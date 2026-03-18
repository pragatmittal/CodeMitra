"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTokenFromHeader = exports.generateRefreshToken = exports.verifyToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
console.log('JWT_SECRET loaded:', JWT_SECRET ? 'YES' : 'NO');
console.log('JWT_SECRET length:', JWT_SECRET ? JWT_SECRET.length : 0);
console.log('JWT_SECRET starts with:', JWT_SECRET ? JWT_SECRET.substring(0, 10) + '...' : 'NONE');
const generateToken = (user) => {
    const payload = {
        userId: user.id,
        email: user.email,
    };
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
};
exports.generateToken = generateToken;
const verifyToken = (token) => {
    try {
        console.log('Verifying token with secret:', JWT_SECRET ? 'SECRET_LOADED' : 'NO_SECRET');
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        console.log('Token verified successfully for user:', decoded.userId);
        return decoded;
    }
    catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
};
exports.verifyToken = verifyToken;
const generateRefreshToken = (user) => {
    const payload = {
        userId: user.id,
        email: user.email,
    };
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        expiresIn: '30d',
    });
};
exports.generateRefreshToken = generateRefreshToken;
const extractTokenFromHeader = (authHeader) => {
    if (!authHeader)
        return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer')
        return null;
    return parts[1];
};
exports.extractTokenFromHeader = extractTokenFromHeader;
//# sourceMappingURL=jwt.js.map