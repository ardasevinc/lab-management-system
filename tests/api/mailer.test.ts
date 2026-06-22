import { describe, expect, it } from "vitest"
import {
  createMailerFromEnv,
  renderBookingHtml,
  renderBookingText,
  renderInviteHtml,
  renderInviteText,
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

  it("treats NODE_ENV=production as production for provider validation", () => {
    expect(() =>
      createMailerFromEnv({
        NODE_ENV: "production",
        EMAIL_PROVIDER: "console",
      }),
    ).toThrow("EMAIL_PROVIDER=ses is required in production")
  })

  it("does not let APP_ENV bypass NODE_ENV=production for provider validation", () => {
    expect(() =>
      createMailerFromEnv({
        APP_ENV: "development",
        NODE_ENV: "production",
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

  it("rejects invalid SES sender addresses before startup can send mail", () => {
    expect(() =>
      createMailerFromEnv({
        EMAIL_PROVIDER: "ses",
        AWS_REGION: "eu-central-1",
        SES_FROM_EMAIL: "no-reply",
      }),
    ).toThrow("SES_FROM_EMAIL must be a valid email address")
  })

  it("rejects invalid SES reply-to addresses before startup can send mail", () => {
    expect(() =>
      createMailerFromEnv({
        EMAIL_PROVIDER: "ses",
        AWS_REGION: "eu-central-1",
        SES_FROM_EMAIL: "no-reply@miralab.tr",
        SES_REPLY_TO: "support",
      }),
    ).toThrow("SES_REPLY_TO must be a valid email address")
  })

  it("rejects SES header values with line breaks", () => {
    expect(() =>
      createMailerFromEnv({
        EMAIL_PROVIDER: "ses",
        AWS_REGION: "eu-central-1",
        SES_FROM_NAME: "MIRALAB\nBcc: someone@example.com",
        SES_FROM_EMAIL: "no-reply@miralab.tr",
      }),
    ).toThrow("SES_FROM_NAME must not contain line breaks")

    expect(() =>
      createMailerFromEnv({
        EMAIL_PROVIDER: "ses",
        AWS_REGION: "eu-central-1",
        SES_FROM_EMAIL: "no-reply@miralab.tr",
        SES_CONFIGURATION_SET: "miralab-lms\r\nX-Test: nope",
      }),
    ).toThrow("SES_CONFIGURATION_SET must not contain line breaks")
  })
})

describe("mailer templates", () => {
  it("renders login OTP text in the configured lab timezone", () => {
    expect(renderLoginOtpText("123456", new Date("2026-05-10T10:10:00.000Z"))).toBe(
      [
        "Your Lab LMS login code is 123456.",
        "It expires at May 10, 2026, 1:10 PM Europe/Istanbul.",
        "",
        "If you did not request this code, you can ignore this email.",
      ].join("\n"),
    )
  })

  it("renders login OTP HTML with escaped code and configured lab copy", () => {
    const html = renderLoginOtpHtml("<123456>", new Date("2026-05-10T10:10:00.000Z"))

    expect(html).toContain("Lab LMS")
    expect(html).toContain("Lab LMS booking system")
    expect(html).toContain("&lt;123456&gt;")
    expect(html).toContain("May 10, 2026, 1:10 PM Europe/Istanbul")
    expect(html).not.toContain("<123456>")
  })

  it("renders invite email text with login action and support contact", () => {
    expect(
      renderInviteText({
        to: "new.member@miralab.tr",
        name: "New Member",
        role: "member",
        loginUrl: "https://lms.miralab.tr/login?email=new.member%40miralab.tr",
      }),
    ).toBe(
      [
        "Hi New Member,",
        "",
        "You have been invited to Lab Management System as a member.",
        "Use your invited email address to request a one-time login code.",
        "",
        "Sign in: https://lms.miralab.tr/login?email=new.member%40miralab.tr",
        "",
        "Need help? Contact support@example.org.",
      ].join("\n"),
    )
  })

  it("renders invite email HTML with escaped name and login action", () => {
    const html = renderInviteHtml({
      to: "new.member@miralab.tr",
      name: "<New Member>",
      role: "admin",
      loginUrl: "https://lms.miralab.tr/login?email=new.member%40miralab.tr",
    })

    expect(html).toContain("Lab LMS")
    expect(html).toContain("&lt;New Member&gt;")
    expect(html).toContain("admin access")
    expect(html).toContain("https://lms.miralab.tr/login?email=new.member%40miralab.tr")
    expect(html).toContain("mailto:support@example.org")
    expect(html).not.toContain("<New Member>")
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
        "Need help? Contact support@example.org.",
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

    expect(html).toContain("Lab LMS")
    expect(html).toContain("Booking &lt;created&gt;")
    expect(html).toContain("&lt;Training&gt;")
    expect(html).toContain("https://miralab.tr/schedule")
    expect(html).toContain("mailto:support@example.org")
    expect(html).not.toContain("<Training>")
  })
})
