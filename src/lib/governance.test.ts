import { describe, expect, it } from "vitest";
import { assessmentStatus } from "./governance";

describe("assessmentStatus", () => {
  it("is draft when neither checked nor locked", () => {
    expect(assessmentStatus(null, null)).toBe("draft");
  });
  it("is checked when checked_at is set", () => {
    expect(assessmentStatus("2026-11-01T08:00:00Z", null)).toBe("checked");
  });
  it("locked wins over checked", () => {
    expect(assessmentStatus("2026-11-01T08:00:00Z", "2026-11-02T08:00:00Z")).toBe("locked");
  });
  it("is locked even without a check", () => {
    expect(assessmentStatus(null, "2026-11-02T08:00:00Z")).toBe("locked");
  });
});
