import { useMemo, useState, useEffect, useRef } from 'react';
import { TimeRange, JournalEntry } from '../types';
import { formatDate, getWeekStart, getMonthStart, getZodiacColor, getZodiacColorForDecade } from '../utils/dateUtils';
import { addDays, addWeeks, addMonths, getYear, getMonth, getDate } from 'date-fns';
import './GlobalTimelineMinimap.css';

interface GlobalTimelineMinimapProps {
  selectedDate: Date;
  viewMode: TimeRange;
  onTimePeriodSelect: (date: Date, viewMode: TimeRange) => void;
  onEntrySelect?: (entry: JournalEntry) => void;
}

// Generate mechanical click sound using Web Audio API
function playMechanicalClick(direction: 'up' | 'down'): void {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Create a mechanical click sound - sharp transient with resonance
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(direction === 'up' ? 800 : 600, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(direction === 'up' ? 400 : 300, audioContext.currentTime + 0.05);
    
    // Envelope for click sound
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
    
    // Add a second click for mechanical feel
    setTimeout(() => {
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      
      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(direction === 'up' ? 1200 : 900, audioContext.currentTime);
      oscillator2.frequency.exponentialRampToValueAtTime(direction === 'up' ? 500 : 400, audioContext.currentTime + 0.03);
      
      gainNode2.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode2.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.001);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.03);
      gainNode2.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.08);
      
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + 0.08);
    }, 20);
  } catch (error) {
    // Silently fail if audio context is not available
    console.debug('Audio context not available:', error);
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
  
  // Resume audio context if suspended (browsers require user interaction)
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {
      // Silently fail if resume is not possible
    });
  }
  
  return sharedAudioContext;
}

// Generate micro mechanical blip sound for date changes during dragging
function playMicroBlip(): void {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
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
  const hue = combinedValue; // 0-360 degrees
  const saturation = 55 + (textValue % 25); // 55-80% saturation (more vibrant)
  const lightness = 45 + (timeValue % 15); // 45-60% lightness (more visible)
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export default function GlobalTimelineMinimap({
  selectedDate,
  viewMode,
  onTimePeriodSelect,
  onEntrySelect,
}: GlobalTimelineMinimapProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [mechanicalClick, setMechanicalClick] = useState<{ scale: TimeRange; direction: 'up' | 'down' } | null>(null);
  const [horizontalLocked, setHorizontalLocked] = useState(false);
  const [radialDial, setRadialDial] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const dragStartPositionRef = useRef<{ x: number; y: number; date: Date } | null>(null);
  const lastVerticalPositionRef = useRef<number>(0);
  const scaleChangeLockRef = useRef<boolean>(false);
  const verticalMovementAccumulatorRef = useRef<number>(0);
  const initialMovementRef = useRef<{ horizontal: number; vertical: number } | null>(null);
  const lastScaleChangeAccumulatorRef = useRef<number>(0); // Track accumulator value at last scale change
  const deadZoneRef = useRef<number>(0); // Dead zone threshold after scale change
  const lastBlipDateRef = useRef<Date | null>(null); // Track last date that triggered a micro blip
  // Load entries for the timeline range
  useEffect(() => {
    const loadEntries = async () => {
      try {
        // Calculate the visible date range based on view mode
        let rangeStart: Date;
        let rangeEnd: Date;
        
        switch (viewMode) {
          case 'decade': {
            const currentDecade = Math.floor(getYear(selectedDate) / 10) * 10;
            rangeStart = new Date(currentDecade - 50, 0, 1);
            rangeEnd = new Date(currentDecade + 60, 11, 31);
            break;
          }
          case 'year': {
            const currentYear = getYear(selectedDate);
            rangeStart = new Date(currentYear - 5, 0, 1);
            rangeEnd = new Date(currentYear + 6, 11, 31);
            break;
          }
          case 'month': {
            const monthStart = getMonthStart(selectedDate);
            rangeStart = addMonths(monthStart, -6);
            rangeEnd = addMonths(monthStart, 7);
            break;
          }
          case 'week': {
            const weekStart = getWeekStart(selectedDate);
            rangeStart = addWeeks(weekStart, -8);
            rangeEnd = addWeeks(weekStart, 9);
            break;
          }
          case 'day': {
            const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            rangeStart = addDays(dayStart, -14);
            rangeEnd = addDays(dayStart, 15);
            break;
          }
        }
        
        // Use the electron API to get entries for the date range
        if (window.electronAPI) {
          const startDateStr = formatDate(rangeStart);
          const endDateStr = formatDate(rangeEnd);
          const loadedEntries = await window.electronAPI.getEntries(startDateStr, endDateStr);
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
  }, [selectedDate, viewMode]);

  // Calculate the time range to display based on view mode
  const timelineData = useMemo(() => {
    let startDate: Date;
    let endDate: Date;
    let segments: Array<{ date: Date; label: string; isCurrent: boolean; viewMode: TimeRange }> = [];
    let currentPosition: number = 0;

    switch (viewMode) {
      case 'decade': {
        const currentDecade = Math.floor(getYear(selectedDate) / 10) * 10;
        startDate = new Date(currentDecade - 50, 0, 1);
        endDate = new Date(currentDecade + 60, 11, 31);
        
        for (let year = currentDecade - 50; year <= currentDecade + 60; year += 10) {
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
        const currentYear = getYear(selectedDate);
        startDate = new Date(currentYear - 5, 0, 1);
        endDate = new Date(currentYear + 6, 11, 31);
        
        for (let year = currentYear - 5; year <= currentYear + 6; year++) {
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
        const monthStart = getMonthStart(selectedDate);
        startDate = addMonths(monthStart, -6);
        endDate = addMonths(monthStart, 7);
        
        let current = new Date(startDate);
        let idx = 0;
        while (current <= endDate) {
          const isCurrent = current.getTime() === monthStart.getTime();
          segments.push({
            date: new Date(current),
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
        const weekStart = getWeekStart(selectedDate);
        startDate = addWeeks(weekStart, -8);
        endDate = addWeeks(weekStart, 9);
        
        let current = new Date(startDate);
        let idx = 0;
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
        const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        startDate = addDays(dayStart, -14);
        endDate = addDays(dayStart, 15);
        
        let current = new Date(startDate);
        let idx = 0;
        while (current <= endDate) {
          const isCurrent = current.getTime() === dayStart.getTime();
          segments.push({
            date: new Date(current),
            label: formatDate(current, 'MMM d'),
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

  // Calculate current period indicator position (where the blue bar is)
  const currentIndicatorPosition = useMemo(() => {
    if (!timelineData.startDate || !timelineData.endDate) return 50;
    const totalTime = timelineData.endDate.getTime() - timelineData.startDate.getTime();
    const selectedTime = selectedDate.getTime() - timelineData.startDate.getTime();
    return (selectedTime / totalTime) * 100;
  }, [selectedDate, timelineData]);

  // Localization range - only show scales within ±20% of the current indicator
  const LOCALIZATION_RANGE = 20; // percentage of timeline width

  // Center of the minimap in SVG coordinates (0–1000) for the "infinity tree" web
  const centerX = useMemo(() => {
    return (currentIndicatorPosition / 100) * 1000;
  }, [currentIndicatorPosition]);

  // Ordered time scales for branch generation
  const timeScaleOrder: TimeRange[] = ['decade', 'year', 'month', 'week', 'day'];

  // Vertical anchoring for each scale level in SVG coordinates
  const scaleYPositions: Record<TimeRange, number> = {
    decade: 20,
    year: 60,
    month: 100,
    week: 140,
    day: 180,
  };

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
      const timeOffset = date.getTime() - startDate.getTime();
      return Math.max(0, Math.min(100, (timeOffset / totalTime) * 100));
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
    let monthCount = 0;
    const maxMonths = 120; // Limit to 10 years of months
    while (current <= endDate && monthCount < maxMonths) {
      const monthStart = new Date(getYear(current), getMonth(current), 1);
      const monthKey = monthStart.getTime();
      if (monthStart >= startDate && monthStart <= endDate && !monthSet.has(monthKey)) {
        monthSet.add(monthKey);
        scales.year.minor.push({
          date: monthStart,
          position: calculatePosition(monthStart),
          label: getMonth(monthStart) % 3 === 0 ? formatDate(monthStart, 'MMM') : undefined,
        });
        monthCount++;
      }
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

  // Calculate entry positions on the timeline with vertical variance
  const entryPositions = useMemo(() => {
    if (!timelineData.startDate || !timelineData.endDate || entries.length === 0) {
      return [];
    }

    const totalTime = timelineData.endDate.getTime() - timelineData.startDate.getTime();
    const verticalVariance = 60; // Maximum vertical offset in pixels (30px up/down from center)
    
    // Group entries by position to avoid overlap
    const positionGroups = new Map<number, Array<{ entry: JournalEntry; position: number; color: string }>>();
    
    entries.forEach(entry => {
      const entryDate = new Date(entry.date);
      const entryTime = entryDate.getTime() - timelineData.startDate!.getTime();
      const position = (entryTime / totalTime) * 100;
      const clampedPosition = Math.max(0, Math.min(100, position));
      
      // Round to nearest 0.1% to group nearby entries
      const roundedPosition = Math.round(clampedPosition * 10) / 10;
      
      if (!positionGroups.has(roundedPosition)) {
        positionGroups.set(roundedPosition, []);
      }
      positionGroups.get(roundedPosition)!.push({
        entry,
        position: clampedPosition,
        color: calculateEntryColor(entry),
      });
    });
    
    // Calculate vertical offsets for each entry, avoiding overlaps
    const result: Array<{ entry: JournalEntry; position: number; color: string; verticalOffset: number }> = [];
    
    positionGroups.forEach((group) => {
      if (group.length === 1) {
        // Single entry at this position - use hash-based offset
        const entry = group[0];
        const hashInput = `${entry.entry.date}-${entry.entry.timeRange}-${entry.entry.id || 0}`;
        const verticalOffset = hashToVerticalOffset(hashInput, verticalVariance);
        result.push({ ...entry, verticalOffset });
      } else {
        // Multiple entries at same position - distribute them vertically
        group.forEach((entry, idx) => {
          // Distribute evenly across vertical space
          const spacing = (verticalVariance * 2) / (group.length + 1);
          const verticalOffset = -verticalVariance + (idx + 1) * spacing;
          result.push({ ...entry, verticalOffset });
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
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
    // Calculate the date at the mouse start position
    const totalTime = timelineData.endDate.getTime() - timelineData.startDate.getTime();
    const timeOffset = (percentage / 100) * totalTime;
    const startDate = new Date(timelineData.startDate.getTime() + timeOffset);
    
    // Store the initial drag position and date
    dragStartPositionRef.current = {
      x: e.clientX,
      y: e.clientY,
      date: startDate,
    };
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
    
    // Show radial dial at mouse position
    setRadialDial({ x: e.clientX, y: e.clientY });
    
    setIsDragging(true);
    e.preventDefault();
  };


  // Handle wheel scroll with reduced sensitivity
  const handleWheel = (e: React.WheelEvent) => {
    if (!containerRef.current || !timelineData.startDate || !timelineData.endDate) return;
    
    e.preventDefault();
    
    // Calculate scroll increment based on visible range
    const totalTime = timelineData.endDate.getTime() - timelineData.startDate.getTime();
    const visibleRangeDays = totalTime / (1000 * 60 * 60 * 24);
    
    // Scroll through a small portion of the visible range (about 5-10%)
    const scrollPercentage = Math.max(0.5, Math.min(2, visibleRangeDays / 100));
    const scrollDays = scrollPercentage * (e.deltaY > 0 ? 1 : -1);
    
    let newDate: Date;
    
    // Use smaller increments that are proportional to the visible range
    switch (viewMode) {
      case 'decade': {
        // Scroll by about 1 year per scroll step
        const yearsToScroll = Math.max(1, Math.round(Math.abs(scrollDays) / 365));
        newDate = addMonths(selectedDate, (scrollDays > 0 ? 1 : -1) * yearsToScroll * 12);
        break;
      }
      case 'year': {
        // Scroll by about 1 month per scroll step
        const monthsToScroll = Math.max(1, Math.round(Math.abs(scrollDays) / 30));
        newDate = addMonths(selectedDate, (scrollDays > 0 ? 1 : -1) * monthsToScroll);
        break;
      }
      case 'month': {
        // Scroll by about 1 week per scroll step
        const weeksToScroll = Math.max(1, Math.round(Math.abs(scrollDays) / 7));
        newDate = addWeeks(selectedDate, (scrollDays > 0 ? 1 : -1) * weeksToScroll);
        break;
      }
      case 'week': {
        // Scroll by about 1 day per scroll step
        const daysToScroll = Math.max(1, Math.round(Math.abs(scrollDays)));
        newDate = addDays(selectedDate, (scrollDays > 0 ? 1 : -1) * daysToScroll);
        break;
      }
      case 'day': {
        // Scroll by 1 day per scroll step
        newDate = addDays(selectedDate, scrollDays > 0 ? 1 : -1);
        break;
      }
      default:
        return;
    }
    
    onTimePeriodSelect(newDate, viewMode);
  };

  // Store refs for drag handler to avoid recreating on every render
  const timelineDataRef = useRef(timelineData);
  const viewModeRef = useRef(viewMode);
  const selectedDateRef = useRef(selectedDate);
  const onTimePeriodSelectRef = useRef(onTimePeriodSelect);
  const horizontalLockedRef = useRef(horizontalLocked);

  // Update refs when values change
  useEffect(() => {
    timelineDataRef.current = timelineData;
    viewModeRef.current = viewMode;
    selectedDateRef.current = selectedDate;
    onTimePeriodSelectRef.current = onTimePeriodSelect;
    horizontalLockedRef.current = horizontalLocked;
  }, [timelineData, viewMode, selectedDate, onTimePeriodSelect, horizontalLocked]);

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
        
        // If vertical movement is detected first (or is significant), lock horizontal
        const verticalThreshold = 10; // pixels
        if (Math.abs(totalVerticalDelta) > verticalThreshold && !horizontalLockedRef.current) {
          // Check if vertical movement happened before significant horizontal movement
          if (Math.abs(totalVerticalDelta) > Math.abs(totalHorizontalDelta) || Math.abs(totalHorizontalDelta) < 5) {
            setHorizontalLocked(true);
            horizontalLockedRef.current = true;
          }
        }
      }
      
      // Calculate incremental vertical movement (scale change)
      const verticalDelta = e.clientY - lastVerticalPositionRef.current;
      const verticalThreshold = 800; // Increased threshold for more deliberate movement
      const deadZoneSize = 300; // Dead zone pixels after scale change
      
      // Accumulate vertical movement for mechanical feel
      verticalMovementAccumulatorRef.current += verticalDelta;
      
      // Check if we're in the dead zone (must move back toward center after scale change)
      const inDeadZone = Math.abs(verticalMovementAccumulatorRef.current - lastScaleChangeAccumulatorRef.current) < deadZoneSize;
      
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
      
      // Calculate horizontal movement (time navigation) - always increment at day level for smoothness
      // Convert pixel movement to days based on visible range
      const totalTime = currentTimelineData.endDate.getTime() - currentTimelineData.startDate.getTime();
      const totalDays = totalTime / (1000 * 60 * 60 * 24); // Convert milliseconds to days
      const daysPerPixel = totalDays / rect.width;
      const daysDelta = totalHorizontalDelta * daysPerPixel;
      
      // Round to nearest day for smooth day-by-day progression
      const roundedDaysDelta = Math.round(daysDelta);
      
      // Calculate new date by adding days to the initial drag position
      // This ensures smooth day-by-day progression regardless of view mode
      const targetDate = addDays(dragStartPositionRef.current.date, roundedDaysDelta);
      
      // Clamp to visible range
      let finalDate: Date;
      if (targetDate < currentTimelineData.startDate) {
        finalDate = currentTimelineData.startDate;
      } else if (targetDate > currentTimelineData.endDate) {
        finalDate = currentTimelineData.endDate;
      } else {
        finalDate = targetDate;
      }
      
      // Play micro blip for every date change during dragging
      // Compare dates at day level (ignore time component) - check BEFORE throttling
      // This ensures blips play immediately even if the update callback is throttled
      const lastBlipDate = lastBlipDateRef.current;
      const finalDateDay = new Date(finalDate.getFullYear(), finalDate.getMonth(), finalDate.getDate());
      const lastBlipDateDay = lastBlipDate ? new Date(lastBlipDate.getFullYear(), lastBlipDate.getMonth(), lastBlipDate.getDate()) : null;
      
      // Detect ALL date changes, even if we skip some updates due to throttling
      // If the date changed, play blip immediately (don't wait for throttle)
      if (!lastBlipDateDay || finalDateDay.getTime() !== lastBlipDateDay.getTime()) {
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
        lastBlipDateRef.current = new Date(finalDateDay);
      }
      
      // Throttle updates - but only for the actual date selection callback
      // This allows blips to play immediately while still throttling expensive updates
      if (now - lastUpdateTimeRef.current < 32) {
        return;
      }
      
      lastUpdateTimeRef.current = now;
      
      // Update the selected date
      if (finalDate < currentTimelineData.startDate) {
        currentOnTimePeriodSelect(currentTimelineData.startDate, currentViewMode);
      } else if (finalDate > currentTimelineData.endDate) {
        currentOnTimePeriodSelect(currentTimelineData.endDate, currentViewMode);
      } else {
        currentOnTimePeriodSelect(finalDate, currentViewMode);
      }
    };

    const handleMouseUpGlobal = () => {
      setIsDragging(false);
      setHorizontalLocked(false);
      setRadialDial(null);
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
        className={`minimap-container ${isDragging ? 'dragging' : ''} ${mechanicalClick ? 'mechanical-click-active' : ''} ${horizontalLocked ? 'horizontal-locked' : ''}`}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        {/* Fractal web background pattern */}
        <svg className="fractal-web" viewBox="0 0 1000 200" preserveAspectRatio="none">
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
          </defs>
          <rect width="100%" height="100%" fill="url(#fractalGrid)" />
          <rect width="100%" height="100%" fill="url(#fractalWeb)" />
          <rect width="100%" height="100%" fill="url(#fractalStrands)" />

          {/* Infinity tree trunk centered on the current indicator */}
          <line
            x1={centerX}
            y1="0"
            x2={centerX}
            y2="200"
            stroke="#4a90e2"
            strokeWidth="1.5"
            opacity="0.55"
            className="infinity-tree-trunk"
          />

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
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = (mark.position / 100) * 1000;
            const isCurrentScale = viewMode === 'decade';
            return (
              <line
                key={`decade-major-${idx}`}
                x1={x}
                y1="0"
                x2={x}
                y2="40"
                stroke={isCurrentScale ? "#4a90e2" : "#333"}
                strokeWidth={isCurrentScale ? "4" : "3"}
                opacity={isCurrentScale ? "0.9" : "0.8"}
              />
            );
          })}
          {allScaleMarkings.decade.minor
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = (mark.position / 100) * 1000;
            const isCurrentScale = viewMode === 'decade';
            return (
              <line
                key={`decade-minor-${idx}`}
                x1={x}
                y1="0"
                x2={x}
                y2="30"
                stroke={isCurrentScale ? "#6ab7ff" : "#555"}
                strokeWidth={isCurrentScale ? "2.5" : "2"}
                opacity={isCurrentScale ? "0.7" : "0.6"}
              />
            );
          })}
          
          {/* YEAR SCALE */}
          {allScaleMarkings.year.major
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = (mark.position / 100) * 1000;
            const isCurrentScale = viewMode === 'year';
            return (
              <line
                key={`year-major-${idx}`}
                x1={x}
                y1="40"
                x2={x}
                y2="80"
                stroke={isCurrentScale ? "#4a90e2" : "#444"}
                strokeWidth={isCurrentScale ? "3.5" : "3"}
                opacity={isCurrentScale ? "0.85" : "0.75"}
              />
            );
          })}
          {allScaleMarkings.year.minor
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = (mark.position / 100) * 1000;
            const isCurrentScale = viewMode === 'year';
            return (
              <line
                key={`year-minor-${idx}`}
                x1={x}
                y1="40"
                x2={x}
                y2="70"
                stroke={isCurrentScale ? "#6ab7ff" : "#666"}
                strokeWidth={isCurrentScale ? "2" : "1.5"}
                opacity={isCurrentScale ? "0.6" : "0.5"}
              />
            );
          })}
          
          {/* MONTH SCALE (center, current view highlighted) */}
          {allScaleMarkings.month.major
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = (mark.position / 100) * 1000;
            const isCurrentScale = viewMode === 'month';
            return (
              <line
                key={`month-major-${idx}`}
                x1={x}
                y1="80"
                x2={x}
                y2="120"
                stroke={isCurrentScale ? "#4a90e2" : "#555"}
                strokeWidth={isCurrentScale ? "3.5" : "2.5"}
                opacity={isCurrentScale ? "0.9" : "0.7"}
              />
            );
          })}
          {allScaleMarkings.month.minor
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = (mark.position / 100) * 1000;
            const isCurrentScale = viewMode === 'month';
            return (
              <line
                key={`month-minor-${idx}`}
                x1={x}
                y1="80"
                x2={x}
                y2="110"
                stroke={isCurrentScale ? "#6ab7ff" : "#777"}
                strokeWidth={isCurrentScale ? "1.5" : "1"}
                opacity={isCurrentScale ? "0.7" : "0.5"}
              />
            );
          })}
          
          {/* WEEK SCALE */}
          {allScaleMarkings.week.major
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = (mark.position / 100) * 1000;
            const isCurrentScale = viewMode === 'week';
            return (
              <line
                key={`week-major-${idx}`}
                x1={x}
                y1="120"
                x2={x}
                y2="160"
                stroke={isCurrentScale ? "#4a90e2" : "#555"}
                strokeWidth={isCurrentScale ? "3" : "2.5"}
                opacity={isCurrentScale ? "0.8" : "0.6"}
              />
            );
          })}
          {allScaleMarkings.week.minor
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = (mark.position / 100) * 1000;
            const isCurrentScale = viewMode === 'week';
            return (
              <line
                key={`week-minor-${idx}`}
                x1={x}
                y1="120"
                x2={x}
                y2="150"
                stroke={isCurrentScale ? "#6ab7ff" : "#888"}
                strokeWidth={isCurrentScale ? "1.2" : "0.8"}
                opacity={isCurrentScale ? "0.6" : "0.4"}
              />
            );
          })}
          
          {/* DAY SCALE (bottommost, finest scale) */}
          {allScaleMarkings.day.major
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = (mark.position / 100) * 1000;
            const isCurrentScale = viewMode === 'day';
            return (
              <line
                key={`day-major-${idx}`}
                x1={x}
                y1="160"
                x2={x}
                y2="200"
                stroke={isCurrentScale ? "#4a90e2" : "#666"}
                strokeWidth={isCurrentScale ? "2.5" : "2"}
                opacity={isCurrentScale ? "0.7" : "0.5"}
              />
            );
          })}
          {allScaleMarkings.day.minor
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
            const x = (mark.position / 100) * 1000;
            return (
              <line
                key={`day-minor-${idx}`}
                x1={x}
                y1="160"
                x2={x}
                y2="190"
                stroke="#999"
                strokeWidth="0.8"
                opacity="0.3"
              />
            );
          })}
        </svg>
        
        {/* Scale labels for all levels - localized to current indicator */}
        <div className="scale-labels">
          {/* Decade labels */}
          {allScaleMarkings.decade.major
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
            .map((mark, idx) => {
              const decadeStart = mark.date ? Math.floor(mark.date.getFullYear() / 10) * 10 : 0;
              const zodiacColor = getZodiacColorForDecade(decadeStart);
              return mark.label && (
                <div
                  key={`decade-label-${idx}`}
                  className={`scale-label decade-label ${viewMode === 'decade' ? 'current-scale' : ''}`}
                  style={{ left: `${mark.position}%`, top: '5px', color: zodiacColor }}
                >
                  {mark.label}
                </div>
              );
            })}
          
          {/* Year labels */}
          {allScaleMarkings.year.major
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
            .map((mark, idx) => (
            mark.label && (
              <div
                key={`year-label-${idx}`}
                className={`scale-label year-label ${viewMode === 'year' ? 'current-scale' : ''}`}
                style={{ left: `${mark.position}%`, top: '45px' }}
              >
                {mark.label}
              </div>
            )
          ))}
          {allScaleMarkings.year.minor
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
            .map((mark, idx) => (
            mark.label && (
              <div
                key={`year-minor-label-${idx}`}
                className="scale-label year-minor-label"
                style={{ left: `${mark.position}%`, top: '48px' }}
              >
                {mark.label}
              </div>
            )
          ))}
          
          {/* Month labels */}
          {allScaleMarkings.month.major
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
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
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
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
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
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
            .filter(mark => Math.abs(mark.position - currentIndicatorPosition) <= LOCALIZATION_RANGE)
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
          {entryPositions.map(({ entry, position, color, verticalOffset }, idx) => {
            const handleClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              const entryDate = new Date(entry.date);
              if (onEntrySelect) {
                onEntrySelect(entry);
              } else {
                onTimePeriodSelect(entryDate, entry.timeRange);
              }
            };
            
            return (
              <div
                key={entry.id || idx}
                className="entry-indicator-wrapper"
                style={{
                  left: `${position}%`,
                  top: `calc(50% + ${verticalOffset}px)`,
                }}
                onClick={handleClick}
                title={`${entry.title} (${entry.timeRange})`}
              >
                <div
                  className="entry-indicator"
                  style={{
                    '--gem-color': color,
                  } as React.CSSProperties & { '--gem-color': string }}
                />
              </div>
            );
          })}
        </div>

        {/* Current period highlight rectangle */}
        {timelineData.segments.length > 0 && (() => {
          const indicatorWidth = viewMode === 'decade' ? '12px' : 
                                viewMode === 'year' ? '10px' : 
                                viewMode === 'month' ? '8px' : 
                                viewMode === 'week' ? '6px' : '4px';
          return (
            <div
              key="current-indicator"
              className="current-period-indicator"
              style={{ 
                left: `${currentIndicatorPosition}%`,
                width: indicatorWidth
              }}
            />
          );
        })()}
      </div>
    </div>
  );
}

