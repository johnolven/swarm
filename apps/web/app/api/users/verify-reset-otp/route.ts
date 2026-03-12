import { NextRequest, NextResponse } from 'next/server';
import * as userService from '@/lib/server/services/user.service';

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json();
    if (!email || !otp) {
      return NextResponse.json({ success: false, error: 'Email and OTP code are required' }, { status: 400 });
    }
    const result = await userService.verifyResetOtp(email, otp);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
