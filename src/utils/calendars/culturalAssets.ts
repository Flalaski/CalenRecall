/**
 * Cultural Assets Registry
 *
 * Genuine, documented cultural symbology and color palettes for every
 * calendar system CalenRecall supports. Each entry cites the cultural
 * basis for its symbol and palette — nothing here is decorative guesswork.
 *
 * DESIGN CONTRACT
 * ───────────────
 * • Symbols are shown wherever the calendar is identified (selector, info
 *   panel). They use Unicode characters that render on stock Windows/macOS
 *   fonts (Ebrima → Ethiopic, Segoe UI Historic → Coptic, Gadugi → Cherokee,
 *   Leelawadee → Thai). Where a culture's primary emblem has no reliable
 *   Unicode coverage (e.g. Mayan numerals U+1D2E0 block, the Baháʼí
 *   nine-pointed star U+1F7D9), a documented-lineage substitute that renders
 *   everywhere is used instead, with the reasoning recorded in `symbolNote`.
 * • Colors are OFF by default. The `culturalColors` layer toggle blends them
 *   with the active theme via CSS `color-mix()` (see App.css "CULTURAL
 *   COLOR BLENDING") — they tint the theme rather than replace it, so all
 *   34 themes keep their identity.
 *
 * Sources: Dershowitz & Reingold, "Calendrical Calculations" (calendar
 * context); J.E.S. Thompson, "Maya Hieroglyphic Writing" (Maya glyphs);
 * Miguel León-Portilla, "Aztec Thought and Culture" (in tlilli in tlapalli);
 * Popol Vuh (maize in Maya cosmology); Horace Kephart & Cherokee Nation
 * heraldry (seal); Onondaga Nation / Haudenosaunee Confederacy documentation
 * (Hiawatha Belt wampum, Great Tree of Peace); national flag statutes
 * (Ethiopia 1897, India 1947, Israel 1948).
 */

import { CalendarSystem } from './types';

export interface CulturalAssets {
  /** Unicode symbol shown beside the calendar name (render-safe on stock fonts) */
  symbol: string;
  /** Short name of the symbol */
  symbolName: string;
  /** Cultural basis / citation for the symbol choice */
  symbolNote: string;
  /** Traditional palette — blended with theme colors when `culturalColors` is on */
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  /** Cultural basis / citation for the palette */
  colorNote: string;
}

export const CULTURAL_ASSETS: Record<CalendarSystem, CulturalAssets> = {
  gregorian: {
    symbol: '☉',
    symbolName: 'Sol',
    symbolNote:
      'Astronomical sun sign — the Gregorian reform (1582) fixed the solar year to keep the equinox in place for the computation of Easter.',
    colors: { primary: '#1F4E79', secondary: '#F5F0E6', accent: '#C9A227' },
    colorNote:
      'Ultramarine, vellum and gold leaf — the palette of the illuminated European manuscripts and books of hours in which this calendar was kept.',
  },
  julian: {
    symbol: '🏛',
    symbolName: 'Fasti',
    symbolNote:
      'Classical temple front — Roman fasti (calendar tables) were posted publicly on temple walls; the Julian reform was enacted by Julius Caesar as pontifex maximus (46 BCE).',
    colors: { primary: '#66023C', secondary: '#E8DCC0', accent: '#C5A100' },
    colorNote:
      'Tyrian purple — the imperial dye of Rome — with marble and gold of the civic forum.',
  },
  islamic: {
    symbol: '☪',
    symbolName: 'Star and crescent',
    symbolNote:
      'The hilāl (crescent) marks the start of each Hijri month by lunar sighting; the star-and-crescent emblem was popularized under the Ottomans.',
    colors: { primary: '#009000', secondary: '#FFFFFF', accent: '#C7A007' },
    colorNote:
      'Green is the color most associated with Islam (Fatimid banners, the Prophet\u2019s standard); white and gold from mosque calligraphy and dome ornament.',
  },
  hebrew: {
    symbol: '✡',
    symbolName: 'Magen David',
    symbolNote:
      'The Star of David, the most widely recognized emblem of Jewish identity since its adoption by the First Zionist Congress (1897) and long prior use in Prague and beyond.',
    colors: { primary: '#0038B8', secondary: '#FFFFFF', accent: '#B9C4CC' },
    colorNote:
      'Tekhelet blue and white — the colors of the tallit (prayer shawl), whence the flag of Israel (1948); silver of the Torah ornaments.',
  },
  persian: {
    symbol: '☀',
    symbolName: 'Nowruz sun',
    symbolNote:
      'The Solar Hijri year begins at the astronomically observed vernal equinox — Nowruz, celebrated for over 3,000 years.',
    colors: { primary: '#00A693', secondary: '#26619C', accent: '#F4C430' },
    colorNote:
      'Firouzeh (Persian turquoise) and lapis of Isfahan tilework, with saffron — Iran\u2019s signature spice and dye.',
  },
  chinese: {
    symbol: '☯',
    symbolName: 'Taijitu',
    symbolNote:
      'The yin-yang diagram — the lunisolar calendar balances lunar months (yin) with the solar year (yang); solar terms alternate through the same duality.',
    colors: { primary: '#E60012', secondary: '#FFB200', accent: '#00A86B' },
    colorNote:
      'Auspicious vermilion red (紅) of festivals, imperial yellow of the Ming court, and jade — the stone of virtue.',
  },
  ethiopian: {
    symbol: '፠',
    symbolName: 'Ge\u02BDez section mark',
    symbolNote:
      'An authentic Ethiopic script character (U+1360) from the Ge\u02BDez manuscript tradition in which the Ethiopian computus (Bahire Hasab) is written.',
    colors: { primary: '#078930', secondary: '#FCDD09', accent: '#DA121A' },
    colorNote:
      'Green, yellow and red of the Ethiopian tricolor (1897) — the oldest African national colors and origin of the Pan-African palette.',
  },
  coptic: {
    symbol: '⳩',
    symbolName: 'Khi-Ro staurogram',
    symbolNote:
      'COPTIC SYMBOL KHI RO (U+2CE9) — a genuine Coptic-script christogram; the Coptic calendar is the liturgical calendar of the Coptic Orthodox Church (Era of the Martyrs).',
    colors: { primary: '#8C1D18', secondary: '#C9A227', accent: '#E8DCC0' },
    colorNote:
      'Deep red and gold of Coptic iconography on the papyrus tones of Egypt.',
  },
  'indian-saka': {
    symbol: '☸',
    symbolName: 'Ashoka Chakra',
    symbolNote:
      'The 24-spoke dharmachakra of Ashoka — centerpiece of India\u2019s flag; the Saka era calendar is India\u2019s official national calendar (adopted 1957).',
    colors: { primary: '#FF9933', secondary: '#138808', accent: '#000080' },
    colorNote:
      'Saffron (courage), India green (faith and fertility) and the navy of the Chakra, as codified for the national flag (1947).',
  },
  bahai: {
    symbol: '٩',
    symbolName: 'Nine',
    symbolNote:
      'Nine — the abjad numerical value of Bahá\u02BC — underlies the nine-pointed star emblem and the Badí\u02BF calendar\u2019s 19×19 structure. (The nine-pointed star itself, U+1F7D9, lacks reliable font coverage.)',
    colors: { primary: '#B8860B', secondary: '#FFFFFF', accent: '#2E8B57' },
    colorNote:
      'Gold of the Shrine of the Báb\u2019s dome, white of its stone, and the green of the Mount Carmel terraces.',
  },
  'thai-buddhist': {
    symbol: '๛',
    symbolName: 'Khomut',
    symbolNote:
      'An authentic Thai script sign (U+0E5B) marking the completion of a text in Thai manuscript tradition — fitting for an era count (Buddhist Era) from the Parinibbāna.',
    colors: { primary: '#E49B0F', secondary: '#2D2A4A', accent: '#FFFFFF' },
    colorNote:
      'Kasava (saffron) of Theravada monastic robes with the deep blue and white of the Thai tricolor.',
  },
  'mayan-tzolkin': {
    symbol: '🐆',
    symbolName: 'B\u02BCalam (jaguar)',
    symbolNote:
      'The jaguar — day-sign Ix of the sacred 260-day round; jaguar priests (b\u02BCalam) kept the divinatory count (Thompson, "Maya Hieroglyphic Writing").',
    colors: { primary: '#73C2FB', secondary: '#00A86B', accent: '#6F4E37' },
    colorNote:
      'Maya blue — the famously stable indigo-palygorskite pigment of Maya murals — with ceremonial jade and cacao.',
  },
  'mayan-haab': {
    symbol: '🌽',
    symbolName: 'Maize',
    symbolNote:
      'The 365-day Haab\u02BC ordered the agricultural year; maize is the axis of Maya cosmology (the Popol Vuh forms humanity from maize dough).',
    colors: { primary: '#00A86B', secondary: '#CC7722', accent: '#73C2FB' },
    colorNote:
      'Young-maize jade green with harvest ochre, on Maya blue.',
  },
  'mayan-longcount': {
    symbol: '🐚',
    symbolName: 'Shell zero',
    symbolNote:
      'The stylized shell is the Maya zero glyph — the digit that makes the Long Count one of history\u2019s first positional systems, opening the era date 0.0.0.0.0 (4 Ajaw 8 Kumk\u02BCu).',
    colors: { primary: '#4A6B58', secondary: '#D9CBB3', accent: '#73C2FB' },
    colorNote:
      'Weathered jade and limestone of the carved stelae that carry Long Count dates, with Maya blue.',
  },
  cherokee: {
    symbol: 'ᏣᎳᎩ',
    symbolName: 'Tsalagi',
    symbolNote:
      '"Cherokee" written in the Cherokee syllabary created by Sequoyah (1821) — one of the few writing systems invented in modern times by a single person.',
    colors: { primary: '#CE5C17', secondary: '#FFB60F', accent: '#1C7C54' },
    colorNote:
      'From the Cherokee Nation seal: the seven-pointed star (seven clans) in yellow on orange, ringed by an oak-leaf wreath in green.',
  },
  iroquois: {
    symbol: '🌲',
    symbolName: 'Great Tree of Peace',
    symbolNote:
      'The Great White Pine under which the Peacemaker united the Five Nations — the central emblem of the Haudenosaunee Confederacy.',
    colors: { primary: '#4B306A', secondary: '#F2EFE9', accent: '#6FA8DC' },
    colorNote:
      'Wampum purple (quahog shell) and white (whelk shell) of the Hiawatha Belt, beneath the open sky of the Confederacy\u2019s law.',
  },
  'aztec-xiuhpohualli': {
    symbol: '🌞',
    symbolName: 'Tonatiuh',
    symbolNote:
      'The sun with a face — Tonatiuh at the center of the Piedra del Sol (the "Aztec calendar stone"); the Xiuhpohualli is the 365-day solar year count.',
    colors: { primary: '#B22222', secondary: '#1A1A1A', accent: '#40E0D0' },
    colorNote:
      'In tlilli, in tlapalli — "the black ink, the red ink," the Nahua metaphor for writing and wisdom — with xihuitl turquoise, the very word shared by "year" and "turquoise" in Nahuatl.',
  },
};

/** Convenience: the symbol for a calendar (empty string if unknown) */
export function getCulturalSymbol(calendar: CalendarSystem): string {
  return CULTURAL_ASSETS[calendar]?.symbol ?? '';
}

/**
 * Apply (or clear) the cultural palette for the active calendar.
 *
 * When enabled, sets `--cultural-primary/secondary/accent` on the root and
 * adds the `cultural-colors` class; App.css blends these with `--theme-*`
 * via color-mix() so the palette TINTS the theme instead of replacing it.
 * When disabled, removes both — zero impact on any theme.
 */
export function applyCulturalAccents(calendar: CalendarSystem, enabled: boolean): void {
  const root = document.documentElement;
  const assets = CULTURAL_ASSETS[calendar];
  if (enabled && assets) {
    root.style.setProperty('--cultural-primary', assets.colors.primary);
    root.style.setProperty('--cultural-secondary', assets.colors.secondary);
    root.style.setProperty('--cultural-accent', assets.colors.accent);
    root.classList.add('cultural-colors');
  } else {
    root.style.removeProperty('--cultural-primary');
    root.style.removeProperty('--cultural-secondary');
    root.style.removeProperty('--cultural-accent');
    root.classList.remove('cultural-colors');
  }
}
