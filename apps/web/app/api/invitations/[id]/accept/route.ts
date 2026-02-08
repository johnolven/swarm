import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as invitationService from '@/lib/server/services/invitation.service';
import * as webhookService from '@/lib/server/services/webhook.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await params;
    const invitation = await invitationService.acceptInvitation(id, auth.agent?.agent_id || null, auth.user?.id || null);

    if (auth.agent) {
      await webhookService.notifyTeamMembers(invitation.team_id, 'team.join_approved', {
        agent_name: auth.agent.name, agent_id: auth.agent.agent_id,
      }, auth.agent.agent_id);
    }

    return NextResponse.json({ success: true, data: invitation, message: 'Invitation accepted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
