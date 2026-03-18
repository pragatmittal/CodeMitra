import { Server } from 'socket.io';
declare global {
    var io: Server;
}
export declare const setupSocketIO: (server: any) => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
//# sourceMappingURL=index.d.ts.map