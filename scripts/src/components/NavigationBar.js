"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = NavigationBar;
const react_1 = require("react");
const date_fns_1 = require("date-fns");
const audioUtils_1 = require("../utils/audioUtils");
const CalendarContext_1 = require("../contexts/CalendarContext");
const types_1 = require("../utils/calendars/types");
const timeRangeConverter_1 = require("../utils/calendars/timeRangeConverter");
const calendarDescriptions_1 = require("../utils/calendars/calendarDescriptions");
require("./NavigationBar.css");
function NavigationBar({ viewMode, onViewModeChange, selectedDate, onDateChange, onOpenPreferences, }) {
    const { calendar, setCalendar } = (0, CalendarContext_1.useCalendar)();
    // Use ref to access current onDateChange in keyboard handler
    const onDateChangeRef = (0, react_1.useRef)(onDateChange);
    // Keep ref updated
    (0, react_1.useEffect)(() => {
        onDateChangeRef.current = onDateChange;
    }, [onDateChange]);
    const navigate = (direction) => {
        (0, audioUtils_1.playNavigationSound)();
        let newDate;
        const multiplier = direction === 'next' ? 1 : -1;
        switch (viewMode) {
            case 'decade':
                newDate = (0, date_fns_1.addYears)(selectedDate, multiplier * 10);
                break;
            case 'year':
                newDate = (0, date_fns_1.addYears)(selectedDate, multiplier);
                break;
            case 'month':
                newDate = (0, date_fns_1.addMonths)(selectedDate, multiplier);
                break;
            case 'week':
                newDate = (0, date_fns_1.addWeeks)(selectedDate, multiplier);
                break;
            case 'day':
                newDate = (0, date_fns_1.addDays)(selectedDate, multiplier);
                break;
            default:
                newDate = selectedDate;
        }
        onDateChange(newDate);
    };
    const getDateLabel = () => {
        // Use calendar-aware formatting
        try {
            return (0, timeRangeConverter_1.getTimeRangeLabelInCalendar)(selectedDate, viewMode, calendar);
        }
        catch (e) {
            console.error('Error formatting date in calendar:', e);
            // Fallback to Gregorian formatting if calendar conversion fails
            switch (viewMode) {
                case 'decade':
                    const decadeStart = Math.floor(selectedDate.getFullYear() / 10) * 10;
                    return `${decadeStart}s`;
                case 'year':
                    return (0, date_fns_1.format)(selectedDate, 'yyyy');
                case 'month':
                    return (0, date_fns_1.format)(selectedDate, 'MMMM yyyy');
                case 'week':
                    return `Week of ${(0, date_fns_1.format)(selectedDate, 'MMM d, yyyy')}`;
                case 'day':
                    return (0, date_fns_1.format)(selectedDate, 'EEEE, MMMM d, yyyy');
                default:
                    return (0, date_fns_1.format)(selectedDate, 'MMMM yyyy');
            }
        }
    };
    const goToToday = () => {
        (0, audioUtils_1.playNavigationSound)();
        onDateChange(new Date());
    };
    // Handle keyboard shortcut for Today button (T key)
    (0, react_1.useEffect)(() => {
        const handleKeyDown = (e) => {
            // Don't handle keys if user is typing in an input, textarea, or contenteditable element
            const target = e.target;
            if (target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable ||
                (target.closest('input') || target.closest('textarea') || target.closest('[contenteditable="true"]'))) {
                return;
            }
            // Only handle T key (case-insensitive)
            if (e.key.toLowerCase() !== 't') {
                return;
            }
            // Prevent default behavior
            e.preventDefault();
            // Trigger Today button - use ref to get current onDateChange
            (0, audioUtils_1.playNavigationSound)();
            onDateChangeRef.current(new Date());
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []); // Empty deps - we use ref to access current values
    return (<div className="navigation-bar">
      <div className="navigation-bar-top-row">
        <div className="nav-controls">
          <img src="/icon.png" alt="CalenRecall" className="app-icon" style={{ width: '32px', height: '32px', marginRight: '0.5rem' }}/>
          <button className="nav-button" onClick={() => navigate('prev')}>
            ←
          </button>
          <button className="nav-button today-button" onClick={goToToday}>
            Today
          </button>
          <button className="nav-button" onClick={() => navigate('next')}>
            →
          </button>
          <h2 className={`date-label date-label-${viewMode}`}>{getDateLabel()}</h2>
          <div className="calendar-selector">
            <select value={calendar} onChange={(e) => {
            (0, audioUtils_1.playModeSelectionSound)();
            setCalendar(e.target.value);
        }} className="calendar-select" title="Select calendar system">
              {Object.entries(types_1.CALENDAR_INFO)
            .filter(([key]) => ['gregorian', 'julian', 'islamic', 'hebrew', 'persian', 'ethiopian', 'coptic', 'indian-saka', 'cherokee', 'iroquois', 'thai-buddhist', 'bahai', 'mayan-tzolkin', 'mayan-haab', 'mayan-longcount', 'aztec-xiuhpohualli', 'chinese'].includes(key))
            .map(([key, info]) => (<option key={key} value={key}>
                    {info.name}
                  </option>))}
            </select>
          </div>
        </div>
        <div className="view-mode-selector">
        <button className={`view-mode-button ${viewMode === 'decade' ? 'active' : ''}`} onClick={() => {
            (0, audioUtils_1.playModeSelectionSound)();
            onViewModeChange('decade');
        }}>
          Decade
        </button>
        <button className={`view-mode-button ${viewMode === 'year' ? 'active' : ''}`} onClick={() => {
            (0, audioUtils_1.playModeSelectionSound)();
            onViewModeChange('year');
        }}>
          Year
        </button>
        <button className={`view-mode-button ${viewMode === 'month' ? 'active' : ''}`} onClick={() => {
            (0, audioUtils_1.playModeSelectionSound)();
            onViewModeChange('month');
        }}>
          Month
        </button>
        <button className={`view-mode-button ${viewMode === 'week' ? 'active' : ''}`} onClick={() => {
            (0, audioUtils_1.playModeSelectionSound)();
            onViewModeChange('week');
        }}>
          Week
        </button>
        <button className={`view-mode-button ${viewMode === 'day' ? 'active' : ''}`} onClick={() => {
            (0, audioUtils_1.playModeSelectionSound)();
            onViewModeChange('day');
        }}>
          Day
        </button>
        {onOpenPreferences && (<button className="view-mode-button preferences-button" onClick={() => {
                (0, audioUtils_1.playSettingsSound)();
                onOpenPreferences();
            }} title="Preferences">
            ⚙️
          </button>)}
        </div>
      </div>
      <div className="calendar-info-panel">
        {(() => {
            const calendarInfo = types_1.CALENDAR_INFO[calendar];
            const description = calendarDescriptions_1.CALENDAR_DESCRIPTIONS[calendar];
            const daysInYear = typeof calendarInfo.daysInYear === 'number'
                ? calendarInfo.daysInYear
                : `${calendarInfo.daysInYear.min}-${calendarInfo.daysInYear.max}`;
            return (<div className="calendar-info-content">
              <div className="calendar-info-section">
                <strong>Definition:</strong> {description.definition}
              </div>
              <div className="calendar-info-section">
                <strong>History:</strong> {description.history}
              </div>
              {description.notes && (<div className="calendar-info-section">
                  <strong>Notes:</strong> {description.notes}
                </div>)}
              <div className="calendar-info-details">
                <span>Type: {calendarInfo.type}</span>
                <span>Months: {calendarInfo.months}</span>
                <span>Days per year: {daysInYear}</span>
                {calendarInfo.eraName && (<span>Era: {calendarInfo.eraName} (begins {calendarInfo.eraStart > 0 ? calendarInfo.eraStart + ' CE' : Math.abs(calendarInfo.eraStart) + ' BCE'})</span>)}
                {calendarInfo.leapYearRule && (<span>Leap year: {calendarInfo.leapYearRule}</span>)}
              </div>
            </div>);
        })()}
      </div>
    </div>);
}
