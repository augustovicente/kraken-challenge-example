import { Injectable, Inject } from '@nestjs/common';

import { FileCoverage } from '../../domain/entities/FileCoverage';
import { IFileCoverageRepo } from '../../domain/repositories/IFileCoverageRepo';
import { IRepositoryRepo } from '../../domain/repositories/IRepositoryRepo';
import { ListFileCoverageDto, FileCoverageDto } from '../dtos/FileCoverageDto';

@Injectable()
export class ListCoverageFilesUseCase {
  constructor(
    @Inject('IRepositoryRepo')
    private readonly repositoryRepo: IRepositoryRepo,
    @Inject('IFileCoverageRepo')
    private readonly fileCoverageRepo: IFileCoverageRepo,
  ) {}

  async execute(dto: ListFileCoverageDto): Promise<FileCoverageDto[]> {
    const repositoryId = `${dto.owner}/${dto.repo}`;

    // Verify repository exists
    const repository = await this.repositoryRepo.findById(repositoryId);
    if (!repository) {
      throw new Error(`Repository ${repositoryId} not found. Please scan it first.`);
    }

    let files: FileCoverage[];

    if (dto.threshold !== undefined) {
      // Get files below threshold
      files = await this.fileCoverageRepo.findLowCoverageFiles(repositoryId, dto.threshold);
    } else {
      // Get all files
      files = await this.fileCoverageRepo.findByRepo(repositoryId);
    }

    // Convert to DTOs
    return files.map(file => this.toDto(file));
  }

  private toDto(file: FileCoverage): FileCoverageDto {
    return {
      id: file.id,
      repositoryId: file.repositoryId,
      filePath: file.filePath,
      coveragePercent: file.coveragePercent,
      linesCovered: file.linesCovered,
      linesTotal: file.linesTotal,
      lastMeasuredAt: file.lastMeasuredAt,
    };
  }
}
