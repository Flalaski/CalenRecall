# CalenRecall — Native Adaptation of the AstroMonix Panel Formatting System

> **Purpose**: Granular audit of `CALENDAR_FORMATTING_ADAPTATION_GUIDE.md` (written by an external project with **no knowledge of CalenRecall's actual structure**) and the **corrected, fully-native adaptation** of its good formatting patterns to our real architecture.
>
> **Audit verdict summary**: of the source guide's 12 sections — **7 patterns worth adopting** (in adapted form), **5 core assumptions rejected** (architecturally incompatible), **1 entire tier missing** (decade), **1 data model mismatch** (mood/priority vs. our `JournalEntry`).
>
> **Date**: 2026-07-17

---

## Table of Contents

1. [Ground Truth the Source Guide Missed](#1-ground-truth-the-source-guide-missed)
2. [Granular Audit — Section-by-Section Verdicts](#2-granular-audit--section-by-section-verdicts)
3. [Name Mapping — Guide Concepts → Real CalenRecall Constructs](#3-name-mapping--guide-concepts--real-calenrecall-constructs)
4. [Token System Adaptation](#4-token-system-adaptation)
5. [Pattern Adaptations (The Good Stuff, Made Native)](#5-pattern-adaptations-the-good-stuff-made-native)
6. [Rejected Patterns and Why](#6-rejected-patterns-and-why)
7. [The Missing Fifth Tier — Decade](#7-the-missing-fifth-tier--decade)
8. [Theme Compatibility Rules (Hard Requirements)](#8-theme-compatibility-rules-hard-requirements)
9. [Implementation Checklist](#9-implementation-checklist)

---

## 1. Ground Truth the Source Guide Missed

The guide assumes a vanilla-JS, single-theme, fixed-side-panel app with 4 tiers and day-only entries. CalenRecall is none of those things.

| Guide assumption | CalenRecall reality | Where |
|---|---|---|
| Vanilla JS: `document.createElement`, `innerHTML`, `addEventListener`, `parent.replaceChild` | **React 18 + TypeScript** components; state-driven rendering; no manual DOM | `src/components/*.tsx` |
| One hardcoded dark color palette (`#7fdfff`, `#4ecdc4`, `rgba(13,20,36,…)`) | **34 user-selectable themes** via `--theme-*` CSS variables (`--theme-accent`, `--theme-card-bg`, `--theme-badge-*`, `--theme-scrollbar-*`, …) | `src/themes/*.css`, `src/themes.css`, `src/utils/themes.ts` |
| 4 time tiers (year/month/week/day) | **5 tiers**: `'decade' \| 'year' \| 'month' \| 'week' \| 'day'` (`TimeRange`) | `src/types.ts:29` |
| Entries live only inside days (`dayData.entries`) | **Entries are tier-scoped**: a `JournalEntry` has `timeRange` — a week/month/year/decade entry belongs to that tier, not to a day | `src/types.ts:1`, `entryLookup` maps in `src/utils/entryLookupUtils.ts` |
| `mood`, `priority`, `category`, `dominantMood`, `time` string, `images` | `JournalEntry` = `id, date (ISO), jdn, timeRange, hour/minute/second, title, content, createdAt/updatedAt, tags: string[], linkedEntries, archived, pinned, attachments` — **no mood/priority model** | `src/types.ts` |
| Fixed right-side panel (`position: fixed; right: 0; width: clamp(280px, 30vw, 480px)`) | **Full-window layout** — `.app` flex column: `NavigationBar` → `TimelineView` content → `GlobalTimelineMinimap` | `src/App.tsx`, `src/App.css` |
| Own header with prev/Today/next + tier buttons | Navigation already exists 3 ways: `NavigationBar` (buttons + date fields + T/arrow keys), `GlobalTimelineMinimap` (drag + WASD/arrows + W/S tier zoom), `TimelineView` cell clicks via `onTimePeriodSelect(date, tier)` — all with tier-aware **sound design** | `NavigationBar.tsx`, `GlobalTimelineMinimap.tsx` |
| Hardcoded `Mon…Sun` headers, ISO "Week 30" | `getWeekdayLabels(weekStartsOn)` honors the **weekStartsOn preference (0–6)**; **17 calendar systems** drive month/day labels via `MONTH_NAMES_SHORT[calendar]` | `dateUtils.ts`, `dateFormatter.ts`, `CalendarContext` |
| "Density dots" as the richest density display | We already exceed this: **pixel maps** (360-px year maps, 35-px month maps) colored by `calculateEntryColor` crystal colors, plus **zodiac gradient accents** per cell and **macro-cycle indicators** (Chinese sexagenary, Mayan, Metonic, Yuga) | `TimelineView.tsx` (`createYearPixelMap`, `createMonthPixelMap`, `renderMacroCycleIndicators`) |
| Rebuild-DOM-on-save, per-item listeners, lazy `innerHTML` detail builds | Incremental **O(1) `entryLookup` mutations** with memo invalidation via reference bump; view-mode-gated `useMemo` data; perfTrail instrumentation with budgets | `EntriesContext.tsx`, `perfTrail.ts` |
| `escapeHtml()` + `truncateText()` utilities | React escapes by default; truncation is CSS `-webkit-line-clamp` | — |
| Mobile 480px/768px breakpoints | **Electron desktop app** with minimum window size; responsive concerns are window-resize driven (NavigationBar already runs a ResizeObserver font-fit system) | `electron/main.ts`, `NavigationBar.tsx` |

---

## 2. Granular Audit — Section-by-Section Verdicts

| Guide § | Content | Verdict | Reason |
|---|---|---|---|
| §1 Conceptual mapping | planet→week, aspect→day, chip→tag | ⚠️ **Partially valid** | Mapping direction is right, but targets the wrong entities: our top-level containers are *tier views*, and "week" is an **entry tier**, not just a layout row |
| §2.1 Foundation variables | `--cal-*` `:root` block | ⚠️ **Split** | **Adopt** the *layout/typography* tokens (clamp() fluid sizing is genuinely good). **Reject** every *color* token — they'd fight all 34 themes |
| §2.2 Per-item day-status vars | `--day-accent` via JS `setProperty` | ✅ **Adopt (React-style)** | We already do exactly this with `--zodiac-gradient` via the `style` prop — extend the pattern |
| §2.3 Viewport-aware tier vars | `--cal-view-tier` etc. | ❌ **Reject** | React props/state already carry `viewMode`; a CSS mirror adds a second source of truth |
| §3 Base container | Fixed side panel + own header + scrollbar | ❌ **Reject container / ✅ adopt scrollbar intent** | Wrong layout model; scrollbars are *already* themed via `--theme-scrollbar-*` |
| §4 Tier config object + `setCalTier()` | JS tier switcher | ❌ **Reject** | This is exactly what `TimelineView`'s `switch (viewMode)` + per-tier render functions already do, with React semantics |
| §5 Week row, three-zone summary | left identity / center density / right chips | ✅ **Adopt** | Our `.week-entry-group-header` (month view) and `.cell-year-label` (decade view) are natural hosts |
| §6 Day column, stepped layout | accent border + header + previews + meta | ✅ **Adopt semantics** | Extends our existing `.timeline-cell.day-cell` (which already has the accent left border via zodiac gradient) with a **semantic `data-day-type`** layer |
| §7 Entry chips (stacked/inline) | `detailChip()` variants | ✅ **Adopt** | Maps onto `.entry-badge` / `.month-entry-tag` / `.card-tag`; chip *sources* must be our real fields: `tags[]`, `pinned`, `attachments.length`, `linkedEntries.length`, `hour:minute` |
| §7.3/§8 Color threshold tables | mood/priority hex tables | ❌ **Reject data, ✅ adopt threshold idea** | No mood/priority in our model; hex values break themes. Keep the *bucketing concept* as theme-relative CSS classes |
| §9.1 Modal day expansion | `showDayDetail()` inline modal | ❌ **Reject** | Our paradigm: clicking a period **navigates** (`onTimePeriodSelect(day, 'day')`) — the day view *is* the expansion. A second inline-modal path would split the interaction model |
| §9.2 Hover lift | `translateY(-2px)` + shadow | ✅ **Adopt (tuned)** | `.timeline-cell` already has `will-change: transform` + GPU hints; add a compositor-only lift |
| §9.3 Inline textarea + Ctrl+Enter | New-entry input in cell | ❌ **Reject input / ✅ adopt hotkey** | We have `JournalEditor`/`EntryEditModal` (tier-aware, calendar-aware, attachments). But **Ctrl+Enter save is genuinely missing** — adopt it there |
| §10 Per-tier assemblies | ASCII layouts | ⚠️ **Reference only** | Useful as intent documentation; our five views already exist and are richer |
| §11 Breakpoints | 480/768/1100/1400px | ⚠️ **Adapt** | Desktop window-resize thresholds only; drop the mobile-hiding rules |
| §12 Checklist | 7 phases | ❌ **Superseded** | Replaced by §9 below, tied to real files |

---

## 3. Name Mapping — Guide Concepts → Real CalenRecall Constructs

Implementers reading the source guide should translate every name:

| Guide name | CalenRecall construct | File |
|---|---|---|
| `.cal-view` | `.timeline-{day,week,month,year,decade}-view` | `TimelineView.css` |
| `.cal-timeline` | `.timeline-grid` (+ `.month-grid`, `.week-grid`, `.year-grid`, `.decade-grid`) | `TimelineView.css` |
| `.cal-view-header` + nav | `NavigationBar` (do **not** duplicate) | `NavigationBar.tsx` |
| Tier buttons | `GlobalTimelineMinimap` W/S zoom + `NavigationBar` | existing |
| `.cal-day-headers` | `.weekday-header` / `.weekday-cell` fed by `getWeekdayLabels(weekStartsOn)` | `TimelineView.tsx` |
| `.cal-week` (container) | `.week-entry-group` (month view) / week **entries** are first-class `timeRange: 'week'` records | `TimelineView.css:183` |
| `.cal-week-summary` three zones | `.week-entry-group-header` | `TimelineView.css:196` |
| `.cal-day` | `.timeline-cell.day-cell` | `TimelineView.css:615` |
| `--day-accent` | `--zodiac-gradient` (exists) + new `data-day-type` accents | `TimelineView.tsx` |
| `.cal-density-dot` strip | **new** `.week-density-strip` (see §5.5); year/decade already use pixel maps | — |
| `.cal-meta-chip` | `.entry-badge`, `.month-entry-tag`, `.card-tag`, `.badge-tag-count` | `TimelineView.css` |
| `.cal-entry-preview` | `.card-preview` / `.month-entry-preview` (line-clamped) | `TimelineView.css` |
| `.cal-entry-expanded` | `.entry-card-full` (day view) / `EntryViewer` | `TimelineView.css:1158`, `EntryViewer.tsx` |
| `showDayDetail()` | `onTimePeriodSelect(date, 'day')` navigation | `App.tsx` `handleTimePeriodSelect` |
| `createWeekRow()` / `createDayColumn()` | JSX inside `renderMonthView()` / `renderWeekView()` | `TimelineView.tsx` |
| `getDayAccentColor()` | `calculateEntryColor` (crystal), `getZodiacGradientColor` | `entryColorUtils.ts`, existing |
| `getWeekAccentColor()` density | pixel maps + **new** density bucket classes (§5.8) | — |
| Lazy `buildWeekDetails()` | React conditional render, view-mode-gated `useMemo` (already implemented) | `TimelineView.tsx` |
| `escapeHtml` | React default escaping | — |

---

## 4. Token System Adaptation

### 4.1 Adopt: structural/typographic tokens (theme-neutral)

The guide's `clamp()` fluid-sizing discipline is its best low-risk idea. Add a **structure-only** token block — no colors — to the top of `TimelineView.css`:

```css
/* ── Fluid layout tokens (theme-neutral — colors ALWAYS come from --theme-*) ── */
:root {
  --cal-stack-gap: clamp(3px, 0.4vw, 6px);
  --cal-cell-padding: clamp(4px, 0.5vw, 8px);
  --cal-radius: 8px;
  --cal-radius-sm: 4px;
  --cal-radius-chip: 999px;

  --cal-label-size: clamp(11px, 0.9vw, 13px);
  --cal-body-size: clamp(12px, 1vw, 15px);
  --cal-date-size: clamp(18px, 2vw, 30px);       /* day-number in month cells */
  --cal-date-size-day-view: clamp(28px, 3vw, 42px);
  --cal-entry-size: clamp(11px, 0.9vw, 14px);

  --cal-entry-max-lines: 3;
  --cal-entry-line-height: 1.35;

  --cal-lift: -2px;                               /* hover lift distance */
  --cal-lift-duration: 0.2s;
}
```

Existing rules can migrate to these tokens opportunistically (no big-bang rewrite needed).

### 4.2 Reject: all color tokens

Every guide color (`--cal-surface`, `--cal-heading-color: #7fdfff`, chip rgba tables) is a **hardcoded palette** that would be identical in Temple of Light, NEON, Manuscript Room, and 31 other themes. Rule: **new CSS may only reference `--theme-*` variables, `--zodiac-gradient`, or per-entry inline colors from `calculateEntryColor`** (which are data-driven, not palette-driven). See §8.

> Audit note while we're here: base `.timeline-cell` rules in `TimelineView.css` still carry light-theme hex literals (`#e0e0e0`, `#e3f2fd`, `#2196f3`…) that each theme must override. Any *new* selectors introduced by this adaptation must not repeat that pattern — use `var(--theme-…, fallback)` from day one.

---

## 5. Pattern Adaptations (The Good Stuff, Made Native)

### 5.1 Semantic day-type accent system → `data-day-type` on `.timeline-cell`

**The guide's best idea.** We already have `.today`, `.selected`, `.has-entries` classes and the zodiac accent border. What's missing is the *semantic* layer: **weekend / past / future / empty** styling.

**TSX** (in `renderMonthView`'s day cell — real code already computes `day`, `hasEntries`, `isToday(day)`):

```tsx
const now = new Date();
const dayType =
  isToday(day) ? 'today' :
  day.getDay() === 0 || day.getDay() === 6 ? 'weekend' :
  hasEntries ? 'has-entries' :
  day < now ? 'past' : 'future';

<div
  className={`timeline-cell day-cell …existing classes…`}
  data-day-type={dayType}
  …
>
```

> Weekend detection must respect the active calendar eventually — for non-Gregorian
> calendars, "weekend" is a Gregorian concept; gate it behind `calendar === 'gregorian'`
> or derive from `weekStartsOn` (`(weekStartsOn + 5) % 7` and `(weekStartsOn + 6) % 7`).

**CSS** (theme-safe — opacity/filter-based, no palette):

```css
.timeline-cell[data-day-type="weekend"] .cell-date {
  color: var(--theme-accent, inherit);
  opacity: 0.9;
}
.timeline-cell[data-day-type="past"]   { opacity: 0.82; }
.timeline-cell[data-day-type="future"] { opacity: 0.94; }
/* today/has-entries/selected keep their existing rules — semantic layer only *adds* */
```

Past/future dimming gives month view an instant "where am I in time" read — the same job the guide's gray/dim hexes do, without breaking a single theme.

### 5.2 Hover lift → compositor-only, tuned for dense grids

`.timeline-cell` already declares `will-change: transform; transform: translateZ(0)`. The guide's lift translates cleanly — but in a 7×5 grid, lifted cells must layer above siblings and the transition must stay transform/shadow-only (our perf work keeps navigation at 60fps; layout-triggering hovers would regress it):

```css
.timeline-cell:hover {
  transform: translateZ(0) translateY(var(--cal-lift));
  box-shadow: 0 4px 12px var(--theme-focus-ring, rgba(0, 0, 0, 0.25));
  z-index: 3; /* above .selected (z-index: 2) while hovered */
}
```

Apply the same lift to `.year-cell` (decade view) and `.entry-card` (week view). **Do not** apply to `.minimap-segment` (the minimap has its own interaction model, and hundreds of segments would thrash the compositor budget).

### 5.3 Three-zone summary bar → `.week-entry-group-header` and `.cell-year-label`

The guide's *identity / density / metadata* zone split is a genuinely good information-architecture pattern. Native hosts:

**Month view — `.week-entry-group-header`** (already renders `.week-label` + `.week-entry-count`):

```
┌──────────────────────────────────────────────────────┐
│ Week of Jul 20        ▪▪▫▪▪▪▫         📝 12  📌 2   │
│ └─ zone 1 (exists)    └─ zone 2 NEW    └─ zone 3 NEW │
└──────────────────────────────────────────────────────┘
```

```css
.week-entry-group-header {
  display: flex;
  align-items: center;
  gap: var(--cal-stack-gap);
}
.week-group-zone-density { flex: 1 1 auto; min-width: 0; display: flex; gap: 2px; }
.week-group-zone-meta    { flex: 0 0 auto; display: flex; gap: 4px; flex-wrap: wrap; }
```

**Decade view — `.cell-year-label`** gets the same treatment: year number (zone 1), the existing `.year-pixel-map` already *is* zone 2, entry-count chip becomes zone 3.

### 5.4 Metadata chips → extend the `.entry-badge` family with real data sources

The guide invents mood/priority chips. Our real chip-worthy fields are richer:

| Chip | Source field | Display |
|---|---|---|
| Entry count | `entries.length` per period | `📝 12` |
| Pinned | `entry.pinned` | `📌 2` |
| Tags | `entry.tags: string[]` | first tag + `+n` (`.badge-tag-count` exists) |
| Attachments | `entry.attachments?.length` | `📎 3` |
| Links | `entry.linkedEntries?.length` | `🔗 1` |
| Time | `hour`/`minute` (nullable!) | `09:30` via existing `formatTime` |
| Tier | `entry.timeRange` | `.time-range-badge` already exists |

**One chip class, theme-safe** (both guide variants — inline and stacked — collapse into this):

```css
.cal-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px;
  border-radius: var(--cal-radius-chip);
  font-size: var(--cal-label-size);
  background: var(--theme-badge-default-bg, rgba(127, 127, 127, 0.12));
  color: var(--theme-badge-default-text, inherit);
  border: 1px solid var(--theme-border, transparent);
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cal-chip--active {
  background: var(--theme-badge-active-bg, rgba(127, 127, 127, 0.2));
  color: var(--theme-badge-active-text, inherit);
}
```

`--theme-badge-*` already exists in all 34 themes — chips are automatically on-theme everywhere.

### 5.5 Density strip → 7-dot week strip fed by `entryLookup` + `entryColors`

Year/decade views already have the superior version (pixel maps). The *gap* the guide fills is **week-level density in month view**. Native implementation — no new data plumbing, everything exists:

```tsx
// Inside the month view week-group header render; day = each of the 7 days
const weekDays = getWeekDaysFor(weekStart); // 7 Dates
<div className="week-group-zone-density" aria-hidden="true">
  {weekDays.map((d) => {
    const dayEntries = getDayEntriesOptimized(entryLookup, formatDate(d));
    const color = dayEntries.length > 0 && dayEntries[0].id !== undefined
      ? entryColors.get(dayEntries[0].id) // crystal color — already precomputed
      : undefined;
    return (
      <span
        key={d.getTime()}
        className={`week-density-dot${dayEntries.length ? ' has' : ''}`}
        style={color ? { background: color } : undefined}
        title={`${dayEntries.length} entries`}
      />
    );
  })}
</div>
```

```css
.week-density-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--theme-border, rgba(127,127,127,0.25));
  flex-shrink: 0;
}
.week-density-dot.has { box-shadow: 0 0 3px currentColor; }
```

Uses O(1) lookups; renders 7 spans per week row — negligible cost, and colors come from the **existing** `entryColors` map (no `calculateEntryColor` calls at render time — consistent with our perf passes).

### 5.6 Line-clamped previews → unify on tokens

`.card-preview` and `.month-entry-preview` already clamp. Unify their magic numbers onto the §4.1 tokens so tier density is tunable in one place:

```css
.card-preview, .month-entry-preview {
  font-size: var(--cal-entry-size);
  line-height: var(--cal-entry-line-height);
  display: -webkit-box;
  -webkit-line-clamp: var(--cal-entry-max-lines);
  -webkit-box-orient: vertical;
  overflow: hidden;
}
/* Week view gets taller previews than month view */
.timeline-week-view { --cal-entry-max-lines: 3; }
.timeline-month-view { --cal-entry-max-lines: 1; }
```

### 5.7 Expansion model → navigation *is* expansion (keep it that way)

The guide's `showDayDetail()` inline modal and "one open at a time" bookkeeping solve a problem we don't have: our tier system already *is* the progressive-disclosure mechanism (`month cell click → day view` via `handleTimePeriodSelect`, with tier-aware sounds and minimap sync). **Do not add a second expansion path.** The one legitimately missing affordance:

- **Peek without navigating**: the existing `title` tooltips on `.entry-badge` serve this. If richer peeking is ever wanted, it should be a single app-level popover (anchored, ESC-dismiss) driven by App state — not per-cell DOM.

### 5.8 Count-threshold coloring → theme-relative density buckets

Adopt the *bucketing* concept, discard the hex table. Buckets as classes, intensity via opacity so every theme's accent drives the hue:

```tsx
const density =
  count === 0 ? 'none' : count <= 2 ? 'light' : count <= 5 ? 'medium' : 'heavy';
// <span className={`cal-chip cal-chip--density-${density}`}>📝 {count}</span>
```

```css
.cal-chip--density-light  { opacity: 0.75; }
.cal-chip--density-medium { opacity: 0.9; }
.cal-chip--density-heavy  {
  opacity: 1;
  background: var(--theme-badge-active-bg);
  color: var(--theme-badge-active-text);
  font-weight: 600;
}
```

### 5.9 Ctrl+Enter save → genuinely missing, adopt in the editor

The only guide interaction we truly lack. Add to `JournalEditor.tsx` (and `EntryEditModal.tsx`) on the content textarea:

```tsx
onKeyDown={(e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleSave();
  }
}}
```

(`metaKey` included — the app ships on macOS too; see `entitlements.mac.plist` / build scripts.)

### 5.10 Fluid date typography → month/day cells

Adopt the guide's large-date hierarchy with our tokens:

```css
.cell-date   { font-size: var(--cal-date-size); font-weight: 700; }
.timeline-day-view .day-header-title-section h2 { font-size: var(--cal-date-size-day-view); }
```

---

## 6. Rejected Patterns and Why

| Pattern | Why rejected |
|---|---|
| Fixed side-panel container (`position:fixed; right:0`) | CalenRecall is a full-window timeline app, not an overlay panel on a chart |
| `innerHTML` assembly + inline `style="…"` strings | Un-themeable, un-typed, XSS-prone, fights React reconciliation and our incremental `entryLookup` updates |
| `element.style.setProperty` imperative theming | React `style` prop with CSS custom properties (existing `--zodiac-gradient` pattern) |
| Own nav header + tier buttons | Triplicates `NavigationBar` + minimap + keyboard nav; would desync sounds/perf checkpoints |
| Hardcoded `Mon…Sun` and ISO week numbers | Breaks `weekStartsOn` preference and all non-Gregorian calendars |
| Mood/priority/category color tables | Fields don't exist in `JournalEntry`; if sentiment ever ships, colors must route through the theme system |
| `showDayDetail()` inline modal expansion | Competing interaction model vs. tier navigation (§5.7) |
| Inline `<textarea>` entry creation in cells | `JournalEditor`/`EntryEditModal` are tier-aware, calendar-aware, attachment-capable |
| `escapeHtml`/`truncateText` JS utilities | React escaping + CSS line-clamp |
| `!important` scroll/display rules | Specificity debt; our theme override chain depends on predictable cascade |
| 480px/768px mobile hiding rules | Desktop Electron app with min window size; hiding `.cal-day-previews` on "mobile" is dead code here |
| Rebuild-and-replace DOM on save | Would bypass `EntriesContext` incremental O(1) mutation path (see `/memories/repo/audit-fixes.md` P9–P12) |

---

## 7. The Missing Fifth Tier — Decade

The guide's biggest blind spot. CalenRecall's decade view already implements the guide's "year tier" ambitions at a higher fidelity:

| Guide "year tier" feature | CalenRecall decade/year view equivalent | Status |
|---|---|---|
| Dot grid per month | `.year-pixel-map` (360 px) / `.month-pixel-map` (35 px), crystal-colored, tier-prioritized | ✅ exceeds |
| "Click month → zoom to month tier" | `onTimePeriodSelect(date, nextTier)` on every cell, all five tiers | ✅ exists |
| Compact week rows | `.year-grid` / `.decade-grid` cells with zodiac gradient accents | ✅ exists |
| — (absent) | Macro-cycle indicators (sexagenary, Mayan long count, Metonic, Calendar Round, Yuga) — toggle-gated, computed only when enabled | ✅ beyond scope of guide |

**Adaptations §5.1–5.5 must be applied to all FIVE tiers.** Concretely:
- `data-day-type` semantics → also `data-period-type` on year cells (`current-year`, `past`, `future`, `has-entries`)
- Three-zone summary → `.cell-year-label` rows in decade view
- Chips → year/decade cells' entry-count badges
- Hover lift → `.year-cell`

Tier-scoped entries also mean chip *counts* must respect prioritization: in year view a month cell shows `prioritizeEntriesByTier(entries, 'year')` results — the guide's flat `dayData.entries.length` model undercounts our week/month/year/decade entries.

---

## 8. Theme Compatibility Rules (Hard Requirements)

Any CSS introduced by this adaptation MUST:

1. **Never hardcode a color** except as a `var()` fallback: `var(--theme-accent, #808080)`.
2. Use only: `--theme-*` variables, `--zodiac-gradient`, per-entry colors from the `entryColors` map, or opacity/filter modulation of the above.
3. Not use `!important` (theme override chain depends on cascade order in `themes.css`).
4. Keep hover/animation effects **transform/opacity/box-shadow only** (compositor-friendly — `contain: layout style paint` is set on cells and layout-triggering hovers would break the 60fps navigation budget).
5. New selectors go in the component's CSS file (`TimelineView.css`), not `themes.css` — themes override, components define.
6. Test at minimum against: `classic-light`, `classic-dark`, `high-contrast`, `NEON`, `manuscript-room` (the extreme palette + serif cases).

---

## 9. Implementation Checklist

### Phase 1 — Tokens & chips (pure CSS, zero behavior risk)
- [ ] Add §4.1 structural token block to `TimelineView.css`
- [ ] Add `.cal-chip` + `.cal-chip--active` + density buckets (§5.4, §5.8)
- [ ] Unify `.card-preview` / `.month-entry-preview` onto clamp tokens (§5.6)
- [ ] Fluid `.cell-date` typography (§5.10)

### Phase 2 — Semantic day types
- [ ] Compute `dayType` in `renderMonthView` / `renderWeekView` day cells (`TimelineView.tsx`, §5.1)
- [ ] `data-day-type` CSS (opacity-based, theme-safe)
- [ ] `data-period-type` for year cells in decade view (§7)
- [ ] Verify against the 5 themes in §8.6

### Phase 3 — Hover lift
- [ ] `.timeline-cell:hover` / `.year-cell:hover` / `.entry-card:hover` lift (§5.2)
- [ ] Confirm no regression in perfTrail `timeline-view-render` timings while hovering during navigation

### Phase 4 — Three-zone summaries + density strips
- [ ] Refactor `.week-entry-group-header` into three zones (§5.3)
- [ ] `week-density-dot` strip fed by `getDayEntriesOptimized` + `entryColors` (§5.5)
- [ ] Zone treatment for `.cell-year-label` in decade view

### Phase 5 — Editor affordance
- [ ] Ctrl/Cmd+Enter save in `JournalEditor.tsx` + `EntryEditModal.tsx` (§5.9)

### Phase 6 — Verification
- [ ] `npx tsc --noEmit` → 0 errors; `npx vite build` clean
- [ ] Keyboard-navigate all five tiers with perfTrail open — no new checkpoints slower than existing budgets
- [ ] Theme sweep (§8.6) + `weekStartsOn` = 0, 1, 6 sanity check on density strips/weekend styling
- [ ] Non-Gregorian calendar spot-check (Hebrew 13-month leap year, Baháʼí 19+1) — no weekday/weekend mislabeling

---

## Related Documents

- `CALENDAR_FORMATTING_ADAPTATION_GUIDE.md` — the audited source (external, structure-blind)
- `GRANULAR_RUNTIME_AUDIT.md`, `PROJECT_AUDIT_REPORT.md` — prior audits
- `/memories/repo/audit-fixes.md` — perf passes P1–P15 (constraints that shaped §5.2, §5.5, §6)
