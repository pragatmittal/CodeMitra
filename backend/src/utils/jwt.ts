import jwt from 'jsonwebtoken';

// Accept a looser user type to avoid dependency on external modules during build
interface UserLike { 
  id: string; 
  email: string; 
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Debug logging
console.log('JWT_SECRET loaded:', JWT_SECRET ? 'YES' : 'NO');
console.log('JWT_SECRET length:', JWT_SECRET ? JWT_SECRET.length : 0);
console.log('JWT_SECRET starts with:', JWT_SECRET ? JWT_SECRET.substring(0, 10) + '...' : 'NONE');

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export const generateToken = (user: UserLike): string => {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): JwtPayload | null => {
  try {
    console.log('Verifying token with secret:', JWT_SECRET ? 'SECRET_LOADED' : 'NO_SECRET');
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    console.log('Token verified successfully for user:', decoded.userId);
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
};

export const generateRefreshToken = (user: UserLike): string => {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '30d',
  } as jwt.SignOptions);
};

export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
};
