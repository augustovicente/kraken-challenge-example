/**
 * FileCoverage Entity
 * Represents test coverage metrics for a single file in a repository
 */

export class FileCoverage {
  constructor(
    public readonly id: string,
    public readonly repositoryId: string,
    public readonly filePath: string,
    public readonly coveragePercent: number,
    public readonly linesCovered: number,
    public readonly linesTotal: number,
    public readonly lastMeasuredAt: Date,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.id || this.id.trim() === '') {
      throw new Error('FileCoverage id is required');
    }
    if (!this.repositoryId || this.repositoryId.trim() === '') {
      throw new Error('FileCoverage repositoryId is required');
    }
    if (!this.filePath || this.filePath.trim() === '') {
      throw new Error('FileCoverage filePath is required');
    }
    if (this.coveragePercent < 0 || this.coveragePercent > 100) {
      throw new Error('FileCoverage coveragePercent must be between 0 and 100');
    }
    if (this.linesCovered < 0) {
      throw new Error('FileCoverage linesCovered must be non-negative');
    }
    if (this.linesTotal < 0) {
      throw new Error('FileCoverage linesTotal must be non-negative');
    }
    if (this.linesCovered > this.linesTotal) {
      throw new Error('FileCoverage linesCovered cannot exceed linesTotal');
    }
  }

  /**
   * Checks if the file coverage is below the specified threshold
   */
  public isBelowThreshold(threshold: number): boolean {
    return this.coveragePercent < threshold;
  }

  /**
   * Checks if the file has full coverage
   */
  public hasFullCoverage(): boolean {
    return this.coveragePercent === 100;
  }

  /**
   * Gets the number of uncovered lines
   */
  public getUncoveredLines(): number {
    return this.linesTotal - this.linesCovered;
  }

  /**
   * Gets the coverage as a fraction (0 to 1)
   */
  public getCoverageFraction(): number {
    return this.linesTotal === 0 ? 1 : this.linesCovered / this.linesTotal;
  }
}
