import { Server as SocketServer, Socket } from 'socket.io';
import { presenceManager } from '../lib/presence';
import { prisma } from '../lib/prisma';

export function registerSpaceHandlers(io: SocketServer, socket: Socket) {
  const user = socket.data.user as {
    id: string;
    type: 'agent' | 'user';
    name: string;
  };

  // Join a team's space
  socket.on('space:join', async ({ teamId }: { teamId: string }) => {
    const room = `space:${teamId}`;
    socket.join(room);

    // Get spawn config
    const config = await prisma.spaceConfig.findUnique({
      where: { team_id: teamId },
    });
    const spawnX = config?.spawn_x ?? 5;
    const spawnY = config?.spawn_y ?? 5;

    const presence = await presenceManager.join(teamId, user, socket.id, spawnX, spawnY);

    // Send full presence list to the new user
    socket.emit('space:presence:sync', {
      users: presenceManager.getTeamPresences(teamId),
    });

    // Notify others
    socket.to(room).emit('space:user:joined', { user: presence });
  });

  // Leave a team's space
  socket.on('space:leave', ({ teamId }: { teamId: string }) => {
    const room = `space:${teamId}`;
    presenceManager.leave(teamId, user.id);
    socket.leave(room);
    socket.to(room).emit('space:user:left', { userId: user.id });
  });

  // Move avatar
  socket.on(
    'space:move',
    ({
      teamId,
      x,
      y,
      direction,
    }: {
      teamId: string;
      x: number;
      y: number;
      direction: 'up' | 'down' | 'left' | 'right';
    }) => {
      presenceManager.move(teamId, user.id, x, y, direction);
      socket.to(`space:${teamId}`).emit('space:user:moved', {
        userId: user.id,
        x,
        y,
        direction,
      });
    }
  );

  // Change state (idle, working, chatting, afk)
  socket.on(
    'space:state',
    ({ teamId, state }: { teamId: string; state: string }) => {
      presenceManager.setState(teamId, user.id, state as any);
      socket.to(`space:${teamId}`).emit('space:user:state', {
        userId: user.id,
        state,
      });
    }
  );

  // Enter a zone
  socket.on(
    'space:zone:enter',
    ({ teamId, zoneId }: { teamId: string; zoneId: string }) => {
      presenceManager.enterZone(teamId, user.id, zoneId);
      const usersInZone = presenceManager
        .getUsersInZone(teamId, zoneId)
        .map((u) => u.id);
      io.to(`space:${teamId}`).emit('space:zone:update', {
        zoneId,
        users: usersInZone,
      });
    }
  );

  // Exit a zone
  socket.on('space:zone:exit', ({ teamId }: { teamId: string }) => {
    const presence = presenceManager.getPresence(teamId, user.id);
    const prevZone = presence?.current_zone;
    presenceManager.leaveZone(teamId, user.id);

    if (prevZone) {
      const usersInZone = presenceManager
        .getUsersInZone(teamId, prevZone)
        .map((u) => u.id);
      io.to(`space:${teamId}`).emit('space:zone:update', {
        zoneId: prevZone,
        users: usersInZone,
      });
    }
  });

  // Send emote
  socket.on(
    'space:emote',
    ({ teamId, emote }: { teamId: string; emote: string }) => {
      io.to(`space:${teamId}`).emit('space:emote', {
        userId: user.id,
        emote,
      });
    }
  );

  // Chat message in space (proximity or zone-based)
  socket.on(
    'space:chat',
    async ({
      teamId,
      content,
      roomId,
    }: {
      teamId: string;
      content: string;
      roomId?: string;
    }) => {
      // Persist message if roomId provided
      if (roomId) {
        await prisma.chatMessage.create({
          data: {
            room_id: roomId,
            sender_type: user.type,
            sender_id: user.id,
            sender_name: user.name,
            content,
          },
        });
      }

      const message = {
        sender_id: user.id,
        sender_type: user.type,
        sender_name: user.name,
        content,
        room_id: roomId || null,
        created_at: new Date().toISOString(),
      };

      // Broadcast to everyone in the space
      io.to(`space:${teamId}`).emit('space:chat:message', { message });
    }
  );

  // Handle disconnect - clean up presence
  socket.on('disconnect', () => {
    const result = presenceManager.leaveBySocketId(socket.id);
    if (result) {
      socket
        .to(`space:${result.teamId}`)
        .emit('space:user:left', { userId: result.userId });
    }
  });
}
