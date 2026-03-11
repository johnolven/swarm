import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as teamService from '../services/team.service';
import { CreateTeamInput } from '@swarm/types';
import { createTeamSchema, inviteSchema, validate } from '../lib/validation';

/**
 * POST /api/teams
 * Create a new team
 */
export async function createTeam(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = validate(createTeamSchema, req.body);
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    const team = await teamService.createTeam(agentId, userId, data);

    res.status(201).json({
      success: true,
      data: team,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create team',
    });
  }
}

/**
 * GET /api/teams
 * Get all teams
 */
export async function getTeams(req: AuthRequest, res: Response): Promise<void> {
  try {
    const agentId = req.agent?.agent_id;
    const userId = req.user?.id;
    const teams = await teamService.getTeams(agentId, userId);

    res.json({
      success: true,
      data: teams,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch teams',
    });
  }
}

/**
 * GET /api/teams/:id
 * Get team by ID
 */
export async function getTeamById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const team = await teamService.getTeamById(id);

    if (!team) {
      res.status(404).json({
        success: false,
        error: 'Team not found',
      });
      return;
    }

    res.json({
      success: true,
      data: team,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch team',
    });
  }
}

/**
 * PUT /api/teams/:id
 * Update team
 */
export async function updateTeam(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;
    const data: Partial<CreateTeamInput> = req.body;

    const team = await teamService.updateTeam(id, agentId, userId, data);

    res.json({
      success: true,
      data: team,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update team',
    });
  }
}

/**
 * POST /api/teams/:id/invite
 * Invite agent or human to team
 */
export async function inviteAgent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: teamId } = req.params;
    const data = validate(inviteSchema, req.body);
    const invitedById = req.agent?.agent_id || null;
    const invitedByUserId = req.user?.id || null;

    const invitation = await teamService.inviteAgentToTeam(
      teamId,
      invitedById,
      invitedByUserId,
      data.agent_id,
      data.user_email,
      data.role
    );

    res.status(201).json({
      success: true,
      data: invitation,
      message: data.agent_id
        ? 'Agent invitation sent successfully'
        : 'Human invitation sent successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to send invitation',
    });
  }
}

/**
 * POST /api/teams/:id/join
 * Request to join team
 */
export async function requestJoin(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: teamId } = req.params;
    const { message } = req.body;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    if (!agentId && !userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const request = await teamService.requestToJoinTeam(teamId, agentId, userId, message);

    res.status(201).json({
      success: true,
      data: request,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to request join',
    });
  }
}

/**
 * DELETE /api/teams/:id/members/:agentId
 * Remove agent from team
 */
export async function removeMember(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: teamId, agentId: agentIdToRemove } = req.params;
    const removedById = req.agent!.agent_id;

    await teamService.removeAgentFromTeam(teamId, agentIdToRemove, removedById);

    res.json({
      success: true,
      message: 'Agent removed from team',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to remove agent',
    });
  }
}

/**
 * DELETE /api/teams/:id
 * Delete team
 */
export async function deleteTeam(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const agentId = req.agent?.agent_id || null;
    const userId = req.user?.id || null;

    await teamService.deleteTeam(id, agentId, userId);

    res.json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete team',
    });
  }
}
