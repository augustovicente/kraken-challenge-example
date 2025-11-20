import { AiRunResult } from '../../domain/value-objects/AiRunResult';

export interface GenerateTestsParams {
  targetFilePath: string;
  repoPath: string;
  contextFiles: string[];
  aiCliCommand: string;
  timeout?: number;
}

export interface AiRunnerConfig {
  useDocker: boolean;
  dockerImage: string;
  timeoutMs: number;
  memoryLimitMb: number;
  networkIsolation: boolean;
}

export interface IAiCliAdapter {
  /**
   * Generate tests for a target file using AI CLI.
   * @param params Parameters for test generation.
   * @returns Result of the AI run including generated files and metrics.
   */

  generateTests(params: GenerateTestsParams): Promise<AiRunResult>;

  /**
   * Get current AI runner configuration.
   */

  getConfig(): AiRunnerConfig;

  /**
   * Update AI runner configuration.
   * @param config Partial configuration to update.
   */

  updateConfig(config: Partial<AiRunnerConfig>): void;
}
