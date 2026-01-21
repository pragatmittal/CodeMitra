'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth';
import toast from 'react-hot-toast';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  updateCode: (roomId: string, code: string, language?: string) => void;
  executeCode: (roomId: string, code: string, language: string, input?: string) => void;
  updateInput: (roomId: string, input: string) => void;
  updateCursor: (roomId: string, position: { line: number; column: number }) => void;
  updateSelection: (roomId: string, selection: any) => void;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, token, logout } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connectSocket = useCallback(() => {
    if (socket && socket.connected) {
      console.log('Socket already connected');
      return;
    }
    
    if (!token) {
      console.warn('No authentication token available for socket connection');
      return;
    }

    // Prevent socket connection during build time
    if (typeof window === 'undefined' || process.env.DISABLE_SOCKET_CONNECTION === 'true') {
      console.warn('Socket connection skipped during build time');
      return;
    }

    console.log('Attempting to connect socket...');
        const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

      newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
        setIsConnected(true);
      toast.success('Connected to real-time server!');
      });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
        setIsConnected(false);
      toast.error(`Disconnected from real-time server: ${reason}`);
      
      if (reason === 'io server disconnect' || reason === 'unauthorized') {
        // Server initiated disconnect due to invalid token or other auth issue
        logout();
        toast.error('Authentication expired. Please log in again.');
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      toast.error(`Real-time connection error: ${err.message}`);
    });

      // Room event listeners
      newSocket.on('room:joined', (data) => {
        console.log('Joined room:', data);
        if (data?.room?.name) {
          toast.success(`Joined room: ${data.room.name}`);
        } else {
          toast.success('Joined room');
        }
      });

      newSocket.on('room:left', (data) => {
        console.log('Left room:', data);
        toast.success('Left room');
      });

      newSocket.on('room:user-joined', (data) => {
        console.log('User joined room:', data);
        if (data?.user?.name) {
          toast.success(`${data.user.name} joined the room`);
        } else if (data?.userName) {
          toast.success(`${data.userName} joined the room`);
        } else {
          toast.success('User joined the room');
        }
      });

      newSocket.on('room:user-left', (data) => {
        console.log('User left room:', data);
        const userName = data?.userName || 'Someone';
        toast(`${userName} left the room`);
      });

      newSocket.on('room:error', (data) => {
        console.error('Room error:', data);
        toast.error(data.message || 'Room error occurred');
      });

      // CRITICAL FIX: Listen for room users updates
      newSocket.on('room:users', (data) => {
        console.log('Room users updated:', data);
        // This will be handled by the room component
      });

      // Code event listeners
      newSocket.on('code:updated', (data) => {
        console.log('Code updated:', data);
        // This will be handled by the code editor component
      });

      newSocket.on('code:language-changed', (data) => {
        console.log('Language changed:', data);
        // This will be handled by the code editor component
      });

      newSocket.on('code:input-updated', (data) => {
        console.log('Input updated:', data);
        // This will be handled by the code editor component
      });

      newSocket.on('code:execution-started', (data) => {
        console.log('Code execution started:', data);
        toast('Code execution started...');
      });

      newSocket.on('code:execution-result', (data) => {
        console.log('Code execution result:', data);
        // This will be handled by the code editor component
      });

      newSocket.on('code:cursor-updated', (data) => {
        console.log('Cursor updated:', data);
        // This will be handled by the code editor component
      });

      newSocket.on('code:selection-updated', (data) => {
        console.log('Selection updated:', data);
        // This will be handled by the code editor component
      });

      newSocket.on('code:error', (data) => {
        console.error('Code error:', data);
        toast.error(data.message || 'Code error occurred');
      });

      // Chat event listeners
      newSocket.on('chat:message-received', (data) => {
        console.log('Message received:', data);
        // This will be handled by the chat component
      });

      newSocket.on('chat:user-typing', (data) => {
        console.log('User typing:', data);
        // This will be handled by the chat component
      });

      newSocket.on('chat:user-stopped-typing', (data) => {
        console.log('User stopped typing:', data);
        // This will be handled by the chat component
      });

      newSocket.on('chat:error', (data) => {
        console.error('Chat error:', data);
        toast.error(data.message || 'Chat error occurred');
      });

      // Video event listeners
      newSocket.on('video:joined-call', (data) => {
        console.log('Joined video call:', data);
        toast.success('Joined video call');
      });

      newSocket.on('video:left-call', (data) => {
        console.log('Left video call:', data);
        toast('Left video call');
      });

      newSocket.on('video:user-joined', (data) => {
        console.log('User joined video call:', data);
        // This will be handled by the video component
      });

      newSocket.on('video:user-left', (data) => {
        console.log('User left video call:', data);
        // This will be handled by the video component
      });

      newSocket.on('video:offer-received', (data) => {
        console.log('Video offer received:', data);
        // This will be handled by the video component
      });

      newSocket.on('video:answer-received', (data) => {
        console.log('Video answer received:', data);
        // This will be handled by the video component
      });

      newSocket.on('video:ice-candidate-received', (data) => {
        console.log('ICE candidate received:', data);
        // This will be handled by the video component
      });

      newSocket.on('video:user-mute-changed', (data) => {
        console.log('User mute changed:', data);
        // This will be handled by the video component
      });

      newSocket.on('video:user-video-changed', (data) => {
        console.log('User video changed:', data);
        // This will be handled by the video component
      });

      newSocket.on('video:screen-share-started', (data) => {
        console.log('Screen share started:', data);
        toast(`${data.userName} started screen sharing`);
      });

      newSocket.on('video:screen-share-stopped', (data) => {
        console.log('Screen share stopped:', data);
        toast(`${data.userName} stopped screen sharing`);
      });

      newSocket.on('video:error', (data) => {
        console.error('Video error:', data);
        toast.error(data.message || 'Video error occurred');
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      toast.error(`Server error: ${error.message || 'Unknown error'}`);
      });

      setSocket(newSocket);
  }, [token, logout, socket]);

  const disconnectSocket = useCallback(() => {
      if (socket) {
      console.log('Disconnecting socket...');
      socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
  }, [socket]);

  // Room methods
  const joinRoom = (roomId: string) => {
    if (socket && user) {
      console.log(`🔌🔌🔌 SocketContext.joinRoom: Emitting room:join for room "${roomId}" by user "${user.name}"`);
      socket.emit('room:join', { 
        roomId, 
        userId: user.id, 
        userName: user.name 
      });
      console.log(`✅✅✅ SocketContext.joinRoom: room:join event SUCCESSFULLY EMITTED`);
    } else {
      console.log(`❌❌❌ SocketContext.joinRoom: Cannot join - socket=${!!socket}, user=${user?.name}`);
    }
  };

  const leaveRoom = (roomId: string) => {
    if (socket) {
      socket.emit('room:leave', { roomId });
    }
  };

  // Code methods
  const updateCode = (roomId: string, code: string, language?: string) => {
    if (socket) {
      socket.emit('code:update', { roomId, code, language });
    }
  };

  const executeCode = (roomId: string, code: string, language: string, input?: string) => {
    if (socket) {
      socket.emit('code:execute', { roomId, code, language, input });
    }
  };

  const updateInput = (roomId: string, input: string) => {
    if (socket) {
      socket.emit('code:input-update', { roomId, input });
    }
  };

  const updateCursor = (roomId: string, position: { line: number; column: number }) => {
    if (socket) {
      socket.emit('code:cursor-update', { roomId, position });
    }
  };

  const updateSelection = (roomId: string, selection: any) => {
    if (socket) {
      socket.emit('code:selection-update', { roomId, selection });
    }
  };

  useEffect(() => {
    if (user && token && !socket) {
      connectSocket();
    }

    // Clean up on component unmount
    return () => {
    if (socket) {
        socket.disconnect();
      }
    };
  }, [user, token, socket, connectSocket]);

  const value: SocketContextType = {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    updateCode,
    executeCode,
    updateInput,
    updateCursor,
    updateSelection,
    connectSocket,
    disconnectSocket,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
