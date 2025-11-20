export interface FileCoverageData {
  filePath: string;
  percent: number;
  linesCovered: number;
  linesTotal: number;
}

export interface ICoverageAdapter {
  /**
   * Run coverage tests for a repository.
   * @param repoPath Path to the repository.
   * @returns Path to the generated coverage summary file.
   */

  runCoverage(repoPath: string): Promise<string>;

  /**
   * Parse coverage summary file.
   * @param pathToSummary Path to coverage-summary.json.
   * @returns Array of file coverage data.
   */

  parseCoverageSummary(pathToSummary: string): Promise<FileCoverageData[]>;
}
