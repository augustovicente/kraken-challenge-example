import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeORMRepository, LessThan } from 'typeorm';

import { FileCoverage } from '../../domain/entities/FileCoverage';
import { IFileCoverageRepo } from '../../domain/repositories/IFileCoverageRepo';
import { FileCoverageEntity } from '../persistence/entities/FileCoverageEntity';

/**
 * Concrete implementation of IFileCoverageRepo using TypeORM
 */

@Injectable()
export class FileCoverageRepository implements IFileCoverageRepo {
  constructor(
    @InjectRepository(FileCoverageEntity)
    private readonly repository: TypeORMRepository<FileCoverageEntity>,
  ) {}

  /**
   * Maps a domain FileCoverage entity to a TypeORM FileCoverageEntity
   */

  private toEntity(domain: FileCoverage): FileCoverageEntity {
    const entity = new FileCoverageEntity();

    if (domain.id && domain.id !== '0') {
      entity.id = parseInt(domain.id, 10);
    }

    entity.repositoryId = domain.repositoryId;
    entity.filePath = domain.filePath;
    entity.coveragePercent = domain.coveragePercent;
    entity.linesCovered = domain.linesCovered;
    entity.linesTotal = domain.linesTotal;
    entity.lastMeasuredAt = domain.lastMeasuredAt;

    return entity;
  }

  /**
   * Maps a TypeORM FileCoverageEntity to a domain FileCoverage entity.
   */

  private toDomain(entity: FileCoverageEntity): FileCoverage {
    return new FileCoverage(
      entity.id.toString(),
      entity.repositoryId,
      entity.filePath,
      entity.coveragePercent,
      entity.linesCovered,
      entity.linesTotal,
      entity.lastMeasuredAt,
    );
  }

  async saveCoverage(coverage: FileCoverage): Promise<void> {
    const entity = this.toEntity(coverage);

    await this.repository.save(entity);
  }

  async findByRepo(repositoryId: string): Promise<FileCoverage[]> {
    const entities = await this.repository.find({ where: { repositoryId } });

    return entities.map(entity => this.toDomain(entity));
  }

  async findLowCoverageFiles(repositoryId: string, threshold: number): Promise<FileCoverage[]> {
    const entities = await this.repository.find({
      where: {
        repositoryId,
        coveragePercent: LessThan(threshold),
      },
      order: { coveragePercent: 'ASC' },
    });

    return entities.map(entity => this.toDomain(entity));
  }
}
