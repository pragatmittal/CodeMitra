import Redis from 'ioredis';
export declare const redisClient: Redis;
export declare const bullMQRedisConfig: {
    host: string;
    port: number;
    maxRetriesPerRequest: null;
    enableReadyCheck: boolean;
    lazyConnect: boolean;
};
export default redisClient;
//# sourceMappingURL=redis.d.ts.map