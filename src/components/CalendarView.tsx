import { useState, useEffect } from 'react';
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
} from '../utils/dateUtils';
import { isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { JournalEntry } from '../types';
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
      
      console.log(`[CalendarView] Loading entries from ${startDateStr} to ${endDateStr} for ${viewMode} view`);
      console.log(`[CalendarView] Selected date: ${formatDate(selectedDate)}`);
      
      const allEntries = await window.electronAPI.getEntries(startDateStr, endDateStr);
      
      console.log(`[CalendarView] Loaded ${allEntries.length} entries from database:`, allEntries.map(e => ({
        date: e.date,
        timeRange: e.timeRange,
        title: e.title
      })));
      
      // Store all entries - the hasEntry function will check if each date falls within any entry's range
      setEntries(allEntries);
    } catch (error) {
      console.error('[CalendarView] Error loading entries:', error);
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

  // Check if a date falls within any entry's time range
  // Similar to TimelineView's getEntriesForDate logic
  const hasEntry = (date: Date): boolean => {
    if (entries.length === 0) {
      return false;
    }
    
    const dateStr = formatDate(date);
    const result = entries.some(entry => {
      const entryDate = new Date(entry.date);
      
      // Check if date falls within entry's time range
      if (entry.timeRange === 'day') {
        const matches = entry.date === dateStr;
        if (matches) {
          console.log(`[hasEntry] Day entry matches: ${dateStr} === ${entry.date}`);
        }
        return matches;
      } else if (entry.timeRange === 'month') {
        // For month entries, check if the date is in the same year and month
        const matches = entryDate.getFullYear() === date.getFullYear() && 
               entryDate.getMonth() === date.getMonth();
        if (matches) {
          console.log(`[hasEntry] Month entry matches: ${dateStr} is in ${entryDate.getFullYear()}-${entryDate.getMonth()}`);
        }
        return matches;
      } else if (entry.timeRange === 'week') {
        // Calculate week start (Monday) for the entry
        const weekStart = new Date(entryDate);
        const dayOfWeek = weekStart.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        weekStart.setDate(weekStart.getDate() - daysToMonday);
        weekStart.setHours(0, 0, 0, 0);
        
        // Calculate week end (Sunday)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        const checkDate = new Date(date);
        checkDate.setHours(12, 0, 0, 0);
        const matches = checkDate >= weekStart && checkDate <= weekEnd;
        if (matches) {
          console.log(`[hasEntry] Week entry matches: ${dateStr} is in week starting ${formatDate(weekStart)}`);
        }
        return matches;
      } else if (entry.timeRange === 'year') {
        const matches = entryDate.getFullYear() === date.getFullYear();
        if (matches) {
          console.log(`[hasEntry] Year entry matches: ${dateStr} is in year ${entryDate.getFullYear()}`);
        }
        return matches;
      } else if (entry.timeRange === 'decade') {
        const decadeStart = Math.floor(entryDate.getFullYear() / 10) * 10;
        const dateDecade = Math.floor(date.getFullYear() / 10) * 10;
        const matches = decadeStart === dateDecade;
        if (matches) {
          console.log(`[hasEntry] Decade entry matches: ${dateStr} is in decade ${decadeStart}s`);
        }
        return matches;
      }
      return false;
    });
    
    if (result) {
      console.log(`[hasEntry] Found entry for date ${dateStr}`);
    }
    return result;
  };

  const renderDecadeView = () => {
    const years = getYearsInDecade(selectedDate);
    return (
      <div className="calendar-grid decade-view">
        {years.map((year, idx) => {
          const yearGradientColor = getZodiacGradientColorForYear(year.getFullYear());
          return (
            <div
              key={idx}
              className={`calendar-cell year-cell ${isSelected(year) ? 'selected' : ''} ${hasEntry(year) ? 'has-entry' : ''}`}
              onClick={() => onTimePeriodSelect(year, 'year')}
              style={{ '--zodiac-gradient': yearGradientColor } as React.CSSProperties}
            >
              <div className="cell-content">
                <div className="cell-label" style={{ color: yearGradientColor }}>
                  {year.getFullYear()}
                </div>
                {hasEntry(year) && <div className="entry-indicator"></div>}
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
          return (
            <div
              key={idx}
              className={`calendar-cell month-cell ${isSelected(month) ? 'selected' : ''} ${hasEntry(month) ? 'has-entry' : ''}`}
              onClick={() => onTimePeriodSelect(month, 'month')}
              style={{ '--zodiac-color': zodiacColor } as React.CSSProperties}
            >
              <div className="cell-content">
                <div className="cell-label month-title">{monthNames[idx]}</div>
                {hasEntry(month) && <div className="entry-indicator"></div>}
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
            return (
              <div
                key={idx}
                className={`calendar-cell day-cell ${isToday(day) ? 'today' : ''} ${isSelected(day) ? 'selected' : ''} ${hasEntry(day) ? 'has-entry' : ''}`}
                onClick={() => onTimePeriodSelect(day, 'day')}
                style={{ '--zodiac-gradient': gradientColor } as React.CSSProperties}
              >
                <div className="cell-content">
                  <div className="cell-label">{day.getDate()}</div>
                  {hasEntry(day) && <div className="entry-indicator"></div>}
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
    
    return (
      <div className="calendar-week-view">
        <div className="weekday-header">
          {weekDays.map((day, idx) => (
            <div key={day} className="weekday-cell">
              <div>{day}</div>
              <div className="day-number">{days[idx].getDate()}</div>
            </div>
          ))}
        </div>
        <div className="calendar-grid week-view">
          {days.map((day, idx) => {
            const gradientColor = getZodiacGradientColor(day);
            return (
              <div
                key={idx}
                className={`calendar-cell day-cell week-day-cell ${isToday(day) ? 'today' : ''} ${isSelected(day) ? 'selected' : ''} ${hasEntry(day) ? 'has-entry' : ''}`}
                onClick={() => onTimePeriodSelect(day, 'day')}
                style={{ '--zodiac-gradient': gradientColor } as React.CSSProperties}
              >
                <div className="cell-content">
                  {hasEntry(day) && <div className="entry-indicator"></div>}
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
            <div className="cell-label large">{formatDate(selectedDate, 'EEEE, MMMM d, yyyy')}</div>
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

