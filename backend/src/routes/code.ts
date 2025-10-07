import express, { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { executeCode } from '../utils/codeExecutor';

const codeRoutes = express.Router();

// Execute code
codeRoutes.post('/execute', 
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code, language, roomId } = req.body;
    const userId = req.user!.id;

    // Validate required fields
    if (!code || !language || !roomId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: code, language, roomId' 
      });
    }

    // Validate user is in room
    const participant = await prisma.roomParticipant.findUnique({
      where: { 
        roomId_userId: { roomId, userId } 
      }
    });

    if (!participant) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to execute code in this room' 
      });
    }

    // Validate language
    const supportedLanguages = ['javascript', 'python', 'java', 'cpp'];
    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({ 
        success: false, 
        error: `Unsupported language: ${language}` 
      });
    }

    try {
      console.log(`[CODE:EXEC] Starting execution - Room: ${roomId}, User: ${userId}, Language: ${language}`);
      
      // Execute the code using the code executor with room and user context
      const result = await executeCode(code, language, roomId, userId);

      console.log(`[CODE:EXEC] Execution completed - Status: ${result.status}, Time: ${result.executionTime}ms`);

      // Save execution to database
      const execution = await prisma.codeExecution.create({
        data: {
          roomId,
          userId,
          code,
          language,
          output: result.output,
          error: result.error,
          executionTime: result.executionTime,
          status: result.status
        }
      });

      // Broadcast execution result to all users in the room
      if (global.io) {
        global.io.to(roomId).emit('code:execution:result', {
          roomId,
          user: { id: userId },
          result: {
            output: result.output,
            error: result.error,
            executionTime: result.executionTime,
            status: result.status,
            compilationTime: result.compilationTime,
            executionTimeOnly: result.executionTimeOnly
          }
        });
      }

      return res.json({ 
        success: true, 
        data: execution 
      });
    } catch (error) {
      console.error('[CODE:EXEC] Error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Code execution failed' 
      });
    }
  })
);

// Get execution history for a room
codeRoutes.get('/history/:roomId', 
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { roomId } = req.params;
    const userId = req.user!.id;

    // Validate user is in room
    const participant = await prisma.roomParticipant.findUnique({
      where: { 
        roomId_userId: { roomId, userId } 
      }
    });

    if (!participant) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to view execution history' 
      });
    }

    const executions = await prisma.codeExecution.findMany({
      where: { roomId },
      include: {
        user: { 
          select: { id: true, name: true } 
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to last 50 executions
    });

    return res.json({ 
      success: true, 
      data: executions 
    });
  })
);

export { codeRoutes };
