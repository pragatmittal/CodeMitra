'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth';
import toast from 'react-hot-toast';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
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

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectSocket, disconnectSocket }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
