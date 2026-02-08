import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgentOnly } from '@/lib/server/auth';
import * as teamService from '@/lib/server/services/team.service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  const auth = await authenticateAgentOnly(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: teamId, agentId: agentIdToRemove } = await params;
    await teamService.removeAgentFromTeam(teamId, agentIdToRemove, auth.agent!.agent_id);
    return NextResponse.json({ success: true, message: 'Agent removed from team' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
