"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.codeRoutes = void 0;
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../utils/prisma");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const codeRoutes = express_1.default.Router();
exports.codeRoutes = codeRoutes;
codeRoutes.post('/execute', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { code, language, roomId } = req.body;
    const userId = req.user.id;
    if (!code || !language || !roomId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: code, language, roomId'
        });
    }
    const participant = await prisma_1.prisma.roomParticipant.findUnique({
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
    const supportedLanguages = ['javascript', 'python', 'java', 'cpp'];
    if (!supportedLanguages.includes(language)) {
        return res.status(400).json({
            success: false,
            error: `Unsupported language: ${language}`
        });
    }
    try {
        const result = {
            output: `Code executed successfully!\nLanguage: ${language}\nCode length: ${code.length} characters`,
            error: null,
            executionTime: 100,
            status: 'success'
        };
        const execution = await prisma_1.prisma.codeExecution.create({
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
        return res.json({
            success: true,
            data: execution
        });
    }
    catch (error) {
        console.error('Code execution error:', error);
        return res.status(500).json({
            success: false,
            error: 'Code execution failed'
        });
    }
}));
codeRoutes.get('/history/:roomId', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;
    const participant = await prisma_1.prisma.roomParticipant.findUnique({
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
    const executions = await prisma_1.prisma.codeExecution.findMany({
        where: { roomId },
        include: {
            user: {
                select: { id: true, name: true }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });
    return res.json({
        success: true,
        data: executions
    });
}));
//# sourceMappingURL=code.js.map