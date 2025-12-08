/**
 * Date Entry Field Configuration
 * 
 * Defines the date entry field structure for each calendar type.
 * This allows the NavigationBar to dynamically render appropriate
 * input fields based on the selected calendar system.
 */

import { CalendarSystem } from './types';

export interface DateFieldConfig {
  label: string;
  placeholder: string;
  min?: number;
  max?: number;
  maxLength?: number;
  validation?: (value: string) => boolean;
  formatValue?: (value: string) => string;
}

export interface CalendarDateEntryConfig {
  fields: DateFieldConfig[];
  parseDate: (values: string[]) => { year: number; month: number; day: number } | null;
  getHelperText: () => string;
}

/**
 * Get date entry configuration for a calendar system
 */
export function getDateEntryConfig(calendar: CalendarSystem): CalendarDateEntryConfig {
  switch (calendar) {
    case 'mayan-tzolkin':
      return {
        fields: [
          {
            label: 'Cycle',
            placeholder: 'Cycle',
            maxLength: 6,
            formatValue: (v) => v.replace(/[^+\-\d]/g, ''), // Allow +, -, and digits
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num);
            }
          },
          {
            label: 'Trecena',
            placeholder: '1-13',
            min: 1,
            max: 13,
            maxLength: 2,
            formatValue: (v) => v.replace(/\D/g, ''),
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 1 && num <= 13;
            }
          },
          {
            label: 'Day Name',
            placeholder: '1-20',
            min: 1,
            max: 20,
            maxLength: 2,
            formatValue: (v) => v.replace(/\D/g, ''),
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 1 && num <= 20;
            }
          }
        ],
        parseDate: (values) => {
          const [cycle, number, dayName] = values;
          const cycleNum = parseInt(cycle.trim(), 10);
          const numberNum = parseInt(number.trim(), 10);
          const dayNameNum = parseInt(dayName.trim(), 10);
          
          if (isNaN(cycleNum) || isNaN(numberNum) || isNaN(dayNameNum)) {
            return null;
          }
          
          if (numberNum < 1 || numberNum > 13 || dayNameNum < 1 || dayNameNum > 20) {
            return null;
          }
          
          // In Tzolk'in: year = cycle, month = dayNameIndex, day = number
          return {
            year: cycleNum,
            month: dayNameNum,
            day: numberNum
          };
        },
        getHelperText: () => 'Enter cycle (required), trecena (1-13), and day name (1-20)'
      };

    case 'mayan-haab':
      return {
        fields: [
          {
            label: 'Haab',
            placeholder: 'Haab',
            maxLength: 6,
            formatValue: (v) => v.replace(/[^+\-\d]/g, ''), // Allow +, -, and digits
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num);
            }
          },
          {
            label: 'Uinal',
            placeholder: '1-19',
            min: 1,
            max: 19,
            maxLength: 2,
            formatValue: (v) => v.replace(/\D/g, ''),
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 1 && num <= 19;
            }
          },
          {
            label: 'K\'in',
            placeholder: '1-20',
            min: 1,
            max: 20,
            maxLength: 2,
            formatValue: (v) => v.replace(/\D/g, ''),
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 1 && num <= 20;
            }
          }
        ],
        parseDate: (values) => {
          const [year, month, day] = values;
          const yearNum = parseInt(year.trim(), 10);
          const monthNum = parseInt(month.trim(), 10);
          const dayNum = parseInt(day.trim(), 10);
          
          if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum)) {
            return null;
          }
          
          if (monthNum < 1 || monthNum > 19) {
            return null;
          }
          
          // Wayeb' (month 19) has only 5 days
          if (monthNum === 19 && (dayNum < 1 || dayNum > 5)) {
            return null;
          }
          
          // Regular months have 20 days
          if (monthNum < 19 && (dayNum < 1 || dayNum > 20)) {
            return null;
          }
          
          return {
            year: yearNum,
            month: monthNum,
            day: dayNum
          };
        },
        getHelperText: () => 'Enter Haab (required), Uinal (1-19), and K\'in (1-20, or 1-5 for Wayeb\')'
      };

    case 'mayan-longcount':
      return {
        fields: [
          {
            label: 'Baktun',
            placeholder: 'Baktun',
            maxLength: 4,
            formatValue: (v) => v.replace(/[^+\-\d]/g, ''), // Allow +, -, and digits
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num);
            }
          },
          {
            label: 'Katun',
            placeholder: 'Katun',
            maxLength: 3,
            formatValue: (v) => v.replace(/[^+\-\d]/g, ''), // Allow +, -, and digits
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 0 && num < 20;
            }
          },
          {
            label: 'Tun',
            placeholder: 'Tun',
            maxLength: 3,
            formatValue: (v) => v.replace(/[^+\-\d]/g, ''), // Allow +, -, and digits
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 0 && num < 20;
            }
          },
          {
            label: 'Uinal',
            placeholder: 'Uinal',
            maxLength: 2,
            formatValue: (v) => v.replace(/[^+\-\d]/g, ''), // Allow +, -, and digits
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 0 && num < 18;
            }
          },
          {
            label: 'Kin',
            placeholder: 'Kin',
            maxLength: 2,
            formatValue: (v) => v.replace(/[^+\-\d]/g, ''), // Allow +, -, and digits
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 0 && num < 20;
            }
          }
        ],
        parseDate: (values) => {
          const [baktun, katun, tun, uinal, kin] = values;
          const baktunNum = parseInt(baktun.trim(), 10);
          const katunNum = parseInt(katun.trim(), 10);
          const tunNum = parseInt(tun.trim(), 10);
          const uinalNum = parseInt(uinal.trim(), 10);
          const kinNum = parseInt(kin.trim(), 10);
          
          if (isNaN(baktunNum) || isNaN(katunNum) || isNaN(tunNum) || isNaN(uinalNum) || isNaN(kinNum)) {
            return null;
          }
          
          if (katunNum < 0 || katunNum >= 20 || 
              tunNum < 0 || tunNum >= 20 ||
              uinalNum < 0 || uinalNum >= 18 ||
              kinNum < 0 || kinNum >= 20) {
            return null;
          }
          
          // Encode tun, uinal, kin in day field: day = tun * 400 + uinal * 20 + kin
          const encodedDay = tunNum * 400 + uinalNum * 20 + kinNum;
          
          return {
            year: baktunNum,
            month: katunNum,
            day: encodedDay
          };
        },
        getHelperText: () => 'Enter all Long Count components: Baktun, Katun (0-19), Tun (0-19), Uinal (0-17), Kin (0-19)'
      };

    case 'bahai':
      return {
        fields: [
          {
            label: 'Váḥid',
            placeholder: 'Váḥid',
            maxLength: 6,
            formatValue: (v) => v.replace(/[^+\-\d]/g, ''), // Allow +, -, and digits
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num);
            }
          },
          {
            label: 'Month',
            placeholder: '1-19',
            min: 1,
            max: 19,
            maxLength: 2,
            formatValue: (v) => v.replace(/\D/g, ''),
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 1 && num <= 19;
            }
          },
          {
            label: 'Day',
            placeholder: '1-19',
            min: 1,
            max: 19,
            maxLength: 2,
            formatValue: (v) => v.replace(/\D/g, ''),
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 1 && num <= 19;
            }
          }
        ],
        parseDate: (values) => {
          const [year, month, day] = values;
          const yearNum = parseInt(year.trim(), 10);
          const monthNum = parseInt(month.trim(), 10);
          const dayNum = parseInt(day.trim(), 10);
          
          if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum)) {
            return null;
          }
          
          if (monthNum < 1 || monthNum > 19 || dayNum < 1 || dayNum > 19) {
            return null;
          }
          
          return {
            year: yearNum,
            month: monthNum,
            day: dayNum
          };
        },
        getHelperText: () => 'Enter Váḥid (required), month (1-19), and day (1-19)'
      };

    case 'ethiopian':
    case 'coptic':
      return {
        fields: [
          {
            label: 'Year',
            placeholder: 'Year',
            maxLength: 6,
            formatValue: (v) => v.replace(/[^+\-\d]/g, ''), // Allow +, -, and digits
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num);
            }
          },
          {
            label: 'Month',
            placeholder: '1-13',
            min: 1,
            max: 13,
            maxLength: 2,
            formatValue: (v) => v.replace(/\D/g, ''),
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 1 && num <= 13;
            }
          },
          {
            label: 'Day',
            placeholder: '1-30',
            min: 1,
            max: 30,
            maxLength: 2,
            formatValue: (v) => v.replace(/\D/g, ''),
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 1 && num <= 30;
            }
          }
        ],
        parseDate: (values) => {
          const [year, month, day] = values;
          const yearNum = parseInt(year.trim(), 10);
          const monthNum = parseInt(month.trim(), 10);
          const dayNum = parseInt(day.trim(), 10);
          
          if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum)) {
            return null;
          }
          
          if (monthNum < 1 || monthNum > 13 || dayNum < 1 || dayNum > 30) {
            return null;
          }
          
          return {
            year: yearNum,
            month: monthNum,
            day: dayNum
          };
        },
        getHelperText: () => 'Enter year (required), month (1-13), and day (1-30)'
      };

    case 'iroquois':
      return {
        fields: [
          {
            label: 'Year',
            placeholder: 'Year',
            maxLength: 6,
            formatValue: (v) => v.replace(/[^+\-\d]/g, ''), // Allow +, -, and digits
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num);
            }
          },
          {
            label: 'Moon',
            placeholder: '1-13',
            min: 1,
            max: 13,
            maxLength: 2,
            formatValue: (v) => v.replace(/\D/g, ''),
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 1 && num <= 13;
            }
          },
          {
            label: 'Day',
            placeholder: '1-28',
            min: 1,
            max: 28,
            maxLength: 2,
            formatValue: (v) => v.replace(/\D/g, ''),
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 1 && num <= 28;
            }
          }
        ],
        parseDate: (values) => {
          const [year, moon, day] = values;
          const yearNum = parseInt(year.trim(), 10);
          const moonNum = parseInt(moon.trim(), 10);
          const dayNum = parseInt(day.trim(), 10);
          
          if (isNaN(yearNum) || isNaN(moonNum) || isNaN(dayNum)) {
            return null;
          }
          
          if (moonNum < 1 || moonNum > 13 || dayNum < 1 || dayNum > 28) {
            return null;
          }
          
          return {
            year: yearNum,
            month: moonNum,
            day: dayNum
          };
        },
        getHelperText: () => 'Enter year (required), moon (1-13), and day (1-28)'
      };

    case 'aztec-xiuhpohualli':
      return {
        fields: [
          {
            label: 'Xiuhmolpilli',
            placeholder: 'Xiuhmolpilli',
            maxLength: 6,
            formatValue: (v) => v.replace(/[^+\-\d]/g, ''), // Allow +, -, and digits
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num);
            }
          },
          {
            label: 'Veintena',
            placeholder: '1-18',
            min: 1,
            max: 18,
            maxLength: 2,
            formatValue: (v) => v.replace(/\D/g, ''),
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 1 && num <= 18;
            }
          },
          {
            label: 'Tonalli',
            placeholder: '1-20',
            min: 1,
            max: 20,
            maxLength: 2,
            formatValue: (v) => v.replace(/\D/g, ''),
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 1 && num <= 20;
            }
          }
        ],
        parseDate: (values) => {
          const [year, month, day] = values;
          const yearNum = parseInt(year.trim(), 10);
          const monthNum = parseInt(month.trim(), 10);
          const dayNum = parseInt(day.trim(), 10);
          
          if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum)) {
            return null;
          }
          
          if (monthNum < 1 || monthNum > 18 || dayNum < 1 || dayNum > 20) {
            return null;
          }
          
          return {
            year: yearNum,
            month: monthNum,
            day: dayNum
          };
        },
        getHelperText: () => 'Enter Xiuhmolpilli (required), Veintena (1-18), and Tonalli (1-20)'
      };

    // Default: Standard Year/Month/Day format (Gregorian, Julian, Islamic, Hebrew, Persian, Chinese, Indian-Saka, Thai-Buddhist, Cherokee)
    default:
      return {
        fields: [
          {
            label: 'Year',
            placeholder: 'YYYY',
            maxLength: 6,
            formatValue: (v) => v.replace(/[^+\-\d]/g, ''), // Allow +, -, and digits
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num);
            }
          },
          {
            label: 'Month',
            placeholder: 'MM',
            min: 1,
            max: 12,
            maxLength: 2,
            formatValue: (v) => v.replace(/\D/g, ''),
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 1 && num <= 12;
            }
          },
          {
            label: 'Day',
            placeholder: 'DD',
            min: 1,
            max: 31,
            maxLength: 2,
            formatValue: (v) => v.replace(/\D/g, ''),
            validation: (v) => {
              const num = parseInt(v, 10);
              return !isNaN(num) && num >= 1 && num <= 31;
            }
          }
        ],
        parseDate: (values) => {
          const [year, month, day] = values;
          const yearTrimmed = year.trim();
          const monthTrimmed = month.trim();
          const dayTrimmed = day.trim();
          
          if (!yearTrimmed) {
            return null;
          }
          
          const yearNum = parseInt(yearTrimmed, 10);
          if (isNaN(yearNum)) {
            return null;
          }
          
          // Month and day are optional
          let monthNum = 0;
          if (monthTrimmed) {
            monthNum = parseInt(monthTrimmed, 10) - 1; // Convert to 0-indexed
            if (isNaN(monthNum) || monthNum < 0 || monthNum > 11) {
              return null;
            }
          }
          
          let dayNum = 1;
          if (dayTrimmed) {
            dayNum = parseInt(dayTrimmed, 10);
            if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
              return null;
            }
          }
          
          return {
            year: yearNum,
            month: monthNum + 1, // Convert back to 1-indexed for calendar
            day: dayNum
          };
        },
        getHelperText: () => 'Enter year (required), month and day (optional)'
      };
  }
}

