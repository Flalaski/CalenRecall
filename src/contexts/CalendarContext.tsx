/**
 * Calendar Context
 * 
 * Provides app-wide calendar system selection and conversion utilities.
 * Allows users to switch between different calendar systems while maintaining
 * accurate date synchronization.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CalendarSystem, CalendarDate, CALENDAR_INFO } from '../utils/calendars/types';
import { dateToCalendarDate, calendarDateToDate, convertDate, formatCalendarDate, getCalendarConverter } from '../utils/calendars/calendarConverter';
import { dateToJDN, jdnToDate } from '../utils/calendars/julianDayUtils';
import { parseISODate, formatDateToISO } from '../utils/dateUtils';

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

  // Load calendar preference from storage
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getPreference('defaultCalendar')
        .then((pref: string | undefined) => {
          if (pref && typeof pref === 'string') {
            setCalendarState(pref as CalendarSystem);
          }
          setPreferencesLoaded(true);
        })
        .catch(() => {
          setPreferencesLoaded(true);
        });
    } else {
      setPreferencesLoaded(true);
    }
  }, []);

  // Save calendar preference when it changes
  const setCalendar = useCallback((newCalendar: CalendarSystem) => {
    setCalendarState(newCalendar);
    if (window.electronAPI && preferencesLoaded) {
      window.electronAPI.setPreference('defaultCalendar', newCalendar).catch(console.error);
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

