import * as crypto from 'crypto';

/**
 * Configuration for password hashing
 */
const SALT_LENGTH = 32; // 32 bytes = 256 bits
const ITERATIONS = 100000; // PBKDF2 iterations (high enough for security, reasonable for performance)
const KEY_LENGTH = 64; // 64 bytes = 512 bits
const HASH_ALGORITHM = 'sha512';

/**
 * Configuration for recovery keys
 */
const RECOVERY_KEY_LENGTH = 32; // 32 bytes = 256 bits
const RECOVERY_KEY_FORMAT = 'base64'; // Base64 encoding for readability

/**
 * Hash a password using PBKDF2
 * Returns a string in format: salt:hash (both base64 encoded)
 * 
 * @param password - Plain text password to hash
 * @returns Hashed password string (salt:hash)
 */
export function hashPassword(password: string): string {
  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  // Generate a random salt
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  // Hash the password with PBKDF2
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    HASH_ALGORITHM
  );

  // Return salt:hash as base64 strings
  return `${salt.toString('base64')}:${hash.toString('base64')}`;
}

/**
 * Verify a password against a stored hash
 * 
 * @param password - Plain text password to verify
 * @param storedHash - Stored hash in format salt:hash
 * @returns True if password matches, false otherwise
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || password.length === 0) {
    return false;
  }

  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }

  try {
    // Split salt and hash
    const [saltBase64, hashBase64] = storedHash.split(':');
    
    if (!saltBase64 || !hashBase64) {
      return false;
    }

    // Decode salt and hash from base64
    const salt = Buffer.from(saltBase64, 'base64');
    const storedHashBuffer = Buffer.from(hashBase64, 'base64');

    // Hash the provided password with the same salt
    const computedHash = crypto.pbkdf2Sync(
      password,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      HASH_ALGORITHM
    );

    // Compare hashes using timing-safe comparison
    return crypto.timingSafeEqual(computedHash, storedHashBuffer);
  } catch (error) {
    console.error('[Password Utils] Error verifying password:', error);
    return false;
  }
}

/**
 * Check if a string is a valid password hash format
 * 
 * @param hash - String to check
 * @returns True if string appears to be a valid hash format
 */
export function isValidHashFormat(hash: string): boolean {
  if (!hash || typeof hash !== 'string') {
    return false;
  }

  const parts = hash.split(':');
  if (parts.length !== 2) {
    return false;
  }

  // Check if both parts are valid base64
  try {
    Buffer.from(parts[0], 'base64');
    Buffer.from(parts[1], 'base64');
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a recovery key for password recovery
 * Returns a base64-encoded random string that can be used to reset the password
 * 
 * @returns Recovery key string (base64 encoded)
 */
export function generateRecoveryKey(): string {
  const keyBytes = crypto.randomBytes(RECOVERY_KEY_LENGTH);
  return keyBytes.toString(RECOVERY_KEY_FORMAT);
}

/**
 * Hash a recovery key using the same method as passwords
 * This allows recovery keys to be stored securely
 * 
 * @param recoveryKey - Plain text recovery key
 * @returns Hashed recovery key string (salt:hash)
 */
export function hashRecoveryKey(recoveryKey: string): string {
  if (!recoveryKey || recoveryKey.length === 0) {
    throw new Error('Recovery key cannot be empty');
  }

  // Generate a random salt
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  // Hash the recovery key with PBKDF2
  const hash = crypto.pbkdf2Sync(
    recoveryKey,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    HASH_ALGORITHM
  );

  // Return salt:hash as base64 strings
  return `${salt.toString('base64')}:${hash.toString('base64')}`;
}

/**
 * Verify a recovery key against a stored hash
 * 
 * @param recoveryKey - Plain text recovery key to verify
 * @param storedHash - Stored hash in format salt:hash
 * @returns True if recovery key matches, false otherwise
 */
export function verifyRecoveryKey(recoveryKey: string, storedHash: string): boolean {
  if (!recoveryKey || recoveryKey.length === 0) {
    return false;
  }

  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }

  try {
    // Split salt and hash
    const [saltBase64, hashBase64] = storedHash.split(':');
    
    if (!saltBase64 || !hashBase64) {
      return false;
    }

    // Decode salt and hash from base64
    const salt = Buffer.from(saltBase64, 'base64');
    const storedHashBuffer = Buffer.from(hashBase64, 'base64');

    // Hash the provided recovery key with the same salt
    const computedHash = crypto.pbkdf2Sync(
      recoveryKey,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      HASH_ALGORITHM
    );

    // Compare hashes using timing-safe comparison
    return crypto.timingSafeEqual(computedHash, storedHashBuffer);
  } catch (error) {
    console.error('[Password Utils] Error verifying recovery key:', error);
    return false;
  }
}

/**
 * Format a recovery key for display (split into groups for readability)
 * 
 * @param recoveryKey - Base64 recovery key
 * @returns Formatted recovery key with spaces every 4 characters
 */
export function formatRecoveryKey(recoveryKey: string): string {
  // Remove any existing spaces
  const cleanKey = recoveryKey.replace(/\s/g, '');
  // Split into groups of 4 characters
  return cleanKey.match(/.{1,4}/g)?.join(' ') || cleanKey;
}


