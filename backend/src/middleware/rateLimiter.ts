import rateLimit from 'express-rate-limit';
import { redisClient } from '../utils/redis';
import { AuthenticatedRequest } from './auth';

// Custom Redis store implementation for express-rate-limit
class RedisStore {
  private client: typeof redisClient;
  private prefix: string;

  constructor(client: typeof redisClient, prefix: string = 'rate-limit:') {
    this.client = client;
    this.prefix = prefix;
  }

  async incr(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes default
    const resetTime = new Date(now + windowMs);
    
    const multi = this.client.multi();
    multi.incr(this.prefix + key);
    multi.expire(this.prefix + key, Math.ceil(windowMs / 1000));
    
    const results = await multi.exec();
    const totalHits = results?.[0]?.[1] as number || 1;
    
    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    await this.client.decr(this.prefix + key);
  }

  async resetKey(key: string): Promise<void> {
    await this.client.del(this.prefix + key);
  }
}

// General API rate limiter - more permissive
export const generalApiLimiter = rateLimit({
  store: new RedisStore(redisClient),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Allow 1000 requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health' || req.path === '/health/ready',
});

// Login endpoint rate limiter - more permissive for better UX
export const loginLimiter = rateLimit({
  store: new RedisStore(redisClient),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Allow 100 login attempts per 15 minutes
  message: {
    error: 'Too many login attempts from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Registration endpoint rate limiter
export const registrationLimiter = rateLimit({
  store: new RedisStore(redisClient),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Allow 10 registration attempts per hour
  message: {
    error: 'Too many registration attempts from this IP, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Code execution rate limiter - per user
export const codeExecutionLimiter = rateLimit({
  store: new RedisStore(redisClient),
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Allow 30 code executions per minute per user
  message: {
    error: 'Too many code executions, please wait before trying again.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID for rate limiting if authenticated
  keyGenerator: (req: AuthenticatedRequest) => {
    return req.user?.id || req.ip || 'anonymous';
  },
  skip: (req: AuthenticatedRequest) => !req.user, // Skip for unauthenticated users
});

// WebSocket connection rate limiter
export const websocketLimiter = rateLimit({
  store: new RedisStore(redisClient),
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Allow 10 WebSocket connections per minute per IP
  message: {
    error: 'Too many WebSocket connections, please wait before trying again.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Room creation rate limiter
export const roomCreationLimiter = rateLimit({
  store: new RedisStore(redisClient),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Allow 20 room creations per 15 minutes per user
  message: {
    error: 'Too many room creations, please wait before trying again.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => {
    return req.user?.id || req.ip || 'anonymous';
  },
  skip: (req: AuthenticatedRequest) => !req.user,
});

// Chat message rate limiter
export const chatMessageLimiter = rateLimit({
  store: new RedisStore(redisClient),
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Allow 100 chat messages per minute per user
  message: {
    error: 'Too many chat messages, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthenticatedRequest) => {
    return req.user?.id || req.ip || 'anonymous';
  },
  skip: (req: AuthenticatedRequest) => !req.user,
});

// Health check endpoint - no rate limiting
export const healthCheckLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Very high limit for health checks
  message: 'Health check rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
});

// Export all limiters for use in routes
export default {
  generalApiLimiter,
  loginLimiter,
  registrationLimiter,
  codeExecutionLimiter,
  websocketLimiter,
  roomCreationLimiter,
  chatMessageLimiter,
  healthCheckLimiter,
};
