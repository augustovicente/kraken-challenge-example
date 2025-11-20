import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeORMRepository } from 'typeorm';

import { ImprovementJob, JobStatus } from '../../domain/entities/ImprovementJob';
import { IImprovementJobRepo } from '../../domain/repositories/IImprovementJobRepo';
import { ImprovementJobEntity } from '../persistence/entities/ImprovementJobEntity';

/**
 * Concrete implementation of IImprovementJobRepo using TypeORM
 */
@Injectable()
export class ImprovementJobRepository implements IImprovementJobRepo {
  constructor(
    @InjectRepository(ImprovementJobEntity)
    private readonly repository: TypeORMRepository<ImprovementJobEntity>,
  ) {}

  /**
   * Maps a domain ImprovementJob entity to a TypeORM ImprovementJobEntity
   */
  private toEntity(domain: ImprovementJob): ImprovementJobEntity {
    const entity = new ImprovementJobEntity();
    // Note: id is auto-generated, so we only set it if it exists and is not the default
    if (domain.id && domain.id !== '0') {
      entity.id = parseInt(domain.id, 10);
    }
    entity.repositoryId = domain.repositoryId;
    entity.filePath = domain.filePath;
    entity.requestedBy = domain.requestedBy;
    entity.status = domain.status;
    entity.progress = domain.progress;
    entity.branchName = domain.branchName;
    entity.prUrl = domain.prUrl;
    entity.logs = domain.logs;
    entity.lastLogAt = domain.lastLogAt;
    entity.coverageBefore = domain.coverageBefore;
    entity.coverageAfter = domain.coverageAfter;
    entity.attemptCount = domain.attemptCount;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }

  /**
   * Maps a TypeORM ImprovementJobEntity to a domain ImprovementJob entity
   */
  private toDomain(entity: ImprovementJobEntity): ImprovementJob {
    return new ImprovementJob(
      entity.id.toString(),
      entity.repositoryId,
      entity.filePath,
      entity.requestedBy,
      entity.status as JobStatus,
      entity.progress,
      entity.branchName,
      entity.prUrl,
      entity.logs,
      entity.lastLogAt,
      entity.coverageBefore,
      entity.coverageAfter,
      entity.createdAt,
      entity.updatedAt,
      entity.attemptCount,
    );
  }

  async createJob(job: ImprovementJob): Promise<void> {
    const entity = this.toEntity(job);
    await this.repository.save(entity);
  }

  async updateJob(job: ImprovementJob): Promise<void> {
    const entity = this.toEntity(job);
    await this.repository.save(entity);
  }

  async getJob(id: string): Promise<ImprovementJob | null> {
    const entity = await this.repository.findOne({
      where: { id: parseInt(id, 10) },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async fetchPendingJobs(): Promise<ImprovementJob[]> {
    const entities = await this.repository.find({
      where: { status: JobStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
    return entities.map(entity => this.toDomain(entity));
  }

  async fetchExecutableJobs(): Promise<ImprovementJob[]> {
    const entities = await this.repository
      .createQueryBuilder('job')
      .where('job.status IN (:...statuses)', {
        statuses: [JobStatus.PENDING, JobStatus.RETRY],
      })
      .orderBy('job.createdAt', 'ASC')
      .getMany();

    return entities.map(entity => this.toDomain(entity));
  }

  async tryAcquireLock(jobId: string, branchName: string): Promise<boolean> {
    const queryRunner = this.repository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get the job and check if it's in a valid state
      const job = await queryRunner.manager.findOne(ImprovementJobEntity, {
        where: { id: parseInt(jobId, 10) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!job) {
        await queryRunner.rollbackTransaction();
        return false;
      }

      // Check if job is in PENDING or RETRY state
      if (job.status !== JobStatus.PENDING && job.status !== JobStatus.RETRY) {
        await queryRunner.rollbackTransaction();
        return false;
      }

      // Check if there's already a RUNNING job for this repository
      const runningJob = await queryRunner.manager.findOne(ImprovementJobEntity, {
        where: {
          repositoryId: job.repositoryId,
          status: JobStatus.RUNNING,
        },
      });

      if (runningJob) {
        await queryRunner.rollbackTransaction();
        return false;
      }

      // Acquire the lock by updating status to RUNNING
      job.status = JobStatus.RUNNING;
      job.branchName = branchName;
      job.updatedAt = new Date();
      job.attemptCount = job.attemptCount + 1;
      await queryRunner.manager.save(job);

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
