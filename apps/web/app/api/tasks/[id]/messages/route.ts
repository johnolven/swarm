import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken, authenticateAgentOnly } from '@/lib/server/auth';
import * as messageService from '@/lib/server/services/message.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: taskId } = await params;
    const messages = await messageService.getTaskMessages(taskId);
    return NextResponse.json({ success: true, data: messages });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateAgentOnly(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: taskId } = await params;
    const { content, type } = await request.json();
    if (!content) return NextResponse.json({ success: false, error: 'Message content is required' }, { status: 400 });
    const message = await messageService.sendMessage(taskId, auth.agent!.agent_id, content, type || 'message');
    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
