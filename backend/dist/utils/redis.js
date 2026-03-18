"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bullMQRedisConfig = exports.redisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
    console.warn('⚠️  REDIS_URL not set. Redis features will be disabled.');
}
let redisConfig = {
    enableReadyCheck: false,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 10000,
    commandTimeout: 30000,
};
if (REDIS_URL) {
    try {
        const redisUrl = new URL(REDIS_URL);
        redisConfig.host = redisUrl.hostname;
        redisConfig.port = parseInt(redisUrl.port) || 6379;
        if (redisUrl.password) {
            redisConfig.password = redisUrl.password;
        }
        console.log('Redis URL configured:', REDIS_URL.replace(/:\/\/([^:@]+:[^:@]+)@/, '://***:***@'));
    }
    catch (error) {
        console.error('Invalid REDIS_URL format:', error);
    }
}
else {
    redisConfig.host = 'localhost';
    redisConfig.port = 6379;
}
const isUpstash = REDIS_URL?.includes('.upstash.io') || false;
const isTLS = REDIS_URL?.startsWith('rediss://') || isUpstash;
let finalRedisUrl = REDIS_URL;
if (REDIS_URL && isUpstash && REDIS_URL.startsWith('redis://')) {
    finalRedisUrl = REDIS_URL.replace('redis://', 'rediss://');
    console.log('✅ Converted redis:// to rediss:// for Upstash TLS connection');
}
const redisClientOptions = {
    enableReadyCheck: false,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 10000,
    commandTimeout: 30000,
};
if (REDIS_URL && isTLS) {
    redisClientOptions.tls = {};
    console.log('✅ TLS enabled for Redis client (Upstash/TLS detected)');
}
exports.redisClient = finalRedisUrl ? new ioredis_1.default(finalRedisUrl, redisClientOptions) : new ioredis_1.default({
    ...redisConfig,
    lazyConnect: true,
    enableOfflineQueue: false,
});
exports.redisClient.on('error', (err) => {
    if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED') || err.message.includes('Connection is closed')) {
        return;
    }
    console.error('Redis Client Error:', err.message);
    console.log('⚠️  Continuing without Redis. Some features may be limited.');
});
exports.redisClient.on('connect', () => {
    console.log('✅ Redis Client Connected');
});
exports.redisClient.on('ready', () => {
    console.log('✅ Redis Client Ready');
});
exports.redisClient.on('end', () => {
    console.log('Redis Client Disconnected');
});
exports.bullMQRedisConfig = REDIS_URL ? (() => {
    try {
        const redisUrl = new URL(REDIS_URL);
        const isUpstash = redisUrl.hostname.includes('.upstash.io');
        const isTLS = REDIS_URL.startsWith('rediss://') || isUpstash;
        const config = {
            host: redisUrl.hostname,
            port: parseInt(redisUrl.port) || 6379,
            password: redisUrl.password || undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            lazyConnect: true,
        };
        if (isTLS) {
            config.tls = {};
            console.log('✅ TLS enabled for Redis connection (Upstash/TLS detected)');
        }
        return config;
    }
    catch (error) {
        console.error('Failed to parse REDIS_URL for BullMQ:', error);
        return {
            host: 'localhost',
            port: 6379,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            lazyConnect: true,
        };
    }
})() : {
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
};
exports.default = exports.redisClient;
//# sourceMappingURL=redis.js.map