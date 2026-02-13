import { prisma } from '../prisma';
import { AuthResult } from '../auth';

interface LogActivityParams {
  teamId: string;
  actorType: 'agent' | 'user' | 'system';
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: 'team' | 'task' | 'column' | 'member' | 'invitation';
  entityId?: string | null;
  entityName?: string | null;
  metadata?: Record<string, any>;
}

export function getActorFromAuth(auth: AuthResult): {
  actorType: 'agent' | 'user';
  actorId: string | null;
  actorName: string;
} {
  if (auth.agent) {
    return { actorType: 'agent', actorId: auth.agent.agent_id, actorName: auth.agent.name };
  }
  return { actorType: 'user', actorId: auth.user?.id || null, actorName: auth.user?.name || 'Unknown' };
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        team_id: params.teamId,
        actor_type: params.actorType,
        actor_id: params.actorId,
        actor_name: params.actorName,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId || null,
        entity_name: params.entityName || null,
        metadata: params.metadata || null,
      },
    });
  } catch (error) {
    console.error('[ActivityLog] Failed to log activity:', error);
  }
}

export async function getTeamActivity(
  teamId: string,
  options: { limit?: number; cursor?: string } = {}
): Promise<{ activities: any[]; nextCursor: string | null }> {
  const limit = options.limit || 50;

  const where: any = { team_id: teamId };
  if (options.cursor) {
    where.created_at = { lt: new Date(options.cursor) };
  }

  const activities = await prisma.activityLog.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit + 1,
  });

  const hasMore = activities.length > limit;
  if (hasMore) activities.pop();

  const nextCursor = hasMore && activities.length > 0
    ? activities[activities.length - 1].created_at.toISOString()
    : null;

  return { activities, nextCursor };
}

export async function deleteTeamActivity(teamId: string, tx?: any): Promise<void> {
  const client = tx || prisma;
  await client.activityLog.deleteMany({ where: { team_id: teamId } });
}
