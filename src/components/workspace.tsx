"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { z } from "zod";
import {
  Activity, ArrowDownToLine, ArrowUpFromLine, BookOpen, CalendarDays, Check,
  ChevronLeft, ChevronRight, Clock3, FilePlus2, Flame, Folder, LayoutDashboard,
  ListTodo, NotebookPen, Plus, Search, Star, Tag,
  Target, Timer, Trash2, TrendingUp, X, Brain, CircleCheck, RotateCcw, Sparkles, CheckCheck, CalendarCheck,
} from "lucide-react";
import { db, makeId, type PageRecord, type TaskRecord, type PlannerEventRecord, type HabitRecord, type HabitEntryRecord } from "@/lib/db";

type Section = "overview" | "vault" | "study" | "planner" | "intelligence";
type PageDraft = Pick<PageRecord, "title" | "content" | "category" | "tags" | "isFavorite">;
type MistakeDraft = { subject: string; chapter: string; question: string; error: string; correction: string };
const navItems: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "vault", label: "Knowledge Vault", icon: NotebookPen },
  { id: "study", label: "Study Intelligence", icon: Activity },
  { id: "planner", label: "Planner", icon: CalendarDays },
  { id: "intelligence", label: "Personal Intelligence", icon: Brain },
];

const starterPages: PageRecord[] = [
  { id: "welcome-atlas", title: "Welcome to Atlas", content: "Your personal workspace starts here. Capture ideas, build your knowledge library, and keep useful information close.\n\nThis is a local-first workspace: your pages are stored in this browser on this device. Export a backup regularly to protect important work.", category: "Getting started", tags: ["welcome", "guide"], isFavorite: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: "quick-capture", title: "Quick capture", content: "A place for ideas, reminders, and things to organise later.\n\nUse tags to make this page easier to find.", category: "Personal", tags: ["inbox"], isFavorite: false, createdAt: Date.now() - 1000, updatedAt: Date.now() - 1000 },
];

const backupSchema = z.object({
  version: z.number(),
  pages: z.array(z.object({ id: z.string(), title: z.string(), content: z.string(), category: z.string().optional(), tags: z.array(z.string()).optional(), isFavorite: z.boolean().optional(), createdAt: z.number().optional(), updatedAt: z.number() })),
  tasks: z.array(z.object({ id: z.string(), title: z.string(), subject: z.string(), chapter: z.string(), status: z.enum(["todo", "doing", "done"]), priority: z.enum(["low", "medium", "high"]), dueDate: z.string().optional(), updatedAt: z.number() })),
  sessions: z.array(z.object({ id: z.string(), subject: z.string(), chapter: z.string(), startedAt: z.number(), endedAt: z.number(), durationSeconds: z.number() })),
  events: z.array(z.object({ id: z.string(), title: z.string(), date: z.string(), details: z.string(), createdAt: z.number() })).optional(),
  mistakes: z.array(z.object({ id: z.string(), subject: z.string(), chapter: z.string(), question: z.string(), error: z.string(), correction: z.string(), source: z.enum(["manual", "quiz"]), createdAt: z.number(), resolved: z.boolean() })).optional(),
  weeklyGoalHours: z.number().optional(),
  habits: z.array(z.object({ id: z.string(), name: z.string(), description: z.string(), frequency: z.enum(["daily", "weekly"]), targetPerWeek: z.number(), color: z.string(), active: z.boolean(), createdAt: z.number() })).optional(),
  habitEntries: z.array(z.object({ id: z.string(), habitId: z.string(), date: z.string(), completedAt: z.number() })).optional(),
});

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600).toString().padStart(2, "0");
  const m = Math.floor((safe % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(safe % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}
function normalizeTags(value: string | string[]) {
  const raw = Array.isArray(value) ? value : value.split(",");
  return [...new Set(raw.map((tag) => tag.trim().replace(/^#/, "").toLowerCase()).filter(Boolean))];
}
function draftFromPage(page: PageRecord): PageDraft {
  return { title: page.title, content: page.content, category: page.category || "Personal", tags: page.tags ?? [], isFavorite: Boolean(page.isFavorite) };
}

export default function Workspace() {
  const [section, setSection] = useState<Section>("overview");
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PageDraft | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [subject, setSubject] = useState("Mathematics");
  const [chapter, setChapter] = useState("");
  const [newTask, setNewTask] = useState("");
  const [showNewTask, setShowNewTask] = useState(false);
  const [plannerView, setPlannerView] = useState<"calendar" | "kanban">("calendar");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => localDateKey());
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDetails, setNewEventDetails] = useState("");
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [vaultNotice, setVaultNotice] = useState("");
  const [mistakeDraft, setMistakeDraft] = useState<MistakeDraft>({ subject: "Mathematics", chapter: "", question: "", error: "", correction: "" });
  const [showMistakeForm, setShowMistakeForm] = useState(false);
  const [weeklyGoalHours, setWeeklyGoalHours] = useState(5);
  const [habitName, setHabitName] = useState("");
  const [habitDescription, setHabitDescription] = useState("");
  const [habitFrequency, setHabitFrequency] = useState<"daily" | "weekly">("daily");
  const [habitTarget, setHabitTarget] = useState(3);
  const [showHabitForm, setShowHabitForm] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const timerStartedAtRef = useRef<number | null>(null);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDraftRef = useRef<{ id: string; draft: PageDraft } | null>(null);

  const pages = useLiveQuery(() => db.pages.orderBy("updatedAt").reverse().toArray(), []) ?? [];
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const sessions = useLiveQuery(() => db.sessions.toArray(), []) ?? [];
  const events = useLiveQuery(() => db.events.orderBy("date").toArray(), []) ?? [];
  const mistakes = useLiveQuery(() => db.mistakes.orderBy("createdAt").reverse().toArray(), []) ?? [];
  const habits = useLiveQuery(() => db.habits.orderBy("createdAt").reverse().toArray(), []) ?? [];
  const habitEntries = useLiveQuery(() => db.habitEntries.toArray(), []) ?? [];
  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? null;

  useEffect(() => {
    const savedGoal = Number(window.localStorage.getItem("atlas-weekly-goal-hours"));
    if (Number.isFinite(savedGoal) && savedGoal >= 1 && savedGoal <= 100) setWeeklyGoalHours(savedGoal);
  }, []);
  useEffect(() => { window.localStorage.setItem("atlas-weekly-goal-hours", String(weeklyGoalHours)); }, [weeklyGoalHours]);

  useEffect(() => {
    let alive = true;
    db.pages.count().then((count) => {
      if (alive && count === 0) return db.pages.bulkAdd(starterPages);
    }).catch(() => setSaveState("error"));
    return () => { alive = false; };
  }, []);

  // Debounced autosave: editor state updates immediately; IndexedDB writes after a short pause.
  useEffect(() => {
    if (!selectedPageId || !draft) return;
    pendingDraftRef.current = { id: selectedPageId, draft };
    setSaveState("saving");
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(async () => {
      const pending = pendingDraftRef.current;
      if (!pending) return;
      try {
        await db.pages.update(pending.id, { ...pending.draft, updatedAt: Date.now() });
        if (pendingDraftRef.current?.id === pending.id) pendingDraftRef.current = null;
        setSaveState("saved");
      } catch { setSaveState("error"); }
    }, 450);
    return () => { if (writeTimerRef.current) clearTimeout(writeTimerRef.current); };
  }, [draft, selectedPageId]);

  // Flush pending edits before leaving the page or closing the workspace component.
  const flushPendingDraft = async () => {
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    const pending = pendingDraftRef.current;
    if (!pending) return;
    try {
      await db.pages.update(pending.id, { ...pending.draft, updatedAt: Date.now() });
      pendingDraftRef.current = null;
      setSaveState("saved");
    } catch { setSaveState("error"); }
  };

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => () => {
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    const pending = pendingDraftRef.current;
    if (pending) void db.pages.update(pending.id, { ...pending.draft, updatedAt: Date.now() });
  }, []);

  const todaySeconds = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return sessions.filter((session) => session.startedAt >= start.getTime()).reduce((sum, session) => sum + session.durationSeconds, 0);
  }, [sessions]);
  const categories = useMemo(() => ["All categories", ...new Set(pages.map((page) => page.category || "Personal").sort())], [pages]);
  const filteredPages = pages.filter((page) => {
    const haystack = `${page.title} ${page.category} ${page.content} ${(page.tags ?? []).join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (categoryFilter === "All categories" || (page.category || "Personal") === categoryFilter) && (!favoritesOnly || page.isFavorite);
  });

  async function createPage() {
    await flushPendingDraft();
    const now = Date.now();
    const page: PageRecord = { id: makeId(), title: "Untitled", content: "", category: "Personal", tags: [], isFavorite: false, createdAt: now, updatedAt: now };
    setSaveState("saving");
    try {
      await db.pages.add(page);
      setSelectedPageId(page.id); setDraft(draftFromPage(page)); setSection("vault"); setSaveState("saved"); setVaultNotice("New page created.");
    } catch { setSaveState("error"); }
  }

  async function openPage(page: PageRecord) {
    await flushPendingDraft();
    setSelectedPageId(page.id); setDraft(draftFromPage(page)); setSection("vault"); setVaultNotice("");
  }

  function patchDraft(patch: Partial<PageDraft>) {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      if (selectedPageId) pendingDraftRef.current = { id: selectedPageId, draft: next };
      return next;
    });
  }

  async function deletePage(id: string) {
    if (!window.confirm("Delete this page permanently from this browser?")) return;
    await flushPendingDraft();
    try {
      await db.pages.delete(id);
      if (selectedPageId === id) { setSelectedPageId(null); setDraft(null); }
      setVaultNotice("Page deleted."); setSaveState("saved");
    } catch { setSaveState("error"); }
  }

  async function addTask() {
    if (!newTask.trim()) return;
    const task: TaskRecord = { id: makeId(), title: newTask.trim(), subject, chapter: "", status: "todo", priority: "medium", updatedAt: Date.now() };
    setSaveState("saving");
    try { await db.tasks.add(task); setNewTask(""); setShowNewTask(false); setSaveState("saved"); }
    catch { setSaveState("error"); }
  }
  async function moveTask(task: TaskRecord, status: TaskRecord["status"]) {
    try { await db.tasks.update(task.id, { status, updatedAt: Date.now() }); setSaveState("saved"); }
    catch { setSaveState("error"); }
  }

  async function addEvent() {
    if (!newEventTitle.trim()) return;
    const event: PlannerEventRecord = { id: makeId(), title: newEventTitle.trim(), date: selectedDate, details: newEventDetails.trim(), createdAt: Date.now() };
    try { await db.events.add(event); setNewEventTitle(""); setNewEventDetails(""); setShowNewEvent(false); setSaveState("saved"); }
    catch { setSaveState("error"); }
  }
  async function deleteEvent(id: string) {
    try { await db.events.delete(id); setSaveState("saved"); } catch { setSaveState("error"); }
  }

  async function finishSession() {
    if (elapsed <= 0) return;
    const now = Date.now();
    setSaveState("saving");
    try {
      await db.sessions.add({ id: makeId(), subject, chapter, startedAt: timerStartedAtRef.current ?? now - elapsed * 1000, endedAt: now, durationSeconds: elapsed });
      setElapsed(0); setTimerRunning(false); timerStartedAtRef.current = null; setSaveState("saved");
    } catch { setSaveState("error"); }
  }
  function toggleTimer() {
    if (timerRunning) { setTimerRunning(false); return; }
    if (elapsed === 0) timerStartedAtRef.current = Date.now();
    setTimerRunning(true);
  }

  async function exportData() {
    await flushPendingDraft();
    const payload = { version: 5, exportedAt: new Date().toISOString(), pages: await db.pages.toArray(), tasks: await db.tasks.toArray(), sessions: await db.sessions.toArray(), events: await db.events.toArray(), mistakes: await db.mistakes.toArray(), habits: await db.habits.toArray(), habitEntries: await db.habitEntries.toArray(), weeklyGoalHours };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `atlas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    setVaultNotice("Backup exported. Keep the JSON file somewhere safe.");
  }

  async function importData(file?: File) {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const result = backupSchema.safeParse(parsed);
      if (!result.success) throw new Error("This file is not a valid Atlas backup.");
      if (!window.confirm(`Import ${result.data.pages.length} pages, ${result.data.tasks.length} tasks and ${result.data.sessions.length} sessions? Matching IDs will be updated; other local records will be kept.`)) return;
      const normalizedPages: PageRecord[] = result.data.pages.map((page) => ({
        id: page.id, title: page.title, content: page.content, category: page.category || "Personal",
        tags: normalizeTags(page.tags ?? []), isFavorite: Boolean(page.isFavorite), createdAt: page.createdAt ?? page.updatedAt, updatedAt: page.updatedAt,
      }));
      await db.transaction("rw", [db.pages, db.tasks, db.sessions, db.events, db.mistakes, db.habits, db.habitEntries], async () => {
        await db.pages.bulkPut(normalizedPages); await db.tasks.bulkPut(result.data.tasks); await db.sessions.bulkPut(result.data.sessions);
        if (result.data.events?.length) await db.events.bulkPut(result.data.events);
        if (result.data.mistakes?.length) await db.mistakes.bulkPut(result.data.mistakes);
        if (result.data.habits?.length) await db.habits.bulkPut(result.data.habits);
        if (result.data.habitEntries?.length) await db.habitEntries.bulkPut(result.data.habitEntries);
        if (result.data.weeklyGoalHours) setWeeklyGoalHours(result.data.weeklyGoalHours);
      });
      setSaveState("saved"); setVaultNotice("Backup imported successfully. Existing records with different IDs were preserved.");
    } catch (error) {
      setSaveState("error"); setVaultNotice(error instanceof Error ? error.message : "Could not import this backup.");
    } finally { if (importInputRef.current) importInputRef.current.value = ""; }
  }

  const weekStart = new Date(); weekStart.setHours(0,0,0,0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekStartMs = weekStart.getTime();
  const thisWeekSeconds = sessions.filter((session) => session.endedAt >= weekStartMs).reduce((sum, session) => sum + session.durationSeconds, 0);
  const weeklyProgress = Math.min(100, Math.round(thisWeekSeconds / (weeklyGoalHours * 3600) * 100));
  const weeklyGoalMet = thisWeekSeconds >= weeklyGoalHours * 3600;
  let weeklyGoalStreak = 0;
  for (let weekOffset = 0; weekOffset < 104; weekOffset++) {
    const start = new Date(weekStart); start.setDate(start.getDate() - weekOffset * 7);
    const end = start.getTime() + 7 * 86400000;
    const seconds = sessions.filter((session) => session.endedAt >= start.getTime() && session.endedAt < end).reduce((sum, session) => sum + session.durationSeconds, 0);
    if (seconds >= weeklyGoalHours * 3600) weeklyGoalStreak++; else break;
  }
  async function addMistake() {
    if (!mistakeDraft.question.trim() || !mistakeDraft.error.trim()) return;
    await db.mistakes.add({ id: makeId(), ...mistakeDraft, source: "manual", createdAt: Date.now(), resolved: false });
    setMistakeDraft({ subject, chapter, question: "", error: "", correction: "" }); setShowMistakeForm(false);
  }
  async function toggleMistake(id: string, resolved: boolean) { await db.mistakes.update(id, { resolved }); }
  async function removeMistake(id: string) { await db.mistakes.delete(id); }

  const todayKey = localDateKey();
  const activeHabits = habits.filter((habit) => habit.active);
  const completedToday = activeHabits.filter((habit) => habitEntries.some((entry) => entry.habitId === habit.id && entry.date === todayKey)).length;
  const last30Keys = Array.from({ length: 30 }, (_, index) => { const date = new Date(); date.setHours(0,0,0,0); date.setDate(date.getDate() - (29-index)); return localDateKey(date); });
  const activeHabitIds = new Set(activeHabits.map((habit) => habit.id));
  const recentEntries = habitEntries.filter((entry) => activeHabitIds.has(entry.habitId) && last30Keys.includes(entry.date));
  const possibleCompletions = activeHabits.reduce((sum, habit) => sum + (habit.frequency === "daily" ? 30 : Math.round(30 * habit.targetPerWeek / 7)), 0);
  const habitConsistency = possibleCompletions ? Math.min(100, Math.round(recentEntries.length / possibleCompletions * 100)) : 0;
  const last7Start = new Date(); last7Start.setHours(0,0,0,0); last7Start.setDate(last7Start.getDate()-6);
  const last7Study = sessions.filter((session) => session.endedAt >= last7Start.getTime()).reduce((sum, session) => sum + session.durationSeconds, 0);
  const last30Study = sessions.filter((session) => session.endedAt >= new Date(Date.now()-30*86400000).getTime()).reduce((sum, session) => sum + session.durationSeconds, 0);
  const doneTasks = tasks.filter((task) => task.status === "done").length;
  const overallInsight = activeHabits.length === 0
    ? "Add a few habits to begin building a picture of your consistency."
    : habitConsistency >= 80 ? "Your recent habit consistency is strong. Protect the routines that are working."
    : habitConsistency >= 50 ? "You have a foundation to build on. Focus on making your most important habits easier to repeat."
    : "Your recent completion rate has room to improve. Start with a smaller, more reliable routine.";

  async function createHabit() {
    if (!habitName.trim()) return;
    const habit: HabitRecord = { id: makeId(), name: habitName.trim(), description: habitDescription.trim(), frequency: habitFrequency, targetPerWeek: habitFrequency === "daily" ? 7 : habitTarget, color: "violet", active: true, createdAt: Date.now() };
    await db.habits.add(habit); setHabitName(""); setHabitDescription(""); setHabitFrequency("daily"); setHabitTarget(3); setShowHabitForm(false);
  }
  async function toggleHabitToday(habit: HabitRecord) {
    const existing = habitEntries.find((entry) => entry.habitId === habit.id && entry.date === todayKey);
    if (existing) await db.habitEntries.delete(existing.id);
    else await db.habitEntries.add({ id: `${habit.id}:${todayKey}`, habitId: habit.id, date: todayKey, completedAt: Date.now() });
  }
  function getHabitStreak(habit: HabitRecord) {
    let streak = 0; const cursor = new Date(); cursor.setHours(0,0,0,0);
    if (habit.frequency === "daily") {
      if (!habitEntries.some((entry) => entry.habitId === habit.id && entry.date === localDateKey(cursor))) cursor.setDate(cursor.getDate()-1);
      while (streak < 366) { const key = localDateKey(cursor); if (!habitEntries.some((entry) => entry.habitId === habit.id && entry.date === key)) break; streak++; cursor.setDate(cursor.getDate()-1); }
    } else {
      cursor.setDate(cursor.getDate()-((cursor.getDay()+6)%7));
      const currentWeekEnd = new Date(cursor); currentWeekEnd.setDate(currentWeekEnd.getDate()+7);
      const currentCount = habitEntries.filter((entry) => entry.habitId === habit.id && entry.date >= localDateKey(cursor) && entry.date < localDateKey(currentWeekEnd)).length;
      if (currentCount < habit.targetPerWeek) cursor.setDate(cursor.getDate()-7);
      for (let week = 0; week < 104; week++) { const start = new Date(cursor); start.setDate(start.getDate()-week*7); const end = new Date(start); end.setDate(end.getDate()+7); const count = habitEntries.filter((entry) => entry.habitId === habit.id && entry.date >= localDateKey(start) && entry.date < localDateKey(end)).length; if (count < habit.targetPerWeek) break; streak++; }
    }
    return streak;
  }
  async function archiveHabit(habit: HabitRecord) { await db.habits.update(habit.id, { active: false }); }

  const title = navItems.find((item) => item.id === section)?.label ?? "Workspace";
  const todoCount = tasks.filter((task) => task.status !== "done").length;
  const totalSeconds = sessions.reduce((sum, session) => sum + session.durationSeconds, 0);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row"><div className="brand-mark">A</div><div><div className="brand-name">atlas</div><div className="brand-caption">PERSONAL WORKSPACE</div></div></div>
        <div className="workspace-switch"><div className="workspace-avatar">S</div><span><strong>Personal workspace</strong><small>Free · Local</small></span></div>
        <div className="side-label">WORKSPACE</div>
        <nav className="nav-list">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setSection(id)} className={`nav-item ${section === id ? "active" : ""}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{id === "planner" && todoCount > 0 && <em>{todoCount}</em>}</button>)}</nav>
        <div className="side-section-heading"><span className="side-label">RECENT PAGES</span><button className="tiny-icon" onClick={createPage} aria-label="Create page"><Plus size={15} /></button></div>
        <div className="recent-list">{pages.slice(0, 6).map((page) => <button key={page.id} onClick={() => void openPage(page)} className={`recent-item ${selectedPageId === page.id && section === "vault" ? "selected" : ""}`}><FilePlus2 size={15} /><span>{page.title || "Untitled"}</span></button>)}{pages.length === 0 && <div className="empty-side">Your pages will appear here.</div>}</div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={exportData}><ArrowDownToLine size={17} /><span>Export workspace</span></button>
          <button className="nav-item" onClick={() => importInputRef.current?.click()}><ArrowUpFromLine size={17} /><span>Import backup</span></button>
          <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importData(event.target.files?.[0])} />
          <div className="profile-card"><div className="profile-avatar">S</div><div><strong>Local profile</strong><small>Data stays on this device</small></div></div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{title}</strong></div><div className="topbar-actions"><div className={`save-indicator ${saveState}`}><span className="save-dot" />{saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved locally"}</div><div className="top-avatar">S</div></div></header>
        <div className="content-area">
          {section === "overview" && <div className="page-wrap">
            <div className="welcome-row"><div><div className="eyebrow">YOUR COMMAND CENTER</div><h1>Good to see you.</h1><p className="subheading">A clear space for everything you&apos;re learning and planning.</p></div><div className="date-chip"><CalendarDays size={15} />{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</div></div>
            <div className="stats-grid"><StatCard icon={<NotebookPen size={18} />} label="Knowledge pages" value={String(pages.length).padStart(2, "0")} note="Ideas saved locally" /><StatCard icon={<Clock3 size={18} />} label="Study time today" value={formatDuration(todaySeconds + (timerRunning ? elapsed : 0))} note={timerRunning ? "Timer is running" : "Recorded sessions"} /><StatCard icon={<ListTodo size={18} />} label="Tasks to complete" value={String(todoCount).padStart(2, "0")} note="Across all subjects" /><StatCard icon={<Flame size={18} />} label="Total study time" value={`${Math.floor(totalSeconds / 3600)}h ${Math.floor((totalSeconds % 3600) / 60)}m`} note="All recorded sessions" /></div>
            <div className="section-heading"><div><h2>Pick up where you left off</h2><p>Your three spaces, connected.</p></div></div>
            <div className="module-grid"><ModuleCard icon={<BookOpen size={20} />} number="01" title="Knowledge Vault" description="Notes, reference material and useful details in one searchable space." action="Open vault" onClick={() => setSection("vault")} tone="violet" /><ModuleCard icon={<TrendingUp size={20} />} number="02" title="Study Intelligence" description="Track focused sessions, learning progress and mistakes." action="View study space" onClick={() => setSection("study")} tone="blue" /><ModuleCard icon={<CalendarDays size={20} />} number="03" title="Planner" description="Turn your study goals into scheduled events and actionable tasks." action="Open planner" onClick={() => setSection("planner")} tone="amber" /><ModuleCard icon={<Brain size={20} />} number="04" title="Personal Intelligence" description="Track habits, understand consistency and discover your productivity patterns." action="Open intelligence" onClick={() => setSection("intelligence")} tone="violet" /></div>
            <div className="bottom-grid"><div className="panel-card"><div className="panel-title"><div><h3>Recent knowledge</h3><p>Recently updated pages</p></div><button className="text-button" onClick={() => setSection("vault")}>View all <span>→</span></button></div>{pages.slice(0, 3).map((page) => <button className="page-row" key={page.id} onClick={() => void openPage(page)}><div className="page-icon"><Folder size={16} /></div><div className="page-row-copy"><strong>{page.title}</strong><small>{page.category}</small></div><span className="row-date">{new Date(page.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></button>)}{pages.length === 0 && <p className="muted-empty">No pages yet. Create your first note in Knowledge Vault.</p>}</div>
              <div className="panel-card focus-card"><div className="panel-title"><div><h3>Focus session</h3><p>A simple timer for intentional study.</p></div><div className="focus-icon"><Timer size={17} /></div></div><div className="mini-timer">{formatDuration(elapsed)}</div><div className="timer-caption">{timerRunning ? "FOCUS SESSION IN PROGRESS" : "READY WHEN YOU ARE"}</div><button className={`primary-button ${timerRunning ? "pause-button" : ""}`} onClick={toggleTimer}>{timerRunning ? "Pause session" : elapsed > 0 ? "Resume session" : "Start studying"}</button>{elapsed > 0 && <button className="subtle-button" onClick={finishSession}>Stop & save session</button>}</div>
            </div>
          </div>}

          {section === "vault" && <div className="page-wrap">
            <div className="page-header"><div><div className="eyebrow">01 / KNOWLEDGE MANAGEMENT</div><h1>Knowledge Vault</h1><p className="subheading">Search inside your notes, organise with categories and tags, and pin important pages.</p></div><button className="primary-button compact" onClick={createPage}><Plus size={16} /> New page</button></div>
            {vaultNotice && <div className="vault-notice" role="status">{vaultNotice}</div>}
            <div className="vault-layout">
              <div className="panel-card page-library">
                <div className="library-toolbar"><div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, notes, tags..." /></div><span className="count-label">{filteredPages.length} PAGES</span></div>
                <div className="vault-filters"><select className="field-control" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category">{categories.map((category) => <option key={category}>{category}</option>)}</select><button className={`filter-chip ${favoritesOnly ? "active" : ""}`} onClick={() => setFavoritesOnly((value) => !value)}><Star size={13} /> Favorites</button></div>
                {filteredPages.map((page) => <button key={page.id} onClick={() => void openPage(page)} className={`library-page ${selectedPageId === page.id ? "active" : ""}`}><div className="page-icon"><FilePlus2 size={16} /></div><div className="library-page-copy"><strong>{page.title || "Untitled"}</strong><small>{page.category || "Personal"} · {new Date(page.updatedAt).toLocaleDateString("en-IN")}</small>{(page.tags ?? []).length > 0 && <span className="page-tag-list">{page.tags.slice(0, 3).map((tag) => <i key={tag}>#{tag}</i>)}</span>}</div>{page.isFavorite && <Star className="favorite-mark" size={13} fill="currentColor" />}</button>)}
                {filteredPages.length === 0 && <p className="muted-empty">No matching pages. Try another search or create a page.</p>}
              </div>
              <div className="panel-card editor-card">
                {selectedPage && draft ? <>
                  <div className="editor-meta"><span>{draft.category || "Personal"}</span><span>·</span><span>Autosaves locally</span><button className={`favorite-toggle ${draft.isFavorite ? "active" : ""}`} onClick={() => patchDraft({ isFavorite: !draft.isFavorite })} aria-label={draft.isFavorite ? "Remove from favorites" : "Add to favorites"}><Star size={15} fill={draft.isFavorite ? "currentColor" : "none"} />{draft.isFavorite ? "Pinned" : "Pin page"}</button><button className="danger-icon" onClick={() => void deletePage(selectedPage.id)} aria-label="Delete page" title="Delete page"><Trash2 size={15} /></button></div>
                  <input className="title-input" value={draft.title} onChange={(event) => patchDraft({ title: event.target.value })} placeholder="Untitled" aria-label="Page title" />
                  <div className="editor-organise"><label><span>CATEGORY</span><input className="field-control" value={draft.category} onChange={(event) => patchDraft({ category: event.target.value })} placeholder="e.g. Chemistry" /></label><label><span>TAGS · COMMA SEPARATED</span><input className="field-control" value={draft.tags.join(", ")} onChange={(event) => patchDraft({ tags: normalizeTags(event.target.value) })} placeholder="revision, formulas, ideas" /></label></div>
                  <textarea className="note-editor" value={draft.content} onChange={(event) => patchDraft({ content: event.target.value })} placeholder="Start writing your thoughts..." aria-label="Page content" />
                  <div className="editor-footer"><span><Check size={14} /> {saveState === "saving" ? "Saving changes..." : saveState === "error" ? "Save failed — check browser storage" : "All changes saved locally"}</span><span>{draft.content.length} characters · {draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0} words</span></div>
                </> : <div className="editor-empty"><div className="empty-icon"><NotebookPen size={24} /></div><h3>Select a page to begin</h3><p>Choose a page from your library or create a new one.</p><button className="primary-button compact" onClick={createPage}><Plus size={15} /> Create a page</button></div>}
              </div>
            </div>
            <div className="vault-footnote"><Tag size={14} /> Search checks page titles, categories, tags and note content. Your pages stay in this browser; use Export workspace for a portable backup.</div>
          </div>}

          {section === "study" && <div className="page-wrap">
            <div className="page-header"><div><div className="eyebrow">02 / LEARNING & PERFORMANCE</div><h1>Study Intelligence</h1><p className="subheading">Track focused work, build consistency and turn mistakes into learning.</p></div><div className="date-chip"><Activity size={15} /> Local tracking</div></div>
            <div className="study-grid"><div className="panel-card timer-panel"><div className="panel-title"><div><h3>Focus timer</h3><p>Choose what you&apos;re studying before you begin.</p></div><div className="focus-icon"><Timer size={18}/></div></div><label className="field-label">SUBJECT</label><select className="field-control" value={subject} onChange={(event) => setSubject(event.target.value)} disabled={timerRunning}><option>Mathematics</option><option>Physics</option><option>Chemistry</option><option>Biology</option><option>English</option><option>Social Science</option><option>Other</option></select><label className="field-label">CHAPTER / TOPIC</label><input className="field-control" value={chapter} onChange={(event) => setChapter(event.target.value)} placeholder="e.g. Structure of Atom" disabled={timerRunning}/><div className="large-timer">{formatDuration(elapsed)}</div><div className="timer-caption">{timerRunning ? "SESSION ACTIVE" : "READY TO FOCUS"}</div><div className="timer-actions"><button className="primary-button" onClick={toggleTimer}>{timerRunning ? "Pause" : elapsed > 0 ? "Resume" : "Start session"}</button><button className="secondary-button" onClick={finishSession} disabled={elapsed === 0}>Stop & save</button></div></div>
              <div className="panel-card"><div className="panel-title"><div><h3>Study overview</h3><p>Your recorded effort</p></div><Target size={18}/></div><div className="metric-block"><span>TODAY</span><strong>{formatDuration(todaySeconds + (timerRunning ? elapsed : 0))}</strong></div><div className="metric-block"><span>ALL-TIME STUDY HOURS</span><strong>{(totalSeconds / 3600).toFixed(1)}h</strong></div><div className="metric-block"><span>WEEKLY GOAL STREAK</span><strong>{weeklyGoalStreak} weeks</strong></div><div className="metric-block"><span>COMPLETED SESSIONS</span><strong>{sessions.length}</strong></div></div></div>
            <div className="study-grid study-lower"><div className="panel-card goal-card"><div className="panel-title"><div><h3>Weekly study goal</h3><p>Progress resets every Monday.</p></div><Flame size={18}/></div><div className="goal-controls"><label className="field-label" htmlFor="weekly-goal">TARGET HOURS / WEEK</label><input id="weekly-goal" className="field-control goal-input" type="number" min="1" max="100" value={weeklyGoalHours} onChange={(e) => setWeeklyGoalHours(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}/></div><div className="goal-progress-track"><div className="goal-progress-fill" style={{width: `${weeklyProgress}%`}}/></div><div className="goal-meta"><strong>{(thisWeekSeconds/3600).toFixed(1)}h of {weeklyGoalHours}h</strong><span>{weeklyProgress}%</span></div><p className="goal-status">{weeklyGoalMet ? "Weekly target achieved. Great consistency." : `${((weeklyGoalHours*3600-thisWeekSeconds)/3600).toFixed(1)} hours left to reach this week's target.`}</p></div>
              <div className="panel-card analytics-card"><div className="panel-title"><div><h3>Subject breakdown</h3><p>All recorded study time</p></div><TrendingUp size={18}/></div>{Object.entries(sessions.reduce<Record<string, number>>((acc, session) => { acc[session.subject] = (acc[session.subject] || 0) + session.durationSeconds; return acc; }, {})).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name, seconds]) => <div className="subject-bar-row" key={name}><div><span>{name}</span><strong>{(seconds/3600).toFixed(1)}h</strong></div><div className="subject-bar-track"><i style={{width:`${totalSeconds ? seconds/totalSeconds*100 : 0}%`}}/></div></div>)}{sessions.length===0 && <p className="muted-empty">Complete a study session to see your subject breakdown.</p>}</div></div>
            <div className="section-heading"><div><h2>Mistake journal</h2><p>Capture errors, record the correction and revisit unresolved mistakes.</p></div><button className="secondary-button" onClick={() => setShowMistakeForm(v=>!v)}><Plus size={14}/> Add mistake</button></div>
            {showMistakeForm && <div className="panel-card mistake-form"><div className="mistake-form-grid"><label>Subject<select className="field-control" value={mistakeDraft.subject} onChange={e=>setMistakeDraft({...mistakeDraft,subject:e.target.value})}><option>Mathematics</option><option>Physics</option><option>Chemistry</option><option>Biology</option><option>English</option><option>Social Science</option><option>Other</option></select></label><label>Chapter / topic<input className="field-control" value={mistakeDraft.chapter} onChange={e=>setMistakeDraft({...mistakeDraft,chapter:e.target.value})} placeholder="Chapter name"/></label><label className="wide-field">Question / concept<input className="field-control" value={mistakeDraft.question} onChange={e=>setMistakeDraft({...mistakeDraft,question:e.target.value})} placeholder="What question or concept did you get wrong?"/></label><label className="wide-field">What went wrong?<textarea className="field-control" value={mistakeDraft.error} onChange={e=>setMistakeDraft({...mistakeDraft,error:e.target.value})} placeholder="Describe the error or misconception." rows={2}/></label><label className="wide-field">Correct approach (optional)<textarea className="field-control" value={mistakeDraft.correction} onChange={e=>setMistakeDraft({...mistakeDraft,correction:e.target.value})} placeholder="Write the right method or key learning." rows={2}/></label></div><div className="mistake-form-actions"><button className="primary-button compact" onClick={()=>void addMistake()} disabled={!mistakeDraft.question.trim()||!mistakeDraft.error.trim()}>Save mistake</button><button className="subtle-button" onClick={()=>setShowMistakeForm(false)}>Cancel</button></div></div>}
            <div className="mistake-list">{mistakes.map(mistake=><article className={`mistake-row ${mistake.resolved?"resolved":""}`} key={mistake.id}><div className="mistake-icon"><Brain size={17}/></div><div className="mistake-content"><div className="mistake-meta"><strong>{mistake.subject}</strong><span>{mistake.chapter||"General"}</span><span>{new Date(mistake.createdAt).toLocaleDateString("en-IN")}</span><span className="mistake-source">{mistake.source==="quiz"?"From quiz":"Manual"}</span></div><h4>{mistake.question}</h4><p><b>What went wrong:</b> {mistake.error}</p>{mistake.correction&&<p><b>Correction:</b> {mistake.correction}</p>}</div><div className="mistake-actions"><button className="icon-button" title={mistake.resolved?"Mark unresolved":"Mark resolved"} onClick={()=>void toggleMistake(mistake.id,!mistake.resolved)}>{mistake.resolved?<RotateCcw size={15}/>:<CircleCheck size={15}/>}</button><button className="danger-icon" title="Delete mistake" onClick={()=>void removeMistake(mistake.id)}><Trash2 size={15}/></button></div></article>)}{mistakes.length===0&&<div className="empty-event">No mistakes logged yet. Add one after a practice session to start learning from patterns.</div>}</div>
            <div className="section-heading"><div><h2>Recent sessions</h2><p>Sessions saved on this device.</p></div></div><div className="panel-card session-list">{sessions.slice().sort((a,b) => b.endedAt-a.endedAt).slice(0,8).map((session) => <div className="session-row" key={session.id}><div className="session-subject"><div className="page-icon"><Clock3 size={16}/></div><div><strong>{session.subject}</strong><small>{session.chapter || "General study"} · {new Date(session.endedAt).toLocaleString("en-IN")}</small></div></div><strong>{formatDuration(session.durationSeconds)}</strong></div>)}{sessions.length === 0 && <p className="muted-empty">Your completed study sessions will appear here.</p>}</div>
          </div>}

          {section === "intelligence" && <div className="page-wrap">
            <div className="page-header"><div><div className="eyebrow">04 / PERSONAL GROWTH & PATTERNS</div><h1>Personal Intelligence</h1><p className="subheading">A data-backed view of your habits, study rhythm and progress.</p></div><div className="date-chip"><Sparkles size={15}/> Your activity, understood</div></div>
            <div className="stats-grid intelligence-stats"><StatCard icon={<CheckCheck size={18}/>} label="Habits completed today" value={`${completedToday}/${activeHabits.length}`} note="Active habits"/><StatCard icon={<TrendingUp size={18}/>} label="30-day consistency" value={`${habitConsistency}%`} note="Based on tracked habits"/><StatCard icon={<Clock3 size={18}/>} label="Study time · 7 days" value={`${(last7Study/3600).toFixed(1)}h`} note="From saved study sessions"/><StatCard icon={<ListTodo size={18}/>} label="Tasks completed" value={String(doneTasks)} note="Planner tasks marked done"/></div>
            <div className="intelligence-grid"><section className="panel-card habit-panel"><div className="panel-title"><div><h3>Habit tracker</h3><p>Build a routine and record each completion.</p></div><button className="primary-button compact" onClick={() => setShowHabitForm((value)=>!value)}><Plus size={14}/> New habit</button></div>
              {showHabitForm && <div className="habit-form"><label>Habit name<input className="field-control" value={habitName} onChange={(e)=>setHabitName(e.target.value)} placeholder="e.g. Read for 20 minutes" autoFocus/></label><label>Description <span>(optional)</span><input className="field-control" value={habitDescription} onChange={(e)=>setHabitDescription(e.target.value)} placeholder="A small note about this habit"/></label><label>Frequency<select className="field-control" value={habitFrequency} onChange={(e)=>setHabitFrequency(e.target.value as "daily"|"weekly")}><option value="daily">Daily</option><option value="weekly">Weekly target</option></select></label>{habitFrequency === "weekly" && <label>Target days per week<select className="field-control" value={habitTarget} onChange={(e)=>setHabitTarget(Number(e.target.value))}>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n} day{n>1?"s":""} per week</option>)}</select></label>}<div className="habit-form-actions"><button className="primary-button compact" onClick={()=>void createHabit()} disabled={!habitName.trim()}>Create habit</button><button className="subtle-button" onClick={()=>setShowHabitForm(false)}>Cancel</button></div></div>}
              <div className="habit-date-label"><CalendarCheck size={14}/> TODAY · {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</div>
              <div className="habit-list">{activeHabits.map((habit)=>{const done=habitEntries.some((entry)=>entry.habitId===habit.id&&entry.date===todayKey);const streak=getHabitStreak(habit);return <article className={`habit-row ${done?"completed":""}`} key={habit.id}><button className={`habit-check ${done?"checked":""}`} onClick={()=>void toggleHabitToday(habit)} aria-label={done?`Undo ${habit.name}`:`Complete ${habit.name}`}>{done&&<Check size={15}/>}</button><div className="habit-copy"><strong>{habit.name}</strong><small>{habit.description|| (habit.frequency==="daily"?"Daily habit":`${habit.targetPerWeek} days per week`)}</small></div><div className="habit-streak"><Flame size={13}/><strong>{streak}</strong><small>{habit.frequency==="daily"?"day streak":"week streak"}</small></div><button className="danger-icon" onClick={()=>void archiveHabit(habit)} title="Archive habit"><X size={15}/></button></article>})}{activeHabits.length===0&&<div className="empty-event">No habits yet. Create your first habit to start tracking consistency.</div>}</div>
              {habits.some(h=>!h.active)&&<div className="archived-note">{habits.filter(h=>!h.active).length} archived habit(s) are retained in your history and backups.</div>}
            </section>
            <section className="panel-card insight-panel"><div className="panel-title"><div><h3>Intelligence insights</h3><p>Patterns calculated from your saved activity.</p></div><Brain size={18}/></div><div className="insight-highlight"><div className="insight-symbol"><Sparkles size={17}/></div><div><strong>Your consistency snapshot</strong><p>{overallInsight}</p></div></div><div className="insight-item"><span>STUDY · LAST 30 DAYS</span><strong>{(last30Study/3600).toFixed(1)} hours</strong><p>{sessions.filter(s=>s.endedAt>=Date.now()-30*86400000).length} recorded sessions in the last 30 days.</p></div><div className="insight-item"><span>HABIT DATA</span><strong>{recentEntries.length} completions</strong><p>{activeHabits.length} active habits are included in your current consistency view.</p></div><div className="insight-item"><span>PLANNER</span><strong>{doneTasks} completed tasks</strong><p>{tasks.length ? `${Math.round(doneTasks/tasks.length*100)}% of all planner tasks are marked complete.` : "Add tasks to the Planner to track completion patterns."}</p></div><p className="insight-footnote">Insights are generated locally from your recorded activity. They are descriptive signals, not predictions or professional advice.</p></section></div>
            <div className="panel-card consistency-panel"><div className="panel-title"><div><h3>Last 30 days</h3><p>Daily completions across your active habits.</p></div><span className="count-label">{recentEntries.length} COMPLETIONS</span></div><div className="consistency-grid">{last30Keys.map((key)=>{const count=habitEntries.filter((entry)=>activeHabitIds.has(entry.habitId)&&entry.date===key).length;return <div key={key} className={`consistency-day level-${count===0?0:count===1?1:count===2?2:3}`} title={`${key}: ${count} completion(s)`}><span>{new Date(`${key}T12:00:00`).getDate()}</span></div>})}</div><div className="consistency-legend"><span>Less</span><i className="level-0"/><i className="level-1"/><i className="level-2"/><i className="level-3"/><span>More</span></div></div>
          </div>}

          {section === "planner" && <div className="page-wrap">
            <div className="page-header"><div><div className="eyebrow">03 / PLAN & EXECUTE</div><h1>Planner</h1><p className="subheading">Organize what needs to happen and move it forward.</p></div><button className="primary-button compact" onClick={() => setShowNewTask(true)}><Plus size={16}/> Add task</button></div>
            {showNewTask && <div className="panel-card new-task-form"><input className="field-control" value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="What needs to get done?" autoFocus/><select className="field-control" value={subject} onChange={(event) => setSubject(event.target.value)}><option>Mathematics</option><option>Physics</option><option>Chemistry</option><option>Biology</option><option>English</option><option>Social Science</option><option>Other</option></select><button className="primary-button compact" onClick={addTask}>Add to board</button><button className="icon-button" onClick={() => setShowNewTask(false)}><X size={17}/></button></div>}
            <div className="planner-toolbar"><div className="view-switch"><button className={`view-tab ${plannerView === "calendar" ? "active" : ""}`} onClick={() => setPlannerView("calendar")}><CalendarDays size={15}/> Visual planner</button><button className={`view-tab ${plannerView === "kanban" ? "active" : ""}`} onClick={() => setPlannerView("kanban")}><ListTodo size={15}/> Kanban board</button></div><span className="count-label">{events.length} EVENTS · {tasks.length} TASKS</span></div>
            {plannerView === "calendar" ? <>
              <div className="panel-card calendar-panel">
                <div className="calendar-heading"><div><h3>{calendarMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h3><p>Select a date to view or add events.</p></div><div className="calendar-nav"><button className="icon-button" aria-label="Previous month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()-1, 1))}><ChevronLeft size={17}/></button><button className="icon-button" aria-label="Next month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()+1, 1))}><ChevronRight size={17}/></button></div></div>
                <div className="calendar-grid">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}{Array.from({length: (new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay()+6)%7}, (_,i) => <div className="calendar-blank" key={`blank-${i}`}/>)}{Array.from({length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()+1, 0).getDate()}, (_,i) => { const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), i+1); const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; const count = events.filter((event) => event.date === key).length; return <button key={key} className={`calendar-day ${selectedDate === key ? "selected" : ""} ${key === localDateKey() ? "today" : ""}`} onClick={() => setSelectedDate(key)}><span>{i+1}</span>{count > 0 && <i>{count} event{count===1?"":"s"}</i>}</button>; })}</div>
              </div>
              <div className="section-heading"><div><h2>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</h2><p>Events scheduled for this date.</p></div><button className="secondary-button" onClick={() => setShowNewEvent((value) => !value)}><Plus size={14}/> Add event</button></div>
              {showNewEvent && <div className="panel-card new-event-form"><input className="field-control" value={newEventTitle} onChange={(event) => setNewEventTitle(event.target.value)} placeholder="Event title" autoFocus/><input className="field-control" value={newEventDetails} onChange={(event) => setNewEventDetails(event.target.value)} placeholder="Details (optional)"/><button className="primary-button compact" onClick={addEvent} disabled={!newEventTitle.trim()}>Save event</button><button className="icon-button" aria-label="Cancel" onClick={() => setShowNewEvent(false)}><X size={17}/></button></div>}
              <div className="event-list">{events.filter((event) => event.date === selectedDate).map((event) => <div className="event-row" key={event.id}><div className="event-marker"/><div className="event-copy"><strong>{event.title}</strong>{event.details && <small>{event.details}</small>}</div><button className="danger-icon" aria-label={`Delete ${event.title}`} onClick={() => void deleteEvent(event.id)}><Trash2 size={15}/></button></div>)}{events.every((event) => event.date !== selectedDate) && <div className="empty-event">No events on this date. Add one to start planning.</div>}</div>
            </> : <><div className="section-heading"><div><h2>Kanban board</h2><p>Move subjects and tasks through your workflow.</p></div></div><div className="kanban-grid">{([{id:"todo",label:"To do"},{id:"doing",label:"In progress"},{id:"done",label:"Completed"}] as const).map((column) => { const columnTasks = tasks.filter((task) => task.status === column.id); return <div className="kanban-column" key={column.id}><div className="kanban-heading"><span>{column.label}</span><em>{columnTasks.length}</em></div>{columnTasks.map((task) => <div className="task-card" key={task.id}><div className="task-topline"><span className={`priority-dot ${task.priority}`}/><span>{task.subject}</span></div><strong>{task.title}</strong><div className="task-actions">{column.id !== "todo" && <button aria-label="Move task left" onClick={() => moveTask(task, column.id === "done" ? "doing" : "todo")}>←</button>}{column.id !== "done" && <button aria-label="Move task right" onClick={() => moveTask(task, column.id === "todo" ? "doing" : "done")}>→</button>}<button className="delete-task" onClick={() => void db.tasks.delete(task.id)} aria-label="Delete task"><Trash2 size={13}/></button></div></div>)}{columnTasks.length === 0 && <div className="kanban-empty">No tasks here yet.</div>}</div>; })}</div></>}

          </div>}
        </div>
      </section>
    </main>
  );
}

function StatCard({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <div className="stat-card"><div className="stat-top"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span></div><strong>{value}</strong><small>{note}</small></div>;
}
function ModuleCard({ icon, number, title, description, action, onClick, tone }: { icon: React.ReactNode; number: string; title: string; description: string; action: string; onClick: () => void; tone: string }) {
  return <button className={`module-card ${tone}`} onClick={onClick}><div className="module-top"><span className="module-icon">{icon}</span><span className="module-number">{number}</span></div><h3>{title}</h3><p>{description}</p><span className="module-action">{action} <span>→</span></span></button>;
}
