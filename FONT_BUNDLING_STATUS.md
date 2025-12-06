# Font Bundling Status - Offline Support

All fonts required for offline installation have been bundled locally. This document summarizes the font coverage for all themes.

## ✅ Bundled Fonts (Available Offline)

The following fonts are now bundled using `@fontsource` packages:

1. **Inter** - Used in default body font stack
2. **Noto Sans** (base + variants) - Multilingual support:
   - Noto Sans (base)
   - Noto Sans SC (Simplified Chinese)
   - Noto Sans Arabic
   - Noto Sans Hebrew
   - Noto Sans Thai
3. **Bebas Neue** - Used in wall-text utility class (date labels, headers)
4. **Antonio** - Used in "ON SCREEN" (LCARS) theme

## Theme Font Coverage

### Themes Using Bundled Fonts

#### Default Body Font (All themes inherit unless overridden)
- **Font**: Inter + Noto Sans variants
- **Used by**: All themes that don't specify a custom font-family
- **Status**: ✅ Bundled

#### ON SCREEN Theme
- **Font**: Antonio (with fallback to system fonts)
- **Status**: ✅ Bundled

#### Wall-Text Utility Class
- **Font**: Bebas Neue (with fallback to Impact, Arial Black, etc.)
- **Used in**: Date labels, entry headers, buttons
- **Status**: ✅ Bundled

### Themes Using System Fonts (Always Available Offline)

These themes use system fonts that are pre-installed on Windows/macOS/Linux:

#### Galactic Basic
- **Fonts**: Arial, Helvetica, Verdana
- **Status**: ✅ System fonts (no bundling needed)

#### Aero Glass
- **Fonts**: Segoe UI, Calibri, Arial
- **Status**: ✅ System fonts (no bundling needed)

#### Classic Light / Classic Dark
- **Fonts**: MS Sans Serif
- **Status**: ✅ System fonts (no bundling needed)

#### BIOS
- **Fonts**: Fixedsys, Terminal, MS Sans Serif
- **Status**: ✅ System fonts (no bundling needed)

#### Terminal
- **Fonts**: Courier New, Consolas, Monaco
- **Status**: ✅ System fonts (no bundling needed)

#### The Real World
- **Fonts**: Courier New, Consolas, Monaco
- **Status**: ✅ System fonts (no bundling needed)

### Themes Using Default (Bundled) Fonts

These themes inherit the default body font (Inter/Noto Sans):

- **Forest** - ✅ Uses default (bundled)
- **Ocean** - ✅ Uses default (bundled)
- **Sunset** - ✅ Uses default (bundled)
- **Retro 80s** - ✅ Uses default (bundled)
- **High Contrast** - ✅ Uses default (bundled)
- **Modern Minimal** - ✅ Uses default (bundled)
- **Modern Minimal OLED** - ✅ Uses default (bundled)
- **Light/Dark themes** - ✅ Uses default (bundled)

## Complete Theme List

1. ✅ **Light** - Uses bundled Inter/Noto Sans
2. ✅ **Dark** - Uses bundled Inter/Noto Sans
3. ✅ **Auto** - Uses bundled Inter/Noto Sans (resolves to Light/Dark)
4. ✅ **Classic Light** - Uses system font (MS Sans Serif)
5. ✅ **Classic Dark** - Uses system font (MS Sans Serif)
6. ✅ **High Contrast** - Uses bundled Inter/Noto Sans
7. ✅ **Terminal** - Uses system fonts (Courier New, Consolas, Monaco)
8. ✅ **BIOS** - Uses system fonts (Fixedsys, Terminal, MS Sans Serif)
9. ✅ **Forest** - Uses bundled Inter/Noto Sans
10. ✅ **Ocean** - Uses bundled Inter/Noto Sans
11. ✅ **Sunset** - Uses bundled Inter/Noto Sans
12. ✅ **Retro 80s** - Uses bundled Inter/Noto Sans
13. ✅ **Modern Minimal** - Uses bundled Inter/Noto Sans
14. ✅ **Modern Minimal OLED** - Uses bundled Inter/Noto Sans
15. ✅ **ON SCREEN** - Uses bundled Antonio
16. ✅ **Aero Glass** - Uses system fonts (Segoe UI, Calibri, Arial)
17. ✅ **Galactic Basic** - Uses system fonts (Arial, Helvetica, Verdana)
18. ✅ **The Real World** - Uses system fonts (Courier New, Consolas, Monaco)

## Summary

**All 18 themes are fully covered for offline installation:**

- ✅ **4 custom fonts** bundled (Inter, Noto Sans variants, Bebas Neue, Antonio)
- ✅ **System fonts** used where appropriate (always available)
- ✅ **No external font dependencies** - all fonts work offline
- ✅ **No Google Fonts links** - removed from all HTML files
- ✅ **CSP updated** - no external font sources allowed

## Implementation Details

- Fonts are bundled using `@fontsource` npm packages
- Font files are included in the build automatically by Vite
- Fonts are imported in `src/fonts.css` and loaded before themes
- All HTML files updated to remove Google Fonts links
- Content Security Policy updated to only allow local fonts

## Testing

To verify offline functionality:

1. Build the application: `npm run build`
2. Test in Electron with network disabled
3. Switch between all themes to verify fonts load correctly
4. Verify multilingual text displays properly (Chinese, Arabic, Hebrew, Thai)

