export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

<<<<<<< HEAD
export interface Room {
  id: string;
  name: string;
  description?: string;
  password: string;
  isPublic: boolean;
  maxUsers: number;
  language: string;
  code: string;
  input: string;
  output: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  owner: User;
  users: RoomUser[];
  executionLogs: ExecutionLog[];
}

export interface RoomUser {
  id: string;
  userId: string;
  roomId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  user: User;
  room: Room;
}


export interface ExecutionLog {
  id: string;
  language: string;
  code: string;
  input?: string;
  output?: string;
  error?: string;
  executionTime?: number;
  memoryUsed?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  userId?: string;
  roomId: string;
  room: Room;
}

=======
>>>>>>> 300446fa250e6096c7b559e094fa5460547acb15
export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

<<<<<<< HEAD
export interface RoomState {
  currentRoom: Room | null;
  rooms: Room[];
  isLoading: boolean;
  error: string | null;
}

export interface CodeEditorState {
  code: string;
  language: string;
  input: string;
  output: string;
  isExecuting: boolean;
  error: string | null;
}


export interface SocketEvents {
  // Room events
  'room:join': (data: { roomId: string; userId: string }) => void;
  'room:leave': (data: { roomId: string; userId: string }) => void;
  'room:user-joined': (data: { user: User; roomId: string }) => void;
  'room:user-left': (data: { userId: string; roomId: string }) => void;
  'room:code-update': (data: { code: string; roomId: string; userId: string }) => void;
  'room:language-change': (data: { language: string; roomId: string; userId: string }) => void;
  'room:input-update': (data: { input: string; roomId: string; userId: string }) => void;
  
  // Code execution events
  'code:execute': (data: { code: string; language: string; input: string; roomId: string }) => void;
  'code:execution-result': (data: { output: string; error?: string; executionTime: number; roomId: string }) => void;
  'code:execution-started': (data: { roomId: string }) => void;
}

=======
>>>>>>> 300446fa250e6096c7b559e094fa5460547acb15
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// Room-related types
export interface Room {
  id: string;
  name: string;
  description?: string;
  language: string;
  visibility: boolean;
  maxCapacity: number;
  creator: User;
  participants: RoomParticipant[];
  code: string;
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
}

export interface RoomParticipant {
  id: string;
  roomId: string;
  userId: string;
  user: User;
  cursorLine: number;
  cursorColumn: number;
  status: 'active' | 'disconnected' | 'grace_period';
  joinedAt: string;
  lastActivity: string;
}

export interface CreateRoomRequest {
  name: string;
  description?: string;
  language?: string;
  visibility?: boolean;
  password?: string;
  maxCapacity?: number;
}

export interface JoinRoomRequest {
  password?: string;
}

// Code execution types
export interface CodeExecution {
  id: string;
  roomId: string;
  userId: string;
  user: User;
  code: string;
  language: string;
  output?: string;
  error?: string;
  executionTime?: number;
  status: 'success' | 'error' | 'timeout';
  createdAt: string;
}

export interface ExecutionRequest {
  code: string;
  language: string;
  roomId: string;
}

export interface ExecutionResult {
  output: string;
  error: string;
  executionTime: number;
  status: 'success' | 'error' | 'timeout';
}

<<<<<<< HEAD
=======
// Socket events
export interface SocketEvents {
  'room:join': (data: { roomId: string }) => void;
  'room:leave': (data: { roomId: string }) => void;
  'room:joined': (data: { roomId: string; participantCount: number; participants: RoomParticipant[] }) => void;
  'room:state': (data: { roomId: string; code: string; language: string; participants: RoomParticipant[]; participantCount?: number }) => void;
  'user:count:update': (data: { roomId: string; count: number; participants: RoomParticipant[]; event: 'user_joined' | 'user_left' | 'user_disconnected' | 'heartbeat_reconciliation'; user: User }) => void;
  'user:joined': (data: { user: User; count: number }) => void; // Legacy
  'user:left': (data: { user: User; count: number }) => void; // Legacy
  'code:update': (data: { roomId: string; code: string; language: string }) => void;
  'code:updated': (data: { code: string; language: string; user: User }) => void;
  'cursor:update': (data: { roomId: string; line: number; column: number }) => void;
  'cursor:updated': (data: { user: User; line: number; column: number }) => void;
  'code:execution': (data: { roomId: string; result: ExecutionResult }) => void;
  'code:execution:result': (data: { result: ExecutionResult; user: User }) => void;
  'error': (error: { message: string }) => void;
}
>>>>>>> 300446fa250e6096c7b559e094fa5460547acb15
