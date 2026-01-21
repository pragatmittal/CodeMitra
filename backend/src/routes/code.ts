import express, { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validate, codeExecutionSchema } from '../utils/validation';
import { Queue, QueueEvents } from 'bullmq';
import { redisClient, bullMQRedisConfig } from '../utils/redis';
import { v4 as uuidv4 } from 'uuid';

const codeRoutes = express.Router();

// Create BullMQ queue for code execution with error handling
let codeExecutionQueue: Queue | null = null;
let queueEvents: QueueEvents | null = null;

// Initialize queue with connection retry
async function initializeQueue() {
  if (!process.env.REDIS_URL) {
    console.log('⚠️  REDIS_URL not set. Code execution queue will not be initialized.');
    return;
  }

  try {
    // First, verify Redis connection
    try {
      await redisClient.ping();
      console.log('✅ Redis connection verified before queue initialization');
    } catch (redisError: any) {
      console.error('⚠️  Redis connection check failed:', redisError.message);
      // Try to connect
      if (redisClient.status !== 'ready') {
        await redisClient.connect();
        console.log('✅ Redis connected successfully');
      }
    }

    // Create queue with connection options that ensure connection
    codeExecutionQueue = new Queue('code-execution', {
      connection: {
        ...bullMQRedisConfig,
        lazyConnect: false, // Connect immediately
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          console.log(`[QUEUE] Retrying Redis connection (attempt ${times})...`);
          return delay;
        },
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // Create QueueEvents for listening to job completion
    queueEvents = new QueueEvents('code-execution', {
      connection: {
        ...bullMQRedisConfig,
        lazyConnect: false,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: null,
      },
    });
    
    console.log('✅ BullMQ queue initialized successfully');
  } catch (error: any) {
    console.error('⚠️  Failed to initialize BullMQ queue:', error.message);
    console.log('⚠️  Code execution will be disabled until Redis is configured');
    codeExecutionQueue = null;
    queueEvents = null;
  }
}

// Initialize queue on module load
initializeQueue().catch(err => {
  console.error('Failed to initialize queue:', err);
});

// Helper function to ensure queue is ready
async function ensureQueueReady(): Promise<boolean> {
  if (!codeExecutionQueue) {
    console.log('[QUEUE] Queue not initialized, attempting to initialize...');
    await initializeQueue();
    if (!codeExecutionQueue) {
      return false;
    }
  }

  // Check if Redis is connected
  try {
    await redisClient.ping();
  } catch (error: any) {
    console.error('[QUEUE] Redis not connected, attempting to connect...');
    try {
      if (redisClient.status !== 'ready') {
        await redisClient.connect();
      }
    } catch (connectError: any) {
      console.error('[QUEUE] Failed to connect Redis:', connectError.message);
      return false;
    }
  }

  return true;
}

interface CodeExecutionRequest {
  code: string;
  language: string;
  input?: string;
  roomId: string;
  userId: string;
}

interface CodeExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
  memoryUsed?: number;
  compilationTime?: number;
  status: 'success' | 'compilation_error' | 'runtime_error' | 'timeout' | 'memory_limit' | 'system_error';
}

// Supported languages and their configurations (matching worker configurations)
const LANGUAGE_CONFIGS = {
  javascript: {
    extension: 'js',
    dockerImage: 'node:18-alpine',
    runCommand: 'node main.js',
    timeout: 30000,
    memoryLimit: '256m',
    needsCompilation: false
  },
  python: {
    extension: 'py',
    dockerImage: 'python:3.11-alpine',
    runCommand: 'python main.py',
    timeout: 30000,
    memoryLimit: '256m',
    needsCompilation: false
  },
  java: {
    extension: 'java',
    dockerImage: 'eclipse-temurin:17-jdk',
    compileCommand: 'javac Main.java',
    runCommand: 'java Main',
    timeout: 30000,
    memoryLimit: '512m',
    needsCompilation: true
  },
  cpp: {
    extension: 'cpp',
    dockerImage: 'gcc:11-alpine',
    compileCommand: 'g++ -std=c++17 -O2 -Wall -Wextra -o main main.cpp',
    runCommand: './main',
    timeout: 45000,
    memoryLimit: '256m',
    needsCompilation: true
  }
};

/**
 * Execute code using BullMQ queue and Docker containers
 */
async function executeCodeWithQueue(code: string, language: string, input: string, config: any): Promise<CodeExecutionResult> {
  // Ensure queue is ready before proceeding
  const queueReady = await ensureQueueReady();
  if (!queueReady || !codeExecutionQueue) {
    console.error('[EXECUTE:QUEUE] Queue is not available. Redis may not be configured.');
    return {
      success: false,
      output: '',
      error: 'Code execution service is not available. Please ensure Redis is configured and running.',
      executionTime: 0,
      memoryUsed: 0,
      compilationTime: 0,
      status: 'system_error'
    };
  }

  const executionId = uuidv4();
  console.log(`[EXECUTE:QUEUE] Starting execution ${executionId} for language ${language}`);
  
  try {

    // Add job to queue with error handling and retry
    let job;
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        job = await codeExecutionQueue.add('execute', {
          executionId,
          language,
          code,
          input,
          timeout: config.timeout,
          memoryLimit: config.memoryLimit,
          timestamp: Date.now()
        }, {
          removeOnComplete: false, // Keep completed jobs so we can get results
          removeOnFail: false,     // Keep failed jobs so we can get error details
          attempts: 1,
          delay: 0
        });
        console.log(`[EXECUTE:QUEUE] Job ${job.id} added to queue successfully`);
        break; // Success, exit retry loop
      } catch (queueError: any) {
        retries++;
        const errorMsg = queueError.message || 'Unknown error';
        console.error(`[EXECUTE:QUEUE] Failed to add job to queue (attempt ${retries}/${maxRetries}):`, errorMsg);
        
        // If connection is closed, try to reconnect and recreate queue
        if (errorMsg.includes('Connection is closed') || errorMsg.includes('closed') || errorMsg.includes('ECONNREFUSED')) {
          if (retries < maxRetries) {
            console.log(`[EXECUTE:QUEUE] Connection closed, attempting to reconnect and recreate queue...`);
            try {
              // Wait a bit before retry
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Try to reconnect Redis
              if (redisClient.status !== 'ready') {
                await redisClient.connect();
              }
              
              // Recreate queue with fresh connection
              console.log(`[EXECUTE:QUEUE] Recreating queue with fresh connection...`);
              await initializeQueue();
              
              if (!codeExecutionQueue) {
                throw new Error('Failed to recreate queue');
              }
              
              console.log(`[EXECUTE:QUEUE] Queue recreated, retrying job add...`);
              continue; // Retry
            } catch (reconnectError: any) {
              console.error(`[EXECUTE:QUEUE] Reconnection/recreation failed:`, reconnectError.message);
              if (retries >= maxRetries) {
                return {
                  success: false,
                  output: '',
                  error: 'Failed to connect to Redis after multiple attempts. Please ensure Redis is configured and running.',
                  executionTime: 0,
                  memoryUsed: 0,
                  compilationTime: 0,
                  status: 'system_error'
                };
              }
            }
          } else {
            // Max retries reached
            return {
              success: false,
              output: '',
              error: 'Failed to queue code execution after multiple attempts. Redis connection may be unavailable.',
              executionTime: 0,
              memoryUsed: 0,
              compilationTime: 0,
              status: 'system_error'
            };
          }
        } else {
          // Other error, don't retry
          return {
            success: false,
            output: '',
            error: `Failed to queue code execution: ${errorMsg}`,
            executionTime: 0,
            memoryUsed: 0,
            compilationTime: 0,
            status: 'system_error'
          };
        }
      }
    }
    
    if (!job) {
      return {
        success: false,
        output: '',
        error: 'Failed to create execution job after retries',
        executionTime: 0,
        memoryUsed: 0,
        compilationTime: 0,
        status: 'system_error'
      };
    }

    // Wait for job completion using polling approach
    try {
      console.log(`[EXECUTE:QUEUE] Waiting for job ${job.id} to complete...`);
      
      // Simple polling approach with proper result retrieval
      {
        let attempts = 0;
        const maxAttempts = 60; // 30 seconds with 500ms intervals
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
          
          let jobState;
          try {
            jobState = await job.getState();
            console.log(`[EXECUTE:QUEUE] Job ${job.id} state: ${jobState}`);
          } catch (stateError: any) {
            console.error(`[EXECUTE:QUEUE] Failed to get job state:`, stateError);
            return {
              success: false,
              output: '',
              error: `Failed to check job status: ${stateError.message || 'Redis connection error'}`,
              executionTime: 0,
              memoryUsed: 0,
              compilationTime: 0,
              status: 'system_error'
            };
          }
          
          if (jobState === 'completed') {
            // Get result from Redis using executionId
            const resultKey = `execution-result:${executionId}`;
            let resultStr: string | null = null;
            try {
              resultStr = await redisClient.get(resultKey);
              if (resultStr) {
                console.log(`[EXECUTE:QUEUE] Got result from Redis for key: ${resultKey}`);
              }
            } catch (redisError: any) {
              console.warn(`[EXECUTE:QUEUE] Failed to get result from Redis: ${redisError.message}`);
              // Continue with fallback to job.returnvalue
            }
            let result = null;
            
            if (resultStr) {
              try {
                result = JSON.parse(resultStr);
                console.log(`Job ${job.id} completed successfully with result from Redis:`, JSON.stringify(result, null, 2));
              } catch (parseError) {
                console.error(`Failed to parse result from Redis:`, parseError);
              }
            } else {
              console.log(`No result found in Redis for key: ${resultKey}, falling back to job.returnvalue`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              result = job.returnvalue;
              console.log(`Job ${job.id} completed with fallback result:`, JSON.stringify(result, null, 2));
            }
            
            return {
              success: result?.status === 'completed',
              output: result?.output || result?.stdout || '',
              error: result?.error || result?.stderr || '',
              executionTime: result?.executionTime || 0,
              memoryUsed: result?.memoryUsage || result?.memoryUsed || 0,
              compilationTime: result?.compilationTime || 0,
              status: result?.status || 'failed'
            };
          }
        
          if (jobState === 'failed') {
            const failedReason = job.failedReason;
            console.error(`Job ${job.id} failed:`, failedReason);
            
            return {
              success: false,
              output: '',
              error: failedReason || 'Code execution failed',
              executionTime: 0,
              memoryUsed: 0,
              compilationTime: 0,
              status: 'runtime_error' as any
            };
          }
          
          attempts++;
        }
        
        // Timeout reached
        console.error(`Job ${job.id} timed out after ${maxAttempts * 500}ms`);
        return {
          success: false,
          output: '',
          error: 'Code execution timed out',
          executionTime: 0,
          memoryUsed: 0,
          compilationTime: 0,
          status: 'timeout' as any
        };
      }
      
    } catch (waitError: any) {
      console.error(`Job ${job.id} wait failed:`, waitError);
      
      return {
        success: false,
        output: '',
        error: waitError.message || 'Code execution failed',
        executionTime: 0,
        memoryUsed: 0,
        compilationTime: 0,
        status: 'system_error' as any
      };
    }
  } catch (error: any) {
    console.error('Code execution failed:', error);
    return {
      success: false,
      error: error.message || 'Execution failed',
      status: 'system_error'
    };
  }
}

/**
 * Execute code endpoint
 */
codeRoutes.post('/execute', 
  authenticate, 
  validate(codeExecutionSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { code, language, input = '', roomId } = req.body;
      const userId = req.user!.id;

      console.log(`[CODE:EXECUTE] Request received: language=${language}, roomId=${roomId}, userId=${userId}`);
      console.log(`[CODE:EXECUTE] Queue available: ${!!codeExecutionQueue}`);

      // Validate required fields
      if (!code || !language || !roomId) {
        console.error(`[CODE:EXECUTE] Missing required fields: code=${!!code}, language=${!!language}, roomId=${!!roomId}`);
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: code, language, roomId'
        });
      }

      // Validate language support
      if (!LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS]) {
        console.error(`[CODE:EXECUTE] Unsupported language: ${language}`);
        return res.status(400).json({
          success: false,
          error: `Unsupported language: ${language}. Supported languages: ${Object.keys(LANGUAGE_CONFIGS).join(', ')}`
        });
      }

      // Check if user is in the room
      let room;
      try {
        room = await prisma.room.findFirst({
          where: {
            id: roomId,
            participants: {
              some: {
                userId: userId
              }
            }
          }
        });
      } catch (dbError: any) {
        console.error(`[CODE:EXECUTE] Database error checking room:`, dbError);
        return res.status(500).json({
          success: false,
          error: 'Database error while checking room access',
          details: dbError.message
        });
      }

      if (!room) {
        console.error(`[CODE:EXECUTE] User ${userId} not authorized for room ${roomId}`);
        return res.status(403).json({
          success: false,
          error: 'You are not authorized to execute code in this room'
        });
      }

      // Check if queue is available
      if (!codeExecutionQueue) {
        console.error(`[CODE:EXECUTE] Queue not available - Redis may not be configured`);
        return res.status(503).json({
          success: false,
          error: 'Code execution service is temporarily unavailable. Please ensure Redis is configured and the worker service is running.',
          details: 'BullMQ queue is not initialized. This usually means Redis is not configured or the connection failed.'
        });
      }

      const config = LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS];
      console.log(`[CODE:EXECUTE] Executing code with config:`, { timeout: config.timeout, memoryLimit: config.memoryLimit });
      
      const result = await executeCodeWithQueue(code, language, input, config);
      
      console.log(`[CODE:EXECUTE] Execution result:`, { 
        success: result.success, 
        status: result.status,
        hasOutput: !!result.output,
        hasError: !!result.error
      });

      // Save execution result to database (with error handling)
      try {
        await prisma.codeExecution.create({
          data: {
            id: uuidv4(),
            userId,
            roomId,
            language,
            code,
            output: result.output || null,
            error: result.error || null,
            executionTime: result.executionTime || null,
            status: result.status
          }
        });
        console.log(`[CODE:EXECUTE] Execution saved to database`);
      } catch (dbError: any) {
        // Log database error but don't fail the request
        console.error('[CODE:EXECUTE] Failed to save execution to database:', dbError);
        // Continue to return the execution result even if DB save fails
      }

      return res.json({
        success: result.success,
        output: result.output,
        error: result.error,
        executionTime: result.executionTime,
        memoryUsed: result.memoryUsed,
        compilationTime: result.compilationTime,
        status: result.status
      });

    } catch (error: any) {
      console.error('[CODE:EXECUTE] Unexpected error:', error);
      console.error('[CODE:EXECUTE] Error stack:', error.stack);
      return res.status(500).json({
        success: false,
        error: 'Code execution failed',
        details: error.message || 'Unknown error occurred',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    }
  })
);

/**
 * Get execution history for a room
 */
codeRoutes.get('/history/:roomId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;
    const userId = req.user!.id;

    // Check if user is in the room
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        participants: {
          some: {
            userId: userId
          }
        }
      }
    });

    if (!room) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view execution history in this room'
      });
    }

    const executions = await prisma.codeExecution.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    });

    return res.json({
      success: true,
      executions
    });
  })
);

/**
 * Get supported languages
 */
codeRoutes.get('/languages', async (req: Request, res: Response) => {
  const languages = Object.keys(LANGUAGE_CONFIGS).map(lang => ({
    id: lang,
    name: lang.charAt(0).toUpperCase() + lang.slice(1),
    extension: LANGUAGE_CONFIGS[lang as keyof typeof LANGUAGE_CONFIGS].extension,
    needsCompilation: LANGUAGE_CONFIGS[lang as keyof typeof LANGUAGE_CONFIGS].needsCompilation
  }));

  return res.json({
    success: true,
    languages
  });
});

export { codeRoutes };
