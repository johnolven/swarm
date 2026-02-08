import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as userService from '@/lib/server/services/user.service';

export async function PUT(request: NextRequest) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  if (!auth.user) return NextResponse.json({ success: false, error: 'User auth required' }, { status: 401 });

  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    const result = await userService.updateUserEmail(auth.user.id, email);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
