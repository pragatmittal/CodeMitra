"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../utils/validation");
const password_1 = require("../utils/password");
const userRoutes = express_1.default.Router();
exports.userRoutes = userRoutes;
userRoutes.get('/profile', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            createdAt: true,
            updatedAt: true,
            _count: {
                select: {
                    createdRooms: true,
                    roomParticipants: true
                }
            }
        }
    });
    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }
    return res.json({
        success: true,
        data: user
    });
}));
userRoutes.put('/profile', auth_1.authenticate, (0, validation_1.validate)(validation_1.updateUserSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const updates = req.body;
    const updatedUser = await prisma_1.prisma.user.update({
        where: { id: userId },
        data: updates,
        select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            createdAt: true,
            updatedAt: true
        }
    });
    res.json({
        success: true,
        data: updatedUser
    });
}));
userRoutes.put('/password', auth_1.authenticate, (0, validation_1.validate)(validation_1.changePasswordSchema), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId }
    });
    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }
    const isCurrentPasswordValid = await (0, password_1.comparePassword)(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
        return res.status(401).json({
            success: false,
            error: 'Current password is incorrect'
        });
    }
    const hashedNewPassword = await (0, password_1.hashPassword)(newPassword);
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
    });
    return res.json({
        success: true,
        message: 'Password changed successfully'
    });
}));
userRoutes.delete('/account', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    await prisma_1.prisma.user.delete({
        where: { id: userId }
    });
    res.json({
        success: true,
        message: 'Account deleted successfully'
    });
}));
//# sourceMappingURL=users.js.map