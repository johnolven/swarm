import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as spaceService from '../services/space.service';
import * as chatService from '../services/chat.service';
import { isTeamMember } from '../lib/authorize';
import { getIO } from '../sockets';
import { prisma } from '../lib/prisma';

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
    const { map_key, zones, spawn_x, spawn_y, map_cols, map_rows, tile_size, collision_grid, background_image } = req.body;
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
      map_cols,
      map_rows,
      tile_size,
      collision_grid,
      background_image,
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

    // Auto-join public teams if not yet an explicit member
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { visibility: true } });
    if (team?.visibility === 'public') {
      const memberWhere: any = { team_id: teamId };
      if (agentId) memberWhere.agent_id = agentId;
      else memberWhere.user_id = userId;
      const existing = await prisma.teamMember.findFirst({ where: memberWhere });
      if (!existing) {
        const memberData: any = { team_id: teamId, role: 'member' };
        if (agentId) memberData.agent_id = agentId;
        else memberData.user_id = userId;
        await prisma.teamMember.create({ data: memberData });
      }
    }

    const id = agentId || userId || '';
    const type = req.agent ? 'agent' : 'user';

    // Look up nickname and avatar_id from DB
    let displayName = req.agent?.name || req.user?.name || 'Unknown';
    let avatarId = 1;

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { nickname: true, avatar_id: true, name: true } });
      if (user) {
        displayName = user.nickname || user.name;
        avatarId = user.avatar_id;
      }
    } else if (agentId) {
      const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { name: true, avatar_id: true } });
      if (agent) {
        displayName = agent.name;
        avatarId = agent.avatar_id;
      }
    }

    const config = await spaceService.getSpaceConfig(teamId);
    const presence = await spaceService.joinSpace(
      teamId,
      { id, type, name: displayName, avatar_id: avatarId },
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

    // Build enriched response: who's here, zones, profiles, tasks
    const allPresences = spaceService.getPresence(teamId);

    // Zone definitions with center coordinates
    const zones = (config.zones as any[] || []).map((z: any) => ({
      id: z.id,
      name: z.name,
      type: z.type,
      x: z.x,
      y: z.y,
      w: z.w,
      h: z.h,
      center_x: Math.round(z.x + z.w / 2),
      center_y: Math.round(z.y + z.h / 2),
    }));

    // Fetch profiles (descriptions/capabilities) for all present users/agents
    const agentIds = allPresences.filter(p => p.type === 'agent').map(p => p.id);
    const userIds = allPresences.filter(p => p.type === 'user').map(p => p.id);

    const [agents, users, tasks] = await Promise.all([
      agentIds.length > 0
        ? prisma.agent.findMany({
            where: { id: { in: agentIds } },
            select: { id: true, name: true, capabilities: true, personality: true },
          })
        : Promise.resolve([]),
      userIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, nickname: true },
          })
        : Promise.resolve([]),
      // Fetch tasks assigned to present users/agents in this team
      prisma.task.findMany({
        where: {
          team_id: teamId,
          assigned_to_id: { in: [...agentIds, ...userIds] },
          completed_at: null,
        },
        select: {
          id: true,
          title: true,
          priority: true,
          column_id: true,
          assigned_to_id: true,
          status: true,
        },
      }),
    ]);

    // Build profile map
    const profileMap: Record<string, any> = {};
    for (const a of agents) {
      profileMap[a.id] = { capabilities: a.capabilities, personality: a.personality };
    }
    for (const u of users) {
      profileMap[u.id] = { nickname: u.nickname };
    }

    // Group tasks by assigned user
    const tasksByUser: Record<string, any[]> = {};
    for (const t of tasks) {
      if (t.assigned_to_id) {
        if (!tasksByUser[t.assigned_to_id]) tasksByUser[t.assigned_to_id] = [];
        tasksByUser[t.assigned_to_id].push({
          id: t.id,
          title: t.title,
          priority: t.priority,
          status: t.status,
          column_id: t.column_id,
        });
      }
    }

    // Enrich presences with profile + tasks
    const members = allPresences.map(p => ({
      ...p,
      profile: profileMap[p.id] || null,
      tasks: tasksByUser[p.id] || [],
    }));

    res.status(201).json({
      success: true,
      data: {
        self: presence,
        members,
        zones,
      },
    });
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

    // Auto-detect zone from coordinates
    const config = await spaceService.getSpaceConfig(teamId);
    const zones = (config.zones as any[]) || [];
    const prevZone = spaceService.getPresence(teamId).find(p => p.id === id)?.current_zone;
    let newZone: string | null = null;
    for (const z of zones) {
      if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) {
        newZone = z.id;
        break;
      }
    }
    if (newZone !== prevZone) {
      if (prevZone) spaceService.leaveZone(teamId, id);
      if (newZone) spaceService.enterZone(teamId, id, newZone);
    }

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

    res.json({ success: true, data: { x, y, direction: direction || 'down', zone: newZone } });
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

    // Look up nickname for users
    let senderName = req.agent?.name || req.user?.name || 'Unknown';
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { nickname: true, name: true } });
      if (user) senderName = user.nickname || user.name;
    }

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
