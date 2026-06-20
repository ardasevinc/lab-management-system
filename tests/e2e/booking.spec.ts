import { expect, test } from "@playwright/test"

test("admin can sign in and manage a tohum booking", async ({ page }) => {
  const consoleProblems: string[] = []
  const bookingTitle = `E2E booking ${Date.now()}`

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on("pageerror", (error) => {
    consoleProblems.push(`pageerror: ${error.message}`)
  })

  await page.goto("/login")
  await expect(page.getByLabel("Email")).toBeVisible()

  await page.getByLabel("Email").fill("admin@miralab.tr")
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByLabel("Login code")).toBeVisible()
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/admin$/)

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
