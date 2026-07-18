/**
 * Shared Layer Toggle List Component
 *
 * Renders the layer toggle checkboxes from the single source of truth
 * (LAYER_TOGGLES registry). Used by both the NavigationBar Layers menu
 * and the Preferences page so they stay in sync automatically.
 *
 * Usage:
 *   <LayerToggleList
 *     prefs={layerPrefs}
 *     onToggle={(key) => toggleLayer(key)}
 *     variant="dropdown"         // compact for Layers menu
 *   />
 */

import React from 'react';
import { LAYER_TOGGLES, getSectionLabel, type LayerToggleConfig } from '../utils/layerToggleRegistry';

interface LayerToggleListProps {
  /** Current preference values (key → boolean) */
  prefs: Record<string, boolean>;
  /** Called when a checkbox is toggled */
  onToggle: (key: string) => void;
  /**
   * Visual variant:
   *  - "dropdown" — compact (Layers menu in nav bar)
   *  - "page"     — full-width with descriptions (Preferences page)
   */
  variant?: 'dropdown' | 'page';
  /**
   * When variant="page", optionally filter to only show certain sections
   */
  sections?: LayerToggleConfig['section'][];
}

export default function LayerToggleList({
  prefs,
  onToggle,
  variant = 'dropdown',
  sections,
}: LayerToggleListProps) {
  const toggles = sections
    ? LAYER_TOGGLES.filter(t => sections.includes(t.section))
    : LAYER_TOGGLES;

  // Group by section
  const groups = new Map<LayerToggleConfig['section'], LayerToggleConfig[]>();
  for (const t of toggles) {
    const list = groups.get(t.section) || [];
    list.push(t);
    groups.set(t.section, list);
  }

  const groupsArray = [...groups.entries()];

  if (variant === 'page') {
    return (
      <>
        {groupsArray.map(([section, items]) => (
          <div key={section}>
            <h4 style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.8rem', color: '#888' }}>
              {getSectionLabel(section)}
            </h4>
            {items.map(t => (
              <div key={t.key} className="preference-item">
                <label>
                  <input
                    type="checkbox"
                    checked={prefs[t.key] === true}
                    onChange={() => onToggle(t.key)}
                  />
                  {t.label}
                </label>
                <small>{t.description}</small>
              </div>
            ))}
          </div>
        ))}
      </>
    );
  }

  // dropdown variant
  return (
    <>
      {groupsArray.map(([section, items], gi) => (
        <React.Fragment key={section}>
          {gi > 0 && <div className="layers-divider" />}
          <div className="layers-dropdown-header">{getSectionLabel(section)}</div>
          {items.map(t => (
            <label key={t.key} className="layers-item">
              <input
                type="checkbox"
                checked={prefs[t.key] === true}
                onChange={() => onToggle(t.key)}
              />
              <span className="layers-item-label">{t.label}</span>
            </label>
          ))}
        </React.Fragment>
      ))}
    </>
  );
}
