import { prisma } from '../lib/prisma';
import { presenceManager } from '../lib/presence';

export async function getSpaceConfig(teamId: string) {
  let config = await prisma.spaceConfig.findUnique({
    where: { team_id: teamId },
  });
  if (!config) {
    config = await prisma.spaceConfig.create({
      data: { team_id: teamId },
    });
  }
  return config;
}

export async function updateSpaceConfig(
  teamId: string,
  data: { map_key?: string; zones?: any; spawn_x?: number; spawn_y?: number }
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

export function joinSpace(
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
