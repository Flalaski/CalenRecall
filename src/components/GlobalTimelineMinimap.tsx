import { useMemo, useState, useEffect, useRef } from 'react';
import { TimeRange, JournalEntry } from '../types';
import { formatDate, getWeekStart, getWeekEnd, getMonthStart, getMonthEnd, getYearEnd, getDecadeEnd, getZodiacColor, getZodiacColorForDecade, getCanonicalDate, parseISODate } from '../utils/dateUtils';
import { addDays, addWeeks, addMonths, addYears, getYear, getMonth, getDate } from 'date-fns';
import { playMechanicalClick, playMicroBlip, getAudioContext, createSliderNoise, SliderNoise } from '../utils/audioUtils';
import { calculateEntryColor } from '../utils/entryColorUtils';
import './GlobalTimelineMinimap.css';

interface GlobalTimelineMinimapProps {
  selectedDate: Date;
  viewMode: TimeRange;
  onTimePeriodSelect: (date: Date, viewMode: TimeRange) => void;
  onEntrySelect?: (entry: JournalEntry) => void;
  minimapSize?: 'small' | 'medium' | 'large';
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
// Helper function to convert hex color to rgba
function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex; // Return original if not a valid hex color
  
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Lighten a hex color for better readability on dark backgrounds
function lightenColor(hex: string, amount: number = 0.4): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  
  if (!result) return hex; // Return original if not a valid hex color
  
  const r = Math.min(255, parseInt(result[1], 16) + Math.round(255 * amount));
  const g = Math.min(255, parseInt(result[2], 16) + Math.round(255 * amount));
  const b = Math.min(255, parseInt(result[3], 16) + Math.round(255 * amount));
  
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
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
  const sliderNoiseRef = useRef<SliderNoise | null>(null); // Track continuous slider noise for vertical drag feedback
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

  // Get color for the currently selected segment of time based on zodiac colors
  const getSelectedSegmentColor = useMemo(() => {
    switch (viewMode) {
      case 'decade': {
        const decadeStart = Math.floor(getYear(selectedDate) / 10) * 10;
        return getZodiacColorForDecade(decadeStart) || '#9c27b0';
      }
      case 'year': {
        const yearDate = new Date(getYear(selectedDate), 0, 1);
        return getZodiacColor(yearDate) || '#0277bd';
      }
      case 'month': {
        const monthDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 15);
        return getZodiacColor(monthDate) || '#ef6c00';
      }
      case 'week': {
        // Use the middle of the week for color
        const weekStart = getWeekStart(selectedDate);
        const weekMiddle = addDays(weekStart, 3);
        return getZodiacColor(weekMiddle) || '#2e7d32';
      }
      case 'day': {
        return getZodiacColor(selectedDate) || '#4a90e2';
      }
      default:
        return '#4a90e2';
    }
  }, [selectedDate, viewMode]);

  // Calculate magnification scale based on distance from indicator
  // Uses an ease-out curve for smooth magnification effect
  const calculateMagnificationScale = (distanceFromIndicator: number, maxDistance: number = 50): number => {
    // Normalize distance to 0-1 range
    const normalizedDistance = Math.min(1, Math.abs(distanceFromIndicator) / maxDistance);
    
    // Use ease-out cubic curve: 1 - (1 - t)^3
    // This creates a smooth curve where labels near the indicator are much larger
    const easedDistance = 1 - Math.pow(1 - normalizedDistance, 3);
    
    // Magnification scale: 1.0 (at distance 0) to 0.5 (at max distance)
    // This means labels at the indicator are 2x size, fading to 1x at distance
    const minScale = 0.5; // Minimum scale at max distance
    const maxScale = 2.0; // Maximum scale at indicator (distance 0)
    
    return maxScale - (easedDistance * (maxScale - minScale));
  };

  // Calculate micro indicators for finer time scales within the main period
  const microIndicators = useMemo(() => {
    if (!timelineData.startDate || !timelineData.endDate) {
      return [];
    }

    const totalTime = timelineData.endDate.getTime() - timelineData.startDate.getTime();
    if (totalTime <= 0 || !isFinite(totalTime)) {
      return [];
    }

    // Get the main period boundaries
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
        periodEndDate = new Date(periodStartDate);
        periodEndDate.setHours(23, 59, 59, 999);
        break;
      default:
        periodEndDate = new Date(periodStartDate);
        periodEndDate.setHours(23, 59, 59, 999);
    }

    const periodDuration = periodEndDate.getTime() - periodStartDate.getTime();
    if (periodDuration <= 0 || !isFinite(periodDuration)) {
      return [];
    }

    const timeScaleOrder: TimeRange[] = ['decade', 'year', 'month', 'week', 'day'];
    const currentScaleIndex = timeScaleOrder.indexOf(viewMode);
    
    // Only show micro indicators for finer scales (those after current in the order)
    const finerScales = timeScaleOrder.slice(currentScaleIndex + 1);
    
    const indicators: Array<{
      scale: TimeRange;
      left: number; // Percentage from left edge of main indicator (0-100)
      width: number; // Percentage of main indicator width (0-100)
      color: string;
    }> = [];

    finerScales.forEach(scale => {
      // Get the start and end of this finer time period
      const finerPeriodStart = getCanonicalDate(selectedDate, scale);
      let finerPeriodEnd: Date;
      
      switch (scale) {
        case 'decade':
          finerPeriodEnd = getDecadeEnd(selectedDate);
          break;
        case 'year':
          finerPeriodEnd = getYearEnd(selectedDate);
          break;
        case 'month':
          finerPeriodEnd = getMonthEnd(selectedDate);
          break;
        case 'week':
          finerPeriodEnd = getWeekEnd(selectedDate);
          break;
        case 'day':
          finerPeriodEnd = new Date(finerPeriodStart);
          finerPeriodEnd.setHours(23, 59, 59, 999);
          break;
        default:
          finerPeriodEnd = new Date(finerPeriodStart);
          finerPeriodEnd.setHours(23, 59, 59, 999);
      }

      // Calculate position relative to main period start
      const finerStartTime = finerPeriodStart.getTime() - periodStartDate.getTime();
      const finerEndTime = finerPeriodEnd.getTime() - periodStartDate.getTime();
      
      // If the finer period is completely outside the main period, skip it
      if (finerEndTime < 0 || finerStartTime > periodDuration) {
        return;
      }

      // Clip the finer period to the main period boundaries
      const clippedStartTime = Math.max(0, finerStartTime);
      const clippedEndTime = Math.min(periodDuration, finerEndTime);
      
      // Calculate left position as percentage of main period width
      const leftPercent = (clippedStartTime / periodDuration) * 100;
      
      // Calculate width as percentage of main period width (using clipped duration)
      const clippedDuration = clippedEndTime - clippedStartTime;
      const widthPercent = (clippedDuration / periodDuration) * 100;
      
      // Clamp values to 0-100
      const left = Math.max(0, Math.min(100, leftPercent));
      const width = Math.max(0.1, Math.min(100, widthPercent)); // Minimum 0.1% width for visibility
      
      // Get zodiac color for this finer time period
      let color: string;
      switch (scale) {
        case 'year': {
          const yearDate = new Date(finerPeriodStart.getFullYear(), 0, 1);
          color = getZodiacColor(yearDate) || getViewModeColor(scale);
          break;
        }
        case 'month': {
          const monthDate = new Date(finerPeriodStart.getFullYear(), finerPeriodStart.getMonth(), 15);
          color = getZodiacColor(monthDate) || getViewModeColor(scale);
          break;
        }
        case 'week': {
          // Use the middle of the week for color
          const weekMiddle = addDays(finerPeriodStart, 3);
          color = getZodiacColor(weekMiddle) || getViewModeColor(scale);
          break;
        }
        case 'day': {
          color = getZodiacColor(finerPeriodStart) || getViewModeColor(scale);
          break;
        }
        default:
          color = getViewModeColor(scale);
      }
      
      indicators.push({
        scale,
        left,
        width,
        color,
      });
    });

    return indicators;
  }, [selectedDate, viewMode, timelineData]);

  // Localization range - only show scales within ±20% of the current indicator
  const LOCALIZATION_RANGE = 20; // percentage of timeline width

  // Center of the minimap in SVG coordinates (0–1000) for the "infinity tree" web
  const centerX = useMemo(() => {
    return (currentIndicatorMetrics.position / 100) * 1000;
  }, [currentIndicatorMetrics.position]);

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

  // Connection strategy types for adaptive extend variants
  type ConnectionStrategy = 'direct' | 'curved' | 'hierarchical' | 'web' | 'spiral' | 'organic';

  // Calculate connection path from fractal web to entry point
  interface ConnectionPath {
    path: string;
    strategy: ConnectionStrategy;
    distance: number;
    opacity: number;
    strokeWidth: number;
  }

  // Optimized fractal chain lightning path generator - performance-focused
  // Always ensures entry crystal is connected (endX, endY is entry position)
  const generateFractalLightningBranch = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    depth: number,
    maxDepth: number,
    entry: JournalEntry,
    branchSeed: string,
    allowSplits: boolean = true,
    isEntryEnd: boolean = true // Track if endX/endY is the entry crystal
  ): string => {
    // Validate inputs
    if (!isFinite(startX) || !isFinite(startY) || !isFinite(endX) || !isFinite(endY)) {
      return `L ${endX.toFixed(2)},${endY.toFixed(2)}`;
    }
    
    // Early termination for performance
    // Always end exactly at the target coordinates (entry crystal center)
    if (depth >= maxDepth) {
      // Use precise coordinates to ensure exact alignment with crystal center
      return `L ${endX.toFixed(2)},${endY.toFixed(2)}`;
    }

    // Cache distance calculation
    const dx = endX - startX;
    const dy = endY - startY;
    const distanceSq = dx * dx + dy * dy;
    const distance = Math.sqrt(distanceSq);
    
    // Check for invalid distance
    if (!isFinite(distance) || distance <= 0) {
      return `L ${endX.toFixed(2)},${endY.toFixed(2)}`;
    }
    
    // Skip recursion for very short distances (performance optimization)
    // Always end exactly at the target coordinates (entry crystal center)
    if (distance < 10 && depth > 0) {
      // Use precise coordinates to ensure exact alignment with crystal center
      return `L ${endX.toFixed(2)},${endY.toFixed(2)}`;
    }

    const midX = (startX + endX) * 0.5;
    const midY = (startY + endY) * 0.5;
    
    // Validate midpoints
    if (!isFinite(midX) || !isFinite(midY)) {
      return `L ${endX.toFixed(2)},${endY.toFixed(2)}`;
    }
    
    // Optimize: only calculate perpendicular if we need it
    const perpX = -dy / distance;
    const perpY = dx / distance;
    
    // Validate perpendicular vectors
    if (!isFinite(perpX) || !isFinite(perpY)) {
      return `L ${endX.toFixed(2)},${endY.toFixed(2)}`;
    }
    
    // Optimized jitter calculation - cache seed
    const jitterSeed = `${branchSeed}-${depth}`;
    const jitterMagnitude = distance * (0.15 - depth * 0.02);
    const jitterX = hashToVerticalOffset(jitterSeed, jitterMagnitude);
    const jitterY = hashToVerticalOffset(`${jitterSeed}-y`, jitterMagnitude);
    
    // Create branching point
    const branchX = midX + perpX * jitterX + (jitterX * 0.3);
    const branchY = midY + perpY * jitterY + (jitterY * 0.3);
    
    // Validate branch point
    if (!isFinite(branchX) || !isFinite(branchY)) {
      return `L ${endX.toFixed(2)},${endY.toFixed(2)}`;
    }
    
    // Optimized split decision - only allow splits at shallow depths and for certain entries
    const shouldSplit = allowSplits && 
                       depth < 2 && // Only split at first 2 levels
                       depth < maxDepth - 1 &&
                       (entry.id || 0) % (5 + depth * 2) === 0; // Less frequent splits
    
    if (shouldSplit) {
      // Simplified possibility branches - only create one side branch for performance
      const splitAngle = Math.PI / 6;
      const splitDistance = distance * 0.2; // Reduced from 0.25
      const baseAngle = Math.atan2(dy, dx);
      
      // Only create right branch (skip left for performance)
      const rightX = branchX + Math.cos(baseAngle + splitAngle) * splitDistance;
      const rightY = branchY + Math.sin(baseAngle + splitAngle) * splitDistance;
      
      // Recursively generate branches (limit recursion)
      // Main branch always connects to entry crystal
      const rightBranch = generateFractalLightningBranch(
        branchX, branchY, rightX, rightY, depth + 1, maxDepth, entry, `${branchSeed}-R`, false, false // Side branch, not entry
      );
      const mainBranch = generateFractalLightningBranch(
        branchX, branchY, endX, endY, depth + 1, maxDepth, entry, `${branchSeed}-M`, false, isEntryEnd // Main branch to entry
      );
      
      return `L ${branchX},${branchY} ${rightBranch} M ${branchX},${branchY} ${mainBranch}`;
    } else {
      // Continue main branch - always ensure it reaches entry crystal
      const nextBranch = generateFractalLightningBranch(
        branchX, branchY, endX, endY, depth + 1, maxDepth, entry, branchSeed, false, isEntryEnd
      );
      return `L ${branchX},${branchY} ${nextBranch}`;
    }
  };

  // Optimized cosmic timeline flow - performance-focused
  // Always ends at entry crystal
  const generateCosmicTimelineFlow = (
    webNodeX: number,
    webNodeY: number,
    entryX: number,
    entryY: number,
    entry: JournalEntry,
    levelIndex: number,
    simplified: boolean = false
  ): string => {
    // Validate inputs
    if (!isFinite(webNodeX) || !isFinite(webNodeY) || !isFinite(entryX) || !isFinite(entryY)) {
      return `M ${webNodeX},${webNodeY} L ${entryX},${entryY}`;
    }
    
    const dx = entryX - webNodeX;
    const dy = entryY - webNodeY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check for invalid distance
    if (!isFinite(distance) || distance <= 0) {
      return `M ${webNodeX},${webNodeY} L ${entryX},${entryY}`;
    }
    
    // Reduce steps for performance
    const flowSteps = simplified ? 4 : Math.min(6 + levelIndex, 10); // Cap at 10 steps
    const timeFlow: string[] = [`M ${webNodeX},${webNodeY}`];
    
    // Pre-calculate constants
    const entryIdHash = (entry.id || 0) * 0.1;
    const amplitudeBase = distance * 0.08;
    
    // Create flowing timeline with cosmic curvature
    for (let i = 0; i < flowSteps; i++) {
      const t = i / flowSteps;
      const baseX = webNodeX + dx * t;
      const baseY = webNodeY + dy * t;
      
      // Optimized cosmic flow calculation
      const timePhase = entryIdHash + t * Math.PI * 2;
      const cosmicAmplitude = amplitudeBase * (1 - t * 0.5);
      const sinPhase = Math.sin(timePhase);
      const cosPhase = Math.cos(timePhase * 1.3);
      
      const flowX = baseX + sinPhase * cosmicAmplitude;
      const flowY = baseY + cosPhase * cosmicAmplitude * 0.7;
      
      // Validate flow coordinates
      if (!isFinite(flowX) || !isFinite(flowY)) {
        continue; // Skip invalid points
      }
      
      // Reduced ripple frequency for performance (only every 4th step)
      if (!simplified && i % 4 === 0 && i > 0 && i < flowSteps) {
        const rippleAngle = timePhase * 2;
        const rippleRadius = distance * 0.02; // Reduced from 0.03
        const rippleX = flowX + Math.cos(rippleAngle) * rippleRadius;
        const rippleY = flowY + Math.sin(rippleAngle) * rippleRadius;
        
        // Validate ripple coordinates
        if (isFinite(rippleX) && isFinite(rippleY)) {
          timeFlow.push(`L ${rippleX},${rippleY} L ${flowX},${flowY}`);
        } else {
          timeFlow.push(`L ${flowX},${flowY}`);
        }
      } else {
        timeFlow.push(`L ${flowX},${flowY}`);
      }
    }
    
    // Always end exactly at entry crystal center - use precise coordinates
    timeFlow.push(`L ${entryX.toFixed(2)},${entryY.toFixed(2)}`);
    
    return timeFlow.join(' ');
  };

  // Optimized chain lightning generator - performance-focused
  // Always ends at entry crystal
  const generateChainLightning = (
    webNodeX: number,
    webNodeY: number,
    entryX: number,
    entryY: number,
    entry: JournalEntry,
    levelIndex: number,
    simplified: boolean = false
  ): string => {
    // Validate inputs
    if (!isFinite(webNodeX) || !isFinite(webNodeY) || !isFinite(entryX) || !isFinite(entryY)) {
      return `M ${webNodeX},${webNodeY} L ${entryX},${entryY}`;
    }
    
    // Cap segments for performance
    const segments = simplified ? 3 : Math.min(4 + levelIndex, 6); // Cap at 6 segments
    const lightning: string[] = [`M ${webNodeX},${webNodeY}`];
    
    const dx = entryX - webNodeX;
    const dy = entryY - webNodeY;
    const entryId = entry.id || 0;
    
    // Generate intermediate points, but always end at entry crystal
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const baseX = webNodeX + dx * t;
      const baseY = webNodeY + dy * t;
      
      // Optimized lightning jitter
      const lightningSeed = `${entryId}-${i}`;
      const jitterScale = 20 * (1 - t * 0.7);
      const jitterX = hashToVerticalOffset(lightningSeed, jitterScale);
      const jitterY = hashToVerticalOffset(`${lightningSeed}-y`, jitterScale);
      
      const lightningX = baseX + jitterX;
      const lightningY = baseY + jitterY;
      
      // Validate lightning coordinates
      if (!isFinite(lightningX) || !isFinite(lightningY)) {
        continue; // Skip invalid points
      }
      
      lightning.push(`L ${lightningX},${lightningY}`);
      
      // Reduced side branch frequency for performance (only every 3rd segment)
      if (!simplified && i % 3 === 0 && i < segments) {
        const branchLength = 12 * (1 - t); // Reduced from 15
        const branchAngle = (entryId % 360) * Math.PI / 180;
        const branchX = lightningX + Math.cos(branchAngle) * branchLength;
        const branchY = lightningY + Math.sin(branchAngle) * branchLength;
        
        // Validate branch coordinates
        if (isFinite(branchX) && isFinite(branchY)) {
          lightning.push(`L ${branchX},${branchY} M ${lightningX},${lightningY}`);
        }
      }
    }
    
    // Always end exactly at entry crystal center - no jitter on final point, use precise coordinates
    lightning.push(`L ${entryX.toFixed(2)},${entryY.toFixed(2)}`);
    return lightning.join(' ');
  };

  // Build adaptive connection path from web node to entry point
  // Enhanced with fractal chain lightning and cosmic timeline nature
  // Localized to entry crystal with viewport culling
  const buildConnectionPath = (
    webNodeX: number,
    webNodeY: number,
    entryX: number,
    entryY: number,
    strategy: ConnectionStrategy,
    entry: JournalEntry,
    levelIndex: number,
    viewportBounds?: { minX: number; maxX: number; minY: number; maxY: number },
    lodLevel?: 'high' | 'medium' | 'low' | 'minimal' | 'ultraMinimal'
  ): ConnectionPath | null => {
    // Validate inputs - check for NaN or invalid values
    if (!isFinite(webNodeX) || !isFinite(webNodeY) || !isFinite(entryX) || !isFinite(entryY)) {
      return null;
    }
    
    const distance = Math.sqrt(Math.pow(entryX - webNodeX, 2) + Math.pow(entryY - webNodeY, 2));
    
    // Check for invalid distance
    if (!isFinite(distance) || distance <= 0) {
      return null;
    }
    
    // Localization: Limit connection distance to keep them near entry crystals
    const maxLocalizedDistance = 300; // Maximum distance from entry crystal
    if (distance > maxLocalizedDistance) {
      // Clamp web node to be within localized distance
      const angle = Math.atan2(entryY - webNodeY, entryX - webNodeX);
      webNodeX = entryX - Math.cos(angle) * maxLocalizedDistance;
      webNodeY = entryY - Math.sin(angle) * maxLocalizedDistance;
    }
    
    // Viewport culling: Check if connection is visible
    if (viewportBounds) {
      const entryVisible = entryX >= viewportBounds.minX - 50 && 
                          entryX <= viewportBounds.maxX + 50 &&
                          entryY >= viewportBounds.minY - 50 && 
                          entryY <= viewportBounds.maxY + 50;
      const webNodeVisible = webNodeX >= viewportBounds.minX - 50 && 
                            webNodeX <= viewportBounds.maxX + 50 &&
                            webNodeY >= viewportBounds.minY - 50 && 
                            webNodeY <= viewportBounds.maxY + 50;
      
      // If neither entry nor web node is visible, skip this connection
      if (!entryVisible && !webNodeVisible) {
        return null;
      }
    }
    
    const maxDistance = 1000; // Maximum expected distance in SVG coordinates
    const normalizedDistance = Math.min(1, distance / maxDistance);
    
    // Calculate opacity based on distance and entry properties
    const baseOpacity = 0.3 + (1 - normalizedDistance) * 0.4;
    const timeRangeOpacity = entry.timeRange === viewMode ? 1.0 : 0.6;
    const finalOpacity = baseOpacity * timeRangeOpacity;
    
    // Calculate stroke width based on distance and time range
    const baseStrokeWidth = 0.8 + (1 - normalizedDistance) * 0.4;
    const timeRangeWeight = entry.timeRange === 'decade' ? 1.5 : 
                           entry.timeRange === 'year' ? 1.3 :
                           entry.timeRange === 'month' ? 1.1 :
                           entry.timeRange === 'week' ? 0.9 : 0.7;
    const finalStrokeWidth = baseStrokeWidth * timeRangeWeight;

    let path: string;
    const branchSeed = `${entry.id || entry.date}-${webNodeX}-${webNodeY}`;
    
    // Performance optimization: use simplified paths for low LOD or distant connections
    // Ultra-minimal LOD (decades view with many entries) uses very simple paths
    const useSimplified = normalizedDistance > 0.7 || distance > 500 || lodLevel === 'ultraMinimal';
    // For ultra-minimal, use depth 1 (straight line with minimal branching)
    const maxDepth = lodLevel === 'ultraMinimal' ? 1 : (useSimplified ? 2 : Math.min(3 + Math.floor(levelIndex / 2), 4)); // Cap at 4

    switch (strategy) {
      case 'direct':
        // Fractal chain lightning - optimized recursion, always ends at entry crystal
        path = `M ${webNodeX},${webNodeY} ${generateFractalLightningBranch(webNodeX, webNodeY, entryX, entryY, 0, maxDepth, entry, branchSeed, !useSimplified, true)}`;
        break;

      case 'curved':
        // Cosmic timeline flow - always ends at entry crystal
        path = generateCosmicTimelineFlow(webNodeX, webNodeY, entryX, entryY, entry, levelIndex, useSimplified);
        break;

      case 'hierarchical':
        // Chain lightning - always ends at entry crystal
        path = generateChainLightning(webNodeX, webNodeY, entryX, entryY, entry, levelIndex, useSimplified);
        break;

      case 'web':
        // Fractal web - limited depth, always ends at entry crystal
        const webMaxDepth = useSimplified ? 2 : Math.min(3, 2 + levelIndex);
        path = `M ${webNodeX},${webNodeY} ${generateFractalLightningBranch(webNodeX, webNodeY, entryX, entryY, 0, webMaxDepth, entry, `${branchSeed}-web`, false, true)}`;
        break;

      case 'spiral':
        // Optimized spiral with fewer branches, always ends at entry crystal
        const centerX = (webNodeX + entryX) * 0.5;
        const centerY = (webNodeY + entryY) * 0.5;
        
        // Validate center coordinates
        if (!isFinite(centerX) || !isFinite(centerY)) {
          path = `M ${webNodeX},${webNodeY} L ${entryX},${entryY}`;
          break;
        }
        
        const radius = distance * 0.5;
        const spiralTurns = 0.5 + levelIndex * 0.2;
        const spiralPath: string[] = [`M ${webNodeX},${webNodeY}`];
        const spiralSteps = useSimplified ? 10 : 15; // Reduced from 20
        for (let i = 0; i < spiralSteps; i++) {
          const t = i / spiralSteps;
          const angle = t * Math.PI * 2 * spiralTurns;
          const r = radius * t;
          const x = centerX + r * Math.cos(angle);
          const y = centerY + r * Math.sin(angle);
          
          // Validate coordinates before adding to path
          if (isFinite(x) && isFinite(y)) {
            spiralPath.push(`${i === 0 ? 'M' : 'L'} ${x},${y}`);
            
            // Reduced branch frequency (every 7th step instead of 5th)
            if (!useSimplified && i % 7 === 0 && i > 0 && i < spiralSteps) {
              const branchAngle = angle + Math.PI / 4;
              const branchLength = radius * 0.12; // Reduced from 0.15
              const branchX = x + Math.cos(branchAngle) * branchLength;
              const branchY = y + Math.sin(branchAngle) * branchLength;
              
              // Validate branch coordinates
              if (isFinite(branchX) && isFinite(branchY)) {
                spiralPath.push(`L ${branchX},${branchY} M ${x},${y}`);
              }
            }
          }
        }
        // Always end exactly at entry crystal center - use precise coordinates
        spiralPath.push(`L ${entryX.toFixed(2)},${entryY.toFixed(2)}`);
        path = spiralPath.join(' ');
        break;

      case 'organic':
        // Simplified organic - single path instead of overlay, always ends at entry crystal
        const organicMaxDepth = useSimplified ? 2 : Math.min(3, 2 + levelIndex);
        if (useSimplified) {
          // Use simple cosmic flow for simplified mode
          path = generateCosmicTimelineFlow(webNodeX, webNodeY, entryX, entryY, entry, levelIndex, true);
        } else {
          const organicBase = generateFractalLightningBranch(webNodeX, webNodeY, entryX, entryY, 0, organicMaxDepth, entry, `${branchSeed}-organic`, false, true);
          path = `M ${webNodeX},${webNodeY} ${organicBase}`;
        }
        break;

      default:
        // Default to optimized fractal, always ends at entry crystal
        path = `M ${webNodeX},${webNodeY} ${generateFractalLightningBranch(webNodeX, webNodeY, entryX, entryY, 0, maxDepth, entry, branchSeed, false, true)}`;
    }

    return {
      path,
      strategy,
      distance,
      opacity: finalOpacity,
      strokeWidth: finalStrokeWidth,
    };
  };

  // Check if a point is within viewport bounds (with margin)
  const isPointInViewport = (
    x: number,
    y: number,
    viewportBounds: { minX: number; maxX: number; minY: number; maxY: number },
    margin: number = 50
  ): boolean => {
    return x >= viewportBounds.minX - margin &&
           x <= viewportBounds.maxX + margin &&
           y >= viewportBounds.minY - margin &&
           y <= viewportBounds.maxY + margin;
  };

  // Calculate web nodes for fractal connections
  // These are strategic points on the fractal web that serve as connection hubs
  const webNodes = useMemo(() => {
    const nodes: Array<{ x: number; y: number; scale: TimeRange; level: number }> = [];
    
    // Create nodes along the infinity tree branches
    timeScaleOrder.forEach((scale, levelIndex) => {
      const yPos = scaleYPositions[scale];
      
      // Primary nodes on left and right branches
      const leftBranchX = centerX - (80 + levelIndex * 25);
      const rightBranchX = centerX + (80 + levelIndex * 25);
      
      nodes.push(
        { x: leftBranchX, y: yPos, scale, level: levelIndex },
        { x: rightBranchX, y: yPos, scale, level: levelIndex }
      );
      
      // Secondary nodes for web density
      if (levelIndex > 0) {
        const secondaryLeftX = centerX - (40 + levelIndex * 15);
        const secondaryRightX = centerX + (40 + levelIndex * 15);
        
        // Validate secondary node coordinates
        if (isFinite(secondaryLeftX) && isFinite(secondaryRightX)) {
          nodes.push(
            { x: secondaryLeftX, y: yPos, scale, level: levelIndex },
            { x: secondaryRightX, y: yPos, scale, level: levelIndex }
          );
        }
      }
      
      // Tertiary nodes for fine-grained connections
      if (levelIndex > 1) {
        const tertiaryLeftX = centerX - (20 + levelIndex * 8);
        const tertiaryRightX = centerX + (20 + levelIndex * 8);
        
        // Validate tertiary node coordinates
        if (isFinite(tertiaryLeftX) && isFinite(tertiaryRightX)) {
          nodes.push(
            { x: tertiaryLeftX, y: yPos, scale, level: levelIndex },
            { x: tertiaryRightX, y: yPos, scale, level: levelIndex }
          );
        }
      }
    });
    
    // Add center trunk nodes
    const trunkNodes = 5;
    for (let i = 0; i < trunkNodes; i++) {
      const yPos = (minimapDimensions.height / trunkNodes) * (i + 0.5);
      
      // Validate trunk node coordinates
      if (isFinite(yPos) && isFinite(centerX)) {
        nodes.push({ x: centerX, y: yPos, scale: viewMode, level: 0 });
      }
    }
    
    return nodes;
  }, [centerX, scaleYPositions, timeScaleOrder, viewMode, minimapDimensions.height]);

  // Performance optimization: Level of Detail (LOD) thresholds
  const LOD_THRESHOLDS = {
    high: 50,    // Show all connections with full detail
    medium: 150, // Show primary connections only
    low: 300,    // Show only same-scale connections
    minimal: 500, // Show only nearest connections
    ultraMinimal: 1000, // Decades view: minimal connections, no entry-to-entry
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
    
    // Determine which scales to calculate based on viewMode
    // Always calculate current scale + one level above/below for context
    const scalesToCalculate = new Set<TimeRange>([viewMode]);
    const scaleIndex = timeScaleOrder.indexOf(viewMode);
    if (scaleIndex > 0) scalesToCalculate.add(timeScaleOrder[scaleIndex - 1]); // Add scale above
    if (scaleIndex < timeScaleOrder.length - 1) scalesToCalculate.add(timeScaleOrder[scaleIndex + 1]); // Add scale below
    
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
    // For decades view, limit year markings to every 5 years to reduce DOM elements
    const yearStep = viewMode === 'decade' ? 5 : 1;
    for (let year = startYear; year <= endYear; year += yearStep) {
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

    // MONTH SCALE - only calculate if needed
    if (scalesToCalculate.has('month')) {
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
    }

    // WEEK SCALE - only calculate if needed
    if (scalesToCalculate.has('week')) {
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
    }

    // DAY SCALE - only calculate if needed, limit to reasonable number
    if (scalesToCalculate.has('day')) {
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
  }, [timelineData, viewMode, timeScaleOrder]);


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
    if (totalTime <= 0 || !isFinite(totalTime)) {
      return [];
    }
    
    const verticalVariance = 60; // Maximum vertical offset in pixels (30px up/down from center)
    
    // OPTIMIZATION: Pre-calculate timeline boundaries for quick range checks
    const timelineStartTime = timelineData.startDate.getTime();
    const timelineEndTime = timelineData.endDate.getTime();
    
    // OPTIMIZATION: Filter entries early - only process entries that could be in the timeline range
    // For decade view, we can quickly check if an entry's year falls within the decade range
    // This avoids expensive date parsing and canonical date calculations for entries outside the range
    const filteredEntries: JournalEntry[] = [];
    
    for (const entry of entries) {
      // Quick pre-check: parse just the year to see if entry could be in range
      const dateParts = entry.date.split('-');
      if (dateParts.length < 3) continue; // Skip invalid dates
      
      const year = parseInt(dateParts[0], 10);
      if (isNaN(year)) continue;
      
      // Quick year-based range check (works for all timeRanges, but especially efficient for decade view)
      // Create a rough date range for this entry's year
      const entryYearStart = new Date(year, 0, 1).getTime();
      const entryYearEnd = new Date(year, 11, 31, 23, 59, 59, 999).getTime();
      
      // Check if this entry's year overlaps with the timeline range
      // If the entry's year is completely outside the timeline, skip it
      if (entryYearEnd < timelineStartTime || entryYearStart > timelineEndTime) {
        continue; // Skip entries outside the timeline range
      }
      
      filteredEntries.push(entry);
    }
    
    // If no entries are in range, return early
    if (filteredEntries.length === 0) {
      return [];
    }
    
    // Group entries by date and timeRange to create clusters
    const clusterGroups = new Map<string, Array<{ entry: JournalEntry; position: number; color: string }>>();
    
    filteredEntries.forEach(entry => {
      // Parse date string (YYYY-MM-DD) as local date to avoid timezone issues
      // new Date("2025-12-04") interprets as UTC, but we need local time
      const dateParts = entry.date.split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
      const day = parseInt(dateParts[2], 10);
      const rawEntryDate = new Date(year, month, day);
      
      // Use canonical date for the entry's timeRange to match how timeline segments are positioned
      const entryDate = getCanonicalDate(rawEntryDate, entry.timeRange);
      const entryTime = entryDate.getTime() - timelineStartTime;
      
      // Final range check: ensure entry is actually within timeline after canonical date calculation
      if (entryTime < 0 || entryTime > totalTime) {
        return; // Skip entries outside the timeline after canonical date calculation
      }
      
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
    
    // Debug: Log cluster information (only if we have entries to process)
    if (clusterGroups.size > 0) {
      console.log(`[TimelineMinimap] Processing ${filteredEntries.length} entries (filtered from ${entries.length} total) into ${clusterGroups.size} clusters`);
      clusterGroups.forEach((group, key) => {
        if (group.length > 1) {
          console.log(`[TimelineMinimap] Cluster ${key}: ${group.length} entries`);
        }
      });
    }
    
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

  // Calculate viewport bounds in SVG coordinates for connection culling
  const viewportBounds = useMemo(() => {
    // Calculate visible viewport in SVG coordinates (0-1000 width, 0-height)
    const viewportMargin = 100; // pixels margin for pre-rendering
    const visibleStartPercent = Math.max(0, currentIndicatorMetrics.position - 20); // 20% margin
    const visibleEndPercent = Math.min(100, currentIndicatorMetrics.position + 20);
    
    return {
      minX: (visibleStartPercent / 100) * 1000 - viewportMargin,
      maxX: (visibleEndPercent / 100) * 1000 + viewportMargin,
      minY: -viewportMargin,
      maxY: minimapDimensions.height + viewportMargin,
    };
  }, [currentIndicatorMetrics.position, minimapDimensions.height]);

  // Calculate main focus web node (center of present focus)
  const focusWebNode = useMemo(() => {
    // Focus node is at the center indicator position, at the current viewMode's Y position
    const focusX = centerX;
    const focusY = scaleYPositions[viewMode];
    return { x: focusX, y: focusY, scale: viewMode, level: 0, isFocus: true };
  }, [centerX, scaleYPositions, viewMode]);

  // Calculate all connections from web nodes to entry points with performance optimizations
  // Includes entry-to-entry connections and connections to main focus web
  const memoryWebConnections = useMemo(() => {
    if (entryPositions.length === 0 || webNodes.length === 0) {
      return [];
    }

    // Determine LOD level based on entry count
    // Decades view gets more aggressive LOD due to large time range
    let lodLevel: 'high' | 'medium' | 'low' | 'minimal' | 'ultraMinimal';
    const entryCount = entryPositions.length;
    const isDecadesView = viewMode === 'decade';
    
    if (entryCount <= LOD_THRESHOLDS.high) {
      lodLevel = 'high';
    } else if (entryCount <= LOD_THRESHOLDS.medium) {
      lodLevel = 'medium';
    } else if (entryCount <= LOD_THRESHOLDS.low) {
      lodLevel = 'low';
    } else if (entryCount <= LOD_THRESHOLDS.minimal) {
      lodLevel = 'minimal';
    } else {
      lodLevel = 'ultraMinimal';
    }
    
    // Decades view: use more aggressive LOD (one level lower)
    if (isDecadesView && lodLevel !== 'ultraMinimal') {
      if (lodLevel === 'high') lodLevel = 'medium';
      else if (lodLevel === 'medium') lodLevel = 'low';
      else if (lodLevel === 'low') lodLevel = 'minimal';
      else if (lodLevel === 'minimal') lodLevel = 'ultraMinimal';
    }

    // Viewport culling: only process entries within visible range plus margin
    // Decades view uses smaller margin (10%) since 20% of 110 years = 22 years
    const viewportMargin = viewMode === 'decade' ? 10 : 20; // percentage margin for pre-rendering
    const visibleStart = Math.max(0, currentIndicatorMetrics.position - viewportMargin);
    const visibleEnd = Math.min(100, currentIndicatorMetrics.position + viewportMargin);

    const connections: Array<{
      connection: ConnectionPath;
      entry: JournalEntry;
      webNode?: { x: number; y: number; scale: TimeRange; level: number };
      targetEntry?: JournalEntry;
      entryPosition: { x: number; y: number };
      targetPosition?: { x: number; y: number };
      lodLevel: string;
      connectionType: 'web' | 'entry-to-entry' | 'focus';
    }> = [];

    // Filter entries by viewport for performance
    // Only process entries that are actually visible in the current viewport
    const visibleEntries = entryPositions.filter(({ entry, position, verticalOffset }) => {
      // Check if entry is within visible range
      if (position < visibleStart || position > visibleEnd) {
        return false;
      }
      
      // Convert to SVG coordinates to check viewport bounds
      const entryX = (position / 100) * 1000;
      const baseYPosition = scaleYPositions[entry.timeRange];
      const entryY = baseYPosition + verticalOffset;
      
      // Validate coordinates before checking viewport
      if (!isFinite(entryX) || !isFinite(entryY) || !isFinite(baseYPosition) || !isFinite(verticalOffset)) {
        return false; // Exclude entries with invalid coordinates
      }
      
      // Only include entries that are actually in the viewport
      return isPointInViewport(entryX, entryY, viewportBounds, 150);
    });

    // If too many visible entries, use spatial clustering
    // Ultra-minimal LOD for decades view with many entries
    const maxConnectionsPerFrame = lodLevel === 'high' ? Infinity :
                                   lodLevel === 'medium' ? 200 :
                                   lodLevel === 'low' ? 100 :
                                   lodLevel === 'minimal' ? 50 : 25; // ultraMinimal: only 25 connections
    
    // Maximum distance for entry-to-entry connections (localized)
    const maxEntryToEntryDistance = 200; // pixels in SVG coordinates

    visibleEntries.forEach(({ entry, position, verticalOffset }) => {
      // Skip if we've exceeded connection budget
      if (connections.length >= maxConnectionsPerFrame) {
        return;
      }

      // Convert entry position to SVG coordinates
      // entryX should match the center of the entry indicator
      // The indicator uses left: ${position}% with transform: translate3d(-50%, -50%, 0)
      // The -50% in translate3d is relative to the element's own size (16px), moving it -8px
      // So the center is at position% of container width
      // The SVG has viewBox="0 0 1000 ${minimapDimensions.height}" with preserveAspectRatio="none"
      // So it stretches to fill the container. To convert percentage to SVG coordinates:
      // entryX = (position / 100) * 1000 (SVG viewBox width)
      // This ensures the connection ends at the exact center of the crystal
      const entryX = (position / 100) * 1000;
      const baseYPosition = scaleYPositions[entry.timeRange];
      // entryY should match the center of the entry indicator
      // The indicator uses top: ${yPositionPercent}% with transform: translate3d(-50%, -50%, 0)
      // where yPositionPercent = (baseYPosition / minimapDimensions.height) * 100
      // The -50% in translate3d moves the 16px indicator -8px, so center is at the top position
      // So the center is at baseYPosition pixels from top in SVG coordinates
      // The SVG height matches minimapDimensions.height, so this aligns perfectly
      const entryY = baseYPosition + verticalOffset;
      
      // Validate entry coordinates - skip if invalid
      if (!isFinite(entryX) || !isFinite(entryY) || !isFinite(baseYPosition) || !isFinite(verticalOffset)) {
        return; // Skip this entry if coordinates are invalid
      }

      // Find nearest web nodes with distance calculation
      // Optimize for decades view: only consider nodes within reasonable distance
      const maxNodeDistance = viewMode === 'decade' ? 500 : Infinity; // Limit search radius for decades
      const nodeDistances = webNodes
        .map(node => {
          const distance = Math.sqrt(Math.pow(entryX - node.x, 2) + Math.pow(entryY - node.y, 2));
          return { node, distance };
        })
        .filter(n => n.distance <= maxNodeDistance) // Filter before sorting
        .sort((a, b) => a.distance - b.distance);

      // Connect to nearest nodes, prioritizing same-scale nodes
      const sameScaleNodes = nodeDistances.filter(n => n.node.scale === entry.timeRange);
      const otherScaleNodes = nodeDistances.filter(n => n.node.scale !== entry.timeRange);

      // Determine connection strategy based on entry properties
      const strategyHash = (entry.id || 0) + entry.date.charCodeAt(0);
      const strategies: ConnectionStrategy[] = ['direct', 'curved', 'hierarchical', 'web', 'spiral', 'organic'];
      const primaryStrategy = strategies[strategyHash % strategies.length];
      
      // Primary connection to nearest same-scale node (always shown)
      if (sameScaleNodes.length > 0) {
        const nearestNode = sameScaleNodes[0].node;
        
        // Validate web node coordinates
        if (!isFinite(nearestNode.x) || !isFinite(nearestNode.y)) {
          return; // Skip if web node has invalid coordinates
        }
        
        const levelIndex = timeScaleOrder.indexOf(entry.timeRange);
        
        // Entry position is already validated in visibleEntries filter, but double-check
        // to ensure we're using current positions
        const connection = buildConnectionPath(
          nearestNode.x,
          nearestNode.y,
          entryX,
          entryY,
          primaryStrategy,
          entry,
          levelIndex,
          viewportBounds,
          lodLevel
        );
        
        // Skip if connection was culled (returned null) or entry is off-screen
        if (connection && isPointInViewport(entryX, entryY, viewportBounds, 150)) {
          // Adjust connection detail based on LOD
          if (lodLevel === 'ultraMinimal') {
            connection.strokeWidth *= 0.5;
            connection.opacity *= 0.4;
          } else if (lodLevel === 'minimal') {
            connection.strokeWidth *= 0.7;
            connection.opacity *= 0.6;
          } else if (lodLevel === 'low') {
            connection.strokeWidth *= 0.85;
            connection.opacity *= 0.8;
          }
          
          connections.push({
            connection,
            entry,
            webNode: nearestNode,
            entryPosition: { x: entryX, y: entryY },
            lodLevel,
            connectionType: 'web',
          });
        }
      }

      // Secondary connection to nearest other-scale node (cross-scale connections)
      // Only show in high/medium LOD or for focused entries
      const shouldShowSecondary = lodLevel === 'high' || 
                                   lodLevel === 'medium' ||
                                   entry.timeRange === viewMode;
      
      if (shouldShowSecondary && otherScaleNodes.length > 0 && connections.length < maxConnectionsPerFrame) {
        const nearestOtherNode = otherScaleNodes[0].node;
        
        // Validate web node coordinates
        if (!isFinite(nearestOtherNode.x) || !isFinite(nearestOtherNode.y)) {
          return; // Skip if web node has invalid coordinates
        }
        
        const levelIndex = timeScaleOrder.indexOf(entry.timeRange);
        const secondaryStrategy = strategies[(strategyHash + 1) % strategies.length];
        
        // Entry position is already validated, but ensure we're using current positions
        const connection = buildConnectionPath(
          nearestOtherNode.x,
          nearestOtherNode.y,
          entryX,
          entryY,
          secondaryStrategy,
          entry,
          levelIndex,
          viewportBounds,
          lodLevel
        );
        
        // Skip if connection was culled or entry is off-screen
        if (connection && isPointInViewport(entryX, entryY, viewportBounds, 150)) {
          // Reduce opacity for cross-scale connections
          connection.opacity *= 0.5;
          
          // Further reduce for medium LOD
          if (lodLevel === 'medium') {
            connection.opacity *= 0.7;
            connection.strokeWidth *= 0.8;
          }
          
          connections.push({
            connection,
            entry,
            webNode: nearestOtherNode,
            entryPosition: { x: entryX, y: entryY },
            lodLevel,
            connectionType: 'web',
          });
        }
      }

      // Tertiary connection for high-density areas (web-like clustering)
      // Only show in high LOD
      if (lodLevel === 'high' && nodeDistances.length > 1 && connections.length < maxConnectionsPerFrame) {
        const tertiaryNode = nodeDistances[1].node;
        
        // Validate web node coordinates
        if (!isFinite(tertiaryNode.x) || !isFinite(tertiaryNode.y)) {
          return; // Skip if web node has invalid coordinates
        }
        
        const levelIndex = timeScaleOrder.indexOf(entry.timeRange);
        const tertiaryStrategy = strategies[(strategyHash + 2) % strategies.length];
        
        // Entry position is already validated, but ensure we're using current positions
        const connection = buildConnectionPath(
          tertiaryNode.x,
          tertiaryNode.y,
          entryX,
          entryY,
          tertiaryStrategy,
          entry,
          levelIndex,
          viewportBounds,
          lodLevel
        );
        
        // Skip if connection was culled or entry is off-screen
        if (connection && isPointInViewport(entryX, entryY, viewportBounds, 150)) {
          connection.opacity *= 0.3;
          connections.push({
            connection,
            entry,
            webNode: tertiaryNode,
            entryPosition: { x: entryX, y: entryY },
            lodLevel,
            connectionType: 'web',
          });
        }
      }
      
      // Connection to main focus web (present focus) - always connect to center
      // Entry position is already validated, but ensure we're using current positions
      if (connections.length < maxConnectionsPerFrame && isPointInViewport(entryX, entryY, viewportBounds, 150)) {
        // Validate focus web node coordinates
        if (!isFinite(focusWebNode.x) || !isFinite(focusWebNode.y)) {
          return; // Skip if focus web node has invalid coordinates
        }
        
        const levelIndex = timeScaleOrder.indexOf(entry.timeRange);
        const focusStrategy = strategies[(strategyHash + 3) % strategies.length];
        const connection = buildConnectionPath(
          focusWebNode.x,
          focusWebNode.y,
          entryX,
          entryY,
          focusStrategy,
          entry,
          levelIndex,
          viewportBounds,
          lodLevel
        );
        
        // Skip if connection was culled or entry is off-screen
        if (connection) {
          // Focus connections are more prominent
          connection.opacity *= 0.6;
          connection.strokeWidth *= 1.1;
          connections.push({
            connection,
            entry,
            webNode: focusWebNode,
            entryPosition: { x: entryX, y: entryY },
            lodLevel,
            connectionType: 'focus',
          });
        }
      }
    });

    // Entry-to-entry connections - connect memories to each other
    // Only for visible entries and within localized distance
    // Disable for minimal/ultraMinimal LOD and decades view to improve performance
    if ((lodLevel === 'high' || lodLevel === 'medium') && viewMode !== 'decade') {
      const maxEntryConnections = lodLevel === 'high' ? 30 : 15; // Limit entry-to-entry connections
      let entryConnectionCount = 0;
      
      for (let i = 0; i < visibleEntries.length && entryConnectionCount < maxEntryConnections && connections.length < maxConnectionsPerFrame; i++) {
        const sourceEntry = visibleEntries[i];
        const sourceX = (sourceEntry.position / 100) * 1000;
        const sourceBaseY = scaleYPositions[sourceEntry.entry.timeRange];
        const sourceY = sourceBaseY + sourceEntry.verticalOffset;
        
        // Validate source coordinates
        if (!isFinite(sourceX) || !isFinite(sourceY) || !isFinite(sourceBaseY) || !isFinite(sourceEntry.verticalOffset)) {
          continue; // Skip invalid source entries
        }
        
        // Skip if source entry is not in viewport
        if (!isPointInViewport(sourceX, sourceY, viewportBounds, 150)) {
          continue;
        }
        
        // Find nearby entries for connection (within localized distance)
        const nearbyEntries: Array<{ entry: JournalEntry; position: { x: number; y: number }; distance: number }> = [];
        
        for (let j = i + 1; j < visibleEntries.length; j++) {
          const targetEntry = visibleEntries[j];
          const targetX = (targetEntry.position / 100) * 1000;
          const targetBaseY = scaleYPositions[targetEntry.entry.timeRange];
          const targetY = targetBaseY + targetEntry.verticalOffset;
          
          // Validate target coordinates
          if (!isFinite(targetX) || !isFinite(targetY) || !isFinite(targetBaseY) || !isFinite(targetEntry.verticalOffset)) {
            continue; // Skip invalid target entries
          }
          
          const distance = Math.sqrt(Math.pow(targetX - sourceX, 2) + Math.pow(targetY - sourceY, 2));
          
          // Only connect if within localized distance and both are visible
          if (distance <= maxEntryToEntryDistance && 
              isPointInViewport(targetX, targetY, viewportBounds, 150) &&
              isPointInViewport(sourceX, sourceY, viewportBounds, 150)) {
            nearbyEntries.push({
              entry: targetEntry.entry,
              position: { x: targetX, y: targetY },
              distance,
            });
          }
        }
        
        // Sort by distance and connect to nearest 1-2 entries
        nearbyEntries.sort((a, b) => a.distance - b.distance);
        const connectionsToMake = lodLevel === 'high' ? Math.min(2, nearbyEntries.length) : 1;
        
        for (let k = 0; k < connectionsToMake && entryConnectionCount < maxEntryConnections && connections.length < maxConnectionsPerFrame; k++) {
          const target = nearbyEntries[k];
          const sourceStrategyHash = (sourceEntry.entry.id || 0) + sourceEntry.entry.date.charCodeAt(0);
          const targetStrategyHash = (target.entry.id || 0) + target.entry.date.charCodeAt(0);
          const combinedHash = sourceStrategyHash + targetStrategyHash;
          const strategies: ConnectionStrategy[] = ['direct', 'curved', 'hierarchical', 'web', 'spiral', 'organic'];
          const entryStrategy = strategies[combinedHash % strategies.length];
          const levelIndex = Math.max(
            timeScaleOrder.indexOf(sourceEntry.entry.timeRange),
            timeScaleOrder.indexOf(target.entry.timeRange)
          );
          
          // Create entry-to-entry connection
          const connection = buildConnectionPath(
            sourceX,
            sourceY,
            target.position.x,
            target.position.y,
            entryStrategy,
            sourceEntry.entry,
            levelIndex,
            viewportBounds,
            lodLevel
          );
          
          if (connection) {
            // Entry-to-entry connections are more subtle
            connection.opacity *= 0.4;
            connection.strokeWidth *= 0.8;
            
            connections.push({
              connection,
              entry: sourceEntry.entry,
              targetEntry: target.entry,
              entryPosition: { x: sourceX, y: sourceY },
              targetPosition: target.position,
              lodLevel,
              connectionType: 'entry-to-entry',
            });
            
            entryConnectionCount++;
          }
        }
      }
    }

    return connections;
  }, [entryPositions, webNodes, scaleYPositions, timeScaleOrder, viewMode, currentIndicatorMetrics.position, viewportBounds, focusWebNode]);

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
    
    // Start continuous slider noise for vertical drag feedback
    // This provides audio feedback indicating distance from center to threshold
    sliderNoiseRef.current = createSliderNoise();
    
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

      // Only handle arrow keys and WASD keys
      const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
      const isWASDKey = ['a', 'A', 'd', 'D', 'w', 'W', 's', 'S'].includes(e.key);
      if (!isArrowKey && !isWASDKey) {
        return;
      }

      // Prevent default scrolling behavior
      e.preventDefault();

      const currentViewMode = viewModeRef.current;
      const currentSelectedDate = selectedDateRef.current;
      const currentOnTimePeriodSelect = onTimePeriodSelectRef.current;

      // Map WASD to arrow key equivalents
      const normalizedKey = e.key.toLowerCase();
      const isLeft = e.key === 'ArrowLeft' || normalizedKey === 'a';
      const isRight = e.key === 'ArrowRight' || normalizedKey === 'd';
      const isUp = e.key === 'ArrowUp' || normalizedKey === 'w';
      const isDown = e.key === 'ArrowDown' || normalizedKey === 's';

      if (isLeft || isRight) {
        // Navigate time horizontally (earlier/later)
        const direction = isLeft ? -1 : 1;
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
      } else if (isUp || isDown) {
        // Change time scale (zoom in/out)
        const scaleOrder: TimeRange[] = ['decade', 'year', 'month', 'week', 'day'];
        const currentIndex = scaleOrder.indexOf(currentViewMode);

        if (isUp && currentIndex < scaleOrder.length - 1) {
          // Zoom in (more detail)
          const newViewMode = scaleOrder[currentIndex + 1];
          playMechanicalClick('up');
          setMechanicalClick({ scale: newViewMode, direction: 'up' });
          setTimeout(() => setMechanicalClick(null), 300);
          currentOnTimePeriodSelect(currentSelectedDate, newViewMode);
        } else if (isDown && currentIndex > 0) {
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

    // Define handleWheel inside useEffect to avoid stale closures
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
      
      // Only call onTimePeriodSelect if the date actually changed
      // This prevents infinite update loops
      if (newDate.getTime() !== currentSelectedDate.getTime()) {
        currentOnTimePeriodSelect(newDate, currentViewMode);
      }
    };

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
      
      // Check if we're at a limit (can't zoom in/out further) and trying to move beyond it
      const scaleOrder: TimeRange[] = ['decade', 'year', 'month', 'week', 'day'];
      const currentIndex = scaleOrder.indexOf(currentViewMode);
      const absAccumulator = Math.abs(verticalMovementAccumulatorRef.current);
      
      // At top limit: moving up (negative) and at finest scale (day), past threshold
      const isAtTopLimit = verticalMovementAccumulatorRef.current < 0 && 
                           currentIndex >= scaleOrder.length - 1 && 
                           absAccumulator > verticalThreshold;
      
      // At bottom limit: moving down (positive) and at coarsest scale (decade), past threshold
      const isAtBottomLimit = verticalMovementAccumulatorRef.current > 0 && 
                              currentIndex <= 0 && 
                              absAccumulator > verticalThreshold;
      
      const isAtLimit = isAtTopLimit || isAtBottomLimit;
      
      // Update slider noise based on distance from center to threshold
      // This provides real-time audio feedback indicating proximity to level change threshold
      if (sliderNoiseRef.current) {
        const distanceFromCenter = absAccumulator;
        sliderNoiseRef.current.update(distanceFromCenter, verticalThreshold);
        
        // Set limit state for dampened null wall effect when at limits
        // This creates a pitch-down portamento effect with dampened volume
        sliderNoiseRef.current.setLimitState(isAtLimit);
      }
      
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
      // Note: scaleOrder is already defined above for limit detection
      if (!scaleChangeLockRef.current && !inDeadZone && Math.abs(verticalMovementAccumulatorRef.current) > verticalThreshold) {
        
        // Check if we've moved enough in the new direction (past the dead zone)
        const movementFromLastChange = verticalMovementAccumulatorRef.current - lastScaleChangeAccumulatorRef.current;
        const hasCrossedDeadZone = Math.abs(movementFromLastChange) >= deadZoneSize;
        
        if (verticalMovementAccumulatorRef.current < 0 && currentIndex < scaleOrder.length - 1 && hasCrossedDeadZone) {
          // Moving up - zoom in (more detail)
          scaleChangeLockRef.current = true; // Lock to prevent rapid changes
          const newViewMode = scaleOrder[currentIndex + 1];
          
          // Play mechanical click sound
          playMechanicalClick('up');
          
          // Trigger portamento drop in slider noise (momentary volume dip, then return)
          if (sliderNoiseRef.current) {
            sliderNoiseRef.current.portamentoDrop();
          }
          
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
          
          // Trigger portamento drop in slider noise (momentary volume dip, then return)
          if (sliderNoiseRef.current) {
            sliderNoiseRef.current.portamentoDrop();
          }
          
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
      
      // Stop slider noise when dragging ends
      if (sliderNoiseRef.current) {
        sliderNoiseRef.current.stop();
        sliderNoiseRef.current = null;
      }
      
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

          {/* Adaptive fractal webbing - memory web connections */}
          <g className="memory-web-connections">
            {memoryWebConnections.map(({ connection, entry, webNode, targetEntry, connectionType }, idx) => {
              // Determine color based on connection type
              let connectionColor: string;
              if (connectionType === 'entry-to-entry' && targetEntry) {
                // Blend colors for entry-to-entry connections
                const sourceColor = calculateEntryColor(entry);
                const targetColor = calculateEntryColor(targetEntry);
                // Convert hex to RGB, blend, and convert back
                const hexToRgb = (hex: string) => {
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  return { r, g, b };
                };
                const rgbToHex = (r: number, g: number, b: number) => {
                  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
                };
                const sourceRgb = hexToRgb(sourceColor);
                const targetRgb = hexToRgb(targetColor);
                connectionColor = rgbToHex(
                  (sourceRgb.r + targetRgb.r) / 2,
                  (sourceRgb.g + targetRgb.g) / 2,
                  (sourceRgb.b + targetRgb.b) / 2
                );
              } else if (connectionType === 'focus') {
                // Focus connections use a vibrant blend with the active color
                const entryColor = calculateEntryColor(entry);
                const hexToRgb = (hex: string) => {
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  return { r, g, b };
                };
                const rgbToHex = (r: number, g: number, b: number) => {
                  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
                };
                const entryRgb = hexToRgb(entryColor);
                // Blend with active color (blue-ish for focus)
                const focusRgb = { r: 74, g: 144, b: 226 }; // #4a90e2
                connectionColor = rgbToHex(
                  (entryRgb.r * 0.6 + focusRgb.r * 0.4),
                  (entryRgb.g * 0.6 + focusRgb.g * 0.4),
                  (entryRgb.b * 0.6 + focusRgb.b * 0.4)
                );
              } else {
                // Web connections use entry color
                connectionColor = calculateEntryColor(entry);
              }
              
              // Determine connection class based on strategy
              const connectionClass = `memory-connection memory-connection-${connection.strategy}`;
              let connectionTypeClass = '';
              if (connectionType === 'focus') {
                connectionTypeClass = 'focus-connection';
              } else if (connectionType === 'entry-to-entry') {
                connectionTypeClass = 'entry-to-entry';
              } else if (webNode) {
                const isSameScale = webNode.scale === entry.timeRange;
                connectionTypeClass = isSameScale ? 'same-scale' : 'cross-scale';
              }
              
              // Calculate dash array based on strategy
              let dashArray: string;
              switch (connection.strategy) {
                case 'direct':
                  dashArray = '4 2';
                  break;
                case 'curved':
                  dashArray = '6 3';
                  break;
                case 'hierarchical':
                  dashArray = '8 4';
                  break;
                case 'web':
                  dashArray = '2 4';
                  break;
                case 'spiral':
                  dashArray = '3 3';
                  break;
                case 'organic':
                  dashArray = '5 2';
                  break;
                default:
                  dashArray = '4 2';
              }

              // Generate unique key based on connection type
              // Include index to ensure uniqueness even if multiple connections share same properties
              const connectionKey = connectionType === 'entry-to-entry' && targetEntry
                ? `connection-${entry.id || idx}-to-${targetEntry.id || idx}-${idx}`
                : connectionType === 'focus'
                ? `connection-${entry.id || idx}-focus-${idx}`
                : `connection-${entry.id || idx}-web-${webNode?.x || 0}-${webNode?.y || 0}-${idx}`;

              return (
                <g key={connectionKey}>
                  {/* Connection path with adaptive styling */}
                  {/* Ensure path ends exactly at entry crystal center by using precise coordinates */}
                  <path
                    d={connection.path}
                    stroke={connectionColor}
                    strokeWidth={connection.strokeWidth}
                    fill="none"
                    opacity={connection.opacity}
                    strokeDasharray={dashArray}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`${connectionClass} ${connectionTypeClass}`}
                    style={{
                      filter: `drop-shadow(0 0 ${connection.strokeWidth * 2}px ${connectionColor})`,
                    }}
                    shapeRendering="geometricPrecision"
                  />
                  
                  {/* Connection glow layer for depth */}
                  <path
                    d={connection.path}
                    stroke={connectionColor}
                    strokeWidth={connection.strokeWidth * 1.5}
                    fill="none"
                    opacity={connection.opacity * 0.2}
                    strokeDasharray={dashArray}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`${connectionClass}-glow ${connectionTypeClass}`}
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
              
              // Calculate opacity and magnification based on distance from indicator
              const indicatorPosition = isFinite(currentIndicatorMetrics.position) 
                ? Number(currentIndicatorMetrics.position) 
                : 50; // Default to center if invalid
              const distanceFromIndicator = labelPosition - indicatorPosition;
              const absDistance = Math.abs(distanceFromIndicator);
              const maxDistanceForFade = 50; // Maximum distance for full fade (50% of timeline)
              const calculatedOpacity = 1 - (absDistance / maxDistanceForFade);
              const labelOpacity = Math.max(0.1, Math.min(1, calculatedOpacity));
              
              // Calculate magnification scale using curve
              const magnificationScale = calculateMagnificationScale(distanceFromIndicator, maxDistanceForFade);
              const baseFontSize = 0.9; // Increased base font size for better legibility
              const fontSize = `${baseFontSize * magnificationScale}rem`;
              
              // Build the style object explicitly to ensure all properties are set correctly
              const decadeLabelStyle: React.CSSProperties = {
                position: 'absolute',
                left: `${labelPosition}%`,
                top: '5px',
                color: zodiacColor,
                opacity: labelOpacity,
                fontSize: fontSize,
                transform: 'translate3d(-50%, 0, 0)',
                WebkitTransform: 'translate3d(-50%, 0, 0)',
                msTransform: 'translate3d(-50%, 0, 0)',
                zIndex: 2,
                pointerEvents: 'none',
                marginLeft: 0,
                marginRight: 0,
                marginTop: 0,
                marginBottom: 0,
              };
              
              // Use truly unique key based on date, position, and index to prevent React element reuse
              const decadeDateTimestamp = mark.date ? mark.date.getTime() : Date.now() + idx;
              const decadeUniqueKey = `decade-label-${decadeDateTimestamp}-${labelPosition}-${idx}`;
              
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
              // Lighten the color for better readability on dark minimap background
              const lightenedColor = lightenColor(zodiacColor, 0.5);
              
              // Calculate opacity and magnification based on distance from indicator
              const indicatorPosition = isFinite(currentIndicatorMetrics.position) 
                ? Number(currentIndicatorMetrics.position) 
                : 50; // Default to center if invalid
              const distanceFromIndicator = labelPosition - indicatorPosition;
              const absDistance = Math.abs(distanceFromIndicator);
              const maxDistanceForFade = 50; // Maximum distance for full fade (50% of timeline)
              const calculatedOpacity = 1 - (absDistance / maxDistanceForFade);
              const labelOpacity = Math.max(0.1, Math.min(1, calculatedOpacity));
              
              // Calculate magnification scale using curve
              const magnificationScale = calculateMagnificationScale(distanceFromIndicator, maxDistanceForFade);
              const baseFontSize = 0.85; // Increased base font size for better legibility
              const fontSize = `${baseFontSize * magnificationScale}rem`;
              
              // Build the style object explicitly
              const yearLabelStyle: React.CSSProperties = {
                position: 'absolute',
                left: `${labelPosition}%`,
                top: '45px',
                color: lightenedColor,
                opacity: labelOpacity,
                fontSize: fontSize,
                transform: 'translate3d(-50%, 0, 0)',
                WebkitTransform: 'translate3d(-50%, 0, 0)',
                msTransform: 'translate3d(-50%, 0, 0)',
                zIndex: 2,
                pointerEvents: 'none',
                marginLeft: 0,
                marginRight: 0,
                marginTop: 0,
                marginBottom: 0,
              };
              
              // Use truly unique key based on date, position, and index to prevent React element reuse
              const yearDateTimestamp = mark.date ? mark.date.getTime() : Date.now() + idx;
              const yearUniqueKey = `year-label-${yearDateTimestamp}-${labelPosition}-${idx}`;
              
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
              
              // Calculate opacity and magnification based on distance from indicator
              const indicatorPosition = isFinite(currentIndicatorMetrics.position) 
                ? Number(currentIndicatorMetrics.position) 
                : 50; // Default to center if invalid
              const distanceFromIndicator = labelPosition - indicatorPosition;
              const absDistance = Math.abs(distanceFromIndicator);
              const maxDistanceForFade = 50; // Maximum distance for full fade (50% of timeline)
              const calculatedOpacity = 1 - (absDistance / maxDistanceForFade);
              const labelOpacity = Math.max(0.1, Math.min(1, calculatedOpacity));
              
              // Calculate magnification scale using curve
              const magnificationScale = calculateMagnificationScale(distanceFromIndicator, maxDistanceForFade);
              const baseFontSize = 0.7; // Increased base font size for better legibility
              const fontSize = `${baseFontSize * magnificationScale}rem`;
              
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
              
              // Lighten the color for better readability on dark minimap background
              const lightenedColor = lightenColor(zodiacColor, 0.5);
              
              const labelStyle: React.CSSProperties = {
                position: 'absolute',
                left: leftValue, // Explicitly set as percentage string
                top: '48px',
                color: lightenedColor,
                opacity: labelOpacity,
                fontSize: fontSize,
                transform: 'translate3d(-50%, 0, 0)',
                WebkitTransform: 'translate3d(-50%, 0, 0)',
                msTransform: 'translate3d(-50%, 0, 0)',
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
              const indicatorPosition = isFinite(currentIndicatorMetrics.position) 
                ? Number(currentIndicatorMetrics.position) 
                : 50;
              const distanceFromIndicator = mark.position - indicatorPosition;
              const magnificationScale = calculateMagnificationScale(distanceFromIndicator, LOCALIZATION_RANGE);
              const baseFontSize = 0.8;
              const fontSize = `${baseFontSize * magnificationScale}rem`;
              const absDistance = Math.abs(distanceFromIndicator);
              const calculatedOpacity = 1 - (absDistance / LOCALIZATION_RANGE);
              const labelOpacity = Math.max(0.2, Math.min(1, calculatedOpacity));
              
              return mark.label && (
                <div
                  key={`month-label-${idx}`}
                  className={`scale-label month-label ${viewMode === 'month' ? 'current-scale' : ''}`}
                  style={{ 
                    left: `${mark.position}%`, 
                    top: '85px', 
                    color: zodiacColor,
                    fontSize: fontSize,
                    opacity: labelOpacity,
                    transform: 'translate3d(-50%, 0, 0)',
                  }}
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
              const indicatorPosition = isFinite(currentIndicatorMetrics.position) 
                ? Number(currentIndicatorMetrics.position) 
                : 50;
              const distanceFromIndicator = mark.position - indicatorPosition;
              const magnificationScale = calculateMagnificationScale(distanceFromIndicator, LOCALIZATION_RANGE);
              const baseFontSize = 0.65;
              const fontSize = `${baseFontSize * magnificationScale}rem`;
              const absDistance = Math.abs(distanceFromIndicator);
              const calculatedOpacity = 1 - (absDistance / LOCALIZATION_RANGE);
              const labelOpacity = Math.max(0.2, Math.min(1, calculatedOpacity));
              
              return mark.label && (
                <div
                  key={`month-minor-label-${idx}`}
                  className="scale-label month-minor-label"
                  style={{ 
                    left: `${mark.position}%`, 
                    top: '88px', 
                    color: zodiacColor,
                    fontSize: fontSize,
                    opacity: labelOpacity,
                    transform: 'translate3d(-50%, 0, 0)',
                  }}
                >
                  {mark.label}
                </div>
              );
            })}
          
          {/* Week labels */}
          {allScaleMarkings.week.major
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
              const indicatorPosition = isFinite(currentIndicatorMetrics.position) 
                ? Number(currentIndicatorMetrics.position) 
                : 50;
              const distanceFromIndicator = mark.position - indicatorPosition;
              const magnificationScale = calculateMagnificationScale(distanceFromIndicator, LOCALIZATION_RANGE);
              const baseFontSize = 0.75;
              const fontSize = `${baseFontSize * magnificationScale}rem`;
              const absDistance = Math.abs(distanceFromIndicator);
              const calculatedOpacity = 1 - (absDistance / LOCALIZATION_RANGE);
              const labelOpacity = Math.max(0.2, Math.min(1, calculatedOpacity));
              
              return mark.label && (
                <div
                  key={`week-label-${idx}`}
                  className={`scale-label week-label ${viewMode === 'week' ? 'current-scale' : ''}`}
                  style={{ 
                    left: `${mark.position}%`, 
                    top: '125px',
                    fontSize: fontSize,
                    opacity: labelOpacity,
                    transform: 'translate3d(-50%, 0, 0)',
                  }}
                >
                  {mark.label}
                </div>
              );
            })}
          
          {/* Day labels */}
          {allScaleMarkings.day.major
            .filter(mark => Math.abs(mark.position - currentIndicatorMetrics.position) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
              const indicatorPosition = isFinite(currentIndicatorMetrics.position) 
                ? Number(currentIndicatorMetrics.position) 
                : 50;
              const distanceFromIndicator = mark.position - indicatorPosition;
              const magnificationScale = calculateMagnificationScale(distanceFromIndicator, LOCALIZATION_RANGE);
              const baseFontSize = 0.7;
              const fontSize = `${baseFontSize * magnificationScale}rem`;
              const absDistance = Math.abs(distanceFromIndicator);
              const calculatedOpacity = 1 - (absDistance / LOCALIZATION_RANGE);
              const labelOpacity = Math.max(0.2, Math.min(1, calculatedOpacity));
              
              return mark.label && (
                <div
                  key={`day-label-${idx}`}
                  className={`scale-label day-label ${viewMode === 'day' ? 'current-scale' : ''}`}
                  style={{ 
                    left: `${mark.position}%`, 
                    top: '165px',
                    fontSize: fontSize,
                    opacity: labelOpacity,
                    transform: 'translate3d(-50%, 0, 0)',
                  }}
                >
                  {mark.label}
                </div>
              );
            })}
        </div>

        {/* Timeline segments */}
        <div className="timeline-segments">
          {timelineData.segments.map((segment, idx) => {
            // Calculate position safely, handling edge cases
            const position = timelineData.segments.length > 1
              ? (idx / (timelineData.segments.length - 1)) * 100
              : 50; // Center if only one segment
            const isNearCurrent = Math.abs(idx - timelineData.currentPosition) <= 1;
            
            // Use a unique key that includes viewMode and date to ensure proper re-rendering
            const segmentKey = `${segment.viewMode}-${segment.date.getTime()}-${idx}`;
            
            return (
              <div
                key={segmentKey}
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
              const entryDate = parseISODate(entry.date);
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
              background: `linear-gradient(to bottom, 
                ${hexToRgba(getSelectedSegmentColor, 0.2)}, 
                ${getSelectedSegmentColor}, 
                ${hexToRgba(getSelectedSegmentColor, 0.2)}
              )`,
              borderLeftColor: getSelectedSegmentColor,
              borderRightColor: getSelectedSegmentColor,
              boxShadow: `
                0 0 10px ${hexToRgba(getSelectedSegmentColor, 0.7)},
                inset 0 0 10px ${hexToRgba(getSelectedSegmentColor, 0.3)}
              `,
            }}
          >
            {/* Micro indicators for finer time scales */}
            {microIndicators.map((indicator, idx) => (
              <div
                key={`micro-indicator-${indicator.scale}-${idx}`}
                className={`micro-indicator micro-indicator-${indicator.scale}`}
                style={{
                  left: `${indicator.left}%`,
                  width: `${indicator.width}%`,
                  backgroundColor: indicator.color,
                  borderColor: indicator.color,
                }}
                title={indicator.scale}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

