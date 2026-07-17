# Online Calendar Sync Implementation Plan (Google + Other Providers)

## 1) Goal
Add secure, profile-scoped synchronization with Google Calendar and other online calendars using the user's default browser for authentication.

Initial target:
- Google Calendar (OAuth2 + PKCE), read-only sync first
- ICS subscriptions (read-only) as a fast "other online calendars" option

Follow-up:
- Microsoft Graph calendars
- CalDAV providers (iCloud, Fastmail, Nextcloud, etc.)
- Optional bidirectional sync

## 2) Current Architecture Fit (CalenRecall)
Existing strengths:
- Electron main/renderer split with secure preload bridge
- Profile-isolated SQLite databases
- Existing IPC style for feature expansion
- External browser launch already implemented

Current gap:
- No OAuth callback receiver yet (no deep link / open-url flow)
- Journal entries are not event-sync entities

Design decision:
- Keep remote events in separate sync tables
- Optionally link/import selected remote events to journal entries

## 3) Security Model
- Keep all auth/token operations in Electron main process only.
- Use Authorization Code + PKCE for OAuth providers.
- Store refresh/access tokens encrypted at rest.
- Keep provider secrets (if any) out of renderer.
- Use least-privilege scopes for initial release.

Recommended for token protection:
- Start with encrypted token blobs stored in SQLite.
- Use an OS-bound encryption key where possible.

## 4) Authentication Flow (Browser-Based)

### Preferred v1 flow: Loopback localhost callback
1. Renderer calls startCalendarAuth(provider).
2. Main creates OAuth state + PKCE verifier/challenge.
3. Main starts temporary localhost callback listener (for example, 127.0.0.1:any-free-port).
4. Main opens provider authorization URL in default browser.
5. Provider redirects to localhost callback with code + state.
6. Main validates state, exchanges code for tokens, stores encrypted token.
7. Main emits auth-success IPC event with account/calendar summary.

Why first:
- Fast to implement
- Works cross-platform
- Avoids initial protocol-registration complexity

### v2 flow: Custom app protocol deep link (optional)
- Register app scheme (for example, calenrecall://oauth/callback)
- Handle app.on('open-url') and second-instance URL forwarding

## 5) Data Model (New Tables)
Add these in createTables and migrate via feature checks.

### 5.1 calendar_accounts
Stores connected provider account credentials and metadata.

Columns:
- id INTEGER PRIMARY KEY AUTOINCREMENT
- provider TEXT NOT NULL  -- google | microsoft | caldav | ics
- account_identifier TEXT NOT NULL  -- email/user id/url
- display_name TEXT
- encrypted_refresh_token TEXT
- encrypted_access_token TEXT
- access_token_expires_at TEXT
- scope TEXT
- status TEXT NOT NULL DEFAULT 'active'  -- active | error | disconnected
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL
- last_sync_at TEXT
- last_error TEXT

Indexes:
- idx_calendar_accounts_provider(provider)
- idx_calendar_accounts_identifier(account_identifier)

### 5.2 remote_calendars
Provider calendars selected by user for sync.

Columns:
- id INTEGER PRIMARY KEY AUTOINCREMENT
- account_id INTEGER NOT NULL
- provider_calendar_id TEXT NOT NULL
- name TEXT NOT NULL
- color TEXT
- is_primary INTEGER NOT NULL DEFAULT 0
- is_selected INTEGER NOT NULL DEFAULT 1
- timezone TEXT
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

Constraints:
- UNIQUE(account_id, provider_calendar_id)

Indexes:
- idx_remote_calendars_account(account_id)

### 5.3 remote_events
Normalized event records from providers.

Columns:
- id INTEGER PRIMARY KEY AUTOINCREMENT
- calendar_id INTEGER NOT NULL
- provider_event_id TEXT NOT NULL
- provider_etag TEXT
- status TEXT  -- confirmed | tentative | cancelled
- title TEXT
- description TEXT
- location TEXT
- start_at TEXT NOT NULL  -- ISO UTC or provider canonical
- end_at TEXT NOT NULL
- is_all_day INTEGER NOT NULL DEFAULT 0
- timezone TEXT
- recurrence_rule TEXT  -- RRULE or provider recurrence payload
- recurrence_instance_id TEXT  -- for expanded instances/overrides
- raw_payload TEXT  -- JSON from provider for fidelity/debug
- updated_remote_at TEXT
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

Constraints:
- UNIQUE(calendar_id, provider_event_id, recurrence_instance_id)

Indexes:
- idx_remote_events_calendar(calendar_id)
- idx_remote_events_start(start_at)
- idx_remote_events_status(status)

### 5.4 sync_state
Per calendar/account cursor and timing metadata.

Columns:
- id INTEGER PRIMARY KEY AUTOINCREMENT
- account_id INTEGER NOT NULL
- calendar_id INTEGER
- sync_token TEXT
- page_token TEXT
- last_full_sync_at TEXT
- last_incremental_sync_at TEXT
- last_success_at TEXT
- last_error TEXT
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

Indexes:
- idx_sync_state_account(account_id)
- idx_sync_state_calendar(calendar_id)

### 5.5 journal_remote_links (optional)
Maps journal entries to remote events if user imports/links them.

Columns:
- id INTEGER PRIMARY KEY AUTOINCREMENT
- journal_entry_id INTEGER NOT NULL
- remote_event_id INTEGER NOT NULL
- link_type TEXT NOT NULL DEFAULT 'reference' -- reference | imported-copy
- created_at TEXT NOT NULL

Constraints:
- UNIQUE(journal_entry_id, remote_event_id)

## 6) IPC Contract (Main <-> Renderer)
Add in preload + ipc-handlers.

Auth/account:
- start-calendar-auth(provider: 'google' | 'microsoft'): Promise<{ success, accountId?, error? }>
- complete-calendar-auth(payload): Promise<...>  (if needed by callback mode)
- list-calendar-accounts(): Promise<CalendarAccount[]>
- disconnect-calendar-account(accountId): Promise<{ success }>

Calendar selection:
- list-remote-calendars(accountId): Promise<RemoteCalendar[]>
- set-remote-calendar-selected(calendarId, selected): Promise<{ success }>

Sync control:
- run-calendar-sync(accountId?, options?): Promise<{ success, imported, updated, removed, errors? }>
- get-calendar-sync-status(accountId?): Promise<...>
- on-calendar-sync-progress(callback)

Read models:
- get-remote-events(startIso, endIso, filters?): Promise<RemoteEvent[]>
- link-journal-entry-to-remote-event(entryId, remoteEventId, linkType?): Promise<{ success }>

## 7) Provider Adapter Design
Create a provider abstraction in main process.

Interface shape:
- buildAuthUrl()
- exchangeCodeForToken()
- refreshAccessToken()
- listCalendars()
- syncEvents(calendar, cursor)
- normalizeEvent(providerPayload)

Implementations:
- google-provider.ts (first)
- ics-provider.ts (read-only pull parser)
- microsoft-provider.ts (later)
- caldav-provider.ts (later)

Normalization contract:
- Preserve provider payload in raw_payload for fidelity and future features.
- Normalize into remote_events fields for UI/filtering.

## 8) Sync Strategy

### v1: Read-only pull sync
- Initial full sync per selected calendar.
- Store provider sync token/cursor.
- Incremental sync on schedule + manual trigger.
- Handle deletes/cancelled events by marking status.

### Scheduling
- Preference-driven interval (for example 5/15/30 min)
- Trigger on app startup and profile switch (debounced)
- Manual "Sync now" button

### Conflict strategy
- v1 read-only: no outgoing conflicts.
- v2 bidirectional: use etag/version checks and explicit conflict resolution UI.

## 9) UI/UX Additions
Preferences -> new "Online Calendars" section:
- Connect Google account button
- Connected accounts list with status + last sync
- Calendar picker per account (checkbox selection)
- Sync frequency + "Sync now"
- Disconnect account

Calendar views:
- Overlay remote events in day/week/month where applicable
- Distinguish remote events visually from journal entries
- Optional quick action: "Import as journal entry"

## 10) Migration Plan (Codebase Style)
Your database uses feature-detection migration checks.

Implementation pattern:
1. Add CREATE TABLE IF NOT EXISTS statements in createTables.
2. In migrateDatabase, check table existence and create missing tables.
3. For new columns later, check with PRAGMA table_info and ALTER TABLE as needed.
4. Add indexes with CREATE INDEX IF NOT EXISTS.

Do not rely on a single integer migration version unless you refactor migration system globally.

## 11) Suggested File-Level Changes

Main process:
- electron/database.ts
  - Add table creation + CRUD helpers for account/calendar/event/sync tables
- electron/ipc-handlers.ts
  - Add auth/account/calendar/sync IPC endpoints
- electron/preload.ts
  - Expose new electronAPI methods
- electron/main.ts
  - Add callback handling bootstrap (localhost listener manager and optional deep link scaffolding)
- electron/types.ts
  - Add sync-related interfaces (CalendarAccount, RemoteCalendar, RemoteEvent, SyncStatus)
- electron/utils/
  - Add token encryption utility
- electron/providers/
  - Add provider adapter files

Renderer:
- src/preferences.tsx
  - Add Online Calendars section
- src/types.ts
  - Mirror sync interfaces if needed
- src/App.tsx and relevant calendar components
  - Render remote event overlays

## 12) Google-Specific Notes
- Use Google Calendar API incremental sync token support.
- Start with read-only scope for easier verification path.
- Handle token refresh in main process automatically.
- Handle invalid_grant by marking account status and prompting re-auth.

## 13) Testing Plan

Unit tests:
- Event normalization (Google payload -> remote_events)
- Cursor/sync token update logic
- Token refresh and error classification

Integration tests:
- Auth start/callback success path (mock provider endpoints)
- Initial sync + incremental sync with updates/deletes
- Profile switch isolation checks

Manual QA:
- Connect/disconnect account
- Select calendars
- Sync now and scheduled sync
- App restart persistence
- Offline behavior and recovery

## 14) Implementation Phases

Phase 1 (MVP, ~1-2 PRs):
- New sync tables
- Google auth via browser + localhost callback
- Read-only calendar/event sync
- Preferences UI for connect/select/sync-now

Phase 2:
- ICS subscription support (URL-based)
- Remote event overlay in calendar views

Phase 3:
- Microsoft Graph adapter
- Better error diagnostics and account health UI

Phase 4:
- CalDAV adapter
- Optional bidirectional sync with conflict UI

## 15) Risks and Mitigations
- OAuth callback complexity on desktop:
  - Mitigation: localhost callback first, deep-link second.
- Calendar fidelity (recurrence/timezones/all-day):
  - Mitigation: keep raw_payload, robust normalization tests.
- Token security:
  - Mitigation: main-process-only handling and encrypted storage.
- Rate limits/API failures:
  - Mitigation: exponential backoff + retry windows + user-visible status.

## 16) Immediate Next Step (Recommended)
Implement Phase 1 in this sequence:
1. Add sync tables + DB helpers.
2. Add provider abstraction + Google adapter skeleton.
3. Add start-calendar-auth and callback handling in main + IPC.
4. Add preload bridge + Preferences UI controls.
5. Add manual sync trigger and event read endpoint.
6. Add minimal tests for normalization and migration.
