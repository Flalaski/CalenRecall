#!/usr/bin/env node

/**
 * Generate a boundary-testing profile for CalenRecall database
 * 
 * This script creates a JSON import file that pushes the boundaries of what
 * the database can contain, testing:
 * - Extreme date ranges (negative years, far future)
 * - Maximum text lengths (titles, content)
 * - Maximum array sizes (tags, linked entries)
 * - All time ranges (decade, year, month, week, day)
 * - Edge cases for time fields (0, 23, 59, null)
 * - Unicode and special characters
 * - Empty/null values
 * - Multiple entries per date/timeRange combination
 * - Maximum entry counts
 */

const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_FILE = path.join(__dirname, '..', 'boundary-test-profile.json');
const MAX_ENTRIES = 10000; // Total entries to generate
const ENTRIES_PER_DATE = 100; // Multiple entries per date/timeRange combo

// Helper functions
function formatDate(year, month, day) {
  const isNegative = year < 0;
  const yearStr = isNegative 
    ? `-${String(Math.abs(year)).padStart(4, '0')}` 
    : String(year).padStart(4, '0');
  return `${yearStr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function generateLargeText(size, prefix = '') {
  // Generate text of approximately 'size' characters
  const base = `${prefix} `.repeat(Math.floor(size / (prefix.length + 1)));
  return base.substring(0, size);
}

function generateUnicodeText(length) {
  // Generate text with various Unicode characters
  const unicodeChars = [
    'α', 'β', 'γ', 'δ', 'ε', // Greek
    '一', '二', '三', '四', '五', // Chinese
    'あ', 'い', 'う', 'え', 'お', // Japanese Hiragana
    'А', 'Б', 'В', 'Г', 'Д', // Cyrillic
    '→', '←', '↑', '↓', '↔', // Arrows
    '✓', '✗', '★', '☆', '♠', // Symbols
    '💀', '🔥', '⚡', '🌟', '🎉', // Emoji
    'ñ', 'é', 'ü', 'ø', 'ä', // Accented
    '🚀', '🎨', '📝', '🎯', '⚙️', // More emoji
  ];
  
  let text = '';
  for (let i = 0; i < length; i++) {
    text += unicodeChars[i % unicodeChars.length];
  }
  return text;
}

function generateTimestamp(year, month, day, hour = 12, minute = 0, second = 0) {
  const date = new Date(year, month - 1, day, hour, minute, second);
  return date.toISOString();
}

// Generate boundary test entries
const entries = [];
let entryIdCounter = 1;

// ============================================
// 1. EXTREME DATE RANGES
// ============================================
console.log('Generating extreme date range entries...');

// Minimum year: -9999
entries.push({
  date: formatDate(-9999, 1, 1),
  timeRange: 'year',
  title: 'Minimum Year Boundary Test (-9999)',
  content: 'Testing the minimum supported year. This entry tests database handling of extreme negative years.',
  tags: ['boundary', 'date', 'min-year'],
  createdAt: generateTimestamp(2024, 1, 1),
  updatedAt: generateTimestamp(2024, 1, 1),
});

// Maximum year: 9999
entries.push({
  date: formatDate(9999, 12, 31),
  timeRange: 'year',
  title: 'Maximum Year Boundary Test (9999)',
  content: 'Testing the maximum supported year. This entry tests database handling of extreme future years.',
  tags: ['boundary', 'date', 'max-year'],
  createdAt: generateTimestamp(2024, 1, 1),
  updatedAt: generateTimestamp(2024, 1, 1),
});

// Year 0 (boundary between BC and AD)
entries.push({
  date: formatDate(0, 6, 15),
  timeRange: 'year',
  title: 'Year Zero Boundary Test',
  content: 'Testing year 0, the boundary between BC and AD dates.',
  tags: ['boundary', 'date', 'year-zero'],
  createdAt: generateTimestamp(2024, 1, 1),
  updatedAt: generateTimestamp(2024, 1, 1),
});

// Year -1 (last year BC)
entries.push({
  date: formatDate(-1, 12, 31),
  timeRange: 'year',
  title: 'Last Year BC (-1)',
  content: 'Testing the last year before year 0.',
  tags: ['boundary', 'date', 'bc'],
  createdAt: generateTimestamp(2024, 1, 1),
  updatedAt: generateTimestamp(2024, 1, 1),
});

// Year 1 (first year AD)
entries.push({
  date: formatDate(1, 1, 1),
  timeRange: 'year',
  title: 'First Year AD (1)',
  content: 'Testing the first year after year 0.',
  tags: ['boundary', 'date', 'ad'],
  createdAt: generateTimestamp(2024, 1, 1),
  updatedAt: generateTimestamp(2024, 1, 1),
});

// ============================================
// 2. ALL TIME RANGES
// ============================================
console.log('Generating all time range entries...');

const testDate = formatDate(2024, 6, 15);
const timeRanges = ['decade', 'year', 'month', 'week', 'day'];

timeRanges.forEach((range, index) => {
  entries.push({
    date: testDate,
    timeRange: range,
    title: `Time Range Test: ${range}`,
    content: `Testing time range "${range}". This entry verifies that all time ranges work correctly.`,
    tags: ['boundary', 'time-range', range],
    createdAt: generateTimestamp(2024, 6, 15 + index, 10, index * 10),
    updatedAt: generateTimestamp(2024, 6, 15 + index, 10, index * 10),
  });
});

// ============================================
// 3. TIME FIELD EDGE CASES
// ============================================
console.log('Generating time field edge cases...');

const timeTestDate = formatDate(2024, 6, 15);

// Hour edge cases
entries.push({
  date: timeTestDate,
  timeRange: 'day',
  hour: 0,
  minute: 0,
  second: 0,
  title: 'Time: 00:00:00 (Midnight)',
  content: 'Testing minimum time values: hour=0, minute=0, second=0.',
  tags: ['boundary', 'time', 'min'],
  createdAt: generateTimestamp(2024, 6, 15, 0, 0, 0),
  updatedAt: generateTimestamp(2024, 6, 15, 0, 0, 0),
});

entries.push({
  date: timeTestDate,
  timeRange: 'day',
  hour: 23,
  minute: 59,
  second: 59,
  title: 'Time: 23:59:59 (Last Second)',
  content: 'Testing maximum time values: hour=23, minute=59, second=59.',
  tags: ['boundary', 'time', 'max'],
  createdAt: generateTimestamp(2024, 6, 15, 23, 59, 59),
  updatedAt: generateTimestamp(2024, 6, 15, 23, 59, 59),
});

entries.push({
  date: timeTestDate,
  timeRange: 'day',
  hour: null,
  minute: null,
  second: null,
  title: 'Time: null (No Time)',
  content: 'Testing null time values: all time fields are null.',
  tags: ['boundary', 'time', 'null'],
  createdAt: generateTimestamp(2024, 6, 15, 12, 0, 0),
  updatedAt: generateTimestamp(2024, 6, 15, 12, 0, 0),
});

entries.push({
  date: timeTestDate,
  timeRange: 'day',
  hour: 12,
  minute: null,
  second: null,
  title: 'Time: Hour Only (12:null:null)',
  content: 'Testing hour-only time: hour=12, minute and second are null.',
  tags: ['boundary', 'time', 'partial'],
  createdAt: generateTimestamp(2024, 6, 15, 12, 0, 0),
  updatedAt: generateTimestamp(2024, 6, 15, 12, 0, 0),
});

entries.push({
  date: timeTestDate,
  timeRange: 'day',
  hour: 12,
  minute: 30,
  second: null,
  title: 'Time: Hour and Minute (12:30:null)',
  content: 'Testing hour and minute: hour=12, minute=30, second is null.',
  tags: ['boundary', 'time', 'partial'],
  createdAt: generateTimestamp(2024, 6, 15, 12, 30, 0),
  updatedAt: generateTimestamp(2024, 6, 15, 12, 30, 0),
});

// ============================================
// 4. TEXT LENGTH BOUNDARIES
// ============================================
console.log('Generating text length boundary tests...');

// Maximum title length (SQLite TEXT can be very large, but we'll test practical limits)
const maxTitleLength = 10000;
entries.push({
  date: formatDate(2024, 6, 15),
  timeRange: 'day',
  title: generateLargeText(maxTitleLength, 'TITLE'),
  content: 'Testing maximum title length.',
  tags: ['boundary', 'text', 'title', 'max-length'],
  createdAt: generateTimestamp(2024, 6, 15),
  updatedAt: generateTimestamp(2024, 6, 15),
});

// Maximum content length (1MB of text)
const maxContentLength = 1024 * 1024; // 1MB
entries.push({
  date: formatDate(2024, 6, 15),
  timeRange: 'day',
  title: 'Maximum Content Length Test (1MB)',
  content: generateLargeText(maxContentLength, 'CONTENT'),
  tags: ['boundary', 'text', 'content', 'max-length'],
  createdAt: generateTimestamp(2024, 6, 15),
  updatedAt: generateTimestamp(2024, 6, 15),
});

// Empty title
entries.push({
  date: formatDate(2024, 6, 15),
  timeRange: 'day',
  title: '',
  content: 'Testing empty title field.',
  tags: ['boundary', 'text', 'title', 'empty'],
  createdAt: generateTimestamp(2024, 6, 15),
  updatedAt: generateTimestamp(2024, 6, 15),
});

// Empty content
entries.push({
  date: formatDate(2024, 6, 15),
  timeRange: 'day',
  title: 'Empty Content Test',
  content: '',
  tags: ['boundary', 'text', 'content', 'empty'],
  createdAt: generateTimestamp(2024, 6, 15),
  updatedAt: generateTimestamp(2024, 6, 15),
});

// ============================================
// 5. UNICODE AND SPECIAL CHARACTERS
// ============================================
console.log('Generating Unicode and special character tests...');

entries.push({
  date: formatDate(2024, 6, 15),
  timeRange: 'day',
  title: generateUnicodeText(200),
  content: generateUnicodeText(5000),
  tags: ['boundary', 'unicode', 'special-chars'],
  createdAt: generateTimestamp(2024, 6, 15),
  updatedAt: generateTimestamp(2024, 6, 15),
});

// SQL injection attempt (should be safely escaped)
entries.push({
  date: formatDate(2024, 6, 15),
  timeRange: 'day',
  title: "SQL Injection Test: '; DROP TABLE journal_entries; --",
  content: "Testing SQL injection safety: '; DROP TABLE journal_entries; --",
  tags: ['boundary', 'security', 'sql-injection'],
  createdAt: generateTimestamp(2024, 6, 15),
  updatedAt: generateTimestamp(2024, 6, 15),
});

// XSS attempt (should be handled safely)
entries.push({
  date: formatDate(2024, 6, 15),
  timeRange: 'day',
  title: 'XSS Test: <script>alert("XSS")</script>',
  content: '<script>alert("XSS")</script><img src=x onerror=alert(1)>',
  tags: ['boundary', 'security', 'xss'],
  createdAt: generateTimestamp(2024, 6, 15),
  updatedAt: generateTimestamp(2024, 6, 15),
});

// ============================================
// 6. TAGS ARRAY BOUNDARIES
// ============================================
console.log('Generating tags array boundary tests...');

// Maximum tags (1000 tags)
const maxTags = Array.from({ length: 1000 }, (_, i) => `tag-${i + 1}`);
entries.push({
  date: formatDate(2024, 6, 15),
  timeRange: 'day',
  title: 'Maximum Tags Test (1000 tags)',
  content: 'Testing maximum number of tags.',
  tags: maxTags,
  createdAt: generateTimestamp(2024, 6, 15),
  updatedAt: generateTimestamp(2024, 6, 15),
});

// Empty tags
entries.push({
  date: formatDate(2024, 6, 15),
  timeRange: 'day',
  title: 'Empty Tags Array Test',
  content: 'Testing empty tags array.',
  tags: [],
  createdAt: generateTimestamp(2024, 6, 15),
  updatedAt: generateTimestamp(2024, 6, 15),
});

// Tags with special characters
entries.push({
  date: formatDate(2024, 6, 15),
  timeRange: 'day',
  title: 'Tags with Special Characters',
  content: 'Testing tags with special characters and Unicode.',
  tags: [
    'tag-with-dashes',
    'tag_with_underscores',
    'tag.with.dots',
    'tag with spaces',
    'tag"with"quotes',
    'tag\'with\'apostrophes',
    'tag-with-émojis-🚀-🎨',
    'tag-with-unicode-一-二-三',
    'tag-with-very-long-name-that-might-cause-issues-if-there-is-a-length-limit',
  ],
  createdAt: generateTimestamp(2024, 6, 15),
  updatedAt: generateTimestamp(2024, 6, 15),
});

// ============================================
// 7. MULTIPLE ENTRIES PER DATE/TIMERANGE
// ============================================
console.log('Generating multiple entries per date/timeRange...');

const multiEntryDate = formatDate(2024, 6, 15);
for (let i = 0; i < ENTRIES_PER_DATE; i++) {
  entries.push({
    date: multiEntryDate,
    timeRange: 'day',
    title: `Multiple Entry Test #${i + 1}`,
    content: `This is entry ${i + 1} of ${ENTRIES_PER_DATE} entries for the same date and timeRange combination. Testing database handling of multiple entries per date/timeRange.`,
    tags: ['boundary', 'multiple-entries', `entry-${i + 1}`],
    hour: i % 24,
    minute: (i * 2) % 60,
    second: (i * 3) % 60,
    createdAt: generateTimestamp(2024, 6, 15, i % 24, (i * 2) % 60, (i * 3) % 60),
    updatedAt: generateTimestamp(2024, 6, 15, i % 24, (i * 2) % 60, (i * 3) % 60),
  });
}

// ============================================
// 8. ARCHIVED AND PINNED COMBINATIONS
// ============================================
console.log('Generating archived and pinned combinations...');

const statusDate = formatDate(2024, 6, 15);
entries.push({
  date: statusDate,
  timeRange: 'day',
  title: 'Archived Entry',
  content: 'Testing archived entry.',
  tags: ['boundary', 'status', 'archived'],
  archived: true,
  pinned: false,
  createdAt: generateTimestamp(2024, 6, 15),
  updatedAt: generateTimestamp(2024, 6, 15),
});

entries.push({
  date: statusDate,
  timeRange: 'day',
  title: 'Pinned Entry',
  content: 'Testing pinned entry.',
  tags: ['boundary', 'status', 'pinned'],
  archived: false,
  pinned: true,
  createdAt: generateTimestamp(2024, 6, 15),
  updatedAt: generateTimestamp(2024, 6, 15),
});

entries.push({
  date: statusDate,
  timeRange: 'day',
  title: 'Archived and Pinned Entry',
  content: 'Testing entry that is both archived and pinned.',
  tags: ['boundary', 'status', 'archived', 'pinned'],
  archived: true,
  pinned: true,
  createdAt: generateTimestamp(2024, 6, 15),
  updatedAt: generateTimestamp(2024, 6, 15),
});

// ============================================
// 9. TIMESTAMP BOUNDARIES
// ============================================
console.log('Generating timestamp boundary tests...');

entries.push({
  date: formatDate(2024, 6, 15),
  timeRange: 'day',
  title: 'Minimum Timestamp Test',
  content: 'Testing minimum timestamp (year 1970, epoch start).',
  tags: ['boundary', 'timestamp', 'min'],
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
});

entries.push({
  date: formatDate(2024, 6, 15),
  timeRange: 'day',
  title: 'Maximum Timestamp Test',
  content: 'Testing maximum timestamp (year 9999).',
  tags: ['boundary', 'timestamp', 'max'],
  createdAt: '9999-12-31T23:59:59.999Z',
  updatedAt: '9999-12-31T23:59:59.999Z',
});

// ============================================
// 10. BULK ENTRIES FOR STRESS TESTING
// ============================================
console.log('Generating bulk entries for stress testing...');

const remainingEntries = MAX_ENTRIES - entries.length;
console.log(`Generating ${remainingEntries} additional bulk entries...`);

const startYear = 2020;
const endYear = 2024;
let bulkCount = 0;

for (let year = startYear; year <= endYear && bulkCount < remainingEntries; year++) {
  for (let month = 1; month <= 12 && bulkCount < remainingEntries; month++) {
    for (let day = 1; day <= 28 && bulkCount < remainingEntries; day++) {
      // Generate multiple entries per day
      const entriesPerDay = Math.min(5, Math.floor((remainingEntries - bulkCount) / 100) + 1);
      for (let e = 0; e < entriesPerDay && bulkCount < remainingEntries; e++) {
        const hour = (bulkCount * 7) % 24;
        const minute = (bulkCount * 13) % 60;
        
        entries.push({
          date: formatDate(year, month, day),
          timeRange: 'day',
          title: `Bulk Entry ${bulkCount + 1}: ${year}-${month}-${day}`,
          content: `This is bulk entry #${bulkCount + 1} generated for stress testing. Year: ${year}, Month: ${month}, Day: ${day}, Hour: ${hour}, Minute: ${minute}.`,
          tags: [
            'bulk',
            `year-${year}`,
            `month-${month}`,
            `day-${day}`,
            `entry-${bulkCount + 1}`,
          ],
          hour: hour,
          minute: minute,
          second: (bulkCount * 17) % 60,
          archived: bulkCount % 10 === 0,
          pinned: bulkCount % 20 === 0,
          createdAt: generateTimestamp(year, month, day, hour, minute, (bulkCount * 17) % 60),
          updatedAt: generateTimestamp(year, month, day, hour, minute, (bulkCount * 17) % 60),
        });
        
        bulkCount++;
        
        if (bulkCount % 1000 === 0) {
          console.log(`  Generated ${bulkCount} bulk entries...`);
        }
      }
    }
  }
}

// ============================================
// 11. DECADE ENTRIES
// ============================================
console.log('Generating decade entries...');

for (let decade = 2020; decade <= 2030; decade += 10) {
  entries.push({
    date: formatDate(decade, 1, 1),
    timeRange: 'decade',
    title: `${decade}s Decade Entry`,
    content: `Summary entry for the ${decade}s decade.`,
    tags: ['boundary', 'time-range', 'decade', `decade-${decade}`],
    createdAt: generateTimestamp(decade, 1, 1),
    updatedAt: generateTimestamp(decade, 1, 1),
  });
}

// ============================================
// 12. YEAR ENTRIES
// ============================================
console.log('Generating year entries...');

for (let year = 2020; year <= 2024; year++) {
  entries.push({
    date: formatDate(year, 1, 1),
    timeRange: 'year',
    title: `${year} Year Summary`,
    content: `Annual summary entry for the year ${year}.`,
    tags: ['boundary', 'time-range', 'year', `year-${year}`],
    createdAt: generateTimestamp(year, 12, 31),
    updatedAt: generateTimestamp(year, 12, 31),
  });
}

// ============================================
// 13. MONTH ENTRIES
// ============================================
console.log('Generating month entries...');

for (let year = 2024; year <= 2024; year++) {
  for (let month = 1; month <= 12; month++) {
    entries.push({
      date: formatDate(year, month, 1),
      timeRange: 'month',
      title: `${year}-${String(month).padStart(2, '0')} Month Summary`,
      content: `Monthly summary for ${year}-${String(month).padStart(2, '0')}.`,
      tags: ['boundary', 'time-range', 'month', `year-${year}`, `month-${month}`],
      createdAt: generateTimestamp(year, month, 15),
      updatedAt: generateTimestamp(year, month, 15),
    });
  }
}

// ============================================
// WRITE OUTPUT
// ============================================
console.log(`\nTotal entries generated: ${entries.length}`);
console.log(`Writing to: ${OUTPUT_FILE}`);

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(entries, null, 2), 'utf-8');

const fileSize = fs.statSync(OUTPUT_FILE).size;
console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`\n✅ Boundary test profile generated successfully!`);
console.log(`\nTo import this profile:`);
console.log(`1. Open CalenRecall`);
console.log(`2. Create a new profile named "Boundary Test" (or select an existing test profile)`);
console.log(`3. Go to File → Import → JSON`);
console.log(`4. Select: ${OUTPUT_FILE}`);
console.log(`\n⚠️  WARNING: This profile contains ${entries.length} entries and may take a while to import!`);

