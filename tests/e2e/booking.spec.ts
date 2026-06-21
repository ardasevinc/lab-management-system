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

test("invite login links prefill the invited email", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop invite-link smoke")

  const consoleProblems = collectConsoleProblems(page)
  await page.goto("/login?email=member%40miralab.tr")

  await expect(page.getByLabel("Email")).toHaveValue("member@miralab.tr")
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByLabel("Login code")).toBeVisible()
  await expect(page.getByText("member@miralab.tr")).toBeVisible()
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
  const createdBooking = await findBookingFromPage(page, bookingTitle)

  await booking.click()
  await expect(page.getByRole("heading", { name: "Edit booking" })).toBeVisible()
  const auditHistory = page.getByRole("region", { name: "Audit history" })
  await expect(auditHistory).toBeVisible()
  await expect(auditHistory.getByText("Created")).toBeVisible()
  await expect(auditHistory.getByText(/MIRALAB Admin/)).toBeVisible()

  const updateReason = "E2E reason: adjusted by admin"
  await page.getByLabel("Admin reason").fill(updateReason)
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()

  await booking.click()
  await expect(page.getByRole("heading", { name: "Edit booking" })).toBeVisible()
  await expect(auditHistory.getByText("Updated")).toBeVisible()
  await expect(auditHistory.getByText(`Reason: ${updateReason}`)).toBeVisible()

  const deleteReason = "E2E reason: cleanup delete"
  await page.getByLabel("Admin reason").fill(deleteReason)
  await page.getByRole("button", { name: "Delete" }).click()
  await expect(page.getByRole("alertdialog", { name: "Delete booking?" })).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(page.getByRole("alertdialog", { name: "Delete booking?" })).toBeHidden()
  await expect(page.getByRole("heading", { name: "Edit booking" })).toBeVisible()
  await page.getByRole("button", { name: "Delete" }).click()
  await expect(page.getByRole("alertdialog", { name: "Delete booking?" })).toBeVisible()
  await page.getByRole("button", { name: "Delete booking" }).click()
  await expect(booking).toBeHidden()
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
  await expectAuditReasonFromPage(page, createdBooking.id, "deleted", deleteReason)

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

test("admin can edit and delete a researcher booking from the booking sheet", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop admin override flow")

  const consoleProblems = collectConsoleProblems(page)
  const bookingTitle = `E2E member owned ${Date.now()}`
  const updatedTitle = `${bookingTitle} updated`
  await loginAsAdmin(page)

  await createBookingFromPage(page, {
    title: bookingTitle,
    startsAt: "2026-06-19T07:00:00.000Z",
    endsAt: "2026-06-19T08:00:00.000Z",
    userId: "member-local",
  })

  await page.goto("/schedule")
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()

  const booking = page.getByRole("button", { name: new RegExp(bookingTitle) })
  await expect(booking).toBeVisible()
  const createdBooking = await findBookingFromPage(page, bookingTitle)
  expect(createdBooking).toEqual(expect.objectContaining({ userId: "member-local" }))

  await booking.click()
  await expect(page.getByRole("heading", { name: "Edit booking" })).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Owner" })).toContainText("MIRALAB Member")

  const updateReason = "E2E reason: admin corrected member booking"
  await page.getByLabel("Title").fill(updatedTitle)
  await page.getByLabel("Admin reason").fill(updateReason)
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
  await expect(page.getByRole("button", { name: new RegExp(updatedTitle) })).toBeVisible()
  await expectAuditReasonFromPage(page, createdBooking.id, "updated", updateReason)

  const updatedBooking = page.getByRole("button", { name: new RegExp(updatedTitle) })
  await updatedBooking.click()
  await expect(page.getByRole("heading", { name: "Edit booking" })).toBeVisible()

  const deleteReason = "E2E reason: admin cleanup member booking"
  await page.getByLabel("Admin reason").fill(deleteReason)
  await page.getByRole("button", { name: "Delete" }).click()
  await expect(page.getByRole("alertdialog", { name: "Delete booking?" })).toBeVisible()
  await page.getByRole("button", { name: "Delete booking" }).click()
  await expect(updatedBooking).toBeHidden()
  await expectAuditReasonFromPage(page, createdBooking.id, "deleted", deleteReason)
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

test("admin user disable requires confirmation", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop user-admin flow")

  const consoleProblems = collectConsoleProblems(page)
  await loginAsAdmin(page)
  await setUserActiveFromPage(page, "member-local", true)

  await page.goto("/admin/users")
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()

  const memberRow = page.locator("tbody tr").filter({ hasText: "member@miralab.tr" })
  const memberStatus = memberRow.locator("td").nth(3)
  await expect(memberRow).toBeVisible()
  const reactivateButton = memberRow.getByRole("button", { name: "Reactivate" })

  if (await reactivateButton.isVisible()) {
    await reactivateButton.click()
  }

  await expect(memberStatus).toHaveText("active")

  await memberRow.getByRole("button", { name: "Disable" }).click()
  await expect(page.getByRole("alertdialog", { name: "Disable user?" })).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(page.getByRole("alertdialog", { name: "Disable user?" })).toBeHidden()
  await expect(memberStatus).toHaveText("active")

  await memberRow.getByRole("button", { name: "Disable" }).click()
  await expect(page.getByRole("alertdialog", { name: "Disable user?" })).toBeVisible()
  await page.getByRole("button", { name: "Disable user" }).click()
  await expect(memberStatus).toHaveText("disabled")

  await memberRow.getByRole("button", { name: "Reactivate" }).click()
  await expect(memberStatus).toHaveText("active")
  expect(consoleProblems).toEqual([])
})

test("admin user role changes require confirmation", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop user-admin flow")

  const consoleProblems = collectConsoleProblems(page)
  await loginAsAdmin(page)
  await setUserRoleFromPage(page, "member-local", "member")

  await page.goto("/admin/users")
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()

  const memberRow = page.locator("tbody tr").filter({ hasText: "member@miralab.tr" })
  const roleSelect = memberRow.getByRole("combobox")
  await expect(memberRow).toBeVisible()
  await expect(roleSelect).toHaveText("Member")

  await roleSelect.click()
  await page.getByRole("option", { name: "Admin" }).click()
  await expect(page.getByRole("alertdialog", { name: "Change role?" })).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(page.getByRole("alertdialog", { name: "Change role?" })).toBeHidden()
  await expect(roleSelect).toHaveText("Member")

  await roleSelect.click()
  await page.getByRole("option", { name: "Admin" }).click()
  await expect(page.getByRole("alertdialog", { name: "Change role?" })).toBeVisible()
  await page.getByRole("button", { name: "Change role" }).click()
  await expect(roleSelect).toHaveText("Admin")

  await roleSelect.click()
  await page.getByRole("option", { name: "Member" }).click()
  await page.getByRole("button", { name: "Change role" }).click()
  await expect(roleSelect).toHaveText("Member")
  expect(consoleProblems).toEqual([])
})

test("admin invites with admin role require confirmation", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop user-admin flow")

  const consoleProblems = collectConsoleProblems(page)
  const suffix = Date.now()
  const email = `admin-invite-${suffix}@miralab.tr`
  const name = `E2E Admin ${suffix}`

  await loginAsAdmin(page)
  await page.goto("/admin/users")
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()

  await page.getByRole("button", { name: "Invite user" }).click()
  await expect(page.getByRole("heading", { name: "Invite user" })).toBeVisible()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Name").fill(name)
  await page.getByRole("combobox", { name: "Role" }).click()
  await page.getByRole("option", { name: "Admin" }).click()
  await page.getByRole("button", { name: "Send invite" }).click()

  await expect(page.getByRole("alertdialog", { name: "Invite admin?" })).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(page.getByRole("alertdialog", { name: "Invite admin?" })).toBeHidden()
  await expect(page.locator("tbody tr").filter({ hasText: email })).toHaveCount(0)

  await page.getByRole("button", { name: "Send invite" }).click()
  await expect(page.getByRole("alertdialog", { name: "Invite admin?" })).toBeVisible()
  await page.getByRole("button", { name: "Send admin invite" }).click()

  const invitedRow = page.locator("tbody tr").filter({ hasText: email })
  await expect(invitedRow).toBeVisible()
  await expect(invitedRow.getByRole("combobox")).toHaveText("Admin")
  expect(consoleProblems).toEqual([])
})

test("admin machine deletion requires confirmation", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop machine-admin flow")

  const consoleProblems = collectConsoleProblems(page)
  const suffix = Date.now()
  const machineName = `E2E GPU ${suffix}`
  const machineSlug = `e2e-gpu-${suffix}`

  await loginAsAdmin(page)
  await page.goto("/admin/machines")
  await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible()

  await page.getByRole("button", { name: "New machine" }).click()
  await expect(page.getByRole("heading", { name: "New machine" })).toBeVisible()
  await page.getByLabel("Name").fill(machineName)
  await page.getByLabel("Slug").fill(machineSlug)
  await page.getByLabel("Description").fill("Temporary e2e machine")
  await page.getByLabel("Specs").fill("Test GPU")
  await page.getByLabel("Access notes").fill("Temporary access notes")
  await page.getByRole("button", { name: "Create machine" }).click()

  const machineRow = page.getByRole("row").filter({ hasText: machineName })
  await expect(machineRow).toBeVisible()
  await machineRow.getByRole("button", { name: "Edit" }).click()
  await expect(page.getByRole("heading", { name: "Edit machine" })).toBeVisible()

  await page.getByRole("button", { name: "Delete" }).click()
  await expect(page.getByRole("alertdialog", { name: "Delete machine?" })).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(page.getByRole("alertdialog", { name: "Delete machine?" })).toBeHidden()
  await expect(page.getByRole("heading", { name: "Edit machine" })).toBeVisible()

  await page.getByRole("button", { name: "Delete" }).click()
  await expect(page.getByRole("alertdialog", { name: "Delete machine?" })).toBeVisible()
  await page.getByRole("button", { name: "Delete machine" }).click()
  await expect(machineRow).toBeHidden()
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
  await expect(page.getByRole("alertdialog", { name: "Delete booking?" })).toBeVisible()
  await page.getByRole("button", { name: "Delete booking" }).click()
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
  booking: { title: string; startsAt: string; endsAt: string; userId?: string },
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
        userId: value.userId,
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

async function setUserActiveFromPage(page: Page, id: string, active: boolean) {
  await page.evaluate(
    async ({ userId, nextActive }) => {
      const token = window.localStorage.getItem("lab_session_token")
      const response = await window.fetch(`/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ active: nextActive }),
      })

      if (!response.ok) {
        throw new Error(`Failed to update user access: ${response.status} ${await response.text()}`)
      }
    },
    { userId: id, nextActive: active },
  )
}

async function setUserRoleFromPage(page: Page, id: string, role: "admin" | "member") {
  await page.evaluate(
    async ({ userId, nextRole }) => {
      const token = window.localStorage.getItem("lab_session_token")
      const response = await window.fetch(`/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ role: nextRole }),
      })

      if (!response.ok) {
        throw new Error(`Failed to update user role: ${response.status} ${await response.text()}`)
      }
    },
    { userId: id, nextRole: role },
  )
}

async function expectAuditReasonFromPage(
  page: Page,
  bookingId: string,
  eventType: "created" | "updated" | "deleted" | "admin_override",
  reason: string,
) {
  const event = await page.evaluate(
    async ({ id, type }) => {
      const token = window.localStorage.getItem("lab_session_token")
      const response = await window.fetch(`/bookings/${id}/audit`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to list audit events: ${response.status} ${await response.text()}`)
      }

      const body = (await response.json()) as {
        events: Array<{ eventType: string; reason: string | null }>
      }
      return body.events.find((candidate) => candidate.eventType === type) ?? null
    },
    { id: bookingId, type: eventType },
  )

  expect(event).toEqual(expect.objectContaining({ reason }))
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
