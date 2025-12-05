import { useState, useEffect, useMemo, useCallback } from 'react';
import { TimeRange } from '../types';
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
} from '../utils/dateUtils';
import { isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { JournalEntry } from '../types';
import { playCalendarSelectionSound } from '../utils/audioUtils';
import { getEntryColorForDate } from '../utils/entryColorUtils';
import { useCalendar } from '../contexts/CalendarContext';
import { dateToCalendarDate } from '../utils/calendars/calendarConverter';
import { formatCalendarDate } from '../utils/calendars/calendarConverter';
import './CalendarView.css';

interface CalendarViewProps {
  selectedDate: Date;
  viewMode: TimeRange;
  onTimePeriodSelect: (date: Date, viewMode: TimeRange) => void;
}

export default function CalendarView({
  selectedDate,
  viewMode,
  onTimePeriodSelect,
}: CalendarViewProps) {
  const { calendar } = useCalendar();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEntries();
  }, [selectedDate, viewMode]);

  useEffect(() => {
    const handleEntrySaved = () => {
      loadEntries();
    };
    window.addEventListener('journalEntrySaved', handleEntrySaved);
    return () => {
      window.removeEventListener('journalEntrySaved', handleEntrySaved);
    };
  }, [selectedDate, viewMode]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      // Determine the date range we need to cover based on view mode
      // We need to load entries that could apply to ANY date visible in the current view
      let startDate: Date;
      let endDate: Date;
      
      switch (viewMode) {
        case 'decade':
          const decadeStart = Math.floor(selectedDate.getFullYear() / 10) * 10;
          startDate = new Date(decadeStart, 0, 1);
          endDate = new Date(decadeStart + 9, 11, 31);
          break;
        case 'year':
          startDate = new Date(selectedDate.getFullYear(), 0, 1);
          endDate = new Date(selectedDate.getFullYear(), 11, 31);
          break;
        case 'month':
          startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
          endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
          break;
        case 'week':
          startDate = getWeekStart(selectedDate);
          endDate = getWeekEnd(selectedDate);
          // For week view, we also need to load month entries that could apply
          // So expand the range to include the full month(s) that contain this week
          const weekStartMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
          const weekEndMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
          // Use the wider range to catch month entries
          if (weekStartMonth < startDate) startDate = weekStartMonth;
          if (weekEndMonth > endDate) endDate = weekEndMonth;
          break;
        case 'day':
          // For day view, load entries for the full month to catch month/week entries
          startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
          endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
          break;
        default:
          startDate = selectedDate;
          endDate = selectedDate;
      }
      
      // Load ALL entries in this date range using the database's getEntries function
      // This will get entries regardless of their timeRange, as long as their date falls in range
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }
      
      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CalendarView] Loading entries from ${startDateStr} to ${endDateStr} for ${viewMode} view`);
        console.log(`[CalendarView] Selected date: ${formatDate(selectedDate)}`);
      }
      
      const allEntries = await window.electronAPI.getEntries(startDateStr, endDateStr);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[CalendarView] Loaded ${allEntries.length} entries from database:`, allEntries.map(e => ({
          date: e.date,
          timeRange: e.timeRange,
          title: e.title
        })));
      }
      
      // Store all entries - the hasEntry function will check if each date falls within any entry's range
      setEntries(allEntries);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[CalendarView] Error loading entries:', error);
      }
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

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

  // Memoize hasEntry to avoid recalculating on every render
  // Create a memoized map of dates to boolean for quick lookup
  const entryDateMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (entries.length === 0) {
      return map;
    }
    
    // Pre-calculate which dates have entries
    // This is more efficient than checking on every render
    entries.forEach(entry => {
      const entryDate = parseISODate(entry.date);
      
      if (entry.timeRange === 'day') {
        map.set(entry.date, true);
      } else if (entry.timeRange === 'month') {
        // Mark all days in the month
        const year = entryDate.getFullYear();
        const month = entryDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const dateKey = formatDate(new Date(year, month, day));
          map.set(dateKey, true);
        }
      } else if (entry.timeRange === 'week') {
        // Mark all days in the week
        const weekStart = new Date(entryDate);
        const dayOfWeek = weekStart.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        weekStart.setDate(weekStart.getDate() - daysToMonday);
        weekStart.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < 7; i++) {
          const weekDay = new Date(weekStart);
          weekDay.setDate(weekStart.getDate() + i);
          const dateKey = formatDate(weekDay);
          map.set(dateKey, true);
        }
      } else if (entry.timeRange === 'year') {
        // Mark all days in the year (simplified - just mark year key)
        const year = entryDate.getFullYear();
        map.set(`year:${year}`, true);
      } else if (entry.timeRange === 'decade') {
        const decadeStart = Math.floor(entryDate.getFullYear() / 10) * 10;
        map.set(`decade:${decadeStart}`, true);
      }
    });
    
    return map;
  }, [entries]);

  // Memoized hasEntry function using the pre-calculated map
  const hasEntry = useCallback((date: Date): boolean => {
    if (entries.length === 0) {
      return false;
    }
    
    const dateStr = formatDate(date);
    
    // Check day entry
    if (entryDateMap.has(dateStr)) {
      return true;
    }
    
    // Check year entry
    const year = date.getFullYear();
    if (entryDateMap.has(`year:${year}`)) {
      return true;
    }
    
    // Check decade entry
    const decadeStart = Math.floor(year / 10) * 10;
    if (entryDateMap.has(`decade:${decadeStart}`)) {
      return true;
    }
    
    return false;
  }, [entries.length, entryDateMap]);

  const renderDecadeView = () => {
    const years = getYearsInDecade(selectedDate);
    return (
      <div className="calendar-grid decade-view">
        {years.map((year, idx) => {
          const yearGradientColor = getZodiacGradientColorForYear(year.getFullYear());
          const entryColor = hasEntry(year) ? getEntryColorForDate(entries, year, 'year') : null;
          return (
            <div
              key={idx}
              className={`calendar-cell year-cell ${isSelected(year) ? 'selected' : ''} ${hasEntry(year) ? 'has-entry' : ''}`}
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
                {hasEntry(year) && entryColor && (
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
          const monthMidpoint = new Date(month.getFullYear(), month.getMonth(), 15);
          const zodiacColor = getZodiacColor(monthMidpoint);
          const entryColor = hasEntry(month) ? getEntryColorForDate(entries, month, 'month') : null;
          return (
            <div
              key={idx}
              className={`calendar-cell month-cell ${isSelected(month) ? 'selected' : ''} ${hasEntry(month) ? 'has-entry' : ''}`}
              onClick={() => {
                playCalendarSelectionSound();
                onTimePeriodSelect(month, 'month');
              }}
              style={{ '--zodiac-color': zodiacColor } as React.CSSProperties}
            >
              <div className="cell-content">
                <div className="cell-label month-title">{monthNames[idx]}</div>
                {hasEntry(month) && entryColor && (
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
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    // Get first day of month and pad with empty cells
    const firstDay = days[0].getDay();
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Convert Sunday (0) to 6
    
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
            const entryColor = hasEntry(day) ? getEntryColorForDate(entries, day, 'day') : null;
            return (
              <div
                key={idx}
                className={`calendar-cell day-cell ${isToday(day) ? 'today' : ''} ${isSelected(day) ? 'selected' : ''} ${hasEntry(day) ? 'has-entry' : ''}`}
                onClick={() => {
                  playCalendarSelectionSound();
                  onTimePeriodSelect(day, 'day');
                }}
                style={{ '--zodiac-gradient': gradientColor } as React.CSSProperties}
              >
                <div className="cell-content">
                  <div className="cell-label">{day.getDate()}</div>
                  {hasEntry(day) && entryColor && (
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
      </div>
    );
  };

  const renderWeekView = () => {
    const days = getDaysInWeek(selectedDate);
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
            const entryColor = hasEntry(day) ? getEntryColorForDate(entries, day, 'day') : null;
            return (
              <div
                key={idx}
                className={`calendar-cell day-cell week-day-cell ${isToday(day) ? 'today' : ''} ${isSelected(day) ? 'selected' : ''} ${hasEntry(day) ? 'has-entry' : ''}`}
                onClick={() => {
                  playCalendarSelectionSound();
                  onTimePeriodSelect(day, 'day');
                }}
                style={{ '--zodiac-gradient': gradientColor } as React.CSSProperties}
              >
                <div className="cell-content">
                  {hasEntry(day) && entryColor && (
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

  if (loading) {
    return <div className="calendar-loading">Loading...</div>;
  }

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

