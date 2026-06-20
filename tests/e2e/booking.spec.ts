import { expect, type Locator, type Page, test } from "@playwright/test"

const adminEmail = "admin@miralab.tr"
const memberEmail = "member@miralab.tr"

test("login returns users to the requested workspace route", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop route-preservation smoke")

  const consoleProblems = collectConsoleProblems(page)

  await page.goto("/machines")
  await expect(page).toHaveURL(/\/login\?redirect=%2Fmachines$/)
  await expect(page.getByLabel("Email")).toBeVisible()

  await page.getByLabel("Email").fill(adminEmail)
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByLabel("Login code")).toBeVisible()
  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(page).toHaveURL(/\/machines$/)
  await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("admin can sign in and manage a tohum booking", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop week-board flow")

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

test("admin can assign a booking to a researcher from the booking sheet", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop owner-select flow")

  const consoleProblems = collectConsoleProblems(page)
  const bookingTitle = `E2E owner ${Date.now()}`
  await loginAsAdmin(page)

  await page.goto("/schedule")
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
  await expect(page.getByText("Week board")).toBeVisible()

  const thirdDayColumn = page.locator("[data-calendar-day]").nth(2)
  await expect(thirdDayColumn).toBeVisible()
  const dayBox = await thirdDayColumn.boundingBox()

  if (!dayBox) {
    throw new Error("Calendar day column did not produce a bounding box.")
  }

  await thirdDayColumn.click({
    position: {
      x: dayBox.width / 2,
      y: 120,
    },
  })

  await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible()
  await page.getByLabel("Title").fill(bookingTitle)
  await page.getByRole("combobox", { name: "Owner" }).click()
  await page.getByRole("option", { name: /MIRALAB Member/ }).click()
  await page.getByRole("button", { name: "Create" }).click()

  const booking = page.getByRole("button", { name: new RegExp(bookingTitle) })
  await expect(booking).toBeVisible()

  const createdBooking = await findBookingFromPage(page, bookingTitle)
  expect(createdBooking).toEqual(expect.objectContaining({ userId: "member-local" }))
  await deleteBookingFromPage(page, createdBooking.id)
  expect(consoleProblems).toEqual([])
})

test("admin can create a maintenance block from the maintenance route", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop maintenance flow")

  const consoleProblems = collectConsoleProblems(page)
  const maintenanceTitle = `E2E maintenance ${Date.now()}`
  await loginAsAdmin(page)

  await page.goto("/admin/maintenance")
  await expect(page.getByRole("heading", { name: "Maintenance" })).toBeVisible()
  await page.getByRole("button", { name: "Add maintenance" }).click()

  await expect(page.getByRole("heading", { name: "New maintenance block" })).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Type" })).toHaveText("Maintenance")
  await page.getByLabel("Title").fill(maintenanceTitle)
  await page.getByRole("button", { name: "Create" }).click()

  await expect(page.locator("tbody").getByText(maintenanceTitle)).toBeVisible()

  const createdBooking = await findBookingFromPage(page, maintenanceTitle)
  expect(createdBooking).toEqual(
    expect.objectContaining({ type: "maintenance", userId: "admin-local" }),
  )
  await deleteBookingFromPage(page, createdBooking.id)
  expect(consoleProblems).toEqual([])
})

test("moving a booking into an occupied slot surfaces a conflict", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop drag flow")

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

test("resizing a booking into an occupied slot surfaces a conflict", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop resize flow")

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

test("researchers can create and delete a booking from the responsive day agenda", async ({
  page,
}, testInfo) => {
  test.skip(isDesktopProject(testInfo.project.name), "responsive day-agenda flow")

  const consoleProblems = collectConsoleProblems(page)
  const bookingTitle = `E2E responsive ${testInfo.project.name} ${Date.now()}`
  await loginAsMember(page)

  await page.goto("/admin")
  await expect(page).toHaveURL(/\/schedule$/)

  await page.goto("/schedule")
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
  await expect(page.getByText("Day agenda")).toBeVisible()
  await expect(page.getByText("Week board")).toBeHidden()

  const dayButtons = page.locator("[data-mobile-day]")
  await expect(dayButtons).toHaveCount(7)
  for (let index = 0; index < 7; index += 1) {
    await expectElementWithinViewport(page, dayButtons.nth(index))
  }

  await page.getByRole("button", { name: "Book" }).click()
  await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible()
  await page.getByLabel("Title").fill(bookingTitle)
  await page.getByRole("button", { name: "Create" }).click()

  const booking = page.getByRole("button", { name: new RegExp(bookingTitle) })
  await expect(booking).toBeVisible()

  await booking.click()
  await expect(page.getByRole("heading", { name: "Edit booking" })).toBeVisible()
  await page.getByRole("button", { name: "Delete" }).click()
  await expect(booking).toBeHidden()
  await expect(page.getByText("Day agenda")).toBeVisible()
  expect(consoleProblems).toEqual([])
})

function isDesktopProject(projectName: string) {
  return projectName === "chromium"
}

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
  await loginAs(page, adminEmail, /\/admin$/)
}

async function loginAsMember(page: Page) {
  await loginAs(page, memberEmail, /\/schedule$/)
}

async function loginAs(page: Page, email: string, expectedUrl: RegExp) {
  await page.goto("/login")
  await expect(page.getByLabel("Email")).toBeVisible()

  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByLabel("Login code")).toBeVisible()
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(expectedUrl)
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

async function findBookingFromPage(
  page: Page,
  title: string,
): Promise<{ id: string; type: "normal" | "maintenance"; userId: string }> {
  return page.evaluate(async (bookingTitle) => {
    const token = window.localStorage.getItem("lab_session_token")
    const response = await window.fetch(
      "/machines/tohum/bookings?start=2026-06-15T00%3A00%3A00.000Z&end=2026-06-22T00%3A00%3A00.000Z",
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to list bookings: ${response.status} ${await response.text()}`)
    }

    const body = (await response.json()) as {
      bookings: Array<{ id: string; title: string; type: "normal" | "maintenance"; userId: string }>
    }
    const booking = body.bookings.find((candidate) => candidate.title === bookingTitle)

    if (!booking) {
      throw new Error(`Booking not found: ${bookingTitle}`)
    }

    return { id: booking.id, type: booking.type, userId: booking.userId }
  }, title)
}

async function deleteBookingFromPage(page: Page, id: string) {
  await page.evaluate(async (bookingId) => {
    const token = window.localStorage.getItem("lab_session_token")
    const response = await window.fetch(`/bookings/${bookingId}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to delete booking: ${response.status} ${await response.text()}`)
    }
  }, id)
}

async function expectElementWithinViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox()
  const viewport = page.viewportSize()

  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()

  if (!box || !viewport) {
    return
  }

  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
}
