import { useState, useEffect } from 'react';
import { ExportFormat, ExportMetadata } from '../types';
import { playSaveSound, playCancelSound } from '../utils/audioUtils';
import { getAvailableThemes, loadAllThemes } from '../utils/themes';
import './ExportMetadataModal.css';

interface ExportMetadataModalProps {
  isOpen: boolean;
  format: ExportFormat;
  onClose: () => void;
  onConfirm: (metadata: ExportMetadata, format: ExportFormat) => void;
  entryCount: number;
  dateRange?: { start: string; end: string };
}

export default function ExportMetadataModal({
  isOpen,
  format,
  onClose,
  onConfirm,
  entryCount,
  dateRange,
}: ExportMetadataModalProps) {
  const [metadata, setMetadata] = useState<ExportMetadata>({
    exportPurpose: 'personal',
    classification: 'private',
    exportDate: new Date().toISOString(),
  });
  
  // Track if we've loaded defaults to avoid resetting on every render
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const [keywordsInput, setKeywordsInput] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>('identity');
  const [themesLoaded, setThemesLoaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load all themes (built-in + custom) when modal opens
      loadAllThemes().then(() => {
        setThemesLoaded(true);
      }).catch(error => {
        console.error('[ExportMetadataModal] Error loading themes:', error);
        setThemesLoaded(true);
      });
      
      // Load default export metadata from preferences (only once when modal opens)
      if (!defaultsLoaded) {
        const loadDefaultMetadata = async () => {
          if (window.electronAPI) {
            try {
              const prefs = await window.electronAPI.getAllPreferences();
              if (prefs.defaultExportMetadata) {
                // Start with defaults, then add current exportDate and date range
                const merged: ExportMetadata = {
                  ...prefs.defaultExportMetadata,
                  exportDate: new Date().toISOString(), // Always use current export date
                  // Override date range if provided
                  ...(dateRange ? {
                    dateRangeStart: dateRange.start,
                    dateRangeEnd: dateRange.end,
                  } : {}),
                };
                setMetadata(merged);
                // Also restore keywords input string
                if (merged.keywords && merged.keywords.length > 0) {
                  setKeywordsInput(merged.keywords.join(', '));
                }
              } else {
                // No default metadata, just set date range if provided
                if (dateRange) {
                  setMetadata(prev => ({
                    ...prev,
                    dateRangeStart: dateRange.start,
                    dateRangeEnd: dateRange.end,
                  }));
                }
              }
              setDefaultsLoaded(true);
            } catch (error) {
              console.error('[ExportMetadataModal] Error loading default metadata:', error);
              // Fallback to just setting date range if provided
              if (dateRange) {
                setMetadata(prev => ({
                  ...prev,
                  dateRangeStart: dateRange.start,
                  dateRangeEnd: dateRange.end,
                }));
              }
              setDefaultsLoaded(true);
            }
          }
        };
        
        loadDefaultMetadata();
      } else {
        // If defaults are already loaded, just update date range if it changed
        if (dateRange) {
          setMetadata(prev => ({
            ...prev,
            dateRangeStart: dateRange.start,
            dateRangeEnd: dateRange.end,
          }));
        }
      }
    }
  }, [isOpen, dateRange, defaultsLoaded]);
  
  // Reset defaultsLoaded when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDefaultsLoaded(false);
    }
  }, [isOpen]);

  const handleInputChange = (field: keyof ExportMetadata, value: any) => {
    setMetadata(prev => ({ ...prev, [field]: value }));
  };

  const handleKeywordsChange = (value: string) => {
    setKeywordsInput(value);
    const keywords = value.split(',').map(k => k.trim()).filter(k => k.length > 0);
    handleInputChange('keywords', keywords);
  };

  const handleConfirm = async () => {
    playSaveSound();
    
    // Save the metadata as default for future exports
    if (window.electronAPI) {
      try {
        // Create a copy of metadata without date range and exportDate (since those change per export)
        const metadataToSave: ExportMetadata = {
          ...metadata,
          // Don't save date range as it's specific to each export
          dateRangeStart: undefined,
          dateRangeEnd: undefined,
          // Don't save exportDate - it should always be the current time when exporting
          exportDate: undefined,
        };
        
        await window.electronAPI.setPreference('defaultExportMetadata', metadataToSave);
      } catch (error) {
        console.error('[ExportMetadataModal] Error saving default metadata:', error);
        // Continue with export even if saving defaults fails
      }
    }
    
    onConfirm(metadata, format);
  };

  const handleCancel = () => {
    playCancelSound();
    onClose();
  };

  if (!isOpen) return null;

  const formatLabel = format.charAt(0).toUpperCase() + format.slice(1);

  return (
    <div className="export-metadata-modal-overlay" onClick={handleCancel}>
      <div className="export-metadata-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-top">
            <h3>Export Metadata & Details</h3>
            <button className="modal-close-button" onClick={handleCancel} aria-label="Close">
              ×
            </button>
          </div>
          <p className="modal-subtitle">
            Exporting {entryCount} {entryCount === 1 ? 'entry' : 'entries'} as {formatLabel}
          </p>
        </div>

        <div className="export-metadata-content">
          <div className="export-metadata-sidebar">
            <button
              className={`sidebar-section ${activeSection === 'identity' ? 'active' : ''}`}
              onClick={() => setActiveSection('identity')}
            >
              Identity
            </button>
            <button
              className={`sidebar-section ${activeSection === 'context' ? 'active' : ''}`}
              onClick={() => setActiveSection('context')}
            >
              Context & Purpose
            </button>
            <button
              className={`sidebar-section ${activeSection === 'classification' ? 'active' : ''}`}
              onClick={() => setActiveSection('classification')}
            >
              Classification
            </button>
            <button
              className={`sidebar-section ${activeSection === 'legal' ? 'active' : ''}`}
              onClick={() => setActiveSection('legal')}
            >
              Legal & Rights
            </button>
            <button
              className={`sidebar-section ${activeSection === 'references' ? 'active' : ''}`}
              onClick={() => setActiveSection('references')}
            >
              References
            </button>
            <button
              className={`sidebar-section ${activeSection === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveSection('notes')}
            >
              Notes
            </button>
            <button
              className={`sidebar-section ${activeSection === 'exportSettings' ? 'active' : ''}`}
              onClick={() => setActiveSection('exportSettings')}
            >
              Themes
            </button>
          </div>

          <div className="export-metadata-form">
            {activeSection === 'identity' && (
              <div className="form-section">
                <h4>Project & Export Identity</h4>
                <div className="form-group">
                  <label htmlFor="projectTitle">Project Title</label>
                  <input
                    id="projectTitle"
                    type="text"
                    value={metadata.projectTitle || ''}
                    onChange={(e) => handleInputChange('projectTitle', e.target.value)}
                    placeholder="e.g., My Life Story, Research Journal 2024"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="exportName">Export Name</label>
                  <input
                    id="exportName"
                    type="text"
                    value={metadata.exportName || ''}
                    onChange={(e) => handleInputChange('exportName', e.target.value)}
                    placeholder="Name for this specific export"
                  />
                </div>

                <h4>Author & Contact</h4>
                <div className="form-group">
                  <label htmlFor="author">Author/Creator</label>
                  <input
                    id="author"
                    type="text"
                    value={metadata.author || ''}
                    onChange={(e) => handleInputChange('author', e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="organization">Organization</label>
                    <input
                      id="organization"
                      type="text"
                      value={metadata.organization || ''}
                      onChange={(e) => handleInputChange('organization', e.target.value)}
                      placeholder="Organization/Institution"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="department">Department</label>
                    <input
                      id="department"
                      type="text"
                      value={metadata.department || ''}
                      onChange={(e) => handleInputChange('department', e.target.value)}
                      placeholder="Department/Division"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="contactEmail">Contact Email</label>
                    <input
                      id="contactEmail"
                      type="email"
                      value={metadata.contactEmail || ''}
                      onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="contactPhone">Contact Phone</label>
                    <input
                      id="contactPhone"
                      type="tel"
                      value={metadata.contactPhone || ''}
                      onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    type="url"
                    value={metadata.website || ''}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            )}

            {activeSection === 'context' && (
              <div className="form-section">
                <h4>Purpose & Context</h4>
                <div className="form-group">
                  <label htmlFor="exportPurpose">Export Purpose</label>
                  <select
                    id="exportPurpose"
                    value={metadata.exportPurpose || 'personal'}
                    onChange={(e) => handleInputChange('exportPurpose', e.target.value)}
                  >
                    <option value="personal">Personal</option>
                    <option value="academic">Academic</option>
                    <option value="professional">Professional</option>
                    <option value="publication">Publication</option>
                    <option value="backup">Backup</option>
                    <option value="archive">Archive</option>
                    <option value="research">Research</option>
                    <option value="legal">Legal</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="purpose">Purpose Description</label>
                  <textarea
                    id="purpose"
                    value={metadata.purpose || ''}
                    onChange={(e) => handleInputChange('purpose', e.target.value)}
                    placeholder="Describe the purpose of this export"
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    value={metadata.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe the content and scope of this export"
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="context">Context</label>
                  <textarea
                    id="context"
                    value={metadata.context || ''}
                    onChange={(e) => handleInputChange('context', e.target.value)}
                    placeholder="Additional context or background information"
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="background">Background</label>
                  <textarea
                    id="background"
                    value={metadata.background || ''}
                    onChange={(e) => handleInputChange('background', e.target.value)}
                    placeholder="Historical or contextual background"
                    rows={3}
                  />
                </div>

                <h4>Versioning</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="version">Version</label>
                    <input
                      id="version"
                      type="text"
                      value={metadata.version || ''}
                      onChange={(e) => handleInputChange('version', e.target.value)}
                      placeholder="e.g., 1.0, 2.3.1"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="versionDate">Version Date</label>
                    <input
                      id="versionDate"
                      type="date"
                      value={metadata.versionDate || ''}
                      onChange={(e) => handleInputChange('versionDate', e.target.value)}
                    />
                  </div>
                </div>

                <h4>Date Range</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="dateRangeStart">Start Date</label>
                    <input
                      id="dateRangeStart"
                      type="date"
                      value={metadata.dateRangeStart || ''}
                      onChange={(e) => handleInputChange('dateRangeStart', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="dateRangeEnd">End Date</label>
                    <input
                      id="dateRangeEnd"
                      type="date"
                      value={metadata.dateRangeEnd || ''}
                      onChange={(e) => handleInputChange('dateRangeEnd', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'classification' && (
              <div className="form-section">
                <h4>Classification & Organization</h4>
                <div className="form-group">
                  <label htmlFor="classification">Classification Level</label>
                  <select
                    id="classification"
                    value={metadata.classification || 'private'}
                    onChange={(e) => handleInputChange('classification', e.target.value)}
                  >
                    <option value="public">Public</option>
                    <option value="internal">Internal</option>
                    <option value="confidential">Confidential</option>
                    <option value="private">Private</option>
                    <option value="restricted">Restricted</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="subject">Subject Category</label>
                  <input
                    id="subject"
                    type="text"
                    value={metadata.subject || ''}
                    onChange={(e) => handleInputChange('subject', e.target.value)}
                    placeholder="e.g., Personal Journal, Academic Research, Project Documentation"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="keywords">Keywords (comma-separated)</label>
                  <input
                    id="keywords"
                    type="text"
                    value={keywordsInput}
                    onChange={(e) => handleKeywordsChange(e.target.value)}
                    placeholder="e.g., journal, personal, 2024, research"
                  />
                  {metadata.keywords && metadata.keywords.length > 0 && (
                    <div className="keywords-preview">
                      {metadata.keywords.map((keyword, idx) => (
                        <span key={idx} className="keyword-tag">{keyword}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'legal' && (
              <div className="form-section">
                <h4>Legal & Rights</h4>
                <div className="form-group">
                  <label htmlFor="copyright">Copyright Notice</label>
                  <input
                    id="copyright"
                    type="text"
                    value={metadata.copyright || ''}
                    onChange={(e) => handleInputChange('copyright', e.target.value)}
                    placeholder="e.g., © 2024 Your Name. All rights reserved."
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="license">License</label>
                  <input
                    id="license"
                    type="text"
                    value={metadata.license || ''}
                    onChange={(e) => handleInputChange('license', e.target.value)}
                    placeholder="e.g., CC BY 4.0, All Rights Reserved, MIT License"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="rights">Rights Statement</label>
                  <textarea
                    id="rights"
                    value={metadata.rights || ''}
                    onChange={(e) => handleInputChange('rights', e.target.value)}
                    placeholder="Additional rights or usage information"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {activeSection === 'references' && (
              <div className="form-section">
                <h4>References & Citations</h4>
                <div className="form-group">
                  <label htmlFor="relatedDocuments">Related Documents</label>
                  <textarea
                    id="relatedDocuments"
                    value={metadata.relatedDocuments || ''}
                    onChange={(e) => handleInputChange('relatedDocuments', e.target.value)}
                    placeholder="List related documents, files, or references"
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="citation">Citation Information</label>
                  <textarea
                    id="citation"
                    value={metadata.citation || ''}
                    onChange={(e) => handleInputChange('citation', e.target.value)}
                    placeholder="How this export should be cited"
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="source">Source</label>
                  <input
                    id="source"
                    type="text"
                    value={metadata.source || ''}
                    onChange={(e) => handleInputChange('source', e.target.value)}
                    placeholder="Source of the content or data"
                  />
                </div>
              </div>
            )}

            {activeSection === 'notes' && (
              <div className="form-section">
                <h4>Additional Notes</h4>
                <div className="form-group">
                  <label htmlFor="notes">Export Notes</label>
                  <textarea
                    id="notes"
                    value={metadata.notes || ''}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Additional notes about this export"
                    rows={4}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="instructions">Instructions</label>
                  <textarea
                    id="instructions"
                    value={metadata.instructions || ''}
                    onChange={(e) => handleInputChange('instructions', e.target.value)}
                    placeholder="Instructions for using or processing this export"
                    rows={4}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="acknowledgments">Acknowledgments</label>
                  <textarea
                    id="acknowledgments"
                    value={metadata.acknowledgments || ''}
                    onChange={(e) => handleInputChange('acknowledgments', e.target.value)}
                    placeholder="People, organizations, or resources to acknowledge"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {activeSection === 'exportSettings' && (
              <div className="form-section">
                <h4>Export Settings</h4>
                <div className="form-group">
                  <label htmlFor="exportTheme">Export Theme</label>
                  <select
                    id="exportTheme"
                    value={metadata.exportTheme || ''}
                    onChange={(e) => handleInputChange('exportTheme', e.target.value || undefined)}
                    disabled={!themesLoaded}
                  >
                    <option value="">Use default theme</option>
                    {getAvailableThemes().map(theme => (
                      <option key={theme.name} value={theme.name}>
                        {theme.displayName}
                      </option>
                    ))}
                  </select>
                  {metadata.exportTheme && (
                    <div className="theme-preview">
                      <p className="theme-preview-label">Selected Theme:</p>
                      <p className="theme-preview-name">
                        {getAvailableThemes().find(t => t.name === metadata.exportTheme)?.displayName || metadata.exportTheme}
                      </p>
                      <p className="theme-preview-description">
                        {getAvailableThemes().find(t => t.name === metadata.exportTheme)?.description || ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleConfirm}>
            Continue Export
          </button>
        </div>
      </div>
    </div>
  );
}
