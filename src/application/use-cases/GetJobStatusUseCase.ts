import { Injectable, Inject } from '@nestjs/common';

import { ImprovementJob } from '../../domain/entities/ImprovementJob';
import { IImprovementJobRepo } from '../../domain/repositories/IImprovementJobRepo';
import { ImprovementJobDto } from '../dtos/ImprovementJobDto';

@Injectable()
export class GetJobStatusUseCase {
  constructor(
    @Inject('IImprovementJobRepo')
    private readonly improvementJobRepo: IImprovementJobRepo,
  ) {}

  async execute(jobId: string): Promise<ImprovementJobDto> {
    const job = await this.improvementJobRepo.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found.`);
    }

    return this.toDto(job);
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
