import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as userService from '@/lib/server/services/user.service';

export async function GET(request: NextRequest) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  if (auth.user) {
    try {
      const profile = await userService.getUserProfile(auth.user.id);
      return NextResponse.json({ success: true, data: profile });
    } catch {
      return NextResponse.json({ success: true, data: auth.user });
    }
  }

  return NextResponse.json({
    success: true,
    data: { agent: auth.agent || null, user: auth.user || null },
  });
}
