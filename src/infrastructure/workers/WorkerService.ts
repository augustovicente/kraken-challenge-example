import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';

import { IImprovementJobRepo } from '../../domain/repositories/IImprovementJobRepo';

import { JobExecutor } from './JobExecutor';

/**
 * WorkerService
 * Polls the improvement_job table and executes pending jobs.
 */

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private intervalHandle?: NodeJS.Timeout;
  private isProcessing = false;
  // 5 seconds.
  private readonly POLL_INTERVAL_MS = 5000;

  constructor(
    @Inject('IImprovementJobRepo')
    private readonly jobRepo: IImprovementJobRepo,
    private readonly jobExecutor: JobExecutor,
  ) {}

  onModuleInit() {
    this.logger.log('Worker service starting...');
    this.startPolling();
  }

  onModuleDestroy() {
    this.logger.log('Worker service stopping...');
    this.stopPolling();
  }

  /**
   * Start the polling loop.
   */

  private startPolling(): void {
    this.intervalHandle = setInterval(async () => {
      await this.poll();
    }, this.POLL_INTERVAL_MS);

    this.logger.log(`Polling started (every ${this.POLL_INTERVAL_MS}ms)`);
  }

  /**
   * Stop the polling loop.
   */

  private stopPolling(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
      this.logger.log('Polling stopped');
    }
  }

  /**
   * Poll for jobs and execute them.
   */

  private async poll(): Promise<void> {
    // Skip if already processing.
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Fetch executable jobs (PENDING or RETRY status).
      const jobs = await this.jobRepo.fetchExecutableJobs();

      if (jobs.length === 0) {
        return;
      }

      this.logger.log(`Found ${jobs.length} executable job(s)`);

      // Try to acquire lock and execute each job
      for (const job of jobs) {
        try {
          // Generate unique branch name
          const timestamp = Date.now();
          const fileSlug = job.filePath
            .replace(/[^a-zA-Z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase();
          const branchName = `improve/${fileSlug}-${timestamp}`;
          const lockAcquired = await this.jobRepo.tryAcquireLock(job.id, branchName);

          if (lockAcquired) {
            this.logger.log(`Lock acquired for job ${job.id}, starting execution`);

            // Execute job asynchronously so the worker can continue processing other jobs.
            this.jobExecutor.executeJob(job).catch(error => {
              this.logger.error(`Failed to execute job ${job.id}: ${error.message}`, error.stack);
            });
          } else {
            this.logger.debug(
              `Could not acquire lock for job ${job.id} (repo may have running job)`,
            );
          }
        } catch (error) {
          this.logger.error(`Error processing job ${job.id}: ${error.message}`, error.stack);
        }
      }
    } catch (error) {
      this.logger.error(`Polling error: ${error.message}`, error.stack);
    } finally {
      this.isProcessing = false;
    }
  }
}
