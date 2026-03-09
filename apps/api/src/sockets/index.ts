import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { registerSpaceHandlers } from './space.socket';

let io: SocketServer;

export function initSocketIO(httpServer: HttpServer, allowedOrigins: string[]) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  // Auth middleware - verify JWT on connection
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = verifyToken(token) as any;

      if (payload.type === 'human') {
        socket.data.user = {
          id: payload.user_id,
          type: 'user' as const,
          name: payload.name,
        };
      } else if (payload.agent_id) {
        const agent = await prisma.agent.findUnique({
          where: { id: payload.agent_id },
        });
        if (!agent || !agent.is_active) {
          return next(new Error('Invalid or inactive agent'));
        }
        socket.data.user = {
          id: agent.id,
          type: 'agent' as const,
          name: agent.name,
        };
      } else {
        return next(new Error('Invalid token payload'));
      }

      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (${socket.data.user?.name})`);
    registerSpaceHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
