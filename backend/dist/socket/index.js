"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketIO = void 0;
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../utils/prisma");
const redis_1 = require("../utils/redis");
const roomUsers = new Map();
const latestRoomState = new Map();
const lastPersistedState = new Map();
const persistTimers = new Map();
const PERSIST_IDLE_MS = Number(process.env.CODE_PERSIST_IDLE_MS || 900);
const MAX_CODE_BYTES = Number(process.env.MAX_CODE_BYTES || 500000);
function trackJoin(roomId, userId) {
    if (!roomUsers.has(roomId))
        roomUsers.set(roomId, new Set());
    roomUsers.get(roomId).add(userId);
}
function trackLeave(roomId, userId) {
    const set = roomUsers.get(roomId);
    if (!set)
        return;
    set.delete(userId);
    if (set.size === 0)
        roomUsers.delete(roomId);
}
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
        if (last && last.code === latest.code && last.language === latest.language) {
            return;
        }
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
async function createRedisAdapterIfConfigured() {
    if (!process.env.REDIS_URL)
        return null;
    try {
        const pub = redis_1.redisClient.duplicate();
        const sub = redis_1.redisClient.duplicate();
        await Promise.all([
            pub.connect().catch(() => undefined),
            sub.connect().catch(() => undefined)
        ]);
        if ((pub.status !== 'ready' && pub.status !== 'connect') || (sub.status !== 'ready' && sub.status !== 'connect')) {
            try {
                pub.disconnect();
            }
            catch { }
            try {
                sub.disconnect();
            }
            catch { }
            return null;
        }
        return { pub, sub };
    }
    catch (e) {
        console.warn('[SOCKET] Redis adapter init failed, continuing without adapter:', e?.message || String(e));
        return null;
    }
}
const setupSocketIO = (server) => {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true
    });
    createRedisAdapterIfConfigured().then((clients) => {
        if (!clients) {
            console.log('[SOCKET] Redis adapter disabled (no REDIS_URL or Redis unavailable)');
            return;
        }
        try {
            io.adapter((0, redis_adapter_1.createAdapter)(clients.pub, clients.sub));
            console.log('[SOCKET] Socket.IO Redis adapter enabled');
        }
        catch (e) {
            console.warn('[SOCKET] Redis adapter setup failed (using memory adapter):', e?.message || String(e));
            try {
                clients.pub.disconnect();
            }
            catch { }
            try {
                clients.sub.disconnect();
            }
            catch { }
        }
    });
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('No token provided'));
            }
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            const user = await prisma_1.prisma.user.findUnique({
                where: { id: decoded.userId || decoded.id },
                select: { id: true, name: true, email: true, avatar: true }
            });
            if (!user) {
                return next(new Error('User not found'));
            }
            socket.data.user = user;
            next();
        }
        catch (error) {
            console.error('Socket authentication error:', error);
            next(new Error('Authentication failed'));
        }
    });
    io.on('connection', (socket) => {
        if (!socket.data.user) {
            console.error(`Connection rejected: No user data for socket ${socket.id}`);
            socket.disconnect();
            return;
        }
        const getUserData = () => ({
            id: socket.data.user.id,
            name: socket.data.user.name || 'Unknown',
            avatar: socket.data.user.avatar || null
        });
        const userName = socket.data.user.name || 'Unknown';
        console.log(`User ${userName} connected: ${socket.id}`);
        socket.on('room:join', async (data) => {
            try {
                const { roomId } = data;
                const userId = socket.data.user.id;
                console.log(`[ROOM:JOIN] User ${socket.data.user.name} (${userId}) attempting to join room ${roomId}`);
                const participant = await prisma_1.prisma.roomParticipant.findUnique({
                    where: {
                        roomId_userId: { roomId, userId }
                    }
                });
                if (!participant) {
                    console.log(`[ROOM:JOIN] User ${userId} not authorized for room ${roomId}`);
                    socket.emit('error', { message: 'Not authorized to join room' });
                    return;
                }
                const result = await prisma_1.prisma.$transaction(async (tx) => {
                    await tx.roomParticipant.update({
                        where: { id: participant.id },
                        data: {
                            status: 'active',
                            lastActivity: new Date()
                        }
                    });
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
                socket.emit('room:state', {
                    roomId,
                    code: room.code,
                    language: room.language,
                    input: room.input,
                    output: room.output,
                    participants: participantList,
                    participantCount
                });
                const userData = getUserData();
                io.to(roomId).emit('user:count:update', {
                    roomId,
                    count: participantCount,
                    participants: participantList,
                    event: 'user_joined',
                    user: userData
                });
                socket.emit('room:joined', {
                    roomId,
                    participantCount,
                    participants: participantList
                });
                console.log(`[ROOM:JOIN] User ${socket.data.user.name} successfully joined room ${roomId} (${participantCount} total)`);
            }
            catch (error) {
                console.error('[ROOM:JOIN] Error:', error);
                socket.emit('error', { message: 'Failed to join room' });
            }
        });
        socket.on('room:leave', async (data) => {
            try {
                const { roomId } = data;
                const userId = socket.data.user.id;
                console.log(`[ROOM:LEAVE] User ${socket.data.user.name} (${userId}) leaving room ${roomId}`);
                const result = await prisma_1.prisma.$transaction(async (tx) => {
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
            }
            catch (error) {
                console.error('[ROOM:LEAVE] Error:', error);
            }
        });
        socket.on('code:update', async (data, ack) => {
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
                const members = roomUsers.get(roomId);
                if (!members || !members.has(userId)) {
                    ack?.({ ok: false, serverTime, error: 'Not in room' });
                    socket.emit('error', { message: 'Not in room' });
                    return;
                }
                const safeLanguage = typeof language === 'string' && language.length > 0 ? language : 'javascript';
                const userData = getUserData();
                const payload = {
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
                latestRoomState.set(roomId, { code, language: safeLanguage, updatedAt: serverTime });
                schedulePersist(roomId);
            }
            catch (error) {
                console.error('Code update error:', error);
                socket.emit('error', { message: 'Failed to update code' });
                try {
                    ack?.({ ok: false, serverTime: Date.now(), error: 'Failed to update code' });
                }
                catch { }
            }
        });
        socket.on('cursor:update', async (data) => {
            try {
                const { roomId, line, column } = data;
                const userId = socket.data.user.id;
                await prisma_1.prisma.roomParticipant.updateMany({
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
                const userData = getUserData();
                socket.to(roomId).emit('cursor:updated', {
                    user: userData,
                    line,
                    column
                });
            }
            catch (error) {
                console.error('Cursor update error:', error);
            }
        });
        socket.on('code:execution', (data) => {
            const { roomId, result } = data;
            const userData = getUserData();
            socket.to(roomId).emit('code:execution:result', {
                result,
                user: userData
            });
        });
        socket.on('disconnect', async () => {
            console.log(`[DISCONNECT] User ${socket.data.user.name} disconnected: ${socket.id}`);
            try {
                for (const [roomId, members] of roomUsers.entries()) {
                    if (members.has(socket.data.user.id)) {
                        members.delete(socket.data.user.id);
                        if (members.size === 0)
                            roomUsers.delete(roomId);
                    }
                }
                const rooms = await prisma_1.prisma.roomParticipant.findMany({
                    where: {
                        userId: socket.data.user.id,
                        status: 'active'
                    }
                });
                console.log(`[DISCONNECT] User was active in ${rooms.length} rooms`);
                for (const room of rooms) {
                    const result = await prisma_1.prisma.$transaction(async (tx) => {
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
            }
            catch (error) {
                console.error('[DISCONNECT] Cleanup error:', error);
            }
        });
    });
    setInterval(async () => {
        try {
            try {
                await prisma_1.prisma.$queryRaw `SELECT 1 FROM rooms LIMIT 1`;
            }
            catch (dbError) {
                if (dbError.code === 'P2021' || dbError.code === '42P01' || dbError.message?.includes('does not exist') || dbError.message?.includes('relation')) {
                    return;
                }
                throw dbError;
            }
            console.log('[HEARTBEAT] Starting periodic reconciliation...');
            const rooms = await prisma_1.prisma.room.findMany({
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
                io.to(room.id).emit('user:count:update', {
                    roomId: room.id,
                    count: participantCount,
                    participants: participantList,
                    event: 'heartbeat_reconciliation'
                });
                console.log(`[HEARTBEAT] Room ${room.id} reconciled: ${participantCount} participants`);
            }
        }
        catch (error) {
            if (error.code !== 'P2021' && !error.message?.includes('does not exist')) {
                console.error('[HEARTBEAT] Reconciliation error:', error);
            }
        }
    }, 30000);
    return io;
};
exports.setupSocketIO = setupSocketIO;
async function getParticipantCount(roomId) {
    return await prisma_1.prisma.roomParticipant.count({
        where: { roomId, status: 'active' }
    });
}
//# sourceMappingURL=index.js.map