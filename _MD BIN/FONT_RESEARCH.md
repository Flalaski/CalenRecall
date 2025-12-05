# Font Research for Multilingual Calendar Support

## Current Font Stack
- **Primary**: Inter (Google Fonts)
- **Fallback**: System fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', etc.)

## Languages/Scripts Used in Calendars

### Scripts Identified:
1. **CJK (Chinese, Japanese, Korean)**
   - Chinese calendar: 正, 二, 三, 四, 五, 六, 七, 八, 九, 十, 十一, 十二
   - Also: 闰 (leap month indicator)

2. **Arabic Script**
   - Islamic calendar: Muharram, Safar, Rabi' al-awwal, etc.
   - Persian calendar: Farvardin, Ordibehesht, etc.
   - Baha'i calendar: Bahá, Raḥmat, Kalimát, etc. (with diacritics)

3. **Hebrew Script**
   - Hebrew calendar: Nisan, Iyar, Sivan, etc.

4. **Thai Script**
   - Thai Buddhist calendar: มกราคม, กุมภาพันธ์, etc.

5. **Latin Script**
   - Most calendars (Gregorian, Julian, etc.)

## Recommended Font Solution

### Option 1: Noto Sans (Recommended)
**Pros:**
- Comprehensive Unicode coverage
- Supports all scripts we need
- Harmonious design across scripts
- Available on Google Fonts
- Free and open source

**Coverage:**
- ✅ Chinese (Simplified & Traditional)
- ✅ Arabic
- ✅ Hebrew
- ✅ Thai
- ✅ Latin, Greek, Cyrillic
- ✅ And many more

**Implementation:**
- Use Noto Sans as primary font
- Keep Inter as fallback for Latin text (better Latin design)
- System fonts as final fallback

### Option 2: Noto Sans + Script-Specific Fallbacks
**For maximum compatibility:**
- Noto Sans (primary)
- Noto Sans SC/TC (Chinese)
- Noto Sans Arabic (Arabic)
- Noto Sans Hebrew (Hebrew)
- Noto Sans Thai (Thai)
- Inter (Latin fallback)

**Pros:** Best coverage and rendering
**Cons:** Larger font files, more HTTP requests

### Option 3: System Font Stack with Unicode Support
**Use system fonts that support Unicode:**
- macOS: PingFang SC (Chinese), Helvetica Neue (multilingual)
- Windows: Microsoft YaHei (Chinese), Segoe UI (multilingual)
- Linux: Noto Sans (if installed)

**Pros:** No font loading, fast
**Cons:** Inconsistent across platforms, may lack some scripts

## Recommended Implementation

**Best Approach: Noto Sans as Primary with Smart Fallbacks**

1. Load Noto Sans from Google Fonts (supports all scripts)
2. Use CSS font-family stack:
   ```css
   font-family: 'Noto Sans', 'Noto Sans SC', 'Noto Sans Arabic', 
                'Noto Sans Hebrew', 'Noto Sans Thai',
                -apple-system, BlinkMacSystemFont, 'Segoe UI', 
                'Microsoft YaHei', 'SimHei', sans-serif;
   ```

3. For calendar-specific text, use script-specific fonts:
   - Chinese text: Noto Sans SC
   - Arabic text: Noto Sans Arabic
   - Hebrew text: Noto Sans Hebrew
   - Thai text: Noto Sans Thai

## Performance Considerations

- **Font Loading**: Use `font-display: swap` for better performance
- **Subset Loading**: Consider loading only needed script subsets
- **Preload**: Preload critical fonts
- **Fallback**: Always have system font fallbacks

## References

- Google Noto Fonts: https://fonts.google.com/noto
- Noto Sans Coverage: Supports 100+ languages
- Unicode Coverage: Comprehensive for all scripts used
