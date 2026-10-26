/** Official CAPS subject starter packs, used to set up a school's subject list in one click. */
export type PresetSubject = { name: string; code: string; phase: string; grades: string };
export type Preset = { id: string; label: string; subjects: PresetSubject[] };

const s = (phase: string, grades: string) => (name: string, code: string): PresetSubject => ({ name, code, phase, grades });
const fp = s("Foundation", "R-3");
const ip = s("Intermediate", "4-6");
const sp7 = s("Senior", "7");
const get = s("Senior (GET)", "8-9");
const fet = s("FET", "10-12");

export const CAPS_PRESETS: Preset[] = [
  {
    id: "primary", label: "Primary school (Grades R–7)",
    subjects: [
      fp("Home Language (Foundation)", "HL-FP"), fp("First Additional Language (Foundation)", "FAL-FP"), fp("Mathematics (Foundation)", "MATH-FP"), fp("Life Skills (Foundation)", "LS-FP"),
      ip("Home Language (Intermediate)", "HL-IP"), ip("First Additional Language (Intermediate)", "FAL-IP"), ip("Mathematics (Intermediate)", "MATH-IP"),
      ip("Natural Sciences and Technology", "NST"), ip("Social Sciences (Intermediate)", "SS-IP"), ip("Life Skills (Intermediate)", "LS-IP"),
      sp7("Home Language (Grade 7)", "HL-7"), sp7("First Additional Language (Grade 7)", "FAL-7"), sp7("Mathematics (Grade 7)", "MATH-7"), sp7("Natural Sciences (Grade 7)", "NS-7"),
      sp7("Social Sciences (Grade 7)", "SS-7"), sp7("Technology (Grade 7)", "TECH-7"), sp7("Economic and Management Sciences (Grade 7)", "EMS-7"), sp7("Life Orientation (Grade 7)", "LO-7"), sp7("Creative Arts (Grade 7)", "CA-7"),
    ],
  },
  {
    id: "get", label: "High school Grades 8–9 (GET)",
    subjects: [
      get("Home Language", "HL"), get("First Additional Language", "FAL"), get("Mathematics", "MATH"), get("Natural Sciences", "NS"), get("Social Sciences", "SS"),
      get("Technology", "TECH"), get("Economic and Management Sciences", "EMS"), get("Life Orientation", "LO"), get("Creative Arts", "CA"),
    ],
  },
  {
    id: "fet", label: "High school Grades 10–12 (FET)",
    subjects: [
      fet("Home Language", "HL"), fet("First Additional Language", "FAL"), fet("Mathematics", "MATH"), fet("Mathematical Literacy", "MLIT"), fet("Technical Mathematics", "TMATH"),
      fet("Life Orientation", "LO"), fet("Physical Sciences", "PHSC"), fet("Life Sciences", "LFSC"), fet("Accounting", "ACCN"), fet("Business Studies", "BSTD"),
      fet("Economics", "ECON"), fet("Geography", "GEOG"), fet("History", "HIST"), fet("Computer Applications Technology", "CAT"), fet("Information Technology", "IT"),
      fet("Tourism", "TOUR"), fet("Engineering Graphics and Design", "EGD"), fet("Consumer Studies", "CSTD"), fet("Agricultural Sciences", "AGRS"),
    ],
  },
];

/** Returns only the preset subjects the school does not already have (case-insensitive name match). */
export function missingFromPreset(preset: Preset, existingNames: string[]): PresetSubject[] {
  const have = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  return preset.subjects.filter((p) => !have.has(p.name.toLowerCase()));
}

/** Turns "10A", "Gr 10 A", "grade 10a" into the school's class name format "Grade 10A". */
export function normalizeClassName(raw: string): string {
  const m = raw.trim().match(/^(?:grade|gr\.?|graad)?\s*(R|\d{1,2})\s*([A-Za-z]{0,3})$/i);
  if (!m) return raw.trim();
  return `Grade ${m[1]!.toUpperCase()}${(m[2] || "A").toUpperCase()}`;
}
