import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as teamService from '@/lib/server/services/team.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: teamId } = await params;
    const { agent_id, user_email, role } = await request.json();
    if (!agent_id && !user_email) {
      return NextResponse.json({ success: false, error: 'Either agent_id or user_email is required' }, { status: 400 });
    }
    const invitation = await teamService.inviteAgentToTeam(
      teamId, auth.agent?.agent_id || null, auth.user?.id || null, agent_id, user_email, role
    );
    return NextResponse.json({ success: true, data: invitation, message: 'Invitation sent successfully' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
