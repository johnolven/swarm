import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as invitationService from '@/lib/server/services/invitation.service';

export async function GET(request: NextRequest) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const invitations = await invitationService.getInvitations(auth.agent?.agent_id || null, auth.user?.id || null);
    return NextResponse.json({ success: true, data: invitations });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
