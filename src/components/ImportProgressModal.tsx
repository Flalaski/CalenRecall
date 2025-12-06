import React from 'react';
import './ImportProgressModal.css';

interface ImportProgressModalProps {
  isOpen: boolean;
  progress: number;
  message: string;
  total?: number;
  imported?: number;
  skipped?: number;
}

export default function ImportProgressModal({
  isOpen,
  progress,
  message,
  total,
  imported,
  skipped,
}: ImportProgressModalProps) {
  if (!isOpen) return null;

  return (
    <div className="import-progress-overlay">
      <div className="import-progress-modal">
        <h3>Importing Entries</h3>
        <div className="import-progress-bar-container">
          <div className="import-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <p className="import-progress-message">{message}</p>
        {total !== undefined && (
          <div className="import-progress-stats">
            {imported !== undefined && <span>Imported: {imported}</span>}
            {skipped !== undefined && skipped > 0 && <span>Skipped: {skipped}</span>}
            <span>Total: {total}</span>
          </div>
        )}
      </div>
    </div>
  );
}

