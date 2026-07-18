/**
 * Path validation utilities for secure file operations.
 * Prevents path traversal attacks and ensures files are within allowed directories.
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Validates that a file path is within an allowed base directory.
 * Prevents path traversal attacks (e.g., ../../../etc/passwd).
 * 
 * @param filePath - The file path to validate (can be relative or absolute)
 * @param allowedBase - The base directory that the file must be within
 * @returns True if the path is valid and within the allowed base, false otherwise
 * 
 * @example
 * ```typescript
 * const userDataPath = app.getPath('userData');
 * const themePath = path.join(userDataPath, 'themes', 'my-theme.css');
 * if (validatePath(themePath, path.join(userDataPath, 'themes'))) {
 *   // Safe to read file
 * }
 * ```
 */
export function validatePath(filePath: string, allowedBase: string): boolean {
  try {
    // Resolve both paths to absolute paths (collapses all traversal sequences)
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(allowedBase);
    
    // Canonical containment test: the target is inside the base iff the
    // relative path from base to target does not escape upward and is not
    // absolute (a different drive on Windows).
    //
    // This replaces the previous checks which had three real bugs:
    // 1. `resolvedPath.startsWith(resolvedBase)` accepted sibling directories
    //    with a shared prefix (`/base-evil` starts with `/base`).
    // 2. Rejecting any path containing `~` broke ALL Windows 8.3 short paths
    //    (e.g. `C:\Users\LONGUS~1\...`) — `~` is only shell-special as a
    //    leading character and is never expanded by Node's fs.
    // 3. `startsWith` is case-sensitive, but Windows paths are not;
    //    `path.win32.relative` compares case-insensitively.
    const rel = path.relative(resolvedBase, resolvedPath);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  } catch (error) {
    // If path resolution fails, consider it invalid
    return false;
  }
}

/**
 * Validates and sanitizes a filename to prevent directory traversal and invalid characters.
 * 
 * @param fileName - The filename to validate
 * @returns The sanitized filename, or null if invalid
 * 
 * @example
 * ```typescript
 * const safeName = sanitizeFileName('../../../etc/passwd'); // Returns null
 * const safeName2 = sanitizeFileName('my-theme.css'); // Returns 'my-theme.css'
 * ```
 */
export function sanitizeFileName(fileName: string): string | null {
  if (!fileName || typeof fileName !== 'string') {
    return null;
  }
  
  // Remove path separators and traversal sequences
  const sanitized = fileName
    .replace(/[\/\\]/g, '') // Remove path separators
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/~/g, '') // Remove home directory references
    .replace(/[<>:"|?*\x00-\x1f]/g, '') // Remove Windows-reserved + control characters
    .trim();
  
  // Check for empty or invalid filenames after stripping
  if (!sanitized || sanitized.length === 0 || sanitized.length > 255) {
    return null;
  }
  
  return sanitized;
}

/**
 * Validates that a file path exists and is within the allowed base directory.
 * 
 * @param filePath - The file path to validate
 * @param allowedBase - The base directory that the file must be within
 * @returns True if the path is valid, exists, and is within the allowed base
 */
export function validateAndCheckPath(filePath: string, allowedBase: string): boolean {
  if (!validatePath(filePath, allowedBase)) {
    return false;
  }
  
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Safely joins a base path with a relative path, ensuring the result is within the base.
 * 
 * @param basePath - The base directory path
 * @param relativePath - The relative path to join
 * @returns The joined path if valid, null otherwise
 * 
 * @example
 * ```typescript
 * const userDataPath = app.getPath('userData');
 * const safePath = safePathJoin(userDataPath, 'themes/my-theme.css');
 * // Returns: /path/to/userData/themes/my-theme.css
 * 
 * const unsafePath = safePathJoin(userDataPath, '../../../etc/passwd');
 * // Returns: null (path traversal detected)
 * ```
 */
export function safePathJoin(basePath: string, relativePath: string): string | null {
  try {
    // Sanitize the relative path first
    const sanitized = path.normalize(relativePath);
    
    // Check for path traversal — segment-aware, so legitimate filenames
    // containing consecutive dots (e.g. `my..file.txt`) are not rejected
    const hasTraversalSegment = sanitized.split(/[\\/]/).includes('..');
    if (hasTraversalSegment || path.isAbsolute(sanitized)) {
      return null;
    }
    
    // Join paths
    const joinedPath = path.join(basePath, sanitized);
    
    // Validate the result
    if (validatePath(joinedPath, basePath)) {
      return joinedPath;
    }
    
    return null;
  } catch {
    return null;
  }
}

