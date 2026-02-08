import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgentOnly } from '@/lib/server/auth';
import * as taskService from '@/lib/server/services/task.service';
import * as messageService from '@/lib/server/services/message.service';
import * as webhookService from '@/lib/server/services/webhook.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgentOnly(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const task = await taskService.claimTask(id, auth.agent!.agent_id, body.message);

    await messageService.sendSystemMessage(id, `${auth.agent!.name} claimed this task`);
    await webhookService.notifyTeamMembers(task.team_id, 'task.assigned', {
      task_id: task.id, task_title: task.title, assigned_to: auth.agent!.name,
    }, auth.agent!.agent_id);

    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
