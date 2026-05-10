import type { Client } from "@libsql/client"

export async function migrate(client: Client) {
  await client.executeMultiple(migrationSql)
}

export const migrationSql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  specs_json TEXT NOT NULL DEFAULT '[]',
  access_notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS machines_slug_idx ON machines (slug);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY NOT NULL,
  machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  type TEXT NOT NULL DEFAULT 'normal',
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS bookings_machine_range_idx
  ON bookings (machine_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS booking_audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  reason TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
`
