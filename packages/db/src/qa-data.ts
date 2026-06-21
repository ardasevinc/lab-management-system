import { inArray } from "drizzle-orm"
import type { Db } from "."
import {
  bookingAuditEvents,
  bookings,
  invites,
  machines,
  notificationDeliveries,
  users,
} from "./schema"
import { seedInitialData } from "./seed-data"

const qaUserIds = [
  "qa-user-ayse",
  "qa-user-deniz",
  "qa-user-burak",
  "qa-user-zeynep",
  "qa-user-disabled",
]

const qaInviteIds = qaUserIds.map((id) => `invite-${id}`)
const qaMachineIds = ["qa-machine-ada", "qa-machine-incir"]
const qaBookingIds = [
  "qa-booking-vision-training",
  "qa-booking-llm-eval",
  "qa-booking-dataset-prep",
  "qa-booking-maintenance",
  "qa-booking-weekend",
  "qa-booking-ada-cv",
]

export async function seedRealisticQaData(db: Db, now = new Date("2026-06-15T06:00:00.000Z")) {
  await seedInitialData(db, now)

  await db.transaction(async (tx) => {
    await tx
      .delete(notificationDeliveries)
      .where(inArray(notificationDeliveries.bookingId, qaBookingIds))
    await tx.delete(bookingAuditEvents).where(inArray(bookingAuditEvents.bookingId, qaBookingIds))
    await tx.delete(bookings).where(inArray(bookings.id, qaBookingIds))
    await tx.delete(invites).where(inArray(invites.id, qaInviteIds))
    await tx.delete(users).where(inArray(users.id, qaUserIds))
    await tx.delete(machines).where(inArray(machines.id, qaMachineIds))

    await tx
      .insert(users)
      .values([
        qaUser("qa-user-ayse", "ayse@miralab.tr", "Ayse Kaya", "member", true, now),
        qaUser("qa-user-deniz", "deniz@miralab.tr", "Deniz Arslan", "member", true, now),
        qaUser("qa-user-burak", "burak@miralab.tr", "Burak Yilmaz", "admin", true, now),
        qaUser("qa-user-zeynep", "zeynep@miralab.tr", "Zeynep Demir", "member", true, now),
        qaUser(
          "qa-user-disabled",
          "disabled@miralab.tr",
          "Disabled Researcher",
          "member",
          false,
          now,
        ),
      ])

    await tx
      .insert(invites)
      .values([
        qaInvite("invite-qa-user-ayse", "ayse@miralab.tr", "Ayse Kaya", "member", now),
        qaInvite("invite-qa-user-deniz", "deniz@miralab.tr", "Deniz Arslan", "member", now),
        qaInvite("invite-qa-user-burak", "burak@miralab.tr", "Burak Yilmaz", "admin", now),
        qaInvite("invite-qa-user-zeynep", "zeynep@miralab.tr", "Zeynep Demir", "member", now),
        qaInvite(
          "invite-qa-user-disabled",
          "disabled@miralab.tr",
          "Disabled Researcher",
          "member",
          now,
        ),
      ])

    await tx
      .insert(machines)
      .values([
        qaMachine(
          "qa-machine-ada",
          "ada",
          "ada",
          "Secondary GPU workstation used for model evaluation and shorter experiments.",
          ["NVIDIA RTX 4090", "128 GB RAM", "Ubuntu"],
          "SSH access is shared after approval.",
          true,
          now,
        ),
        qaMachine(
          "qa-machine-incir",
          "incir",
          "incir",
          "Offline workstation kept for driver and CUDA maintenance drills.",
          ["NVIDIA RTX 3090", "64 GB RAM"],
          "Offline until the next maintenance window clears.",
          false,
          now,
        ),
      ])

    const bookingRows = [
      qaBooking(
        "qa-booking-vision-training",
        "tohum",
        "qa-user-ayse",
        "Vision training run",
        "Long segmentation experiment.",
        "normal",
        "2026-06-15T06:00:00.000Z",
        "2026-06-15T08:00:00.000Z",
        now,
      ),
      qaBooking(
        "qa-booking-llm-eval",
        "tohum",
        "qa-user-deniz",
        "LLM eval batch",
        "Benchmark sweep for retrieval experiments.",
        "normal",
        "2026-06-16T10:00:00.000Z",
        "2026-06-16T13:00:00.000Z",
        now,
      ),
      qaBooking(
        "qa-booking-dataset-prep",
        "tohum",
        "qa-user-zeynep",
        "Dataset preprocessing",
        null,
        "normal",
        "2026-06-18T11:00:00.000Z",
        "2026-06-18T14:00:00.000Z",
        now,
      ),
      qaBooking(
        "qa-booking-maintenance",
        "tohum",
        "admin-local",
        "CUDA driver maintenance",
        "Reserved by admins for driver checks.",
        "maintenance",
        "2026-06-19T06:00:00.000Z",
        "2026-06-19T08:00:00.000Z",
        now,
      ),
      qaBooking(
        "qa-booking-weekend",
        "tohum",
        "qa-user-burak",
        "Weekend cleanup run",
        null,
        "normal",
        "2026-06-21T12:00:00.000Z",
        "2026-06-21T14:00:00.000Z",
        now,
      ),
      qaBooking(
        "qa-booking-ada-cv",
        "qa-machine-ada",
        "qa-user-ayse",
        "CV smoke tests",
        "Short test batch on the secondary workstation.",
        "normal",
        "2026-06-17T07:00:00.000Z",
        "2026-06-17T09:00:00.000Z",
        now,
      ),
    ]

    await tx.insert(bookings).values(bookingRows)
    await tx.insert(bookingAuditEvents).values(
      bookingRows.map((booking) => ({
        id: `audit-${booking.id}`,
        bookingId: booking.id,
        actorUserId: "admin-local",
        eventType: "created" as const,
        reason: "Realistic QA data",
        payloadJson: JSON.stringify(booking),
        createdAt: now,
      })),
    )
  })

  return {
    users: qaUserIds.length,
    machines: qaMachineIds.length,
    bookings: qaBookingIds.length,
  }
}

function qaUser(
  id: string,
  email: string,
  name: string,
  role: "admin" | "member",
  active: boolean,
  now: Date,
) {
  return {
    id,
    email,
    name,
    role,
    active,
    createdAt: now,
    updatedAt: now,
  }
}

function qaInvite(id: string, email: string, name: string, role: "admin" | "member", now: Date) {
  return {
    id,
    email,
    name,
    role,
    invitedByUserId: "admin-local",
    acceptedAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

function qaMachine(
  id: string,
  slug: string,
  name: string,
  description: string,
  specs: string[],
  accessNotes: string,
  active: boolean,
  now: Date,
) {
  return {
    id,
    slug,
    name,
    description,
    specsJson: JSON.stringify(specs),
    accessNotes,
    active,
    createdAt: now,
    updatedAt: now,
  }
}

function qaBooking(
  id: string,
  machineId: string,
  userId: string,
  title: string,
  notes: string | null,
  type: "normal" | "maintenance",
  startsAt: string,
  endsAt: string,
  now: Date,
) {
  return {
    id,
    machineId,
    userId,
    title,
    notes,
    type,
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}
