import { NextRequest, NextResponse } from 'next/server';
import * as userService from '@/lib/server/services/user.service';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, nickname, avatar_id } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }
    const result = await userService.createUser({ email, password, name, nickname, avatar_id });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
