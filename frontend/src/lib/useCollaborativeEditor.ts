/**
 * Custom hook for managing collaborative code editing
 * Handles real-time synchronization, cursor sharing, and conflict resolution
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from './socket';
import { useAuth } from './auth';
import { useRoom } from './room';
import { ot, Operation } from './operationalTransform';

export interface CursorPosition {
  userId: string;
  userName: string;
  userColor: string;
  position: {
    lineNumber: number;
    column: number;
  };
  selection?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

export interface CodeChange {
  userId: string;
  userName: string;
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  text: string;
  timestamp: number;
}

export interface CollaborativeEditorState {
  code: string;
  language: string;
  cursors: CursorPosition[];
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: number;
  pendingChanges: Operation[];
  version: number;
}

export function useCollaborativeEditor(roomId: string, initialCode: string = '', initialLanguage: string = 'javascript') {
  const { socket, isConnected, joinRoom, updateCode } = useSocket();
  const { user } = useAuth();
  const { currentRoom } = useRoom();
  
  console.log(`🔧🔧🔧 useCollaborativeEditor: Hook called with roomId="${roomId}", socket=${!!socket}, isConnected=${isConnected}, user="${user?.name}", currentRoom="${currentRoom?.id}"`);
  console.log(`🔧🔧🔧 useCollaborativeEditor: initialCode length=${initialCode.length}, initialLanguage="${initialLanguage}"`);
  
  // Add interval debugging to track state changes
  useEffect(() => {
    const interval = setInterval(() => {
      console.log(`🔧⏰ useCollaborativeEditor: State check - roomId="${roomId}", socket=${!!socket}, isConnected=${isConnected}, user="${user?.name}"`);
    }, 5000);
    return () => clearInterval(interval);
  }, [roomId, socket, isConnected, user]);
  
  // Editor state
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState(initialLanguage);
  const [cursors, setCursors] = useState<CursorPosition[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const [pendingChanges, setPendingChanges] = useState<Operation[]>([]);
  const [version, setVersion] = useState(0);
  
  // Refs for tracking state
  const lastCodeRef = useRef(initialCode);
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Get unique color for user
  const getUserColor = useCallback((userId: string): string => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
      '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
    ];
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  }, []);
  
  // Sync code changes with other users
  const syncCodeChanges = useCallback(async (newCode: string) => {
    console.log(`📤📤📤 syncCodeChanges: CALLED!`);
    console.log(`📤📤📤 syncCodeChanges: socket=${!!socket}, isConnected=${isConnected}, user=${user?.name}, roomId=${roomId}`);
    
    if (!socket || !isConnected || !user || !roomId) {
      console.log(`❌❌❌ syncCodeChanges: CANNOT SYNC - missing requirements:`);
      console.log(`❌❌❌ - socket: ${!!socket}`);
      console.log(`❌❌❌ - isConnected: ${isConnected}`);
      console.log(`❌❌❌ - user: ${user?.name}`);
      console.log(`❌❌❌ - roomId: ${roomId}`);
      return;
    }
    
    const oldCode = lastCodeRef.current;
    console.log(`📤📤📤 syncCodeChanges: oldCode length=${oldCode.length}, newCode length=${newCode.length}`);
    
    if (oldCode === newCode) {
      console.log(`📤📤📤 syncCodeChanges: Code unchanged - skipping sync`);
      return;
    }
    
    let transformedOperations: Operation[] = [];
    
    try {
      setIsSyncing(true);
      console.log(`📤📤📤 syncCodeChanges: Setting syncing state to true`);
      
      // Create operations from text changes
      const operations = ot.createOperation(oldCode, newCode, user.id, Date.now());
      console.log(`📤📤📤 syncCodeChanges: Created ${operations.length} operations`);
      
      // Transform operations against pending changes
      transformedOperations = operations;
      for (const pendingOp of pendingChanges) {
        const result = ot.transform(operations[0], pendingOp);
        transformedOperations = result.transformed;
      }
      console.log(`📤📤📤 syncCodeChanges: Transformed operations, final count: ${transformedOperations.length}`);
      
      // Use SocketContext method instead of direct socket.emit
      console.log(`📤📤📤 syncCodeChanges: ABOUT TO CALL updateCode method for room "${roomId}"`);
      console.log(`📤📤📤 syncCodeChanges: Code length: ${newCode.length}, language: ${language}`);
      
      if (updateCode) {
        updateCode(roomId, newCode, language);
        console.log(`✅✅✅ syncCodeChanges: updateCode method SUCCESSFULLY CALLED for room "${roomId}"`);
      } else {
        console.log(`❌❌❌ syncCodeChanges: updateCode function not available!`);
      }
      
      // Update local state
      setVersion(prev => prev + 1);
      setLastSyncTime(Date.now());
      lastCodeRef.current = newCode;
      setPendingChanges([]);
      console.log(`📤📤📤 syncCodeChanges: Local state updated successfully`);
      
    } catch (error) {
      console.error('❌❌❌ syncCodeChanges: Failed to sync code changes:', error);
      // Add to pending changes for retry
      if (transformedOperations.length > 0) {
        setPendingChanges(prev => [...prev, ...transformedOperations]);
      }
    } finally {
      setIsSyncing(false);
      console.log(`📤📤📤 syncCodeChanges: Setting syncing state to false`);
    }
  }, [socket, isConnected, user?.id, roomId, pendingChanges, language]); // Removed function dependency
  
  // Debounced sync function
  const debouncedSync = useCallback((newCode: string) => {
    console.log(`⏰⏰⏰ debouncedSync: Called with code length ${newCode.length}`);
    
    if (syncTimeoutRef.current) {
      console.log(`⏰⏰⏰ debouncedSync: Clearing existing timeout`);
      clearTimeout(syncTimeoutRef.current);
    }
    
    console.log(`⏰⏰⏰ debouncedSync: Setting 300ms timeout for syncCodeChanges`);
    syncTimeoutRef.current = setTimeout(() => {
      console.log(`⏰⏰⏰ debouncedSync: Timeout fired - calling syncCodeChanges now!`);
      syncCodeChanges(newCode);
    }, 300); // 300ms debounce
  }, [syncCodeChanges]);
  
  // Handle code changes from user input
  const handleCodeChange = useCallback((newCode: string) => {
    console.log(`🔄🔄🔄 useCollaborativeEditor: CODE CHANGE DETECTED!`);
    console.log(`🔄🔄🔄 useCollaborativeEditor: newCode length: ${newCode.length}`);
    console.log(`🔄🔄🔄 useCollaborativeEditor: roomId: "${roomId}"`);
    console.log(`🔄🔄🔄 useCollaborativeEditor: user: "${user?.name}"`);
    console.log(`🔄🔄🔄 useCollaborativeEditor: socket connected: ${!!socket && isConnected}`);
    
    setCode(newCode);
    
    console.log(`🔄🔄🔄 useCollaborativeEditor: About to call debouncedSync...`);
    debouncedSync(newCode);
    console.log(`🔄🔄🔄 useCollaborativeEditor: debouncedSync called successfully`);
  }, [debouncedSync, roomId, user, socket, isConnected]);
  
  // Handle language changes
  const handleLanguageChange = useCallback((newLanguage: string) => {
    setLanguage(newLanguage);
    
    // Notify other users of language change
    if (socket && isConnected && currentRoom) {
      socket.emit('languageChange', {
        roomId: currentRoom.id,
        language: newLanguage,
        userId: user?.id,
        timestamp: Date.now()
      });
    }
  }, [socket, isConnected, currentRoom, user?.id]);
  
  // Update cursor position
  const updateCursorPosition = useCallback((position: { lineNumber: number; column: number }, selection?: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }) => {
    if (!socket || !isConnected || !user || !currentRoom) return;
    
    // Emit cursor update
    socket.emit('cursor:position', {
      roomId: currentRoom.id,
      position: position,
      selection: selection,
      timestamp: Date.now()
    });
  }, [socket, isConnected, user, currentRoom]);
  
  // Socket event handlers
  useEffect(() => {
    if (!socket) return;
    
    // Handle incoming code changes from backend
    const handleCodeChange = (data: { code: string; language?: string; userId: string; userName?: string; roomId: string; timestamp: number }) => {
      console.log('🔄🔄🔄 useCollaborativeEditor: Received code:updated event', data);
      console.log('🔄🔄🔄 useCollaborativeEditor: Current user ID:', user?.id);
      console.log('🔄🔄🔄 useCollaborativeEditor: Event user ID:', data.userId);
      console.log('🔄🔄🔄 useCollaborativeEditor: Should ignore:', data.userId === user?.id);
      
      if (data.userId === user?.id) {
        console.log('🔄🔄🔄 useCollaborativeEditor: Ignoring own code change');
        return; // Ignore own changes
      }
      
      console.log('🔄🔄🔄 useCollaborativeEditor: Processing code change from another user');
      setCode(data.code);
      if (data.language) {
        setLanguage(data.language);
      }
      lastCodeRef.current = data.code;
      setPendingChanges([]);
      console.log('🔄🔄🔄 useCollaborativeEditor: Code updated successfully');
    };
    
    // Handle incoming cursor updates
    const handleCursorUpdate = (data: { position: { lineNumber: number; column: number }; selection?: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }; userId: string; userName?: string; roomId: string; timestamp: number }) => {
      if (data.userId === user?.id) return; // Ignore own cursor
      
      const newCursor: CursorPosition = {
        userId: data.userId,
        userName: data.userName || '',
        userColor: getUserColor(data.userId),
        position: data.position,
        selection: data.selection
      };
      
      setCursors(prev => {
        const existing = prev.find(c => c.userId === data.userId);
        if (existing) {
          return prev.map(c => c.userId === data.userId ? newCursor : c);
        } else {
          return [...prev, newCursor];
        }
      });
    };
    
    // Handle language changes
    const handleLanguageChange = (data: { language: string; userId: string }) => {
      if (data.userId === user?.id) return; // Ignore own changes
      setLanguage(data.language);
    };
    
    // Handle full sync requests
    const handleSyncRequest = (data: { roomId: string; userId: string }) => {
      if (data.userId === user?.id) return; // Ignore own requests
      
      // Send current code state
      socket.emit('code:sync-request', {
        roomId: data.roomId
      });
    };
    
    // Handle incoming sync from room:code-sync (when joining room)
    const handleRoomCodeSync = (data: { code: string; language: string; input?: string; output?: string; roomId: string }) => {
      console.log('🔄 MonacoEditor: Received room:code-sync', data);
      setCode(data.code);
      setLanguage(data.language);
      lastCodeRef.current = data.code;
      setPendingChanges([]);
    };
    
    // Handle incoming sync
    const handleCodeSync = (data: { code: string; language: string; version: number; userId: string }) => {
      if (data.userId === user?.id) return; // Ignore own sync
      
      setCode(data.code);
      setLanguage(data.language);
      setVersion(data.version);
      lastCodeRef.current = data.code;
      setPendingChanges([]);
    };
    
    // Handle user join/leave
    const handleUserJoin = (data: { userId: string; userName: string }) => {
      // Remove cursor when user leaves
      setCursors(prev => prev.filter(c => c.userId !== data.userId));
    };
    
    const handleUserLeave = (data: { userId: string }) => {
      // Remove cursor when user leaves
      setCursors(prev => prev.filter(c => c.userId !== data.userId));
    };
    
    // Register event listeners
    socket.on('code:updated', handleCodeChange);
    socket.on('cursor:position-updated', handleCursorUpdate);
    socket.on('code:language-changed', handleLanguageChange);
    socket.on('code:sync-request', handleSyncRequest);
    socket.on('code:sync-response', handleCodeSync);
    socket.on('room:code-sync', handleRoomCodeSync);
    socket.on('room:user-joined', handleUserJoin);
    socket.on('room:user-left', handleUserLeave);
    
    // Cleanup
    return () => {
      socket.off('code:updated', handleCodeChange);
      socket.off('cursor:position-updated', handleCursorUpdate);
      socket.off('code:language-changed', handleLanguageChange);
      socket.off('code:sync-request', handleSyncRequest);
      socket.off('code:sync-response', handleCodeSync);
      socket.off('room:code-sync', handleRoomCodeSync);
      socket.off('room:user-joined', handleUserJoin);
      socket.off('room:user-left', handleUserLeave);
    };
  }, [socket, user?.id, user?.name, code, language, version, currentRoom?.id, getUserColor]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);
  
  // Request initial sync when joining room - ENHANCED VERSION
  useEffect(() => {
    console.log(`🔍🔍🔍 useCollaborativeEditor: ===== ROOM JOIN useEffect TRIGGERED =====`);
    console.log(`🔍🔍🔍 useCollaborativeEditor: Time: ${new Date().toISOString()}`);
    console.log(`🔍🔍🔍 useCollaborativeEditor: isConnected=${isConnected}, user=${user?.name} (ID: ${user?.id}), roomId="${roomId}"`);
    console.log(`🔍🔍🔍 useCollaborativeEditor: socket exists=${!!socket}, joinRoom function exists=${!!joinRoom}`);
    
    // Add unique user identification check
    if (user) {
      console.log(`👤👤👤 useCollaborativeEditor: USER IDENTITY CHECK - Name: "${user.name}", ID: "${user.id}", Email: "${user.email}"`);
    }
    
    // Force a delay to avoid any timing issues
    setTimeout(() => {
      console.log(`🔍🔍🔍 useCollaborativeEditor: DELAYED CHECK - conditions check starting...`);
      
      if (isConnected && user && roomId && socket && joinRoom) {
        console.log(`🔌🔌🔌 useCollaborativeEditor: ALL CONDITIONS MET - About to join Socket.IO room "${roomId}"`);
        console.log(`🔌🔌🔌 useCollaborativeEditor: User joining: ${user.name} (${user.id})`);
        
        // CRITICAL: Verify the user is actually authorized to be in this room
        // In production, this should be verified on the backend, but we'll emit with user data
        joinRoom(roomId);
        console.log(`✅✅✅ useCollaborativeEditor: joinRoom method SUCCESSFULLY CALLED for room "${roomId}" by user "${user.name}" (${user.id})`);
        
        // Enhanced test events with user identification
        console.log(`🧪🧪🧪 useCollaborativeEditor: About to emit test:simple event...`);
        socket.emit('test:simple', { 
          message: `Hello from ${user.name} (${user.id})`, 
          roomId: roomId, 
          userId: user.id,
          userName: user.name,
          timestamp: Date.now() 
        });
        console.log(`🧪🧪🧪 useCollaborativeEditor: test:simple event EMITTED for room "${roomId}"`);
        
        // Enhanced delayed check
        setTimeout(() => {
          console.log(`⏰⏰⏰ useCollaborativeEditor: 2 second check for user ${user.name} (${user.id})`);
          socket.emit('test:delayed', { 
            message: `Delayed test from ${user.name}`, 
            roomId: roomId, 
            userId: user.id,
            userName: user.name,
            timestamp: Date.now() 
          });
          console.log(`⏰⏰⏰ useCollaborativeEditor: test:delayed event EMITTED`);
        }, 2000);
        
      } else {
        console.log(`❌❌❌ useCollaborativeEditor: CANNOT JOIN ROOM - MISSING REQUIREMENTS:`);
        console.log(`❌❌❌ - isConnected: ${isConnected}`);
        console.log(`❌❌❌ - user: ${user?.name} (${user?.id})`);
        console.log(`❌❌❌ - roomId: "${roomId}"`);
        console.log(`❌❌❌ - socket: ${!!socket}`);
        console.log(`❌❌❌ - joinRoom: ${!!joinRoom}`);
      }
    }, 100); // 100ms delay to avoid timing issues
    
  }, [isConnected, user?.id, user?.name, roomId, socket, joinRoom]); // Enhanced dependencies
  
  return {
    // State
    code,
    language,
    cursors,
    isConnected,
    isSyncing,
    lastSyncTime,
    version,
    
    // Actions
    handleCodeChange,
    handleLanguageChange,
    updateCursorPosition,
    
    // Utilities
    getUserColor
  };
}
