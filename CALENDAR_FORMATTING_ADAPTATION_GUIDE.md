# Calendar/Journal System — AstroMonix Panel Formatting Adaptation Guide

> **Purpose**: This document adapts the AstroMonix panel formatting system (documented in `PANEL_FORMATTING_EXHAUSTIVE_GUIDE.md`) to a **calendar/journal application** where weeks contain days, and each day column contains user-typed journal log entries. The system must adapt gracefully across all time tier views (year, month, week, day).
>
> **Source patterns**: AstroMonix Aspects Panel (stepped row layout + directional metadata chips), Planets Panel (three-zone sidecar layout + lazy details), Fixed Stars Panel (summary+details grid + modal expansion).
> **Date**: 2026-07-17

---

## Table of Contents

1. [Conceptual Mapping](#1-conceptual-mapping)
2. [CSS Variable System for Calendar](#2-css-variable-system-for-calendar)
3. [Base Container Structure](#3-base-container-structure)
4. [Time Tier Contexts — Responsive System](#4-time-tier-contexts--responsive-system)
5. [Week Row (Planet-Item Equivalent)](#5-week-row-planet-item-equivalent)
6. [Day Column (Aspect-Item Equivalent)](#6-day-column-aspect-item-equivalent)
7. [Journal Entry (Directional Meta Chip Equivalent)](#7-journal-entry-directional-meta-chip-equivalent)
8. [Color System for Calendar Contexts](#8-color-system-for-calendar-contexts)
9. [Interaction Patterns](#9-interaction-patterns)
10. [Complete HTML Assembly by View Tier](#10-complete-html-assembly-by-view-tier)
11. [Responsive Breakpoints](#11-responsive-breakpoints)
12. [Implementation Checklist](#12-implementation-checklist)

---

## 1. Conceptual Mapping

### 1.1 Core Entity Mapping

| AstroMonix Pattern | Calendar/Journal Equivalent | Why |
|--------------------|---------------------------|-----|
| `.panel` container | Calendar view container (`.cal-view`) | Holds the entire view |
| `#planet-list` / `#aspect-list` | Scrollable time period list (`.cal-timeline`) | Scrollable content area |
| `.planet-item` | Week row (`.cal-week`) | A time container holding sub-items |
| `.planet-matrix` | Week clickable shell (`.cal-week-shell`) | Click-to-expand week details |
| `.planet-summary` + three zones | Week summary bar | Date range, entry count, metadata |
| `.aspect-item` | Day column (`.cal-day`) | A day within a week |
| `.aspect-step-flow` | Day content flow | Stepped rows within a day |
| `.aspect-main` | Day header | Day name, date, today indicator |
| `.aspect-direction-meta` chips | Journal entry tags/mood chips | Small metadata labels |
| `.fixed-star-item` with `addDetailRow()` | Journal entry list | Expandable detail rows |
| `.planet-details` (hidden) | Expanded day entries | Full journal content |
| `.aspect-interpretation` (hidden) | Expanded journal entry | Full entry text |

### 1.2 Formatting Pattern Mapping

| AstroMonix Pattern | Calendar Usage |
|--------------------|----------------|
| Accent left border (`3-5px solid`) | Day type: today, weekend, has-entries, empty, past, future |
| Color-coded border per type | Each day status gets a unique border color |
| Three-zone sidecar | Left: date header, Center: entry previews, Right: metadata chips |
| Stepped row layout | Day header → Entry count → Tag chips → Expand button |
| Metadata chips (detailChip) | Entry tags, mood emoji, word count, timestamp |
| Grid detail rows | Individual journal entries in expanded view |
| Orb color thresholds | Entry importance/color coding |
| Hover lift (`translateY(-2px)`) | Day/week hover effect |
| Lazy details (deferred build) | Entries loaded on first expand |
| Modal expansion (one open at a time) | Only one day/week expanded |
| Custom CSS variables per item | Day-specific colors via `--day-accent`, `--day-type` |

---

## 2. CSS Variable System for Calendar

### 2.1 Foundation Variables

```css
:root {
    /* --- Calendar Base Dimensions --- */
    --cal-header-height: 60px;
    --cal-info-top: calc(var(--cal-header-height) + 12px);
    --cal-week-width: clamp(280px, 30vw, 480px);
    --cal-day-width: clamp(120px, 14vw, 200px);
    --cal-day-min-width: 100px;
    --cal-stack-gap: clamp(6px, 0.8vw, 10px);
    --cal-info-max-height: calc(100vh - var(--cal-info-top) - 22px);

    /* --- Surface Colors (based on panel system) --- */
    --cal-surface: rgba(13, 20, 36, 0.95);
    --cal-surface-alt: rgba(17, 26, 46, 0.9);
    --cal-surface-hover: rgba(25, 40, 65, 0.85);
    --cal-border-strong: #39415a;
    --cal-border-muted: rgba(57, 65, 90, 0.5);
    --cal-shadow-rest: 0 2px 8px rgba(0, 0, 0, 0.3);
    --cal-shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.4);
    --cal-shadow-item: 0 2px 10px rgba(0, 0, 0, 0.4);
    --cal-shadow-summary: 0 1px 4px rgba(0, 0, 0, 0.22);

    /* --- Padding & Gap --- */
    --cal-padding: clamp(4px, 0.5vw, 6px);
    --cal-gap: clamp(3px, 0.4vw, 5px);
    --cal-week-padding: clamp(6px, 0.6vw, 10px);
    --cal-day-padding: clamp(4px, 0.4vw, 8px);

    /* --- Border Radius --- */
    --cal-radius-lg: 12px;
    --cal-radius: 8px;
    --cal-radius-sm: 4px;
    --cal-radius-chip: 999px;
    --cal-radius-day: 6px;

    /* --- Typography --- */
    --cal-header-size: clamp(14px, 1.2vw, 18px);
    --cal-body-size: clamp(12px, 1vw, 15px);
    --cal-label-size: clamp(11px, 0.9vw, 13px);
    --cal-day-header-size: clamp(15px, 1.3vw, 20px);
    --cal-entry-size: clamp(11px, 0.9vw, 14px);
    --cal-date-size: clamp(24px, 2.2vw, 36px);
    --cal-heading-color: #7fdfff;
    --cal-muted-color: #8899bb;
    --cal-text: #e8f8e8;
    --cal-text-dim: #6a7a9a;

    /* --- Entry Density --- */
    --cal-entry-max-lines: 3;
    --cal-entry-line-height: 1.35;

    /* --- Backdrop --- */
    --cal-blur: blur(10px);
}
```

### 2.2 Day Status Color Variables (per-item, set via JS)

```css
/* These are set dynamically via element.style.setProperty() */
--day-accent: #4ecdc4;       /* accent border color for this day */
--day-bg-tint: rgba(78,205,196,0.08);  /* subtle background tint */
--day-type: 'today';          /* data attribute: today, weekend, has-entries, empty, past, future */
--day-entry-density: 3;       /* number of entries in this day */
```

### 2.3 Viewport-Aware Sizing Variables (set by JS per view tier)

```css
/* Set dynamically based on time tier context */
--cal-view-tier: 'month';     /* 'year', 'month', 'week', 'day' */
--cal-week-count: 5;          /* rows of weeks visible */
--cal-day-count: 7;           /* columns of days visible */
--cal-cell-aspect: 1;         /* aspect ratio for day cells in grid mode */
```

---

## 3. Base Container Structure

### 3.1 Calendar View Container

**HTML** — replaces the `.panel` container:
```html
<section id="calendar-view" class="cal-view">
    <!-- View Header -->
    <div class="cal-view-header">
        <h3>
            <span id="cal-view-title">July 2026</span>
            <div class="cal-view-nav">
                <button class="cal-nav-btn" data-direction="prev">◀</button>
                <button class="cal-nav-btn cal-nav-today">Today</button>
                <button class="cal-nav-btn" data-direction="next">▶</button>
            </div>
            <div class="cal-view-toggles">
                <button class="cal-tier-btn active" data-tier="month">Month</button>
                <button class="cal-tier-btn" data-tier="week">Week</button>
                <button class="cal-tier-btn" data-tier="day">Day</button>
            </div>
        </h3>
    </div>

    <!-- Day-of-week Headers (for month/week grid views) -->
    <div id="cal-day-headers" class="cal-day-headers">
        <span class="cal-day-header">Mon</span>
        <span class="cal-day-header">Tue</span>
        <span class="cal-day-header">Wed</span>
        <span class="cal-day-header">Thu</span>
        <span class="cal-day-header">Fri</span>
        <span class="cal-day-header">Sat</span>
        <span class="cal-day-header">Sun</span>
    </div>

    <!-- Scrollable Timeline (replaces #planet-list) -->
    <div id="cal-timeline" class="cal-timeline">
        <!-- Weeks/Days rendered here -->
    </div>
</section>
```

### 3.2 Base Container CSS

```css
.cal-view {
    background: var(--cal-surface);
    border: 1.5px solid var(--cal-border-strong);
    border-radius: var(--cal-radius-lg);
    box-shadow: var(--cal-shadow-rest);
    color: var(--cal-text);
    padding: var(--cal-padding);
    margin: 0;
    font-size: var(--cal-body-size);
    z-index: 1020;
    -webkit-backdrop-filter: var(--cal-blur);
    backdrop-filter: var(--cal-blur);
    transition: 0.15s ease;
    will-change: transform, opacity;
    display: flex;
    flex-direction: column;
    gap: var(--cal-gap);
    position: fixed;
    top: var(--cal-info-top);
    right: 0;
    width: var(--cal-week-width);
    height: var(--cal-info-max-height);
    max-height: var(--cal-info-max-height);
    overflow: hidden;
}

.cal-view-header h3 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: clamp(3px, 0.4vw, 5px);
    margin: 0 0 var(--cal-gap) 0;
    padding: 0 0 6px 0;
    font-size: var(--cal-header-size);
    color: var(--cal-heading-color);
    font-weight: 600;
    letter-spacing: 0.01em;
    border-bottom: 1px solid var(--cal-border-muted);
    font-kerning: normal;
    font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
}

.cal-timeline {
    flex: 1;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    font-size: var(--cal-body-size);
    scrollbar-width: thin;
    scrollbar-color: var(--cal-heading-color) var(--cal-surface-alt);
    display: flex;
    flex-direction: column;
    gap: var(--cal-gap);
}

/* Scrollbar — matching panel system */
.cal-timeline::-webkit-scrollbar { width: 7px; background: var(--cal-surface-alt); }
.cal-timeline::-webkit-scrollbar-thumb {
    background: var(--cal-heading-color);
    border-radius: clamp(6px, 0.7vw, 8px);
}
.cal-timeline::-webkit-scrollbar-track {
    background: var(--cal-surface-alt);
    border-radius: clamp(3px, 0.4vw, 4px);
}

/* Day-of-week headers */
.cal-day-headers {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    padding: 0 4px;
    margin-bottom: 2px;
    flex-shrink: 0;
}
.cal-day-header {
    text-align: center;
    font-size: var(--cal-label-size);
    color: var(--cal-muted-color);
    font-weight: 600;
    padding: 4px 0;
    letter-spacing: 0.03em;
    text-transform: uppercase;
}

/* View nav buttons */
.cal-nav-btn {
    background: transparent;
    border: 1px solid var(--cal-border-muted);
    color: var(--cal-heading-color);
    padding: 4px 10px;
    border-radius: var(--cal-radius-sm);
    cursor: pointer;
    font-size: 0.85em;
    transition: all 0.15s ease;
}
.cal-nav-btn:hover {
    background: rgba(127, 223, 255, 0.1);
    border-color: var(--cal-heading-color);
}
.cal-nav-today {
    font-weight: 700;
    border-color: var(--cal-heading-color);
}
.cal-tier-btn {
    background: transparent;
    border: 1px solid var(--cal-border-muted);
    color: var(--cal-muted-color);
    padding: 3px 8px;
    border-radius: var(--cal-radius-sm);
    cursor: pointer;
    font-size: 0.78em;
    transition: all 0.15s ease;
}
.cal-tier-btn.active {
    background: rgba(127, 223, 255, 0.15);
    border-color: var(--cal-heading-color);
    color: var(--cal-heading-color);
    font-weight: 600;
}
.cal-tier-btn:hover {
    background: rgba(127, 223, 255, 0.08);
    border-color: var(--cal-heading-color);
}
```

---

## 4. Time Tier Contexts — Responsive System

This is the core adaptation: each view tier transforms the calendar layout while reusing the same formatting patterns.

### 4.1 Tier State Variables (Set by JS)

```javascript
const calTierConfig = {
    year: {
        weekDisplayMode: 'compact',     // tiny week rows
        dayDisplayMode: 'dot',           // dots for days with entries
        showEntryText: false,
        maxWeekRows: 52,
        dayCellSize: '8px',
        weekPadding: '2px 4px',
        showDayHeaders: false
    },
    month: {
        weekDisplayMode: 'normal',       // standard week rows
        dayDisplayMode: 'column',        // mini day columns
        showEntryText: false,
        maxWeekRows: 6,
        dayCellSize: 'minmax(30px, 1fr)',
        weekPadding: 'var(--cal-week-padding)',
        showDayHeaders: true
    },
    week: {
        weekDisplayMode: 'expanded',     // taller week rows
        dayDisplayMode: 'full-column',   // full day columns with previews
        showEntryText: true,
        maxEntryPreviews: 3,
        maxWeekRows: 1,
        dayCellSize: '1fr',
        weekPadding: 'var(--cal-week-padding)',
        showDayHeaders: true
    },
    day: {
        weekDisplayMode: 'single',       // single column
        dayDisplayMode: 'full',          // full day with all entries
        showEntryText: true,
        maxEntryPreviews: Infinity,
        maxWeekRows: 1,
        dayCellSize: '1fr',
        weekPadding: 'var(--cal-week-padding)',
        showDayHeaders: false
    }
};
```

### 4.2 Tier Transition Logic

```javascript
function setCalTier(tier) {
    const config = calTierConfig[tier];
    const timeline = document.getElementById('cal-timeline');
    
    // CSS custom properties for the tier
    timeline.style.setProperty('--cal-tier', tier);
    timeline.style.setProperty('--cal-week-display', tier === 'year' ? 'compact' : 'normal');
    timeline.style.setProperty('--cal-day-display', config.dayDisplayMode);
    timeline.style.setProperty('--cal-show-entry-text', config.showEntryText ? '1' : '0');
    
    // Update day headers visibility
    const dayHeaders = document.getElementById('cal-day-headers');
    if (dayHeaders) {
        dayHeaders.style.display = config.showDayHeaders ? 'grid' : 'none';
    }
    
    // Rebuild the timeline with new tier configuration
    rebuildCalendarTimeline(tier);
    
    // Update active tier button
    document.querySelectorAll('.cal-tier-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tier === tier);
    });
}
```

### 4.3 Grid Layout Per Tier

**CSS** — `.cal-timeline` adapts its layout:
```css
/* Month view: Grid of day cells within week rows */
.cal-view[data-tier="month"] .cal-week {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
}

/* Week view: Single row of day columns */
.cal-view[data-tier="week"] .cal-week {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    min-height: 180px;
}

/* Day view: Single column, single day */
.cal-view[data-tier="day"] .cal-week {
    display: block;
}

/* Year view: Compact grid */
.cal-view[data-tier="year"] .cal-week {
    display: grid;
    grid-template-columns: repeat(7, 8px);
    gap: 1px;
    padding: 2px 4px;
}
```

---

## 5. Week Row (Planet-Item Equivalent)

The week row is the top-level container, adapting from AstroMonix's `.planet-item`.

### 5.1 Week Row HTML (Month/Week Tiers)

```html
<div class="cal-week" id="cal-week-2026-30" data-week="30" data-year="2026"
     data-entry-count="12" style="--week-accent: #4ecdc4;">
    
    <!-- Week Summary Bar (like planet-summary) -->
    <div class="cal-week-summary"
      style="border-left: 4px solid var(--week-accent, #4ecdc4);
             padding: var(--cal-week-padding);
             border-radius: var(--cal-radius);
             box-shadow: var(--cal-shadow-summary);">
        
        <!-- Zone 1 (Left): Week number + date range -->
        <div class="cal-week-zone-left">
            <div class="cal-week-number"
              style="font-weight:bold; font-size:1.1em; color:var(--week-accent);">
                Week 30
            </div>
            <div class="cal-week-range"
              style="font-size:0.85em; color:var(--cal-muted-color);">
                Jul 20 – Jul 26
            </div>
        </div>
        
        <!-- Zone 2 (Center): Entry density bar -->
        <div class="cal-week-zone-center" style="flex:1;">
            <div class="cal-week-density"
              style="display:flex; gap:2px; align-items:center; height:20px;">
                <!-- Mini dots representing days with entries -->
                <span class="cal-density-dot" style="width:6px;height:6px;border-radius:50%;
                      background:var(--day-accent, #555);" title="Mon: 3 entries"></span>
                <span class="cal-density-dot" style="width:6px;height:6px;border-radius:50%;
                      background:var(--day-accent, #555);" title="Tue: 0 entries"></span>
                <!-- ... 5 more dots ... -->
            </div>
        </div>
        
        <!-- Zone 3 (Right): Metadata chips -->
        <div class="cal-week-zone-right"
          style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
            <span class="cal-meta-chip"
              style="display:inline-flex; align-items:center; gap:4px;
                     padding:2px 8px; border-radius:var(--cal-radius-chip);
                     background:rgba(127,223,255,0.12);
                     border:1px solid rgba(127,223,255,0.25);
                     font-size:0.78em; color:var(--cal-heading-color);">
                📝 12 entries
            </span>
            <span class="cal-meta-chip"
              style="display:inline-flex; align-items:center; gap:4px;
                     padding:2px 8px; border-radius:var(--cal-radius-chip);
                     background:rgba(255,215,0,0.12);
                     border:1px solid rgba(255,215,0,0.25);
                     font-size:0.78em; color:#ffd700;">
                ⭐ 3 tagged
            </span>
        </div>
    </div>
    
    <!-- Day Columns (rendered as grid cells inside the week) -->
    <div class="cal-week-days" style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px;">
        <!-- Day items rendered here — see §6 -->
    </div>
    
    <!-- Hidden expanded week detail (like planet-details) -->
    <div class="cal-week-details" style="display:none; margin-top:6px;">
        <div class="cal-week-details-header" style="display:flex; justify-content:space-between;
             align-items:center; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1);">
            <h4 style="margin:0; color:var(--cal-heading-color); font-size:1.1em;">
                Week 30 — Detailed View
            </h4>
            <button class="cal-collapse-btn" style="background:transparent; border:1px solid var(--cal-heading-color);
                   color:var(--cal-heading-color); padding:4px 8px; border-radius:var(--cal-radius-sm);
                   cursor:pointer; font-size:0.8em;">Collapse</button>
        </div>
        <div class="cal-week-details-content"
          style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-top:6px;">
            <!-- All days expanded in detail -->
        </div>
    </div>
</div>
```

### 5.2 Week Row CSS

```css
.cal-week {
    margin-bottom: 4px;
    transition: all 0.2s ease-out;
    cursor: pointer;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.cal-week:hover {
    transform: translateY(-1px);
}

.cal-week-summary {
    display: flex;
    align-items: center;
    gap: clamp(8px, 1vw, 16px);
    cursor: pointer;
    transition: all 0.2s ease-out;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
}

.cal-week-summary:hover {
    box-shadow: var(--cal-shadow-elevated);
}

.cal-week-zone-left {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.cal-week-zone-center {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
}

.cal-week-zone-right {
    flex: 0 0 auto;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
}

/* Hover lift — matching planet-item pattern */
.cal-week:hover {
    transform: translateY(-2px);
    box-shadow: var(--cal-shadow-elevated);
}
.cal-week:not(:hover) {
    transform: translateY(0);
    box-shadow: none;
}
```

### 5.3 Week Row Construction (JS)

```javascript
function createWeekRow(weekData, tier) {
    const weekDiv = document.createElement('div');
    weekDiv.className = 'cal-week';
    weekDiv.id = `cal-week-${weekData.year}-${weekData.weekNum}`;
    weekDiv.dataset.week = String(weekData.weekNum);
    weekDiv.dataset.year = String(weekData.year);
    weekDiv.dataset.entryCount = String(weekData.totalEntries);
    
    const accentColor = getWeekAccentColor(weekData); // based on entry density
    weekDiv.style.setProperty('--week-accent', accentColor);
    
    const densityDots = weekData.days.map(day => {
        const dotColor = day.entryCount > 0 ? getDayAccentColor(day) : '#444';
        return `<span class="cal-density-dot"
          style="width:6px;height:6px;border-radius:50%;background:${dotColor};"
          title="${day.name}: ${day.entryCount} entries"></span>`;
    }).join('');
    
    const entryChip = weekData.totalEntries > 0
        ? `<span class="cal-meta-chip"
             style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;
                    border-radius:var(--cal-radius-chip);
                    background:rgba(127,223,255,0.12);
                    border:1px solid rgba(127,223,255,0.25);
                    font-size:0.78em;color:var(--cal-heading-color);">
             📝 ${weekData.totalEntries} entries</span>`
        : '';
    
    const taggedChip = weekData.taggedCount > 0
        ? `<span class="cal-meta-chip"
             style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;
                    border-radius:var(--cal-radius-chip);
                    background:rgba(255,215,0,0.12);
                    border:1px solid rgba(255,215,0,0.25);
                    font-size:0.78em;color:#ffd700;">
             ⭐ ${weekData.taggedCount} tagged</span>`
        : '';
    
    weekDiv.innerHTML = `
        <div class="cal-week-summary"
          style="border-left:4px solid ${accentColor}; padding:var(--cal-week-padding);
                 border-radius:var(--cal-radius); box-shadow:var(--cal-shadow-summary);">
            <div class="cal-week-zone-left">
                <div class="cal-week-number"
                  style="font-weight:bold; font-size:1.1em; color:${accentColor};">
                  Week ${weekData.weekNum}
                </div>
                <div class="cal-week-range"
                  style="font-size:0.85em; color:var(--cal-muted-color);">
                  ${weekData.startDate} – ${weekData.endDate}
                </div>
            </div>
            <div class="cal-week-zone-center" style="flex:1;">
                <div class="cal-week-density"
                  style="display:flex; gap:2px; align-items:center; height:20px;">
                  ${densityDots}
                </div>
            </div>
            <div class="cal-week-zone-right"
              style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
              ${entryChip} ${taggedChip}
            </div>
        </div>
        <div class="cal-week-days" style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-top:4px;">
            ${weekData.days.map(day => createDayColumn(day, tier)).join('')}
        </div>
        <div class="cal-week-details" style="display:none; margin-top:6px;">
            <div class="cal-week-details-header" style="display:flex; justify-content:space-between;
                 align-items:center; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1);">
                <h4 style="margin:0; color:var(--cal-heading-color); font-size:1.1em;">
                  Week ${weekData.weekNum} — Detailed View
                </h4>
                <button class="cal-collapse-btn" style="background:transparent; border:1px solid var(--cal-heading-color);
                       color:var(--cal-heading-color); padding:4px 8px; border-radius:var(--cal-radius-sm);
                       cursor:pointer; font-size:0.8em;">Collapse</button>
            </div>
            <div class="cal-week-details-content"
              style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-top:6px;"></div>
        </div>
    `;
    
    // Lazy detail build (like planet details)
    let detailsBuilt = false;
    const summary = weekDiv.querySelector('.cal-week-summary');
    summary.addEventListener('click', function(e) {
        if (e.target.closest('.cal-collapse-btn')) return;
        const details = weekDiv.querySelector('.cal-week-details');
        const isVisible = details.style.display !== 'none';
        details.style.display = isVisible ? 'none' : 'block';
        if (!isVisible && !detailsBuilt) {
            buildWeekDetails(weekDiv, weekData);
            detailsBuilt = true;
        }
    });
    
    return weekDiv;
}
```

---

## 6. Day Column (Aspect-Item Equivalent)

The day column is the core content unit, adapting from AstroMonix's `.aspect-item` with its stepped flow and directional metadata chips.

### 6.1 Day Column HTML (Month/Week Tiers)

```html
<div class="cal-day" id="cal-day-2026-07-20"
     data-date="2026-07-20" data-day-name="Monday" data-entry-count="3"
     style="--day-accent: #4ecdc4; --day-type: today; --day-entry-density: 3;
            border-left: 4px solid var(--day-accent, #4ecdc4);
            padding: var(--cal-day-padding); border-radius: var(--cal-radius-day);
            box-shadow: var(--cal-shadow-item); cursor: pointer;
            transition: all 0.2s ease-out; min-width: 0;">

    <!-- STEP 1: Day Header (like aspect-header with focus button) -->
    <div class="cal-day-header"
      style="display:flex; align-items:center; justify-content:space-between; gap:4px;
             margin-bottom:2px;">
        <button class="cal-day-focus" title="Jump to this day"
          style="background:none; border:1px solid rgba(200,220,240,0.4); border-radius:50%;
                 width:20px; height:20px; padding:0; cursor:pointer; color:var(--cal-heading-color);
                 font-size:0.65em; display:flex; align-items:center; justify-content:center;
                 transition:all 0.2s ease; flex-shrink:0;">◉</button>
        <span class="cal-day-name"
          style="font-size:0.78em; color:var(--cal-muted-color); font-weight:600;">Mon</span>
        <span class="cal-day-number"
          style="font-size:var(--cal-date-size); font-weight:700; color:var(--day-accent);">20</span>
    </div>

    <!-- STEP 2: Entry Preview Area (like aspect-main) — hidden in month, visible in week/day -->
    <div class="cal-day-previews"
      style="display:var(--cal-show-entry-previews, none); flex-direction:column; gap:2px;
             min-width:0; margin-top:2px;">
        <!-- Visible in week/day tiers -->
        <div class="cal-entry-preview" title="Click to expand"
          style="font-size:var(--cal-entry-size); color:var(--cal-text-dim); line-height:var(--cal-entry-line-height);
                 overflow:hidden; text-overflow:ellipsis; display:-webkit-box;
                 -webkit-line-clamp:var(--cal-entry-max-lines); -webkit-box-orient:vertical;
                 padding:2px 4px; border-radius:3px;
                 background:rgba(255,255,255,0.04); margin-bottom:1px;
                 border-left:2px solid var(--entry-tag-color, transparent);">
            <span class="cal-entry-time" style="color:var(--cal-muted-color); font-size:0.85em;">09:30</span>
            Had a great meeting about the new project...
        </div>
        <div class="cal-entry-preview">...</div>
    </div>

    <!-- STEP 3: Entry Count + Tags (like aspect-orb-step / directional-meta) -->
    <div class="cal-day-meta"
      style="display:flex; align-items:center; gap:4px; flex-wrap:wrap; margin-top:auto;">
        <span class="cal-meta-chip"
          style="display:inline-flex; align-items:center; gap:3px; padding:1px 6px;
                 border-radius:var(--cal-radius-chip); font-size:0.7em;
                 background:rgba(127,223,255,0.1); border:1px solid rgba(127,223,255,0.2);
                 color:var(--cal-heading-color);">
            📝 ${entryCount}
        </span>
        <span class="cal-meta-chip mood-chip"
          style="display:inline-flex; align-items:center; gap:3px; padding:1px 6px;
                 border-radius:var(--cal-radius-chip); font-size:0.7em;
                 background:rgba(255,215,0,0.1); border:1px solid rgba(255,215,0,0.2);">😊</span>
    </div>
</div>
```

### 6.2 Day Column CSS

```css
.cal-day {
    transition: all 0.2s ease-out;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-wrap: anywhere;
    word-break: break-word;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    position: relative;
}

.cal-day:hover {
    transform: translateY(-2px);
    box-shadow: var(--cal-shadow-elevated);
    z-index: 2;
}

.cal-day:not(:hover) {
    transform: translateY(0);
    box-shadow: var(--cal-shadow-item);
}

/* Today indicator */
.cal-day[data-day-type="today"] {
    --day-accent: #ffd700;
    box-shadow: 0 0 0 1.5px rgba(255, 215, 0, 0.4), var(--cal-shadow-item);
}

/* Weekend styling */
.cal-day[data-day-type="weekend"] {
    --day-accent: #5ec9ff;
    background: rgba(94, 201, 255, 0.03);
}

/* Empty day */
.cal-day[data-day-type="empty"] {
    opacity: 0.5;
}

/* Past day */
.cal-day[data-day-type="past"] {
    opacity: 0.7;
}

/* Day has entries */
.cal-day[data-day-type="has-entries"] {
    --day-accent: #4ecdc4;
}

/* Day focus button hover — matching aspect focus btn pattern */
.cal-day-focus:hover {
    background: rgba(127, 223, 255, 0.1);
    border-color: rgba(200, 220, 240, 0.7);
}
```

### 6.3 Day Column Construction (JS)

```javascript
function createDayColumn(dayData, tier) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'cal-day';
    dayDiv.id = `cal-day-${dayData.isoDate}`;
    dayDiv.dataset.date = dayData.isoDate;
    dayDiv.dataset.dayName = dayData.name;
    dayDiv.dataset.entryCount = String(dayData.entries.length);
    
    // Determine day type
    const dayType = getDayType(dayData); // 'today', 'weekend', 'has-entries', 'empty', 'past', 'future'
    dayDiv.dataset.dayType = dayType;
    
    const accentColor = getDayAccentColor(dayData);
    dayDiv.style.setProperty('--day-accent', accentColor);
    dayDiv.style.setProperty('--day-type', dayType);
    dayDiv.style.setProperty('--day-entry-density', String(dayData.entries.length));
    
    // Build entry previews (only for week/day tiers)
    const showPreviews = (tier === 'week' || tier === 'day');
    const maxPreviews = tier === 'day' ? Infinity : 3;
    const entryPreviewsHTML = showPreviews && dayData.entries.length > 0
        ? `<div class="cal-day-previews"
             style="display:flex; flex-direction:column; gap:2px; min-width:0; margin-top:2px;">
             ${dayData.entries.slice(0, maxPreviews).map(entry => createEntryPreview(entry)).join('')}
             ${dayData.entries.length > maxPreviews
               ? `<div style="font-size:0.7em; color:var(--cal-muted-color); text-align:center;
                     padding:1px 0;">+${dayData.entries.length - maxPreviews} more</div>`
               : ''}
           </div>`
        : '';
    
    // Build metadata chips
    const entryChip = dayData.entries.length > 0
        ? `<span class="cal-meta-chip"
             style="display:inline-flex; align-items:center; gap:3px; padding:1px 6px;
                    border-radius:var(--cal-radius-chip); font-size:0.7em;
                    background:rgba(127,223,255,0.1); border:1px solid rgba(127,223,255,0.2);
                    color:var(--cal-heading-color);">📝 ${dayData.entries.length}</span>`
        : '';
    
    const moodChip = dayData.dominantMood
        ? `<span class="cal-meta-chip mood-chip"
             style="display:inline-flex; align-items:center; gap:3px; padding:1px 6px;
                    border-radius:var(--cal-radius-chip); font-size:0.7em;
                    background:rgba(255,215,0,0.1); border:1px solid rgba(255,215,0,0.2);">
             ${dayData.dominantMood}</span>`
        : '';
    
    dayDiv.innerHTML = `
        <div class="cal-day-header"
          style="display:flex; align-items:center; justify-content:space-between; gap:4px; margin-bottom:2px;">
            <button class="cal-day-focus" title="Jump to this day"
              style="background:none; border:1px solid rgba(200,220,240,0.4); border-radius:50%;
                     width:20px; height:20px; padding:0; cursor:pointer; color:var(--cal-heading-color);
                     font-size:0.65em; display:flex; align-items:center; justify-content:center;
                     transition:all 0.2s ease; flex-shrink:0;">◉</button>
            <span class="cal-day-name"
              style="font-size:0.78em; color:var(--cal-muted-color); font-weight:600;">${dayData.shortName}</span>
            <span class="cal-day-number"
              style="font-size:var(--cal-date-size); font-weight:700; color:${accentColor};">${dayData.dayNumber}</span>
        </div>
        ${entryPreviewsHTML}
        <div class="cal-day-meta"
          style="display:flex; align-items:center; gap:4px; flex-wrap:wrap; margin-top:auto;">
          ${entryChip} ${moodChip}
        </div>
    `;
    
    // Click handler — toggle expanded day detail view
    dayDiv.addEventListener('click', function(e) {
        if (e.target.closest('.cal-day-focus')) return; // focus button handled separately
        
        // Build and show expanded day detail
        showDayDetail(dayData, dayDiv);
    });
    
    // Focus button click
    const focusBtn = dayDiv.querySelector('.cal-day-focus');
    focusBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        jumpToDay(dayData.isoDate);
        // Visual feedback flash
        focusBtn.style.background = 'rgba(127, 223, 255, 0.15)';
        focusBtn.style.borderColor = 'rgba(200, 220, 240, 0.8)';
        setTimeout(() => {
            focusBtn.style.background = 'none';
            focusBtn.style.borderColor = 'rgba(200, 220, 240, 0.4)';
        }, 300);
    });
    
    return dayDiv;
}
```

---

## 7. Journal Entry (Directional Meta Chip Equivalent)

Individual journal entries adapt from AstroMonix's `detailChip()` function and `aspect-direction-meta` chips.

### 7.1 Entry Preview (Shown in Day Column)

Adapted from `detailChip`:
```javascript
function createEntryPreview(entryData) {
    const tagColor = getEntryTagColor(entryData.tags);
    const timeColor = entryData.isPinned ? '#ffd700' : 'var(--cal-muted-color)';
    
    return `<div class="cal-entry-preview" title="${entryData.text}"
      style="font-size:var(--cal-entry-size); color:var(--cal-text-dim);
             line-height:var(--cal-entry-line-height);
             overflow:hidden; text-overflow:ellipsis; display:-webkit-box;
             -webkit-line-clamp:var(--cal-entry-max-lines, 3); -webkit-box-orient:vertical;
             padding:2px 4px; border-radius:3px;
             background:rgba(255,255,255,0.04); margin-bottom:1px; cursor:pointer;
             border-left:2px solid ${tagColor}; transition:all 0.15s ease;">
        <span class="cal-entry-time"
          style="color:${timeColor}; font-size:0.85em; font-weight:600; margin-right:6px;">
          ${entryData.time}</span>
        <span class="cal-entry-text">${escapeHtml(truncateText(entryData.text, 80))}</span>
    </div>`;
}
```

### 7.2 Entry Tag Chips (Like Directional Metadata)

Adapted from the `detailChip()` function with its label/value/border/background pattern:

```javascript
function createEntryTagChip(tag) {
    const colors = getTagColors(tag); // returns { bg, border, text }
    
    const config = {
        mood: {
            // Stacked variant (like Application chip)
            isStacked: true,
            background: 'rgba(255, 215, 0, 0.12)',
            border: 'rgba(255, 215, 0, 0.25)',
            textColor: '#ffe38c'
        },
        category: {
            // Inline variant (like Hand chip)
            isStacked: false,
            background: 'rgba(94, 201, 255, 0.12)',
            border: 'rgba(94, 201, 255, 0.25)',
            textColor: '#8be8ff'
        },
        priority: {
            isStacked: false,
            background: tag.level === 'high' ? 'rgba(255, 68, 68, 0.15)' : 'rgba(255, 193, 7, 0.12)',
            border: tag.level === 'high' ? 'rgba(255, 68, 68, 0.3)' : 'rgba(255, 193, 7, 0.25)',
            textColor: tag.level === 'high' ? '#ff6666' : '#ffd93d'
        },
        custom: {
            isStacked: false,
            background: colors.bg,
            border: colors.border,
            textColor: colors.text
        }
    };
    
    const c = config[tag.type] || config.custom;
    
    if (c.isStacked) {
        return `<span style="display:inline-flex; flex-direction:column; align-items:flex-start;
                            gap:1px; padding:3px 6px; border-radius:8px;
                            background:${c.background}; border:1px solid ${c.border};
                            min-width:60px; max-width:100%;">
                  <strong style="color:rgba(255,255,255,0.6); font-size:0.75em; line-height:1.1;">
                    ${tag.label}:</strong>
                  <span style="color:${c.textColor}; font-weight:600; line-height:1.15; font-size:0.85em;">
                    ${tag.value}</span>
                </span>`;
    }
    
    return `<span style="display:inline-flex; align-items:center; gap:4px;
                        padding:2px 7px; border-radius:var(--cal-radius-chip);
                        background:${c.background}; border:1px solid ${c.border};
                        white-space:nowrap; font-size:0.75em;">
              <strong style="color:rgba(255,255,255,0.55); font-size:0.9em;">${tag.label}:</strong>
              <span style="color:${c.textColor}; font-weight:600;">${tag.value}</span>
            </span>`;
}
```

### 7.3 Entry Tag Color Mapping (Like Aspect Orb Colors)

```javascript
const tagColorThresholds = {
    // Priority levels — like orb color thresholds
    priority: {
        critical: { bg: 'rgba(255, 68, 68, 0.18)', border: 'rgba(255, 131, 131, 0.34)', text: '#ffb3b3' },
        high:     { bg: 'rgba(255, 152, 0, 0.18)', border: 'rgba(255, 196, 93, 0.34)', text: '#ffd27a' },
        medium:   { bg: 'rgba(255, 215, 0, 0.15)', border: 'rgba(255, 221, 115, 0.30)', text: '#ffe38c' },
        low:      { bg: 'rgba(144, 164, 174, 0.15)', border: 'rgba(180, 200, 220, 0.25)', text: '#d7e2ed' }
    },
    // Mood colors — like phase (waxing/waning) colors
    mood: {
        happy:    { bg: 'rgba(34, 139, 94, 0.18)', border: 'rgba(103, 224, 162, 0.35)', text: '#8ff0bf' },
        neutral:  { bg: 'rgba(110, 130, 150, 0.15)', border: 'rgba(180, 200, 220, 0.25)', text: '#d7e2ed' },
        sad:      { bg: 'rgba(48, 84, 149, 0.20)', border: 'rgba(128, 177, 255, 0.30)', text: '#9dcbff' },
        anxious:  { bg: 'rgba(113, 73, 151, 0.20)', border: 'rgba(204, 157, 255, 0.30)', text: '#d7b1ff' },
        angry:    { bg: 'rgba(184, 50, 50, 0.20)', border: 'rgba(255, 131, 131, 0.30)', text: '#ffb3b3' }
    },
    // Category colors — like hand (dexter/sinister) colors
    category: {
        work:     { bg: 'rgba(24, 126, 150, 0.20)', border: 'rgba(102, 221, 243, 0.35)', text: '#8be8ff' },
        personal: { bg: 'rgba(156, 39, 176, 0.18)', border: 'rgba(204, 157, 255, 0.30)', text: '#d7b1ff' },
        health:   { bg: 'rgba(34, 139, 94, 0.18)', border: 'rgba(103, 224, 162, 0.35)', text: '#8ff0bf' },
        social:   { bg: 'rgba(255, 152, 0, 0.18)', border: 'rgba(255, 196, 93, 0.30)', text: '#ffd27a' }
    }
};
```

### 7.4 Full Entry Expanded View (Like Aspect Interpretation)

Adapted from the `aspectShell` + interpretation container pattern:
```javascript
function createEntryShell(entryData) {
    const tagColor = getEntryTagColor(entryData.tags);
    const shell = getCalEntryShell(
        `margin-top: 6px; padding: 8px 10px; border-radius: var(--cal-radius);
         border-left: 3px solid ${tagColor};
         font-size: 0.95em; color: var(--cal-text);
         background: rgba(30, 30, 30, 0.93);`,
        tagColor
    );
    
    const container = document.createElement('div');
    container.className = 'cal-entry-expanded';
    container.style.cssText = shell.wrapperStyle;
    container.style.display = 'none';
    container.innerHTML = `
        ${shell.layers}
        ${shell.contentStart}
            <div class="cal-entry-header"
              style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                <span style="font-weight:bold; color:${tagColor}; font-size:1.05em;">
                  ${entryData.time}
                </span>
                <div style="display:flex; gap:4px; flex-wrap:wrap;">
                  ${entryData.tags.map(t => createEntryTagChip(t)).join('')}
                </div>
            </div>
            <div class="cal-entry-body"
              style="font-size:0.95em; color:var(--cal-text); line-height:1.6;
                     white-space:pre-wrap; overflow-wrap:break-word;">
              ${escapeHtml(entryData.text)}
            </div>
            ${entryData.images ? createEntryImageRow(entryData.images) : ''}
        ${shell.contentEnd}
    `;
    return container;
}
```

---

## 8. Color System for Calendar Contexts

### 8.1 Day Accent Color Function

```javascript
function getDayAccentColor(dayData) {
    if (dayData.isToday) return '#ffd700';           // gold — today
    if (dayData.isWeekend) return '#5ec9ff';          // blue — weekend
    if (dayData.entries.length > 5) return '#4ecdc4';  // teal — many entries
    if (dayData.entries.length > 0) return '#6bcf7f';  // green — has entries
    if (dayData.isPast) return '#666';                 // gray — past empty
    return '#445';                                      // dim — future empty
}
```

### 8.2 Week Accent Color Function

```javascript
function getWeekAccentColor(weekData) {
    const density = weekData.totalEntries;
    if (density > 20) return '#4ecdc4';    // teal — dense
    if (density > 10) return '#6bcf7f';    // green
    if (density > 5) return '#ffd93d';     // yellow
    if (density > 0) return '#5ec9ff';     // blue
    return '#555';                           // gray — empty
}
```

### 8.3 Entry Preview Left Border Color (Like Aspect Orb Colors)

```javascript
function getEntryTagColor(tags) {
    if (!tags || tags.length === 0) return 'transparent';
    
    // Priority takes precedence
    const priority = tags.find(t => t.type === 'priority');
    if (priority) {
        const map = { critical: '#ff6666', high: '#ffa500', medium: '#ffd93d', low: '#90a4ae' };
        return map[priority.level] || map.medium;
    }
    
    // Then mood
    const mood = tags.find(t => t.type === 'mood');
    if (mood) {
        const map = { happy: '#8ff0bf', neutral: '#d7e2ed', sad: '#9dcbff',
                      anxious: '#d7b1ff', angry: '#ffb3b3' };
        return map[mood.value] || '#8be8ff';
    }
    
    // Then category
    const category = tags.find(t => t.type === 'category');
    if (category) {
        const map = { work: '#8be8ff', personal: '#d7b1ff', health: '#8ff0bf', social: '#ffd27a' };
        return map[category.value] || '#8be8ff';
    }
    
    return '#8be8ff'; // default blue
}
```

### 8.4 Entry Count Color Threshold (Like Speed Colors)

```javascript
function getEntryCountColor(count) {
    if (count > 8) return '#6bcf7f';    // green — heavy journaling day
    if (count > 4) return '#ffd93d';    // yellow — moderate
    if (count > 0) return '#ffa500';    // orange — light
    return '#888';                       // gray — empty
}
```

---

## 9. Interaction Patterns

### 9.1 Day Click → Show Day Detail (Modal Expansion, Like Fixed Stars)

```javascript
function showDayDetail(dayData, dayDiv) {
    // Auto-collapse other expanded days (modal behavior)
    document.querySelectorAll('.cal-day-detail-expanded').forEach(detail => {
        if (detail.closest('.cal-day') !== dayDiv) {
            detail.style.display = 'none';
            detail.classList.remove('cal-day-detail-expanded');
        }
    });
    
    // Check if already expanded
    const existingDetail = dayDiv.querySelector('.cal-day-detail');
    if (existingDetail) {
        const isVisible = existingDetail.style.display !== 'none';
        existingDetail.style.display = isVisible ? 'none' : 'block';
        existingDetail.classList.toggle('cal-day-detail-expanded', !isVisible);
        return;
    }
    
    // Build lazy detail content (like planet lazy details)
    const detailDiv = document.createElement('div');
    detailDiv.className = 'cal-day-detail cal-day-detail-expanded';
    detailDiv.style.cssText = `
        display: block;
        margin-top: 6px;
        padding: 6px 8px;
        background: transparent;
        border-radius: var(--cal-radius);
        border: 1px solid rgba(255,255,255,0.1);
    `;
    
    detailDiv.innerHTML = `
        <div class="cal-day-detail-header"
          style="display:flex; justify-content:space-between; align-items:center;
                 margin-bottom:6px; padding-bottom:6px;
                 border-bottom:1px solid rgba(255,255,255,0.1);">
            <h4 style="margin:0; color:var(--cal-heading-color); font-size:1.05em;">
              ${dayData.name}, ${dayData.formattedDate}
            </h4>
            <button class="cal-day-detail-collapse"
              style="background:transparent; border:1px solid var(--cal-heading-color);
                     color:var(--cal-heading-color); padding:3px 8px;
                     border-radius:var(--cal-radius-sm); cursor:pointer; font-size:0.78em;">
              Collapse
            </button>
        </div>
        <div class="cal-day-detail-entries"
          style="display:flex; flex-direction:column; gap:6px;">
            ${dayData.entries.map(entry => createExpandedEntry(entry)).join('')}
        </div>
        <div class="cal-day-detail-new-entry" style="margin-top:8px;">
            <textarea class="cal-new-entry-input"
              placeholder="Write a new entry..."
              style="width:100%; min-height:60px; padding:6px 8px; border-radius:var(--cal-radius);
                     background:rgba(0,0,0,0.3); border:1px solid var(--cal-border-muted);
                     color:var(--cal-text); font-size:var(--cal-entry-size);
                     resize:vertical; box-sizing:border-box;
                     font-family:inherit;"></textarea>
            <button class="cal-new-entry-save"
              style="margin-top:4px; padding:4px 12px; border-radius:var(--cal-radius-sm);
                     background:rgba(127,223,255,0.15); border:1px solid var(--cal-heading-color);
                     color:var(--cal-heading-color); cursor:pointer; font-size:0.82em;
                     transition:all 0.15s ease;">Save Entry</button>
        </div>
    `;
    
    dayDiv.appendChild(detailDiv);
    
    // Collapse button
    detailDiv.querySelector('.cal-day-detail-collapse').addEventListener('click', function(e) {
        e.stopPropagation();
        detailDiv.style.display = 'none';
        detailDiv.classList.remove('cal-day-detail-expanded');
    });
}
```

### 9.2 Hover Lift (Exact AstroMonix Pattern)

```css
/* Applied to .cal-day and .cal-week */
.cal-day:hover, .cal-week:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(255, 255, 255, 0.15);
    z-index: 2;
}

.cal-day, .cal-week {
    transition: all 0.2s ease-out;
}
```

### 9.3 New Entry Input (Inline Creation)

```javascript
function setupNewEntryInput(textarea, saveBtn, dayData) {
    saveBtn.addEventListener('click', function() {
        const text = textarea.value.trim();
        if (!text) return;
        
        // Create new entry object
        const newEntry = {
            id: generateEntryId(),
            time: formatTime(new Date()),
            text: text,
            tags: [],
            timestamp: Date.now()
        };
        
        // Add to day data
        dayData.entries.push(newEntry);
        
        // Rebuild day column
        const dayDiv = textarea.closest('.cal-day');
        const parent = dayDiv.parentNode;
        const newDayDiv = createDayColumn(dayData, currentTier);
        parent.replaceChild(newDayDiv, dayDiv);
        
        // Auto-expand new detail
        showDayDetail(dayData, newDayDiv);
    });
    
    // Ctrl+Enter to save
    textarea.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            saveBtn.click();
        }
    });
}
```

---

## 10. Complete HTML Assembly by View Tier

### 10.1 Month Tier Assembly

```
┌─────────────────────────────────────────────┐
│  CALENDAR VIEW                    ◀ Today ▶  │
│  [Month] [Week] [Day]                        │
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun           │
├─────────────────────────────────────────────┤
│  ┌── Week 30 · Jul 20-26 ──────── 📝 12 ─┐  │
│  │ ● ● ○ ● ●● ○                           │  │
│  │ ┌────┬────┬────┬────┬────┬────┬────┐   │  │
│  │ │ 20 │ 21 │ 22 │ 23 │ 24 │ 25 │ 26 │   │  │
│  │ │ 📝3│ 📝0│ 📝1│ 📝5│ 📝2│ 📝1│ 📝0│   │  │
│  │ └────┴────┴────┴────┴────┴────┴────┘   │  │
│  └─────────────────────────────────────────┘  │
│  ┌── Week 29 · Jul 13-19 ──────── 📝 8 ──┐  │
│  │ ...                                     │  │
│  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Characteristics**:
- Day columns show date number + entry count chip only
- No entry preview text visible
- Week rows show density dots in center zone
- Day grid: tight 7-column with 2px gaps
- Click day → expand day detail overlay

### 10.2 Week Tier Assembly

```
┌─────────────────────────────────────────────┐
│  CALENDAR VIEW                    ◀ Today ▶  │
│  [Month] [Week] [Day]                        │
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun           │
├─────────────────────────────────────────────┤
│  ┌── Week 30 ────────────────────────────┐   │
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │   │
│  │ │ Mon  │ │ Tue  │ │ Wed  │ │ Thu  │  │   │
│  │ │  20  │ │  21  │ │  22  │ │  23  │  │   │
│  │ │◉     │ │◉     │ │◉     │ │◉     │  │   │
│  │ │09:30 │ │      │ │14:00 │ │08:00 │  │   │
│  │ │Had a │ │      │ │Met w/│ │Gym - │  │   │
│  │ │great │ │      │ │team  │ │chest │  │   │
│  │ │meet- │ │      │ │      │ │day   │  │   │
│  │ │📝3😊│ │📝0  │ │📝1😐│ │📝5😊│  │   │
│  │ └──────┘ └──────┘ └──────┘ └──────┘  │   │
│  │ ... (3 more days)                     │   │
│  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Characteristics**:
- Single week row, full width
- Day columns show entry previews (3-line clamped)
- Day metadata chips visible (count + mood)
- Full date + day name in header
- Click day → expand detail below (modal)

### 10.3 Day Tier Assembly

```
┌─────────────────────────────────────────────┐
│  CALENDAR VIEW                    ◀ Today ▶  │
│  [Month] [Week] [Day]                        │
├─────────────────────────────────────────────┤
│  ┌── Monday, July 20, 2026 ──────────────┐  │
│  │                                        │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ 09:30     📝 work    😊 happy   │  │  │
│  │  │─────────────────────────────────│  │  │
│  │  │ Had a great meeting about the   │  │  │
│  │  │ new project timeline. We        │  │  │
│  │  │ discussed Q3 priorities and     │  │  │
│  │  │ allocated resources.            │  │  │
│  │  │                      [Edit] [🗑]│  │  │
│  │  └─────────────────────────────────┘  │  │
│  │                                        │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ 14:00     📝 personal  😐 neutral│  │  │
│  │  │─────────────────────────────────│  │  │
│  │  │ Met with team for project       │  │  │
│  │  │ review. Progress is on track.   │  │  │
│  │  │                      [Edit] [🗑]│  │  │
│  │  └─────────────────────────────────┘  │  │
│  │                                        │  │
│  │  ┌─ New Entry ──────────────────────┐  │  │
│  │  │ │                          │     │  │  │
│  │  │ └──────────────────────────┘     │  │  │
│  │  │ [Save Entry]                    │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Characteristics**:
- Single day, full detail
- All entries shown fully with tag chips
- Entry expanded view (like aspect interpretation)
- Inline new entry textarea
- Edit/delete per entry

### 10.4 Year Tier Assembly

```
┌─────────────────────────────────────────────┐
│  CALENDAR VIEW                    2026       │
│  [Month] [Week] [Day]                        │
├─────────────────────────────────────────────┤
│  ┌── January 2026 ───────────────────────┐  │
│  │  ○○●○●●○ ○○●○●●○ ○○●○●●○ ○○●○●●○    │  │
│  │  ○○●○●●○ ○○●○●●○                     │  │
│  └────────────────────────────────────────┘  │
│  ┌── February 2026 ──────────────────────┐  │
│  │  ○○●○●●○ ○○●○●●○ ○○●○●●○ ○○●○●●○    │  │
│  │  ○○●○●●○                               │  │
│  └────────────────────────────────────────┘  │
│  ...                                         │
└─────────────────────────────────────────────┘
```

**Characteristics**:
- Month rows as week containers
- Dot grid for days (6px dots)
- Color: green for entries, gray for empty, gold for today
- No text previews
- Minimal padding
- Click month → zoom to month tier

---

## 11. Responsive Breakpoints

### 11.1 Viewport Width Breakpoints (Adapted from Panel System)

```css
/* Large screens — side-by-side with main content */
@media (min-width: 1400px) {
    .cal-view {
        width: clamp(380px, 28vw, 500px);
    }
}

/* Medium screens — standard panel width */
@media (max-width: 1100px) {
    .cal-view {
        width: clamp(280px, 34vw, 360px);
    }
    
    .cal-week {
        padding: 4px;
    }
    
    .cal-day {
        padding: 3px;
    }
    
    .cal-day-number {
        font-size: clamp(18px, 2vw, 24px);
    }
}

/* Small screens — full width overlay */
@media (max-width: 768px) {
    :root {
        --cal-week-width: 96vw;
        --cal-day-min-width: 80px;
    }
    
    .cal-view {
        width: 96vw !important;
        max-width: 96vw !important;
        right: 2vw !important;
        left: 2vw !important;
        top: var(--cal-info-top) !important;
    }
    
    .cal-week-summary {
        flex-direction: column;
        gap: 4px;
    }
    
    .cal-week-zone-center {
        width: 100%;
    }
    
    .cal-day-header {
        flex-direction: column;
        align-items: center;
        gap: 1px;
    }
    
    .cal-day-focus {
        display: none; /* hide focus button on mobile */
    }
    
    .cal-day-name {
        font-size: 0.65em;
    }
    
    .cal-day-number {
        font-size: clamp(16px, 4vw, 22px);
    }
    
    .cal-day-previews {
        display: none !important; /* no previews on mobile */
    }
    
    .cal-day-meta {
        justify-content: center;
    }
}

/* Very small screens */
@media (max-width: 480px) {
    .cal-day-headers {
        display: none !important;
    }
    
    .cal-week-days {
        gap: 1px;
    }
    
    .cal-day {
        padding: 2px !important;
    }
    
    .cal-day-number {
        font-size: clamp(14px, 3.5vw, 18px);
    }
    
    .cal-view-header h3 {
        font-size: clamp(12px, 1vw, 14px);
        flex-wrap: wrap;
    }
    
    .cal-tier-btn {
        font-size: 0.65em;
        padding: 2px 5px;
    }
}
```

### 11.2 Tier Transition Responsive Adjustments

```css
/* Month tier on small screens — hide day headers */
.cal-view[data-tier="month"] .cal-day-name {
    display: none;
}

.cal-view[data-tier="month"] .cal-day-focus {
    display: none;
}

.cal-view[data-tier="month"] .cal-day-meta {
    justify-content: center;
}

/* Week tier — ensure previews are visible */
.cal-view[data-tier="week"] .cal-day-previews {
    display: flex !important;
}

/* Day tier — full detail */
.cal-view[data-tier="day"] .cal-day {
    border-left-width: 5px;
    padding: clamp(8px, 1vw, 12px) !important;
}

.cal-view[data-tier="day"] .cal-day-header {
    margin-bottom: 8px;
}

.cal-view[data-tier="day"] .cal-day-number {
    font-size: clamp(28px, 3vw, 42px);
}
```

---

## 12. Implementation Checklist

### Phase 1: Foundation

- [ ] Set up CSS variables (§2) — copy `:root` block exactly
- [ ] Create `.cal-view` base class with backdrop blur and scrollbar (§3.2)
- [ ] Create `.cal-timeline` scroll container matching panel scrollbar system
- [ ] Create `.cal-day-headers` grid for weekday labels
- [ ] Implement `setCalTier()` JS function with tier config object (§4.2)

### Phase 2: Week Row (Planet Item Equivalent)

- [ ] Create `createWeekRow()` function (§5.3)
- [ ] Implement `.cal-week-summary` with three-zone layout (§5.1)
- [ ] Implement `getWeekAccentColor()` for density-based coloring (§8.2)
- [ ] Create `.cal-week-details` expansion with lazy build
- [ ] Add hover lift: `translateY(-2px)` + shadow transition

### Phase 3: Day Column (Aspect Item Equivalent)

- [ ] Create `createDayColumn()` function (§6.3)
- [ ] Implement `.cal-day` with stepped layout (§6.1)
- [ ] Implement `getDayType()` for today/weekend/has-entries/empty/past (§6.2)
- [ ] Implement `getDayAccentColor()` function (§8.1)
- [ ] Create day focus button (`◉`) with click/hover interaction (§6.3)
- [ ] Implement entry count chip + mood chip display

### Phase 4: Journal Entry System

- [ ] Create `createEntryPreview()` for day column previews (§7.1)
- [ ] Create `createEntryTagChip()` with stacked/inline variants (§7.2)
- [ ] Implement tag color mapping with threshold system (§7.3)
- [ ] Create `createEntryShell()` for expanded entry view (§7.4)
- [ ] Implement `showDayDetail()` with modal expansion (§9.1)
- [ ] Implement inline new entry input with Ctrl+Enter save (§9.3)

### Phase 5: Color & Styling

- [ ] Implement `getEntryTagColor()` with priority→mood→category cascade (§8.3)
- [ ] Implement `getEntryCountColor()` threshold (§8.4)
- [ ] Implement `.cal-day[data-day-type]` selectors for today/weekend/empty/past (§6.2)
- [ ] Apply `overflow-wrap:anywhere; word-break:break-word` to ALL text elements
- [ ] Apply `min-width:0; max-width:100%; box-sizing:border-box` to ALL containers

### Phase 6: View Tier Adaptation

- [ ] Implement month tier: grid of day cells, no previews, density dots on week (§10.1)
- [ ] Implement week tier: day columns with entry previews, single week (§10.2)
- [ ] Implement day tier: full detail, all entries expanded, inline creation (§10.3)
- [ ] Implement year tier: compact dot grid, minimal info (§10.4)
- [ ] Add responsive breakpoints for 1400px, 1100px, 768px, 480px (§11.1)

### Phase 7: Polish

- [ ] Add scrollbar styling matching panel system (thin, accent-colored thumb)
- [ ] Add transition: `all 0.2s ease-out` to all clickable elements
- [ ] Add hover lift effect to `.cal-week` and `.cal-day`
- [ ] Verify modal expansion (only one day detail open at a time)
- [ ] Test all four view tiers with sample data
- [ ] Verify responsive behavior at all breakpoints
