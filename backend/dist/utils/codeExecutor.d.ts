export interface ExecutionResult {
    output: string;
    error: string;
    executionTime: number;
    status: 'success' | 'error' | 'timeout' | 'compilation_error';
    compilationTime?: number;
    executionTimeOnly?: number;
}
export declare function executeCode(code: string, language: string, roomId?: string, userId?: string): Promise<ExecutionResult>;
//# sourceMappingURL=codeExecutor.d.ts.map