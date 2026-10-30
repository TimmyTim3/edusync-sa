import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Snapshot } from "./DisciplinaryReports";

export const DBE_LOGO_URL = "/dbe-logo.png";

const levelsOf = (s: Snapshot) => {
  const m = new Map<string, { m: number; d: number }>();
  for (let i = 1; i <= 5; i++) m.set(`Level ${i}`, { m: 0, d: 0 });
  for (const r of s.register ?? []) {
    const v = m.get(r.level) ?? { m: 0, d: 0 };
    if (r.type === "Merit") v.m++; else v.d++;
    m.set(r.level, v);
  }
  return [...m.entries()];
};

export function useSchoolName(schoolId: string | null) {
  return useQuery({
    queryKey: ["school-name", schoolId],
    enabled: !!schoolId,
    queryFn: async () => (await supabase.from("schools").select("name, address, phone").eq("id", schoolId!).maybeSingle()).data,
  });
}

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Standalone HTML of the report — used for the Word (.doc) download. */
export function reportHtml(s: Snapshot, period: string, school: string, logoAbs: string) {
  const th = (h: string[]) => `<tr>${h.map((x) => `<th style="border:1px solid #333;background:#e8e8e8;padding:4px;font-size:9pt">${x}</th>`).join("")}</tr>`;
  const td = (r: unknown[]) => `<tr>${r.map((x) => `<td style="border:1px solid #333;padding:4px;font-size:9pt">${esc(x)}</td>`).join("")}</tr>`;
  return `<html><head><meta charset="utf-8"><title>Learner Discipline Register</title></head><body style="font-family:Arial">
<p style="text-align:center"><img src="${logoAbs}" width="320"/></p>
<h2 style="text-align:center;margin:0">${esc(school)}</h2>
<h3 style="text-align:center;margin:4px 0">LEARNER DISCIPLINE REGISTER</h3>
<p style="text-align:center;font-size:9pt">Code of Conduct for Learners — South African Schools Act 84 of 1996, Section 8<br/>Period: ${esc(period)} · Generated ${esc(new Date(s.generated_at).toLocaleString("en-ZA"))}</p>
<h4>1. Summary of incidents</h4><table style="border-collapse:collapse;width:100%">${th(["Measure", "Total"])}${td(["Behaviour entries", s.total])}${td(["Merits", s.positive])}${td(["Demerits / concerns", s.negative])}</table>
<h4>2. SASA level breakdown</h4><table style="border-collapse:collapse;width:100%">${th(["Level", "Merits", "Demerits"])}${levelsOf(s).map(([k, v]) => td([k, v.m, v.d])).join("")}</table>
<h4>3. Repeat offenders</h4><table style="border-collapse:collapse;width:100%">${th(["Adm No", "Learner (Surname, Name)", "Class", "Incidents", "Highest SASA Level"])}${s.offenders.slice(0, 15).map((o) => td([o.admission || "—", o.learner, o.cls, o.count, o.highestLevel])).join("")}</table>
<h4>4. Serious incidents referred to SGB</h4><table style="border-collapse:collapse;width:100%">${th(["Date", "Adm No", "Learner", "Class", "Offence", "Level", "Severity", "Description"])}${s.serious.map((x) => td([x.date, x.admission || "—", x.student, x.cls, x.category, x.level, x.severity, x.note])).join("")}</table>
<h4>5. Incident register</h4><table style="border-collapse:collapse;width:100%">${th(["No.", "Date", "Adm No", "Learner", "Class", "Type", "Offence / Merit", "Level", "Pts", "Description"])}${(s.register ?? []).map((r, i) => td([i + 1, r.date, r.admission, r.learner, r.cls, r.type, r.category, r.level, r.points, r.note])).join("")}</table>
<h4>6. Sign-off</h4><p>Principal (name &amp; signature): ______________________ Date: __________</p><p>Chairperson, SGB Disciplinary Committee: ______________________ Date: __________</p><p>School stamp:</p>
</body></html>`;
}

export function registerCsv(s: Snapshot) {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["No.", "Date", "Admission_No", "Learner", "Grade", "Class", "Type", "Category", "SASA_Level", "Points", "Description"],
    ...(s.register ?? []).map((r, i) => [i + 1, r.date, r.admission, r.learner, r.grade, r.cls, r.type, r.category, r.level, r.points, r.note])];
  return "\uFEFF" + rows.map((r) => r.map(q).join(",")).join("\r\n");
}

const Th = ({ children }: { children: React.ReactNode }) => <th className="border border-foreground/40 bg-muted px-2 py-1 text-left font-semibold">{children}</th>;
const Td = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <td className={`border border-foreground/30 px-2 py-1 align-top ${className}`}>{children}</td>;

function H({ n, t }: { n: number; t: string }) {
  return <h3 className="mb-2 mt-6 border-b-2 border-foreground pb-1 text-sm font-bold uppercase tracking-wide">{n}. {t}</h3>;
}

/** Official A4-style on-screen document. Printing prints only this element. */
export function DbeReport({ snapshot: s, period, school }: { snapshot: Snapshot; period: string; school: string }) {
  const reg = s.register ?? [];
  return (
    <div className="overflow-x-auto rounded-lg bg-muted/50 p-2 sm:p-6">
      <article className="dbe-print mx-auto w-full max-w-[210mm] bg-card p-5 font-sans text-[11px] leading-snug text-card-foreground shadow-lift sm:p-10 sm:text-xs">
        <header className="flex flex-col items-center border-b-4 border-double border-foreground pb-3 text-center">
<img src={DBE_LOGO_URL} alt="Department of Basic Education, Republic of South Africa" className="h-16 w-auto sm:h-20" />
          
          <p className="mt-3 text-base font-bold uppercase sm:text-lg">{school}</p>
          <p className="text-sm font-bold tracking-widest">LEARNER DISCIPLINE REGISTER</p>
          <p className="mt-1 text-muted-foreground">Code of Conduct for Learners — South African Schools Act 84 of 1996, Section 8</p>
          <div className="mt-2 flex flex-wrap justify-center gap-x-6 text-muted-foreground">
            <span>Period: <b className="text-foreground">{period}</b></span>
            <span>Generated: <b className="text-foreground">{new Date(s.generated_at).toLocaleString("en-ZA")}</b></span>
          </div>
        </header>

        <H n={1} t="Summary of incidents" />
        <div className="grid grid-cols-3 gap-2">
          {[["Behaviour entries", s.total, ""], ["Merits", s.positive, "text-success"], ["Demerits / concerns", s.negative, "text-destructive"]].map(([l, v, c]) => (
            <div key={l as string} className="border border-foreground/40 p-2 text-center">
              <p className="text-[10px] uppercase text-muted-foreground">{l}</p>
              <p className={`text-xl font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <H n={2} t="SASA level breakdown" />
            <table className="w-full border-collapse"><thead><tr><Th>Level</Th><Th>Merits</Th><Th>Demerits</Th></tr></thead>
              <tbody>{levelsOf(s).map(([k, v]) => <tr key={k}><Td>{k}</Td><Td>{v.m}</Td><Td>{v.d}</Td></tr>)}</tbody></table>
          </div>
          <div>
            <H n={3} t="Repeat offenders" />
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Adm No</Th>
                  <Th>Learner</Th>
                  <Th>Class</Th>
                  <Th>Count</Th>
                  <Th>Level</Th>
                </tr>
              </thead>
              <tbody>
                {s.offenders.slice(0, 10).map((o, idx) => (
                  <tr key={idx}>
                    <Td className="whitespace-nowrap font-mono">{o.admission || "—"}</Td>
                    <Td className="font-medium">{o.learner}</Td>
                    <Td>{o.cls}</Td>
                    <Td className="font-bold text-destructive">{o.count}</Td>
                    <Td>{o.highestLevel}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <H n={4} t="Serious incidents referred to the SGB" />
        {s.serious.length === 0 ? <p className="text-muted-foreground">None in this period.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Adm No</Th>
                  <Th>Learner</Th>
                  <Th>Class</Th>
                  <Th>Offence</Th>
                  <Th>Level</Th>
                  <Th>Severity</Th>
                  <Th>Description</Th>
                </tr>
              </thead>
              <tbody>
                {s.serious.slice(0, 30).map((x, i) => (
                  <tr key={i}>
                    <Td className="whitespace-nowrap font-mono">{x.date}</Td>
                    <Td className="whitespace-nowrap font-mono">{x.admission || "—"}</Td>
                    <Td className="whitespace-nowrap font-medium">{x.student}</Td>
                    <Td>{x.cls}</Td>
                    <Td>{x.category}</Td>
                    <Td className="font-semibold text-destructive">{x.level}</Td>
                    <Td className="capitalize">{x.severity}</Td>
                    <Td className="text-muted-foreground">{x.note}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <H n={5} t={`Incident register (${reg.length} entries)`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse"><thead><tr>{["No.", "Date", "Adm No", "Learner", "Class", "Type", "Offence / Merit", "Level", "Pts"].map((h) => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>{reg.slice(0, 200).map((r, i) => <tr key={i}><Td>{i + 1}</Td><Td className="whitespace-nowrap">{r.date}</Td><Td>{r.admission || "—"}</Td><Td>{r.learner}</Td><Td>{r.cls}</Td>
              <Td className={r.type === "Merit" ? "text-success" : "text-destructive"}>{r.type}</Td><Td>{r.category}</Td><Td>{r.level}</Td><Td>{r.points}</Td></tr>)}</tbody></table>
        </div>
        {reg.length > 200 && <p className="mt-1 text-muted-foreground">First 200 shown — the full register is in the Excel, CSV and Word downloads.</p>}

        <H n={6} t="Sign-off" />
        <div className="grid gap-6 pt-2 sm:grid-cols-2">
          {["Principal (name & signature)", "Chairperson, SGB Disciplinary Committee", "Date", "School stamp"].map((l) => (
            <div key={l}><div className="h-8 border-b border-foreground" /><p className="mt-1 text-muted-foreground">{l}</p></div>
          ))}
        </div>
        <footer className="mt-6 border-t pt-2 text-center text-[10px] text-muted-foreground">Confidential learner record — handle in accordance with POPIA (Act 4 of 2013).</footer>
      </article>
    </div>
  );
}
