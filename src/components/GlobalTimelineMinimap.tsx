import { useMemo, useState, useEffect, useRef } from 'react';
import { TimeRange, JournalEntry } from '../types';
import { formatDate, getWeekStart, getWeekEnd, getMonthStart, getMonthEnd, getYearEnd, getDecadeEnd, getZodiacColor, getZodiacColorForDecade, getCanonicalDate } from '../utils/dateUtils';
import { addDays, addWeeks, addMonths, addYears, getYear, getMonth, getDate } from 'date-fns';
import './GlobalTimelineMinimap.css';

interface GlobalTimelineMinimapProps {
  selectedDate: Date;
  viewMode: TimeRange;
  onTimePeriodSelect: (date: Date, viewMode: TimeRange) => void;
  onEntrySelect?: (entry: JournalEntry) => void;
  minimapSize?: 'small' | 'medium' | 'large';
}

// Generate mechanical click sound using Web Audio API
function playMechanicalClick(direction: 'up' | 'down'): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  // Check if context is in a valid state
  if (audioContext.state === 'closed') {
    return;
  }
  
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Create a mechanical click sound - sharp transient with resonance
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(direction === 'up' ? 800 : 600, now);
    oscillator.frequency.exponentialRampToValueAtTime(direction === 'up' ? 400 : 300, now + 0.05);
    
    // Envelope for click sound
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.1);
    
    // Add a second click for mechanical feel
    setTimeout(() => {
      // Re-check context state in case it changed
      if (!audioContext || audioContext.state === 'closed') {
        return;
      }
      
      try {
        const now2 = audioContext.currentTime;
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        
        oscillator2.type = 'sine';
        oscillator2.frequency.setValueAtTime(direction === 'up' ? 1200 : 900, now2);
        oscillator2.frequency.exponentialRampToValueAtTime(direction === 'up' ? 500 : 400, now2 + 0.03);
        
        gainNode2.gain.setValueAtTime(0, now2);
        gainNode2.gain.linearRampToValueAtTime(0.2, now2 + 0.001);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, now2 + 0.03);
        gainNode2.gain.linearRampToValueAtTime(0, now2 + 0.08);
        
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        
        oscillator2.start(now2);
        oscillator2.stop(now2 + 0.08);
      } catch (error) {
        // Silently fail if second click cannot be created
        console.debug('Second click audio error:', error);
      }
    }, 20);
  } catch (error) {
    // Silently fail if audio context is not available
    console.debug('Mechanical click audio error:', error);
  }
}

// Shared audio context for micro blips - reuse to avoid creation overhead
let sharedAudioContext: AudioContext | null = null;

// Initialize audio context on first use
function getAudioContext(): AudioContext | null {
  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.debug('Audio context not available:', error);
      return null;
    }
  }
  
  // Check if context was closed (shouldn't happen, but handle gracefully)
  if (sharedAudioContext.state === 'closed') {
    // Reset and try to create a new one
    sharedAudioContext = null;
    try {
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.debug('Audio context recreation failed:', error);
      return null;
    }
  }
  
  // Resume audio context if suspended (browsers require user interaction)
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch((error) => {
      // Silently fail if resume is not possible
      console.debug('Audio context resume failed:', error);
    });
  }
  
  return sharedAudioContext;
}

// Generate micro mechanical blip sound for date changes during dragging
function playMicroBlip(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  // Check if context is in a valid state
  if (audioContext.state === 'closed') {
    return;
  }
  
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Create a very short, quiet mechanical blip - subtle tick sound
    oscillator.type = 'sine';
    const now = audioContext.currentTime;
    oscillator.frequency.setValueAtTime(1000, now);
    oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.02);
    
    // Very short envelope for micro blip - quieter and shorter than main click
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.08, now + 0.0005);
    gainNode.gain.exponentialRampToValueAtTime(0.005, now + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.04);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.04);
  } catch (error) {
    // Silently fail if audio creation fails
    console.debug('Micro blip audio error:', error);
  }
}

// Generate a polygon clip-path based on number of sides
function generatePolygonClipPath(sides: number): string {
  if (sides < 3) sides = 3; // Minimum triangle
  if (sides > 12) sides = 12; // Maximum dodecagon
  
  const centerX = 50;
  const centerY = 50;
  const radius = 50;
  const points: string[] = [];
  
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - (Math.PI / 2); // Start from top
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    points.push(`${x}% ${y}%`);
  }
  
  return `polygon(${points.join(', ')})`;
}

// Numerological breakdown: reduce a number to a single digit by summing digits
function numerologicalReduce(num: number): number {
  while (num > 9) {
    num = num.toString().split('').reduce((sum, digit) => sum + parseInt(digit, 10), 0);
  }
  return num;
}

// Calculate number of sides for a crystal based on numerological breakdown of entry
function calculateCrystalSides(entry: JournalEntry): number {
  // Extract all numbers from the entry
  const titleNumbers = (entry.title || '').match(/\d+/g) || [];
  const contentNumbers = (entry.content || '').match(/\d+/g) || [];
  
  // Sum all numbers found in title and content
  let numberSum = 0;
  titleNumbers.forEach(numStr => {
    numberSum += parseInt(numStr, 10);
  });
  contentNumbers.forEach(numStr => {
    numberSum += parseInt(numStr, 10);
  });
  
  // Calculate numerological value from text (sum of character codes)
  let textValue = 0;
  const allText = (entry.title || '') + (entry.content || '');
  for (let i = 0; i < allText.length; i++) {
    const charCode = allText.charCodeAt(i);
    // Weight characters differently
    textValue += charCode * (i % 5 + 1);
  }
  
  // Extract numbers from date (YYYY-MM-DD format)
  const dateParts = entry.date.split('-');
  const yearValue = parseInt(dateParts[0] || '0', 10);
  const monthValue = parseInt(dateParts[1] || '0', 10);
  const dayValue = parseInt(dateParts[2] || '0', 10);
  
  // Calculate numerological values
  const yearNumerological = numerologicalReduce(yearValue);
  const monthNumerological = numerologicalReduce(monthValue);
  const dayNumerological = numerologicalReduce(dayValue);
  const numberSumNumerological = numberSum > 0 ? numerologicalReduce(numberSum) : 0;
  const textValueNumerological = numerologicalReduce(textValue);
  
  // TimeRange numerological mapping
  const timeRangeNumerological = entry.timeRange === 'decade' ? 1 :
                                entry.timeRange === 'year' ? 2 :
                                entry.timeRange === 'month' ? 3 :
                                entry.timeRange === 'week' ? 4 : 5;
  
  // ID numerological (if exists)
  const idNumerological = entry.id ? numerologicalReduce(entry.id) : 0;
  
  // Combine all numerological values
  const combinedNumerological = yearNumerological + 
                               monthNumerological + 
                               dayNumerological + 
                               numberSumNumerological + 
                               textValueNumerological + 
                               timeRangeNumerological + 
                               idNumerological;
  
  // Final numerological reduction
  const finalNumerological = numerologicalReduce(combinedNumerological);
  
  // Map to 3-12 sides (0 maps to 3, 1-9 map to 4-12)
  // This ensures every entry gets a unique shape based on its numerological essence
  if (finalNumerological === 0) {
    return 3; // Triangle
  } else {
    // Map 1-9 to 4-12 sides
    return 3 + finalNumerological; // Results in 4-12 sides
  }
}

// Calculate color based on numerological patterns of content and time
function calculateEntryColor(entry: JournalEntry): string {
  // Combine title and content for numerological calculation
  const text = (entry.title || '') + (entry.content || '');
  
  // Calculate numerological value from text (sum of character codes with weighting)
  let textValue = 0;
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // Weight characters differently to create more variation
    textValue += charCode * (i % 3 + 1);
  }
  
  // Calculate time-based numerological value
  const entryDate = new Date(entry.date);
  const timeValue = entryDate.getFullYear() * 10000 + 
                    (entryDate.getMonth() + 1) * 100 + 
                    entryDate.getDate();
  
  // Add timeRange to the calculation for additional variation
  const timeRangeValue = entry.timeRange === 'decade' ? 1000 :
                        entry.timeRange === 'year' ? 2000 :
                        entry.timeRange === 'month' ? 3000 :
                        entry.timeRange === 'week' ? 4000 : 5000;
  
  // Combine all values for numerological calculation
  const combinedValue = (textValue + timeValue + timeRangeValue) % 360; // Use modulo 360 for hue
  
  // Calculate hue, saturation, and lightness with more variation
  // Increased base saturation for vibrant colors (CSS filter will multiply this)
  const hue = combinedValue; // 0-360 degrees
  const saturation = 75 + (textValue % 20); // 75-95% saturation (very vibrant base)
  const lightness = 45 + (timeValue % 15); // 45-60% lightness (more visible)
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export default function GlobalTimelineMinimap({
  selectedDate,
  viewMode,
  onTimePeriodSelect,
  onEntrySelect,
  minimapSize = 'medium',
}: GlobalTimelineMinimapProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [timelineRangeKey, setTimelineRangeKey] = useState(0); // Track timeline range changes to trigger entry reloading
  const [isDragging, setIsDragging] = useState(false);
  const [mechanicalClick, setMechanicalClick] = useState<{ scale: TimeRange; direction: 'up' | 'down' } | null>(null);
  const [horizontalLocked, setHorizontalLocked] = useState(false);
  const [radialDial, setRadialDial] = useState<{ x: number; y: number } | null>(null);
  const [dragLimits, setDragLimits] = useState<{ 
    deadZoneTop: number; 
    deadZoneBottom: number; 
    thresholdTop: number; 
    thresholdBottom: number;
    currentMovement?: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const dragStartPositionRef = useRef<{ x: number; y: number; date: Date; timelinePosition: number } | null>(null);
  const lastVerticalPositionRef = useRef<number>(0);
  const scaleChangeLockRef = useRef<boolean>(false);
  const verticalMovementAccumulatorRef = useRef<number>(0);
  const initialMovementRef = useRef<{ horizontal: number; vertical: number } | null>(null);
  const lastScaleChangeAccumulatorRef = useRef<number>(0); // Track accumulator value at last scale change
  const deadZoneRef = useRef<number>(0); // Dead zone threshold after scale change
  const lastBlipDateRef = useRef<Date | null>(null); // Track last date that triggered a micro blip
  const currentDragTargetDateRef = useRef<Date | null>(null); // Track the target date we're moving toward
  // Load entries for the timeline range
  // Use the fixed timeline range, not recalculated based on selectedDate
  useEffect(() => {
    const loadEntries = async () => {
      try {
        // Use the fixed timeline range (same as what's displayed)
        const range = timelineRangeRef.current;
        if (!range) {
          return; // Wait for range to be initialized
        }
        
        const { startDate, endDate } = range;
        
        // Use the electron API to get entries for the date range
        if (window.electronAPI) {
          const startDateStr = formatDate(startDate);
          const endDateStr = formatDate(endDate);
          const loadedEntries = await window.electronAPI.getEntries(startDateStr, endDateStr);
          console.log(`[TimelineMinimap] Loaded ${loadedEntries.length} entries from ${startDateStr} to ${endDateStr}`);
          // Log entries for selected date for debugging
          const selectedStr = formatDate(selectedDate);
          const selectedEntries = loadedEntries.filter(e => e.date === selectedStr);
          if (selectedEntries.length > 0) {
            console.log(`[TimelineMinimap] Found ${selectedEntries.length} entries for ${selectedStr}:`, selectedEntries.map(e => ({ id: e.id, title: e.title, timeRange: e.timeRange })));
          }
          setEntries(loadedEntries);
        }
      } catch (error) {
        console.error('Error loading entries:', error);
        setEntries([]);
      }
    };
    
    loadEntries();
    
    // Reload when entries are saved
    const handleEntrySaved = () => {
      loadEntries();
    };
    window.addEventListener('journalEntrySaved', handleEntrySaved);
    
    return () => {
      window.removeEventListener('journalEntrySaved', handleEntrySaved);
    };
    // Reload entries when viewMode changes, when timeline range expands, or when entries are saved
    // timelineRangeKey increments when the range expands, triggering reload for new date ranges
  }, [viewMode, timelineRangeKey]);

  // Calculate the time range to display based on view mode
  // The timeline range should only change when viewMode changes, NOT when selectedDate changes
  // This prevents automatic recentering during dragging or navigation
  const timelineRangeRef = useRef<{ startDate: Date; endDate: Date; viewMode: TimeRange } | null>(null);
  const isInitialLoadRef = useRef(true);
  
  // Calculate timeline range - only recalculate when viewMode changes or on initial load
  const calculateTimelineRange = (date: Date, mode: TimeRange) => {
    let startDate: Date;
    let endDate: Date;

    switch (mode) {
      case 'decade': {
        const currentDecade = Math.floor(getYear(date) / 10) * 10;
        startDate = new Date(currentDecade - 50, 0, 1);
        endDate = new Date(currentDecade + 60, 11, 31);
        break;
      }
      case 'year': {
        const currentYear = getYear(date);
        startDate = new Date(currentYear - 5, 0, 1);
        endDate = new Date(currentYear + 6, 11, 31);
        break;
      }
      case 'month': {
        const monthStart = getMonthStart(date);
        startDate = addMonths(monthStart, -6);
        endDate = addMonths(monthStart, 7);
        break;
      }
      case 'week': {
        const weekStart = getWeekStart(date);
        startDate = addWeeks(weekStart, -8);
        endDate = addWeeks(weekStart, 9);
        break;
      }
      case 'day': {
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        startDate = addDays(dayStart, -14);
        endDate = addDays(dayStart, 15);
        break;
      }
    }
    
    return { startDate, endDate };
  };
  
  // Update timeline range when viewMode changes, on initial load, or when selectedDate moves outside the current range
  useEffect(() => {
    let shouldRecalculate = 
      isInitialLoadRef.current || 
      timelineRangeRef.current?.viewMode !== viewMode;
    
    // Check if selectedDate is outside the current timeline range (only if range exists)
    if (!shouldRecalculate && timelineRangeRef.current) {
      const canonicalSelectedDate = getCanonicalDate(selectedDate, viewMode);
      const { startDate, endDate } = timelineRangeRef.current;
      
      // For decade view, compare decade boundaries
      if (viewMode === 'decade') {
        const selectedDecade = Math.floor(getYear(canonicalSelectedDate) / 10) * 10;
        const rangeStartDecade = Math.floor(getYear(startDate) / 10) * 10;
        const rangeEndDecade = Math.floor(getYear(endDate) / 10) * 10;
        
        if (selectedDecade < rangeStartDecade || selectedDecade > rangeEndDecade) {
          shouldRecalculate = true;
        }
      } else {
        // For other views, compare canonical dates directly
        if (canonicalSelectedDate < startDate || canonicalSelectedDate > endDate) {
          shouldRecalculate = true;
        }
      }
    }
    
    if (shouldRecalculate) {
      const range = calculateTimelineRange(selectedDate, viewMode);
      timelineRangeRef.current = {
        ...range,
        viewMode,
      };
      isInitialLoadRef.current = false;
      // Increment key to trigger entry reloading when range changes
      setTimelineRangeKey(prev => prev + 1);
    }
  }, [viewMode, selectedDate]);
  
  const timelineData = useMemo(() => {
    // Use the fixed timeline range (doesn't change based on selectedDate)
    const range = timelineRangeRef.current || calculateTimelineRange(selectedDate, viewMode);
    const { startDate, endDate } = range;
    
    // Calculate segments based on the fixed range (not recalculated from selectedDate)
    let segments: Array<{ date: Date; label: string; isCurrent: boolean; viewMode: TimeRange }> = [];
    let currentPosition: number = 0;

    switch (viewMode) {
      case 'decade': {
        // Use the fixed range, but calculate segments from startDate
        const startDecade = Math.floor(getYear(startDate) / 10) * 10;
        const endDecade = Math.floor(getYear(endDate) / 10) * 10;
        
        for (let year = startDecade; year <= endDecade; year += 10) {
          const decadeDate = new Date(year, 0, 1);
          const isCurrent = Math.floor(getYear(selectedDate) / 10) * 10 === year;
          segments.push({
            date: decadeDate,
            label: `${year}s`,
            isCurrent,
            viewMode: 'decade',
          });
          if (isCurrent) {
            currentPosition = segments.length - 1;
          }
        }
        break;
      }
      case 'year': {
        const startYear = getYear(startDate);
        const endYear = getYear(endDate);
        
        for (let year = startYear; year <= endYear; year++) {
          const yearDate = new Date(year, 0, 1);
          const isCurrent = getYear(selectedDate) === year;
          segments.push({
            date: yearDate,
            label: year.toString(),
            isCurrent,
            viewMode: 'year',
          });
          if (isCurrent) {
            currentPosition = segments.length - 1;
          }
        }
        break;
      }
      case 'month': {
        let current = new Date(startDate);
        let idx = 0;
        const monthStart = getMonthStart(selectedDate);
        while (current <= endDate) {
          const isCurrent = getMonthStart(current).getTime() === monthStart.getTime();
          segments.push({
            date: new Date(getMonthStart(current)),
            label: formatDate(current, 'MMM yyyy'),
            isCurrent,
            viewMode: 'month',
          });
          if (isCurrent) {
            currentPosition = idx;
          }
          current = addMonths(current, 1);
          idx++;
        }
        break;
      }
      case 'week': {
        let current = new Date(startDate);
        let idx = 0;
        const weekStart = getWeekStart(selectedDate);
        while (current <= endDate) {
          const weekStartDate = getWeekStart(current);
          const isCurrent = weekStartDate.getTime() === weekStart.getTime();
          segments.push({
            date: weekStartDate,
            label: formatDate(weekStartDate, 'MMM d'),
            isCurrent,
            viewMode: 'week',
          });
          if (isCurrent) {
            currentPosition = idx;
          }
          current = addWeeks(current, 1);
          idx++;
        }
        break;
      }
      case 'day': {
        let current = new Date(startDate);
        let idx = 0;
        const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        while (current <= endDate) {
          const currentDay = new Date(current.getFullYear(), current.getMonth(), current.getDate());
          const isCurrent = currentDay.getTime() === dayStart.getTime();
          segments.push({
            date: currentDay,
            label: formatDate(currentDay, 'MMM d'),
            isCurrent,
            viewMode: 'day',
          });
          if (isCurrent) {
            currentPosition = idx;
          }
          current = addDays(current, 1);
          idx++;
        }
        break;
      }
    }

    return { segments, currentPosition, startDate, endDate };
  }, [selectedDate, viewMode]);

  // Calculate position percentage for the illuminated line (kept for potential future use)
  // Currently unused by the infinity tree, but preserved for design iterations.
  // const linePosition = useMemo(() => {
  //   if (timelineData.segments.length === 0) return 50;
  //   return (timelineData.currentPosition / (timelineData.segments.length - 1)) * 100;
  // }, [timelineData]);

  // Calculate the start, end, center, and width of the current period indicator
  // The indicator should cover the entire focused time segment (day, week, month, year, or decade)
  const currentIndicatorMetrics = useMemo(() => {
    if (!timelineData.startDate || !timelineData.endDate) {
      return { position: 50, width: '6px' };
    }
    
    const totalTime = timelineData.endDate.getTime() - timelineData.startDate.getTime();
    if (totalTime <= 0 || !isFinite(totalTime)) {
      return { position: 50, width: '6px' };
    }
    
    // Get the start and end dates of the focused period
    const periodStartDate = getCanonicalDate(selectedDate, viewMode);
    let periodEndDate: Date;
    
    switch (viewMode) {
      case 'decade':
        periodEndDate = getDecadeEnd(selectedDate);
        break;
      case 'year':
        periodEndDate = getYearEnd(selectedDate);
        break;
      case 'month':
        periodEndDate = getMonthEnd(selectedDate);
        break;
      case 'week':
        periodEndDate = getWeekEnd(selectedDate);
        break;
      case 'day':
        // For a day, the period is from start of day to end of day (23:59:59.999)
        periodEndDate = new Date(periodStartDate);
        periodEndDate.setHours(23, 59, 59, 999);
        break;
      default:
        periodEndDate = new Date(periodStartDate);
        periodEndDate.setHours(23, 59, 59, 999);
    }
    
    // Calculate the duration of the focused period
    const periodDuration = periodEndDate.getTime() - periodStartDate.getTime();
    if (periodDuration <= 0 || !isFinite(periodDuration)) {
      return { position: 50, width: '6px' };
    }
    
    // Calculate the center of the period (for positioning the indicator)
    const periodCenterDate = new Date(periodStartDate.getTime() + periodDuration / 2);
    const centerTime = periodCenterDate.getTime() - timelineData.startDate.getTime();
    const centerPosition = (centerTime / totalTime) * 100;
    
    // Calculate what percentage of the total timeline this period represents (for width)
    const periodPercentage = (periodDuration / totalTime) * 100;
    
    // Ensure valid numbers
    const position = isFinite(centerPosition) && !isNaN(centerPosition) 
      ? Math.max(0, Math.min(100, centerPosition))
      : 50;
    
    // Convert percentage to a width value
    // Use a minimum width of 4px and ensure it doesn't exceed reasonable bounds
    const minWidthPx = 4;
    const maxWidthPercent = 50; // Don't let it exceed 50% of the container
    
    // Calculate width as percentage, clamped to reasonable bounds
    const widthPercent = isFinite(periodPercentage) && !isNaN(periodPercentage)
      ? Math.max(0.1, Math.min(maxWidthPercent, periodPercentage))
      : 0.5;
    
    // Return as a percentage string for CSS, but ensure minimum pixel width
    // We'll use calc() to ensure minimum width while allowing percentage scaling
    const width = `max(${minWidthPx}px, ${widthPercent}%)`;
    
    return { position, width };
  }, [selectedDate, viewMode, timelineData]);

  // Localization range - only show scales within ±20% of the current indicator
  const LOCALIZATION_RANGE = 20; // percentage of timeline width

  // Center of the minimap in SVG coordinates (0–1000) for the "infinity tree" web
  const centerX = useMemo(() => {
    return (currentIndicatorMetrics.position / 100) * 1000;
  }, [currentIndicatorMetrics.position]);

  // Get color for current view mode
  const getViewModeColor = (mode: TimeRange): string => {
    switch (mode) {
      case 'decade': return '#9c27b0';
      case 'year': return '#0277bd';
      case 'month': return '#ef6c00';
      case 'week': return '#2e7d32';
      case 'day': return '#4a90e2';
      default: return '#4a90e2';
    }
  };

  const activeColor = getViewModeColor(viewMode);

  // Calculate gradient stop positions for separator lines
  // Return numeric values (0-1 range) for arithmetic operations
  const gradientStops = useMemo(() => {
    // Ensure currentIndicatorMetrics.position is valid
    const center = isFinite(currentIndicatorMetrics.position) && !isNaN(currentIndicatorMetrics.position) 
      ? currentIndicatorMetrics.position / 100  // Convert percentage to 0-1 range
      : 0.5; // Default to center if invalid
    
    const fadeStart = Math.max(0, Math.min(1, center - 0.15));
    const colorStart = Math.max(0, Math.min(1, center - 0.05));
    const colorEnd = Math.max(0, Math.min(1, center + 0.05));
    const fadeEnd = Math.max(0, Math.min(1, center + 0.15));
    
    return {
      fadeStart,
      colorStart,
      center,
      colorEnd,
      fadeEnd,
    };
  }, [currentIndicatorMetrics.position]);

  // Ordered time scales for branch generation
  const timeScaleOrder: TimeRange[] = ['decade', 'year', 'month', 'week', 'day'];

  // Calculate container height and scale factor based on minimap size
  const minimapDimensions = useMemo(() => {
    const baseHeight = 200; // Medium size
    const heights = {
      small: 120,
      medium: 200,
      large: 280,
    };
    const height = heights[minimapSize] || baseHeight;
    const scaleFactor = height / baseHeight;
    
    return { height, scaleFactor };
  }, [minimapSize]);

  // Calculate dynamic Y positions that expand focused section and shrink others
  const scaleYPositions = useMemo(() => {
    const focusedExpansion = 25 * minimapDimensions.scaleFactor; // Extra pixels for focused section
    const compressionFactor = 0.75; // How much other sections compress (0.75 = 75% of original)
    
    // Calculate spacing between sections (each section is ~40px tall at base)
    const baseSpacing = 40 * minimapDimensions.scaleFactor;
    const focusedSpacing = baseSpacing + focusedExpansion;
    const compressedSpacing = baseSpacing * compressionFactor;
    
    const focusedIndex = timeScaleOrder.indexOf(viewMode);
    const scaled: Record<TimeRange, number> = {} as Record<TimeRange, number>;
    
    let currentY = baseSpacing / 2; // Start at center of first section
    
    timeScaleOrder.forEach((range, idx) => {
      scaled[range] = currentY;
      
      // Move to next section's center
      if (idx < timeScaleOrder.length - 1) {
        const spacing = idx === focusedIndex ? focusedSpacing : compressedSpacing;
        currentY += spacing;
      }
    });
    
    return scaled;
  }, [viewMode, minimapDimensions.scaleFactor]);

  // Calculate separator line positions between sections (must match background band calculation exactly)
  const separatorPositions = useMemo(() => {
    const baseHeight = 40 * minimapDimensions.scaleFactor;
    const focusedExpansion = 25 * minimapDimensions.scaleFactor;
    const compressionFactor = 0.75;
    
    const positions: number[] = [];
    
    // Use the same calculation logic as background bands
    timeScaleOrder.forEach((range, idx) => {
      // Calculate section top position (same logic as background bands)
      let sectionTop = 0;
      timeScaleOrder.forEach((r, i) => {
        if (i < idx) {
          const prevIsFocused = r === viewMode;
          const prevBaseHeight = 40 * minimapDimensions.scaleFactor;
          const prevHeight = prevIsFocused 
            ? prevBaseHeight + focusedExpansion 
            : prevBaseHeight * compressionFactor;
          sectionTop += prevHeight;
        }
      });
      
      // Calculate section height
      const isFocused = range === viewMode;
      const sectionHeight = isFocused 
        ? baseHeight + focusedExpansion 
        : baseHeight * compressionFactor;
      
      // Separator is at the bottom of this section (top + height = bottom boundary)
      if (idx < timeScaleOrder.length - 1) {
        positions.push(sectionTop + sectionHeight);
      }
    });
    
    return positions;
  }, [viewMode, minimapDimensions.scaleFactor]);

  // Build a crystalline, lightning-like branch path for a given scale and side
  const buildInfinityBranchPath = (scale: TimeRange, direction: 'left' | 'right'): string => {
    const levelIndex = timeScaleOrder.indexOf(scale);
    const yTarget = scaleYPositions[scale];

    // Horizontal reach grows with finer scales (more detailed = wider spread)
    const baseSpread = 80 + levelIndex * 25;
    const spread = baseSpread * (direction === 'left' ? -1 : 1);

    // Deterministic jitter based on current date and scale, so the web shifts with movement
    const jitterSeed = `${scale}-${selectedDate.toISOString()}`;
    const jitter = hashToVerticalOffset(jitterSeed, 40); // -40..40

    // Intermediate "lightning" joints between center and target band
    const midY1 = 100 + (yTarget - 100) * 0.33;
    const midY2 = 100 + (yTarget - 100) * 0.66;

    const midX1 = centerX + spread * 0.4 + jitter * 0.2;
    const midX2 = centerX + spread * 0.8 - jitter * 0.2;
    const endX = centerX + spread + jitter * 0.1;

    return `M ${centerX},100 L ${midX1},${midY1} L ${midX2},${midY2} L ${endX},${yTarget}`;
  };

  // Calculate detailed scale markings for ALL time scale levels simultaneously
  const allScaleMarkings = useMemo(() => {
    if (!timelineData.startDate || !timelineData.endDate) {
      return {
        decade: { major: [], minor: [] },
        year: { major: [], minor: [] },
        month: { major: [], minor: [] },
        week: { major: [], minor: [] },
        day: { major: [], minor: [] },
      };
    }

    const startDate = timelineData.startDate;
    const endDate = timelineData.endDate;
    const totalTime = endDate.getTime() - startDate.getTime();
    
    interface ScaleMark {
      date: Date;
      position: number; // 0-100
      label?: string;
    }

    const calculatePosition = (date: Date): number => {
      // Ensure we have valid dates and totalTime
      if (!date || !startDate || !endDate || !isFinite(totalTime) || totalTime <= 0) {
        return 0;
      }
      
      const dateTime = date.getTime();
      const startTime = startDate.getTime();
      
      // Calculate the time offset from the start
      const timeOffset = dateTime - startTime;
      
      // Calculate position as a percentage (0-100)
      const positionPercentage = (timeOffset / totalTime) * 100;
      
      // Clamp the position to valid range (0-100)
      const clampedPosition = Math.max(0, Math.min(100, positionPercentage));
      
      // Ensure the result is a valid finite number
      if (!isFinite(clampedPosition)) {
        return 0;
      }
      
      return clampedPosition;
    };

    const scales: {
      decade: { major: ScaleMark[]; minor: ScaleMark[] };
      year: { major: ScaleMark[]; minor: ScaleMark[] };
      month: { major: ScaleMark[]; minor: ScaleMark[] };
      week: { major: ScaleMark[]; minor: ScaleMark[] };
      day: { major: ScaleMark[]; minor: ScaleMark[] };
    } = {
      decade: { major: [], minor: [] },
      year: { major: [], minor: [] },
      month: { major: [], minor: [] },
      week: { major: [], minor: [] },
      day: { major: [], minor: [] },
    };

    // DECADE SCALE
    const startYear = getYear(startDate);
    const endYear = getYear(endDate);
    const startDecade = Math.floor(startYear / 10) * 10;
    const endDecade = Math.ceil(endYear / 10) * 10;

    for (let decade = startDecade; decade <= endDecade; decade += 10) {
      const decadeDate = new Date(decade, 0, 1);
      if (decadeDate >= startDate && decadeDate <= endDate) {
        scales.decade.major.push({
          date: decadeDate,
          position: calculatePosition(decadeDate),
          label: `${decade}s`,
        });
      }
    }

    for (let year = startYear; year <= endYear; year += 5) {
      const yearDate = new Date(year, 0, 1);
      if (yearDate >= startDate && yearDate <= endDate && year % 10 !== 0) {
        scales.decade.minor.push({
          date: yearDate,
          position: calculatePosition(yearDate),
          label: year.toString(),
        });
      }
    }

    // YEAR SCALE
    for (let year = startYear; year <= endYear; year++) {
      const yearDate = new Date(year, 0, 1);
      if (yearDate >= startDate && yearDate <= endDate) {
        scales.year.major.push({
          date: yearDate,
          position: calculatePosition(yearDate),
          label: year.toString(),
        });
      }
    }

    const monthSet = new Set<number>();
    let current = new Date(startDate);
    // Reset to the first day of the month for accurate month calculations
    current = new Date(getYear(current), getMonth(current), 1);
    let monthCount = 0;
    const maxMonths = 120; // Limit to 10 years of months
    while (current <= endDate && monthCount < maxMonths) {
      // Create month start date explicitly
      const monthStart = new Date(getYear(current), getMonth(current), 1);
      const monthKey = monthStart.getTime();
      
      // Only include months that fall within our date range
      if (monthStart >= startDate && monthStart <= endDate && !monthSet.has(monthKey)) {
        monthSet.add(monthKey);
        
        // Calculate position for this month
        const monthPosition = calculatePosition(monthStart);
        
        // Only add labels for quarterly months (Jan=0, Apr=3, Jul=6, Oct=9)
        const monthIndex = getMonth(monthStart);
        const isQuarterlyMonth = monthIndex % 3 === 0;
        
        if (isQuarterlyMonth) {
          // Ensure position is calculated correctly before storing
          const finalPosition = isFinite(monthPosition) ? monthPosition : 0;
          scales.year.minor.push({
            date: new Date(monthStart.getTime()), // Ensure we store a fresh date object with correct timestamp
            position: finalPosition,
            label: formatDate(monthStart, 'MMM'),
          });
        }
        monthCount++;
      }
      // Move to next month
      current = addMonths(current, 1);
    }

    // MONTH SCALE
    const monthMajorSet = new Set<number>();
    current = new Date(startDate);
    let monthMajorCount = 0;
    const maxMonthMajors = 24; // Limit to 2 years of months
    while (current <= endDate && monthMajorCount < maxMonthMajors) {
      const monthStart = new Date(getYear(current), getMonth(current), 1);
      const monthKey = monthStart.getTime();
      if (monthStart >= startDate && monthStart <= endDate && !monthMajorSet.has(monthKey)) {
        monthMajorSet.add(monthKey);
        scales.month.major.push({
          date: monthStart,
          position: calculatePosition(monthStart),
          label: formatDate(monthStart, 'MMM yyyy'),
        });
        monthMajorCount++;
      }
      current = addMonths(current, 1);
    }

    const monthWeekSet = new Set<number>();
    current = new Date(startDate);
    let monthWeekCount = 0;
    while (current <= endDate && monthWeekCount < 50) { // Limit weeks for month scale
      const weekStart = getWeekStart(current);
      const weekKey = weekStart.getTime();
      if (weekStart >= startDate && weekStart <= endDate && !monthWeekSet.has(weekKey)) {
        monthWeekSet.add(weekKey);
        scales.month.minor.push({
          date: weekStart,
          position: calculatePosition(weekStart),
          label: getDate(weekStart) <= 7 ? formatDate(weekStart, 'd') : undefined,
        });
        monthWeekCount++;
      }
      current = addWeeks(current, 1);
    }

    // WEEK SCALE
    const weekStartSet = new Set<number>();
    current = new Date(startDate);
    let weekCount = 0;
    while (current <= endDate && weekCount < 100) { // Limit to 100 weeks
      const weekStart = getWeekStart(current);
      const weekKey = weekStart.getTime();
      if (weekStart >= startDate && weekStart <= endDate && !weekStartSet.has(weekKey)) {
        weekStartSet.add(weekKey);
        scales.week.major.push({
          date: weekStart,
          position: calculatePosition(weekStart),
          label: formatDate(weekStart, 'MMM d'),
        });
        weekCount++;
      }
      current = addWeeks(current, 1);
    }

    // Limit day marks for week scale - only show every few days
    const weekDaySet = new Set<number>();
    current = new Date(startDate);
    let dayCount = 0;
    const maxDays = 200; // Limit total day marks
    while (current <= endDate && dayCount < maxDays) {
      const dayKey = Math.floor(current.getTime() / (1000 * 60 * 60 * 24));
      if (!weekDaySet.has(dayKey)) {
        weekDaySet.add(dayKey);
        scales.week.minor.push({
          date: new Date(current),
          position: calculatePosition(current),
          label: getDate(current) % 7 === 1 ? formatDate(current, 'd') : undefined,
        });
        dayCount++;
      }
      current = addDays(current, 1);
    }

    // DAY SCALE - limit to reasonable number
    const dayMajorSet = new Set<number>();
    current = new Date(startDate);
    let dayMajorCount = 0;
    const maxDayMajors = 100; // Limit day major marks
    while (current <= endDate && dayMajorCount < maxDayMajors) {
      const dayStart = new Date(getYear(current), getMonth(current), getDate(current));
      const dayKey = dayStart.getTime();
      if (dayStart >= startDate && dayStart <= endDate && !dayMajorSet.has(dayKey)) {
        dayMajorSet.add(dayKey);
        scales.day.major.push({
          date: dayStart,
          position: calculatePosition(dayStart),
          label: formatDate(dayStart, 'MMM d'),
        });
        dayMajorCount++;
      }
      current = addDays(current, 1);
    }

    // Limit hour marks - only show every 12 hours, max 50
    const hourSet = new Set<number>();
    current = new Date(startDate);
    let hourCount = 0;
    const maxHours = 50;
    while (current <= endDate && hourCount < maxHours) {
      const hourMark = new Date(current);
      hourMark.setHours(Math.floor(hourMark.getHours() / 12) * 12, 0, 0, 0);
      const hourKey = hourMark.getTime();
      if (hourMark >= startDate && hourMark <= endDate && !hourSet.has(hourKey)) {
        hourSet.add(hourKey);
        scales.day.minor.push({
          date: hourMark,
          position: calculatePosition(hourMark),
        });
        hourCount++;
      }
      current = addDays(current, 1);
    }

    return scales;
  }, [timelineData]);


  // Simple hash function to generate consistent vertical offset from entry date/id
  const hashToVerticalOffset = (str: string, maxOffset: number): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Return a value between -maxOffset and maxOffset
    return ((Math.abs(hash) % (maxOffset * 2 + 1)) - maxOffset);
  };

  // Calculate entry positions on the timeline with vertical variance and clustering
  const entryPositions = useMemo(() => {
    if (!timelineData.startDate || !timelineData.endDate || entries.length === 0) {
      return [];
    }

    const totalTime = timelineData.endDate.getTime() - timelineData.startDate.getTime();
    const verticalVariance = 60; // Maximum vertical offset in pixels (30px up/down from center)
    
    // Group entries by date and timeRange to create clusters
    const clusterGroups = new Map<string, Array<{ entry: JournalEntry; position: number; color: string }>>();
    
    entries.forEach(entry => {
      // Parse date string (YYYY-MM-DD) as local date to avoid timezone issues
      // new Date("2025-12-04") interprets as UTC, but we need local time
      const dateParts = entry.date.split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
      const day = parseInt(dateParts[2], 10);
      const rawEntryDate = new Date(year, month, day);
      
      // Use canonical date for the entry's timeRange to match how timeline segments are positioned
      const entryDate = getCanonicalDate(rawEntryDate, entry.timeRange);
      const entryTime = entryDate.getTime() - timelineData.startDate!.getTime();
      const position = (entryTime / totalTime) * 100;
      const clampedPosition = Math.max(0, Math.min(100, position));
      
      // Create cluster key from date and timeRange (entries with same date/timeRange form a cluster)
      const clusterKey = `${entry.date}-${entry.timeRange}`;
      
      if (!clusterGroups.has(clusterKey)) {
        clusterGroups.set(clusterKey, []);
      }
      clusterGroups.get(clusterKey)!.push({
        entry,
        position: clampedPosition,
        color: calculateEntryColor(entry),
      });
    });
    
    // Debug: Log cluster information
    console.log(`[TimelineMinimap] Processing ${entries.length} entries into ${clusterGroups.size} clusters`);
    clusterGroups.forEach((group, key) => {
      if (group.length > 1) {
        console.log(`[TimelineMinimap] Cluster ${key}: ${group.length} entries`);
      }
    });
    
    // Calculate positions for clusters and individual entries
    const result: Array<{ 
      entry: JournalEntry; 
      position: number; 
      color: string; 
      verticalOffset: number;
      clusterIndex?: number;
      clusterSize?: number;
      clusterAngle?: number;
      polygonClipPath: string;
      sides: number;
    }> = [];
    
    clusterGroups.forEach((group) => {
      if (group.length === 1) {
        // Single entry - use hash-based offset
        const entry = group[0];
        const hashInput = `${entry.entry.date}-${entry.entry.timeRange}-${entry.entry.id || 0}`;
        const verticalOffset = hashToVerticalOffset(hashInput, verticalVariance);
        const sides = calculateCrystalSides(entry.entry);
        const polygonClipPath = generatePolygonClipPath(sides);
        result.push({ ...entry, verticalOffset, polygonClipPath, sides });
      } else {
        // Multiple entries - create staggered crystalline cluster
        // Increase radius significantly so individual crystals are clearly visible
        const clusterRadius = 12 + (group.length * 4); // Larger radius for better visibility
        const angleStep = (2 * Math.PI) / group.length; // Distribute evenly in circle
        
        group.forEach((entry, idx) => {
          // Calculate angle for this gem in the cluster (staggered around center)
          const angle = idx * angleStep;
          // Add slight rotation offset for more organic feel
          const rotationOffset = (entry.entry.id || idx) % 3 - 1; // -1, 0, or 1
          const finalAngle = angle + (rotationOffset * 0.15);
          
          // Calculate vertical offset from center for cluster positioning
          const verticalOffset = Math.sin(finalAngle) * clusterRadius;
          
          // Each crystal in cluster gets its own polygon shape
          const sides = calculateCrystalSides(entry.entry);
          const polygonClipPath = generatePolygonClipPath(sides);
          
          result.push({ 
            ...entry, 
            verticalOffset,
            clusterIndex: idx,
            clusterSize: group.length,
            clusterAngle: finalAngle,
            polygonClipPath,
            sides,
          });
        });
      }
    });
    
    return result;
  }, [entries, timelineData]);

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start drag if clicking on an entry indicator or segment
    const target = e.target as HTMLElement;
    if (target.closest('.entry-indicator') || target.closest('.timeline-segment')) {
      return;
    }
    
    if (!containerRef.current || !timelineData.startDate || !timelineData.endDate) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    
    // Use the current selected date as the starting point for drag calculations
    // This prevents jumping when clicking far from center
    const totalTime = timelineData.endDate.getTime() - timelineData.startDate.getTime();
    const currentTimeOffset = selectedDate.getTime() - timelineData.startDate.getTime();
    const currentTimelinePosition = (currentTimeOffset / totalTime) * 100;
    
    // Calculate center indicator's screen position (where the blue bar is)
    const centerIndicatorScreenX = rect.left + (currentTimelinePosition / 100) * rect.width;
    
    // Store the initial drag position - use center indicator's screen position as reference
    // This ensures consistent haptic interaction regardless of where user starts drag
    dragStartPositionRef.current = {
      x: centerIndicatorScreenX, // Center indicator's screen X position, not mouse click position
      y: e.clientY,
      date: selectedDate, // Start from current selected date, not where user clicked
      timelinePosition: currentTimelinePosition, // Store timeline position (0-100)
    };
    
    // Initialize target date to current selected date
    currentDragTargetDateRef.current = selectedDate;
    lastVerticalPositionRef.current = e.clientY;
    initialMovementRef.current = { horizontal: 0, vertical: 0 };
    setHorizontalLocked(false);
    verticalMovementAccumulatorRef.current = 0;
    lastBlipDateRef.current = null; // Reset blip tracking when dragging starts
    
    // Initialize audio context early to ensure it's ready for blips
    // This also helps with browser autoplay policies
    const audioContext = getAudioContext();
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {
        // Silently fail if resume is not possible
      });
    }
    
    // Timeline range is already locked via timelineRangeRef - no need to lock again
    
    // Show radial dial at mouse position
    setRadialDial({ x: e.clientX, y: e.clientY });
    
    // Initialize drag limits visualization
    setDragLimits({
      deadZoneTop: 0,
      deadZoneBottom: 0,
      thresholdTop: -800,
      thresholdBottom: 800,
      currentMovement: 0,
    });
    
    setIsDragging(true);
    e.preventDefault();
  };


  // Handle wheel scroll with reduced sensitivity
  // Note: This is called from a native event listener with { passive: false }
  // to allow preventDefault() to work
  const handleWheel = (e: WheelEvent) => {
    if (!containerRef.current || !timelineDataRef.current.startDate || !timelineDataRef.current.endDate) return;
    
    e.preventDefault();
    
    // Calculate scroll increment based on visible range
    const totalTime = timelineDataRef.current.endDate.getTime() - timelineDataRef.current.startDate.getTime();
    const visibleRangeDays = totalTime / (1000 * 60 * 60 * 24);
    
    // Scroll through a small portion of the visible range (about 5-10%)
    const scrollPercentage = Math.max(0.5, Math.min(2, visibleRangeDays / 100));
    const scrollDays = scrollPercentage * (e.deltaY > 0 ? 1 : -1);
    
    let newDate: Date;
    
    // Use smaller increments that are proportional to the visible range
    const currentViewMode = viewModeRef.current;
    const currentSelectedDate = selectedDateRef.current;
    const currentOnTimePeriodSelect = onTimePeriodSelectRef.current;
    
    switch (currentViewMode) {
      case 'decade': {
        // Scroll by about 1 year per scroll step
        const yearsToScroll = Math.max(1, Math.round(Math.abs(scrollDays) / 365));
        newDate = addMonths(currentSelectedDate, (scrollDays > 0 ? 1 : -1) * yearsToScroll * 12);
        break;
      }
      case 'year': {
        // Scroll by about 1 month per scroll step
        const monthsToScroll = Math.max(1, Math.round(Math.abs(scrollDays) / 30));
        newDate = addMonths(currentSelectedDate, (scrollDays > 0 ? 1 : -1) * monthsToScroll);
        break;
      }
      case 'month': {
        // Scroll by about 1 week per scroll step
        const weeksToScroll = Math.max(1, Math.round(Math.abs(scrollDays) / 7));
        newDate = addWeeks(currentSelectedDate, (scrollDays > 0 ? 1 : -1) * weeksToScroll);
        break;
      }
      case 'week': {
        // Scroll by about 1 day per scroll step
        const daysToScroll = Math.max(1, Math.round(Math.abs(scrollDays)));
        newDate = addDays(currentSelectedDate, (scrollDays > 0 ? 1 : -1) * daysToScroll);
        break;
      }
      case 'day': {
        // Scroll by 1 day per scroll step
        newDate = addDays(currentSelectedDate, scrollDays > 0 ? 1 : -1);
        break;
      }
      default:
        return;
    }
    
    currentOnTimePeriodSelect(newDate, currentViewMode);
  };

  // Store refs for drag handler to avoid recreating on every render
  const timelineDataRef = useRef(timelineData);
  const viewModeRef = useRef(viewMode);
  const selectedDateRef = useRef(selectedDate);
  const onTimePeriodSelectRef = useRef(onTimePeriodSelect);
  const horizontalLockedRef = useRef(horizontalLocked);
  const allScaleMarkingsRef = useRef(allScaleMarkings);

  // Update refs when values change
  useEffect(() => {
    timelineDataRef.current = timelineData;
    viewModeRef.current = viewMode;
    selectedDateRef.current = selectedDate;
    onTimePeriodSelectRef.current = onTimePeriodSelect;
    horizontalLockedRef.current = horizontalLocked;
    allScaleMarkingsRef.current = allScaleMarkings;
  }, [timelineData, viewMode, selectedDate, onTimePeriodSelect, horizontalLocked, allScaleMarkings]);

  // Handle keyboard arrow key navigation
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

      // Only handle arrow keys
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        return;
      }

      // Prevent default scrolling behavior
      e.preventDefault();

      const currentViewMode = viewModeRef.current;
      const currentSelectedDate = selectedDateRef.current;
      const currentOnTimePeriodSelect = onTimePeriodSelectRef.current;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Navigate time horizontally (earlier/later)
        const direction = e.key === 'ArrowLeft' ? -1 : 1;
        let newDate: Date;

        switch (currentViewMode) {
          case 'decade':
            newDate = addYears(currentSelectedDate, direction * 10);
            break;
          case 'year':
            newDate = addYears(currentSelectedDate, direction);
            break;
          case 'month':
            newDate = addMonths(currentSelectedDate, direction);
            break;
          case 'week':
            newDate = addWeeks(currentSelectedDate, direction);
            break;
          case 'day':
            newDate = addDays(currentSelectedDate, direction);
            break;
          default:
            return;
        }

        // Play micro blip for date change
        playMicroBlip();
        currentOnTimePeriodSelect(newDate, currentViewMode);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // Change time scale (zoom in/out)
        const scaleOrder: TimeRange[] = ['decade', 'year', 'month', 'week', 'day'];
        const currentIndex = scaleOrder.indexOf(currentViewMode);

        if (e.key === 'ArrowUp' && currentIndex < scaleOrder.length - 1) {
          // Zoom in (more detail)
          const newViewMode = scaleOrder[currentIndex + 1];
          playMechanicalClick('up');
          setMechanicalClick({ scale: newViewMode, direction: 'up' });
          setTimeout(() => setMechanicalClick(null), 300);
          currentOnTimePeriodSelect(currentSelectedDate, newViewMode);
        } else if (e.key === 'ArrowDown' && currentIndex > 0) {
          // Zoom out (less detail)
          const newViewMode = scaleOrder[currentIndex - 1];
          playMechanicalClick('down');
          setMechanicalClick({ scale: newViewMode, direction: 'down' });
          setTimeout(() => setMechanicalClick(null), 300);
          currentOnTimePeriodSelect(currentSelectedDate, newViewMode);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty deps - we use refs to access current values

  // Handle wheel scroll with non-passive event listener to allow preventDefault()
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []); // Empty deps - we use refs to access current values

  // Set up global mouse event listeners for dragging
  useEffect(() => {
    if (!isDragging || !dragStartPositionRef.current) {
      return;
    }
    
    const handleMouseMoveGlobal = (e: MouseEvent) => {
      const currentTimelineData = timelineDataRef.current;
      const currentViewMode = viewModeRef.current;
      const currentSelectedDate = selectedDateRef.current;
      const currentOnTimePeriodSelect = onTimePeriodSelectRef.current;
      
      if (!containerRef.current || !currentTimelineData.startDate || !currentTimelineData.endDate || !dragStartPositionRef.current) {
        return;
      }

      const now = Date.now();
      const rect = containerRef.current.getBoundingClientRect();
      
      // Calculate total movement from start
      const totalHorizontalDelta = e.clientX - dragStartPositionRef.current.x;
      const totalVerticalDelta = e.clientY - dragStartPositionRef.current.y;
      
      // Track initial movement direction to determine lock
      if (initialMovementRef.current) {
        initialMovementRef.current.horizontal = totalHorizontalDelta;
        initialMovementRef.current.vertical = totalVerticalDelta;
      }
      
      // Horizontal dead zone: suppress horizontal movement when primarily moving vertically
      // This makes it easier to zoom without accidentally moving the blips left/right
      const horizontalDeadZone = 30; // pixels - ignore horizontal movement if within this
      const verticalToHorizontalRatio = 2.0; // If vertical movement is X times horizontal, lock horizontal
      
      // Calculate if movement is primarily vertical
      const absVertical = Math.abs(totalVerticalDelta);
      const absHorizontal = Math.abs(totalHorizontalDelta);
      
      // Lock horizontal if:
      // 1. Horizontal movement is within dead zone AND vertical movement is significant, OR
      // 2. Vertical movement is significantly more than horizontal (ratio-based)
      const shouldLockHorizontal = 
        (absVertical > 10 && absHorizontal < horizontalDeadZone) || 
        (absVertical > 15 && absVertical > absHorizontal * verticalToHorizontalRatio);
      
      if (shouldLockHorizontal && !horizontalLockedRef.current) {
        setHorizontalLocked(true);
        horizontalLockedRef.current = true;
      } else if (!shouldLockHorizontal && horizontalLockedRef.current && absHorizontal > horizontalDeadZone) {
        // Unlock if user explicitly moves horizontally beyond dead zone
        setHorizontalLocked(false);
        horizontalLockedRef.current = false;
      }
      
      // Calculate incremental vertical movement (scale change)
      const verticalDelta = e.clientY - lastVerticalPositionRef.current;
      const verticalThreshold = 800; // Increased threshold for more deliberate movement
      const deadZoneSize = 300; // Dead zone pixels after scale change
      
      // Accumulate vertical movement for mechanical feel
      verticalMovementAccumulatorRef.current += verticalDelta;
      
      // Check if we're in the dead zone (must move back toward center after scale change)
      const inDeadZone = Math.abs(verticalMovementAccumulatorRef.current - lastScaleChangeAccumulatorRef.current) < deadZoneSize;
      
      // Update drag limits visualization relative to radial dial position
      if (dragStartPositionRef.current) {
        // Calculate dead zone boundaries relative to start position
        // Dead zone is relative to the last scale change accumulator value
        // The accumulator tracks total vertical movement from start
        const deadZoneCenter = lastScaleChangeAccumulatorRef.current;
        const deadZoneTop = -(deadZoneCenter + deadZoneSize); // Negative = above dial
        const deadZoneBottom = -(deadZoneCenter - deadZoneSize); // Negative = above dial
        
        // Vertical threshold lines (800px from start)
        // These represent the actual pixel distances, but we'll show them scaled for visibility
        const thresholdTop = -800; // Above dial
        const thresholdBottom = 800; // Below dial
        
        // Calculate current vertical movement from start
        const currentVerticalMovement = verticalMovementAccumulatorRef.current;
        
        setDragLimits({
          deadZoneTop: deadZoneTop,
          deadZoneBottom: deadZoneBottom,
          thresholdTop: thresholdTop,
          thresholdBottom: thresholdBottom,
          currentMovement: currentVerticalMovement, // Track current position for visual feedback
        });
      }
      
      // Handle vertical movement for scale changes with lock-in mechanism and dead zone
      if (!scaleChangeLockRef.current && !inDeadZone && Math.abs(verticalMovementAccumulatorRef.current) > verticalThreshold) {
        const scaleOrder: TimeRange[] = ['decade', 'year', 'month', 'week', 'day'];
        const currentIndex = scaleOrder.indexOf(currentViewMode);
        
        // Check if we've moved enough in the new direction (past the dead zone)
        const movementFromLastChange = verticalMovementAccumulatorRef.current - lastScaleChangeAccumulatorRef.current;
        const hasCrossedDeadZone = Math.abs(movementFromLastChange) >= deadZoneSize;
        
        if (verticalMovementAccumulatorRef.current < 0 && currentIndex < scaleOrder.length - 1 && hasCrossedDeadZone) {
          // Moving up - zoom in (more detail)
          scaleChangeLockRef.current = true; // Lock to prevent rapid changes
          const newViewMode = scaleOrder[currentIndex + 1];
          
          // Play mechanical click sound
          playMechanicalClick('up');
          
          // Trigger visual feedback
          setMechanicalClick({ scale: newViewMode, direction: 'up' });
          setTimeout(() => setMechanicalClick(null), 300);
          
          // View mode change will trigger timeline range recalculation via useEffect
          currentOnTimePeriodSelect(currentSelectedDate, newViewMode);
          
          // Update drag start position to maintain relative position
          if (dragStartPositionRef.current) {
            dragStartPositionRef.current.date = currentSelectedDate;
          }
          
          // Store accumulator value at scale change and set dead zone
          lastScaleChangeAccumulatorRef.current = verticalMovementAccumulatorRef.current;
          deadZoneRef.current = deadZoneSize;
          
          // Reset accumulator position but keep the value for dead zone calculation
          lastVerticalPositionRef.current = e.clientY;
          setTimeout(() => {
            scaleChangeLockRef.current = false;
          }, 200); // Lock for 200ms to prevent rapid clicking
          return;
        } else if (verticalMovementAccumulatorRef.current > 0 && currentIndex > 0 && hasCrossedDeadZone) {
          // Moving down - zoom out (less detail)
          scaleChangeLockRef.current = true; // Lock to prevent rapid changes
          const newViewMode = scaleOrder[currentIndex - 1];
          
          // Play mechanical click sound
          playMechanicalClick('down');
          
          // Trigger visual feedback
          setMechanicalClick({ scale: newViewMode, direction: 'down' });
          setTimeout(() => setMechanicalClick(null), 300);
          
          // View mode change will trigger timeline range recalculation via useEffect
          currentOnTimePeriodSelect(currentSelectedDate, newViewMode);
          
          // Update drag start position to maintain relative position
          if (dragStartPositionRef.current) {
            dragStartPositionRef.current.date = currentSelectedDate;
          }
          
          // Store accumulator value at scale change and set dead zone
          lastScaleChangeAccumulatorRef.current = verticalMovementAccumulatorRef.current;
          deadZoneRef.current = deadZoneSize;
          
          // Reset accumulator position but keep the value for dead zone calculation
          lastVerticalPositionRef.current = e.clientY;
          setTimeout(() => {
            scaleChangeLockRef.current = false;
          }, 200); // Lock for 200ms to prevent rapid clicking
          return;
        }
      }
      
      // Decay accumulator if not enough movement or in dead zone
      if (Math.abs(verticalMovementAccumulatorRef.current) < verticalThreshold || inDeadZone) {
        verticalMovementAccumulatorRef.current *= 0.95; // Decay slowly
      }
      
      // If horizontal is locked, skip horizontal movement calculation
      if (horizontalLockedRef.current) {
        // Only process vertical movement for scale changes
        // Horizontal movement is blocked
        return;
      }
      
      // Calculate horizontal movement (time navigation) - smooth and fluid with fret-like resistance
      // Movement is relative to center indicator's position for consistent haptic interaction
      const totalTime = currentTimelineData.endDate.getTime() - currentTimelineData.startDate.getTime();
      
      if (!dragStartPositionRef.current) {
        return;
      }
      
      // Calculate horizontal delta from center indicator's position (not from click position)
      // dragStartPositionRef.current.x is the center indicator's screen X position when drag started
      const horizontalDelta = e.clientX - dragStartPositionRef.current.x;
      
      // Convert pixel delta to timeline percentage (0-1)
      const deltaPercentage = horizontalDelta / rect.width;
      
      // Get the starting timeline position (center indicator position when drag started)
      const startTimelinePosition = dragStartPositionRef.current.timelinePosition / 100; // Convert to 0-1
      
      // Calculate current selected date position (may have changed during drag)
      const currentTimeOffset = currentSelectedDate.getTime() - currentTimelineData.startDate.getTime();
      const currentTimelinePosition = (currentTimeOffset / totalTime);
      
      // Calculate target position by applying delta relative to center indicator's current position
      // This ensures consistent haptic interaction regardless of where user started drag
      const rawTargetPosition = currentTimelinePosition + deltaPercentage;
      
      // Calculate distance from center when drag started (for dampening adjustment)
      const distanceFromCenter = Math.abs(startTimelinePosition - 0.5);
      
      // Apply distance-based dampening: the further from center, the more dampening
      // Scale from 0.02 (at edges) to 0.05 (at center) for molasses-like mechanical lever feel
      const baseDampening = 0.05 - (distanceFromCenter * 0.06); // Range: 0.05 at center, 0.02 at edges
      
      // Additional dampening for large distances to prevent fast jumps
      const distanceMagnitude = Math.abs(deltaPercentage);
      const distanceMultiplier = distanceMagnitude > 0.3 ? 0.6 : 1.0; // Extra dampening for large movements
      
      const combinedDampening = baseDampening * distanceMultiplier;
      
      // Apply fret-like resistance: deeper valleys between time points require more drag
      // Get all time points (frets) for the current view mode
      const currentAllScaleMarkings = allScaleMarkingsRef.current;
      const allMarks = currentAllScaleMarkings[currentViewMode];
      const allTimePoints = [...allMarks.major, ...allMarks.minor]
        .map(mark => mark.position / 100) // Convert to 0-1 range
        .sort((a, b) => a - b); // Sort for easier valley calculation
      
      // Calculate target position with gradual movement and fret resistance
      let targetMousePosition = rawTargetPosition;
      
      if (allTimePoints.length > 0) {
        // Find the two nearest time points (frets) to determine which valley we're in
        let leftFret = 0;
        let rightFret = 1;
        
        for (let i = 0; i < allTimePoints.length; i++) {
          if (allTimePoints[i] <= rawTargetPosition) {
            leftFret = allTimePoints[i];
          }
          if (allTimePoints[i] >= rawTargetPosition && rightFret === 1) {
            rightFret = allTimePoints[i];
            break;
          }
        }
        
        // Calculate position within the valley (between two frets)
        const valleyWidth = rightFret - leftFret;
        if (valleyWidth > 0) {
          const positionInValley = (rawTargetPosition - leftFret) / valleyWidth; // 0 to 1
          
          // Apply resistance curve: valleys require more drag - stronger curve for molasses-like mechanical lever feel
          const resistanceCurve = Math.pow(positionInValley, 5.0);
          
          // Map the resisted position back to timeline coordinates
          targetMousePosition = leftFret + (resistanceCurve * valleyWidth);
        }
      }
      
      // Gradually move from current position toward target position
      // Use current selected date position as the reference, not the start position
      const targetPosition = currentTimelinePosition + (targetMousePosition - currentTimelinePosition) * combinedDampening;
      
      // Clamp the target position
      const clampedTargetPosition = Math.max(0, Math.min(1, targetPosition));
      
      // Calculate time from target position
      const timeOffset = clampedTargetPosition * totalTime;
      const targetTime = currentTimelineData.startDate.getTime() + timeOffset;
      
      // Create date from time with resistance applied
      const finalDate = new Date(targetTime);
      
      // Clamp to visible range (shouldn't be necessary but safety check)
      let clampedDate: Date;
      if (finalDate < currentTimelineData.startDate) {
        clampedDate = currentTimelineData.startDate;
      } else if (finalDate > currentTimelineData.endDate) {
        clampedDate = currentTimelineData.endDate;
      } else {
        clampedDate = finalDate;
      }
      
      // Play micro blip for every date change during dragging
      // Compare dates at day level (ignore time component) - check BEFORE throttling
      // This ensures blips play immediately even if the update callback is throttled
      const lastBlipDate = lastBlipDateRef.current;
      const clampedDateDay = new Date(clampedDate.getFullYear(), clampedDate.getMonth(), clampedDate.getDate());
      const lastBlipDateDay = lastBlipDate ? new Date(lastBlipDate.getFullYear(), lastBlipDate.getMonth(), lastBlipDate.getDate()) : null;
      
      // Detect ALL date changes, even if we skip some updates due to throttling
      // If the date changed, play blip immediately (don't wait for throttle)
      if (!lastBlipDateDay || clampedDateDay.getTime() !== lastBlipDateDay.getTime()) {
        // Date has changed - play micro blip immediately
        // Try to resume audio context if suspended, but don't wait - play blip anyway
        const audioContext = getAudioContext();
        if (audioContext && audioContext.state === 'suspended') {
          audioContext.resume().catch(() => {
            // Silently fail - we'll try to play anyway
          });
        }
        playMicroBlip();
        
        // Store normalized date (day level only) for accurate comparison
        lastBlipDateRef.current = new Date(clampedDateDay);
      }
      
      // Reduced throttling for smoother movement - 16ms for ~60fps
      // This allows smooth fluid movement while still preventing excessive updates
      if (now - lastUpdateTimeRef.current < 16) {
        return;
      }
      
      lastUpdateTimeRef.current = now;
      
      // Update the selected date with smooth continuous movement
      currentOnTimePeriodSelect(clampedDate, currentViewMode);
    };

    const handleMouseUpGlobal = () => {
      setIsDragging(false);
      setHorizontalLocked(false);
      setRadialDial(null);
      setDragLimits(null);
      horizontalLockedRef.current = false;
      dragStartPositionRef.current = null;
      lastUpdateTimeRef.current = 0;
      lastVerticalPositionRef.current = 0;
      verticalMovementAccumulatorRef.current = 0;
      scaleChangeLockRef.current = false;
      initialMovementRef.current = null;
      lastScaleChangeAccumulatorRef.current = 0;
      deadZoneRef.current = 0;
      lastBlipDateRef.current = null; // Reset blip tracking when dragging ends
      currentDragTargetDateRef.current = null; // Reset drag target tracking
      // Timeline range remains locked - it only updates when viewMode changes
    };

    window.addEventListener('mousemove', handleMouseMoveGlobal);
    window.addEventListener('mouseup', handleMouseUpGlobal);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]); // Only depend on isDragging to avoid recreating handlers

  // Get context-aware labels for radial dial
  const getRadialDialLabels = () => {
    switch (viewMode) {
      case 'decade':
        return {
          left: 'Earlier Decades',
          right: 'Later Decades',
          up: 'Zoom In: Year',
          down: 'Zoom Out: Century',
        };
      case 'year':
        return {
          left: 'Earlier Years',
          right: 'Later Years',
          up: 'Zoom In: Month',
          down: 'Zoom Out: Decade',
        };
      case 'month':
        return {
          left: 'Earlier Months',
          right: 'Later Months',
          up: 'Zoom In: Week',
          down: 'Zoom Out: Year',
        };
      case 'week':
        return {
          left: 'Earlier Weeks',
          right: 'Later Weeks',
          up: 'Zoom In: Day',
          down: 'Zoom Out: Month',
        };
      case 'day':
        return {
          left: 'Earlier Days',
          right: 'Later Days',
          up: 'Zoom In: (Max)',
          down: 'Zoom Out: Week',
        };
      default:
        return {
          left: 'Earlier',
          right: 'Later',
          up: 'Zoom In',
          down: 'Zoom Out',
        };
    }
  };

  return (
    <div className="global-timeline-minimap">
      {/* Drag limits visualization - positioned relative to radial dial */}
      {isDragging && dragLimits && radialDial && (
        <div 
          className="drag-limits-overlay"
          style={{
            left: `${radialDial.x}px`,
            top: `${radialDial.y}px`,
          }}
        >
          {/* Dead zone indicators - show when dead zone is active */}
          {lastScaleChangeAccumulatorRef.current !== 0 && (
            <>
              <div 
                className="dead-zone-line dead-zone-top"
                style={{ top: `${dragLimits.deadZoneTop}px` }}
              />
              <div 
                className="dead-zone-line dead-zone-bottom"
                style={{ top: `${dragLimits.deadZoneBottom}px` }}
              />
              {/* Dead zone fill */}
              {Math.abs(dragLimits.deadZoneBottom - dragLimits.deadZoneTop) > 0 && (
                <div 
                  className="dead-zone-fill"
                  style={{ 
                    top: `${Math.min(dragLimits.deadZoneTop, dragLimits.deadZoneBottom)}px`,
                    height: `${Math.abs(dragLimits.deadZoneBottom - dragLimits.deadZoneTop)}px`
                  }}
                />
              )}
            </>
          )}
          {/* Vertical threshold indicators - show the 800px threshold boundaries */}
          <div 
            className="vertical-threshold-line vertical-threshold-top"
            style={{ top: `${dragLimits.thresholdTop}px` }}
          >
            <span className="threshold-label">800px</span>
          </div>
          <div 
            className="vertical-threshold-line vertical-threshold-bottom"
            style={{ top: `${dragLimits.thresholdBottom}px` }}
          >
            <span className="threshold-label">800px</span>
          </div>
          {/* Current position indicator */}
          {dragLimits.currentMovement !== undefined && (
            <>
              <div 
                className="current-movement-indicator"
                style={{ top: `${-dragLimits.currentMovement}px` }}
              >
                <span className="movement-label">
                  {Math.abs(dragLimits.currentMovement).toFixed(0)}px / 800px
                </span>
              </div>
              {/* Compact scale indicator showing relative distances */}
              <div className="compact-scale-indicator">
                <div className="scale-line scale-center" style={{ top: '0px' }}>
                  <span className="scale-label">Start</span>
                </div>
                {lastScaleChangeAccumulatorRef.current !== 0 && (
                  <>
                    <div 
                      className="scale-line scale-deadzone-top" 
                      style={{ top: `${dragLimits.deadZoneTop}px` }}
                    >
                      <span className="scale-label">Dead Zone</span>
                    </div>
                    <div 
                      className="scale-line scale-deadzone-bottom" 
                      style={{ top: `${dragLimits.deadZoneBottom}px` }}
                    >
                      <span className="scale-label">Dead Zone</span>
                    </div>
                  </>
                )}
                <div 
                  className="scale-line scale-threshold-top" 
                  style={{ top: `${dragLimits.thresholdTop}px` }}
                >
                  <span className="scale-label">800px</span>
                </div>
                <div 
                  className="scale-line scale-threshold-bottom" 
                  style={{ top: `${dragLimits.thresholdBottom}px` }}
                >
                  <span className="scale-label">800px</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {/* Radial dial for directional movement */}
      {radialDial && isDragging && (
        <div 
          className="radial-dial"
          style={{
            left: `${radialDial.x}px`,
            top: `${radialDial.y}px`,
          }}
        >
          <div className="radial-dial-center"></div>
          <div className="radial-dial-direction radial-dial-left" title={getRadialDialLabels().left}>
            <div className="radial-arrow">←</div>
            <div className="radial-label">{getRadialDialLabels().left}</div>
          </div>
          <div className="radial-dial-direction radial-dial-right" title={getRadialDialLabels().right}>
            <div className="radial-arrow">→</div>
            <div className="radial-label">{getRadialDialLabels().right}</div>
          </div>
          <div className="radial-dial-direction radial-dial-up" title={getRadialDialLabels().up}>
            <div className="radial-arrow">↑</div>
            <div className="radial-label">{getRadialDialLabels().up}</div>
          </div>
          <div className="radial-dial-direction radial-dial-down" title={getRadialDialLabels().down}>
            <div className="radial-arrow">↓</div>
            <div className="radial-label">{getRadialDialLabels().down}</div>
          </div>
        </div>
      )}
      {/* Mechanical click visual feedback */}
      {mechanicalClick && (
        <div className={`mechanical-click-feedback ${mechanicalClick.direction}`}>
          <div className="mechanical-gear">
            <div className="gear-tooth"></div>
            <div className="gear-tooth"></div>
            <div className="gear-tooth"></div>
            <div className="gear-tooth"></div>
            <div className="gear-tooth"></div>
            <div className="gear-tooth"></div>
          </div>
          <div className="mechanical-scale-label">{mechanicalClick.scale}</div>
        </div>
      )}
      <div 
        ref={containerRef}
        className={`minimap-container minimap-size-${minimapSize} ${isDragging ? 'dragging' : ''} ${mechanicalClick ? 'mechanical-click-active' : ''} ${horizontalLocked ? 'horizontal-locked' : ''}`}
        onMouseDown={handleMouseDown}
      >
        {/* Edge labels for time sections - positioned at center of each visual band */}
        <div className="edge-labels edge-labels-left">
          <div className="edge-label edge-label-decade" style={{ top: `${scaleYPositions.decade}px` }}>
            Decade
          </div>
          <div className="edge-label edge-label-year" style={{ top: `${scaleYPositions.year}px` }}>
            Year
          </div>
          <div className="edge-label edge-label-month" style={{ top: `${scaleYPositions.month}px` }}>
            Month
          </div>
          <div className="edge-label edge-label-week" style={{ top: `${scaleYPositions.week}px` }}>
            Week
          </div>
          <div className="edge-label edge-label-day" style={{ top: `${scaleYPositions.day}px` }}>
            Day
          </div>
        </div>
        <div className="edge-labels edge-labels-right">
          <div className="edge-label edge-label-decade" style={{ top: `${scaleYPositions.decade}px` }}>
            Decade
          </div>
          <div className="edge-label edge-label-year" style={{ top: `${scaleYPositions.year}px` }}>
            Year
          </div>
          <div className="edge-label edge-label-month" style={{ top: `${scaleYPositions.month}px` }}>
            Month
          </div>
          <div className="edge-label edge-label-week" style={{ top: `${scaleYPositions.week}px` }}>
            Week
          </div>
          <div className="edge-label edge-label-day" style={{ top: `${scaleYPositions.day}px` }}>
            Day
          </div>
        </div>
        {/* Fractal web background pattern */}
        <svg 
          className="fractal-web" 
          viewBox={`0 0 1000 ${minimapDimensions.height}`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
          style={{ imageRendering: 'crisp-edges' }}
        >
          <defs>
            <pattern id="fractalGrid" x="0" y="0" width="15" height="15" patternUnits="userSpaceOnUse">
              <circle cx="7.5" cy="7.5" r="0.4" fill="#c0c0c0" opacity="0.4" />
              <line x1="7.5" y1="0" x2="7.5" y2="15" stroke="#c0c0c0" strokeWidth="0.4" opacity="0.25" />
              <line x1="0" y1="7.5" x2="15" y2="7.5" stroke="#c0c0c0" strokeWidth="0.4" opacity="0.25" />
            </pattern>
            <pattern id="fractalWeb" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1.5" fill="#a0a0a0" opacity="0.3" />
              <line x1="20" y1="0" x2="20" y2="40" stroke="#a0a0a0" strokeWidth="0.6" opacity="0.2" />
              <line x1="0" y1="20" x2="40" y2="20" stroke="#a0a0a0" strokeWidth="0.6" opacity="0.2" />
              <line x1="0" y1="0" x2="40" y2="40" stroke="#a0a0a0" strokeWidth="0.4" opacity="0.15" />
              <line x1="40" y1="0" x2="0" y2="40" stroke="#a0a0a0" strokeWidth="0.4" opacity="0.15" />
              {/* Additional diagonal connections */}
              <line x1="10" y1="0" x2="10" y2="40" stroke="#a0a0a0" strokeWidth="0.3" opacity="0.1" />
              <line x1="30" y1="0" x2="30" y2="40" stroke="#a0a0a0" strokeWidth="0.3" opacity="0.1" />
              <line x1="0" y1="10" x2="40" y2="10" stroke="#a0a0a0" strokeWidth="0.3" opacity="0.1" />
              <line x1="0" y1="30" x2="40" y2="30" stroke="#a0a0a0" strokeWidth="0.3" opacity="0.1" />
            </pattern>
            <pattern id="fractalStrands" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <circle cx="40" cy="40" r="2" fill="#909090" opacity="0.25" />
              {/* Radial lines creating web structure */}
              <line x1="40" y1="40" x2="80" y2="40" stroke="#909090" strokeWidth="0.5" opacity="0.15" />
              <line x1="40" y1="40" x2="40" y2="0" stroke="#909090" strokeWidth="0.5" opacity="0.15" />
              <line x1="40" y1="40" x2="0" y2="40" stroke="#909090" strokeWidth="0.5" opacity="0.15" />
              <line x1="40" y1="40" x2="40" y2="80" stroke="#909090" strokeWidth="0.5" opacity="0.15" />
              <line x1="40" y1="40" x2="56.57" y2="23.43" stroke="#909090" strokeWidth="0.5" opacity="0.15" />
              <line x1="40" y1="40" x2="56.57" y2="56.57" stroke="#909090" strokeWidth="0.5" opacity="0.15" />
              <line x1="40" y1="40" x2="23.43" y2="56.57" stroke="#909090" strokeWidth="0.5" opacity="0.15" />
              <line x1="40" y1="40" x2="23.43" y2="23.43" stroke="#909090" strokeWidth="0.5" opacity="0.15" />
            </pattern>
            
            {/* Gradient definitions for separator lines - wider vibrant region for stronger minimap color focus */}
            {/* Colors based on viewMode to reflect the active time level, wider color region */}
            <linearGradient id="separatorGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#999" stopOpacity="0.2" />
              <stop offset={`${gradientStops.fadeStart * 100}%`} stopColor="#999" stopOpacity="0.2" />
              {/* Expand colorStart/End so the colored center covers a much wider band */}
              <stop offset={`${Math.max(0, gradientStops.colorStart - 0.11) * 100}%`} stopColor={activeColor} stopOpacity="0.5" />
              <stop offset={`${Math.max(0, gradientStops.colorStart) * 100}%`} stopColor={activeColor} stopOpacity="0.8" />
              <stop offset={`${Math.max(0, gradientStops.center - 0.065) * 100}%`} stopColor={activeColor} stopOpacity="1" />
              <stop offset={`${gradientStops.center * 100}%`} stopColor={activeColor} stopOpacity="1" />
              <stop offset={`${Math.min(1, gradientStops.center + 0.065) * 100}%`} stopColor={activeColor} stopOpacity="1" />
              <stop offset={`${Math.min(1, gradientStops.colorEnd) * 100}%`} stopColor={activeColor} stopOpacity="0.8" />
              <stop offset={`${Math.min(1, gradientStops.colorEnd + 0.11) * 100}%`} stopColor={activeColor} stopOpacity="0.5" />
              <stop offset={`${gradientStops.fadeEnd * 100}%`} stopColor="#999" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#999" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="separatorGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#999" stopOpacity="0.2" />
              <stop offset={`${gradientStops.fadeStart * 100}%`} stopColor="#999" stopOpacity="0.2" />
              <stop offset={`${Math.max(0, gradientStops.colorStart - 0.11) * 100}%`} stopColor={activeColor} stopOpacity="0.5" />
              <stop offset={`${Math.max(0, gradientStops.colorStart) * 100}%`} stopColor={activeColor} stopOpacity="0.8" />
              <stop offset={`${Math.max(0, gradientStops.center - 0.065) * 100}%`} stopColor={activeColor} stopOpacity="1" />
              <stop offset={`${gradientStops.center * 100}%`} stopColor={activeColor} stopOpacity="1" />
              <stop offset={`${Math.min(1, gradientStops.center + 0.065) * 100}%`} stopColor={activeColor} stopOpacity="1" />
              <stop offset={`${Math.min(1, gradientStops.colorEnd) * 100}%`} stopColor={activeColor} stopOpacity="0.8" />
              <stop offset={`${Math.min(1, gradientStops.colorEnd + 0.11) * 100}%`} stopColor={activeColor} stopOpacity="0.5" />
              <stop offset={`${gradientStops.fadeEnd * 100}%`} stopColor="#999" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#999" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="separatorGradient3" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#999" stopOpacity="0.2" />
              <stop offset={`${gradientStops.fadeStart * 100}%`} stopColor="#999" stopOpacity="0.2" />
              <stop offset={`${Math.max(0, gradientStops.colorStart - 0.11) * 100}%`} stopColor={activeColor} stopOpacity="0.5" />
              <stop offset={`${Math.max(0, gradientStops.colorStart) * 100}%`} stopColor={activeColor} stopOpacity="0.8" />
              <stop offset={`${Math.max(0, gradientStops.center - 0.065) * 100}%`} stopColor={activeColor} stopOpacity="1" />
              <stop offset={`${gradientStops.center * 100}%`} stopColor={activeColor} stopOpacity="1" />
              <stop offset={`${Math.min(1, gradientStops.center + 0.065) * 100}%`} stopColor={activeColor} stopOpacity="1" />
              <stop offset={`${Math.min(1, gradientStops.colorEnd) * 100}%`} stopColor={activeColor} stopOpacity="0.8" />
              <stop offset={`${Math.min(1, gradientStops.colorEnd + 0.11) * 100}%`} stopColor={activeColor} stopOpacity="0.5" />
              <stop offset={`${gradientStops.fadeEnd * 100}%`} stopColor="#999" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#999" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="separatorGradient4" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#999" stopOpacity="0.2" />
              <stop offset={`${gradientStops.fadeStart * 100}%`} stopColor="#999" stopOpacity="0.2" />
              <stop offset={`${Math.max(0, gradientStops.colorStart - 0.11) * 100}%`} stopColor={activeColor} stopOpacity="0.5" />
              <stop offset={`${Math.max(0, gradientStops.colorStart) * 100}%`} stopColor={activeColor} stopOpacity="0.8" />
              <stop offset={`${Math.max(0, gradientStops.center - 0.065) * 100}%`} stopColor={activeColor} stopOpacity="1" />
              <stop offset={`${gradientStops.center * 100}%`} stopColor={activeColor} stopOpacity="1" />
              <stop offset={`${Math.min(1, gradientStops.center + 0.065) * 100}%`} stopColor={activeColor} stopOpacity="1" />
              <stop offset={`${Math.min(1, gradientStops.colorEnd) * 100}%`} stopColor={activeColor} stopOpacity="0.8" />
              <stop offset={`${Math.min(1, gradientStops.colorEnd + 0.11) * 100}%`} stopColor={activeColor} stopOpacity="0.5" />
              <stop offset={`${gradientStops.fadeEnd * 100}%`} stopColor="#999" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#999" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#fractalGrid)" />
          <rect width="100%" height="100%" fill="url(#fractalWeb)" />
          <rect width="100%" height="100%" fill="url(#fractalStrands)" />
          
          {/* Background bands for each time section - expand when focused */}
          {timeScaleOrder.map((range, idx) => {
            const isFocused = range === viewMode;
            const baseHeight = 40 * minimapDimensions.scaleFactor;
            const focusedHeight = baseHeight + (25 * minimapDimensions.scaleFactor);
            const compressedHeight = baseHeight * 0.75;
            const sectionHeight = isFocused ? focusedHeight : compressedHeight;
            
            // Calculate Y position for this section's top
            let sectionTop = 0;
            timeScaleOrder.forEach((r, i) => {
              if (i < idx) {
                const prevIsFocused = r === viewMode;
                const prevBaseHeight = 40 * minimapDimensions.scaleFactor;
                const prevHeight = prevIsFocused ? prevBaseHeight + (25 * minimapDimensions.scaleFactor) : prevBaseHeight * 0.75;
                sectionTop += prevHeight;
              }
            });
            
            const sectionColor = getViewModeColor(range);
            const opacity = isFocused ? 0.15 : 0.08;
            
            return (
              <rect
                key={`section-band-${range}`}
                x="0"
                y={sectionTop}
                width="1000"
                height={sectionHeight}
                fill={sectionColor}
                opacity={opacity}
                style={{
                  transition: 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease, y 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
            );
          })}

          {/* Infinity tree trunk centered on the current indicator */}
          <line
            x1={Math.round(centerX) + 0.5}
            y1="0.5"
            x2={Math.round(centerX) + 0.5}
            y2={`${minimapDimensions.height - 0.5}`}
            stroke="#4a90e2"
            strokeWidth="2"
            opacity="0.55"
            className="infinity-tree-trunk"
            shapeRendering="crispEdges"
          />

          {/* Horizontal separator lines between time sections - dynamically positioned, full width */}
          {separatorPositions.map((yPos, idx) => {
            const gradientId = `separatorGradient${Math.min(idx + 1, 4)}`; // Use gradient 1-4
            const yPosFormatted = yPos + 0.5; // Add 0.5 for crisp pixel alignment
            
            return (
              <g key={`separator-${idx}`}>
                {/* Base line with gradient - spans full width */}
                <line
                  x1="0"
                  y1={yPosFormatted}
                  x2="1000"
                  y2={yPosFormatted}
                  stroke={`url(#${gradientId})`}
                  strokeWidth="1"
                  shapeRendering="crispEdges"
                />
                {/* Thicker center overlay for light-catching effect - spans full width */}
                <line
                  x1="0"
                  y1={yPosFormatted}
                  x2="1000"
                  y2={yPosFormatted}
                  stroke={activeColor}
                  strokeWidth="2"
                  opacity="0.8"
                  shapeRendering="crispEdges"
                  style={{ 
                    filter: `drop-shadow(0 0 2px ${activeColor})`
                  }}
                />
              </g>
            );
          })}

          {/* Fractaline crystalline web "infinity tree" branches for each time scale */}
          <g className="infinity-tree">
            {timeScaleOrder.map((scale) => {
              const isActiveScale = scale === viewMode;
              const levelIndex = timeScaleOrder.indexOf(scale);
              const baseOpacity = isActiveScale ? 0.9 : 0.35;
              const thickness = isActiveScale ? 2.6 : 1.6;
              const glowColorPrimary = '#4a90e2';
              const glowColorSecondary = '#90caf9';

              return (
                <g key={scale}>
                  {/* Primary crystalline branch */}
                  <path
                    d={buildInfinityBranchPath(scale, 'left')}
                    stroke={glowColorPrimary}
                    strokeWidth={thickness}
                    fill="none"
                    opacity={baseOpacity}
                    className={`infinity-tree-branch ${isActiveScale ? 'active' : ''}`}
                  />
                  <path
                    d={buildInfinityBranchPath(scale, 'right')}
                    stroke={glowColorSecondary}
                    strokeWidth={thickness - 0.4}
                    fill="none"
                    opacity={baseOpacity * 0.8}
                    className={`infinity-tree-branch secondary ${isActiveScale ? 'active' : ''}`}
                  />

                  {/* Subtle crystalline filaments hugging the scale band */}
                  <path
                    d={`M ${centerX - 12 * (levelIndex + 1)},${scaleYPositions[scale]} 
                        L ${centerX + 12 * (levelIndex + 1)},${scaleYPositions[scale]}`}
                    stroke={glowColorSecondary}
                    strokeWidth="0.8"
                    opacity={baseOpacity * 0.4}
                    className="infinity-tree-filament"
                  />
                </g>
              );
            })}
          </g>
          
          {/* All time scale levels - displayed simultaneously, localized to current indicator */}
          {/* DECADE SCALE (topmost, largest scale) */}
          {allScaleMarkings.decade.major
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = Math.round((mark.position / 100) * 1000) + 0.5;
            const isCurrentScale = viewMode === 'decade';
            return (
              <line
                key={`decade-major-${idx}`}
                x1={x}
                y1="0.5"
                x2={x}
                y2="40.5"
                stroke={isCurrentScale ? "#4a90e2" : "#333"}
                strokeWidth={isCurrentScale ? "4" : "3"}
                opacity={isCurrentScale ? "0.9" : "0.8"}
                shapeRendering="crispEdges"
              />
            );
          })}
          {allScaleMarkings.decade.minor
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = Math.round((mark.position / 100) * 1000) + 0.5;
            const isCurrentScale = viewMode === 'decade';
            return (
              <line
                key={`decade-minor-${idx}`}
                x1={x}
                y1="0.5"
                x2={x}
                y2="30.5"
                stroke={isCurrentScale ? "#6ab7ff" : "#555"}
                strokeWidth={isCurrentScale ? "3" : "2"}
                opacity={isCurrentScale ? "0.7" : "0.6"}
                shapeRendering="crispEdges"
              />
            );
          })}
          
          {/* YEAR SCALE */}
          {allScaleMarkings.year.major
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = Math.round((mark.position / 100) * 1000) + 0.5;
            const isCurrentScale = viewMode === 'year';
            return (
              <line
                key={`year-major-${idx}`}
                x1={x}
                y1="40.5"
                x2={x}
                y2="80.5"
                stroke={isCurrentScale ? "#4a90e2" : "#444"}
                strokeWidth={isCurrentScale ? "4" : "3"}
                opacity={isCurrentScale ? "0.85" : "0.75"}
                shapeRendering="crispEdges"
              />
            );
          })}
          {allScaleMarkings.year.minor
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = Math.round((mark.position / 100) * 1000) + 0.5;
            const isCurrentScale = viewMode === 'year';
            return (
              <line
                key={`year-minor-${idx}`}
                x1={x}
                y1="40.5"
                x2={x}
                y2="70.5"
                stroke={isCurrentScale ? "#6ab7ff" : "#666"}
                strokeWidth={isCurrentScale ? "2" : "2"}
                opacity={isCurrentScale ? "0.6" : "0.5"}
                shapeRendering="crispEdges"
              />
            );
          })}
          
          {/* MONTH SCALE (center, current view highlighted) */}
          {allScaleMarkings.month.major
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = Math.round((mark.position / 100) * 1000) + 0.5;
            const isCurrentScale = viewMode === 'month';
            return (
              <line
                key={`month-major-${idx}`}
                x1={x}
                y1="80.5"
                x2={x}
                y2="120.5"
                stroke={isCurrentScale ? "#4a90e2" : "#555"}
                strokeWidth={isCurrentScale ? "4" : "3"}
                opacity={isCurrentScale ? "0.9" : "0.7"}
                shapeRendering="crispEdges"
              />
            );
          })}
          {allScaleMarkings.month.minor
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = Math.round((mark.position / 100) * 1000) + 0.5;
            const isCurrentScale = viewMode === 'month';
            return (
              <line
                key={`month-minor-${idx}`}
                x1={x}
                y1="80.5"
                x2={x}
                y2="110.5"
                stroke={isCurrentScale ? "#6ab7ff" : "#777"}
                strokeWidth={isCurrentScale ? "2" : "1"}
                opacity={isCurrentScale ? "0.7" : "0.5"}
                shapeRendering="crispEdges"
              />
            );
          })}
          
          {/* WEEK SCALE */}
          {allScaleMarkings.week.major
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = Math.round((mark.position / 100) * 1000) + 0.5;
            const isCurrentScale = viewMode === 'week';
            return (
              <line
                key={`week-major-${idx}`}
                x1={x}
                y1="120.5"
                x2={x}
                y2="160.5"
                stroke={isCurrentScale ? "#4a90e2" : "#555"}
                strokeWidth={isCurrentScale ? "3" : "3"}
                opacity={isCurrentScale ? "0.8" : "0.6"}
                shapeRendering="crispEdges"
              />
            );
          })}
          {allScaleMarkings.week.minor
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = Math.round((mark.position / 100) * 1000) + 0.5;
            const isCurrentScale = viewMode === 'week';
            return (
              <line
                key={`week-minor-${idx}`}
                x1={x}
                y1="120.5"
                x2={x}
                y2="150.5"
                stroke={isCurrentScale ? "#6ab7ff" : "#888"}
                strokeWidth={isCurrentScale ? "1" : "1"}
                opacity={isCurrentScale ? "0.6" : "0.4"}
                shapeRendering="crispEdges"
              />
            );
          })}
          
          {/* DAY SCALE (bottommost, finest scale) */}
          {allScaleMarkings.day.major
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = Math.round((mark.position / 100) * 1000) + 0.5;
            const isCurrentScale = viewMode === 'day';
            return (
              <line
                key={`day-major-${idx}`}
                x1={x}
                y1="160.5"
                x2={x}
                y2="200.5"
                stroke={isCurrentScale ? "#4a90e2" : "#666"}
                strokeWidth={isCurrentScale ? "3" : "2"}
                opacity={isCurrentScale ? "0.7" : "0.5"}
                shapeRendering="crispEdges"
              />
            );
          })}
          {allScaleMarkings.day.minor
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = Math.round((mark.position / 100) * 1000) + 0.5;
            return (
              <line
                key={`day-minor-${idx}`}
                x1={x}
                y1="160.5"
                x2={x}
                y2="190.5"
                stroke="#999"
                strokeWidth="1"
                opacity="0.3"
                shapeRendering="crispEdges"
              />
            );
          })}
        </svg>
        
        {/* Scale labels for all levels - localized to current indicator */}
        <div className="scale-labels">
          {/* Decade labels */}
          {allScaleMarkings.decade.major
            .filter(mark => {
              // Ensure we have a valid label and a valid numeric position
              if (!mark.label) return false;
              if (!isFinite(mark.position)) return false;
              if (mark.position < 0 || mark.position > 100) return false;
              return true;
            })
            .map((mark, idx) => {
              // Explicitly ensure position is a valid number between 0 and 100
              const labelPosition = Math.max(0, Math.min(100, Number(mark.position)));
              
              // Get zodiac color for the decade
              const decadeStart = mark.date ? Math.floor(mark.date.getFullYear() / 10) * 10 : 0;
              const zodiacColor = getZodiacColorForDecade(decadeStart) || '#4a90e2';
              
              // Calculate opacity based on distance from indicator (fade with distance)
              const indicatorPosition = isFinite(currentIndicatorMetrics.position) 
                ? Number(currentIndicatorMetrics.position) 
                : 50; // Default to center if invalid
              const distanceFromIndicator = Math.abs(labelPosition - indicatorPosition);
              const maxDistanceForFade = 50; // Maximum distance for full fade (50% of timeline)
              const calculatedOpacity = 1 - (distanceFromIndicator / maxDistanceForFade);
              const labelOpacity = Math.max(0.1, Math.min(1, calculatedOpacity));
              
              // Build the style object explicitly to ensure all properties are set correctly
              const decadeLabelStyle: React.CSSProperties = {
                position: 'absolute',
                left: `${labelPosition}%`,
                top: '5px',
                color: zodiacColor,
                opacity: labelOpacity,
                transform: 'translateX(-50%)',
                WebkitTransform: 'translateX(-50%)',
                msTransform: 'translateX(-50%)',
                zIndex: 2,
                pointerEvents: 'none',
                marginLeft: 0,
                marginRight: 0,
                marginTop: 0,
                marginBottom: 0,
              };
              
              // Use truly unique key based on date and position to prevent React element reuse
              const decadeDateTimestamp = mark.date ? mark.date.getTime() : Date.now() + idx;
              const decadeUniqueKey = `decade-label-${decadeDateTimestamp}-${labelPosition}`;
              
              return (
                <div
                  key={decadeUniqueKey}
                  className={`scale-label decade-label ${viewMode === 'decade' ? 'current-scale' : ''}`}
                  style={decadeLabelStyle}
                  data-position={labelPosition}
                  data-label={mark.label}
                >
                  {mark.label}
                </div>
              );
            })}
          
          {/* Year labels */}
          {allScaleMarkings.year.major
            .filter(mark => {
              // Ensure we have a valid label and a valid numeric position
              if (!mark.label) return false;
              if (!isFinite(mark.position)) return false;
              if (mark.position < 0 || mark.position > 100) return false;
              return true;
            })
            .map((mark, idx) => {
              // Explicitly ensure position is a valid number between 0 and 100
              const labelPosition = Math.max(0, Math.min(100, Number(mark.position)));
              
              // Get zodiac color for the year
              const yearDate = mark.date ? new Date(mark.date.getFullYear(), 0, 1) : new Date();
              const zodiacColor = getZodiacColor(yearDate);
              
              // Calculate opacity based on distance from indicator (fade with distance)
              const indicatorPosition = isFinite(currentIndicatorMetrics.position) 
                ? Number(currentIndicatorMetrics.position) 
                : 50; // Default to center if invalid
              const distanceFromIndicator = Math.abs(labelPosition - indicatorPosition);
              const maxDistanceForFade = 50; // Maximum distance for full fade (50% of timeline)
              const calculatedOpacity = 1 - (distanceFromIndicator / maxDistanceForFade);
              const labelOpacity = Math.max(0.1, Math.min(1, calculatedOpacity));
              
              // Build the style object explicitly
              const yearLabelStyle: React.CSSProperties = {
                position: 'absolute',
                left: `${labelPosition}%`,
                top: '45px',
                color: zodiacColor,
                opacity: labelOpacity,
                transform: 'translateX(-50%)',
                WebkitTransform: 'translateX(-50%)',
                msTransform: 'translateX(-50%)',
                zIndex: 2,
                pointerEvents: 'none',
                marginLeft: 0,
                marginRight: 0,
                marginTop: 0,
                marginBottom: 0,
              };
              
              // Use truly unique key based on date and position to prevent React element reuse
              const yearDateTimestamp = mark.date ? mark.date.getTime() : Date.now() + idx;
              const yearUniqueKey = `year-label-${yearDateTimestamp}-${labelPosition}`;
              
              return (
                <div
                  key={yearUniqueKey}
                  className={`scale-label year-label ${viewMode === 'year' ? 'current-scale' : ''}`}
                  style={yearLabelStyle}
                  data-position={labelPosition}
                  data-label={mark.label}
                >
                  {mark.label}
                </div>
              );
            })}
          {allScaleMarkings.year.minor
            .filter(mark => {
              // Ensure we have a valid label and a valid numeric position
              if (!mark.label) return false;
              if (!mark.date) return false;
              if (!isFinite(mark.position)) return false;
              if (mark.position < 0 || mark.position > 100) return false;
              return true;
            })
            .map((mark, idx) => {
              // Explicitly ensure position is a valid number between 0 and 100
              // Position 0% is valid (start of timeline), only check if it's not finite
              let labelPosition = Number(mark.position);
              
              // Safety check: only recalculate if position is not finite (NaN or Infinity)
              // Position 0 is valid and should NOT trigger recalculation
              if (!isFinite(labelPosition)) {
                // Fallback: recalculate from date only if position is truly invalid
                if (mark.date && timelineData.startDate && timelineData.endDate) {
                  const timeOffset = mark.date.getTime() - timelineData.startDate.getTime();
                  const totalTime = timelineData.endDate.getTime() - timelineData.startDate.getTime();
                  if (totalTime > 0) {
                    labelPosition = Math.max(0, Math.min(100, (timeOffset / totalTime) * 100));
                  } else {
                    labelPosition = 0;
                  }
                } else {
                  labelPosition = 0;
                }
              }
              
              // Final validation and clamping - ensure we have a valid position (0-100 range)
              // Position can be 0 (start of timeline) or 100 (end of timeline)
              labelPosition = Math.max(0, Math.min(100, labelPosition));
              
              // Calculate opacity based on distance from indicator (fade with distance)
              const indicatorPosition = isFinite(currentIndicatorMetrics.position) 
                ? Number(currentIndicatorMetrics.position) 
                : 50; // Default to center if invalid
              const distanceFromIndicator = Math.abs(labelPosition - indicatorPosition);
              const maxDistanceForFade = 50; // Maximum distance for full fade (50% of timeline)
              const calculatedOpacity = 1 - (distanceFromIndicator / maxDistanceForFade);
              const labelOpacity = Math.max(0.1, Math.min(1, calculatedOpacity));
              
              // Use a truly unique key based on date timestamp to prevent React from reusing elements
              // This ensures each label gets its own DOM element even if positions are similar
              const dateTimestamp = mark.date ? mark.date.getTime() : Date.now() + idx;
              const uniqueKey = `year-minor-label-${dateTimestamp}-${labelPosition}`;
              
              // Get zodiac color for the month
              const monthDate = mark.date ? new Date(mark.date.getFullYear(), mark.date.getMonth(), 15) : new Date();
              const zodiacColor = getZodiacColor(monthDate);
              
              // Build the style object explicitly to ensure all properties are set correctly
              // CRITICAL: left must be set as a string with % to work correctly
              const leftValue = `${labelPosition}%`;
              
              const labelStyle: React.CSSProperties = {
                position: 'absolute',
                left: leftValue, // Explicitly set as percentage string
                top: '48px',
                color: zodiacColor,
                opacity: labelOpacity,
                transform: 'translateX(-50%)',
                WebkitTransform: 'translateX(-50%)',
                msTransform: 'translateX(-50%)',
                zIndex: 2,
                pointerEvents: 'none',
                marginLeft: 0,
                marginRight: 0,
                marginTop: 0,
                marginBottom: 0,
                // Force override any CSS that might conflict
                width: 'auto',
                height: 'auto',
              };
              
              // Debug: Log if label position is very small (might be clustering)
              if (labelPosition < 5 && idx < 10) {
                console.log(`[DEBUG] Year minor label cluster check: "${mark.label}" at position ${labelPosition}%, date: ${mark.date ? formatDate(mark.date) : 'no date'}, style left: ${labelStyle.left}`);
              }
              
              return (
                <div
                  key={uniqueKey}
                  className="scale-label year-minor-label"
                  style={labelStyle}
                  data-position={labelPosition}
                  data-label={mark.label}
                  data-debug={`pos:${labelPosition},opacity:${labelOpacity.toFixed(2)}`}
                >
                  {mark.label}
                </div>
              );
            })}
          
          {/* Month labels */}
          {allScaleMarkings.month.major
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
              const monthDate = mark.date ? new Date(mark.date.getFullYear(), mark.date.getMonth(), 15) : new Date();
              const zodiacColor = getZodiacColor(monthDate);
              return mark.label && (
                <div
                  key={`month-label-${idx}`}
                  className={`scale-label month-label ${viewMode === 'month' ? 'current-scale' : ''}`}
                  style={{ left: `${mark.position}%`, top: '85px', color: zodiacColor }}
                >
                  {mark.label}
                </div>
              );
            })}
          {allScaleMarkings.month.minor
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
              const monthDate = mark.date ? new Date(mark.date.getFullYear(), mark.date.getMonth(), 15) : new Date();
              const zodiacColor = getZodiacColor(monthDate);
              return mark.label && (
                <div
                  key={`month-minor-label-${idx}`}
                  className="scale-label month-minor-label"
                  style={{ left: `${mark.position}%`, top: '88px', color: zodiacColor }}
                >
                  {mark.label}
                </div>
              );
            })}
          
          {/* Week labels */}
          {allScaleMarkings.week.major
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => (
            mark.label && (
              <div
                key={`week-label-${idx}`}
                className={`scale-label week-label ${viewMode === 'week' ? 'current-scale' : ''}`}
                style={{ left: `${mark.position}%`, top: '125px' }}
              >
                {mark.label}
              </div>
            )
          ))}
          
          {/* Day labels */}
          {allScaleMarkings.day.major
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => (
            mark.label && (
              <div
                key={`day-label-${idx}`}
                className={`scale-label day-label ${viewMode === 'day' ? 'current-scale' : ''}`}
                style={{ left: `${mark.position}%`, top: '165px' }}
              >
                {mark.label}
              </div>
            )
          ))}
        </div>

        {/* Timeline segments */}
        <div className="timeline-segments">
          {timelineData.segments.map((segment, idx) => {
            const position = (idx / (timelineData.segments.length - 1)) * 100;
            const isNearCurrent = Math.abs(idx - timelineData.currentPosition) <= 1;
            
            return (
              <div
                key={idx}
                className={`timeline-segment ${segment.isCurrent ? 'current' : ''} ${isNearCurrent ? 'near-current' : ''}`}
                style={{ left: `${position}%` }}
                onClick={() => onTimePeriodSelect(segment.date, segment.viewMode)}
                title={formatDate(segment.date, 'MMM d, yyyy')}
              >
                <div className="segment-indicator" />
                {segment.isCurrent && (
                  <div className="segment-label">{segment.label}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Entry indicators */}
        <div className="entry-indicators">
          {entryPositions.map(({ entry, position, color, clusterIndex, clusterSize, clusterAngle, polygonClipPath, sides }, idx) => {
            const handleClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              const entryDate = new Date(entry.date);
              if (onEntrySelect) {
                onEntrySelect(entry);
              } else {
                onTimePeriodSelect(entryDate, entry.timeRange);
              }
            };
            
            const isInCluster = clusterSize !== undefined && clusterSize > 1;
            const clusterRadius = isInCluster ? (8 + (clusterSize! * 2)) : 0;
            const horizontalOffset = isInCluster && clusterAngle !== undefined 
              ? Math.cos(clusterAngle) * clusterRadius 
              : 0;
            const clusterVerticalOffset = isInCluster && clusterAngle !== undefined
              ? Math.sin(clusterAngle) * clusterRadius
              : 0;
            
            // Check if this entry's time section is currently focused
            const isFocusedSection = entry.timeRange === viewMode;
            
            // Position entry based on its timeRange - convert SVG Y coordinate to percentage
            // Position entry based on its timeRange - scaleYPositions are scaled based on minimap size
            const baseYPosition = scaleYPositions[entry.timeRange];
            const yPositionPercent = (baseYPosition / minimapDimensions.height) * 100;
            
            return (
              <div
                key={entry.id || idx}
                className={`entry-indicator-wrapper ${isInCluster ? 'in-cluster' : ''} ${isFocusedSection ? 'focused-section' : ''}`}
                style={{
                  left: `${position}%`,
                  top: isInCluster 
                    ? `calc(${yPositionPercent}% + ${clusterVerticalOffset}px)`
                    : `${yPositionPercent}%`,
                  transform: isInCluster 
                    ? `translate(calc(-50% + ${horizontalOffset}px), -50%) ${isFocusedSection ? 'scale(1.4)' : 'scale(1)'}`
                    : `translate(-50%, -50%) ${isFocusedSection ? 'scale(1.4)' : 'scale(1)'}`,
                  zIndex: isInCluster ? (clusterIndex || 0) + 4 : (isFocusedSection ? 5 : 4),
                  transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), z-index 0.5s ease',
                }}
                onClick={handleClick}
                title={`${entry.title} (${entry.timeRange})${isInCluster ? ` - ${clusterSize} entries` : ''}`}
                data-cluster-size={isInCluster ? clusterSize : undefined}
                data-cluster-index={isInCluster ? clusterIndex : undefined}
                onMouseEnter={(e) => {
                  if (isInCluster) {
                    e.currentTarget.style.transform = `translate(calc(-50% + ${horizontalOffset}px), -50%) scale(2.5)`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (isInCluster) {
                    e.currentTarget.style.transform = `translate(calc(-50% + ${horizontalOffset}px), -50%)`;
                  }
                }}
              >
                <div
                  className="entry-indicator"
                  style={{
                    '--gem-color': color,
                    '--polygon-clip': polygonClipPath,
                    animationDelay: isInCluster ? `${(clusterIndex || 0) * 0.2}s` : '0s',
                  } as React.CSSProperties & { '--gem-color': string; '--polygon-clip': string }}
                  data-sides={sides}
                />
              </div>
            );
          })}
        </div>

        {/* Current period highlight rectangle */}
        {timelineData.segments.length > 0 && (
          <div
            key="current-indicator"
            className="current-period-indicator"
            style={{ 
              left: `${currentIndicatorMetrics.position}%`,
              width: currentIndicatorMetrics.width,
            }}
          />
        )}
      </div>
    </div>
  );
}

