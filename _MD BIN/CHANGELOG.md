# Changelog

All notable changes to CalenRecall will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2025.12.10.1] - 2025-12-10 - Alpha Release

### ⚠️ ALPHA RELEASE - Known Limitations

This is an **alpha release** of CalenRecall. While the core functionality is complete and stable, there are some known limitations and areas for improvement:

**Known Limitations:**
- **Test Coverage**: Unit test coverage is currently low. Core functionality has been manually tested, but automated test coverage needs improvement.
- **Error Reporting**: Production error reporting service integration is planned but not yet implemented (ErrorBoundary has TODO comment).
- **Performance**: With very large datasets (10,000+ entries), initial load may take a few seconds. Performance optimizations are ongoing.
- **Calendar Accuracy**: Some calendar systems may have approximations for very ancient dates (before 1000 BCE). See calendar documentation for details.
- **Export Metadata**: Export metadata modal is not yet integrated with profile-specific export flows (metadata can be added manually in preferences).
- **Platform Support**: Currently Windows-only. macOS and Linux support planned for future releases.

**What Works:**
- ✅ All core journaling features (create, edit, delete entries)
- ✅ Multiple calendar systems (17 calendars)
- ✅ Export/Import functionality (all formats)
- ✅ Profile management with password protection
- ✅ Theme system (37 themes)
- ✅ Search and navigation
- ✅ Timeline minimap
- ✅ Entry versioning and history

**Reporting Issues:**
If you encounter bugs or have suggestions, please report them through the appropriate channels. Your feedback is valuable for improving CalenRecall!

### Added
- **Profile-based export system**: All export formats now include profile selection stage
- **Password-protected profile exports**: Secure export handling for password-protected profiles
- Version control system for builds
- Import progress feedback with progress bar for large imports
- CSV export format option for journal entries
- Comprehensive import format documentation (JSON and Markdown)
- Calendar authenticity audit documentation (17 calendars reviewed)
- Epoch verification tools and test scripts
- Entry preloading optimization for faster startup
- Enhanced loading screen with progress indicators
- Multi-profile support with isolated databases
- Profile password protection with recovery keys

### Improved
- Export workflow now includes profile selection for all formats (Markdown, Text, JSON, RTF, PDF, CSV, DEC)
- Password handling is now consistent across all export operations
- Import process now shows real-time progress with detailed statistics
- Export functionality expanded to include CSV format
- Calendar system accuracy verified and documented
- Performance optimizations for entry loading
- Profile switching and management

### Fixed
- Mayan Long Count epoch bug (missing case statement)
- Entry loading performance issues
- Profile export password handling consistency

### Documentation
- Added `IMPORT_FORMAT.md` with detailed import/export specifications
- Created comprehensive calendar audit reports
- Documented calendar system limitations and approximations
- Added user guide for calendar systems
- Added `ALPHA_NOTES.md` for alpha testers

## [1.0.0] - 2024-01-XX

### Added
- Initial release
- Multiple time views (decades, years, months, weeks, days)
- Hierarchical entry system for different time scales
- Global Timeline Minimap with drag-to-navigate
- Preferences system with theme support
- Local SQLite storage
- Rich journal entries with titles, content, and tags
- Visual indicators for entries
- Windows installer and portable builds

[Unreleased]: https://github.com/yourusername/calenrecall/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourusername/calenrecall/releases/tag/v1.0.0

