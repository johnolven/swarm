import { prisma } from '../lib/prisma';

/**
 * Get all invitations for an agent
 */
export async function getAgentInvitations(agentId: string): Promise<any[]> {
  return await prisma.teamInvitation.findMany({
    where: {
      agent_id: agentId,
      status: 'pending',
    },
    include: {
      team: {
        include: {
          members: {
            include: {
              agent: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });
}

/**
 * Accept invitation
 */
export async function acceptInvitation(
  invitationId: string,
  agentId: string
): Promise<any> {
  return await prisma.$transaction(async (tx) => {
    // Get invitation
    const invitation = await tx.teamInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.agent_id !== agentId) {
      throw new Error('This invitation is not for you');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation already processed');
    }

    // Update invitation status
    const updatedInvitation = await tx.teamInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'accepted',
        responded_at: new Date(),
      },
    });

    // Add agent to team
    await tx.teamMember.create({
      data: {
        team_id: invitation.team_id,
        agent_id: agentId,
        role: invitation.role || 'member',
      },
    });

    return updatedInvitation;
  });
}

/**
 * Decline invitation
 */
export async function declineInvitation(
  invitationId: string,
  agentId: string
): Promise<any> {
  const invitation = await prisma.teamInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.agent_id !== agentId) {
    throw new Error('This invitation is not for you');
  }

  if (invitation.status !== 'pending') {
    throw new Error('Invitation already processed');
  }

  return await prisma.teamInvitation.update({
    where: { id: invitationId },
    data: {
      status: 'rejected',
      responded_at: new Date(),
    },
  });
}

/**
 * Get pending join requests for a team
 */
export async function getTeamJoinRequests(
  teamId: string,
  agentId: string
): Promise<any[]> {
  // Verify agent is team admin
  const member = await prisma.teamMember.findFirst({
    where: {
      team_id: teamId,
      agent_id: agentId,
      role: { in: ['owner', 'admin'] },
    },
  });

  if (!member) {
    throw new Error('Only team admins can view join requests');
  }

  return await prisma.joinRequest.findMany({
    where: {
      team_id: teamId,
      status: 'pending',
    },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          description: true,
          capabilities: true,
          personality: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });
}

/**
 * Approve join request
 */
export async function approveJoinRequest(
  requestId: string,
  approverId: string
): Promise<any> {
  return await prisma.$transaction(async (tx) => {
    // Get request
    const request = await tx.joinRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Request already processed');
    }

    // Verify approver is team admin
    const member = await tx.teamMember.findFirst({
      where: {
        team_id: request.team_id,
        agent_id: approverId,
        role: { in: ['owner', 'admin'] },
      },
    });

    if (!member) {
      throw new Error('Only team admins can approve requests');
    }

    // Update request
    const updatedRequest = await tx.joinRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        resolved_at: new Date(),
      },
    });

    // Add agent to team
    await tx.teamMember.create({
      data: {
        team_id: request.team_id,
        agent_id: request.agent_id,
        role: 'member',
      },
    });

    return updatedRequest;
  });
}

/**
 * Reject join request
 */
export async function rejectJoinRequest(
  requestId: string,
  rejecterId: string
): Promise<any> {
  const request = await prisma.joinRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error('Request not found');
  }

  if (request.status !== 'pending') {
    throw new Error('Request already processed');
  }

  // Verify rejecter is team admin
  const member = await prisma.teamMember.findFirst({
    where: {
      team_id: request.team_id,
      agent_id: rejecterId,
      role: { in: ['owner', 'admin'] },
    },
  });

  if (!member) {
    throw new Error('Only team admins can reject requests');
  }

  return await prisma.joinRequest.update({
    where: { id: requestId },
    data: {
      status: 'rejected',
      resolved_at: new Date(),
    },
  });
}
