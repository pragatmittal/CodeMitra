import { Server as SocketIOServer } from 'socket.io';
import { Socket } from 'socket.io';
export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
}
export interface AuthenticatedSocket extends Socket {
    userId?: string;
    user?: User;
}
export type Server = SocketIOServer;
//# sourceMappingURL=types.d.ts.map