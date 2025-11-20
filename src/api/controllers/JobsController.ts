import { Controller, Get, Param, HttpStatus, HttpException } from '@nestjs/common';

import { GetJobStatusUseCase } from '../../application/use-cases/GetJobStatusUseCase';
import { ListJobsUseCase } from '../../application/use-cases/ListJobsUseCase';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly getJobStatusUseCase: GetJobStatusUseCase,
    private readonly listJobsUseCase: ListJobsUseCase,
  ) {}

  /**
   * GET /jobs/:id
   * Returns job status, progress, logs, and PR URL
   */
  @Get(':id')
  async getJob(@Param('id') id: string) {
    try {
      const job = await this.getJobStatusUseCase.execute(id);

      return {
        success: true,
        data: job,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }
}

@Controller('repos/:owner/:repo')
export class RepoJobsController {
  constructor(private readonly listJobsUseCase: ListJobsUseCase) {}

  /**
   * GET /repos/:owner/:repo/jobs
   * Lists recent jobs for a repository
   */
  @Get('jobs')
  async getRepoJobs(@Param('owner') owner: string, @Param('repo') repo: string) {
    try {
      const repositoryId = `${owner}/${repo}`;
      const jobs = await this.listJobsUseCase.execute(repositoryId);

      return {
        success: true,
        data: {
          repository: repositoryId,
          count: jobs.length,
          jobs,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
