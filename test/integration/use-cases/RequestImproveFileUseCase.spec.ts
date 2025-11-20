import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { RequestImproveFileUseCase } from '../../../src/application/use-cases/RequestImproveFileUseCase';
import { FileCoverage } from '../../../src/domain/entities/FileCoverage';
import { JobStatus } from '../../../src/domain/entities/ImprovementJob';
import { Repository } from '../../../src/domain/entities/Repository';
import { FileCoverageRepository } from '../../../src/infrastructure/repositories/FileCoverageRepository';
import { ImprovementJobRepository } from '../../../src/infrastructure/repositories/ImprovementJobRepository';
import { RepositoryRepository } from '../../../src/infrastructure/repositories/RepositoryRepository';

describe('RequestImproveFileUseCase (Integration)', () => {
  let dataSource: DataSource;
  let useCase: RequestImproveFileUseCase;
  let jobRepo: ImprovementJobRepository;
  let repositoryRepo: RepositoryRepository;
  let fileCoverageRepo: FileCoverageRepository;
  let testDbPath: string;

  beforeAll(async () => {
    testDbPath = path.join(os.tmpdir(), `test-db-${uuidv4()}.sqlite`);

    const { RepositoryEntity } = await import(
      '../../../src/infrastructure/persistence/entities/RepositoryEntity'
    );
    const { FileCoverageEntity } = await import(
      '../../../src/infrastructure/persistence/entities/FileCoverageEntity'
    );
    const { ImprovementJobEntity } = await import(
      '../../../src/infrastructure/persistence/entities/ImprovementJobEntity'
    );

    dataSource = new DataSource({
      type: 'sqlite',
      database: testDbPath,
      entities: [RepositoryEntity, FileCoverageEntity, ImprovementJobEntity],
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();

    const repositoryEntityRepo = dataSource.getRepository(RepositoryEntity);
    const fileCoverageEntityRepo = dataSource.getRepository(FileCoverageEntity);
    const jobEntityRepo = dataSource.getRepository(ImprovementJobEntity);

    repositoryRepo = new RepositoryRepository(repositoryEntityRepo);
    fileCoverageRepo = new FileCoverageRepository(fileCoverageEntityRepo);
    jobRepo = new ImprovementJobRepository(jobEntityRepo);

    useCase = new RequestImproveFileUseCase(repositoryRepo, fileCoverageRepo, jobRepo);
  });

  afterAll(async () => {
    await dataSource.destroy();
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    await dataSource.getRepository('ImprovementJobEntity').clear();
    await dataSource.getRepository('FileCoverageEntity').clear();
    await dataSource.getRepository('RepositoryEntity').clear();
  });

  describe('execute', () => {
    it('should create an improvement job', async () => {
      // Arrange
      const repository = new Repository(
        'owner/repo',
        'owner',
        'repo',
        'main',
        'https://github.com/owner/repo',
        new Date(),
      );
      await repositoryRepo.upsert(repository);

      const fileCoverage = new FileCoverage(
        uuidv4(),
        'owner/repo',
        'src/utils.ts',
        50,
        50,
        100,
        new Date(),
      );
      await fileCoverageRepo.saveCoverage(fileCoverage);

      // Act
      const result = await useCase.execute({
        owner: 'owner',
        repo: 'repo',
        filePath: 'src/utils.ts',
        requestedBy: 'user@example.com',
      });

      // Assert
      expect(result.id).toBeDefined();
      expect(result.status).toBe(JobStatus.PENDING);
      expect(result.filePath).toBe('src/utils.ts');

      // Verify job was persisted
      const savedJob = await jobRepo.getJob(result.id);
      expect(savedJob).toBeDefined();
      expect(savedJob?.status).toBe(JobStatus.PENDING);
      expect(savedJob?.repositoryId).toBe('owner/repo');
    });

    it('should throw error when repository does not exist', async () => {
      await expect(
        useCase.execute({
          owner: 'nonexistent',
          repo: 'repo',
          filePath: 'src/utils.ts',
          requestedBy: 'user@example.com',
        }),
      ).rejects.toThrow();
    });

    it('should throw error when file coverage does not exist', async () => {
      // Arrange
      const repository = new Repository(
        'owner/repo',
        'owner',
        'repo',
        'main',
        'https://github.com/owner/repo',
        new Date(),
      );
      await repositoryRepo.upsert(repository);

      // Act & Assert
      await expect(
        useCase.execute({
          owner: 'owner',
          repo: 'repo',
          filePath: 'src/nonexistent.ts',
          requestedBy: 'user@example.com',
        }),
      ).rejects.toThrow();
    });

    it('should create multiple jobs for the same repository', async () => {
      // Arrange
      const repository = new Repository(
        'owner/repo',
        'owner',
        'repo',
        'main',
        'https://github.com/owner/repo',
        new Date(),
      );
      await repositoryRepo.upsert(repository);

      const file1 = new FileCoverage(
        uuidv4(),
        'owner/repo',
        'src/file1.ts',
        50,
        50,
        100,
        new Date(),
      );
      const file2 = new FileCoverage(
        uuidv4(),
        'owner/repo',
        'src/file2.ts',
        60,
        60,
        100,
        new Date(),
      );

      await fileCoverageRepo.saveCoverage(file1);
      await fileCoverageRepo.saveCoverage(file2);

      // Act
      const result1 = await useCase.execute({
        owner: 'owner',
        repo: 'repo',
        filePath: 'src/file1.ts',
        requestedBy: 'user@example.com',
      });

      const result2 = await useCase.execute({
        owner: 'owner',
        repo: 'repo',
        filePath: 'src/file2.ts',
        requestedBy: 'user@example.com',
      });

      // Assert
      expect(result1.id).not.toBe(result2.id);

      const jobs = await jobRepo.fetchPendingJobs();
      expect(jobs).toHaveLength(2);
    });

    it('should track job metadata correctly', async () => {
      // Arrange
      const repository = new Repository(
        'owner/repo',
        'owner',
        'repo',
        'main',
        'https://github.com/owner/repo',
        new Date(),
      );
      await repositoryRepo.upsert(repository);

      const fileCoverage = new FileCoverage(
        uuidv4(),
        'owner/repo',
        'src/utils.ts',
        50,
        50,
        100,
        new Date(),
      );
      await fileCoverageRepo.saveCoverage(fileCoverage);

      // Act
      const result = await useCase.execute({
        owner: 'owner',
        repo: 'repo',
        filePath: 'src/utils.ts',
        requestedBy: 'test@example.com',
      });

      // Assert
      const savedJob = await jobRepo.getJob(result.id);
      expect(savedJob?.requestedBy).toBe('test@example.com');
      expect(savedJob?.progress).toBe(0);
      expect(savedJob?.attemptCount).toBe(0);
      expect(savedJob?.branchName).toBeNull();
      expect(savedJob?.prUrl).toBeNull();
    });
  });
});
