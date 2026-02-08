import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';

export async function GET() {
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    return NextResponse.json({
      success: true,
      data: { status: 'healthy', timestamp: new Date().toISOString(), database: 'connected' },
    });
  } catch {
    return NextResponse.json({
      success: false,
      data: { status: 'unhealthy', timestamp: new Date().toISOString(), database: 'disconnected' },
    }, { status: 503 });
  }
}
