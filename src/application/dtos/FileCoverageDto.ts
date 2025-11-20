/**
 * DTO for file coverage information.
 */

export interface FileCoverageDto {
  coveragePercent: number;
  filePath: string;
  id: string;
  lastMeasuredAt: Date;
  linesCovered: number;
  linesTotal: number;
  repositoryId: string;
}

/**
 * DTO for listing file coverage with filters.
 */

export interface ListFileCoverageDto {
  owner: string;
  repo: string;
  threshold?: number;
}
