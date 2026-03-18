"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoomHandlers = void 0;
const prisma_1 = require("../utils/prisma");
const setupRoomHandlers = (io, socket, isUserInRoom, roomUsers) => {
    socket.on('room:join', async (data) => {
        try {
            const { roomId } = data;
            console.log(`🔌🔌🔌 BACKEND: room:join handler called for roomId="${roomId}" by user="${socket.user?.name}"`);
            console.log(`🔌🔌🔌 BACKEND: Full event data:`, data);
            const userId = socket.userId;
            const isAuthorized = await isUserInRoom(userId, roomId);
            if (!isAuthorized) {
                socket.emit('room:error', { message: 'You are not authorized to join this room' });
                return;
            }
            socket.join(roomId);
            console.log(`🔍 DEBUG: User ${socket.user?.name} joined socket room: ${roomId}`);
            if (!roomUsers.has(roomId)) {
                roomUsers.set(roomId, new Set());
            }
            roomUsers.get(roomId).add(userId);
            console.log(`👥 User ${socket.user?.name} added to roomUsers Map for room ${roomId}`);
            const room = await prisma_1.prisma.room.findUnique({
                where: { id: roomId },
                include: {
                    participants: {
                        where: { status: 'active' },
                        include: {
                            user: {
                                select: { id: true, name: true, email: true, avatar: true }
                            }
                        }
                    },
                    creator: {
                        select: { id: true, name: true, avatar: true }
                    }
                }
            });
            if (!room) {
                socket.emit('room:error', { message: 'Room not found' });
                return;
            }
            socket.to(roomId).emit('room:user-joined', {
                user: socket.user,
                roomId,
                timestamp: new Date().toISOString()
            });
            socket.emit('room:joined', {
                room,
                user: socket.user
            });
            socket.emit('room:code-sync', {
                code: room.code,
                language: room.language,
                input: room.input,
                output: room.output,
                roomId
            });
            const updatedUsers = room.participants.map(p => ({
                id: p.user.id,
                name: p.user.name,
                email: p.user.email,
                avatar: p.user.avatar,
                joinedAt: p.joinedAt
            }));
            io.to(roomId).emit('room:users', {
                users: updatedUsers,
                roomId,
                timestamp: new Date().toISOString()
            });
            console.log(`User ${socket.user?.name} joined room ${roomId}`);
        }
        catch (error) {
            console.error('Error joining room:', error);
            socket.emit('room:error', { message: 'Failed to join room' });
        }
    });
    socket.on('room:leave', async (data) => {
        try {
            const { roomId } = data;
            const userId = socket.userId;
            socket.leave(roomId);
            const users = roomUsers.get(roomId);
            if (users && users.has(userId)) {
                users.delete(userId);
                console.log(`👥 User ${socket.user?.name} removed from roomUsers Map for room ${roomId}`);
            }
            socket.to(roomId).emit('room:user-left', {
                userId,
                userName: socket.user?.name,
                roomId,
                timestamp: new Date()
            });
            socket.emit('room:left', { roomId });
            const room = await prisma_1.prisma.room.findUnique({
                where: { id: roomId },
                include: {
                    participants: {
                        where: { status: 'active' },
                        include: {
                            user: {
                                select: { id: true, name: true, email: true, avatar: true }
                            }
                        }
                    }
                }
            });
            if (room) {
                const updatedUsers = room.participants.map(p => ({
                    id: p.user.id,
                    name: p.user.name,
                    email: p.user.email,
                    avatar: p.user.avatar,
                    joinedAt: p.joinedAt
                }));
                io.to(roomId).emit('room:users', {
                    users: updatedUsers,
                    roomId,
                    timestamp: new Date()
                });
            }
            console.log(`User ${socket.user?.name} left room ${roomId}`);
        }
        catch (error) {
            console.error('Error leaving room:', error);
            socket.emit('room:error', { message: 'Failed to leave room' });
        }
    });
    socket.on('room:get-users', async (data) => {
        try {
            const { roomId } = data;
            const userId = socket.userId;
            const isAuthorized = await isUserInRoom(userId, roomId);
            if (!isAuthorized) {
                socket.emit('room:error', { message: 'You are not authorized to view this room' });
                return;
            }
            const room = await prisma_1.prisma.room.findUnique({
                where: { id: roomId },
                include: {
                    participants: {
                        where: { status: 'active' },
                        include: {
                            user: {
                                select: { id: true, name: true, email: true, avatar: true }
                            }
                        }
                    }
                }
            });
            if (!room) {
                socket.emit('room:error', { message: 'Room not found' });
                return;
            }
            const users = room.participants.map(p => ({
                id: p.user.id,
                name: p.user.name,
                email: p.user.email,
                avatar: p.user.avatar,
                joinedAt: p.joinedAt
            }));
            socket.emit('room:users', {
                users,
                roomId,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('Error getting room users:', error);
            socket.emit('room:error', { message: 'Failed to get room users' });
        }
    });
    socket.on('room:get-info', async (data) => {
        try {
            const { roomId } = data;
            const userId = socket.userId;
            const isAuthorized = await isUserInRoom(userId, roomId);
            if (!isAuthorized) {
                socket.emit('room:error', { message: 'You are not authorized to view this room' });
                return;
            }
            const room = await prisma_1.prisma.room.findUnique({
                where: { id: roomId },
                include: {
                    creator: {
                        select: { id: true, name: true, avatar: true }
                    },
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
                socket.emit('room:error', { message: 'Room not found' });
                return;
            }
            socket.emit('room:info', {
                room: {
                    id: room.id,
                    name: room.name,
                    description: room.description,
                    visibility: room.visibility,
                    maxCapacity: room.maxCapacity,
                    language: room.language,
                    creator: room.creator,
                    participantCount: room.participants.length,
                    createdAt: room.createdAt,
                    updatedAt: room.updatedAt
                },
                roomId
            });
        }
        catch (error) {
            console.error('Error getting room info:', error);
            socket.emit('room:error', { message: 'Failed to get room info' });
        }
    });
    socket.on('room:update-settings', async (data) => {
        try {
            const { roomId, settings } = data;
            const userId = socket.userId;
            const room = await prisma_1.prisma.room.findUnique({
                where: { id: roomId }
            });
            if (!room) {
                socket.emit('room:error', { message: 'Room not found' });
                return;
            }
            if (room.creatorId !== userId) {
                socket.emit('room:error', { message: 'Only the room creator can update settings' });
                return;
            }
            const updatedRoom = await prisma_1.prisma.room.update({
                where: { id: roomId },
                data: settings,
                include: {
                    participants: {
                        where: { status: 'active' },
                        include: {
                            user: {
                                select: { id: true, name: true, email: true, avatar: true }
                            }
                        }
                    }
                }
            });
            io.to(roomId).emit('room:settings-updated', {
                room: updatedRoom,
                roomId,
                timestamp: new Date()
            });
            console.log(`Room ${roomId} settings updated by ${socket.user?.name}`);
        }
        catch (error) {
            console.error('Error updating room settings:', error);
            socket.emit('room:error', { message: 'Failed to update room settings' });
        }
    });
    socket.on('room:kick-user', async (data) => {
        try {
            const { roomId, targetUserId } = data;
            const userId = socket.userId;
            const room = await prisma_1.prisma.room.findUnique({
                where: { id: roomId }
            });
            if (!room) {
                socket.emit('room:error', { message: 'Room not found' });
                return;
            }
            if (room.creatorId !== userId) {
                socket.emit('room:error', { message: 'You do not have permission to kick users' });
                return;
            }
            await prisma_1.prisma.roomParticipant.deleteMany({
                where: {
                    userId: targetUserId,
                    roomId
                }
            });
            io.to(roomId).emit('room:user-kicked', {
                userId: targetUserId,
                kickedBy: socket.user?.name,
                roomId,
                timestamp: new Date()
            });
            const updatedRoom = await prisma_1.prisma.room.findUnique({
                where: { id: roomId },
                include: {
                    participants: {
                        where: { status: 'active' },
                        include: {
                            user: {
                                select: { id: true, name: true, email: true, avatar: true }
                            }
                        }
                    }
                }
            });
            if (updatedRoom) {
                const updatedUsers = updatedRoom.participants.map(p => ({
                    id: p.user.id,
                    name: p.user.name,
                    email: p.user.email,
                    avatar: p.user.avatar,
                    joinedAt: p.joinedAt
                }));
                io.to(roomId).emit('room:users', {
                    users: updatedUsers,
                    roomId,
                    timestamp: new Date()
                });
            }
            console.log(`User ${targetUserId} kicked from room ${roomId} by ${socket.user?.name}`);
        }
        catch (error) {
            console.error('Error kicking user:', error);
            socket.emit('room:error', { message: 'Failed to kick user' });
        }
    });
};
exports.setupRoomHandlers = setupRoomHandlers;
//# sourceMappingURL=roomHandlers.js.map