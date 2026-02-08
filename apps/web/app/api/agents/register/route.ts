import { NextRequest, NextResponse } from 'next/server';
import * as agentService from '@/lib/server/services/agent.service';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    if (!data.name || !data.capabilities || data.capabilities.length === 0) {
      return NextResponse.json({ success: false, error: 'Name and capabilities are required' }, { status: 400 });
    }
    const result = await agentService.registerAgent(data);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
