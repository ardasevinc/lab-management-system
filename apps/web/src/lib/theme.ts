import type { LabConfig } from "@lab/config"

type StyleTarget = {
  style: {
    setProperty: (name: string, value: string) => void
  }
}

type ThemeMetaElement = {
  content: string
  name: string
}

type ThemeDocument = {
  createElement: (tagName: "meta") => ThemeMetaElement
  head: {
    appendChild: (element: ThemeMetaElement) => void
  }
  querySelector: (selector: 'meta[name="theme-color"]') => ThemeMetaElement | null
}

export function applyLabTheme(
  config: Pick<LabConfig, "primaryColor">,
  root: StyleTarget = document.documentElement,
  ownerDocument: ThemeDocument = document as unknown as ThemeDocument,
) {
  const primaryColor = config.primaryColor.trim()
  if (!primaryColor) {
    return
  }

  for (const variable of ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring"]) {
    root.style.setProperty(variable, primaryColor)
  }

  const existingThemeColorMeta = ownerDocument.querySelector('meta[name="theme-color"]')
  const themeColorMeta = existingThemeColorMeta ?? ownerDocument.createElement("meta")
  themeColorMeta.name = "theme-color"
  themeColorMeta.content = primaryColor

  if (!existingThemeColorMeta) {
    ownerDocument.head.appendChild(themeColorMeta)
  }
}
