/**
 * Job Status enum
 */
export enum JobStatus {
  PENDING = 'PENDING',
  RETRY = 'RETRY',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

/**
 * ImprovementJob Entity
 * Represents a job to improve test coverage for a specific file
 */
export class ImprovementJob {
  constructor(
    public readonly id: string,
    public readonly repositoryId: string,
    public readonly filePath: string,
    public readonly requestedBy: string,
    public readonly status: JobStatus,
    public readonly progress: number,
    public readonly branchName: string | null,
    public readonly prUrl: string | null,
    public readonly logs: string,
    public readonly lastLogAt: Date | null,
    public readonly coverageBefore: number | null,
    public readonly coverageAfter: number | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly attemptCount: number = 0,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.id || this.id.trim() === '') {
      throw new Error('ImprovementJob id is required');
    }
    if (!this.repositoryId || this.repositoryId.trim() === '') {
      throw new Error('ImprovementJob repositoryId is required');
    }
    if (!this.filePath || this.filePath.trim() === '') {
      throw new Error('ImprovementJob filePath is required');
    }
    if (!this.requestedBy || this.requestedBy.trim() === '') {
      throw new Error('ImprovementJob requestedBy is required');
    }
    if (!Object.values(JobStatus).includes(this.status)) {
      throw new Error('ImprovementJob status must be a valid JobStatus');
    }
    if (this.progress < 0 || this.progress > 100) {
      throw new Error('ImprovementJob progress must be between 0 and 100');
    }
    if (this.attemptCount < 0) {
      throw new Error('ImprovementJob attemptCount must be non-negative');
    }
  }

  /**
   * Creates a new ImprovementJob with PENDING status
   */
  public static create(
    id: string,
    repositoryId: string,
    filePath: string,
    requestedBy: string,
  ): ImprovementJob {
    const now = new Date();
    return new ImprovementJob(
      id,
      repositoryId,
      filePath,
      requestedBy,
      JobStatus.PENDING,
      0,
      null,
      null,
      '',
      null,
      null,
      null,
      now,
      now,
      0,
    );
  }

  /**
   * Starts the job (transitions to RUNNING status)
   */
  public start(branchName: string): ImprovementJob {
    if (this.status !== JobStatus.PENDING && this.status !== JobStatus.RETRY) {
      throw new Error('Only PENDING or RETRY jobs can be started');
    }

    const now = new Date();
    const startLog = `Job started (attempt ${this.attemptCount + 1})`;
    const newLogs = this.logs
      ? `${this.logs}\n[${now.toISOString()}] ${startLog}`
      : `[${now.toISOString()}] ${startLog}`;

    return new ImprovementJob(
      this.id,
      this.repositoryId,
      this.filePath,
      this.requestedBy,
      JobStatus.RUNNING,
      5,
      branchName,
      this.prUrl,
      newLogs,
      now,
      this.coverageBefore,
      this.coverageAfter,
      this.createdAt,
      now,
      this.attemptCount + 1,
    );
  }

  /**
   * Updates the job progress.
   */

  public updateProgress(progress: number, logMessage?: string): ImprovementJob {
    if (this.status !== JobStatus.RUNNING) {
      throw new Error('Only RUNNING jobs can have progress updated');
    }

    const now = new Date();
    const newLogs = logMessage ? `${this.logs}\n[${now.toISOString()}] ${logMessage}` : this.logs;
    const newLastLogAt = logMessage ? now : this.lastLogAt;

    return new ImprovementJob(
      this.id,
      this.repositoryId,
      this.filePath,
      this.requestedBy,
      this.status,
      progress,
      this.branchName,
      this.prUrl,
      newLogs,
      newLastLogAt,
      this.coverageBefore,
      this.coverageAfter,
      this.createdAt,
      now,
      this.attemptCount,
    );
  }

  /**
   * Marks the job as succeeded
   */
  public succeed(prUrl: string, logMessage?: string): ImprovementJob {
    if (this.status !== JobStatus.RUNNING) {
      throw new Error('Only RUNNING jobs can be marked as succeeded');
    }

    const now = new Date();
    const newLogs = logMessage ? `${this.logs}\n[${now.toISOString()}] ${logMessage}` : this.logs;

    return new ImprovementJob(
      this.id,
      this.repositoryId,
      this.filePath,
      this.requestedBy,
      JobStatus.SUCCEEDED,
      100,
      this.branchName,
      prUrl,
      newLogs,
      logMessage ? now : this.lastLogAt,
      this.coverageBefore,
      this.coverageAfter,
      this.createdAt,
      now,
      this.attemptCount,
    );
  }

  /**
   * Marks the job as failed
   */
  public fail(errorMessage: string): ImprovementJob {
    if (this.status !== JobStatus.RUNNING && this.status !== JobStatus.PENDING) {
      throw new Error('Only RUNNING or PENDING jobs can be marked as failed');
    }

    const now = new Date();
    const newLogs = `${this.logs}\n[${now.toISOString()}] ERROR: ${errorMessage}`;

    return new ImprovementJob(
      this.id,
      this.repositoryId,
      this.filePath,
      this.requestedBy,
      JobStatus.FAILED,
      this.progress,
      this.branchName,
      this.prUrl,
      newLogs,
      now,
      this.coverageBefore,
      this.coverageAfter,
      this.createdAt,
      now,
      this.attemptCount,
    );
  }

  /**
   * Marks the job for retry (increments attempt count)
   */
  public markForRetry(errorMessage: string, maxAttempts: number): ImprovementJob {
    if (this.status !== JobStatus.RUNNING) {
      throw new Error('Only RUNNING jobs can be marked for retry');
    }

    const now = new Date();
    const newAttemptCount = this.attemptCount + 1;
    const newLogs = `${this.logs}\n[${now.toISOString()}] ERROR (attempt ${newAttemptCount}/${maxAttempts}): ${errorMessage}`;

    // If we've exceeded max attempts, mark as FAILED instead
    const newStatus = newAttemptCount >= maxAttempts ? JobStatus.FAILED : JobStatus.RETRY;

    return new ImprovementJob(
      this.id,
      this.repositoryId,
      this.filePath,
      this.requestedBy,
      newStatus,
      this.progress,
      this.branchName,
      this.prUrl,
      newLogs,
      now,
      this.coverageBefore,
      this.coverageAfter,
      this.createdAt,
      now,
      newAttemptCount,
    );
  }

  /**
   * Retries a failed job (resets to PENDING status)
   */
  public retry(): ImprovementJob {
    if (this.status !== JobStatus.FAILED) {
      throw new Error('Only FAILED jobs can be retried');
    }

    const now = new Date();
    const newLogs = `${this.logs}\n[${now.toISOString()}] Job retry requested`;

    return new ImprovementJob(
      this.id,
      this.repositoryId,
      this.filePath,
      this.requestedBy,
      JobStatus.PENDING,
      0,
      null,
      null,
      newLogs,
      now,
      null,
      null,
      this.createdAt,
      now,
      this.attemptCount,
    );
  }

  /**
   * Checks if the job is in a terminal state
   */
  public isTerminal(): boolean {
    return this.status === JobStatus.SUCCEEDED || this.status === JobStatus.FAILED;
  }

  /**
   * Checks if the job is currently active
   */
  public isActive(): boolean {
    return this.status === JobStatus.PENDING || this.status === JobStatus.RUNNING;
  }

  /**
   * Checks if the job can be retried
   */
  public canRetry(maxAttempts: number): boolean {
    return this.status === JobStatus.FAILED && this.attemptCount < maxAttempts;
  }

  /**
   * Appends a log entry
   */
  public appendLog(message: string): ImprovementJob {
    const now = new Date();
    const newLogs = `${this.logs}\n[${now.toISOString()}] ${message}`;

    return new ImprovementJob(
      this.id,
      this.repositoryId,
      this.filePath,
      this.requestedBy,
      this.status,
      this.progress,
      this.branchName,
      this.prUrl,
      newLogs,
      now,
      this.coverageBefore,
      this.coverageAfter,
      this.createdAt,
      now,
      this.attemptCount,
    );
  }

  /**
   * Sets the PR URL (can be called as soon as PR is created)
   */
  public setPrUrl(prUrl: string, logMessage?: string): ImprovementJob {
    if (this.status !== JobStatus.RUNNING) {
      throw new Error('Only RUNNING jobs can have PR URL set');
    }

    const now = new Date();
    const newLogs = logMessage ? `${this.logs}\n[${now.toISOString()}] ${logMessage}` : this.logs;

    return new ImprovementJob(
      this.id,
      this.repositoryId,
      this.filePath,
      this.requestedBy,
      this.status,
      this.progress,
      this.branchName,
      prUrl,
      newLogs,
      logMessage ? now : this.lastLogAt,
      this.coverageBefore,
      this.coverageAfter,
      this.createdAt,
      now,
      this.attemptCount,
    );
  }

  /**
   * Sets coverage metrics
   */
  public setCoverage(
    coverageBefore: number,
    coverageAfter: number,
    logMessage?: string,
  ): ImprovementJob {
    if (this.status !== JobStatus.RUNNING) {
      throw new Error('Only RUNNING jobs can have coverage set');
    }

    const now = new Date();
    const newLogs = logMessage ? `${this.logs}\n[${now.toISOString()}] ${logMessage}` : this.logs;

    return new ImprovementJob(
      this.id,
      this.repositoryId,
      this.filePath,
      this.requestedBy,
      this.status,
      this.progress,
      this.branchName,
      this.prUrl,
      newLogs,
      logMessage ? now : this.lastLogAt,
      coverageBefore,
      coverageAfter,
      this.createdAt,
      now,
      this.attemptCount,
    );
  }
}
