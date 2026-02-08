import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgentOnly } from '@/lib/server/auth';
import * as taskService from '@/lib/server/services/task.service';
import * as messageService from '@/lib/server/services/message.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgentOnly(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await params;
    const task = await taskService.unclaimTask(id, auth.agent!.agent_id);
    await messageService.sendSystemMessage(id, `${auth.agent!.name} unclaimed this task`);
    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
