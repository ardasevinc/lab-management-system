import { expect, type Page, test } from "@playwright/test"

const adminEmail = "admin@miralab.tr"

test("admin can sign in and manage a tohum booking", async ({ page }) => {
  const bookingTitle = `E2E booking ${Date.now()}`

  const consoleProblems = collectConsoleProblems(page)
  await loginAsAdmin(page)

  await page.goto("/schedule")
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
  await expect(page.getByText("Week board")).toBeVisible()

  const firstDayColumn = page.locator("[data-calendar-day]").first()
  await expect(firstDayColumn).toBeVisible()
  const dayBox = await firstDayColumn.boundingBox()

  if (!dayBox) {
    throw new Error("Calendar day column did not produce a bounding box.")
  }

  await firstDayColumn.click({
    position: {
      x: dayBox.width / 2,
      y: 120,
    },
  })

  await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible()
  await page.getByLabel("Title").fill(bookingTitle)
  await page.getByRole("button", { name: "Create" }).click()

  const booking = page.getByRole("button", { name: new RegExp(bookingTitle) })
  await expect(booking).toBeVisible()

  await booking.click()
  await expect(page.getByRole("heading", { name: "Edit booking" })).toBeVisible()
  await page.getByRole("button", { name: "Delete" }).click()
  await expect(booking).toBeHidden()
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()

  expect(consoleProblems).toEqual([])
})

test("moving a booking into an occupied slot surfaces a conflict", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page)
  await loginAsAdmin(page)

  const firstTitle = `E2E movable ${Date.now()}`
  const secondTitle = `E2E occupied ${Date.now()}`
  await createBookingFromPage(page, {
    title: firstTitle,
    startsAt: "2026-06-15T07:00:00.000Z",
    endsAt: "2026-06-15T08:00:00.000Z",
  })
  await createBookingFromPage(page, {
    title: secondTitle,
    startsAt: "2026-06-15T09:00:00.000Z",
    endsAt: "2026-06-15T10:00:00.000Z",
  })

  await page.goto("/schedule")
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()

  const movableBooking = page.getByRole("button", { name: new RegExp(firstTitle) })
  await expect(movableBooking).toBeVisible()

  const bookingBox = await movableBooking.boundingBox()
  if (!bookingBox) {
    throw new Error("Seeded booking did not produce a bounding box.")
  }

  await page.mouse.move(bookingBox.x + bookingBox.width / 2, bookingBox.y + bookingBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    bookingBox.x + bookingBox.width / 2,
    bookingBox.y + bookingBox.height / 2 + 112,
    { steps: 8 },
  )
  await page.mouse.up()

  await expect(page.getByRole("alert")).toContainText("Booking overlaps an existing booking")
  await expect(page.getByRole("button", { name: new RegExp(firstTitle) })).toContainText(
    "10:00 - 11:00",
  )
  expect(unexpectedConsoleProblems(consoleProblems)).toEqual([])
})

test("resizing a booking into an occupied slot surfaces a conflict", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page)
  await loginAsAdmin(page)

  const firstTitle = `E2E resize ${Date.now()}`
  const secondTitle = `E2E resize occupied ${Date.now()}`
  await createBookingFromPage(page, {
    title: firstTitle,
    startsAt: "2026-06-16T07:00:00.000Z",
    endsAt: "2026-06-16T08:00:00.000Z",
  })
  await createBookingFromPage(page, {
    title: secondTitle,
    startsAt: "2026-06-16T08:30:00.000Z",
    endsAt: "2026-06-16T09:30:00.000Z",
  })

  await page.goto("/schedule")
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()

  const booking = page.getByRole("button", { name: new RegExp(firstTitle) })
  await expect(booking).toBeVisible()

  const bookingBox = await booking.boundingBox()
  if (!bookingBox) {
    throw new Error("Seeded booking did not produce a bounding box.")
  }

  await page.mouse.move(bookingBox.x + bookingBox.width / 2, bookingBox.y + bookingBox.height - 2)
  await page.mouse.down()
  await page.mouse.move(
    bookingBox.x + bookingBox.width / 2,
    bookingBox.y + bookingBox.height + 56,
    {
      steps: 8,
    },
  )
  await page.mouse.up()

  await expect(page.getByRole("alert")).toContainText("Booking overlaps an existing booking")
  await expect(page.getByRole("button", { name: new RegExp(firstTitle) })).toContainText(
    "10:00 - 11:00",
  )
  expect(unexpectedConsoleProblems(consoleProblems)).toEqual([])
})

function collectConsoleProblems(page: Page) {
  const consoleProblems: string[] = []

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on("pageerror", (error) => {
    consoleProblems.push(`pageerror: ${error.message}`)
  })

  return consoleProblems
}

function unexpectedConsoleProblems(consoleProblems: string[]) {
  return consoleProblems.filter(
    (problem) => !problem.includes("the server responded with a status of 409 (Conflict)"),
  )
}

async function loginAsAdmin(page: Page) {
  await page.goto("/login")
  await expect(page.getByLabel("Email")).toBeVisible()

  await page.getByLabel("Email").fill(adminEmail)
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByLabel("Login code")).toBeVisible()
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function createBookingFromPage(
  page: Page,
  booking: { title: string; startsAt: string; endsAt: string },
) {
  await page.evaluate(async (value) => {
    const token = window.localStorage.getItem("lab_session_token")
    const response = await window.fetch("/bookings", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        machineId: "tohum",
        title: value.title,
        startsAt: value.startsAt,
        endsAt: value.endsAt,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to seed booking: ${response.status} ${await response.text()}`)
    }
  }, booking)
}
