import { useState, useEffect, useRef } from 'react';
import { JournalEntry, TimeRange } from '../types';
import { searchJournalEntries } from '../services/journalService';
import { formatDate, parseISODate } from '../utils/dateUtils';
import { useCalendar } from '../contexts/CalendarContext';
import { getTimeRangeLabelInCalendar } from '../utils/calendars/timeRangeConverter';
import { playNavigationSound } from '../utils/audioUtils';
import './SearchView.css';

interface SearchViewProps {
  onEntrySelect: (entry: JournalEntry) => void;
  onClose?: () => void;
}

export default function SearchView({ onEntrySelect, onClose }: SearchViewProps) {
  const { calendar } = useCalendar();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTimeRanges, setSelectedTimeRanges] = useState<TimeRange[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'timeRange'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Get all unique tags from results
  const allTags = Array.from(new Set(results.flatMap(entry => entry.tags || [])));

  // Perform search
  const performSearch = async () => {
    if (!query.trim() && selectedTags.length === 0 && selectedTimeRanges.length === 0 && !startDate && !endDate) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      let searchResults: JournalEntry[] = [];

      // If we have a text query, use the search API
      if (query.trim()) {
        searchResults = await searchJournalEntries(query);
      } else {
        // If no text query but we have filters, get all entries and filter
        if (window.electronAPI) {
          const allEntries = await window.electronAPI.getEntries('0000-01-01', '9999-12-31');
          searchResults = allEntries;
        }
      }

      // Apply filters
      let filtered = searchResults;

      // Filter by tags
      if (selectedTags.length > 0) {
        filtered = filtered.filter(entry => 
          entry.tags && entry.tags.some(tag => selectedTags.includes(tag))
        );
      }

      // Filter by time ranges
      if (selectedTimeRanges.length > 0) {
        filtered = filtered.filter(entry => 
          selectedTimeRanges.includes(entry.timeRange)
        );
      }

      // Filter by date range
      if (startDate) {
        const start = parseISODate(startDate);
        filtered = filtered.filter(entry => {
          const entryDate = parseISODate(entry.date);
          return entryDate >= start;
        });
      }

      if (endDate) {
        const end = parseISODate(endDate);
        filtered = filtered.filter(entry => {
          const entryDate = parseISODate(entry.date);
          return entryDate <= end;
        });
      }

      // Sort results
      filtered.sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'date':
            comparison = a.date.localeCompare(b.date);
            break;
          case 'title':
            comparison = a.title.localeCompare(b.title);
            break;
          case 'timeRange':
            const timeRangeOrder: Record<TimeRange, number> = {
              decade: 0,
              year: 1,
              month: 2,
              week: 3,
              day: 4,
            };
            comparison = timeRangeOrder[a.timeRange] - timeRangeOrder[b.timeRange];
            break;
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });

      setResults(filtered);
    } catch (error) {
      console.error('Error performing search:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selectedTags, selectedTimeRanges, startDate, endDate, sortBy, sortOrder]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleTimeRangeToggle = (timeRange: TimeRange) => {
    setSelectedTimeRanges(prev => 
      prev.includes(timeRange)
        ? prev.filter(t => t !== timeRange)
        : [...prev, timeRange]
    );
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedTimeRanges([]);
    setStartDate('');
    setEndDate('');
  };

  const getTimeRangeLabel = (timeRange: TimeRange): string => {
    switch (timeRange) {
      case 'decade': return 'Decade';
      case 'year': return 'Year';
      case 'month': return 'Month';
      case 'week': return 'Week';
      case 'day': return 'Day';
      default: return '';
    }
  };

  const getTimeRangeColor = (timeRange: TimeRange): string => {
    switch (timeRange) {
      case 'decade': return '#9c27b0';
      case 'year': return '#2196f3';
      case 'month': return '#ff9800';
      case 'week': return '#4caf50';
      case 'day': return '#f44336';
      default: return '#999';
    }
  };

  const formatEntryDate = (entry: JournalEntry): string => {
    const entryDate = parseISODate(entry.date);
    try {
      return getTimeRangeLabelInCalendar(entryDate, entry.timeRange, calendar);
    } catch (e) {
      console.error('Error formatting entry date in calendar:', e);
      switch (entry.timeRange) {
        case 'decade':
          const decadeStart = Math.floor(entryDate.getFullYear() / 10) * 10;
          return `${decadeStart}s`;
        case 'year':
          return formatDate(entryDate, 'yyyy');
        case 'month':
          return formatDate(entryDate, 'MMMM yyyy');
        case 'week':
          return `Week of ${formatDate(entryDate, 'MMM d, yyyy')}`;
        case 'day':
          return formatDate(entryDate, 'MMM d, yyyy');
        default:
          return formatDate(entryDate, 'MMM d, yyyy');
      }
    }
  };

  const handleEntryClick = (entry: JournalEntry) => {
    playNavigationSound();
    onEntrySelect(entry);
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="search-view">
      <div className="search-header">
        <div className="search-input-container">
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search entries by title or content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && onClose) {
                onClose();
              }
            }}
          />
          <button
            className="search-filters-toggle"
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle filters"
          >
            {showFilters ? '▼' : '▶'} Filters
          </button>
        </div>
        {onClose && (
          <button className="search-close-button" onClick={onClose} title="Close search">
            ✕
          </button>
        )}
      </div>

      {showFilters && (
        <div className="search-filters">
          <div className="filter-group">
            <label>Tags:</label>
            <div className="filter-tags">
              {allTags.length > 0 ? (
                allTags.map(tag => (
                  <button
                    key={tag}
                    className={`filter-tag ${selectedTags.includes(tag) ? 'active' : ''}`}
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </button>
                ))
              ) : (
                <span className="filter-empty">No tags available</span>
              )}
            </div>
          </div>

          <div className="filter-group">
            <label>Time Range:</label>
            <div className="filter-time-ranges">
              {(['decade', 'year', 'month', 'week', 'day'] as TimeRange[]).map(timeRange => (
                <button
                  key={timeRange}
                  className={`filter-time-range ${selectedTimeRanges.includes(timeRange) ? 'active' : ''}`}
                  onClick={() => handleTimeRangeToggle(timeRange)}
                  style={selectedTimeRanges.includes(timeRange) ? { backgroundColor: getTimeRangeColor(timeRange) } : {}}
                >
                  {getTimeRangeLabel(timeRange)}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label>Date Range:</label>
            <div className="filter-date-range">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start date"
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End date"
              />
            </div>
          </div>

          <div className="filter-group">
            <label>Sort by:</label>
            <div className="filter-sort">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'date' | 'title' | 'timeRange')}>
                <option value="date">Date</option>
                <option value="title">Title</option>
                <option value="timeRange">Time Range</option>
              </select>
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
              <button className="clear-filters-button" onClick={clearFilters}>
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="search-results">
        {loading ? (
          <div className="search-loading">Searching...</div>
        ) : results.length === 0 ? (
          <div className="search-empty">
            {query.trim() || selectedTags.length > 0 || selectedTimeRanges.length > 0 || startDate || endDate ? (
              <p>No entries found matching your search criteria.</p>
            ) : (
              <p>Enter a search query or use filters to find entries.</p>
            )}
          </div>
        ) : (
          <>
            <div className="search-results-count">
              Found {results.length} {results.length === 1 ? 'entry' : 'entries'}
            </div>
            <div className="search-results-list">
              {results.map((entry) => (
                <div
                  key={entry.id || `${entry.date}-${entry.timeRange}-${entry.createdAt}`}
                  className="search-result-item"
                  onClick={() => handleEntryClick(entry)}
                >
                  <div className="result-item-header">
                    <div className="result-item-title">{entry.title}</div>
                    <div className="result-item-meta">
                      <span
                        className="result-time-range-badge"
                        style={{ backgroundColor: getTimeRangeColor(entry.timeRange) }}
                      >
                        {getTimeRangeLabel(entry.timeRange)}
                      </span>
                      <span className="result-date">{formatEntryDate(entry)}</span>
                    </div>
                  </div>
                  <div className="result-item-content">
                    {entry.content.substring(0, 200)}
                    {entry.content.length > 200 && '...'}
                  </div>
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="result-item-tags">
                      {entry.tags.map((tag, idx) => (
                        <span key={idx} className="result-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

