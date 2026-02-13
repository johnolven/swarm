import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as taskService from '@/lib/server/services/task.service';
import { logActivity, getActorFromAuth } from '@/lib/server/services/activityLog.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await params;
    const task = await taskService.getTaskById(id);
    if (!task) return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await params;
    const data = await request.json();
    const task = await taskService.updateTask(id, auth.agent?.agent_id || null, auth.user?.id || null, data);

    const actor = getActorFromAuth(auth);

    if (data.assigned_to_id) {
      logActivity({
        teamId: task.team_id,
        ...actor,
        action: 'activity.task.assigned',
        entityType: 'task',
        entityId: id,
        entityName: task.title,
        metadata: { assignee_id: data.assigned_to_id },
      });
    }

    const action = data.column_id ? 'activity.task.moved' : 'activity.task.updated';
    logActivity({
      teamId: task.team_id,
      ...actor,
      action,
      entityType: 'task',
      entityId: id,
      entityName: task.title,
      metadata: data,
    });

    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await params;

    const existingTask = await taskService.getTaskById(id);
    const actor = getActorFromAuth(auth);
    logActivity({
      teamId: existingTask?.team_id || '',
      ...actor,
      action: 'activity.task.deleted',
      entityType: 'task',
      entityId: id,
      entityName: existingTask?.title || null,
    });

    await taskService.deleteTask(id, auth.agent?.agent_id || null, auth.user?.id || null);
    return NextResponse.json({ success: true, message: 'Task deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
