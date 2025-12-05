# Chinese Calendar Implementation Progress

## Status: In Progress - Enhanced Astronomical Functions Complete

### Completed ✅

1. **Enhanced New Moon Calculation** (`astronomicalUtils.ts`)
   - ✅ Implemented mean lunar longitude calculation
   - ✅ Implemented mean lunar anomaly calculation
   - ✅ Implemented lunar ecliptic longitude calculation
   - ✅ Implemented iterative refinement for accurate new moon dates
   - ✅ Added `nextNewMoonJDN()` and `previousNewMoonJDN()` helper functions

2. **Enhanced Solar Terms Calculation** (`astronomicalUtils.ts`)
   - ✅ Improved `solarTermJDN()` with iterative refinement
   - ✅ Added `winterSolsticeJDN()` function
   - ✅ Solar terms now use accurate astronomical calculations

3. **Mayan Long Count** ✅
   - ✅ Complete 5-component support (baktun, katun, tun, uinal, kin)
   - ✅ Proper encoding in CalendarDate interface
   - ✅ Accurate formatting and parsing

### In Progress ⏳

**Chinese Calendar Core Implementation**
- Need to rewrite `chinese.ts` to use:
  - Accurate new moon calculations for month boundaries
  - Solar terms for leap month determination
  - Chinese New Year calculation (second new moon after winter solstice)

### Next Steps

1. **Implement Chinese New Year Calculation**
   - Function: `chineseNewYearJDN(year)` 
   - Algorithm: Find winter solstice, then second new moon after it

2. **Implement Lunar Month Structure**
   - Calculate all new moons for a Chinese year
   - Determine month lengths based on actual new moon dates
   - Store month data structure

3. **Implement Leap Month Logic**
   - Check which solar terms fall in each lunar month
   - Identify months with no solar term (leap months)
   - Place leap month correctly

4. **Rewrite Conversion Functions**
   - Update `toJDN()` to use accurate calculations
   - Update `fromJDN()` to use accurate calculations
   - Test round-trip conversions

### Notes

- The astronomical foundation is now in place
- Chinese calendar implementation requires careful testing
- Need to verify against known Chinese New Year dates
- Cultural accuracy is maintained throughout

