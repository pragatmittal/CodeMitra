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
    const roomData = {
        name,
        description,
        language: language || 'javascript',
        visibility: visibility !== false,
        maxCapacity: maxCapacity || 10,
        creatorId: userId,
        code: getBoilerplateCode(language || 'javascript')
    };
    if (!roomData.visibility && password) {
        roomData.password = await (0, password_1.hashPassword)(password);
    }
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
    res.status(201).json({
        success: true,
        data: room
    });
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
                _count: {
                    select: { participants: true }
                }
            },
            orderBy: { lastActivity: 'desc' }
        }),
        prisma_1.prisma.room.count({ where })
    ]);
    res.json({
        success: true,
        data: {
            rooms,
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
        return res.status(400).json({
            success: false,
            error: 'Already in room'
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