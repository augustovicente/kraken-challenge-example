/**
 * DTO for scanning a repository.
 */

export interface ScanRepositoryDto {
  repoUrl: string;
}

/**
 * DTO for scan result.
 */

export interface ScanResultDto {
  filesBelowThreshold: number;
  filesScanned: number;
  name: string;
  owner: string;
  repositoryId: string;
  scannedAt: Date;
  threshold: number;
}
