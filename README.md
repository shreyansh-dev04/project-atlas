# Project Atlas

A local-first personal knowledge and study management workspace.

## Phase 02 — Foundation + Knowledge Vault

- Next.js App Router + React + TypeScript
- Tailwind CSS and a responsive workspace shell
- Dexie.js + IndexedDB local database with a versioned schema migration
- Knowledge Vault with page creation, editing, deletion, categories, tags and favorites
- Full-text-style local search across page titles, categories, tags and note content
- Debounced autosave with visible save status
- JSON workspace export and validated, non-destructive backup import
- Existing Phase 01 pages are migrated in place; no manual database reset is needed

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data storage and backups

Atlas stores data in this browser's IndexedDB database. Data normally remains available across browser restarts in the same browser profile. Clearing site data, deleting the browser profile, or using another browser/device can remove or hide it. Use **Export workspace** regularly. Import merges records by ID: matching records are updated and other local records are kept.

## Current scope

Study timer and basic Kanban remain part of the starter. Mistake Journal, weekly streaks, Visual Planner events, drag-and-drop Kanban, and BlockNote rich editing are future milestones and are not represented as complete.

## Project structure

```text
src/
  app/             Next.js routes and global styles
  components/      Workspace UI
  lib/              IndexedDB database and data helpers
```

## License

MIT. See `LICENSE`.
