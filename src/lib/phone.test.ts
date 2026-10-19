import { describe, expect, it } from "vitest";
import { toE164SA } from "./phone";

describe("toE164SA", () => {
  it("converts local 0-prefixed numbers", () => expect(toE164SA("072 123 4567")).toBe("+27721234567"));
  it("keeps +27 numbers", () => expect(toE164SA("+27 82 123 4567")).toBe("+27821234567"));
  it("rejects landlines and short numbers", () => {
    expect(toE164SA("011 123 4567")).toBeNull();
    expect(toE164SA("07212")).toBeNull();
  });
});
