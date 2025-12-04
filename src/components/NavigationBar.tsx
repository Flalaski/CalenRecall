import { TimeRange } from '../types';
import { format, addMonths, subMonths, addYears, subYears, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
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
  const navigate = (direction: 'prev' | 'next') => {
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
    onDateChange(new Date());
  };

  return (
    <div className="navigation-bar">
      <div className="nav-controls">
        <button className="nav-button" onClick={() => navigate('prev')}>
          ←
        </button>
        <button className="nav-button today-button" onClick={goToToday}>
          Today
        </button>
        <button className="nav-button" onClick={() => navigate('next')}>
          →
        </button>
        <h2 className="date-label">{getDateLabel()}</h2>
      </div>
      <div className="view-mode-selector">
        <button
          className={`view-mode-button ${viewMode === 'decade' ? 'active' : ''}`}
          onClick={() => onViewModeChange('decade')}
        >
          Decade
        </button>
        <button
          className={`view-mode-button ${viewMode === 'year' ? 'active' : ''}`}
          onClick={() => onViewModeChange('year')}
        >
          Year
        </button>
        <button
          className={`view-mode-button ${viewMode === 'month' ? 'active' : ''}`}
          onClick={() => onViewModeChange('month')}
        >
          Month
        </button>
        <button
          className={`view-mode-button ${viewMode === 'week' ? 'active' : ''}`}
          onClick={() => onViewModeChange('week')}
        >
          Week
        </button>
        <button
          className={`view-mode-button ${viewMode === 'day' ? 'active' : ''}`}
          onClick={() => onViewModeChange('day')}
        >
          Day
        </button>
        {onOpenPreferences && (
          <button
            className="view-mode-button preferences-button"
            onClick={onOpenPreferences}
            title="Preferences"
          >
            ⚙️
          </button>
        )}
      </div>
    </div>
  );
}

