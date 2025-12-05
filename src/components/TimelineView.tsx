import { useState, useEffect } from 'react';
import { JournalEntry, TimeRange } from '../types';
import { formatDate, getDaysInMonth, getDaysInWeek, isToday, getWeekStart, getWeekEnd, getZodiacColor, getZodiacGradientColor, getZodiacGradientColorForYear, getZodiacColorForDecade, parseISODate } from '../utils/dateUtils';
import { isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { playCalendarSelectionSound, playEntrySelectionSound, playEditSound } from '../utils/audioUtils';
import { calculateEntryColor } from '../utils/entryColorUtils';
import { useCalendar } from '../contexts/CalendarContext';
import { dateToCalendarDate } from '../utils/calendars/calendarConverter';
import { formatCalendarDate } from '../utils/calendars/calendarConverter';
import './TimelineView.css';

interface TimelineViewProps {
  selectedDate: Date;
  viewMode: TimeRange;
  onTimePeriodSelect: (date: Date, viewMode: TimeRange) => void;
  onEntrySelect: (entry: JournalEntry) => void;
  onEditEntry?: (entry: JournalEntry) => void;
}

export default function TimelineView({
  selectedDate,
  viewMode,
  onTimePeriodSelect,
  onEntrySelect,
  onEditEntry,
}: TimelineViewProps) {
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
      // Load entries for all time ranges that could be relevant to the current view
      // This ensures we can show indicators for entries regardless of their timeRange
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
          // Expand to include full month(s) to catch month entries
          const weekStartMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
          const weekEndMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
          if (weekStartMonth < startDate) startDate = weekStartMonth;
          if (weekEndMonth > endDate) endDate = weekEndMonth;
          break;
        case 'day':
          // Load entries for the full month to catch month/week entries
          startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
          endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
          break;
        default:
          startDate = selectedDate;
          endDate = selectedDate;
      }
      
      // Load ALL entries in this date range using the database's getEntries function
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }
      
      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);
      
      console.log(`[TimelineView] Loading entries from ${startDateStr} to ${endDateStr} for ${viewMode} view`);
      
      const allEntries = await window.electronAPI.getEntries(startDateStr, endDateStr);
      
      console.log(`[TimelineView] Loaded ${allEntries.length} entries:`, allEntries.map(e => ({
        date: e.date,
        timeRange: e.timeRange,
        title: e.title
      })));
      
      setEntries(allEntries);
    } catch (error) {
      console.error('[TimelineView] Error loading entries:', error);
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

  const getEntriesForDate = (date: Date, forViewMode?: TimeRange): JournalEntry[] => {
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
  };

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
      const entryDay = entryDate.getDate();
      
      // Check if entry falls within this month
      if (entry.timeRange === 'day') {
        return entryYear === year && entryMonth === month;
      } else if (entry.timeRange === 'week') {
        // Check if week overlaps with this month
        const weekStart = getWeekStart(entryDate);
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
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const firstDay = days[0].getDay();
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    
    // Get week entries for the month and group them by week
    const weekEntriesByWeek = new Map<string, JournalEntry[]>();
    entries.forEach(entry => {
      if (entry.timeRange === 'week') {
        // Parse entry date to get the week start
        const entryDate = parseISODate(entry.date);
        const weekStart = getWeekStart(entryDate);
        const weekKey = formatDate(weekStart);
        
        // Check if this week is within the current month
        const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
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
      const weekStart = getWeekStart(day);
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
          
          {weeksInMonth.length > 0 && (
            <div className="month-week-entries-section">
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
                                <span className="week-entry-title">{entry.title}</span>
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
            </div>
          )}
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
          {weekDays.map((day, idx) => {
            const dayDate = days[idx];
            const gradientColor = getZodiacGradientColor(dayDate);
            return (
              <div 
                key={day} 
                className="weekday-cell"
                style={{ '--zodiac-gradient': gradientColor } as React.CSSProperties}
              >
                <div>{day}</div>
                <div className="day-number">{dayDate.getDate()}</div>
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

  const renderDayView = () => {
    const dayEntries = getEntriesForDate(selectedDate);
    
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
        </div>
        <div className="day-entries-list">
          {dayEntries.length === 0 ? (
            <div className="no-entries-message">
              <p>No entries for this day.</p>
              <p className="hint">Click on a date in month or week view to see entries, or create a new one.</p>
            </div>
          ) : (
            dayEntries.map((entry, idx) => {
              const entryColor = calculateEntryColor(entry);
              return (
                <div
                  key={idx}
                  className={`entry-card-full entry-${entry.timeRange}`}
                  onClick={() => {
                    playEntrySelectionSound();
                    onEntrySelect(entry);
                  }}
                  style={{ borderLeftColor: entryColor }}
                >
                <div className="card-header">
                  <div className="card-title-full">{entry.title}</div>
                  <div className="card-meta">
                    {onEditEntry && (
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
                    <span className="card-date">{formatDate(parseISODate(entry.date), 'MMM d')}</span>
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

