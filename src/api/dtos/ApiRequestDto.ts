import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max, IsEmail } from 'class-validator';

/**
 * API DTO for scanning a repository
 */
export class ScanRepoRequestDto {
  @IsString()
  @IsNotEmpty()
  repoUrl: string;
}

/**
 * API DTO for creating an improvement job
 */
export class CreateJobRequestDto {
  @IsString()
  @IsNotEmpty()
  filePath: string;

  @IsEmail()
  @IsNotEmpty()
  requestedBy: string;
}

/**
 * API DTO for query parameters
 */
export class CoverageQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  threshold?: number;
}
