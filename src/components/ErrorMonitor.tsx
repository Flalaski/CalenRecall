/**
 * ErrorMonitor — In-app error viewing panel
 *
 * Shows a badge with active error count and a panel listing captured errors.
 * Allows dismissing individual errors or clearing all.
 * Integrates with the errorReporting system.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getCapturedErrors,
  getActiveErrorCount,
  dismissError,
  dismissAllErrors,
  clearAllErrors,
  exportErrors,
  subscribeToErrors,
  type CapturedError,
} from '../utils/errorReporting';
import { announce } from '../utils/accessibility';

export function ErrorMonitor() {
  const [isOpen, setIsOpen] = useState(false);
  const [errors, setErrors] = useState<CapturedError[]>(getCapturedErrors());
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');

  // Subscribe to error updates
  useEffect(() => {
    const unsubscribe = subscribeToErrors((updated) => {
      setErrors([...updated]);
    });
    return unsubscribe;
  }, []);

  // Periodically check for new errors
  useEffect(() => {
    const interval = setInterval(() => {
      setErrors(getCapturedErrors());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = errors.filter(e => !e.dismissed).length;
  const errorCount = errors.filter(e => !e.dismissed && e.severity === 'error').length;

  const filteredErrors = errors.filter(e => {
    if (e.dismissed) return false;
    if (filter === 'error') return e.severity === 'error';
    if (filter === 'warning') return e.severity === 'warning';
    return true;
  });

  const handleDismiss = useCallback((errorId: string) => {
    dismissError(errorId);
    announce('Error dismissed', false);
  }, []);

  const handleDismissAll = useCallback(() => {
    dismissAllErrors();
    announce('All errors dismissed', false);
  }, []);

  const handleClearAll = useCallback(() => {
    clearAllErrors();
    setIsOpen(false);
    announce('Error log cleared', false);
  }, []);

  const handleExport = useCallback(() => {
    const data = exportErrors();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calenrecall-errors-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return '⚪';
    }
  };

  const timeAgo = (timestamp: string): string => {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="error-monitor" role="region" aria-label="Error monitor">
      {/* Trigger button */}
      <button
        className={`error-monitor-trigger ${errorCount > 0 ? 'error-monitor-trigger-active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Error monitor: ${activeCount} active ${activeCount === 1 ? 'issue' : 'issues'}`}
        title={`${activeCount} active ${activeCount === 1 ? 'issue' : 'issues'}`}
      >
        <span className="error-monitor-icon" aria-hidden="true">⚠</span>
        {activeCount > 0 && (
          <span className="error-monitor-badge">{activeCount}</span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="error-monitor-panel"
          role="dialog"
          aria-label="Error details"
          aria-modal="true"
        >
          <div className="error-monitor-panel-header">
            <h3>Error Log</h3>
            <div className="error-monitor-panel-actions">
              {errors.length > 0 && (
                <>
                  <button onClick={handleDismissAll} className="error-monitor-action" aria-label="Dismiss all errors">
                    Dismiss All
                  </button>
                  <button onClick={handleExport} className="error-monitor-action" aria-label="Export error log">
                    Export
                  </button>
                  <button onClick={handleClearAll} className="error-monitor-action error-monitor-action-danger" aria-label="Clear all errors">
                    Clear All
                  </button>
                </>
              )}
              <button onClick={() => setIsOpen(false)} className="error-monitor-action" aria-label="Close error panel">
                ✕
              </button>
            </div>
          </div>

          {/* Filter */}
          <div className="error-monitor-filters">
            {(['all', 'error', 'warning'] as const).map(f => (
              <button
                key={f}
                className={`error-monitor-filter ${filter === f ? 'error-monitor-filter-active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'error' ? 'Errors' : 'Warnings'}
                {f === 'all' ? ` (${activeCount})` : f === 'error' ? ` (${errorCount})` : ''}
              </button>
            ))}
          </div>

          {/* Error list */}
          <div className="error-monitor-list">
            {filteredErrors.length === 0 ? (
              <div className="error-monitor-empty" role="status">
                {errors.length === 0
                  ? 'No errors recorded.'
                  : 'No matching errors.'}
              </div>
            ) : (
              filteredErrors.map(error => (
                <div key={error.id} className="error-monitor-item">
                  <div className="error-monitor-item-header">
                    <span className="error-monitor-item-severity" title={error.severity}>
                      {severityIcon(error.severity)}
                    </span>
                    <span className="error-monitor-item-source">{error.source}</span>
                    {error.component && (
                      <span className="error-monitor-item-component">{error.component}</span>
                    )}
                    <span className="error-monitor-item-time">{timeAgo(error.timestamp)}</span>
                    {error.occurrenceCount > 1 && (
                      <span className="error-monitor-item-count">×{error.occurrenceCount}</span>
                    )}
                    <button
                      className="error-monitor-item-dismiss"
                      onClick={() => handleDismiss(error.id)}
                      aria-label={`Dismiss error from ${error.source}`}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="error-monitor-item-message">{error.userMessage}</div>
                  {error.operation && (
                    <div className="error-monitor-item-operation">
                      During: {error.operation}
                    </div>
                  )}
                  {error.stack && (
                    <details className="error-monitor-item-details">
                      <summary>Stack trace</summary>
                      <pre>{error.stack}</pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>

          {errors.length > 0 && (
            <div className="error-monitor-footer">
              <span>{errors.filter(e => !e.dismissed).length} active / {errors.length} total</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ErrorMonitor;
