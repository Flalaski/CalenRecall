/**
 * Tests for error handling utilities
 */

import { toUserError, handleError, ErrorMessages, ErrorType } from '../errorHandler';

describe('errorHandler', () => {
  describe('toUserError', () => {
    it('should convert network errors to user-friendly messages', () => {
      const error = new Error('Network request failed');
      const userError = toUserError(error);
      
      expect(userError.type).toBe('NETWORK_ERROR');
      expect(userError.message).toBe(ErrorMessages.NETWORK_ERROR);
      expect(userError.originalError).toBe(error);
    });

    it('should convert database errors to user-friendly messages', () => {
      const error = new Error('SQLite database error');
      const userError = toUserError(error);
      
      expect(userError.type).toBe('DATABASE_ERROR');
      expect(userError.message).toBe(ErrorMessages.DATABASE_ERROR);
    });

    it('should convert file not found errors', () => {
      const error = new Error('File not found: ENOENT');
      const userError = toUserError(error);
      
      expect(userError.type).toBe('FILE_NOT_FOUND');
      expect(userError.message).toBe(ErrorMessages.FILE_NOT_FOUND);
    });

    it('should convert permission errors', () => {
      const error = new Error('Permission denied: EACCES');
      const userError = toUserError(error);
      
      expect(userError.type).toBe('PERMISSION_DENIED');
      expect(userError.message).toBe(ErrorMessages.PERMISSION_DENIED);
    });

    it('should convert invalid input errors', () => {
      const error = new Error('Invalid input validation failed');
      const userError = toUserError(error);
      
      expect(userError.type).toBe('INVALID_INPUT');
      expect(userError.message).toBe(ErrorMessages.INVALID_INPUT);
    });

    it('should default to UNKNOWN_ERROR for unrecognized errors', () => {
      const error = new Error('Some random error');
      const userError = toUserError(error);
      
      expect(userError.type).toBe('UNKNOWN_ERROR');
      expect(userError.message).toBe(ErrorMessages.UNKNOWN_ERROR);
    });

    it('should handle non-Error objects', () => {
      const error = 'String error';
      const userError = toUserError(error);
      
      expect(userError.type).toBe('UNKNOWN_ERROR');
      expect(userError.message).toBe(ErrorMessages.UNKNOWN_ERROR);
    });

    it('should include error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test error');
      const userError = toUserError(error);
      
      expect(userError.details).toBe('Test error');
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('handleError', () => {
    it('should convert and log errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Test error');
      
      const userError = handleError(error, 'TestContext');
      
      expect(userError.type).toBe('UNKNOWN_ERROR');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});

