"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomRoutes = void 0;
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const password_1 = require("../utils/password");
const roomRoutes = express_1.default.Router();
exports.roomRoutes = roomRoutes;
const getBoilerplateCode = (language) => {
    const templates = {
        javascript: `// Welcome to CodeMitra - JavaScript
console.log("Hello, World!");

function add(a, b) {
  return a + b;
}

console.log(add(5, 3));
`,
        python: `# Welcome to CodeMitra - Python
print("Hello, World!")

def add(a, b):
    return a + b

if __name__ == "__main__":
    print(add(5, 3))
`,
        java: `// Welcome to CodeMitra - Java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        System.out.println(add(5, 3));
    }
    
    public static int add(int a, int b) {
        return a + b;
    }
}
`,
        cpp: `// Welcome to CodeMitra - C++
#include <iostream>
using namespace std;

int add(int a, int b) {
    return a + b;
}

int main() {
    cout << "Hello, World!" << endl;
    cout << add(5, 3) << endl;
    return 0;
}
`
    };
    return templates[language] || templates.javascript;
};
roomRoutes.post('/', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name, description, language, visibility, password, maxCapacity } = req.body;
    const userId = req.user.id;
    console.log(`Room creation request from user ${userId}:`, { name, language, visibility });
    if (!name || name.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Room name is required',
            code: 'ROOM_NAME_REQUIRED'
        });
    }
    const supportedLanguages = ['javascript', 'python', 'java', 'cpp'];
    const selectedLanguage = language || 'javascript';
    if (!supportedLanguages.includes(selectedLanguage)) {
        return res.status(400).json({
            success: false,
            error: `Invalid language. Supported: ${supportedLanguages.join(', ')}`,
            code: 'INVALID_LANGUAGE'
        });
    }
    const capacity = maxCapacity || 10;
    if (capacity < 1 || capacity > 100) {
        return res.status(400).json({
            success: false,
            error: 'Room capacity must be between 1 and 100',
            code: 'INVALID_CAPACITY'
        });
    }
    try {
        const roomData = {
            name: name.trim(),
            description: description?.trim() || '',
            language: selectedLanguage,
            visibility: visibility !== false,
            maxCapacity: capacity,
            creatorId: userId,
            code: getBoilerplateCode(selectedLanguage)
        };
        if (!roomData.visibility && password) {
            if (password.length < 4) {
                return res.status(400).json({
                    success: false,
                    error: 'Password must be at least 4 characters long',
                    code: 'INVALID_PASSWORD'
                });
            }
            roomData.password = await (0, password_1.hashPassword)(password);
        }
        console.log(`Creating room for user ${userId} with data:`, {
            name: roomData.name,
            language: roomData.language,
            visibility: roomData.visibility,
            hasPassword: !!roomData.password
        });
        const room = await prisma_1.prisma.room.create({
            data: {
                ...roomData,
                participants: {
                    create: {
                        userId: userId,
                        status: 'active'
                    }
                }
            },
            include: {
                creator: {
                    select: { id: true, name: true, email: true }
                },
                participants: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                }
            }
        });
        console.log(`Room created successfully: ${room.id} with ${room.participants.length} participants`);
        if (global.io) {
            global.io.emit('room:created', {
                id: room.id,
                name: room.name,
                language: room.language,
                visibility: room.visibility,
                creator: room.creator,
                participantCount: room.participants.length,
                createdAt: room.createdAt
            });
        }
        return res.status(201).json({
            success: true,
            data: {
                ...room,
                redirectUrl: `/room/${room.id}/editor`
            }
        });
    }
    catch (error) {
        console.error('Room creation error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({
                success: false,
                error: 'A room with this name already exists',
                code: 'ROOM_NAME_EXISTS'
            });
        }
        return res.status(500).json({
            success: false,
            error: 'Failed to create room. Please try again.',
            code: 'DATABASE_ERROR'
        });
    }
}));
roomRoutes.get('/', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 10, language, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = { visibility: true };
    if (language)
        where.language = language;
    if (search)
        where.name = { contains: search, mode: 'insensitive' };
    const [rooms, total] = await Promise.all([
        prisma_1.prisma.room.findMany({
            where,
            skip,
            take: Number(limit),
            include: {
                creator: {
                    select: { id: true, name: true }
                },
                participants: {
                    where: { status: 'active' },
                    select: { id: true }
                }
            },
            orderBy: { lastActivity: 'desc' }
        }),
        prisma_1.prisma.room.count({ where })
    ]);
    const roomsWithAccurateCount = rooms.map(room => ({
        ...room,
        _count: {
            participants: room.participants.length
        }
    }));
    res.json({
        success: true,
        data: {
            rooms: roomsWithAccurateCount,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        }
    });
}));
roomRoutes.get('/:id', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const room = await prisma_1.prisma.room.findUnique({
        where: { id },
        include: {
            creator: {
                select: { id: true, name: true, email: true }
            },
            participants: {
                include: {
                    user: {
                        select: { id: true, name: true, email: true }
                    }
                }
            }
        }
    });
    if (!room) {
        return res.status(404).json({
            success: false,
            error: 'Room not found'
        });
    }
    return res.json({
        success: true,
        data: room
    });
}));
roomRoutes.post('/:id/join', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    const userId = req.user.id;
    const room = await prisma_1.prisma.room.findUnique({
        where: { id },
        include: { participants: true }
    });
    if (!room) {
        return res.status(404).json({
            success: false,
            error: 'Room not found'
        });
    }
    if (room.participants.length >= room.maxCapacity) {
        return res.status(400).json({
            success: false,
            error: 'Room is full'
        });
    }
    const existingParticipant = room.participants.find(p => p.userId === userId);
    if (existingParticipant) {
        return res.json({
            success: true,
            data: {
                room: {
                    id: room.id,
                    name: room.name,
                    language: room.language,
                    visibility: room.visibility,
                    participants: room.participants
                },
                redirectUrl: `/room/${room.id}/editor`
            },
            message: 'Already in room - redirecting to editor'
        });
    }
    if (!room.visibility && room.password) {
        if (!password || !(await (0, password_1.comparePassword)(password, room.password))) {
            return res.status(401).json({
                success: false,
                error: 'Invalid password'
            });
        }
    }
    await prisma_1.prisma.roomParticipant.create({
        data: { roomId: id, userId, status: 'active' }
    });
    await prisma_1.prisma.room.update({
        where: { id },
        data: { lastActivity: new Date() }
    });
    return res.json({
        success: true,
        message: 'Joined room successfully'
    });
}));
roomRoutes.post('/:id/leave', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    await prisma_1.prisma.roomParticipant.deleteMany({
        where: { roomId: id, userId }
    });
    return res.json({
        success: true,
        message: 'Left room successfully'
    });
}));
roomRoutes.delete('/:id', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const room = await prisma_1.prisma.room.findUnique({
        where: { id }
    });
    if (!room) {
        return res.status(404).json({
            success: false,
            error: 'Room not found'
        });
    }
    if (room.creatorId !== userId) {
        return res.status(403).json({
            success: false,
            error: 'Only room creator can delete room'
        });
    }
    await prisma_1.prisma.room.delete({
        where: { id }
    });
    return res.json({
        success: true,
        message: 'Room deleted successfully'
    });
}));
//# sourceMappingURL=rooms.js.map