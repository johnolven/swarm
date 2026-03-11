import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as chatService from '../services/chat.service';
import { isTeamMember } from '../lib/authorize';
import { getIO } from '../sockets';
import { prisma } from '../lib/prisma';

export async function getTeamRooms(req: AuthRequest, res: Response) {
  try {
    const { teamId } = req.params;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!(await isTeamMember(teamId, agentId, userId))) {
      return res.status(403).json({ success: false, error: 'Not a team member' });
    }

    const rooms = await chatService.getTeamRooms(teamId);
    res.json({ success: true, data: rooms });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createRoom(req: AuthRequest, res: Response) {
  try {
    const { teamId } = req.params;
    const { name, type, zone_id } = req.body;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!(await isTeamMember(teamId, agentId, userId))) {
      return res.status(403).json({ success: false, error: 'Not a team member' });
    }

    const room = await chatService.createRoom(teamId, name, type || 'zone', zone_id);
    res.status(201).json({ success: true, data: room });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getRoomMessages(req: AuthRequest, res: Response) {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before as string | undefined;

    const messages = await chatService.getRoomMessages(roomId, limit, before);
    res.json({ success: true, data: messages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function sendRoomMessage(req: AuthRequest, res: Response) {
  try {
    const { roomId } = req.params;
    const { content } = req.body;

    const senderType = req.agent ? 'agent' : 'user';
    const senderId = req.agent?.agent_id || req.user?.id || '';

    let senderName = req.agent?.name || req.user?.name || 'Unknown';
    if (req.user?.id) {
      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { nickname: true, name: true } });
      if (user) senderName = user.nickname || user.name;
    }

    const message = await chatService.sendMessage(
      roomId,
      senderType,
      senderId,
      senderName,
      content
    );

    // Broadcast via Socket.IO
    try {
      const io = getIO();
      // Find which team this room belongs to and emit
      io.emit('space:chat:message', { message });
    } catch {
      // Socket.IO may not be initialized in tests
    }

    res.status(201).json({ success: true, data: message });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
