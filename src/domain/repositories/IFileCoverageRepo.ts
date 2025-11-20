import { FileCoverage } from '../../domain/entities/FileCoverage';

/**
 * Repository interface for FileCoverage entity persistence operations.
 */

export interface IFileCoverageRepo {
  /**
   * Saves file coverage data.
   */

  saveCoverage(coverage: FileCoverage): Promise<void>;

  /**
   * Finds all file coverage records for a repository.
   */

  findByRepo(repositoryId: string): Promise<FileCoverage[]>;

  /**
   * Finds files with coverage below the specified threshold.
   */

  findLowCoverageFiles(repositoryId: string, threshold: number): Promise<FileCoverage[]>;
}
