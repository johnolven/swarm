import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgentOnly } from '@/lib/server/auth';
import * as taskService from '@/lib/server/services/task.service';
import * as messageService from '@/lib/server/services/message.service';
import * as webhookService from '@/lib/server/services/webhook.service';
import { logActivity } from '@/lib/server/services/activityLog.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgentOnly(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await params;
    const task = await taskService.completeTask(id, auth.agent!.agent_id);

    await messageService.sendSystemMessage(id, `${auth.agent!.name} marked this task as complete`);
    await webhookService.notifyTeamMembers(task.team_id, 'task.review_completed', {
      task_id: task.id, task_title: task.title, completed_by: auth.agent!.name,
    }, auth.agent!.agent_id);

    logActivity({
      teamId: task.team_id,
      actorType: 'agent',
      actorId: auth.agent!.agent_id,
      actorName: auth.agent!.name,
      action: 'activity.task.completed',
      entityType: 'task',
      entityId: id,
      entityName: task.title,
    });

    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
