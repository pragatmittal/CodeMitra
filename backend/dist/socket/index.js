"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketIO = void 0;
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = __importDefault(require("ioredis"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../utils/prisma");
let pubClient = null;
let subClient = null;
let redisAvailable = false;
if (process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379') {
    try {
        pubClient = new ioredis_1.default(process.env.REDIS_URL, {
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
    }
    catch (error) {
        console.warn('Redis initialization failed (continuing without Redis):', error);
        redisAvailable = false;
    }
}
else {
    console.log('Redis not configured, using memory adapter');
    redisAvailable = false;
}
const setupSocketIO = (server) => {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });
    if (redisAvailable && pubClient && subClient) {
        try {
            io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
            console.log('Socket.IO Redis adapter enabled');
        }
        catch (error) {
            console.warn('Redis adapter failed (using memory adapter):', error);
        }
    }
    else {
        console.log('Socket.IO using memory adapter (Redis not available)');
    }
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
        console.log(`User ${socket.data.user.name} connected: ${socket.id}`);
        socket.on('room:join', async (data) => {
            try {
                const { roomId } = data;
                const userId = socket.data.user.id;
                const participant = await prisma_1.prisma.roomParticipant.findUnique({
                    where: {
                        roomId_userId: { roomId, userId }
                    }
                });
                if (!participant) {
                    socket.emit('error', { message: 'Not authorized to join room' });
                    return;
                }
                await prisma_1.prisma.roomParticipant.update({
                    where: { id: participant.id },
                    data: {
                        status: 'active',
                        lastActivity: new Date()
                    }
                });
                socket.join(roomId);
                const room = await prisma_1.prisma.room.findUnique({
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
                    socket.emit('error', { message: 'Room not found' });
                    return;
                }
                socket.emit('room:state', {
                    roomId,
                    code: room.code,
                    language: room.language,
                    input: room.input,
                    output: room.output,
                    participants: room.participants.map(p => ({
                        id: p.user.id,
                        name: p.user.name,
                        avatar: p.user.avatar,
                        cursorLine: p.cursorLine,
                        cursorColumn: p.cursorColumn,
                        status: p.status
                    }))
                });
                socket.to(roomId).emit('user:joined', {
                    user: {
                        id: socket.data.user.id,
                        name: socket.data.user.name,
                        avatar: socket.data.user.avatar
                    },
                    count: room.participants.length
                });
                socket.to(roomId).emit('room:users', {
                    roomId,
                    users: room.participants.map(p => ({
                        id: p.user.id,
                        name: p.user.name,
                        avatar: p.user.avatar,
                        cursorLine: p.cursorLine,
                        cursorColumn: p.cursorColumn,
                        status: p.status
                    }))
                });
                console.log(`User ${socket.data.user.name} joined room ${roomId}`);
            }
            catch (error) {
                console.error('Room join error:', error);
                socket.emit('error', { message: 'Failed to join room' });
            }
        });
        socket.on('room:leave', async (data) => {
            try {
                const { roomId } = data;
                const userId = socket.data.user.id;
                await prisma_1.prisma.roomParticipant.updateMany({
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
                socket.leave(roomId);
                const count = await getParticipantCount(roomId);
                socket.to(roomId).emit('user:left', {
                    user: {
                        id: socket.data.user.id,
                        name: socket.data.user.name,
                        avatar: socket.data.user.avatar
                    },
                    count
                });
                console.log(`User ${socket.data.user.name} left room ${roomId}`);
            }
            catch (error) {
                console.error('Room leave error:', error);
            }
        });
        socket.on('code:update', async (data) => {
            try {
                const { roomId, code, language } = data;
                const userId = socket.data.user.id;
                const participant = await prisma_1.prisma.roomParticipant.findUnique({
                    where: {
                        roomId_userId: { roomId, userId }
                    }
                });
                if (!participant) {
                    socket.emit('error', { message: 'Not in room' });
                    return;
                }
                await prisma_1.prisma.room.update({
                    where: { id: roomId },
                    data: {
                        code,
                        language: language || 'javascript',
                        updatedAt: new Date()
                    }
                });
                socket.to(roomId).emit('code:updated', {
                    code,
                    language: language || 'javascript',
                    user: socket.data.user
                });
                console.log(`Code updated in room ${roomId} by ${socket.data.user.name}`);
            }
            catch (error) {
                console.error('Code update error:', error);
                socket.emit('error', { message: 'Failed to update code' });
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
                socket.to(roomId).emit('cursor:updated', {
                    user: {
                        id: socket.data.user.id,
                        name: socket.data.user.name,
                        avatar: socket.data.user.avatar
                    },
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
            socket.to(roomId).emit('code:execution:result', {
                result,
                user: socket.data.user
            });
        });
        socket.on('disconnect', async () => {
            console.log(`User ${socket.data.user.name} disconnected: ${socket.id}`);
            try {
                const rooms = await prisma_1.prisma.roomParticipant.findMany({
                    where: {
                        userId: socket.data.user.id,
                        status: 'active'
                    }
                });
                for (const room of rooms) {
                    await prisma_1.prisma.roomParticipant.updateMany({
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
                    const count = await getParticipantCount(room.roomId);
                    socket.to(room.roomId).emit('user:left', {
                        user: {
                            id: socket.data.user.id,
                            name: socket.data.user.name,
                            avatar: socket.data.user.avatar
                        },
                        count
                    });
                }
            }
            catch (error) {
                console.error('Disconnect cleanup error:', error);
            }
        });
    });
    return io;
};
exports.setupSocketIO = setupSocketIO;
async function getParticipantCount(roomId) {
    return await prisma_1.prisma.roomParticipant.count({
        where: { roomId, status: 'active' }
    });
}
//# sourceMappingURL=index.js.map