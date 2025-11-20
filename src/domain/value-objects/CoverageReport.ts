import { FileCoverage } from '../entities/FileCoverage';

/**
 * CoverageReport Value Object
 * Represents an aggregate report of coverage for multiple files
 */
export class CoverageReport {
  constructor(
    public readonly fileCoverages: ReadonlyArray<FileCoverage>,
    public readonly repositoryId: string,
    public readonly timestamp: Date,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.repositoryId || this.repositoryId.trim() === '') {
      throw new Error('CoverageReport repositoryId is required');
    }
    if (!this.fileCoverages) {
      throw new Error('CoverageReport fileCoverages is required');
    }
    // Validate all file coverages belong to the same repository
    const invalidFiles = this.fileCoverages.filter(fc => fc.repositoryId !== this.repositoryId);
    if (invalidFiles.length > 0) {
      throw new Error('All FileCoverage items must belong to the same repository');
    }
  }

  /**
   * Gets the total number of files in the report
   */
  public getTotalFiles(): number {
    return this.fileCoverages.length;
  }

  /**
   * Gets the aggregate coverage percentage across all files
   */
  public getAggregateCoverage(): number {
    if (this.fileCoverages.length === 0) {
      return 100; // No files means 100% coverage
    }

    const totalLines = this.fileCoverages.reduce((sum, fc) => sum + fc.linesTotal, 0);
    const totalCovered = this.fileCoverages.reduce((sum, fc) => sum + fc.linesCovered, 0);

    return totalLines === 0 ? 100 : (totalCovered / totalLines) * 100;
  }

  /**
   * Gets files below the specified coverage threshold
   */
  public getFilesBelowThreshold(threshold: number): FileCoverage[] {
    return this.fileCoverages.filter(fc => fc.isBelowThreshold(threshold));
  }

  /**
   * Gets the total number of lines across all files
   */
  public getTotalLines(): number {
    return this.fileCoverages.reduce((sum, fc) => sum + fc.linesTotal, 0);
  }

  /**
   * Gets the total number of covered lines across all files
   */
  public getTotalCoveredLines(): number {
    return this.fileCoverages.reduce((sum, fc) => sum + fc.linesCovered, 0);
  }

  /**
   * Gets the total number of uncovered lines across all files
   */
  public getTotalUncoveredLines(): number {
    return this.getTotalLines() - this.getTotalCoveredLines();
  }

  /**
   * Gets the number of files below the specified threshold
   */
  public getFilesCountBelowThreshold(threshold: number): number {
    return this.getFilesBelowThreshold(threshold).length;
  }

  /**
   * Gets the number of files with full coverage
   */
  public getFullyCoveredFilesCount(): number {
    return this.fileCoverages.filter(fc => fc.hasFullCoverage()).length;
  }

  /**
   * Gets the average coverage across all files (simple average, not weighted)
   */
  public getAverageCoverage(): number {
    if (this.fileCoverages.length === 0) {
      return 100;
    }

    const sum = this.fileCoverages.reduce((acc, fc) => acc + fc.coveragePercent, 0);
    return sum / this.fileCoverages.length;
  }

  /**
   * Checks if the repository meets the overall coverage threshold
   */
  public meetsThreshold(threshold: number): boolean {
    return this.getAggregateCoverage() >= threshold;
  }

  /**
   * Gets a summary object for reporting
   */
  public getSummary() {
    return {
      repositoryId: this.repositoryId,
      timestamp: this.timestamp,
      totalFiles: this.getTotalFiles(),
      aggregateCoverage: this.getAggregateCoverage(),
      averageCoverage: this.getAverageCoverage(),
      totalLines: this.getTotalLines(),
      coveredLines: this.getTotalCoveredLines(),
      uncoveredLines: this.getTotalUncoveredLines(),
      fullyCoveredFiles: this.getFullyCoveredFilesCount(),
    };
  }
}
