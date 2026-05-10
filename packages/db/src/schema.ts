import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: ["admin", "member"] })
      .notNull()
      .default("member"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
)

export const machines = sqliteTable(
  "machines",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    specsJson: text("specs_json").notNull().default("[]"),
    accessNotes: text("access_notes").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("machines_slug_idx").on(table.slug),
  }),
)

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    machineId: text("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    type: text("type", { enum: ["normal", "maintenance"] })
      .notNull()
      .default("normal"),
    startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    machineRangeIdx: index("bookings_machine_range_idx").on(
      table.machineId,
      table.startsAt,
      table.endsAt,
    ),
  }),
)

export const bookingAuditEvents = sqliteTable("booking_audit_events", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventType: text("event_type", {
    enum: ["created", "updated", "deleted", "admin_override"],
  }).notNull(),
  reason: text("reason"),
  payloadJson: text("payload_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})
