/**
 * Layer Toggle Registry
 *
 * Single source of truth for all display-layer preferences that can be toggled
 * from the Layers menu or Preferences page. Adding a toggle here automatically
 * makes it available in both places.
 *
 * Usage:
 *   import { LAYER_TOGGLES, type LayerToggleConfig } from '../utils/layerToggleRegistry';
 *
 *   // Render in a menu:
 *   {LAYER_TOGGLES.map(t => (
 *     <label key={t.key}>
 *       <input type="checkbox" checked={prefs[t.key]} onChange={() => toggle(t.key)} />
 *       {t.label}
 *     </label>
 *   ))}
 */

export interface LayerToggleConfig {
  /** Preference key stored in the database */
  key: string;
  /** Short display label (Layers menu, Preferences) */
  label: string;
  /** Description shown in Preferences page */
  description: string;
  /** Icon/emoji for the Layers menu button */
  icon: string;
  /** Section grouping */
  section: 'astronomical' | 'cultural' | 'macro-cycle';
  /** Default value when preferences have not been set */
  defaultValue: boolean;
}

export const LAYER_TOGGLES: LayerToggleConfig[] = [
  // ── Astronomical events ──
  {
    key: 'showSolsticesEquinoxes',
    label: 'Solstices & Equinoxes',
    description: "Display Earth's seasons (vernal equinox, summer solstice, autumnal equinox, winter solstice) in the calendar view",
    icon: '🌍',
    section: 'astronomical',
    defaultValue: false,
  },
  {
    key: 'showMoonPhases',
    label: 'Moon Phases',
    description: 'Display actual moon phases (new moon, first quarter, full moon, last quarter) in the calendar view',
    icon: '🌙',
    section: 'astronomical',
    defaultValue: false,
  },

  // ── Cultural holidays ──
  {
    key: 'showCulturalHolidays',
    label: 'Cultural Holidays',
    description: 'Display culturally significant holidays and observances (Chinese New Year, Ramadan, Passover, Nowruz, etc.) in the calendar view',
    icon: '🎉',
    section: 'cultural',
    defaultValue: false,
  },
  {
    key: 'culturalColors',
    label: 'Cultural Colors',
    description: "Blend each calendar system's traditional palette (documented cultural colors — e.g. wampum purple for Haudenosaunee, Maya blue, tekhelet) with the current theme's colors",
    icon: '🎨',
    section: 'cultural',
    defaultValue: false,
  },

  // ── Macro cycles ──
  {
    key: 'showChineseSexagenaryCycle',
    label: 'Chinese 60-Year Cycle',
    description: 'Display Chinese sexagenary cycle (干支) indicators in year and decade views when using Chinese calendar',
    icon: '🐉',
    section: 'macro-cycle',
    defaultValue: false,
  },
  {
    key: 'showMayanLongCountCycles',
    label: 'Mayan Long Count Cycles',
    description: 'Display Mayan Long Count cycle indicators (Baktun/Katun) in year and decade views',
    icon: '🌴',
    section: 'macro-cycle',
    defaultValue: false,
  },
  {
    key: 'showMetonicCycle',
    label: 'Metonic Cycle',
    description: 'Display Metonic cycle indicators (Hebrew 19-year cycle) in year and decade views',
    icon: '🔵',
    section: 'macro-cycle',
    defaultValue: false,
  },
  {
    key: 'showMayanCalendarRound',
    label: 'Mayan Calendar Round',
    description: 'Display Mayan Calendar Round indicators (52-year cycle) in year and decade views',
    icon: '🔄',
    section: 'macro-cycle',
    defaultValue: false,
  },
  {
    key: 'showHinduYugaCycles',
    label: 'Hindu Yuga Cycles',
    description: 'Display Hindu Yuga cycle indicators in year and decade views',
    icon: '🕉️',
    section: 'macro-cycle',
    defaultValue: false,
  },
];

/** Build an initial preferences object with all defaults */
export function getDefaultLayerPrefs(): Record<string, boolean> {
  const prefs: Record<string, boolean> = {};
  for (const t of LAYER_TOGGLES) {
    prefs[t.key] = t.defaultValue;
  }
  return prefs;
}

/** Map layer toggle keys to their config for O(1) lookup */
export const LAYER_TOGGLE_MAP = new Map<string, LayerToggleConfig>(
  LAYER_TOGGLES.map(t => [t.key, t])
);

/** Get the section display name */
export function getSectionLabel(section: LayerToggleConfig['section']): string {
  switch (section) {
    case 'astronomical': return 'Astronomical Events';
    case 'cultural': return 'Cultural';
    case 'macro-cycle': return 'Macro Cycles';
  }
}
