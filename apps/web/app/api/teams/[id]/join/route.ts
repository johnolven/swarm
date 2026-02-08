import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgentOnly } from '@/lib/server/auth';
import * as teamService from '@/lib/server/services/team.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgentOnly(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: teamId } = await params;
    const { message } = await request.json();
    const result = await teamService.requestToJoinTeam(teamId, auth.agent!.agent_id, message);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
