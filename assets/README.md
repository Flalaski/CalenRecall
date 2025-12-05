# Assets Directory

## Icon Files

- `icon.svg` - Source SVG icon for CalenRecall (calendar + journal design)
- `icon.png` - Generated PNG icon (256x256) - created from icon.svg
- `icon-512.png` - High-resolution version (512x512)
- `icon-1024.png` - High-resolution version (1024x1024)

## Generating PNG from SVG

To generate the PNG files from the SVG source:

```bash
npm run generate:icon
```

This requires the `sharp` package. If not installed, run:
```bash
npm install --save-dev sharp
```

The icon design features:
- Calendar grid (representing time/date organization)
- Journal/notebook (representing memory/journaling)
- Connecting arrow (representing recall from calendar to journal)
- Memory marker (highlighted day with sparkle)

If icon.png is not present, the application will use Electron's default icon.

