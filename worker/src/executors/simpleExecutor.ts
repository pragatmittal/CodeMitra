import { DockerExecutor } from './dockerExecutor';
import { ExecutionRequest, ExecutionResult } from '../types';

/**
 * Simple executor that uses relative imports instead of aliases
 * This is a fallback executor to avoid module resolution issues
 */
export class SimpleExecutor {
  private dockerExecutor: DockerExecutor;

  constructor() {
    this.dockerExecutor = new DockerExecutor();
  }

  async executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
    try {
      return await this.dockerExecutor.executeCode(request);
    } catch (error) {
      console.error('Execution failed:', error);
      return {
        executionId: request.executionId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0
      };
    }
  }

  async getDockerInfo() {
    return await this.dockerExecutor.getDockerInfo();
  }

  async pruneContainers() {
    await this.dockerExecutor.pruneContainers();
  }

  async pruneImages() {
    await this.dockerExecutor.pruneImages();
  }

  async getRunningContainers() {
    return await this.dockerExecutor.getRunningContainers();
  }

  async getImages() {
    return await this.dockerExecutor.getImages();
  }
}
