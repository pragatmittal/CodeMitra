'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Users, Clock, Code2, LogOut, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Room {
  id: string;
  name: string;
  language: string;
  code: string;
  participants: Array<{ 
    user: { id: string; name: string }; 
    cursorLine: number; 
    cursorColumn: number; 
  }>;
}

interface ExecutionResult {
  output: string;
  error: string;
  executionTime: number;
  status: 'success' | 'error' | 'timeout' | 'compilation_error';
  compilationTime?: number;
  executionTimeOnly?: number;
}

export default function CollaborativeEditor({ roomId }: { roomId: string }) {
  const { user, token } = useAuth();
  const { socket, isConnected } = useSocket();
  const [room, setRoom] = useState<Room | null>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [participants, setParticipants] = useState<any[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ line: 0, column: 0 });
  const [isLeaving, setIsLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const editorRef = useRef<any>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle browser close/tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Send leave notification if possible
      if (socket && isConnected) {
        socket.emit('room:leave', { roomId });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [socket, isConnected, roomId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up timeouts
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (socket && isConnected) {
      // Join room
      socket.emit('room:join', { roomId });

      // Listen for room state (initial sync)
      socket.on('room:state', (data) => {
        console.log('[ROOM:STATE]', data);
        setCode(data.code);
        setLanguage(data.language);
        setParticipants(data.participants || []);
        console.log(`[ROOM:STATE] Room synchronized with ${data.participantCount || data.participants?.length || 0} participants`);
        toast.success('Room synchronized!');
      });

      // Listen for authoritative user count updates
      socket.on('user:count:update', (data) => {
        console.log('[USER:COUNT:UPDATE]', data);
        
        // Update participants list with authoritative data
        setParticipants(data.participants);
        
        // Show toast for user events (not heartbeat)
        if (data.event === 'user_joined') {
          toast.success(`${data.user.name} joined the room (${data.count} users)`);
        } else if (data.event === 'user_left') {
          toast.(`${data.user.name} left the room (${data.count} users)`);
        } else if (data.event === 'user_disconnected') {
          toast.info(`${data.user.name} disconnected (${data.count} users)`);
        }
        // No toast for heartbeat_reconciliation
      });

      // Legacy event handlers for backward compatibility
      socket.on('user:joined', (data) => {
        console.log('[LEGACY] User joined:', data);
        // This should not be used anymore, but keeping for safety
      });

      socket.on('user:left', (data) => {
        console.log('[LEGACY] User left:', data);
        // This should not be used anymore, but keeping for safety
      });

      // Listen for code updates
      socket.on('code:updated', (data) => {
        if (data.user.id !== user?.id) {
          console.log('Code updated by:', data.user.name);
          setCode(data.code);
          setLanguage(data.language);
          toast(`Code updated by ${data.user.name}`, { 
            icon: '✍️',
            duration: 2000
          });
        }
      });

      // Listen for cursor updates
      socket.on('cursor:updated', (data) => {
        if (data.user.id !== user?.id) {
          console.log('Cursor updated by:', data.user.name, 'at line', data.line);
          // You could implement cursor visualization here
        }
      });

      // Listen for code execution results
      socket.on('code:execution:result', (data) => {
        console.log('Code execution result:', data);
        setExecutionResult(data.result);
        toast.success(`Code executed by ${data.user.name}`);
      });

      // Listen for errors
      socket.on('error', (error) => {
        console.error('Socket error:', error);
        toast.error(error.message || 'An error occurred');
      });

      return () => {
        socket.emit('room:leave', { roomId });
        socket.off('room:state');
        socket.off('user:joined');
        socket.off('user:left');
        socket.off('code:updated');
        socket.off('cursor:updated');
        socket.off('code:execution:result');
        socket.off('error');
      };
    }
  }, [socket, isConnected, roomId, user?.id]);

  useEffect(() => {
    fetchRoomDetails();
  }, [roomId]);

  const fetchRoomDetails = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/rooms/${roomId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      if (data.success) {
        setRoom(data.data);
        setCode(data.data.code);
        setLanguage(data.data.language);
        setParticipants(data.data.participants.map((p: any) => p.user));
      } else {
        toast.error(data.error || 'Failed to fetch room details');
      }
    } catch (error) {
      console.error('Failed to fetch room details:', error);
      toast.error('Failed to fetch room details');
    }
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    
    // Broadcast code update
    if (socket && isConnected) {
      socket.emit('code:update', {
        roomId,
        code: newCode,
        language
      });
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    
    // Broadcast language change
    if (socket && isConnected) {
      socket.emit('code:update', {
        roomId,
        code,
        language: newLanguage
      });
    }
  };

  const handleCursorChange = (line: number, column: number) => {
    setCursorPosition({ line, column });
    
    // Broadcast cursor position (throttled to avoid too many updates)
    if (socket && isConnected) {
      socket.emit('cursor:update', {
        roomId,
        line,
        column
      });
    }
  };

  const executeCode = async () => {
    if (!code.trim()) {
      toast.error('No code to execute');
      return;
    }

    try {
      setIsExecuting(true);
      setExecutionResult(null);

      const response = await fetch('/api/code/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          code,
          language,
          roomId
        })
      });

      const data = await response.json();
      if (data.success) {
        setExecutionResult(data.data);
        
        // Broadcast execution result
        if (socket && isConnected) {
          socket.emit('code:execution', {
            roomId,
            result: data.data
          });
        }
      } else {
        toast.error(data.error || 'Code execution failed');
      }
    } catch (error) {
      console.error('Code execution error:', error);
      toast.error('Code execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleLeaveRoom = () => {
    if (isLeaving) return; // Prevent double-clicks
    
    setShowLeaveConfirm(true);
  };

  const confirmLeaveRoom = async () => {
    if (isLeaving) return;
    
    setIsLeaving(true);
    setShowLeaveConfirm(false);
    
    try {
      // Show immediate feedback
      toast.loading('Leaving room...', { id: 'leave-room' });
      
      // Set up timeout for network failure handling
      leaveTimeoutRef.current = setTimeout(() => {
        console.warn('Leave room timeout - forcing navigation');
        toast.dismiss('leave-room');
        toast.error('Network timeout - leaving room anyway');
        forceLeaveRoom();
      }, 5000);
      
      // Send leave room event
      if (socket && isConnected) {
        socket.emit('room:leave', { roomId });
        
        // Wait for acknowledgment with a shorter timeout
        const acknowledgmentTimeout = setTimeout(() => {
          console.warn('No acknowledgment received - forcing leave');
          if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
          }
          forceLeaveRoom();
        }, 3000);
        
        // Listen for acknowledgment (server should emit this)
        const handleLeaveAcknowledgment = () => {
          clearTimeout(acknowledgmentTimeout);
          if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
          }
          toast.dismiss('leave-room');
          toast.success('Left room successfully');
          navigateToDashboard();
        };
        
        socket.once('room:leave:acknowledged', handleLeaveAcknowledgment);
      } else {
        // No socket connection - force leave
        console.warn('No socket connection - forcing leave');
        if (leaveTimeoutRef.current) {
          clearTimeout(leaveTimeoutRef.current);
          leaveTimeoutRef.current = null;
        }
        forceLeaveRoom();
      }
    } catch (error) {
      console.error('Error leaving room:', error);
      toast.dismiss('leave-room');
      toast.error('Failed to leave room - trying anyway');
      forceLeaveRoom();
    }
  };

  const forceLeaveRoom = () => {
    // Clean up state
    setIsLeaving(false);
    
    // Clear any pending timeouts
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    
    // Clean up WebSocket listeners
    if (socket) {
      socket.off('room:state');
      socket.off('user:joined');
      socket.off('user:left');
      socket.off('code:updated');
      socket.off('cursor:updated');
      socket.off('code:execution:result');
      socket.off('error');
      socket.off('room:leave:acknowledged');
    }
    
    // Navigate to dashboard
    navigateToDashboard();
  };

  const navigateToDashboard = () => {
    // Use window.location for reliable navigation
    window.location.href = '/dashboard';
  };

  const cancelLeaveRoom = () => {
    setShowLeaveConfirm(false);
  };

  const getLanguageIcon = (lang: string) => {
    const icons = {
      javascript: '⚡',
      python: '🐍',
      java: '☕',
      cpp: '⚙️'
    };
    return icons[lang as keyof typeof icons] || '📝';
  };

  if (!room) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">{room.name}</h1>
            <div className="flex items-center space-x-4 mt-1">
              <Badge className="bg-blue-500 text-white">
                {getLanguageIcon(language)} {language}
              </Badge>
              <div className="flex items-center space-x-1 text-sm text-gray-500">
                <Users className="w-4 h-4" />
                <span>{participants.length} participants</span>
              </div>
              <div className="flex items-center space-x-1 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
            
            <Button 
              onClick={executeCode} 
              disabled={isExecuting || !code.trim()}
              className="flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>{isExecuting ? 'Running...' : 'Run Code'}</span>
            </Button>

            <Button 
              onClick={handleLeaveRoom} 
              disabled={isLeaving}
              variant="outline"
              className="flex items-center space-x-2 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
            >
              <LogOut className="w-4 h-4" />
              <span>{isLeaving ? 'Leaving...' : 'Leave Room'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Code Editor */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4">
            <textarea
              ref={editorRef}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onSelect={(e) => {
                const target = e.target as HTMLTextAreaElement;
                const lines = target.value.substring(0, target.selectionStart).split('\n');
                const line = lines.length - 1;
                const column = lines[lines.length - 1].length;
                handleCursorChange(line, column);
              }}
              className="w-full h-full p-4 border rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Start coding..."
              style={{ 
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                lineHeight: '1.5'
              }}
            />
          </div>
        </div>

        {/* Output Panel */}
        <div className="w-96 border-l border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold flex items-center space-x-2">
              <Code2 className="w-4 h-4" />
              <span>Output</span>
            </h3>
          </div>
          
          <div className="flex-1 p-4">
            {executionResult ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Status: 
                    <Badge className={`ml-2 ${
                      executionResult.status === 'success' 
                        ? 'bg-green-500' 
                        : executionResult.status === 'compilation_error'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    } text-white`}>
                      {executionResult.status}
                    </Badge>
                  </h4>
                  
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>Total time: {executionResult.executionTime}ms</p>
                    {executionResult.compilationTime && (
                      <p>Compilation: {executionResult.compilationTime}ms</p>
                    )}
                    {executionResult.executionTimeOnly && (
                      <p>Execution: {executionResult.executionTimeOnly}ms</p>
                    )}
                  </div>
                </div>

                {executionResult.output && (
                  <div>
                    <h5 className="font-medium text-sm mb-2">Output:</h5>
                    <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-auto">
                      {executionResult.output}
                    </pre>
                  </div>
                )}

                {executionResult.error && (
                  <div>
                    <h5 className="font-medium text-sm mb-2 text-red-600">Error:</h5>
                    <pre className="bg-red-50 dark:bg-red-900/20 p-3 rounded text-sm overflow-auto text-red-600">
                      {executionResult.error}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Code2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Click "Run Code" to see output here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leave Room Confirmation Dialog */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Leave Room
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to leave this room?
                </p>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 mb-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Your code changes are automatically synced</strong> with the room, so other participants will keep your latest changes.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button
                onClick={cancelLeaveRoom}
                variant="outline"
                disabled={isLeaving}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmLeaveRoom}
                disabled={isLeaving}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isLeaving ? 'Leaving...' : 'Leave Room'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
