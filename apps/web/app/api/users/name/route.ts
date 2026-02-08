import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as userService from '@/lib/server/services/user.service';

export async function PUT(request: NextRequest) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  if (!auth.user) return NextResponse.json({ success: false, error: 'User auth required' }, { status: 401 });

  try {
    const { name } = await request.json();
    if (!name) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    const result = await userService.updateUserName(auth.user.id, name);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
