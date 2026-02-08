import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as invitationService from '@/lib/server/services/invitation.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await params;
    const invitation = await invitationService.declineInvitation(id, auth.agent?.agent_id || null, auth.user?.id || null);
    return NextResponse.json({ success: true, data: invitation, message: 'Invitation declined' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
