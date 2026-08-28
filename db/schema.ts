import { sql } from "void/db";
import { integer, sqliteTable, text } from "void/schema-d1";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  track: text("track"),
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  durationMinutes: integer("duration_minutes"),
  day: text("day"),
  timeString: text("time_string"),
  speakers: text("speakers"),
  contentHash: text("content_hash").notNull(),
  firstSeenAt: text("first_seen_at").notNull().default(sql`(datetime('now'))`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`(datetime('now'))`),
  isDeleted: integer("is_deleted").notNull().default(0),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("user"),
  shareSchedule: integer("share_schedule").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const ingestionRuns = sqliteTable("ingestion_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  days: text("days"),
  stats: text("stats"),
  log: text("log"),
  errorMessage: text("error_message"),
  startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
});

export const userEvents = sqliteTable("user_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  eventId: text("event_id").notNull(),
  status: text("status").notNull().default("going"),
  notes: text("notes"),
  addedAt: text("added_at").notNull().default(sql`(datetime('now'))`),
});

export const friendships = sqliteTable("friendships", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  friendId: text("friend_id").notNull(),
  status: text("status").notNull().default("accepted"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const eventChanges = sqliteTable("event_changes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: text("event_id").notNull(),
  eventTitle: text("event_title").notNull(),
  changeType: text("change_type").notNull(),
  diffDetails: text("diff_details"),
  detectedAt: text("detected_at").notNull().default(sql`(datetime('now'))`),
});

export const authenticators = sqliteTable("authenticators", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  credentialId: text("credential_id").notNull(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  username: text("username"),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  contact: text("contact"),
  appVersion: text("app_version"),
  userAgent: text("user_agent"),
  pageUrl: text("page_url"),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
