import { describe, expect, it } from "vitest"
import { renderLoginOtpHtml, renderLoginOtpText } from "../../apps/api/src/mailer"

describe("mailer templates", () => {
  it("renders login OTP text in the configured lab timezone", () => {
    expect(renderLoginOtpText("123456", new Date("2026-05-10T10:10:00.000Z"))).toBe(
      [
        "Your MIRALAB login code is 123456.",
        "It expires at May 10, 2026, 1:10 PM Europe/Istanbul.",
        "",
        "If you did not request this code, you can ignore this email.",
      ].join("\n"),
    )
  })

  it("renders login OTP HTML with escaped code and configured lab copy", () => {
    const html = renderLoginOtpHtml("<123456>", new Date("2026-05-10T10:10:00.000Z"))

    expect(html).toContain("MIRALAB")
    expect(html).toContain("MIRALAB booking system")
    expect(html).toContain("&lt;123456&gt;")
    expect(html).toContain("May 10, 2026, 1:10 PM Europe/Istanbul")
    expect(html).not.toContain("<123456>")
  })
})
