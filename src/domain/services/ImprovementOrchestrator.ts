import { FileCoverage } from '../entities/FileCoverage';
import { ImprovementJob, JobStatus } from '../entities/ImprovementJob';
import { AiRunResult } from '../value-objects/AiRunResult';

/**
 * ImprovementOrchestrator
 * Domain service responsible for orchestrating the improvement process.
 * Contains the business logic for coordinating improvement jobs but delegates
 * actual infrastructure operations to adapters (injected via methods).
 */
export class ImprovementOrchestrator {
  /**
   * Creates a new improvement job for a given file
   */
  public createImprovementJob(
    jobId: string,
    fileCoverage: FileCoverage,
    requestedBy: string,
    threshold: number,
  ): ImprovementJob {
    if (!fileCoverage.isBelowThreshold(threshold)) {
      throw new Error(
        `File ${fileCoverage.filePath} is already above threshold (${fileCoverage.coveragePercent}% >= ${threshold}%)`,
      );
    }

    return ImprovementJob.create(
      jobId,
      fileCoverage.repositoryId,
      fileCoverage.filePath,
      requestedBy,
    );
  }

  /**
   * Validates if a job can be started
   */
  public canStartJob(job: ImprovementJob): boolean {
    return job.status === JobStatus.PENDING;
  }

  /**
   * Determines the branch name for a job
   */
  public determineBranchName(job: ImprovementJob): string {
    // Create a safe branch name from the file path
    const sanitizedPath = job.filePath
      .replace(/[^a-zA-Z0-9-_/]/g, '-')
      .replace(/^\/+|\/+$/g, '')
      .replace(/\/+/g, '-');

    const timestamp = Date.now();
    return `coverage-improvement/${sanitizedPath}-${timestamp}`;
  }

  /**
   * Starts a job with proper initialization
   */
  public startJob(job: ImprovementJob, branchName: string): ImprovementJob {
    if (!this.canStartJob(job)) {
      throw new Error(`Job ${job.id} cannot be started from status ${job.status}`);
    }

    return job
      .start(branchName)
      .appendLog(`Starting improvement for ${job.filePath}`)
      .appendLog(`Branch created: ${branchName}`);
  }

  /**
   * Updates job progress with appropriate logging
   */
  public updateJobProgress(job: ImprovementJob, progress: number, message: string): ImprovementJob {
    if (job.status !== JobStatus.RUNNING) {
      throw new Error(`Job ${job.id} is not running`);
    }

    return job.updateProgress(progress, message);
  }

  /**
   * Processes the AI run result and determines next steps
   */
  public processAiRunResult(
    job: ImprovementJob,
    result: AiRunResult,
  ): { updatedJob: ImprovementJob; shouldContinue: boolean } {
    if (result.isFailed()) {
      return {
        updatedJob: job.fail(result.error!),
        shouldContinue: false,
      };
    }

    if (!result.hasChanges()) {
      return {
        updatedJob: job.fail('AI did not generate any test files'),
        shouldContinue: false,
      };
    }

    const message = `AI generated changes: ${result.getSummary()}`;
    return {
      updatedJob: job.updateProgress(75, message),
      shouldContinue: true,
    };
  }

  /**
   * Completes a job successfully
   */
  public completeJob(job: ImprovementJob, prUrl: string): ImprovementJob {
    if (job.status !== JobStatus.RUNNING) {
      throw new Error(`Job ${job.id} is not running`);
    }

    return job.succeed(prUrl, `Pull request created successfully: ${prUrl}`);
  }

  /**
   * Handles job failure with appropriate error handling
   */
  public handleJobFailure(job: ImprovementJob, error: Error | string): ImprovementJob {
    const errorMessage = error instanceof Error ? error.message : error;
    return job.fail(errorMessage);
  }

  /**
   * Determines if a failed job should be retried
   */
  public shouldRetryJob(job: ImprovementJob, maxAttempts: number): boolean {
    return job.canRetry(maxAttempts);
  }

  /**
   * Retries a failed job
   */
  public retryJob(job: ImprovementJob, maxAttempts: number): ImprovementJob {
    if (!this.shouldRetryJob(job, maxAttempts)) {
      throw new Error(
        `Job ${job.id} cannot be retried (status: ${job.status}, attempts: ${job.attemptCount}, max: ${maxAttempts})`,
      );
    }

    return job.retry();
  }

  /**
   * Generates a commit message for the improvement
   */
  public generateCommitMessage(job: ImprovementJob, result: AiRunResult): string {
    const baseMessage = `chore: improve test coverage for ${job.filePath}`;

    const details: string[] = [];
    if (result.filesCreated.length > 0) {
      details.push(`Created ${result.filesCreated.length} test file(s)`);
    }
    if (result.filesModified.length > 0) {
      details.push(`Modified ${result.filesModified.length} file(s)`);
    }

    if (details.length > 0) {
      return `${baseMessage}\n\n${details.join('\n')}`;
    }

    return baseMessage;
  }

  /**
   * Generates a pull request title
   */
  public generatePrTitle(job: ImprovementJob): string {
    return `[Coverage] Improve test coverage for ${job.filePath}`;
  }

  /**
   * Generates a pull request description
   */
  public generatePrDescription(
    job: ImprovementJob,
    result: AiRunResult,
    currentCoverage: number,
  ): string {
    const lines: string[] = [
      '## Test Coverage Improvement',
      '',
      `This PR improves test coverage for \`${job.filePath}\`.`,
      '',
      '### Changes',
      `- Current coverage: ${currentCoverage.toFixed(2)}%`,
      `- Files created: ${result.filesCreated.length}`,
      `- Files modified: ${result.filesModified.length}`,
      '',
    ];

    if (result.filesCreated.length > 0) {
      lines.push('### Created Files');
      result.filesCreated.forEach(file => {
        lines.push(`- \`${file}\``);
      });
      lines.push('');
    }

    if (result.filesModified.length > 0) {
      lines.push('### Modified Files');
      result.filesModified.forEach(file => {
        lines.push(`- \`${file}\``);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('*This PR was automatically generated by the Coverage Improvement System*');

    return lines.join('\n');
  }

  /**
   * Validates if a job belongs to a specific repository
   */
  public validateJobRepository(job: ImprovementJob, repositoryId: string): boolean {
    return job.repositoryId === repositoryId;
  }
}
