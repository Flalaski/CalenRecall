/**
 * EntryTemplateManager — Create, browse, and apply journal entry templates.
 *
 * The backend and IPC layer already support templates (getAllTemplates, saveTemplate, etc.)
 * but no frontend UI existed. This component provides a complete template management
 * interface: create from existing entries, browse available templates, preview content,
 * apply to new entries, and delete unused templates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { JournalEntry, EntryTemplate, TimeRange } from '../types';
import { announce, focusElement } from '../utils/accessibility';

interface EntryTemplateManagerProps {
  /** Called when a template should be applied to create a new entry */
  onApplyTemplate: (template: EntryTemplate) => void;
  /** Currently selected date for the new entry */
  currentDate?: Date;
  /** Optional: provide an existing entry to save as a template */
  sourceEntry?: JournalEntry | null;
  /** Optional: existing templates list from parent */
  existingTemplates?: EntryTemplate[];
  /** Optional: whether the manager is embedded in a modal */
  embedded?: boolean;
}

/**
 * EntryTemplateManager component.
 * Renders a template browser/editor panel.
 */
export function EntryTemplateManager({
  onApplyTemplate,
  sourceEntry,
  existingTemplates: externalTemplates,
  embedded = false,
}: EntryTemplateManagerProps) {
  const [templates, setTemplates] = useState<EntryTemplate[]>(externalTemplates || []);
  const [isLoading, setIsLoading] = useState(!externalTemplates);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EntryTemplate | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateTags, setTemplateTags] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [filterText, setFilterText] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const saveAsTemplateButtonRef = useRef<HTMLButtonElement>(null);

  // Load templates on mount
  useEffect(() => {
    if (externalTemplates) {
      setTemplates(externalTemplates);
      setIsLoading(false);
      return;
    }

    const loadTemplates = async () => {
      try {
        if (!window.electronAPI?.getAllTemplates) {
          // In browser-only mode, use localStorage
          const stored = localStorage.getItem('calenrecall-templates');
          if (stored) {
            setTemplates(JSON.parse(stored));
          }
          return;
        }
        const result = await window.electronAPI.getAllTemplates();
        setTemplates(result || []);
      } catch (err) {
        console.error('[TemplateManager] Failed to load templates:', err);
        setError('Failed to load templates');
      } finally {
        setIsLoading(false);
      }
    };
    loadTemplates();
  }, [externalTemplates]);

  // Focus name input when save dialog opens
  useEffect(() => {
    if (showSaveDialog && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [showSaveDialog]);

  /**
   * Save a new template from the source entry.
   */
  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim() || !sourceEntry) return;

    const newTemplate: EntryTemplate = {
      name: templateName.trim(),
      title: sourceEntry.title,
      content: sourceEntry.content,
      tags: templateTags.split(',').map(t => t.trim()).filter(Boolean),
      timeRange: sourceEntry.timeRange,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (window.electronAPI?.saveTemplate) {
        const saved = await window.electronAPI.saveTemplate(newTemplate);
        if (saved) {
          setTemplates(prev => [...prev, saved]);
        }
      } else {
        // Browser-only fallback
        const savedTemplate = { ...newTemplate, id: Date.now() };
        const updated = [...templates, savedTemplate];
        setTemplates(updated);
        localStorage.setItem('calenrecall-templates', JSON.stringify(updated));
      }
      announce(`Template "${templateName.trim()}" saved`, false);
      setShowSaveDialog(false);
      setTemplateName('');
      setTemplateTags('');
    } catch (err) {
      console.error('[TemplateManager] Failed to save template:', err);
      setError('Failed to save template');
    }
  }, [templateName, templateTags, sourceEntry, templates]);

  /**
   * Delete a template by ID.
   */
  const handleDeleteTemplate = useCallback(async (templateId: number) => {
    try {
      if (window.electronAPI?.deleteTemplate) {
        await window.electronAPI.deleteTemplate(templateId);
      } else {
        // Browser-only fallback
        const updated = templates.filter(t => t.id !== templateId);
        setTemplates(updated);
        localStorage.setItem('calenrecall-templates', JSON.stringify(updated));
      }
      announce('Template deleted', false);
      setShowDeleteConfirm(null);
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }
    } catch (err) {
      console.error('[TemplateManager] Failed to delete template:', err);
      setError('Failed to delete template');
    }
  }, [templates, selectedTemplate]);

  /**
   * Apply a template to create a new entry.
   */
  const handleApplyTemplate = useCallback((template: EntryTemplate) => {
    onApplyTemplate(template);
    announce(`Template "${template.name}" applied`, false);
  }, [onApplyTemplate]);

  // Filter templates by search text
  const filteredTemplates = filterText.trim()
    ? templates.filter(t =>
        t.name.toLowerCase().includes(filterText.toLowerCase()) ||
        t.title?.toLowerCase().includes(filterText.toLowerCase()) ||
        t.tags?.some(tag => tag.toLowerCase().includes(filterText.toLowerCase()))
      )
    : templates;

  // Show save-as-template button when sourceEntry is provided
  const canSaveTemplate = sourceEntry && sourceEntry.title && sourceEntry.content;

  if (isLoading) {
    return (
      <div className="template-manager" role="region" aria-label="Entry templates">
        <div className="template-loading" role="status">
          <span className="sr-only">Loading templates...</span>
          <div className="loading-spinner" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="template-manager" role="region" aria-label="Entry templates">
        <div className="template-error" role="alert">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="template-retry-btn">
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`template-manager ${embedded ? 'template-manager-embedded' : ''}`} role="region" aria-label="Entry templates">
      {/* Header */}
      <div className="template-manager-header">
        <h2 className="template-manager-title">Templates</h2>
        <div className="template-manager-actions">
          {canSaveTemplate && (
            <button
              ref={saveAsTemplateButtonRef}
              className="template-save-btn"
              onClick={() => setShowSaveDialog(true)}
              aria-label={`Save "${sourceEntry.title}" as template`}
              title="Save current entry as template"
            >
              + Save as Template
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {templates.length > 0 && (
        <div className="template-search">
          <input
            type="text"
            className="template-search-input"
            placeholder="Filter templates..."
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            aria-label="Filter templates by name, title, or tags"
          />
        </div>
      )}

      {/* Template list */}
      {filteredTemplates.length === 0 ? (
        <div className="template-empty" role="status">
          {templates.length === 0 ? (
            <p>No templates yet. Save an entry as a template to get started.</p>
          ) : (
            <p>No templates match your filter.</p>
          )}
        </div>
      ) : (
        <div className="template-list" role="listbox" aria-label="Available templates">
          {filteredTemplates.map(template => (
            <div
              key={template.id}
              className={`template-item ${selectedTemplate?.id === template.id ? 'template-item-selected' : ''}`}
              role="option"
              aria-selected={selectedTemplate?.id === template.id}
              tabIndex={0}
              onClick={() => setSelectedTemplate(template)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedTemplate(template);
                }
              }}
            >
              <div className="template-item-header">
                <span className="template-item-name">{template.name}</span>
                {template.timeRange && (
                  <span className="template-item-badge">{template.timeRange}</span>
                )}
              </div>
              {template.title && (
                <div className="template-item-title">{template.title}</div>
              )}
              {template.tags && template.tags.length > 0 && (
                <div className="template-item-tags">
                  {template.tags.map((tag, i) => (
                    <span key={i} className="template-tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Selected template preview */}
      {selectedTemplate && (
        <div className="template-preview" role="region" aria-label="Template preview">
          <div className="template-preview-header">
            <h3>{selectedTemplate.name}</h3>
            <div className="template-preview-actions">
              <button
                className="template-apply-btn"
                onClick={() => handleApplyTemplate(selectedTemplate)}
                aria-label={`Create entry from template "${selectedTemplate.name}"`}
              >
                Apply Template
              </button>
              <button
                className="template-delete-btn"
                onClick={() => setShowDeleteConfirm(selectedTemplate.id!)}
                aria-label={`Delete template "${selectedTemplate.name}"`}
              >
                Delete
              </button>
            </div>
          </div>
          {selectedTemplate.title && (
            <div className="template-preview-title">
              <strong>Title:</strong> {selectedTemplate.title}
            </div>
          )}
          <div className="template-preview-content">
            <strong>Content:</strong>
            <pre>{selectedTemplate.content}</pre>
          </div>
          {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
            <div className="template-preview-tags">
              <strong>Tags:</strong>
              {selectedTemplate.tags.map((tag, i) => (
                <span key={i} className="template-tag">{tag}</span>
              ))}
            </div>
          )}
          {selectedTemplate.timeRange && (
            <div className="template-preview-range">
              <strong>Default time range:</strong> {selectedTemplate.timeRange}
            </div>
          )}
        </div>
      )}

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="template-dialog-overlay" role="dialog" aria-modal="true" aria-label="Save as template">
          <div className="template-dialog">
            <h3>Save as Template</h3>
            <div className="template-dialog-field">
              <label htmlFor="template-name-input">Template name *</label>
              <input
                id="template-name-input"
                ref={nameInputRef}
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="e.g., Daily Journal Entry"
                aria-required="true"
              />
            </div>
            <div className="template-dialog-field">
              <label htmlFor="template-tags-input">Tags (comma-separated)</label>
              <input
                id="template-tags-input"
                type="text"
                value={templateTags}
                onChange={e => setTemplateTags(e.target.value)}
                placeholder="e.g., daily, personal"
              />
            </div>
            <div className="template-dialog-actions">
              <button
                className="template-dialog-cancel"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </button>
              <button
                className="template-dialog-save"
                onClick={handleSaveTemplate}
                disabled={!templateName.trim()}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm !== null && (
        <div className="template-dialog-overlay" role="dialog" aria-modal="true" aria-label="Delete template">
          <div className="template-dialog template-dialog-confirm">
            <h3>Delete Template?</h3>
            <p>This action cannot be undone.</p>
            <div className="template-dialog-actions">
              <button
                className="template-dialog-cancel"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="template-dialog-delete"
                onClick={() => handleDeleteTemplate(showDeleteConfirm)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EntryTemplateManager;
