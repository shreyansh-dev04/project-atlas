# Phase 02 changelog

## Foundation
- Introduced IndexedDB schema version 2 with an in-place migration for existing pages.
- Existing pages receive default tags, favorite state, and creation timestamps without clearing the database.
- Improved page autosave with a 450 ms debounce, explicit pending-write flushing before page changes/deletes/exports, and visible save state.
- Added validated JSON backup import. Import merges by record ID and preserves unrelated local records.
- Kept the existing database name (`atlas-local`) so the browser can upgrade the existing data rather than creating a blank workspace.

## Knowledge Vault
- Search now includes title, category, tags, and note content.
- Added category filtering and a favorites-only filter.
- Added editable categories and comma-separated tags.
- Added page pin/favorite support.
- Added character and word counts.
- Added clearer local-storage and backup messaging.

## Not included yet
- Rich block editor / BlockNote integration.
- Folders, backlinks, page relations, templates, and attachments.
- Mistake Journal, weekly streaks, and full Visual Planner.
