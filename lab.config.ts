import type { LabConfig } from "./packages/config/src/schema"

export default {
  appTitle: "Lab Management System",
  labName: "Research Lab",
  institutionName: "Your Institution",
  shortName: "Lab LMS",
  baseUrl: "http://localhost:5173",
  logoPath: "/logo.svg",
  faviconPath: "/favicon.svg",
  primaryColor: "#007f67",
  defaultTimezone: "Europe/Istanbul",
  authHero: {
    eyebrow: "Shared lab resource booking",
    headline: "Book lab machines without calendar drift.",
  },
  email: {
    fromName: "Lab Management System",
    fromAddress: "no-reply@example.org",
    supportAddress: "support@example.org",
  },
  links: [],
} satisfies LabConfig
