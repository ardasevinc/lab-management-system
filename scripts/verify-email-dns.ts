import { resolveMx, resolveTxt } from "node:dns/promises"

type EmailDnsOptions = {
  domain: string
  mailFromDomain: string
  sesRegion: string
}

type EmailDnsRecords = {
  apexTxt: string[]
  dmarcTxt: string[]
  mailFromMx: string[]
  mailFromTxt: string[]
}

const DEFAULT_OPTIONS: EmailDnsOptions = {
  domain: "miralab.tr",
  mailFromDomain: "mail.miralab.tr",
  sesRegion: "eu-central-1",
}

if (import.meta.main) {
  try {
    await main(Bun.argv.slice(2))
  } catch (error) {
    console.error(errorMessage(error))
    process.exit(1)
  }
}

async function main(args: string[]) {
  const options = parseArgs(args)
  const records = await resolveEmailDns(options)
  const result = evaluateEmailDns({ options, records })

  if (!result.ok) {
    throw new Error(result.messages.join("\n"))
  }

  for (const message of result.messages) {
    console.log(`verified email DNS: ${message}`)
  }
}

export function parseArgs(args: string[]): EmailDnsOptions {
  const options = { ...DEFAULT_OPTIONS }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const value = args[index + 1]

    switch (arg) {
      case "--domain":
        options.domain = requireValue(arg, value)
        index += 1
        break
      case "--mail-from-domain":
        options.mailFromDomain = requireValue(arg, value)
        index += 1
        break
      case "--ses-region":
        options.sesRegion = requireValue(arg, value)
        index += 1
        break
      case "--help":
        printUsage()
        process.exit(0)
        break
      default:
        throw new Error(`Unknown option: ${arg}`)
    }
  }

  assertDnsName("domain", options.domain)
  assertDnsName("mail-from-domain", options.mailFromDomain)
  assertAwsRegion(options.sesRegion)

  return options
}

export function evaluateEmailDns(input: { options: EmailDnsOptions; records: EmailDnsRecords }) {
  const failures: string[] = []
  const verified: string[] = []
  const expectedMailFromMx = `feedback-smtp.${input.options.sesRegion}.amazonses.com`

  const dmarcRecord = input.records.dmarcTxt.find((record) => startsWithTag(record, "v=DMARC1"))
  if (!dmarcRecord) {
    failures.push(`_dmarc.${input.options.domain} has no DMARC TXT record`)
  } else {
    verified.push(`_dmarc.${input.options.domain} publishes DMARC`)
  }

  if (!input.records.mailFromMx.some((exchange) => sameDnsName(exchange, expectedMailFromMx))) {
    failures.push(`${input.options.mailFromDomain} MX does not include ${expectedMailFromMx}`)
  } else {
    verified.push(`${input.options.mailFromDomain} MX targets SES ${input.options.sesRegion}`)
  }

  const mailFromSpf = input.records.mailFromTxt.find((record) => startsWithTag(record, "v=spf1"))
  if (!mailFromSpf) {
    failures.push(`${input.options.mailFromDomain} has no SPF TXT record`)
  } else if (!mailFromSpf.includes("include:amazonses.com")) {
    failures.push(`${input.options.mailFromDomain} SPF does not include amazonses.com`)
  } else {
    verified.push(`${input.options.mailFromDomain} SPF authorizes Amazon SES`)
  }

  const apexSpf = input.records.apexTxt.find((record) => startsWithTag(record, "v=spf1"))
  if (apexSpf) {
    verified.push(`${input.options.domain} apex SPF exists`)
  }

  return {
    ok: failures.length === 0,
    messages: failures.length > 0 ? failures : verified,
  }
}

async function resolveEmailDns(options: EmailDnsOptions): Promise<EmailDnsRecords> {
  const [apexTxt, dmarcTxt, mailFromMxRecords, mailFromTxt] = await Promise.all([
    txt(options.domain),
    txt(`_dmarc.${options.domain}`),
    resolveMx(options.mailFromDomain).catch(() => []),
    txt(options.mailFromDomain),
  ])

  return {
    apexTxt,
    dmarcTxt,
    mailFromMx: mailFromMxRecords.map((record) => record.exchange),
    mailFromTxt,
  }
}

async function txt(hostname: string) {
  const records = await resolveTxt(hostname).catch(() => [])
  return records.map((chunks) => chunks.join(""))
}

function requireValue(option: string, value: string | undefined) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`)
  }

  return value
}

function assertDnsName(label: string, value: string) {
  if (
    value.length > 253 ||
    !/^[a-zA-Z0-9.-]+$/.test(value) ||
    value.startsWith(".") ||
    value.endsWith(".") ||
    value.includes("..")
  ) {
    throw new Error(`${label} must be a DNS name`)
  }
}

function assertAwsRegion(value: string) {
  if (!/^[a-z]{2}-[a-z]+-\d$/.test(value)) {
    throw new Error(`Invalid AWS region: ${value}`)
  }
}

function startsWithTag(record: string, tag: string) {
  return record.trim().toLowerCase().startsWith(tag.toLowerCase())
}

function sameDnsName(actual: string, expected: string) {
  return actual.replace(/\.$/, "").toLowerCase() === expected.replace(/\.$/, "").toLowerCase()
}

function printUsage() {
  console.log(`Usage: bun scripts/verify-email-dns.ts [--domain miralab.tr] [--mail-from-domain mail.miralab.tr] [--ses-region eu-central-1]

Checks the production email DNS posture used by SES:
- DMARC exists at _dmarc.<domain>
- custom MAIL FROM MX points to feedback-smtp.<region>.amazonses.com
- custom MAIL FROM SPF authorizes amazonses.com`)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
