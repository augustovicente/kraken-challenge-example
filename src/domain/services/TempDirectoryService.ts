import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { SecureLogger } from '../../infrastructure/utils/logger';

/**
 * Service for managing ephemeral temporary directories
 * Provides automatic cleanup and prevents data leakage between jobs
 */
@Injectable()
export class TempDirectoryService implements OnModuleDestroy {
  private readonly logger = new SecureLogger(TempDirectoryService.name);
  private readonly baseDir: string;
  private readonly trackedDirectories: Set<string> = new Set();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Get base directory from env or use system temp
    this.baseDir = process.env.TEMP_BASE_DIR || path.join(os.tmpdir(), 'coverage-improvement');

    this.logger.log(`Temp directory service initialized: ${this.baseDir}`);

    // Start automatic cleanup if configured
    const cleanupHours = parseInt(process.env.TEMP_CLEANUP_HOURS || '24', 10);
    if (cleanupHours > 0) {
      this.startAutomaticCleanup(cleanupHours);
    }
  }

  /**
   * Create a new temporary directory for a job
   * Directory name includes timestamp and random suffix for uniqueness
   */
  async create(prefix: string = 'job'): Promise<string> {
    // Ensure base directory exists
    await this.ensureBaseDir();

    // Generate unique directory name
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const dirName = `${prefix}-${timestamp}-${random}`;
    const tempDir = path.join(this.baseDir, dirName);

    try {
      // Create directory with restricted permissions (700)
      await fs.mkdir(tempDir, { recursive: true, mode: 0o700 });

      // Track this directory
      this.trackedDirectories.add(tempDir);

      this.logger.log(`Created temporary directory: ${dirName}`);
      return tempDir;
    } catch (error) {
      this.logger.error(`Failed to create temporary directory: ${dirName}`, error.message);
      throw new Error(`Failed to create temporary directory: ${error.message}`);
    }
  }

  /**
   * Clean up a specific temporary directory
   * Removes all contents and the directory itself
   */
  async cleanup(tempDir: string): Promise<void> {
    if (!tempDir || !tempDir.startsWith(this.baseDir)) {
      this.logger.warn(`Refusing to clean up directory outside base: ${tempDir}`);
      return;
    }

    try {
      // Check if directory exists
      const exists = await this.exists(tempDir);
      if (!exists) {
        this.logger.debug(`Directory already removed: ${tempDir}`);
        this.trackedDirectories.delete(tempDir);
        return;
      }

      // Remove directory recursively
      await fs.rm(tempDir, { recursive: true, force: true });

      // Remove from tracking
      this.trackedDirectories.delete(tempDir);

      this.logger.log(`Cleaned up temporary directory: ${path.basename(tempDir)}`);
    } catch (error) {
      this.logger.error(`Failed to clean up directory: ${tempDir}`, error.message);
      // Don't throw - cleanup failures shouldn't stop the process
    }
  }

  /**
   * Clean up all tracked directories
   * Useful for shutdown or testing
   */
  async cleanupAll(): Promise<void> {
    this.logger.log(`Cleaning up ${this.trackedDirectories.size} tracked directories`);

    const cleanupPromises = Array.from(this.trackedDirectories).map(dir => this.cleanup(dir));

    await Promise.allSettled(cleanupPromises);
  }

  /**
   * Clean up old temporary directories based on age
   */
  async cleanupOld(maxAgeHours: number): Promise<void> {
    try {
      const exists = await this.exists(this.baseDir);
      if (!exists) {
        return;
      }

      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      const now = Date.now();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

      let cleanedCount = 0;

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const dirPath = path.join(this.baseDir, entry.name);

        try {
          const stats = await fs.stat(dirPath);
          const age = now - stats.mtimeMs;

          if (age > maxAgeMs) {
            await this.cleanup(dirPath);
            cleanedCount++;
          }
        } catch (error) {
          this.logger.debug(`Failed to check directory age: ${entry.name}`);
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} old directories`);
      }
    } catch (error) {
      this.logger.error('Failed to clean up old directories', error.message);
    }
  }

  /**
   * Get the size of a directory in bytes
   */
  async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(entryPath);
        } else {
          const stats = await fs.stat(entryPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      this.logger.debug(`Failed to calculate directory size: ${dirPath}`);
    }

    return totalSize;
  }

  /**
   * Get statistics about temporary directories
   */
  async getStats(): Promise<{
    trackedCount: number;
    totalCount: number;
    totalSizeMB: number;
  }> {
    try {
      const exists = await this.exists(this.baseDir);
      if (!exists) {
        return { trackedCount: 0, totalCount: 0, totalSizeMB: 0 };
      }

      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      const directories = entries.filter(e => e.isDirectory());

      let totalSize = 0;
      for (const dir of directories) {
        const dirPath = path.join(this.baseDir, dir.name);
        totalSize += await this.getDirectorySize(dirPath);
      }

      return {
        trackedCount: this.trackedDirectories.size,
        totalCount: directories.length,
        totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
      };
    } catch (error) {
      this.logger.error('Failed to get temp directory stats', error.message);
      return { trackedCount: 0, totalCount: 0, totalSizeMB: 0 };
    }
  }

  /**
   * Start automatic cleanup of old directories
   */
  private startAutomaticCleanup(cleanupHours: number): void {
    const intervalMs = 60 * 60 * 1000; // Run every hour

    this.cleanupInterval = setInterval(() => {
      this.logger.debug('Running automatic cleanup of old directories');
      this.cleanupOld(cleanupHours).catch(error => {
        this.logger.error('Automatic cleanup failed', error.message);
      });
    }, intervalMs);

    this.logger.log(
      `Automatic cleanup enabled: directories older than ${cleanupHours}h will be removed`,
    );
  }

  /**
   * Stop automatic cleanup
   */
  private stopAutomaticCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.log('Automatic cleanup stopped');
    }
  }

  /**
   * Ensure base directory exists
   */
  private async ensureBaseDir(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true, mode: 0o700 });
    } catch (error) {
      this.logger.error(`Failed to create base directory: ${this.baseDir}`, error.message);
      throw error;
    }
  }

  /**
   * Check if a path exists
   */
  private async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Module destroying, cleaning up resources');

    // Stop automatic cleanup
    this.stopAutomaticCleanup();

    // Clean up tracked directories
    await this.cleanupAll();
  }
}
