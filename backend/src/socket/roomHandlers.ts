import { AuthenticatedSocket, Server } from './types';
import { prisma } from '../utils/prisma';



export const setupRoomHandlers = (io: Server, socket: AuthenticatedSocket, isUserInRoom: (userId: string, roomId: string) => Promise<boolean>, roomUsers: Map<string, Set<string>>) => {
  // Join a room
  socket.on('room:join', async (data: { roomId: string; userId?: string; userName?: string }) => {
    try {
      const { roomId } = data;
      console.log(`🔌🔌🔌 BACKEND: room:join handler called for roomId="${roomId}" by user="${socket.user?.name}"`);
      console.log(`🔌🔌🔌 BACKEND: Full event data:`, data);
      const userId = socket.userId!;

      // Check if user is authorized to join this room
      const isAuthorized = await isUserInRoom(userId, roomId);
      if (!isAuthorized) {
        socket.emit('room:error', { message: 'You are not authorized to join this room' });
        return;
      }

      // Join the socket room
      socket.join(roomId);
      console.log(`🔍 DEBUG: User ${socket.user?.name} joined socket room: ${roomId}`);

      // CRITICAL FIX: Update roomUsers tracking
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Set());
      }
      roomUsers.get(roomId)!.add(userId);
      console.log(`👥 User ${socket.user?.name} added to roomUsers Map for room ${roomId}`);

      // Get room data with current users
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          users: {
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

      // Notify other users in the room that someone joined
      socket.to(roomId).emit('room:user-joined', {
        user: socket.user,
        roomId,
        timestamp: new Date().toISOString()
      });

      // Send room data to the user
      socket.emit('room:joined', {
        room,
        user: socket.user
      });

      // Send current code state to the new user
      socket.emit('room:code-sync', {
        code: room.code,
        language: room.language,
        input: room.input,
        output: room.output,
        roomId
      });

      // Broadcast updated user list to ALL users in the room (including the new user)
      const updatedUsers = room.users.map(ru => ({
        id: ru.user.id,
        name: ru.user.name,
        email: ru.user.email,
        avatar: ru.user.avatar,
        role: ru.role,
        joinedAt: ru.joinedAt
      }));

      io.to(roomId).emit('room:users', {
        users: updatedUsers,
        roomId,
        timestamp: new Date().toISOString()
      });

      console.log(`User ${socket.user?.name} joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('room:error', { message: 'Failed to join room' });
    }
  });

  // Leave a room
  socket.on('room:leave', async (data: { roomId: string }) => {
    try {
      const { roomId } = data;
      const userId = socket.userId!;

      // Leave the socket room
      socket.leave(roomId);

      // CRITICAL FIX: Update roomUsers tracking
      const users = roomUsers.get(roomId);
      if (users && users.has(userId)) {
        users.delete(userId);
        console.log(`👥 User ${socket.user?.name} removed from roomUsers Map for room ${roomId}`);
      }

      // Notify other users in the room
      socket.to(roomId).emit('room:user-left', {
        userId,
        userName: socket.user?.name,
        roomId,
        timestamp: new Date()
      });

      socket.emit('room:left', { roomId });

      // Update user list for remaining users
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          users: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatar: true }
              }
            }
          }
        }
      });

      if (room) {
        const updatedUsers = room.users.map(ru => ({
          id: ru.user.id,
          name: ru.user.name,
          email: ru.user.email,
          avatar: ru.user.avatar,
          role: ru.role,
          joinedAt: ru.joinedAt
        }));

        io.to(roomId).emit('room:users', {
          users: updatedUsers,
          roomId,
          timestamp: new Date()
        });
      }

      console.log(`User ${socket.user?.name} left room ${roomId}`);
    } catch (error) {
      console.error('Error leaving room:', error);
      socket.emit('room:error', { message: 'Failed to leave room' });
    }
  });

  // Get room users
  socket.on('room:get-users', async (data: { roomId: string }) => {
    try {
      const { roomId } = data;
      const userId = socket.userId!;

      // Check if user is authorized
      const isAuthorized = await isUserInRoom(userId, roomId);
      if (!isAuthorized) {
        socket.emit('room:error', { message: 'You are not authorized to view this room' });
        return;
      }

      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          users: {
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

      const users = room.users.map(ru => ({
        id: ru.user.id,
        name: ru.user.name,
        email: ru.user.email,
        avatar: ru.user.avatar,
        role: ru.role,
        joinedAt: ru.joinedAt
      }));

      socket.emit('room:users', {
        users,
        roomId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting room users:', error);
      socket.emit('room:error', { message: 'Failed to get room users' });
    }
  });

  // Get room info
  socket.on('room:get-info', async (data: { roomId: string }) => {
    try {
      const { roomId } = data;
      const userId = socket.userId!;

      // Check if user is authorized
      const isAuthorized = await isUserInRoom(userId, roomId);
      if (!isAuthorized) {
        socket.emit('room:error', { message: 'You are not authorized to view this room' });
        return;
      }

      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          owner: {
            select: { id: true, name: true, avatar: true }
          },
          users: {
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
          isPublic: room.isPublic,
          maxUsers: room.maxUsers,
          language: room.language,
          owner: room.owner,
          userCount: room.users.length,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt
        },
        roomId
      });
    } catch (error) {
      console.error('Error getting room info:', error);
      socket.emit('room:error', { message: 'Failed to get room info' });
    }
  });

  // Update room settings (owner only)
  socket.on('room:update-settings', async (data: { roomId: string; settings: any }) => {
    try {
      const { roomId, settings } = data;
      const userId = socket.userId!;

      // Check if user is the room owner
      const room = await prisma.room.findUnique({
        where: { id: roomId }
      });

      if (!room) {
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }

      if (room.ownerId !== userId) {
        socket.emit('room:error', { message: 'Only the room owner can update settings' });
        return;
      }

      // Update room settings
      const updatedRoom = await prisma.room.update({
        where: { id: roomId },
        data: settings,
        include: {
          users: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatar: true }
              }
            }
          }
        }
      });

      // Notify all users in the room
      io.to(roomId).emit('room:settings-updated', {
        room: updatedRoom,
        roomId,
        timestamp: new Date()
      });

      console.log(`Room ${roomId} settings updated by ${socket.user?.name}`);
    } catch (error) {
      console.error('Error updating room settings:', error);
      socket.emit('room:error', { message: 'Failed to update room settings' });
    }
  });

  // Kick user from room (owner/admin only)
  socket.on('room:kick-user', async (data: { roomId: string; targetUserId: string }) => {
    try {
      const { roomId, targetUserId } = data;
      const userId = socket.userId!;

      // Check if user has permission to kick
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          users: true
        }
      });

      if (!room) {
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }

      const currentUser = room.users.find((u: { userId: string; role: string; }) => u.userId === userId);
      if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'admin')) {
        socket.emit('room:error', { message: 'You do not have permission to kick users' });
        return;
      }

      // Remove user from room
      await prisma.roomUser.deleteMany({
        where: {
          userId: targetUserId,
          roomId
        }
      });

      // Notify all users in the room
      io.to(roomId).emit('room:user-kicked', {
        userId: targetUserId,
        kickedBy: socket.user?.name,
        roomId,
        timestamp: new Date()
      });

      // Update user list for remaining users
      const updatedRoom = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          users: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatar: true }
              }
            }
          }
        }
      });

      if (updatedRoom) {
        const updatedUsers = updatedRoom.users.map(ru => ({
          id: ru.user.id,
          name: ru.user.name,
          email: ru.user.email,
          avatar: ru.user.avatar,
          role: ru.role,
          joinedAt: ru.joinedAt
        }));

        io.to(roomId).emit('room:users', {
          users: updatedUsers,
          roomId,
          timestamp: new Date()
        });
      }

      console.log(`User ${targetUserId} kicked from room ${roomId} by ${socket.user?.name}`);
    } catch (error) {
      console.error('Error kicking user:', error);
      socket.emit('room:error', { message: 'Failed to kick user' });
    }
  });
};
