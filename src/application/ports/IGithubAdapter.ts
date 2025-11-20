export interface RepoInfo {
  gitUrl: string;
  defaultBranch: string;
}

export interface PullRequestInfo {
  url: string;
  number: number;
}

export interface IGithubAdapter {
  /**
   * Get repository information including git URL and default branch
   * @param owner Repository owner
   * @param name Repository name
   * @returns Repository information
   */
  getRepo(owner: string, name: string): Promise<RepoInfo>;

  /**
   * Create a new branch in the repository
   * @param owner Repository owner
   * @param repo Repository name
   * @param branchName Name for the new branch
   * @param base Base branch to create from
   */
  createBranch(owner: string, repo: string, branchName: string, base: string): Promise<void>;

  /**
   * Create a pull request
   * @param owner Repository owner
   * @param repo Repository name
   * @param head Head branch (source)
   * @param base Base branch (target)
   * @param title Pull request title
   * @param body Pull request body/description
   * @returns Pull request information
   */
  createPullRequest(
    owner: string,
    repo: string,
    head: string,
    base: string,
    title: string,
    body: string,
  ): Promise<PullRequestInfo>;

  /**
   * Create a commit and push changes to a branch
   * @param owner Repository owner
   * @param repo Repository name
   * @param branchName Branch to commit to
   * @param files Map of file paths to their contents
   */

  createCommitAndPush(
    owner: string,
    repo: string,
    branchName: string,
    files: Map<string, string>,
  ): Promise<void>;

  /**
   * Get authenticated Git URL with embedded credentials.
   * @param owner Repository owner
   * @param repo Repository name
   * @returns Git URL with embedded authentication token
   */

  getAuthenticatedGitUrl(owner: string, repo: string): string;

  /**
   * Get safe Git URL without credentials (safe for logging)
   * @param owner Repository owner
   * @param repo Repository name
   * @returns Git URL without authentication
   */

  getSafeGitUrl(owner: string, repo: string): string;
}
