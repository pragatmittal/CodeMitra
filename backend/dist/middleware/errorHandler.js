"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.notFoundHandler = exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let code = err.code || 'INTERNAL_ERROR';
    const errAny = err;
    if (errAny?.name === 'PrismaClientKnownRequestError') {
        switch (errAny.code) {
            case 'P2002':
                statusCode = 409;
                message = 'Resource already exists';
                code = 'CONFLICT';
                break;
            case 'P2025':
                statusCode = 404;
                message = 'Resource not found';
                code = 'NOT_FOUND';
                break;
            case 'P2003':
                statusCode = 400;
                message = 'Foreign key constraint failed';
                code = 'BAD_REQUEST';
                break;
            case 'P2021':
            case 'P1001':
                statusCode = 503;
                message = 'Database connection error. Please try again.';
                code = 'DATABASE_CONNECTION_ERROR';
                break;
            default:
                statusCode = 500;
                message = errAny.message || 'Database error';
                code = 'DATABASE_ERROR';
                console.error('Prisma Error Details:', {
                    code: errAny.code,
                    meta: errAny.meta,
                    message: errAny.message
                });
        }
    }
    if (errAny?.name === 'PrismaClientValidationError') {
        statusCode = 400;
        message = 'Validation error';
        code = 'VALIDATION_ERROR';
    }
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
        code = 'INVALID_TOKEN';
    }
    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
        code = 'TOKEN_EXPIRED';
    }
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        statusCode,
        code,
    });
    res.status(statusCode).json({
        success: false,
        error: message,
        code,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};
exports.errorHandler = errorHandler;
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        code: 'NOT_FOUND',
    });
};
exports.notFoundHandler = notFoundHandler;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=errorHandler.js.map