# Chinese Calendar Reference Dates for Verification

**Date**: December 2024  
**Purpose**: Collect known reference dates to verify Chinese calendar accuracy

## Known Chinese Calendar Dates

### Chinese New Year Dates (Recent Years)

| Gregorian Date | Chinese Date | Year | Description |
|----------------|--------------|------|-------------|
| 2024-02-10 | 2024-正月初一 | 甲辰 | Year of the Dragon |
| 2023-01-22 | 2023-正月初一 | 癸卯 | Year of the Rabbit |
| 2022-02-01 | 2022-正月初一 | 壬寅 | Year of the Tiger |
| 2021-02-12 | 2021-正月初一 | 辛丑 | Year of the Ox |
| 2020-01-25 | 2020-正月初一 | 庚子 | Year of the Rat |

### Intercalary (Leap) Months

Recent leap months (闰月):

| Year | Leap Month | Gregorian Range | Description |
|------|------------|-----------------|-------------|
| 2023 | 闰二月 | March 22 - April 19, 2023 | Intercalary 2nd month |
| 2020 | 闰四月 | May 23 - June 20, 2020 | Intercalary 4th month |
| 2017 | 闰六月 | July 23 - August 21, 2017 | Intercalary 6th month |

### Solar Terms (节气) - 2024

| Solar Term | Chinese Name | Gregorian Date | Longitude |
|------------|--------------|----------------|-----------|
| 立春 | Start of Spring | 2024-02-04 | 315° |
| 雨水 | Rain Water | 2024-02-19 | 330° |
| 惊蛰 | Awakening of Insects | 2024-03-05 | 345° |
| 春分 | Spring Equinox | 2024-03-20 | 0° |
| 清明 | Clear and Bright | 2024-04-04 | 15° |
| 谷雨 | Grain Rain | 2024-04-19 | 30° |
| 立夏 | Start of Summer | 2024-05-05 | 45° |
| 小满 | Grain Buds | 2024-05-20 | 60° |
| 芒种 | Grain in Ear | 2024-06-05 | 75° |
| 夏至 | Summer Solstice | 2024-06-21 | 90° |
| 小暑 | Minor Heat | 2024-07-06 | 105° |
| 大暑 | Major Heat | 2024-07-22 | 120° |
| 立秋 | Start of Autumn | 2024-08-07 | 135° |
| 处暑 | End of Heat | 2024-08-23 | 150° |
| 白露 | White Dew | 2024-09-07 | 165° |
| 秋分 | Autumn Equinox | 2024-09-22 | 180° |
| 寒露 | Cold Dew | 2024-10-08 | 195° |
| 霜降 | Frost Descent | 2024-10-23 | 210° |
| 立冬 | Start of Winter | 2024-11-07 | 225° |
| 小雪 | Minor Snow | 2024-11-22 | 240° |
| 大雪 | Major Snow | 2024-12-07 | 255° |
| 冬至 | Winter Solstice | 2024-12-21 | 270° |
| 小寒 | Minor Cold | 2025-01-05 | 285° |
| 大寒 | Major Cold | 2025-01-20 | 300° |

### Traditional Festivals

| Festival | Chinese Name | Gregorian 2024 | Chinese Date |
|----------|--------------|----------------|--------------|
| Chinese New Year | 春节 | 2024-02-10 | 2024-正月初一 |
| Lantern Festival | 元宵节 | 2024-02-24 | 2024-正月十五 |
| Dragon Boat Festival | 端午节 | 2024-06-10 | 2024-五月初五 |
| Mid-Autumn Festival | 中秋节 | 2024-09-17 | 2024-八月十五 |
| Double Ninth Festival | 重阳节 | 2024-10-11 | 2024-九月初九 |

## Verification Test Cases

### Test Case 1: Chinese New Year 2024
- **Input**: Gregorian 2024-02-10
- **Expected**: Chinese 2024-正月初一 (Year of the Dragon, 甲辰)
- **Verify**: JDN round-trip, date conversion

### Test Case 2: Leap Month 2023
- **Input**: Gregorian 2023-03-22
- **Expected**: Chinese 2023-闰二月初一
- **Verify**: Intercalary month handling

### Test Case 3: Solar Terms
- **Input**: Gregorian dates for each solar term
- **Expected**: Correct solar term number (0-23)
- **Verify**: Solar term calculation accuracy

### Test Case 4: Round-Trip Conversions
- **Test**: Chinese Date → JDN → Chinese Date
- **Verify**: Exact round-trips for known dates

## Sources for Verification

1. **Hong Kong Observatory**
   - Official Chinese calendar dates
   - Solar term calculations
   - Intercalary month determinations

2. **Chinese Calendar Websites**
   - Traditional calendar converters
   - Verified reference dates

3. **Astronomical Sources**
   - US Naval Observatory
   - Astronomical almanacs
   - Solar term calculations

4. **Academic References**
   - "Calendrical Calculations" Chapter 19
   - Research papers on Chinese calendar

## Implementation Verification Checklist

- [ ] Chinese New Year dates match authoritative sources
- [ ] Intercalary months placed correctly
- [ ] Solar terms calculated accurately
- [ ] Round-trip conversions exact
- [ ] Month lengths correct (29/30 days)
- [ ] Year lengths correct (353-385 days)
- [ ] Edge cases handled (year boundaries, leap years)

---

**Status**: Collection in progress  
**Next Step**: Create verification test script with these reference dates

