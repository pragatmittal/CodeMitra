export interface ExecutionResult {
    output: string;
    error: string;
    executionTime: number;
    status: 'success' | 'error' | 'timeout';
}
export declare function executeCode(code: string, language: string): Promise<ExecutionResult>;
//# sourceMappingURL=codeExecutor.d.ts.map