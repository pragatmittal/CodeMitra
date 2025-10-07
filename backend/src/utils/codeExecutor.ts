import { spawn } from 'child_process';
import { writeFile, unlink, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export interface ExecutionResult {
  output: string;
  error: string;
  executionTime: number;
  status: 'success' | 'error' | 'timeout' | 'compilation_error';
  compilationTime?: number;
  executionTimeOnly?: number;
}

export async function executeCode(code: string, language: string, roomId?: string, userId?: string): Promise<ExecutionResult> {
  const startTime = Date.now();
  const executionId = randomUUID();
  const timestamp = Date.now();
  const tempDir = join('/tmp', `exec_${roomId || 'unknown'}_${userId || 'unknown'}_${timestamp}_${executionId.slice(0, 8)}`);
  
  try {
    // Create isolated temporary directory for this execution
    await mkdir(tempDir, { recursive: true, mode: 0o700 });
    
    console.log(`[CODE:EXEC] Starting ${language} execution - ID: ${executionId}, Room: ${roomId}, User: ${userId}`);
    console.log(`[CODE:EXEC] Temp directory: ${tempDir}`);
    
    // Verify language runtime availability
    await verifyLanguageRuntime(language);
    
    let result: ExecutionResult;
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
  } catch (error) {
    console.error(`[CODE:EXEC] Error for ${language}:`, error);
    return {
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: Date.now() - startTime,
      status: 'error'
    };
  } finally {
    // Always cleanup temporary directory
    await cleanupDirectory(tempDir);
  }
}

// Verify that the required language runtime is available
async function verifyLanguageRuntime(language: string): Promise<void> {
  const runtimes = {
    javascript: 'node',
    python: 'python3',
    java: 'java',
    cpp: 'g++'
  };
  
  const runtime = runtimes[language as keyof typeof runtimes];
  if (!runtime) {
    throw new Error(`Unsupported language: ${language}`);
  }
  
  try {
    await executeCommand(runtime, ['--version'], '/tmp', 5000);
  } catch (error) {
    throw new Error(`Programming language runtime not available: ${runtime}. Please contact support.`);
  }
}

// JavaScript execution
async function executeJavaScript(code: string, tempDir: string, executionId: string, startTime: number): Promise<ExecutionResult> {
  const fileName = 'main.js';
  const filePath = join(tempDir, fileName);
  
  try {
    // Write code to file
    await writeFile(filePath, code);
    
    // Execute with Node.js
    const result = await executeCommand('node', [fileName], tempDir, 10000);
    
    return {
      output: result.stdout,
      error: result.stderr,
      executionTime: Date.now() - startTime,
      status: result.exitCode === 0 ? 'success' : 'error'
    };
  } catch (error) {
    return {
      output: '',
      error: error instanceof Error ? error.message : 'JavaScript execution failed',
      executionTime: Date.now() - startTime,
      status: 'error'
    };
  }
}

// Python execution
async function executePython(code: string, tempDir: string, executionId: string, startTime: number): Promise<ExecutionResult> {
  const fileName = 'main.py';
  const filePath = join(tempDir, fileName);
  
  try {
    // Write code to file
    await writeFile(filePath, code);
    
    // Execute with Python 3
    const result = await executeCommand('python3', [fileName], tempDir, 10000);
    
    return {
      output: result.stdout,
      error: result.stderr,
      executionTime: Date.now() - startTime,
      status: result.exitCode === 0 ? 'success' : 'error'
    };
  } catch (error) {
    return {
      output: '',
      error: error instanceof Error ? error.message : 'Python execution failed',
      executionTime: Date.now() - startTime,
      status: 'error'
    };
  }
}

// Java execution (two-phase: compile then run)
async function executeJava(code: string, tempDir: string, executionId: string, startTime: number): Promise<ExecutionResult> {
  const fileName = 'Main.java';
  const filePath = join(tempDir, fileName);
  const classFile = join(tempDir, 'Main.class');
  
  try {
    // Ensure code has a public class Main
    let javaCode = code.trim();
    if (!javaCode.includes('public class Main')) {
      // Wrap in Main class if not present
      if (javaCode.includes('class ')) {
        // Replace existing class with Main
        javaCode = javaCode.replace(/class\s+\w+/, 'class Main');
      } else {
        // Wrap in Main class
        javaCode = `public class Main {\n    public static void main(String[] args) {\n${javaCode.split('\n').map(line => '        ' + line).join('\n')}\n    }\n}`;
      }
    }
    
    // Write code to file
    await writeFile(filePath, javaCode);
    console.log(`[JAVA] Written code to ${filePath}`);
    
    // Phase 1: Compile Java code
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
    
    // Check if class file was created
    try {
      await access(classFile);
      console.log(`[JAVA] Class file created successfully`);
    } catch {
      return {
        output: '',
        error: 'Compilation failed - no class file generated',
        executionTime: Date.now() - startTime,
        compilationTime,
        status: 'compilation_error'
      };
    }
    
    // Phase 2: Execute compiled Java code
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
  } catch (error) {
    console.error(`[JAVA] Execution error:`, error);
    return {
      output: '',
      error: error instanceof Error ? error.message : 'Java execution failed',
      executionTime: Date.now() - startTime,
      status: 'error'
    };
  }
}

// C++ execution (two-phase: compile then run)
async function executeCpp(code: string, tempDir: string, executionId: string, startTime: number): Promise<ExecutionResult> {
  const fileName = 'main.cpp';
  const filePath = join(tempDir, fileName);
  const executableName = 'program';
  const executablePath = join(tempDir, executableName);
  
  try {
    // Write code to file
    await writeFile(filePath, code);
    console.log(`[CPP] Written code to ${filePath}`);
    
    // Phase 1: Compile C++ code
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
    
    // Check if executable was created
    try {
      await access(executablePath);
      console.log(`[CPP] Executable created successfully`);
    } catch {
      return {
        output: '',
        error: 'Compilation failed - no executable generated',
        executionTime: Date.now() - startTime,
        compilationTime,
        status: 'compilation_error'
      };
    }
    
    // Phase 2: Execute compiled C++ code
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
  } catch (error) {
    console.error(`[CPP] Execution error:`, error);
    return {
      output: '',
      error: error instanceof Error ? error.message : 'C++ execution failed',
      executionTime: Date.now() - startTime,
      status: 'error'
    };
  }
}

// Generic command execution with timeout
function executeCommand(command: string, args: string[], cwd: string, timeout: number): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command} ${args.join(' ')} in ${cwd}`);
    
    const childProcess = spawn(command, args, {
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

    childProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    childProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code: number | null) => {
      console.log(`Command completed with exit code: ${code}`);
      resolve({
        stdout,
        stderr,
        exitCode: code || 0
      });
    });

    childProcess.on('error', (error: Error) => {
      console.error(`Command error:`, error);
      reject(error);
    });
  });
}

// Cleanup temporary directory
async function cleanupDirectory(tempDir: string): Promise<void> {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Remove the entire directory and its contents
    await execAsync(`rm -rf "${tempDir}"`);
  } catch (error) {
    console.warn('Cleanup warning:', error);
  }
}

