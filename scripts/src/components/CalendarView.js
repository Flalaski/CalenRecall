"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CalendarView;
const react_1 = require("react");
const dateUtils_1 = require("../utils/dateUtils");
const date_fns_1 = require("date-fns");
const audioUtils_1 = require("../utils/audioUtils");
const entryColorUtils_1 = require("../utils/entryColorUtils");
const CalendarContext_1 = require("../contexts/CalendarContext");
const calendarConverter_1 = require("../utils/calendars/calendarConverter");
const calendarConverter_2 = require("../utils/calendars/calendarConverter");
require("./CalendarView.css");
function CalendarView({ selectedDate, viewMode, onTimePeriodSelect, }) {
    const { calendar } = (0, CalendarContext_1.useCalendar)();
    const [entries, setEntries] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        loadEntries();
    }, [selectedDate, viewMode]);
    (0, react_1.useEffect)(() => {
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
            let startDate;
            let endDate;
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
                    startDate = (0, dateUtils_1.getWeekStart)(selectedDate);
                    endDate = (0, dateUtils_1.getWeekEnd)(selectedDate);
                    // For week view, we also need to load month entries that could apply
                    // So expand the range to include the full month(s) that contain this week
                    const weekStartMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                    const weekEndMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
                    // Use the wider range to catch month entries
                    if (weekStartMonth < startDate)
                        startDate = weekStartMonth;
                    if (weekEndMonth > endDate)
                        endDate = weekEndMonth;
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
            const startDateStr = (0, dateUtils_1.formatDate)(startDate);
            const endDateStr = (0, dateUtils_1.formatDate)(endDate);
            console.log(`[CalendarView] Loading entries from ${startDateStr} to ${endDateStr} for ${viewMode} view`);
            console.log(`[CalendarView] Selected date: ${(0, dateUtils_1.formatDate)(selectedDate)}`);
            const allEntries = await window.electronAPI.getEntries(startDateStr, endDateStr);
            console.log(`[CalendarView] Loaded ${allEntries.length} entries from database:`, allEntries.map(e => ({
                date: e.date,
                timeRange: e.timeRange,
                title: e.title
            })));
            // Store all entries - the hasEntry function will check if each date falls within any entry's range
            setEntries(allEntries);
        }
        catch (error) {
            console.error('[CalendarView] Error loading entries:', error);
            setEntries([]);
        }
        finally {
            setLoading(false);
        }
    };
    // Check if a date is the currently selected date (at appropriate granularity)
    const isSelected = (date) => {
        switch (viewMode) {
            case 'day':
            case 'week':
            case 'month':
                // For day/week/month views, compare at day level
                return (0, date_fns_1.isSameDay)(date, selectedDate);
            case 'year':
                // For year view, compare at month level
                return (0, date_fns_1.isSameMonth)(date, selectedDate) && (0, date_fns_1.isSameYear)(date, selectedDate);
            case 'decade':
                // For decade view, compare at year level
                return (0, date_fns_1.isSameYear)(date, selectedDate);
            default:
                return false;
        }
    };
    // Check if a date falls within any entry's time range
    // Similar to TimelineView's getEntriesForDate logic
    const hasEntry = (date) => {
        if (entries.length === 0) {
            return false;
        }
        const dateStr = (0, dateUtils_1.formatDate)(date);
        const result = entries.some(entry => {
            const entryDate = (0, dateUtils_1.parseISODate)(entry.date);
            // Check if date falls within entry's time range
            if (entry.timeRange === 'day') {
                const matches = entry.date === dateStr;
                if (matches) {
                    console.log(`[hasEntry] Day entry matches: ${dateStr} === ${entry.date}`);
                }
                return matches;
            }
            else if (entry.timeRange === 'month') {
                // For month entries, check if the date is in the same year and month
                const matches = entryDate.getFullYear() === date.getFullYear() &&
                    entryDate.getMonth() === date.getMonth();
                if (matches) {
                    console.log(`[hasEntry] Month entry matches: ${dateStr} is in ${entryDate.getFullYear()}-${entryDate.getMonth()}`);
                }
                return matches;
            }
            else if (entry.timeRange === 'week') {
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
                    console.log(`[hasEntry] Week entry matches: ${dateStr} is in week starting ${(0, dateUtils_1.formatDate)(weekStart)}`);
                }
                return matches;
            }
            else if (entry.timeRange === 'year') {
                const matches = entryDate.getFullYear() === date.getFullYear();
                if (matches) {
                    console.log(`[hasEntry] Year entry matches: ${dateStr} is in year ${entryDate.getFullYear()}`);
                }
                return matches;
            }
            else if (entry.timeRange === 'decade') {
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
        const years = (0, dateUtils_1.getYearsInDecade)(selectedDate);
        return (<div className="calendar-grid decade-view">
        {years.map((year, idx) => {
                const yearGradientColor = (0, dateUtils_1.getZodiacGradientColorForYear)(year.getFullYear());
                const entryColor = hasEntry(year) ? (0, entryColorUtils_1.getEntryColorForDate)(entries, year, 'year') : null;
                return (<div key={idx} className={`calendar-cell year-cell ${isSelected(year) ? 'selected' : ''} ${hasEntry(year) ? 'has-entry' : ''}`} onClick={() => {
                        (0, audioUtils_1.playCalendarSelectionSound)();
                        onTimePeriodSelect(year, 'year');
                    }} style={{ '--zodiac-gradient': yearGradientColor }}>
              <div className="cell-content">
                <div className="cell-label" style={{ color: yearGradientColor }}>
                  {(() => {
                        try {
                            const calDate = (0, calendarConverter_1.dateToCalendarDate)(year, calendar);
                            return `${calDate.year}${calDate.era ? ' ' + calDate.era : ''}`;
                        }
                        catch (e) {
                            return year.getFullYear();
                        }
                    })()}
                </div>
                {hasEntry(year) && entryColor && (<div className="entry-indicator" style={{ backgroundColor: entryColor }}></div>)}
              </div>
            </div>);
            })}
      </div>);
    };
    const renderYearView = () => {
        const months = (0, dateUtils_1.getMonthsInYear)(selectedDate);
        const monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        return (<div className="calendar-grid year-view">
        {months.map((month, idx) => {
                // Use the 15th of each month as representative for the zodiac color
                const monthMidpoint = new Date(month.getFullYear(), month.getMonth(), 15);
                const zodiacColor = (0, dateUtils_1.getZodiacColor)(monthMidpoint);
                const entryColor = hasEntry(month) ? (0, entryColorUtils_1.getEntryColorForDate)(entries, month, 'month') : null;
                return (<div key={idx} className={`calendar-cell month-cell ${isSelected(month) ? 'selected' : ''} ${hasEntry(month) ? 'has-entry' : ''}`} onClick={() => {
                        (0, audioUtils_1.playCalendarSelectionSound)();
                        onTimePeriodSelect(month, 'month');
                    }} style={{ '--zodiac-color': zodiacColor }}>
              <div className="cell-content">
                <div className="cell-label month-title">{monthNames[idx]}</div>
                {hasEntry(month) && entryColor && (<div className="entry-indicator" style={{ backgroundColor: entryColor }}></div>)}
              </div>
            </div>);
            })}
      </div>);
    };
    const renderMonthView = () => {
        const days = (0, dateUtils_1.getDaysInMonth)(selectedDate);
        const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        // Get first day of month and pad with empty cells
        const firstDay = days[0].getDay();
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Convert Sunday (0) to 6
        return (<div className="calendar-month-view">
        <div className="weekday-header">
          {weekDays.map(day => (<div key={day} className="weekday-cell">{day}</div>))}
        </div>
        <div className="calendar-grid month-view">
          {Array(adjustedFirstDay).fill(null).map((_, idx) => (<div key={`empty-${idx}`} className="calendar-cell empty-cell"></div>))}
          {days.map((day, idx) => {
                const gradientColor = (0, dateUtils_1.getZodiacGradientColor)(day);
                const entryColor = hasEntry(day) ? (0, entryColorUtils_1.getEntryColorForDate)(entries, day, 'day') : null;
                return (<div key={idx} className={`calendar-cell day-cell ${(0, dateUtils_1.isToday)(day) ? 'today' : ''} ${isSelected(day) ? 'selected' : ''} ${hasEntry(day) ? 'has-entry' : ''}`} onClick={() => {
                        (0, audioUtils_1.playCalendarSelectionSound)();
                        onTimePeriodSelect(day, 'day');
                    }} style={{ '--zodiac-gradient': gradientColor }}>
                <div className="cell-content">
                  <div className="cell-label">{day.getDate()}</div>
                  {hasEntry(day) && entryColor && (<div className="entry-indicator" style={{ backgroundColor: entryColor }}></div>)}
                </div>
              </div>);
            })}
        </div>
      </div>);
    };
    const renderWeekView = () => {
        const days = (0, dateUtils_1.getDaysInWeek)(selectedDate);
        const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        return (<div className="calendar-week-view">
        <div className="weekday-header">
          {weekDays.map((day, idx) => (<div key={day} className="weekday-cell">
              <div>{day}</div>
              <div className="day-number">{days[idx].getDate()}</div>
            </div>))}
        </div>
        <div className="calendar-grid week-view">
          {days.map((day, idx) => {
                const gradientColor = (0, dateUtils_1.getZodiacGradientColor)(day);
                const entryColor = hasEntry(day) ? (0, entryColorUtils_1.getEntryColorForDate)(entries, day, 'day') : null;
                return (<div key={idx} className={`calendar-cell day-cell week-day-cell ${(0, dateUtils_1.isToday)(day) ? 'today' : ''} ${isSelected(day) ? 'selected' : ''} ${hasEntry(day) ? 'has-entry' : ''}`} onClick={() => {
                        (0, audioUtils_1.playCalendarSelectionSound)();
                        onTimePeriodSelect(day, 'day');
                    }} style={{ '--zodiac-gradient': gradientColor }}>
                <div className="cell-content">
                  {hasEntry(day) && entryColor && (<div className="entry-indicator" style={{ backgroundColor: entryColor }}></div>)}
                </div>
              </div>);
            })}
        </div>
      </div>);
    };
    const renderDayView = () => {
        return (<div className="calendar-day-view">
        <div className={`calendar-cell day-cell single-day ${(0, dateUtils_1.isToday)(selectedDate) ? 'today' : ''} ${isSelected(selectedDate) ? 'selected' : ''} ${hasEntry(selectedDate) ? 'has-entry' : ''}`}>
          <div className="cell-content">
            <div className="cell-label large">
              {(() => {
                try {
                    return (0, calendarConverter_2.formatCalendarDate)((0, calendarConverter_1.dateToCalendarDate)(selectedDate, calendar), 'EEEE, MMMM D, YYYY');
                }
                catch (e) {
                    return (0, dateUtils_1.formatDate)(selectedDate, 'EEEE, MMMM d, yyyy');
                }
            })()}
            </div>
            {hasEntry(selectedDate) && <div className="entry-indicator"></div>}
          </div>
        </div>
      </div>);
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
