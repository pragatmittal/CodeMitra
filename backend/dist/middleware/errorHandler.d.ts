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
export declare const errorHandler: (err: ApiError, req: Request, res: Response, next: NextFunction) => void;
export declare const notFoundHandler: (req: Request, res: Response) => void;
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=errorHandler.d.ts.map