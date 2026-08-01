-- Art School WhatsApp Bot — schema
-- SQLite. Kept deliberately simple for a prototype; swap for Postgres later if needed.

CREATE TABLE IF NOT EXISTS courses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,          -- e.g. Painting, Sculpture, Pottery, Kids Art
  age_group     TEXT NOT NULL,          -- e.g. "6-12 yrs", "Adults"
  description   TEXT NOT NULL,
  fee_text      TEXT NOT NULL,          -- human-readable, e.g. "₹3,500 / month"
  duration_text TEXT NOT NULL,          -- e.g. "8-week batch, 2 classes/week"
  mode_text     TEXT NOT NULL DEFAULT '',  -- e.g. "Online & offline batches available"
  image_url     TEXT,                   -- public image URL sent alongside course details
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS trial_slots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id     INTEGER NOT NULL REFERENCES courses(id),
  label         TEXT NOT NULL,          -- e.g. "Sat, 9 Aug · 10:00 AM"
  capacity      INTEGER NOT NULL DEFAULT 6,
  booked_count  INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bookings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  course_id     INTEGER NOT NULL REFERENCES courses(id),
  slot_id       INTEGER NOT NULL REFERENCES trial_slots(id),
  status        TEXT NOT NULL DEFAULT 'confirmed',  -- confirmed | cancelled
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  phone         TEXT NOT NULL UNIQUE,   -- WhatsApp number, digits only w/ country code
  name          TEXT NOT NULL,
  course_id     INTEGER REFERENCES courses(id),
  status        TEXT NOT NULL DEFAULT 'active'  -- active | inactive
);

CREATE TABLE IF NOT EXISTS class_schedule (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id     INTEGER NOT NULL REFERENCES courses(id),
  day_of_week   TEXT NOT NULL,          -- e.g. "Saturday"
  time_label    TEXT NOT NULL,          -- e.g. "10:00 AM - 11:30 AM"
  room          TEXT NOT NULL DEFAULT 'Main Studio'
);

CREATE TABLE IF NOT EXISTS fee_reminders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    INTEGER NOT NULL REFERENCES students(id),
  amount_text   TEXT NOT NULL,          -- e.g. "₹3,500"
  due_date      TEXT NOT NULL,          -- e.g. "2026-08-10"
  paid          INTEGER NOT NULL DEFAULT 0
);

-- Per-user conversation state machine + context (JSON blob)
CREATE TABLE IF NOT EXISTS conversations (
  phone         TEXT PRIMARY KEY,
  state         TEXT NOT NULL DEFAULT 'MAIN_MENU',
  context       TEXT NOT NULL DEFAULT '{}',
  needs_human   INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Log of "talk to a human" escalations, for staff to review
CREATE TABLE IF NOT EXISTS staff_alerts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  phone         TEXT NOT NULL,
  name          TEXT,
  message       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  resolved      INTEGER NOT NULL DEFAULT 0
);
