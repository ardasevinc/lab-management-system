import { z } from "zod"

export const machineSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  specs: z.array(z.string()),
  accessNotes: z.string(),
  active: z.boolean(),
})

export type Machine = z.infer<typeof machineSchema>

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["admin", "member"]),
  active: z.boolean(),
})

export type User = z.infer<typeof userSchema>

export const bookingSchema = z.object({
  id: z.string(),
  machineId: z.string(),
  userId: z.string(),
  title: z.string().min(1),
  notes: z.string().optional(),
  type: z.enum(["normal", "maintenance"]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
})

export type Booking = z.infer<typeof bookingSchema>

export const machines: Machine[] = [
  {
    id: "tohum",
    slug: "tohum",
    name: "tohum",
    description: "MIRALAB GPU workstation for remote AI training and research sessions.",
    specs: ["NVIDIA GPU workstation"],
    accessNotes: "",
    active: true,
  },
]
