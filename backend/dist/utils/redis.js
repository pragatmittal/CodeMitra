"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bullMQRedisConfig = exports.redisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const REDIS_URL = process.env.REDIS_URL || 'redis://codemitra-redis:6379';
console.log('Redis URL:', REDIS_URL.replace(/:\/\/([^:@]+:[^:@]+)@/, '://***:***@'));
exports.redisClient = new ioredis_1.default(REDIS_URL, {
    enableReadyCheck: false,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 10000,
    commandTimeout: 30000,
});
exports.redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});
exports.redisClient.on('connect', () => {
    console.log('Redis Client Connected');
});
exports.redisClient.on('ready', () => {
    console.log('Redis Client Ready');
});
exports.redisClient.on('end', () => {
    console.log('Redis Client Disconnected');
});
exports.bullMQRedisConfig = {
    host: process.env.REDIS_HOST || 'codemitra-redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
};
exports.default = exports.redisClient;
//# sourceMappingURL=redis.js.map