import type { Booking, User } from "./api"

export function bookingOwnerLabel(booking: Pick<Booking, "userId">, users: User[]) {
  if ("userName" in booking && typeof booking.userName === "string" && booking.userName) {
    return booking.userName
  }

  if ("userEmail" in booking && typeof booking.userEmail === "string" && booking.userEmail) {
    return booking.userEmail
  }

  const owner = users.find((user) => user.id === booking.userId)
  return owner?.name || owner?.email || "Unknown owner"
}
