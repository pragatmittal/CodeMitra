"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.optionalAuth = exports.authenticate = void 0;
const jwt_1 = require("../utils/jwt");
const prisma_1 = require("../utils/prisma");
const authenticate = async (req, res, next) => {
    try {
        const token = (0, jwt_1.extractTokenFromHeader)(req.headers.authorization);
        if (!token) {
            res.status(401).json({
                success: false,
                error: 'Access token is required',
            });
            return;
        }
        const decoded = (0, jwt_1.verifyToken)(token);
        if (!decoded) {
            res.status(401).json({
                success: false,
                error: 'Invalid or expired token',
            });
            return;
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
            },
        });
        if (!user) {
            res.status(401).json({
                success: false,
                error: 'User not found',
            });
            return;
        }
        req.user = {
            ...user,
            avatar: user.avatar || undefined
        };
        req.token = token;
        next();
    }
    catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
};
exports.authenticate = authenticate;
const optionalAuth = async (req, res, next) => {
    try {
        const token = (0, jwt_1.extractTokenFromHeader)(req.headers.authorization);
        if (token) {
            const decoded = (0, jwt_1.verifyToken)(token);
            if (decoded) {
                const user = await prisma_1.prisma.user.findUnique({
                    where: { id: decoded.userId },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                    },
                });
                if (user) {
                    req.user = {
                        ...user,
                        avatar: user.avatar || undefined
                    };
                    req.token = token;
                }
            }
        }
        next();
    }
    catch (error) {
        console.error('Optional auth error:', error);
        next();
    }
};
exports.optionalAuth = optionalAuth;
const requireRole = (roles) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                });
                return;
            }
            next();
        }
        catch (error) {
            console.error('Role check error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    };
};
exports.requireRole = requireRole;
//# sourceMappingURL=auth.js.map