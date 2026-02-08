import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as columnService from '@/lib/server/services/column.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: teamId } = await params;
    const { columnOrders } = await request.json();
    if (!columnOrders || !Array.isArray(columnOrders)) {
      return NextResponse.json({ success: false, error: 'columnOrders array is required' }, { status: 400 });
    }
    const columns = await columnService.reorderColumns(teamId, auth.agent?.agent_id || null, auth.user?.id || null, columnOrders);
    return NextResponse.json({ success: true, data: columns });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
