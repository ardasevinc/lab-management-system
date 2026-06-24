export class BookingConflictError extends Error {
  constructor() {
    super("Booking overlaps an existing booking")
    this.name = "BookingConflictError"
  }
}

export class StaleBookingError extends Error {
  constructor(message = "Booking changed since it was opened") {
    super(message)
    this.name = "StaleBookingError"
  }
}

export class ConflictError extends Error {
  constructor(message = "Resource conflict") {
    super(message)
    this.name = "ConflictError"
  }
}

export class NotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(message)
    this.name = "NotFoundError"
  }
}

export class InvalidBookingRangeError extends Error {
  constructor(message = "Booking end time must be after start time") {
    super(message)
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
