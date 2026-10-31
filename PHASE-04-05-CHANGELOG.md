# Project Atlas — Phase 04 + 05

## Personal Intelligence System

### Habit Intelligence
- Create daily habits and weekly-target habits (1–7 days per week).
- Mark today's completion and undo it when needed.
- View current daily streaks or consecutive weekly-target streaks.
- Archive habits without deleting their historical completion records.
- Habit records and completion history are stored locally in IndexedDB.

### Personal Intelligence
- Dashboard cards for today's habit completions, 30-day habit consistency, seven-day study time, and completed planner tasks.
- Locally calculated insights based on saved habit, study-session, and planner data.
- Last-30-days habit-completion activity grid.
- Clear note that insights are descriptive and based only on recorded activity.

### Data and compatibility
- IndexedDB schema upgraded to version 5; previous pages, tasks, events, study sessions, and mistakes are preserved.
- JSON workspace backups now include habits and habit completion entries.
- Older backups remain importable; habit fields are optional.
- No cloud service, account, quiz engine, or external AI API is required.

## Notes
- Daily streaks allow the current day to remain incomplete while counting an unbroken streak through yesterday.
- Weekly streaks are based on meeting the habit's configured weekly target.
- Archived habits remain in local history and backups, but are excluded from the active habit consistency percentage.
