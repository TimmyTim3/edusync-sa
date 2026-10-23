import { describe, expect, it } from "vitest";
import { classifySubject, evaluatePromotion } from "./npppr";

const s = (subject: string, pct: number | null) => ({ subject, pct });

describe("classifySubject", () => {
  it("maps official SA subject names onto NPPPR roles", () => {
    expect(classifySubject("English Home Language")).toBe("hl");
    expect(classifySubject("isiZulu FAL")).toBe("fal");
    expect(classifySubject("First Additional Language")).toBe("fal");
    expect(classifySubject("Mathematics")).toBe("maths");
    expect(classifySubject("Mathematical Literacy")).toBe("other");
    expect(classifySubject("Life Sciences")).toBe("other");
  });
});

describe("senior phase (Gr 7-9): HL 50, FAL 40, Maths 40, 2 others 40+, 3 more 30+", () => {
  const passing = [
    s("English Home Language", 50), s("isiZulu FAL", 45), s("Mathematics", 42),
    s("Natural Sciences", 44), s("Social Sciences", 40),
    s("Economic Management Sciences", 35), s("Life Orientation", 60), s("Technology", 32),
  ];
  it("promotes a learner who meets every requirement", () => {
    const o = evaluatePromotion(passing, 8);
    expect(o.promoted).toBe(true);
    expect(o.reasons).toEqual([]);
  });
  it("holds back a learner with Home Language at 49%", () => {
    const o = evaluatePromotion([s("English Home Language", 49), ...passing.slice(1)], 9);
    expect(o.promoted).toBe(false);
    expect(o.reasons.join(" ")).toContain("Home Language 50%");
  });
  it("holds back a learner with only one other subject at 40%+", () => {
    const o = evaluatePromotion([
      s("English Home Language", 55), s("isiZulu FAL", 45), s("Mathematics", 45),
      s("Natural Sciences", 42), s("Social Sciences", 35),
      s("Economic Management Sciences", 35), s("Life Orientation", 35), s("Technology", 33),
    ], 7);
    expect(o.promoted).toBe(false);
    expect(o.reasons.join(" ")).toContain("2 more subjects at 40%");
  });
});

describe("intermediate phase (Gr 4-6): HL 40, FAL 40, Maths 40", () => {
  it("holds back a learner with Home Language at 39%", () => {
    const o = evaluatePromotion([
      s("English Home Language", 39), s("Afrikaans FAL", 45), s("Mathematics", 45),
      s("Natural Sciences and Technology", 45), s("Social Sciences", 45), s("Life Skills", 45),
    ], 5);
    expect(o.promoted).toBe(false);
    expect(o.reasons.join(" ")).toContain("Home Language 40%");
  });
  it("promotes a learner who meets all intermediate requirements", () => {
    const o = evaluatePromotion([
      s("English Home Language", 40), s("Afrikaans FAL", 40), s("Mathematics", 40),
      s("Natural Sciences and Technology", 42), s("Social Sciences", 40),
      s("Life Skills", 30), s("Second Additional Language", 30), s("Extra Subject", 30), s("Another", 30),
    ], 4);
    expect(o.promoted).toBe(true);
  });
});

describe("foundation phase (Gr 1-3): HL 50, FAL 40, Maths 40", () => {
  it("holds back a Gr 2 learner with Home Language at 49%", () => {
    const o = evaluatePromotion([s("Sesotho Home Language", 49), s("English FAL", 55), s("Mathematics", 60)], 2);
    expect(o.promoted).toBe(false);
  });
  it("promotes a Gr 3 learner who meets all foundation requirements", () => {
    const o = evaluatePromotion([s("Sesotho Home Language", 50), s("English FAL", 40), s("Mathematics", 40), s("Life Skills", 45)], 3);
    expect(o.promoted).toBe(true);
  });
});

describe("FET (Gr 10-12): 3 subjects 40%+ incl HL, 2 more 30%+ incl FAL, one condonation", () => {
  const base11 = [
    s("English Home Language", 45), s("Afrikaans FAL", 35), s("Mathematics", 42),
    s("Physical Sciences", 41), s("Life Sciences", 40),
    s("Geography", 33), s("Life Orientation", 55),
  ];
  it("promotes a learner who meets all FET requirements", () => {
    const o = evaluatePromotion(base11, 11);
    expect(o.promoted).toBe(true);
    expect(o.condonationPossible).toBe(false);
  });
  it("flags condonation when exactly one subject fails and everything else passes", () => {
    const o = evaluatePromotion([s("Physical Sciences", 28), ...base11.filter((r) => r.subject !== "Physical Sciences")], 11);
    expect(o.promoted).toBe(false);
    expect(o.condonationPossible).toBe(true);
    expect(o.failed).toEqual(["Physical Sciences"]);
  });
  it("refuses condonation when two subjects fail", () => {
    const o = evaluatePromotion([s("Physical Sciences", 28), s("Geography", 20), ...base11.filter((r) => !["Physical Sciences", "Geography"].includes(r.subject))], 12);
    expect(o.condonationPossible).toBe(false);
    expect(o.promoted).toBe(false);
    expect(o.reasons.join(" ")).toContain("only one may be condoned");
  });
  it("refuses promotion when no Home Language reaches 40%", () => {
    const o = evaluatePromotion([s("English Home Language", 39), ...base11.slice(1)], 10);
    expect(o.promoted).toBe(false);
    expect(o.reasons.join(" ")).toContain("Home Language");
  });
  it("warns when subject results are missing", () => {
    const o = evaluatePromotion([s("English Home Language", 45), s("Afrikaans FAL", 35), s("Mathematics", 42), s("Physical Sciences", null)], 11);
    expect(o.reasons.join(" ")).toContain("no results");
    expect(o.promoted).toBe(false);
  });
});
