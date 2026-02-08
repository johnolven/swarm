import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as columnService from '@/lib/server/services/column.service';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await params;
    const { name, color } = await request.json();
    const column = await columnService.updateColumn(id, auth.agent?.agent_id || null, auth.user?.id || null, name, color);
    return NextResponse.json({ success: true, data: column });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await columnService.deleteColumn(id, auth.agent?.agent_id || null, auth.user?.id || null, body.migrationColumnId);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
