export interface JournalEntry {
  id?: number;
  date: string; // ISO date string (YYYY-MM-DD) - canonical date for the time range
  timeRange: 'decade' | 'year' | 'month' | 'week' | 'day'; // Time scale for this entry
  hour?: number | null; // Optional hour (0-23), null when cleared
  minute?: number | null; // Optional minute (0-59), null when cleared
  second?: number | null; // Optional second (0-59), null when cleared
  title: string;
  content: string;
  createdAt: string; // ISO datetime string
  updatedAt: string; // ISO datetime string
  tags?: string[];
  linkedEntries?: number[]; // Array of entry IDs this entry is linked to
  archived?: boolean; // Whether this entry is archived
  pinned?: boolean; // Whether this entry is pinned/favorited
  attachments?: EntryAttachment[]; // Array of file attachments
}

export interface EntryAttachment {
  id: string; // Unique identifier for the attachment
  fileName: string; // Original file name
  filePath: string; // Path where file is stored
  fileSize: number; // File size in bytes
  mimeType: string; // MIME type of the file
  createdAt: string; // When attachment was added
}

export type TimeRange = 'decade' | 'year' | 'month' | 'week' | 'day';

// Supported export formats for storybook export
export type ExportFormat = 'markdown' | 'text' | 'json' | 'rtf' | 'pdf' | 'dec' | 'csv';

export interface ExportMetadata {
  // Project/Export Identity
  projectTitle?: string;
  exportName?: string;
  
  // Identity
  author?: string;
  organization?: string;
  department?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  
  // Context
  description?: string;
  purpose?: string;
  exportPurpose?: 'personal' | 'academic' | 'professional' | 'publication' | 'backup' | 'archive' | 'research' | 'legal' | 'other';
  context?: string;
  background?: string;
  
  // Versioning
  version?: string;
  versionDate?: string;
  
  // Classification
  classification?: 'public' | 'internal' | 'confidential' | 'private' | 'restricted';
  keywords?: string[];
  subject?: string;
  
  // Legal/Copyright
  copyright?: string;
  license?: string;
  rights?: string;
  
  // Dates
  dateRangeStart?: string;
  dateRangeEnd?: string;
  exportDate?: string;
  
  // References
  relatedDocuments?: string;
  citation?: string;
  source?: string;
  
  // Notes
  notes?: string;
  instructions?: string;
  acknowledgments?: string;
  
  // Thematic Construct
  exportTheme?: string; // Theme name to use as a thematic construct for the export
}

export interface EntryVersion {
  id: number;
  entryId: number;
  date: string;
  timeRange: TimeRange;
  title: string;
  content: string;
  tags: string[];
  linkedEntries: number[];
  createdAt: string;
  versionCreatedAt: string;
}

