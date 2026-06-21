import { describe, expect, it, vi } from "vitest"
import { applyLabTheme } from "../../apps/web/src/lib/theme"

describe("lab theme", () => {
  it("applies the configured primary color to app chrome variables", () => {
    const setProperty = vi.fn()
    const documentMock = themeDocumentMock()

    applyLabTheme({ primaryColor: "#123456" }, { style: { setProperty } }, documentMock.document)

    expect(setProperty.mock.calls).toEqual([
      ["--primary", "#123456"],
      ["--ring", "#123456"],
      ["--sidebar-primary", "#123456"],
      ["--sidebar-ring", "#123456"],
    ])
    expect(documentMock.appended).toEqual([{ name: "theme-color", content: "#123456" }])
  })

  it("updates an existing theme-color meta tag", () => {
    const existing = { name: "theme-color", content: "#000000" }
    const documentMock = themeDocumentMock(existing)

    applyLabTheme(
      { primaryColor: "#2563eb" },
      { style: { setProperty: vi.fn() } },
      documentMock.document,
    )

    expect(existing.content).toBe("#2563eb")
    expect(documentMock.appended).toEqual([])
  })
})

function themeDocumentMock(existingMeta?: { name: string; content: string }) {
  const appended: Array<{ name: string; content: string }> = []

  return {
    appended,
    document: {
      createElement: () => ({ name: "", content: "" }),
      head: {
        appendChild: (element: { name: string; content: string }) => appended.push(element),
      },
      querySelector: () => existingMeta ?? null,
    },
  }
}
