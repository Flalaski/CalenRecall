# Font Research for CalenRecall Calendar Interface

## Executive Summary

This document provides research and recommendations for typography choices in CalenRecall, a calendar journaling application designed for creative users who find their own reasons to use the software. The recommendations balance readability, aesthetic appeal, versatility, and creative expression.

## Current State

The application currently uses a system font stack:
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
  'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
```

This provides good cross-platform compatibility but lacks a distinctive character that would appeal to creative users.

## Top Recommendations

### 1. **Inter** (Primary Recommendation) ⭐

**Why it's ideal:**
- **Designed specifically for screens**: Created by Rasmus Andersson with optimal readability at all sizes
- **Open-source and free**: SIL Open Font License
- **Excellent for UI**: Used by major apps (GitHub, Figma, Notion)
- **Variable font support**: Allows fine-tuned weight control
- **Neutral yet distinctive**: Professional without being generic
- **Great for both display and body text**: Works well for calendar labels and journal content

**Best for:**
- Calendar month/year labels
- Day numbers
- Navigation elements
- Journal body text

**Implementation:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Use cases:**
- Calendar cells: 400-500 weight
- Month/Year labels: 600-700 weight
- Body text: 400 weight

---

### 2. **Poppins** (Modern & Versatile)

**Why it's ideal:**
- **Geometric and modern**: Clean, minimalist aesthetic
- **Highly versatile**: Works for headings, labels, and body text
- **Warm and approachable**: More friendly than strict geometric fonts
- **Excellent readability**: Designed for digital interfaces
- **Multiple weights**: 9 weights from Thin to Black

**Best for:**
- Calendar display labels (months, years)
- Headings and titles
- Creative, modern aesthetic

**Implementation:**
```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
```

**Use cases:**
- Month names: 600-700 weight
- Year labels: 700 weight
- Day numbers: 500-600 weight

---

### 3. **Lato** (Warm & Humanist)

**Why it's ideal:**
- **Humanist sans-serif**: More warmth and character than geometric fonts
- **Excellent readability**: Designed for extended reading
- **Semi-rounded details**: Friendly without being casual
- **Versatile**: Works for both UI and body text
- **Professional yet approachable**: Good balance for creative tools

**Best for:**
- Journal entry text
- Calendar labels
- General UI text

**Implementation:**
```css
@import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap');

font-family: 'Lato', -apple-system, BlinkMacSystemFont, sans-serif;
```

---

### 4. **Montserrat** (Bold & Geometric)

**Why it's ideal:**
- **Strong geometric character**: Distinctive and modern
- **Great for display**: Excellent for calendar labels and headings
- **Multiple weights**: 9 weights available
- **Popular in creative tools**: Used by many modern apps
- **Clean and minimal**: Works well in grid layouts

**Best for:**
- Calendar month/year labels
- Headings
- Display text

**Note:** May be too bold for body text; consider pairing with a complementary font.

---

### 5. **Open Sans** (Classic & Reliable)

**Why it's ideal:**
- **Humanist design**: Excellent for readability
- **Open letterforms**: Clear at small sizes
- **Proven track record**: Used by Google, widely tested
- **Versatile**: Works for all text sizes
- **Neutral**: Won't distract from content

**Best for:**
- Body text in journal entries
- General UI text
- Calendar day numbers

---

## Font Pairing Recommendations

### Option A: Inter (Primary) + System Serif (Accents)
- **Inter** for all calendar and UI elements
- **System serif** (Georgia, Times) for special emphasis or quotes
- Clean, modern, professional

### Option B: Poppins (Display) + Inter (Body)
- **Poppins** for calendar labels (months, years, large numbers)
- **Inter** for day numbers, body text, and UI
- Modern, distinctive, balanced

### Option C: Montserrat (Headings) + Lato (Body)
- **Montserrat** for calendar labels and headings
- **Lato** for body text and general UI
- Strong contrast, creative feel

### Option D: Single Font (Inter)
- **Inter** for everything
- Simplest implementation
- Consistent, professional
- Variable font allows weight variation for hierarchy

---

## Considerations for Creative Users

### Readability at Various Sizes
- Calendar labels need to be clear at 1rem-1.5rem
- Day numbers should be legible at 0.9rem-1.1rem
- Body text needs excellent readability for journal entries
- **Recommendation**: Inter or Lato excel here

### Aesthetic Versatility
- Creative users may use the app for various purposes
- Font should support both formal and casual use cases
- Should not feel "corporate" or "boring"
- **Recommendation**: Poppins or Montserrat for character, Inter for neutrality

### Performance
- Web fonts add load time
- Variable fonts reduce file size
- System fonts are fastest but less distinctive
- **Recommendation**: Use `font-display: swap` for web fonts

### Accessibility
- High contrast readability
- Clear distinction between weights
- Support for various screen sizes
- **Recommendation**: All listed fonts meet accessibility standards

---

## Implementation Strategy

### Phase 1: Add Google Fonts Import
Update `index.html` to include font imports:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

### Phase 2: Update CSP Policy
Modify Content Security Policy in `index.html`:
```html
<!-- Change from: font-src 'self' data:; -->
<!-- To: font-src 'self' data: https://fonts.gstatic.com; -->
```

### Phase 3: Update CSS
Modify `src/index.css` to use the new font:
```css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

### Phase 4: Calendar-Specific Typography
Update `src/components/CalendarView.css` with appropriate weights:
- Month labels: `font-weight: 600;`
- Year labels: `font-weight: 700;`
- Day numbers: `font-weight: 500;`
- Weekday headers: `font-weight: 600;`

---

## Comparison Matrix

| Font | Readability | Modern Feel | Versatility | Character | Best Use |
|------|-------------|-------------|-------------|-----------|----------|
| **Inter** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | All-purpose |
| **Poppins** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Display/Headings |
| **Lato** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Body text |
| **Montserrat** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Display only |
| **Open Sans** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | Body text |

---

## Final Recommendation

**Primary Choice: Inter**

**Rationale:**
1. Specifically designed for digital interfaces
2. Excellent readability at all sizes
3. Neutral enough for diverse creative uses
4. Distinctive enough to feel intentional
5. Variable font support for fine control
6. Used by respected creative tools (Notion, Figma)
7. Open-source and free
8. Works well for both calendar display and journal body text

**Secondary Option: Poppins + Inter Pairing**

If you want more visual character:
- Use **Poppins** (600-700 weight) for calendar labels (months, years)
- Use **Inter** (400-500 weight) for day numbers and body text
- Creates a modern, distinctive look while maintaining readability

---

## Testing Recommendations

1. **Visual Testing**: Test each font at various sizes (0.8rem to 2rem)
2. **Readability Testing**: Check calendar labels in year, month, week, and day views
3. **Dark Mode Testing**: Verify fonts render well in dark theme
4. **Performance Testing**: Measure page load impact of web fonts
5. **User Feedback**: Consider A/B testing with a small user group

---

## Resources

- [Inter Font Website](https://rsms.me/inter/)
- [Google Fonts - Inter](https://fonts.google.com/specimen/Inter)
- [Google Fonts - Poppins](https://fonts.google.com/specimen/Poppins)
- [Google Fonts - Lato](https://fonts.google.com/specimen/Lato)
- [Google Fonts - Montserrat](https://fonts.google.com/specimen/Montserrat)
- [Variable Fonts Guide](https://web.dev/variable-fonts/)

---

## Next Steps

1. Review this document and select preferred font(s)
2. Test selected fonts in the application
3. Implement font loading and CSS updates
4. Test across different view modes (decade, year, month, week, day)
5. Verify dark mode compatibility
6. Consider adding font preference in user settings (future enhancement)

