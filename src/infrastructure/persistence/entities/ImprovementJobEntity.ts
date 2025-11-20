import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('improvement_job')
export class ImprovementJobEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text', { name: 'repository_id' })
  repositoryId: string;

  @Column('text', { name: 'file_path' })
  filePath: string;

  @Column('text', { name: 'requested_by' })
  requestedBy: string;

  @Column('text')
  status: string;

  @Column('integer')
  progress: number;

  @Column('text', { name: 'branch_name', nullable: true })
  branchName: string | null;

  @Column('text', { name: 'pr_url', nullable: true })
  prUrl: string | null;

  @Column('text')
  logs: string;

  @Column('datetime', { name: 'last_log_at', nullable: true })
  lastLogAt: Date | null;

  @Column('real', { name: 'coverage_before', nullable: true })
  coverageBefore: number | null;

  @Column('real', { name: 'coverage_after', nullable: true })
  coverageAfter: number | null;

  @Column('integer', { name: 'attempt_count', default: 0 })
  attemptCount: number;

  @Column('datetime', { name: 'created_at' })
  createdAt: Date;

  @Column('datetime', { name: 'updated_at' })
  updatedAt: Date;
}
