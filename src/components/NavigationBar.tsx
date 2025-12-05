import { useEffect, useRef } from 'react';
import { TimeRange } from '../types';
import { format, addMonths, addYears, addWeeks, addDays } from 'date-fns';
import { playNavigationSound, playModeSelectionSound, playSettingsSound } from '../utils/audioUtils';
import './NavigationBar.css';

interface NavigationBarProps {
  viewMode: TimeRange;
  onViewModeChange: (mode: TimeRange) => void;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onOpenPreferences?: () => void;
}

export default function NavigationBar({
  viewMode,
  onViewModeChange,
  selectedDate,
  onDateChange,
  onOpenPreferences,
}: NavigationBarProps) {
  // Use ref to access current onDateChange in keyboard handler
  const onDateChangeRef = useRef(onDateChange);
  
  // Keep ref updated
  useEffect(() => {
    onDateChangeRef.current = onDateChange;
  }, [onDateChange]);

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
  };

  const goToToday = () => {
    playNavigationSound();
    onDateChange(new Date());
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
      <div className="nav-controls">
        <img 
          src="/icon.png" 
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
        <h2 className={`date-label date-label-${viewMode}`}>{getDateLabel()}</h2>
      </div>
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
    </div>
  );
}

