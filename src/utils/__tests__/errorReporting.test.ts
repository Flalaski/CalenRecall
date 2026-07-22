/**
 * Unit tests for errorReporting
 */

import {
  captureError,
  getCapturedErrors,
  getActiveErrorCount,
  dismissError,
  dismissAllErrors,
  clearAllErrors,
  getErrorsBySeverity,
  subscribeToErrors,
} from '../errorReporting';

describe('errorReporting', () => {
  beforeEach(() => {
    clearAllErrors();
  });

  describe('captureError', () => {
    it('captures an error with source', () => {
      const error = new Error('Test error');
      const captured = captureError(error, 'test-source');
      
      expect(captured.source).toBe('test-source');
      expect(captured.message).toBe('Test error');
      expect(captured.severity).toBe('error');
      expect(captured.occurrenceCount).toBe(1);
    });

    it('captures a string error', () => {
      const captured = captureError('String error', 'test');
      expect(captured.message).toBe('String error');
    });

    it('deduplicates identical errors', () => {
      const error = new Error('Duplicate error');
      captureError(error, 'test');
      captureError(error, 'test');
      
      const errors = getCapturedErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].occurrenceCount).toBe(2);
    });

    it('accepts severity option', () => {
      const error = new Error('Warning test');
      const captured = captureError(error, 'test', { severity: 'warning' });
      expect(captured.severity).toBe('warning');
    });

    it('accepts component option', () => {
      const error = new Error('Component error');
      const captured = captureError(error, 'test', { component: 'CalendarView' });
      expect(captured.component).toBe('CalendarView');
    });

    it('accepts operation option', () => {
      const error = new Error('Operation error');
      const captured = captureError(error, 'test', { operation: 'loadEntries' });
      expect(captured.operation).toBe('loadEntries');
    });
  });

  describe('getCapturedErrors', () => {
    it('returns empty array when no errors', () => {
      expect(getCapturedErrors()).toEqual([]);
    });

    it('returns all captured errors', () => {
      captureError(new Error('Error 1'), 'test1');
      captureError(new Error('Error 2'), 'test2');
      
      expect(getCapturedErrors()).toHaveLength(2);
    });
  });

  describe('getActiveErrorCount', () => {
    it('returns 0 when no errors', () => {
      expect(getActiveErrorCount()).toBe(0);
    });

    it('returns count of non-dismissed errors', () => {
      captureError(new Error('Active error'), 'test');
      expect(getActiveErrorCount()).toBe(1);
    });
  });

  describe('dismissError', () => {
    it('marks error as dismissed', () => {
      const captured = captureError(new Error('Dismiss me'), 'test');
      expect(getActiveErrorCount()).toBe(1);
      
      dismissError(captured.id);
      expect(getActiveErrorCount()).toBe(0);
    });
  });

  describe('dismissAllErrors', () => {
    it('dismisses all errors', () => {
      captureError(new Error('Error A'), 'test');
      captureError(new Error('Error B'), 'test');
      
      dismissAllErrors();
      expect(getActiveErrorCount()).toBe(0);
    });
  });

  describe('clearAllErrors', () => {
    it('removes all errors permanently', () => {
      captureError(new Error('Error'), 'test');
      clearAllErrors();
      expect(getCapturedErrors()).toEqual([]);
    });
  });

  describe('getErrorsBySeverity', () => {
    it('filters errors by severity', () => {
      captureError(new Error('Error'), 'test', { severity: 'error' });
      captureError(new Error('Warning'), 'test', { severity: 'warning' });
      captureError(new Error('Info'), 'test', { severity: 'info' });
      
      expect(getErrorsBySeverity('error')).toHaveLength(1);
      expect(getErrorsBySeverity('warning')).toHaveLength(1);
    });
  });

  describe('subscribeToErrors', () => {
    it('notifies listeners on new errors', () => {
      const listener = jest.fn();
      const unsubscribe = subscribeToErrors(listener);
      
      captureError(new Error('Notify test'), 'test');
      expect(listener).toHaveBeenCalledTimes(1);
      
      unsubscribe();
    });
  });
});
