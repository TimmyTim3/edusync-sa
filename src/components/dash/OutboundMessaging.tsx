import React, { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { dispatchOutboundQueue } from "@/lib/messaging.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "./Shell";
import { toast } from "sonner";
import { Send, MessageSquare, Mail, RefreshCw, CheckCircle2, Clock, Plus, Loader2 } from "lucide-react";

interface Props {
  schoolId: string;
}

export function OutboundMessaging({ schoolId }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"dispatch" | "queue" | "templates">("dispatch");
  const dispatchQueue = useServerFn(dispatchOutboundQueue);
  const [dispatching, setDispatching] = useState(false);

  const handleDispatchQueue = async () => {
    if (dispatching) return;
    setDispatching(true);
    try {
      const result = await dispatchQueue({ data: { schoolId } });
      toast.success(`Queue processed: ${result.sent} sent · ${result.failed} failed`);
      await qc.invalidateQueries({ queryKey: ["outbound-messages", schoolId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not dispatch the queue");
    } finally {
      setDispatching(false);
    }
  };

  const [channel, setChannel] = useState<"sms" | "whatsapp" | "email">("sms");
  const [audience, setAudience] = useState<"all" | "grade" | "student">("grade");
  const [targetGrade, setTargetGrade] = useState("Grade 10");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; phone?: string; email?: string } | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);

  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateChannel, setNewTemplateChannel] = useState<"sms" | "whatsapp" | "email">("sms");
  const [newTemplatePurpose, setNewTemplatePurpose] = useState("");
  const [newTemplateBody, setNewTemplateBody] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const templates = useQuery({
    queryKey: ["notification-templates", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_templates")
        .select("*")
        .eq("school_id", schoolId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const queue = useQuery({
    queryKey: ["outbound-messages", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outbound_messages")
        .select(`
          id, channel, recipient_name, recipient_phone, recipient_email, body, status, retry_count, last_error, scheduled_at, sent_at,
          students ( first_name, last_name, admission_no, classes ( grade, name ) )
        `)
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const studentResults = useQuery({
    queryKey: ["search-students-msg", schoolId, studentSearch],
    enabled: studentSearch.trim().length >= 2,
    queryFn: async () => {
      const q = studentSearch.trim();
      // Use independent parameterized filters instead of interpolating user input into PostgREST's .or() grammar.
      const base = () => supabase.from("students").select("id, first_name, last_name, admission_no, classes ( grade, name ), parent_student ( parents ( phone, whatsapp_number, email ) )").eq("school_id", schoolId).is("deleted_at", null);
      const [byFirst, byLast, byAdmission] = await Promise.all([
        base().ilike("first_name", `%${q}%`).limit(10),
        base().ilike("last_name", `%${q}%`).limit(10),
        base().ilike("admission_no", `%${q}%`).limit(10),
      ]);
      const error = byFirst.error ?? byLast.error ?? byAdmission.error;
      if (error) throw error;
      const unique = new Map<string, NonNullable<typeof byFirst.data>[number]>();
      for (const row of [...(byFirst.data ?? []), ...(byLast.data ?? []), ...(byAdmission.data ?? [])]) unique.set(row.id, row);
      return [...unique.values()].slice(0, 10);
    },
  });

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const tmpl = templates.data?.find((t) => t.id === id);
    if (tmpl) {
      setMessageBody(tmpl.body);
      setChannel(tmpl.channel as any);
    }
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim()) {
      toast.error("Please enter a message body");
      return;
    }

    setSending(true);
    try {
      if (audience === "student") {
        if (!selectedStudent) {
          toast.error("Please select a recipient learner");
          setSending(false);
          return;
        }
        if (channel === "email" && !selectedStudent.email) {
          toast.error("This learner has no linked guardian email address");
          setSending(false);
          return;
        }

        const { error } = await supabase.from("outbound_messages").insert({
          school_id: schoolId,
          channel,
          template_id: selectedTemplateId || null,
          student_id: selectedStudent.id,
          recipient_name: selectedStudent.name,
          recipient_phone: channel === "email" ? null : selectedStudent.phone || null,
          recipient_email: channel === "email" ? selectedStudent.email || null : null,
          body: messageBody.replace("{{learner_name}}", selectedStudent.name),
          status: "queued",
        });
        if (error) throw error;
        toast.success(`Message queued for ${selectedStudent.name}`);
      } else {
        let classIds: string[] | null = null;
        if (audience === "grade") {
          const { data: classes, error: classError } = await supabase
            .from("classes")
            .select("id")
            .eq("school_id", schoolId)
            .eq("grade", targetGrade.replace(/^Grade\s+/i, ""));
          if (classError) throw classError;
          classIds = (classes ?? []).map((row) => row.id);
          if (!classIds.length) {
            toast.info("No classes found for this grade");
            setSending(false);
            return;
          }
        }

        let query = supabase
          .from("students")
          .select("id, first_name, last_name, class_id, classes ( grade, name ), parent_student ( parents ( phone, whatsapp_number, email ) )")
          .eq("school_id", schoolId)
          .is("deleted_at", null);
        if (classIds) query = query.in("class_id", classIds);
        const { data: targets, error: targetErr } = await query.limit(200);
        if (targetErr) throw targetErr;

        if (!targets || targets.length === 0) {
          toast.info("No matching learners found for this audience");
          setSending(false);
          return;
        }

        const batch = targets.map((st) => {
          const learnerName = `${st.first_name} ${st.last_name}`;
          const guardian = st.parent_student?.map((link) => link.parents).find((parent) => parent != null);
          const phone = guardian?.whatsapp_number || guardian?.phone || null;
          return {
            school_id: schoolId,
            channel,
            template_id: selectedTemplateId || null,
            student_id: st.id,
            recipient_name: learnerName,
            recipient_phone: channel === "email" ? null : phone,
            recipient_email: channel === "email" ? guardian?.email || null : null,
            body: messageBody.replace("{{learner_name}}", learnerName).replace("{{grade}}", st.classes?.grade ?? ""),
            status: "queued" as const,
          };
        }).filter((row) => channel === "email" ? Boolean(row.recipient_email) : Boolean(row.recipient_phone));

        if (!batch.length) {
          toast.info("No linked guardians with a usable contact detail were found");
          setSending(false);
          return;
        }

        const { error: batchErr } = await supabase.from("outbound_messages").insert(batch as any);
        if (batchErr) throw batchErr;

        toast.success(`Enqueued ${batch.length} ${channel.toUpperCase()} messages for dispatch`);
      }

      setMessageBody("");
      setSelectedStudent(null);
      setStudentSearch("");
      setTab("queue");
      qc.invalidateQueries({ queryKey: ["outbound-messages", schoolId] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch messages");
    } finally {
      setSending(false);
    }
  };

  const handleCancelMessage = async (msgId: string) => {
    try {
      const { error } = await supabase
        .from("outbound_messages")
        .update({ status: "cancelled" })
        .eq("id", msgId)
        .eq("status", "queued");
      if (error) throw error;
      toast.success("Message dispatch cancelled");
      qc.invalidateQueries({ queryKey: ["outbound-messages", schoolId] });
    } catch (err: any) {
      toast.error(err?.message || "Could not cancel message");
    }
  };

  const handleRetryMessage = async (msgId: string) => {
    try {
      const { error } = await supabase
        .from("outbound_messages")
        .update({ status: "queued", retry_count: 0, last_error: null })
        .eq("id", msgId);
      if (error) throw error;
      toast.success("Message re-queued for delivery");
      qc.invalidateQueries({ queryKey: ["outbound-messages", schoolId] });
    } catch (err: any) {
      toast.error(err?.message || "Could not retry message");
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim() || !newTemplateBody.trim()) return;
    setSavingTemplate(true);
    try {
      const { error } = await supabase.from("notification_templates").insert({
        school_id: schoolId,
        name: newTemplateName.trim(),
        channel: newTemplateChannel,
        purpose: newTemplatePurpose.trim() || "General Notice",
        body: newTemplateBody.trim(),
        variables: ["learner_name", "grade", "date"],
      });
      if (error) throw error;
      toast.success("Notification template saved");
      setNewTemplateName("");
      setNewTemplatePurpose("");
      setNewTemplateBody("");
      qc.invalidateQueries({ queryKey: ["notification-templates", schoolId] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <Card
      title="Outbound Notification Gateway & Messaging Queue"
      description="Automated parent & guardian messaging hub. Send official DBE notices, absenteeism alerts, SGB summons, and fee reminders via SMS, WhatsApp, and Email."
    >
      <div className="space-y-6">
                <div className="flex border-b border-border text-xs font-medium gap-2 sm:gap-4 overflow-x-auto pb-1">
          <button
            onClick={() => setTab("dispatch")}
            className={`min-h-11 px-2 pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors shrink-0 whitespace-nowrap ${
              tab === "dispatch" ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground"
            }`}
          >
            <Send className="h-4 w-4" /> Dispatch Notice
          </button>
          <button
            onClick={() => setTab("queue")}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors shrink-0 whitespace-nowrap ${
              tab === "queue" ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground"
            }`}
          >
            <Clock className="h-4 w-4" /> Outbound Queue ({queue.data?.length || 0})
          </button>
          <button
            onClick={() => setTab("templates")}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors shrink-0 whitespace-nowrap ${
              tab === "templates" ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground"
            }`}
          >
            <MessageSquare className="h-4 w-4" /> Pre-Approved Templates
          </button>
        </div>
        
                  {tab === "dispatch" && (
          <form onSubmit={handleDispatch} className="p-4 border rounded-xl bg-card space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Communication Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["sms", "whatsapp", "email"] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannel(ch)}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold uppercase flex items-center justify-center gap-1.5 transition-colors ${
                        channel === ch ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                      }`}
                    >
                      {ch === "email" ? <Mail className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Target Audience</label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as any)}
                  className="min-h-11 w-full px-3 py-2 border rounded-lg text-sm bg-background"
                >
                  <option value="grade">By Grade</option>
                  <option value="student">Individual Learner Guardian</option>
                  <option value="all">Whole School (All Guardians)</option>
                </select>
              </div>
            </div>

            {audience === "grade" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Select Grade</label>
                <select
                  value={targetGrade}
                  onChange={(e) => setTargetGrade(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                >
                  {["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            )}

            {audience === "student" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Find Learner</label>
                {selectedStudent ? (
                  <div className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/40 text-xs">
                    <div>
                      <span className="font-semibold text-foreground">{selectedStudent.name}</span>
                      <span className="text-muted-foreground ml-2">Phone: {selectedStudent.phone || "—"} · Email: {selectedStudent.email || "—"}</span>
                    </div>
                    <button type="button" onClick={() => setSelectedStudent(null)} className="text-red-600 font-medium">Change</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type learner name or admission no..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                    />
                    {studentResults.data && studentResults.data.length > 0 && (
                      <div className="absolute z-10 left-0 right-0 mt-1 border rounded-lg bg-card shadow-xl max-h-40 overflow-y-auto divide-y">
                        {studentResults.data.map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              const guardian = st.parent_student?.map((link) => link.parents).find((parent) => parent != null);
                              const phone = guardian?.whatsapp_number || guardian?.phone;
                              setSelectedStudent({
                                id: st.id,
                                name: `${st.first_name} ${st.last_name}`,
                                ...(phone ? { phone } : {}),
                                ...(guardian?.email ? { email: guardian.email } : {}),
                              });
                              setStudentSearch("");
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-xs flex justify-between"
                          >
                            <span>{st.first_name} {st.last_name} ({st.classes?.grade ?? "No grade"})</span>
                            <span className="font-mono text-muted-foreground">{st.parent_student?.map((link) => link.parents?.whatsapp_number || link.parents?.phone).find(Boolean) || "No phone"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Use Pre-Approved Template (Optional)</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
              >
                <option value="">-- Custom Notice --</option>
                {templates.data?.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.name} ({tmpl.channel.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-muted-foreground">Message Body</label>
                <span className="text-[11px] text-muted-foreground">
                  {messageBody.length} chars {channel === "sms" ? `(${Math.ceil(messageBody.length / 160) || 1} SMS unit)` : ""}
                </span>
              </div>
              <textarea
                rows={4}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Dear Parent, this is an official notice regarding {{learner_name}}..."
                className="min-h-24 w-full p-3 border rounded-lg text-sm bg-background font-sans"
                required
              />
              <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
                <span>Placeholders:</span>
                <code className="bg-muted px-1 rounded">{"{{learner_name}}"}</code>
                <code className="bg-muted px-1 rounded">{"{{grade}}"}</code>
                <code className="bg-muted px-1 rounded">{"{{date}}"}</code>
              </div>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
            >
              <Send className="h-4 w-4" />
              {sending ? "Enqueuing..." : "Queue for Immediate Dispatch"}
            </button>
          </form>
        )}

        {tab === "queue" && (
          <div className="border rounded-xl overflow-hidden bg-card">
            <div className="p-3 border-b bg-muted/30 flex flex-wrap justify-between items-center gap-2">
              <span className="text-xs font-semibold">Latest Dispatch Activity</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDispatchQueue()}
                  disabled={dispatching}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {dispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {dispatching ? "Dispatching…" : "Dispatch Pending Queue"}
                </button>
                <button
                  onClick={() => qc.invalidateQueries({ queryKey: ["outbound-messages", schoolId] })}
                  className="flex min-h-11 items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3">Channel</th>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Message</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Scheduled / Sent</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {queue.data?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No outbound messages in dispatch queue.
                      </td>
                    </tr>
                  ) : (
                    queue.data?.map((m: any) => (
                      <tr key={m.id} className="hover:bg-muted/20">
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded font-mono uppercase font-bold text-[10px] bg-muted">
                            {m.channel}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-foreground">{m.recipient_name || "—"}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{m.recipient_phone || m.recipient_email || "—"}</div>
                        </td>
                        <td className="p-3 max-w-xs truncate text-[11px]" title={m.body}>
                          {m.body}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            m.status === "sent" || m.status === "delivered" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                            m.status === "queued" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                            m.status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {m.status === "delivered" ? <CheckCircle2 className="h-3 w-3" /> : null}
                            {m.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-muted-foreground">
                          {new Date(m.scheduled_at).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="p-3 text-right space-x-1">
                          {m.status === "queued" && (
                            <button
                              onClick={() => handleCancelMessage(m.id)}
                              className="px-2 py-1 text-[10px] border rounded text-red-600 hover:bg-muted font-medium"
                            >
                              Cancel
                            </button>
                          )}
                          {m.status === "failed" && (
                            <button
                              onClick={() => handleRetryMessage(m.id)}
                              className="px-2 py-1 text-[10px] border rounded text-primary hover:bg-muted font-medium"
                            >
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "templates" && (
          <div className="space-y-6">
            <form onSubmit={handleCreateTemplate} className="p-4 border rounded-xl bg-card space-y-4 max-w-xl">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Add Pre-Approved School Template
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Template Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Absenteeism Alert"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="min-h-11 w-full px-3 py-2 border rounded-lg text-xs bg-background"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Channel</label>
                  <select
                    value={newTemplateChannel}
                    onChange={(e) => setNewTemplateChannel(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg text-xs bg-background"
                  >
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Purpose / Tag</label>
                <input
                  type="text"
                  placeholder="e.g. Daily Attendance"
                  value={newTemplatePurpose}
                  onChange={(e) => setNewTemplatePurpose(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs bg-background"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Template Text</label>
                <textarea
                  rows={3}
                  placeholder="Dear Parent, your child {{learner_name}} was marked absent today..."
                  value={newTemplateBody}
                  onChange={(e) => setNewTemplateBody(e.target.value)}
                  className="min-h-20 w-full p-3 border rounded-lg text-xs bg-background"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={savingTemplate}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold"
              >
                {savingTemplate ? "Saving..." : "Save Template"}
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.data?.map((tmpl) => (
                <div key={tmpl.id} className="p-3 border rounded-xl bg-card space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-foreground">{tmpl.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-muted">
                      {tmpl.channel}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tmpl.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
