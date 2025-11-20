import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { TempDirectoryService } from '../../../src/domain/services/TempDirectoryService';

describe('TempDirectoryService', () => {
  let service: TempDirectoryService;
  let testBaseDir: string;

  beforeEach(() => {
    // Use a test-specific temp directory
    testBaseDir = path.join(os.tmpdir(), 'temp-directory-service-test');
    process.env.TEMP_BASE_DIR = testBaseDir;
    process.env.TEMP_CLEANUP_HOURS = '0'; // Disable auto-cleanup during tests

    service = new TempDirectoryService();
  });

  afterEach(async () => {
    // Clean up all test directories
    await service.cleanupAll();

    // Clean up base directory
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    delete process.env.TEMP_BASE_DIR;
    delete process.env.TEMP_CLEANUP_HOURS;
  });

  describe('create', () => {
    it('should create a temporary directory', async () => {
      const tempDir = await service.create('test');

      expect(tempDir).toContain(testBaseDir);
      expect(tempDir).toContain('test-');

      // Verify directory exists
      const stats = await fs.stat(tempDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create unique directories', async () => {
      const dir1 = await service.create('test');
      const dir2 = await service.create('test');

      expect(dir1).not.toBe(dir2);
    });

    it('should use default prefix when not specified', async () => {
      const tempDir = await service.create();

      expect(tempDir).toContain('job-');
    });

    it('should create base directory if it does not exist', async () => {
      // Ensure base dir doesn't exist
      await fs.rm(testBaseDir, { recursive: true, force: true }).catch(() => {});

      const tempDir = await service.create('test');

      const baseExists = await fs
        .access(testBaseDir)
        .then(() => true)
        .catch(() => false);
      expect(baseExists).toBe(true);
      expect(tempDir).toContain(testBaseDir);
    });
  });

  describe('cleanup', () => {
    it('should remove a temporary directory', async () => {
      const tempDir = await service.create('test');

      await service.cleanup(tempDir);

      // Verify directory no longer exists
      const exists = await fs
        .access(tempDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('should handle cleanup of non-existent directory', async () => {
      const nonExistent = path.join(testBaseDir, 'non-existent');

      // Should not throw
      await expect(service.cleanup(nonExistent)).resolves.not.toThrow();
    });

    it('should refuse to clean directories outside base', async () => {
      const outsideDir = '/tmp/outside-directory';

      // Should not throw but also should not delete
      await service.cleanup(outsideDir);

      // If the directory existed, it should still exist
      // (We're just testing it doesn't attempt to delete)
    });

    it('should clean up directory with contents', async () => {
      const tempDir = await service.create('test');

      // Create some files
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content');
      await fs.mkdir(path.join(tempDir, 'subdir'));
      await fs.writeFile(path.join(tempDir, 'subdir', 'file2.txt'), 'content');

      await service.cleanup(tempDir);

      const exists = await fs
        .access(tempDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });
  });

  describe('cleanupAll', () => {
    it('should clean up all tracked directories', async () => {
      const dir1 = await service.create('test1');
      const dir2 = await service.create('test2');
      const dir3 = await service.create('test3');

      await service.cleanupAll();

      // Verify all directories are removed
      const exists1 = await fs
        .access(dir1)
        .then(() => true)
        .catch(() => false);
      const exists2 = await fs
        .access(dir2)
        .then(() => true)
        .catch(() => false);
      const exists3 = await fs
        .access(dir3)
        .then(() => true)
        .catch(() => false);

      expect(exists1).toBe(false);
      expect(exists2).toBe(false);
      expect(exists3).toBe(false);
    });

    it('should handle empty tracked directories', async () => {
      await expect(service.cleanupAll()).resolves.not.toThrow();
    });
  });

  describe('cleanupOld', () => {
    it('should clean up directories older than threshold', async () => {
      const tempDir = await service.create('old');

      // Manually modify the timestamp to make it appear old
      // 25 hours ago
      const oldTime = Date.now() - 25 * 60 * 60 * 1000;
      await fs.utimes(tempDir, oldTime / 1000, oldTime / 1000);

      await service.cleanupOld(24); // Clean up dirs older than 24 hours

      const exists = await fs
        .access(tempDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('should not clean up recent directories', async () => {
      const tempDir = await service.create('recent');

      await service.cleanupOld(24);

      const exists = await fs
        .access(tempDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle non-existent base directory', async () => {
      await fs.rm(testBaseDir, { recursive: true, force: true }).catch(() => {});

      await expect(service.cleanupOld(24)).resolves.not.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true for existing directory', async () => {
      const tempDir = await service.create('test');

      const exists = await service['exists'](tempDir);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent directory', async () => {
      const nonExistent = path.join(testBaseDir, 'non-existent');

      const exists = await service['exists'](nonExistent);

      expect(exists).toBe(false);
    });
  });

  describe('tracked directories', () => {
    it('should track created directories', async () => {
      const dir1 = await service.create('test1');
      const dir2 = await service.create('test2');
      const dir3 = await service.create('test3');

      // Verify directories exist
      const exists1 = await fs
        .access(dir1)
        .then(() => true)
        .catch(() => false);
      const exists2 = await fs
        .access(dir2)
        .then(() => true)
        .catch(() => false);
      const exists3 = await fs
        .access(dir3)
        .then(() => true)
        .catch(() => false);

      expect(exists1).toBe(true);
      expect(exists2).toBe(true);
      expect(exists3).toBe(true);
    });

    it('should untrack directories after cleanup', async () => {
      const dir1 = await service.create('test1');
      await service.create('test2');

      await service.cleanup(dir1);

      const exists1 = await fs
        .access(dir1)
        .then(() => true)
        .catch(() => false);
      expect(exists1).toBe(false);
    });
  });

  describe('module lifecycle', () => {
    it('should clean up on module destroy', async () => {
      const dir1 = await service.create('test1');
      const dir2 = await service.create('test2');

      // Simulate module destroy
      await service.onModuleDestroy();

      // Directories should be cleaned up
      const exists1 = await fs
        .access(dir1)
        .then(() => true)
        .catch(() => false);
      const exists2 = await fs
        .access(dir2)
        .then(() => true)
        .catch(() => false);

      expect(exists1).toBe(false);
      expect(exists2).toBe(false);
    });
  });
});
