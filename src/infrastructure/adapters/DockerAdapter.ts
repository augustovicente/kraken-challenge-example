import { exec } from 'child_process';
import { promisify } from 'util';

import { Injectable } from '@nestjs/common';

import { SecureLogger } from '../utils/logger';

const execAsync = promisify(exec);

export interface DockerRunOptions {
  image: string;
  command: string;
  workDir: string;
  mountDir?: string;
  env?: Record<string, string>;
  memoryLimit?: string;
  cpuLimit?: string;
  networkMode?: string;
  timeout?: number;
  removeContainer?: boolean;
}

export interface DockerRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Adapter for running commands in isolated Docker containers
 * Provides sandboxing for AI CLI and other external tools
 */
@Injectable()
export class DockerAdapter {
  private readonly logger = new SecureLogger(DockerAdapter.name);

  /**
   * Check if Docker is available
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('docker --version');
      this.logger.debug(`Docker available: ${stdout.trim()}`);
      return true;
    } catch (error) {
      this.logger.warn('Docker is not available on this system. Error:', error.message);
      return false;
    }
  }

  /**
   * Run a command in an isolated Docker container
   * @param options Docker run configuration
   * @returns Command output and exit code
   */
  async run(options: DockerRunOptions): Promise<DockerRunResult> {
    const {
      image,
      command,
      workDir,
      mountDir,
      env = {},
      memoryLimit = '1g',
      cpuLimit = '1.0',
      networkMode = 'bridge',
      timeout = 600,
    } = options;

    this.logger.log(`Running command in Docker container: ${image}`);
    this.logger.debug(`Work directory: ${workDir}`);
    this.logger.debug(`Memory limit: ${memoryLimit}, CPU limit: ${cpuLimit}`);

    // Build Docker command
    const dockerArgs: string[] = [
      'run',
      '--rm', // Remove container after execution (if removeContainer is true)
      `--memory=${memoryLimit}`,
      `--cpus=${cpuLimit}`,
      `--network=${networkMode}`,
      '--read-only', // Make container filesystem read-only
      '--tmpfs=/tmp:rw,noexec,nosuid,size=100m', // Temporary directory
    ];

    // Add volume mount if specified
    if (mountDir) {
      dockerArgs.push(`--volume=${mountDir}:${workDir}:rw`);
    }

    // Add working directory
    dockerArgs.push(`--workdir=${workDir}`);

    // Add environment variables (excluding sensitive ones from logs)
    for (const [key, value] of Object.entries(env)) {
      dockerArgs.push(`--env=${key}=${value}`);
    }

    // Add security options
    dockerArgs.push(
      '--security-opt=no-new-privileges', // Prevent privilege escalation
      '--cap-drop=ALL', // Drop all capabilities
      '--cap-add=CHOWN', // Add only necessary capabilities
      '--cap-add=SETUID',
      '--cap-add=SETGID',
    );

    // Add image and command
    dockerArgs.push(image);
    dockerArgs.push('sh', '-c', command);

    const dockerCommand = `docker ${dockerArgs.join(' ')}`;

    // Log safe version of command (without sensitive env vars)
    this.logger.debug(`Executing Docker command with timeout: ${timeout}s`);

    try {
      // Execute with timeout
      const { stdout, stderr } = await this.executeWithTimeout(dockerCommand, timeout * 1000);

      this.logger.log('Docker command completed successfully');
      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      };
    } catch (error) {
      this.logger.error('Docker command failed', error.message);

      // Handle timeout
      if (error.killed && error.signal === 'SIGTERM') {
        throw new Error(`Docker command timed out after ${timeout} seconds`);
      }

      // Extract exit code if available
      const exitCode = error.code || 1;
      return {
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || error.message,
        exitCode,
      };
    }
  }

  /**
   * Execute command with timeout
   */
  private async executeWithTimeout(
    command: string,
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const childProcess = exec(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set timeout
      const timer = setTimeout(() => {
        timedOut = true;
        childProcess.kill('SIGTERM');

        // Force kill after 5 seconds
        setTimeout(() => {
          if (childProcess.exitCode === null) {
            childProcess.kill('SIGKILL');
          }
        }, 5000);
      }, timeoutMs);

      // Collect stdout
      childProcess.stdout?.on('data', data => {
        stdout += data;
      });

      // Collect stderr
      childProcess.stderr?.on('data', data => {
        stderr += data;
      });

      // Handle completion
      childProcess.on('close', code => {
        clearTimeout(timer);

        if (timedOut) {
          reject(
            Object.assign(new Error('Command timed out'), {
              killed: true,
              signal: 'SIGTERM',
              stdout,
              stderr,
            }),
          );
        } else if (code !== 0) {
          reject(
            Object.assign(new Error(`Command exited with code ${code}`), {
              code,
              stdout,
              stderr,
            }),
          );
        } else {
          resolve({ stdout, stderr });
        }
      });

      // Handle errors
      childProcess.on('error', error => {
        clearTimeout(timer);
        reject(
          Object.assign(error, {
            stdout,
            stderr,
          }),
        );
      });
    });
  }

  /**
   * Pull a Docker image
   */
  async pullImage(image: string): Promise<void> {
    this.logger.log(`Pulling Docker image: ${image}`);

    try {
      const { stdout } = await execAsync(`docker pull ${image}`);
      this.logger.debug(stdout.trim());
      this.logger.log(`Image pulled successfully: ${image}`);
    } catch (error) {
      this.logger.error(`Failed to pull Docker image: ${image}`, error.message);
      throw new Error(`Failed to pull Docker image ${image}: ${error.message}`);
    }
  }

  /**
   * Check if a Docker image exists locally
   */
  async imageExists(image: string): Promise<boolean> {
    try {
      await execAsync(`docker image inspect ${image}`);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Ensure Docker image is available (pull if not exists)
   */
  async ensureImage(image: string): Promise<void> {
    const exists = await this.imageExists(image);
    if (!exists) {
      this.logger.log(`Docker image not found locally, pulling: ${image}`);
      await this.pullImage(image);
    } else {
      this.logger.debug(`Docker image already available: ${image}`);
    }
  }
}
