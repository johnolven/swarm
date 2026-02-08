import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as invitationService from '@/lib/server/services/invitation.service';
import * as webhookService from '@/lib/server/services/webhook.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await params;
    const result = await invitationService.approveJoinRequest(id, auth.agent?.agent_id || null, auth.user?.id || null);

    await webhookService.sendWebhookEvent(result.agent_id, 'team.join_approved', {
      team_id: result.team_id,
      approved_by: auth.agent?.name || auth.user?.email || 'Team Admin',
    });

    return NextResponse.json({ success: true, data: result, message: 'Join request approved' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
