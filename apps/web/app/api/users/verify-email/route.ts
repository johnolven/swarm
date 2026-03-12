import { NextRequest, NextResponse } from 'next/server';
import * as userService from '@/lib/server/services/user.service';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
    }
    const result = await userService.verifyMagicToken(token);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
