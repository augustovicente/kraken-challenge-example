import { spawn } from 'child_process';

import { Injectable } from '@nestjs/common';

import {
  IAiCliAdapter,
  GenerateTestsParams,
  AiRunnerConfig,
} from '../../application/ports/IAiCliAdapter';
import { AiRunResult } from '../../domain/value-objects/AiRunResult';
import { SecureLogger } from '../utils/logger';

import { DockerAdapter } from './DockerAdapter';

@Injectable()
export class AiCliAdapter implements IAiCliAdapter {
  private readonly logger = new SecureLogger(AiCliAdapter.name);
  private config: AiRunnerConfig;

  constructor(private readonly dockerAdapter: DockerAdapter) {
    // Initialize configuration from environment variables with defaults
    this.config = {
      // Default to true.
      useDocker: process.env.USE_DOCKER_ISOLATION !== 'false',
      dockerImage: process.env.DOCKER_AI_IMAGE || 'node:18-alpine',
      // Convert seconds to ms.
      timeoutMs: parseInt(process.env.DOCKER_TIMEOUT || '600', 10) * 1000,
      memoryLimitMb: this.parseMemoryLimit(process.env.DOCKER_MEMORY_LIMIT || '1g'),
      // True if 'none'.
      networkIsolation: process.env.DOCKER_NETWORK_MODE === 'none',
    };

    this.logger.log('AI CLI Adapter initialized with Docker isolation');
    this.logger.debug(`Docker enabled: ${this.config.useDocker}`);
  }

  /**
   * Parse memory limit from string (e.g., '1g', '512m') to MB.
   */

  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)([mg])$/i);
    // Default 1GB.
    if (!match) return 1024;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    return unit === 'g' ? value * 1024 : value;
  }

  getConfig(): AiRunnerConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<AiRunnerConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.log('AI CLI configuration updated');
  }

  async generateTests(params: GenerateTestsParams): Promise<AiRunResult> {
    const {
      targetFilePath,
      repoPath,
      contextFiles,
      aiCliCommand,
      timeout = this.config.timeoutMs,
    } = params;

    this.logger.log(`Generating tests for ${targetFilePath}`);

    const startTime = Date.now();

    try {
      let result: { exitCode: number; stdout: string; stderr: string };

      if (this.config.useDocker) {
        // Ensure Docker is available.
        const dockerAvailable = await this.dockerAdapter.isDockerAvailable();

        if (!dockerAvailable) {
          this.logger.warn('Docker not available, falling back to local execution');
          result = await this.executeLocal(
            repoPath,
            targetFilePath,
            contextFiles,
            aiCliCommand,
            timeout,
          );
        } else {
          // Ensure Docker image is available.
          await this.dockerAdapter.ensureImage(this.config.dockerImage);

          // Execute in Docker.
          result = await this.executeInDocker(
            repoPath,
            targetFilePath,
            contextFiles,
            aiCliCommand,
            timeout,
          );
        }
      } else {
        // Use local execution.
        this.logger.warn('Docker isolation is disabled - running AI CLI locally');
        result = await this.executeLocal(
          repoPath,
          targetFilePath,
          contextFiles,
          aiCliCommand,
          timeout,
        );
      }

      const durationMs = Date.now() - startTime;

      // Parse the result to create AiRunResult
      const generatedFiles = this.parseGeneratedFiles(result.stdout);

      let aiRunResult: AiRunResult;

      if (result.exitCode === 0) {
        this.logger.log(`Test generation completed successfully in ${durationMs}ms`);
        aiRunResult = AiRunResult.success(generatedFiles, []);
      } else {
        this.logger.error(`Test generation failed with exit code ${result.exitCode}`);
        aiRunResult = AiRunResult.failure(result.stderr || 'Unknown error');
      }

      return aiRunResult;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.logger.error(`Test generation error after ${durationMs}ms`);

      return AiRunResult.failure(error.message);
    }
  }

  /**
   * Execute AI CLI in Docker container.
   */

  private async executeInDocker(
    repoPath: string,
    targetFilePath: string,
    contextFiles: string[],
    aiCliCommand: string,
    timeoutMs: number,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    this.logger.log('Executing AI CLI in Docker container');

    // Build command with file arguments
    const command = this.buildCliCommand(aiCliCommand, targetFilePath, contextFiles);

    // Prepare environment variables (without sensitive data logging)
    const env: Record<string, string> = {};
    if (process.env.AI_CLI_KEY) {
      env.AI_CLI_KEY = process.env.AI_CLI_KEY;
    }

    // Get network mode from config
    const networkMode = this.config.networkIsolation
      ? 'none'
      : process.env.DOCKER_NETWORK_MODE || 'bridge';
    const cpuLimit = process.env.DOCKER_CPU_LIMIT || '1.0';

    const dockerResult = await this.dockerAdapter.run({
      image: this.config.dockerImage,
      command,
      workDir: '/workspace',
      mountDir: repoPath,
      env,
      memoryLimit: `${this.config.memoryLimitMb}m`,
      cpuLimit,
      networkMode,
      // Convert to seconds.
      timeout: timeoutMs / 1000,
      removeContainer: true,
    });

    return {
      exitCode: dockerResult.exitCode,
      stdout: dockerResult.stdout,
      stderr: dockerResult.stderr,
    };
  }

  /**
   * Execute AI CLI locally (without Docker)
   */
  private async executeLocal(
    repoPath: string,
    targetFilePath: string,
    contextFiles: string[],
    aiCliCommand: string,
    timeoutMs: number,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    this.logger.warn('Executing AI CLI locally without Docker isolation');

    const command = this.buildCliCommand(aiCliCommand, targetFilePath, contextFiles);

    // Parse command into executable and args
    const parts = command.split(' ');
    const executable = parts[0];
    const args = parts.slice(1);

    return this.executeCommand(executable, args, repoPath, timeoutMs);
  }

  /**
   * Build CLI command with arguments
   */

  private buildCliCommand(
    baseCommand: string,
    targetFilePath: string,
    contextFiles: string[],
  ): string {
    let command = baseCommand;

    // Replace placeholders.
    command = command.replace('{FILE}', targetFilePath);
    command = command.replace('{TARGET}', targetFilePath);

    // Add context files if provided and not already in command.
    if (contextFiles && contextFiles.length > 0 && !command.includes('--context')) {
      command += ` --context ${contextFiles.join(' ')}`;
    }

    return command;
  }

  /**
   * Execute command with timeout and streaming output capture
   */

  private executeCommand(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number,
  ): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    output: string | null;
  }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(command, args, {
        cwd,
        env: process.env,
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');

        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }, timeoutMs);

      // Capture stdout
      child.stdout?.on('data', data => {
        const chunk = data.toString();
        stdout += chunk;
        this.logger.debug(`[AI CLI stdout]: ${chunk}`);
      });

      // Capture stderr
      child.stderr?.on('data', data => {
        const chunk = data.toString();
        stderr += chunk;
        this.logger.debug(`[AI CLI stderr]: ${chunk}`);
      });

      // Handle completion
      child.on('close', code => {
        clearTimeout(timeoutId);

        if (timedOut) {
          reject(new Error(`AI CLI command timed out after ${timeoutMs}ms`));
          return;
        }

        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
          output: code === 0 ? stdout : null,
        });
      });

      // Handle errors
      child.on('error', error => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Parse generated files from stdout
   * This assumes the AI CLI outputs generated file paths
   */
  private parseGeneratedFiles(stdout: string): string[] {
    const files: string[] = [];

    // Look for common patterns in output
    // Example: "Generated: tests/foo.test.ts"
    const generatedPattern = /(?:Generated|Created|Written):\s*(.+)/gi;
    let match;

    while ((match = generatedPattern.exec(stdout)) !== null) {
      if (match[1]) {
        files.push(match[1].trim());
      }
    }

    // Also look for file paths in quotes
    const filePathPattern = /['"]([^'"]+\.test\.[^'"]+)['"]/g;
    while ((match = filePathPattern.exec(stdout)) !== null) {
      if (match[1] && !files.includes(match[1])) {
        files.push(match[1]);
      }
    }

    return files;
  }
}
