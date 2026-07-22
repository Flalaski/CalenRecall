/**
 * Unit tests for accessibility utilities
 */

import {
  getDayCellAriaLabel,
  getMonthCellAriaLabel,
  getYearCellAriaLabel,
  getNavButtonAriaLabel,
  getViewModeAriaLabel,
  getKeyAction,
  getTimeRangeRole,
  initAnnouncer,
} from '../accessibility';

describe('getDayCellAriaLabel', () => {
  it('includes date, today, and entry info', () => {
    const label = getDayCellAriaLabel(new Date(2024, 0, 15), true, 3, true, true);
    expect(label).toContain('Monday');
    expect(label).toContain('January');
    expect(label).toContain('15');
    expect(label).toContain('2024');
    expect(label).toContain('Today');
    expect(label).toContain('Selected');
    expect(label).toContain('3 entries');
  });

  it('handles singular entry', () => {
    const label = getDayCellAriaLabel(new Date(2024, 0, 15), true, 1, false, false);
    expect(label).toContain('1 entry');
  });

  it('handles no entries with hasEntries flag', () => {
    const label = getDayCellAriaLabel(new Date(2024, 0, 15), true, 0, false, false);
    expect(label).toContain('Has entries');
  });
});

describe('getMonthCellAriaLabel', () => {
  it('includes month name, year, and entry count', () => {
    const label = getMonthCellAriaLabel('January', 2024, 5, true);
    expect(label).toContain('January 2024');
    expect(label).toContain('Current month');
    expect(label).toContain('5 entries');
  });
});

describe('getYearCellAriaLabel', () => {
  it('includes year and entry info', () => {
    const label = getYearCellAriaLabel(2024, 10, true);
    expect(label).toContain('Year 2024');
    expect(label).toContain('Current year');
    expect(label).toContain('10 entries');
  });
});

describe('getNavButtonAriaLabel', () => {
  it('describes navigation direction and target', () => {
    const label = getNavButtonAriaLabel('next', 'month', 'February 2024');
    expect(label).toBe('next month: February 2024');
  });
});

describe('getViewModeAriaLabel', () => {
  it('maps view mode codes to readable labels', () => {
    expect(getViewModeAriaLabel('month')).toBe('Month view');
    expect(getViewModeAriaLabel('year')).toBe('Year view');
    expect(getViewModeAriaLabel('decade')).toBe('Decade view');
    expect(getViewModeAriaLabel('week')).toBe('Week view');
    expect(getViewModeAriaLabel('day')).toBe('Day view');
  });
});

describe('getKeyAction', () => {
  it('returns arrow-left for ArrowLeft key', () => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    expect(getKeyAction(event)).toBe('arrow-left');
  });

  it('returns escape for Escape key', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    expect(getKeyAction(event)).toBe('escape');
  });

  it('returns null for typing in input', () => {
    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
    jest.spyOn(event, 'target', 'get').mockReturnValue(input);
    expect(getKeyAction(event)).toBeNull();
  });
});

describe('getTimeRangeRole', () => {
  it('returns correct ARIA roles', () => {
    expect(getTimeRangeRole('day')).toBe('gridcell');
    expect(getTimeRangeRole('month')).toBe('grid');
    expect(getTimeRangeRole('year')).toBe('list');
  });
});

describe('announce', () => {
  beforeEach(() => {
    // Clean up any existing announcer
    const existing = document.getElementById('sr-announcer');
    if (existing) existing.remove();
  });

  it('creates announcer element and announces', () => {
    initAnnouncer();
    const announcer = document.getElementById('sr-announcer');
    expect(announcer).toBeTruthy();
    expect(announcer?.getAttribute('aria-live')).toBe('polite');
  });
});
