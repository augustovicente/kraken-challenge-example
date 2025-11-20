#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * CLI entry point for coverage improvement system
 * Usage: npm run cli <command> [options]
 */

import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Command } from 'commander';

import { AppModule } from '../app.module';
import { GetJobStatusUseCase } from '../application/use-cases/GetJobStatusUseCase';
import { ListCoverageFilesUseCase } from '../application/use-cases/ListCoverageFilesUseCase';
import { ListJobsUseCase } from '../application/use-cases/ListJobsUseCase';
import { RequestImproveFileUseCase } from '../application/use-cases/RequestImproveFileUseCase';
import { ScanRepositoryUseCase } from '../application/use-cases/ScanRepositoryUseCase';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const program = new Command();

  program
    .name('coverage-cli')
    .description('CLI tool for TypeScript coverage improvement system')
    .version('1.0.0');

  // Scan command
  program
    .command('scan')
    .description('Scan repository coverage')
    .requiredOption(
      '--repo <url>',
      'Repository URL (e.g., owner/repo or https://github.com/owner/repo)',
    )
    .action(async options => {
      try {
        const scanUseCase = app.get(ScanRepositoryUseCase);
        console.log(`🔍 Scanning repository: ${options.repo}...`);

        const result = await scanUseCase.execute({ repoUrl: options.repo });

        console.log('\n✅ Scan complete!');
        console.log(`Repository: ${result.owner}/${result.name}`);
        console.log(`Files scanned: ${result.filesScanned}`);
        console.log(`Files below threshold (${result.threshold}%): ${result.filesBelowThreshold}`);
        console.log(`Scanned at: ${result.scannedAt.toISOString()}`);
      } catch (error) {
        console.error('❌ Scan failed:', error.message);
        process.exit(1);
      }
    });

  // List command
  program
    .command('list')
    .description('List low-coverage files')
    .requiredOption('--repo <owner/repo>', 'Repository in format owner/repo')
    .option('--threshold <number>', 'Coverage threshold (default: 80)', '80')
    .action(async options => {
      try {
        const [owner, repo] = options.repo.split('/');
        if (!owner || !repo) {
          throw new Error('Repository must be in format owner/repo');
        }

        const listUseCase = app.get(ListCoverageFilesUseCase);
        const threshold = parseInt(options.threshold, 10);

        console.log(`📋 Listing files below ${threshold}% coverage for ${owner}/${repo}...`);

        const files = await listUseCase.execute({ owner, repo, threshold });

        if (files.length === 0) {
          console.log('\n✅ All files meet the coverage threshold!');
        } else {
          console.log(`\n📊 Found ${files.length} file(s) below threshold:\n`);
          files.forEach(file => {
            console.log(`  ${file.filePath}`);
            console.log(`    Coverage: ${file.coveragePercent.toFixed(2)}%`);
            console.log(`    Lines: ${file.linesCovered}/${file.linesTotal}`);
            console.log('');
          });
        }
      } catch (error) {
        console.error('❌ List failed:', error.message);
        process.exit(1);
      }
    });

  // Improve command
  program
    .command('improve')
    .description('Create improvement job for a specific file')
    .requiredOption('--repo <owner/repo>', 'Repository in format owner/repo')
    .requiredOption('--file <path>', 'File path to improve')
    .requiredOption('--user <email>', 'Email of user requesting improvement')
    .action(async options => {
      try {
        const [owner, repo] = options.repo.split('/');
        if (!owner || !repo) {
          throw new Error('Repository must be in format owner/repo');
        }

        const improveUseCase = app.get(RequestImproveFileUseCase);

        console.log(`🚀 Creating improvement job for ${options.file} in ${owner}/${repo}...`);

        const job = await improveUseCase.execute({
          owner,
          repo,
          filePath: options.file,
          requestedBy: options.user,
        });

        console.log('\n✅ Improvement job created!');
        console.log(`Job ID: ${job.id}`);
        console.log(`Status: ${job.status}`);
        console.log(`File: ${job.filePath}`);
        console.log(`Requested by: ${job.requestedBy}`);
        console.log('\nThe worker will process this job automatically.');
      } catch (error) {
        console.error('❌ Improvement request failed:', error.message);
        process.exit(1);
      }
    });

  // Job status command
  program
    .command('job')
    .description('Get job status and details')
    .requiredOption('--id <jobId>', 'Job ID')
    .action(async options => {
      try {
        const jobUseCase = app.get(GetJobStatusUseCase);

        console.log(`📝 Fetching job ${options.id}...`);

        const job = await jobUseCase.execute(options.id);

        console.log('\nJob Details:');
        console.log(`  ID: ${job.id}`);
        console.log(`  Repository: ${job.repositoryId}`);
        console.log(`  File: ${job.filePath}`);
        console.log(`  Status: ${job.status}`);
        console.log(`  Progress: ${job.progress}%`);
        console.log(`  Requested by: ${job.requestedBy}`);
        console.log(`  Attempts: ${job.attemptCount}`);
        console.log(`  Created: ${job.createdAt.toISOString()}`);
        console.log(`  Updated: ${job.updatedAt.toISOString()}`);

        if (job.branchName) {
          console.log(`  Branch: ${job.branchName}`);
        }

        if (job.prUrl) {
          console.log(`  Pull Request: ${job.prUrl}`);
        }

        if (job.logs.trim()) {
          console.log('\nLogs:');
          console.log(job.logs);
        }
      } catch (error) {
        console.error('❌ Failed to get job:', error.message);
        process.exit(1);
      }
    });

  // List jobs command
  program
    .command('jobs:list')
    .description('List all jobs')
    .option('--repo <owner/repo>', 'Filter by repository')
    .action(async options => {
      try {
        const listJobsUseCase = app.get(ListJobsUseCase);

        let repositoryId: string | undefined;
        if (options.repo) {
          repositoryId = options.repo;
          console.log(`📋 Listing jobs for ${repositoryId}...`);
        } else {
          console.log('📋 Listing all jobs...');
        }

        const jobs = await listJobsUseCase.execute(repositoryId);

        if (jobs.length === 0) {
          console.log('\n✅ No jobs found.');
        } else {
          console.log(`\n📊 Found ${jobs.length} job(s):\n`);
          jobs.forEach(job => {
            console.log(`  [${job.id}]`);
            console.log(`    Repository: ${job.repositoryId}`);
            console.log(`    File: ${job.filePath}`);
            console.log(`    Status: ${job.status} (${job.progress}%)`);
            console.log(`    Created: ${job.createdAt.toISOString()}`);
            if (job.prUrl) {
              console.log(`    PR: ${job.prUrl}`);
            }
            console.log('');
          });
        }
      } catch (error) {
        console.error('❌ Failed to list jobs:', error.message);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
  await app.close();
}

bootstrap().catch(error => {
  console.error('CLI Error:', error);
  process.exit(1);
});
