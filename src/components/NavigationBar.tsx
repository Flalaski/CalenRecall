import { useEffect, useRef, useState } from 'react';
import { TimeRange } from '../types';
import { format, addMonths, addYears, addWeeks, addDays, differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';
import { playNavigationSound, playModeSelectionSound, playSettingsSound, playTabSound, playDateSubmitSound, playNavigationJourneySound } from '../utils/audioUtils';
import { useCalendar } from '../contexts/CalendarContext';
import { CalendarSystem, CALENDAR_INFO } from '../utils/calendars/types';
import { getTimeRangeLabelInCalendar } from '../utils/calendars/timeRangeConverter';
import { CALENDAR_DESCRIPTIONS } from '../utils/calendars/calendarDescriptions';
import { createDate } from '../utils/dateUtils';
import './NavigationBar.css';

interface NavigationBarProps {
  viewMode: TimeRange;
  onViewModeChange: (mode: TimeRange) => void;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onOpenPreferences?: () => void;
  onOpenSearch?: () => void;
}

export default function NavigationBar({
  viewMode,
  onViewModeChange,
  selectedDate,
  onDateChange,
  onOpenPreferences,
  onOpenSearch,
}: NavigationBarProps) {
  const { calendar, setCalendar } = useCalendar();
  const [isDefinitionExpanded, setIsDefinitionExpanded] = useState(false);
  const [dateYear, setDateYear] = useState('');
  const [dateMonth, setDateMonth] = useState('');
  const [dateDay, setDateDay] = useState('');
  const [dateInputError, setDateInputError] = useState(false);
  const [isDateInputFocused, setIsDateInputFocused] = useState(false);
  const yearInputRef = useRef<HTMLInputElement>(null);
  const monthInputRef = useRef<HTMLInputElement>(null);
  const dayInputRef = useRef<HTMLInputElement>(null);
  const previousFocusedFieldRef = useRef<'year' | 'month' | 'day' | null>(null);
  
  // Use ref to access current onDateChange in keyboard handler
  const onDateChangeRef = useRef(onDateChange);
  
  // Keep ref updated
  useEffect(() => {
    onDateChangeRef.current = onDateChange;
  }, [onDateChange]);

  // Update input values when selectedDate changes externally
  useEffect(() => {
    const activeElement = document.activeElement;
    const isAnyInputFocused = activeElement === yearInputRef.current || 
                              activeElement === monthInputRef.current || 
                              activeElement === dayInputRef.current;
    
    if (!isAnyInputFocused) {
      setDateYear('');
      setDateMonth('');
      setDateDay('');
      setDateInputError(false);
    }
  }, [selectedDate]);

  const navigate = (direction: 'prev' | 'next') => {
    playNavigationSound();
    let newDate: Date;
    const multiplier = direction === 'next' ? 1 : -1;

    switch (viewMode) {
      case 'decade':
        newDate = addYears(selectedDate, multiplier * 10);
        break;
      case 'year':
        newDate = addYears(selectedDate, multiplier);
        break;
      case 'month':
        newDate = addMonths(selectedDate, multiplier);
        break;
      case 'week':
        newDate = addWeeks(selectedDate, multiplier);
        break;
      case 'day':
        newDate = addDays(selectedDate, multiplier);
        break;
      default:
        newDate = selectedDate;
    }
    onDateChange(newDate);
  };

  const getDateLabel = () => {
    // Use calendar-aware formatting
    try {
      return getTimeRangeLabelInCalendar(selectedDate, viewMode, calendar);
    } catch (e) {
      console.error('Error formatting date in calendar:', e);
      // Fallback to Gregorian formatting if calendar conversion fails
      switch (viewMode) {
        case 'decade':
          const decadeStart = Math.floor(selectedDate.getFullYear() / 10) * 10;
          return `${decadeStart}s`;
        case 'year':
          return format(selectedDate, 'yyyy');
        case 'month':
          return format(selectedDate, 'MMMM yyyy');
        case 'week':
          return `Week of ${format(selectedDate, 'MMM d, yyyy')}`;
        case 'day':
          return format(selectedDate, 'EEEE, MMMM d, yyyy');
        default:
          return format(selectedDate, 'MMMM yyyy');
      }
    }
  };

  // Render decade label with smaller "s"
  const renderDateLabel = () => {
    const label = getDateLabel();
    if (viewMode === 'decade') {
      // Parse decade label: "1990s CE" or "1990s" -> separate year and "s"
      const match = label.match(/^(\d+)(s)(.*)$/);
      if (match) {
        const [, year, s, era] = match;
        return (
          <>
            {year}
            <span className="decade-suffix">{s}</span>
            {era}
          </>
        );
      }
    }
    return label;
  };

  const goToToday = () => {
    playNavigationSound();
    onDateChange(new Date());
  };

  // Parse date from three separate fields
  const parseDateFromFields = (year: string, month: string, day: string): Date | null => {
    const yearTrimmed = year.trim();
    const monthTrimmed = month.trim();
    const dayTrimmed = day.trim();

    // If all fields are empty, return null
    if (!yearTrimmed && !monthTrimmed && !dayTrimmed) {
      return null;
    }

    // Parse year (required)
    let parsedYear: number;
    if (!yearTrimmed) {
      return null;
    }
    try {
      parsedYear = parseInt(yearTrimmed, 10);
      if (isNaN(parsedYear)) {
        return null;
      }
    } catch (e) {
      return null;
    }

    // Parse month (optional, defaults to 0 if not provided)
    let parsedMonth: number = 0;
    if (monthTrimmed) {
      try {
        parsedMonth = parseInt(monthTrimmed, 10) - 1; // Convert to 0-indexed
        if (isNaN(parsedMonth) || parsedMonth < 0 || parsedMonth > 11) {
          return null;
        }
      } catch (e) {
        return null;
      }
    }

    // Parse day (optional, defaults to 1 if not provided)
    let parsedDay: number = 1;
    if (dayTrimmed) {
      try {
        parsedDay = parseInt(dayTrimmed, 10);
        if (isNaN(parsedDay) || parsedDay < 1 || parsedDay > 31) {
          return null;
        }
      } catch (e) {
        return null;
      }
    }

    // Validate the date
    try {
      const date = createDate(parsedYear, parsedMonth, parsedDay);
      // Verify the date is valid (e.g., not Feb 30)
      if (date.getFullYear() === parsedYear && 
          date.getMonth() === parsedMonth && 
          date.getDate() === parsedDay) {
        return date;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^-\d]/g, ''); // Only allow digits and minus
    setDateYear(value);
    setDateInputError(false);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    // Limit to 2 digits, allow any single digit, or valid 2-digit month (01-12)
    if (value === '' || value.length === 1 || (value.length === 2 && parseInt(value, 10) >= 1 && parseInt(value, 10) <= 12)) {
      setDateMonth(value);
      setDateInputError(false);
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    // Limit to 2 digits, allow any single digit, or valid 2-digit day (01-31)
    if (value === '' || value.length === 1 || (value.length === 2 && parseInt(value, 10) >= 1 && parseInt(value, 10) <= 31)) {
      setDateDay(value);
      setDateInputError(false);
    }
  };

  const handleDateInputFocus = (field: 'year' | 'month' | 'day') => {
    setIsDateInputFocused(true);
    // Play a unique tab sound when tabbing between date input fields
    // Only play if coming from another date input field (not initial focus from outside)
    if (previousFocusedFieldRef.current && previousFocusedFieldRef.current !== field) {
      playTabSound();
    }
    previousFocusedFieldRef.current = field;
  };

  const handleDateInputBlur = () => {
    setIsDateInputFocused(false);
    // Don't auto-submit on blur - only clear if all fields are empty
    if (!dateYear.trim() && !dateMonth.trim() && !dateDay.trim()) {
      setDateYear('');
      setDateMonth('');
      setDateDay('');
      setDateInputError(false);
      previousFocusedFieldRef.current = null;
    }
  };

  // Navigate to target date with animated steps, transitioning through time tiers
  const navigateToDateWithSteps = (targetDate: Date) => {
    const startDate = new Date(selectedDate);
    const timeDiff = Math.abs(differenceInDays(startDate, targetDate));
    const isFuture = targetDate > startDate;
    
    // Time tier hierarchy: decade → year → month → week → day
    const timeTiers: TimeRange[] = ['decade', 'year', 'month', 'week', 'day'];
    const currentTierIndex = timeTiers.indexOf(viewMode);
    
    // Calculate navigation steps based on distance
    interface NavigationStep {
      date: Date;
      viewMode: TimeRange;
    }
    
    const steps: NavigationStep[] = [];
    let currentDate = new Date(startDate);
    
    // Step 1: Navigate through decades if more than 5 years away
    const yearsDiff = differenceInYears(targetDate, currentDate);
    if (Math.abs(yearsDiff) >= 5) {
      // Start at decade view if we're far away
      if (currentTierIndex > 0) {
        steps.push({ date: currentDate, viewMode: 'decade' });
      }
      
      // Navigate decade by decade
      while (Math.abs(differenceInYears(currentDate, targetDate)) >= 10) {
        if (isFuture) {
          currentDate = addYears(currentDate, 10);
        } else {
          currentDate = addYears(currentDate, -10);
        }
        // Round to start of decade
        const decadeStart = Math.floor(currentDate.getFullYear() / 10) * 10;
        currentDate = createDate(decadeStart, 0, 1);
        steps.push({ date: new Date(currentDate), viewMode: 'decade' });
      }
    }
    
    // Step 2: Navigate through years if more than 6 months away
    const monthsDiff = differenceInMonths(targetDate, currentDate);
    if (Math.abs(monthsDiff) >= 6) {
      // Transition to year view
      if (steps.length === 0 && currentTierIndex > 1) {
        steps.push({ date: currentDate, viewMode: 'year' });
      } else if (steps.length > 0) {
        steps.push({ date: currentDate, viewMode: 'year' });
      }
      
      // Navigate year by year
      while (Math.abs(differenceInMonths(currentDate, targetDate)) >= 12) {
        if (isFuture) {
          currentDate = addYears(currentDate, 1);
        } else {
          currentDate = addYears(currentDate, -1);
        }
        currentDate = createDate(currentDate.getFullYear(), 0, 1);
        steps.push({ date: new Date(currentDate), viewMode: 'year' });
      }
    }
    
    // Step 3: Navigate through months if more than 2 weeks away
    if (timeDiff >= 14) {
      // Transition to month view
      if (steps.length === 0 && currentTierIndex > 2) {
        steps.push({ date: currentDate, viewMode: 'month' });
      } else if (steps.length > 0) {
        steps.push({ date: currentDate, viewMode: 'month' });
      }
      
      // Navigate month by month
      while (timeDiff >= 14 && Math.abs(differenceInDays(currentDate, targetDate)) >= 14) {
        if (isFuture) {
          currentDate = addMonths(currentDate, 1);
        } else {
          currentDate = addMonths(currentDate, -1);
        }
        currentDate = createDate(currentDate.getFullYear(), currentDate.getMonth(), 1);
        steps.push({ date: new Date(currentDate), viewMode: 'month' });
      }
    }
    
    // Step 4: Navigate through weeks if more than 3 days away
    if (timeDiff >= 3) {
      // Transition to week view
      if (steps.length === 0 && currentTierIndex > 3) {
        steps.push({ date: currentDate, viewMode: 'week' });
      } else if (steps.length > 0) {
        steps.push({ date: currentDate, viewMode: 'week' });
      }
      
      // Navigate week by week
      while (Math.abs(differenceInDays(currentDate, targetDate)) >= 7) {
        if (isFuture) {
          currentDate = addWeeks(currentDate, 1);
        } else {
          currentDate = addWeeks(currentDate, -1);
        }
        steps.push({ date: new Date(currentDate), viewMode: 'week' });
      }
    }
    
    // Step 5: Final transition to day view and navigate day by day
    if (steps.length === 0 && currentTierIndex > 4) {
      steps.push({ date: currentDate, viewMode: 'day' });
    } else if (steps.length > 0) {
      steps.push({ date: currentDate, viewMode: 'day' });
    }
    
    // Navigate day by day for final precision
    while (Math.abs(differenceInDays(currentDate, targetDate)) > 0) {
      if (isFuture) {
        currentDate = addDays(currentDate, 1);
      } else {
        currentDate = addDays(currentDate, -1);
      }
      steps.push({ date: new Date(currentDate), viewMode: 'day' });
    }
    
    // Add final target step
    steps.push({ date: targetDate, viewMode: 'day' });
    
    // For very long journeys, optimize by skipping intermediate steps
    let optimizedSteps = steps;
    if (steps.length > 100) {
      // Take every Nth step to keep animation reasonable
      const skipFactor = Math.ceil(steps.length / 50);
      optimizedSteps = steps.filter((_, index) => index % skipFactor === 0 || index === steps.length - 1);
    }
    
    // Animate through steps with appropriate pacing
    let stepIndex = 0;
    let currentViewMode = viewMode;
    
    const executeStep = () => {
      if (stepIndex >= optimizedSteps.length) {
        return;
      }
      
      const step = optimizedSteps[stepIndex];
      
      // Play procedurally generated navigation sound based on time tier
      // Each tier has a unique sound reflecting the journey through time scales
      playNavigationJourneySound(step.viewMode);
      
      // Update view mode if it changed
      if (step.viewMode !== currentViewMode) {
        if (step.viewMode === 'day') {
          playModeSelectionSound();
        }
        onViewModeChange(step.viewMode);
        currentViewMode = step.viewMode;
      }
      
      // Update date
      onDateChange(step.date);
      
      stepIndex++;
      
      // Calculate delay: faster pacing for smoother navigation
      // Decade steps: 80ms, Year steps: 60ms, Month steps: 40ms, Week steps: 30ms, Day steps: 20ms
      let delay = 40;
      if (step.viewMode === 'decade') delay = 8;
      else if (step.viewMode === 'year') delay = 6;
      else if (step.viewMode === 'month') delay = 4;
      else if (step.viewMode === 'week') delay = 3;
      else if (step.viewMode === 'day') delay = 2;
      
      if (stepIndex < optimizedSteps.length) {
        setTimeout(executeStep, delay);
      } else {
        // Final step - ensure we're at target with day view
        if (currentViewMode !== 'day') {
          playModeSelectionSound();
          onViewModeChange('day');
        }
        onDateChange(targetDate);
      }
    };
    
    // Start animation
    executeStep();
  };

  const handleDateInputSubmit = () => {
    if (!dateYear.trim()) {
      setDateYear('');
      setDateMonth('');
      setDateDay('');
      return;
    }

    const parsedDate = parseDateFromFields(dateYear, dateMonth, dateDay);
    if (parsedDate) {
      // Clear inputs and blur
      setDateYear('');
      setDateMonth('');
      setDateDay('');
      setDateInputError(false);
      yearInputRef.current?.blur();
      monthInputRef.current?.blur();
      dayInputRef.current?.blur();
      
      // Navigation sound is already played in handleDateInputKeyDown for Enter
      // Navigate to target date with animated steps through time tiers
      navigateToDateWithSteps(parsedDate);
    } else {
      setDateInputError(true);
    }
  };

  const handleDateInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: 'year' | 'month' | 'day') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Play unique date submit sound for Enter (date submission)
      playDateSubmitSound();
      handleDateInputSubmit();
    } else if (e.key === 'Tab') {
      // Play unique tab sound when tabbing between date fields
      // Only play if tabbing to another date field (not away from date inputs)
      if (!e.shiftKey) {
        // Tab forward - check if next field is a date field
        if (field === 'year' || field === 'month') {
          playTabSound();
        }
      } else {
        // Shift+Tab backward - check if previous field is a date field
        if (field === 'month' || field === 'day') {
          playTabSound();
        }
      }
      // Let Tab work normally - don't prevent default
    } else if (e.key === 'Escape') {
      setDateYear('');
      setDateMonth('');
      setDateDay('');
      setDateInputError(false);
      yearInputRef.current?.blur();
      monthInputRef.current?.blur();
      dayInputRef.current?.blur();
    } else if (e.key === 'ArrowLeft') {
      // Allow arrow left to move to previous field when at start of current field
      if (e.currentTarget.selectionStart === 0) {
        if (field === 'month') {
          yearInputRef.current?.focus();
          e.preventDefault();
        } else if (field === 'day') {
          monthInputRef.current?.focus();
          e.preventDefault();
        }
      }
    } else if (e.key === 'Backspace') {
      // If backspace on empty field or at start, go to previous field
      if (e.currentTarget.value === '' || e.currentTarget.selectionStart === 0) {
        if (field === 'month') {
          yearInputRef.current?.focus();
          e.preventDefault();
        } else if (field === 'day') {
          monthInputRef.current?.focus();
          e.preventDefault();
        }
      }
    }
    // Let Tab key work normally - don't intercept it
  };

  // Handle keyboard shortcut for Today button (T key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keys if user is typing in an input, textarea, or contenteditable element
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        (target.closest('input') || target.closest('textarea') || target.closest('[contenteditable="true"]'))
      ) {
        return;
      }

      // Only handle T key (case-insensitive)
      if (e.key.toLowerCase() !== 't') {
        return;
      }

      // Prevent default behavior
      e.preventDefault();

      // Trigger Today button - use ref to get current onDateChange
      playNavigationSound();
      onDateChangeRef.current(new Date());
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty deps - we use ref to access current values

  return (
    <div className="navigation-bar">
      <div className="navigation-bar-top-row">
        <div className="nav-controls">
          <img 
            src="./icon.png" 
            alt="CalenRecall" 
            className="app-icon"
            style={{ width: '32px', height: '32px', marginRight: '0.5rem' }}
          />
          <button className="nav-button" onClick={() => navigate('prev')}>
            ←
          </button>
          <button className="nav-button today-button" onClick={goToToday}>
            Today
          </button>
          <button className="nav-button" onClick={() => navigate('next')}>
            →
          </button>
          <h2 className={`date-label date-label-${viewMode}`}>{renderDateLabel()}</h2>
          <div className="date-input-container">
            <div className="date-input-wrapper">
              <div className="date-input-fields" role="group" aria-label="Go to date">
                <div className="date-field-group">
                  <label htmlFor="date-input-year" className="date-field-label">Year</label>
                  <input
                    ref={yearInputRef}
                    type="text"
                    id="date-input-year"
                    className={`date-input date-input-year ${dateInputError ? 'error' : ''}`}
                    placeholder="YYYY"
                    value={dateYear}
                    onChange={handleYearChange}
                    onKeyDown={(e) => handleDateInputKeyDown(e, 'year')}
                    onFocus={() => handleDateInputFocus('year')}
                    onBlur={handleDateInputBlur}
                    aria-label="Year"
                    aria-describedby="date-input-helper date-input-error"
                    aria-invalid={dateInputError}
                    maxLength={6}
                  />
                </div>
                <div className="date-field-separator">/</div>
                <div className="date-field-group">
                  <label htmlFor="date-input-month" className="date-field-label">Month</label>
                  <input
                    ref={monthInputRef}
                    type="text"
                    id="date-input-month"
                    className={`date-input date-input-month ${dateInputError ? 'error' : ''}`}
                    placeholder="MM"
                    value={dateMonth}
                    onChange={handleMonthChange}
                    onKeyDown={(e) => handleDateInputKeyDown(e, 'month')}
                    onFocus={() => handleDateInputFocus('month')}
                    onBlur={handleDateInputBlur}
                    aria-label="Month"
                    aria-describedby="date-input-helper date-input-error"
                    aria-invalid={dateInputError}
                    maxLength={2}
                  />
                </div>
                <div className="date-field-separator">/</div>
                <div className="date-field-group">
                  <label htmlFor="date-input-day" className="date-field-label">Day</label>
                  <input
                    ref={dayInputRef}
                    type="text"
                    id="date-input-day"
                    className={`date-input date-input-day ${dateInputError ? 'error' : ''}`}
                    placeholder="DD"
                    value={dateDay}
                    onChange={handleDayChange}
                    onKeyDown={(e) => handleDateInputKeyDown(e, 'day')}
                    onFocus={() => handleDateInputFocus('day')}
                    onBlur={handleDateInputBlur}
                    aria-label="Day"
                    aria-describedby="date-input-helper date-input-error"
                    aria-invalid={dateInputError}
                    maxLength={2}
                  />
                </div>
              </div>
              <span 
                id="date-input-helper" 
                className={`date-input-helper-text ${isDateInputFocused && !dateInputError ? 'visible' : 'sr-only'}`}
                role="status"
                aria-live="polite"
              >
                Enter year (required), month and day (optional)
              </span>
              <span 
                id="date-input-error" 
                className={`date-input-error-message ${dateInputError ? 'visible' : 'sr-only'}`}
                role="alert"
                aria-live="assertive"
              >
                Invalid date
              </span>
            </div>
          </div>
        </div>
        <div className="right-controls">
          <div className="view-mode-selector">
            <button
              className={`view-mode-button ${viewMode === 'decade' ? 'active' : ''}`}
              onClick={() => {
                playModeSelectionSound();
                onViewModeChange('decade');
              }}
            >
              Decade
            </button>
            <button
              className={`view-mode-button ${viewMode === 'year' ? 'active' : ''}`}
              onClick={() => {
                playModeSelectionSound();
                onViewModeChange('year');
              }}
            >
              Year
            </button>
            <button
              className={`view-mode-button ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => {
                playModeSelectionSound();
                onViewModeChange('month');
              }}
            >
              Month
            </button>
            <button
              className={`view-mode-button ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => {
                playModeSelectionSound();
                onViewModeChange('week');
              }}
            >
              Week
            </button>
            <button
              className={`view-mode-button ${viewMode === 'day' ? 'active' : ''}`}
              onClick={() => {
                playModeSelectionSound();
                onViewModeChange('day');
              }}
            >
              Day
            </button>
            {onOpenSearch && (
              <button
                className="view-mode-button search-button"
                onClick={() => {
                  playModeSelectionSound();
                  onOpenSearch();
                }}
                title="Search (Ctrl+F)"
              >
                🔍
              </button>
            )}
            {onOpenPreferences && (
              <button
                className="view-mode-button preferences-button"
                onClick={() => {
                  playSettingsSound();
                  onOpenPreferences();
                }}
                title="Preferences"
              >
                ⚙️
              </button>
            )}
          </div>
          <div className="calendar-selector">
            <select
              value={calendar}
              onChange={(e) => {
                playModeSelectionSound();
                setCalendar(e.target.value as CalendarSystem);
              }}
              className="calendar-select"
              title="Select calendar system"
            >
              {Object.entries(CALENDAR_INFO)
                .filter(([key]) => ['gregorian', 'julian', 'islamic', 'hebrew', 'persian', 'ethiopian', 'coptic', 'indian-saka', 'cherokee', 'iroquois', 'thai-buddhist', 'bahai', 'mayan-tzolkin', 'mayan-haab', 'mayan-longcount', 'aztec-xiuhpohualli', 'chinese'].includes(key))
                .map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>
      <div className="calendar-info-panel">
        {(() => {
          const calendarInfo = CALENDAR_INFO[calendar];
          const description = CALENDAR_DESCRIPTIONS[calendar];
          const daysInYear = typeof calendarInfo.daysInYear === 'number' 
            ? calendarInfo.daysInYear 
            : `${calendarInfo.daysInYear.min}-${calendarInfo.daysInYear.max}`;
          
          return (
            <div className="calendar-info-content">
              <button 
                className="calendar-definition-toggle"
                onClick={() => setIsDefinitionExpanded(!isDefinitionExpanded)}
                aria-expanded={isDefinitionExpanded}
              >
                <span className="toggle-icon">{isDefinitionExpanded ? '▼' : '▶'}</span>
                <span>Calendar Information</span>
              </button>
              <div className={`calendar-definition-drawer ${isDefinitionExpanded ? 'expanded' : ''}`}>
                <div className="calendar-info-section">
                  <strong>Native Name:</strong> {calendarInfo.nativeName}
                </div>
                <div className="calendar-info-section">
                  <strong>Definition:</strong> {description.definition}
                </div>
                <div className="calendar-info-section">
                  <strong>History:</strong> {description.history}
                </div>
                {description.notes && (
                  <div className="calendar-info-section">
                    <strong>Notes:</strong> {description.notes}
                  </div>
                )}
                <div className="calendar-info-details">
                  <span>Type: {calendarInfo.type}</span>
                  <span>Months: {calendarInfo.months}</span>
                  <span>Days per year: {daysInYear}</span>
                  {calendarInfo.eraName && (
                    <span>Era: {calendarInfo.eraName} (begins {calendarInfo.eraStart > 0 ? calendarInfo.eraStart + ' CE' : Math.abs(calendarInfo.eraStart) + ' BCE'})</span>
                  )}
                  {calendarInfo.leapYearRule && (
                    <span>Leap year: {calendarInfo.leapYearRule}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

