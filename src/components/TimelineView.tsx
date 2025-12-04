import { useState, useEffect } from 'react';
import { JournalEntry, TimeRange } from '../types';
import { getEntriesForRange } from '../services/journalService';
import { formatDate, getDaysInMonth, getDaysInWeek, isToday } from '../utils/dateUtils';
import './TimelineView.css';

interface TimelineViewProps {
  selectedDate: Date;
  viewMode: TimeRange;
  onTimePeriodSelect: (date: Date, viewMode: TimeRange) => void;
  onEntrySelect: (entry: JournalEntry) => void;
}

export default function TimelineView({
  selectedDate,
  viewMode,
  onTimePeriodSelect,
  onEntrySelect,
}: TimelineViewProps) {
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

  const getEntriesForDate = (date: Date): JournalEntry[] => {
    const dateStr = formatDate(date);
    return entries.filter(entry => {
      const entryDate = new Date(entry.date);
      // Match exact date or check if date falls within entry's time range
      if (entry.timeRange === 'day') {
        return entry.date === dateStr;
      } else if (entry.timeRange === 'month') {
        return entryDate.getFullYear() === date.getFullYear() && 
               entryDate.getMonth() === date.getMonth();
      } else if (entry.timeRange === 'week') {
        const weekStart = new Date(entryDate);
        const dayOfWeek = weekStart.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        weekStart.setDate(weekStart.getDate() - daysToMonday);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return date >= weekStart && date <= weekEnd;
      } else if (entry.timeRange === 'year') {
        return entryDate.getFullYear() === date.getFullYear();
      } else if (entry.timeRange === 'decade') {
        const decadeStart = Math.floor(entryDate.getFullYear() / 10) * 10;
        const dateDecade = Math.floor(date.getFullYear() / 10) * 10;
        return decadeStart === dateDecade;
      }
      return false;
    });
  };

  const renderMonthView = () => {
    const days = getDaysInMonth(selectedDate);
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const firstDay = days[0].getDay();
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    
    return (
      <div className="timeline-month-view">
        <div className="weekday-header">
          {weekDays.map(day => (
            <div key={day} className="weekday-cell">{day}</div>
          ))}
        </div>
        <div className="timeline-grid month-grid">
          {Array(adjustedFirstDay).fill(null).map((_, idx) => (
            <div key={`empty-${idx}`} className="timeline-cell empty-cell"></div>
          ))}
          {days.map((day, idx) => {
            const dayEntries = getEntriesForDate(day);
            return (
              <div
                key={idx}
                className={`timeline-cell day-cell ${isToday(day) ? 'today' : ''} ${dayEntries.length > 0 ? 'has-entries' : ''}`}
                onClick={() => onTimePeriodSelect(day, 'day')}
              >
                <div className="cell-date">{day.getDate()}</div>
                <div className="cell-entries">
                  {dayEntries.slice(0, 3).map((entry, eIdx) => (
                    <div
                      key={eIdx}
                      className={`entry-badge entry-${entry.timeRange}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEntrySelect(entry);
                      }}
                      title={entry.title}
                    >
                      <span className="badge-title">{entry.title.substring(0, 8)}</span>
                      {entry.tags && entry.tags.length > 0 && (
                        <span className="badge-tag-count">{entry.tags.length}</span>
                      )}
                    </div>
                  ))}
                  {dayEntries.length > 3 && (
                    <div className="entry-badge more-entries">+{dayEntries.length - 3}</div>
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
    
    return (
      <div className="timeline-week-view">
        <div className="weekday-header">
          {weekDays.map((day, idx) => (
            <div key={day} className="weekday-cell">
              <div>{day}</div>
              <div className="day-number">{days[idx].getDate()}</div>
            </div>
          ))}
        </div>
        <div className="timeline-grid week-grid">
          {days.map((day, idx) => {
            const dayEntries = getEntriesForDate(day);
            return (
              <div
                key={idx}
                className={`timeline-cell day-cell week-day-cell ${isToday(day) ? 'today' : ''} ${dayEntries.length > 0 ? 'has-entries' : ''}`}
                onClick={() => onTimePeriodSelect(day, 'day')}
              >
                <div className="cell-entries-vertical">
                  {dayEntries.map((entry, eIdx) => (
                    <div
                      key={eIdx}
                      className={`entry-card entry-${entry.timeRange}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEntrySelect(entry);
                      }}
                    >
                      <div className="card-title">{entry.title}</div>
                      <div className="card-preview">{entry.content.substring(0, 50)}...</div>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="card-tags">
                          {entry.tags.slice(0, 2).map((tag, tIdx) => (
                            <span key={tIdx} className="card-tag">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayEntries = getEntriesForDate(selectedDate);
    
    return (
      <div className="timeline-day-view">
        <div className="day-header">
          <h2>{formatDate(selectedDate, 'EEEE, MMMM d, yyyy')}</h2>
        </div>
        <div className="day-entries-list">
          {dayEntries.length === 0 ? (
            <div className="no-entries-message">
              <p>No entries for this day.</p>
              <p className="hint">Click on a date in month or week view to see entries, or create a new one.</p>
            </div>
          ) : (
            dayEntries.map((entry, idx) => (
              <div
                key={idx}
                className={`entry-card-full entry-${entry.timeRange}`}
                onClick={() => onEntrySelect(entry)}
              >
                <div className="card-header">
                  <div className="card-title-full">{entry.title}</div>
                  <div className="card-meta">
                    <span className="time-range-badge">{entry.timeRange}</span>
                    <span className="card-date">{formatDate(new Date(entry.date), 'MMM d')}</span>
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
            ))
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
            const monthEntries = getEntriesForDate(month);
            return (
              <div
                key={idx}
                className={`timeline-cell month-cell ${monthEntries.length > 0 ? 'has-entries' : ''}`}
                onClick={() => onTimePeriodSelect(month, 'month')}
              >
                <div className="cell-month-label">{formatDate(month, 'MMM')}</div>
                <div className="cell-entries">
                  {monthEntries.slice(0, 2).map((entry, eIdx) => (
                    <div
                      key={eIdx}
                      className={`entry-badge entry-${entry.timeRange}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEntrySelect(entry);
                      }}
                      title={entry.title}
                    >
                      <span className="badge-title">{entry.title.substring(0, 10)}</span>
                    </div>
                  ))}
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
            const yearEntries = getEntriesForDate(year);
            return (
              <div
                key={idx}
                className={`timeline-cell year-cell ${yearEntries.length > 0 ? 'has-entries' : ''}`}
                onClick={() => onTimePeriodSelect(year, 'year')}
              >
                <div className="cell-year-label">{year.getFullYear()}</div>
                <div className="cell-entries">
                  {yearEntries.slice(0, 1).map((entry, eIdx) => (
                    <div
                      key={eIdx}
                      className={`entry-badge entry-${entry.timeRange}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEntrySelect(entry);
                      }}
                      title={entry.title}
                    >
                      <span className="badge-title">{entry.title.substring(0, 12)}</span>
                    </div>
                  ))}
                  {yearEntries.length > 1 && (
                    <div className="entry-badge more-entries">+{yearEntries.length - 1}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="timeline-loading">Loading...</div>;
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

