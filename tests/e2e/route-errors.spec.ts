import { expect, type Page, test } from "@playwright/test"

test("unknown routes render the app not-found surface", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page)

  await page.goto("/definitely-missing")

  await expect(page.getByText("MIRALAB").first()).toBeVisible()
  await expect(page.getByRole("heading", { name: "Page not found." })).toBeVisible()
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Schedule" })).toHaveAttribute("href", "/schedule")
  await expect(page.getByText("404")).toBeVisible()
  await expect(consoleProblems).toEqual([])
})

function collectConsoleProblems(page: Page) {
  const problems: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      problems.push(`${message.type()}: ${message.text()}`)
    }
  })

  page.on("pageerror", (error) => {
    problems.push(`pageerror: ${error.message}`)
  })

  return problems
}
