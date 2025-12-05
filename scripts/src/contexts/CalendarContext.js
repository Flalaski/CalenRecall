"use strict";
/**
 * Calendar Context
 *
 * Provides app-wide calendar system selection and conversion utilities.
 * Allows users to switch between different calendar systems while maintaining
 * accurate date synchronization.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarProvider = CalendarProvider;
exports.useCalendar = useCalendar;
const react_1 = __importStar(require("react"));
const types_1 = require("../utils/calendars/types");
const calendarConverter_1 = require("../utils/calendars/calendarConverter");
const dateUtils_1 = require("../utils/dateUtils");
const CalendarContext = (0, react_1.createContext)(undefined);
function CalendarProvider({ children }) {
    const [calendar, setCalendarState] = (0, react_1.useState)('gregorian');
    const [preferencesLoaded, setPreferencesLoaded] = (0, react_1.useState)(false);
    // Load calendar preference from storage
    (0, react_1.useEffect)(() => {
        if (window.electronAPI) {
            window.electronAPI.getPreference('defaultCalendar')
                .then((pref) => {
                if (pref && typeof pref === 'string') {
                    setCalendarState(pref);
                }
                setPreferencesLoaded(true);
            })
                .catch(() => {
                setPreferencesLoaded(true);
            });
        }
        else {
            setPreferencesLoaded(true);
        }
    }, []);
    // Save calendar preference when it changes
    const setCalendar = (0, react_1.useCallback)((newCalendar) => {
        setCalendarState(newCalendar);
        if (window.electronAPI && preferencesLoaded) {
            window.electronAPI.setPreference('defaultCalendar', newCalendar).catch(console.error);
        }
    }, [preferencesLoaded]);
    // Convert Date to current calendar
    const dateToCalendar = (0, react_1.useCallback)((date) => {
        return (0, calendarConverter_1.dateToCalendarDate)(date, calendar);
    }, [calendar]);
    // Convert calendar date to Date
    const calendarToDate = (0, react_1.useCallback)((calendarDate) => {
        return (0, calendarConverter_1.calendarDateToDate)(calendarDate);
    }, []);
    // Convert date string (ISO format) to calendar date
    const dateStringToCalendar = (0, react_1.useCallback)((dateStr) => {
        const date = (0, dateUtils_1.parseISODate)(dateStr);
        return (0, calendarConverter_1.dateToCalendarDate)(date, calendar);
    }, [calendar]);
    // Format date in current calendar
    const formatDate = (0, react_1.useCallback)((date, format = 'YYYY-MM-DD') => {
        const calendarDate = (0, calendarConverter_1.dateToCalendarDate)(date, calendar);
        return (0, calendarConverter_1.formatCalendarDate)(calendarDate, format);
    }, [calendar]);
    // Format calendar date
    const formatCalendarDateFunc = (0, react_1.useCallback)((calendarDate, format = 'YYYY-MM-DD') => {
        return (0, calendarConverter_1.formatCalendarDate)(calendarDate, format);
    }, []);
    // Get calendar info
    const getCalendarInfo = (0, react_1.useCallback)(() => {
        return types_1.CALENDAR_INFO[calendar];
    }, [calendar]);
    const value = {
        calendar,
        setCalendar,
        dateToCalendar,
        calendarToDate,
        dateStringToCalendar,
        formatDate,
        formatCalendarDate: formatCalendarDateFunc,
        getCalendarInfo,
    };
    return (<CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>);
}
function useCalendar() {
    const context = (0, react_1.useContext)(CalendarContext);
    if (context === undefined) {
        throw new Error('useCalendar must be used within a CalendarProvider');
    }
    return context;
}
