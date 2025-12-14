/**
 * Astronomical Events Utility
 * 
 * Provides helper functions to get astronomical events for date ranges
 * and check if a specific date has an astronomical event.
 */

import { 
  getSolsticesEquinoxesForYear, 
  getMoonPhasesForRange,
  getMoonPhase,
  SolsticeEquinoxType,
  MoonPhaseType
} from './calendars/astronomicalUtils';
import { dateToJDN } from './calendars/julianDayUtils';
import { isSameDay } from 'date-fns';

export interface DateAstronomicalEvent {
  date: Date;
  type: 'solstice-equinox' | 'moon-phase';
  name: SolsticeEquinoxType | MoonPhaseType;
  displayName: string;
}

/**
 * Get all astronomical events for a date range
 * @param startDate Start date
 * @param endDate End date
 * @param showSolsticesEquinoxes Whether to include solstices and equinoxes
 * @param showMoonPhases Whether to include moon phases
 * @returns Map of dates (as ISO strings) to events
 */
export function getAstronomicalEventsForRange(
  startDate: Date,
  endDate: Date,
  showSolsticesEquinoxes: boolean = false,
  showMoonPhases: boolean = false
): Map<string, DateAstronomicalEvent[]> {
  const eventsMap = new Map<string, DateAstronomicalEvent[]>();
  
  if (!showSolsticesEquinoxes && !showMoonPhases) {
    return eventsMap;
  }
  
  const startJDN = dateToJDN(startDate);
  const endJDN = dateToJDN(endDate);
  
  // Get solstices and equinoxes for all years in range
  if (showSolsticesEquinoxes) {
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    
    for (let year = startYear; year <= endYear; year++) {
      const yearEvents = getSolsticesEquinoxesForYear(year);
      
      for (const event of yearEvents) {
        if (event.jdn >= startJDN && event.jdn <= endJDN) {
          const eventDate = event.date;
          // Use local date string to match calendar day keys
          const year = eventDate.getFullYear();
          const month = String(eventDate.getMonth() + 1).padStart(2, '0');
          const day = String(eventDate.getDate()).padStart(2, '0');
          const dateKey = `${year}-${month}-${day}`;
          
          if (!eventsMap.has(dateKey)) {
            eventsMap.set(dateKey, []);
          }
          
          const displayNames: Record<SolsticeEquinoxType, string> = {
            'vernal-equinox': 'Vernal Equinox',
            'summer-solstice': 'Summer Solstice',
            'autumnal-equinox': 'Autumnal Equinox',
            'winter-solstice': 'Winter Solstice'
          };
          
          eventsMap.get(dateKey)!.push({
            date: eventDate,
            type: 'solstice-equinox',
            name: event.name as SolsticeEquinoxType,
            displayName: displayNames[event.name as SolsticeEquinoxType]
          });
        }
      }
    }
  }
  
  // Get moon phases for the range
  if (showMoonPhases) {
    const moonEvents = getMoonPhasesForRange(startJDN, endJDN);
    
    for (const event of moonEvents) {
      const eventDate = event.date;
      // Use local date string to match calendar day keys
      const year = eventDate.getFullYear();
      const month = String(eventDate.getMonth() + 1).padStart(2, '0');
      const day = String(eventDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      
      if (!eventsMap.has(dateKey)) {
        eventsMap.set(dateKey, []);
      }
      
      const displayNames: Record<MoonPhaseType, string> = {
        'new': 'New Moon',
        'first-quarter': 'First Quarter',
        'full': 'Full Moon',
        'last-quarter': 'Last Quarter'
      };
      
      eventsMap.get(dateKey)!.push({
        date: eventDate,
        type: 'moon-phase',
        name: event.name as MoonPhaseType,
        displayName: displayNames[event.name as MoonPhaseType]
      });
    }
  }
  
  return eventsMap;
}

/**
 * Get astronomical events for a specific date
 * @param date Date to check
 * @param showSolsticesEquinoxes Whether to include solstices and equinoxes
 * @param showMoonPhases Whether to include moon phases
 * @returns Array of events for that date
 */
export function getAstronomicalEventsForDate(
  date: Date,
  showSolsticesEquinoxes: boolean = false,
  showMoonPhases: boolean = false
): DateAstronomicalEvent[] {
  const events: DateAstronomicalEvent[] = [];
  
  if (!showSolsticesEquinoxes && !showMoonPhases) {
    return events;
  }
  
  const dateJDN = dateToJDN(date);
  const year = date.getFullYear();
  
  // Check for solstices and equinoxes
  if (showSolsticesEquinoxes) {
    const yearEvents = getSolsticesEquinoxesForYear(year);
    
    for (const event of yearEvents) {
      if (isSameDay(event.date, date)) {
        const displayNames: Record<SolsticeEquinoxType, string> = {
          'vernal-equinox': 'Vernal Equinox',
          'summer-solstice': 'Summer Solstice',
          'autumnal-equinox': 'Autumnal Equinox',
          'winter-solstice': 'Winter Solstice'
        };
        
        events.push({
          date: event.date,
          type: 'solstice-equinox',
          name: event.name as SolsticeEquinoxType,
          displayName: displayNames[event.name as SolsticeEquinoxType]
        });
      }
    }
  }
  
  // Check for moon phases
  if (showMoonPhases) {
    const moonPhase = getMoonPhase(dateJDN);
    
    // Only show major phases (new, first quarter, full, last quarter)
    if (moonPhase === 'new' || moonPhase === 'first-quarter' || 
        moonPhase === 'full' || moonPhase === 'last-quarter') {
      const displayNames: Record<string, string> = {
        'new': 'New Moon',
        'first-quarter': 'First Quarter',
        'full': 'Full Moon',
        'last-quarter': 'Last Quarter'
      };
      
      events.push({
        date: date,
        type: 'moon-phase',
        name: moonPhase as MoonPhaseType,
        displayName: displayNames[moonPhase]
      });
    }
  }
  
  return events;
}

/**
 * Get a short label for an astronomical event (for display in calendar cells)
 * @param event Astronomical event
 * @returns Short label
 */
export function getAstronomicalEventLabel(event: DateAstronomicalEvent): string {
  if (event.type === 'solstice-equinox') {
    const labels: Record<SolsticeEquinoxType, string> = {
      'vernal-equinox': '🌱',
      'summer-solstice': '☀️',
      'autumnal-equinox': '🍂',
      'winter-solstice': '❄️'
    };
    return labels[event.name as SolsticeEquinoxType] || event.displayName;
  } else {
    const labels: Record<MoonPhaseType, string> = {
      'new': '🌑',
      'first-quarter': '🌓',
      'full': '🌕',
      'last-quarter': '🌗'
    };
    return labels[event.name as MoonPhaseType] || event.displayName;
  }
}

