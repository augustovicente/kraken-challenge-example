import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/rest';

import { IGithubAdapter, RepoInfo, PullRequestInfo } from '../../application/ports/IGithubAdapter';
import { SecureLogger } from '../utils/logger';

@Injectable()
export class GithubAdapter implements IGithubAdapter {
  private readonly logger = new SecureLogger(GithubAdapter.name);
  private readonly octokit: Octokit;
  private readonly token: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN;
    if (!this.token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    this.octokit = new Octokit({
      auth: this.token,
    });

    // Log initialization without exposing token
    this.logger.log('GitHub adapter initialized successfully');
  }

  /**
   * Get authenticated Git URL with token embedded.
   * Uses x-access-token format for GitHub authentication
   */

  getAuthenticatedGitUrl(owner: string, repo: string): string {
    return `https://x-access-token:${this.token}@github.com/${owner}/${repo}.git`;
  }

  /**
   * Get safe Git URL for logging (without credentials)
   */

  getSafeGitUrl(owner: string, repo: string): string {
    return `https://github.com/${owner}/${repo}.git`;
  }

  async getRepo(owner: string, name: string): Promise<RepoInfo> {
    this.logger.log(`Fetching repository info for ${owner}/${name}`);

    try {
      const { data } = await this.octokit.repos.get({
        owner,
        repo: name,
      });

      return {
        gitUrl: data.clone_url,
        defaultBranch: data.default_branch,
      };
    } catch (error) {
      this.logger.error(`Failed to get repository ${owner}/${name}: ${error.message}`);
      throw error;
    }
  }

  async createBranch(owner: string, repo: string, branchName: string, base: string): Promise<void> {
    this.logger.log(`Creating branch ${branchName} from ${base} in ${owner}/${repo}`);

    try {
      // Get the base branch reference
      const { data: baseRef } = await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${base}`,
      });

      // Create new branch from base SHA
      await this.octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: baseRef.object.sha,
      });

      this.logger.log(`Branch ${branchName} created successfully`);
    } catch (error) {
      this.logger.error(`Failed to create branch ${branchName}: ${error.message}`);
      throw error;
    }
  }

  async createPullRequest(
    owner: string,
    repo: string,
    head: string,
    base: string,
    title: string,
    body: string,
  ): Promise<PullRequestInfo> {
    this.logger.log(`Creating pull request in ${owner}/${repo}: ${head} -> ${base}`);

    try {
      const { data } = await this.octokit.pulls.create({
        owner,
        repo,
        head,
        base,
        title,
        body,
      });

      this.logger.log(`Pull request created: #${data.number}`);

      return {
        url: data.html_url,
        number: data.number,
      };
    } catch (error) {
      this.logger.error(`Failed to create pull request: ${error.message}`);
      throw error;
    }
  }

  async createCommitAndPush(
    owner: string,
    repo: string,
    branchName: string,
    files: Map<string, string>,
  ): Promise<void> {
    this.logger.log(
      `Creating commit with ${files.size} file(s) on ${branchName} in ${owner}/${repo}`,
    );

    try {
      // Get the current commit SHA of the branch
      const { data: ref } = await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
      });
      const currentCommitSha = ref.object.sha;

      // Get the current tree
      const { data: currentCommit } = await this.octokit.git.getCommit({
        owner,
        repo,
        commit_sha: currentCommitSha,
      });
      const currentTreeSha = currentCommit.tree.sha;

      // Create blobs for each file
      const blobs = await Promise.all(
        Array.from(files.entries()).map(async ([path, content]) => {
          const { data: blob } = await this.octokit.git.createBlob({
            owner,
            repo,
            content: Buffer.from(content).toString('base64'),
            encoding: 'base64',
          });
          return { path, sha: blob.sha };
        }),
      );

      // Create a new tree with the blobs
      const { data: newTree } = await this.octokit.git.createTree({
        owner,
        repo,
        base_tree: currentTreeSha,
        tree: blobs.map(blob => ({
          path: blob.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha,
        })),
      });

      // Create a new commit
      const { data: newCommit } = await this.octokit.git.createCommit({
        owner,
        repo,
        message: `Add generated test files`,
        tree: newTree.sha,
        parents: [currentCommitSha],
      });

      // Update the branch reference to the new commit
      await this.octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
        sha: newCommit.sha,
      });

      this.logger.log(`Commit created and pushed successfully: ${newCommit.sha}`);
    } catch (error) {
      this.logger.error(`Failed to create commit and push: ${error.message}`);
      throw error;
    }
  }
}
