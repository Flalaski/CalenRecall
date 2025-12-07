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
  createDate,
  getMonthStart,
  getMonthEnd,
} from '../utils/dateUtils';
import { isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { JournalEntry } from '../types';
import { playCalendarSelectionSound } from '../utils/audioUtils';
import { getEntryColorForDate } from '../utils/entryColorUtils';
import { useCalendar } from '../contexts/CalendarContext';
import { useEntries } from '../contexts/EntriesContext';
import { dateToCalendarDate } from '../utils/calendars/calendarConverter';
import { formatCalendarDate } from '../utils/calendars/calendarConverter';
import { filterEntriesByDateRange, hasEntryForDate } from '../utils/entryFilterUtils';
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
  const { entries: allEntries } = useEntries();

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
        startDate = getMonthStart(selectedDate);
        endDate = getMonthEnd(selectedDate);
        break;
      }
      case 'week': {
        startDate = getWeekStart(selectedDate);
        endDate = getWeekEnd(selectedDate);
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
    
    return filterEntriesByDateRange(allEntries, startDate, endDate);
  }, [allEntries, selectedDate, viewMode]);

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

  // OPTIMIZATION: Use optimized hasEntryForDate utility
  const hasEntry = useCallback((date: Date): boolean => {
    return hasEntryForDate(entries, date);
  }, [entries]);

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
          const monthMidpoint = createDate(month.getFullYear(), month.getMonth(), 15);
          const zodiacColor = getZodiacColor(monthMidpoint);
          const entryColor = hasEntry(month) ? getEntryColorForDate(entries, month, 'month') : null;
          
          // Get number of days in this month
          const daysInMonth = getDaysInMonth(month).length;
          
          // Count entries for this month (including day, week, and month entries)
          const monthStart = getMonthStart(month);
          const monthEnd = getMonthEnd(month);
          monthEnd.setHours(23, 59, 59, 999);
          const monthEntries = entries.filter(entry => {
            try {
              const entryDate = parseISODate(entry.date);
              return entryDate >= monthStart && entryDate <= monthEnd;
            } catch {
              return false;
            }
          });
          const entryCount = monthEntries.length;
          
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
                <div className="month-details">
                  <div className="month-days">{daysInMonth} days</div>
                  {entryCount > 0 && (
                    <div className="month-entry-count">{entryCount} {entryCount === 1 ? 'entry' : 'entries'}</div>
                  )}
                </div>
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

