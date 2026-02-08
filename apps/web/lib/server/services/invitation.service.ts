import { prisma } from '../prisma';

export async function getInvitations(agentId: string | null, userId: string | null): Promise<any[]> {
  const whereClause: any = { status: 'pending' };
  if (agentId) whereClause.agent_id = agentId;
  else if (userId) return [];

  return await prisma.teamInvitation.findMany({
    where: whereClause,
    include: {
      team: { include: { members: { include: { agent: { select: { id: true, name: true } } } } } },
    },
    orderBy: { invited_at: 'desc' },
  });
}

export async function acceptInvitation(invitationId: string, agentId: string | null, _userId: string | null): Promise<any> {
  return await prisma.$transaction(async (tx: any) => {
    const invitation = await tx.teamInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation) throw new Error('Invitation not found');
    if (agentId && invitation.agent_id !== agentId) throw new Error('This invitation is not for you');
    if (invitation.status !== 'pending') throw new Error('Invitation already processed');

    const updatedInvitation = await tx.teamInvitation.update({
      where: { id: invitationId },
      data: { status: 'accepted', responded_at: new Date() },
    });

    if (agentId && invitation.agent_id) {
      await tx.teamMember.create({
        data: { team_id: invitation.team_id, agent_id: agentId, role: invitation.role || 'member' },
      });
    }

    return updatedInvitation;
  });
}

export async function declineInvitation(invitationId: string, agentId: string | null, _userId: string | null): Promise<any> {
  const invitation = await prisma.teamInvitation.findUnique({ where: { id: invitationId } });
  if (!invitation) throw new Error('Invitation not found');
  if (agentId && invitation.agent_id !== agentId) throw new Error('This invitation is not for you');
  if (invitation.status !== 'pending') throw new Error('Invitation already processed');

  return await prisma.teamInvitation.update({
    where: { id: invitationId },
    data: { status: 'rejected', responded_at: new Date() },
  });
}

export async function getTeamJoinRequests(teamId: string, agentId: string | null, userId: string | null): Promise<any[]> {
  let isAuthorized = false;
  if (agentId) {
    const member = await prisma.teamMember.findFirst({
      where: { team_id: teamId, agent_id: agentId, role: { in: ['owner', 'admin'] } },
    });
    isAuthorized = !!member;
  }
  if (userId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    isAuthorized = team?.created_by_user === userId;
  }
  if (!isAuthorized) throw new Error('Only team admins/creators can view join requests');

  return await prisma.joinRequest.findMany({
    where: { team_id: teamId, status: 'pending' },
    include: {
      agent: { select: { id: true, name: true, description: true, capabilities: true, personality: true } },
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function approveJoinRequest(requestId: string, agentId: string | null, userId: string | null): Promise<any> {
  return await prisma.$transaction(async (tx: any) => {
    const request = await tx.joinRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Request not found');
    if (request.status !== 'pending') throw new Error('Request already processed');

    let isAuthorized = false;
    if (agentId) {
      const member = await tx.teamMember.findFirst({
        where: { team_id: request.team_id, agent_id: agentId, role: { in: ['owner', 'admin'] } },
      });
      isAuthorized = !!member;
    }
    if (userId) {
      const team = await tx.team.findUnique({ where: { id: request.team_id } });
      isAuthorized = team?.created_by_user === userId;
    }
    if (!isAuthorized) throw new Error('Only team admins/creators can approve requests');

    const updatedRequest = await tx.joinRequest.update({
      where: { id: requestId },
      data: { status: 'approved', resolved_at: new Date() },
    });

    await tx.teamMember.create({
      data: { team_id: request.team_id, agent_id: request.agent_id, role: 'member' },
    });

    return updatedRequest;
  });
}

export async function rejectJoinRequest(requestId: string, agentId: string | null, userId: string | null): Promise<any> {
  const request = await prisma.joinRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error('Request not found');
  if (request.status !== 'pending') throw new Error('Request already processed');

  let isAuthorized = false;
  if (agentId) {
    const member = await prisma.teamMember.findFirst({
      where: { team_id: request.team_id, agent_id: agentId, role: { in: ['owner', 'admin'] } },
    });
    isAuthorized = !!member;
  }
  if (userId) {
    const team = await prisma.team.findUnique({ where: { id: request.team_id } });
    isAuthorized = team?.created_by_user === userId;
  }
  if (!isAuthorized) throw new Error('Only team admins/creators can reject requests');

  return await prisma.joinRequest.update({
    where: { id: requestId },
    data: { status: 'rejected', resolved_at: new Date() },
  });
}
