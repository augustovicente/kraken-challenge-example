import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('file_coverage')
export class FileCoverageEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text', { name: 'repository_id' })
  repositoryId: string;

  @Column('text', { name: 'file_path' })
  filePath: string;

  @Column('real', { name: 'coverage_percent' })
  coveragePercent: number;

  @Column('integer', { name: 'lines_covered' })
  linesCovered: number;

  @Column('integer', { name: 'lines_total' })
  linesTotal: number;

  @Column('datetime', { name: 'last_measured_at' })
  lastMeasuredAt: Date;
}
