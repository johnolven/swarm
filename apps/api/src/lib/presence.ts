/**
 * In-memory presence manager for spatial spaces.
 * Tracks user/agent positions, zones, and state per team.
 */

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

class PresenceManager {
  // teamId -> userId -> presence
  private presences = new Map<string, Map<string, UserPresence>>();

  join(
    teamId: string,
    user: { id: string; type: 'agent' | 'user'; name: string },
    socketId: string,
    spawnX = 5,
    spawnY = 5
  ): UserPresence {
    if (!this.presences.has(teamId)) {
      this.presences.set(teamId, new Map());
    }
    const teamMap = this.presences.get(teamId)!;

    const presence: UserPresence = {
      id: user.id,
      type: user.type,
      name: user.name,
      x: spawnX,
      y: spawnY,
      direction: 'down',
      state: 'idle',
      current_zone: null,
      current_task_id: null,
      connected_at: Date.now(),
      last_move_at: Date.now(),
      socket_id: socketId,
      avatar: {
        sprite: user.type === 'agent' ? 'agent-default' : 'human-default',
        color: user.type === 'agent' ? '#8b5cf6' : '#3b82f6',
      },
    };

    teamMap.set(user.id, presence);
    return presence;
  }

  leave(teamId: string, userId: string): void {
    this.presences.get(teamId)?.delete(userId);
  }

  leaveBySocketId(socketId: string): { teamId: string; userId: string } | null {
    for (const [teamId, teamMap] of this.presences) {
      for (const [userId, presence] of teamMap) {
        if (presence.socket_id === socketId) {
          teamMap.delete(userId);
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
    }
  }

  setState(teamId: string, userId: string, state: UserPresence['state']): void {
    const presence = this.presences.get(teamId)?.get(userId);
    if (presence) {
      presence.state = state;
    }
  }

  enterZone(teamId: string, userId: string, zoneId: string): void {
    const presence = this.presences.get(teamId)?.get(userId);
    if (presence) {
      presence.current_zone = zoneId;
    }
  }

  leaveZone(teamId: string, userId: string): void {
    const presence = this.presences.get(teamId)?.get(userId);
    if (presence) {
      presence.current_zone = null;
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
