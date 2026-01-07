import Docker from 'dockerode';
import path from 'path';
import fs from 'fs-extra';
import tarFs from 'tar-fs';
import { 
  DockerExecutionOptions, 
  DockerExecutionResult, 
  ExecutionRequest, 
  ExecutionResult, 
  CompilationResult 
} from '../types';
import { 
  logger, 
  createTempDirectory, 
  writeCodeToFile, 
  createInputFile, 
  cleanupDirectory, 
  validateTimeout, 
  validateMemoryLimit, 
  formatExecutionTime, 
  formatMemorySize, 
  isTimeoutError, 
  isMemoryError, 
  sanitizeError, 
  getWorkerConfig 
} from '../utils';
import { 
  getLanguageById, 
  getFileName, 
  extractClassName 
} from '../languages';

export class DockerExecutor {
  private docker: Docker;
  private config: any;
  private runningContainers: Map<string, Docker.Container>;

  constructor() {
    this.config = getWorkerConfig();
    this.docker = new Docker({
      socketPath: this.config.docker.socketPath,
      host: this.config.docker.host,
      port: this.config.docker.port,
      timeout: this.config.docker.timeout
    });
    this.runningContainers = new Map();
    
    // Setup cleanup on exit
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  async executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    let tempDir: string | null = null;
    let containerId: string | null = null;

    try {
      // Validate language
      const language = getLanguageById(request.language);
      if (!language) {
        throw new Error(`Unsupported language: ${request.language}`);
      }

      // Validate request parameters
      const timeout = validateTimeout(request.timeout || language.timeout);
      const memoryLimit = validateMemoryLimit(request.memoryLimit || language.memoryLimit);

      // Create temporary directory
      tempDir = await createTempDirectory();
      logger.info(`Created temp directory: ${tempDir}`);

      // Extract class name for Java
      const className = extractClassName(request.code, request.language);
      const fileName = getFileName(request.language, className);
      const codeFile = path.join(tempDir, fileName);

      // Write code to file
      await writeCodeToFile(request.code, codeFile);

      // Create input file if provided
      let inputFile: string | null = null;
      if (request.input) {
        inputFile = await createInputFile(request.input, tempDir);
      }

      // Compile if necessary
      let compilationResult: CompilationResult | null = null;
      if (language.compileCommand) {
        compilationResult = await this.compileCode(
          language,
          tempDir,
          fileName,
          timeout
        );

        if (!compilationResult.success) {
          return {
            executionId: request.executionId,
            status: 'compilation_error',
            error: compilationResult.error || 'Compilation failed',
            compilationOutput: compilationResult.output,
            executionTime: Date.now() - startTime
          };
        }
      }

      // Execute code
      const executionResult = await this.runCode(
        language,
        tempDir,
        fileName,
        inputFile,
        timeout,
        memoryLimit
      );

      // Determine status with proper syntax error detection for interpreted languages
      let status: 'completed' | 'failed' | 'timeout' | 'memory_limit_exceeded' | 'compilation_error';
      if (executionResult.timedOut) {
        status = 'timeout';
      } else if (executionResult.exitCode === 0) {
        status = 'completed';
      } else {
        // Check for syntax errors in interpreted languages
        const stderr = executionResult.stderr.toLowerCase();
        let isSyntaxError = false;
        
        if (language.id === 'python') {
          // Python: Only syntax errors, not runtime errors
          isSyntaxError = stderr.includes('syntaxerror') || 
                         stderr.includes('syntax error') ||
                         stderr.includes('invalid syntax') ||
                         stderr.includes('parsing error');
          // If it has traceback with runtime errors (IndexError, NameError, etc.), it's NOT a syntax error
          const runtimeErrors = ['indexerror', 'nameerror', 'typeerror', 'valueerror', 'keyerror', 'attributeerror'];
          if (stderr.includes('traceback') && runtimeErrors.some(err => stderr.includes(err))) {
            isSyntaxError = false; // This is a runtime error, not syntax
          }
        } else if (language.id === 'javascript') {
          // JavaScript: Syntax errors
          isSyntaxError = stderr.includes('syntaxerror') || 
                         stderr.includes('syntax error') ||
                         stderr.includes('unexpected token') ||
                         stderr.includes('parsing error');
        }
        
        status = isSyntaxError ? 'compilation_error' : 'failed';
      }

      // Build result
      const result: ExecutionResult = {
        executionId: request.executionId,
        status,
        stdout: executionResult.stdout,
        stderr: executionResult.stderr,
        output: executionResult.stdout,
        // Only set error field for actual failures, not successful executions with stderr
        error: (status === 'completed') ? undefined : (executionResult.stderr || undefined),
        exitCode: executionResult.exitCode,
        executionTime: Date.now() - startTime,
        memoryUsed: executionResult.memoryUsed,
        compilationOutput: compilationResult?.output
      };

      // Handle memory limit exceeded
      if (isMemoryError(new Error(executionResult.stderr))) {
        result.status = 'memory_limit_exceeded';
      }

      logger.info(`Execution completed: ${request.executionId}, Status: ${result.status}, Time: ${formatExecutionTime(result.executionTime)}`);
      return result;

    } catch (error) {
      logger.error(`Execution failed: ${request.executionId}`, error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const status = isTimeoutError(error as Error) ? 'timeout' :
                    isMemoryError(error as Error) ? 'memory_limit_exceeded' : 'failed';

      return {
        executionId: request.executionId,
        status,
        error: sanitizeError(errorMessage),
        executionTime: Date.now() - startTime
      };
    } finally {
      // Cleanup
      if (containerId) {
        await this.cleanupContainer(containerId);
      }
      if (tempDir) {
        await cleanupDirectory(tempDir);
      }
    }
  }

  private async compileCode(
    language: any,
    workDir: string,
    fileName: string,
    timeout: number
  ): Promise<CompilationResult> {
    const startTime = Date.now();

    try {
      const options: DockerExecutionOptions = {
        image: language.dockerImage,
        command: language.compileCommand!.split(' '),
        workingDir: '/workspace',
        timeout,
        memoryLimit: '512m', // Compilation usually needs more memory
        networkMode: 'none',
        readOnly: false,
        volumes: {
          [workDir]: '/workspace'
        }
      };

      const result = await this.executeInDocker(options);

      // Clean output to prevent database encoding issues
      const cleanOutput = (text: string) => {
        return text.replace(/\0/g, '')
                   .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                   .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
                   .trim();
      };

      return {
        success: result.exitCode === 0,
        output: cleanOutput(result.stdout),
        error: result.stderr ? cleanOutput(result.stderr) : undefined,
        compilationTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        compilationTime: Date.now() - startTime
      };
    }
  }

  private async runCode(
    language: any,
    workDir: string,
    fileName: string,
    inputFile: string | null,
    timeout: number,
    memoryLimit: string
  ): Promise<DockerExecutionResult> {
    const command = language.runCommand.split(' ');
    
    // Handle input redirection
    if (inputFile) {
      command.push('<', 'input.txt');
    }

    const options: DockerExecutionOptions = {
      image: language.dockerImage,
      command,
      workingDir: '/workspace',
      timeout,
      memoryLimit,
      networkMode: 'none',
      readOnly: false, // Allow writing for compiled languages that need executable files
      volumes: {
        [workDir]: '/workspace'
      }
    };

    return await this.executeInDocker(options);
  }

  private async executeInDocker(options: DockerExecutionOptions): Promise<DockerExecutionResult> {
    const startTime = Date.now();
    let container: Docker.Container | null = null;
    let stream: NodeJS.ReadWriteStream | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Pull image if not exists
      await this.ensureImage(options.image);

      // Create container
      const containerOptions: any = {
        Image: options.image,
        Cmd: options.command,
        WorkingDir: options.workingDir,
        NetworkMode: options.networkMode || 'none',
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: true,
        OpenStdin: true,
        StdinOnce: true,
        Tty: false,
        HostConfig: {
          Memory: this.parseMemoryLimit(options.memoryLimit),
          MemorySwap: this.parseMemoryLimit(options.memoryLimit),
          CpuPeriod: 100000,
          CpuQuota: 50000, // 50% CPU
          NetworkMode: options.networkMode || 'none',
          ReadonlyRootfs: options.readOnly || false,
          SecurityOpt: ['no-new-privileges'],
          CapDrop: ['ALL'],
          CapAdd: ['SETUID', 'SETGID'], // Minimal capabilities
          PidsLimit: 64,
          Ulimits: [
            {
              Name: 'nofile',
              Soft: 1024,
              Hard: 1024
            },
            {
              Name: 'nproc',
              Soft: 32,
              Hard: 32
            }
          ]
        }
      };

      // Add volumes if specified
      if (options.volumes) {
        const volumeMode = options.readOnly ? 'ro' : 'rw';
        containerOptions.HostConfig!.Binds = Object.entries(options.volumes).map(
          ([host, container]) => `${host}:${container}:${volumeMode}`
        );
      }

      // Add environment variables
      if (options.environment) {
        containerOptions.Env = Object.entries(options.environment).map(
          ([key, value]) => `${key}=${value}`
        );
      }

      container = await this.docker.createContainer(containerOptions);
      const containerId = container.id;
      this.runningContainers.set(containerId, container);

      // Start container
      await container.start();

      // Setup timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Execution timed out after ${options.timeout}ms`));
        }, options.timeout);
      });

      // Attach to container
      stream = await container.attach({
        stream: true,
        stdout: true,
        stderr: true,
        stdin: true
      });

      // Collect output
      let stdout = '';
      let stderr = '';

      const outputPromise = new Promise<void>((resolve, reject) => {
        if (!stream) {
          reject(new Error('Stream not available'));
          return;
        }

        stream.on('data', (chunk: Buffer) => {
          const data = chunk.toString();
          // Docker multiplexes stdout/stderr
          if (chunk[0] === 1) {
            stdout += data.slice(8); // Remove Docker header
          } else if (chunk[0] === 2) {
            stderr += data.slice(8); // Remove Docker header
          }
        });

        stream.on('end', resolve);
        stream.on('error', reject);
      });

      // Wait for container to finish or timeout
      const containerPromise = container.wait();

      await Promise.race([
        Promise.all([containerPromise, outputPromise]),
        timeoutPromise
      ]);

      // Get container stats
      const stats = await container.stats({ stream: false });
      const memoryUsed = stats.memory_stats?.usage || 0;

      // Get exit code
      const containerInfo = await container.inspect();
      const exitCode = containerInfo.State.ExitCode || 0;

      const executionTime = Date.now() - startTime;

      // Remove null bytes and other problematic characters that cause database encoding issues
      const cleanOutput = (text: string) => {
        // Remove null bytes, control characters, and other problematic characters
        return text.replace(/\0/g, '')
                   .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                   .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
                   .trim();
      };

      return {
        stdout: cleanOutput(stdout),
        stderr: cleanOutput(stderr),
        exitCode,
        executionTime,
        memoryUsed,
        timedOut: false,
        killed: false
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message.includes('timeout');

      if (isTimeout && container) {
        try {
          await container.kill();
        } catch (killError) {
          logger.error('Failed to kill container:', killError);
        }
      }

      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: isTimeout ? 124 : 1,
        executionTime,
        memoryUsed: 0,
        timedOut: isTimeout,
        killed: isTimeout
      };
    } finally {
      // Cleanup
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (stream) {
        // Use end() instead of destroy() for better compatibility
        if (typeof (stream as any).destroy === 'function') {
          (stream as any).destroy();
        } else if (typeof stream.end === 'function') {
          stream.end();
        }
      }
      if (container) {
        await this.cleanupContainer(container.id);
      }
    }
  }

  private async ensureImage(imageName: string): Promise<void> {
    try {
      await this.docker.getImage(imageName).inspect();
    } catch (error) {
      logger.info(`Pulling image: ${imageName}`);
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(imageName, (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) {
            reject(err);
            return;
          }

          this.docker.modem.followProgress(stream, (err: Error | null) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      });
    }
  }

  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)([kmg]?)$/i);
    if (!match) {
      return 268435456; // Default 256MB
    }

    const value = parseInt(match[1]);
    const unit = match[2]?.toLowerCase() || '';

    switch (unit) {
      case 'k':
        return value * 1024;
      case 'm':
        return value * 1024 * 1024;
      case 'g':
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  private async cleanupContainer(containerId: string): Promise<void> {
    try {
      const container = this.runningContainers.get(containerId);
      if (container) {
        try {
          await container.stop({ t: 5 });
        } catch (error) {
          // Container might already be stopped
        }
        
        try {
          await container.remove({ force: true });
        } catch (error) {
          logger.error(`Failed to remove container ${containerId}:`, error);
        }
        
        this.runningContainers.delete(containerId);
      }
    } catch (error) {
      logger.error(`Failed to cleanup container ${containerId}:`, error);
    }
  }

  private async cleanup(): Promise<void> {
    logger.info('Cleaning up running containers...');
    
    const cleanupPromises = Array.from(this.runningContainers.keys()).map(
      containerId => this.cleanupContainer(containerId)
    );
    
    await Promise.all(cleanupPromises);
    logger.info('Container cleanup completed');
  }

  // Health check methods
  async getDockerInfo(): Promise<any> {
    try {
      return await this.docker.info();
    } catch (error) {
      logger.error('Failed to get Docker info:', error);
      throw error;
    }
  }

  async getRunningContainers(): Promise<Docker.ContainerInfo[]> {
    try {
      return await this.docker.listContainers({ all: false });
    } catch (error) {
      logger.error('Failed to get running containers:', error);
      throw error;
    }
  }

  async getImages(): Promise<Docker.ImageInfo[]> {
    try {
      return await this.docker.listImages();
    } catch (error) {
      logger.error('Failed to get images:', error);
      throw error;
    }
  }

  async pruneContainers(): Promise<void> {
    try {
      await this.docker.pruneContainers();
      logger.info('Pruned unused containers');
    } catch (error) {
      logger.error('Failed to prune containers:', error);
    }
  }

  async pruneImages(): Promise<void> {
    try {
      await this.docker.pruneImages();
      logger.info('Pruned unused images');
    } catch (error) {
      logger.error('Failed to prune images:', error);
    }
  }
}
