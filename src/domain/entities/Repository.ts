/**
 * Repository Entity
 * Represents a GitHub repository being monitored for test coverage
 */
export class Repository {
  constructor(
    public readonly id: string,
    public readonly owner: string,
    public readonly name: string,
    public readonly defaultBranch: string,
    public readonly gitUrl: string,
    public readonly lastScannedAt: Date | null = null,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.id || this.id.trim() === '') {
      throw new Error('Repository id is required');
    }
    if (!this.owner || this.owner.trim() === '') {
      throw new Error('Repository owner is required');
    }
    if (!this.name || this.name.trim() === '') {
      throw new Error('Repository name is required');
    }
    if (!this.defaultBranch || this.defaultBranch.trim() === '') {
      throw new Error('Repository defaultBranch is required');
    }
    if (!this.gitUrl || this.gitUrl.trim() === '') {
      throw new Error('Repository gitUrl is required');
    }
  }

  /**
   * Gets the full repository name (owner/name)
   */
  public getFullName(): string {
    return `${this.owner}/${this.name}`;
  }

  /**
   * Creates a new Repository instance with updated lastScannedAt timestamp
   */
  public updateLastScanned(timestamp: Date): Repository {
    return new Repository(
      this.id,
      this.owner,
      this.name,
      this.defaultBranch,
      this.gitUrl,
      timestamp,
    );
  }

  /**
   * Checks if the repository has been scanned before
   */
  public hasBeenScanned(): boolean {
    return this.lastScannedAt !== null;
  }
}
