# Project Atlas — Phase 03

## Study Intelligence
- Added a Dexie v4 migration that creates a local `mistakes` table without deleting existing pages, tasks, sessions, or planner events.
- Added a manual mistake journal with subject, chapter, question/concept, error, correction, resolved status, and deletion.
- Added `recordQuizMistake()` in `src/lib/db.ts` as the integration point for future in-app quizzes/tests. It labels entries as quiz-originated.
- Added configurable weekly study-hour target (1–100 hours), weekly progress, and consecutive weekly-goal streak calculation based on saved study sessions.
- Added subject-wise study-time breakdown and retained session history.
- Extended JSON backup export/import to include mistake records and weekly goal.

## Data and limitations
- All records remain local in IndexedDB; the weekly target is stored in local browser storage.
- Weekly progress is calculated Monday through Sunday using completed sessions' end timestamps.
- Quiz auto-capture is exposed as a database integration function; no quiz engine exists in this starter yet, so no quiz is currently calling it automatically.
- Existing timer behaviour is retained in this phase; active timer recovery after browser closure is not included.
