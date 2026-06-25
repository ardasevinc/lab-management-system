import { expect, type Locator, type Page, test } from "@playwright/test"

const adminEmail = "admin@example.org"
const memberEmail = "member@example.org"

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
  await expect(page.getByRole("heading", { name: "Machines", exact: true })).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("invite login links prefill the invited email", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop invite-link smoke")

  const consoleProblems = collectConsoleProblems(page)
  await page.goto("/login?email=member%40example.org")

  await expect(page.getByLabel("Email")).toHaveValue("member@example.org")
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByLabel("Login code")).toBeVisible()
  await expect(page.getByText("member@example.org")).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("mobile auth controls keep stable touch targets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile auth ergonomics")

  const consoleProblems = collectConsoleProblems(page)
  await page.goto("/login")

  await expect(page.getByLabel("Email")).toBeVisible()
  await expectMinHeight(page.getByLabel("Email"), 44)
  await expectMinHeight(page.getByRole("button", { name: "Continue" }), 44)
  await expect(page.locator(".auth-background")).toHaveCSS("position", "fixed")
  await expectAuthBackgroundOverscansViewport(page)
  await expectAuthRootBackground(page)
  await expectNoHorizontalOverflow(page)

  await page.getByLabel("Email").click()
  await page.setViewportSize({ width: 390, height: 620 })
  await expectAuthBackgroundOverscansViewport(page)
  await expectAuthRootBackground(page)
  await expectNoHorizontalOverflow(page)
  expect(consoleProblems).toEqual([])
})

test("machines route presents the selected machine cleanly", async ({ page }, testInfo) => {
  const consoleProblems = collectConsoleProblems(page)
  await loginAsMember(page)

  await page.goto("/machines")
  await expect(page.getByRole("heading", { name: "Machines", exact: true })).toBeVisible()

  const selectedMachine = page.locator("main > section").filter({
    has: page.getByRole("heading", { name: "tohum", exact: true }),
  })
  await expect(selectedMachine.getByText("available").first()).toBeVisible()
  await expect(selectedMachine.getByText("Primary spec")).toBeVisible()
  await expect(selectedMachine.getByText("Timezone")).toBeVisible()

  const inventory = page.locator("section").filter({ hasText: "All machines" })
  const selectedBadge = isDesktopProject(testInfo.project.name)
    ? inventory.getByRole("table").getByText("Selected")
    : inventory.getByRole("article").getByText("Selected")
  await expect(inventory.getByText("1 machine")).toBeVisible()
  await expect(selectedBadge).toBeVisible()
  await expect(inventory.getByRole("button", { name: "Selected machine" })).toHaveCount(0)
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
  await expect(auditHistory.getByText(/Lab Admin/)).toBeVisible()

  const updateReason = "E2E reason: adjusted by admin"
  await page.getByLabel("Audit reason").fill(updateReason)
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()

  await booking.click()
  await expect(page.getByRole("heading", { name: "Edit booking" })).toBeVisible()
  await expect(auditHistory.getByText("Updated")).toBeVisible()
  await expect(auditHistory.getByText(`Reason: ${updateReason}`)).toBeVisible()

  const deleteReason = "E2E reason: cleanup delete"
  await page.getByLabel("Audit reason").fill(deleteReason)
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

test("admin can inspect and open booking audit entries", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop admin audit flow")

  const consoleProblems = collectConsoleProblems(page)
  const bookingTitle = `E2E audit feed ${Date.now()}`
  const updateReason = "E2E audit feed reason"
  let createdBooking: { id: string } | null = null
  await loginAsAdmin(page)

  try {
    createdBooking = await createBookingFromPage(page, {
      title: bookingTitle,
      startsAt: "2026-06-25T09:00:00.000Z",
      endsAt: "2026-06-25T10:00:00.000Z",
      userId: "member-local",
    })
    await updateBookingFromPage(page, createdBooking.id, {
      title: `${bookingTitle} updated`,
      reason: updateReason,
    })

    await page.goto("/admin/audit")
    await expect(page.getByRole("heading", { name: "Booking audit" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Audit" })).toBeVisible()
    await expect(page.getByText(`${bookingTitle} updated`).first()).toBeVisible()
    await expect(page.getByText(updateReason).first()).toBeVisible()
    await expect(page.getByText("Lab Member").first()).toBeVisible()

    await page.getByLabel("Search audit").fill(`${bookingTitle} updated`)
    const auditRow = page
      .getByRole("row")
      .filter({ hasText: `${bookingTitle} updated` })
      .first()
    await expect(auditRow).toBeVisible()
    await expect(auditRow.getByText("Updated", { exact: true })).toBeVisible()
    await auditRow.getByRole("button", { name: "Open" }).click()
    await expect(page.getByRole("heading", { name: "Edit booking" })).toBeVisible()
    await expect(page.getByLabel("Title")).toHaveValue(`${bookingTitle} updated`)

    expect(consoleProblems).toEqual([])
  } finally {
    if (createdBooking) {
      await deleteBookingFromPage(page, createdBooking.id)
    }
  }
})

test("admin can drag an empty desktop range to create a booking", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop drag-create flow")

  const consoleProblems = collectConsoleProblems(page)
  const bookingTitle = `E2E drag create ${Date.now()}`
  await loginAsAdmin(page)

  await page.goto("/schedule")
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
  await expect(page.getByText("Week board")).toBeVisible()

  await dragEmptyCalendarRange(page, page.locator("[data-calendar-day]").first(), {
    startY: 112,
    endY: 224,
  })

  await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible()
  await expect(page.getByLabel("Starts time")).toHaveValue("10:00")
  await expect(page.getByLabel("Ends time")).toHaveValue("12:00")
  await page.getByLabel("Title").fill(bookingTitle)
  await page.getByRole("button", { name: "Create" }).click()

  const booking = page.getByRole("button", { name: new RegExp(bookingTitle) })
  await expect(booking).toBeVisible()
  await expect(booking).toContainText("10:00 - 12:00")

  const createdBooking = await findBookingFromPage(page, bookingTitle)
  await deleteBookingFromPage(page, createdBooking.id)
  await page.reload()
  await expect(booking).toBeHidden()
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
  await page.getByRole("option", { name: /Lab Member/ }).click()
  await page.getByRole("button", { name: "Create" }).click()

  const booking = page.getByRole("button", { name: new RegExp(bookingTitle) })
  await expect(booking).toBeVisible()
  await expect(booking).toContainText("Lab Member")

  const createdBooking = await findBookingFromPage(page, bookingTitle)
  expect(createdBooking).toEqual(expect.objectContaining({ userId: "member-local" }))
  await deleteBookingFromPage(page, createdBooking.id)
  expect(consoleProblems).toEqual([])
})

test("desktop booking toasts appear bottom-right", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop toast placement")

  const consoleProblems = collectConsoleProblems(page)
  const bookingTitle = `E2E toast ${Date.now()}`
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
      y: 196,
    },
  })

  await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible()
  await page.getByLabel("Title").fill(bookingTitle)
  await page.getByRole("button", { name: "Create" }).click()
  await expectToastInCorner(page, "Booking created", "bottom-right")

  const createdBooking = await findBookingFromPage(page, bookingTitle)
  await deleteBookingFromPage(page, createdBooking.id)
  expect(consoleProblems).toEqual([])
})

test("desktop week calendar keeps multi-day booking cards inset on hover", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop calendar event geometry")

  const consoleProblems = collectConsoleProblems(page)
  const bookingTitle = `E2E event inset ${Date.now()}`
  await loginAsAdmin(page)

  const createdBooking = await createBookingFromPage(page, {
    title: bookingTitle,
    startsAt: "2026-06-25T09:30:00.000Z",
    endsAt: "2026-06-28T10:30:00.000Z",
    userId: "member-local",
  })

  try {
    await page.goto("/schedule")
    await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
    await expect(page.getByText("Week board")).toBeVisible()

    const bookingCards = page.locator(`[data-booking-id="${createdBooking.id}"]`).filter({
      visible: true,
    })
    await expect(bookingCards).toHaveCount(4)
    await bookingCards.nth(1).hover()
    await expectBookingCardsInsetFromColumns(bookingCards, 2)
    expect(consoleProblems).toEqual([])
  } finally {
    await deleteBookingFromPage(page, createdBooking.id)
  }
})

test("booking date picker closes when reselecting the selected day", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop booking date-picker regression")

  const consoleProblems = collectConsoleProblems(page)
  await loginAsAdmin(page)

  await page.goto("/schedule")
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
  await page.getByRole("button", { name: "New booking" }).click()
  await expect(page.getByRole("heading", { name: "New booking" })).toBeVisible()

  await page.getByRole("button", { name: /^Starts date/ }).click()
  const selectedDay = page.getByRole("gridcell", { selected: true }).getByRole("button")
  await expect(selectedDay).toBeVisible()
  await selectedDay.click()
  await expect(page.getByRole("grid")).toBeHidden()

  await page.getByRole("combobox", { name: "Type" }).click()
  await expect(page.getByRole("option", { name: "Maintenance" })).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("booking sheet overlays stay inside responsive viewports", async ({ page }, testInfo) => {
  const consoleProblems = collectConsoleProblems(page)
  await loginAsAdmin(page)

  await page.goto("/schedule")
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
  if (isDesktopProject(testInfo.project.name)) {
    const weekBoard = page.locator("section").filter({ hasText: "Week board" })
    const previousWeek = weekBoard.getByRole("button", { name: "Previous week" })
    const weekPicker = weekBoard.getByRole("button", { name: /Week of/ })
    const today = weekBoard.getByRole("button", { name: "Today" })
    const nextWeek = weekBoard.getByRole("button", { name: "Next week" })
    await expectSameHeight(previousWeek, weekPicker)
    await expectSameHeight(nextWeek, weekPicker)
    await expectSameHeight(today, weekPicker)

    await weekPicker.click()
    await expectPopoverFitsCalendar(page.locator("[data-slot='popover-content']"))
    await page.keyboard.press("Escape")
  }
  const headerSidebarTrigger = page.locator("header").getByRole("button", {
    name: "Toggle Sidebar",
  })
  await expectMinSize(
    headerSidebarTrigger.locator("svg"),
    testInfo.project.name === "mobile-chromium" ? 22 : 17,
    testInfo.project.name === "mobile-chromium" ? 22 : 17,
  )
  await openNewBookingSheet(page, testInfo.project.name)

  const bookingSheet = page.getByRole("dialog", { name: "New booking" })
  await expect(bookingSheet).toBeVisible()
  await expectElementFullyWithinViewport(page, bookingSheet)
  await expectElementNoHorizontalOverflow(bookingSheet)

  await bookingSheet.getByRole("combobox", { name: "Type" }).click()
  const typeListbox = page.getByRole("listbox")
  await expect(page.getByRole("option", { name: "Maintenance" })).toBeVisible()
  await expectElementFullyWithinViewport(page, typeListbox)
  await expectElementNoHorizontalOverflow(typeListbox)
  await page.keyboard.press("Escape")

  await bookingSheet.getByRole("combobox", { name: "Owner" }).click()
  const ownerListbox = page.getByRole("listbox")
  await expect(page.getByRole("option", { name: /Lab Member/ })).toBeVisible()
  await expectElementFullyWithinViewport(page, ownerListbox)
  await expectElementNoHorizontalOverflow(ownerListbox)
  await page.keyboard.press("Escape")

  await expectMinSize(
    bookingSheet.locator("[data-slot='sheet-close'] svg"),
    testInfo.project.name === "mobile-chromium" ? 22 : 17,
    testInfo.project.name === "mobile-chromium" ? 22 : 17,
  )

  if (testInfo.project.name === "mobile-chromium") {
    const startsDateInput = bookingSheet.getByLabel("Starts date")
    const startsTimeInput = bookingSheet.getByLabel("Starts time")
    const nativePickerFields = bookingSheet.locator("[data-native-picker-field]")
    await expect(nativePickerFields).toHaveCount(4)
    await expect(startsDateInput).toHaveAttribute("type", "date")
    await expect(startsTimeInput).toHaveAttribute("type", "time")
    await expect(startsDateInput).toHaveCSS("opacity", "0")
    await expect(startsTimeInput).toHaveCSS("opacity", "0")
    await expect(bookingSheet.getByRole("grid")).toHaveCount(0)

    await expectMinHeight(bookingSheet.getByLabel("Title"), 44)
    for (let index = 0; index < 4; index += 1) {
      await expectMinHeight(nativePickerFields.nth(index), 48)
      await expectElementNoHorizontalOverflow(nativePickerFields.nth(index))
    }
    await expectMinHeight(startsDateInput, 44)
    await expectMinHeight(startsTimeInput, 44)
    await expectElementNoHorizontalOverflow(bookingSheet)
  } else {
    await bookingSheet.getByRole("button", { name: /^Starts date/ }).click()
    const dateGrid = page.getByRole("grid")
    await expect(dateGrid).toBeVisible()
    await expectElementFullyWithinViewport(page, dateGrid)
    await expectPopoverFitsCalendar(page.locator("[data-slot='popover-content']"))
  }

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
  await expect(page.getByRole("combobox", { name: "Owner" })).toContainText("Lab Member")

  const updateReason = "E2E reason: admin corrected member booking"
  await page.getByLabel("Title").fill(updatedTitle)
  await page.getByLabel("Audit reason").fill(updateReason)
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
  await expect(page.getByRole("button", { name: new RegExp(updatedTitle) })).toBeVisible()
  await expectAuditReasonFromPage(page, createdBooking.id, "updated", updateReason)

  const updatedBooking = page.getByRole("button", { name: new RegExp(updatedTitle) })
  await updatedBooking.click()
  await expect(page.getByRole("heading", { name: "Edit booking" })).toBeVisible()

  const deleteReason = "E2E reason: admin cleanup member booking"
  await page.getByLabel("Audit reason").fill(deleteReason)
  await page.getByRole("button", { name: "Delete" }).click()
  await expect(page.getByRole("alertdialog", { name: "Delete booking?" })).toBeVisible()
  await page.getByRole("button", { name: "Delete booking" }).click()
  await expect(updatedBooking).toBeHidden()
  await expectAuditReasonFromPage(page, createdBooking.id, "deleted", deleteReason)
  expect(consoleProblems).toEqual([])
})

test("researchers can edit move resize and delete their own desktop bookings", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop member lifecycle flow")

  const consoleProblems = collectConsoleProblems(page)
  const bookingTitle = `E2E member lifecycle ${Date.now()}`
  const updatedTitle = `${bookingTitle} updated`
  await loginAsMember(page)

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
  expect(createdBooking).toEqual(expect.objectContaining({ userId: "member-local" }))

  await booking.click()
  await expect(page.getByRole("heading", { name: "Edit booking" })).toBeVisible()
  await page.getByLabel("Title").fill(updatedTitle)
  await page.getByRole("button", { name: "Save" }).click()

  const updatedBooking = page.getByRole("button", { name: new RegExp(updatedTitle) })
  await expect(updatedBooking).toBeVisible()

  const movedBooking = await dragBookingBy(page, updatedBooking, { x: 0, y: 56 })
  await expect(movedBooking).toContainText("11:00 - 12:00")

  const resizedBooking = await resizeBookingEndBy(page, movedBooking, 28)
  await expect(resizedBooking).toContainText("11:00 - 12:30")

  await resizedBooking.click()
  await expect(page.getByRole("heading", { name: "Edit booking" })).toBeVisible()
  await page.getByRole("button", { name: "Delete" }).click()
  await expect(page.getByRole("alertdialog", { name: "Delete booking?" })).toBeVisible()
  await page.getByRole("button", { name: "Delete booking" }).click()
  await expect(resizedBooking).toBeHidden()

  expect(unexpectedConsoleProblems(consoleProblems)).toEqual([])
})

test("admin can create a maintenance block from the maintenance route", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop maintenance flow")

  const consoleProblems = collectConsoleProblems(page)
  const maintenanceTitle = `E2E maintenance ${Date.now()}`
  await loginAsAdmin(page)

  await page.goto("/admin/maintenance")
  await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Add maintenance" }).click()

  await expect(page.getByRole("heading", { name: "New maintenance block" })).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Type" })).toHaveText("Maintenance")
  await page.getByLabel("Title").fill(maintenanceTitle)
  await page.getByRole("button", { name: "Create" }).click()

  await expect(page.locator("tbody").getByText(maintenanceTitle)).toBeVisible()
  await expect(page.getByText("1 block").first()).toBeVisible()
  await expect(page.getByText("1h reserved")).toBeVisible()
  await page.getByRole("button", { name: `Edit ${maintenanceTitle}` }).click()
  await expect(page.getByRole("heading", { name: "Edit maintenance block" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("heading", { name: "Edit maintenance block" })).toBeHidden()

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

  const memberRow = page.locator("tbody tr").filter({ hasText: "member@example.org" })
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

  const memberRow = page.locator("tbody tr").filter({ hasText: "member@example.org" })
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

test("admin users filter keeps member management scannable", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page)
  await loginAsAdmin(page)

  await page.goto("/admin/users")
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()

  const membersPanel = page.locator("section").filter({ hasText: "Members" })
  const userStats = membersPanel.locator("dl")
  await expectVisibleText(membersPanel, "admin@example.org")
  await expectVisibleText(membersPanel, "member@example.org")
  await expect(userStats.getByText("Total").locator("..")).toContainText("2")
  await expect(userStats.getByText("Active").locator("..")).toContainText("2")
  await expect(userStats.getByText("Admins").locator("..")).toContainText("1")
  await expect(userStats.getByText("Members").locator("..")).toContainText("1")
  await expect(userStats.getByText("Disabled").locator("..")).toContainText("0")

  await page.getByLabel("Filter users").fill("member")
  await expectVisibleText(membersPanel, "member@example.org")
  await expectNoVisibleText(membersPanel, "admin@example.org")
  await expect(membersPanel.getByText("1/2 shown")).toBeVisible()

  await page.getByLabel("Filter users").fill("no-such-user")
  await expect(membersPanel.getByText("No matching users")).toBeVisible()
  await page.getByRole("button", { name: "Clear filter" }).click()
  await expectVisibleText(membersPanel, "admin@example.org")
  await expectVisibleText(membersPanel, "member@example.org")
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

test("admin machine deactivation is visible and confirmed", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop machine-admin flow")

  const consoleProblems = collectConsoleProblems(page)
  await loginAsAdmin(page)
  await setMachineActiveFromPage(page, "tohum", true)

  await page.goto("/admin/machines")
  await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible()

  const machineRow = page.getByRole("row").filter({ hasText: "tohum" })
  const machineState = machineRow.locator("td").nth(1)
  await expect(machineRow).toBeVisible()
  await expect(machineState).toHaveText("available")

  await machineRow.getByRole("button", { name: "Deactivate" }).click()
  await expect(page.getByRole("alertdialog", { name: "Deactivate machine?" })).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(page.getByRole("alertdialog", { name: "Deactivate machine?" })).toBeHidden()
  await expect(machineState).toHaveText("available")

  await machineRow.getByRole("button", { name: "Deactivate" }).click()
  await expect(page.getByRole("alertdialog", { name: "Deactivate machine?" })).toBeVisible()
  await page.getByRole("button", { name: "Deactivate machine" }).click()
  await expect(machineState).toHaveText("inactive")

  await machineRow.getByRole("button", { name: "Reactivate" }).click()
  await expect(machineState).toHaveText("available")
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

test("mobile day agenda shows multi-day bookings on later days", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile multi-day agenda regression")

  const consoleProblems = collectConsoleProblems(page)
  const bookingTitle = `E2E multi-day mobile ${Date.now()}`
  await loginAsMember(page)

  const createdBooking = await createBookingFromPage(page, {
    title: bookingTitle,
    startsAt: "2026-06-25T09:30:00.000Z",
    endsAt: "2026-06-28T10:30:00.000Z",
    userId: "member-local",
  })

  try {
    await page.goto("/schedule")
    await expect(page.getByText("Day agenda")).toBeVisible()
    const booking = page.getByRole("button", { name: new RegExp(bookingTitle) })
    await expect(booking).toBeVisible()
    await expect(booking).toContainText("Lab Member")
    await expect(booking).toContainText("12:30 - 24:00")
    await expect(booking).not.toContainText("continues")

    for (let index = 0; index < 3; index += 1) {
      await page.getByRole("button", { name: "Next day" }).click()
    }

    const finalDayBooking = page.getByRole("button", { name: new RegExp(bookingTitle) })
    await expect(finalDayBooking).toBeVisible()
    await expect(finalDayBooking).not.toContainText("starts earlier")
    await expect(finalDayBooking).toContainText("00:00 - 13:30")
    await expect(consoleProblems).toEqual([])
  } finally {
    await deleteBookingFromPage(page, createdBooking.id)
  }
})

test("mobile day agenda scroll does not open a booking sheet", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile scroll ergonomics")

  const consoleProblems = collectConsoleProblems(page)
  await loginAsMember(page)

  await page.goto("/schedule")
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
  await expect(page.getByText("Day agenda")).toBeVisible()
  await expectNoHorizontalOverflow(page)

  const agendaDayInput = page.getByLabel("Agenda day")
  await expect(agendaDayInput).toHaveAttribute("type", "date")
  await expectMinHeight(agendaDayInput, 44)
  await expect(page.getByRole("button", { name: "Previous day" })).toBeVisible()
  await expectMinSize(page.getByRole("button", { name: "Previous day" }).locator("svg"), 22, 22)
  await expect(page.getByRole("button", { name: "Next day" })).toBeVisible()
  await expectMinSize(page.getByRole("button", { name: "Next day" }).locator("svg"), 22, 22)
  await expectMaxSize(page.locator("[data-mobile-day-timeline-header] svg"), 16, 16)
  await expect(page.locator("main").getByRole("grid")).toHaveCount(0)

  const activeDay = page.locator("[data-mobile-day][data-active=true]")
  const activeDayBefore = await activeDay.innerText()
  await page.getByRole("button", { name: "Next day" }).click()
  await expect.poll(() => activeDay.innerText()).not.toBe(activeDayBefore)

  await agendaDayInput.fill("2026-06-23", { force: true })
  await expect(activeDay).toContainText("23")

  const timeline = page.locator("[data-mobile-day-timeline]")
  await expect(timeline).toBeVisible()
  const timelineBox = await timeline.boundingBox()
  if (!timelineBox) {
    throw new Error("Mobile timeline did not produce a bounding box.")
  }

  await page.mouse.move(timelineBox.x + timelineBox.width / 2, timelineBox.y + 220)
  await page.mouse.down()
  await page.mouse.move(timelineBox.x + timelineBox.width / 2, timelineBox.y + 80)
  await page.mouse.up()
  await expect(page.getByRole("heading", { name: "New booking" })).toHaveCount(0)

  const beforeScroll = await timeline.evaluate((element) => element.scrollTop)
  await timeline.hover()
  await page.mouse.wheel(0, 260)
  await expect
    .poll(() => timeline.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(beforeScroll)
  await expect(page.getByRole("heading", { name: "New booking" })).toHaveCount(0)
  expect(consoleProblems).toEqual([])
})

test("admin responsive shell keeps navigation and account menu usable", async ({
  page,
}, testInfo) => {
  test.skip(isDesktopProject(testInfo.project.name), "responsive shell flow")

  const consoleProblems = collectConsoleProblems(page)
  await loginAsAdmin(page)

  await page.goto("/admin")
  await expect(page.getByRole("heading", { name: "Admin overview" })).toBeVisible()
  await expectReminderSummarySpansResponsiveGrid(page)

  await page.goto("/schedule")
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
  const headerSidebarTrigger = page.locator("header").getByRole("button", {
    name: "Toggle Sidebar",
  })

  if (testInfo.project.name === "mobile-chromium") {
    await expectMinHeight(headerSidebarTrigger, 44)
    await expectMinSize(headerSidebarTrigger.locator("svg"), 22, 22)
    await expect(page.locator("header [data-slot='separator']")).toBeHidden()

    await headerSidebarTrigger.click()
    const sidebar = page.getByRole("dialog", { name: "Sidebar" })
    await expect(sidebar).toBeVisible()
    await expectElementNoHorizontalOverflow(sidebar)
    await expect(sidebar.getByRole("link", { name: "Schedule" })).toBeVisible()
    await expectMinHeight(sidebar.getByRole("link", { name: "Schedule" }), 44)
    await expect(sidebar.getByRole("link", { name: "Machines" })).toHaveCount(2)
    await expect(sidebar.getByRole("link", { name: "Users" })).toBeVisible()

    await sidebar.getByRole("link", { name: "Users" }).click()
    await expect(page).toHaveURL(/\/admin\/users$/)
    await expect(sidebar).toBeHidden()
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()

    await headerSidebarTrigger.click()
    await expect(sidebar).toBeVisible()
    await sidebar.getByRole("button").filter({ hasText: "Lab Admin" }).click()
  } else {
    await expect(page.getByRole("link", { name: "Schedule" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Machines" })).toHaveCount(2)
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible()

    await page.getByRole("link", { name: "Users" }).click()
    await expect(page).toHaveURL(/\/admin\/users$/)
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()

    await page.getByRole("button").filter({ hasText: "Lab Admin" }).click()
  }

  const accountMenu = page.getByRole("menu")
  await expect(accountMenu).toBeVisible()
  await expect(accountMenu.getByText("Lab Admin")).toBeVisible()
  await expect(accountMenu.getByText("admin@example.org")).toBeVisible()
  await expect(accountMenu.getByText("Admin", { exact: true })).toBeVisible()
  await expect(accountMenu.getByRole("menuitem", { name: "Log out" })).toBeVisible()
  await expectElementWithinViewport(page, accountMenu)

  expect(consoleProblems).toEqual([])
})

test("desktop collapsed sidebar keeps rail chrome aligned", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop collapsed sidebar regression")

  const consoleProblems = collectConsoleProblems(page)
  await loginAsAdmin(page)

  await page.goto("/schedule")
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()

  const expandedAccountButton = page.getByRole("button", { name: /Open account menu/ })
  await expectMinSize(expandedAccountButton.locator("[data-slot='avatar']"), 32, 32)

  await page.locator("header").getByRole("button", { name: "Toggle Sidebar" }).click()
  await expect(page.locator("div[data-slot='sidebar'][data-state='collapsed']")).toBeVisible()

  const sidebar = page.locator("[data-slot='sidebar-container']")
  await expect
    .poll(async () => {
      const box = await sidebar.boundingBox()
      return box?.width ?? Number.POSITIVE_INFINITY
    })
    .toBeLessThanOrEqual(72)
  const brandMark = sidebar.locator("[data-slot='brand-mark']")
  const scheduleLink = sidebar.getByRole("link", { name: "Schedule" })
  const overviewLink = sidebar.getByRole("link", { name: "Overview" })
  const accountButton = sidebar.getByRole("button", { name: /Open account menu/ })
  const accountAvatar = accountButton.locator("[data-slot='avatar']")

  await expectSameCenterX([brandMark, scheduleLink, overviewLink, accountAvatar], 1.5)
  await expectMinSize(brandMark, 36, 36)
  await expectMinSize(scheduleLink, 36, 36)
  await expectMinSize(scheduleLink.locator("svg"), 20, 20)
  await expectMinSize(overviewLink.locator("svg"), 20, 20)
  await expectMinSize(accountButton, 36, 36)
  await expectMinSize(accountAvatar, 32, 32)
  await accountButton.hover()
  await expectMinBorderRadius(accountButton, 18)
  expect(consoleProblems).toEqual([])
})

test("member workspace refresh keeps admin navigation hidden", async ({ page }, testInfo) => {
  const consoleProblems = collectConsoleProblems(page)
  await loginAsMember(page)

  await page.goto("/schedule")
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
  await installAuthScreenObserver(page)
  await page.reload()
  await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
  await expect(page.getByLabel("Email")).toBeHidden()
  expect(await authScreenWasObserved(page)).toBe(false)

  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Toggle Sidebar" }).click()
    const sidebar = page.getByRole("dialog", { name: "Sidebar" })
    await expectMemberNavigation(sidebar)
    await expectElementWithinViewport(page, sidebar)
  } else {
    await expectMemberNavigation(page)
  }

  expect(consoleProblems).toEqual([])
})

test("admin tablet routes keep seeded data and admin sheets usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "tablet-chromium", "tablet admin route flow")

  const consoleProblems = collectConsoleProblems(page)
  await loginAsAdmin(page)

  await page.goto("/schedule")
  await expect(page.getByText("Day agenda")).toBeVisible()
  await expect(page.getByText("Week board")).toBeHidden()
  await expectRouteContentWithinViewport(page)

  await page.goto("/admin")
  await expect(page.getByRole("heading", { name: "Admin overview" })).toBeVisible()
  await expect(page.getByText("Week queue")).toBeVisible()
  await expect(page.getByText("Machine status")).toBeVisible()
  await expect(page.getByText("Access notes")).toBeVisible()
  await expect(page.getByText("Not configured")).toBeVisible()
  await expect(page.getByText("Reminders", { exact: true })).toBeVisible()
  await expect(page.getByText("Disabled", { exact: true })).toBeVisible()
  await expect(page.getByText("Start/end reminders off")).toBeVisible()
  await expect(page.getByText("No notes")).toHaveCount(0)
  await expectRouteContentWithinViewport(page)

  await page.getByRole("link", { name: "Users" }).click()
  await expect(page).toHaveURL(/\/admin\/users$/)
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()
  const membersPanel = page.locator("section").filter({ hasText: "Members" })
  await expect(membersPanel.getByText("admin@example.org").first()).toBeVisible()
  await expect(membersPanel.getByText("member@example.org").first()).toBeVisible()
  await expectRouteContentWithinViewport(page)

  await page.getByRole("button", { name: "Invite user" }).click()
  const inviteSheet = page.getByRole("dialog", { name: "Invite user" })
  await expect(inviteSheet).toBeVisible()
  await expect(inviteSheet.getByLabel("Email")).toBeVisible()
  await expect(inviteSheet.getByRole("combobox", { name: "Role" })).toHaveText("Member")
  await expectElementWithinViewport(page, inviteSheet)
  await expectElementNoHorizontalOverflow(inviteSheet)
  await page.keyboard.press("Escape")
  await expect(inviteSheet).toBeHidden()

  await page.getByRole("link", { name: "Machines" }).nth(1).click()
  await expect(page).toHaveURL(/\/admin\/machines$/)
  await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "tohum" })).toBeVisible()
  await expectRouteContentWithinViewport(page)

  await page.getByRole("button", { name: "Edit machine" }).first().click()
  const machineSheet = page.getByRole("dialog", { name: "Edit machine" })
  await expect(machineSheet).toBeVisible()
  await expect(machineSheet.getByLabel("Booking state")).toHaveText("Available")
  await expect(machineSheet.getByLabel("Access notes")).toBeVisible()
  await expectElementWithinViewport(page, machineSheet)
  await expectElementNoHorizontalOverflow(machineSheet)
  await page.keyboard.press("Escape")
  await expect(machineSheet).toBeHidden()

  await page.getByRole("link", { name: "Maintenance" }).click()
  await expect(page).toHaveURL(/\/admin\/maintenance$/)
  await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Add maintenance" }).click()
  const maintenanceSheet = page.getByRole("dialog", { name: "New maintenance block" })
  await expect(maintenanceSheet).toBeVisible()
  await expect(maintenanceSheet.getByRole("combobox", { name: "Type" })).toHaveText("Maintenance")
  await expectElementWithinViewport(page, maintenanceSheet)

  expect(consoleProblems).toEqual([])
})

test("admin route and sheet surfaces stay usable with mixed lab data", async ({
  page,
}, testInfo) => {
  const consoleProblems = collectConsoleProblems(page)
  const suffix = `${testInfo.project.name}-${Date.now()}`
  const seededBookings: string[] = []

  await loginAsAdmin(page)

  for (const booking of [
    {
      title: `E2E mixed admin ${suffix}`,
      startsAt: "2026-06-25T07:00:00.000Z",
      endsAt: "2026-06-25T08:00:00.000Z",
    },
    {
      title: `E2E mixed member ${suffix}`,
      startsAt: "2026-06-25T09:00:00.000Z",
      endsAt: "2026-06-25T10:00:00.000Z",
      userId: "member-local",
    },
    {
      title: `E2E mixed maintenance ${suffix}`,
      startsAt: "2026-06-26T11:00:00.000Z",
      endsAt: "2026-06-26T12:00:00.000Z",
      type: "maintenance" as const,
    },
  ]) {
    const created = await createBookingFromPage(page, booking)
    seededBookings.push(created.id)
  }

  try {
    await page.goto("/schedule")
    await expect(page.getByRole("heading", { name: /tohum schedule/i })).toBeVisible()
    if (isDesktopProject(testInfo.project.name)) {
      await expect(
        page.getByRole("button", { name: new RegExp(`E2E mixed admin ${suffix}`) }),
      ).toBeVisible()
    } else {
      await expect(page.getByText("Day agenda")).toBeVisible()
    }
    await expectRouteContentWithinViewport(page)

    await openNewBookingSheet(page, testInfo.project.name)
    const bookingSheet = page.getByRole("dialog", { name: "New booking" })
    await expect(bookingSheet).toBeVisible()
    await expect(bookingSheet.getByLabel("Title")).toBeVisible()
    await expectElementFullyWithinViewport(page, bookingSheet)
    await page.keyboard.press("Escape")
    await expect(bookingSheet).toBeHidden()

    await page.goto("/machines")
    await expect(page.getByRole("heading", { name: "Machines", exact: true })).toBeVisible()
    await expectVisibleText(page.locator("main"), "tohum")
    await expectRouteContentWithinViewport(page)

    await page.goto("/admin")
    await expect(page.getByRole("heading", { name: "Admin overview" })).toBeVisible()
    await expect(page.getByText("Week queue")).toBeVisible()
    await expect(page.getByText("Machine status")).toBeVisible()
    await expectRouteContentWithinViewport(page)

    await page.goto("/admin/users")
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()
    await expect(page.locator("section").filter({ hasText: "Members" })).toBeVisible()
    await expectRouteContentWithinViewport(page)
    await page.getByRole("button", { name: "Invite user" }).click()
    const inviteSheet = page.getByRole("dialog", { name: "Invite user" })
    await expect(inviteSheet).toBeVisible()
    await expect(inviteSheet.getByRole("combobox", { name: "Role" })).toHaveText("Member")
    await expectElementFullyWithinViewport(page, inviteSheet)
    await expectElementNoHorizontalOverflow(inviteSheet)
    await page.keyboard.press("Escape")
    await expect(inviteSheet).toBeHidden()

    await page.goto("/admin/machines")
    await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible()
    await expectVisibleText(page.locator("main"), "tohum")
    await expectRouteContentWithinViewport(page)
    await page.getByRole("button", { name: "New machine" }).click()
    const machineSheet = page.getByRole("dialog", { name: "New machine" })
    await expect(machineSheet).toBeVisible()
    await expectElementNoHorizontalOverflow(machineSheet)
    await expect(machineSheet.getByLabel("Name")).toBeVisible()
    await expectElementFullyWithinViewport(page, machineSheet)
    await page.keyboard.press("Escape")
    await expect(machineSheet).toBeHidden()

    await page.goto("/admin/audit")
    await expect(page.getByRole("heading", { name: "Booking audit" })).toBeVisible()
    await expectVisibleText(page.locator("main"), `E2E mixed admin ${suffix}`)
    await expectRouteContentWithinViewport(page)

    await page.goto("/admin/maintenance")
    await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible()
    await expectVisibleText(page.locator("main"), `E2E mixed maintenance ${suffix}`)
    await expectRouteContentWithinViewport(page)
    await page.getByRole("button", { name: "Add maintenance" }).click()
    const maintenanceSheet = page.getByRole("dialog", { name: "New maintenance block" })
    await expect(maintenanceSheet).toBeVisible()
    await expect(maintenanceSheet.getByRole("combobox", { name: "Type" })).toHaveText("Maintenance")
    await expectElementFullyWithinViewport(page, maintenanceSheet)

    expect(consoleProblems).toEqual([])
  } finally {
    for (const bookingId of seededBookings) {
      await deleteBookingFromPage(page, bookingId)
    }
  }
})

test("admin empty states expose primary recovery actions", async ({ page }, testInfo) => {
  test.skip(!isDesktopProject(testInfo.project.name), "desktop admin empty-state flow")

  const consoleProblems = collectConsoleProblems(page)
  await page.route("**/admin/users", async (route) => {
    if (route.request().resourceType() !== "fetch") {
      await route.continue()
      return
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ users: [] }),
    })
  })

  await loginAsAdmin(page)
  await page.goto("/admin/users")
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()
  await expect(page.getByText("No members yet")).toBeVisible()
  await page.getByRole("button", { name: "Invite user" }).last().click()
  await expect(page.getByRole("dialog", { name: "Invite user" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Invite user" })).toBeHidden()

  await page.unroute("**/admin/users")
  await page.route("**/machines", async (route) => {
    if (route.request().resourceType() !== "fetch") {
      await route.continue()
      return
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ machines: [] }),
    })
  })
  await page.reload()
  await page.goto("/admin/machines")
  await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible()
  await expect(page.getByText("No machines configured")).toBeVisible()
  await page.getByRole("button", { name: "New machine" }).last().click()
  await expect(page.getByRole("dialog", { name: "New machine" })).toBeVisible()

  expect(consoleProblems).toEqual([])
})

test("machine inventory filter keeps dense labs scannable", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page)
  await page.route("**/machines", async (route) => {
    if (route.request().resourceType() !== "fetch") {
      await route.continue()
      return
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        machines: [
          {
            id: "machine-tohum",
            slug: "tohum",
            name: "tohum",
            description: "MIRALAB GPU workstation for remote AI training and research.",
            specs: ["NVIDIA GPU workstation"],
            accessNotes: "Shared over ZeroTier by admins.",
            active: true,
          },
          {
            id: "machine-vision",
            slug: "vision-rig",
            name: "vision-rig",
            description: "Camera calibration and embedded inference bench.",
            specs: ["Jetson Orin", "Basler camera"],
            accessNotes: "Lab-only bench.",
            active: false,
          },
        ],
      }),
    })
  })

  await loginAsAdmin(page)
  await page.goto("/admin/machines")
  await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible()

  const inventory = page.locator("section").filter({ hasText: "Machine inventory" })
  await expect(page.getByLabel("Filter machines")).toBeVisible()
  await expectVisibleText(inventory, "tohum")
  await expectVisibleText(inventory, "vision-rig")

  await page.getByLabel("Filter machines").fill("jetson")
  await expectVisibleText(inventory, "vision-rig")
  await expectNoVisibleText(inventory, "tohum")
  await expect(inventory.getByText("1/2 shown")).toBeVisible()

  await page.getByLabel("Filter machines").fill("no-such-machine")
  await expect(inventory.getByText("No matching machines")).toBeVisible()
  await page.getByRole("button", { name: "Clear filter" }).click()
  await expectVisibleText(inventory, "tohum")
  await expectVisibleText(inventory, "vision-rig")
  expect(consoleProblems).toEqual([])
})

test("machines route keeps inactive machines visible but not schedulable", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page)
  await page.route("**/machines", async (route) => {
    if (route.request().resourceType() !== "fetch") {
      await route.continue()
      return
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        machines: [
          {
            id: "machine-tohum",
            slug: "tohum",
            name: "tohum",
            description: "MIRALAB GPU workstation for remote AI training and research.",
            specs: ["NVIDIA GPU workstation"],
            accessNotes: "",
            active: true,
          },
          {
            id: "machine-ada",
            slug: "ada",
            name: "ada",
            description: "Secondary GPU workstation.",
            specs: ["NVIDIA RTX 4090"],
            accessNotes: "",
            active: true,
          },
          {
            id: "machine-incir",
            slug: "incir",
            name: "incir",
            description: "Offline workstation kept for maintenance drills.",
            specs: ["NVIDIA RTX 3090"],
            accessNotes: "",
            active: false,
          },
        ],
      }),
    })
  })

  await loginAsAdmin(page)
  await page.goto("/machines")
  await expect(page.getByRole("heading", { name: "Machines", exact: true })).toBeVisible()

  const inventory = page.locator("section").filter({ hasText: "All machines" })
  const adaRow = inventory.locator('[data-machine-slug="ada"]').filter({ visible: true })
  const incirRow = inventory.locator('[data-machine-slug="incir"]').filter({ visible: true })
  await expect(adaRow).toBeVisible()
  await expect(incirRow).toBeVisible()
  await expect(inventory.getByRole("button", { name: "Use for schedule" })).toHaveCount(1)
  await expect(adaRow.getByRole("button", { name: "Use for schedule" })).toBeVisible()
  await expect(incirRow.getByRole("button", { name: "Use for schedule" })).toHaveCount(0)
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
  booking: {
    title: string
    startsAt: string
    endsAt: string
    userId?: string
    type?: "normal" | "maintenance"
  },
) {
  return page
    .evaluate(async (value) => {
      const response = await window.fetch("/bookings", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          machineId: "tohum",
          title: value.title,
          startsAt: value.startsAt,
          endsAt: value.endsAt,
          userId: value.userId,
          type: value.type,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to seed booking: ${response.status} ${await response.text()}`)
      }

      return (await response.json()) as { booking: { id: string } }
    }, booking)
    .then((body) => body.booking)
}

async function updateBookingFromPage(
  page: Page,
  id: string,
  booking: {
    title?: string
    startsAt?: string
    endsAt?: string
    userId?: string
    type?: "normal" | "maintenance"
    reason?: string
  },
) {
  return page.evaluate(
    async ({ bookingId, value }) => {
      const response = await window.fetch(`/bookings/${bookingId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(value),
      })

      if (!response.ok) {
        throw new Error(`Failed to update booking: ${response.status} ${await response.text()}`)
      }

      return (await response.json()) as { booking: { id: string } }
    },
    { bookingId: id, value: booking },
  )
}

async function findBookingFromPage(
  page: Page,
  title: string,
): Promise<{ id: string; type: "normal" | "maintenance"; userId: string }> {
  return page.evaluate(async (bookingTitle) => {
    const response = await window.fetch(
      "/machines/tohum/bookings?start=2026-01-01T00%3A00%3A00.000Z&end=2027-01-01T00%3A00%3A00.000Z",
      {
        credentials: "include",
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
    const response = await window.fetch(`/bookings/${bookingId}`, {
      method: "DELETE",
      credentials: "include",
    })

    if (!response.ok) {
      throw new Error(`Failed to delete booking: ${response.status} ${await response.text()}`)
    }
  }, id)
}

async function setUserActiveFromPage(page: Page, id: string, active: boolean) {
  await page.evaluate(
    async ({ userId, nextActive }) => {
      const response = await window.fetch(`/admin/users/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
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
      const response = await window.fetch(`/admin/users/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
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

async function setMachineActiveFromPage(page: Page, id: string, active: boolean) {
  await page.evaluate(
    async ({ machineId, nextActive }) => {
      const response = await window.fetch(`/admin/machines/${machineId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ active: nextActive }),
      })

      if (!response.ok) {
        throw new Error(
          `Failed to update machine access: ${response.status} ${await response.text()}`,
        )
      }
    },
    { machineId: id, nextActive: active },
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
      const response = await window.fetch(`/bookings/${id}/audit`, {
        credentials: "include",
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
  await expect(locator).toBeVisible()
  await expect
    .poll(async () => {
      const box = await locator.boundingBox()
      const viewport = page.viewportSize()

      if (!box || !viewport) {
        return false
      }

      return box.x >= 0 && box.x + box.width <= viewport.width
    })
    .toBe(true)
}

async function expectElementFullyWithinViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible()
  await expect
    .poll(async () => {
      const box = await locator.boundingBox()
      const viewport = page.viewportSize()

      if (!box || !viewport) {
        return false
      }

      return (
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width &&
        box.y + box.height <= viewport.height
      )
    })
    .toBe(true)
}

async function expectElementNoHorizontalOverflow(locator: Locator) {
  await expect(locator).toBeVisible()
  await expect
    .poll(() =>
      locator.evaluate(
        (element) => Math.ceil(element.scrollWidth) <= Math.ceil(element.clientWidth) + 1,
      ),
    )
    .toBe(true)
}

async function expectBookingCardsInsetFromColumns(locator: Locator, minInsetPx: number) {
  await expect(locator.first()).toBeVisible()
  await expect
    .poll(() =>
      locator.evaluateAll(
        (elements, inset) =>
          elements.every((element) => {
            const parent = element.offsetParent
            if (!(element instanceof HTMLElement) || !(parent instanceof HTMLElement)) {
              return false
            }

            const rightInset = parent.clientWidth - element.offsetLeft - element.offsetWidth
            const bottomInset = parent.clientHeight - element.offsetTop - element.offsetHeight

            return (
              element.offsetLeft >= inset &&
              element.offsetTop >= inset &&
              rightInset >= inset &&
              bottomInset >= inset
            )
          }),
        minInsetPx,
      ),
    )
    .toBe(true)
}

async function expectToastInCorner(
  page: Page,
  text: string,
  corner: "bottom-right" | "top-center",
) {
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: text }).last()
  await expect(toast).toBeVisible()
  await expect
    .poll(async () => {
      const box = await toast.boundingBox()
      const viewport = page.viewportSize()

      if (!box || !viewport) {
        return false
      }

      if (corner === "bottom-right") {
        return box.x + box.width / 2 > viewport.width * 0.6 && box.y > viewport.height * 0.6
      }

      const toastCenter = box.x + box.width / 2
      return Math.abs(toastCenter - viewport.width / 2) <= 24 && box.y < viewport.height * 0.25
    })
    .toBe(true)
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => Math.ceil(document.documentElement.scrollWidth) <= Math.ceil(window.innerWidth) + 1,
      ),
    )
    .toBe(true)
}

async function expectAuthBackgroundOverscansViewport(page: Page) {
  const viewportHeight = page.viewportSize()?.height
  if (!viewportHeight) {
    throw new Error("Page has no viewport size.")
  }

  await expect
    .poll(() =>
      page
        .locator(".auth-background")
        .evaluate((element) => element.getBoundingClientRect().height),
    )
    .toBeGreaterThanOrEqual(viewportHeight * 1.3)
}

async function expectAuthRootBackground(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        authScreen: document.documentElement.dataset.authScreen,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        rootBackground: getComputedStyle(document.documentElement).backgroundColor,
      })),
    )
    .toEqual({
      authScreen: "true",
      bodyBackground: "rgb(7, 16, 15)",
      rootBackground: "rgb(7, 16, 15)",
    })
}

async function expectMinHeight(locator: Locator, minHeight: number) {
  await expect(locator).toBeVisible()
  await expect
    .poll(async () => {
      const box = await locator.boundingBox()
      return box?.height ?? 0
    })
    .toBeGreaterThanOrEqual(minHeight)
}

async function expectMinSize(locator: Locator, minWidth: number, minHeight: number) {
  await expect(locator).toBeVisible()
  await expect
    .poll(async () => {
      const box = await locator.boundingBox()
      return box?.width ?? 0
    })
    .toBeGreaterThanOrEqual(minWidth)
  await expect
    .poll(async () => {
      const box = await locator.boundingBox()
      return box?.height ?? 0
    })
    .toBeGreaterThanOrEqual(minHeight)
}

async function expectMaxSize(locator: Locator, maxWidth: number, maxHeight: number) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(maxWidth)
  expect(box?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(maxHeight)
}

async function expectPopoverFitsCalendar(popover: Locator) {
  await expect(popover).toBeVisible()
  const calendar = popover.locator("[data-slot='calendar']")
  await expect(calendar).toBeVisible()
  await expect
    .poll(async () => {
      const [popoverBox, calendarBox] = await Promise.all([
        popover.boundingBox(),
        calendar.boundingBox(),
      ])

      return (popoverBox?.width ?? 0) - (calendarBox?.width ?? 0)
    })
    .toBeLessThanOrEqual(4)
}

async function expectMinBorderRadius(locator: Locator, minRadius: number) {
  await expect(locator).toBeVisible()
  await expect
    .poll(async () =>
      locator.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
      ),
    )
    .toBeGreaterThanOrEqual(minRadius)
}

async function expectSameHeight(first: Locator, second: Locator) {
  await expect(first).toBeVisible()
  await expect(second).toBeVisible()
  const firstBox = await first.boundingBox()
  const secondBox = await second.boundingBox()
  expect(Math.abs((firstBox?.height ?? 0) - (secondBox?.height ?? 0))).toBeLessThanOrEqual(1)
}

async function expectSameCenterX(locators: Locator[], tolerancePx: number) {
  const centers: number[] = []
  for (const locator of locators) {
    await expect(locator).toBeVisible()
    const box = await locator.boundingBox()
    if (!box) {
      throw new Error("Expected locator to have a bounding box.")
    }
    centers.push(box.x + box.width / 2)
  }

  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(tolerancePx)
}

async function expectRouteContentWithinViewport(page: Page) {
  await expectElementWithinViewport(page, page.locator("main").last())
}

async function expectReminderSummarySpansResponsiveGrid(page: Page) {
  const summaryGrid = page.locator("[data-admin-summary-grid]")
  const reminderTile = page.locator('[data-admin-summary-panel="reminders"]')
  await expect(summaryGrid).toBeVisible()
  await expect(reminderTile).toBeVisible()

  const [summaryGridBox, reminderTileBox] = await Promise.all([
    summaryGrid.boundingBox(),
    reminderTile.boundingBox(),
  ])

  expect(summaryGridBox).not.toBeNull()
  expect(reminderTileBox).not.toBeNull()
  expect(reminderTileBox?.width ?? 0).toBeGreaterThan((summaryGridBox?.width ?? 0) * 0.9)
}

async function openNewBookingSheet(page: Page, projectName: string) {
  if (isDesktopProject(projectName)) {
    await page.getByRole("button", { name: "New booking" }).click()
    return
  }

  await page.getByRole("button", { name: "Book" }).click()
}

async function expectMemberNavigation(scope: Page | Locator) {
  await expect(scope.getByRole("link", { name: "Schedule" })).toBeVisible()
  await expect(scope.getByRole("link", { name: "Machines" })).toHaveCount(1)
  await expect(scope.getByRole("link", { name: "Overview" })).toHaveCount(0)
  await expect(scope.getByRole("link", { name: "Users" })).toHaveCount(0)
  await expect(scope.getByRole("link", { name: "Maintenance" })).toHaveCount(0)
}

async function installAuthScreenObserver(page: Page) {
  await page.addInitScript(() => {
    const state = globalThis as typeof globalThis & { __sawAuthScreen?: boolean }
    state.__sawAuthScreen = false

    const markIfAuthScreenIsVisible = () => {
      const text = document.body?.innerText ?? ""
      if (text.includes("Sign in to") || text.includes("Login code")) {
        state.__sawAuthScreen = true
      }
    }

    const attachObserver = () => {
      const root = document.documentElement
      if (!root) {
        setTimeout(attachObserver, 0)
        return
      }

      new MutationObserver(markIfAuthScreenIsVisible).observe(root, {
        childList: true,
        characterData: true,
        subtree: true,
      })
    }

    attachObserver()
    window.addEventListener("DOMContentLoaded", markIfAuthScreenIsVisible)
    setTimeout(markIfAuthScreenIsVisible, 0)
  })
}

async function authScreenWasObserved(page: Page) {
  return page.evaluate(() => {
    const state = globalThis as typeof globalThis & { __sawAuthScreen?: boolean }
    return state.__sawAuthScreen === true
  })
}

async function expectVisibleText(scope: Locator, text: string) {
  await expect
    .poll(async () => {
      const matches = await scope.getByText(text).all()
      for (const match of matches) {
        if (await match.isVisible()) {
          return true
        }
      }
      return false
    })
    .toBe(true)
}

async function expectNoVisibleText(scope: Locator, text: string) {
  await expect
    .poll(async () => {
      const matches = await scope.getByText(text).all()
      for (const match of matches) {
        if (await match.isVisible()) {
          return false
        }
      }
      return true
    })
    .toBe(true)
}

async function dragEmptyCalendarRange(
  page: Page,
  column: Locator,
  range: { startY: number; endY: number },
) {
  await expect(column).toBeVisible()
  const columnBox = await column.boundingBox()
  if (!columnBox) {
    throw new Error("Calendar day column did not produce a bounding box.")
  }

  const x = columnBox.x + columnBox.width / 2
  await page.mouse.move(x, columnBox.y + range.startY)
  await page.mouse.down()
  await page.mouse.move(x, columnBox.y + range.endY, { steps: 8 })
  await page.mouse.up()
}

async function dragBookingBy(page: Page, booking: Locator, delta: { x: number; y: number }) {
  const bookingBox = await booking.boundingBox()
  if (!bookingBox) {
    throw new Error("Booking did not produce a bounding box.")
  }

  const startX = bookingBox.x + bookingBox.width / 2
  const startY = bookingBox.y + bookingBox.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + delta.x, startY + delta.y, { steps: 8 })
  await page.mouse.up()

  return booking
}

async function resizeBookingEndBy(page: Page, booking: Locator, deltaY: number) {
  const bookingBox = await booking.boundingBox()
  if (!bookingBox) {
    throw new Error("Booking did not produce a bounding box.")
  }

  const startX = bookingBox.x + bookingBox.width / 2
  const startY = bookingBox.y + bookingBox.height - 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY + deltaY, { steps: 8 })
  await page.mouse.up()

  return booking
}
