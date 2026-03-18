"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCode = executeCode;
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const crypto_1 = require("crypto");
async function executeCode(code, language, roomId, userId) {
    const startTime = Date.now();
    const executionId = (0, crypto_1.randomUUID)();
    const timestamp = Date.now();
    const tempDir = (0, path_1.join)('/tmp', `exec_${roomId || 'unknown'}_${userId || 'unknown'}_${timestamp}_${executionId.slice(0, 8)}`);
    try {
        await (0, promises_1.mkdir)(tempDir, { recursive: true, mode: 0o700 });
        console.log(`[CODE:EXEC] Starting ${language} execution - ID: ${executionId}, Room: ${roomId}, User: ${userId}`);
        console.log(`[CODE:EXEC] Temp directory: ${tempDir}`);
        await verifyLanguageRuntime(language);
        let result;
        switch (language) {
            case 'javascript':
                result = await executeJavaScript(code, tempDir, executionId, startTime);
                break;
            case 'python':
                result = await executePython(code, tempDir, executionId, startTime);
                break;
            case 'java':
                result = await executeJava(code, tempDir, executionId, startTime);
                break;
            case 'cpp':
                result = await executeCpp(code, tempDir, executionId, startTime);
                break;
            default:
                throw new Error(`Unsupported language: ${language}`);
        }
        console.log(`[CODE:EXEC] Completed ${language} execution - Status: ${result.status}, Time: ${result.executionTime}ms`);
        return result;
    }
    catch (error) {
        console.error(`[CODE:EXEC] Error for ${language}:`, error);
        return {
            output: '',
            error: error instanceof Error ? error.message : 'Unknown error',
            executionTime: Date.now() - startTime,
            status: 'error'
        };
    }
    finally {
        await cleanupDirectory(tempDir);
    }
}
async function verifyLanguageRuntime(language) {
    const runtimes = {
        javascript: 'node',
        python: 'python3',
        java: 'java',
        cpp: 'g++'
    };
    const runtime = runtimes[language];
    if (!runtime) {
        throw new Error(`Unsupported language: ${language}`);
    }
    try {
        await executeCommand(runtime, ['--version'], '/tmp', 5000);
    }
    catch (error) {
        throw new Error(`Programming language runtime not available: ${runtime}. Please contact support.`);
    }
}
async function executeJavaScript(code, tempDir, executionId, startTime) {
    const fileName = 'main.js';
    const filePath = (0, path_1.join)(tempDir, fileName);
    try {
        await (0, promises_1.writeFile)(filePath, code);
        const result = await executeCommand('node', [fileName], tempDir, 10000);
        return {
            output: result.stdout,
            error: result.stderr,
            executionTime: Date.now() - startTime,
            status: result.exitCode === 0 ? 'success' : 'error'
        };
    }
    catch (error) {
        return {
            output: '',
            error: error instanceof Error ? error.message : 'JavaScript execution failed',
            executionTime: Date.now() - startTime,
            status: 'error'
        };
    }
}
async function executePython(code, tempDir, executionId, startTime) {
    const fileName = 'main.py';
    const filePath = (0, path_1.join)(tempDir, fileName);
    try {
        await (0, promises_1.writeFile)(filePath, code);
        const result = await executeCommand('python3', [fileName], tempDir, 10000);
        return {
            output: result.stdout,
            error: result.stderr,
            executionTime: Date.now() - startTime,
            status: result.exitCode === 0 ? 'success' : 'error'
        };
    }
    catch (error) {
        return {
            output: '',
            error: error instanceof Error ? error.message : 'Python execution failed',
            executionTime: Date.now() - startTime,
            status: 'error'
        };
    }
}
async function executeJava(code, tempDir, executionId, startTime) {
    const fileName = 'Main.java';
    const filePath = (0, path_1.join)(tempDir, fileName);
    const classFile = (0, path_1.join)(tempDir, 'Main.class');
    try {
        let javaCode = code.trim();
        if (!javaCode.includes('public class Main')) {
            if (javaCode.includes('class ')) {
                javaCode = javaCode.replace(/class\s+\w+/, 'class Main');
            }
            else {
                javaCode = `public class Main {\n    public static void main(String[] args) {\n${javaCode.split('\n').map(line => '        ' + line).join('\n')}\n    }\n}`;
            }
        }
        await (0, promises_1.writeFile)(filePath, javaCode);
        console.log(`[JAVA] Written code to ${filePath}`);
        const compileStartTime = Date.now();
        const compileResult = await executeCommand('javac', ['-cp', '.', fileName], tempDir, 10000);
        const compilationTime = Date.now() - compileStartTime;
        console.log(`[JAVA] Compilation result - Exit code: ${compileResult.exitCode}, Stderr: ${compileResult.stderr}`);
        if (compileResult.exitCode !== 0) {
            return {
                output: '',
                error: `Compilation Error:\n${compileResult.stderr}`,
                executionTime: Date.now() - startTime,
                compilationTime,
                status: 'compilation_error'
            };
        }
        try {
            await (0, promises_1.access)(classFile);
            console.log(`[JAVA] Class file created successfully`);
        }
        catch {
            return {
                output: '',
                error: 'Compilation failed - no class file generated',
                executionTime: Date.now() - startTime,
                compilationTime,
                status: 'compilation_error'
            };
        }
        const execStartTime = Date.now();
        const execResult = await executeCommand('java', ['-cp', tempDir, 'Main'], tempDir, 10000);
        const executionTimeOnly = Date.now() - execStartTime;
        console.log(`[JAVA] Execution result - Exit code: ${execResult.exitCode}, Output: ${execResult.stdout}, Stderr: ${execResult.stderr}`);
        return {
            output: execResult.stdout,
            error: execResult.stderr,
            executionTime: Date.now() - startTime,
            compilationTime,
            executionTimeOnly,
            status: execResult.exitCode === 0 ? 'success' : 'error'
        };
    }
    catch (error) {
        console.error(`[JAVA] Execution error:`, error);
        return {
            output: '',
            error: error instanceof Error ? error.message : 'Java execution failed',
            executionTime: Date.now() - startTime,
            status: 'error'
        };
    }
}
async function executeCpp(code, tempDir, executionId, startTime) {
    const fileName = 'main.cpp';
    const filePath = (0, path_1.join)(tempDir, fileName);
    const executableName = 'program';
    const executablePath = (0, path_1.join)(tempDir, executableName);
    try {
        await (0, promises_1.writeFile)(filePath, code);
        console.log(`[CPP] Written code to ${filePath}`);
        const compileStartTime = Date.now();
        const compileResult = await executeCommand('g++', [
            '-std=c++17',
            '-Wall',
            '-Wextra',
            '-o', executableName,
            fileName
        ], tempDir, 10000);
        const compilationTime = Date.now() - compileStartTime;
        console.log(`[CPP] Compilation result - Exit code: ${compileResult.exitCode}, Stderr: ${compileResult.stderr}`);
        if (compileResult.exitCode !== 0) {
            return {
                output: '',
                error: `Compilation Error:\n${compileResult.stderr}`,
                executionTime: Date.now() - startTime,
                compilationTime,
                status: 'compilation_error'
            };
        }
        try {
            await (0, promises_1.access)(executablePath);
            console.log(`[CPP] Executable created successfully`);
        }
        catch {
            return {
                output: '',
                error: 'Compilation failed - no executable generated',
                executionTime: Date.now() - startTime,
                compilationTime,
                status: 'compilation_error'
            };
        }
        const execStartTime = Date.now();
        const execResult = await executeCommand(`./${executableName}`, [], tempDir, 10000);
        const executionTimeOnly = Date.now() - execStartTime;
        console.log(`[CPP] Execution result - Exit code: ${execResult.exitCode}, Output: ${execResult.stdout}, Stderr: ${execResult.stderr}`);
        return {
            output: execResult.stdout,
            error: execResult.stderr,
            executionTime: Date.now() - startTime,
            compilationTime,
            executionTimeOnly,
            status: execResult.exitCode === 0 ? 'success' : 'error'
        };
    }
    catch (error) {
        console.error(`[CPP] Execution error:`, error);
        return {
            output: '',
            error: error instanceof Error ? error.message : 'C++ execution failed',
            executionTime: Date.now() - startTime,
            status: 'error'
        };
    }
}
function executeCommand(command, args, cwd, timeout) {
    return new Promise((resolve, reject) => {
        console.log(`Executing: ${command} ${args.join(' ')} in ${cwd}`);
        const childProcess = (0, child_process_1.spawn)(command, args, {
            cwd,
            timeout,
            env: {
                ...process.env,
                LANG: 'en_US.UTF-8',
                LC_ALL: 'en_US.UTF-8'
            }
        });
        let stdout = '';
        let stderr = '';
        childProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        childProcess.on('close', (code) => {
            console.log(`Command completed with exit code: ${code}`);
            resolve({
                stdout,
                stderr,
                exitCode: code || 0
            });
        });
        childProcess.on('error', (error) => {
            console.error(`Command error:`, error);
            reject(error);
        });
    });
}
async function cleanupDirectory(tempDir) {
    try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        await execAsync(`rm -rf "${tempDir}"`);
    }
    catch (error) {
        console.warn('Cleanup warning:', error);
    }
}
//# sourceMappingURL=codeExecutor.js.map