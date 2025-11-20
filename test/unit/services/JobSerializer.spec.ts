import { ImprovementJob } from '../../../src/domain/entities/ImprovementJob';
import { JobSerializer, LockToken } from '../../../src/domain/services/JobSerializer';

describe('JobSerializer', () => {
  let serializer: JobSerializer;

  beforeEach(() => {
    serializer = new JobSerializer();
  });

  describe('acquireLock', () => {
    it('should acquire lock successfully', () => {
      const token = serializer.acquireLock('repo1', 'job1');

      expect(token).toBeDefined();
      expect(token.repositoryId).toBe('repo1');
      expect(token.jobId).toBe('job1');
      expect(token.acquiredAt).toBeInstanceOf(Date);
    });

    it('should throw error when repository is already locked', () => {
      serializer.acquireLock('repo1', 'job1');

      expect(() => serializer.acquireLock('repo1', 'job2')).toThrow(
        'Repository repo1 is locked by job job1. Cannot start job job2.',
      );
    });

    it('should allow locking different repositories', () => {
      const token1 = serializer.acquireLock('repo1', 'job1');
      const token2 = serializer.acquireLock('repo2', 'job2');

      expect(token1.repositoryId).toBe('repo1');
      expect(token2.repositoryId).toBe('repo2');
    });

    it('should throw error for empty repository ID', () => {
      expect(() => serializer.acquireLock('', 'job1')).toThrow(
        'Repository ID is required to acquire lock',
      );
      expect(() => serializer.acquireLock('   ', 'job1')).toThrow(
        'Repository ID is required to acquire lock',
      );
    });

    it('should throw error for empty job ID', () => {
      expect(() => serializer.acquireLock('repo1', '')).toThrow(
        'Job ID is required to acquire lock',
      );
      expect(() => serializer.acquireLock('repo1', '   ')).toThrow(
        'Job ID is required to acquire lock',
      );
    });
  });

  describe('releaseLock', () => {
    it('should release lock successfully', () => {
      serializer.acquireLock('repo1', 'job1');

      const result = serializer.releaseLock('repo1', 'job1');

      expect(result).toBe(true);
      expect(serializer.isLocked('repo1')).toBe(false);
    });

    it('should return false when no lock exists', () => {
      const result = serializer.releaseLock('repo1', 'job1');

      expect(result).toBe(false);
    });

    it('should throw error when trying to release lock held by different job', () => {
      serializer.acquireLock('repo1', 'job1');

      expect(() => serializer.releaseLock('repo1', 'job2')).toThrow(
        'Cannot release lock for repository repo1: lock is held by job job1, not job2',
      );
    });

    it('should throw error for empty repository ID', () => {
      expect(() => serializer.releaseLock('', 'job1')).toThrow(
        'Repository ID is required to release lock',
      );
    });

    it('should allow acquiring lock after release', () => {
      serializer.acquireLock('repo1', 'job1');
      serializer.releaseLock('repo1', 'job1');

      const token = serializer.acquireLock('repo1', 'job2');

      expect(token.jobId).toBe('job2');
    });
  });

  describe('isLocked', () => {
    it('should return false when repository is not locked', () => {
      const result = serializer.isLocked('repo1');

      expect(result).toBe(false);
    });

    it('should return true when repository is locked', () => {
      serializer.acquireLock('repo1', 'job1');

      const result = serializer.isLocked('repo1');

      expect(result).toBe(true);
    });

    it('should return false after lock is released', () => {
      serializer.acquireLock('repo1', 'job1');
      serializer.releaseLock('repo1', 'job1');

      const result = serializer.isLocked('repo1');

      expect(result).toBe(false);
    });
  });

  describe('getLock', () => {
    it('should return null when no lock exists', () => {
      const result = serializer.getLock('repo1');

      expect(result).toBeNull();
    });

    it('should return lock token when lock exists', () => {
      const originalToken = serializer.acquireLock('repo1', 'job1');

      const result = serializer.getLock('repo1');

      expect(result).toBeDefined();
      expect(result?.repositoryId).toBe('repo1');
      expect(result?.jobId).toBe('job1');
      expect(result?.acquiredAt).toEqual(originalToken.acquiredAt);
    });
  });

  describe('canAcquireLock', () => {
    it('should return true when repository is not locked', () => {
      const job = ImprovementJob.create('job1', 'repo1', 'file.ts', 'user@example.com');

      const result = serializer.canAcquireLock(job);

      expect(result).toBe(true);
    });

    it('should return false when repository is locked', () => {
      serializer.acquireLock('repo1', 'job1');

      const job = ImprovementJob.create('job2', 'repo1', 'file.ts', 'user@example.com');

      const result = serializer.canAcquireLock(job);

      expect(result).toBe(false);
    });
  });

  describe('getLockedRepositories', () => {
    it('should return empty array when no locks exist', () => {
      const result = serializer.getLockedRepositories();

      expect(result).toHaveLength(0);
    });

    it('should return all locked repositories', () => {
      serializer.acquireLock('repo1', 'job1');
      serializer.acquireLock('repo2', 'job2');
      serializer.acquireLock('repo3', 'job3');

      const result = serializer.getLockedRepositories();

      expect(result).toHaveLength(3);
      expect(result).toContain('repo1');
      expect(result).toContain('repo2');
      expect(result).toContain('repo3');
    });

    it('should not include released repositories', () => {
      serializer.acquireLock('repo1', 'job1');
      serializer.acquireLock('repo2', 'job2');
      serializer.releaseLock('repo1', 'job1');

      const result = serializer.getLockedRepositories();

      expect(result).toHaveLength(1);
      expect(result).toContain('repo2');
      expect(result).not.toContain('repo1');
    });
  });

  describe('releaseAllLocks', () => {
    it('should clear all locks', () => {
      serializer.acquireLock('repo1', 'job1');
      serializer.acquireLock('repo2', 'job2');

      serializer.releaseAllLocks();

      expect(serializer.isLocked('repo1')).toBe(false);
      expect(serializer.isLocked('repo2')).toBe(false);
      expect(serializer.getLockedRepositories()).toHaveLength(0);
    });

    it('should allow acquiring locks after clearing', () => {
      serializer.acquireLock('repo1', 'job1');
      serializer.releaseAllLocks();

      const token = serializer.acquireLock('repo1', 'job2');

      expect(token.jobId).toBe('job2');
    });
  });

  describe('LockToken', () => {
    it('should create lock token with correct properties', () => {
      const now = new Date();
      const token = new LockToken('repo1', 'job1', now);

      expect(token.repositoryId).toBe('repo1');
      expect(token.jobId).toBe('job1');
      expect(token.acquiredAt).toBe(now);
    });
  });
});
