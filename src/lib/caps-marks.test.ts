import { describe, it, expect } from "vitest";
import { finalMark, truncatePct, achievementLevel } from "./caps-marks";

describe("SA-SAMS mark rules", () => {
  it("truncates 49.6 to 49, never rounds up", () => expect(truncatePct(49.6)).toBe(49));
  it("49.6% stays Level 3 (not a pass level 4)", () => expect(achievementLevel(49.6)).toBe(3));
  it("FET weights 25% SBA / 75% exam", () => expect(finalMark(60, 40, 11)).toBe(45));
  it("Senior phase weights 40% SBA / 60% exam", () => expect(finalMark(60, 40, 8)).toBe(48));
});
