import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';

import { Injectable, Logger } from '@nestjs/common';

import { ICoverageAdapter, FileCoverageData } from '../../application/ports/ICoverageAdapter';

const execAsync = promisify(exec);

@Injectable()
export class CoverageAdapter implements ICoverageAdapter {
  private readonly logger = new Logger(CoverageAdapter.name);

  async runCoverage(repoPath: string): Promise<string> {
    this.logger.log(`Running coverage tests in ${repoPath}`);

    try {
      // First, install dependencies if needed.
      await this.ensureDependencies(repoPath);

      // Check if there's a coverage script in package.json.
      const hasCustomCoverageScript = await this.hasCoverageScript(repoPath);

      let command: string;
      if (hasCustomCoverageScript) {
        command = 'npm run coverage';
      } else {
        // Use nyc with default configuration.
        command = 'npx nyc --reporter=json-summary --reporter=text npm test';
      }

      this.logger.log(`Executing: ${command}`);

      const { stdout, stderr } = await execAsync(command, {
        cwd: repoPath,
        // 10MB buffer.
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
      });

      if (stdout) {
        this.logger.debug(`Coverage stdout: ${stdout}`);
      }
      if (stderr) {
        this.logger.warn(`Coverage stderr: ${stderr}`);
      }

      // Return the path to coverage summary.
      const coverageSummaryPath = path.join(repoPath, 'coverage', 'coverage-summary.json');

      // Verify the file exists.
      try {
        await fs.access(coverageSummaryPath);
      } catch (error) {
        throw new Error(
          `Coverage summary not found at ${coverageSummaryPath}. Coverage run may have failed. Error: ${error.message}`,
        );
      }

      this.logger.log('Coverage tests completed successfully');

      return coverageSummaryPath;
    } catch (error) {
      this.logger.error(`Failed to run coverage: ${error.message}`);
      throw error;
    }
  }

  async parseCoverageSummary(pathToSummary: string): Promise<FileCoverageData[]> {
    this.logger.log(`Parsing coverage summary from ${pathToSummary}`);

    try {
      const content = await fs.readFile(pathToSummary, 'utf-8');
      const coverageData = JSON.parse(content);
      const results: FileCoverageData[] = [];

      // Iterate through each file in the coverage report.
      for (const [filePath, data] of Object.entries(coverageData)) {
        // Skip the 'total' entry.
        if (filePath === 'total') {
          continue;
        }

        const lines = data['lines'] || {};

        results.push({
          filePath,
          percent: lines.pct || 0,
          linesCovered: lines.covered || 0,
          linesTotal: lines.total || 0,
        });
      }

      this.logger.log(`Parsed coverage for ${results.length} files`);

      return results;
    } catch (error) {
      this.logger.error(`Failed to parse coverage summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure dependencies are installed
   */
  private async ensureDependencies(repoPath: string): Promise<void> {
    try {
      const nodeModulesPath = path.join(repoPath, 'node_modules');

      // Check if node_modules exists
      try {
        await fs.access(nodeModulesPath);
        this.logger.log('Dependencies already installed');
        return;
      } catch {
        // Node_modules doesn't exist, need to install
      }

      this.logger.log('Installing dependencies...');
      const { stderr } = await execAsync('npm ci', {
        cwd: repoPath,
        // 10MB buffer.
        maxBuffer: 10 * 1024 * 1024,
      });

      if (stderr) {
        this.logger.warn(`npm ci stderr: ${stderr}`);
      }

      this.logger.log('Dependencies installed successfully');
    } catch (error) {
      // If npm ci fails, try npm install as fallback
      this.logger.warn(`npm ci failed, trying npm install: ${error.message}`);
      try {
        await execAsync('npm install', {
          cwd: repoPath,
          maxBuffer: 10 * 1024 * 1024,
        });
        this.logger.log('Dependencies installed via npm install');
      } catch (installError) {
        this.logger.error(`Failed to install dependencies: ${installError.message}`);
        throw installError;
      }
    }
  }

  /**
   * Check if package.json has a coverage script
   */
  private async hasCoverageScript(repoPath: string): Promise<boolean> {
    try {
      const packageJsonPath = path.join(repoPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      return !!(packageJson.scripts && packageJson.scripts.coverage);
    } catch (error) {
      this.logger.warn(`Could not read package.json: ${error.message}`);
      return false;
    }
  }
}
