"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.codeExecutionQueue = exports.setupCodeHandlers = void 0;
const prisma_1 = require("../utils/prisma");
const bullmq_1 = require("bullmq");
const redis_1 = require("../utils/redis");
const latestRoomState = new Map();
const lastPersistedState = new Map();
const persistTimers = new Map();
const PERSIST_IDLE_MS = Number(process.env.CODE_PERSIST_IDLE_MS || 900);
const MAX_CODE_BYTES = Number(process.env.MAX_CODE_BYTES || 500000);
function schedulePersist(roomId) {
    const existing = persistTimers.get(roomId);
    if (existing)
        clearTimeout(existing);
    const timer = setTimeout(async () => {
        persistTimers.delete(roomId);
        const latest = latestRoomState.get(roomId);
        if (!latest)
            return;
        const last = lastPersistedState.get(roomId);
        if (last && last.code === latest.code && last.language === latest.language)
            return;
        try {
            await prisma_1.prisma.room.update({
                where: { id: roomId },
                data: {
                    code: latest.code,
                    language: latest.language,
                    updatedAt: new Date()
                }
            });
            lastPersistedState.set(roomId, { code: latest.code, language: latest.language });
        }
        catch (err) {
            console.error('[CODE:PERSIST] Failed to persist latest room state:', {
                roomId,
                message: err?.message || String(err)
            });
        }
    }, PERSIST_IDLE_MS);
    persistTimers.set(roomId, timer);
}
const codeExecutionQueue = new bullmq_1.Queue('code-execution', {
    connection: redis_1.bullMQRedisConfig,
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
exports.codeExecutionQueue = codeExecutionQueue;
const setupCodeHandlers = (io, socket, isUserInRoom) => {
    console.log('🔧 Setting up code handlers for socket:', socket.id);
    socket.on('code:update', async (data, ack) => {
        try {
            const { roomId, code, language } = data;
            const userId = socket.userId;
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
            const isAuthorized = await isUserInRoom(userId, roomId);
            if (!isAuthorized) {
                socket.emit('code:error', { message: 'You are not authorized to edit code in this room' });
                ack?.({ ok: false, serverTime, error: 'Not authorized' });
                return;
            }
            const safeLanguage = language || 'javascript';
            const payload = {
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
            latestRoomState.set(roomId, { code, language: safeLanguage, updatedAt: serverTime });
            schedulePersist(roomId);
            console.log(`Code updated in room ${roomId} by ${socket.user?.name}`);
        }
        catch (error) {
            console.error('Error updating code:', error);
            socket.emit('code:error', { message: 'Failed to update code' });
            try {
                ack?.({ ok: false, serverTime: Date.now(), error: 'Failed to update code' });
            }
            catch { }
        }
    });
    socket.on('code:language-change', async (data) => {
        try {
            const { roomId, language } = data;
            const userId = socket.userId;
            console.log(`🔍 DEBUG: Received code:language-change event from user ${socket.user?.name} in room ${roomId}`);
            console.log(`🔍 DEBUG: Event data:`, data);
            const isAuthorized = await isUserInRoom(userId, roomId);
            if (!isAuthorized) {
                socket.emit('code:error', { message: 'You are not authorized to change language in this room' });
                return;
            }
            await prisma_1.prisma.room.update({
                where: { id: roomId },
                data: { language }
            });
            io.to(roomId).emit('code:language-changed', {
                language,
                userId,
                userName: socket.user?.name,
                roomId,
                timestamp: Date.now()
            });
            console.log(`Language changed to ${language} in room ${roomId} by ${socket.user?.name}`);
        }
        catch (error) {
            console.error('Error changing language:', error);
            socket.emit('code:error', { message: 'Failed to change language' });
        }
    });
    socket.on('code:execute', async (data) => {
        try {
            const { roomId, code, language, input = '' } = data;
            const userId = socket.userId;
            console.log(`Code execution request from user ${socket.user?.name} in room ${roomId}`);
            const isAuthorized = await isUserInRoom(userId, roomId);
            if (!isAuthorized) {
                socket.emit('code:error', { message: 'You are not authorized to execute code in this room' });
                return;
            }
            io.to(roomId).emit('code:execution-started', {
                userId,
                userName: socket.user?.name,
                language,
                roomId,
                timestamp: Date.now()
            });
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
            socket.emit('code:execution-queued', {
                jobId: job.id,
                message: 'Code execution queued successfully'
            });
        }
        catch (error) {
            console.error('Error queuing code execution:', error);
            socket.emit('code:error', { message: 'Failed to queue code execution' });
        }
    });
    socket.on('cursor:position', async (data) => {
        try {
            const { roomId, position, selection } = data;
            const userId = socket.userId;
            const isAuthorized = await isUserInRoom(userId, roomId);
            if (!isAuthorized) {
                return;
            }
            socket.to(roomId).emit('cursor:position-updated', {
                userId,
                userName: socket.user?.name,
                position,
                selection,
                roomId,
                timestamp: Date.now()
            });
        }
        catch (error) {
            console.error('Error updating cursor position:', error);
        }
    });
    socket.on('code:sync-request', async (data) => {
        try {
            const { roomId } = data;
            const userId = socket.userId;
            const isAuthorized = await isUserInRoom(userId, roomId);
            if (!isAuthorized) {
                return;
            }
            const room = await prisma_1.prisma.room.findUnique({
                where: { id: roomId },
                select: {
                    code: true,
                    language: true,
                    input: true,
                    output: true
                }
            });
            if (room) {
                socket.emit('code:sync-response', {
                    code: room.code,
                    language: room.language,
                    input: room.input,
                    output: room.output,
                    roomId,
                    timestamp: Date.now()
                });
            }
        }
        catch (error) {
            console.error('Error syncing code:', error);
        }
    });
    socket.on('code:auto-save', async (data) => {
        try {
            const { roomId, code, language } = data;
            const userId = socket.userId;
            const isAuthorized = await isUserInRoom(userId, roomId);
            if (!isAuthorized) {
                return;
            }
            const updateData = { code };
            if (language) {
                updateData.language = language;
            }
            await prisma_1.prisma.room.update({
                where: { id: roomId },
                data: updateData
            });
            console.log(`Auto-save completed for room ${roomId} by ${socket.user?.name}`);
        }
        catch (error) {
            console.error('Error auto-saving code:', error);
        }
    });
};
exports.setupCodeHandlers = setupCodeHandlers;
//# sourceMappingURL=codeHandlers.js.map