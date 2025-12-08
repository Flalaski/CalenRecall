# AstroMonix URL Parameter System Documentation

This document provides a comprehensive guide to the URL parameter system in AstroMonix, enabling external projects to link to specific dates, times, and locations.

## Overview

AstroMonix supports URL query parameters that allow you to pre-populate the birth chart form with specific date, time, and location data. When a user visits AstroMonix with these parameters in the URL, the application will automatically load and display the chart for that specific moment and location.

## Supported Parameters

### Core Parameters

| Parameter | Type | Format | Required | Description |
|-----------|------|--------|----------|-------------|
| `date` | String | `YYYY-MM-DD` | No | The date for the birth chart (ISO 8601 format) |
| `time` | String | `HH:MM` | No | The time for the birth chart (24-hour format) |
| `location` | String | Text | No | Human-readable location name (e.g., "New York, USA") |
| `lat` | String | Decimal | No | Latitude coordinate (e.g., "40.7128") |
| `lon` | String | Decimal | No | Longitude coordinate (e.g., "-74.0060") |
| `live` | String | `"true"` | No | Enable live mode (real-time chart updates) |

### Parameter Details

#### Date Format (`date`)
- **Format**: `YYYY-MM-DD` (ISO 8601 date format)
- **Examples**: 
  - `1990-05-15` (May 15, 1990)
  - `2000-01-01` (January 1, 2000)
  - `1985-12-25` (December 25, 1985)
- **Range**: Supports dates from 4713 BC to 6738 AD
- **Note**: The date format is preserved when the URL is updated, so if you pass `1990-5-15`, it will be preserved as-is (though `1990-05-15` is recommended)

#### Time Format (`time`)
- **Format**: `HH:MM` (24-hour format)
- **Examples**:
  - `14:30` (2:30 PM)
  - `09:15` (9:15 AM)
  - `00:00` (Midnight)
  - `23:59` (11:59 PM)
- **Note**: Seconds are not supported; only hours and minutes

#### Location Parameters
You can specify location in two ways:

1. **Location Name** (`location`): Human-readable location string
   - Example: `"New York, USA"`, `"London, UK"`, `"Tokyo, Japan"`
   - This is primarily for display purposes

2. **Coordinates** (`lat` and `lon`): Precise geographic coordinates
   - `lat`: Latitude as a decimal number (positive for North, negative for South)
   - `lon`: Longitude as a decimal number (positive for East, negative for West)
   - Examples:
     - New York: `lat=40.7128&lon=-74.0060`
     - London: `lat=51.5074&lon=-0.1278`
     - Tokyo: `lat=35.6762&lon=139.6503`

**Important**: While `location` is optional, providing `lat` and `lon` is recommended for accurate astrological calculations. If only `location` is provided without coordinates, the application will attempt to geocode it, but coordinates are more reliable.

#### Live Mode (`live`)
- **Value**: Must be the string `"true"` (case-sensitive)
- **Behavior**: When set to `"true"`, enables live mode which updates the chart in real-time
- **Alternative**: Live mode can also be activated by using the `/live` path (e.g., `/live?date=1990-05-15`)
- **Note**: If live mode is explicitly disabled in the application, this parameter will be ignored

## URL Examples

### Basic Date and Time
```
https://your-astromonix-domain.com/?date=1990-05-15&time=14:30
```

### Complete Chart with Location
```
https://your-astromonix-domain.com/?date=1990-05-15&time=14:30&location=London, UK&lat=51.5074&lon=-0.1278
```

### With Live Mode Enabled
```
https://your-astromonix-domain.com/?date=1990-05-15&time=14:30&location=New York, USA&lat=40.7128&lon=-74.0060&live=true
```

### Live Mode via Path
```
https://your-astromonix-domain.com/live?date=1990-05-15&time=14:30
```

### Minimal (Date Only)
```
https://your-astromonix-domain.com/?date=2000-01-01
```

### Coordinates Only (No Location Name)
```
https://your-astromonix-domain.com/?date=1985-12-25&time=12:00&lat=-33.8688&lon=151.2093
```

## Parameter Priority and Behavior

### Detection Order
1. **URL Parameters** (Highest Priority): If URL parameters are present, they override all defaults
2. **Form Fields**: If no URL parameters, form field values are used
3. **Current Time/Location**: If no parameters or form values, current time and auto-detected location are used

### Default Values
If URL parameters are present but some values are missing, the application will:
- **Date/Time**: Use current date/time for missing values
- **Location**: Use "New York, USA" (40.7128, -74.0060) if not specified
- **Coordinates**: Use New York coordinates if not specified

### Parameter Validation
- Empty parameters are ignored (e.g., `?date=&time=14:30` will use current date with time 14:30)
- Invalid date formats may cause the application to fall back to current date
- Invalid coordinates may cause calculation errors

## URL Encoding

When constructing URLs programmatically, ensure proper URL encoding:

### Special Characters
- Spaces in location names should be encoded as `%20` or `+`
- Example: `location=New%20York,%20USA` or `location=New+York,+USA`
- Commas in location names should be URL-encoded as `%2C` if they cause issues, though most browsers handle commas in query strings correctly

### JavaScript Example
```javascript
const params = new URLSearchParams({
    date: '1990-05-15',
    time: '14:30',
    location: 'New York, USA',
    lat: '40.7128',
    lon: '-74.0060'
});
const url = `https://your-astromonix-domain.com/?${params.toString()}`;
// Result: https://your-astromonix-domain.com/?date=1990-05-15&time=14%3A30&location=New+York%2C+USA&lat=40.7128&lon=-74.0060
```

### Python Example
```python
from urllib.parse import urlencode

params = {
    'date': '1990-05-15',
    'time': '14:30',
    'location': 'New York, USA',
    'lat': '40.7128',
    'lon': '-74.0060'
}
url = f"https://your-astromonix-domain.com/?{urlencode(params)}"
```

## Integration Examples

### Linking from Another Application

#### Simple Date Link
```html
<a href="https://astromonix.com/?date=1990-05-15&time=14:30">
    View Chart for May 15, 1990, 2:30 PM
</a>
```

#### JavaScript Redirect
```javascript
function openAstromonixChart(date, time, lat, lon, location) {
    const params = new URLSearchParams({
        date: date,
        time: time,
        lat: lat.toString(),
        lon: lon.toString(),
        location: location
    });
    window.open(`https://astromonix.com/?${params.toString()}`, '_blank');
}

// Usage
openAstromonixChart('1990-05-15', '14:30', 40.7128, -74.0060, 'New York, USA');
```

#### React Component
```jsx
function AstromonixLink({ date, time, location, lat, lon, children }) {
    const params = new URLSearchParams({
        date: date,
        time: time,
        location: location,
        lat: lat?.toString(),
        lon: lon?.toString()
    });
    
    return (
        <a href={`https://astromonix.com/?${params.toString()}`}>
            {children}
        </a>
    );
}

// Usage
<AstromonixLink 
    date="1990-05-15" 
    time="14:30" 
    location="New York, USA"
    lat={40.7128}
    lon={-74.0060}
>
    View Birth Chart
</AstromonixLink>
```

## Technical Implementation Details

### Early Detection
The URL parameters are detected immediately on page load, before any other initialization. This ensures that:
- Parameters are available as soon as possible
- Form fields can be populated immediately
- Chart calculations can use the correct data from the start

### Parameter Storage
The application stores URL parameters in global variables:
- `window._astroMonixUrlParams`: Object containing all detected parameters
- `window._astroMonixHasUrlParams`: Boolean indicating if any parameters exist
- `window._astroMonixHasLocationData`: Boolean indicating if location data exists
- `window._astroMonixOriginalUrlParams`: Copy of original parameters (for format preservation)

### URL Updates
The application automatically updates the URL when form values change, preserving the original parameter format when possible. This means:
- If you link with `date=1990-5-15`, it will be preserved as `1990-5-15` (not normalized to `1990-05-15`)
- The URL stays in sync with the form, allowing users to bookmark or share the current chart state

### Live Mode Handling
Live mode can be activated in two ways:
1. **Query Parameter**: `?live=true`
2. **Path**: `/live` or any path ending in `/live`

Both methods are equivalent. When live mode is active, the URL will include `/live` in the path and `live=true` in the query string.

## Common Use Cases

### 1. Linking to a Specific Birth Chart
```javascript
// User's birth information
const birthDate = '1990-05-15';
const birthTime = '14:30';
const birthLocation = 'New York, USA';
const birthLat = 40.7128;
const birthLon = -74.0060;

// Generate link
const link = `https://astromonix.com/?date=${birthDate}&time=${birthTime}&location=${encodeURIComponent(birthLocation)}&lat=${birthLat}&lon=${birthLon}`;
```

### 2. Linking to Current Moment
```javascript
// Get current date/time
const now = new Date();
const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

// Link to current moment (location will be auto-detected)
const link = `https://astromonix.com/?date=${date}&time=${time}`;
```

### 3. Historical Event Chart
```javascript
// Historical event: Moon Landing
const eventDate = '1969-07-20';
const eventTime = '20:17';
const eventLocation = 'Sea of Tranquility, Moon';
// Note: For Moon coordinates, you'd need to calculate or use approximate Earth coordinates
const link = `https://astromonix.com/?date=${eventDate}&time=${eventTime}&location=${encodeURIComponent(eventLocation)}`;
```

### 4. Future Event Chart
```javascript
// Future event: New Year 2025
const futureDate = '2025-01-01';
const futureTime = '00:00';
const futureLocation = 'New York, USA';
const link = `https://astromonix.com/?date=${futureDate}&time=${futureTime}&location=${encodeURIComponent(futureLocation)}&lat=40.7128&lon=-74.0060`;
```

## Error Handling

### Invalid Dates
If an invalid date format is provided:
- The application will attempt to parse it using JavaScript's `Date` constructor
- If parsing fails, it falls back to the current date
- The form will still be populated with the invalid value, but calculations will use the fallback

### Missing Parameters
- Missing `date`: Uses current date
- Missing `time`: Uses current time
- Missing `location`: Uses "New York, USA" (or auto-detected location if available)
- Missing `lat`/`lon`: Uses New York coordinates (40.7128, -74.0060)

### Best Practices
1. **Always provide coordinates**: While `location` name is nice for display, `lat` and `lon` ensure accuracy
2. **Use ISO date format**: `YYYY-MM-DD` is the most reliable format
3. **URL encode properly**: Especially important for location names with special characters
4. **Test your URLs**: Verify that your generated URLs work correctly in a browser

## Browser Compatibility

The URL parameter system uses standard web APIs:
- `URLSearchParams`: Supported in all modern browsers (Chrome 49+, Firefox 44+, Safari 10.1+, Edge 17+)
- `window.location.search`: Universal support
- `history.replaceState`: Supported in all modern browsers

For older browser support, you may need to include a polyfill for `URLSearchParams`.

## Debugging

### Console Logging
The application logs URL parameter detection to the console. Look for:
- `[EARLY URL DETECTION]` messages showing detected parameters
- `[URL LOAD]` messages showing form field population
- `[LIVE MODE DEBUG]` messages showing live mode detection

### Testing URLs
You can test your URLs by:
1. Opening the browser console
2. Navigating to your URL
3. Checking the console for detection messages
4. Verifying form fields are populated correctly

### Common Issues
- **Parameters not loading**: Check that the URL is properly formatted and encoded
- **Date not recognized**: Ensure date is in `YYYY-MM-DD` format
- **Location not found**: Provide both `location` name and `lat`/`lon` coordinates
- **Live mode not activating**: Ensure `live=true` is in the query string or use `/live` path

## Summary

The AstroMonix URL parameter system provides a simple, powerful way to link to specific astrological charts. By including `date`, `time`, `location`, `lat`, and `lon` parameters in your URLs, you can create deep links that automatically load the correct chart when users visit AstroMonix.

**Quick Reference:**
- Date: `YYYY-MM-DD` (e.g., `1990-05-15`)
- Time: `HH:MM` (e.g., `14:30`)
- Location: Text string (e.g., `New York, USA`)
- Latitude: Decimal number (e.g., `40.7128`)
- Longitude: Decimal number (e.g., `-74.0060`)
- Live Mode: `live=true` or use `/live` path

For questions or issues, refer to the console logs or check the source code in `index.html` for the implementation details.

