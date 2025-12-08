/**
 * Tests for path validation utilities
 */

import { validatePath, sanitizeFileName, safePathJoin, validateAndCheckPath } from '../pathValidation';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('pathValidation', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calenrecall-test-'));

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('validatePath', () => {
    it('should validate paths within allowed base directory', () => {
      const baseDir = tempDir;
      const validPath = path.join(baseDir, 'subdir', 'file.txt');
      
      expect(validatePath(validPath, baseDir)).toBe(true);
    });

    it('should reject paths outside allowed base directory', () => {
      const baseDir = tempDir;
      const invalidPath = path.join(baseDir, '..', 'etc', 'passwd');
      
      expect(validatePath(invalidPath, baseDir)).toBe(false);
    });

    it('should reject paths with traversal sequences', () => {
      const baseDir = tempDir;
      const invalidPath = path.join(baseDir, '..', '..', 'etc', 'passwd');
      
      expect(validatePath(invalidPath, baseDir)).toBe(false);
    });

    it('should handle absolute paths correctly', () => {
      const baseDir = tempDir;
      const validPath = path.resolve(baseDir, 'file.txt');
      
      expect(validatePath(validPath, baseDir)).toBe(true);
    });
  });

  describe('sanitizeFileName', () => {
    it('should sanitize valid filenames', () => {
      expect(sanitizeFileName('my-theme.css')).toBe('my-theme.css');
      expect(sanitizeFileName('file123.txt')).toBe('file123.txt');
    });

    it('should remove path separators', () => {
      expect(sanitizeFileName('path/to/file.txt')).toBe('pathtofile.txt');
      expect(sanitizeFileName('path\\to\\file.txt')).toBe('pathtofile.txt');
    });

    it('should remove path traversal sequences', () => {
      expect(sanitizeFileName('../../../etc/passwd')).toBe('etcpasswd');
      expect(sanitizeFileName('..\\..\\..\\windows\\system32')).toBe('windowssystem32');
    });

    it('should remove invalid characters', () => {
      expect(sanitizeFileName('file<>:"|?*.txt')).toBe('file.txt');
    });

    it('should reject empty filenames', () => {
      expect(sanitizeFileName('')).toBeNull();
      expect(sanitizeFileName('   ')).toBeNull();
    });

    it('should reject filenames that are too long', () => {
      const longName = 'a'.repeat(300);
      expect(sanitizeFileName(longName)).toBeNull();
    });

    it('should handle null/undefined', () => {
      expect(sanitizeFileName(null as any)).toBeNull();
      expect(sanitizeFileName(undefined as any)).toBeNull();
    });
  });

  describe('safePathJoin', () => {
    it('should safely join valid paths', () => {
      const baseDir = tempDir;
      const relativePath = 'subdir/file.txt';
      const result = safePathJoin(baseDir, relativePath);
      
      expect(result).toBe(path.join(baseDir, relativePath));
    });

    it('should reject paths with traversal sequences', () => {
      const baseDir = tempDir;
      const relativePath = '../../../etc/passwd';
      const result = safePathJoin(baseDir, relativePath);
      
      expect(result).toBeNull();
    });

    it('should reject absolute paths', () => {
      const baseDir = tempDir;
      const absolutePath = '/etc/passwd';
      const result = safePathJoin(baseDir, absolutePath);
      
      expect(result).toBeNull();
    });

    it('should normalize paths correctly', () => {
      const baseDir = tempDir;
      const relativePath = 'subdir/../file.txt';
      const result = safePathJoin(baseDir, relativePath);
      
      // Should normalize to just 'file.txt' and validate
      expect(result).toBe(path.join(baseDir, 'file.txt'));
    });
  });

  describe('validateAndCheckPath', () => {
    it('should validate and check existing files', () => {
      const baseDir = tempDir;
      const testFile = path.join(baseDir, 'test.txt');
      fs.writeFileSync(testFile, 'test');
      
      expect(validateAndCheckPath(testFile, baseDir)).toBe(true);
      
      fs.unlinkSync(testFile);
    });

    it('should return false for non-existent files', () => {
      const baseDir = tempDir;
      const testFile = path.join(baseDir, 'nonexistent.txt');
      
      expect(validateAndCheckPath(testFile, baseDir)).toBe(false);
    });

    it('should return false for invalid paths', () => {
      const baseDir = tempDir;
      const invalidPath = path.join(baseDir, '..', 'etc', 'passwd');
      
      expect(validateAndCheckPath(invalidPath, baseDir)).toBe(false);
    });
  });
});

