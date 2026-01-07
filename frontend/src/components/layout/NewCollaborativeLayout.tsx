'use client';

import { useState, useCallback, useEffect } from 'react';
import { MonacoEditor } from '@/components/editor/MonacoEditor';
import { EnhancedCodeExecutionPanel } from '@/components/editor/EnhancedCodeExecutionPanel';
import { CleanNavbar } from './CleanNavbar';
import { getBoilerplate } from '@/lib/codeBoilerplates';
import { useAuth } from '@/lib/auth';
import { useRoom } from '@/lib/room';
import { useSocket } from '@/lib/socket';
import { useRouter } from 'next/navigation';
import { GripHorizontal } from 'lucide-react';

interface NewCollaborativeLayoutProps {
  roomId: string;
  initialLanguage?: string;
  initialCode?: string;
  onCodeChange?: (code: string) => void;
  onLanguageChange?: (language: string) => void;
}

export function NewCollaborativeLayout({
  roomId,
  initialLanguage = 'javascript',
  initialCode = '',
  onCodeChange,
  onLanguageChange
}: NewCollaborativeLayoutProps) {

  console.log(`🏗️🏗️🏗️ NewCollaborativeLayout: Rendering with roomId="${roomId}", initialLanguage="${initialLanguage}", initialCode length=${initialCode.length}`);
  const { user } = useAuth();
  const { currentRoom, leaveRoom } = useRoom();
  const { socket, isConnected } = useSocket();
  const router = useRouter();
  
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState(initialLanguage);
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Editor and execution panel heights
  const [editorHeight, setEditorHeight] = useState(65); // Editor takes 65% of center area height
  
  // CRITICAL FIX: User presence tracking
  const [roomUsers, setRoomUsers] = useState<{ id: string; name: string; email: string; avatar?: string; role: string; joinedAt: string }[]>([]);

  // Load boilerplate code only when there's no existing code for initial load
  useEffect(() => {
    if (!code.trim() && !initialCode.trim()) {
      const boilerplate = getBoilerplate(language);
      if (boilerplate) {
        setCode(boilerplate.code);
        onCodeChange?.(boilerplate.code);
      }
    }
  }, [language, code, onCodeChange, initialCode]);

  // Update local state when props change (from room data)
  useEffect(() => {
    if (initialCode !== code) {
      setCode(initialCode);
    }
    if (initialLanguage !== language) {
      setLanguage(initialLanguage);
    }
  }, [initialCode, initialLanguage, code, language]);

  // Handle code changes
  const handleCodeChange = useCallback((value: string) => {
    setCode(value);
    onCodeChange?.(value);
    
    // Sync code changes with other users via WebSocket
    if (socket && isConnected && currentRoom) {
      socket.emit('code:update', {
        roomId: currentRoom.id,
        code: value,
        language
      });
    }
  }, [socket, isConnected, currentRoom, language, onCodeChange]);

  // Handle execution start
  const handleExecutionStart = useCallback(() => {
    setIsExecuting(true);
    
    // Notify other users that code is being executed
    if (socket && isConnected && currentRoom) {
      socket.emit('code:execute', {
        roomId: currentRoom.id,
        code,
        language,
        userId: user?.id
      });
    }
  }, [socket, isConnected, currentRoom, user?.id, language, code]);

  // Handle run code from navbar
  const handleRunCode = useCallback(() => {
    handleExecutionStart();
  }, [handleExecutionStart]);

  // Listen for remote code changes from other users
  useEffect(() => {
    if (!socket || !isConnected || !currentRoom) return;

    const handleRemoteCodeChange = (data: { code: string; language?: string; userId: string }) => {
      if (data.userId !== user?.id) {
        setCode(data.code);
        onCodeChange?.(data.code);
        if (data.language) {
          setLanguage(data.language);
          onLanguageChange?.(data.language);
        }
      }
    };

    const handleRemoteLanguageChange = (data: { language: string; userId: string }) => {
      if (data.userId !== user?.id) {
        setLanguage(data.language);
        onLanguageChange?.(data.language);
      }
    };

    const handleRemoteExecutionStart = (data: { userId: string; language: string }) => {
      if (data.userId !== user?.id) {
        console.log(`User ${data.userId} is executing ${data.language} code`);
      }
    };

    const handleCodeSync = (data: { code: string; language: string; input?: string; output?: string }) => {
      setCode(data.code);
      setLanguage(data.language);
      onCodeChange?.(data.code);
      onLanguageChange?.(data.language);
    };

    socket.on('code:updated', handleRemoteCodeChange);
    socket.on('code:language-changed', handleRemoteLanguageChange);
    socket.on('code:execution-started', handleRemoteExecutionStart);
    socket.on('room:code-sync', handleCodeSync);

    return () => {
      socket.off('code:updated', handleRemoteCodeChange);
      socket.off('code:language-changed', handleRemoteLanguageChange);
      socket.off('code:execution-started', handleRemoteExecutionStart);
      socket.off('room:code-sync', handleCodeSync);
    };
  }, [socket, isConnected, currentRoom, user?.id, onCodeChange, onLanguageChange]);

  // CRITICAL FIX: Listen for user presence updates
  useEffect(() => {
    if (!socket || !isConnected || !currentRoom) return;

    const handleRoomUsers = (data: { users: { id: string; name: string; email: string; avatar?: string; role: string; joinedAt: string }[]; roomId: string; timestamp: string }) => {
      console.log('Room users updated:', data.users);
      setRoomUsers(data.users);
    };

    const handleUserJoined = (data: { user: { id: string; name: string; email: string; avatar?: string }; roomId: string; timestamp: string }) => {
      console.log('User joined room:', data.user.name);
      // The room:users event will handle the actual user list update
    };

    const handleUserLeft = (data: { userId: string; userName: string; roomId: string; timestamp: string }) => {
      console.log('User left room:', data.userName);
      // The room:users event will handle the actual user list update
    };

    socket.on('room:users', handleRoomUsers);
    socket.on('room:user-joined', handleUserJoined);
    socket.on('room:user-left', handleUserLeft);

    return () => {
      socket.off('room:users', handleRoomUsers);
      socket.off('room:user-joined', handleUserJoined);
      socket.off('room:user-left', handleUserLeft);
    };
  }, [socket, isConnected, currentRoom]);

  // Join room when component mounts
  useEffect(() => {
    if (socket && isConnected && currentRoom) {
      socket.emit('room:join', { roomId: currentRoom.id });
    }
  }, [socket, isConnected, currentRoom]);

  // Handle leave room
  const handleLeaveRoom = useCallback(async () => {
    try {
      if (currentRoom && socket) {
        socket.emit('room:leave', { roomId: currentRoom.id });
        await leaveRoom(currentRoom.id);
        router.push('/');
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Error leaving room:', error);
      router.push('/');
    }
  }, [currentRoom, socket, leaveRoom, router]);

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Clean Navbar - Fixed positioned */}
      <CleanNavbar 
        onRunCode={handleRunCode}
        isExecuting={isExecuting}
        currentLanguage={language}
        onLeaveRoom={handleLeaveRoom}
      />

      {/* Main Content Area - Starts below navbar */}
      <div className="flex-1 overflow-hidden flex" style={{ marginTop: '4rem' }}>
        
        {/* Center Area - Editor + Execution Panel */}
        <div className="flex flex-col bg-gray-800 w-full">
          {/* Code Editor */}
          <div 
            className="border-b border-gray-700 relative"
            style={{ height: `${editorHeight}%` }}
          >
            {/* CRITICAL FIX: User count display */}
            <div className="absolute top-4 right-4 z-10 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-sm text-gray-300">
                {roomUsers.length} user{roomUsers.length !== 1 ? 's' : ''} online
              </span>
            </div>
            
            <div className="h-full">
              <MonacoEditor
                roomId={roomId}
                language={language}
                initialCode={code}
                onCodeChange={handleCodeChange}
              />
            </div>
          </div>

          {/* Horizontal Resize Handle */}
          <div
            className="h-1 bg-gray-600 hover:bg-blue-500 cursor-ns-resize relative group"
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startHeight = editorHeight;
              
              const handleMouseMove = (e: MouseEvent) => {
                const deltaY = e.clientY - startY;
                const containerHeight = window.innerHeight - 64; // Account for navbar
                const deltaPercent = (deltaY / containerHeight) * 100;
                const newHeight = Math.max(30, Math.min(80, startHeight + deltaPercent));
                setEditorHeight(newHeight);
              };
              
              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <GripHorizontal className="w-4 h-4 text-gray-400 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Code Execution Panel */}
          <div 
            className="bg-gray-800"
            style={{ height: `${100 - editorHeight}%` }}
          >
            <div className="h-full">
              <EnhancedCodeExecutionPanel
                code={code}
                language={language}
                roomId={currentRoom?.id || ''}
                onExecutionStart={handleExecutionStart}
                onExecutionComplete={() => setIsExecuting(false)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}