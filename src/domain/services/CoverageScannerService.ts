import { FileCoverage } from '../entities/FileCoverage';
import { CoverageReport } from '../value-objects/CoverageReport';

/**
 * CoverageScannerService
 * Domain service responsible for analyzing coverage reports and determining
 * which files are below threshold. Contains pure business logic with no infrastructure dependencies.
 */
export class CoverageScannerService {
  /**
   * Analyzes a coverage report and returns files below the specified threshold
   */
  public getFilesBelowThreshold(report: CoverageReport, threshold: number): FileCoverage[] {
    this.validateThreshold(threshold);
    return report.getFilesBelowThreshold(threshold);
  }

  /**
   * Determines if a coverage report requires improvement based on threshold
   */
  public requiresImprovement(report: CoverageReport, threshold: number): boolean {
    this.validateThreshold(threshold);
    return !report.meetsThreshold(threshold);
  }

  /**
   * Prioritizes files for improvement based on coverage gaps
   * Returns files sorted by priority (lowest coverage first)
   */
  public prioritizeFilesForImprovement(report: CoverageReport, threshold: number): FileCoverage[] {
    this.validateThreshold(threshold);
    const filesBelowThreshold = report.getFilesBelowThreshold(threshold);

    // Sort by coverage percentage (ascending) and then by total lines (descending)
    // This prioritizes files with lowest coverage and higher impact
    return [...filesBelowThreshold].sort((a, b) => {
      const coverageDiff = a.coveragePercent - b.coveragePercent;
      if (coverageDiff !== 0) {
        return coverageDiff;
      }
      // If coverage is the same, prioritize files with more lines
      return b.linesTotal - a.linesTotal;
    });
  }

  /**
   * Calculates the improvement potential (number of lines that need coverage)
   */
  public calculateImprovementPotential(file: FileCoverage, threshold: number): number {
    this.validateThreshold(threshold);

    if (!file.isBelowThreshold(threshold)) {
      return 0;
    }

    const targetCoveredLines = Math.ceil((threshold / 100) * file.linesTotal);
    const additionalLinesNeeded = targetCoveredLines - file.linesCovered;

    return Math.max(0, additionalLinesNeeded);
  }

  /**
   * Estimates the effort required to reach the threshold (0-100 scale)
   */
  public estimateImprovementEffort(file: FileCoverage, threshold: number): number {
    this.validateThreshold(threshold);

    if (!file.isBelowThreshold(threshold)) {
      return 0;
    }

    const improvementPotential = this.calculateImprovementPotential(file, threshold);
    const totalLines = file.linesTotal;

    if (totalLines === 0) {
      return 0;
    }

    // Effort is proportional to the percentage of lines that need coverage
    const effortPercentage = (improvementPotential / totalLines) * 100;

    // Cap at 100
    return Math.min(100, Math.round(effortPercentage));
  }

  /**
   * Filters files by minimum total lines to avoid trivial files
   */
  public filterByMinimumLines(files: FileCoverage[], minimumLines: number): FileCoverage[] {
    if (minimumLines < 0) {
      throw new Error('Minimum lines must be non-negative');
    }
    return files.filter(file => file.linesTotal >= minimumLines);
  }

  /**
   * Groups files by coverage ranges for reporting
   */
  public groupFilesByCoverageRange(files: FileCoverage[]): Map<string, FileCoverage[]> {
    const ranges = new Map<string, FileCoverage[]>([
      ['0-20%', []],
      ['21-40%', []],
      ['41-60%', []],
      ['61-80%', []],
      ['81-99%', []],
      ['100%', []],
    ]);

    for (const file of files) {
      const coverage = file.coveragePercent;
      let range: string;

      if (coverage === 100) {
        range = '100%';
      } else if (coverage > 80) {
        range = '81-99%';
      } else if (coverage > 60) {
        range = '61-80%';
      } else if (coverage > 40) {
        range = '41-60%';
      } else if (coverage > 20) {
        range = '21-40%';
      } else {
        range = '0-20%';
      }

      ranges.get(range)!.push(file);
    }

    return ranges;
  }

  private validateThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 100) {
      throw new Error('Threshold must be between 0 and 100');
    }
  }
}
