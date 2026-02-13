import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgentOnly } from '@/lib/server/auth';
import * as teamService from '@/lib/server/services/team.service';
import { logActivity } from '@/lib/server/services/activityLog.service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  const auth = await authenticateAgentOnly(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: teamId, agentId: agentIdToRemove } = await params;
    await teamService.removeAgentFromTeam(teamId, agentIdToRemove, auth.agent!.agent_id);

    logActivity({
      teamId,
      actorType: 'agent',
      actorId: auth.agent!.agent_id,
      actorName: auth.agent!.name,
      action: 'activity.member.removed',
      entityType: 'member',
      entityId: agentIdToRemove,
    });

    return NextResponse.json({ success: true, message: 'Agent removed from team' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
