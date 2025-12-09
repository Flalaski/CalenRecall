# Boundary Test Profile

This document describes the boundary test profile generated for CalenRecall database testing.

## Overview

The boundary test profile (`boundary-test-profile.json`) is a comprehensive test dataset that pushes the boundaries of what a CalenRecall database can contain. It contains **8,549 entries** testing various edge cases, limits, and stress scenarios.

## Test Coverage

### 1. Extreme Date Ranges
- **Minimum Year**: -9999 (minimum supported year)
- **Maximum Year**: 9999 (maximum supported year)
- **Year Zero**: Boundary between BC and AD dates
- **Year -1**: Last year BC
- **Year 1**: First year AD

### 2. All Time Ranges
Tests all five time range types:
- `decade`
- `year`
- `month`
- `week`
- `day`

### 3. Time Field Edge Cases
- **00:00:00**: Minimum time values (midnight)
- **23:59:59**: Maximum time values (last second of day)
- **null values**: All time fields null
- **Partial times**: Hour only, hour+minute, full time
- Tests all boundary values: 0, 23, 59

### 4. Text Length Boundaries
- **Maximum Title**: 10,000 characters
- **Maximum Content**: 1 MB (1,048,576 characters)
- **Empty Title**: Empty string
- **Empty Content**: Empty string

### 5. Unicode and Special Characters
- **Unicode Text**: Extensive Unicode characters including:
  - Greek letters (α, β, γ, δ, ε)
  - Chinese characters (一, 二, 三, 四, 五)
  - Japanese Hiragana (あ, い, う, え, お)
  - Cyrillic letters (А, Б, В, Г, Д)
  - Arrows and symbols (→, ←, ↑, ↓, ✓, ★, ♠)
  - Emoji (💀, 🔥, ⚡, 🌟, 🎉, 🚀, 🎨, 📝)
  - Accented characters (ñ, é, ü, ø, ä)

### 6. Security Testing
- **SQL Injection Attempts**: Tests database escaping
- **XSS Attempts**: Tests HTML/script injection safety

### 7. Tags Array Boundaries
- **Maximum Tags**: 1,000 tags per entry
- **Empty Tags**: Empty array
- **Special Character Tags**: Tags with dashes, underscores, dots, spaces, quotes, apostrophes, emoji, Unicode, and very long names

### 8. Multiple Entries per Date/TimeRange
- **100 entries** with the same date and timeRange combination
- Tests database handling of multiple entries per date/timeRange (no unique constraint)

### 9. Archived and Pinned Combinations
- Archived only
- Pinned only
- Both archived and pinned
- Neither archived nor pinned

### 10. Timestamp Boundaries
- **Minimum Timestamp**: 1970-01-01T00:00:00.000Z (Unix epoch start)
- **Maximum Timestamp**: 9999-12-31T23:59:59.999Z

### 11. Bulk Entries (Stress Testing)
- **~9,870 bulk entries** spanning years 2020-2024
- Multiple entries per day
- Various hours, minutes, seconds
- Mix of archived and pinned entries
- Comprehensive tag coverage

### 12. Decade Entries
- Entries for decades: 2020s, 2030s

### 13. Year Entries
- Annual summaries for years 2020-2024

### 14. Month Entries
- Monthly summaries for all months in 2024

## File Information

- **Filename**: `boundary-test-profile.json`
- **Size**: ~5.24 MB
- **Format**: JSON array of journal entries
- **Encoding**: UTF-8
- **Total Entries**: 8,549

## Import Instructions

### Method 1: Using CalenRecall UI

1. **Create Test Profile** (recommended):
   - Open CalenRecall
   - Go to Profile menu → Create New Profile
   - Name it "Boundary Test" or similar
   - Select this profile

2. **Import the JSON file**:
   - Go to **File → Import → JSON**
   - Navigate to `boundary-test-profile.json`
   - Select the file and click "Open"
   - Wait for import to complete (this may take several minutes)

3. **Verify Import**:
   - Check that all entries were imported successfully
   - Review the import summary (should show 8,549 imported entries)
   - Test various queries and views

### Method 2: Using Profile Manager (Advanced)

If you want to create the profile programmatically:

```javascript
const { createProfile } = require('./electron/profile-manager');
const profile = createProfile('Boundary Test');
// Then import using the UI as described above
```

## Testing Scenarios

After importing, test the following scenarios:

### 1. Date Range Queries
- Query entries from year -9999
- Query entries from year 9999
- Query entries around year 0

### 2. Time Range Views
- Switch between decade/year/month/week/day views
- Verify all time ranges display correctly

### 3. Search Functionality
- Search for Unicode text
- Search for entries with many tags
- Search for entries with specific time values

### 4. Filtering
- Filter archived entries
- Filter pinned entries
- Filter by tags (including special character tags)
- Filter by date ranges

### 5. Performance
- Load large date ranges
- Export all entries
- Switch between views quickly
- Test with all entries displayed

### 6. Display
- Verify Unicode characters display correctly
- Check that very long titles/content render properly
- Verify time values display correctly (00:00:00, 23:59:59, null)

### 7. Database Integrity
- Verify all entries saved correctly
- Check database file size
- Test database backup/restore
- Verify no data corruption

## Expected Behavior

### Successful Import
- All 8,549 entries should import without errors
- Import may take 5-15 minutes depending on system
- Database file should be approximately 5-10 MB after import

### Database Performance
- Queries should complete in reasonable time (< 1 second for most)
- View switching should be smooth
- Search should work across all entries

### Edge Cases
- All date ranges should be handled correctly
- All time values should be stored and retrieved correctly
- Unicode characters should display correctly
- Large text fields should be fully accessible

## Known Limitations

1. **Import Time**: Large imports may take several minutes
2. **Memory Usage**: Viewing all entries at once may use significant memory
3. **Display**: Some very long content may require scrolling
4. **Linked Entries**: This test profile doesn't test linked entries (they require existing entry IDs)

## Troubleshooting

### Import Fails
- Check file encoding is UTF-8
- Verify JSON is valid (use a JSON validator)
- Ensure sufficient disk space
- Check database file permissions

### Import is Slow
- Normal for large imports (8,549 entries)
- Progress updates should appear
- Can take 5-15 minutes depending on system

### Some Entries Missing
- Check import summary for skipped entries
- Verify no entries have `id` fields (those are skipped)
- Check for validation errors in console

### Display Issues
- Verify font supports Unicode characters
- Check that browser/Electron supports emoji
- Ensure proper text encoding

## Generating New Test Profile

To regenerate the test profile with different parameters:

```bash
node scripts/generate-boundary-test-profile.js
```

Edit `scripts/generate-boundary-test-profile.js` to adjust:
- `MAX_ENTRIES`: Total number of entries to generate
- `ENTRIES_PER_DATE`: Number of entries per date/timeRange combination
- Text sizes: Adjust `maxTitleLength` and `maxContentLength`

## Additional Test Cases

To add more test cases, edit `scripts/generate-boundary-test-profile.js` and add new entry generation sections before the "WRITE OUTPUT" section.

## Version Information

- **Generated**: 2024-12-08
- **CalenRecall Version**: Compatible with profile system (v2.0+)
- **Script Version**: 1.0

## Notes

- This profile is designed for testing and should not be used as a production database
- The profile may be large and may slow down the application
- Consider creating a separate profile for this test data
- You can delete the profile after testing if needed

---

**WARNING**: This test profile contains extreme values and edge cases. Some entries may intentionally push boundaries beyond normal usage. Use this profile in a test environment, not with production data.

