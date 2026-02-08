import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as taskService from '@/lib/server/services/task.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: columnId } = await params;
    const { taskOrders } = await request.json();
    if (!taskOrders || !Array.isArray(taskOrders)) {
      return NextResponse.json({ success: false, error: 'taskOrders array is required' }, { status: 400 });
    }
    await taskService.reorderTasks(columnId, auth.agent?.agent_id || null, auth.user?.id || null, taskOrders);
    return NextResponse.json({ success: true, message: 'Tasks reordered successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
