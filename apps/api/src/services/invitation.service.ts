import { prisma } from '../lib/prisma';

/**
 * Get all invitations for an agent or user
 */
export async function getInvitations(agentId: string | null, userId: string | null): Promise<any[]> {
  const whereClause: any = {
    status: 'pending',
  };

  if (agentId) {
    whereClause.agent_id = agentId;
  } else if (userId) {
    // For now, invitations are only for agents
    // When we add user invitations, we'll add user_id field
    return [];
  }

  return await prisma.teamInvitation.findMany({
    where: whereClause,
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
    orderBy: { invited_at: 'desc' },
  });
}

/**
 * Accept invitation
 */
export async function acceptInvitation(
  invitationId: string,
  agentId: string | null,
  userId: string | null
): Promise<any> {
  return await prisma.$transaction(async (tx) => {
    // Get invitation
    const invitation = await tx.teamInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    // Verify ownership
    if (agentId && invitation.agent_id !== agentId) {
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

    // Add agent to team (only if agent invitation)
    if (agentId && invitation.agent_id) {
      await tx.teamMember.create({
        data: {
          team_id: invitation.team_id,
          agent_id: agentId,
          role: invitation.role || 'member',
        },
      });
    }

    return updatedInvitation;
  });
}

/**
 * Decline invitation
 */
export async function declineInvitation(
  invitationId: string,
  agentId: string | null,
  userId: string | null
): Promise<any> {
  const invitation = await prisma.teamInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  // Verify ownership
  if (agentId && invitation.agent_id !== agentId) {
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
  agentId: string | null,
  userId: string | null
): Promise<any[]> {
  // Verify authorization
  let isAuthorized = false;

  if (agentId) {
    const member = await prisma.teamMember.findFirst({
      where: {
        team_id: teamId,
        agent_id: agentId,
        role: { in: ['owner', 'admin'] },
      },
    });
    isAuthorized = !!member;
  }

  if (userId) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });
    isAuthorized = team?.created_by_user === userId;
  }

  if (!isAuthorized) {
    throw new Error('Only team admins/creators can view join requests');
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
  agentId: string | null,
  userId: string | null
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

    // Verify authorization
    let isAuthorized = false;

    if (agentId) {
      const member = await tx.teamMember.findFirst({
        where: {
          team_id: request.team_id,
          agent_id: agentId,
          role: { in: ['owner', 'admin'] },
        },
      });
      isAuthorized = !!member;
    }

    if (userId) {
      const team = await tx.team.findUnique({
        where: { id: request.team_id },
      });
      isAuthorized = team?.created_by_user === userId;
    }

    if (!isAuthorized) {
      throw new Error('Only team admins/creators can approve requests');
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
  agentId: string | null,
  userId: string | null
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

  // Verify authorization
  let isAuthorized = false;

  if (agentId) {
    const member = await prisma.teamMember.findFirst({
      where: {
        team_id: request.team_id,
        agent_id: agentId,
        role: { in: ['owner', 'admin'] },
      },
    });
    isAuthorized = !!member;
  }

  if (userId) {
    const team = await prisma.team.findUnique({
      where: { id: request.team_id },
    });
    isAuthorized = team?.created_by_user === userId;
  }

  if (!isAuthorized) {
    throw new Error('Only team admins/creators can reject requests');
  }

  return await prisma.joinRequest.update({
    where: { id: requestId },
    data: {
      status: 'rejected',
      resolved_at: new Date(),
    },
  });
}
