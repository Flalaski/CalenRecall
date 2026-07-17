/**
 * Type definitions for database rows and internal database structures.
 * These types represent the raw database schema before conversion to application types.
 */

/**
 * Raw database row for journal_entries table
 */
export interface JournalEntryRow {
  id: number;
  date: string;
  jdn: number | null;
  time_range: string;
  hour: number | null;
  minute: number | null;
  second: number | null;
  title: string;
  content: string;
  tags: string | null; // JSON string
  linked_entries: string | null; // JSON string
  archived: number; // 0 or 1 (SQLite boolean)
  pinned: number; // 0 or 1 (SQLite boolean)
  attachments: string | null; // JSON string
  created_at: string;
  updated_at: string;
}

/**
 * Raw database row for entry_versions table
 */
export interface EntryVersionRow {
  id: number;
  entry_id: number;
  date: string;
  time_range: string;
  title: string;
  content: string;
  tags: string | null; // JSON string
  linked_entries: string | null; // JSON string
  created_at: string;
  version_created_at: string;
}

/**
 * Raw database row for preferences table
 */
export interface PreferenceRow {
  key: string;
  value: string; // JSON string
}

/**
 * Raw database row for entry_templates table
 */
export interface EntryTemplateRow {
  id: number;
  name: string;
  title: string | null;
  content: string;
  tags: string | null; // JSON string
  time_range: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * SQLite PRAGMA table_info result
 */
export interface TableInfoRow {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}

/**
 * SQLite PRAGMA result for synchronous
 */
export interface SynchronousPragma {
  synchronous: number;
}

/**
 * SQLite PRAGMA result for journal_mode
 */
export interface JournalModePragma {
  journal_mode: string;
}

/**
 * SQLite master table row (for checking table/index existence)
 */
export interface SqliteMasterRow {
  type: string;
  name: string;
  tbl_name: string;
  rootpage: number;
  sql: string | null;
}

/**
 * Time fields extracted from a database row
 */
export interface TimeFields {
  hour: number | null;
  minute: number;
  second: number;
}

export interface CalendarAccountRow {
  id: number;
  provider: string;
  account_identifier: string;
  display_name: string | null;
  encrypted_refresh_token: string | null;
  encrypted_access_token: string | null;
  access_token_expires_at: string | null;
  scope: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  last_sync_at: string | null;
  last_error: string | null;
}

export interface RemoteCalendarRow {
  id: number;
  account_id: number;
  provider_calendar_id: string;
  name: string;
  color: string | null;
  is_primary: number;
  is_selected: number;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export interface RemoteEventRow {
  id: number;
  calendar_id: number;
  provider_event_id: string;
  provider_etag: string | null;
  status: string | null;
  title: string | null;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  is_all_day: number;
  timezone: string | null;
  recurrence_rule: string | null;
  recurrence_instance_id: string | null;
  raw_payload: string | null;
  updated_remote_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarSyncStateRow {
  id: number;
  account_id: number;
  calendar_id: number | null;
  sync_token: string | null;
  page_token: string | null;
  last_full_sync_at: string | null;
  last_incremental_sync_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

