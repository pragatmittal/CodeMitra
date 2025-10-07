import express, { Request, Response } from 'express';
import cors from 'cors';
import { prisma } from '../utils/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import { validate, loginSchema, registerSchema } from '../utils/validation';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { AuthenticatedRequest } from '../middleware/auth';

const authRoutes = express.Router();

// CORS configuration for auth routes
const authCorsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Apply CORS to all auth routes
authRoutes.use(cors(authCorsOptions));

// Handle preflight requests for auth routes
authRoutes.options('*', cors(authCorsOptions));

// Register a new user
authRoutes.post('/register', validate(registerSchema), asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            name,
        },
    });

    const token = generateToken(user);
    return res.status(201).json({ success: true, token, user });
}));

// User login
authRoutes.post('/login', validate(loginSchema), asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await comparePassword(password, user.password))) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    return res.status(200).json({ success: true, token, user });
}));

// Get current user
authRoutes.get('/me', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    return res.status(200).json({ success: true, user: req.user });
}));

export { authRoutes };
