/**
 * Calendar Context
 * 
 * Provides app-wide calendar system selection and conversion utilities.
 * Allows users to switch between different calendar systems while maintaining
 * accurate date synchronization.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CalendarSystem, CalendarDate, CALENDAR_INFO } from '../utils/calendars/types';
import { dateToCalendarDate, calendarDateToDate, formatCalendarDate } from '../utils/calendars/calendarConverter';
import { parseISODate } from '../utils/dateUtils';

interface CalendarContextType {
  // Current calendar system
  calendar: CalendarSystem;
  setCalendar: (calendar: CalendarSystem) => void;
  
  // Convert Date to current calendar
  dateToCalendar: (date: Date) => CalendarDate;
  
  // Convert calendar date to Date
  calendarToDate: (calendarDate: CalendarDate) => Date;
  
  // Convert date string to calendar date
  dateStringToCalendar: (dateStr: string) => CalendarDate;
  
  // Format date in current calendar
  formatDate: (date: Date, format?: string) => string;
  
  // Format calendar date
  formatCalendarDate: (calendarDate: CalendarDate, format?: string) => string;
  
  // Get calendar info
  getCalendarInfo: () => import('../utils/calendars/types').CalendarInfo;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [calendar, setCalendarState] = useState<CalendarSystem>('gregorian');
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Load calendar preference from storage (use 'calendar' key to match profile database)
  useEffect(() => {
    const loadCalendar = async () => {
      if (window.electronAPI) {
        try {
          const pref = await window.electronAPI.getPreference('calendar');
          if (pref && typeof pref === 'string') {
            setCalendarState(pref as CalendarSystem);
          }
          setPreferencesLoaded(true);
        } catch {
          setPreferencesLoaded(true);
        }
      } else {
        setPreferencesLoaded(true);
      }
    };
    
    loadCalendar();
    
    // Listen for profile switches to reload calendar from new profile
    if (window.electronAPI && (window.electronAPI as any).onProfileSwitched) {
      const handleProfileSwitch = async () => {
        console.log('[CalendarContext] Profile switched, reloading calendar preference');
        // Wait a moment for the database to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        const pref = await window.electronAPI.getPreference('calendar');
        if (pref && typeof pref === 'string') {
          setCalendarState(pref as CalendarSystem);
        }
      };
      
      (window.electronAPI as any).onProfileSwitched(handleProfileSwitch);
      
      return () => {
        if ((window.electronAPI as any).removeProfileListeners) {
          (window.electronAPI as any).removeProfileListeners();
        }
      };
    }
  }, []);

  // Save calendar preference when it changes (use 'calendar' key to match profile database)
  const setCalendar = useCallback(async (newCalendar: CalendarSystem) => {
    setCalendarState(newCalendar);
    if (window.electronAPI && preferencesLoaded) {
      try {
        const result = await window.electronAPI.setPreference('calendar', newCalendar);
        if (result && !result.success) {
          console.error('[CalendarContext] Failed to save calendar preference');
        } else {
          console.log('[CalendarContext] ✅ Calendar preference saved:', newCalendar);
        }
      } catch (error) {
        console.error('[CalendarContext] ❌ Error saving calendar preference:', error);
        // Don't revert the state change - the UI should reflect the user's choice
        // The preference will be saved on next attempt or when the app restarts
      }
    } else if (!preferencesLoaded) {
      console.warn('[CalendarContext] Preferences not loaded yet, calendar change will be saved when ready');
    }
  }, [preferencesLoaded]);

  // Convert Date to current calendar
  const dateToCalendar = useCallback((date: Date): CalendarDate => {
    return dateToCalendarDate(date, calendar);
  }, [calendar]);

  // Convert calendar date to Date
  const calendarToDate = useCallback((calendarDate: CalendarDate): Date => {
    return calendarDateToDate(calendarDate);
  }, []);

  // Convert date string (ISO format) to calendar date
  const dateStringToCalendar = useCallback((dateStr: string): CalendarDate => {
    const date = parseISODate(dateStr);
    return dateToCalendarDate(date, calendar);
  }, [calendar]);

  // Format date in current calendar
  const formatDate = useCallback((date: Date, format: string = 'YYYY-MM-DD'): string => {
    const calendarDate = dateToCalendarDate(date, calendar);
    return formatCalendarDate(calendarDate, format);
  }, [calendar]);

  // Format calendar date
  const formatCalendarDateFunc = useCallback((calendarDate: CalendarDate, format: string = 'YYYY-MM-DD'): string => {
    return formatCalendarDate(calendarDate, format);
  }, []);

  // Get calendar info
  const getCalendarInfo = useCallback(() => {
    return CALENDAR_INFO[calendar];
  }, [calendar]);

  const value: CalendarContextType = {
    calendar,
    setCalendar,
    dateToCalendar,
    calendarToDate,
    dateStringToCalendar,
    formatDate,
    formatCalendarDate: formatCalendarDateFunc,
    getCalendarInfo,
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar(): CalendarContextType {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}

