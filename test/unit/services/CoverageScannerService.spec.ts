import { FileCoverage } from '../../../src/domain/entities/FileCoverage';
import { CoverageScannerService } from '../../../src/domain/services/CoverageScannerService';
import { CoverageReport } from '../../../src/domain/value-objects/CoverageReport';

describe('CoverageScannerService', () => {
  let service: CoverageScannerService;

  beforeEach(() => {
    service = new CoverageScannerService();
  });

  describe('getFilesBelowThreshold', () => {
    it('should return files below threshold', () => {
      const files = [
        new FileCoverage('1', 'repo1', 'file1.ts', 50, 50, 100, new Date()),
        new FileCoverage('2', 'repo1', 'file2.ts', 80, 80, 100, new Date()),
        new FileCoverage('3', 'repo1', 'file3.ts', 90, 90, 100, new Date()),
      ];
      const report = new CoverageReport(files, 'repo1', new Date());

      const result = service.getFilesBelowThreshold(report, 75);

      expect(result).toHaveLength(1);
      expect(result[0].filePath).toBe('file1.ts');
    });

    it('should return empty array when all files meet threshold', () => {
      const files = [
        new FileCoverage('1', 'repo1', 'file1.ts', 90, 90, 100, new Date()),
        new FileCoverage('2', 'repo1', 'file2.ts', 95, 95, 100, new Date()),
      ];
      const report = new CoverageReport(files, 'repo1', new Date());

      const result = service.getFilesBelowThreshold(report, 80);

      expect(result).toHaveLength(0);
    });

    it('should throw error for invalid threshold', () => {
      const report = new CoverageReport([], 'repo1', new Date());

      expect(() => service.getFilesBelowThreshold(report, -1)).toThrow(
        'Threshold must be between 0 and 100',
      );
      expect(() => service.getFilesBelowThreshold(report, 101)).toThrow(
        'Threshold must be between 0 and 100',
      );
    });
  });

  describe('requiresImprovement', () => {
    it('should return true when report is below threshold', () => {
      const files = [new FileCoverage('1', 'repo1', 'file1.ts', 50, 50, 100, new Date())];
      const report = new CoverageReport(files, 'repo1', new Date());

      const result = service.requiresImprovement(report, 80);

      expect(result).toBe(true);
    });

    it('should return false when report meets threshold', () => {
      const files = [new FileCoverage('1', 'repo1', 'file1.ts', 85, 85, 100, new Date())];
      const report = new CoverageReport(files, 'repo1', new Date());

      const result = service.requiresImprovement(report, 80);

      expect(result).toBe(false);
    });
  });

  describe('prioritizeFilesForImprovement', () => {
    it('should sort files by coverage ascending', () => {
      const files = [
        new FileCoverage('1', 'repo1', 'file1.ts', 70, 70, 100, new Date()),
        new FileCoverage('2', 'repo1', 'file2.ts', 50, 50, 100, new Date()),
        new FileCoverage('3', 'repo1', 'file3.ts', 60, 60, 100, new Date()),
      ];
      const report = new CoverageReport(files, 'repo1', new Date());

      const result = service.prioritizeFilesForImprovement(report, 80);

      expect(result).toHaveLength(3);
      expect(result[0].coveragePercent).toBe(50);
      expect(result[1].coveragePercent).toBe(60);
      expect(result[2].coveragePercent).toBe(70);
    });

    it('should prioritize by total lines when coverage is equal', () => {
      const files = [
        new FileCoverage('1', 'repo1', 'file1.ts', 50, 25, 50, new Date()),
        new FileCoverage('2', 'repo1', 'file2.ts', 50, 50, 100, new Date()),
        new FileCoverage('3', 'repo1', 'file3.ts', 50, 75, 150, new Date()),
      ];
      const report = new CoverageReport(files, 'repo1', new Date());

      const result = service.prioritizeFilesForImprovement(report, 80);

      expect(result).toHaveLength(3);
      expect(result[0].linesTotal).toBe(150);
      expect(result[1].linesTotal).toBe(100);
      expect(result[2].linesTotal).toBe(50);
    });
  });

  describe('calculateImprovementPotential', () => {
    it('should calculate lines needed to reach threshold', () => {
      const file = new FileCoverage('1', 'repo1', 'file1.ts', 50, 50, 100, new Date());

      const result = service.calculateImprovementPotential(file, 80);

      expect(result).toBe(30); // Need 80 covered lines, currently have 50
    });

    it('should return 0 when file meets threshold', () => {
      const file = new FileCoverage('1', 'repo1', 'file1.ts', 85, 85, 100, new Date());

      const result = service.calculateImprovementPotential(file, 80);

      expect(result).toBe(0);
    });

    it('should handle files with zero lines', () => {
      const file = new FileCoverage('1', 'repo1', 'file1.ts', 0, 0, 0, new Date());

      const result = service.calculateImprovementPotential(file, 80);

      expect(result).toBe(0);
    });

    it('should round up fractional lines needed', () => {
      const file = new FileCoverage('1', 'repo1', 'file1.ts', 70, 70, 99, new Date());

      // Need 79.2 lines for 80%, should round up to 80
      const result = service.calculateImprovementPotential(file, 80);

      expect(result).toBe(10); // 80 - 70 = 10
    });
  });

  describe('estimateImprovementEffort', () => {
    it('should calculate effort percentage', () => {
      const file = new FileCoverage('1', 'repo1', 'file1.ts', 50, 50, 100, new Date());

      const result = service.estimateImprovementEffort(file, 80);

      // Need 30 more lines out of 100 total = 30% effort
      expect(result).toBe(30);
    });

    it('should return 0 when file meets threshold', () => {
      const file = new FileCoverage('1', 'repo1', 'file1.ts', 85, 85, 100, new Date());

      const result = service.estimateImprovementEffort(file, 80);

      expect(result).toBe(0);
    });

    it('should cap effort at 100', () => {
      const file = new FileCoverage('1', 'repo1', 'file1.ts', 0, 0, 100, new Date());

      const result = service.estimateImprovementEffort(file, 80);

      expect(result).toBe(80);
    });
  });

  describe('filterByMinimumLines', () => {
    it('should filter files below minimum lines', () => {
      const files = [
        new FileCoverage('1', 'repo1', 'file1.ts', 50, 5, 10, new Date()),
        new FileCoverage('2', 'repo1', 'file2.ts', 50, 50, 100, new Date()),
        new FileCoverage('3', 'repo1', 'file3.ts', 50, 25, 50, new Date()),
      ];

      const result = service.filterByMinimumLines(files, 50);

      expect(result).toHaveLength(2);
      expect(result[0].filePath).toBe('file2.ts');
      expect(result[1].filePath).toBe('file3.ts');
    });

    it('should throw error for negative minimum', () => {
      expect(() => service.filterByMinimumLines([], -1)).toThrow(
        'Minimum lines must be non-negative',
      );
    });
  });

  describe('groupFilesByCoverageRange', () => {
    it('should group files into correct coverage ranges', () => {
      const files = [
        new FileCoverage('1', 'repo1', 'file1.ts', 10, 10, 100, new Date()),
        new FileCoverage('2', 'repo1', 'file2.ts', 30, 30, 100, new Date()),
        new FileCoverage('3', 'repo1', 'file3.ts', 50, 50, 100, new Date()),
        new FileCoverage('4', 'repo1', 'file4.ts', 70, 70, 100, new Date()),
        new FileCoverage('5', 'repo1', 'file5.ts', 90, 90, 100, new Date()),
        new FileCoverage('6', 'repo1', 'file6.ts', 100, 100, 100, new Date()),
      ];

      const result = service.groupFilesByCoverageRange(files);

      expect(result.get('0-20%')).toHaveLength(1);
      expect(result.get('21-40%')).toHaveLength(1);
      expect(result.get('41-60%')).toHaveLength(1);
      expect(result.get('61-80%')).toHaveLength(1);
      expect(result.get('81-99%')).toHaveLength(1);
      expect(result.get('100%')).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const result = service.groupFilesByCoverageRange([]);

      expect(result.get('0-20%')).toHaveLength(0);
      expect(result.get('21-40%')).toHaveLength(0);
      expect(result.get('41-60%')).toHaveLength(0);
      expect(result.get('61-80%')).toHaveLength(0);
      expect(result.get('81-99%')).toHaveLength(0);
      expect(result.get('100%')).toHaveLength(0);
    });

    it('should handle boundary values correctly', () => {
      const files = [
        new FileCoverage('1', 'repo1', 'file1.ts', 20, 20, 100, new Date()),
        new FileCoverage('2', 'repo1', 'file2.ts', 21, 21, 100, new Date()),
      ];

      const result = service.groupFilesByCoverageRange(files);

      expect(result.get('0-20%')).toHaveLength(1);
      expect(result.get('21-40%')).toHaveLength(1);
    });
  });
});
