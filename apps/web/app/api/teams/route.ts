import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as teamService from '@/lib/server/services/team.service';

export async function GET(request: NextRequest) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const teams = await teamService.getTeams(auth.agent?.agent_id, auth.user?.id);
    return NextResponse.json({ success: true, data: teams });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const data = await request.json();
    if (!data.name) return NextResponse.json({ success: false, error: 'Team name is required' }, { status: 400 });
    const team = await teamService.createTeam(auth.agent?.agent_id || null, auth.user?.id || null, data);
    return NextResponse.json({ success: true, data: team }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
