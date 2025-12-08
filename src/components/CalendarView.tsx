import { useState, useEffect, useMemo, useCallback } from 'react';
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
  parseISODate,
  createDate,
  getMonthStart,
  getMonthEnd,
  getWeekdayLabels,
  formatTime,
} from '../utils/dateUtils';
import { isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { JournalEntry } from '../types';
import { playCalendarSelectionSound } from '../utils/audioUtils';
import { useCalendar } from '../contexts/CalendarContext';
import { useEntries } from '../contexts/EntriesContext';
import { dateToCalendarDate } from '../utils/calendars/calendarConverter';
import { formatCalendarDate } from '../utils/calendars/calendarConverter';
import { buildEntryLookup, hasEntryForDateOptimized, getDayEntriesOptimized, getEntriesWithTimeOptimized, filterEntriesByDateRangeOptimized } from '../utils/entryLookupUtils';
import { getEntryColorForDateOptimized } from '../utils/entryColorUtils';
import './CalendarView.css';

interface CalendarViewProps {
  selectedDate: Date;
  viewMode: TimeRange;
  onTimePeriodSelect: (date: Date, viewMode: TimeRange) => void;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export default function CalendarView({
  selectedDate,
  viewMode,
  onTimePeriodSelect,
  weekStartsOn = 0,
}: CalendarViewProps) {
  const { calendar } = useCalendar();
  const { entries: allEntries, entryLookup: contextEntryLookup, entryColors } = useEntries();
  const [preferences, setPreferences] = useState<Preferences>({});

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

  // OPTIMIZATION: Use lookup from context (stable across renders) or build with weekStartsOn if different
  const entryLookup = useMemo(() => {
    // If weekStartsOn is 0 (default), use context lookup directly
    if (weekStartsOn === 0) {
      return contextEntryLookup;
    }
    // Otherwise rebuild with custom weekStartsOn
    return buildEntryLookup(allEntries, weekStartsOn);
  }, [contextEntryLookup, allEntries, weekStartsOn]);

  // OPTIMIZATION: Filter entries using optimized lookup instead of O(n) filtering
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
        startDate = getMonthStart(selectedDate);
        endDate = getMonthEnd(selectedDate);
        break;
      }
      case 'week': {
        startDate = getWeekStart(selectedDate, weekStartsOn);
        endDate = getWeekEnd(selectedDate, weekStartsOn);
        // For week view, we also need to load month entries that could apply
        // So expand the range to include the full month(s) that contain this week
        const weekStartMonth = getMonthStart(startDate);
        const weekEndMonth = getMonthEnd(endDate);
        // Use the wider range to catch month entries
        if (weekStartMonth < startDate) startDate = weekStartMonth;
        if (weekEndMonth > endDate) endDate = weekEndMonth;
        break;
      }
      case 'day': {
        // For day view, load entries for the full month to catch month/week entries
        startDate = getMonthStart(selectedDate);
        endDate = getMonthEnd(selectedDate);
        break;
      }
      default: {
        startDate = selectedDate;
        endDate = selectedDate;
      }
    }
    
    // Use optimized lookup-based filtering instead of O(n) array filtering
    return filterEntriesByDateRangeOptimized(entryLookup, startDate, endDate, weekStartsOn);
  }, [entryLookup, selectedDate, viewMode, weekStartsOn]);

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
          const monthStart = getMonthStart(month);
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

