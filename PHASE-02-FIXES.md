# Phase 02 fixes

- Replaced the Planner placeholder with a working month calendar, date selection, event creation, event listing, event deletion, and a functional Calendar/Kanban view switch.
- Added a Dexie database version 3 `events` table. Existing local pages, tasks, and study sessions are preserved by the schema upgrade.
- Included events in workspace JSON export/import while keeping older backups valid (the `events` property is optional).
- Removed inert workspace-options, workspace-switch, help, and decorative settings controls. The workspace identity is now informational rather than a fake button.
- Disabled the Next.js development indicator (`devIndicators: false`), which removes the bottom-left Next.js badge in development.

After replacing the project files, restart the dev server. If the old N indicator remains, stop and restart `npm.cmd run dev` because Next.js config changes require a restart.
