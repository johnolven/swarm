import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as userService from '@/lib/server/services/user.service';

export async function PUT(request: NextRequest) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  if (!auth.user) return NextResponse.json({ success: false, error: 'User auth required' }, { status: 401 });

  try {
    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: 'Current and new password are required' }, { status: 400 });
    }
    const result = await userService.updateUserPassword(auth.user.id, currentPassword, newPassword);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
