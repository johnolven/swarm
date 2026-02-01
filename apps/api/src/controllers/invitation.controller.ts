import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as invitationService from '../services/invitation.service';
import * as webhookService from '../services/webhook.service';

/**
 * GET /api/invitations
 * Get all invitations for the authenticated agent
 */
export async function getInvitations(req: AuthRequest, res: Response): Promise<void> {
  try {
    const agentId = req.agent!.agent_id;
    const invitations = await invitationService.getAgentInvitations(agentId);

    res.json({
      success: true,
      data: invitations,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch invitations',
    });
  }
}

/**
 * POST /api/invitations/:id/accept
 * Accept invitation
 */
export async function acceptInvitation(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const agentId = req.agent!.agent_id;

    const invitation = await invitationService.acceptInvitation(id, agentId);

    // Notify team
    await webhookService.notifyTeamMembers(
      invitation.team_id,
      'team.join_approved',
      {
        agent_name: req.agent!.name,
        agent_id: agentId,
      },
      agentId
    );

    res.json({
      success: true,
      data: invitation,
      message: 'Invitation accepted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to accept invitation',
    });
  }
}

/**
 * POST /api/invitations/:id/decline
 * Decline invitation
 */
export async function declineInvitation(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const agentId = req.agent!.agent_id;

    const invitation = await invitationService.declineInvitation(id, agentId);

    res.json({
      success: true,
      data: invitation,
      message: 'Invitation declined',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to decline invitation',
    });
  }
}

/**
 * GET /api/teams/:teamId/join-requests
 * Get pending join requests for a team
 */
export async function getJoinRequests(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { teamId } = req.params;
    const agentId = req.agent!.agent_id;

    const requests = await invitationService.getTeamJoinRequests(teamId, agentId);

    res.json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to fetch join requests',
    });
  }
}

/**
 * POST /api/join-requests/:id/approve
 * Approve join request
 */
export async function approveJoinRequest(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const agentId = req.agent!.agent_id;

    const request = await invitationService.approveJoinRequest(id, agentId);

    // Notify the agent who requested
    await webhookService.sendWebhookEvent(
      request.agent_id,
      'team.join_approved',
      {
        team_id: request.team_id,
        approved_by: req.agent!.name,
      }
    );

    res.json({
      success: true,
      data: request,
      message: 'Join request approved',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to approve request',
    });
  }
}

/**
 * POST /api/join-requests/:id/reject
 * Reject join request
 */
export async function rejectJoinRequest(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const agentId = req.agent!.agent_id;

    const request = await invitationService.rejectJoinRequest(id, agentId);

    res.json({
      success: true,
      data: request,
      message: 'Join request rejected',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to reject request',
    });
  }
}
