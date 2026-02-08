import { prisma } from '../prisma';
import { Team, CreateTeamInput } from '@swarm/types';

export async function createTeam(
  agentId: string | null,
  userId: string | null,
  data: CreateTeamInput
): Promise<Team> {
  return await prisma.$transaction(async (tx: any) => {
    const team = await tx.team.create({
      data: {
        name: data.name,
        description: data.description,
        visibility: data.visibility || 'public',
        auto_accept: data.auto_accept || false,
        created_by: agentId,
        created_by_user: userId,
      },
    });

    if (agentId) {
      await tx.teamMember.create({
        data: { team_id: team.id, agent_id: agentId, role: 'owner' },
      });
    }

    return team;
  });
}

export async function getTeams(agentId?: string, userId?: string): Promise<Team[]> {
  const whereConditions: any[] = [{ visibility: 'public' }];
  if (agentId) whereConditions.push({ members: { some: { agent_id: agentId } } });
  if (userId) whereConditions.push({ created_by_user: userId });

  return await prisma.team.findMany({
    where: { OR: whereConditions },
    include: {
      members: {
        include: {
          agent: { select: { id: true, name: true, capabilities: true, is_active: true } },
        },
      },
      _count: { select: { tasks: true, members: true } },
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  return await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          agent: {
            select: { id: true, name: true, description: true, capabilities: true, personality: true, is_active: true, created_at: true },
          },
        },
      },
      tasks: { orderBy: { created_at: 'desc' }, take: 20 },
      invitations: { where: { status: 'pending' } },
    },
  });
}

export async function updateTeam(
  teamId: string, agentId: string | null, userId: string | null, data: Partial<CreateTeamInput>
): Promise<Team> {
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
  if (!isAuthorized) throw new Error('Only team admins can update team settings');

  return await prisma.team.update({
    where: { id: teamId },
    data: { name: data.name, description: data.description, visibility: data.visibility, auto_accept: data.auto_accept },
  });
}

export async function inviteAgentToTeam(
  teamId: string, invitedById: string | null, invitedByUserId: string | null,
  invitedAgentId?: string, invitedUserEmail?: string, role: string = 'member'
): Promise<any> {
  let isAuthorized = false;
  if (invitedById) {
    const inviter = await prisma.teamMember.findFirst({
      where: { team_id: teamId, agent_id: invitedById, role: { in: ['owner', 'admin'] } },
    });
    isAuthorized = !!inviter;
  }
  if (invitedByUserId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    isAuthorized = team?.created_by_user === invitedByUserId;
  }
  if (!isAuthorized) throw new Error('Only team admins/creators can invite members');

  if (invitedAgentId) {
    const existingMember = await prisma.teamMember.findFirst({ where: { team_id: teamId, agent_id: invitedAgentId } });
    if (existingMember) throw new Error('Agent is already a team member');
    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: { team_id: teamId, agent_id: invitedAgentId, status: 'pending' },
    });
    if (existingInvitation) throw new Error('Invitation already sent to this agent');
    return await prisma.teamInvitation.create({
      data: { team_id: teamId, agent_id: invitedAgentId, role, status: 'pending' },
    });
  }

  if (invitedUserEmail) {
    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: { team_id: teamId, user_email: invitedUserEmail, status: 'pending' },
    });
    if (existingInvitation) throw new Error('Invitation already sent to this email');
    const user = await prisma.user.findUnique({ where: { email: invitedUserEmail } });
    return await prisma.teamInvitation.create({
      data: { team_id: teamId, user_email: invitedUserEmail, user_id: user?.id, role, status: 'pending' },
    });
  }

  throw new Error('Must provide either agent_id or user_email');
}

export async function requestToJoinTeam(teamId: string, agentId: string, message?: string): Promise<any> {
  const existingMember = await prisma.teamMember.findFirst({ where: { team_id: teamId, agent_id: agentId } });
  if (existingMember) throw new Error('Already a team member');
  const existingRequest = await prisma.joinRequest.findFirst({
    where: { team_id: teamId, agent_id: agentId, status: 'pending' },
  });
  if (existingRequest) throw new Error('Join request already pending');

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error('Team not found');

  if (team.auto_accept) {
    return await prisma.$transaction(async (tx: any) => {
      const request = await tx.joinRequest.create({
        data: { team_id: teamId, agent_id: agentId, message, status: 'approved', resolved_at: new Date() },
      });
      await tx.teamMember.create({ data: { team_id: teamId, agent_id: agentId, role: 'member' } });
      return request;
    });
  }

  return await prisma.joinRequest.create({
    data: { team_id: teamId, agent_id: agentId, message, status: 'pending' },
  });
}

export async function removeAgentFromTeam(teamId: string, agentIdToRemove: string, removedById: string): Promise<void> {
  const remover = await prisma.teamMember.findFirst({ where: { team_id: teamId, agent_id: removedById } });
  if (!remover) throw new Error('Not a team member');
  const canRemove = remover.role === 'owner' || remover.role === 'admin' || agentIdToRemove === removedById;
  if (!canRemove) throw new Error('Only admins can remove other members');

  if (remover.role === 'owner') {
    const ownerCount = await prisma.teamMember.count({ where: { team_id: teamId, role: 'owner' } });
    if (ownerCount === 1 && agentIdToRemove === removedById) throw new Error('Cannot remove the last owner');
  }

  await prisma.teamMember.deleteMany({ where: { team_id: teamId, agent_id: agentIdToRemove } });
}

export async function deleteTeam(teamId: string, agentId: string | null, userId: string | null): Promise<void> {
  let isAuthorized = false;
  if (agentId) {
    const member = await prisma.teamMember.findFirst({ where: { team_id: teamId, agent_id: agentId, role: 'owner' } });
    isAuthorized = !!member;
  }
  if (userId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    isAuthorized = team?.created_by_user === userId;
  }
  if (!isAuthorized) throw new Error('Only team owner can delete team');

  await prisma.team.delete({ where: { id: teamId } });
}
