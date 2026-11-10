import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "./Shell";
import { toast } from "sonner";
import { Search, Printer, Save } from "lucide-react";

interface Props {
  schoolId: string;
}

const SASA_OFFENCES: Record<string, { label: string; level: number; sasaRef: string }> = {
  fighting: { label: "Physical Assault / Mutual Fighting", level: 4, sasaRef: "SASA S8(4) - Level 4 Violent Conduct" },
  substances: { label: "Possession / Use of Prohibited Substances", level: 4, sasaRef: "SASA S8A - Level 4 Illegal Substance" },
  weapons: { label: "Dangerous Object / Weapon on Campus", level: 5, sasaRef: "SASA S8A(1) - Level 5 Critical Safety" },
  theft: { label: "Severe Vandalism / Malicious Property Theft", level: 3, sasaRef: "SASA S8(2) - Level 3 Property Violation" },
  insubordination: { label: "Gross Insubordination & Threatening Staff", level: 3, sasaRef: "SASA S8(2) - Level 3 Disruption" },
  cyberbullying: { label: "Severe Bullying, Intimidation or Harassment", level: 4, sasaRef: "SASA S8(4) - Level 4 Dignity & Safety" },
};
const DEFAULT_OFFENCE = SASA_OFFENCES["fighting"]!;
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]!);

export function SgbHearingDocket({ schoolId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; admission: string; grade: string; class: string; parentPhone?: string } | null>(null);
  const [offenceKey, setOffenceKey] = useState("fighting");
  const [hearingDate, setHearingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [venue, setVenue] = useState("Principal Office / SGB Boardroom");
  const [chargeDetails, setChargeDetails] = useState("");
  const [sanction, setSanction] = useState("Written Final Warning");
  const [saving, setSaving] = useState(false);

  const studentResults = useQuery({
    queryKey: ["search-students-docket", schoolId, studentSearch],
    enabled: studentSearch.trim().length >= 2,
    queryFn: async () => {
      const q = studentSearch.trim();
      const base = () => supabase
        .from("students")
        .select("id, first_name, last_name, admission_no, classes ( grade, name ), parent_student ( parents ( phone, whatsapp_number ) )")
        .eq("school_id", schoolId)
        .is("deleted_at", null);
      const [byFirstName, byLastName, byAdmission] = await Promise.all([
        base().ilike("first_name", `%${q}%`).limit(8),
        base().ilike("last_name", `%${q}%`).limit(8),
        base().ilike("admission_no", `%${q}%`).limit(8),
      ]);
      const error = byFirstName.error ?? byLastName.error ?? byAdmission.error;
      if (error) throw error;
      const unique = new Map<string, NonNullable<typeof byFirstName.data>[number]>();
      for (const student of [...(byFirstName.data ?? []), ...(byLastName.data ?? []), ...(byAdmission.data ?? [])]) {
        unique.set(student.id, student);
      }
      return [...unique.values()].slice(0, 8).map((s) => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        admission: s.admission_no || "—",
        grade: s.classes?.grade || "—",
        class: s.classes?.name || "—",
        parentPhone: s.parent_student
          ?.map((link) => link.parents?.whatsapp_number || link.parents?.phone)
          .find((phone) => Boolean(phone)) || "",
      }));
    },
  });

  const history = useQuery({
    queryKey: ["student-history-docket", selectedStudent?.id],
    enabled: !!selectedStudent?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("behaviour_notes")
        .select("id, category, is_positive, severity, note, points, created_at")
        .eq("student_id", selectedStudent!.id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handlePrintDocket = () => {
    if (!selectedStudent) { toast.error("Please select a candidate learner first"); return; }
    const offence = SASA_OFFENCES[offenceKey] ?? DEFAULT_OFFENCE;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Please allow popups to print docket"); return; }

    const rows = (history.data ?? []).map((h: any) => `
      <tr>
        <td>${escapeHtml(h.created_at.slice(0, 10))}</td>
        <td>${h.is_positive ? "Merit" : "Concern"}</td>
        <td>${escapeHtml(h.severity || "—")}</td>
        <td>${escapeHtml(h.points > 0 ? "+" + h.points : h.points)}</td>
        <td>${escapeHtml(h.note)}</td>
      </tr>
    `).join("") || '<tr><td colspan="5" style="text-align:center;">No prior documented offences on record.</td></tr>';

    const html = `<!DOCTYPE html><html><head><title>SGB Docket - ${escapeHtml(selectedStudent.admission)} - ${escapeHtml(selectedStudent.name)}</title>
      <style>
        body { font-family: sans-serif; font-size: 11px; color: #111; line-height: 1.4; padding: 24px; max-width: 800px; margin: auto; }
        .hdr { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
        .box { border: 1px solid #ccc; padding: 8px; border-radius: 4px; }
        .box-t { font-weight: bold; font-size: 10px; text-transform: uppercase; color: #555; border-bottom: 1px solid #eee; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
        th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
        th { background: #f3f4f6; }
        .sigs { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .sig-l { border-top: 1px solid #111; margin-top: 32px; padding-top: 2px; font-size: 10px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="hdr">
        <div style="font-size:11px; color:#444;">Republic of South Africa · Department of Basic Education</div>
        <div style="font-size:16px; font-weight:bold; margin:2px 0;">SASA Section 8 / 9 Disciplinary Tribunal Docket</div>
        <div style="font-size:11px;">Formal Hearing Case File & Official Charge Sheet</div>
      </div>
      <div class="grid">
        <div class="box"><div class="box-t">Learner Profile</div>
          <div><strong>Name:</strong> ${escapeHtml(selectedStudent.name)}</div>
          <div><strong>Admission:</strong> ${escapeHtml(selectedStudent.admission)}</div>
          <div><strong>Grade / Class:</strong> ${escapeHtml(selectedStudent.grade)} (${escapeHtml(selectedStudent.class)})</div>
          <div><strong>Guardian Phone:</strong> ${escapeHtml(selectedStudent.parentPhone || "On file in front office")}</div>
        </div>
        <div class="box"><div class="box-t">Tribunal Details</div>
          <div><strong>Hearing Date:</strong> ${escapeHtml(hearingDate)}</div>
          <div><strong>Incident Date:</strong> ${escapeHtml(incidentDate)}</div>
          <div><strong>Venue:</strong> ${escapeHtml(venue)}</div>
          <div><strong>Authority:</strong> SGB Disciplinary Committee</div>
        </div>
      </div>
      <div class="box" style="margin-bottom:10px;"><div class="box-t">Code of Conduct Charge Allegation</div>
        <div style="font-size:12px; font-weight:bold; margin-bottom:2px;">SASA Level ${offence.level}: ${escapeHtml(offence.label)}</div>
        <div style="font-size:10px; color:#555; margin-bottom:4px;">${escapeHtml(offence.sasaRef)}</div>
        <div style="white-space:pre-wrap; background:#f9f9f9; padding:6px; border:1px solid #eee;">${escapeHtml(chargeDetails || "Particulars as presented by School Disciplinary Representative.")}</div>
      </div>
      <div class="box" style="margin-bottom:10px;"><div class="box-t">Prior Behavioural Interventions</div>
        <table><thead><tr><th>Date</th><th>Type</th><th>Severity</th><th>Points</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
      <div class="box"><div class="box-t">Tribunal Recommended Sanction</div>
        <div><strong>Recommended Sanction:</strong> ${escapeHtml(sanction)}</div>
        <div style="font-size:10px; color:#666; margin-top:2px;">In terms of SASA Section 9, learner is entitled to legal or guardian representation before final sanction.</div>
      </div>
      <div class="sigs">
        <div><div class="sig-l">SGB Disciplinary Committee Chairperson</div><div>Date: ________________________</div></div>
        <div><div class="sig-l">School Principal</div><div>Date: ________________________</div></div>
        <div><div class="sig-l">Parent / Guardian Signature</div><div>Date: ________________________</div></div>
        <div><div class="sig-l">Learner Acknowledgement</div><div>Date: ________________________</div></div>
      </div></body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const handleSaveToArchive = async () => {
    if (!selectedStudent) { toast.error("Please select a candidate learner first"); return; }
    if (!user?.id) { toast.error("Please sign in again before saving this docket"); return; }
    setSaving(true);
    try {
      const offence = SASA_OFFENCES[offenceKey] ?? DEFAULT_OFFENCE;
      const snapshot = { candidate: selectedStudent, offence, incidentDate, hearingDate, venue, chargeDetails, sanction, history: history.data ?? [], generatedAt: new Date().toISOString() };
      const { error } = await supabase.from("disciplinary_reports").insert({
        school_id: schoolId,
        created_by: user.id,
        prepared_for_hearing: true,
        title: `SGB Docket: ${selectedStudent.name} (${selectedStudent.admission}) - Level ${offence.level}`,
        snapshot: snapshot as any,
        filters: { type: "sgb_docket", student_id: selectedStudent.id, level: offence.level } as any,
      });
      if (error) throw error;
      toast.success(`SGB Case Docket archived for ${selectedStudent.name}`);
      qc.invalidateQueries({ queryKey: ["disc-archive", schoolId] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to save docket to archive");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="SGB Disciplinary Hearing Docket & Tribunal Packager"
      description="Official South African Schools Act (SASA Section 8/9) disciplinary hearing compiler. Generate formal charge sheets, pull learner chronologies, and produce printable tribunal packets."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground block">Find Candidate Learner</label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by learner name or admission no..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border rounded-lg text-xs bg-background"
              />
            </div>
            {studentResults.data && studentResults.data.length > 0 && (
              <div className="border rounded-lg max-h-36 overflow-y-auto divide-y text-xs bg-card shadow-sm">
                {studentResults.data.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => { setSelectedStudent(st); setStudentSearch(""); }}
                    className="w-full text-left p-2 hover:bg-muted/40 flex justify-between items-center transition-colors"
                  >
                    <span className="font-semibold text-foreground">{st.name}</span>
                    <span className="text-muted-foreground font-mono">{st.admission} ({st.grade})</span>
                  </button>
                ))}
              </div>
            )}
            {selectedStudent && (
              <div className="p-3 bg-muted/40 rounded-xl border flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-foreground block">{selectedStudent.name}</span>
                  <span className="text-muted-foreground">Adm: {selectedStudent.admission} · {selectedStudent.grade} ({selectedStudent.class})</span>
                </div>
                <button type="button" onClick={() => setSelectedStudent(null)} className="text-xs text-muted-foreground hover:text-destructive">Change</button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground block">SASA Level & Allegation</label>
            <select value={offenceKey} onChange={(e) => setOffenceKey(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background">
        {Object.entries(SASA_OFFENCES).map(([k, v]) => (
                <option key={k} value={k}>Level {v.level} — {v.label}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">Incident Date</label>
                <input type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} className="w-full px-2.5 py-1 border rounded-lg bg-background text-xs" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">Hearing Date</label>
                <input type="date" value={hearingDate} onChange={(e) => setHearingDate(e.target.value)} className="w-full px-2.5 py-1 border rounded-lg bg-background text-xs" />
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Charge Particulars & Investigation Summary</label>
          <textarea
            rows={3}
            placeholder="State specific Code of Conduct clauses violated, eyewitness statements, and confiscated items..."
            value={chargeDetails}
            onChange={(e) => setChargeDetails(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-xs bg-background resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="font-semibold text-muted-foreground block mb-1">Hearing Venue</label>
            <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg bg-background" />
          </div>
          <div>
            <label className="font-semibold text-muted-foreground block mb-1">Recommended Sanction</label>
            <select value={sanction} onChange={(e) => setSanction(e.target.value)} className="w-full px-3 py-1.5 border rounded-lg bg-background">
              <option value="Written Final Warning">Written Final Warning (In Learner File)</option>
              <option value="SGB Community Service">Campus Community Service (10 hours)</option>
              <option value="Suspension (1–7 School Days)">Suspension (1–7 School Days pending HOD)</option>
              <option value="Expulsion Recommendation to HOD">Expulsion Recommendation to DBE HOD</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
          <button
            type="button"
            onClick={handlePrintDocket}
            disabled={!selectedStudent}
            className="flex-1 py-2 px-3 bg-primary text-primary-foreground rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" /> Generate & Print SGB Hearing Docket
          </button>
          <button
            type="button"
            onClick={handleSaveToArchive}
            disabled={!selectedStudent || saving}
            className="py-2 px-4 border border-border bg-card hover:bg-muted text-foreground rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "Archiving..." : "Save to Archive"}
          </button>
        </div>
      </div>
    </Card>
  );
        }
                    
