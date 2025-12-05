# Calendar Epochs and Negative Years

## Overview

Each calendar system has its own epoch (year 1, month 1, day 1) which corresponds to a specific Julian Day Number (JDN). Years before the epoch are represented as negative years within that calendar system.

## Epoch Definitions

### Gregorian Calendar
- **Epoch**: January 1, 1 CE (JDN: 1721424)
- **Negative Years**: Years before 1 CE are negative (e.g., -1 = 2 BCE, -100 = 101 BCE)
- **Note**: There is no year 0 in the Gregorian calendar

### Julian Calendar
- **Epoch**: January 1, 1 CE (JDN: 1721424)
- **Negative Years**: Same as Gregorian

### Islamic (Hijri) Calendar
- **Epoch**: July 16, 622 CE (Julian) = Muharram 1, 1 AH (JDN: 1948439)
- **Negative Years**: Years before 1 AH are negative (e.g., -1 AH = before the Hijra)

### Hebrew (Jewish) Calendar
- **Epoch**: October 7, 3761 BCE (Julian) = Tishrei 1, 1 AM (JDN: 347997)
- **Negative Years**: Years before 1 AM are negative
- **Note**: The Hebrew calendar counts from the traditional date of creation

### Persian (Jalali) Calendar
- **Epoch**: March 19, 622 CE (Gregorian) = Farvardin 1, 1 SH (JDN: 1948318)
- **Negative Years**: Years before 1 SH are negative

### Chinese Calendar
- **Epoch**: Complex - traditionally starts around 2697 BCE, but varies
- **Negative Years**: Years before the epoch are negative
- **Note**: This is a simplified implementation

### Ethiopian Calendar
- **Epoch**: August 29, 8 CE (Julian) = Meskerem 1, 1 EE (JDN: 1724221)
- **Negative Years**: Years before 1 EE are negative

### Coptic Calendar
- **Epoch**: August 29, 284 CE (Julian) = Tout 1, 1 AM (JDN: 1825030)
- **Negative Years**: Years before 1 AM are negative

### Indian National (Saka) Calendar
- **Epoch**: March 22, 78 CE (Gregorian) = Chaitra 1, 1 Saka (JDN: 1749630)
- **Negative Years**: Years before 1 Saka are negative

### Baháʼí Calendar
- **Epoch**: March 21, 1844 CE (Gregorian) = Naw-Rúz, 1 BE (JDN: 2394647)
- **Negative Years**: Years before 1 BE are negative

### Thai Buddhist Calendar
- **Epoch**: January 1, 544 BCE (Gregorian) = Year 1 BE (JDN: calculated from -543)
- **Negative Years**: Years before 1 BE are negative
- **Note**: BE year = Gregorian year + 544 (or Gregorian year - 543 for the offset)

### Mayan Calendars (Tzolk'in, Haab', Long Count)
- **Epoch**: August 11, 3114 BCE (Gregorian) = 0.0.0.0.0 (JDN: 584283)
- **Negative Years**: Years before the epoch are negative

### Aztec Xiuhpohualli
- **Epoch**: August 11, 3114 BCE (Gregorian) (JDN: 584283)
- **Negative Years**: Years before the epoch are negative

### Cherokee & Iroquois Calendars
- **Epoch**: January 1, 1 CE (Gregorian) (JDN: 1721424)
- **Negative Years**: Same as Gregorian

## Implementation Requirements

Each calendar converter must:

1. **Handle Year 1 Correctly**: Year 1, month 1, day 1 must map to the epoch JDN
2. **Support Negative Years**: Years < 1 must be calculated relative to the epoch
3. **Maintain Accuracy**: Conversions must remain accurate for all years, positive and negative
4. **Display Correctly**: Negative years should be displayed with appropriate era designations

## Conversion Logic

For `toJDN(year, month, day)`:
- If `year >= 1`: Calculate days since epoch normally
- If `year < 1`: Calculate days before epoch (work backwards)

For `fromJDN(jdn)`:
- If `jdn >= epoch`: Calculate year >= 1
- If `jdn < epoch`: Calculate year < 1 (negative)

## Example: Hebrew Calendar

- Year 1 AM = JDN 347997 (epoch)
- Year 0 AM = JDN 347997 - days_in_year_0
- Year -1 AM = JDN 347997 - days_in_year_0 - days_in_year_-1

The challenge is determining the structure of years before the epoch, which may require using the same calendar rules (Metonic cycle, etc.) applied backwards.

