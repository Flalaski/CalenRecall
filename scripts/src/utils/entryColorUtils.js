"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateEntryColor = calculateEntryColor;
exports.getEntryColorForDate = getEntryColorForDate;
const dateUtils_1 = require("./dateUtils");
/**
 * Calculate entry color based on numerological calculation
 * This matches the crystal color calculation used in GlobalTimelineMinimap
 */
function calculateEntryColor(entry) {
    // Combine title and content for numerological calculation
    const text = (entry.title || '') + (entry.content || '');
    // Calculate numerological value from text (sum of character codes with weighting)
    let textValue = 0;
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        // Weight characters differently to create more variation
        textValue += charCode * (i % 3 + 1);
    }
    // Calculate time-based numerological value
    const entryDate = (0, dateUtils_1.parseISODate)(entry.date);
    const timeValue = entryDate.getFullYear() * 10000 +
        (entryDate.getMonth() + 1) * 100 +
        entryDate.getDate();
    // Add timeRange to the calculation for additional variation
    const timeRangeValue = entry.timeRange === 'decade' ? 1000 :
        entry.timeRange === 'year' ? 2000 :
            entry.timeRange === 'month' ? 3000 :
                entry.timeRange === 'week' ? 4000 : 5000;
    // Combine all values for numerological calculation
    const combinedValue = (textValue + timeValue + timeRangeValue) % 360; // Use modulo 360 for hue
    // Calculate hue, saturation, and lightness with more variation
    // Increased base saturation for vibrant colors (CSS filter will multiply this)
    const hue = combinedValue; // 0-360 degrees
    const saturation = 75 + (textValue % 20); // 75-95% saturation (very vibrant base)
    const lightness = 45 + (timeValue % 15); // 45-60% lightness (more visible)
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
/**
 * Get the primary entry color for a date/timeRange combination
 * If multiple entries exist, returns the color of the first one
 */
function getEntryColorForDate(entries, date, timeRange) {
    // Find entries that match this date and timeRange
    const matchingEntries = entries.filter(entry => {
        if (entry.timeRange !== timeRange)
            return false;
        const entryDate = (0, dateUtils_1.parseISODate)(entry.date);
        switch (timeRange) {
            case 'day':
                return entryDate.toDateString() === date.toDateString();
            case 'week':
                // Check if date falls within the week of entry
                const weekStart = new Date(entryDate);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                return date >= weekStart && date <= weekEnd;
            case 'month':
                return entryDate.getFullYear() === date.getFullYear() &&
                    entryDate.getMonth() === date.getMonth();
            case 'year':
                return entryDate.getFullYear() === date.getFullYear();
            case 'decade':
                const entryDecade = Math.floor(entryDate.getFullYear() / 10) * 10;
                const dateDecade = Math.floor(date.getFullYear() / 10) * 10;
                return entryDecade === dateDecade;
            default:
                return false;
        }
    });
    if (matchingEntries.length === 0)
        return null;
    // Return color of first matching entry
    return calculateEntryColor(matchingEntries[0]);
}
