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
    const { message, required_capabilities } = await request.json();
    const result = await taskService.requestCollaboration(id, auth.agent!.agent_id, message, required_capabilities);

    await messageService.sendMessage(id, auth.agent!.agent_id, message, 'collaboration_request');
    for (const agent of result.matching_agents) {
      await webhookService.sendWebhookEvent(agent.id, 'task.collaboration_requested', {
        task_id: id, requesting_agent: auth.agent!.name, message, required_capabilities,
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
