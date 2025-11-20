import { Injectable } from '@nestjs/common';
import simpleGit, { SimpleGit } from 'simple-git';

import { ILocalGitAdapter } from '../../application/ports/ILocalGitAdapter';
import { SecureLogger } from '../utils/logger';

@Injectable()
export class LocalGitAdapter implements ILocalGitAdapter {
  private readonly logger = new SecureLogger(LocalGitAdapter.name);
  private git: SimpleGit | null = null;
  private currentRepoPath: string | null = null;

  private getGit(repoPath?: string): SimpleGit {
    if (repoPath && repoPath !== this.currentRepoPath) {
      this.currentRepoPath = repoPath;
      this.git = simpleGit(repoPath);
    } else if (!this.git) {
      throw new Error('Git instance not initialized. Clone a repository first.');
    }
    return this.git;
  }

  async cloneRepo(gitUrl: string, targetPath: string, token?: string): Promise<void> {
    // Log safe version (redaction will handle any embedded tokens)
    this.logger.log(`Cloning repository to ${targetPath}`);

    try {
      let authenticatedUrl = gitUrl;

      if (token) {
        const url = new URL(gitUrl);
        if (url.protocol === 'https:') {
          // Use x-access-token format for GitHub.
          url.username = 'x-access-token';
          url.password = token;
          authenticatedUrl = url.toString();
        }
      }

      // Create a temporary git instance for cloning.
      const git = simpleGit();
      await git.clone(authenticatedUrl, targetPath);

      // Initialize git instance for this repo.
      this.currentRepoPath = targetPath;
      this.git = simpleGit(targetPath);

      this.logger.log('Repository cloned successfully');
    } catch (error) {
      this.logger.error('Failed to clone repository', error.message);
      throw error;
    }
  }

  async checkoutNewBranch(branchName: string): Promise<void> {
    this.logger.log(`Creating and checking out new branch: ${branchName}`);

    try {
      const git = this.getGit();
      await git.checkoutLocalBranch(branchName);

      this.logger.log(`Branch ${branchName} created and checked out`);
    } catch (error) {
      this.logger.error(`Failed to checkout new branch: ${error.message}`);
      throw error;
    }
  }

  async commitAll(message: string): Promise<void> {
    this.logger.log(`Committing all changes with message: "${message}"`);

    try {
      const git = this.getGit();

      // Stage all changes
      await git.add('.');

      // Commit
      await git.commit(message);

      this.logger.log('Changes committed successfully');
    } catch (error) {
      this.logger.error(`Failed to commit changes: ${error.message}`);
      throw error;
    }
  }

  async push(branchName: string, token?: string): Promise<void> {
    this.logger.log(`Pushing branch ${branchName} to remote`);

    try {
      const git = this.getGit();

      // If token is provided, configure remote URL with authentication
      // Uses x-access-token format for GitHub
      if (token) {
        const remotes = await git.getRemotes(true);
        const origin = remotes.find(r => r.name === 'origin');

        if (origin && origin.refs.push) {
          const url = new URL(origin.refs.push);
          if (url.protocol === 'https:') {
            url.username = 'x-access-token';
            url.password = token;

            // Update remote with authenticated URL
            // Note: This URL is never logged due to SecureLogger redaction
            await git.removeRemote('origin');
            await git.addRemote('origin', url.toString());
          }
        }
      }

      // Push the branch
      await git.push('origin', branchName, ['--set-upstream']);

      this.logger.log(`Branch ${branchName} pushed successfully`);
    } catch (error) {
      this.logger.error('Failed to push branch', error.message);
      throw error;
    }
  }

  /**
   * Set the working directory for git operations
   * Useful when switching between repositories
   */
  setWorkingDirectory(repoPath: string): void {
    this.currentRepoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Get the current working directory
   */
  getWorkingDirectory(): string | null {
    return this.currentRepoPath;
  }
}
