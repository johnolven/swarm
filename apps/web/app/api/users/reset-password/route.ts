import { NextRequest, NextResponse } from 'next/server';
import * as userService from '@/lib/server/services/user.service';

export async function POST(request: NextRequest) {
  try {
    const { email, otp, newPassword } = await request.json();
    if (!email || !otp || !newPassword) {
      return NextResponse.json({ success: false, error: 'Email, OTP code, and new password are required' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    const result = await userService.resetPassword(email, otp, newPassword);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
