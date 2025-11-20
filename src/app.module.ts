import { join } from 'path';

import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoverageController } from './api/controllers/CoverageController';
import { JobsController, RepoJobsController } from './api/controllers/JobsController';
import { GetJobStatusUseCase } from './application/use-cases/GetJobStatusUseCase';
import { ListCoverageFilesUseCase } from './application/use-cases/ListCoverageFilesUseCase';
import { ListJobsUseCase } from './application/use-cases/ListJobsUseCase';
import { RequestImproveFileUseCase } from './application/use-cases/RequestImproveFileUseCase';
import { ScanRepositoryUseCase } from './application/use-cases/ScanRepositoryUseCase';
import { AiCliAdapter } from './infrastructure/adapters/AiCliAdapter';
import { CoverageAdapter } from './infrastructure/adapters/CoverageAdapter';
import { GithubAdapter } from './infrastructure/adapters/GithubAdapter';
import { LocalGitAdapter } from './infrastructure/adapters/LocalGitAdapter';
import { FileCoverageEntity } from './infrastructure/persistence/entities/FileCoverageEntity';
import { ImprovementJobEntity } from './infrastructure/persistence/entities/ImprovementJobEntity';
import { RepositoryEntity } from './infrastructure/persistence/entities/RepositoryEntity';
import { FileCoverageRepository } from './infrastructure/repositories/FileCoverageRepository';
import { ImprovementJobRepository } from './infrastructure/repositories/ImprovementJobRepository';
import { RepositoryRepository } from './infrastructure/repositories/RepositoryRepository';

// Controllers.
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || './data/coverage.db',
      entities: [RepositoryEntity, FileCoverageEntity, ImprovementJobEntity],
      // Set to false in production, use migrations.
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forFeature([RepositoryEntity, FileCoverageEntity, ImprovementJobEntity]),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
    }),
  ],
  controllers: [CoverageController, JobsController, RepoJobsController],
  providers: [
    // Repositories.
    {
      provide: 'IRepositoryRepo',
      useClass: RepositoryRepository,
    },
    {
      provide: 'IFileCoverageRepo',
      useClass: FileCoverageRepository,
    },
    {
      provide: 'IImprovementJobRepo',
      useClass: ImprovementJobRepository,
    },
    // Adapters.
    {
      provide: 'IGithubAdapter',
      useClass: GithubAdapter,
    },
    {
      provide: 'ICoverageAdapter',
      useClass: CoverageAdapter,
    },
    {
      provide: 'ILocalGitAdapter',
      useClass: LocalGitAdapter,
    },
    {
      provide: 'IAiCliAdapter',
      useClass: AiCliAdapter,
    },
    // Use Cases.
    ScanRepositoryUseCase,
    ListCoverageFilesUseCase,
    RequestImproveFileUseCase,
    GetJobStatusUseCase,
    ListJobsUseCase,
  ],
  exports: [
    'IRepositoryRepo',
    'IFileCoverageRepo',
    'IImprovementJobRepo',
    'IGithubAdapter',
    'ICoverageAdapter',
    'ILocalGitAdapter',
    'IAiCliAdapter',
    ScanRepositoryUseCase,
    ListCoverageFilesUseCase,
    RequestImproveFileUseCase,
    GetJobStatusUseCase,
    ListJobsUseCase,
  ],
})
export class AppModule {}
