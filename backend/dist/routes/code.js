"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.codeRoutes = void 0;
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../utils/validation");
const bullmq_1 = require("bullmq");
const redis_1 = require("../utils/redis");
const uuid_1 = require("uuid");
const codeExecutor_1 = require("../utils/codeExecutor");
const codeRoutes = express_1.default.Router();
exports.codeRoutes = codeRoutes;
let codeExecutionQueue = null;
let queueEvents = null;
async function initializeQueue() {
    if (!process.env.REDIS_URL) {
        console.log('⚠️  REDIS_URL not set. Code execution queue will not be initialized.');
        return;
    }
    try {
        try {
            await redis_1.redisClient.ping();
            console.log('✅ Redis connection verified before queue initialization');
        }
        catch (redisError) {
            console.error('⚠️  Redis connection check failed:', redisError.message);
            if (redis_1.redisClient.status !== 'ready') {
                await redis_1.redisClient.connect();
                console.log('✅ Redis connected successfully');
            }
        }
        codeExecutionQueue = new bullmq_1.Queue('code-execution', {
            connection: {
                ...redis_1.bullMQRedisConfig,
                lazyConnect: false,
                retryStrategy: (times) => {
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
        queueEvents = new bullmq_1.QueueEvents('code-execution', {
            connection: {
                ...redis_1.bullMQRedisConfig,
                lazyConnect: false,
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: null,
            },
        });
        console.log('✅ BullMQ queue initialized successfully');
    }
    catch (error) {
        console.error('⚠️  Failed to initialize BullMQ queue:', error.message);
        console.log('⚠️  Code execution will be disabled until Redis is configured');
        codeExecutionQueue = null;
        queueEvents = null;
    }
}
initializeQueue().catch(err => {
    console.error('Failed to initialize queue:', err);
});
async function ensureQueueReady() {
    if (!codeExecutionQueue) {
        console.log('[QUEUE] Queue not initialized, attempting to initialize...');
        await initializeQueue();
        if (!codeExecutionQueue) {
            return false;
        }
    }
    try {
        await redis_1.redisClient.ping();
    }
    catch (error) {
        console.error('[QUEUE] Redis not connected, attempting to connect...');
        try {
            if (redis_1.redisClient.status !== 'ready') {
                await redis_1.redisClient.connect();
            }
        }
        catch (connectError) {
            console.error('[QUEUE] Failed to connect Redis:', connectError.message);
            return false;
        }
    }
    return true;
}
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
async function executeCodeWithQueue(code, language, input, config) {
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
    const executionId = (0, uuid_1.v4)();
    console.log(`[EXECUTE:QUEUE] Starting execution ${executionId} for language ${language}`);
    try {
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
                    removeOnComplete: false,
                    removeOnFail: false,
                    attempts: 1,
                    delay: 0
                });
                console.log(`[EXECUTE:QUEUE] Job ${job.id} added to queue successfully`);
                break;
            }
            catch (queueError) {
                retries++;
                const errorMsg = queueError.message || 'Unknown error';
                console.error(`[EXECUTE:QUEUE] Failed to add job to queue (attempt ${retries}/${maxRetries}):`, errorMsg);
                if (errorMsg.includes('Connection is closed') || errorMsg.includes('closed') || errorMsg.includes('ECONNREFUSED')) {
                    if (retries < maxRetries) {
                        console.log(`[EXECUTE:QUEUE] Connection closed, attempting to reconnect and recreate queue...`);
                        try {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            if (redis_1.redisClient.status !== 'ready') {
                                await redis_1.redisClient.connect();
                            }
                            console.log(`[EXECUTE:QUEUE] Recreating queue with fresh connection...`);
                            await initializeQueue();
                            if (!codeExecutionQueue) {
                                throw new Error('Failed to recreate queue');
                            }
                            console.log(`[EXECUTE:QUEUE] Queue recreated, retrying job add...`);
                            continue;
                        }
                        catch (reconnectError) {
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
                    }
                    else {
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
                }
                else {
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
        try {
            console.log(`[EXECUTE:QUEUE] Waiting for job ${job.id} to complete...`);
            {
                let attempts = 0;
                const maxAttempts = 60;
                while (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    let jobState;
                    try {
                        jobState = await job.getState();
                        console.log(`[EXECUTE:QUEUE] Job ${job.id} state: ${jobState}`);
                    }
                    catch (stateError) {
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
                        const resultKey = `execution-result:${executionId}`;
                        let resultStr = null;
                        try {
                            resultStr = await redis_1.redisClient.get(resultKey);
                            if (resultStr) {
                                console.log(`[EXECUTE:QUEUE] Got result from Redis for key: ${resultKey}`);
                            }
                        }
                        catch (redisError) {
                            console.warn(`[EXECUTE:QUEUE] Failed to get result from Redis: ${redisError.message}`);
                        }
                        let result = null;
                        if (resultStr) {
                            try {
                                result = JSON.parse(resultStr);
                                console.log(`Job ${job.id} completed successfully with result from Redis:`, JSON.stringify(result, null, 2));
                            }
                            catch (parseError) {
                                console.error(`Failed to parse result from Redis:`, parseError);
                            }
                        }
                        else {
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
                            status: 'runtime_error'
                        };
                    }
                    attempts++;
                }
                console.error(`Job ${job.id} timed out after ${maxAttempts * 500}ms`);
                return {
                    success: false,
                    output: '',
                    error: 'Code execution timed out',
                    executionTime: 0,
                    memoryUsed: 0,
                    compilationTime: 0,
                    status: 'timeout'
                };
            }
        }
        catch (waitError) {
            console.error(`Job ${job.id} wait failed:`, waitError);
            return {
                success: false,
                output: '',
                error: waitError.message || 'Code execution failed',
                executionTime: 0,
                memoryUsed: 0,
                compilationTime: 0,
                status: 'system_error'
            };
        }
    }
    catch (error) {
        console.error('Code execution failed:', error);
        return {
            success: false,
            error: error.message || 'Execution failed',
            status: 'system_error'
        };
    }
}
codeRoutes.post('/execute', auth_1.authenticate, (0, validation_1.validate)(validation_1.codeExecutionSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    try {
        const { code, language, input = '', roomId } = req.body;
        const userId = req.user.id;
        console.log(`[CODE:EXECUTE] Request received: language=${language}, roomId=${roomId}, userId=${userId}`);
        console.log(`[CODE:EXECUTE] Queue available: ${!!codeExecutionQueue}`);
        if (!code || !language || !roomId) {
            console.error(`[CODE:EXECUTE] Missing required fields: code=${!!code}, language=${!!language}, roomId=${!!roomId}`);
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: code, language, roomId'
            });
        }
        if (!LANGUAGE_CONFIGS[language]) {
            console.error(`[CODE:EXECUTE] Unsupported language: ${language}`);
            return res.status(400).json({
                success: false,
                error: `Unsupported language: ${language}. Supported languages: ${Object.keys(LANGUAGE_CONFIGS).join(', ')}`
            });
        }
        let room;
        try {
            room = await prisma_1.prisma.room.findFirst({
                where: {
                    id: roomId,
                    participants: {
                        some: {
                            userId: userId
                        }
                    }
                }
            });
        }
        catch (dbError) {
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
        if (!codeExecutionQueue) {
            console.log(`[CODE:EXECUTE] Queue not available, attempting to initialize...`);
            await initializeQueue();
            if (!codeExecutionQueue) {
                console.error(`[CODE:EXECUTE] Queue initialization failed - Redis may not be configured`);
                console.error(`[CODE:EXECUTE] REDIS_URL is ${process.env.REDIS_URL ? 'set' : 'NOT SET'}`);
                return res.status(503).json({
                    success: false,
                    error: 'Code execution service is temporarily unavailable.',
                    details: process.env.REDIS_URL
                        ? 'Redis is configured but connection failed. Please check Redis service status.'
                        : 'Redis is not configured. Please set REDIS_URL environment variable to enable code execution.',
                    suggestion: 'To enable code execution, configure Redis (e.g., Upstash) and set REDIS_URL environment variable.'
                });
            }
            console.log(`[CODE:EXECUTE] Queue initialized successfully`);
        }
        const config = LANGUAGE_CONFIGS[language];
        console.log(`[CODE:EXECUTE] Executing code with config:`, { timeout: config.timeout, memoryLimit: config.memoryLimit });
        let result;
        if (codeExecutionQueue) {
            try {
                const queuePromise = executeCodeWithQueue(code, language, input, config);
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        console.log(`[CODE:EXECUTE] Queue timeout - worker not processing, using direct execution`);
                        resolve({
                            success: false,
                            output: '',
                            error: 'TIMEOUT_FALLBACK',
                            executionTime: 0,
                            memoryUsed: 0,
                            compilationTime: 0,
                            status: 'timeout'
                        });
                    }, 8000);
                });
                result = await Promise.race([queuePromise, timeoutPromise]);
                if (result.error === 'TIMEOUT_FALLBACK' || result.status === 'timeout') {
                    console.log(`[CODE:EXECUTE] Using direct execution fallback (worker unavailable)`);
                    const directResult = await (0, codeExecutor_1.executeCode)(code, language, roomId, userId);
                    result = {
                        success: directResult.status === 'success',
                        output: directResult.output || '',
                        error: directResult.error || '',
                        executionTime: directResult.executionTime || 0,
                        memoryUsed: 0,
                        compilationTime: directResult.compilationTime || 0,
                        status: directResult.status === 'success' ? 'success' :
                            directResult.status === 'compilation_error' ? 'compilation_error' :
                                directResult.status === 'timeout' ? 'timeout' : 'runtime_error'
                    };
                }
            }
            catch (queueError) {
                console.error(`[CODE:EXECUTE] Queue execution failed, using direct execution:`, queueError.message);
                const directResult = await (0, codeExecutor_1.executeCode)(code, language, roomId, userId);
                result = {
                    success: directResult.status === 'success',
                    output: directResult.output || '',
                    error: directResult.error || '',
                    executionTime: directResult.executionTime || 0,
                    memoryUsed: 0,
                    compilationTime: directResult.compilationTime || 0,
                    status: directResult.status === 'success' ? 'success' :
                        directResult.status === 'compilation_error' ? 'compilation_error' :
                            directResult.status === 'timeout' ? 'timeout' : 'runtime_error'
                };
            }
        }
        else {
            console.log(`[CODE:EXECUTE] Queue not available, using direct execution`);
            const directResult = await (0, codeExecutor_1.executeCode)(code, language, roomId, userId);
            result = {
                success: directResult.status === 'success',
                output: directResult.output || '',
                error: directResult.error || '',
                executionTime: directResult.executionTime || 0,
                memoryUsed: 0,
                compilationTime: directResult.compilationTime || 0,
                status: directResult.status === 'success' ? 'success' :
                    directResult.status === 'compilation_error' ? 'compilation_error' :
                        directResult.status === 'timeout' ? 'timeout' : 'runtime_error'
            };
        }
        console.log(`[CODE:EXECUTE] Execution result:`, {
            success: result.success,
            status: result.status,
            hasOutput: !!result.output,
            hasError: !!result.error
        });
        try {
            await prisma_1.prisma.codeExecution.create({
                data: {
                    id: (0, uuid_1.v4)(),
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
        }
        catch (dbError) {
            console.error('[CODE:EXECUTE] Failed to save execution to database:', dbError);
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
    }
    catch (error) {
        console.error('[CODE:EXECUTE] Unexpected error:', error);
        console.error('[CODE:EXECUTE] Error stack:', error.stack);
        return res.status(500).json({
            success: false,
            error: 'Code execution failed',
            details: error.message || 'Unknown error occurred',
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
}));
codeRoutes.get('/history/:roomId', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;
    const room = await prisma_1.prisma.room.findFirst({
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
    const executions = await prisma_1.prisma.codeExecution.findMany({
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
}));
codeRoutes.get('/languages', async (req, res) => {
    const languages = Object.keys(LANGUAGE_CONFIGS).map(lang => ({
        id: lang,
        name: lang.charAt(0).toUpperCase() + lang.slice(1),
        extension: LANGUAGE_CONFIGS[lang].extension,
        needsCompilation: LANGUAGE_CONFIGS[lang].needsCompilation
    }));
    return res.json({
        success: true,
        languages
    });
});
//# sourceMappingURL=code.js.map