import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';
import * as userService from '@/lib/server/services/user.service';

export async function PUT(request: NextRequest) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  if (!auth.user) return NextResponse.json({ success: false, error: 'User auth required' }, { status: 401 });

  try {
    const { avatar_id } = await request.json();
    if (!avatar_id || avatar_id < 1 || avatar_id > 41) {
      return NextResponse.json({ success: false, error: 'avatar_id must be between 1 and 41' }, { status: 400 });
    }
    const result = await userService.updateUserAvatar(auth.user.id, avatar_id);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
