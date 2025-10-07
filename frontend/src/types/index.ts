export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

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