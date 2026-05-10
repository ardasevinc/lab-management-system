export class BookingConflictError extends Error {
  constructor() {
    super("Booking overlaps an existing booking")
    this.name = "BookingConflictError"
  }
}

export class NotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(message)
    this.name = "NotFoundError"
  }
}

export class InvalidBookingRangeError extends Error {
  constructor() {
    super("Booking end time must be after start time")
    this.name = "InvalidBookingRangeError"
  }
}

export class AuthError extends Error {
  constructor(message = "Authentication failed") {
    super(message)
    this.name = "AuthError"
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message)
    this.name = "ForbiddenError"
  }
}
