import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { ImprovementJob } from '../../domain/entities/ImprovementJob';
import { IFileCoverageRepo } from '../../domain/repositories/IFileCoverageRepo';
import { IImprovementJobRepo } from '../../domain/repositories/IImprovementJobRepo';
import { IRepositoryRepo } from '../../domain/repositories/IRepositoryRepo';
import { ImprovementOrchestrator } from '../../domain/services/ImprovementOrchestrator';
import { CreateImprovementJobDto, ImprovementJobDto } from '../dtos/ImprovementJobDto';

@Injectable()
export class RequestImproveFileUseCase {
  private readonly orchestrator: ImprovementOrchestrator;

  constructor(
    @Inject('IRepositoryRepo')
    private readonly repositoryRepo: IRepositoryRepo,
    @Inject('IFileCoverageRepo')
    private readonly fileCoverageRepo: IFileCoverageRepo,
    @Inject('IImprovementJobRepo')
    private readonly improvementJobRepo: IImprovementJobRepo,
  ) {
    this.orchestrator = new ImprovementOrchestrator();
  }

  async execute(dto: CreateImprovementJobDto): Promise<ImprovementJobDto> {
    const repositoryId = `${dto.owner}/${dto.repo}`;

    // Verify repository exists
    const repository = await this.repositoryRepo.findById(repositoryId);
    if (!repository) {
      throw new Error(`Repository ${repositoryId} not found. Please scan it first.`);
    }

    // Get file coverage information
    const files = await this.fileCoverageRepo.findByRepo(repositoryId);
    const fileCoverage = files.find(f => f.filePath === dto.filePath);

    if (!fileCoverage) {
      throw new Error(`File ${dto.filePath} not found in repository coverage data.`);
    }

    // Create improvement job using domain service
    const threshold = parseInt(process.env.COVERAGE_THRESHOLD || '80', 10);
    const jobId = uuidv4();

    const job = this.orchestrator.createImprovementJob(
      jobId,
      fileCoverage,
      dto.requestedBy,
      threshold,
    );

    // Save job
    await this.improvementJobRepo.createJob(job);

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
