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

try {
  codeExecutionQueue = new Queue('code-execution', {
    connection: bullMQRedisConfig,
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
    connection: bullMQRedisConfig,
  });
  
  console.log('✅ BullMQ queue initialized successfully');
} catch (error: any) {
  console.error('⚠️  Failed to initialize BullMQ queue:', error.message);
  console.log('⚠️  Code execution will be disabled until Redis is configured');
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
  // Check if queue is available
  if (!codeExecutionQueue) {
    console.error('Code execution queue is not available. Redis may not be configured.');
    return {
      success: false,
      output: '',
      error: 'Code execution service is not available. Please ensure Redis is configured and the worker is running.',
      executionTime: 0,
      memoryUsed: 0,
      compilationTime: 0,
      status: 'system_error'
    };
  }

  const executionId = uuidv4();
  
  try {
    // Add job to queue
    const job = await codeExecutionQueue.add('execute', {
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

    console.log(`Code execution job ${job.id} added to queue`);

    // Wait for job completion using polling approach
    try {
      console.log(`Waiting for job ${job.id} to complete...`);
      
      // Simple polling approach with proper result retrieval
      {
        let attempts = 0;
        const maxAttempts = 60; // 30 seconds with 500ms intervals
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
          
          const jobState = await job.getState();
          console.log(`Job ${job.id} state: ${jobState}`);
          
          if (jobState === 'completed') {
            // Get result from Redis using executionId
            const resultKey = `execution-result:${executionId}`;
            let resultStr: string | null = null;
            try {
              resultStr = await redisClient.get(resultKey);
            } catch (redisError: any) {
              console.warn(`Failed to get result from Redis: ${redisError.message}`);
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
    const { code, language, input = '', roomId } = req.body;
    const userId = req.user!.id;

    console.log(`Code execution request: ${language} in room ${roomId} by user ${userId}`);

    // Validate language support
    if (!LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS]) {
      return res.status(400).json({
        success: false,
        error: `Unsupported language: ${language}. Supported languages: ${Object.keys(LANGUAGE_CONFIGS).join(', ')}`
      });
    }

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
        error: 'You are not authorized to execute code in this room'
      });
    }

    try {
      const config = LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS];
      const result = await executeCodeWithQueue(code, language, input, config);

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
      } catch (dbError: any) {
        // Log database error but don't fail the request
        console.error('Failed to save execution to database:', dbError);
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
      console.error('Code execution error:', error);
      return res.status(500).json({
        success: false,
        error: 'Code execution failed',
        details: error.message || 'Unknown error occurred'
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
