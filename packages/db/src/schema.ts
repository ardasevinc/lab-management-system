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
    active: integer("active", { mode: "boolean" }).notNull().default(true),
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

export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: ["admin", "member"] })
      .notNull()
      .default("member"),
    invitedByUserId: text("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: integer("accepted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("invites_email_idx").on(table.email),
  }),
)

export const otpCodes = sqliteTable(
  "otp_codes",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    code: text("code").notNull(),
    consumedAt: integer("consumed_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    emailIdx: index("otp_codes_email_idx").on(table.email),
  }),
)

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    userIdx: index("sessions_user_idx").on(table.userId),
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

export const notificationDeliveries = sqliteTable(
  "notification_deliveries",
  {
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    recipientEmail: text("recipient_email").notNull(),
    kind: text("kind", {
      enum: [
        "booking_created",
        "booking_updated",
        "booking_deleted",
        "booking_start_reminder",
        "booking_ending_reminder",
      ],
    }).notNull(),
    status: text("status", { enum: ["pending", "sent", "failed"] })
      .notNull()
      .default("pending"),
    error: text("error"),
    attemptCount: integer("attempt_count").notNull().default(0),
    scheduledFor: integer("scheduled_for", { mode: "timestamp" }).notNull(),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    idempotencyIdx: uniqueIndex("notification_deliveries_idempotency_idx").on(table.idempotencyKey),
    dueIdx: index("notification_deliveries_due_idx").on(table.status, table.scheduledFor),
  }),
)
