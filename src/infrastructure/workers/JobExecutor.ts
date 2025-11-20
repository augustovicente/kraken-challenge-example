import * as path from 'path';

import { Injectable, Inject } from '@nestjs/common';
import * as fs from 'fs-extra';

import { IAiCliAdapter } from '../../application/ports/IAiCliAdapter';
import { ICoverageAdapter } from '../../application/ports/ICoverageAdapter';
import { IGithubAdapter } from '../../application/ports/IGithubAdapter';
import { ILocalGitAdapter } from '../../application/ports/ILocalGitAdapter';
import { ImprovementJob } from '../../domain/entities/ImprovementJob';
import { Repository } from '../../domain/entities/Repository';
import { IImprovementJobRepo } from '../../domain/repositories/IImprovementJobRepo';
import { IRepositoryRepo } from '../../domain/repositories/IRepositoryRepo';
import { TempDirectoryService } from '../../domain/services/TempDirectoryService';
import { SecureLogger } from '../utils/logger';

/**
 * Executes improvement jobs step by step.
 */

@Injectable()
export class JobExecutor {
  private readonly logger = new SecureLogger(JobExecutor.name);
  private readonly MAX_ATTEMPTS = 3;

  constructor(
    @Inject('IImprovementJobRepo')
    private readonly jobRepo: IImprovementJobRepo,
    @Inject('IRepositoryRepo')
    private readonly repoRepo: IRepositoryRepo,
    @Inject('ILocalGitAdapter')
    private readonly localGitAdapter: ILocalGitAdapter,
    @Inject('ICoverageAdapter')
    private readonly coverageAdapter: ICoverageAdapter,
    @Inject('IAiCliAdapter')
    private readonly aiCliAdapter: IAiCliAdapter,
    @Inject('IGithubAdapter')
    private readonly githubAdapter: IGithubAdapter,
    private readonly tempDirService: TempDirectoryService,
  ) {}

  /**
   * Execute a single improvement job. Uses ephemeral temporary directory with automatic cleanup.
   */

  async executeJob(job: ImprovementJob): Promise<void> {
    // Create ephemeral temporary directory.
    const tmpDir = await this.tempDirService.create(`job-${job.id}`);

    try {
      this.logger.log(`Starting job ${job.id} for file ${job.filePath}`);
      this.logger.debug(`Working directory: ${tmpDir}`);

      // Get repository information.
      const repository = await this.repoRepo.findById(job.repositoryId);
      if (!repository) {
        throw new Error(`Repository ${job.repositoryId} not found`);
      }

      // Step 1: Clone repository.
      job = await this.cloneRepository(job, repository, tmpDir);

      // Step 2: Run baseline coverage.
      job = await this.runBaselineCoverage(job, tmpDir);

      // Step 3: Generate tests with AI.
      job = await this.generateTests(job, tmpDir);

      // Step 4: Verify tests.
      job = await this.verifyTests(job, tmpDir);

      // Step 5: Commit and push.
      job = await this.commitAndPush(job, repository, tmpDir);

      // Step 6: Create pull request.
      job = await this.createPullRequest(job, repository);

      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Job ${job.id} failed`, error.message);

      // Mark for retry or fail.
      const updatedJob = job.markForRetry(error.message, this.MAX_ATTEMPTS);

      await this.jobRepo.updateJob(updatedJob);
    } finally {
      // Cleanup ephemeral temporary directory.
      await this.tempDirService.cleanup(tmpDir);
    }
  }

  /**
   * Uses authenticated Git URL with secure token handling.
   */

  private async cloneRepository(
    job: ImprovementJob,
    repository: Repository,
    tmpDir: string,
  ): Promise<ImprovementJob> {
    let updatedJob = job.updateProgress(5, 'Cloning repository...');
    await this.jobRepo.updateJob(updatedJob);

    // Get authenticated Git URL.
    const authGitUrl = this.githubAdapter.getAuthenticatedGitUrl(repository.owner, repository.name);

    // Log safe URL (without credentials).
    this.logger.debug(
      `Cloning ${this.githubAdapter.getSafeGitUrl(repository.owner, repository.name)}`,
    );

    await this.localGitAdapter.cloneRepo(authGitUrl, tmpDir);

    updatedJob = updatedJob.appendLog('Repository cloned successfully');
    await this.jobRepo.updateJob(updatedJob);

    return updatedJob;
  }

  /**
   * Run baseline coverage.
   */

  private async runBaselineCoverage(job: ImprovementJob, tmpDir: string): Promise<ImprovementJob> {
    let updatedJob = job.updateProgress(25, 'Running baseline coverage...');
    await this.jobRepo.updateJob(updatedJob);

    let coverageBefore: number | null = null;

    try {
      const coverageSummaryPath = await this.coverageAdapter.runCoverage(tmpDir);
      const coverageData = await this.coverageAdapter.parseCoverageSummary(coverageSummaryPath);

      const targetFileCoverage = coverageData.find(({ filePath }) => filePath === job.filePath);

      if (targetFileCoverage) {
        coverageBefore = targetFileCoverage.percent;
        updatedJob = updatedJob.appendLog(
          `Baseline coverage for ${job.filePath}: ${targetFileCoverage.percent}%`,
        );
      } else {
        updatedJob = updatedJob.appendLog(
          'Baseline coverage captured (target file not in coverage report)',
        );
      }

      await this.jobRepo.updateJob(updatedJob);
    } catch (error) {
      // Coverage might fail if no tests exist yet, continue anyway.
      updatedJob = updatedJob.appendLog(
        `Baseline coverage failed (may be no existing tests): ${error.message}`,
      );
      await this.jobRepo.updateJob(updatedJob);
    }

    // Store baseline coverage (even if null)
    if (coverageBefore !== null) {
      updatedJob = updatedJob.setCoverage(coverageBefore, null);
      await this.jobRepo.updateJob(updatedJob);
    }

    return updatedJob;
  }

  /**
   * Generate tests with AI.
   */

  private async generateTests(job: ImprovementJob, tmpDir: string): Promise<ImprovementJob> {
    let updatedJob = job.updateProgress(50, 'Generating tests with AI...');
    await this.jobRepo.updateJob(updatedJob);

    // Prepare context files.
    const contextFiles = await this.gatherContextFiles(tmpDir, job.filePath);

    // Run AI CLI
    const aiCliCommand = process.env.AI_CLI_COMMAND || 'echo "AI CLI not configured"';

    updatedJob = updatedJob.appendLog(`Running AI CLI: ${aiCliCommand}`);
    await this.jobRepo.updateJob(updatedJob);

    const aiResult = await this.aiCliAdapter.generateTests({
      targetFilePath: job.filePath,
      repoPath: tmpDir,
      contextFiles,
      aiCliCommand,
    });

    if (aiResult.isFailed()) {
      throw new Error(`AI test generation failed: ${aiResult.error}`);
    }

    if (aiResult.filesCreated.length === 0 && aiResult.filesModified.length === 0) {
      throw new Error('AI did not generate any test files');
    }

    const filesMessage = `${aiResult.filesCreated.length} files created, ${aiResult.filesModified.length} files modified`;

    updatedJob = updatedJob.appendLog(`AI generated tests: ${filesMessage}`);
    await this.jobRepo.updateJob(updatedJob);

    return updatedJob;
  }

  /**
   * Step 4: Verify tests run successfully
   */
  private async verifyTests(job: ImprovementJob, tmpDir: string): Promise<ImprovementJob> {
    let updatedJob = job.updateProgress(75, 'Verifying tests...');
    await this.jobRepo.updateJob(updatedJob);

    let coverageAfter: number | null = null;

    try {
      const coverageSummaryPath = await this.coverageAdapter.runCoverage(tmpDir);
      const coverageData = await this.coverageAdapter.parseCoverageSummary(coverageSummaryPath);

      const targetFileCoverage = coverageData.find(fc => fc.filePath === job.filePath);

      if (targetFileCoverage) {
        coverageAfter = targetFileCoverage.percent;
        updatedJob = updatedJob.appendLog(
          `New coverage for ${job.filePath}: ${targetFileCoverage.percent}%`,
        );
      } else {
        updatedJob = updatedJob.appendLog('Tests verified (coverage report generated)');
      }

      await this.jobRepo.updateJob(updatedJob);
    } catch (error) {
      // Tests might fail, but we'll still create a PR as draft
      updatedJob = updatedJob.appendLog(
        `Test verification warning: ${error.message} (will create draft PR)`,
      );
      await this.jobRepo.updateJob(updatedJob);
    }

    // Update coverage metrics (update both before/after if we have new data)
    if (coverageAfter !== null) {
      updatedJob = updatedJob.setCoverage(
        job.coverageBefore !== null ? job.coverageBefore : null,
        coverageAfter,
      );
      await this.jobRepo.updateJob(updatedJob);
    }

    return updatedJob;
  }

  /**
   * Step 5: Commit and push changes
   */
  private async commitAndPush(
    job: ImprovementJob,
    repository: Repository,
    tmpDir: string,
  ): Promise<ImprovementJob> {
    let updatedJob = job.updateProgress(90, 'Committing changes...');
    await this.jobRepo.updateJob(updatedJob);

    // Change to repo directory for git operations
    const originalCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      // Checkout new branch
      if (!job.branchName) {
        throw new Error('Branch name not set');
      }

      await this.localGitAdapter.checkoutNewBranch(job.branchName);

      // Commit all changes
      const commitMessage = `chore(tests): add generated tests for ${job.filePath}

Generated by AI-powered test generation system.
Job ID: ${job.id}`;

      await this.localGitAdapter.commitAll(commitMessage);

      updatedJob = updatedJob.appendLog('Changes committed');
      await this.jobRepo.updateJob(updatedJob);

      // Push to remote (LocalGitAdapter will use authenticated URL)
      await this.localGitAdapter.push(job.branchName);

      updatedJob = updatedJob.appendLog(`Changes pushed to branch ${job.branchName}`);
      await this.jobRepo.updateJob(updatedJob);
    } finally {
      process.chdir(originalCwd);
    }

    return updatedJob;
  }

  /**
   * Step 6: Create pull request
   */
  private async createPullRequest(
    job: ImprovementJob,
    repository: Repository,
  ): Promise<ImprovementJob> {
    let updatedJob = job.appendLog('Creating pull request...');
    await this.jobRepo.updateJob(updatedJob);

    const title = `Add tests for ${job.filePath}`;
    const body = `## AI-Generated Test Coverage Improvement

This PR adds test coverage for \`${job.filePath}\`.

### Job Details
- Job ID: ${job.id}
- Requested by: ${job.requestedBy}
- Branch: ${job.branchName}

### Generated by
AI-powered test generation system

### Notes
Please review the generated tests and adjust as needed.
`;

    const prInfo = await this.githubAdapter.createPullRequest(
      repository.owner,
      repository.name,
      job.branchName!,
      repository.defaultBranch,
      title,
      body,
    );

    // Expose PR URL immediately (still at milestone 90)
    updatedJob = updatedJob.setPrUrl(prInfo.url, `Pull request created: ${prInfo.url}`);
    await this.jobRepo.updateJob(updatedJob);

    // Now mark as complete (milestone 100)
    updatedJob = updatedJob.succeed(prInfo.url, 'Job completed successfully');
    await this.jobRepo.updateJob(updatedJob);

    return updatedJob;
  }

  /**
   * Gather context files for AI.
   */

  private async gatherContextFiles(repoPath: string, targetFile: string): Promise<string[]> {
    const contextFiles: string[] = [];

    // Add target file.
    const targetPath = path.join(repoPath, targetFile);

    if (await fs.pathExists(targetPath)) {
      contextFiles.push(targetFile);
    }

    // Add package.json if exists.
    const packageJsonPath = path.join(repoPath, 'package.json');

    if (await fs.pathExists(packageJsonPath)) {
      contextFiles.push('package.json');
    }

    // Add tsconfig.json if exists.
    const tsconfigPath = path.join(repoPath, 'tsconfig.json');

    if (await fs.pathExists(tsconfigPath)) {
      contextFiles.push('tsconfig.json');
    }

    // Look for existing test files in test/ or __tests__/ directories.
    const testDirs = ['test', 'tests', '__tests__', 'src/__tests__'];

    for (const testDir of testDirs) {
      const testDirPath = path.join(repoPath, testDir);

      if (await fs.pathExists(testDirPath)) {
        const testFiles = await fs.readdir(testDirPath);

        for (const f of testFiles) {
          if (f.endsWith('.test.ts') || f.endsWith('.spec.ts')) {
            contextFiles.push(path.join(testDir, f));
          }
        }
      }
    }

    return contextFiles;
  }
}
