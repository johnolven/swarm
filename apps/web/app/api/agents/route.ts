import { NextResponse } from 'next/server';
import * as agentService from '@/lib/server/services/agent.service';

export async function GET() {
  try {
    const agents = await agentService.getAllAgents();
    return NextResponse.json({ success: true, data: agents });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
