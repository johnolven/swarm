import { prisma } from '../prisma';

export async function getTeamRooms(teamId: string) {
  return prisma.chatRoom.findMany({
    where: { team_id: teamId },
    orderBy: { created_at: 'asc' },
  });
}

export async function createRoom(teamId: string, name: string, type: string, zoneId?: string) {
  return prisma.chatRoom.create({
    data: {
      team_id: teamId,
      name,
      type,
      zone_id: zoneId,
    },
  });
}

export async function getOrCreateGeneralRoom(teamId: string) {
  let room = await prisma.chatRoom.findFirst({
    where: { team_id: teamId, type: 'general' },
  });
  if (!room) {
    room = await prisma.chatRoom.create({
      data: { team_id: teamId, name: 'General', type: 'general' },
    });
  }
  return room;
}

export async function getRoomMessages(roomId: string, limit = 50, before?: string) {
  return prisma.chatMessage.findMany({
    where: {
      room_id: roomId,
      ...(before ? { created_at: { lt: new Date(before) } } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: limit,
  });
}

export async function sendMessage(
  roomId: string,
  senderType: string,
  senderId: string,
  senderName: string,
  content: string,
  type = 'message'
) {
  return prisma.chatMessage.create({
    data: {
      room_id: roomId,
      sender_type: senderType,
      sender_id: senderId,
      sender_name: senderName,
      content,
      type,
    },
  });
}

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
