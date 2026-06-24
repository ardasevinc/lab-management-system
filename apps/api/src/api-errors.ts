import {
  AuthError,
  BookingConflictError,
  ConflictError,
  ForbiddenError,
  InvalidBookingRangeError,
  NotFoundError,
  StaleBookingError,
} from "@lab/db"
import type { Context } from "hono"

export async function handleApiResult(c: Context, fn: () => Promise<Response>) {
  try {
    return await fn()
  } catch (error) {
    return apiErrorResponse(c, error)
  }
}

export function apiErrorResponse(c: Context, error: unknown) {
  if (error instanceof BookingConflictError) {
    return c.json({ error: error.message, code: "booking_conflict" }, 409)
  }

  if (error instanceof StaleBookingError) {
    return c.json({ error: error.message, code: "stale_booking" }, 409)
  }

  if (error instanceof ConflictError) {
    return c.json({ error: error.message }, 409)
  }

  if (error instanceof InvalidBookingRangeError) {
    return c.json({ error: error.message }, 400)
  }

  if (error instanceof NotFoundError) {
    return c.json({ error: error.message }, 404)
  }

  if (error instanceof AuthError) {
    return c.json({ error: error.message }, 401)
  }

  if (error instanceof ForbiddenError) {
    return c.json({ error: error.message }, 403)
  }

  throw error
}
