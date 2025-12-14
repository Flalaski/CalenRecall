import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { JournalEntry, TimeRange, Preferences } from '../types';
import { formatDate, getDaysInMonth, getDaysInWeek, isToday, getWeekStart, getZodiacColor, getZodiacGradientColor, getZodiacGradientColorForYear, parseISODate, getWeekdayLabels, formatTime } from '../utils/dateUtils';
import { isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { playCalendarSelectionSound, playEntrySelectionSound, playEditSound } from '../utils/audioUtils';
import { calculateEntryColor } from '../utils/entryColorUtils';
import { useCalendar } from '../contexts/CalendarContext';
import { useEntries } from '../contexts/EntriesContext';
import { dateToCalendarDate } from '../utils/calendars/calendarConverter';
import { formatCalendarDate } from '../utils/calendars/calendarConverter';
import { deleteJournalEntry } from '../services/journalService';
import { buildEntryLookup, getDayEntriesOptimized, getMonthEntriesOptimized, getAllEntriesForYearOptimized, getAllEntriesForMonthOptimized } from '../utils/entryLookupUtils';
import { getAstronomicalEventsForRange, getAstronomicalEventLabel, type DateAstronomicalEvent } from '../utils/astronomicalEvents';
import { gregorianToJDN } from '../utils/calendars/julianDayUtils';
import { getAllMacroCycles, getChineseSexagenaryCycle, getMayanLongCountCycles, getMetonicCycle, getMayanCalendarRound, getHinduYugaCycle, type YugaType } from '../utils/calendars/macroCycleUtils';
import './TimelineView.css';

interface TimelineViewProps {
  selectedDate: Date;
  viewMode: TimeRange;
  onTimePeriodSelect: (date: Date, viewMode: TimeRange) => void;
  onEntrySelect: (entry: JournalEntry) => void;
  onEditEntry?: (entry: JournalEntry) => void;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

function TimelineView({
  selectedDate,
  viewMode,
  onTimePeriodSelect,
  onEntrySelect,
  onEditEntry,
  weekStartsOn = 0,
}: TimelineViewProps) {
  const { calendar } = useCalendar();
  const { entries: allEntries, entryLookup: contextEntryLookup, entryColors } = useEntries();
  const [preferences, setPreferences] = useState<Preferences>({});
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set());
  const [monthEntriesBulkEditMode, setMonthEntriesBulkEditMode] = useState(false);
  const [selectedMonthEntryIds, setSelectedMonthEntryIds] = useState<Set<number>>(new Set());

  // Load preferences for time format and astronomical events
  useEffect(() => {
    const loadPreferences = async () => {
      if (window.electronAPI) {
        const prefs = await window.electronAPI.getAllPreferences();
        console.log('[TimelineView] ✅ Loaded ALL preferences:', prefs);
        console.log('[TimelineView] showSolsticesEquinoxes:', prefs.showSolsticesEquinoxes, 'type:', typeof prefs.showSolsticesEquinoxes);
        console.log('[TimelineView] showMoonPhases:', prefs.showMoonPhases, 'type:', typeof prefs.showMoonPhases);
        setPreferences({
          ...prefs,
          showSolsticesEquinoxes: prefs.showSolsticesEquinoxes ?? false,
          showMoonPhases: prefs.showMoonPhases ?? false,
          showChineseSexagenaryCycle: prefs.showChineseSexagenaryCycle ?? false,
          showMayanLongCountCycles: prefs.showMayanLongCountCycles ?? false,
          showMetonicCycle: prefs.showMetonicCycle ?? false,
          showMayanCalendarRound: prefs.showMayanCalendarRound ?? false,
          showHinduYugaCycles: prefs.showHinduYugaCycles ?? false
        });
      }
    };
    loadPreferences();

    // Listen for preference updates (e.g., from menu toggles)
    if (window.electronAPI && window.electronAPI.onPreferenceUpdated) {
      const handlePreferenceUpdate = (data: { key: string; value: any }) => {
        console.log('[TimelineView] Preference update received:', data);
        const macroCycleKeys = [
          'showSolsticesEquinoxes',
          'showMoonPhases',
          'showChineseSexagenaryCycle',
          'showMayanLongCountCycles',
          'showMetonicCycle',
          'showMayanCalendarRound',
          'showHinduYugaCycles'
        ];
        if (macroCycleKeys.includes(data.key)) {
          setPreferences(prev => {
            const updated = { ...prev, [data.key]: data.value };
            console.log('[TimelineView] Updated preferences:', updated);
            return updated;
          });
        }
      };
      
      window.electronAPI.onPreferenceUpdated(handlePreferenceUpdate);
      
      return () => {
        if (window.electronAPI && window.electronAPI.removePreferenceUpdatedListener) {
          window.electronAPI.removePreferenceUpdatedListener();
        }
      };
    }
  }, []);

  // OPTIMIZATION: Use lookup from context (stable across renders) or build with weekStartsOn if different
  const entryLookup = useMemo(() => {
    // If weekStartsOn is 0 (default), use context lookup directly
    if (weekStartsOn === 0) {
      return contextEntryLookup;
    }
    // Otherwise rebuild with custom weekStartsOn
    return buildEntryLookup(allEntries, weekStartsOn);
  }, [contextEntryLookup, allEntries, weekStartsOn]);

  // Get astronomical events for the visible date range
  const astronomicalEvents = useMemo(() => {
    // Use truthy check instead of strict === true to handle undefined as false
    const showSolsticesEquinoxes = !!(preferences.showSolsticesEquinoxes);
    const showMoonPhases = !!(preferences.showMoonPhases);
    
    // Early return if both are disabled
    if (!showSolsticesEquinoxes && !showMoonPhases) {
      return new Map<string, DateAstronomicalEvent[]>();
    }
    
    let startDate: Date;
    let endDate: Date;
    
    switch (viewMode) {
      case 'decade': {
        const decadeStart = Math.floor(selectedDate.getFullYear() / 10) * 10;
        startDate = new Date(decadeStart, 0, 1);
        endDate = new Date(decadeStart + 9, 11, 31);
        break;
      }
      case 'year': {
        startDate = new Date(selectedDate.getFullYear(), 0, 1);
        endDate = new Date(selectedDate.getFullYear(), 11, 31);
        break;
      }
      case 'month': {
        startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        break;
      }
      case 'week': {
        startDate = getWeekStart(selectedDate, weekStartsOn);
        const weekEnd = new Date(startDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        endDate = weekEnd;
        break;
      }
      case 'day': {
        startDate = selectedDate;
        endDate = selectedDate;
        break;
      }
      default: {
        startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      }
    }
    
    const events = getAstronomicalEventsForRange(
      startDate,
      endDate,
      showSolsticesEquinoxes,
      showMoonPhases
    );
    
    return events;
  }, [selectedDate, viewMode, weekStartsOn, preferences.showSolsticesEquinoxes, preferences.showMoonPhases]);


  useEffect(() => {
    // Clear bulk selection when changing date/view
    setSelectedEntryIds(new Set());
    setBulkEditMode(false);
    setSelectedMonthEntryIds(new Set());
    setMonthEntriesBulkEditMode(false);
  }, [selectedDate, viewMode]);

  // Removed loadEntries - now using EntriesContext with memoized filtering

  // Check if a date is the currently selected date (at appropriate granularity)
  const isSelected = (date: Date): boolean => {
    switch (viewMode) {
      case 'day':
      case 'week':
      case 'month':
        // For day/week/month views, compare at day level
        return isSameDay(date, selectedDate);
      case 'year':
        // For year view, compare at month level
        return isSameMonth(date, selectedDate) && isSameYear(date, selectedDate);
      case 'decade':
        // For decade view, compare at year level
        return isSameYear(date, selectedDate);
      default:
        return false;
    }
  };

  // OPTIMIZATION: Use optimized lookup instead of filtering
  const getEntriesForDate = useCallback((date: Date, forViewMode?: TimeRange): JournalEntry[] => {
    const effectiveViewMode = forViewMode || viewMode;
    
    // For month/week/day views, only show day entries in calendar cells
    if (effectiveViewMode === 'month' || effectiveViewMode === 'week' || effectiveViewMode === 'day') {
      return getDayEntriesOptimized(entryLookup, date);
    }
    
    // For year view, show month entries
    if (effectiveViewMode === 'year') {
      return getMonthEntriesOptimized(entryLookup, date.getFullYear(), date.getMonth());
    }
    
    // For decade view, show year entries
    if (effectiveViewMode === 'decade') {
      const year = date.getFullYear();
      return entryLookup.byYear.get(year) || [];
    }
    
    return [];
  }, [entryLookup, viewMode]);

  // OPTIMIZATION: Use optimized lookup functions instead of O(n) filtering
  // Exclude day entries when used in decade/year views (not needed at those tiers)
  const getAllEntriesForYear = useCallback((year: number): JournalEntry[] => {
    return getAllEntriesForYearOptimized(entryLookup, year, weekStartsOn, true);
  }, [entryLookup, weekStartsOn]);

  const getAllEntriesForMonth = useCallback((year: number, month: number): JournalEntry[] => {
    return getAllEntriesForMonthOptimized(entryLookup, year, month, weekStartsOn);
  }, [entryLookup, weekStartsOn]);

  // OPTIMIZATION: Get all entries that apply to a specific date
  // This includes day, week, month, year, and decade entries
  // OPTIMIZATION: Early return optimizations to avoid unnecessary work when no entries exist
  const getAllEntriesForDate = useCallback((date: Date): JournalEntry[] => {
    const results: JournalEntry[] = [];
    const dateStr = formatDate(date);
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const decadeStart = Math.floor(year / 10) * 10;
    
    // Calculate week key once (needed for both check and lookup)
    const weekStart = getWeekStart(date, weekStartsOn);
    const weekKey = formatDate(weekStart);
    
    // OPTIMIZATION: Quick check - if no entries exist for this date at any tier, return early
    const hasDayEntries = entryLookup.hasEntryDates.has(dateStr);
    const hasWeekEntries = entryLookup.hasWeekEntryWeeks.size > 0 && entryLookup.hasWeekEntryWeeks.has(weekKey);
    const hasMonthEntries = entryLookup.hasMonthEntryMonths.has(monthKey);
    const hasYearEntries = entryLookup.hasYearEntryYears.has(year);
    const hasDecadeEntries = entryLookup.hasDecadeEntryDecades.has(decadeStart);
    
    // If no entries exist at any tier, return empty array immediately
    if (!hasDayEntries && !hasWeekEntries && !hasMonthEntries && !hasYearEntries && !hasDecadeEntries) {
      return results;
    }
    
    // Add day entries
    if (hasDayEntries) {
      const dayEntries = entryLookup.byDateString.get(dateStr);
      if (dayEntries) {
        results.push(...dayEntries);
      }
    }
    
    // Add week entries
    if (hasWeekEntries) {
      const weekEntries = entryLookup.byWeekStart.get(weekKey);
      if (weekEntries) {
        results.push(...weekEntries);
      }
    }
    
    // Add month entries
    if (hasMonthEntries) {
      const monthEntries = entryLookup.byMonth.get(monthKey);
      if (monthEntries) {
        results.push(...monthEntries);
      }
    }
    
    // Add year entries
    if (hasYearEntries) {
      const yearEntries = entryLookup.byYear.get(year);
      if (yearEntries) {
        results.push(...yearEntries);
      }
    }
    
    // Add decade entries
    if (hasDecadeEntries) {
      const decadeEntries = entryLookup.byDecade.get(decadeStart);
      if (decadeEntries) {
        results.push(...decadeEntries);
      }
    }
    
    return results;
  }, [entryLookup, weekStartsOn]);

  // OPTIMIZATION: Prioritize entries from the currently selected time tier
  // This ensures entries matching the viewMode appear first when displaying limited entries
  const prioritizeEntriesByTier = useCallback((entries: JournalEntry[], priorityTier: TimeRange): JournalEntry[] => {
    if (entries.length === 0) return entries;
    
    // Separate entries by tier
    const priorityEntries: JournalEntry[] = [];
    const otherEntries: JournalEntry[] = [];
    
    for (const entry of entries) {
      if (entry.timeRange === priorityTier) {
        priorityEntries.push(entry);
      } else {
        otherEntries.push(entry);
      }
    }
    
    // Return priority entries first, then others
    return [...priorityEntries, ...otherEntries];
  }, []);

  // Create pixel map for a year (12 months x ~30 days = 360 pixels, but we'll use 12x30 grid)
  // OPTIMIZED: Limit processing to first N entries to avoid performance issues with thousands of entries
  // OPTIMIZATION: Prioritizes entries from the current time tier (year entries in year view)
  const createYearPixelMap = useCallback((yearEntries: JournalEntry[], priorityTier: TimeRange = 'year'): string[] => {
    // Create a 12x30 grid (12 months, 30 days each)
    // Each pixel represents one entry, colored using crystal colors
    const pixels: string[] = [];
    const totalPixels = 12 * 30; // 360 pixels
    
    // OPTIMIZATION: Prioritize entries from current tier first
    const prioritizedEntries = prioritizeEntriesByTier(yearEntries, priorityTier);
    
    // OPTIMIZATION: For performance, limit to first 360 entries instead of sorting all
    // If there are many entries, we'll sample them rather than processing all
    const maxEntriesToProcess = Math.min(prioritizedEntries.length, totalPixels * 2); // Process up to 2x pixels worth
    
    // Only sort if we have a reasonable number of entries
    // IMPORTANT: Sort within each tier group to preserve prioritization
    let entriesToUse: JournalEntry[];
    if (prioritizedEntries.length <= maxEntriesToProcess) {
      // Sort entries by date while preserving tier priority
      // Split into priority and other groups, sort each, then combine
      const priorityTierEntries: JournalEntry[] = [];
      const otherTierEntries: JournalEntry[] = [];
      
      for (const entry of prioritizedEntries) {
        if (entry.timeRange === priorityTier) {
          priorityTierEntries.push(entry);
        } else {
          otherTierEntries.push(entry);
        }
      }
      
      // Sort each group by date
      priorityTierEntries.sort((a, b) => {
        const dateA = parseISODate(a.date);
        const dateB = parseISODate(b.date);
        return dateA.getTime() - dateB.getTime();
      });
      
      otherTierEntries.sort((a, b) => {
        const dateA = parseISODate(a.date);
        const dateB = parseISODate(b.date);
        return dateA.getTime() - dateB.getTime();
      });
      
      // Combine with priority entries first
      entriesToUse = [...priorityTierEntries, ...otherTierEntries];
    } else {
      // For very large sets, take first N entries (prioritized entries come first)
      entriesToUse = prioritizedEntries.slice(0, maxEntriesToProcess);
    }
    
    // Create pixel array - one entry per pixel, using crystal colors
    for (let i = 0; i < Math.min(entriesToUse.length, totalPixels); i++) {
      const entry = entriesToUse[i];
      pixels.push(calculateEntryColor(entry));
    }
    
    // Fill remaining pixels with transparent/empty
    while (pixels.length < totalPixels) {
      pixels.push('transparent');
    }
    
    return pixels;
  }, [prioritizeEntriesByTier]);

  // Create pixel map for a month (7 days x 5 weeks = 35 pixels)
  // OPTIMIZED: Limit processing to avoid performance issues with many entries
  // OPTIMIZATION: Prioritizes entries from the current time tier (month entries in month view, year entries in year view)
  const createMonthPixelMap = useCallback((monthEntries: JournalEntry[], priorityTier: TimeRange = 'month'): string[] => {
    // Create a 7x5 grid (7 days per week, 5 weeks max)
    // Each pixel represents one entry, colored by time range
    const pixels: string[] = [];
    const totalPixels = 7 * 5; // 35 pixels
    
    // OPTIMIZATION: Prioritize entries from current tier first
    const prioritizedEntries = prioritizeEntriesByTier(monthEntries, priorityTier);
    
    // OPTIMIZATION: For performance, limit processing
    const maxEntriesToProcess = Math.min(prioritizedEntries.length, totalPixels * 2); // Process up to 2x pixels worth
    
    // Only sort if we have a reasonable number of entries
    // IMPORTANT: Sort within each tier group to preserve prioritization
    let entriesToUse: JournalEntry[];
    if (prioritizedEntries.length <= maxEntriesToProcess) {
      // Sort entries by date while preserving tier priority
      // Split into priority and other groups, sort each, then combine
      const priorityTierEntries: JournalEntry[] = [];
      const otherTierEntries: JournalEntry[] = [];
      
      for (const entry of prioritizedEntries) {
        if (entry.timeRange === priorityTier) {
          priorityTierEntries.push(entry);
        } else {
          otherTierEntries.push(entry);
        }
      }
      
      // Sort each group by date
      priorityTierEntries.sort((a, b) => {
        const dateA = parseISODate(a.date);
        const dateB = parseISODate(b.date);
        return dateA.getTime() - dateB.getTime();
      });
      
      otherTierEntries.sort((a, b) => {
        const dateA = parseISODate(a.date);
        const dateB = parseISODate(b.date);
        return dateA.getTime() - dateB.getTime();
      });
      
      // Combine with priority entries first
      entriesToUse = [...priorityTierEntries, ...otherTierEntries];
    } else {
      // For very large sets, take first N entries (prioritized entries come first)
      entriesToUse = prioritizedEntries.slice(0, maxEntriesToProcess);
    }
    
    // Create pixel array - one entry per pixel, using crystal colors
    for (let i = 0; i < Math.min(entriesToUse.length, totalPixels); i++) {
      const entry = entriesToUse[i];
      pixels.push(calculateEntryColor(entry));
    }
    
    // Fill remaining pixels with transparent/empty
    while (pixels.length < totalPixels) {
      pixels.push('transparent');
    }
    
    return pixels;
  }, [prioritizeEntriesByTier]);

  const renderMonthView = () => {
    const days = getDaysInMonth(selectedDate);
    const weekDays = getWeekdayLabels(weekStartsOn);
    const firstDay = days[0].getDay();
    // Adjust first day based on weekStartsOn: if weekStartsOn is 1 (Monday), Sunday (0) becomes 6
    // General formula: (firstDay - weekStartsOn + 7) % 7
    const adjustedFirstDay = (firstDay - weekStartsOn + 7) % 7;
    
    // OPTIMIZATION: Use lookup to get month entries
    const monthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
    const monthEntries = entryLookup.byMonth.get(monthKey) || [];
    const monthEntriesWithIds = monthEntries.filter(entry => entry.id !== undefined);
    
    // OPTIMIZATION: Get week entries using lookup
    // Only iterate through week entries if there are any week entries in the database
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    const weekEntriesByWeek = new Map<string, JournalEntry[]>();
    
    // OPTIMIZATION: Early return if no week entries exist
    if (entryLookup.hasWeekEntryWeeks.size > 0) {
      // Get all week entries that overlap with this month
      for (const [weekKey, weekEntries] of entryLookup.byWeekStart.entries()) {
        const weekStart = parseISODate(weekKey);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // Only include weeks that overlap with the current month
        if (weekStart <= monthEnd && weekEnd >= monthStart) {
          weekEntriesByWeek.set(weekKey, weekEntries);
        }
      }
    }
    
    // Get unique weeks in the month
    const weeksInMonth: Date[] = [];
    const seenWeeks = new Set<string>();
    days.forEach(day => {
      const weekStart = getWeekStart(day, weekStartsOn);
      const weekKey = formatDate(weekStart);
      if (!seenWeeks.has(weekKey)) {
        seenWeeks.add(weekKey);
        weeksInMonth.push(weekStart);
      }
    });
    weeksInMonth.sort((a, b) => a.getTime() - b.getTime());
    
    return (
      <div className="timeline-month-view">
        <div className="month-view-content">
          <div className="month-calendar-section">
            <div className="weekday-header">
              {weekDays.map((day, dayIdx) => {
                // Get a representative date for this weekday in the current month
                const weekDayDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), dayIdx + 1);
                const gradientColor = getZodiacGradientColor(weekDayDate);
                return (
                  <div 
                    key={day} 
                    className="weekday-cell"
                    style={{ '--zodiac-gradient': gradientColor } as React.CSSProperties}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
            <div className="timeline-grid month-grid">
              {Array(adjustedFirstDay).fill(null).map((_, idx) => (
                <div key={`empty-${idx}`} className="timeline-cell empty-cell"></div>
              ))}
              {days.map((day, idx) => {
                // OPTIMIZATION: Get all entries for this day (day, week, month, year, decade)
                // and prioritize month entries since we're in month view
                // getAllEntriesForDate has early returns when no entries exist, so this is efficient
                const allDayEntries = getAllEntriesForDate(day);
                // prioritizeEntriesByTier returns early if entries.length === 0
                const prioritizedEntries = allDayEntries.length > 0 
                  ? prioritizeEntriesByTier(allDayEntries, 'month')
                  : [];
                const gradientColor = getZodiacGradientColor(day);
                const hasEntries = prioritizedEntries.length > 0;
                
                // Get astronomical events for this day
                // Use local date string to match event keys
                const year = day.getFullYear();
                const month = String(day.getMonth() + 1).padStart(2, '0');
                const dayNum = String(day.getDate()).padStart(2, '0');
                const dayKey = `${year}-${month}-${dayNum}`;
                const dayEvents = astronomicalEvents.get(dayKey) || [];
                
                return (
                  <div
                    key={idx}
                    className={`timeline-cell day-cell ${isToday(day) ? 'today' : ''} ${isSelected(day) ? 'selected' : ''} ${hasEntries ? 'has-entries' : ''}`}
                    onClick={() => {
                      playCalendarSelectionSound();
                      onTimePeriodSelect(day, 'day');
                    }}
                    style={{ '--zodiac-gradient': gradientColor } as React.CSSProperties}
                  >
                    <div className="cell-date">{day.getDate()}</div>
                    {dayEvents.length > 0 && (
                      <div className="cell-astronomical-events" title={dayEvents.map(e => e.displayName).join(', ')}>
                        {dayEvents.map((event, eIdx) => (
                          <span key={eIdx} className="astronomical-event-icon">
                            {getAstronomicalEventLabel(event)}
                          </span>
                        ))}
                      </div>
                    )}
                    {hasEntries && (
                    <div className="cell-entries">
                      {prioritizedEntries.slice(0, 3).map((entry, eIdx) => {
                        const entryColor = entry.id !== undefined && entryColors?.get(entry.id) || calculateEntryColor(entry);
                        return (
                          <div
                            key={eIdx}
                            className={`entry-badge entry-${entry.timeRange}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              playEntrySelectionSound();
                              onEntrySelect(entry);
                            }}
                            title={entry.title}
                            style={{ backgroundColor: entryColor }}
                          >
                            <span className="badge-title">{entry.title}</span>
                            {entry.hour !== undefined && entry.hour !== null && (
                              <span className="badge-time">
                                {formatTime(entry.hour, entry.minute, entry.second, preferences.timeFormat || '12h')}
                              </span>
                            )}
                            {entry.tags && entry.tags.length > 0 && (
                              <span className="badge-tag-count">{entry.tags.length}</span>
                            )}
                          </div>
                        );
                      })}
                      {prioritizedEntries.length > 3 && (
                        <div className="entry-badge more-entries">+{prioritizedEntries.length - 3}</div>
                      )}
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="month-week-entries-section">
            <div className="month-entries-section">
              <div className="month-entries-header">
                <span>Month Entries</span>
                {monthEntries.length > 0 && (
                  <button 
                    className={`bulk-edit-toggle-button ${monthEntriesBulkEditMode ? 'active' : ''}`}
                    onClick={() => {
                      setMonthEntriesBulkEditMode(!monthEntriesBulkEditMode);
                      if (monthEntriesBulkEditMode) {
                        setSelectedMonthEntryIds(new Set());
                      }
                    }}
                    title={monthEntriesBulkEditMode ? 'Exit bulk edit mode' : 'Enter bulk edit mode'}
                  >
                    {monthEntriesBulkEditMode ? 'Cancel' : 'Bulk Edit'}
                  </button>
                )}
              </div>
              {monthEntriesBulkEditMode && selectedMonthEntryIds.size > 0 && (
                <div className="bulk-edit-actions">
                  <span className="bulk-edit-selected-count">
                    {selectedMonthEntryIds.size} {selectedMonthEntryIds.size === 1 ? 'entry' : 'entries'} selected
                  </span>
                  <button 
                    className="bulk-delete-button"
                    onClick={handleBulkDeleteMonthEntries}
                  >
                    Delete Selected
                  </button>
                </div>
              )}
              {monthEntriesBulkEditMode && monthEntriesWithIds.length > 0 && (
                <div className="bulk-edit-select-all">
                  <label className="bulk-edit-checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedMonthEntryIds.size === monthEntriesWithIds.length && monthEntriesWithIds.length > 0}
                      onChange={() => toggleSelectAllMonthEntries(monthEntries)}
                    />
                    <span>Select All ({monthEntriesWithIds.length})</span>
                  </label>
                </div>
              )}
              <div className="month-entries-list">
                {monthEntries.length > 0 ? (
                  monthEntries.map((entry, eIdx) => {
                    const entryColor = calculateEntryColor(entry);
                    const isSelected = monthEntriesBulkEditMode && entry.id !== undefined && selectedMonthEntryIds.has(entry.id);
                    return (
                      <div
                        key={eIdx}
                        className={`month-entry-item ${isSelected ? 'bulk-selected' : ''} ${monthEntriesBulkEditMode ? 'bulk-edit-mode' : ''}`}
                        onClick={() => {
                          if (monthEntriesBulkEditMode) {
                            toggleMonthEntrySelection(entry.id);
                          } else {
                            playEntrySelectionSound();
                            onEntrySelect(entry);
                          }
                        }}
                        title={entry.title}
                        style={{ borderLeftColor: entryColor }}
                      >
                        {monthEntriesBulkEditMode && entry.id !== undefined && (
                          <div className="entry-checkbox-wrapper">
                            <input
                              type="checkbox"
                              checked={selectedMonthEntryIds.has(entry.id)}
                              onChange={() => toggleMonthEntrySelection(entry.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                        <div className="month-entry-content-wrapper">
                          <div className="month-entry-header">
                            <span className="month-entry-title">{entry.title}</span>
                            {entry.hour !== undefined && entry.hour !== null && (
                              <span className="month-entry-time">
                                {formatTime(entry.hour, entry.minute, entry.second, preferences.timeFormat || '12h')}
                              </span>
                            )}
                          </div>
                          {entry.content && entry.content.length > 0 && (
                            <span className="month-entry-preview">{entry.content.substring(0, 80)}...</span>
                          )}
                          {entry.tags && entry.tags.length > 0 && (
                            <div className="month-entry-tags">
                              {entry.tags.slice(0, 3).map((tag, tIdx) => (
                                <span key={tIdx} className="month-entry-tag">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="month-entry-empty">No month entries</div>
                )}
              </div>
            </div>
            
            {weeksInMonth.length > 0 && (
              <>
                <div className="week-entries-header">Week Entries</div>
                <div className="week-entries-list">
                  {weeksInMonth.map((weekStart, weekIdx) => {
                    const weekKey = formatDate(weekStart);
                    const weekEntries = weekEntriesByWeek.get(weekKey) || [];
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    
                    return (
                      <div key={weekIdx} className="week-entry-group">
                        <div className="week-entry-group-header">
                          <span className="week-label">
                            Week of {formatDate(weekStart, 'MMM d')}
                          </span>
                          {weekEntries.length > 0 && (
                            <span className="week-entry-count">{weekEntries.length}</span>
                          )}
                        </div>
                        {weekEntries.length > 0 ? (
                          <div className="week-entry-items">
                            {weekEntries.map((entry, eIdx) => {
                              const entryColor = entry.id !== undefined && entryColors?.get(entry.id) || calculateEntryColor(entry);
                              return (
                                <div
                                  key={eIdx}
                                  className="week-entry-item"
                                  onClick={() => {
                                    playEntrySelectionSound();
                                    onEntrySelect(entry);
                                  }}
                                  title={entry.title}
                                  style={{ borderLeftColor: entryColor }}
                                >
                                  <div className="week-entry-header">
                                    <span className="week-entry-title">{entry.title}</span>
                                    {entry.hour !== undefined && entry.hour !== null && (
                                      <span className="week-entry-time">
                                        {formatTime(entry.hour, entry.minute, entry.second, preferences.timeFormat || '12h')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="week-entry-empty">No week entries</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const days = getDaysInWeek(selectedDate, weekStartsOn);
    const weekDays = getWeekdayLabels(weekStartsOn);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return (
      <div className="timeline-week-view">
        <div className="weekday-header">
          {weekDays.map((day, idx) => {
            const dayDate = days[idx];
            const gradientColor = getZodiacGradientColor(dayDate);
            const dayNumber = dayDate.getDate();
            const monthName = monthNames[dayDate.getMonth()];
            return (
              <div 
                key={day} 
                className="weekday-cell"
                style={{ '--zodiac-gradient': gradientColor } as React.CSSProperties}
              >
                <div className="day-number">{dayNumber}</div>
                <div className="day-name">{day}</div>
                <div className="day-month">{monthName}</div>
              </div>
            );
          })}
        </div>
        <div className="timeline-grid week-grid">
          {days.map((day, idx) => {
            const dayEntries = getEntriesForDate(day);
            const gradientColor = getZodiacGradientColor(day);
            
            // Get astronomical events for this day
            // Use local date string to match event keys
            const year = day.getFullYear();
            const month = String(day.getMonth() + 1).padStart(2, '0');
            const dayNum = String(day.getDate()).padStart(2, '0');
            const dayKey = `${year}-${month}-${dayNum}`;
            const dayEvents = astronomicalEvents.get(dayKey) || [];
            
            return (
              <div
                key={idx}
                className={`timeline-cell day-cell week-day-cell ${isToday(day) ? 'today' : ''} ${isSelected(day) ? 'selected' : ''} ${dayEntries.length > 0 ? 'has-entries' : ''}`}
                onClick={() => {
                  playCalendarSelectionSound();
                  onTimePeriodSelect(day, 'day');
                }}
                style={{ '--zodiac-gradient': gradientColor } as React.CSSProperties}
              >
                {dayEvents.length > 0 && (
                  <div className="cell-astronomical-events" title={dayEvents.map(e => e.displayName).join(', ')}>
                    {dayEvents.map((event, eIdx) => (
                      <span key={eIdx} className="astronomical-event-icon">
                        {getAstronomicalEventLabel(event)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="cell-entries-vertical">
                  {dayEntries.map((entry, eIdx) => {
                    const entryColor = calculateEntryColor(entry);
                    return (
                      <div
                        key={eIdx}
                        className={`entry-card entry-${entry.timeRange}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          playEntrySelectionSound();
                          onEntrySelect(entry);
                        }}
                        style={{ borderLeftColor: entryColor }}
                      >
                      <div className="card-title-row">
                        <div className="card-title">{entry.title}</div>
                        {entry.hour !== undefined && entry.hour !== null && (
                          <span className="card-time-small">
                            {formatTime(entry.hour, entry.minute, entry.second, preferences.timeFormat || '12h')}
                          </span>
                        )}
                        {onEditEntry && entry.timeRange === viewMode && (
                          <button
                            className="card-edit-button-small"
                            onClick={(e) => {
                              e.stopPropagation();
                              playEditSound();
                              onEditEntry(entry);
                            }}
                            title="Edit entry"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      <div className="card-preview">{entry.content}</div>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="card-tags">
                          {entry.tags.map((tag, tIdx) => (
                            <span key={tIdx} className="card-tag">{tag}</span>
                          ))}
                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const toggleEntrySelection = (entryId: number | undefined) => {
    if (entryId === undefined) return;
    setSelectedEntryIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = (dayEntries: JournalEntry[]) => {
    const entriesWithIds = dayEntries.filter(entry => entry.id !== undefined);
    if (selectedEntryIds.size === entriesWithIds.length && entriesWithIds.length > 0) {
      setSelectedEntryIds(new Set());
    } else {
      const allIds = new Set(entriesWithIds.map(entry => entry.id!));
      setSelectedEntryIds(allIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEntryIds.size === 0) return;
    
    const confirmMessage = `Are you sure you want to delete ${selectedEntryIds.size} ${selectedEntryIds.size === 1 ? 'entry' : 'entries'}? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const deletePromises = Array.from(selectedEntryIds).map(id => 
        deleteJournalEntry(id)
      );
      await Promise.all(deletePromises);
      
      setSelectedEntryIds(new Set());
      setBulkEditMode(false);
      // Entries are automatically refreshed via EntriesContext
      window.dispatchEvent(new CustomEvent('journalEntrySaved'));
    } catch (error) {
      console.error('Error deleting entries:', error);
      alert(`Failed to delete entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const toggleMonthEntrySelection = (entryId: number | undefined) => {
    if (entryId === undefined) return;
    setSelectedMonthEntryIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const toggleSelectAllMonthEntries = (monthEntries: JournalEntry[]) => {
    const entriesWithIds = monthEntries.filter(entry => entry.id !== undefined);
    if (selectedMonthEntryIds.size === entriesWithIds.length && entriesWithIds.length > 0) {
      setSelectedMonthEntryIds(new Set());
    } else {
      const allIds = new Set(entriesWithIds.map(entry => entry.id!));
      setSelectedMonthEntryIds(allIds);
    }
  };

  const handleBulkDeleteMonthEntries = async () => {
    if (selectedMonthEntryIds.size === 0) return;
    
    const confirmMessage = `Are you sure you want to delete ${selectedMonthEntryIds.size} ${selectedMonthEntryIds.size === 1 ? 'entry' : 'entries'}? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const deletePromises = Array.from(selectedMonthEntryIds).map(id => 
        deleteJournalEntry(id)
      );
      await Promise.all(deletePromises);
      
      setSelectedMonthEntryIds(new Set());
      setMonthEntriesBulkEditMode(false);
      // Entries are automatically refreshed via EntriesContext
      window.dispatchEvent(new CustomEvent('journalEntrySaved'));
    } catch (error) {
      console.error('Error deleting month entries:', error);
      alert(`Failed to delete entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const renderDayView = () => {
    const dayEntries = getEntriesForDate(selectedDate);
    const entriesWithIds = dayEntries.filter(entry => entry.id !== undefined);
    
    return (
      <div className="timeline-day-view">
        <div className="day-header">
          <h2>
            {(() => {
              try {
                return formatCalendarDate(dateToCalendarDate(selectedDate, calendar), 'EEEE, MMMM D, YYYY');
              } catch (e) {
                return formatDate(selectedDate, 'EEEE, MMMM d, yyyy');
              }
            })()}
          </h2>
          {dayEntries.length > 0 && (
            <div className="day-header-actions">
              <button 
                className={`bulk-edit-toggle-button ${bulkEditMode ? 'active' : ''}`}
                onClick={() => {
                  setBulkEditMode(!bulkEditMode);
                  if (bulkEditMode) {
                    setSelectedEntryIds(new Set());
                  }
                }}
                title={bulkEditMode ? 'Exit bulk edit mode' : 'Enter bulk edit mode'}
              >
                {bulkEditMode ? 'Cancel' : 'Bulk Edit'}
              </button>
            </div>
          )}
        </div>
        {bulkEditMode && selectedEntryIds.size > 0 && (
          <div className="bulk-edit-actions">
            <span className="bulk-edit-selected-count">
              {selectedEntryIds.size} {selectedEntryIds.size === 1 ? 'entry' : 'entries'} selected
            </span>
            <button 
              className="bulk-delete-button"
              onClick={handleBulkDelete}
            >
              Delete Selected
            </button>
          </div>
        )}
        {bulkEditMode && entriesWithIds.length > 0 && (
          <div className="bulk-edit-select-all">
            <label className="bulk-edit-checkbox-label">
              <input
                type="checkbox"
                checked={selectedEntryIds.size === entriesWithIds.length && entriesWithIds.length > 0}
                onChange={() => toggleSelectAll(dayEntries)}
              />
              <span>Select All ({entriesWithIds.length})</span>
            </label>
          </div>
        )}
        <div className="day-entries-list">
          {dayEntries.length === 0 ? (
            <div className="no-entries-message">
              <p>No entries for this day.</p>
              <p className="hint">Click on a date in month or week view to see entries, or create a new one.</p>
            </div>
          ) : (
            dayEntries.map((entry, idx) => {
              const entryColor = calculateEntryColor(entry);
              const isSelected = bulkEditMode && entry.id !== undefined && selectedEntryIds.has(entry.id);
              return (
                <div
                  key={idx}
                  className={`entry-card-full entry-${entry.timeRange} ${isSelected ? 'bulk-selected' : ''} ${bulkEditMode ? 'bulk-edit-mode' : ''}`}
                  onClick={(e) => {
                    if (bulkEditMode) {
                      e.stopPropagation();
                      toggleEntrySelection(entry.id);
                    } else {
                      playEntrySelectionSound();
                      onEntrySelect(entry);
                    }
                  }}
                  style={{ borderLeftColor: entryColor }}
                >
                {bulkEditMode && entry.id !== undefined && (
                  <div className="entry-checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={selectedEntryIds.has(entry.id)}
                      onChange={() => toggleEntrySelection(entry.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                <div className="entry-card-content-wrapper">
                <div className="card-header">
                  <div className="card-title-full">{entry.title}</div>
                  <div className="card-meta">
                    {onEditEntry && !bulkEditMode && entry.timeRange === viewMode && (
                      <button
                        className="card-edit-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playEditSound();
                          onEditEntry(entry);
                        }}
                        title="Edit entry"
                      >
                        Edit
                      </button>
                    )}
                    <span className="time-range-badge">{entry.timeRange}</span>
                    <span className="card-date">
                      {formatDate(parseISODate(entry.date), 'MMM d')}
                      {entry.hour !== undefined && entry.hour !== null && (
                        <span className="card-date-time">
                          {' '}{formatTime(entry.hour, entry.minute, entry.second, preferences.timeFormat || '12h')}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="card-content-full">{entry.content}</div>
                {entry.tags && entry.tags.length > 0 && (
                  <div className="card-tags-full">
                    {entry.tags.map((tag, tIdx) => (
                      <span key={tIdx} className="card-tag-full">{tag}</span>
                    ))}
                  </div>
                )}
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // OPTIMIZATION: Memoize month data to avoid recalculating on every render
  const selectedYear = selectedDate.getFullYear();
  const yearViewMonthData = useMemo(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      months.push(new Date(selectedYear, i, 1));
    }
    
    return months.map((month) => {
      // OPTIMIZATION: Get all entries for this month (month, year, decade)
      // and prioritize year entries since we're in year view
      const allMonthEntries = getAllEntriesForMonth(month.getFullYear(), month.getMonth());
      const prioritizedMonthEntries = prioritizeEntriesByTier(allMonthEntries, 'year');
      const pixelMap = createMonthPixelMap(allMonthEntries, 'year');
      
      return {
        month,
        monthEntries: prioritizedMonthEntries,
        allMonthEntries,
        pixelMap,
      };
    });
  }, [selectedYear, entryLookup, getAllEntriesForMonth, createMonthPixelMap, prioritizeEntriesByTier]);

  // Helper function to render macro cycle indicators
  // Now shows cycles regardless of calendar selection when toggles are enabled
  const renderMacroCycleIndicators = (year: number, jdn: number) => {
    // Get cycles for all calendar types (not just current calendar)
    const cyclesChinese = getAllMacroCycles(jdn, 'chinese', year);
    const cyclesMayan = getAllMacroCycles(jdn, 'mayan-longcount', year);
    const cyclesHebrew = getAllMacroCycles(jdn, 'hebrew', year);
    const cyclesIndian = getAllMacroCycles(jdn, 'indian-saka', year);
    
    const indicators: JSX.Element[] = [];
    
    // Chinese 60-year cycle - ALWAYS show when enabled (not just for Chinese calendar)
    if (preferences.showChineseSexagenaryCycle === true && cyclesChinese.chineseSexagenary) {
      const { combined, cyclePosition, branchEnglish, stem, branch } = cyclesChinese.chineseSexagenary;
      const isTransition = cyclePosition === 1; // Highlight start of cycle
      indicators.push(
        <div 
          key="chinese" 
          className={`macro-cycle-indicator chinese-cycle ${isTransition ? 'cycle-transition' : ''}`} 
          title={`Chinese Sexagenary Cycle (干支): ${combined} (${stem}${branch}) - ${branchEnglish} Year\nPosition: ${cyclePosition} of 60\n\nThe 60-year cycle combines 10 Heavenly Stems (天干) and 12 Earthly Branches (地支). Each year has a unique name. This cycle is used in traditional Chinese calendar systems.`}
        >
          <span className="cycle-label">{combined}</span>
          <span className="cycle-position">{cyclePosition}/60</span>
        </div>
      );
    }
    
    // Mayan Long Count cycles - ALWAYS show when enabled
    if (preferences.showMayanLongCountCycles === true && cyclesMayan.mayanLongCount) {
      const { baktun, katun, katunCycleGlobal, daysIntoKatun, tun } = cyclesMayan.mayanLongCount;
      const isKatunTransition = daysIntoKatun < 100 || daysIntoKatun > 7100;
      const isBaktunTransition = katun === 0 && daysIntoKatun < 100;
      
      // Always show katun (every year)
      indicators.push(
        <div 
          key="katun" 
          className={`macro-cycle-indicator mayan-katun ${isKatunTransition ? 'cycle-transition' : ''}`}
          title={`Mayan Katun ${katunCycleGlobal}\nBaktun ${baktun}, Katun ${katun}, Tun ${tun}\nDays into Katun: ${daysIntoKatun.toLocaleString()} of 7,200\n\nA Katun is a period of 7,200 days (~19.7 years). 20 Katuns = 1 Baktun (144,000 days ≈ 394 years). The Maya used these cycles to track long periods of time.`}
        >
          <span className="cycle-label">K{katunCycleGlobal}</span>
          {isKatunTransition && <span className="cycle-badge">Transition</span>}
        </div>
      );
      
      // Show baktun when at transition or every baktun
      if (isBaktunTransition || baktun % 1 === 0) {
        indicators.push(
          <div 
            key="baktun" 
            className={`macro-cycle-indicator mayan-baktun ${isBaktunTransition ? 'cycle-transition' : ''}`}
            title={`Mayan Baktun ${baktun}\n\nA Baktun is a period of 144,000 days (approximately 394 years). The completion of Baktun 13 on December 21, 2012 was a significant date in Mayan cosmology.`}
          >
            <span className="cycle-label">B{baktun}</span>
            {isBaktunTransition && <span className="cycle-badge">New</span>}
          </div>
        );
      }
    }
    
    // Metonic cycle - ALWAYS show when enabled
    if (preferences.showMetonicCycle === true && cyclesHebrew.metonic) {
      const { cyclePosition, isLeapYear } = cyclesHebrew.metonic;
      const isTransition = cyclePosition === 1 || cyclePosition === 19;
      indicators.push(
        <div 
          key="metonic" 
          className={`macro-cycle-indicator metonic-cycle ${isTransition ? 'cycle-transition' : ''}`}
          title={`Metonic Cycle Position ${cyclePosition} of 19${isLeapYear ? ' (Leap Year)' : ''}\n\nThe Metonic cycle is a 19-year period after which the phases of the moon recur on the same days of the year. Used in the Hebrew calendar to synchronize lunar months with solar years. 7 out of every 19 years are leap years (13 months).`}
        >
          <span className="cycle-label">M{cyclePosition}</span>
          {isLeapYear && <span className="cycle-badge">Leap</span>}
        </div>
      );
    }
    
    // Mayan Calendar Round - ALWAYS show when enabled
    if (preferences.showMayanCalendarRound === true && cyclesMayan.mayanCalendarRound) {
      const { roundNumber, yearsIntoRound } = cyclesMayan.mayanCalendarRound;
      const isTransition = yearsIntoRound === 0 || yearsIntoRound === 51;
      indicators.push(
        <div 
          key="calendar-round" 
          className={`macro-cycle-indicator mayan-round ${isTransition ? 'cycle-transition' : ''}`}
          title={`Mayan Calendar Round ${roundNumber}\nYear ${yearsIntoRound} of 52\n\nThe Calendar Round is a 52-year cycle (18,980 days) formed by combining the 260-day Tzolk'in and 365-day Haab' calendars. After 52 Haab' years, both cycles realign.`}
        >
          <span className="cycle-label">R{roundNumber}</span>
          <span className="cycle-position">{yearsIntoRound}/52</span>
        </div>
      );
    }
    
    // Hindu Yuga cycles - ALWAYS show when enabled (show current Yuga)
    if (preferences.showHinduYugaCycles === true && cyclesIndian.hinduYuga) {
      const { yugaType, yearsIntoYuga, mahayugaNumber } = cyclesIndian.hinduYuga;
      const yugaDurations: Record<YugaType, number> = {
        'Satya': 1728000,
        'Treta': 1296000,
        'Dvapara': 864000,
        'Kali': 432000
      };
      const totalYugaYears = yugaDurations[yugaType];
      const progressPercent = Math.round((yearsIntoYuga / totalYugaYears) * 100);
      
      const yugaEmoji: Record<YugaType, string> = {
        'Satya': '🟢',
        'Treta': '🟡',
        'Dvapara': '🟠',
        'Kali': '🔴'
      };
      
      const yugaDescriptions: Record<YugaType, string> = {
        'Satya': 'Golden Age - Age of Truth and Perfection',
        'Treta': 'Silver Age - Age of Three Quarters',
        'Dvapara': 'Bronze Age - Age of Two Quarters',
        'Kali': 'Iron Age - Current Age of Strife'
      };
      
      indicators.push(
        <div 
          key="yuga" 
          className="macro-cycle-indicator hindu-yuga"
          title={`${yugaType} Yuga - ${yugaDescriptions[yugaType]}\n${yearsIntoYuga.toLocaleString()} of ${totalYugaYears.toLocaleString()} years (${progressPercent}%)\nMahayuga ${mahayugaNumber}\n\nHindu cosmology divides time into four Yugas (ages) that repeat in cycles. A complete Mahayuga is 4,320,000 years. We are currently in Kali Yuga, which began in 3102 BCE.`}
        >
          <span className="cycle-label">{yugaEmoji[yugaType]} {yugaType}</span>
          <span className="cycle-position">{progressPercent}%</span>
        </div>
      );
    }
    
    return indicators.length > 0 ? (
      <div className="macro-cycles-container">
        {indicators}
      </div>
    ) : null;
  };

  const renderYearView = () => {
    const yearNum = selectedDate.getFullYear();
    const jdn = gregorianToJDN(yearNum, 1, 1);
    const yearMacroCycles = renderMacroCycleIndicators(yearNum, jdn);
    
    return (
      <div className="timeline-year-view">
        {yearMacroCycles && (
          <div className="year-macro-cycles">
            {yearMacroCycles}
          </div>
        )}
        <div className="year-grid">
          {yearViewMonthData.map((monthData, idx) => {
            const { month, monthEntries, allMonthEntries, pixelMap } = monthData;
            
            return (
              <div
                key={idx}
                className={`timeline-cell month-cell ${isSelected(month) ? 'selected' : ''} ${monthEntries.length > 0 ? 'has-entries' : ''}`}
                onClick={() => {
                  playCalendarSelectionSound();
                  onTimePeriodSelect(month, 'month');
                }}
              >
                <div 
                  className="cell-month-label"
                  style={{ color: getZodiacColor(new Date(month.getFullYear(), month.getMonth(), 15)) }}
                >
                  {formatDate(month, 'MMM')}
                </div>
                {allMonthEntries.length > 0 && (
                  <div className="month-pixel-map">
                    {pixelMap.map((color, pixelIdx) => (
                      <div
                        key={pixelIdx}
                        className="pixel"
                        style={{ backgroundColor: color }}
                        title={pixelIdx < allMonthEntries.length ? allMonthEntries[pixelIdx].title : ''}
                      />
                    ))}
                  </div>
                )}
                <div className="cell-entries">
                  {monthEntries.slice(0, 2).map((entry, eIdx) => {
                    const entryColor = calculateEntryColor(entry);
                    return (
                      <div
                        key={eIdx}
                        className={`entry-badge entry-${entry.timeRange}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          playEntrySelectionSound();
                          onEntrySelect(entry);
                        }}
                        title={entry.title}
                        style={{ backgroundColor: entryColor }}
                      >
                        <span className="badge-title">{entry.title}</span>
                      </div>
                    );
                  })}
                  {monthEntries.length > 2 && (
                    <div className="entry-badge more-entries">+{monthEntries.length - 2}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // OPTIMIZATION: Memoize decade year data to avoid recalculating on every render
  const selectedYearForDecade = selectedDate.getFullYear();
  const decadeViewYearData = useMemo(() => {
    const decadeStart = Math.floor(selectedYearForDecade / 10) * 10;
    const years = [];
    for (let i = 0; i < 10; i++) {
      years.push(new Date(decadeStart + i, 0, 1));
    }
    
    return years.map((year) => {
      // OPTIMIZATION: Get all entries for this year (year, decade)
      // and prioritize decade entries since we're in decade view
      const allYearEntries = getAllEntriesForYear(year.getFullYear());
      const prioritizedYearEntries = prioritizeEntriesByTier(allYearEntries, 'decade');
      const pixelMap = createYearPixelMap(allYearEntries, 'decade');
      const yearGradientColor = getZodiacGradientColorForYear(year.getFullYear());
      
      return {
        year,
        yearEntries: prioritizedYearEntries,
        allYearEntries,
        pixelMap,
        yearGradientColor,
      };
    });
  }, [selectedYearForDecade, entryLookup, getAllEntriesForYear, createYearPixelMap, prioritizeEntriesByTier]);

  const renderDecadeView = () => {
    // Check if any macro cycle toggles are enabled
    const hasAnyMacroCycles = 
      preferences.showChineseSexagenaryCycle === true ||
      preferences.showMayanLongCountCycles === true ||
      preferences.showMetonicCycle === true ||
      preferences.showMayanCalendarRound === true ||
      preferences.showHinduYugaCycles === true;
    
    // Get macro cycles for the decade start year (for header display)
    const decadeStartYear = Math.floor(selectedDate.getFullYear() / 10) * 10;
    const decadeStartJDN = gregorianToJDN(decadeStartYear, 1, 1);
    const decadeMacroCycles = hasAnyMacroCycles ? renderMacroCycleIndicators(decadeStartYear, decadeStartJDN) : null;
    
    return (
      <div className="timeline-decade-view">
        {hasAnyMacroCycles && decadeMacroCycles && (
          <div className="decade-macro-cycles-header">
            <div className="decade-macro-cycles-title">Macro Cycles for {decadeStartYear}s</div>
            {decadeMacroCycles}
          </div>
        )}
        <div className="decade-grid">
          {decadeViewYearData.map((yearData, idx) => {
            const { year, yearEntries, allYearEntries, pixelMap, yearGradientColor } = yearData;
            
            return (
              <div
                key={idx}
                className={`timeline-cell year-cell ${isSelected(year) ? 'selected' : ''} ${yearEntries.length > 0 ? 'has-entries' : ''}`}
                onClick={() => {
                  playCalendarSelectionSound();
                  onTimePeriodSelect(year, 'year');
                }}
                style={{ '--zodiac-gradient': yearGradientColor } as React.CSSProperties}
              >
                <div 
                  className="cell-year-label"
                  style={{ color: yearGradientColor }}
                >
                  {year.getFullYear()}
                </div>
                {allYearEntries.length > 0 && (
                  <div className="year-pixel-map">
                    {pixelMap.map((color, pixelIdx) => (
                      <div
                        key={pixelIdx}
                        className="pixel"
                        style={{ backgroundColor: color }}
                        title={pixelIdx < allYearEntries.length ? allYearEntries[pixelIdx].title : ''}
                      />
                    ))}
                  </div>
                )}
                <div className="cell-entries">
                  {yearEntries.slice(0, 2).map((entry, eIdx) => {
                    const entryColor = calculateEntryColor(entry);
                    return (
                      <div
                        key={eIdx}
                        className={`entry-badge entry-${entry.timeRange}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          playEntrySelectionSound();
                          onEntrySelect(entry);
                        }}
                        title={entry.title}
                        style={{ backgroundColor: entryColor }}
                      >
                        <span className="badge-title">{entry.title}</span>
                      </div>
                    );
                  })}
                  {yearEntries.length > 2 && (
                    <div className="entry-badge more-entries">+{yearEntries.length - 2}</div>
                  )}
                </div>
                {/* Macro cycle indicators for decade view (year level) */}
                {(() => {
                  const yearNum = year.getFullYear();
                  const jdn = gregorianToJDN(yearNum, 1, 1);
                  return renderMacroCycleIndicators(yearNum, jdn);
                })()}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Loading is handled at app level via EntriesContext
  // Entries are preloaded, so no need for component-level loading state

  switch (viewMode) {
    case 'decade':
      return renderDecadeView();
    case 'year':
      return renderYearView();
    case 'month':
      return renderMonthView();
    case 'week':
      return renderWeekView();
    case 'day':
      return renderDayView();
    default:
      return renderMonthView();
  }
}

// Memoize component to prevent unnecessary re-renders
// Only re-render when props actually change
export default memo(TimelineView, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.selectedDate.getTime() === nextProps.selectedDate.getTime() &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.weekStartsOn === nextProps.weekStartsOn &&
    prevProps.onTimePeriodSelect === nextProps.onTimePeriodSelect &&
    prevProps.onEntrySelect === nextProps.onEntrySelect &&
    prevProps.onEditEntry === nextProps.onEditEntry
  );
});

