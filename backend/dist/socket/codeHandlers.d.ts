import { AuthenticatedSocket, Server } from './types';
import { Queue } from 'bullmq';
declare const codeExecutionQueue: Queue<any, any, string, any, any, string>;
export declare const setupCodeHandlers: (io: Server, socket: AuthenticatedSocket, isUserInRoom: (userId: string, roomId: string) => Promise<boolean>) => void;
export { codeExecutionQueue };
//# sourceMappingURL=codeHandlers.d.ts.map