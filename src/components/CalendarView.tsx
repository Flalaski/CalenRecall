import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { TimeRange, Preferences } from '../types';
import {
  getDaysInMonth,
  getDaysInWeek,
  getMonthsInYear,
  getYearsInDecade,
  formatDate,
  isToday,
  getWeekStart,
  getWeekEnd,
  getZodiacColor,
  getZodiacGradientColor,
  getZodiacGradientColorForYear,
  createDate,
  getMonthStart,
  getMonthEnd,
  getWeekdayLabels,
  formatTime,
} from '../utils/dateUtils';
import { isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { playCalendarSelectionSound } from '../utils/audioUtils';
import { useCalendar } from '../contexts/CalendarContext';
import { useEntries } from '../contexts/EntriesContext';
import { dateToCalendarDate } from '../utils/calendars/calendarConverter';
import { formatCalendarDate } from '../utils/calendars/calendarConverter';
import { buildEntryLookup, hasEntryForDateOptimized, getEntriesWithTimeOptimized } from '../utils/entryLookupUtils';
import { getEntryColorForDateOptimized } from '../utils/entryColorUtils';
import { getAstronomicalEventsForRange, getAstronomicalEventLabel, type DateAstronomicalEvent } from '../utils/astronomicalEvents';
import './CalendarView.css';

interface CalendarViewProps {
  selectedDate: Date;
  viewMode: TimeRange;
  onTimePeriodSelect: (date: Date, viewMode: TimeRange) => void;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

function CalendarView({
  selectedDate,
  viewMode,
  onTimePeriodSelect,
  weekStartsOn = 0,
}: CalendarViewProps) {
  const { calendar } = useCalendar();
  const { entries: allEntries, entryLookup: contextEntryLookup, entryColors } = useEntries();
  const [preferences, setPreferences] = useState<Preferences>({});

  // Load preferences for time format and astronomical events
  useEffect(() => {
    console.log('[CalendarView] Component mounted, loading preferences...');
    const loadPreferences = async () => {
      if (window.electronAPI) {
        try {
          const prefs = await window.electronAPI.getAllPreferences();
          console.log('[CalendarView] ✅ Loaded ALL preferences:', prefs);
          console.log('[CalendarView] showSolsticesEquinoxes:', prefs.showSolsticesEquinoxes, 'type:', typeof prefs.showSolsticesEquinoxes);
          console.log('[CalendarView] showMoonPhases:', prefs.showMoonPhases, 'type:', typeof prefs.showMoonPhases);
          
          // Force set preferences even if they're undefined (will default to false)
          setPreferences({
            ...prefs,
            showSolsticesEquinoxes: prefs.showSolsticesEquinoxes ?? false,
            showMoonPhases: prefs.showMoonPhases ?? false
          });
        } catch (error) {
          console.error('[CalendarView] ❌ Error loading preferences:', error);
        }
      } else {
        console.warn('[CalendarView] ⚠️ window.electronAPI not available');
      }
    };
    loadPreferences();

    // Listen for preference updates (e.g., from menu toggles)
    if (window.electronAPI && window.electronAPI.onPreferenceUpdated) {
      const handlePreferenceUpdate = (data: { key: string; value: any }) => {
        console.log('[CalendarView] Preference update received:', data);
        if (data.key === 'showSolsticesEquinoxes' || data.key === 'showMoonPhases') {
          // Update preferences state immediately
          setPreferences(prev => {
            const updated = { ...prev, [data.key]: data.value };
            console.log('[CalendarView] Updated preferences:', updated);
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

  // Note: entries filtering is handled by EntriesContext, no need to filter here

  // Get astronomical events for the visible date range
  const astronomicalEvents = useMemo(() => {
    // Use truthy check instead of strict === true to handle undefined as false
    const showSolsticesEquinoxes = !!(preferences.showSolsticesEquinoxes);
    const showMoonPhases = !!(preferences.showMoonPhases);
    
    console.log('[CalendarView] useMemo - preferences state:', {
      showSolsticesEquinoxes: preferences.showSolsticesEquinoxes,
      showMoonPhases: preferences.showMoonPhases,
      computed: { showSolsticesEquinoxes, showMoonPhases }
    });
    
    // Early return if both are disabled
    if (!showSolsticesEquinoxes && !showMoonPhases) {
      console.log('[CalendarView] ⚠️ Both astronomical features disabled, returning empty map');
      return new Map<string, DateAstronomicalEvent[]>();
    }
    
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
        startDate = getMonthStart(selectedDate);
        endDate = getMonthEnd(selectedDate);
        break;
      }
      case 'week': {
        startDate = getWeekStart(selectedDate, weekStartsOn);
        endDate = getWeekEnd(selectedDate, weekStartsOn);
        break;
      }
      case 'day': {
        startDate = selectedDate;
        endDate = selectedDate;
        break;
      }
      default: {
        startDate = getMonthStart(selectedDate);
        endDate = getMonthEnd(selectedDate);
      }
    }
    
    const events = getAstronomicalEventsForRange(
      startDate,
      endDate,
      showSolsticesEquinoxes,
      showMoonPhases
    );
    
    // Debug logging - ALWAYS log to help diagnose
    console.log('[CalendarView] Astronomical events calculation:', {
      viewMode,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      showSolsticesEquinoxes,
      showMoonPhases,
      preferences: {
        showSolsticesEquinoxes: preferences.showSolsticesEquinoxes,
        showMoonPhases: preferences.showMoonPhases
      },
      eventCount: events.size,
      events: Array.from(events.entries()).slice(0, 10) // Log first 10 events
    });
    
    // Log a sample of date keys for debugging
    if (events.size > 0) {
      const sampleKeys = Array.from(events.keys()).slice(0, 5);
      console.log('[CalendarView] Sample event date keys:', sampleKeys);
    }
    
    return events;
  }, [selectedDate, viewMode, weekStartsOn, preferences.showSolsticesEquinoxes, preferences.showMoonPhases]);

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

  // OPTIMIZATION: Use optimized hasEntryForDate utility with lookup
  const hasEntry = useCallback((date: Date): boolean => {
    return hasEntryForDateOptimized(entryLookup, date, weekStartsOn);
  }, [entryLookup, weekStartsOn]);

  const renderDecadeView = () => {
    const years = getYearsInDecade(selectedDate);
    return (
      <div className="calendar-grid decade-view">
        {years.map((year, idx) => {
          const yearGradientColor = getZodiacGradientColorForYear(year.getFullYear());
          const hasEntryForYear = hasEntry(year);
          const entryColor = hasEntryForYear ? getEntryColorForDateOptimized(entryLookup, year, 'year', weekStartsOn, entryColors) : null;
          
          // Get astronomical events for this year (check solstices/equinoxes)
          const yearEvents: DateAstronomicalEvent[] = [];
          // Check all solstices and equinoxes for this year
          for (let month = 0; month < 12; month++) {
            for (let day = 1; day <= 31; day++) {
              try {
                const checkDate = createDate(year.getFullYear(), month, day);
                const checkYear = checkDate.getFullYear();
                const checkMonth = String(checkDate.getMonth() + 1).padStart(2, '0');
                const checkDay = String(checkDate.getDate()).padStart(2, '0');
                const checkKey = `${checkYear}-${checkMonth}-${checkDay}`;
                const events = astronomicalEvents.get(checkKey) || [];
                if (events.length > 0) {
                  yearEvents.push(...events);
                }
              } catch (e) {
                // Invalid date, skip
              }
            }
          }
          // Deduplicate events
          const uniqueEvents = Array.from(new Map(yearEvents.map(e => [e.type + '-' + e.name, e])).values());
          
          return (
            <div
              key={idx}
              className={`calendar-cell year-cell ${isSelected(year) ? 'selected' : ''} ${hasEntryForYear ? 'has-entry' : ''}`}
              onClick={() => {
                playCalendarSelectionSound();
                onTimePeriodSelect(year, 'year');
              }}
              style={{ '--zodiac-gradient': yearGradientColor } as React.CSSProperties}
            >
              <div className="cell-content">
                <div className="cell-label" style={{ color: yearGradientColor }}>
                  {(() => {
                    try {
                      const calDate = dateToCalendarDate(year, calendar);
                      return `${calDate.year}${calDate.era ? ' ' + calDate.era : ''}`;
                    } catch (e) {
                      return year.getFullYear();
                    }
                  })()}
                </div>
                {uniqueEvents.length > 0 && (
                  <div className="cell-astronomical-events" title={uniqueEvents.map(e => e.displayName).join(', ')}>
                    {uniqueEvents.slice(0, 4).map((event, eIdx) => (
                      <span key={eIdx} className="astronomical-event-icon">
                        {getAstronomicalEventLabel(event)}
                      </span>
                    ))}
                  </div>
                )}
                {hasEntryForYear && entryColor && (
                  <div 
                    className="entry-indicator"
                    style={{ backgroundColor: entryColor }}
                  ></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderYearView = () => {
    const months = getMonthsInYear(selectedDate);
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return (
      <div className="calendar-grid year-view">
        {months.map((month, idx) => {
          // Use the 15th of each month as representative for the zodiac color
          const monthMidpoint = createDate(month.getFullYear(), month.getMonth(), 15);
          const zodiacColor = getZodiacColor(monthMidpoint);
          const hasEntryForMonth = hasEntry(month);
          const entryColor = hasEntryForMonth ? getEntryColorForDateOptimized(entryLookup, month, 'month', weekStartsOn, entryColors) : null;
          
          // Get number of days in this month
          const daysInMonth = getDaysInMonth(month).length;
          
          // OPTIMIZATION: Count entries using lookup instead of filtering
          const monthEnd = getMonthEnd(month);
          monthEnd.setHours(23, 59, 59, 999);
          // Count entries more efficiently using lookup
          let entryCount = 0;
          const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
          entryCount += entryLookup.byMonth.get(monthKey)?.length || 0;
          // Count day entries in month (approximate - could be optimized further)
          for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = createDate(month.getFullYear(), month.getMonth(), day);
            const dayStr = formatDate(dayDate);
            entryCount += entryLookup.byDateString.get(dayStr)?.length || 0;
          }
          
          // Get astronomical events for this month
          const monthEvents: DateAstronomicalEvent[] = [];
          for (let day = 1; day <= daysInMonth; day++) {
            try {
              const dayDate = createDate(month.getFullYear(), month.getMonth(), day);
              const dayYear = dayDate.getFullYear();
              const dayMonth = String(dayDate.getMonth() + 1).padStart(2, '0');
              const dayDay = String(dayDate.getDate()).padStart(2, '0');
              const dayKey = `${dayYear}-${dayMonth}-${dayDay}`;
              const events = astronomicalEvents.get(dayKey) || [];
              if (events.length > 0) {
                monthEvents.push(...events);
              }
            } catch (e) {
              // Invalid date, skip
            }
          }
          // Deduplicate events
          const uniqueMonthEvents = Array.from(new Map(monthEvents.map(e => [e.type + '-' + e.name, e])).values());
          
          return (
            <div
              key={idx}
              className={`calendar-cell month-cell ${isSelected(month) ? 'selected' : ''} ${hasEntryForMonth ? 'has-entry' : ''}`}
              onClick={() => {
                playCalendarSelectionSound();
                onTimePeriodSelect(month, 'month');
              }}
              style={{ '--zodiac-color': zodiacColor } as React.CSSProperties}
            >
              <div className="cell-content">
                <div className="cell-label month-title">{monthNames[idx]}</div>
                <div className="month-details">
                  <div className="month-days">{daysInMonth} days</div>
                  {entryCount > 0 && (
                    <div className="month-entry-count">{entryCount} {entryCount === 1 ? 'entry' : 'entries'}</div>
                  )}
                </div>
                {uniqueMonthEvents.length > 0 && (
                  <div className="cell-astronomical-events" title={uniqueMonthEvents.map(e => e.displayName).join(', ')}>
                    {uniqueMonthEvents.slice(0, 3).map((event, eIdx) => (
                      <span key={eIdx} className="astronomical-event-icon">
                        {getAstronomicalEventLabel(event)}
                      </span>
                    ))}
                  </div>
                )}
                {hasEntryForMonth && entryColor && (
                  <div 
                    className="entry-indicator"
                    style={{ backgroundColor: entryColor }}
                  ></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMonthView = () => {
    const days = getDaysInMonth(selectedDate);
    const weekDays = getWeekdayLabels(weekStartsOn);
    
    // Get first day of month and pad with empty cells
    const firstDay = days[0].getDay();
    // Adjust first day based on weekStartsOn: (firstDay - weekStartsOn + 7) % 7
    const adjustedFirstDay = (firstDay - weekStartsOn + 7) % 7;
    
    return (
      <div className="calendar-month-view">
        <div className="weekday-header">
          {weekDays.map(day => (
            <div key={day} className="weekday-cell">{day}</div>
          ))}
        </div>
        <div className="calendar-grid month-view">
          {Array(adjustedFirstDay).fill(null).map((_, idx) => (
            <div key={`empty-${idx}`} className="calendar-cell empty-cell"></div>
          ))}
          {days.map((day, idx) => {
            const gradientColor = getZodiacGradientColor(day);
            // OPTIMIZATION: Use optimized lookup instead of filtering
            const hasEntryForDay = hasEntry(day);
            const entryColor = hasEntryForDay ? getEntryColorForDateOptimized(entryLookup, day, 'day', weekStartsOn, entryColors) : null;
            const entriesWithTime = getEntriesWithTimeOptimized(entryLookup, day);
            const timeFormat = preferences.timeFormat || '12h';
            
            // Get astronomical events for this day
            const dayKey = day.toISOString().split('T')[0];
            const dayEvents = astronomicalEvents.get(dayKey) || [];
            
            return (
              <div
                key={idx}
                className={`calendar-cell day-cell ${isToday(day) ? 'today' : ''} ${isSelected(day) ? 'selected' : ''} ${hasEntryForDay ? 'has-entry' : ''}`}
                onClick={() => {
                  playCalendarSelectionSound();
                  onTimePeriodSelect(day, 'day');
                }}
                style={{ '--zodiac-gradient': gradientColor } as React.CSSProperties}
              >
                <div className="cell-content">
                  <div className="cell-label">{day.getDate()}</div>
                  {hasEntryForDay && entryColor && (
                    <div 
                      className="entry-indicator"
                      style={{ backgroundColor: entryColor }}
                    ></div>
                  )}
                  {dayEvents.length > 0 && (
                    <div className="cell-astronomical-events" title={dayEvents.map(e => e.displayName).join(', ')}>
                      {dayEvents.map((event, eIdx) => (
                        <span key={eIdx} className="astronomical-event-icon">
                          {getAstronomicalEventLabel(event)}
                        </span>
                      ))}
                    </div>
                  )}
                  {entriesWithTime.length > 0 && (
                    <div className="cell-time-info">
                      {entriesWithTime.slice(0, 2).map((entry, eIdx) => {
                        const timeStr = formatTime(entry.hour, entry.minute, entry.second, timeFormat);
                        return timeStr ? (
                          <div key={eIdx} className="cell-time-badge" title={entry.title}>
                            {timeStr}
                          </div>
                        ) : null;
                      })}
                      {entriesWithTime.length > 2 && (
                        <div className="cell-time-more">+{entriesWithTime.length - 2}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const days = getDaysInWeek(selectedDate, weekStartsOn);
    const weekDays = getWeekdayLabels(weekStartsOn);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return (
      <div className="calendar-week-view">
        <div className="weekday-header">
          {weekDays.map((day, idx) => {
            const dayDate = days[idx];
            const dayNumber = dayDate.getDate();
            const monthName = monthNames[dayDate.getMonth()];
            return (
              <div key={day} className="weekday-cell">
                <div className="day-number">{dayNumber}</div>
                <div className="day-name">{day}</div>
                <div className="day-month">{monthName}</div>
              </div>
            );
          })}
        </div>
        <div className="calendar-grid week-view">
          {days.map((day, idx) => {
            const gradientColor = getZodiacGradientColor(day);
            // OPTIMIZATION: Use optimized lookup instead of filtering
            const hasEntryForDay = hasEntry(day);
            const entryColor = hasEntryForDay ? getEntryColorForDateOptimized(entryLookup, day, 'day', weekStartsOn, entryColors) : null;
            const entriesWithTime = getEntriesWithTimeOptimized(entryLookup, day);
            const timeFormat = preferences.timeFormat || '12h';
            
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
                className={`calendar-cell day-cell week-day-cell ${isToday(day) ? 'today' : ''} ${isSelected(day) ? 'selected' : ''} ${hasEntryForDay ? 'has-entry' : ''}`}
                onClick={() => {
                  playCalendarSelectionSound();
                  onTimePeriodSelect(day, 'day');
                }}
                style={{ '--zodiac-gradient': gradientColor } as React.CSSProperties}
              >
                <div className="cell-content">
                  {hasEntryForDay && entryColor && (
                    <div 
                      className="entry-indicator"
                      style={{ backgroundColor: entryColor }}
                    ></div>
                  )}
                  {dayEvents.length > 0 && (
                    <div className="cell-astronomical-events" title={dayEvents.map(e => e.displayName).join(', ')}>
                      {dayEvents.map((event, eIdx) => (
                        <span key={eIdx} className="astronomical-event-icon">
                          {getAstronomicalEventLabel(event)}
                        </span>
                      ))}
                    </div>
                  )}
                  {entriesWithTime.length > 0 && (
                    <div className="cell-time-info">
                      {entriesWithTime.slice(0, 2).map((entry, eIdx) => {
                        const timeStr = formatTime(entry.hour, entry.minute, entry.second, timeFormat);
                        return timeStr ? (
                          <div key={eIdx} className="cell-time-badge" title={entry.title}>
                            {timeStr}
                          </div>
                        ) : null;
                      })}
                      {entriesWithTime.length > 2 && (
                        <div className="cell-time-more">+{entriesWithTime.length - 2}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    // Get astronomical events for this day
    // Use local date string to match event keys
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dayNum = String(selectedDate.getDate()).padStart(2, '0');
    const dayKey = `${year}-${month}-${dayNum}`;
    const dayEvents = astronomicalEvents.get(dayKey) || [];
    
    return (
      <div className="calendar-day-view">
        <div
          className={`calendar-cell day-cell single-day ${isToday(selectedDate) ? 'today' : ''} ${isSelected(selectedDate) ? 'selected' : ''} ${hasEntry(selectedDate) ? 'has-entry' : ''}`}
        >
          <div className="cell-content">
            <div className="cell-label large">
              {(() => {
                try {
                  return formatCalendarDate(dateToCalendarDate(selectedDate, calendar), 'EEEE, MMMM D, YYYY');
                } catch (e) {
                  return formatDate(selectedDate, 'EEEE, MMMM d, yyyy');
                }
              })()}
            </div>
            {dayEvents.length > 0 && (
              <div className="cell-astronomical-events" title={dayEvents.map(e => e.displayName).join(', ')}>
                {dayEvents.map((event, eIdx) => (
                  <span key={eIdx} className="astronomical-event-icon">
                    {getAstronomicalEventLabel(event)}
                  </span>
                ))}
              </div>
            )}
            {hasEntry(selectedDate) && <div className="entry-indicator"></div>}
          </div>
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
export default memo(CalendarView, (prevProps, nextProps) => {
  return (
    prevProps.selectedDate.getTime() === nextProps.selectedDate.getTime() &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.weekStartsOn === nextProps.weekStartsOn &&
    prevProps.onTimePeriodSelect === nextProps.onTimePeriodSelect
  );
});

