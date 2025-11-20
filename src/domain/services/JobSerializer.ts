import { ImprovementJob } from '../entities/ImprovementJob';

/**
 * Lock Token
 * Represents a lock acquired for a repository
 */
export class LockToken {
  constructor(
    public readonly repositoryId: string,
    public readonly jobId: string,
    public readonly acquiredAt: Date,
  ) {}
}

/**
 * JobSerializer
 * Domain service that ensures only one active job runs per repository at a time.
 * Implements serialization logic without infrastructure dependencies.
 */
export class JobSerializer {
  private locks: Map<string, LockToken> = new Map();

  /**
   * Attempts to acquire a lock for a repository
   * Returns a LockToken if successful, throws error if lock cannot be acquired
   */
  public acquireLock(repositoryId: string, jobId: string): LockToken {
    if (!repositoryId || repositoryId.trim() === '') {
      throw new Error('Repository ID is required to acquire lock');
    }
    if (!jobId || jobId.trim() === '') {
      throw new Error('Job ID is required to acquire lock');
    }

    const existingLock = this.locks.get(repositoryId);

    if (existingLock) {
      throw new Error(
        `Repository ${repositoryId} is locked by job ${existingLock.jobId}. Cannot start job ${jobId}.`,
      );
    }

    const token = new LockToken(repositoryId, jobId, new Date());
    this.locks.set(repositoryId, token);

    return token;
  }

  /**
   * Releases a lock for a repository
   * Returns true if lock was released, false if no lock existed
   */
  public releaseLock(repositoryId: string, jobId: string): boolean {
    if (!repositoryId || repositoryId.trim() === '') {
      throw new Error('Repository ID is required to release lock');
    }

    const existingLock = this.locks.get(repositoryId);

    if (!existingLock) {
      return false;
    }

    // Only allow the job that acquired the lock to release it
    if (existingLock.jobId !== jobId) {
      throw new Error(
        `Cannot release lock for repository ${repositoryId}: lock is held by job ${existingLock.jobId}, not ${jobId}`,
      );
    }

    this.locks.delete(repositoryId);
    return true;
  }

  /**
   * Checks if a repository is currently locked
   */
  public isLocked(repositoryId: string): boolean {
    return this.locks.has(repositoryId);
  }

  /**
   * Gets the current lock token for a repository
   * Returns null if no lock exists
   */
  public getLock(repositoryId: string): LockToken | null {
    return this.locks.get(repositoryId) || null;
  }

  /**
   * Validates if a job can acquire a lock for its repository
   * Useful for pre-checking before attempting to start a job
   */
  public canAcquireLock(job: ImprovementJob): boolean {
    return !this.isLocked(job.repositoryId);
  }

  /**
   * Gets all currently locked repositories
   */
  public getLockedRepositories(): string[] {
    return Array.from(this.locks.keys());
  }

  /**
   * Gets all active locks
   */
  public getAllLocks(): LockToken[] {
    return Array.from(this.locks.values());
  }

  /**
   * Forces release of a lock (use with caution, typically for cleanup)
   */
  public forceReleaseLock(repositoryId: string): boolean {
    if (!repositoryId || repositoryId.trim() === '') {
      throw new Error('Repository ID is required to force release lock');
    }

    return this.locks.delete(repositoryId);
  }

  /**
   * Releases all locks (typically used for cleanup or testing)
   */
  public releaseAllLocks(): void {
    this.locks.clear();
  }

  /**
   * Gets the number of active locks
   */
  public getActiveLockCount(): number {
    return this.locks.size;
  }

  /**
   * Checks if any locks are currently active
   */
  public hasActiveLocks(): boolean {
    return this.locks.size > 0;
  }

  /**
   * Gets lock information for a repository (if locked)
   */
  public getLockInfo(repositoryId: string): {
    isLocked: boolean;
    jobId?: string;
    acquiredAt?: Date;
    duration?: number;
  } {
    const lock = this.locks.get(repositoryId);

    if (!lock) {
      return { isLocked: false };
    }

    const duration = Date.now() - lock.acquiredAt.getTime();

    return {
      isLocked: true,
      jobId: lock.jobId,
      acquiredAt: lock.acquiredAt,
      duration,
    };
  }
}
