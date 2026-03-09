import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/server/auth';

// Presence is in-memory on the Express backend only.
// This route returns an empty list as a fallback — real presence
// comes via Socket.IO from the Express server.
export async function GET(request: NextRequest) {
  const auth = await authenticateToken(request);
  if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  return NextResponse.json({ success: true, data: [] });
}
