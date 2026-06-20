import { describe, expect, it } from "vitest"
import {
  createMailerFromEnv,
  renderBookingHtml,
  renderBookingText,
  renderLoginOtpHtml,
  renderLoginOtpText,
} from "../../apps/api/src/mailer"

describe("mailer env", () => {
  it("rejects console mailer in production", () => {
    expect(() =>
      createMailerFromEnv({
        APP_ENV: "production",
        EMAIL_PROVIDER: "console",
      }),
    ).toThrow("EMAIL_PROVIDER=ses is required in production")
  })

  it("rejects unknown mailer providers", () => {
    expect(() =>
      createMailerFromEnv({
        EMAIL_PROVIDER: "sess",
      }),
    ).toThrow("EMAIL_PROVIDER must be one of: console, ses")
  })
})

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

  it("renders booking email text with schedule action and support contact", () => {
    expect(
      renderBookingText({
        to: "member@miralab.tr",
        subject: "MIRALAB booking created: Training",
        headline: "Booking created",
        body: "Your tohum booking has been created.",
        details: [{ label: "Machine", value: "tohum" }],
        actionLabel: "Open schedule",
        actionUrl: "https://miralab.tr/schedule",
      }),
    ).toBe(
      [
        "Booking created",
        "",
        "Your tohum booking has been created.",
        "",
        "Machine: tohum",
        "",
        "Open schedule: https://miralab.tr/schedule",
        "",
        "Need help? Contact support@miralab.tr.",
      ].join("\n"),
    )
  })

  it("renders booking email HTML with escaped details, schedule action, and support contact", () => {
    const html = renderBookingHtml({
      to: "member@miralab.tr",
      subject: "MIRALAB booking created: <Training>",
      headline: "Booking <created>",
      body: "Your tohum booking has been created.",
      details: [{ label: "Title", value: "<Training>" }],
      actionLabel: "Open schedule",
      actionUrl: "https://miralab.tr/schedule",
    })

    expect(html).toContain("MIRALAB")
    expect(html).toContain("Booking &lt;created&gt;")
    expect(html).toContain("&lt;Training&gt;")
    expect(html).toContain("https://miralab.tr/schedule")
    expect(html).toContain("mailto:support@miralab.tr")
    expect(html).not.toContain("<Training>")
  })
})
