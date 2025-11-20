import { ImprovementJob } from '../../domain/entities/ImprovementJob';

/**
 * Repository interface for ImprovementJob entity persistence operations.
 */

export interface IImprovementJobRepo {
  /**
   * Creates a new improvement job.
   */

  createJob(job: ImprovementJob): Promise<void>;

  /**
   * Updates an existing improvement job.
   */

  updateJob(job: ImprovementJob): Promise<void>;

  /**
   * Gets an improvement job by ID.
   */

  getJob(id: string): Promise<ImprovementJob | null>;

  /**
   * Fetches all pending jobs.
   */

  fetchPendingJobs(): Promise<ImprovementJob[]>;

  /**
   * Fetches jobs that are ready to be executed (PENDING or RETRY).
   * Ordered by creation date (oldest first).
   */

  fetchExecutableJobs(): Promise<ImprovementJob[]>;

  /**
   * Attempts to acquire a lock for a job by atomically setting its status to RUNNING.
   * This ensures per-repo serialization by checking no other job is RUNNING for the same repo.
   * @returns true if lock was acquired, false otherwise.
   */

  tryAcquireLock(jobId: string, branchName: string): Promise<boolean>;
}
