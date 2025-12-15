import { useState, useEffect } from 'react';
import '../types';
import './UpdateBanner.css';

export default function UpdateBanner() {
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready'>('idle');
  const [version, setVersion] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  useEffect(() => {
    if (!window.electronAPI) return;

    const removeChecking = window.electronAPI.onUpdateChecking?.(() => {
      setUpdateState('checking');
    });

    const removeAvailable = window.electronAPI.onUpdateAvailable?.((newVersion: string) => {
      setUpdateState('available');
      setVersion(newVersion);
    });

    const removeNotAvailable = window.electronAPI.onUpdateNotAvailable?.(() => {
      setUpdateState('idle');
    });

    const removeProgress = window.electronAPI.onUpdateDownloadProgress?.((percent: number) => {
      setUpdateState('downloading');
      setDownloadProgress(percent);
    });

    const removeDownloaded = window.electronAPI.onUpdateDownloaded?.((newVersion: string) => {
      setUpdateState('ready');
      setVersion(newVersion);
    });

    const removeError = window.electronAPI.onUpdateError?.(() => {
      setUpdateState('idle');
    });

    return () => {
      removeChecking?.();
      removeAvailable?.();
      removeNotAvailable?.();
      removeProgress?.();
      removeDownloaded?.();
      removeError?.();
    };
  }, []);

  if (updateState === 'idle' || updateState === 'checking') {
    return null;
  }

  return (
    <div className="update-banner">
      {updateState === 'available' && (
        <div className="update-banner-content">
          <span className="update-icon">↓</span>
          <span>Update {version} available — downloading in background...</span>
        </div>
      )}
      {updateState === 'downloading' && (
        <div className="update-banner-content">
          <span className="update-icon">↓</span>
          <span>Downloading update {version}... {downloadProgress.toFixed(0)}%</span>
          <div className="update-progress-bar">
            <div className="update-progress-fill" style={{ width: `${downloadProgress}%` }} />
          </div>
        </div>
      )}
      {updateState === 'ready' && (
        <div className="update-banner-content update-ready">
          <span className="update-icon">✓</span>
          <span>Update {version} ready — restart to apply</span>
        </div>
      )}
    </div>
  );
}
