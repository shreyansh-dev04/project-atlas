import Dexie, { type EntityTable } from "dexie";

export type PageRecord = {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
};

export type TaskRecord = {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  status: "todo" | "doing" | "done";
  priority: "low" | "medium" | "high";
  dueDate?: string;
  updatedAt: number;
};

export type PlannerEventRecord = {
  id: string;
  title: string;
  date: string;
  details: string;
  createdAt: number;
};

export type MistakeRecord = {
  id: string;
  subject: string;
  chapter: string;
  question: string;
  error: string;
  correction: string;
  source: "manual" | "quiz";
  createdAt: number;
  resolved: boolean;
};

export type HabitRecord = {
  id: string;
  name: string;
  description: string;
  frequency: "daily" | "weekly";
  targetPerWeek: number;
  color: string;
  active: boolean;
  createdAt: number;
};

export type HabitEntryRecord = {
  id: string;
  habitId: string;
  date: string;
  completedAt: number;
};

export type StudySessionRecord = {
  id: string;
  subject: string;
  chapter: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
};

class AtlasDatabase extends Dexie {
  pages!: EntityTable<PageRecord, "id">;
  tasks!: EntityTable<TaskRecord, "id">;
  sessions!: EntityTable<StudySessionRecord, "id">;
  events!: EntityTable<PlannerEventRecord, "id">;
  mistakes!: EntityTable<MistakeRecord, "id">;
  habits!: EntityTable<HabitRecord, "id">;
  habitEntries!: EntityTable<HabitEntryRecord, "id">;

  constructor() {
    super("atlas-local");
    this.version(1).stores({
      pages: "id, title, category, updatedAt",
      tasks: "id, status, subject, dueDate, updatedAt",
      sessions: "id, subject, startedAt, endedAt",
    });
    this.version(2)
      .stores({
        pages: "id, title, category, isFavorite, updatedAt, *tags",
        tasks: "id, status, subject, dueDate, updatedAt",
        sessions: "id, subject, startedAt, endedAt",
      })
      .upgrade(async (transaction) => {
        await transaction.table("pages").toCollection().modify((page) => {
          page.tags = Array.isArray(page.tags) ? page.tags : [];
          page.isFavorite = Boolean(page.isFavorite);
          page.createdAt = typeof page.createdAt === "number" ? page.createdAt : page.updatedAt ?? Date.now();
        });
      });
    this.version(3).stores({
      pages: "id, title, category, isFavorite, updatedAt, *tags",
      tasks: "id, status, subject, dueDate, updatedAt",
      sessions: "id, subject, startedAt, endedAt",
      events: "id, date, createdAt",
    });
    this.version(4).stores({
      pages: "id, title, category, isFavorite, updatedAt, *tags",
      tasks: "id, status, subject, dueDate, updatedAt",
      sessions: "id, subject, startedAt, endedAt",
      events: "id, date, createdAt",
      mistakes: "id, subject, chapter, source, createdAt, resolved",
    });
    this.version(5).stores({
      pages: "id, title, category, isFavorite, updatedAt, *tags",
      tasks: "id, status, subject, dueDate, updatedAt",
      sessions: "id, subject, startedAt, endedAt",
      events: "id, date, createdAt",
      mistakes: "id, subject, chapter, source, createdAt, resolved",
      habits: "id, active, createdAt",
      habitEntries: "id, habitId, date, completedAt, [habitId+date]",
    });
  }
}

export const db = new AtlasDatabase();

export function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Save a mistake produced by an in-app quiz/test result. */
export async function recordQuizMistake(input: { subject: string; chapter?: string; question: string; error: string; correction?: string }) {
  const id = makeId();
  await db.mistakes.add({
    id,
    subject: input.subject,
    chapter: input.chapter ?? "",
    question: input.question,
    error: input.error,
    correction: input.correction ?? "",
    source: "quiz",
    createdAt: Date.now(),
    resolved: false,
  });
  return id;
}
