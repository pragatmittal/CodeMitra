import Docker from 'dockerode';
import { v4 as uuidv4 } from 'uuid';

interface ExecutionRequest {
  executionId: string;
  language: string;
  code: string;
  input?: string;
  timeout?: number;
  memoryLimit?: number;
}

interface ExecutionResult {
  executionId: string;
  status: 'completed' | 'failed' | 'timeout' | 'compilation_error' | 'runtime_error';
  stdout: string;
  stderr: string;
  output: string;
  exitCode: number;
  executionTime: number;
  memoryUsed: number;
  compilationTime?: number;
  error?: string;
}

export class DockerExecutor {
  private docker: Docker;
  private lastContainer: Docker.Container | null = null;

  constructor() {
    this.docker = new Docker({
      socketPath: '/var/run/docker.sock'
    });
  }

  async executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Executing code for language: ${request.language}`);
      
      const config = this.getLanguageConfig(request.language);
      if (!config) {
        throw new Error(`Unsupported language: ${request.language}`);
      }

      // Create container with language-specific image
      const container = await this.docker.createContainer({
        Image: config.dockerImage,
        Cmd: config.command,
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: true,
        OpenStdin: true,
        StdinOnce: false,
        Tty: false,
        WorkingDir: '/workspace',
        HostConfig: {
          Memory: request.memoryLimit || config.memoryLimit,
          MemorySwap: request.memoryLimit || config.memoryLimit,
          NetworkMode: 'none', // Isolate network
          ReadonlyRootfs: true, // Read-only filesystem
          SecurityOpt: ['no-new-privileges'], // No privilege escalation
          CapDrop: ['ALL'], // Drop all capabilities
          Binds: [`${process.cwd()}/temp:/workspace:rw`] // Mount temp directory
        }
      });

      // Start container
      this.lastContainer = container;
      await container.start();

      // Write code to container
      const codeBuffer = Buffer.from(request.code);
      const inputBuffer = Buffer.from(request.input || '');
      
      // Execute code in container
      const exec = await container.exec({
        Cmd: config.command,
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: true,
        WorkingDir: '/workspace'
      });

      const stream = await exec.start({
        stdin: true,
        hijack: true
      });

      // Send code to container
      stream.write(codeBuffer);
      if (inputBuffer.length > 0) {
        stream.write(inputBuffer);
      }
      stream.end();

      // Collect output
      let stdout = '';
      let stderr = '';
      
      stream.on('data', (chunk: Buffer) => {
        const data = chunk.toString();
        if (data.includes('stdout')) {
          stdout += data.replace('stdout', '').trim();
        } else if (data.includes('stderr')) {
          stderr += data.replace('stderr', '').trim();
        }
      });

      // Wait for completion
      const result = await new Promise<{ exitCode: number }>((resolve, reject) => {
        stream.on('end', () => {
          exec.inspect().then(inspect => {
            resolve({ exitCode: inspect.ExitCode || 0 });
          });
        });
        
        stream.on('error', reject);
        
        // Timeout
        setTimeout(() => {
          reject(new Error('Execution timeout'));
        }, request.timeout || config.timeout);
      });

      // Get container stats for memory usage
      let memoryUsed = 0;
      try {
        const stats = await container.stats({ stream: false });
        memoryUsed = stats.memory_stats?.usage || 0;
      } catch (error) {
        console.warn('Failed to get container memory stats:', error);
      }

      // Stop and remove container
      await container.stop();
      await container.remove();

      const executionTime = Date.now() - startTime;

      if (result.exitCode === 0) {
        return {
          executionId: request.executionId,
          status: 'completed',
          stdout,
          stderr,
          output: stdout,
          exitCode: result.exitCode,
          executionTime,
          memoryUsed
        };
      } else {
        return {
          executionId: request.executionId,
          status: 'runtime_error',
          stdout,
          stderr,
          output: stderr || 'Runtime error occurred',
          exitCode: result.exitCode,
          executionTime,
          memoryUsed,
          error: stderr || 'Runtime error'
        };
      }

    } catch (error: any) {
      console.error(`Execution failed:`, error);
      
      // Try to get memory stats even on error, if container was created
      let memoryUsed = 0;
      try {
        if (this.lastContainer) {
          const stats = await this.lastContainer.stats({ stream: false });
          memoryUsed = stats.memory_stats?.usage || 0;
        }
      } catch (statsError) {
        // Ignore stats errors in error handling
      }
      
      return {
        executionId: request.executionId,
        status: 'failed',
        stdout: '',
        stderr: '',
        output: '',
        exitCode: -1,
        executionTime: Date.now() - startTime,
        memoryUsed,
        error: error.message || 'Execution failed'
      };
    }
  }

  private getLanguageConfig(language: string) {
    const configs = {
      javascript: {
        dockerImage: 'node:18-alpine',
        command: ['node', '-e'],
        timeout: 10000,
        memoryLimit: 128 * 1024 * 1024
      },
      python: {
        dockerImage: 'python:3.11-alpine',
        command: ['python3', '-c'],
        timeout: 10000,
        memoryLimit: 256 * 1024 * 1024
      },
      java: {
        dockerImage: 'openjdk:17-alpine',
        command: ['java', '-cp', '.', 'Main'],
        timeout: 20000,
        memoryLimit: 512 * 1024 * 1024
      },
      cpp: {
        dockerImage: 'gcc:alpine',
        command: ['./a.out'],
        timeout: 15000,
        memoryLimit: 256 * 1024 * 1024
      }
    };

    return configs[language as keyof typeof configs];
  }
}
