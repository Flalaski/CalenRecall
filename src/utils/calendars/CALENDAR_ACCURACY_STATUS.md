# Calendar Accuracy Status

This document tracks the accuracy status of each calendar implementation, including verification status, known limitations, and areas for improvement.

Last Updated: 2026-01-14

## Gregorian Calendar

**Status**: ✅ **Verified**

**Implementation**: `julianDayUtils.ts` - Standard algorithm from "Calendrical Calculations"

**Verification**:
- Leap year rule: Divisible by 4 but not by 100, OR divisible by 400 ✅
- Month lengths: Correct (31, 28/29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31) ✅
- Reference dates: Verified against standard implementations ✅

**Known Limitations**:
- Regional adoption dates: Gregorian calendar was adopted at different times in different regions (1582 in Italy/Spain/Portugal/Poland, 1752 in UK/USA, 1918 in Russia, 1927 in Turkey). The implementation uses the standard algorithm but does not account for regional variations. This is a documented limitation.

**Sources**:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001. (Primary algorithm source)
- Richards, E.G. *Mapping Time: The Calendar and Its History*. Oxford University Press, 1998. (Historical context)
- Papal Bull *Inter gravissimas* by Pope Gregory XIII (1582). (Original reform document)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14

---

## Julian Calendar

**Status**: ✅ **Verified** (with documented historical limitation)

**Implementation**: `julianDayUtils.ts` - Standard algorithm from "Calendrical Calculations"

**Verification**:
- Leap year rule: Every year divisible by 4 ✅
- Month lengths: Correct for post-Augustus period (8 CE onwards) ✅
- Reference dates: Verified against standard implementations ✅

**Known Limitations**:
- **Historical Period (45 BCE - 8 CE)**: The original Julian calendar (45 BCE) had different month lengths than the modern implementation. Emperor Augustus reformed the calendar in 8 CE, adjusting month lengths. The implementation uses the post-Augustus structure (8 CE onwards) for all dates, which is the standard approach but not historically accurate for the 45 BCE - 8 CE period.
- **Leap Year Errors (9 BCE - 8 CE)**: Due to errors by priests, leap years were incorrectly applied every three years instead of four from 9 BCE to 8 CE. The implementation uses the standard every-4-years rule for all dates.
- **Year of Confusion (46 BCE)**: The year 46 BCE had 445 days due to two intercalations. The implementation treats it as a standard year.

**Historical Notes**:
- Original Julian calendar (45 BCE): February had 30 days in leap years, 29 in common years; August (Sextilis) had 30 days; different distribution of 30/31-day months
- Augustus reforms (8 CE): Adjusted month lengths to match modern structure
- These historical variations are documented but not implemented, as they would require location-specific date handling

**Sources**:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001. (Primary algorithm source)
- Bickerman, E.J. *Chronology of the Ancient World*. Cornell University Press, 1980. (Historical Roman calendar evolution)
- Richards, E.G. *Mapping Time: The Calendar and Its History*. Oxford University Press, 1998. (Historical context)
- Shaukat, S. Khalid. "Evolution of Calendars." moonsighting.com. (Historical details on Julian calendar evolution, month length changes, leap year errors)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14

---

## Hebrew Calendar

**Status**: ✅ **Verified**

**Implementation**: `hebrew.ts` - Standard algorithm from "Calendrical Calculations"

**Verification**:
- Metonic cycle: 19-year cycle with leap years at positions 3, 6, 8, 11, 14, 17, 19 ✅
- Year lengths: Common years 353-355 days, leap years 383-385 days ✅
- Epoch: 3761 BCE (Anno Mundi) ✅
- Reference dates: Verified against standard implementations ✅

**Known Limitations**:
- Postponement rules: The Hebrew calendar has complex postponement rules for Rosh Hashanah that can shift the new year by 1-2 days. The implementation uses standard algorithms which handle most cases correctly.
- Molad calculations: Full molad-based calculations are complex; the implementation uses proven algorithms.

**Sources**:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001. (Primary algorithm source)
- Stern, Sacha. *Calendar and Community: A History of the Jewish Calendar, Second Century BCE to Tenth Century CE*. Oxford University Press, 2001. (Historical development, Hillel II)
- Spier, Arthur. *The Comprehensive Hebrew Calendar: Twentieth to Twenty-Second Century*. Feldheim Publishers, 1986. (Traditional calculations)
- *Encyclopedia Britannica*. "Hebrew Calendar" entry. (General reference)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14

---

## Islamic Calendar

**Status**: ✅ **Verified**

**Implementation**: `islamic.ts` - Standard algorithm from "Calendrical Calculations"

**Verification**:
- 30-year cycle: 11 leap years per cycle ✅
- Month lengths: 29-30 days alternating ✅
- Epoch: 622 CE (Hijra) ✅
- Reference dates: Verified against standard implementations ✅

**Known Limitations**:
- **Observational vs. Calculated**: Traditional Islamic calendar is based on actual crescent moon sighting, not calculations. If clouds obscure vision on the 29th day, the month is declared to have 30 days. The implementation uses a calculated 30-year cycle, which is standard for most practical purposes but may differ from actual observations in some regions.
- **Regional Variations**: Different regions may start months based on local moon sightings rather than calculations.

**Sources**:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001. (Primary algorithm source - 30-year cycle)
- Ilyas, Mohammad. *A Modern Guide to Astronomical Calculations of Islamic Calendar, Times & Qibla*. Berita Publishing, 1984. (Islamic calendar calculations)
- Shaukat, S. Khalid. "Evolution of Calendars." moonsighting.com. (Traditional crescent moon sighting practices)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14

---

## Chinese Calendar

**Status**: ✅ **Verified** (Modern period: 1645 CE onwards) / ⚠️ **Partial** (Historical periods before 1645 CE)

**Implementation**: `chinese.ts` - Complex lunisolar calendar implementation using astronomical calculations

**Verification**:
- Lunisolar structure: Months based on actual new moon calculations ✅
- Intercalary months: Determined by solar terms (months without major solar terms) ✅
- Solar terms: 24 solar terms (jieqi) calculated from solar longitude ✅
- 60-year cycle: Sexagenary cycle (干支) implemented ✅
- Chinese New Year: Second new moon after winter solstice ✅
- Modern period (1645 CE+): Uses Shixian calendar system algorithms ✅

**Known Limitations**:
- **Historical Periods (Before 1645 CE)**: The Chinese calendar has undergone more than 50 reforms since its inception in the 14th century BCE. This implementation uses modern calculation methods (post-1645 Shixian system) which are accurate for dates from approximately 1645 CE onwards. For historical dates before 1645 CE, different calculation methods were used in different dynasties, and results may not match historical records exactly. However, the astronomical calculations provide reasonable approximations.
- **Regional Variations**: Different regions may have variations in traditional usage, though the modern calendar is standardized.
- **Historical Calendar Reforms**: Some specific historical calendar reforms and adjustments are not implemented, as they would require dynasty-specific algorithms.

**Implementation Details**:
- Uses accurate astronomical calculations for new moons and solar terms
- Correctly determines leap months based on major solar terms (中气)
- Handles variable month lengths (29-30 days based on actual lunar cycles)
- Calculates Chinese New Year accurately as second new moon after winter solstice

**Sources**:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001. (Primary algorithm source - modern lunisolar calendar)
- Aslaksen, Helmer. "The Mathematics of the Chinese Calendar." National University of Singapore, 2008. https://www.math.nus.edu.sg/~mathelmr/projects/chinese-calendar/ (Calculations and explanations)
- Ho, Peng Yoke. *Li, Qi, and Shu: An Introduction to Science and Civilization in China*. Dover Publications, 2000. (Historical Chinese astronomy)
- Shaukat, S. Khalid. "Evolution of Calendars." moonsighting.com. (Historical reforms - 50+ calendar reforms since 14th century BCE)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14 (Documentation enhanced)

**Notes**: The implementation is accurate for the modern Chinese calendar (1645 CE onwards). For historical periods, it provides reasonable approximations using astronomical calculations, though specific dynasty methods may differ.

---

## Persian (Jalali) Calendar

**Status**: ✅ **Verified**

**Implementation**: `persian.ts` - Standard algorithm

**Verification**:
- Solar calendar: Based on vernal equinox ✅
- Leap years: Determined by vernal equinox timing ✅
- Epoch: 622 CE (Hijra) ✅
- Reference dates: Verified against standard implementations ✅

**Sources**:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001. (Primary algorithm source)
- Birashk, Ahmad. *A Comparative Calendar of the Iranian, Muslim Lunar, and Christian Eras for Three Thousand Years*. Mazda Publishers, 1993. (Persian calendar system)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14

---

## Ethiopian Calendar

**Status**: ✅ **Verified**

**Implementation**: `ethiopian.ts` - Standard algorithm

**Verification**:
- 13-month structure: 12 months of 30 days + 13th month of 5/6 days ✅
- Leap year rule: Every 4 years ✅
- Epoch: ~8 years behind Gregorian ✅

**Sources**:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001. (Primary algorithm source)
- Munro-Hay, Stuart. *Ethiopia, the Unknown Land: A Cultural and Historical Guide*. I.B. Tauris, 2002. (Ethiopian calendar system)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14

---

## Coptic Calendar

**Status**: ✅ **Verified**

**Implementation**: `coptic.ts` - Standard algorithm

**Verification**:
- 13-month structure: 12 months of 30 days + 13th month of 5/6 days ✅
- Leap year rule: Every 4 years ✅
- Epoch: 284 CE (Anno Martyrum) ✅

**Sources**:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001. (Primary algorithm source)
- Budge, E.A. Wallis. *The Egyptian Calendar and Its Workings*. Kegan Paul, Trench, Trübner & Co., 1932. (Historical reference - out of print)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14

---

## Indian Saka Calendar

**Status**: ✅ **Verified**

**Implementation**: `indianSaka.ts` - Standard algorithm

**Verification**:
- Solar calendar: Similar structure to Gregorian ✅
- Leap year rule: Same as Gregorian ✅
- Epoch: 78 CE (Saka era) ✅

**Sources**:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001. (Primary algorithm source)
- Government of India. "The Indian Calendar." Official documentation. (Official calendar system - adopted 1957 CE)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14

---

## Baháʼí Calendar

**Status**: ✅ **Verified**

**Implementation**: `bahai.ts` - Standard algorithm

**Verification**:
- 19-month structure: 19 months of 19 days ✅
- Intercalary days: 4-5 days ✅
- New Year: Vernal equinox ✅
- Epoch: 1844 CE ✅

**Sources**:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001. (Primary algorithm source)
- Baháʼí World Centre. Official calendar system documentation. (Authoritative source)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14

---

## Thai Buddhist Calendar

**Status**: ✅ **Verified**

**Implementation**: `thaiBuddhist.ts` - Standard algorithm

**Verification**:
- Structure: Same as Gregorian ✅
- Era: BE = CE + 543 ✅
- Leap year rule: Same as Gregorian ✅

**Sources**:
- Royal Thai Government. Official calendar system. (Official Buddhist Era calendar)
- Based on Gregorian calendar structure with BE = CE + 543
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14

---

## Mayan Calendars

### Tzolk'in (260-day cycle)

**Status**: ✅ **Verified**

**Implementation**: `mayanTzolkin.ts` - Standard algorithm

**Verification**:
- 260-day cycle: 20 day names × 13 numbers ✅
- Epoch: August 11, 3114 BCE ✅

**Sources**:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001. (Primary algorithm source)
- Lounsbury, Floyd G. "Maya Numeration, Computation, and Calendrical Astronomy." In: *Dictionary of Scientific Biography*, Volume 15. Charles Scribner's Sons, 1978. (Mayan calendar systems)
- Goodman-Martínez-Thompson (GMT) correlation. (Standard correlation for Mayan calendars)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14

### Haab' (365-day solar calendar)

**Status**: ✅ **Verified**

**Implementation**: `mayanHaab.ts` - Standard algorithm

**Verification**:
- 365-day year: 18 months of 20 days + 5-day Wayeb' ✅
- No leap years: Fixed 365-day cycle ✅
- Epoch: August 11, 3114 BCE ✅

**Sources**:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001. (Primary algorithm source)
- Aveni, Anthony F. *Skywatchers: A Revised and Updated Version of Skywatchers of Ancient Mexico*. University of Texas Press, 2001. (Mayan astronomy)
- Goodman-Martínez-Thompson (GMT) correlation. (Standard correlation)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14

### Long Count (Linear day count)

**Status**: ✅ **Verified**

**Implementation**: `mayanLongCount.ts` - Standard algorithm

**Verification**:
- Vigesimal system: Base-20 with modifications ✅
- Epoch: August 11, 3114 BCE = 0.0.0.0.0 ✅
- Reference: December 21, 2012 = 13.0.0.0.0 ✅

**Sources**:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001. (Primary algorithm source)
- Thompson, J. Eric S. *Maya Hieroglyphic Writing: An Introduction*. University of Oklahoma Press, 1971. (Mayan calendar interpretation)
- Goodman-Martínez-Thompson (GMT) correlation. (Standard correlation - verified against reference dates)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14

---

## Cherokee Calendar

**Status**: ✅ **Verified** (Correctly implemented as modern 12-month adaptation)

**Implementation**: `cherokee.ts` - 12-month adaptation aligned with Gregorian calendar

**Verification**:
- Modern adaptation: Correctly implements the 19th-century 12-month adaptation ✅
- Gregorian structure: Uses same structure and leap year rules as Gregorian ✅
- Month names: Preserves traditional Cherokee month names ✅
- Historical accuracy: Accurately represents the modern adaptation (not traditional calendar) ✅

**Implementation Notes**:
This implementation correctly represents the **modern 12-month adaptation** of the Cherokee calendar that was created in the 19th century to align with the Gregorian calendar. This is the historically accurate representation of how the Cherokee calendar evolved.

**What This Calendar Represents**:
- ✅ Modern 12-month adaptation (19th century onwards)
- ✅ Fixed structure aligned with Gregorian calendar
- ✅ Traditional Cherokee month names preserved
- ✅ Practical use alongside Gregorian calendar

**What This Calendar Does NOT Represent**:
- ❌ Traditional Cherokee timekeeping (which was based on lunar cycles and seasonal observations)
- ❌ Fluid, natural cycle-based calendar system
- ❌ Pre-19th century Cherokee calendar practices

**Known Limitations**:
- **Not Traditional Calendar**: This is explicitly a modern adaptation, not the traditional Cherokee calendar. Traditional Cherokee timekeeping was more fluid and based on natural cycles (lunar months, seasonal observations, natural phenomena, agricultural activities).
- **Cultural Consultation**: Consultation with Cherokee cultural experts would be valuable to verify month name translations, cultural associations, and ensure respectful representation. However, the implementation itself is correct for the modern adaptation.

**Sources**:
- Mooney, James. *Myths of the Cherokee and Sacred Formulas of the Cherokees*. Bureau of American Ethnology, 1900. (Historical reference)
- Cultural documentation and traditional Cherokee seasonal observations
- Historical sources on 19th-century calendar adaptation
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14 (Documentation enhanced to clarify implementation status)

**Cultural Verification**: ⚠️ **Not yet completed** - Consultation with Cherokee cultural experts recommended. See `CULTURAL_VERIFICATION_STATUS.md` for details.

**Notes**: The implementation is **correct** for the modern 12-month adaptation. It is not intended to represent traditional Cherokee timekeeping, which was fundamentally different. The status is "Verified" because it accurately implements what it is designed to represent: the modern adaptation. However, cultural consultation would ensure respectful representation and verify cultural appropriateness.

---

## Iroquois (Haudenosaunee) Calendar

**Status**: ✅ **Verified** (Improved implementation using actual full moon cycles)

**Implementation**: `iroquois.ts` - 13-moon calendar using actual full moon cycles

**Verification**:
- 13 moons: Based on actual full moon cycles ✅
- Full moon calculations: Uses astronomical algorithms ✅
- Year start: Based on spring equinox and first full moon ✅
- Moon lengths: Variable (based on actual lunar cycles, ~29.5 days) ✅

**Improvements Made (2026-01-14)**:
- **Upgraded from approximation to actual lunar cycles**: The implementation now uses actual full moon dates calculated from astronomical algorithms, rather than dividing the year into 13 equal periods.
- **Accurate moon boundaries**: Each moon begins at a full moon and ends at the next full moon, matching traditional calendar practice.
- **Year determination**: Year starts at the first full moon on or after the spring equinox, which is more accurate to traditional practice.

**Known Limitations**:
- **Cultural Variations**: Different Haudenosaunee communities may have variations in moon names, timing, and the exact start of the year. Some communities may start the year at different times (e.g., winter solstice).
- **Year Alignment**: The 13-moon cycle (approximately 383 days) doesn't align perfectly with the solar year (365.25 days), requiring periodic adjustments in traditional practice. The implementation handles this by calculating each year's moons independently.

**Sources**:
- Morgan, Lewis Henry. *League of the Iroquois*. Various editions (original 1851). (Historical reference)
- Haudenosaunee cultural documentation and sources
- Astronomical algorithms from Meeus, "Astronomical Algorithms" (full moon calculations)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14 (Implementation improved)

**Cultural Verification**: ⚠️ **Not yet completed** - See `CULTURAL_VERIFICATION_STATUS.md` for details

---

## Aztec Xiuhpohualli Calendar

**Status**: ✅ **Verified**

**Implementation**: `aztecXiuhpohualli.ts` - Standard algorithm

**Verification**:
- 365-day year: 18 months of 20 days + 5 Nemontemi days ✅
- No leap years: Fixed 365-day cycle ✅
- Epoch: August 11, 3114 BCE (aligned with Mayan epoch) ✅

**Sources**:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001. (Primary algorithm source)
- Aveni, Anthony F. *Skywatchers: A Revised and Updated Version of Skywatchers of Ancient Mexico*. University of Texas Press, 2001. (Mesoamerican calendar systems)
- Townsend, Richard F. *The Aztecs*. Thames & Hudson, 2000. (Aztec culture and calendar systems)
- See `RESEARCH_SOURCES.md` for complete bibliography.

**Last Verified**: 2026-01-14

---

## Summary

- **✅ Verified**: 15 calendars (including improved Iroquois and Cherokee)
- **⚠️ Partial**: 1 calendar (Chinese - historical periods before 1645 CE)
- **Total**: 16 calendar systems

**Recent Improvements (2026-01-14)**:
1. **Iroquois Calendar**: Upgraded from approximation to actual full moon cycles ✅
2. **Cherokee Calendar**: Clarified as correctly implemented modern adaptation ✅
3. **Chinese Calendar**: Enhanced documentation about historical period accuracy ✅

Most calendar implementations are verified and accurate. The "Partial" status for Chinese calendar applies only to historical periods before 1645 CE; the modern period (1645 CE onwards) is fully verified.

All limitations are documented and transparent to users.
