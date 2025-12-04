import { useMemo, useState, useEffect } from 'react';
import { TimeRange, JournalEntry } from '../types';
import { formatDate, getWeekStart, getMonthStart } from '../utils/dateUtils';
import { addDays, addWeeks, addMonths, getYear } from 'date-fns';
import './GlobalTimelineMinimap.css';

interface GlobalTimelineMinimapProps {
  selectedDate: Date;
  viewMode: TimeRange;
  onTimePeriodSelect: (date: Date, viewMode: TimeRange) => void;
  onEntrySelect?: (entry: JournalEntry) => void;
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
  const [loading, setLoading] = useState(false);
  // Load entries for the timeline range
  useEffect(() => {
    const loadEntries = async () => {
      setLoading(true);
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
      } finally {
        setLoading(false);
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
    const now = new Date();
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

  // Calculate position percentage for the illuminated line
  const linePosition = useMemo(() => {
    if (timelineData.segments.length === 0) return 50;
    return (timelineData.currentPosition / (timelineData.segments.length - 1)) * 100;
  }, [timelineData]);

  // Calculate entry positions on the timeline
  const entryPositions = useMemo(() => {
    if (!timelineData.startDate || !timelineData.endDate || entries.length === 0) {
      return [];
    }

    const totalTime = timelineData.endDate.getTime() - timelineData.startDate.getTime();
    
    return entries.map(entry => {
      const entryDate = new Date(entry.date);
      const entryTime = entryDate.getTime() - timelineData.startDate!.getTime();
      const position = (entryTime / totalTime) * 100;
      
      // Clamp position to 0-100%
      const clampedPosition = Math.max(0, Math.min(100, position));
      
      return {
        entry,
        position: clampedPosition,
        color: calculateEntryColor(entry),
      };
    });
  }, [entries, timelineData]);

  return (
    <div className="global-timeline-minimap">
      <div className="minimap-container">
        {/* Fractal web background pattern */}
        <svg className="fractal-web" viewBox="0 0 1000 100" preserveAspectRatio="none">
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
          
          {/* Illuminated timeline path - curves through the fractal web */}
          <path
            d={`M 0,50 Q ${linePosition * 5},25 ${linePosition * 10},50 T 1000,50`}
            stroke="#4a90e2"
            strokeWidth="3"
            fill="none"
            opacity="0.8"
            className="timeline-path"
          />
          <path
            d={`M 0,50 Q ${linePosition * 5},25 ${linePosition * 10},50 T 1000,50`}
            stroke="#2196f3"
            strokeWidth="2"
            fill="none"
            opacity="0.6"
            className="timeline-path-glow"
          />
          {/* Additional subtle paths suggesting other timeline possibilities */}
          <path
            d={`M 0,45 Q ${linePosition * 4},20 ${linePosition * 8},45 T 1000,45`}
            stroke="#90caf9"
            strokeWidth="1"
            fill="none"
            opacity="0.2"
          />
          <path
            d={`M 0,55 Q ${linePosition * 6},30 ${linePosition * 12},55 T 1000,55`}
            stroke="#90caf9"
            strokeWidth="1"
            fill="none"
            opacity="0.2"
          />
        </svg>

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
          {entryPositions.map(({ entry, position, color }, idx) => {
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
                className="entry-indicator"
                style={{
                  left: `${position}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 6px ${color}40, 0 0 12px ${color}20`,
                }}
                onClick={handleClick}
                title={entry.title}
              />
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
                left: `${linePosition}%`,
                width: indicatorWidth
              }}
            />
          );
        })()}
      </div>
    </div>
  );
}

