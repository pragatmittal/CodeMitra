import { prisma } from '../utils/prisma';
import { AuthenticatedSocket, Server } from './types';
import { Queue } from 'bullmq';
import { redisClient, bullMQRedisConfig } from '../utils/redis';

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

// Coalesced persistence per room (shared across sockets in this process)
const latestRoomState: Map<string, { code: string; language: string; updatedAt: number }> = new Map();
const lastPersistedState: Map<string, { code: string; language: string }> = new Map();
const persistTimers: Map<string, NodeJS.Timeout> = new Map();

const PERSIST_IDLE_MS = Number(process.env.CODE_PERSIST_IDLE_MS || 900);
const MAX_CODE_BYTES = Number(process.env.MAX_CODE_BYTES || 500_000);

function schedulePersist(roomId: string) {
  const existing = persistTimers.get(roomId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    persistTimers.delete(roomId);
    const latest = latestRoomState.get(roomId);
    if (!latest) return;

    const last = lastPersistedState.get(roomId);
    if (last && last.code === latest.code && last.language === latest.language) return;

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
      console.error('[CODE:PERSIST] Failed to persist latest room state:', {
        roomId,
        message: err?.message || String(err)
      });
    }
  }, PERSIST_IDLE_MS);

  persistTimers.set(roomId, timer);
}

// Create BullMQ queue for code execution
const codeExecutionQueue = new Queue('code-execution', {
  connection: bullMQRedisConfig,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const setupCodeHandlers = (io: Server, socket: AuthenticatedSocket, isUserInRoom: (userId: string, roomId: string) => Promise<boolean>) => {
  console.log('🔧 Setting up code handlers for socket:', socket.id);
  
  // Handle code updates with real-time sync
  socket.on('code:update', async (data: { roomId: string; code: string; language?: string; userId?: string; userName?: string; timestamp?: number }, ack?: (res: CodeUpdateAck) => void) => {
    try {
      const { roomId, code, language } = data;
      const userId = socket.userId!;
      const serverTime = Date.now();

      console.log(`📤📤📤 BACKEND: code:update handler called for roomId="${roomId}" by user="${socket.user?.name}"`);
      console.log(`📤📤📤 BACKEND: Event data:`, data);
      console.log(`📤📤📤 BACKEND: Code length: ${code.length}, language: ${language}`);

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

      // Check if user is authorized
      const isAuthorized = await isUserInRoom(userId, roomId);
      if (!isAuthorized) {
        socket.emit('code:error', { message: 'You are not authorized to edit code in this room' });
        ack?.({ ok: false, serverTime, error: 'Not authorized' });
        return;
      }

      const safeLanguage = language || 'javascript';

      // Broadcast-first: realtime update should not wait on persistence
      const payload: CodeUpdatedPayload = {
        roomId,
        code,
        language: safeLanguage,
        timestamp: serverTime,
        userId,
        userName: socket.user?.name || 'Unknown',
        user: {
          id: userId,
          name: socket.user?.name || 'Unknown',
          avatar: socket.user?.avatar || null
        }
      };

      socket.to(roomId).emit('code:updated', payload);
      ack?.({ ok: true, serverTime });

      // Coalesce persistence (idle flush)
      latestRoomState.set(roomId, { code, language: safeLanguage, updatedAt: serverTime });
      schedulePersist(roomId);

      console.log(`Code updated in room ${roomId} by ${socket.user?.name}`);
    } catch (error) {
      console.error('Error updating code:', error);
      socket.emit('code:error', { message: 'Failed to update code' });
      try {
        ack?.({ ok: false, serverTime: Date.now(), error: 'Failed to update code' });
      } catch {}
    }
  });

  // Handle language changes
  socket.on('code:language-change', async (data: { roomId: string; language: string }) => {
    try {
      const { roomId, language } = data;
      const userId = socket.userId!;

      console.log(`🔍 DEBUG: Received code:language-change event from user ${socket.user?.name} in room ${roomId}`);
      console.log(`🔍 DEBUG: Event data:`, data);

      // Check if user is authorized
      const isAuthorized = await isUserInRoom(userId, roomId);
      if (!isAuthorized) {
        socket.emit('code:error', { message: 'You are not authorized to change language in this room' });
        return;
      }

      // Update language in database
      await prisma.room.update({
        where: { id: roomId },
        data: { language }
      });

      // Broadcast language change to all users in the room
      io.to(roomId).emit('code:language-changed', {
        language,
        userId,
        userName: socket.user?.name,
        roomId,
        timestamp: Date.now()
      });

      console.log(`Language changed to ${language} in room ${roomId} by ${socket.user?.name}`);
    } catch (error) {
      console.error('Error changing language:', error);
      socket.emit('code:error', { message: 'Failed to change language' });
    }
  });

  // Handle code execution requests
  socket.on('code:execute', async (data: { roomId: string; code: string; language: string; input?: string }) => {
    try {
      const { roomId, code, language, input = '' } = data;
      const userId = socket.userId!;

      console.log(`Code execution request from user ${socket.user?.name} in room ${roomId}`);

      // Check if user is authorized
      const isAuthorized = await isUserInRoom(userId, roomId);
      if (!isAuthorized) {
        socket.emit('code:error', { message: 'You are not authorized to execute code in this room' });
        return;
      }

      // Notify all users that code execution has started
      io.to(roomId).emit('code:execution-started', {
        userId,
        userName: socket.user?.name,
        language,
        roomId,
        timestamp: Date.now()
      });

      // Add job to execution queue
      const job = await codeExecutionQueue.add('execute', {
        executionId: `exec_${Date.now()}_${userId}`,
        language,
        code,
        input,
        roomId,
        userId,
        timestamp: Date.now()
      }, {
        removeOnComplete: true,
        removeOnFail: true
      });

      console.log(`Code execution job ${job.id} added to queue for room ${roomId}`);

      // Emit job queued event
      socket.emit('code:execution-queued', {
        jobId: job.id,
        message: 'Code execution queued successfully'
      });

    } catch (error) {
      console.error('Error queuing code execution:', error);
      socket.emit('code:error', { message: 'Failed to queue code execution' });
    }
  });

  // Handle cursor position updates
  socket.on('cursor:position', async (data: { roomId: string; position: any; selection?: any }) => {
    try {
      const { roomId, position, selection } = data;
      const userId = socket.userId!;

      // Check if user is authorized
      const isAuthorized = await isUserInRoom(userId, roomId);
      if (!isAuthorized) {
        return;
      }

      // Broadcast cursor position to other users in the room
      socket.to(roomId).emit('cursor:position-updated', {
        userId,
        userName: socket.user?.name,
        position,
        selection,
        roomId,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error updating cursor position:', error);
    }
  });

  // Handle code sync requests
  socket.on('code:sync-request', async (data: { roomId: string }) => {
    try {
      const { roomId } = data;
      const userId = socket.userId!;

      // Check if user is authorized
      const isAuthorized = await isUserInRoom(userId, roomId);
      if (!isAuthorized) {
        return;
      }

      // Get current room state
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: {
          code: true,
          language: true,
          input: true,
          output: true
        }
      });

      if (room) {
        // Send current code state to requesting user
        socket.emit('code:sync-response', {
          code: room.code,
          language: room.language,
          input: room.input,
          output: room.output,
          roomId,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      console.error('Error syncing code:', error);
    }
  });

  // Handle auto-save requests
  socket.on('code:auto-save', async (data: { roomId: string; code: string; language?: string }) => {
    try {
      const { roomId, code, language } = data;
      const userId = socket.userId!;

      // Check if user is authorized
      const isAuthorized = await isUserInRoom(userId, roomId);
      if (!isAuthorized) {
        return;
      }

      // Update code in database (silent update)
      const updateData: any = { code };
      if (language) {
        updateData.language = language;
      }

      await prisma.room.update({
        where: { id: roomId },
        data: updateData
      });

      console.log(`Auto-save completed for room ${roomId} by ${socket.user?.name}`);

    } catch (error) {
      console.error('Error auto-saving code:', error);
    }
  });
};

export { codeExecutionQueue };
