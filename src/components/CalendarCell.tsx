import { memo } from 'react';
import { JournalEntry, TimeRange } from '../types';
import { formatTime } from '../utils/dateUtils';
import { getEntryColorForDateOptimized } from '../utils/entryColorUtils';
import type { EntryLookup } from '../utils/entryLookupUtils';

interface CalendarCellProps {
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  hasEntry: boolean;
  entryColor: string | null;
  entriesWithTime: JournalEntry[];
  gradientColor?: string;
  timeFormat?: '12h' | '24h';
  onClick: () => void;
  viewMode?: TimeRange;
  // Additional props for different cell types
  label?: string | number;
  subtitle?: string;
  entryCount?: number;
}

/**
 * Memoized calendar cell component
 * Only re-renders when its specific props change
 */
const CalendarCell = memo(function CalendarCell({
  date,
  isSelected,
  isToday,
  hasEntry,
  entryColor,
  entriesWithTime,
  gradientColor,
  timeFormat = '12h',
  onClick,
  viewMode = 'day',
  label,
  subtitle,
  entryCount,
}: CalendarCellProps) {
  const dateLabel = label ?? date.getDate();
  
  return (
    <div
      className={`calendar-cell ${viewMode}-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasEntry ? 'has-entry' : ''}`}
      onClick={(e) => {
        // INP optimization: Defer to next animation frame for better responsiveness
        requestAnimationFrame(() => onClick());
      }}
      style={gradientColor ? { '--zodiac-gradient': gradientColor } as React.CSSProperties : undefined}
    >
      <div className="cell-content">
        <div className="cell-label">
          {viewMode === 'year' && typeof label === 'string' ? (
            <div className="month-title">{label}</div>
          ) : (
            dateLabel
          )}
          {subtitle && <div className="cell-subtitle">{subtitle}</div>}
          {entryCount !== undefined && entryCount > 0 && (
            <div className="month-entry-count">
              {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
            </div>
          )}
        </div>
        {hasEntry && entryColor && (
          <div 
            className="entry-indicator"
            style={{ backgroundColor: entryColor }}
          />
        )}
        {entriesWithTime.length > 0 && (
          <div className="cell-time-info">
            {entriesWithTime.slice(0, 2).map((entry, eIdx) => {
              const timeStr = formatTime(entry.hour, entry.minute, entry.second, timeFormat);
              return timeStr ? (
                <div key={eIdx} className="cell-time-badge" title={entry.title}>
                  {timeStr}
                </div>
              ) : null;
            })}
            {entriesWithTime.length > 2 && (
              <div className="cell-time-more">+{entriesWithTime.length - 2}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  // Only re-render if relevant props changed
  return (
    prevProps.date.getTime() === nextProps.date.getTime() &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isToday === nextProps.isToday &&
    prevProps.hasEntry === nextProps.hasEntry &&
    prevProps.entryColor === nextProps.entryColor &&
    prevProps.gradientColor === nextProps.gradientColor &&
    prevProps.timeFormat === nextProps.timeFormat &&
    prevProps.label === nextProps.label &&
    prevProps.subtitle === nextProps.subtitle &&
    prevProps.entryCount === nextProps.entryCount &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.entriesWithTime.length === nextProps.entriesWithTime.length &&
    prevProps.entriesWithTime.every((entry, idx) => 
      nextProps.entriesWithTime[idx]?.id === entry.id &&
      nextProps.entriesWithTime[idx]?.hour === entry.hour &&
      nextProps.entriesWithTime[idx]?.minute === entry.minute
    )
  );
});

export default CalendarCell;


