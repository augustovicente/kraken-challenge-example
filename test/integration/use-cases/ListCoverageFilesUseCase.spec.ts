import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { ListCoverageFilesUseCase } from '../../../src/application/use-cases/ListCoverageFilesUseCase';
import { FileCoverage } from '../../../src/domain/entities/FileCoverage';
import { Repository } from '../../../src/domain/entities/Repository';
import { FileCoverageRepository } from '../../../src/infrastructure/repositories/FileCoverageRepository';
import { RepositoryRepository } from '../../../src/infrastructure/repositories/RepositoryRepository';

describe('ListCoverageFilesUseCase (Integration)', () => {
  let dataSource: DataSource;
  let useCase: ListCoverageFilesUseCase;
  let repositoryRepo: RepositoryRepository;
  let fileCoverageRepo: FileCoverageRepository;
  let testDbPath: string;

  beforeAll(async () => {
    // Create a test database in temp directory
    testDbPath = path.join(os.tmpdir(), `test-db-${uuidv4()}.sqlite`);

    // Import entity classes
    const { RepositoryEntity } = await import(
      '../../../src/infrastructure/persistence/entities/RepositoryEntity'
    );
    const { FileCoverageEntity } = await import(
      '../../../src/infrastructure/persistence/entities/FileCoverageEntity'
    );

    dataSource = new DataSource({
      type: 'sqlite',
      database: testDbPath,
      entities: [RepositoryEntity, FileCoverageEntity],
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();

    // Initialize repositories using TypeORM repositories
    const repositoryEntityRepo = dataSource.getRepository(RepositoryEntity);
    const fileCoverageEntityRepo = dataSource.getRepository(FileCoverageEntity);

    repositoryRepo = new RepositoryRepository(repositoryEntityRepo);
    fileCoverageRepo = new FileCoverageRepository(fileCoverageEntityRepo);

    // Initialize use case
    useCase = new ListCoverageFilesUseCase(repositoryRepo, fileCoverageRepo);
  });

  afterAll(async () => {
    await dataSource.destroy();

    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clear data before each test
    await dataSource.getRepository('FileCoverageEntity').clear();
    await dataSource.getRepository('RepositoryEntity').clear();
  });

  describe('execute', () => {
    it('should list all coverage files for a repository', async () => {
      // Arrange: Create test data
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
        80,
        80,
        100,
        new Date(),
      );
      const file3 = new FileCoverage(
        uuidv4(),
        'owner/repo',
        'src/file3.ts',
        90,
        90,
        100,
        new Date(),
      );

      await fileCoverageRepo.saveCoverage(file1);
      await fileCoverageRepo.saveCoverage(file2);
      await fileCoverageRepo.saveCoverage(file3);

      // Act
      const result = await useCase.execute({ owner: 'owner', repo: 'repo' });

      // Assert
      expect(result).toHaveLength(3);
      expect(result.map(f => f.filePath).sort()).toEqual([
        'src/file1.ts',
        'src/file2.ts',
        'src/file3.ts',
      ]);
    });

    it('should filter files below threshold', async () => {
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
        80,
        80,
        100,
        new Date(),
      );
      const file3 = new FileCoverage(
        uuidv4(),
        'owner/repo',
        'src/file3.ts',
        90,
        90,
        100,
        new Date(),
      );

      await fileCoverageRepo.saveCoverage(file1);
      await fileCoverageRepo.saveCoverage(file2);
      await fileCoverageRepo.saveCoverage(file3);

      // Act
      const result = await useCase.execute({ owner: 'owner', repo: 'repo', threshold: 75 });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].filePath).toBe('src/file1.ts');
      expect(result[0].coveragePercent).toBe(50);
    });

    it('should throw error when repository does not exist', async () => {
      // Act & Assert
      await expect(useCase.execute({ owner: 'nonexistent', repo: 'repo' })).rejects.toThrow(
        'Repository nonexistent/repo not found. Please scan it first.',
      );
    });

    it('should return empty array when no files exist', async () => {
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

      // Act
      const result = await useCase.execute({ owner: 'owner', repo: 'repo' });

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should handle multiple repositories independently', async () => {
      // Arrange: Create two repositories
      const repo1 = new Repository(
        'owner/repo1',
        'owner',
        'repo1',
        'main',
        'https://github.com/owner/repo1',
        new Date(),
      );
      const repo2 = new Repository(
        'owner/repo2',
        'owner',
        'repo2',
        'main',
        'https://github.com/owner/repo2',
        new Date(),
      );
      await repositoryRepo.upsert(repo1);
      await repositoryRepo.upsert(repo2);

      // Add files to each repository
      const file1 = new FileCoverage(
        uuidv4(),
        'owner/repo1',
        'src/file1.ts',
        50,
        50,
        100,
        new Date(),
      );
      const file2 = new FileCoverage(
        uuidv4(),
        'owner/repo2',
        'src/file2.ts',
        80,
        80,
        100,
        new Date(),
      );

      await fileCoverageRepo.saveCoverage(file1);
      await fileCoverageRepo.saveCoverage(file2);

      // Act: List files for each repository
      const result1 = await useCase.execute({ owner: 'owner', repo: 'repo1' });
      const result2 = await useCase.execute({ owner: 'owner', repo: 'repo2' });

      // Assert
      expect(result1).toHaveLength(1);
      expect(result1[0].filePath).toBe('src/file1.ts');

      expect(result2).toHaveLength(1);
      expect(result2[0].filePath).toBe('src/file2.ts');
    });
  });
});
