import { describe, expect, it } from "vitest"
import type { Machine } from "../../apps/web/src/lib/api"
import {
  resolveSelectedMachine,
  resolveSelectedMachineSlug,
} from "../../apps/web/src/lib/machine-selection"

const machines: Machine[] = [
  {
    id: "machine-1",
    slug: "ada",
    name: "ada",
    description: "first workstation",
    specs: [],
    accessNotes: "",
    active: true,
  },
  {
    id: "machine-2",
    slug: "tohum",
    name: "tohum",
    description: "gpu workstation",
    specs: ["NVIDIA GPU"],
    accessNotes: "",
    active: true,
  },
]

describe("machine selection", () => {
  it("keeps the requested machine when it exists", () => {
    expect(resolveSelectedMachine(machines, "tohum")?.slug).toBe("tohum")
    expect(resolveSelectedMachineSlug(machines, "tohum")).toBe("tohum")
  })

  it("falls back to the first machine when the requested slug is missing", () => {
    expect(resolveSelectedMachine(machines, "missing")?.slug).toBe("ada")
    expect(resolveSelectedMachineSlug(machines, "missing")).toBe("ada")
  })

  it("preserves the requested slug when no machine exists yet", () => {
    expect(resolveSelectedMachine([], "tohum")).toBeNull()
    expect(resolveSelectedMachineSlug([], "tohum")).toBe("tohum")
  })
})
