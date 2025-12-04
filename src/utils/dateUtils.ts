import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, addDays, addWeeks, addMonths, addYears,
  getWeek, getYear, getMonth, differenceInDays, isSameDay } from 'date-fns';

export function formatDate(date: Date, formatStr: string = 'yyyy-MM-dd'): string {
  return format(date, formatStr);
}

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 }); // Monday
}

export function getWeekEnd(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: 1 });
}

export function getMonthStart(date: Date): Date {
  return startOfMonth(date);
}

export function getMonthEnd(date: Date): Date {
  return endOfMonth(date);
}

export function getYearStart(date: Date): Date {
  return startOfYear(date);
}

export function getYearEnd(date: Date): Date {
  return endOfYear(date);
}

export function getDecadeStart(date: Date): Date {
  const year = getYear(date);
  const decadeStart = Math.floor(year / 10) * 10;
  return new Date(decadeStart, 0, 1);
}

export function getDecadeEnd(date: Date): Date {
  const year = getYear(date);
  const decadeEnd = Math.floor(year / 10) * 10 + 9;
  return new Date(decadeEnd, 11, 31);
}

export function getDaysInMonth(date: Date): Date[] {
  const start = getMonthStart(date);
  const end = getMonthEnd(date);
  const days: Date[] = [];
  let current = new Date(start);
  
  while (current <= end) {
    days.push(new Date(current));
    current = addDays(current, 1);
  }
  
  return days;
}

export function getDaysInWeek(date: Date): Date[] {
  const start = getWeekStart(date);
  const days: Date[] = [];
  
  for (let i = 0; i < 7; i++) {
    days.push(addDays(start, i));
  }
  
  return days;
}

export function getMonthsInYear(date: Date): Date[] {
  const year = getYear(date);
  const months: Date[] = [];
  
  for (let i = 0; i < 12; i++) {
    months.push(new Date(year, i, 1));
  }
  
  return months;
}

export function getYearsInDecade(date: Date): Date[] {
  const decadeStart = Math.floor(getYear(date) / 10) * 10;
  const years: Date[] = [];
  
  for (let i = 0; i < 10; i++) {
    years.push(new Date(decadeStart + i, 0, 1));
  }
  
  return years;
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

// Get canonical date for a time range (the date used to store entries)
export function getCanonicalDate(date: Date, timeRange: 'decade' | 'year' | 'month' | 'week' | 'day'): Date {
  switch (timeRange) {
    case 'decade':
      return getDecadeStart(date);
    case 'year':
      return getYearStart(date);
    case 'month':
      return getMonthStart(date);
    case 'week':
      return getWeekStart(date);
    case 'day':
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    default:
      return date;
  }
}

