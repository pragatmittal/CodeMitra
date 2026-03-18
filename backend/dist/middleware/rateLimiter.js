"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheckLimiter = exports.chatMessageLimiter = exports.roomCreationLimiter = exports.websocketLimiter = exports.codeExecutionLimiter = exports.registrationLimiter = exports.loginLimiter = exports.generalApiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const redis_1 = require("../utils/redis");
class RedisStore {
    constructor(client, prefix = 'rate-limit:') {
        this.client = client;
        this.prefix = prefix;
    }
    async incr(key) {
        const now = Date.now();
        const windowMs = 15 * 60 * 1000;
        const resetTime = new Date(now + windowMs);
        const multi = this.client.multi();
        multi.incr(this.prefix + key);
        multi.expire(this.prefix + key, Math.ceil(windowMs / 1000));
        const results = await multi.exec();
        const totalHits = results?.[0]?.[1] || 1;
        return { totalHits, resetTime };
    }
    async decrement(key) {
        await this.client.decr(this.prefix + key);
    }
    async resetKey(key) {
        await this.client.del(this.prefix + key);
    }
}
exports.generalApiLimiter = (0, express_rate_limit_1.default)({
    store: new RedisStore(redis_1.redisClient),
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || req.path === '/health/ready',
});
exports.loginLimiter = (0, express_rate_limit_1.default)({
    store: new RedisStore(redis_1.redisClient),
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many login attempts from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});
exports.registrationLimiter = (0, express_rate_limit_1.default)({
    store: new RedisStore(redis_1.redisClient),
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: {
        error: 'Too many registration attempts from this IP, please try again later.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
exports.codeExecutionLimiter = (0, express_rate_limit_1.default)({
    store: new RedisStore(redis_1.redisClient),
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: {
        error: 'Too many code executions, please wait before trying again.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.id || req.ip || 'anonymous';
    },
    skip: (req) => !req.user,
});
exports.websocketLimiter = (0, express_rate_limit_1.default)({
    store: new RedisStore(redis_1.redisClient),
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: {
        error: 'Too many WebSocket connections, please wait before trying again.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
exports.roomCreationLimiter = (0, express_rate_limit_1.default)({
    store: new RedisStore(redis_1.redisClient),
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
        error: 'Too many room creations, please wait before trying again.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.id || req.ip || 'anonymous';
    },
    skip: (req) => !req.user,
});
exports.chatMessageLimiter = (0, express_rate_limit_1.default)({
    store: new RedisStore(redis_1.redisClient),
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many chat messages, please slow down.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.id || req.ip || 'anonymous';
    },
    skip: (req) => !req.user,
});
exports.healthCheckLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 1000,
    message: 'Health check rate limit exceeded',
    standardHeaders: true,
    legacyHeaders: false,
});
exports.default = {
    generalApiLimiter: exports.generalApiLimiter,
    loginLimiter: exports.loginLimiter,
    registrationLimiter: exports.registrationLimiter,
    codeExecutionLimiter: exports.codeExecutionLimiter,
    websocketLimiter: exports.websocketLimiter,
    roomCreationLimiter: exports.roomCreationLimiter,
    chatMessageLimiter: exports.chatMessageLimiter,
    healthCheckLimiter: exports.healthCheckLimiter,
};
//# sourceMappingURL=rateLimiter.js.map