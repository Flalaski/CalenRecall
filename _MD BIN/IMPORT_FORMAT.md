# CalenRecall Import Format API Documentation

This document provides comprehensive documentation for importing journal entries into CalenRecall. Use this guide to create custom import scripts that convert your existing datasets into CalenRecall-compatible formats.

## Table of Contents

1. [Overview](#overview)
2. [Profile System](#profile-system)
3. [JSON Format](#json-format)
4. [Markdown Format](#markdown-format)
5. [Field Reference](#field-reference)
6. [Creating Custom Import Scripts](#creating-custom-import-scripts)
7. [Examples](#examples)
8. [Validation & Troubleshooting](#validation--troubleshooting)

---

## Overview

CalenRecall supports importing journal entries in two formats:

- **JSON** - Structured data format, best for programmatic conversion and supports all entry fields
- **Markdown** - Human-readable text format, best for manual editing or simple scripts

### Key Concepts

- **Profile-Based Import**: All imports are performed on the **currently active profile**. Each profile has its own separate database, so entries imported into one profile will not appear in another.
- **Duplicate Prevention**: Entries with an `id` field will be **skipped** during import to prevent duplicates. Only include `id` if you want to skip that entry.
- **Date Format**: All dates must be in ISO format: `YYYY-MM-DD` (e.g., `2024-12-05`). Negative years are supported (e.g., `-0001-01-01`).
- **Time Range**: Must be one of: `decade`, `year`, `month`, `week`, or `day`.
- **Character Encoding**: Files should be UTF-8 encoded.

---

## Profile System

### Understanding Profiles

CalenRecall uses a **profile-based system** where each profile has its own isolated database. This allows you to:

- Separate personal and work journals
- Maintain multiple independent datasets
- Organize entries by project, theme, or purpose

### Import Behavior with Profiles

1. **Active Profile**: Imports always go to the **currently active profile** at the time of import.
2. **Profile Selection**: Before importing, ensure you have selected the correct profile in CalenRecall.
3. **Profile-Specific Data**: Each profile's database is completely independent. Importing the same file into different profiles will create separate copies of the entries.
4. **Backup & Restore**: Backup and restore operations are also profile-specific. When you backup, you're backing up the current profile's database.

### Best Practices

- **Before Import**: Verify which profile is active by checking the profile name in the application.
- **Multiple Profiles**: If you need to import the same data into multiple profiles, you'll need to:
  1. Select Profile A → Import file
  2. Select Profile B → Import the same file again
- **Profile Management**: Use descriptive profile names to avoid confusion (e.g., "Personal Journal", "Work Log", "Project Notes").

---

## JSON Format

### File Structure

The JSON file must contain an **array** of entry objects:

```json
[
  {
    "date": "2024-12-05",
    "timeRange": "day",
    "title": "My Entry Title",
    "content": "Entry content goes here...",
    "tags": ["tag1", "tag2"],
    "createdAt": "2024-12-05T10:30:00.000Z",
    "updatedAt": "2024-12-05T10:30:00.000Z"
  }
]
```

### Complete Field Reference

See the [Field Reference](#field-reference) section for detailed information about all supported fields.

### Minimal Example

Only `date` is strictly required. All other fields have defaults:

```json
[
  {
    "date": "2024-12-05"
  }
]
```

### Complete Example with All Fields

```json
[
  {
    "date": "2024-12-05",
    "timeRange": "day",
    "hour": 14,
    "minute": 30,
    "second": 0,
    "title": "Afternoon Meeting",
    "content": "Had a productive meeting with the team.\n\nDiscussed:\n- Project timeline\n- Resource allocation\n- Next steps",
    "tags": ["work", "meeting", "team"],
    "linkedEntries": [],
    "archived": false,
    "pinned": true,
    "createdAt": "2024-12-05T14:30:00.000Z",
    "updatedAt": "2024-12-05T14:30:00.000Z"
  },
  {
    "date": "2024-11-01",
    "timeRange": "month",
    "title": "November Summary",
    "content": "November was a productive month.",
    "tags": ["summary", "monthly"]
  }
]
```

---

## Markdown Format

### File Structure

Each entry follows this pattern:

```markdown
## YYYY-MM-DD (timeRange) — Title
**Tags:** tag1, tag2

Entry content goes here.
Can span multiple lines.

---
```

### Format Rules

1. **Entry Header**: Must start with `## ` followed by:
   - Date in ISO format: `YYYY-MM-DD` (supports negative years like `-0001-01-01`)
   - Time range in parentheses: `(decade)`, `(year)`, `(month)`, `(week)`, or `(day)`
   - Em dash `—` (or regular dash `-`)
   - Title text

2. **Tags Line** (optional): 
   - Format: `**Tags:** tag1, tag2, tag3`
   - Must appear after the header
   - Tags are comma-separated
   - Can be omitted if no tags

3. **Content**:
   - Appears after the header (and tags, if present)
   - Can span multiple lines
   - Empty lines are preserved
   - Markdown formatting is preserved (but not rendered in CalenRecall)

4. **Entry Separator**:
   - Each entry ends with `---` on its own line
   - This separates entries from each other

### Complete Markdown Example

```markdown
## 2024-12-05 (day) — Morning Reflection
**Tags:** reflection, morning, tasks

Today I woke up feeling refreshed. The weather is beautiful and I'm ready to tackle the day.

I have several tasks to complete:
- Review project proposal
- Call client
- Write documentation

---

## 2024-11-01 (month) — November Summary
**Tags:** summary, monthly

November was a productive month. I completed several major milestones and learned a lot.

---

## 2024-01-01 (year) — New Year's Resolution
**Tags:** resolution, yearly

This year I resolve to:
1. Learn a new language
2. Exercise regularly
3. Read more books

---
```

### Markdown Limitations

The Markdown format has some limitations compared to JSON:

- **Time Fields**: Hour, minute, and second cannot be specified in Markdown format
- **Linked Entries**: Cannot be specified in Markdown format
- **Archived/Pinned Status**: Cannot be specified in Markdown format (defaults to `false`)
- **Attachments**: Cannot be imported in either format (must be added manually)

For full control over all fields, use the JSON format.

---

## Field Reference

### Core Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `date` | string | **Yes** | - | ISO date string (YYYY-MM-DD). Supports negative years (e.g., `-0001-01-01`). |
| `timeRange` | string | No | `"day"` | One of: `"decade"`, `"year"`, `"month"`, `"week"`, `"day"` |
| `title` | string | No | `""` | Entry title |
| `content` | string | No | `""` | Entry content (supports multi-line text, newlines preserved) |

### Time Fields (JSON Only)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `hour` | number \| null | No | `null` | Hour of day (0-23). Set to `null` to omit. |
| `minute` | number \| null | No | `null` | Minute (0-59). Set to `null` to omit. |
| `second` | number \| null | No | `null` | Second (0-59). Set to `null` to omit. |

**Notes:**
- If `hour` is provided, it must be between 0-23
- If `minute` is provided, it must be between 0-59
- If `second` is provided, it must be between 0-59
- If `hour` is `null` or omitted, the entry has no specific time
- If `hour` is provided but `minute`/`second` are omitted, they default to 0

### Metadata Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `tags` | string[] | No | `[]` | Array of tag strings. Empty array if omitted. |
| `linkedEntries` | number[] | No | `[]` | Array of entry IDs this entry is linked to. **Note**: IDs must reference entries that already exist in the database. |
| `archived` | boolean | No | `false` | Whether this entry is archived |
| `pinned` | boolean | No | `false` | Whether this entry is pinned/favorited |

### Timestamp Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `createdAt` | string | No | Current time | ISO datetime string (e.g., `"2024-12-05T10:30:00.000Z"`) |
| `updatedAt` | string | No | Current time | ISO datetime string (e.g., `"2024-12-05T10:30:00.000Z"`) |

### Special Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | number | No | - | **If present, entry will be SKIPPED during import** (used to prevent duplicates) |

### Fields Not Supported in Import

These fields exist in CalenRecall but **cannot** be imported:

- `attachments` - File attachments must be added manually after import through the CalenRecall UI

---

## Creating Custom Import Scripts

### General Conversion Strategy

1. **Read Your Source Data**: Load your existing dataset (CSV, database, text files, etc.)
2. **Map Fields**: Map your data fields to CalenRecall's field structure
3. **Transform Data**: Convert dates, normalize text, extract tags, etc.
4. **Generate Output**: Create JSON or Markdown file following CalenRecall's format
5. **Validate**: Check that dates are valid, time ranges are correct, etc.
6. **Import**: Use CalenRecall's import feature to load the file

### Step-by-Step Guide

#### Step 1: Analyze Your Source Data

Identify:
- How dates are stored (format, timezone)
- What fields map to title, content, tags
- Whether you have time information (hour, minute, second)
- Whether entries have relationships (for linkedEntries)
- Whether entries have status flags (archived, pinned)

#### Step 2: Create Field Mapping

Create a mapping between your source fields and CalenRecall fields:

```python
# Example mapping
FIELD_MAPPING = {
    'date': 'entry_date',           # Your source field → CalenRecall field
    'title': 'subject',
    'content': 'body',
    'tags': 'categories',
    'timeRange': 'period_type',
}
```

#### Step 3: Write Conversion Logic

```python
def convert_entry(source_entry, mapping):
    """Convert a source entry to CalenRecall format."""
    calenrecall_entry = {
        'date': convert_date(source_entry[mapping['date']]),
        'timeRange': map_time_range(source_entry.get(mapping.get('timeRange'))),
        'title': source_entry.get(mapping.get('title'), ''),
        'content': source_entry.get(mapping.get('content'), ''),
        'tags': parse_tags(source_entry.get(mapping.get('tags'), '')),
        'createdAt': convert_timestamp(source_entry.get('created_at')),
        'updatedAt': convert_timestamp(source_entry.get('updated_at')),
    }
    
    # Add optional fields if available
    if 'hour' in source_entry:
        calenrecall_entry['hour'] = int(source_entry['hour'])
    
    return calenrecall_entry
```

#### Step 4: Handle Edge Cases

- **Missing Dates**: Skip entries without valid dates
- **Invalid Time Ranges**: Default to 'day' if invalid
- **Empty Content**: Allow empty content (some entries might be title-only)
- **Special Characters**: Ensure UTF-8 encoding
- **Large Files**: Process in batches if dealing with very large datasets

#### Step 5: Generate Output File

```python
import json

entries = []
for source_entry in source_data:
    converted = convert_entry(source_entry, FIELD_MAPPING)
    if converted:  # Only add if conversion succeeded
        entries.append(converted)

# Write JSON file
with open('calenrecall_import.json', 'w', encoding='utf-8') as f:
    json.dump(entries, f, indent=2, ensure_ascii=False)
```

---

## Examples

### Example 1: Converting from CSV

```python
import csv
import json
from datetime import datetime

def convert_csv_to_calenrecall(csv_file, output_file):
    entries = []
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Convert date format (assuming MM/DD/YYYY)
            try:
                date_obj = datetime.strptime(row['Date'], '%m/%d/%Y')
                iso_date = date_obj.strftime('%Y-%m-%d')
            except ValueError:
                print(f"Skipping invalid date: {row['Date']}")
                continue
            
            # Parse tags (assuming comma-separated)
            tags = [tag.strip() for tag in row['Tags'].split(',')] if row.get('Tags') else []
            
            # Map time range
            time_range_map = {
                'D': 'day',
                'W': 'week',
                'M': 'month',
                'Y': 'year',
            }
            time_range = time_range_map.get(row.get('Period', 'D'), 'day')
            
            entry = {
                "date": iso_date,
                "timeRange": time_range,
                "title": row.get('Title', ''),
                "content": row.get('Content', ''),
                "tags": tags,
                "createdAt": datetime.now().isoformat() + 'Z',
                "updatedAt": datetime.now().isoformat() + 'Z'
            }
            entries.append(entry)
    
    # Write JSON file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
    
    print(f"Converted {len(entries)} entries to {output_file}")

# Usage
convert_csv_to_calenrecall('journal.csv', 'calenrecall_import.json')
```

### Example 2: Converting from Plain Text Diary

```python
import re
import json
from datetime import datetime

def convert_text_diary(input_file, output_file):
    entries = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Example format: "2024-12-05: Title\nContent here..."
    pattern = r'(\d{4}-\d{2}-\d{2}):\s*(.+?)\n(.*?)(?=\d{4}-\d{2}-\d{2}:|$)'
    
    for match in re.finditer(pattern, content, re.DOTALL):
        date_str = match.group(1)
        title = match.group(2).strip()
        content_text = match.group(3).strip()
        
        # Validate date
        try:
            datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            print(f"Skipping invalid date: {date_str}")
            continue
        
        entry = {
            "date": date_str,
            "timeRange": "day",
            "title": title,
            "content": content_text,
            "tags": [],
            "createdAt": datetime.now().isoformat() + 'Z',
            "updatedAt": datetime.now().isoformat() + 'Z'
        }
        entries.append(entry)
    
    # Write JSON file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
    
    print(f"Converted {len(entries)} entries to {output_file}")

convert_text_diary('diary.txt', 'calenrecall_import.json')
```

### Example 3: Converting from SQLite Database

```python
import sqlite3
import json
from datetime import datetime

def convert_sqlite_to_calenrecall(db_file, output_file):
    entries = []
    
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    # Query your source database
    cursor.execute("""
        SELECT date, title, content, tags, created_at, updated_at, hour, minute
        FROM entries
        ORDER BY date
    """)
    
    for row in cursor.fetchall():
        date_str, title, content, tags_str, created_at, updated_at, hour, minute = row
        
        # Parse tags
        tags = [tag.strip() for tag in tags_str.split(',')] if tags_str else []
        
        entry = {
            "date": date_str,
            "timeRange": "day",
            "title": title or '',
            "content": content or '',
            "tags": tags,
            "createdAt": created_at or datetime.now().isoformat() + 'Z',
            "updatedAt": updated_at or datetime.now().isoformat() + 'Z'
        }
        
        # Add time fields if available
        if hour is not None:
            entry['hour'] = hour
            if minute is not None:
                entry['minute'] = minute
        
        entries.append(entry)
    
    conn.close()
    
    # Write JSON file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
    
    print(f"Converted {len(entries)} entries to {output_file}")

convert_sqlite_to_calenrecall('old_journal.db', 'calenrecall_import.json')
```

### Example 4: Converting to Markdown Format

```python
import json
from datetime import datetime

def convert_to_markdown(json_file, markdown_file):
    with open(json_file, 'r', encoding='utf-8') as f:
        entries = json.load(f)
    
    lines = []
    
    for entry in entries:
        # Header: ## YYYY-MM-DD (timeRange) — Title
        time_range = entry.get('timeRange', 'day')
        title = entry.get('title', '')
        lines.append(f"## {entry['date']} ({time_range}) — {title}")
        
        # Tags
        if entry.get('tags'):
            tags_str = ', '.join(entry['tags'])
            lines.append(f"**Tags:** {tags_str}")
        
        lines.append('')  # Empty line
        
        # Content
        if entry.get('content'):
            lines.append(entry['content'])
        
        lines.append('')  # Empty line
        
        # Separator
        lines.append('---')
        lines.append('')  # Empty line
    
    with open(markdown_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    print(f"Converted {len(entries)} entries to {markdown_file}")

convert_to_markdown('entries.json', 'calenrecall_import.md')
```

### Example 5: Advanced Conversion with Time Fields

```python
import json
from datetime import datetime

def convert_with_time_fields(source_data, output_file):
    entries = []
    
    for item in source_data:
        # Parse datetime if available
        if 'datetime' in item:
            dt = datetime.fromisoformat(item['datetime'].replace('Z', '+00:00'))
            date_str = dt.strftime('%Y-%m-%d')
            hour = dt.hour
            minute = dt.minute
            second = dt.second
        else:
            date_str = item['date']
            hour = item.get('hour')
            minute = item.get('minute')
            second = item.get('second')
        
        entry = {
            "date": date_str,
            "timeRange": item.get('timeRange', 'day'),
            "title": item.get('title', ''),
            "content": item.get('content', ''),
            "tags": item.get('tags', []),
        }
        
        # Add time fields if available
        if hour is not None:
            entry['hour'] = hour
            if minute is not None:
                entry['minute'] = minute
                if second is not None:
                    entry['second'] = second
        
        # Add metadata
        if item.get('archived'):
            entry['archived'] = True
        if item.get('pinned'):
            entry['pinned'] = True
        
        entries.append(entry)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
    
    print(f"Converted {len(entries)} entries with time fields to {output_file}")
```

---

## Validation & Troubleshooting

### Pre-Import Validation Checklist

Before importing, ensure your file:

- [ ] Is UTF-8 encoded
- [ ] Has valid JSON syntax (if using JSON format)
- [ ] All dates are in ISO format: `YYYY-MM-DD`
- [ ] All dates are valid calendar dates (e.g., not February 30th)
- [ ] All time ranges are one of: `decade`, `year`, `month`, `week`, `day`
- [ ] All hour values (if present) are between 0-23
- [ ] All minute/second values (if present) are between 0-59
- [ ] No entries have `id` fields (unless you want them skipped)
- [ ] For Markdown: Headers follow the exact format with em dash `—`
- [ ] For Markdown: Entries are separated by `---` on its own line

### Common Issues and Solutions

#### Issue: "No entries found in file"

**Possible Causes:**
- File encoding is not UTF-8
- JSON syntax is invalid
- Markdown headers don't match the expected format

**Solutions:**
- Convert file to UTF-8 encoding
- Validate JSON syntax using a JSON validator
- Check Markdown header format matches: `## YYYY-MM-DD (timeRange) — Title`

#### Issue: "Failed to read file"

**Possible Causes:**
- File permissions issue
- File is corrupted
- File path is incorrect

**Solutions:**
- Check file permissions
- Verify file is not corrupted
- Ensure file path is correct

#### Issue: Entries not importing

**Possible Causes:**
- Entries have `id` fields (they will be skipped)
- Date format is incorrect
- Time range values are invalid

**Solutions:**
- Remove `id` fields from entries you want to import
- Verify date format is `YYYY-MM-DD`
- Ensure time range values are valid

#### Issue: Date parsing errors

**Possible Causes:**
- Dates are not in ISO format
- Invalid dates (e.g., February 30th)
- Negative years not formatted correctly

**Solutions:**
- Convert dates to ISO format: `YYYY-MM-DD`
- Validate dates are real calendar dates
- For negative years, use format: `-YYYY-MM-DD` (e.g., `-0001-01-01`)

#### Issue: Time fields not working

**Possible Causes:**
- Hour/minute/second values are out of range
- Values are not numbers

**Solutions:**
- Ensure hour is 0-23, minute/second are 0-59
- Convert values to numbers (not strings)

### Validation Script Example

```python
import json
from datetime import datetime

def validate_import_file(file_path):
    """Validate a CalenRecall import file."""
    errors = []
    warnings = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        if file_path.endswith('.json'):
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                errors.append(f"Invalid JSON: {e}")
                return errors, warnings
            
            if not isinstance(data, list):
                errors.append("JSON must contain an array of entries")
                return errors, warnings
            
            entries = data
        else:
            # Markdown validation would go here
            entries = []
    
    valid_time_ranges = ['decade', 'year', 'month', 'week', 'day']
    
    for i, entry in enumerate(entries):
        # Validate date
        if 'date' not in entry:
            errors.append(f"Entry {i}: Missing required field 'date'")
        else:
            try:
                datetime.strptime(entry['date'], '%Y-%m-%d')
            except ValueError:
                errors.append(f"Entry {i}: Invalid date format: {entry['date']}")
        
        # Validate time range
        if 'timeRange' in entry:
            if entry['timeRange'] not in valid_time_ranges:
                errors.append(f"Entry {i}: Invalid timeRange: {entry['timeRange']}")
        
        # Validate time fields
        if 'hour' in entry and entry['hour'] is not None:
            if not (0 <= entry['hour'] <= 23):
                errors.append(f"Entry {i}: Hour must be 0-23, got: {entry['hour']}")
        
        if 'minute' in entry and entry['minute'] is not None:
            if not (0 <= entry['minute'] <= 59):
                errors.append(f"Entry {i}: Minute must be 0-59, got: {entry['minute']}")
        
        if 'second' in entry and entry['second'] is not None:
            if not (0 <= entry['second'] <= 59):
                errors.append(f"Entry {i}: Second must be 0-59, got: {entry['second']}")
        
        # Check for id field (will be skipped)
        if 'id' in entry:
            warnings.append(f"Entry {i}: Has 'id' field - will be skipped during import")
    
    return errors, warnings

# Usage
errors, warnings = validate_import_file('calenrecall_import.json')
if errors:
    print("Errors found:")
    for error in errors:
        print(f"  - {error}")
if warnings:
    print("Warnings:")
    for warning in warnings:
        print(f"  - {warning}")
if not errors and not warnings:
    print("File is valid!")
```

---

## Import Process

### Step-by-Step Import Instructions

1. **Select Profile**: Ensure you have the correct profile selected in CalenRecall
2. **Prepare File**: Create your import file (JSON or Markdown) following this documentation
3. **Validate**: Optionally validate your file using the validation script
4. **Import**: 
   - Go to File → Import → JSON (or Markdown)
   - Select your import file
   - Wait for import to complete
5. **Review Results**: Check the import results:
   - `imported`: Number of entries successfully imported
   - `skipped`: Number of entries skipped (entries with `id` fields)
   - `total`: Total entries found in file
6. **Verify**: Check your entries in CalenRecall to ensure they imported correctly

### Import Progress Messages

During import, you'll see progress messages indicating:
- Which profile the import is going to
- How many entries have been processed
- Any errors that occurred

Example progress messages:
- `Reading file for profile: Personal Journal...`
- `Parsing entries for profile: Personal Journal...`
- `Importing 150 entries into profile: Personal Journal...`
- `Profile: Personal Journal - Imported 145 entries, skipped 5...`
- `Import complete for profile: Personal Journal! Imported 145 entries, skipped 5 duplicates.`

---

## Additional Resources

### Tips for Large Imports

- **Test First**: Import a small subset first to verify your conversion script works correctly
- **Batch Processing**: For very large datasets, consider splitting into multiple files
- **Progress Tracking**: Monitor import progress for large files
- **Backup First**: Always backup your current profile before importing large datasets

### Best Practices

1. **Profile Organization**: Use descriptive profile names and organize imports by purpose
2. **Date Validation**: Always validate dates before importing
3. **Tag Consistency**: Use consistent tag naming conventions
4. **Content Preservation**: Ensure your conversion script preserves all important content
5. **Testing**: Test your conversion script on a small sample before full import

### Getting Help

If you encounter issues:

1. **Check Validation**: Run the validation script to identify problems
2. **Review Examples**: Compare your format with the examples in this document
3. **Test Small**: Try importing a single entry first
4. **Check Profile**: Verify you're importing to the correct profile
5. **Export First**: Export some entries from CalenRecall to see the exact format

---

## Support

For additional help or questions about creating custom import scripts, please refer to:
- CalenRecall main documentation
- Export your entries first to see the exact format CalenRecall uses
- Test with a small file before importing large datasets

---

**Last Updated**: 2024-12-08
**Version**: 2.0 (Profile-Aware)
