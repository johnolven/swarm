import { prisma } from '../lib/prisma';
import { Team, CreateTeamInput } from '@swarm/types';
import { createDefaultColumns } from './column.service';

/**
 * Create a new team
 */
export async function createTeam(
  agentId: string | null,
  userId: string | null,
  data: CreateTeamInput
): Promise<Team> {
  return await prisma.$transaction(async (tx) => {
    // Create team
    const team = await tx.team.create({
      data: {
        name: data.name,
        description: data.description,
        visibility: data.visibility || 'public',
        auto_accept: data.auto_accept || false,
        created_by: agentId, // Agent creator (if any)
        created_by_user: userId, // Human creator (if any)
      },
    });

    // Add creator as team owner (only if created by an agent)
    if (agentId) {
      await tx.teamMember.create({
        data: {
          team_id: team.id,
          agent_id: agentId,
          role: 'owner',
        },
      });
    }

    // Create default columns (Todo, Doing, Done)
    const defaultColumns = [
      { name: 'Todo', color: 'bg-blue-100', order: 0 },
      { name: 'Doing', color: 'bg-yellow-100', order: 1 },
      { name: 'Done', color: 'bg-green-100', order: 2 },
    ];

    await Promise.all(
      defaultColumns.map((col) =>
        tx.column.create({
          data: {
            team_id: team.id,
            name: col.name,
            color: col.color,
            order: col.order,
          },
        })
      )
    );

    return team;
  });
}

/**
 * Get all public teams or teams the user/agent has access to
 */
export async function getTeams(agentId?: string, userId?: string): Promise<Team[]> {
  // Build WHERE conditions based on user type
  const whereConditions: any[] = [{ visibility: 'public' }];

  if (agentId) {
    // For agents: include teams they're members of
    whereConditions.push({
      members: {
        some: {
          agent_id: agentId,
        },
      },
    });
  }

  if (userId) {
    // For humans: include teams they created
    whereConditions.push({
      created_by_user: userId,
    });
  }

  return await prisma.team.findMany({
    where: {
      OR: whereConditions,
    },
    include: {
      members: {
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              capabilities: true,
              is_active: true,
            },
          },
        },
      },
      _count: {
        select: {
          tasks: true,
          members: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });
}

/**
 * Get team by ID
 */
export async function getTeamById(teamId: string): Promise<Team | null> {
  return await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              description: true,
              capabilities: true,
              personality: true,
              is_active: true,
              created_at: true,
            },
          },
        },
      },
      tasks: {
        orderBy: { created_at: 'desc' },
        take: 20,
      },
      invitations: {
        where: { status: 'pending' },
      },
    },
  });
}

/**
 * Update team
 */
export async function updateTeam(
  teamId: string,
  agentId: string | null,
  userId: string | null,
  data: Partial<CreateTeamInput>
): Promise<Team> {
  // Authorization check
  let isAuthorized = false;

  // Check agent permissions
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

  // Check user permissions (human creator)
  if (userId) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });
    const isTeamCreator = team?.created_by_user === userId;
    isAuthorized = isTeamCreator;
  }

  if (!isAuthorized) {
    throw new Error('Only team admins can update team settings');
  }

  return await prisma.team.update({
    where: { id: teamId },
    data: {
      name: data.name,
      description: data.description,
      visibility: data.visibility,
      auto_accept: data.auto_accept,
    },
  });
}

/**
 * Invite agent to team
 */
export async function inviteAgentToTeam(
  teamId: string,
  invitedById: string,
  invitedAgentId: string,
  role: string = 'member'
): Promise<any> {
  // Check if inviter is admin/owner
  const inviter = await prisma.teamMember.findFirst({
    where: {
      team_id: teamId,
      agent_id: invitedById,
      role: { in: ['owner', 'admin'] },
    },
  });

  if (!inviter) {
    throw new Error('Only team admins can invite agents');
  }

  // Check if agent is already a member
  const existingMember = await prisma.teamMember.findFirst({
    where: {
      team_id: teamId,
      agent_id: invitedAgentId,
    },
  });

  if (existingMember) {
    throw new Error('Agent is already a team member');
  }

  // Check for existing pending invitation
  const existingInvitation = await prisma.teamInvitation.findFirst({
    where: {
      team_id: teamId,
      agent_id: invitedAgentId,
      status: 'pending',
    },
  });

  if (existingInvitation) {
    throw new Error('Invitation already sent to this agent');
  }

  // Create invitation
  return await prisma.teamInvitation.create({
    data: {
      team_id: teamId,
      agent_id: invitedAgentId,
      role: role,
      status: 'pending',
    },
  });
}

/**
 * Request to join team
 */
export async function requestToJoinTeam(
  teamId: string,
  agentId: string,
  message?: string
): Promise<any> {
  // Check if already a member
  const existingMember = await prisma.teamMember.findFirst({
    where: {
      team_id: teamId,
      agent_id: agentId,
    },
  });

  if (existingMember) {
    throw new Error('Already a team member');
  }

  // Check for existing pending request
  const existingRequest = await prisma.joinRequest.findFirst({
    where: {
      team_id: teamId,
      agent_id: agentId,
      status: 'pending',
    },
  });

  if (existingRequest) {
    throw new Error('Join request already pending');
  }

  // Get team to check auto_accept
  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  // If auto_accept is true, add directly as member
  if (team.auto_accept) {
    return await prisma.$transaction(async (tx) => {
      const request = await tx.joinRequest.create({
        data: {
          team_id: teamId,
          agent_id: agentId,
          message: message,
          status: 'approved',
          resolved_at: new Date(),
        },
      });

      await tx.teamMember.create({
        data: {
          team_id: teamId,
          agent_id: agentId,
          role: 'member',
        },
      });

      return request;
    });
  }

  // Create join request
  return await prisma.joinRequest.create({
    data: {
      team_id: teamId,
      agent_id: agentId,
      message: message,
      status: 'pending',
    },
  });
}

/**
 * Remove agent from team
 */
export async function removeAgentFromTeam(
  teamId: string,
  agentIdToRemove: string,
  removedById: string
): Promise<void> {
  // Check if remover is admin/owner or removing themselves
  const remover = await prisma.teamMember.findFirst({
    where: {
      team_id: teamId,
      agent_id: removedById,
    },
  });

  if (!remover) {
    throw new Error('Not a team member');
  }

  const canRemove =
    remover.role === 'owner' ||
    remover.role === 'admin' ||
    agentIdToRemove === removedById;

  if (!canRemove) {
    throw new Error('Only admins can remove other members');
  }

  // Can't remove the last owner
  if (remover.role === 'owner') {
    const ownerCount = await prisma.teamMember.count({
      where: {
        team_id: teamId,
        role: 'owner',
      },
    });

    if (ownerCount === 1 && agentIdToRemove === removedById) {
      throw new Error('Cannot remove the last owner');
    }
  }

  // Remove member
  await prisma.teamMember.deleteMany({
    where: {
      team_id: teamId,
      agent_id: agentIdToRemove,
    },
  });
}

/**
 * Delete team
 */
export async function deleteTeam(
  teamId: string,
  agentId: string | null,
  userId: string | null
): Promise<void> {
  // Authorization check
  let isAuthorized = false;

  // Check agent permissions
  if (agentId) {
    const member = await prisma.teamMember.findFirst({
      where: {
        team_id: teamId,
        agent_id: agentId,
        role: 'owner',
      },
    });
    isAuthorized = !!member;
  }

  // Check user permissions (human creator)
  if (userId) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });
    const isTeamCreator = team?.created_by_user === userId;
    isAuthorized = isTeamCreator;
  }

  if (!isAuthorized) {
    throw new Error('Only team owner can delete team');
  }

  // Delete team (cascade will handle members, tasks, etc.)
  await prisma.team.delete({
    where: { id: teamId },
  });
}
