import type { LabConfig } from "./packages/config/src/schema"

export default {
  appTitle: "MIRALAB",
  labName: "Machine Intelligence Research and Applications Lab",
  shortName: "MIRALAB",
  baseUrl: "https://miralab.tr",
  logoPath: "/logo.svg",
  faviconPath: "/favicon.svg",
  primaryColor: "#2563eb",
  defaultTimezone: "Europe/Istanbul",
  email: {
    fromName: "MIRALAB",
    fromAddress: "bookings@miralab.tr",
    supportAddress: "support@miralab.tr",
  },
  links: [
    {
      label: "MIRALAB",
      href: "https://miralab.tr",
    },
  ],
} satisfies LabConfig
