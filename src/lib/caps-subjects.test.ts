import { describe, it, expect } from "vitest";
import { CAPS_PRESETS, missingFromPreset, normalizeClassName } from "./caps-subjects";

describe("CAPS presets", () => {
  it("GET pack has the 9 Senior Phase subjects", () => {
    expect(CAPS_PRESETS.find((p) => p.id === "get")!.subjects).toHaveLength(9);
  });
  it("skips subjects the school already has", () => {
    const fet = CAPS_PRESETS.find((p) => p.id === "fet")!;
    const left = missingFromPreset(fet, ["mathematics", "Life Orientation"]);
    expect(left.some((x) => x.name === "Mathematics")).toBe(false);
    expect(left).toHaveLength(fet.subjects.length - 2);
  });
});

describe("class name from SA-SAMS sheet", () => {
  it("normalises short forms", () => {
    expect(normalizeClassName("10a")).toBe("Grade 10A");
    expect(normalizeClassName("Gr 8 B")).toBe("Grade 8B");
    expect(normalizeClassName("Grade 12")).toBe("Grade 12A");
  });
});
