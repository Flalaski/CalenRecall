# Changelog

All notable changes to CalenRecall will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Version control system for builds
- Import progress feedback with progress bar for large imports
- CSV export format option for journal entries
- Comprehensive import format documentation (JSON and Markdown)
- Calendar authenticity audit documentation (17 calendars reviewed)
- Epoch verification tools and test scripts
- Entry preloading optimization for faster startup
- Enhanced loading screen with progress indicators

### Improved
- Import process now shows real-time progress with detailed statistics
- Export functionality expanded to include CSV format
- Calendar system accuracy verified and documented
- Performance optimizations for entry loading

### Fixed
- Mayan Long Count epoch bug (missing case statement)
- Entry loading performance issues

### Documentation
- Added `IMPORT_FORMAT.md` with detailed import/export specifications
- Created comprehensive calendar audit reports
- Documented calendar system limitations and approximations
- Added user guide for calendar systems

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

