import Redis from 'ioredis';

// Get Redis URL from environment variable (required for production)
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.warn('⚠️  REDIS_URL not set. Redis features will be disabled.');
}

// Parse Redis URL for connection options
let redisConfig: any = {
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
  } catch (error) {
    console.error('Invalid REDIS_URL format:', error);
  }
} else {
  // Fallback for local development only
  redisConfig.host = 'localhost';
  redisConfig.port = 6379;
}

// Create Redis client (will only connect if REDIS_URL is set)
export const redisClient = REDIS_URL ? new Redis(REDIS_URL, {
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableOfflineQueue: false,
  connectTimeout: 10000,
  commandTimeout: 30000,
}) : new Redis({
  ...redisConfig,
  lazyConnect: true,
  enableOfflineQueue: false,
});

redisClient.on('error', (err) => {
  // Only log connection errors once, not repeatedly
  if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED') || err.message.includes('Connection is closed')) {
    // Suppress repeated connection errors - they're expected if Redis is not available
    return;
  }
  console.error('Redis Client Error:', err.message);
  console.log('⚠️  Continuing without Redis. Some features may be limited.');
});

redisClient.on('connect', () => {
  console.log('✅ Redis Client Connected');
});

redisClient.on('ready', () => {
  console.log('✅ Redis Client Ready');
});

redisClient.on('end', () => {
  console.log('Redis Client Disconnected');
});

// BullMQ connection configuration - parse from REDIS_URL
export const bullMQRedisConfig = REDIS_URL ? (() => {
  try {
    const redisUrl = new URL(REDIS_URL);
    return {
      host: redisUrl.hostname,
      port: parseInt(redisUrl.port) || 6379,
      password: redisUrl.password || undefined,
      maxRetriesPerRequest: null, // BullMQ requires null
      enableReadyCheck: false,
      lazyConnect: true,
    };
  } catch (error) {
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

export default redisClient;
