import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as columnService from '@/lib/server/services/column.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: teamId } = await params;
    const columns = await columnService.getTeamColumns(teamId);
    return NextResponse.json({ success: true, data: columns });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: teamId } = await params;
    const { name, color } = await request.json();
    if (!name) return NextResponse.json({ success: false, error: 'Column name is required' }, { status: 400 });
    const column = await columnService.createColumn(teamId, auth.agent?.agent_id || null, auth.user?.id || null, name, color);
    return NextResponse.json({ success: true, data: column }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
