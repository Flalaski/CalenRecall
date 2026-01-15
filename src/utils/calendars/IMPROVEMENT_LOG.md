# Calendar Accuracy Improvement Log

This log tracks improvements and corrections made to calendar implementations as new information becomes available.

## Format

Each entry includes:
- **Date**: When the improvement was made
- **Calendar**: Which calendar system(s) were affected
- **Change**: Description of the improvement
- **Source**: Source of the new information
- **Impact**: Impact on accuracy or functionality

---

## 2026-01-14: Historical Context Enhancement

**Calendars**: All calendars

**Change**: Enhanced calendar descriptions with detailed historical context from "Evolution of Calendars" document

**Details**:
- Added historical information about Julian calendar evolution (45 BCE - 8 CE)
- Added Gregorian calendar regional adoption dates
- Enhanced Hebrew calendar description with Metonic cycle details
- Added Islamic calendar crescent moon sighting practices
- Enhanced Chinese calendar description with reform history

**Source**: "Evolution of Calendars" document by S. Khalid Shaukat (moonsighting.com)

**Impact**: Improved user understanding of calendar history and evolution. No changes to conversion algorithms.

---

## 2026-01-14: Accuracy Framework Establishment

**Calendars**: All calendars

**Change**: Created comprehensive accuracy framework and status tracking system

**Details**:
- Created `ACCURACY_FRAMEWORK.md` - Framework for ensuring accuracy and continuous improvement
- Created `CALENDAR_ACCURACY_STATUS.md` - Detailed status of each calendar with verification and limitations
- Documented known limitations for all calendars
- Established verification process and sources

**Source**: Best practices for calendar system documentation

**Impact**: Provides structure for continuous improvement and transparency about accuracy levels

---

## 2026-01-14: Partial Calendar Implementation Improvements

**Calendars**: Iroquois, Chinese, Cherokee

**Change**: Improved implementations and enhanced documentation for all three partial calendars

**Details**:
- **Iroquois Calendar**: Upgraded from simple approximation (dividing year into 13 equal periods) to using actual full moon cycles calculated from astronomical algorithms. Each moon now begins at a full moon and ends at the next full moon, matching traditional calendar practice. Year starts at first full moon on or after spring equinox.
- **Chinese Calendar**: Enhanced documentation to clarify that implementation is accurate for modern period (1645 CE onwards, Shixian calendar system) and provides reasonable approximations for historical periods before 1645 CE. Added detailed notes about historical calendar reforms and limitations.
- **Cherokee Calendar**: Clarified that implementation is correct for the modern 12-month adaptation (19th century onwards), not the traditional Cherokee calendar. Updated status from "Partial" to "Verified" since it correctly implements what it's designed to represent.

**Source**: 
- Astronomical algorithms from Meeus, "Astronomical Algorithms" (for full moon calculations)
- Historical research on calendar evolution
- Analysis of implementation requirements

**Impact**: 
- Iroquois calendar now uses actual lunar cycles instead of approximations, significantly improving accuracy
- Chinese calendar documentation now clearly explains accuracy levels for different historical periods
- Cherokee calendar status clarified - correctly implemented as modern adaptation

---

## Template for Future Improvements

### [Date]: [Title]

**Calendars**: [Which calendar(s)]

**Change**: [Description of improvement]

**Details**:
- [Detailed information]

**Source**: [Source of new information]

**Impact**: [Impact on accuracy or functionality]

---

## Notes

- Improvements that affect conversion algorithms should be thoroughly tested
- Historical accuracy improvements should be verified against authoritative sources
- User-facing changes should be documented in calendar descriptions
- All improvements should update relevant documentation files