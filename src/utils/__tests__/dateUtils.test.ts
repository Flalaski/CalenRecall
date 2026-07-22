/**
 * Unit tests for dateUtils
 * Tests the core date manipulation utilities including ISO formatting,
 * negative year handling, JDN conversion, and date parsing.
 */

import {
  formatDateToISO,
  createDate,
  parseISODate,
  formatDate,
  getWeekStart,
  getWeekEnd,
  getMonthStart,
  getMonthEnd,
  getYearStart,
  getYearEnd,
  getDecadeStart,
  getDecadeEnd,
  isToday,
  getDaysInWeek,
  getYearsInDecade,
  getWeekdayLabels,
  formatTime,
  getZodiacColor,
  getZodiacGradientColor,
} from '../dateUtils';

describe('formatDateToISO', () => {
  it('formats a normal date correctly', () => {
    const date = new Date(2024, 0, 15);
    expect(formatDateToISO(date)).toBe('2024-01-15');
  });

  it('formats December date correctly', () => {
    const date = new Date(2024, 11, 25);
    expect(formatDateToISO(date)).toBe('2024-12-25');
  });

  it('formats date with single-digit month/day', () => {
    const date = new Date(2024, 2, 5);
    expect(formatDateToISO(date)).toBe('2024-03-05');
  });

  it('formats negative year (BCE) correctly', () => {
    const date = new Date(-500, 5, 15);
    expect(formatDateToISO(date)).toBe('-0500-06-15');
  });

  it('handles year 0 edge case from JS Date constructor', () => {
    // JS Date constructor with year 0-99 maps to 1900-1999
    const date = new Date(0, 2, 1);
    expect(formatDateToISO(date)).toBe('1900-03-01');
  });
});

describe('createDate', () => {
  it('creates a normal positive year date', () => {
    const date = createDate(2024, 0, 1);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(1);
  });

  it('creates date near year 0 using JDN', () => {
    const date = createDate(1, 0, 1);
    expect(date.getFullYear()).toBe(1);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(1);
  });

  it('creates date for year before 100 safely', () => {
    const date = createDate(50, 5, 15);
    expect(date.getFullYear()).toBe(50);
    expect(date.getMonth()).toBe(5);
    expect(date.getDate()).toBe(15);
  });

  it('creates date for negative year', () => {
    const date = createDate(-500, 3, 10);
    expect(date.getFullYear()).toBe(-500);
    expect(date.getMonth()).toBe(3);
    expect(date.getDate()).toBe(10);
  });
});

describe('parseISODate', () => {
  it('parses standard ISO date', () => {
    const date = parseISODate('2024-01-15');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(15);
  });

  it('parses negative year ISO date', () => {
    const date = parseISODate('-0500-06-15');
    expect(date.getFullYear()).toBe(-500);
    expect(date.getMonth()).toBe(5);
    expect(date.getDate()).toBe(15);
  });

  it('parses year 0 ISO date', () => {
    const date = parseISODate('0000-03-01');
    expect(date.getFullYear()).toBe(0);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(1);
  });

  it('parses date with single-digit month and day', () => {
    const date = parseISODate('2024-03-05');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(5);
  });
});

describe('formatDate', () => {
  it('returns ISO format by default', () => {
    const result = formatDate(new Date(2024, 0, 15));
    expect(result).toBe('2024-01-15');
  });

  it('supports custom format string', () => {
    // Custom format via date-fns format
    const result = formatDate(new Date(2024, 0, 15), 'MM/dd/yyyy');
    expect(result).toBe('01/15/2024');
  });

  it('handles negative years in ISO format', () => {
    const result = formatDate(new Date(-500, 5, 15));
    expect(result).toBe('-0500-06-15');
  });
});

describe('getWeekStart / getWeekEnd', () => {
  it('returns Sunday as week start by default (weekStartsOn=0)', () => {
    // Jan 14, 2024 is a Sunday
    const date = new Date(2024, 0, 14);
    const start = getWeekStart(date);
    expect(start.getDay()).toBe(0); // Sunday
  });

  it('supports Monday week start', () => {
    // Jan 15, 2024 is a Monday
    const date = new Date(2024, 0, 15);
    const start = getWeekStart(date, 1);
    expect(start.getDay()).toBe(1); // Monday
  });

  it('returns week end after start (6-7 days)', () => {
    const date = new Date(2024, 0, 14);
    const start = getWeekStart(date);
    const end = getWeekEnd(date);
    const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
    // Week end should be within a reasonable range of the week start
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(8);
  });
});

describe('getMonthStart / getMonthEnd', () => {
  it('returns the first day of the month', () => {
    const date = new Date(2024, 5, 15);
    const start = getMonthStart(date);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(5);
  });

  it('returns the last day of the month', () => {
    const date = new Date(2024, 0, 15);
    const end = getMonthEnd(date);
    expect(end.getDate()).toBe(31);
  });

  it('handles February in leap year', () => {
    const date = new Date(2024, 1, 15);
    const end = getMonthEnd(date);
    expect(end.getDate()).toBe(29);
  });

  it('handles February in non-leap year', () => {
    const date = new Date(2023, 1, 15);
    const end = getMonthEnd(date);
    expect(end.getDate()).toBe(28);
  });
});

describe('getYearStart / getYearEnd', () => {
  it('returns Jan 1 for year start', () => {
    const date = new Date(2024, 5, 15);
    const start = getYearStart(date);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(start.getFullYear()).toBe(2024);
  });

  it('returns Dec 31 for year end', () => {
    const date = new Date(2024, 5, 15);
    const end = getYearEnd(date);
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
  });
});

describe('getDecadeStart / getDecadeEnd', () => {
  it('returns the start of the decade', () => {
    const date = new Date(2024, 5, 15);
    const start = getDecadeStart(date);
    expect(start.getFullYear()).toBe(2020);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
  });

  it('returns the end of the decade', () => {
    const date = new Date(2024, 5, 15);
    const end = getDecadeEnd(date);
    expect(end.getFullYear()).toBe(2029);
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
  });
});

describe('isToday', () => {
  it('returns true for today', () => {
    expect(isToday(new Date())).toBe(true);
  });

  it('returns false for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(yesterday)).toBe(false);
  });

  it('returns false for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isToday(tomorrow)).toBe(false);
  });
});

describe('getDaysInWeek', () => {
  it('returns 7 days', () => {
    const days = getDaysInWeek(new Date(2024, 0, 15));
    expect(days).toHaveLength(7);
  });

  it('starts on Sunday by default (weekStartsOn=0)', () => {
    const days = getDaysInWeek(new Date(2024, 0, 15));
    expect(days[0].getDay()).toBe(0); // Sunday
  });

  it('starts on Monday when specified', () => {
    const days = getDaysInWeek(new Date(2024, 0, 15), 1);
    expect(days[0].getDay()).toBe(1); // Monday
  });
});

describe('getYearsInDecade', () => {
  it('returns 10 years', () => {
    const years = getYearsInDecade(new Date(2024, 0, 1));
    expect(years).toHaveLength(10);
  });

  it('starts from the decade start', () => {
    const years = getYearsInDecade(new Date(2024, 0, 1));
    expect(years[0].getFullYear()).toBe(2020);
    expect(years[9].getFullYear()).toBe(2029);
  });
});

describe('getWeekdayLabels', () => {
  it('returns Mon-Sun by default', () => {
    const labels = getWeekdayLabels(1);
    expect(labels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('returns Sun-Sat when weekStartsOn=0', () => {
    const labels = getWeekdayLabels(0);
    expect(labels).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });
});

describe('formatTime', () => {
  it('formats in 12h format by default', () => {
    const result = formatTime(14, 30, 0);
    expect(result).toContain('2:30');
    expect(result).toContain('PM');
  });

  it('formats in 24h format', () => {
    const result = formatTime(14, 30, 0, '24h');
    expect(result).toContain('14:30');
  });

  it('handles midnight in 12h', () => {
    const result = formatTime(0, 0, 0);
    expect(result).toContain('12:00');
    expect(result).toContain('AM');
  });

  it('handles noon in 12h', () => {
    const result = formatTime(12, 0, 0);
    expect(result).toContain('12:00');
    expect(result).toContain('PM');
  });
});

describe('getZodiacColor', () => {
  it('returns a string color', () => {
    const color = getZodiacColor(new Date(2024, 0, 15));
    expect(typeof color).toBe('string');
    expect(color.startsWith('#')).toBe(true);
  });

  it('returns different colors for different dates', () => {
    const color1 = getZodiacColor(new Date(2024, 0, 1));
    const color2 = getZodiacColor(new Date(2024, 5, 15));
    expect(color1).not.toBe(color2);
  });
});

describe('getZodiacGradientColor', () => {
  it('returns a string color', () => {
    const color = getZodiacGradientColor(new Date(2024, 0, 15));
    expect(typeof color).toBe('string');
    expect(color.startsWith('#')).toBe(true);
  });
});
