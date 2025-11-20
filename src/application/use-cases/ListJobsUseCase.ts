import { Injectable, Inject } from '@nestjs/common';

import { ImprovementJob } from '../../domain/entities/ImprovementJob';
import { IImprovementJobRepo } from '../../domain/repositories/IImprovementJobRepo';
import { ImprovementJobDto } from '../dtos/ImprovementJobDto';

@Injectable()
export class ListJobsUseCase {
  constructor(
    @Inject('IImprovementJobRepo')
    private readonly improvementJobRepo: IImprovementJobRepo,
  ) {}

  async execute(repositoryId?: string): Promise<ImprovementJobDto[]> {
    // For now, get all executable jobs (PENDING/RETRY)
    // In a full implementation, you'd add methods to filter by repository
    const jobs = await this.improvementJobRepo.fetchExecutableJobs();

    // Filter by repository if specified
    const filteredJobs = repositoryId
      ? jobs.filter(job => job.repositoryId === repositoryId)
      : jobs;

    return filteredJobs.map(job => this.toDto(job));
  }

  private toDto(job: ImprovementJob): ImprovementJobDto {
    return {
      id: job.id,
      repositoryId: job.repositoryId,
      filePath: job.filePath,
      requestedBy: job.requestedBy,
      status: job.status,
      progress: job.progress,
      branchName: job.branchName,
      prUrl: job.prUrl,
      logs: job.logs,
      lastLogAt: job.lastLogAt,
      coverageBefore: job.coverageBefore,
      coverageAfter: job.coverageAfter,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      attemptCount: job.attemptCount,
    };
  }
}
