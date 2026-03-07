import { prisma } from './prisma';

/**
 * Check if an agent or user is authorized for a team action.
 * Reduces duplicated authorization logic across services.
 */
export async function authorizeTeamAction(
  teamId: string,
  agentId: string | null,
  userId: string | null,
  requiredRoles: string[] = ['owner', 'admin']
): Promise<boolean> {
  if (agentId) {
    const member = await prisma.teamMember.findFirst({
      where: {
        team_id: teamId,
        agent_id: agentId,
        role: { in: requiredRoles },
      },
    });
    if (member) return true;
  }

  if (userId) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });
    if (team?.created_by_user === userId) return true;
  }

  return false;
}

/**
 * Check if an agent or user is a team member (any role).
 */
export async function isTeamMember(
  teamId: string,
  agentId: string | null,
  userId: string | null
): Promise<boolean> {
  return authorizeTeamAction(teamId, agentId, userId, ['owner', 'admin', 'member']);
}
