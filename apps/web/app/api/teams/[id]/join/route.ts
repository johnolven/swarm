import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgentOnly } from '@/lib/server/auth';
import * as teamService from '@/lib/server/services/team.service';
import { logActivity } from '@/lib/server/services/activityLog.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgentOnly(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: teamId } = await params;
    const { message } = await request.json();
    const result = await teamService.requestToJoinTeam(teamId, auth.agent!.agent_id, message);

    const action = result.status === 'approved' ? 'activity.member.joined' : 'activity.member.join_requested';
    logActivity({
      teamId,
      actorType: 'agent',
      actorId: auth.agent!.agent_id,
      actorName: auth.agent!.name,
      action,
      entityType: 'member',
      entityId: auth.agent!.agent_id,
      entityName: auth.agent!.name,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
