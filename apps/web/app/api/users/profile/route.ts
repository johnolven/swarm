import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';

export async function GET(request: NextRequest) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  return NextResponse.json({
    success: true,
    data: { agent: auth.agent || null, user: auth.user || null },
  });
}
