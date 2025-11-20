/**
 * AiRunResult Value Object
 * Represents the result of running an AI test generation CLI
 */
export class AiRunResult {
  constructor(
    public readonly filesCreated: ReadonlyArray<string>,
    public readonly filesModified: ReadonlyArray<string>,
    public readonly error: string | null = null,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.filesCreated) {
      throw new Error('AiRunResult filesCreated is required');
    }
    if (!this.filesModified) {
      throw new Error('AiRunResult filesModified is required');
    }
  }

  /**
   * Creates a successful AI run result
   */
  public static success(filesCreated: string[], filesModified: string[]): AiRunResult {
    return new AiRunResult(filesCreated, filesModified, null);
  }

  /**
   * Creates a failed AI run result
   */
  public static failure(error: string): AiRunResult {
    return new AiRunResult([], [], error);
  }

  /**
   * Checks if the AI run was successful
   */
  public isSuccessful(): boolean {
    return this.error === null;
  }

  /**
   * Checks if the AI run failed
   */
  public isFailed(): boolean {
    return this.error !== null;
  }

  /**
   * Gets the total number of files affected
   */
  public getTotalFilesAffected(): number {
    return this.filesCreated.length + this.filesModified.length;
  }

  /**
   * Checks if any files were created
   */
  public hasCreatedFiles(): boolean {
    return this.filesCreated.length > 0;
  }

  /**
   * Checks if any files were modified
   */
  public hasModifiedFiles(): boolean {
    return this.filesModified.length > 0;
  }

  /**
   * Checks if any changes were made
   */
  public hasChanges(): boolean {
    return this.hasCreatedFiles() || this.hasModifiedFiles();
  }

  /**
   * Gets all affected file paths
   */
  public getAllAffectedFiles(): string[] {
    return [...this.filesCreated, ...this.filesModified];
  }

  /**
   * Gets a summary string describing the result
   */
  public getSummary(): string {
    if (this.isFailed()) {
      return `Failed: ${this.error}`;
    }

    const parts: string[] = [];
    if (this.filesCreated.length > 0) {
      parts.push(`${this.filesCreated.length} file(s) created`);
    }
    if (this.filesModified.length > 0) {
      parts.push(`${this.filesModified.length} file(s) modified`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No changes made';
  }

  /**
   * Creates a detailed report object
   */
  public getReport() {
    return {
      successful: this.isSuccessful(),
      totalFilesAffected: this.getTotalFilesAffected(),
      filesCreated: [...this.filesCreated],
      filesModified: [...this.filesModified],
      error: this.error,
      summary: this.getSummary(),
    };
  }
}
