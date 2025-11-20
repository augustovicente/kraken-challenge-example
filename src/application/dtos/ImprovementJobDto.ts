import { JobStatus } from '../../domain/entities/ImprovementJob';

/**
 * DTO for creating an improvement job.
 */

export interface CreateImprovementJobDto {
  filePath: string;
  owner: string;
  repo: string;
  requestedBy: string;
}

/**
 * DTO for improvement job response.
 */

export interface ImprovementJobDto {
  attemptCount: number;
  branchName: string | null;
  coverageAfter: number | null;
  coverageBefore: number | null;
  createdAt: Date;
  id: string;
  filePath: string;
  lastLogAt: Date | null;
  logs: string;
  prUrl: string | null;
  progress: number;
  repositoryId: string;
  requestedBy: string;
  status: JobStatus;
  updatedAt: Date;
}

/**
 * DTO for listing jobs.
 */

export interface ListJobsDto {
  limit?: number;
  owner: string;
  repo: string;
  status?: JobStatus;
}
