import { describe, it, expect } from "vitest";
import { levelPoints, normSeverity } from "./import-normalize";
describe("SASA levels", () => {
  it("level 1 merit is +5", () => expect(levelPoints(1, true)).toBe(5));
  it("level 5 demerit is -25", () => expect(levelPoints(5, false)).toBe(-25));
  it("level 4 is high severity", () => expect(normSeverity("4")).toBe("high"));
});
