import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
import { labConfig } from "@lab/config"

export type LoginOtpEmail = {
  to: string
  code: string
  expiresAt: string
}

export type BookingEmail = {
  to: string
  subject: string
  headline: string
  body: string
  details: Array<{ label: string; value: string }>
}

export type Mailer = {
  sendLoginOtp(email: LoginOtpEmail): Promise<void>
  sendBookingEmail(email: BookingEmail): Promise<void>
}

type SesMailerConfig = {
  region: string
  fromName: string
  fromEmail: string
  replyTo?: string
  configurationSet?: string
}

export function createMailerFromEnv(env: Record<string, string | undefined>): Mailer {
  const provider = env.EMAIL_PROVIDER ?? "console"

  if (provider === "ses") {
    return createSesMailer({
      region: requiredEnv(env.AWS_REGION, "AWS_REGION"),
      fromName: env.SES_FROM_NAME ?? "MIRALAB",
      fromEmail: requiredEnv(env.SES_FROM_EMAIL, "SES_FROM_EMAIL"),
      replyTo: emptyToUndefined(env.SES_REPLY_TO),
      configurationSet: emptyToUndefined(env.SES_CONFIGURATION_SET),
    })
  }

  return createConsoleMailer()
}

export function createConsoleMailer(): Mailer {
  return {
    async sendLoginOtp(email) {
      console.info(`[lab-api] login code for ${email.to}: ${email.code} expires ${email.expiresAt}`)
    },
    async sendBookingEmail(email) {
      console.info(`[lab-api] booking email to ${email.to}: ${email.subject}`)
    },
  }
}

export function createSesMailer(config: SesMailerConfig): Mailer {
  const client = new SESClient({ region: config.region })

  return {
    async sendLoginOtp(email) {
      const expiresAt = new Date(email.expiresAt)
      await client.send(
        new SendEmailCommand({
          Source: formatAddress(config.fromName, config.fromEmail),
          Destination: {
            ToAddresses: [email.to],
          },
          ReplyToAddresses: config.replyTo ? [config.replyTo] : undefined,
          ConfigurationSetName: config.configurationSet,
          Message: {
            Subject: {
              Charset: "UTF-8",
              Data: "Your MIRALAB login code",
            },
            Body: {
              Text: {
                Charset: "UTF-8",
                Data: renderLoginOtpText(email.code, expiresAt),
              },
              Html: {
                Charset: "UTF-8",
                Data: renderLoginOtpHtml(email.code, expiresAt),
              },
            },
          },
        }),
      )
    },
    async sendBookingEmail(email) {
      await client.send(
        new SendEmailCommand({
          Source: formatAddress(config.fromName, config.fromEmail),
          Destination: {
            ToAddresses: [email.to],
          },
          ReplyToAddresses: config.replyTo ? [config.replyTo] : undefined,
          ConfigurationSetName: config.configurationSet,
          Message: {
            Subject: {
              Charset: "UTF-8",
              Data: email.subject,
            },
            Body: {
              Text: {
                Charset: "UTF-8",
                Data: renderBookingText(email),
              },
              Html: {
                Charset: "UTF-8",
                Data: renderBookingHtml(email),
              },
            },
          },
        }),
      )
    },
  }
}

function formatAddress(name: string, email: string) {
  return `${quoteDisplayName(name)} <${email}>`
}

function quoteDisplayName(name: string) {
  return `"${name.replaceAll('"', '\\"')}"`
}

export function renderLoginOtpText(code: string, expiresAt: Date) {
  return [
    `Your ${labConfig.shortName} login code is ${code}.`,
    `It expires at ${formatLabTimezone(expiresAt)}.`,
    "",
    "If you did not request this code, you can ignore this email.",
  ].join("\n")
}

export function renderLoginOtpHtml(code: string, expiresAt: Date) {
  const expiry = formatLabTimezone(expiresAt)

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7f8;color:#172124;font-family:Arial,sans-serif;">
    <main style="max-width:520px;margin:0 auto;padding:32px 20px;">
      <section style="background:#ffffff;border:1px solid #d8e2e4;border-radius:12px;padding:24px;">
        <p style="margin:0 0 8px;color:#647176;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(labConfig.shortName)}</p>
        <h1 style="margin:0 0 18px;font-size:22px;line-height:1.25;">Your login code</h1>
        <p style="margin:0 0 16px;color:#455157;font-size:15px;line-height:1.5;">Use this one-time code to sign in to the ${escapeHtml(labConfig.shortName)} booking system.</p>
        <div style="margin:0 0 16px;padding:14px 16px;border-radius:10px;background:#e7f5f1;color:#007f67;font-size:28px;font-weight:700;letter-spacing:0.18em;text-align:center;">${escapeHtml(code)}</div>
        <p style="margin:0;color:#647176;font-size:13px;line-height:1.5;">Expires at ${escapeHtml(expiry)}. Ignore this email if you did not request it.</p>
      </section>
    </main>
  </body>
</html>`
}

function formatLabTimezone(date: Date) {
  const formatted = date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: labConfig.defaultTimezone,
  })

  return `${formatted} ${labConfig.defaultTimezone}`
}

function renderBookingText(email: BookingEmail) {
  return [
    email.headline,
    "",
    email.body,
    "",
    ...email.details.map((detail) => `${detail.label}: ${detail.value}`),
  ].join("\n")
}

function renderBookingHtml(email: BookingEmail) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7f8;color:#172124;font-family:Arial,sans-serif;">
    <main style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <section style="background:#ffffff;border:1px solid #d8e2e4;border-radius:12px;padding:24px;">
        <p style="margin:0 0 8px;color:#647176;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">MIRALAB</p>
        <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;">${escapeHtml(email.headline)}</h1>
        <p style="margin:0 0 18px;color:#455157;font-size:15px;line-height:1.5;">${escapeHtml(email.body)}</p>
        <dl style="margin:0;display:grid;gap:10px;">
          ${email.details
            .map(
              (detail) => `<div style="padding-top:10px;border-top:1px solid #e3ecee;">
            <dt style="margin:0 0 3px;color:#647176;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(detail.label)}</dt>
            <dd style="margin:0;color:#172124;font-size:15px;">${escapeHtml(detail.value)}</dd>
          </div>`,
            )
            .join("")}
        </dl>
      </section>
    </main>
  </body>
</html>`
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function requiredEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required`)
  }

  return value
}

function emptyToUndefined(value: string | undefined) {
  return value?.trim() || undefined
}
