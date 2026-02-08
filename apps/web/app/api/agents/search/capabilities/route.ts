import { NextRequest, NextResponse } from 'next/server';
import * as agentService from '@/lib/server/services/agent.service';

export async function GET(request: NextRequest) {
  try {
    const capabilities = request.nextUrl.searchParams.get('capabilities');
    if (!capabilities) {
      return NextResponse.json({ success: false, error: 'Capabilities query parameter is required' }, { status: 400 });
    }
    const agents = await agentService.findAgentsByCapabilities(capabilities.split(','));
    return NextResponse.json({ success: true, data: agents });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
