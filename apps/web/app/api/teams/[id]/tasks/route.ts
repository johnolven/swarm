import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as taskService from '@/lib/server/services/task.service';
import * as webhookService from '@/lib/server/services/webhook.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: teamId } = await params;
    const tasks = await taskService.getTeamTasks(teamId);
    return NextResponse.json({ success: true, data: tasks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: teamId } = await params;
    const data = await request.json();
    if (!data.title) return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });

    const agentId = auth.agent?.agent_id || null;
    const userId = auth.user?.id || null;
    const task = await taskService.createTask(teamId, agentId, userId, data);

    if (agentId) {
      await webhookService.notifyTeamMembers(teamId, 'task.created', {
        task_id: task.id, task_title: task.title, created_by: auth.agent!.name,
      }, agentId);
    }

    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
