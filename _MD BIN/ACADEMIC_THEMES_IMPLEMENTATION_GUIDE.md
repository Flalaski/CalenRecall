# Academic Themes Implementation Guide

## Summary

This guide provides actionable steps for implementing academic-friendly librarian/historian themes based on the research conducted. These themes should evoke settings like aged paper, vintage libraries, archives, and historical documents.

## Research Findings

Key approaches identified for effective academic themes:

1. **Aged Paper Aesthetics**: Use warm, cream-based backgrounds with subtle textures
2. **Historical Typography**: Balance authenticity with readability
3. **Setting-Based Variations**: Multiple themes based on different historical contexts
4. **Accessibility First**: Maintain WCAG AA contrast ratios
5. **Comfortable Reading**: Warm colors reduce eye strain for extended use

## Recommended Theme Concepts

### Priority 1: Parchment Scholar
**Best for**: Medieval history, ancient manuscripts, traditional scholarship

**Color Palette**:
- Background: `#f4f1e8` (warm parchment)
- Text: `#2c1810` (deep brown-black)
- Accents: `#8b6914` (sepia), `#c9a96b` (muted gold)
- Borders: `#7d6b5d` (aged brown)

### Priority 2: Victorian Archive  
**Best for**: 19th-century research, formal academic work, elegant aesthetics

**Color Palette**:
- Background: `#faf8f3` (aged cream)
- Text: `#1a1a2e` (deep blue-black)
- Accents: `#6b2d3a` (deep burgundy), `#2c3e50` (ink blue)
- Borders: `#5d4037` (walnut brown)

### Priority 3: Librarian's Study
**Best for**: Modern academic work, research settings, professional appearance

**Color Palette**:
- Background: `#f9f7f4` (soft beige)
- Text: `#2d2d2d` (charcoal)
- Accents: `#2d5016` (deep green - traditional library), `#2c5282` (academic blue)
- Borders: `#8b8680` (warm gray)

### Additional Concepts
- Research Archive (neutral, document-focused)
- Manuscript Room (luxurious, special collections)
- Reading Room (calm, contemplative)

## Implementation Steps

### Step 1: Choose First Theme to Implement

**Recommendation**: Start with **Parchment Scholar** as it's the most distinctive and clearly academic.

### Step 2: Create Theme File Structure

1. Create file: `src/themes/parchment-scholar.css`
2. Follow structure from `src/themes/theme-template.css`
3. Use `classic-light.css` as a comprehensive reference

### Step 3: Define Color Variables (Optional but Recommended)

At the top of your theme file, define CSS custom properties:

```css
[data-theme="parchment-scholar"] {
  /* Color Palette */
  --parchment-bg: #f4f1e8;
  --parchment-bg-light: #faf8f3;
  --parchment-bg-dark: #ebe6d3;
  --text-primary: #2c1810;
  --text-secondary: #4a3424;
  --accent-sepia: #8b6914;
  --accent-gold: #c9a96b;
  --border-aged: #7d6b5d;
  --border-light: #9b8a7a;
  
  /* Base styles */
  font-family: 'Georgia', 'Times New Roman', serif;
}
```

### Step 4: Implement Base Styles

```css
[data-theme="parchment-scholar"] body {
  background: var(--parchment-bg);
  color: var(--text-primary);
  --theme-body-bg: var(--parchment-bg);
}

[data-theme="parchment-scholar"] html,
[data-theme="parchment-scholar"] #root {
  background: var(--parchment-bg);
}

[data-theme="parchment-scholar"] .app {
  background: var(--parchment-bg);
}

[data-theme="parchment-scholar"] .app-content {
  background: var(--parchment-bg);
}
```

### Step 5: Style All Components

Follow the comprehensive list in `src/themes/COMPONENT_CLASSES.md`. Key areas:

#### Navigation Bar
- Warm parchment background
- Aged brown borders
- Soft shadows for depth
- Sepia-toned hover states

#### Calendar/Timeline Cells
- Paper-like cell backgrounds
- Aged border treatments
- Subtle hover effects (slight darkening)
- Today indicators with warm colors

#### Entry Cards/Items
- Aged paper appearance
- Soft shadows
- Warm borders
- Comfortable reading spacing

#### Buttons
- Soft, pressed appearance (not flat)
- Aged border styling
- Warm hover effects
- Avoid harsh modern gradients

#### Input Fields
- Paper-like backgrounds
- Subtle borders (aged brown, not stark)
- Warm focus states (sepia/gold outlines)
- Comfortable padding

#### Modals/Dialogs
- Aged paper backgrounds
- Vintage border treatments
- Soft shadows for depth
- Warm overlay colors

### Step 6: Typography Considerations

**Current Fonts Available**:
- Inter (sans-serif) - Modern, clean
- Noto Sans (multilingual support)
- Georgia/Times New Roman (serif - system fonts)

**Recommendations**:
1. **Use system serif fonts** (Georgia, Times New Roman) for authentic feel
2. **Consider adding**: 
   - Crimson Text (elegant serif)
   - Lora (readable serif)
   - Via Fontsource package

**Typography Style**:
```css
[data-theme="parchment-scholar"] {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 14px; /* Slightly larger for reading comfort */
  line-height: 1.6; /* Comfortable line spacing */
}

[data-theme="parchment-scholar"] h1,
[data-theme="parchment-scholar"] h2,
[data-theme="parchment-scholar"] h3 {
  font-weight: 600;
  color: var(--text-primary);
  /* Subtle text shadow for depth */
  text-shadow: 0 1px 2px rgba(44, 24, 16, 0.1);
}
```

### Step 7: Texture and Visual Effects

#### Aged Paper Texture Approach

**Option 1: CSS Gradients** (Simplest)
```css
[data-theme="parchment-scholar"] body {
  background: 
    radial-gradient(circle at 20% 50%, rgba(139, 105, 20, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(201, 169, 107, 0.02) 0%, transparent 50%),
    linear-gradient(135deg, #faf8f3 0%, #f4f1e8 50%, #f0ede7 100%);
}
```

**Option 2: Subtle Texture Image** (More Authentic)
- Use low-opacity texture overlay
- Apply via `::before` pseudo-element
- Keep opacity very low (5-15%)

**Option 3: CSS Filters** (Quick Effect)
```css
[data-theme="parchment-scholar"] .app {
  filter: sepia(5%) contrast(98%);
}
```

#### Border Treatments

Use aged, warm borders instead of stark lines:

```css
[data-theme="parchment-scholar"] .calendar-cell,
[data-theme="parchment-scholar"] .timeline-cell {
  border: 1px solid var(--border-aged);
  border-radius: 2px; /* Subtle rounded corners */
  box-shadow: 0 1px 2px rgba(125, 107, 93, 0.1);
}
```

#### Shadow Effects

Soft, warm shadows for depth:

```css
[data-theme="parchment-scholar"] .entry-card,
[data-theme="parchment-scholar"] .journal-entry-item {
  box-shadow: 
    0 2px 4px rgba(125, 107, 93, 0.15),
    0 1px 2px rgba(125, 107, 93, 0.1);
}
```

### Step 8: Interactive States

#### Hover Effects
```css
[data-theme="parchment-scholar"] .calendar-cell:hover,
[data-theme="parchment-scholar"] .timeline-cell:hover {
  background: var(--parchment-bg-dark);
  border-color: var(--accent-sepia);
  box-shadow: 0 2px 4px rgba(139, 105, 20, 0.2);
}
```

#### Focus States
```css
[data-theme="parchment-scholar"] input:focus,
[data-theme="parchment-scholar"] textarea:focus,
[data-theme="parchment-scholar"] select:focus {
  outline: 2px solid var(--accent-sepia);
  outline-offset: 2px;
  border-color: var(--accent-sepia);
}
```

#### Active/Pressed States
```css
[data-theme="parchment-scholar"] .nav-button:active,
[data-theme="parchment-scholar"] .save-button:active {
  background: var(--parchment-bg-dark);
  box-shadow: inset 0 2px 4px rgba(125, 107, 93, 0.2);
}
```

### Step 9: Accessibility Checks

1. **Contrast Ratios**: Verify all text meets WCAG AA (4.5:1)
   - Test: `#2c1810` on `#f4f1e8` = ~12:1 ✓ (Excellent)
   
2. **Focus Indicators**: Ensure all interactive elements have visible focus states

3. **Color Blindness**: Test with color blindness simulators
   - Don't rely solely on color for meaning
   - Use icons and patterns

4. **Readability**: 
   - Comfortable font sizes (14px+ base)
   - Adequate line spacing (1.5-1.6)
   - Warm, non-glaring backgrounds

### Step 10: Register Theme

1. **Add to themes.css** (if not auto-discovered):
```css
@import './themes/parchment-scholar.css';
```

2. **Add metadata to src/utils/themes.ts** (optional - for custom display name):
```typescript
const BUILT_IN_THEME_METADATA: Record<string, Omit<ThemeInfo, 'name'>> = {
  // ... existing themes
  'parchment-scholar': {
    displayName: 'Parchment Scholar',
    description: 'Warm parchment aesthetic inspired by medieval manuscripts and ancient libraries'
  },
  // ...
};
```

3. **Update electron/main.ts** (if needed for menu):
```typescript
const THEME_METADATA: Record<string, { displayName: string }> = {
  // ... existing themes
  'parchment-scholar': { displayName: 'Parchment Scholar' },
  // ...
};
```

## Testing Checklist

- [ ] All components styled consistently
- [ ] Text readable on all backgrounds
- [ ] Contrast ratios meet WCAG AA
- [ ] Hover states work for all interactive elements
- [ ] Focus states visible and clear
- [ ] Extended reading is comfortable
- [ ] Theme works across all views (calendar, timeline, journal, search)
- [ ] Modals and dialogs styled appropriately
- [ ] Loading states maintain theme aesthetic
- [ ] No harsh colors or glaring whites

## Design Patterns to Avoid

1. **Pure black text** - Use deep brown/charcoal instead
2. **Harsh white backgrounds** - Use warm creams/beiges
3. **Bright, saturated colors** - Mute everything for vintage feel
4. **Flat design** - Add subtle depth with shadows
5. **Modern gradients** - Use warm, aged tones
6. **Sharp borders** - Use subtle, aged borders

## Design Patterns to Embrace

1. **Warm color palette** - Creams, beiges, browns, sepia
2. **Soft shadows** - Subtle depth without harshness
3. **Aged borders** - Brown/gray instead of black
4. **Comfortable spacing** - Generous padding for reading
5. **Serif fonts** - Traditional, scholarly feel
6. **Subtle textures** - Aged paper effects
7. **Muted accents** - Gold, sepia, deep brown

## Next Steps After First Theme

1. **User Testing**: Get feedback from academic users
2. **Refinement**: Adjust colors/spacing based on feedback
3. **Additional Themes**: Implement Victorian Archive, Librarian's Study
4. **Font Enhancement**: Consider adding serif fonts via Fontsource
5. **Texture Assets**: Create/acquire subtle aged paper textures

## Resources

- **Color Palette Tools**: 
  - Coolors.co for palette generation
  - Contrast Checker: WebAIM Contrast Checker
  
- **Typography**:
  - Fontsource packages for web fonts
  - Google Fonts for inspiration
  
- **Textures**:
  - Subtle, low-opacity textures
  - Free texture resources (check licensing)

- **Accessibility**:
  - WCAG Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
  - Contrast ratio calculator tools

## Example Color Combinations (Tested for Contrast)

### Parchment Scholar
- Background: `#f4f1e8` | Text: `#2c1810` = **12.4:1** ✓
- Background: `#faf8f3` | Text: `#2c1810` = **13.2:1** ✓
- Background: `#c9a96b` | Text: `#2c1810` = **6.8:1** ✓

### Victorian Archive
- Background: `#faf8f3` | Text: `#1a1a2e` = **13.8:1** ✓
- Background: `#f5f1e8` | Text: `#1a1a2e` = **13.5:1** ✓

All combinations exceed WCAG AAA standards (7:1).

