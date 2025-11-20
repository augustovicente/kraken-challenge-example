export interface ILocalGitAdapter {
  /**
   * Clone a repository to a target path
   * @param gitUrl Git repository URL
   * @param targetPath Local path to clone to
   * @param token Optional authentication token
   */

  cloneRepo(gitUrl: string, targetPath: string, token?: string): Promise<void>;

  /**
   * Create and checkout a new branch
   * @param branchName Name of the new branch
   */

  checkoutNewBranch(branchName: string): Promise<void>;

  /**
   * Stage and commit all changes
   * @param message Commit message
   */

  commitAll(message: string): Promise<void>;

  /**
   * Push changes to remote
   * @param branchName Branch to push
   * @param token Optional authentication token
   */

  push(branchName: string, token?: string): Promise<void>;
}
