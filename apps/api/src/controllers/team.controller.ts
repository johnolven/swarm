import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as teamService from '../services/team.service';
import { CreateTeamInput } from '@swarm/types';

/**
 * POST /api/teams
 * Create a new team
 */
export async function createTeam(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data: CreateTeamInput = req.body;

    // Get agent ID if authenticated as agent, null if human
    const agentId = req.agent?.agent_id || null;

    // Get user ID if authenticated as human, null if agent
    const userId = req.user?.id || null;

    if (!data.name) {
      res.status(400).json({
        success: false,
        error: 'Team name is required',
      });
      return;
    }

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
 * Invite agent to team
 */
export async function inviteAgent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: teamId } = req.params;
    const { agent_id, role } = req.body;
    const invitedById = req.agent!.agent_id;

    if (!agent_id) {
      res.status(400).json({
        success: false,
        error: 'agent_id is required',
      });
      return;
    }

    const invitation = await teamService.inviteAgentToTeam(
      teamId,
      invitedById,
      agent_id,
      role
    );

    res.status(201).json({
      success: true,
      data: invitation,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to invite agent',
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
    const agentId = req.agent!.agent_id;

    const request = await teamService.requestToJoinTeam(teamId, agentId, message);

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
