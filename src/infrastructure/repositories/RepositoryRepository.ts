import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeORMRepository } from 'typeorm';

import { Repository } from '../../domain/entities/Repository';
import { IRepositoryRepo } from '../../domain/repositories/IRepositoryRepo';
import { RepositoryEntity } from '../persistence/entities/RepositoryEntity';

/**
 * Concrete implementation of IRepositoryRepo using TypeORM
 */
@Injectable()
export class RepositoryRepository implements IRepositoryRepo {
  constructor(
    @InjectRepository(RepositoryEntity)
    private readonly repository: TypeORMRepository<RepositoryEntity>,
  ) {}

  /**
   * Maps a domain Repository entity to a TypeORM RepositoryEntity
   */
  private toEntity(domain: Repository): RepositoryEntity {
    const entity = new RepositoryEntity();
    entity.id = domain.id;
    entity.owner = domain.owner;
    entity.name = domain.name;
    entity.gitUrl = domain.gitUrl;
    entity.defaultBranch = domain.defaultBranch;
    entity.lastScannedAt = domain.lastScannedAt;
    return entity;
  }

  /**
   * Maps a TypeORM RepositoryEntity to a domain Repository entity
   */
  private toDomain(entity: RepositoryEntity): Repository {
    return new Repository(
      entity.id,
      entity.owner,
      entity.name,
      entity.defaultBranch,
      entity.gitUrl,
      entity.lastScannedAt,
    );
  }

  async saveRepo(repo: Repository): Promise<void> {
    const entity = this.toEntity(repo);
    await this.repository.save(entity);
  }

  async findById(id: string): Promise<Repository | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async upsert(repo: Repository): Promise<void> {
    const entity = this.toEntity(repo);
    await this.repository.save(entity);
  }
}
