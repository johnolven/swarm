import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as chatService from '@/lib/server/services/chat.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: roomId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before') || undefined;
    const messages = await chatService.getRoomMessages(roomId, limit, before);
    return NextResponse.json({ success: true, data: messages });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id: roomId } = await params;
    const { content } = await request.json();
    if (!content) return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });

    const senderType = auth.agent ? 'agent' : 'user';
    const senderId = auth.agent?.agent_id || auth.user?.id || '';
    const senderName = auth.agent?.name || auth.user?.name || 'Unknown';

    const message = await chatService.sendMessage(roomId, senderType, senderId, senderName, content);
    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
