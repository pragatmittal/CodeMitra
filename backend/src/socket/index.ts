import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { redisClient } from '../utils/redis';

// Global declaration for Socket.IO instance
declare global {
  var io: Server;
}

/**
 * Real-time design goals:
 * - Broadcast-first (no DB in the hot path)
 * - Coalesce + throttle persistence (avoid write-per-keystroke)
 * - Avoid per-keystroke DB auth checks (track membership in-memory after join auth)
 *
 * NOTE: Redis adapter should be enabled whenever REDIS_URL is present,
 * otherwise multi-instance deployments will drop cross-instance room broadcasts.
 */

type CodeUpdatedPayload = {
  roomId: string;
  code: string;
  language: string;
  timestamp: number;
  userId: string;
  userName: string;
  user: { id: string; name: string; avatar: string | null };
};

type CodeUpdateAck =
  | { ok: true; serverTime: number }
  | { ok: false; serverTime: number; error: string };

const roomUsers: Map<string, Set<string>> = new Map();

// Coalesced persistence (roomId -> latest state + timer)
const latestRoomState: Map<string, { code: string; language: string; updatedAt: number }> = new Map();
const lastPersistedState: Map<string, { code: string; language: string }> = new Map();
const persistTimers: Map<string, NodeJS.Timeout> = new Map();

const PERSIST_IDLE_MS = Number(process.env.CODE_PERSIST_IDLE_MS || 900); // tuned for Supabase latency
const MAX_CODE_BYTES = Number(process.env.MAX_CODE_BYTES || 500_000); // ~500KB guardrail

function trackJoin(roomId: string, userId: string) {
  if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Set());
  roomUsers.get(roomId)!.add(userId);
}

function trackLeave(roomId: string, userId: string) {
  const set = roomUsers.get(roomId);
  if (!set) return;
  set.delete(userId);
  if (set.size === 0) roomUsers.delete(roomId);
}

function schedulePersist(roomId: string) {
  const existing = persistTimers.get(roomId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    persistTimers.delete(roomId);

    const latest = latestRoomState.get(roomId);
    if (!latest) return;

    const last = lastPersistedState.get(roomId);
    if (last && last.code === latest.code && last.language === latest.language) {
      return;
    }

    try {
      await prisma.room.update({
        where: { id: roomId },
        data: {
          code: latest.code,
          language: latest.language,
          updatedAt: new Date()
        }
      });
      lastPersistedState.set(roomId, { code: latest.code, language: latest.language });
    } catch (err: any) {
      // Persistence failure should NOT break realtime; we log once per flush attempt.
      console.error('[CODE:PERSIST] Failed to persist latest room state:', {
        roomId,
        message: err?.message || String(err)
      });
    }
  }, PERSIST_IDLE_MS);

  persistTimers.set(roomId, timer);
}

async function createRedisAdapterIfConfigured(): Promise<{ pub: Redis; sub: Redis } | null> {
  if (!process.env.REDIS_URL) return null;

  // Reuse the already configured redisClient URL/options as much as possible by duplicating it.
  // ioredis duplicate() keeps connection options consistent (TLS, auth, etc).
  try {
    const pub = redisClient.duplicate();
    const sub = redisClient.duplicate();

    // Fail-fast-ish: try connecting, but don't block server startup for long.
    await Promise.all([
      pub.connect().catch(() => undefined),
      sub.connect().catch(() => undefined)
    ]);

    // If either is not ready, skip adapter.
    if ((pub.status !== 'ready' && pub.status !== 'connect') || (sub.status !== 'ready' && sub.status !== 'connect')) {
      try { pub.disconnect(); } catch {}
      try { sub.disconnect(); } catch {}
      return null;
    }

    return { pub, sub };
  } catch (e: any) {
    console.warn('[SOCKET] Redis adapter init failed, continuing without adapter:', e?.message || String(e));
    return null;
  }
}

export const setupSocketIO = (server: any) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    // Keep transports explicit; if WS upgrade fails, latency looks like "seconds".
    transports: ['websocket', 'polling'],
    allowEIO3: true
  });

  // Enable Redis adapter when REDIS_URL is present (required for multi-instance).
  // Do not rely on heuristics for REDIS_URL contents.
  createRedisAdapterIfConfigured().then((clients) => {
    if (!clients) {
      console.log('[SOCKET] Redis adapter disabled (no REDIS_URL or Redis unavailable)');
      return;
    }
    try {
      io.adapter(createAdapter(clients.pub, clients.sub));
      console.log('[SOCKET] Socket.IO Redis adapter enabled');
    } catch (e: any) {
      console.warn('[SOCKET] Redis adapter setup failed (using memory adapter):', e?.message || String(e));
      try { clients.pub.disconnect(); } catch {}
      try { clients.sub.disconnect(); } catch {}
    }
  });

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
    // Safety check: ensure user is authenticated
    if (!socket.data.user) {
      console.error(`Connection rejected: No user data for socket ${socket.id}`);
      socket.disconnect();
      return;
    }

    // Helper function to safely get user data
    const getUserData = () => ({
      id: socket.data.user!.id,
      name: socket.data.user!.name || 'Unknown',
      avatar: socket.data.user!.avatar || null
    });

    const userName = socket.data.user.name || 'Unknown';
    console.log(`User ${userName} connected: ${socket.id}`);

    // Join room
    socket.on('room:join', async (data) => {
      try {
        const { roomId } = data;
        const userId = socket.data.user!.id;

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
        trackJoin(roomId, userId);
        
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
        const userData = getUserData();
        io.to(roomId).emit('user:count:update', {
          roomId,
          count: participantCount,
          participants: participantList,
          event: 'user_joined',
          user: userData
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
        trackLeave(roomId, userId);
        
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
          const userData = getUserData();
          io.to(roomId).emit('user:count:update', {
            roomId,
            count: participantCount,
            participants: participantList,
            event: 'user_left',
            user: userData
          });
        }

        console.log(`[ROOM:LEAVE] User ${socket.data.user.name} left room ${roomId}`);
      } catch (error) {
        console.error('[ROOM:LEAVE] Error:', error);
      }
    });

    // Code update
    socket.on('code:update', async (data: any, ack?: (res: CodeUpdateAck) => void) => {
      try {
        const { roomId, code, language } = data || {};
        const userId = socket.data.user.id;
        const serverTime = Date.now();

        if (!roomId || typeof roomId !== 'string') {
          ack?.({ ok: false, serverTime, error: 'Invalid roomId' });
          return;
        }

        if (typeof code !== 'string') {
          ack?.({ ok: false, serverTime, error: 'Invalid code' });
          return;
        }

        if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
          ack?.({ ok: false, serverTime, error: 'Payload too large' });
          return;
        }

        // Fast membership check (avoids DB on each keystroke).
        const members = roomUsers.get(roomId);
        if (!members || !members.has(userId)) {
          ack?.({ ok: false, serverTime, error: 'Not in room' });
          socket.emit('error', { message: 'Not in room' });
          return;
        }

        const safeLanguage = typeof language === 'string' && language.length > 0 ? language : 'javascript';
        const userData = getUserData();

        // Broadcast-first: realtime update should not wait on persistence.
        const payload: CodeUpdatedPayload = {
          roomId,
          code,
          language: safeLanguage,
          timestamp: serverTime,
          userId: userData.id,
          userName: userData.name,
          user: userData
        };

        socket.to(roomId).emit('code:updated', payload);
        ack?.({ ok: true, serverTime });

        // Coalesce persistence (idle flush).
        latestRoomState.set(roomId, { code, language: safeLanguage, updatedAt: serverTime });
        schedulePersist(roomId);
      } catch (error) {
        console.error('Code update error:', error);
        socket.emit('error', { message: 'Failed to update code' });
        try {
          ack?.({ ok: false, serverTime: Date.now(), error: 'Failed to update code' });
        } catch {}
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
        const userData = getUserData();
        socket.to(roomId).emit('cursor:updated', {
          user: userData,
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
      // Ensure user object is complete and safe
      const userData = getUserData();
      
      socket.to(roomId).emit('code:execution:result', {
        result,
        user: userData
      });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log(`[DISCONNECT] User ${socket.data.user.name} disconnected: ${socket.id}`);
      
      // Handle graceful disconnect - update status in all rooms
      try {
        // Fast cleanup for membership map
        for (const [roomId, members] of roomUsers.entries()) {
          if (members.has(socket.data.user.id)) {
            members.delete(socket.data.user.id);
            if (members.size === 0) roomUsers.delete(roomId);
          }
        }

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
            const userData = getUserData();
            io.to(room.roomId).emit('user:count:update', {
              roomId: room.roomId,
              count: participantCount,
              participants: participantList,
              event: 'user_disconnected',
              user: userData
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
        if (dbError.code === 'P2021' || dbError.code === '42P01' || dbError.message?.includes('does not exist') || dbError.message?.includes('relation')) {
          // Silently skip - migrations need to be run via /api/migrate/run endpoint
          return;
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
