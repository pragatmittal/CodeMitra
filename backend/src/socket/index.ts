import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';

// Global declaration for Socket.IO instance
declare global {
  var io: Server;
}

// Redis connection with error handling - make it completely optional
let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let redisAvailable = false;

// Only try to connect to Redis if explicitly configured
if (process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379' && !process.env.REDIS_URL.includes('codemitra-redis')) {
  try {
    pubClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 2000,
      commandTimeout: 2000
    });
    
    pubClient.on('error', (err) => {
      console.warn('Redis Pub Client Error (continuing without Redis):', err.message);
      redisAvailable = false;
    });
    
    pubClient.on('connect', () => {
      console.log('Redis Pub Client Connected');
      redisAvailable = true;
    });
    
    subClient = pubClient.duplicate();
    
    subClient.on('error', (err) => {
      console.warn('Redis Sub Client Error (continuing without Redis):', err.message);
      redisAvailable = false;
    });
    
    subClient.on('connect', () => {
      console.log('Redis Sub Client Connected');
      redisAvailable = true;
    });
  } catch (error) {
    console.warn('Redis initialization failed (continuing without Redis):', error);
    redisAvailable = false;
  }
} else {
  console.log('Redis not configured, using memory adapter');
  redisAvailable = false;
}

export const setupSocketIO = (server: any) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Only use Redis adapter if both clients are available and connected
  if (redisAvailable && pubClient && subClient) {
    try {
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.IO Redis adapter enabled');
    } catch (error) {
      console.warn('Redis adapter failed (using memory adapter):', error);
    }
  } else {
    console.log('Socket.IO using memory adapter (Redis not available)');
  }

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId || decoded.id },
        select: { id: true, name: true, email: true, avatar: true }
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.data.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.data.user.name} connected: ${socket.id}`);

    // Join room
    socket.on('room:join', async (data) => {
      try {
        const { roomId } = data;
        const userId = socket.data.user.id;

        console.log(`[ROOM:JOIN] User ${socket.data.user.name} (${userId}) attempting to join room ${roomId}`);

        // Verify user is participant
        const participant = await prisma.roomParticipant.findUnique({
          where: { 
            roomId_userId: { roomId, userId } 
          }
        });

        if (!participant) {
          console.log(`[ROOM:JOIN] User ${userId} not authorized for room ${roomId}`);
          socket.emit('error', { message: 'Not authorized to join room' });
          return;
        }

        // Use transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
          // Update participant status to active
          await tx.roomParticipant.update({
            where: { id: participant.id },
            data: { 
              status: 'active',
              lastActivity: new Date()
            }
          });

          // Get current room state with fresh participant count
          const room = await tx.room.findUnique({
            where: { id: roomId },
            include: {
              participants: {
                where: { status: 'active' },
                include: {
                  user: {
                    select: { id: true, name: true, avatar: true }
                  }
                }
              }
            }
          });

          if (!room) {
            throw new Error('Room not found');
          }

          return room;
        });

        socket.join(roomId);
        
        const room = result;
        const participantCount = room.participants.length;
        const participantList = room.participants.map(p => ({
          id: p.user.id,
          name: p.user.name,
          avatar: p.user.avatar,
          cursorLine: p.cursorLine,
          cursorColumn: p.cursorColumn,
          status: p.status
        }));

        console.log(`[ROOM:JOIN] Room ${roomId} now has ${participantCount} active participants`);

        // Send room state to the joining user with authoritative count
        socket.emit('room:state', {
          roomId,
          code: room.code,
          language: room.language,
          input: room.input,
          output: room.output,
          participants: participantList,
          participantCount
        });

        // Broadcast to ALL users in room (including the joining user) with authoritative count
        io.to(roomId).emit('user:count:update', {
          roomId,
          count: participantCount,
          participants: participantList,
          event: 'user_joined',
          user: {
            id: socket.data.user.id,
            name: socket.data.user.name,
            avatar: socket.data.user.avatar
          }
        });

        // Send acknowledgment to joining user
        socket.emit('room:joined', {
          roomId,
          participantCount,
          participants: participantList
        });

        console.log(`[ROOM:JOIN] User ${socket.data.user.name} successfully joined room ${roomId} (${participantCount} total)`);
      } catch (error) {
        console.error('[ROOM:JOIN] Error:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Leave room
    socket.on('room:leave', async (data) => {
      try {
        const { roomId } = data;
        const userId = socket.data.user.id;
        
        console.log(`[ROOM:LEAVE] User ${socket.data.user.name} (${userId}) leaving room ${roomId}`);

        // Use transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
          // Update participant status to disconnected
          await tx.roomParticipant.updateMany({
            where: { 
              roomId, 
              userId,
              status: 'active'
            },
            data: { 
              status: 'disconnected',
              lastActivity: new Date()
            }
          });

          // Get updated participant count and list
          const room = await tx.room.findUnique({
            where: { id: roomId },
            include: {
              participants: {
                where: { status: 'active' },
                include: {
                  user: {
                    select: { id: true, name: true, avatar: true }
                  }
                }
              }
            }
          });

          return room;
        });

        socket.leave(roomId);
        
        if (result) {
          const participantCount = result.participants.length;
          const participantList = result.participants.map(p => ({
            id: p.user.id,
            name: p.user.name,
            avatar: p.user.avatar,
            cursorLine: p.cursorLine,
            cursorColumn: p.cursorColumn,
            status: p.status
          }));

          console.log(`[ROOM:LEAVE] Room ${roomId} now has ${participantCount} active participants`);

          // Broadcast to ALL users in room (including the leaving user) with authoritative count
          io.to(roomId).emit('user:count:update', {
            roomId,
            count: participantCount,
            participants: participantList,
            event: 'user_left',
            user: {
              id: socket.data.user.id,
              name: socket.data.user.name,
              avatar: socket.data.user.avatar
            }
          });
        }

        console.log(`[ROOM:LEAVE] User ${socket.data.user.name} left room ${roomId}`);
      } catch (error) {
        console.error('[ROOM:LEAVE] Error:', error);
      }
    });

    // Code update
    socket.on('code:update', async (data) => {
      try {
        const { roomId, code, language } = data;
        const userId = socket.data.user.id;

        // Verify user is in room
        const participant = await prisma.roomParticipant.findUnique({
          where: { 
            roomId_userId: { roomId, userId } 
          }
        });

        if (!participant) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }

        // Update room code in database
        await prisma.room.update({
          where: { id: roomId },
          data: { 
            code, 
            language: language || 'javascript',
            updatedAt: new Date() 
          }
        });

        // Broadcast to others in the room
        socket.to(roomId).emit('code:updated', {
          code,
          language: language || 'javascript',
          user: socket.data.user
        });

        console.log(`Code updated in room ${roomId} by ${socket.data.user.name}`);
      } catch (error) {
        console.error('Code update error:', error);
        socket.emit('error', { message: 'Failed to update code' });
      }
    });

    // Cursor update
    socket.on('cursor:update', async (data) => {
      try {
        const { roomId, line, column } = data;
        const userId = socket.data.user.id;

        // Update cursor position in database
        await prisma.roomParticipant.updateMany({
          where: { 
            roomId, 
            userId,
            status: 'active'
          },
          data: { 
            cursorLine: line,
            cursorColumn: column,
            lastActivity: new Date()
          }
        });

        // Broadcast cursor position to others
        socket.to(roomId).emit('cursor:updated', {
          user: {
            id: socket.data.user.id,
            name: socket.data.user.name,
            avatar: socket.data.user.avatar
          },
          line,
          column
        });
      } catch (error) {
        console.error('Cursor update error:', error);
      }
    });

    // Code execution result
    socket.on('code:execution', (data) => {
      const { roomId, result } = data;
      socket.to(roomId).emit('code:execution:result', {
        result,
        user: socket.data.user
      });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log(`[DISCONNECT] User ${socket.data.user.name} disconnected: ${socket.id}`);
      
      // Handle graceful disconnect - update status in all rooms
      try {
        const rooms = await prisma.roomParticipant.findMany({
          where: { 
            userId: socket.data.user.id,
            status: 'active'
          }
        });

        console.log(`[DISCONNECT] User was active in ${rooms.length} rooms`);

        for (const room of rooms) {
          // Use transaction to ensure atomicity
          const result = await prisma.$transaction(async (tx) => {
            // Update participant status to disconnected
            await tx.roomParticipant.updateMany({
              where: { 
                roomId: room.roomId,
                userId: socket.data.user.id,
                status: 'active'
              },
              data: { 
                status: 'disconnected',
                lastActivity: new Date()
              }
            });

            // Get updated participant count and list
            const roomData = await tx.room.findUnique({
              where: { id: room.roomId },
              include: {
                participants: {
                  where: { status: 'active' },
                  include: {
                    user: {
                      select: { id: true, name: true, avatar: true }
                    }
                  }
                }
              }
            });

            return roomData;
          });

          if (result) {
            const participantCount = result.participants.length;
            const participantList = result.participants.map(p => ({
              id: p.user.id,
              name: p.user.name,
              avatar: p.user.avatar,
              cursorLine: p.cursorLine,
              cursorColumn: p.cursorColumn,
              status: p.status
            }));

            console.log(`[DISCONNECT] Room ${room.roomId} now has ${participantCount} active participants`);

            // Broadcast to ALL users in room with authoritative count
            io.to(room.roomId).emit('user:count:update', {
              roomId: room.roomId,
              count: participantCount,
              participants: participantList,
              event: 'user_disconnected',
              user: {
                id: socket.data.user.id,
                name: socket.data.user.name,
                avatar: socket.data.user.avatar
              }
            });
          }
        }
      } catch (error) {
        console.error('[DISCONNECT] Cleanup error:', error);
      }
    });
  });

  // Periodic reconciliation heartbeat - every 30 seconds
  setInterval(async () => {
    try {
      // Check if database tables exist before querying
      try {
        await prisma.$queryRaw`SELECT 1 FROM rooms LIMIT 1`;
      } catch (dbError: any) {
        // If tables don't exist, skip heartbeat (migrations not run yet)
        if (dbError.code === 'P2021' || dbError.message?.includes('does not exist')) {
          return; // Silently skip - migrations need to be run
        }
        throw dbError; // Re-throw other database errors
      }
      
      console.log('[HEARTBEAT] Starting periodic reconciliation...');
      
      // Get all active rooms
      const rooms = await prisma.room.findMany({
        where: {
          participants: {
            some: { status: 'active' }
          }
        },
        include: {
          participants: {
            where: { status: 'active' },
            include: {
              user: {
                select: { id: true, name: true, avatar: true }
              }
            }
          }
        }
      });

      for (const room of rooms) {
        const participantCount = room.participants.length;
        const participantList = room.participants.map(p => ({
          id: p.user.id,
          name: p.user.name,
          avatar: p.user.avatar,
          cursorLine: p.cursorLine,
          cursorColumn: p.cursorColumn,
          status: p.status
        }));

        // Broadcast authoritative count to all users in room
        io.to(room.id).emit('user:count:update', {
          roomId: room.id,
          count: participantCount,
          participants: participantList,
          event: 'heartbeat_reconciliation'
        });

        console.log(`[HEARTBEAT] Room ${room.id} reconciled: ${participantCount} participants`);
      }
    } catch (error: any) {
      // Only log non-table-missing errors
      if (error.code !== 'P2021' && !error.message?.includes('does not exist')) {
        console.error('[HEARTBEAT] Reconciliation error:', error);
      }
    }
  }, 30000); // 30 seconds

  return io;
};

async function getParticipantCount(roomId: string): Promise<number> {
  return await prisma.roomParticipant.count({
    where: { roomId, status: 'active' }
  });
}
