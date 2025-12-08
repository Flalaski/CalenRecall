import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { TimeRange } from '../types';
import { format, addMonths, addYears, addWeeks, addDays, differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';
import { playNavigationSound, playModeSelectionSound, playSettingsSound, playTabSound, playDateSubmitSound, playNavigationJourneySound, playTierNavigationSound } from '../utils/audioUtils';
import { useCalendar } from '../contexts/CalendarContext';
import { CalendarSystem, CALENDAR_INFO } from '../utils/calendars/types';
import { getTimeRangeLabelInCalendar } from '../utils/calendars/timeRangeConverter';
import { CALENDAR_DESCRIPTIONS } from '../utils/calendars/calendarDescriptions';
import { createDate } from '../utils/dateUtils';
import { getDateEntryConfig } from '../utils/calendars/dateEntryConfig';
import { calendarDateToDate } from '../utils/calendars/calendarConverter';
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
  const { calendar, setCalendar, dateToCalendar } = useCalendar();
  const [isDefinitionExpanded, setIsDefinitionExpanded] = useState(false);
  
  // Get date entry configuration for current calendar
  const dateEntryConfig = useMemo(() => getDateEntryConfig(calendar), [calendar]);
  
  // Era state for BCE/CE switcher (only for year fields)
  // Determine if current calendar uses BCE/CE terminology
  const calendarInfo = CALENDAR_INFO[calendar];
  const usesBCE_CE = !calendarInfo.eraName || calendarInfo.eraName === 'CE' || calendarInfo.eraName === '';
  const [eraMode, setEraMode] = useState<'CE' | 'BCE'>('CE');
  
  // Dynamic date input state - array of values for each field
  // Initialize based on current calendar's field count
  const [dateInputValues, setDateInputValues] = useState<string[]>(() => 
    new Array(dateEntryConfig.fields.length).fill('')
  );
  const [dateInputError, setDateInputError] = useState(false);
  const [isDateInputFocused, setIsDateInputFocused] = useState(false);
  
  // Dynamic refs for input fields
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const previousFocusedFieldRef = useRef<number | null>(null);
  // Track if user is actively typing in date fields to prevent auto-population
  const isUserTypingRef = useRef(false);
  
  // Use ref to access current onDateChange in keyboard handler
  const onDateChangeRef = useRef(onDateChange);
  
  // Keep ref updated
  useEffect(() => {
    onDateChangeRef.current = onDateChange;
  }, [onDateChange]);

  // Helper function to populate date input fields from selectedDate
  // All calendar conversions go through JDN (Julian Day Number), ensuring
  // that the day/K'in values represent the same moment in time across all calendars
  const populateDateFields = useCallback((date?: Date) => {
    try {
      // Use provided date or fall back to selectedDate
      const dateToUse = date || selectedDate;
      // Convert date (Gregorian Date) to current calendar format via JDN
      // This ensures all calendars represent the same moment in time
      const calendarDate = dateToCalendar(dateToUse);
      const fieldCount = dateEntryConfig.fields.length;
      const values: string[] = [];
      
      // Map calendar date components to input fields based on calendar type
      if (calendar === 'mayan-longcount') {
        // Decode Long Count components from the encoded day field
        // The day field encodes: tun * 400 + uinal * 20 + kin
        const baktun = calendarDate.year;
        const katun = calendarDate.month;
        const absDay = Math.abs(calendarDate.day);
        const tun = Math.floor(absDay / 400);
        const remainingAfterTun = absDay % 400;
        const uinal = Math.floor(remainingAfterTun / 20);
        const kin = remainingAfterTun % 20; // This is the K'in (day) value
        
        values[0] = baktun.toString();
        values[1] = katun.toString();
        values[2] = tun.toString();
        values[3] = uinal.toString();
        values[4] = kin.toString(); // K'in represents the same moment as day in other calendars
      } else {
        // For all other calendars, use year/month/day directly
        // The day field represents the same moment in time across all calendars
        // because all conversions go through JDN
        // For year field: display based on current era mode
        let yearValue = calendarDate.year;
        if (usesBCE_CE && calendarDate.year < 1) {
          // For BCE dates, show as positive number when in BCE mode
          // Check current era mode state (but don't update it here to avoid circular dependency)
          const currentEraMode = eraMode;
          if (currentEraMode === 'BCE') {
            yearValue = Math.abs(calendarDate.year);
          } else {
            // In CE mode, show negative year
            yearValue = calendarDate.year;
          }
        }
        values[0] = yearValue.toString();
        if (fieldCount > 1) {
          values[1] = calendarDate.month.toString();
        }
        if (fieldCount > 2) {
          // This day/K'in value is synchronized across all calendars via JDN
          values[2] = calendarDate.day.toString();
        }
      }
      
      // Update era mode based on calendar date (only if not manually set by user)
      // Use a separate effect to avoid circular dependency
      if (usesBCE_CE && calendarDate.year !== undefined) {
        // Update era mode based on the actual calendar date
        // This will be handled by useEffect below
      }
      
      // Ensure array is properly sized
      while (values.length < fieldCount) {
        values.push('');
      }
      
      return values.slice(0, fieldCount);
    } catch (e) {
      // If conversion fails, return empty array
      console.error('Error populating date fields:', e);
      return new Array(dateEntryConfig.fields.length).fill('');
    }
  }, [calendar, selectedDate, dateEntryConfig.fields.length, dateToCalendar, usesBCE_CE, eraMode]);

  // Update era mode when selectedDate changes (for BCE/CE calendars)
  useEffect(() => {
    if (usesBCE_CE) {
      try {
        const calendarDate = dateToCalendar(selectedDate);
        if (calendarDate.year < 1) {
          setEraMode('BCE');
        } else {
          setEraMode('CE');
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }, [selectedDate, usesBCE_CE, dateToCalendar]);

  // Initialize and populate date input values when calendar changes
  useEffect(() => {
    const fieldCount = dateEntryConfig.fields.length;
    const values = populateDateFields();
    setDateInputValues(values);
    setDateInputError(false);
    // Resize refs array to match new field count
    inputRefs.current = new Array(fieldCount).fill(null);
    previousFocusedFieldRef.current = null;
  }, [calendar, dateEntryConfig.fields.length, populateDateFields]);

  // Don't auto-populate fields from selectedDate changes
  // Fields will only be populated during explicit navigation movements

  const navigate = (direction: 'prev' | 'next', shiftPressed: boolean = false) => {
    // Play tier-aware navigation sound with direction and shift distinction
    playTierNavigationSound(viewMode, direction, shiftPressed);
    
    let newDate: Date;
    const multiplier = direction === 'next' ? 1 : -1;
    // If shift is pressed, multiply the jump by 3 for faster navigation
    const shiftMultiplier = shiftPressed ? 3 : 1;

    switch (viewMode) {
      case 'decade':
        newDate = addYears(selectedDate, multiplier * 10 * shiftMultiplier);
        break;
      case 'year':
        newDate = addYears(selectedDate, multiplier * shiftMultiplier);
        break;
      case 'month':
        newDate = addMonths(selectedDate, multiplier * shiftMultiplier);
        break;
      case 'week':
        newDate = addWeeks(selectedDate, multiplier * shiftMultiplier);
        break;
      case 'day':
        newDate = addDays(selectedDate, multiplier * shiftMultiplier);
        break;
      default:
        newDate = selectedDate;
    }
    onDateChange(newDate);
    // Populate date fields after navigation (only if user is not typing)
    // Use setTimeout to ensure state has updated
    if (!isUserTypingRef.current) {
      setTimeout(() => {
        if (!isUserTypingRef.current) {
          const values = populateDateFields(newDate);
          setDateInputValues(values);
          setDateInputError(false);
        }
      }, 0);
    }
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
    const today = new Date();
    onDateChange(today);
    // Populate date fields after navigation (only if user is not typing)
    // Use setTimeout to ensure state has updated
    if (!isUserTypingRef.current) {
      setTimeout(() => {
        if (!isUserTypingRef.current) {
          const values = populateDateFields(today);
          setDateInputValues(values);
          setDateInputError(false);
        }
      }, 0);
    }
  };

  // Parse date from dynamic fields using calendar-specific parser
  const parseDateFromFields = (values: string[]): Date | null => {
    // Use calendar-specific parser
    const parsed = dateEntryConfig.parseDate(values);
    if (!parsed) {
      return null;
    }

    // Convert calendar date to JavaScript Date
    try {
      // Handle BCE/CE era toggle for calendars that use BCE/CE terminology
      let year = parsed.year;
      if (usesBCE_CE) {
        const isYearField = dateEntryConfig.fields[0]?.label.toLowerCase().includes('year') ||
                           dateEntryConfig.fields[0]?.label.toLowerCase().includes('cycle') ||
                           dateEntryConfig.fields[0]?.label.toLowerCase().includes('haab') ||
                           dateEntryConfig.fields[0]?.label.toLowerCase().includes('baktun') ||
                           dateEntryConfig.fields[0]?.label.toLowerCase().includes('váḥid') ||
                           dateEntryConfig.fields[0]?.label.toLowerCase().includes('xiuhmolpilli');
        
        if (isYearField) {
          // If era mode is BCE and year is positive, make it negative
          if (eraMode === 'BCE' && year > 0) {
            year = -year;
          }
          // If year is already negative (user typed -), respect that regardless of era mode
          // This allows users to type negative years directly
        }
      }
      
      const calendarDate = {
        year: year,
        month: parsed.month,
        day: parsed.day,
        calendar: calendar
      };
      return calendarDateToDate(calendarDate);
    } catch (e) {
      return null;
    }
  };

  // Dynamic input change handler
  const handleFieldChange = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    // Mark that user is actively typing to prevent auto-population
    isUserTypingRef.current = true;
    
    const field = dateEntryConfig.fields[index];
    let value = e.target.value;
    
    // Check if this is a year field that uses BCE/CE
    const isYearField = field.label.toLowerCase().includes('year') || 
                       field.label.toLowerCase().includes('cycle') ||
                       field.label.toLowerCase().includes('haab') ||
                       field.label.toLowerCase().includes('baktun') ||
                       field.label.toLowerCase().includes('váḥid') ||
                       field.label.toLowerCase().includes('xiuhmolpilli');
    
    // Apply formatting if specified
    if (field.formatValue) {
      value = field.formatValue(value);
    }
    
    // For year fields with BCE/CE, allow "-" as a valid intermediate value
    // This allows users to type negative years by starting with "-"
    if (isYearField && usesBCE_CE) {
      // If user types "-" when field already has content, clear it and show "-"
      const previousValue = dateInputValues[index]?.trim() || '';
      if (value === '-' && previousValue !== '' && previousValue !== '-') {
        // User typed "-" in a field with content: clear it and show "-"
        const newValues = [...dateInputValues];
        newValues[index] = '-';
        setDateInputValues(newValues);
        setDateInputError(false);
        setEraMode('BCE');
        // Focus the input and place cursor after "-"
        setTimeout(() => {
          inputRefs.current[index]?.focus();
          inputRefs.current[index]?.setSelectionRange(1, 1);
        }, 0);
        return;
      }
      
      // Allow "-" as a valid intermediate value when typing negative numbers
      if (value === '-' || value === '') {
        // Update the value immediately to allow typing "-"
        const newValues = [...dateInputValues];
        newValues[index] = value;
        setDateInputValues(newValues);
        setDateInputError(false);
        if (value === '-') {
          setEraMode('BCE');
        }
        return; // Skip validation for intermediate "-" or empty
      }
      
      // Detect negative input and update era mode
      if (value.trim() !== '') {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
          if (numValue < 0) {
            // User typed negative year, switch to BCE mode
            setEraMode('BCE');
          } else if (numValue > 0 && eraMode === 'BCE') {
            // User typed positive year while in BCE mode, keep BCE mode
            // (the value will be converted to negative on parse)
          }
        }
      }
    }
    
    // Apply validation if specified
    // Skip validation for "-" in year fields (already handled above)
    if (field.validation && value !== '' && value !== '-') {
      if (!field.validation(value)) {
        return; // Don't update if validation fails
      }
    }
    
    // Check max length
    if (field.maxLength && value.length > field.maxLength) {
      return;
    }
    
    // Update the value
    const newValues = [...dateInputValues];
    newValues[index] = value;
    setDateInputValues(newValues);
    setDateInputError(false);
  };

  const handleDateInputFocus = (index: number) => () => {
    setIsDateInputFocused(true);
    // Mark that user is actively typing to prevent auto-population
    isUserTypingRef.current = true;
    
    // Check if this is the first time focusing on any date field (coming from outside)
    const isInitialFocus = previousFocusedFieldRef.current === null;
    const isSwitchingFields = previousFocusedFieldRef.current !== null && previousFocusedFieldRef.current !== index;
    
    // Play a unique tab sound when tabbing between date input fields
    if (isSwitchingFields) {
      playTabSound();
    }
    
    // Only clear fields on initial focus (when clicking from outside), not when moving between fields
    if (isInitialFocus) {
      // Clear all date input fields when user first clicks on any field
      // This prevents the current date from interfering with user input
      const clearedValues = new Array(dateEntryConfig.fields.length).fill('');
      setDateInputValues(clearedValues);
      setDateInputError(false);
    }
    
    previousFocusedFieldRef.current = index;
    
    // Focus the clicked field and select its content for easy replacement
    setTimeout(() => {
      const input = inputRefs.current[index];
      if (input) {
        input.focus();
        // Select all text so user can easily type over it
        input.select();
      }
    }, 0);
  };

  const handleDateInputBlur = () => {
    setIsDateInputFocused(false);
    // Reset typing flag after a short delay to allow for any pending updates
    setTimeout(() => {
      isUserTypingRef.current = false;
    }, 100);
    
    // Don't auto-submit on blur - only clear if all fields are empty
    if (dateInputValues.every(v => !v.trim())) {
      setDateInputValues(new Array(dateEntryConfig.fields.length).fill(''));
      setDateInputError(false);
      previousFocusedFieldRef.current = null;
    }
  };

  // Track if navigation is in progress to prevent overlapping navigations
  const isNavigatingRef = useRef(false);

  // Navigate to target date with animated steps, transitioning through time tiers
  const navigateToDateWithSteps = (targetDate: Date) => {
    // Prevent multiple simultaneous navigations
    if (isNavigatingRef.current) {
      return;
    }
    
    isNavigatingRef.current = true;
    
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
    
    // Store timeout ID to allow cancellation
    let timeoutId: NodeJS.Timeout | null = null;
    
    const executeStep = () => {
      try {
        if (stepIndex >= optimizedSteps.length) {
          // Reset navigation flag
          isNavigatingRef.current = false;
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
        
        // Populate date fields after navigation step (only if user is not typing)
        // Use setTimeout to ensure state has updated
        if (!isUserTypingRef.current) {
          setTimeout(() => {
            if (!isUserTypingRef.current) {
              const values = populateDateFields(step.date);
              setDateInputValues(values);
              setDateInputError(false);
            }
          }, 0);
        }
        
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
          timeoutId = setTimeout(executeStep, delay);
        } else {
          // Final step - ensure we're at target with day view
          if (currentViewMode !== 'day') {
            playModeSelectionSound();
            onViewModeChange('day');
          }
          onDateChange(targetDate);
          // Populate date fields after navigation completes (only if user is not typing)
          // Use setTimeout to ensure state has updated
          if (!isUserTypingRef.current) {
            setTimeout(() => {
              if (!isUserTypingRef.current) {
                const values = populateDateFields(targetDate);
                setDateInputValues(values);
                setDateInputError(false);
              }
            }, 0);
          }
          // Reset navigation flag after a short delay to allow final update to complete
          timeoutId = setTimeout(() => {
            isNavigatingRef.current = false;
            timeoutId = null;
          }, 100);
        }
      } catch (error) {
        // Reset navigation flag on error
        console.error('Error during navigation:', error);
        isNavigatingRef.current = false;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    };
    
    // Start animation
    executeStep();
  };

  const handleDateInputSubmit = () => {
    // Prevent submission if navigation is already in progress
    if (isNavigatingRef.current) {
      return;
    }
    
    // Check if first field (usually year/cycle/baktun) is required and filled
    const firstFieldValue = dateInputValues[0]?.trim();
    if (!firstFieldValue) {
      setDateInputValues(new Array(dateEntryConfig.fields.length).fill(''));
      return;
    }

    const parsedDate = parseDateFromFields(dateInputValues);
    if (parsedDate) {
      // Clear inputs and blur
      setDateInputValues(new Array(dateEntryConfig.fields.length).fill(''));
      setDateInputError(false);
      inputRefs.current.forEach(ref => ref?.blur());
      
      // Navigation sound is already played in handleDateInputKeyDown for Enter
      // Navigate to target date with animated steps through time tiers
      navigateToDateWithSteps(parsedDate);
    } else {
      setDateInputError(true);
    }
  };

  const handleDateInputKeyDown = (index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        if (index < dateEntryConfig.fields.length - 1) {
          playTabSound();
        }
      } else {
        // Shift+Tab backward - check if previous field is a date field
        if (index > 0) {
          playTabSound();
        }
      }
      // Let Tab work normally - don't prevent default
    } else if (e.key === 'Escape') {
      setDateInputValues(new Array(dateEntryConfig.fields.length).fill(''));
      setDateInputError(false);
      inputRefs.current.forEach(ref => ref?.blur());
    } else if (e.key === 'ArrowLeft') {
      // Allow arrow left to move to previous field when at start of current field
      if (e.currentTarget.selectionStart === 0 && index > 0) {
        inputRefs.current[index - 1]?.focus();
        e.preventDefault();
      }
    } else if (e.key === 'Backspace') {
      // If backspace on empty field or at start, go to previous field
      if ((e.currentTarget.value === '' || e.currentTarget.selectionStart === 0) && index > 0) {
        inputRefs.current[index - 1]?.focus();
        e.preventDefault();
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

      // Handle T key for Today button
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        playNavigationSound();
        onDateChangeRef.current(new Date());
        return;
      }

      // Handle arrow keys for navigation (Left = prev, Right = next)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const direction = e.key === 'ArrowLeft' ? 'prev' : 'next';
        const shiftPressed = e.shiftKey;
        
        // Get current state from refs/closure
        const currentViewMode = viewMode;
        const currentSelectedDate = selectedDate;
        
        // Play tier-aware navigation sound with direction and shift distinction
        playTierNavigationSound(currentViewMode, direction, shiftPressed);
        
        let newDate: Date;
        const multiplier = direction === 'next' ? 1 : -1;
        const shiftMultiplier = shiftPressed ? 3 : 1;

        switch (currentViewMode) {
          case 'decade':
            newDate = addYears(currentSelectedDate, multiplier * 10 * shiftMultiplier);
            break;
          case 'year':
            newDate = addYears(currentSelectedDate, multiplier * shiftMultiplier);
            break;
          case 'month':
            newDate = addMonths(currentSelectedDate, multiplier * shiftMultiplier);
            break;
          case 'week':
            newDate = addWeeks(currentSelectedDate, multiplier * shiftMultiplier);
            break;
          case 'day':
            newDate = addDays(currentSelectedDate, multiplier * shiftMultiplier);
            break;
          default:
            newDate = currentSelectedDate;
        }
        onDateChange(newDate);
        // Populate date fields after keyboard navigation (only if user is not typing)
        // Use setTimeout to ensure state has updated
        if (!isUserTypingRef.current) {
          setTimeout(() => {
            if (!isUserTypingRef.current) {
              const values = populateDateFields(newDate);
              setDateInputValues(values);
              setDateInputError(false);
            }
          }, 0);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewMode, selectedDate, onDateChange]); // Include dependencies for keyboard navigation

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
          <button 
            className="nav-button" 
            onClick={(e) => navigate('prev', e.shiftKey)}
            onMouseDown={(e) => e.preventDefault()} // Prevent default to allow shift detection
          >
            ←
          </button>
          <button className="nav-button today-button" onClick={goToToday}>
            Today
          </button>
          <button 
            className="nav-button" 
            onClick={(e) => navigate('next', e.shiftKey)}
            onMouseDown={(e) => e.preventDefault()} // Prevent default to allow shift detection
          >
            →
          </button>
          <h2 className={`date-label date-label-${viewMode}`}>{renderDateLabel()}</h2>
          <div className="date-input-container" key={`date-input-${calendar}`}>
            <div className="date-input-wrapper">
              <div className="date-input-fields" role="group" aria-label="Go to date">
                {dateEntryConfig.fields.map((field, index) => {
                  // Ensure dateInputValues array is properly sized
                  const fieldValue = index < dateInputValues.length ? dateInputValues[index] : '';
                  const isYearField = field.label.toLowerCase().includes('year') || 
                                     field.label.toLowerCase().includes('cycle') ||
                                     field.label.toLowerCase().includes('haab') ||
                                     field.label.toLowerCase().includes('baktun') ||
                                     field.label.toLowerCase().includes('váḥid') ||
                                     field.label.toLowerCase().includes('xiuhmolpilli');
                  
                  return (
                    <React.Fragment key={`${calendar}-${index}-${field.label}`}>
                      <div className="date-field-group">
                        <label 
                          htmlFor={`date-input-${calendar}-${index}`} 
                          className="date-field-label"
                        >
                          {field.label}
                        </label>
                        <div className="date-input-with-era">
                          <input
                            ref={(el) => {
                              if (inputRefs.current.length <= index) {
                                inputRefs.current.length = index + 1;
                              }
                              inputRefs.current[index] = el;
                            }}
                            type="text"
                            id={`date-input-${calendar}-${index}`}
                            className={`date-input date-input-${index} ${dateInputError ? 'error' : ''}`}
                            placeholder={field.placeholder}
                            value={fieldValue}
                            onChange={handleFieldChange(index)}
                            onKeyDown={handleDateInputKeyDown(index)}
                            onFocus={handleDateInputFocus(index)}
                            onBlur={handleDateInputBlur}
                            aria-label={field.label}
                            aria-describedby="date-input-helper date-input-error"
                            aria-invalid={dateInputError}
                            maxLength={field.maxLength}
                          />
                          {isYearField && usesBCE_CE && (
                            <button
                              type="button"
                              className="era-switcher-button"
                              onClick={() => {
                                const newEraMode = eraMode === 'CE' ? 'BCE' : 'CE';
                                setEraMode(newEraMode);
                                // Update the year value when toggling era
                                const currentYearValue = dateInputValues[0]?.trim();
                                const newValues = [...dateInputValues];
                                
                                if (eraMode === 'CE' && newEraMode === 'BCE') {
                                  // Switching from CE to BCE: clear field and show "-" so user can type
                                  newValues[0] = '-';
                                  setDateInputValues(newValues);
                                  // Focus the input field so user can continue typing
                                  setTimeout(() => {
                                    inputRefs.current[0]?.focus();
                                    inputRefs.current[0]?.setSelectionRange(1, 1); // Place cursor after "-"
                                  }, 0);
                                } else if (eraMode === 'BCE' && newEraMode === 'CE') {
                                  // Switching from BCE to CE: clear field
                                  if (currentYearValue) {
                                    const yearNum = parseInt(currentYearValue, 10);
                                    if (!isNaN(yearNum) && yearNum < 0) {
                                      // Convert negative to positive
                                      newValues[0] = Math.abs(yearNum).toString();
                                    } else {
                                      // Clear the field
                                      newValues[0] = '';
                                    }
                                  } else {
                                    newValues[0] = '';
                                  }
                                  setDateInputValues(newValues);
                                }
                              }}
                              title={`Current era: ${eraMode}. Click to switch to ${eraMode === 'CE' ? 'BCE' : 'CE'}`}
                              aria-label={`Current era: ${eraMode}. Click to switch to ${eraMode === 'CE' ? 'BCE' : 'CE'}`}
                            >
                              {eraMode}
                            </button>
                          )}
                        </div>
                      </div>
                      {index < dateEntryConfig.fields.length - 1 && (
                        <div className="date-field-separator">
                          {calendar === 'mayan-longcount' ? '.' : '/'}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              <span 
                id="date-input-helper" 
                className={`date-input-helper-text ${isDateInputFocused && !dateInputError ? 'visible' : 'sr-only'}`}
                role="status"
                aria-live="polite"
              >
                {dateEntryConfig.getHelperText()}
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

