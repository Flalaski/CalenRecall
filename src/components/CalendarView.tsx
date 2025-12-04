import { useState, useEffect } from 'react';
import { TimeRange } from '../types';
import {
  getDaysInMonth,
  getDaysInWeek,
  getMonthsInYear,
  getYearsInDecade,
  formatDate,
  isToday,
  getCanonicalDate,
} from '../utils/dateUtils';
import { getEntriesForRange } from '../services/journalService';
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
      const loadedEntries = await getEntriesForRange(viewMode, selectedDate);
      setEntries(loadedEntries);
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasEntry = (date: Date): boolean => {
    const dateStr = formatDate(date);
    // Check if there's any entry that matches this date
    // For day view, check if the entry date matches
    // For other views, check if the entry's canonical date matches the cell's canonical date
    return entries.some(entry => {
      if (viewMode === 'day') {
        // For day view, check if entry date matches
        return entry.date === dateStr;
      } else {
        // For other views, check if entry's canonical date matches the cell's canonical date
        const cellCanonicalDate = getCanonicalDate(date, viewMode);
        const cellCanonicalDateStr = formatDate(cellCanonicalDate);
        const entryCanonicalDate = getCanonicalDate(new Date(entry.date), entry.timeRange);
        const entryCanonicalDateStr = formatDate(entryCanonicalDate);
        return entryCanonicalDateStr === cellCanonicalDateStr && entry.timeRange === viewMode;
      }
    });
  };

  const renderDecadeView = () => {
    const years = getYearsInDecade(selectedDate);
    return (
      <div className="calendar-grid decade-view">
        {years.map((year, idx) => (
          <div
            key={idx}
            className={`calendar-cell year-cell ${hasEntry(year) ? 'has-entry' : ''}`}
            onClick={() => onTimePeriodSelect(year, 'year')}
          >
            <div className="cell-content">
              <div className="cell-label">{year.getFullYear()}</div>
            </div>
          </div>
        ))}
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
        {months.map((month, idx) => (
          <div
            key={idx}
            className={`calendar-cell month-cell ${hasEntry(month) ? 'has-entry' : ''}`}
            onClick={() => onTimePeriodSelect(month, 'month')}
          >
            <div className="cell-content">
              <div className="cell-label">{monthNames[idx]}</div>
            </div>
          </div>
        ))}
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
          {days.map((day, idx) => (
            <div
              key={idx}
              className={`calendar-cell day-cell ${isToday(day) ? 'today' : ''} ${hasEntry(day) ? 'has-entry' : ''}`}
              onClick={() => onTimePeriodSelect(day, 'day')}
            >
              <div className="cell-content">
                <div className="cell-label">{day.getDate()}</div>
                {hasEntry(day) && <div className="entry-indicator"></div>}
              </div>
            </div>
          ))}
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
          {days.map((day, idx) => (
            <div
              key={idx}
              className={`calendar-cell day-cell week-day-cell ${isToday(day) ? 'today' : ''} ${hasEntry(day) ? 'has-entry' : ''}`}
              onClick={() => onTimePeriodSelect(day, 'day')}
            >
              <div className="cell-content">
                {hasEntry(day) && <div className="entry-indicator"></div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    return (
      <div className="calendar-day-view">
        <div
          className={`calendar-cell day-cell single-day ${isToday(selectedDate) ? 'today' : ''} ${hasEntry(selectedDate) ? 'has-entry' : ''}`}
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

