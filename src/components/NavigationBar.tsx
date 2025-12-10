import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { TimeRange } from '../types';
import { format, addMonths, addYears, addWeeks, addDays, differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';
import { playNavigationSound, playModeSelectionSound, playSettingsSound, playTabSound, playDateSubmitSound, playNavigationJourneySound, playTierNavigationSound, playEraSwitchSound, playNumberTypingSound } from '../utils/audioUtils';
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
  
  // Dynamic font scaling for date label
  const dateLabelRef = useRef<HTMLHeadingElement>(null);
  const navControlsRef = useRef<HTMLDivElement>(null);
  const [dateLabelFontSize, setDateLabelFontSize] = useState<number>(3.5); // Default 3.5rem
  const [dateLabelLayout, setDateLabelLayout] = useState<'single' | 'two-line'>('single');
  const [dateLabelLines, setDateLabelLines] = useState<[string, string?]>(['', undefined]);
  const currentFontSizeRef = useRef<number>(3.5); // Track current font size for comparison
  const isUpdatingRef = useRef<boolean>(false); // Prevent overlapping updates
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Debounce timer
  const lastUpdateTimeRef = useRef<number>(0); // Track last update time for throttling
  const lastDimensionsRef = useRef<{ width: number; height: number } | null>(null); // Track last known dimensions
  const cooldownUntilRef = useRef<number>(0); // Cooldown period after updates to prevent loops
  const lastCalculatedTextRef = useRef<string>(''); // Track last calculated text to avoid recalculating same text
  
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
  // But don't update if user is actively typing (they may be setting era manually)
  useEffect(() => {
    if (usesBCE_CE && !isUserTypingRef.current) {
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
  // Only populate if user is not actively typing
  useEffect(() => {
    if (isUserTypingRef.current) {
      return; // Don't populate if user is typing
    }
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
    
    // For year fields with BCE/CE, allow "-" and "+" as valid intermediate values
    // This allows users to type negative years by starting with "-" or switch to CE with "+"
    if (isYearField && usesBCE_CE) {
      const previousValue = dateInputValues[index]?.trim() || '';
      
      // If user types "+" when field already has content, clear it and switch to CE
      if (value === '+' && previousValue !== '' && previousValue !== '+') {
        // User typed "+" in a field with content: clear it and switch to CE
        const newValues = [...dateInputValues];
        newValues[index] = '';
        setDateInputValues(newValues);
        setDateInputError(false);
        setEraMode('CE');
        playEraSwitchSound('CE');
        // Keep typing flag active to prevent any effects from repopulating
        isUserTypingRef.current = true;
        // Focus the input
        setTimeout(() => {
          inputRefs.current[index]?.focus();
        }, 0);
        return;
      }
      
      // If user types "-" when field already has content, clear it and show "-"
      if (value === '-' && previousValue !== '' && previousValue !== '-') {
        // User typed "-" in a field with content: clear it and show "-"
        const newValues = [...dateInputValues];
        newValues[index] = '-';
        setDateInputValues(newValues);
        setDateInputError(false);
        setEraMode('BCE');
        playEraSwitchSound('BCE');
        // Keep typing flag active to prevent any effects from repopulating
        isUserTypingRef.current = true;
        // Focus the input and place cursor after "-"
        setTimeout(() => {
          inputRefs.current[index]?.focus();
          inputRefs.current[index]?.setSelectionRange(1, 1);
        }, 0);
        return;
      }
      
      // Handle "+" to switch to CE mode (remove the "+" from value since it's not needed)
      if (value.startsWith('+')) {
        // Remove the "+" and switch to CE mode
        const cleanValue = value.replace(/^\+/, '');
        const newValues = [...dateInputValues];
        newValues[index] = cleanValue;
        setDateInputValues(newValues);
        setDateInputError(false);
        setEraMode('CE');
        playEraSwitchSound('CE');
        // Keep typing flag active to prevent any effects from repopulating
        isUserTypingRef.current = true;
        return; // Skip further processing
      }
      
      // Allow "-" as a valid intermediate value when typing negative numbers
      if (value === '-' || value === '') {
        // Update the value immediately to allow typing "-"
        const newValues = [...dateInputValues];
        newValues[index] = value;
        setDateInputValues(newValues);
        setDateInputError(false);
        if (value === '-') {
          // Set era mode but ensure we stay in typing mode to prevent repopulation
          setEraMode('BCE');
          playEraSwitchSound('BCE');
          // Keep typing flag active to prevent any effects from repopulating
          isUserTypingRef.current = true;
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
            playEraSwitchSound('BCE');
          } else if (numValue > 0 && eraMode === 'BCE') {
            // User typed positive year while in BCE mode, keep BCE mode
            // (the value will be converted to negative on parse)
          } else if (numValue > 0) {
            // Typing sound is handled in onKeyDown for better key context
          }
        }
      }
    }
    
    // Apply validation if specified
    // Skip validation for "-" and "+" in year fields (already handled above)
    if (field.validation && value !== '' && value !== '-' && value !== '+') {
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
    
    // Typing sound is handled in onKeyDown for better key context
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
    
    // For very large jumps (more than 1000 years = ~365,000 days), jump to within 1000 years first
    // Then do animated navigation from there
    const MAX_ANIMATED_DAYS = 365000; // ~1000 years
    let actualStartDate = new Date(startDate);
    
    if (timeDiff > MAX_ANIMATED_DAYS) {
      // Calculate how many years away we are
      const yearsDiff = differenceInYears(targetDate, startDate);
      const yearsToJump = isFuture 
        ? yearsDiff - 1000  // Jump forward to 1000 years before target
        : yearsDiff + 1000; // Jump backward to 1000 years after target
      
      // Jump to within 1000 years of target
      actualStartDate = addYears(startDate, yearsToJump);
      // Round to start of year for cleaner navigation
      actualStartDate = createDate(actualStartDate.getFullYear(), 0, 1);
      
      // Update the date immediately to the jump point (no animation for this part)
      // This happens synchronously so the animation can continue from this point
      onDateChange(actualStartDate);
    }
    
    // Checkpoint-based navigation system with directional momentum
    // Creates checkpoints at regular intervals and calculates steps between them dynamically
    interface NavigationStep {
      date: Date;
      viewMode: TimeRange;
    }
    
    // Checkpoint-based navigation system with directional momentum
    // Creates checkpoints at regular intervals and calculates steps between them dynamically
    interface Checkpoint {
      date: Date;
      viewMode: TimeRange;
      distance: number; // Days from start
    }
    
    // Create directional checkpoints at regular intervals
    const createCheckpoints = (start: Date, target: Date, isFuture: boolean): Checkpoint[] => {
      const checkpoints: Checkpoint[] = [];
      const totalDays = Math.abs(differenceInDays(start, target));
      
      // Determine checkpoint intervals based on distance
      let checkpointInterval: number; // Days between checkpoints
      let viewModeForCheckpoints: TimeRange;
      
      if (totalDays > 365000) { // > 1000 years
        checkpointInterval = 182500; // ~500 years between checkpoints
        viewModeForCheckpoints = 'decade';
      } else if (totalDays > 36500) { // > 100 years
        checkpointInterval = 18250; // ~50 years between checkpoints
        viewModeForCheckpoints = 'decade';
      } else if (totalDays > 3650) { // > 10 years
        checkpointInterval = 1825; // ~5 years between checkpoints
        viewModeForCheckpoints = 'year';
      } else if (totalDays > 365) { // > 1 year
        checkpointInterval = 90; // ~3 months between checkpoints
        viewModeForCheckpoints = 'month';
      } else if (totalDays > 30) { // > 1 month
        checkpointInterval = 14; // 2 weeks between checkpoints
        viewModeForCheckpoints = 'week';
      } else {
        checkpointInterval = 7; // 1 week between checkpoints (even for small distances)
        viewModeForCheckpoints = 'day';
      }
      
      // Create checkpoints
      let currentCheckpointDate = new Date(start);
      let distance = 0;
      
      while (distance < totalDays) {
        checkpoints.push({
          date: new Date(currentCheckpointDate),
          viewMode: viewModeForCheckpoints,
          distance: distance
        });
        
        // Move to next checkpoint
        if (isFuture) {
          currentCheckpointDate = addDays(currentCheckpointDate, checkpointInterval);
        } else {
          currentCheckpointDate = addDays(currentCheckpointDate, -checkpointInterval);
        }
        distance += checkpointInterval;
      }
      
      // Always add final target as last checkpoint
      checkpoints.push({
        date: new Date(target),
        viewMode: 'day',
        distance: totalDays
      });
      
      return checkpoints;
    };
    
    const checkpoints = createCheckpoints(actualStartDate, targetDate, isFuture);
    let checkpointIndex = 0;
    let currentViewMode = viewMode;
    let animatedCurrentDate = new Date(actualStartDate);
    const totalJourneyDays = Math.abs(differenceInDays(actualStartDate, targetDate));
    
    // Store timeout ID to allow cancellation
    let timeoutId: NodeJS.Timeout | null = null;
    
    // Easing function: ease-out-cubic for smooth deceleration
    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };
    
    // Bell curve function for step size distribution (larger steps in middle, smaller at edges)
    // Returns a multiplier (0 to 1) based on progress through the journey
    const bellCurveMultiplier = (progress: number): number => {
      // Normalized bell curve: peaks at 0.5 (middle), tapers at 0 and 1 (edges)
      // Using a Gaussian-like function: e^(-((x-0.5)^2) / (2*sigma^2))
      // Adjust sigma to control the curve width (smaller = sharper peak)
      const sigma = 0.25; // Controls curve width (smaller = sharper peak, more extreme middle)
      const center = 0.5;
      const exponent = -Math.pow((progress - center) / sigma, 2) / 2;
      const bellValue = Math.exp(exponent);
      
      // Normalize to 0.1-1.0 range (minimum 10% step size at edges, 100% at peak)
      // This creates more extreme differences - much smaller at edges, full size at middle
      return 0.1 + (bellValue * 0.9);
    };
    
    // Calculate steps between current position and next checkpoint
    // Uses bell curve to take larger steps in the middle of the journey
    const calculateStepsToCheckpoint = (
      from: Date, 
      to: Date, 
      targetViewMode: TimeRange,
      overallProgress: number // 0 to 1, progress through entire journey
    ): NavigationStep[] => {
      const steps: NavigationStep[] = [];
      let current = new Date(from);
      const daysToCheckpoint = Math.abs(differenceInDays(current, to));
      
      // Get bell curve multiplier for current progress
      const bellMultiplier = bellCurveMultiplier(overallProgress);
      
      // Determine base step size based on distance and view mode
      // Apply bell curve to create much larger steps in the middle
      if (daysToCheckpoint > 365) {
        // Large distance: step by years
        const yearsToCheckpoint = Math.abs(differenceInYears(to, current));
        // Base step size, then apply aggressive bell curve multiplier (much larger steps in middle)
        const baseStepSize = Math.max(1, Math.floor(yearsToCheckpoint / 22)); // Base: max 15 steps for smoother animation
        // Bell multiplier creates 1x to 10x larger steps in middle (very aggressive)
        const dynamicStepSize = Math.max(1, Math.floor(baseStepSize * (1 + bellMultiplier * 9)));
        
        while (Math.abs(differenceInYears(current, to)) > dynamicStepSize) {
          if (isFuture) {
            current = addYears(current, dynamicStepSize);
          } else {
            current = addYears(current, -dynamicStepSize);
          }
          steps.push({ date: new Date(current), viewMode: 'year' });
        }
      } else if (daysToCheckpoint > 30) {
        // Medium distance: step by months
        const monthsToCheckpoint = Math.abs(differenceInMonths(to, current));
        const baseStepSize = Math.max(1, Math.floor(monthsToCheckpoint / 22)); // More steps for smoother animation
        // Bell multiplier creates 1x to 8x larger steps in middle
        const dynamicStepSize = Math.max(1, Math.floor(baseStepSize * (1 + bellMultiplier * 7)));
        
        while (Math.abs(differenceInMonths(current, to)) > dynamicStepSize) {
          if (isFuture) {
            current = addMonths(current, dynamicStepSize);
          } else {
            current = addMonths(current, -dynamicStepSize);
          }
          steps.push({ date: new Date(current), viewMode: 'month' });
        }
      } else if (daysToCheckpoint > 7) {
        // Small distance: step by weeks
        const weeksToCheckpoint = Math.floor(daysToCheckpoint / 7);
        const baseStepSize = Math.max(1, Math.floor(weeksToCheckpoint / 22)); // More steps for smoother animation
        // Bell multiplier creates 1x to 5x larger steps in middle
        const dynamicStepSize = Math.max(1, Math.floor(baseStepSize * (1 + bellMultiplier * 4)));
        
        let weeksStepped = 0;
        while (weeksStepped < weeksToCheckpoint) {
          const stepSize = Math.min(dynamicStepSize, weeksToCheckpoint - weeksStepped);
          if (isFuture) {
            current = addWeeks(current, stepSize);
          } else {
            current = addWeeks(current, -stepSize);
          }
          steps.push({ date: new Date(current), viewMode: 'week' });
          weeksStepped += stepSize;
        }
      } else {
        // Very small distance: step by days
        // For small distances, use smaller bell curve effect
        const baseStepSize = 1;
        const dynamicStepSize = Math.max(1, Math.floor(baseStepSize * (1 + bellMultiplier * 2)));
        
        let daysStepped = 0;
        while (daysStepped < daysToCheckpoint) {
          const stepSize = Math.min(dynamicStepSize, daysToCheckpoint - daysStepped);
          if (isFuture) {
            current = addDays(current, stepSize);
          } else {
            current = addDays(current, -stepSize);
          }
          steps.push({ date: new Date(current), viewMode: 'day' });
          daysStepped += stepSize;
        }
      }
      
      // Add a few more intermediate steps near the checkpoint for smooth arrival
      // This creates a gentle deceleration as we approach each checkpoint
      if (steps.length > 0) {
        const lastStep = steps[steps.length - 1];
        const remainingDays = Math.abs(differenceInDays(lastStep.date, to));
        
        // Add 2-4 smaller steps for final approach if there's still distance
        if (remainingDays > 0 && remainingDays <= 30) {
          const finalSteps = Math.min(4, remainingDays);
          let finalCurrent = new Date(lastStep.date);
          
          for (let i = 0; i < finalSteps; i++) {
            if (Math.abs(differenceInDays(finalCurrent, to)) <= 1) break;
            
            if (isFuture) {
              finalCurrent = addDays(finalCurrent, 1);
            } else {
              finalCurrent = addDays(finalCurrent, -1);
            }
            steps.push({ date: new Date(finalCurrent), viewMode: 'day' });
          }
        }
      }
      
      // Add final checkpoint step
      steps.push({ date: new Date(to), viewMode: targetViewMode });
      
      return steps;
    };
    
    // Current segment of steps between checkpoints
    let currentSegmentSteps: NavigationStep[] = [];
    let segmentStepIndex = 0;
    
    const executeStep = () => {
      try {
        // If we've completed all checkpoints, finish
        if (checkpointIndex >= checkpoints.length) {
          // Final step - ensure we're at target with day view
          if (currentViewMode !== 'day') {
            playModeSelectionSound();
            onViewModeChange('day');
          }
          onDateChange(targetDate);
          if (!isUserTypingRef.current) {
            setTimeout(() => {
              if (!isUserTypingRef.current) {
                const values = populateDateFields(targetDate);
                setDateInputValues(values);
                setDateInputError(false);
              }
            }, 0);
          }
          timeoutId = setTimeout(() => {
            isNavigatingRef.current = false;
            timeoutId = null;
          }, 100);
          return;
        }
        
        // If we've completed current segment, calculate next segment to next checkpoint
        if (segmentStepIndex >= currentSegmentSteps.length) {
          const nextCheckpoint = checkpoints[checkpointIndex];
          
          if (!nextCheckpoint) {
            // No more checkpoints, go directly to target
            onDateChange(targetDate);
            checkpointIndex = checkpoints.length; // Mark as complete
            timeoutId = setTimeout(executeStep, 0);
            return;
          }
          
          // Calculate overall progress through entire journey (0 to 1)
          const daysTraveled = Math.abs(differenceInDays(actualStartDate, animatedCurrentDate));
          const overallProgress = Math.min(1, daysTraveled / totalJourneyDays);
          
          // Calculate steps to next checkpoint with bell curve step sizing
          currentSegmentSteps = calculateStepsToCheckpoint(
            animatedCurrentDate,
            nextCheckpoint.date,
            nextCheckpoint.viewMode,
            overallProgress
          );
          segmentStepIndex = 0;
          checkpointIndex++;
        }
        
        // Execute current step in segment
        const step = currentSegmentSteps[segmentStepIndex];
        segmentStepIndex++;
        animatedCurrentDate = new Date(step.date);
        
        // Calculate progress (0 to 1) based on checkpoints
        const totalProgress = checkpointIndex / checkpoints.length;
        
        // Play sound
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
        
        // Populate date fields
        if (!isUserTypingRef.current) {
          setTimeout(() => {
            if (!isUserTypingRef.current) {
              const values = populateDateFields(step.date);
              setDateInputValues(values);
              setDateInputError(false);
            }
          }, 0);
        }
        
        // Calculate dynamic delay based on progress and view mode
        // Faster at start (momentum), slower near end (precision)
        const baseDelays: Record<TimeRange, number> = {
          decade: 12,
          year: 10,
          month: 6,
          week: 4,
          day: 2
        };
        
        const baseDelay = baseDelays[step.viewMode] || 6;
        const momentumFactor = 1 + (1 - easeOutCubic(totalProgress)) * 1.5; // 1x to 2.5x speedup
        const delay = Math.max(1, baseDelay / momentumFactor);
        
        // Continue animation
        timeoutId = setTimeout(executeStep, delay);
      } catch (error) {
        console.error('Error during navigation:', error);
        isNavigatingRef.current = false;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    };
    
    // Initialize first segment
    if (checkpoints.length > 0) {
      const firstCheckpoint = checkpoints[0];
      const initialProgress = 0; // At the start of journey
      currentSegmentSteps = calculateStepsToCheckpoint(
        actualStartDate,
        firstCheckpoint.date,
        firstCheckpoint.viewMode,
        initialProgress
      );
      checkpointIndex = 1; // Will process first checkpoint
    }
    
    // Start animation immediately
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
      // Play context-aware typing sound for backspace
      playNumberTypingSound(e.key);
      // If backspace on empty field or at start, go to previous field
      if ((e.currentTarget.value === '' || e.currentTarget.selectionStart === 0) && index > 0) {
        inputRefs.current[index - 1]?.focus();
        e.preventDefault();
      }
    } else {
      // Play context-aware typing sound for number keys and other printable characters
      // Skip for arrow keys and other navigation keys
      if (e.key.length === 1 || ['Delete'].includes(e.key)) {
        playNumberTypingSound(e.key);
      }
    }
    // Let Tab key work normally - don't intercept it
  };

  // Dynamic font scaling for date label to prevent truncation
  useEffect(() => {
    const updateFontSize = () => {
      // Prevent overlapping updates
      if (isUpdatingRef.current) return;
      
      // Check cooldown period - don't update if we just updated recently
      const now = Date.now();
      if (now < cooldownUntilRef.current) {
        return; // Still in cooldown, skip
      }
      
      // Throttle updates to prevent rapid-fire changes
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
      if (timeSinceLastUpdate < 200) { // Increased to 200ms minimum between updates
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        updateTimeoutRef.current = setTimeout(() => {
          updateFontSize();
        }, 200 - timeSinceLastUpdate);
        return;
      }
      
      const dateLabel = dateLabelRef.current;
      const navControls = navControlsRef.current;
      
      if (!dateLabel || !navControls) return;
      
      // Get the full text content first to check if it changed
      const fullText = getDateLabel();
      if (!fullText.trim()) {
        return;
      }
      
      // If text hasn't changed and we have dimensions, check if dimensions changed
      const textChanged = fullText !== lastCalculatedTextRef.current;
      
      // Get current dimensions to check if anything actually changed
      const navControlsRect = navControls.getBoundingClientRect();
      const currentDimensions = {
        width: Math.round(navControlsRect.width), // Round to avoid floating point issues
        height: Math.round(navControlsRect.height)
      };
      
      // If text hasn't changed and dimensions haven't changed significantly, skip recalculation
      if (!textChanged && lastDimensionsRef.current) {
        const widthDiff = Math.abs(lastDimensionsRef.current.width - currentDimensions.width);
        const heightDiff = Math.abs(lastDimensionsRef.current.height - currentDimensions.height);
        
        // Only recalculate if dimensions changed by more than 5px (increased threshold)
        if (widthDiff < 5 && heightDiff < 5) {
          return; // Nothing significant changed, skip
        }
      }
      
      // Update tracked dimensions and text
      lastDimensionsRef.current = currentDimensions;
      lastCalculatedTextRef.current = fullText;
      isUpdatingRef.current = true;
      
      // Get available width and height by measuring actual layout positions
      const navButtons = Array.from(navControls.querySelectorAll('.nav-button')) as HTMLElement[];
      const dateInputContainer = navControls.querySelector('.date-input-container') as HTMLElement;
      
      let availableWidth = 0;
      let availableHeight = 0;
      
      if (navButtons.length > 0 && dateInputContainer) {
        // Get the right edge of the last nav button
        const lastButton = navButtons[navButtons.length - 1];
        const lastButtonRect = lastButton.getBoundingClientRect();
        const lastButtonRight = lastButtonRect.right;
        
        // Get the left edge of the date input container
        const inputContainerRect = dateInputContainer.getBoundingClientRect();
        const inputContainerLeft = inputContainerRect.left;
        
        // Available width is the space between them, minus the date label's margin-left
        availableWidth = inputContainerLeft - lastButtonRight;
        
        // Subtract the date label's margin-left (1rem)
        const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
        availableWidth -= rootFontSize; // 1rem
        
        // Small safety margin to prevent edge cases
        availableWidth -= 10;
        
        // Available height: use the navigation bar row height
        const navRow = navControls.closest('.navigation-bar-top-row') as HTMLElement;
        if (navRow) {
          const navRowRect = navRow.getBoundingClientRect();
          availableHeight = navRowRect.height - 20; // Subtract padding
        } else {
          availableHeight = 80; // Fallback height
        }
      } else {
        // Fallback: use a percentage of nav-controls width
        availableWidth = navControlsRect.width * 0.35; // Estimate 35% available
        availableHeight = 80;
      }
      
      // Safety checks - minimum dimensions
      // Ensure we always have some space, even if very small
      if (availableWidth <= 0) {
        // If width is negative or zero, use a fallback calculation
        // Try to get space from the nav-controls container itself
        const navControlsRect = navControls.getBoundingClientRect();
        availableWidth = Math.max(100, navControlsRect.width * 0.2); // At least 20% of nav-controls width or 100px
      } else if (availableWidth < 50) {
        availableWidth = 50; // Minimum 50px
      }
      if (availableHeight <= 0) {
        availableHeight = 40; // Minimum height for two-line layout
      } else if (availableHeight < 30) {
        availableHeight = 30;
      }
      
      // Parse the date label to find natural split points
      // Common patterns: "WEDNESDAY, THIRTEENTH MOON 8, 2025 CE"
      // Split options:
      // 1. Single line (no split)
      // 2. Split before year/era: "WEDNESDAY, THIRTEENTH MOON 8" / "2025 CE"
      // 3. Split after day name: "WEDNESDAY" / "THIRTEENTH MOON 8, 2025 CE"
      // 4. Split before era: "WEDNESDAY, THIRTEENTH MOON 8, 2025" / "CE"
      
      const splitOptions: Array<{ lines: [string, string?]; description: string }> = [
        { lines: [fullText, undefined], description: 'single' },
      ];
      
      // Try to find natural split points
      // Look for patterns like ", YYYY" or ", YYYY ERA" or "ERA" at the end
      const yearEraMatch = fullText.match(/(.*?)(\d{4}(\s+(?:CE|BCE|AH|AM|ERA))?)$/);
      if (yearEraMatch) {
        const beforeYear = yearEraMatch[1].trim();
        const yearEra = yearEraMatch[2].trim();
        if (beforeYear && yearEra) {
          splitOptions.push({ lines: [beforeYear, yearEra], description: 'before-year' });
        }
      }
      
      // Look for comma-separated parts (e.g., "WEDNESDAY, THIRTEENTH MOON 8, 2025 CE")
      const commaParts = fullText.split(',').map(s => s.trim()).filter(s => s);
      if (commaParts.length >= 2) {
        // Split after first part (day name)
        const firstPart = commaParts[0];
        const rest = commaParts.slice(1).join(', ');
        if (firstPart && rest) {
          splitOptions.push({ lines: [firstPart, rest], description: 'after-day-name' });
        }
        
        // If we have 3+ parts, try splitting before the last part (year/era)
        if (commaParts.length >= 3) {
          const beforeLast = commaParts.slice(0, -1).join(', ');
          const lastPart = commaParts[commaParts.length - 1];
          if (beforeLast && lastPart) {
            splitOptions.push({ lines: [beforeLast, lastPart], description: 'before-last-part' });
          }
        }
      }
      
      // Try splitting on "ERA" or "CE"/"BCE" at the end
      const eraMatch = fullText.match(/(.*?)\s+((?:CE|BCE|AH|AM|ERA))$/);
      if (eraMatch) {
        const beforeEra = eraMatch[1].trim();
        const era = eraMatch[2].trim();
        if (beforeEra && era) {
          splitOptions.push({ lines: [beforeEra, era], description: 'before-era' });
        }
      }
      
      // Test each layout option and find the one with the largest font size
      let bestLayout = splitOptions[0];
      let bestFontSize = 0;
      let bestLayoutType: 'single' | 'two-line' = 'single';
      
      // Create a temporary container to measure layouts
      const tempContainer = document.createElement('div');
      tempContainer.style.visibility = 'hidden';
      tempContainer.style.position = 'absolute';
      tempContainer.style.top = '-9999px';
      tempContainer.style.left = '-9999px';
      tempContainer.style.display = 'flex';
      tempContainer.style.flexDirection = 'column';
      tempContainer.style.alignItems = 'flex-start';
      tempContainer.style.justifyContent = 'center';
      
      const labelStyles = getComputedStyle(dateLabel);
      
      for (const option of splitOptions) {
        const isTwoLine = option.lines[1] !== undefined;
        
        // Create temp elements for measurement
        const line1 = document.createElement('span');
        line1.style.fontFamily = labelStyles.fontFamily;
        line1.style.fontWeight = labelStyles.fontWeight;
        line1.style.letterSpacing = labelStyles.letterSpacing;
        line1.style.textTransform = labelStyles.textTransform;
        line1.style.whiteSpace = 'nowrap';
        line1.textContent = option.lines[0];
        
        tempContainer.innerHTML = '';
        tempContainer.appendChild(line1);
        
        if (isTwoLine) {
          const line2 = document.createElement('span');
          line2.style.fontFamily = labelStyles.fontFamily;
          line2.style.fontWeight = labelStyles.fontWeight;
          line2.style.letterSpacing = labelStyles.letterSpacing;
          line2.style.textTransform = labelStyles.textTransform;
          line2.style.whiteSpace = 'nowrap';
          line2.textContent = option.lines[1]!;
          tempContainer.appendChild(line2);
        }
        
        document.body.appendChild(tempContainer);
        
      // Binary search for optimal font size for this layout
      // Ensure minimum font size so text is always visible
      let minSize = 0.4; // Minimum 0.4rem to ensure visibility
      let maxSize = 3.5;
      let optimalSize = minSize; // Start with minimum to ensure visibility
        
        const iterations = 20;
        for (let i = 0; i < iterations; i++) {
          const testSize = (minSize + maxSize) / 2;
          line1.style.fontSize = `${testSize}rem`;
          if (isTwoLine) {
            (tempContainer.children[1] as HTMLElement).style.fontSize = `${testSize}rem`;
          }
          
          const containerRect = tempContainer.getBoundingClientRect();
          const fitsWidth = containerRect.width <= availableWidth;
          const fitsHeight = containerRect.height <= availableHeight;
          
          if (fitsWidth && fitsHeight) {
            optimalSize = testSize;
            minSize = testSize;
          } else {
            maxSize = testSize;
          }
        }
        
        document.body.removeChild(tempContainer);
        
        // Update best layout if this one is better
        if (optimalSize > bestFontSize) {
          bestFontSize = optimalSize;
          bestLayout = option;
          bestLayoutType = isTwoLine ? 'two-line' : 'single';
        }
      }
      
      // Ensure we always have a valid font size (minimum 0.4rem for visibility)
      const finalFontSize = Math.max(0.4, bestFontSize);
      
      // Only update if there's a meaningful change (larger threshold to prevent micro-adjustments)
      const fontSizeDiff = Math.abs(currentFontSizeRef.current - finalFontSize);
      const layoutChanged = dateLabelLayout !== bestLayoutType;
      const linesChanged = JSON.stringify(dateLabelLines) !== JSON.stringify(bestLayout.lines);
      
      // Use a larger threshold (0.15rem instead of 0.1rem) to prevent unnecessary updates
      if (fontSizeDiff > 0.15 || layoutChanged || linesChanged) {
        currentFontSizeRef.current = finalFontSize;
        lastUpdateTimeRef.current = Date.now();
        
        // Set cooldown period - don't allow updates for 500ms after this one
        cooldownUntilRef.current = Date.now() + 500;
        
        // Batch state updates to minimize re-renders
        setDateLabelFontSize(finalFontSize);
        setDateLabelLayout(bestLayoutType);
        setDateLabelLines(bestLayout.lines);
        
        // Allow next update after a longer delay to let layout fully settle
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 300); // Increased delay
      } else {
        // No change needed, allow next update but with shorter cooldown
        isUpdatingRef.current = false;
        cooldownUntilRef.current = Date.now() + 200; // Shorter cooldown for no-change case
      }
    };
    
    // Initial update with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      updateFontSize();
    }, 0);
    
    // Watch for resize events with stronger debouncing
    // Only observe the navControls container, not the date label itself
    // (The date label will trigger updates when date/viewMode/calendar changes via useEffect dependency)
    const handleResize = () => {
      // Don't process if we're in cooldown or updating
      const now = Date.now();
      if (isUpdatingRef.current || now < cooldownUntilRef.current) {
        return;
      }
      
      // Clear any pending update
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Stronger debounce for resize events (300ms)
      updateTimeoutRef.current = setTimeout(() => {
        // Double-check we're not in cooldown or updating
        const checkNow = Date.now();
        if (!isUpdatingRef.current && checkNow >= cooldownUntilRef.current) {
          requestAnimationFrame(() => {
            updateFontSize();
          });
        }
      }, 300); // Increased debounce to 300ms
    };
    
    const resizeObserver = new ResizeObserver(handleResize);
    
    // Only observe the navControls container, not the date label
    // This prevents the date label's own size changes from triggering recalculations
    if (navControlsRef.current) {
      resizeObserver.observe(navControlsRef.current);
    }
    
    // Watch for window resize with debouncing
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timeoutId);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      isUpdatingRef.current = false; // Reset on cleanup
      lastDimensionsRef.current = null; // Reset dimensions tracking
      cooldownUntilRef.current = 0; // Reset cooldown
      lastCalculatedTextRef.current = ''; // Reset text tracking
    };
  }, [selectedDate, viewMode, calendar]); // Re-run when date/viewMode/calendar changes (not dateLabelFontSize to avoid loop)

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
        <div className="nav-controls" ref={navControlsRef}>
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
          <h2 
            ref={dateLabelRef}
            className={`date-label date-label-${viewMode} ${dateLabelLayout === 'two-line' ? 'date-label-two-line' : ''}`}
            style={{ fontSize: `${dateLabelFontSize}rem` }}
          >
            {dateLabelLayout === 'two-line' && dateLabelLines[1] ? (
              <>
                <span className="date-label-line-1">{dateLabelLines[0]}</span>
                <span className="date-label-line-2">{dateLabelLines[1]}</span>
              </>
            ) : (
              renderDateLabel()
            )}
          </h2>
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
                                playEraSwitchSound(newEraMode);
                                // Update the year value when toggling era
                                const currentYearValue = dateInputValues[0]?.trim() || '';
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

