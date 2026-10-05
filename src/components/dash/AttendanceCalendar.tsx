import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AttRec = { date: string; status: string };

export const ATT_STYLES: Record<string, { cls: string; symbol: string; label: string }> = {
  present: { cls: "bg-success/20 text-success border-success/40", symbol: "✓", label: "Present" },
  late: { cls: "bg-warning/20 text-warning border-warning/40", symbol: "L", label: "Late" },
  absent: { cls: "bg-destructive/20 text-destructive border-destructive/40", symbol: "✗", label: "Absent" },
  excused: { cls: "bg-primary/15 text-primary border-primary/40", symbol: "E", label: "Excused" },
  half_day: { cls: "bg-accent text-accent-foreground border-border", symbol: "½", label: "Half day" },
};
const NONE = { cls: "bg-muted/40 text-muted-foreground border-dashed border-border", symbol: "–", label: "Weekend / holiday (no school)" };

const RANGES = { week: 7, month: 31, term: 92, year: 365 } as const;
type Range = keyof typeof RANGES;

export function AttendanceLegend() {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
      {[...Object.values(ATT_STYLES), NONE].map((s) => (
        <li key={s.label} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs font-bold ${s.cls}`}>{s.symbol}</span>
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export function AttendanceCalendar({ records }: { records: AttRec[] }) {
  const [range, setRange] = useState<Range>("month");
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const byDate = useMemo(() => new Map(records.map((r) => [r.date, r.status])), [records]);

  const cutoff = new Date(Date.now() - RANGES[range] * 86400000).toISOString().slice(0, 10);
  const inRange = records.filter((r) => r.date >= cutoff);
  const count = (s: string) => inRange.filter((r) => r.status === s).length;
  const pct = inRange.length ? Math.round(((count("present") + count("late")) / inRange.length) * 100) : 0;

  const days: (Date | null)[] = [];
  const lead = (month.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) days.push(null);
  const dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let i = 1; i <= dim; i++) days.push(new Date(month.getFullYear(), month.getMonth(), i));
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayIso = iso(new Date());

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap gap-1">
        {(Object.keys(RANGES) as Range[]).map((r) => (
          <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>
            {r === "week" ? "Last week" : `Past ${r}`}
          </Button>
        ))}
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
        <div className="rounded-md border p-2"><p className="text-lg font-semibold">{pct}%</p>Attendance</div>
        {(["present", "late", "absent", "excused", "half_day"] as const).map((s) => (
          <div key={s} className={`rounded-md border p-2 ${ATT_STYLES[s].cls}`}><p className="text-lg font-semibold">{count(s)}</p>{ATT_STYLES[s].label}</div>
        ))}
      </div>
      <div className="mx-auto max-w-md">
        <div className="mb-2 flex items-center justify-between">
          <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <p className="font-medium">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
          <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <span key={i} />;
            const key = iso(d);
            const st = byDate.get(key);
            const future = key > todayIso;
            const s = st ? ATT_STYLES[st] : NONE;
            return (
              <div key={i} title={`${key}: ${st ? s.label : future ? "Upcoming" : NONE.label}`}
                className={`flex aspect-square flex-col items-center justify-center rounded border text-xs ${future && !st ? "border-transparent text-muted-foreground/50" : s.cls} ${key === todayIso ? "ring-2 ring-ring" : ""}`}>
                <span className="leading-none">{d.getDate()}</span>
                {!future || st ? <span className="text-[10px] font-bold leading-none">{s.symbol}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
      <AttendanceLegend />
    </div>
  );
}
