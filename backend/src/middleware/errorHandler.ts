// Use flexible types to avoid module resolution issues during build
interface Request {
  url: string;
  method: string;
  [key: string]: any;
}

interface Response {
  status(code: number): Response;
  json(data: any): void;
  [key: string]: any;
}

interface NextFunction {
  (error?: any): void;
}

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_ERROR';

  // Handle Prisma errors using runtime checks
  const errAny = err as any;
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
        // Log full error for debugging
        console.error('Prisma Error Details:', {
          code: errAny.code,
          meta: errAny.meta,
          message: errAny.message
        });
    }
  }

  // Handle validation errors
  if (errAny?.name === 'PrismaClientValidationError') {
    statusCode = 400;
    message = 'Validation error';
    code = 'VALIDATION_ERROR';
  }

  // Handle JWT errors
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

  // Log error for debugging
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

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
