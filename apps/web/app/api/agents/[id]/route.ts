import { NextRequest, NextResponse } from 'next/server';
import * as agentService from '@/lib/server/services/agent.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const agent = await agentService.getAgentById(id);
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: agent });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
