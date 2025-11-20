import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { ListCoverageFilesUseCase } from '../../application/use-cases/ListCoverageFilesUseCase';
import { RequestImproveFileUseCase } from '../../application/use-cases/RequestImproveFileUseCase';
import { ScanRepositoryUseCase } from '../../application/use-cases/ScanRepositoryUseCase';
import { CreateJobRequestDto } from '../dtos';

@Controller('repos/:owner/:repo')
export class CoverageController {
  constructor(
    private readonly listCoverageFilesUseCase: ListCoverageFilesUseCase,
    private readonly scanRepositoryUseCase: ScanRepositoryUseCase,
    private readonly requestImproveFileUseCase: RequestImproveFileUseCase,
  ) {}

  /**
   * GET /repos/:owner/:repo/coverage?threshold=80
   * Returns file coverage list filtered by threshold.
   */

  @Get('coverage')
  async getCoverage(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @Query('threshold') threshold?: string,
  ) {
    try {
      const thresholdValue = threshold ? parseInt(threshold, 10) : undefined;

      const files = await this.listCoverageFilesUseCase.execute({
        owner,
        repo,
        threshold: thresholdValue,
      });

      return {
        success: true,
        data: {
          repository: `${owner}/${repo}`,
          threshold: thresholdValue,
          count: files.length,
          files,
        },
      };
    } catch (error) {
      throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /repos/:owner/:repo/improve
   * Creates an improvement job for a specific file.
   */

  @Post('improve')
  async createImprovementJob(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
    @Body() body: CreateJobRequestDto,
  ) {
    try {
      const job = await this.requestImproveFileUseCase.execute({
        owner,
        repo,
        filePath: body.filePath,
        requestedBy: body.requestedBy,
      });

      return {
        data: {
          filePath: job.filePath,
          jobId: job.id,
          message:
            'Improvement job created successfully. The worker will process it automatically.',
          status: job.status,
        },
        success: true,
      };
    } catch (error) {
      throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /repos/:owner/:repo/scan
   * Triggers a coverage scan for the repository.
   */

  @Post('scan')
  async scanRepository(@Param('owner') owner: string, @Param('repo') repo: string) {
    try {
      const repoUrl = `${owner}/${repo}`;
      const result = await this.scanRepositoryUseCase.execute({ repoUrl });

      return { data: result, success: true };
    } catch (error) {
      throw new HttpException({ success: false, error: error.message }, HttpStatus.BAD_REQUEST);
    }
  }
}
