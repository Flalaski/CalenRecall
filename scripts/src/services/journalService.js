"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEntryForDate = getEntryForDate;
exports.saveJournalEntry = saveJournalEntry;
exports.deleteJournalEntry = deleteJournalEntry;
exports.getEntriesForDate = getEntriesForDate;
exports.searchJournalEntries = searchJournalEntries;
exports.getEntriesForRange = getEntriesForRange;
const dateUtils_1 = require("../utils/dateUtils");
async function getEntryForDate(date, timeRange) {
    if (!window.electronAPI) {
        throw new Error('Electron API not available');
    }
    const canonicalDate = (0, dateUtils_1.getCanonicalDate)(date, timeRange);
    const dateStr = (0, dateUtils_1.formatDate)(canonicalDate);
    return await window.electronAPI.getEntry(dateStr, timeRange);
}
async function saveJournalEntry(entry) {
    if (!window.electronAPI) {
        throw new Error('Electron API not available');
    }
    await window.electronAPI.saveEntry(entry);
}
async function deleteJournalEntry(id) {
    if (!window.electronAPI) {
        throw new Error('Electron API not available');
    }
    await window.electronAPI.deleteEntry(id);
}
async function getEntriesForDate(date, timeRange) {
    if (!window.electronAPI) {
        throw new Error('Electron API not available');
    }
    const canonicalDate = (0, dateUtils_1.getCanonicalDate)(date, timeRange);
    const dateStr = (0, dateUtils_1.formatDate)(canonicalDate);
    return await window.electronAPI.getEntriesByDateRange(dateStr, timeRange);
}
async function searchJournalEntries(query) {
    if (!window.electronAPI) {
        throw new Error('Electron API not available');
    }
    return await window.electronAPI.searchEntries(query);
}
async function getEntriesForRange(range, date) {
    if (!window.electronAPI) {
        throw new Error('Electron API not available');
    }
    let value;
    switch (range) {
        case 'decade':
            const year = date.getFullYear();
            value = Math.floor(year / 10);
            break;
        case 'year':
            value = date.getFullYear();
            break;
        case 'month':
            value = date.getFullYear() * 12 + date.getMonth();
            break;
        case 'week':
            // Calculate week number based on Monday-based weeks
            // Use a reference Monday that works for all dates: January 1, 0001 was a Monday
            // (in proleptic Gregorian calendar)
            const weekStart = new Date(date);
            const dayOfWeek = weekStart.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday (0) to 6
            weekStart.setDate(weekStart.getDate() - daysToMonday);
            // Reference Monday: January 1, 0001 (works for all dates including negative years)
            const referenceMonday = new Date(1, 0, 1);
            value = Math.floor((weekStart.getTime() - referenceMonday.getTime()) / (1000 * 60 * 60 * 24 * 7));
            break;
        case 'day':
            // Use January 1, 0001 as reference (works for all dates in proleptic Gregorian calendar)
            const referenceDay = new Date(1, 0, 1);
            value = Math.floor((date.getTime() - referenceDay.getTime()) / (1000 * 60 * 60 * 24));
            break;
    }
    return await window.electronAPI.getEntriesByRange(range, value);
}
