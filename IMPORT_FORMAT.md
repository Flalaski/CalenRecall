# CalenRecall Import Format Documentation

This document explains the expected format for importing journal entries into CalenRecall. Use this guide to adapt your own scripts for converting documents from other formats.

## Overview

CalenRecall supports importing entries in two formats:
- **JSON** - Structured data format, best for programmatic conversion
- **Markdown** - Human-readable text format, best for manual editing or simple scripts

## Important Notes

- **Duplicate Prevention**: Entries with an `id` field will be **skipped** during import to prevent duplicates. Only include `id` if you want to skip that entry.
- **Date Format**: All dates must be in ISO format: `YYYY-MM-DD` (e.g., `2024-12-05`). Negative years are supported (e.g., `-0001-01-01`).
- **Time Range**: Must be one of: `decade`, `year`, `month`, `week`, or `day`.
- **Character Encoding**: Files should be UTF-8 encoded.

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
  },
  {
    "date": "2024-12-06",
    "timeRange": "day",
    "title": "Another Entry",
    "content": "More content..."
  }
]
```

### Field Specifications

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `date` | string | **Yes** | - | ISO date string (YYYY-MM-DD). Supports negative years. |
| `timeRange` | string | No | `"day"` | One of: `"decade"`, `"year"`, `"month"`, `"week"`, `"day"` |
| `title` | string | No | `""` | Entry title |
| `content` | string | No | `""` | Entry content (supports multi-line text) |
| `tags` | string[] | No | `[]` | Array of tag strings |
| `createdAt` | string | No | Current time | ISO datetime string (e.g., `"2024-12-05T10:30:00.000Z"`) |
| `updatedAt` | string | No | Current time | ISO datetime string (e.g., `"2024-12-05T10:30:00.000Z"`) |
| `id` | number | No | - | **If present, entry will be skipped** (used to prevent duplicates) |

### Optional Fields (Not Imported)

These fields exist in CalenRecall but are **not** imported from JSON:
- `linkedEntries` - Will be empty after import
- `archived` - Will be `false` after import
- `pinned` - Will be `false` after import
- `attachments` - Cannot be imported (must be added manually)

### Complete JSON Example

```json
[
  {
    "date": "2024-12-05",
    "timeRange": "day",
    "title": "Morning Reflection",
    "content": "Today I woke up feeling refreshed. The weather is beautiful and I'm ready to tackle the day.\n\nI have several tasks to complete:\n- Review project proposal\n- Call client\n- Write documentation",
    "tags": ["reflection", "morning", "tasks"],
    "createdAt": "2024-12-05T08:00:00.000Z",
    "updatedAt": "2024-12-05T08:00:00.000Z"
  },
  {
    "date": "2024-11-01",
    "timeRange": "month",
    "title": "November Summary",
    "content": "November was a productive month. I completed several major milestones and learned a lot.",
    "tags": ["summary", "monthly"]
  },
  {
    "date": "2024-01-01",
    "timeRange": "year",
    "title": "New Year's Resolution",
    "content": "This year I resolve to:\n1. Learn a new language\n2. Exercise regularly\n3. Read more books",
    "tags": ["resolution", "yearly"]
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

### Markdown Format Details

- **Header Regex Pattern**: `^##\s+(-?\d{4}-\d{2}-\d{2})\s+\((\w+)\)\s+—\s+(.+)$`
  - Date: `-?\d{4}-\d{2}-\d{2}` (supports negative years)
  - Time range: `\w+` (must be: decade, year, month, week, or day)
  - Title: Everything after the em dash

- **Tags Line**: `^\*\*Tags:\*\*` followed by comma-separated tags
- **Separator**: `---` on its own line (three hyphens)
- **Content**: All lines between the header/tags and the separator

---

## Converting from Other Formats

### General Conversion Tips

1. **Date Conversion**:
   - Convert your date format to ISO: `YYYY-MM-DD`
   - For negative years, use format: `-YYYY-MM-DD` (e.g., `-0001-01-01`)
   - Ensure dates are valid calendar dates

2. **Time Range Mapping**:
   - Map your time periods to: `decade`, `year`, `month`, `week`, or `day`
   - If unsure, use `day` as the default

3. **Content Handling**:
   - Preserve line breaks in content
   - Escape special characters in JSON (e.g., `\n` for newlines, `\"` for quotes)
   - In Markdown, content is plain text (formatting preserved but not rendered)

4. **Tags**:
   - Convert your tag/category system to an array of strings
   - Remove duplicates
   - Trim whitespace

### Example: Converting from CSV

```python
import csv
import json
from datetime import datetime

entries = []

with open('journal.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Convert date format (assuming MM/DD/YYYY)
        date_obj = datetime.strptime(row['Date'], '%m/%d/%Y')
        iso_date = date_obj.strftime('%Y-%m-%d')
        
        # Parse tags (assuming comma-separated)
        tags = [tag.strip() for tag in row['Tags'].split(',')] if row['Tags'] else []
        
        entry = {
            "date": iso_date,
            "timeRange": row.get('TimeRange', 'day'),
            "title": row['Title'],
            "content": row['Content'],
            "tags": tags,
            "createdAt": datetime.now().isoformat() + 'Z',
            "updatedAt": datetime.now().isoformat() + 'Z'
        }
        entries.append(entry)

# Write JSON file
with open('calenrecall_import.json', 'w', encoding='utf-8') as f:
    json.dump(entries, f, indent=2, ensure_ascii=False)
```

### Example: Converting from Plain Text Diary

```python
import re
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
    import json
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)

convert_text_diary('diary.txt', 'calenrecall_import.json')
```

### Example: Converting to Markdown Format

```python
import json
from datetime import datetime

def convert_to_markdown(json_file, markdown_file):
    with open(json_file, 'r', encoding='utf-8') as f:
        entries = json.load(f)
    
    lines = []
    
    for entry in entries:
        # Header
        lines.append(f"## {entry['date']} ({entry.get('timeRange', 'day')}) — {entry.get('title', '')}")
        
        # Tags
        if entry.get('tags'):
            tags_str = ', '.join(entry['tags'])
            lines.append(f"**Tags:** {tags_str}")
        
        lines.append('')  # Empty line
        
        # Content
        lines.append(entry.get('content', ''))
        lines.append('')  # Empty line
        
        # Separator
        lines.append('---')
        lines.append('')  # Empty line
    
    with open(markdown_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

convert_to_markdown('entries.json', 'calenrecall_import.md')
```

---

## Validation Checklist

Before importing, ensure your file:

- [ ] Is UTF-8 encoded
- [ ] Has valid JSON syntax (if using JSON format)
- [ ] All dates are in ISO format: `YYYY-MM-DD`
- [ ] All time ranges are one of: `decade`, `year`, `month`, `week`, `day`
- [ ] No entries have `id` fields (unless you want them skipped)
- [ ] Dates are valid calendar dates
- [ ] For Markdown: Headers follow the exact format with em dash `—`
- [ ] For Markdown: Entries are separated by `---` on its own line

---

## Import Process

1. Open CalenRecall
2. Go to Preferences (or use the import menu)
3. Select "Import Entries"
4. Choose format: JSON or Markdown
5. Select your file
6. Review the import results:
   - `imported`: Number of entries successfully imported
   - `skipped`: Number of entries skipped (entries with `id` fields)
   - `total`: Total entries found in file

---

## Troubleshooting

### Common Issues

1. **"No entries found in file"**
   - Check file encoding (must be UTF-8)
   - Verify JSON syntax is valid
   - For Markdown, ensure headers follow the exact format

2. **"Failed to read file"**
   - Check file permissions
   - Ensure file is not corrupted
   - Verify file path is correct

3. **Entries not importing**
   - Check if entries have `id` fields (they will be skipped)
   - Verify date format is `YYYY-MM-DD`
   - Ensure time range values are valid

4. **Date parsing errors**
   - Verify dates are in ISO format
   - Check for invalid dates (e.g., February 30th)
   - Ensure negative years use format: `-YYYY-MM-DD`

---

## Additional Resources

- For more information about CalenRecall, see the main documentation
- Export your entries first to see the exact format CalenRecall uses
- Test with a small file before importing large datasets

---

## Support

If you encounter issues or need help adapting your conversion script, please refer to the CalenRecall documentation or support resources.

