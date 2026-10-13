import { describe, expect, it } from "vitest";
import { mapStaffRole, normalizeSaPhone } from "./staff-normalize";

describe("normalizeSaPhone", () => {
  it("converts local 0 numbers to +27", () => expect(normalizeSaPhone("082 123 4567")).toBe("+27821234567"));
  it("handles brackets, hyphens and 27 prefix", () => {
    expect(normalizeSaPhone("(082) 123-4567")).toBe("+27821234567");
    expect(normalizeSaPhone("+27 82 123 4567")).toBe("+27821234567");
  });
  it("rejects too-short numbers", () => expect(normalizeSaPhone("08212")).toBe(""));
});

describe("mapStaffRole", () => {
  it("HOD becomes teacher", () => expect(mapStaffRole("HOD")).toBe("teacher"));
  it("Deputy principal becomes school admin", () => expect(mapStaffRole("Deputy Principal")).toBe("school_admin"));
  it("Admin clerk is not supported yet", () => expect(mapStaffRole("Admin Clerk")).toBeNull());
});
