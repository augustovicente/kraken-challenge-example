import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiCliAdapter } from './adapters/AiCliAdapter';
import { CoverageAdapter } from './adapters/CoverageAdapter';
import { GithubAdapter } from './adapters/GithubAdapter';
import { LocalGitAdapter } from './adapters/LocalGitAdapter';
import { ImprovementJobEntity } from './persistence/entities/ImprovementJobEntity';
import { RepositoryEntity } from './persistence/entities/RepositoryEntity';
import { ImprovementJobRepository } from './repositories/ImprovementJobRepository';
import { RepositoryRepository } from './repositories/RepositoryRepository';
import { JobExecutor } from './workers/JobExecutor';
import { WorkerService } from './workers/WorkerService';

/**
 * WorkerModule
 * Module for background worker processes.
 */

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || './data/coverage.db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      // Set to false in production, use migrations.
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forFeature([ImprovementJobEntity, RepositoryEntity]),
  ],
  providers: [
    // Worker services.
    WorkerService,
    JobExecutor,

    // Repositories.
    {
      provide: 'IImprovementJobRepo',
      useClass: ImprovementJobRepository,
    },
    {
      provide: 'IRepositoryRepo',
      useClass: RepositoryRepository,
    },

    // Adapters.
    {
      provide: 'ILocalGitAdapter',
      useClass: LocalGitAdapter,
    },
    {
      provide: 'ICoverageAdapter',
      useClass: CoverageAdapter,
    },
    {
      provide: 'IAiCliAdapter',
      useClass: AiCliAdapter,
    },
    {
      provide: 'IGithubAdapter',
      useClass: GithubAdapter,
    },
  ],
  exports: [WorkerService],
})
export class WorkerModule {}
