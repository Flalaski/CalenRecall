# CalenRecall Alpha Release Notes

**Version:** 2025.12.10.1  
**Release Date:** December 10, 2025  
**Status:** Alpha Release

## Welcome Alpha Testers!

Thank you for testing CalenRecall! This document outlines what to expect in this alpha release, known limitations, and how to provide feedback.

## What's Working

### Core Features ✅
- **Journaling**: Create, edit, and delete entries at any time scale (day, week, month, year, decade)
- **Time Tracking**: Entries support specific hours, minutes, and seconds
- **Multiple Calendars**: 17 different calendar systems for viewing and entering dates
- **Search**: Full-text search across all entries
- **Export/Import**: Export to 7 formats (Markdown, Text, JSON, RTF, PDF, CSV, DEC) and import from JSON/Markdown
- **Profiles**: Multiple isolated profiles with password protection
- **Themes**: 37 built-in themes plus custom theme support
- **Timeline Minimap**: Interactive visual navigation through your timeline
- **Entry Management**: Tags, colors, linking, archiving, pinning, versioning

### Recent Additions
- **Profile-based Exports**: All export formats now include profile selection
- **Password Protection**: Secure profile exports with password verification
- **Performance**: Optimized entry loading and preloading

## Known Limitations

### Test Coverage
- **Status**: Low automated test coverage
- **Impact**: Core features have been manually tested, but edge cases may exist
- **Workaround**: Report any bugs you encounter

### Error Reporting
- **Status**: Production error reporting not yet integrated
- **Impact**: Errors are logged to console in development mode
- **Workaround**: Check console/developer tools if you encounter issues

### Performance
- **Status**: Optimized for typical use cases
- **Impact**: With very large datasets (10,000+ entries), initial load may take 3-5 seconds
- **Workaround**: The loading screen shows progress. For very large datasets, consider archiving old entries.

### Calendar Accuracy
- **Status**: Most calendars are highly accurate
- **Impact**: Some calendar systems may have approximations for very ancient dates (before 1000 BCE)
- **Workaround**: See `_MD BIN/CALENDAR_LIMITATIONS.md` for specific calendar accuracy details

### Export Metadata
- **Status**: Export metadata modal not integrated with profile-specific exports
- **Impact**: When exporting from a specific profile, metadata must be set in preferences beforehand
- **Workaround**: Set default export metadata in Preferences before exporting

### Platform Support
- **Status**: Windows-only currently
- **Impact**: macOS and Linux versions not available yet
- **Workaround**: Windows version runs on Windows 10/11

## Testing Focus Areas

We'd especially appreciate feedback on:

1. **Profile Management**
   - Creating and switching between profiles
   - Password-protected profile functionality
   - Exporting from different profiles

2. **Export/Import**
   - All export formats (Markdown, Text, JSON, RTF, PDF, CSV, DEC)
   - Import from JSON and Markdown
   - Large dataset exports (1000+ entries)

3. **Calendar Systems**
   - Switching between different calendar systems
   - Date entry in non-Gregorian calendars
   - Very old dates (before 1000 BCE)

4. **Performance**
   - Startup time with large datasets
   - Navigation smoothness
   - Search performance

5. **UI/UX**
   - Theme appearance and readability
   - Timeline minimap usability
   - Entry editing workflow

## Reporting Issues

When reporting issues, please include:

1. **Version**: 2025.12.10.1 (or current version)
2. **Steps to Reproduce**: Detailed steps to trigger the issue
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **System Info**: Windows version, hardware specs (if relevant)
6. **Screenshots**: If applicable

## Data Safety

- **Backup**: Always backup your data before testing
- **Database Location**: `%APPDATA%\calenrecall\`
- **Export**: Regularly export your entries as backup (JSON format recommended)

## What's Next

Planned improvements for future releases:

- Enhanced test coverage
- Production error reporting
- Additional performance optimizations
- macOS and Linux support
- Export metadata integration with profile exports
- Additional calendar systems
- Cloud sync (optional, privacy-focused)

## Thank You!

Your feedback helps make CalenRecall better. We appreciate your time testing this alpha release!

---

**Note**: This is an alpha release. While we've tested core functionality, there may be bugs or incomplete features. Use at your own discretion and always maintain backups of your data.

