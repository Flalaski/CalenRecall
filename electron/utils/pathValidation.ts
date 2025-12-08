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
    // Resolve both paths to absolute paths
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(allowedBase);
    
    // Check if the resolved path starts with the resolved base
    // This prevents path traversal attacks
    const isWithinBase = resolvedPath.startsWith(resolvedBase);
    
    // Also check that the path doesn't use path traversal sequences
    const normalizedPath = path.normalize(filePath);
    const hasTraversal = normalizedPath.includes('..') || 
                        normalizedPath.includes('~') ||
                        path.isAbsolute(filePath) && !resolvedPath.startsWith(resolvedBase);
    
    return isWithinBase && !hasTraversal;
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
    .trim();
  
  // Check for empty or invalid filenames
  if (!sanitized || sanitized.length === 0 || sanitized.length > 255) {
    return null;
  }
  
  // Check for invalid characters (Windows reserved characters)
  const invalidChars = /[<>:"|?*\x00-\x1f]/;
  if (invalidChars.test(sanitized)) {
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
    
    // Check for path traversal
    if (sanitized.includes('..') || sanitized.startsWith('/') || sanitized.startsWith('\\')) {
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

