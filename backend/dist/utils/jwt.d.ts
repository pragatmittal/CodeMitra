interface UserLike {
    id: string;
    email: string;
}
export interface JwtPayload {
    userId: string;
    email: string;
    iat?: number;
    exp?: number;
}
export declare const generateToken: (user: UserLike) => string;
export declare const verifyToken: (token: string) => JwtPayload | null;
export declare const generateRefreshToken: (user: UserLike) => string;
export declare const extractTokenFromHeader: (authHeader: string | undefined) => string | null;
export {};
//# sourceMappingURL=jwt.d.ts.map