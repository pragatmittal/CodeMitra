import express, { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { hashPassword, comparePassword } from '../utils/password';

const roomRoutes = express.Router();

// Boilerplate code templates
const getBoilerplateCode = (language: string): string => {
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
  
  return templates[language as keyof typeof templates] || templates.javascript;
};

// Create room
roomRoutes.post('/', 
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, description, language, visibility, password, maxCapacity } = req.body;
    const userId = req.user!.id;

    console.log(`Room creation request from user ${userId}:`, { name, language, visibility });

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Room name is required',
        code: 'ROOM_NAME_REQUIRED'
      });
    }

    // Validate language
    const supportedLanguages = ['javascript', 'python', 'java', 'cpp'];
    const selectedLanguage = language || 'javascript';
    if (!supportedLanguages.includes(selectedLanguage)) {
      return res.status(400).json({
        success: false,
        error: `Invalid language. Supported: ${supportedLanguages.join(', ')}`,
        code: 'INVALID_LANGUAGE'
      });
    }

    // Validate maxCapacity
    const capacity = maxCapacity || 10;
    if (capacity < 1 || capacity > 100) {
      return res.status(400).json({
        success: false,
        error: 'Room capacity must be between 1 and 100',
        code: 'INVALID_CAPACITY'
      });
    }

    try {
      const roomData: any = {
        name: name.trim(),
        description: description?.trim() || '',
        language: selectedLanguage,
        visibility: visibility !== false, // default to true
        maxCapacity: capacity,
        creatorId: userId,
        code: getBoilerplateCode(selectedLanguage)
      };

      // Handle password for private rooms
      if (!roomData.visibility && password) {
        if (password.length < 4) {
          return res.status(400).json({
            success: false,
            error: 'Password must be at least 4 characters long',
            code: 'INVALID_PASSWORD'
          });
        }
        roomData.password = await hashPassword(password);
      }

      console.log(`Creating room for user ${userId} with data:`, { 
        name: roomData.name, 
        language: roomData.language, 
        visibility: roomData.visibility,
        hasPassword: !!roomData.password 
      });

      // Create room and participant in a single transaction
      const room = await prisma.room.create({
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

      // Broadcast room creation to all connected users (if WebSocket is available)
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

      // Return response with redirect URL
      return res.status(201).json({ 
        success: true, 
        data: {
          ...room,
          redirectUrl: `/room/${room.id}/editor`
        }
      });
    } catch (error: any) {
      console.error('Room creation error:', error);
      
      // Handle specific database errors
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
  })
);

// List rooms
roomRoutes.get('/', 
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page = 1, limit = 10, language, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { visibility: true };
    if (language) where.language = language;
    if (search) where.name = { contains: search as string, mode: 'insensitive' };

    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
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
      prisma.room.count({ where })
    ]);

    // Transform rooms to include accurate participant count
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
  })
);

// Get room details
roomRoutes.get('/:id', 
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const room = await prisma.room.findUnique({
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
  })
);

// Join room
roomRoutes.post('/:id/join', 
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { password } = req.body;
    const userId = req.user!.id;

    const room = await prisma.room.findUnique({
      where: { id },
      include: { participants: true }
    });

    if (!room) {
      return res.status(404).json({ 
        success: false, 
        error: 'Room not found' 
      });
    }

    // Check capacity
    if (room.participants.length >= room.maxCapacity) {
      return res.status(400).json({ 
        success: false, 
        error: 'Room is full' 
      });
    }

    // Check if already joined
    const existingParticipant = room.participants.find(p => p.userId === userId);
    if (existingParticipant) {
      // If user is already in room, return success with redirect URL instead of error
      // This handles the case where creator tries to join their own room
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

    // Check password for private rooms
    if (!room.visibility && room.password) {
      if (!password || !(await comparePassword(password, room.password))) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid password' 
        });
      }
    }

    // Add participant
    await prisma.roomParticipant.create({
      data: { roomId: id, userId, status: 'active' }
    });

    // Update room activity
    await prisma.room.update({
      where: { id },
      data: { lastActivity: new Date() }
    });

    return res.json({ 
      success: true, 
      message: 'Joined room successfully' 
    });
  })
);

// Leave room
roomRoutes.post('/:id/leave', 
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    await prisma.roomParticipant.deleteMany({
      where: { roomId: id, userId }
    });

    return res.json({ 
      success: true, 
      message: 'Left room successfully' 
    });
  })
);

// Delete room (creator only)
roomRoutes.delete('/:id', 
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    const room = await prisma.room.findUnique({
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

    await prisma.room.delete({
      where: { id }
    });

    return res.json({ 
      success: true, 
      message: 'Room deleted successfully' 
    });
  })
);

export { roomRoutes };
