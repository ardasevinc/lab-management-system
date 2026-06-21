export type LabConfig = {
  appTitle: string
  labName: string
  shortName: string
  baseUrl: string
  logoPath: string
  faviconPath: string
  primaryColor: string
  defaultTimezone: string
  authHero: {
    eyebrow: string
    headline: string
  }
  email: {
    fromName: string
    fromAddress: string
    supportAddress: string
  }
  links: Array<{
    label: string
    href: string
  }>
}
