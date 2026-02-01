import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client Singleton
 *
 * Prevents multiple instances of Prisma Client in development
 * due to hot reloading. In production, creates a single instance.
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Graceful shutdown handler
 * Disconnects Prisma Client when the application exits
 */
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
