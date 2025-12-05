# Component Classes Reference

This document lists all CSS class names that need to be styled in your theme file to ensure comprehensive coverage.

## Core Application

- `.app` - Main application container
- `.app-content` - Application content area
- `.timeline-section` - Timeline view section
- `.editor-section` - Editor/viewer section

## Navigation Bar

- `.navigation-bar` - Navigation bar container
- `.navigation-bar-top-row` - Top row of navigation
- `.nav-controls` - Navigation controls container
- `.nav-button` - Navigation buttons
- `.today-button` - Today button
- `.date-label` - Date display label
- `.view-mode-selector` - View mode selector container
- `.view-mode-button` - View mode buttons (DECADE, YEAR, MONTH, etc.)
- `.view-mode-button.active` - Active view mode button
- `.calendar-selector` - Calendar system selector
- `.calendar-select` - Calendar select dropdown
- `.calendar-info-panel` - Calendar information panel
- `.calendar-definition-toggle` - Calendar definition toggle button
- `.calendar-definition-drawer` - Calendar definition drawer

## Calendar View

- `.calendar-loading` - Calendar loading state
- `.calendar-grid` - Calendar grid container
- `.calendar-cell` - Individual calendar cell
- `.calendar-cell.day-cell` - Day cell
- `.calendar-cell.year-cell` - Year cell
- `.calendar-cell.month-cell` - Month cell
- `.calendar-cell.empty-cell` - Empty cell
- `.calendar-cell.today` - Today's cell
- `.calendar-cell.selected` - Selected cell
- `.calendar-cell.has-entry` - Cell with entry
- `.cell-content` - Cell content wrapper
- `.cell-label` - Cell label text
- `.entry-indicator` - Entry indicator dot
- `.weekday-header` - Weekday header row
- `.weekday-cell` - Individual weekday cell
- `.day-number` - Day number display
- `.day-name` - Day name display
- `.day-month` - Month display in day cell

## Timeline View

- `.timeline-loading` - Timeline loading state
- `.timeline-month-view` - Month timeline view
- `.timeline-week-view` - Week timeline view
- `.month-view-content` - Month view content
- `.month-calendar-section` - Calendar section in month view
- `.month-week-entries-section` - Week entries section
- `.timeline-grid` - Timeline grid
- `.timeline-cell` - Timeline cell
- `.timeline-cell.today` - Today's timeline cell
- `.week-entries-header` - Week entries header
- `.week-entries-list` - Week entries list
- `.week-entry-group` - Week entry group container
- `.week-entry-group-header` - Week entry group header
- `.week-label` - Week label
- `.week-entry-count` - Week entry count badge
- `.week-entry-items` - Week entry items container
- `.week-entry-item` - Individual week entry item
- `.week-entry-title` - Week entry title
- `.week-entry-empty` - Empty week entry message

## Entry Viewer

- `.entry-viewer` - Entry viewer container
- `.viewer-header` - Viewer header
- `.header-top` - Header top section
- `.viewer-header h3` - Viewer header title
- `.header-actions` - Header action buttons
- `.edit-button` - Edit button
- `.duplicate-button` - Duplicate button
- `.new-entry-button-header` - New entry button in header
- `.entry-meta` - Entry metadata
- `.time-range-badge-viewer` - Time range badge
- `.entry-date-display` - Entry date display
- `.viewer-content` - Viewer content area
- `.viewer-title` - Viewer entry title
- `.viewer-text` - Viewer entry text
- `.viewer-tags` - Viewer tags container
- `.viewer-tag` - Individual viewer tag
- `.viewer-linked-entries` - Linked entries section
- `.linked-entries-list` - Linked entries list
- `.linked-entry-item` - Individual linked entry item
- `.linked-entry-title` - Linked entry title
- `.linked-entry-meta` - Linked entry metadata
- `.linked-entry-date` - Linked entry date
- `.linked-entry-time-range` - Linked entry time range badge
- `.viewer-empty` - Empty viewer state
- `.viewer-loading` - Viewer loading state
- `.period-entries-controls` - Period entries controls
- `.period-entries-filter` - Period entries filter
- `.period-entries-sort` - Period entries sort
- `.period-entries-tags` - Period filter tags
- `.period-entry-filter-tag` - Period filter tag
- `.period-entry-filter-tag.active` - Active filter tag
- `.period-entry-clear-filters` - Clear filters button
- `.period-entries-list` - Period entries list
- `.period-entry-item` - Period entry item
- `.period-entry-header` - Period entry header
- `.period-entry-title-row` - Period entry title row
- `.period-entry-title` - Period entry title
- `.period-entry-actions` - Period entry actions
- `.period-entry-edit-button` - Period entry edit button
- `.period-entry-badge` - Period entry badge
- `.period-entry-meta` - Period entry metadata
- `.period-entry-date` - Period entry date
- `.period-entry-content` - Period entry content
- `.period-entry-content-wrapper` - Period entry content wrapper
- `.period-entry-tags` - Period entry tags
- `.period-entry-tag` - Period entry tag

## Journal Editor

- `.journal-editor-inline` - Journal editor container
- `.editor-loading` - Editor loading state
- `.editor-header` - Editor header
- `.editor-content` - Editor content area
- `.view-mode-message` - View mode message
- `.title-input` - Title input field
- `.content-input` - Content textarea
- `.tags-section` - Tags section
- `.tags-input-container` - Tags input container
- `.tag-input` - Tag input field
- `.add-tag-button` - Add tag button
- `.tags-list` - Tags list container
- `.tag` - Individual tag
- `.tag-remove` - Tag remove button
- `.editor-footer` - Editor footer
- `.footer-actions` - Footer actions
- `.cancel-button` - Cancel button
- `.delete-button` - Delete button
- `.save-button` - Save button
- `.save-button:disabled` - Disabled save button
- `.confirm-dialog-overlay` - Confirmation dialog overlay
- `.confirm-dialog` - Confirmation dialog
- `.confirm-dialog-buttons` - Confirmation dialog buttons

## Journal List

- `.journal-list` - Journal list container
- `.journal-list-loading` - Journal list loading state
- `.journal-list-header` - Journal list header
- `.journal-list-header-actions` - Header actions
- `.journal-list-content` - Journal list content
- `.journal-list-controls` - Journal list controls
- `.journal-list-filter` - Journal list filter
- `.journal-list-sort` - Journal list sort
- `.journal-list-tags` - Journal list filter tags
- `.journal-entry-filter-tag` - Journal filter tag
- `.journal-entry-filter-tag.active` - Active filter tag
- `.journal-entry-clear-filters` - Clear filters button
- `.journal-list-empty` - Empty journal list state
- `.journal-entries` - Journal entries container
- `.journal-entry-item` - Journal entry item
- `.journal-entry-item.selected` - Selected entry item
- `.journal-entry-item.bulk-edit-mode` - Bulk edit mode entry
- `.journal-entry-item.bulk-selected` - Bulk selected entry
- `.entry-item-header` - Entry item header
- `.entry-item-title` - Entry item title
- `.entry-item-meta` - Entry item metadata
- `.entry-time-range` - Entry time range badge
- `.entry-date` - Entry date
- `.entry-item-preview` - Entry item preview text
- `.entry-item-tags` - Entry item tags
- `.entry-tag` - Entry tag badge
- `.entry-item-content` - Entry item content wrapper
- `.entry-checkbox-wrapper` - Entry checkbox wrapper
- `.bulk-edit-actions` - Bulk edit actions bar
- `.bulk-edit-selected-count` - Bulk edit selected count
- `.bulk-delete-button` - Bulk delete button
- `.bulk-edit-select-all` - Bulk edit select all section
- `.bulk-edit-checkbox-label` - Bulk edit checkbox label

## Entry Edit Modal

- `.entry-edit-modal-overlay` - Modal overlay
- `.entry-edit-modal` - Modal container
- `.modal-header` - Modal header
- `.modal-header-top` - Modal header top section
- `.modal-header-top h3` - Modal title
- `.modal-close-button` - Modal close button
- `.modal-entry-meta` - Modal entry metadata
- `.modal-content` - Modal content area
- `.modal-title-input` - Modal title input
- `.modal-content-input` - Modal content textarea
- `.modal-tags-section` - Modal tags section
- `.modal-tags-input-container` - Modal tags input container
- `.modal-tag-input` - Modal tag input
- `.modal-add-tag-button` - Modal add tag button
- `.modal-tags-list` - Modal tags list
- `.modal-tag` - Modal tag
- `.modal-tag-remove` - Modal tag remove button
- `.modal-footer` - Modal footer
- `.modal-duplicate-button` - Modal duplicate button
- `.modal-delete-button` - Modal delete button
- `.modal-footer-actions` - Modal footer actions
- `.modal-cancel-button` - Modal cancel button
- `.modal-save-button` - Modal save button

## Search View

- `.search-view` - Search view container
- `.search-header` - Search header
- `.search-input-container` - Search input container
- `.search-input` - Search input field
- `.search-filters-toggle` - Search filters toggle button
- `.search-close-button` - Search close button
- `.search-filters` - Search filters section
- `.filter-group` - Filter group
- `.filter-group label` - Filter group label
- `.filter-tags` - Filter tags container
- `.filter-tag` - Filter tag
- `.filter-tag.active` - Active filter tag
- `.filter-empty` - Empty filter message
- `.filter-time-ranges` - Time range filters
- `.filter-time-range` - Time range filter button
- `.filter-time-range.active` - Active time range filter
- `.filter-date-range` - Date range filter
- `.filter-sort` - Sort filter
- `.clear-filters-button` - Clear filters button
- `.search-results` - Search results container
- `.search-loading` - Search loading state
- `.search-empty` - Empty search results
- `.search-results-count` - Search results count
- `.search-results-list` - Search results list
- `.search-result-item` - Search result item
- `.result-item-header` - Result item header
- `.result-item-title` - Result item title
- `.result-item-meta` - Result item metadata
- `.result-time-range-badge` - Result time range badge
- `.result-date` - Result date
- `.result-item-content` - Result item content
- `.result-item-tags` - Result item tags
- `.result-tag` - Result tag

## Preferences

- `.preferences-container` - Preferences container
- `.preferences-loading` - Preferences loading state
- `.preferences-header` - Preferences header
- `.preferences-header h1` - Preferences title
- `.preferences-actions` - Preferences action buttons
- `.preferences-button` - Preferences button
- `.save-button` - Save button (preferences)
- `.reset-button` - Reset button
- `.preferences-content` - Preferences content
- `.preferences-section` - Preferences section
- `.preferences-section h2` - Section title
- `.preference-item` - Preference item
- `.preference-item label` - Preference label
- `.preference-item input` - Preference input
- `.preference-item select` - Preference select
- `.preference-item small` - Preference help text
- `.preference-note` - Preference note/notice
- `.auto-save-indicator` - Auto-save indicator
- `.export-toolbar` - Export toolbar
- `.export-controls` - Export controls
- `.about-section` - About section in preferences

## About Page

- `.about-container` - About page container
- `.about-content` - About content
- `.about-header` - About header
- `.about-icon` - About icon
- `.about-title-section` - About title section
- `.about-title-section h1` - About title
- `.about-description` - About description
- `.about-section` - About section
- `.about-version` - Version display
- `.about-note` - About note
- `.about-credits` - Credits section
- `.about-credits h2` - Credits title
- `.about-credits p` - Credits paragraph
- `.about-link` - About link
- `.about-credits-detailed` - Detailed credits
- `.credits-category` - Credits category
- `.credits-category h3` - Category title
- `.credits-category ul` - Category list
- `.credits-category li` - Category list item
- `.credits-note` - Credits note

## Loading Screen

- `.loading-screen` - Loading screen container
- `.space-background` - Space background
- `.nebula-layer` - Nebula layer
- `.starfield` - Starfield container
- `.star` - Individual star
- `.loading-content` - Loading content
- `.loading-logo` - Loading logo container
- `.camera-wrapper` - Camera wrapper
- `.infinity-3d-container` - 3D infinity container
- `.infinity-segment-3d` - 3D infinity segment
- `.branch-segment-3d` - 3D branch segment
- `.entry-ornament-3d` - 3D entry ornament
- `.infinity-3d-layer` - Infinity 3D layer
- `.infinity-layer-front` - Front layer
- `.infinity-layer-middle` - Middle layer
- `.infinity-layer-back` - Back layer
- `.loading-title` - Loading title
- `.loading-message` - Loading message
- `.loading-progress` - Loading progress container
- `.loading-progress-bar` - Progress bar container
- `.loading-progress-fill` - Progress bar fill
- `.loading-progress-text` - Progress text
- `.loading-spinner` - Loading spinner
- `.spinner-ring` - Spinner ring

## Global Timeline Minimap

- `.global-timeline-minimap` - Minimap container
- `.minimap-container` - Minimap container
- `.radial-dial` - Radial dial
- `.radial-dial-center` - Dial center
- `.radial-dial-direction` - Dial direction indicator
- `.radial-arrow` - Radial arrow
- `.radial-label` - Radial label
- `.timeline-path` - Timeline path
- `.timeline-segments` - Timeline segments container
- `.timeline-segment` - Timeline segment
- `.segment-indicator` - Segment indicator
- `.segment-label` - Segment label
- `.entry-indicators` - Entry indicators container
- `.entry-indicator-wrapper` - Entry indicator wrapper
- `.entry-indicator` - Entry indicator dot
- `.scale-labels` - Scale labels container
- `.scale-label` - Scale label
- And many more minimap-specific classes...

## Button States

All buttons should support:
- Normal state
- `:hover` - Hover state
- `:active` - Active/pressed state
- `:focus` - Focus state
- `:disabled` - Disabled state

## Input States

All inputs should support:
- Normal state
- `:focus` - Focus state
- `:disabled` - Disabled state
- `:placeholder` - Placeholder text styling

## Important Notes

1. **Always style all states** - hover, focus, active, disabled
2. **Use consistent color schemes** - maintain theme identity
3. **Consider accessibility** - ensure sufficient contrast
4. **Test across all views** - calendar, timeline, journal, search, preferences
5. **Style all variations** - selected, today, has-entry, empty states

