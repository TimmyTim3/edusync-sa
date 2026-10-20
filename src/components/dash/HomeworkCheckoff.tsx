import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, Empty } from "./Shell";

type Stu = { id: string; first_name: string; last_name: string };

/** Teacher marks who handed in homework: "Mark all handed in", untick the few who didn't, save once. */
export function HomeworkCheckoff({ schoolId, classId, students, userId }: { schoolId: string; classId: string; students: Stu[]; userId: string }) {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const hw = useQuery({
    queryKey: ["teacher-homework", classId],
    queryFn: async () => {
      const { data } = await supabase.from("homework").select("id, title, due_date").eq("class_id", classId).order("due_date", { ascending: false }).limit(10);
      return data ?? [];
    },
  });
  const done = useQuery({
    queryKey: ["hw-done", openId],
    enabled: !!openId,
    queryFn: async () => {
      const { data } = await supabase.from("homework_completions").select("student_id").eq("homework_id", openId!);
      return new Set((data ?? []).map((d) => d.student_id));
    },
  });
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (done.data) setTicked(new Set(done.data)); }, [done.data]);

  const save = async () => {
    if (!openId || !done.data || busy) return;
    setBusy(true);
    const add = [...ticked].filter((id) => !done.data!.has(id));
    const remove = [...done.data].filter((id) => !ticked.has(id));
    let err = null;
    if (add.length) err = (await supabase.from("homework_completions").insert(add.map((student_id) => ({ school_id: schoolId, homework_id: openId, student_id, marked_by: userId })))).error;
    if (!err && remove.length) err = (await supabase.from("homework_completions").delete().eq("homework_id", openId).in("student_id", remove)).error;
    setBusy(false);
    if (err) { toast.error(err.message); return; }
    toast.success(`Saved: ${ticked.size} handed in, ${students.length - ticked.size} not handed in`);
    void qc.invalidateQueries({ queryKey: ["hw-done", openId] });
    setOpenId(null);
  };
  const cur = hw.data?.find((h) => h.id === openId);

  return (
    <Card title="Check homework hand-ins">
      {!hw.data?.length ? <Empty>No homework set for this class yet.</Empty> : (
        <ul className="divide-y text-sm">
          {hw.data.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0 truncate">{h.title} <span className="text-xs text-muted-foreground">· due {h.due_date}</span></span>
              <Button size="sm" variant="outline" onClick={() => setOpenId(h.id)}>Check</Button>
            </li>
          ))}
        </ul>
      )}
      {openId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-foreground/40" onClick={() => setOpenId(null)}>
          <div className="flex h-full w-full max-w-md flex-col bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">{cur?.title}</h3><button aria-label="Close" onClick={() => setOpenId(null)}><X className="h-4 w-4" /></button></div>
            <div className="mb-2 flex gap-2">
              <Button size="sm" onClick={() => setTicked(new Set(students.map((s) => s.id)))}>Mark all handed in</Button>
              <Button size="sm" variant="outline" onClick={() => setTicked(new Set())}>Clear</Button>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">{ticked.size} of {students.length} handed in. Untick learners who did not hand in.</p>
            <ul className="flex-1 divide-y overflow-y-auto rounded-md border text-sm">
              {students.map((s) => (
                <li key={s.id}><label className="flex cursor-pointer items-center gap-3 p-2">
                  <input type="checkbox" className="h-5 w-5" checked={ticked.has(s.id)} onChange={() => setTicked((t) => { const n = new Set(t); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} />
                  <span>{s.last_name}, {s.first_name}</span>
                  {!ticked.has(s.id) && <span className="ml-auto text-xs text-destructive">Not handed in</span>}
                </label></li>
              ))}
            </ul>
            <Button className="mt-3 w-full" disabled={busy || !done.data} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
