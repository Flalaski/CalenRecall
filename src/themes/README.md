# Themes Directory

This directory contains all theme files for CalenRecall. Each theme is defined in its own CSS file.

## Built-in Themes

- `windows95.css` - Classic Windows 95 aesthetic
- `high-contrast.css` - High contrast accessibility theme
- `terminal.css` - Monochrome terminal aesthetic
- `forest.css` - Nature-inspired green theme
- `ocean.css` - Cool blue ocean theme
- `sunset.css` - Warm sunset orange theme
- `retro80s.css` - Vibrant 1980s retro theme
- `modern-minimal.css` - Clean minimal design

Note: `light` and `dark` themes are handled separately in the main application CSS.

## Creating Your Own Theme

To create a custom theme:

1. **Create a new CSS file** in this directory, e.g., `my-custom-theme.css`

2. **Use the template structure** from `theme-template.css` as a starting point

3. **Define your theme** using the `[data-theme="your-theme-name"]` selector:
   ```css
   [data-theme="your-theme-name"] {
     /* Your theme styles */
   }
   
   [data-theme="your-theme-name"] body {
     background: #your-color;
     color: #your-text-color;
   }
   
   /* Style all components... */
   ```

4. **Add the import** to `src/themes.css` (in the parent directory):
   ```css
   @import './themes/your-theme-name.css';
   ```
   
   Note: The path is relative to `src/themes.css`, which is located in the `src/` directory.

5. **Register your theme** in `src/utils/themes.ts`:
   ```typescript
   export type ThemeName = 
     | 'light' 
     | 'dark' 
     | 'your-theme-name'  // Add here
     | ...;
     
   export const AVAILABLE_THEMES: ThemeInfo[] = [
     // ... existing themes
     {
       name: 'your-theme-name',
       displayName: 'Your Theme Name',
       description: 'Description of your theme'
     }
   ];
   ```

## Theme Structure

Each theme should style all UI components comprehensively. See `COMPONENT_CLASSES.md` for a complete list of all CSS classes that need styling.

Key areas to cover:
- Base elements (body, .app, .app-content)
- Navigation bar and buttons
- Calendar views (grid, cells, headers)
- Timeline views
- Entry viewers and editors
- Modals and dialogs
- Search interface
- Preferences page
- Journal list
- Loading screens
- All buttons, inputs, selects
- Tags, badges, and indicators
- All hover, focus, and active states

**Important**: Your theme file should comprehensively style ALL component classes to ensure consistent appearance across the entire application.

## Theme Template

See `theme-template.css` for a complete template showing all component classes that need styling.

## Best Practices

1. **Use CSS variables** for colors that appear multiple times
2. **Style all states**: normal, hover, focus, active, disabled
3. **Maintain consistency** within your theme
4. **Test thoroughly** across all views and components
5. **Consider accessibility** - ensure sufficient contrast ratios
6. **Document your theme** with comments explaining design choices

