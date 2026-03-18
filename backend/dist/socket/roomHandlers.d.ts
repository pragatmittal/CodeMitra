import { AuthenticatedSocket, Server } from './types';
export declare const setupRoomHandlers: (io: Server, socket: AuthenticatedSocket, isUserInRoom: (userId: string, roomId: string) => Promise<boolean>, roomUsers: Map<string, Set<string>>) => void;
//# sourceMappingURL=roomHandlers.d.ts.map