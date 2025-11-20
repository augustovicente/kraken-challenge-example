import * as os from 'os';
import * as path from 'path';

import { Injectable, Inject } from '@nestjs/common';
import * as fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';

import { FileCoverage } from '../../domain/entities/FileCoverage';
import { Repository } from '../../domain/entities/Repository';
import { IFileCoverageRepo } from '../../domain/repositories/IFileCoverageRepo';
import { IRepositoryRepo } from '../../domain/repositories/IRepositoryRepo';
import { ScanRepositoryDto, ScanResultDto } from '../dtos/ScanRepositoryDto';
import { ICoverageAdapter } from '../ports/ICoverageAdapter';
import { IGithubAdapter } from '../ports/IGithubAdapter';
import { ILocalGitAdapter } from '../ports/ILocalGitAdapter';

@Injectable()
export class ScanRepositoryUseCase {
  constructor(
    @Inject('IGithubAdapter')
    private readonly githubAdapter: IGithubAdapter,
    @Inject('ICoverageAdapter')
    private readonly coverageAdapter: ICoverageAdapter,
    @Inject('ILocalGitAdapter')
    private readonly localGitAdapter: ILocalGitAdapter,
    @Inject('IRepositoryRepo')
    private readonly repositoryRepo: IRepositoryRepo,
    @Inject('IFileCoverageRepo')
    private readonly fileCoverageRepo: IFileCoverageRepo,
  ) {}

  async execute(dto: ScanRepositoryDto): Promise<ScanResultDto> {
    // Parse repo URL to extract owner and name
    const { owner, name } = this.parseRepoUrl(dto.repoUrl);

    // Get repository information from GitHub
    const repoInfo = await this.githubAdapter.getRepo(owner, name);

    // Create or update repository entity
    const repositoryId = `${owner}/${name}`;
    const repository = new Repository(
      repositoryId,
      owner,
      name,
      repoInfo.defaultBranch,
      repoInfo.gitUrl,
      new Date(),
    );

    await this.repositoryRepo.upsert(repository);

    // Clone repository to temporary location
    const tempDir = path.join(os.tmpdir(), `coverage-scan-${uuidv4()}`);

    try {
      await this.localGitAdapter.cloneRepo(repoInfo.gitUrl, tempDir, process.env.GITHUB_TOKEN);

      // Run coverage analysis
      const coverageSummaryPath = await this.coverageAdapter.runCoverage(tempDir);
      const fileCoverageData = await this.coverageAdapter.parseCoverageSummary(coverageSummaryPath);

      // Save file coverage data
      const threshold = parseInt(process.env.COVERAGE_THRESHOLD || '80', 10);
      let filesBelowThreshold = 0;

      for (const data of fileCoverageData) {
        const fileCoverage = new FileCoverage(
          uuidv4(),
          repositoryId,
          data.filePath,
          data.percent,
          data.linesCovered,
          data.linesTotal,
          new Date(),
        );

        await this.fileCoverageRepo.saveCoverage(fileCoverage);

        if (fileCoverage.isBelowThreshold(threshold)) {
          filesBelowThreshold++;
        }
      }

      return {
        repositoryId,
        owner,
        name,
        filesScanned: fileCoverageData.length,
        filesBelowThreshold,
        threshold,
        scannedAt: new Date(),
      };
    } finally {
      // Clean up temporary directory
      await fs.remove(tempDir);
    }
  }

  private parseRepoUrl(repoUrl: string): { owner: string; name: string } {
    // Handle formats like:
    // - https://github.com/owner/repo
    // - git@github.com:owner/repo.git
    // - owner/repo

    let cleanUrl = repoUrl.trim();

    // Remove .git suffix if present
    cleanUrl = cleanUrl.replace(/\.git$/, '');

    // Extract from SSH format
    if (cleanUrl.includes('git@github.com:')) {
      cleanUrl = cleanUrl.replace('git@github.com:', '');
    }

    // Extract from HTTPS format
    if (cleanUrl.includes('github.com/')) {
      const match = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (match) {
        return { owner: match[1], name: match[2] };
      }
    }

    // Handle owner/repo format
    const parts = cleanUrl.split('/');
    if (parts.length >= 2) {
      return { owner: parts[parts.length - 2], name: parts[parts.length - 1] };
    }

    throw new Error(`Invalid repository URL format: ${repoUrl}`);
  }
}
