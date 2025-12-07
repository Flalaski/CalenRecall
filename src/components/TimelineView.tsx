import { useState, useEffect, useMemo, useCallback } from 'react';
import { JournalEntry, TimeRange, Preferences } from '../types';
import { formatDate, getDaysInMonth, getDaysInWeek, isToday, getWeekStart, getWeekEnd, getZodiacColor, getZodiacGradientColor, getZodiacGradientColorForYear, parseISODate, getMonthStart, getMonthEnd, createDate, getWeekdayLabels, formatTime } from '../utils/dateUtils';
import { isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { playCalendarSelectionSound, playEntrySelectionSound, playEditSound } from '../utils/audioUtils';
import { calculateEntryColor } from '../utils/entryColorUtils';
import { useCalendar } from '../contexts/CalendarContext';
import { useEntries } from '../contexts/EntriesContext';
import { dateToCalendarDate } from '../utils/calendars/calendarConverter';
import { formatCalendarDate } from '../utils/calendars/calendarConverter';
import { deleteJournalEntry } from '../services/journalService';
import { filterEntriesByDateRange } from '../utils/entryFilterUtils';
import './TimelineView.css';

interface TimelineViewProps {
  selectedDate: Date;
  viewMode: TimeRange;
  onTimePeriodSelect: (date: Date, viewMode: TimeRange) => void;
  onEntrySelect: (entry: JournalEntry) => void;
  onEditEntry?: (entry: JournalEntry) => void;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export default function TimelineView({
  selectedDate,
  viewMode,
  onTimePeriodSelect,
  onEntrySelect,
  onEditEntry,
  weekStartsOn = 0,
}: TimelineViewProps) {
  const { calendar } = useCalendar();
  const { entries: allEntries } = useEntries();
  const [preferences, setPreferences] = useState<Preferences>({});
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set());

  // Load preferences for time format
  useEffect(() => {
    const loadPreferences = async () => {
      if (window.electronAPI) {
        const prefs = await window.electronAPI.getAllPreferences();
        setPreferences(prefs);
      }
    };
    loadPreferences();
  }, []);

  // OPTIMIZATION: Filter entries from global context instead of querying database
  const entries = useMemo(() => {
    let startDate: Date;
    let endDate: Date;
    
    switch (viewMode) {
      case 'decade': {
        const decadeStart = Math.floor(selectedDate.getFullYear() / 10) * 10;
        startDate = createDate(decadeStart, 0, 1);
        endDate = createDate(decadeStart + 9, 11, 31);
        break;
      }
      case 'year': {
        startDate = createDate(selectedDate.getFullYear(), 0, 1);
        endDate = createDate(selectedDate.getFullYear(), 11, 31);
        break;
      }
      case 'month': {
        startDate = createDate(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        // Use date-fns endOfMonth which handles negative years correctly
        endDate = getMonthEnd(selectedDate);
        break;
      }
      case 'week': {
        startDate = getWeekStart(selectedDate, weekStartsOn);
        endDate = getWeekEnd(selectedDate, weekStartsOn);
        // Expand to include full month(s) to catch month entries
        const weekStartMonth = getMonthStart(startDate);
        const weekEndMonth = getMonthEnd(endDate);
        if (weekStartMonth < startDate) startDate = weekStartMonth;
        if (weekEndMonth > endDate) endDate = weekEndMonth;
        break;
      }
      case 'day': {
        // Load entries for the full month to catch month/week entries
        startDate = getMonthStart(selectedDate);
        endDate = getMonthEnd(selectedDate);
        break;
      }
      default: {
        startDate = selectedDate;
        endDate = selectedDate;
      }
    }
    
    return filterEntriesByDateRange(allEntries, startDate, endDate);
  }, [allEntries, selectedDate, viewMode]);

  useEffect(() => {
    // Clear bulk selection when changing date/view
    setSelectedEntryIds(new Set());
    setBulkEditMode(false);
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

  // Memoize getEntriesForDate to avoid recalculating on every render
  const getEntriesForDate = useCallback((date: Date, forViewMode?: TimeRange): JournalEntry[] => {
    const dateStr = formatDate(date);
    const checkYear = date.getFullYear();
    const checkMonth = date.getMonth();
    
    // Determine which entries to return based on the view mode
    return entries.filter(entry => {
      // Parse entry date as local date (YYYY-MM-DD or -YYYY-MM-DD format)
      const entryDate = parseISODate(entry.date);
      const entryYear = entryDate.getFullYear();
      const entryMonth = entryDate.getMonth();
      
      // For decade view, show year entries in their year cells
      if (forViewMode === 'decade' || viewMode === 'decade') {
        if (entry.timeRange === 'year') {
          return entryYear === checkYear;
        }
        // Don't show other entry types in decade view cells
        return false;
      }
      
      // For year view, show month entries in their month cells
      if (forViewMode === 'year' || viewMode === 'year') {
        if (entry.timeRange === 'month') {
          return entryYear === checkYear && entryMonth === checkMonth;
        }
        // Don't show other entry types in year view cells
        return false;
      }
      
      // For month/week/day views, only show day entries in calendar cells
      // Week/month/year/decade entries are shown in the right panel
      if (entry.timeRange === 'day') {
        return entry.date === dateStr;
      }
      
      return false;
    });
  }, [entries, viewMode]);

  // Get all entries for a specific year (for pixel map)
  const getAllEntriesForYear = (year: number): JournalEntry[] => {
    return entries.filter(entry => {
      const entryDate = parseISODate(entry.date);
      const entryYear = entryDate.getFullYear();
      
      // Check if entry falls within this year
      if (entry.timeRange === 'day' || entry.timeRange === 'week' || entry.timeRange === 'month') {
        return entryYear === year;
      } else if (entry.timeRange === 'year') {
        return entryYear === year;
      } else if (entry.timeRange === 'decade') {
        const entryDecade = Math.floor(entryYear / 10) * 10;
        const yearDecade = Math.floor(year / 10) * 10;
        return entryDecade === yearDecade;
      }
      return false;
    });
  };

  // Get all entries for a specific month (for pixel map)
  const getAllEntriesForMonth = (year: number, month: number): JournalEntry[] => {
    return entries.filter(entry => {
      const entryDate = parseISODate(entry.date);
      const entryYear = entryDate.getFullYear();
      const entryMonth = entryDate.getMonth();
      
      // Check if entry falls within this month
      if (entry.timeRange === 'day') {
        return entryYear === year && entryMonth === month;
      } else if (entry.timeRange === 'week') {
        // Check if week overlaps with this month
        const weekStart = getWeekStart(entryDate, weekStartsOn);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);
        return weekStart <= monthEnd && weekEnd >= monthStart;
      } else if (entry.timeRange === 'month') {
        return entryYear === year && entryMonth === month;
      } else if (entry.timeRange === 'year') {
        return entryYear === year;
      } else if (entry.timeRange === 'decade') {
        const entryDecade = Math.floor(entryYear / 10) * 10;
        const yearDecade = Math.floor(year / 10) * 10;
        return entryDecade === yearDecade;
      }
      return false;
    });
  };

  // Create pixel map for a year (12 months x ~30 days = 360 pixels, but we'll use 12x30 grid)
  const createYearPixelMap = (yearEntries: JournalEntry[]): string[] => {
    // Create a 12x30 grid (12 months, 30 days each)
    // Each pixel represents one entry, colored using crystal colors
    const pixels: string[] = [];
    const totalPixels = 12 * 30; // 360 pixels
    
    // Sort entries by date
    const sortedEntries = [...yearEntries].sort((a, b) => {
      const dateA = parseISODate(a.date);
      const dateB = parseISODate(b.date);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Create pixel array - one entry per pixel, using crystal colors
    for (let i = 0; i < Math.min(sortedEntries.length, totalPixels); i++) {
      const entry = sortedEntries[i];
      pixels.push(calculateEntryColor(entry));
    }
    
    // Fill remaining pixels with transparent/empty
    while (pixels.length < totalPixels) {
      pixels.push('transparent');
    }
    
    return pixels;
  };

  // Create pixel map for a month (7 days x 5 weeks = 35 pixels)
  const createMonthPixelMap = (monthEntries: JournalEntry[]): string[] => {
    // Create a 7x5 grid (7 days per week, 5 weeks max)
    // Each pixel represents one entry, colored by time range
    const pixels: string[] = [];
    const totalPixels = 7 * 5; // 35 pixels
    
    // Sort entries by date
    const sortedEntries = [...monthEntries].sort((a, b) => {
      const dateA = parseISODate(a.date);
      const dateB = parseISODate(b.date);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Create pixel array - one entry per pixel, using crystal colors
    for (let i = 0; i < Math.min(sortedEntries.length, totalPixels); i++) {
      const entry = sortedEntries[i];
      pixels.push(calculateEntryColor(entry));
    }
    
    // Fill remaining pixels with transparent/empty
    while (pixels.length < totalPixels) {
      pixels.push('transparent');
    }
    
    return pixels;
  };

  const renderMonthView = () => {
    const days = getDaysInMonth(selectedDate);
    const weekDays = getWeekdayLabels(weekStartsOn);
    const firstDay = days[0].getDay();
    // Adjust first day based on weekStartsOn: if weekStartsOn is 1 (Monday), Sunday (0) becomes 6
    // General formula: (firstDay - weekStartsOn + 7) % 7
    const adjustedFirstDay = (firstDay - weekStartsOn + 7) % 7;
    
    // Get month entries for the current month
    const monthEntries: JournalEntry[] = [];
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    entries.forEach(entry => {
      if (entry.timeRange === 'month') {
        const entryDate = parseISODate(entry.date);
        if (entryDate >= monthStart && entryDate <= monthEnd) {
          monthEntries.push(entry);
        }
      }
    });
    
    // Get week entries for the month and group them by week
    const weekEntriesByWeek = new Map<string, JournalEntry[]>();
    entries.forEach(entry => {
      if (entry.timeRange === 'week') {
        // Parse entry date to get the week start
        const entryDate = parseISODate(entry.date);
        const weekStart = getWeekStart(entryDate, weekStartsOn);
        const weekKey = formatDate(weekStart);
        
        // Check if this week is within the current month
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // Only include weeks that overlap with the current month
        if (weekStart <= monthEnd && weekEnd >= monthStart) {
          if (!weekEntriesByWeek.has(weekKey)) {
            weekEntriesByWeek.set(weekKey, []);
          }
          weekEntriesByWeek.get(weekKey)!.push(entry);
        }
      }
    });
    
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
                const dayEntries = getEntriesForDate(day);
                const gradientColor = getZodiacGradientColor(day);
                return (
                  <div
                    key={idx}
                    className={`timeline-cell day-cell ${isToday(day) ? 'today' : ''} ${isSelected(day) ? 'selected' : ''} ${dayEntries.length > 0 ? 'has-entries' : ''}`}
                    onClick={() => {
                      playCalendarSelectionSound();
                      onTimePeriodSelect(day, 'day');
                    }}
                    style={{ '--zodiac-gradient': gradientColor } as React.CSSProperties}
                  >
                    <div className="cell-date">{day.getDate()}</div>
                    <div className="cell-entries">
                      {dayEntries.slice(0, 3).map((entry, eIdx) => {
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
                      {dayEntries.length > 3 && (
                        <div className="entry-badge more-entries">+{dayEntries.length - 3}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="month-week-entries-section">
            <div className="month-entries-section">
              <div className="month-entries-header">Month Entries</div>
              <div className="month-entries-list">
                {monthEntries.length > 0 ? (
                  monthEntries.map((entry, eIdx) => {
                    const entryColor = calculateEntryColor(entry);
                    return (
                      <div
                        key={eIdx}
                        className="month-entry-item"
                        onClick={() => {
                          playEntrySelectionSound();
                          onEntrySelect(entry);
                        }}
                        title={entry.title}
                        style={{ borderLeftColor: entryColor }}
                      >
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
                              const entryColor = calculateEntryColor(entry);
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
                        {onEditEntry && (
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
                      <div className="card-preview">{entry.content.substring(0, 50)}...</div>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="card-tags">
                          {entry.tags.slice(0, 2).map((tag, tIdx) => (
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
                    {onEditEntry && !bulkEditMode && (
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

  const renderYearView = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      months.push(new Date(selectedDate.getFullYear(), i, 1));
    }
    
    return (
      <div className="timeline-year-view">
        <div className="year-grid">
          {months.map((month, idx) => {
            const monthEntries = getEntriesForDate(month, 'year');
            const allMonthEntries = getAllEntriesForMonth(month.getFullYear(), month.getMonth());
            const pixelMap = createMonthPixelMap(allMonthEntries);
            
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

  const renderDecadeView = () => {
    const decadeStart = Math.floor(selectedDate.getFullYear() / 10) * 10;
    const years = [];
    for (let i = 0; i < 10; i++) {
      years.push(new Date(decadeStart + i, 0, 1));
    }
    
    return (
      <div className="timeline-decade-view">
        <div className="decade-grid">
          {years.map((year, idx) => {
            const yearEntries = getEntriesForDate(year, 'decade');
            const allYearEntries = getAllEntriesForYear(year.getFullYear());
            const pixelMap = createYearPixelMap(allYearEntries);
            const yearGradientColor = getZodiacGradientColorForYear(year.getFullYear());
            
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

