"use strict";
/**
 * Calendar System Types
 *
 * Defines types and interfaces for multi-calendar support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CALENDAR_INFO = void 0;
exports.CALENDAR_INFO = {
    gregorian: {
        name: 'Gregorian',
        nativeName: 'Gregorian',
        type: 'solar',
        months: 12,
        daysInYear: { min: 365, max: 366 },
        eraStart: 1,
        eraName: 'CE',
        leapYearRule: 'Every 4 years, except century years unless divisible by 400'
    },
    julian: {
        name: 'Julian',
        nativeName: 'Julian',
        type: 'solar',
        months: 12,
        daysInYear: { min: 365, max: 366 },
        eraStart: 1,
        eraName: 'CE',
        leapYearRule: 'Every 4 years'
    },
    islamic: {
        name: 'Islamic (Hijri)',
        nativeName: 'التقويم الهجري',
        type: 'lunar',
        months: 12,
        daysInYear: { min: 354, max: 355 },
        eraStart: 622,
        eraName: 'AH',
        leapYearRule: '30-year cycle with 11 leap years'
    },
    hebrew: {
        name: 'Hebrew (Jewish)',
        nativeName: 'הלוח העברי',
        type: 'lunisolar',
        months: 12, // Can have 13 in leap years
        daysInYear: { min: 353, max: 385 },
        eraStart: -3761,
        eraName: 'AM',
        leapYearRule: '19-year Metonic cycle'
    },
    persian: {
        name: 'Persian (Jalali)',
        nativeName: 'گاهشماری جلالی',
        type: 'solar',
        months: 12,
        daysInYear: { min: 365, max: 366 },
        eraStart: 622,
        eraName: 'SH',
        leapYearRule: 'Based on vernal equinox'
    },
    chinese: {
        name: 'Chinese',
        nativeName: '农历',
        type: 'lunisolar',
        months: 12, // Can have 13 in leap years
        daysInYear: { min: 353, max: 385 },
        eraStart: 1,
        eraName: 'CE',
        leapYearRule: 'Based on solar terms and lunar months'
    },
    ethiopian: {
        name: 'Ethiopian',
        nativeName: 'የኢትዮጵያ ዘመን አቆጣጠር',
        type: 'solar',
        months: 13,
        daysInYear: { min: 365, max: 366 },
        eraStart: 8,
        eraName: 'EE',
        leapYearRule: 'Every 4 years'
    },
    coptic: {
        name: 'Coptic',
        nativeName: 'ⲛⲓⲙⲉⲧⲟⲩⲛⲓⲙⲓⲛⲓ',
        type: 'solar',
        months: 13,
        daysInYear: { min: 365, max: 366 },
        eraStart: 284,
        eraName: 'AM',
        leapYearRule: 'Every 4 years'
    },
    'indian-saka': {
        name: 'Indian National (Saka)',
        nativeName: 'शक संवत',
        type: 'solar',
        months: 12,
        daysInYear: { min: 365, max: 366 },
        eraStart: 78,
        eraName: 'Saka',
        leapYearRule: 'Every 4 years'
    },
    bahai: {
        name: 'Baháʼí',
        nativeName: 'Badíʻ',
        type: 'solar',
        months: 19,
        daysInYear: { min: 365, max: 366 },
        eraStart: 1844,
        eraName: 'BE',
        leapYearRule: 'Based on vernal equinox'
    },
    'thai-buddhist': {
        name: 'Thai Buddhist',
        nativeName: 'พุทธศักราช',
        type: 'solar',
        months: 12,
        daysInYear: { min: 365, max: 366 },
        eraStart: -543,
        eraName: 'BE',
        leapYearRule: 'Same as Gregorian'
    },
    'mayan-tzolkin': {
        name: 'Mayan Tzolk\'in',
        nativeName: 'Tzolk\'in',
        type: 'other',
        months: 20,
        daysInYear: 260,
        eraStart: -3114,
        eraName: '',
        leapYearRule: '260-day cycle'
    },
    'mayan-haab': {
        name: 'Mayan Haab\'',
        nativeName: 'Haab\'',
        type: 'solar',
        months: 18,
        daysInYear: 365,
        eraStart: -3114,
        eraName: '',
        leapYearRule: 'Fixed 365-day year'
    },
    'mayan-longcount': {
        name: 'Mayan Long Count',
        nativeName: 'Long Count',
        type: 'other',
        months: 0,
        daysInYear: 0,
        eraStart: -3114,
        eraName: '',
        leapYearRule: 'Linear count from epoch'
    },
    cherokee: {
        name: 'Cherokee',
        nativeName: 'ᎠᏂᏴᏫᏯᎢ',
        type: 'lunisolar',
        months: 12,
        daysInYear: { min: 365, max: 366 },
        eraStart: 1,
        eraName: 'CE',
        leapYearRule: 'Same as Gregorian (adapted 12-month system)'
    },
    iroquois: {
        name: 'Iroquois (Haudenosaunee)',
        nativeName: 'Haudenosaunee',
        type: 'lunisolar',
        months: 13,
        daysInYear: { min: 364, max: 365 }, // 13 moons × ~28 days
        eraStart: 1,
        eraName: 'CE',
        leapYearRule: '13 lunar cycles per solar year'
    },
    'aztec-xiuhpohualli': {
        name: 'Aztec Xiuhpohualli',
        nativeName: 'Xiuhpohualli',
        type: 'solar',
        months: 18,
        daysInYear: 365, // 18 months × 20 days + 5 Nemontemi days
        eraStart: -3114,
        eraName: '',
        leapYearRule: 'Fixed 365-day year (no leap years)'
    }
};
