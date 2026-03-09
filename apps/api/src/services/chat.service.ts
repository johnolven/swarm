import { prisma } from '../lib/prisma';

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

export async function getRoomMessages(
  roomId: string,
  limit = 50,
  before?: string
) {
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
