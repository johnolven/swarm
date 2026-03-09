import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as spaceService from '../services/space.service';
import * as chatService from '../services/chat.service';
import { isTeamMember } from '../lib/authorize';
import { getIO } from '../sockets';

export async function getSpaceConfig(req: AuthRequest, res: Response) {
  try {
    const { teamId } = req.params;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!(await isTeamMember(teamId, agentId, userId))) {
      return res.status(403).json({ success: false, error: 'Not a team member' });
    }

    const config = await spaceService.getSpaceConfig(teamId);
    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateSpaceConfig(req: AuthRequest, res: Response) {
  try {
    const { teamId } = req.params;
    const { map_key, zones, spawn_x, spawn_y } = req.body;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!(await isTeamMember(teamId, agentId, userId))) {
      return res.status(403).json({ success: false, error: 'Not a team member' });
    }

    const config = await spaceService.updateSpaceConfig(teamId, {
      map_key,
      zones,
      spawn_x,
      spawn_y,
    });
    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getPresence(req: AuthRequest, res: Response) {
  try {
    const { teamId } = req.params;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!(await isTeamMember(teamId, agentId, userId))) {
      return res.status(403).json({ success: false, error: 'Not a team member' });
    }

    const presences = spaceService.getPresence(teamId);
    res.json({ success: true, data: presences });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================================
// AGENT REST API - Space operations via HTTP (Phase 6)
// ============================================================

/**
 * POST /api/teams/:teamId/space/join
 * Agent joins the virtual space (REST alternative to Socket.IO)
 */
export async function joinSpace(req: AuthRequest, res: Response) {
  try {
    const { teamId } = req.params;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!(await isTeamMember(teamId, agentId, userId))) {
      return res.status(403).json({ success: false, error: 'Not a team member' });
    }

    const id = agentId || userId || '';
    const type = req.agent ? 'agent' : 'user';
    const name = req.agent?.name || req.user?.name || 'Unknown';

    const config = await spaceService.getSpaceConfig(teamId);
    const presence = spaceService.joinSpace(
      teamId,
      { id, type, name },
      `rest-${id}`,
      config.spawn_x,
      config.spawn_y
    );

    // Broadcast via Socket.IO
    try {
      const io = getIO();
      io.to(`space:${teamId}`).emit('space:user:joined', { user: presence });
    } catch {
      // Socket.IO may not be initialized
    }

    res.status(201).json({ success: true, data: presence });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/teams/:teamId/space/leave
 * Agent leaves the virtual space
 */
export async function leaveSpace(req: AuthRequest, res: Response) {
  try {
    const { teamId } = req.params;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!(await isTeamMember(teamId, agentId, userId))) {
      return res.status(403).json({ success: false, error: 'Not a team member' });
    }

    const id = agentId || userId || '';
    spaceService.leaveSpace(teamId, id);

    // Broadcast via Socket.IO
    try {
      const io = getIO();
      io.to(`space:${teamId}`).emit('space:user:left', { userId: id });
    } catch {
      // Socket.IO may not be initialized
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/teams/:teamId/space/move
 * Agent moves to a position
 * Body: { x: number, y: number, direction: string }
 */
export async function moveInSpace(req: AuthRequest, res: Response) {
  try {
    const { teamId } = req.params;
    const { x, y, direction } = req.body;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!(await isTeamMember(teamId, agentId, userId))) {
      return res.status(403).json({ success: false, error: 'Not a team member' });
    }

    if (typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({ success: false, error: 'x and y are required numbers' });
    }

    const id = agentId || userId || '';
    spaceService.moveInSpace(teamId, id, x, y, direction || 'down');

    // Broadcast via Socket.IO
    try {
      const io = getIO();
      io.to(`space:${teamId}`).emit('space:user:moved', {
        userId: id,
        x,
        y,
        direction: direction || 'down',
      });
    } catch {
      // Socket.IO may not be initialized
    }

    res.json({ success: true, data: { x, y, direction: direction || 'down' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/teams/:teamId/space/nearby?x=N&y=N
 * Get users near a position (within 5 tiles)
 */
export async function getNearbyUsers(req: AuthRequest, res: Response) {
  try {
    const { teamId } = req.params;
    const x = parseInt(req.query.x as string);
    const y = parseInt(req.query.y as string);
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!(await isTeamMember(teamId, agentId, userId))) {
      return res.status(403).json({ success: false, error: 'Not a team member' });
    }

    if (isNaN(x) || isNaN(y)) {
      return res.status(400).json({ success: false, error: 'x and y query params are required' });
    }

    const nearby = spaceService.getNearbyUsers(teamId, x, y);
    res.json({ success: true, data: nearby });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/teams/:teamId/space/chat
 * Send a chat message in the space (REST alternative to Socket.IO)
 * Body: { content: string, room_id?: string }
 */
export async function sendSpaceChat(req: AuthRequest, res: Response) {
  try {
    const { teamId } = req.params;
    const { content, room_id } = req.body;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!(await isTeamMember(teamId, agentId, userId))) {
      return res.status(403).json({ success: false, error: 'Not a team member' });
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'content is required' });
    }

    const senderType = req.agent ? 'agent' : 'user';
    const senderId = agentId || userId || '';
    const senderName = req.agent?.name || req.user?.name || 'Unknown';

    // Persist if room_id provided
    if (room_id) {
      await chatService.sendMessage(room_id, senderType, senderId, senderName, content);
    }

    const message = {
      sender_id: senderId,
      sender_type: senderType,
      sender_name: senderName,
      content,
      room_id: room_id || null,
      created_at: new Date().toISOString(),
    };

    // Broadcast via Socket.IO
    try {
      const io = getIO();
      io.to(`space:${teamId}`).emit('space:chat:message', { message });
    } catch {
      // Socket.IO may not be initialized
    }

    res.status(201).json({ success: true, data: message });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/teams/:teamId/space/state
 * Set agent state (idle, walking, working, chatting, afk)
 * Body: { state: string }
 */
export async function setSpaceState(req: AuthRequest, res: Response) {
  try {
    const { teamId } = req.params;
    const { state } = req.body;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!(await isTeamMember(teamId, agentId, userId))) {
      return res.status(403).json({ success: false, error: 'Not a team member' });
    }

    const validStates = ['idle', 'walking', 'working', 'chatting', 'afk'];
    if (!state || !validStates.includes(state)) {
      return res.status(400).json({ success: false, error: `state must be one of: ${validStates.join(', ')}` });
    }

    const id = agentId || userId || '';
    spaceService.setUserState(teamId, id, state);

    // Broadcast via Socket.IO
    try {
      const io = getIO();
      io.to(`space:${teamId}`).emit('space:user:state', { userId: id, state });
    } catch {
      // Socket.IO may not be initialized
    }

    res.json({ success: true, data: { state } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/teams/:teamId/space/emote
 * Send an emote in the space
 * Body: { emote: string }
 */
export async function sendEmote(req: AuthRequest, res: Response) {
  try {
    const { teamId } = req.params;
    const { emote } = req.body;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!(await isTeamMember(teamId, agentId, userId))) {
      return res.status(403).json({ success: false, error: 'Not a team member' });
    }

    if (!emote || typeof emote !== 'string') {
      return res.status(400).json({ success: false, error: 'emote is required' });
    }

    const id = agentId || userId || '';

    // Broadcast via Socket.IO
    try {
      const io = getIO();
      io.to(`space:${teamId}`).emit('space:emote', { userId: id, emote });
    } catch {
      // Socket.IO may not be initialized
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
