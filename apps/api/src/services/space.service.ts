import { prisma } from '../lib/prisma';
import { presenceManager } from '../lib/presence';

// Default zones matching the frontend MapEditor DEFAULT_ZONES
const DEFAULT_ZONES = [
  { id: 'open-office', name: 'Open Office', type: 'work', x: 1, y: 1, w: 30, h: 18 },
  { id: 'meeting-room', name: 'Meeting Room', type: 'meeting', x: 1, y: 21, w: 12, h: 13 },
  { id: 'lobby', name: 'Lobby', type: 'social', x: 13, y: 21, w: 10, h: 13 },
  { id: 'private-office-1', name: 'Office A', type: 'work', x: 23, y: 21, w: 8, h: 6 },
  { id: 'private-office-2', name: 'Office B', type: 'work', x: 23, y: 27, w: 8, h: 7 },
];

export async function getSpaceConfig(teamId: string) {
  let config = await prisma.spaceConfig.findUnique({
    where: { team_id: teamId },
  });
  if (!config) {
    config = await prisma.spaceConfig.create({
      data: { team_id: teamId, zones: DEFAULT_ZONES },
    });
  }
  // If zones are empty, return default zones
  const zones = config.zones as any[];
  if (!zones || (Array.isArray(zones) && zones.length === 0)) {
    return { ...config, zones: DEFAULT_ZONES };
  }
  return config;
}

export async function updateSpaceConfig(
  teamId: string,
  data: {
    map_key?: string;
    zones?: any;
    spawn_x?: number;
    spawn_y?: number;
    map_cols?: number;
    map_rows?: number;
    tile_size?: number;
    collision_grid?: string;
    background_image?: string;
  }
) {
  return prisma.spaceConfig.upsert({
    where: { team_id: teamId },
    update: data,
    create: { team_id: teamId, ...data },
  });
}

export function getPresence(teamId: string) {
  return presenceManager.getTeamPresences(teamId);
}

export async function joinSpace(
  teamId: string,
  user: { id: string; type: 'agent' | 'user'; name: string; avatar_id?: number },
  socketId: string,
  spawnX?: number,
  spawnY?: number
) {
  return presenceManager.join(teamId, user, socketId, spawnX, spawnY);
}

export function leaveSpace(teamId: string, userId: string) {
  presenceManager.leave(teamId, userId);
}

export function moveInSpace(
  teamId: string,
  userId: string,
  x: number,
  y: number,
  direction: 'up' | 'down' | 'left' | 'right'
) {
  presenceManager.move(teamId, userId, x, y, direction);
}

export function setUserState(
  teamId: string,
  userId: string,
  state: 'idle' | 'walking' | 'working' | 'chatting' | 'afk'
) {
  presenceManager.setState(teamId, userId, state);
}

export function getNearbyUsers(teamId: string, x: number, y: number) {
  return presenceManager.getNearbyUsers(teamId, x, y);
}

export function enterZone(teamId: string, userId: string, zoneId: string) {
  presenceManager.enterZone(teamId, userId, zoneId);
}

export function leaveZone(teamId: string, userId: string) {
  presenceManager.leaveZone(teamId, userId);
}
