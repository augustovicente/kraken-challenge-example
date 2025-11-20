import { Repository } from '../../domain/entities/Repository';

/**
 * Repository interface for Repository entity persistence operations.
 */

export interface IRepositoryRepo {
  /**
   * Saves a new repository.
   */

  saveRepo(repo: Repository): Promise<void>;

  /**
   * Finds a repository by its ID.
   */

  findById(id: string): Promise<Repository | null>;

  /**
   * Upserts a repository (insert or update).
   */

  upsert(repo: Repository): Promise<void>;
}
