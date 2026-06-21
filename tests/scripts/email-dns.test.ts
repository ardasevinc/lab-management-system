import { describe, expect, it } from "vitest"
import { evaluateEmailDns, parseArgs } from "../../scripts/verify-email-dns"

describe("email DNS verifier", () => {
  it("defaults to the MIRALAB SES identity and custom MAIL FROM domain", () => {
    expect(parseArgs([])).toEqual({
      domain: "miralab.tr",
      mailFromDomain: "mail.miralab.tr",
      sesRegion: "eu-central-1",
    })
  })

  it("accepts explicit whitelabel domains and SES region", () => {
    expect(
      parseArgs([
        "--domain",
        "lab.example.com",
        "--mail-from-domain",
        "mail.lab.example.com",
        "--ses-region",
        "us-east-1",
      ]),
    ).toEqual({
      domain: "lab.example.com",
      mailFromDomain: "mail.lab.example.com",
      sesRegion: "us-east-1",
    })
  })

  it("rejects unsafe DNS names and malformed regions", () => {
    expect(() => parseArgs(["--domain", "miralab.tr;reboot"])).toThrow("domain must be a DNS name")
    expect(() => parseArgs(["--mail-from-domain", ".mail.miralab.tr"])).toThrow(
      "mail-from-domain must be a DNS name",
    )
    expect(() => parseArgs(["--ses-region", "eu-central-1;cat"])).toThrow(
      "Invalid AWS region: eu-central-1;cat",
    )
  })

  it("passes when DMARC and SES custom MAIL FROM DNS are present", () => {
    expect(
      evaluateEmailDns({
        options: {
          domain: "miralab.tr",
          mailFromDomain: "mail.miralab.tr",
          sesRegion: "eu-central-1",
        },
        records: {
          apexTxt: ["v=spf1 include:_spfcls.natrohost.com ~all"],
          dmarcTxt: ["v=DMARC1; p=none; adkim=s; aspf=r"],
          mailFromMx: ["feedback-smtp.eu-central-1.amazonses.com."],
          mailFromTxt: ["v=spf1 include:amazonses.com ~all"],
        },
      }),
    ).toEqual({
      ok: true,
      messages: [
        "_dmarc.miralab.tr publishes DMARC",
        "mail.miralab.tr MX targets SES eu-central-1",
        "mail.miralab.tr SPF authorizes Amazon SES",
        "miralab.tr apex SPF exists",
      ],
    })
  })

  it("fails with actionable messages for missing or wrong SES DNS", () => {
    expect(
      evaluateEmailDns({
        options: {
          domain: "miralab.tr",
          mailFromDomain: "mail.miralab.tr",
          sesRegion: "eu-central-1",
        },
        records: {
          apexTxt: [],
          dmarcTxt: [],
          mailFromMx: ["feedback-smtp.us-east-1.amazonses.com"],
          mailFromTxt: ["v=spf1 include:_spf.example.com ~all"],
        },
      }),
    ).toEqual({
      ok: false,
      messages: [
        "_dmarc.miralab.tr has no DMARC TXT record",
        "mail.miralab.tr MX does not include feedback-smtp.eu-central-1.amazonses.com",
        "mail.miralab.tr SPF does not include amazonses.com",
      ],
    })
  })
})
