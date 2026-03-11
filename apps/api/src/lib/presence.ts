/**
 * Presence manager with MongoDB persistence.
 * Uses in-memory Map for fast reads, writes through to DB so presence survives redeploys.
 */

import { prisma } from './prisma';

export interface UserPresence {
  id: string;
  type: 'agent' | 'user';
  name: string;
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  state: 'idle' | 'walking' | 'working' | 'chatting' | 'afk';
  current_zone: string | null;
  current_task_id: string | null;
  connected_at: number;
  last_move_at: number;
  socket_id: string;
  avatar: {
    sprite: string;
    color: string;
  };
}

const PROXIMITY_RADIUS = 5; // tiles

// Distinct colors for agents so each one looks different
const AGENT_COLORS = [
  '#8b5cf6', // violet
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#ec4899', // pink
  '#14b8a6', // teal
  '#a855f7', // purple
  '#f43f5e', // rose
  '#84cc16', // lime
];

function pickColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

// Map is 32x34 tiles. Spawn in a safe inner zone away from edges.
const SPAWN_MIN_X = 5;
const SPAWN_MAX_X = 27;
const SPAWN_MIN_Y = 5;
const SPAWN_MAX_Y = 29;
const DIRECTIONS: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];

function randomSpawn(): { x: number; y: number; direction: 'up' | 'down' | 'left' | 'right' } {
  return {
    x: SPAWN_MIN_X + Math.floor(Math.random() * (SPAWN_MAX_X - SPAWN_MIN_X + 1)),
    y: SPAWN_MIN_Y + Math.floor(Math.random() * (SPAWN_MAX_Y - SPAWN_MIN_Y + 1)),
    direction: DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)],
  };
}

class PresenceManager {
  // teamId -> userId -> presence
  private presences = new Map<string, Map<string, UserPresence>>();
  private loaded = false;

  /**
   * Load all persisted presences from MongoDB on startup.
   */
  async loadFromDB(): Promise<void> {
    if (this.loaded) return;
    try {
      const rows = await prisma.spacePresence.findMany();
      for (const row of rows) {
        if (!this.presences.has(row.team_id)) {
          this.presences.set(row.team_id, new Map());
        }
        const teamMap = this.presences.get(row.team_id)!;
        teamMap.set(row.user_id, {
          id: row.user_id,
          type: row.type as UserPresence['type'],
          name: row.name,
          x: row.x,
          y: row.y,
          direction: row.direction as UserPresence['direction'],
          state: row.state as UserPresence['state'],
          current_zone: row.current_zone,
          current_task_id: row.current_task_id,
          connected_at: row.connected_at.getTime(),
          last_move_at: row.last_move_at.getTime(),
          socket_id: `restored-${row.user_id}`,
          avatar: {
            sprite: row.avatar_sprite,
            color: row.avatar_color,
          },
        });
      }
      this.loaded = true;
      console.log(`[presence] Loaded ${rows.length} presences from DB`);
    } catch (err: any) {
      console.error('[presence] Failed to load from DB:', err?.message);
    }
  }

  async join(
    teamId: string,
    user: { id: string; type: 'agent' | 'user'; name: string; avatar_id?: number },
    socketId: string,
    spawnX = 5,
    spawnY = 5
  ): Promise<UserPresence> {
    if (!this.presences.has(teamId)) {
      this.presences.set(teamId, new Map());
    }
    const teamMap = this.presences.get(teamId)!;

    const avatarId = user.avatar_id || 1;
    const padded = String(avatarId).padStart(3, '0');

    // Try to restore last known position from DB
    let pos = randomSpawn();
    try {
      const saved = await prisma.spacePresence.findUnique({
        where: { team_id_user_id: { team_id: teamId, user_id: user.id } },
      });
      if (saved) {
        pos = {
          x: saved.x,
          y: saved.y,
          direction: (saved.direction as typeof pos.direction) || pos.direction,
        };
      }
    } catch { /* use random spawn */ }

    const presence: UserPresence = {
      id: user.id,
      type: user.type,
      name: user.name,
      x: pos.x,
      y: pos.y,
      direction: pos.direction,
      state: 'idle',
      current_zone: null,
      current_task_id: null,
      connected_at: Date.now(),
      last_move_at: Date.now(),
      socket_id: socketId,
      avatar: {
        sprite: `Character_${padded}`,
        color: pickColor(user.id),
      },
    };

    teamMap.set(user.id, presence);

    // Persist to DB (fire-and-forget)
    prisma.spacePresence.upsert({
      where: { team_id_user_id: { team_id: teamId, user_id: user.id } },
      update: {
        type: user.type,
        name: user.name,
        direction: pos.direction,
        state: 'idle',
        connected_at: new Date(),
        last_move_at: new Date(),
        avatar_sprite: presence.avatar.sprite,
        avatar_color: presence.avatar.color,
      },
      create: {
        team_id: teamId,
        user_id: user.id,
        type: user.type,
        name: user.name,
        x: pos.x,
        y: pos.y,
        direction: pos.direction,
        avatar_sprite: presence.avatar.sprite,
        avatar_color: presence.avatar.color,
      },
    }).catch((err: any) => console.error('[presence] DB upsert failed:', err?.message));

    return presence;
  }

  leave(teamId: string, userId: string): void {
    this.presences.get(teamId)?.delete(userId);

    // Remove from DB
    prisma.spacePresence.deleteMany({
      where: { team_id: teamId, user_id: userId },
    }).catch((err: any) => console.error('[presence] DB delete failed:', err?.message));
  }

  leaveBySocketId(socketId: string): { teamId: string; userId: string } | null {
    for (const [teamId, teamMap] of this.presences) {
      for (const [userId, presence] of teamMap) {
        if (presence.socket_id === socketId) {
          teamMap.delete(userId);

          // Remove from DB
          prisma.spacePresence.deleteMany({
            where: { team_id: teamId, user_id: userId },
          }).catch((err: any) => console.error('[presence] DB delete failed:', err?.message));

          return { teamId, userId };
        }
      }
    }
    return null;
  }

  move(
    teamId: string,
    userId: string,
    x: number,
    y: number,
    direction: 'up' | 'down' | 'left' | 'right'
  ): void {
    const presence = this.presences.get(teamId)?.get(userId);
    if (presence) {
      presence.x = x;
      presence.y = y;
      presence.direction = direction;
      presence.last_move_at = Date.now();

      // Persist position (fire-and-forget)
      prisma.spacePresence.updateMany({
        where: { team_id: teamId, user_id: userId },
        data: { x, y, direction, last_move_at: new Date() },
      }).catch((err: any) => console.error('[presence] DB move update failed:', err?.message));
    }
  }

  setState(teamId: string, userId: string, state: UserPresence['state']): void {
    const presence = this.presences.get(teamId)?.get(userId);
    if (presence) {
      presence.state = state;

      // Persist state
      prisma.spacePresence.updateMany({
        where: { team_id: teamId, user_id: userId },
        data: { state },
      }).catch((err: any) => console.error('[presence] DB state update failed:', err?.message));
    }
  }

  enterZone(teamId: string, userId: string, zoneId: string): void {
    const presence = this.presences.get(teamId)?.get(userId);
    if (presence) {
      presence.current_zone = zoneId;

      prisma.spacePresence.updateMany({
        where: { team_id: teamId, user_id: userId },
        data: { current_zone: zoneId },
      }).catch((err: any) => console.error('[presence] DB zone update failed:', err?.message));
    }
  }

  leaveZone(teamId: string, userId: string): void {
    const presence = this.presences.get(teamId)?.get(userId);
    if (presence) {
      presence.current_zone = null;

      prisma.spacePresence.updateMany({
        where: { team_id: teamId, user_id: userId },
        data: { current_zone: null },
      }).catch((err: any) => console.error('[presence] DB zone update failed:', err?.message));
    }
  }

  getPresence(teamId: string, userId: string): UserPresence | undefined {
    return this.presences.get(teamId)?.get(userId);
  }

  getTeamPresences(teamId: string): UserPresence[] {
    const teamMap = this.presences.get(teamId);
    return teamMap ? Array.from(teamMap.values()) : [];
  }

  getNearbyUsers(teamId: string, x: number, y: number): UserPresence[] {
    return this.getTeamPresences(teamId).filter((p) => {
      const dx = p.x - x;
      const dy = p.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= PROXIMITY_RADIUS;
    });
  }

  getUsersInZone(teamId: string, zoneId: string): UserPresence[] {
    return this.getTeamPresences(teamId).filter(
      (p) => p.current_zone === zoneId
    );
  }

  getOnlineCount(teamId: string): number {
    return this.presences.get(teamId)?.size ?? 0;
  }
}

export const presenceManager = new PresenceManager();
