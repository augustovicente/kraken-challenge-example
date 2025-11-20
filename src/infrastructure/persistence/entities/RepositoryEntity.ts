import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('repo')
export class RepositoryEntity {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  owner: string;

  @Column('text')
  name: string;

  @Column('text', { name: 'git_url' })
  gitUrl: string;

  @Column('text', { name: 'default_branch' })
  defaultBranch: string;

  @Column('datetime', { name: 'last_scanned_at', nullable: true })
  lastScannedAt: Date | null;
}
