import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "./Shell";
import { toast } from "sonner";
import { BookOpen, Barcode, Plus, Search, RotateCcw } from "lucide-react";

interface Props {
  schoolId: string;
}

export function TextbookInventory({ schoolId }: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"catalog" | "issue" | "returns">("catalog");

  const [showAddTitle, setShowAddTitle] = useState(false);
  const [titleName, setTitleName] = useState("");
  const [isbn, setIsbn] = useState("");
  const [publisher, setPublisher] = useState("");
  const [grade, setGrade] = useState("Grade 10");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  const [selectedTitleId, setSelectedTitleId] = useState<string | null>(null);
  const [barcodePrefix, setBarcodePrefix] = useState("");
  const [copyCount, setCopyCount] = useState(30);
  const [generatingCopies, setGeneratingCopies] = useState(false);

  const [issueBarcode, setIssueBarcode] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; admission: string } | null>(null);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 10);
    return d.toISOString().slice(0, 10);
  });
  const [issuing, setIssuing] = useState(false);

  const [returnBarcode, setReturnBarcode] = useState("");
  const [returnCondition, setReturnCondition] = useState<"good" | "fair" | "damaged" | "lost">("good");
  const [replacementFee, setReplacementFee] = useState<number>(0);
  const [returnNotes, setReturnNotes] = useState("");
  const [processingReturn, setProcessingReturn] = useState(false);

  const subjects = useQuery({
    queryKey: ["subjects", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("id, name, code").eq("school_id", schoolId).order("name");
      return data ?? [];
    },
  });

  const titles = useQuery({
    queryKey: ["textbook-titles", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("textbook_titles").select("id, title, isbn, publisher, grade, subject_id, total_copies").eq("school_id", schoolId).order("title");
      if (error) throw error;
      return data ?? [];
    },
  });

  const copies = useQuery({
    queryKey: ["textbook-copies", selectedTitleId],
    enabled: !!selectedTitleId,
    queryFn: async () => {
      const { data, error } = await supabase.from("textbook_copies").select("id, barcode, condition, status").eq("title_id", selectedTitleId!).order("barcode");
      if (error) throw error;
      return data ?? [];
    },
  });

  const issues = useQuery({
    queryKey: ["textbook-issues", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("textbook_issues").select(`
        id, copy_id, student_id, issued_on, due_on, returned_on, return_condition, fee, fee_paid, notes,
        textbook_copies ( barcode, textbook_titles ( title, grade ) ),
        students ( id, first_name, last_name, admission_no )
      `).eq("school_id", schoolId).order("issued_on", { ascending: false }).limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const studentResults = useQuery({
    queryKey: ["learner-search-textbook", schoolId, studentSearch],
    enabled: studentSearch.trim().length >= 2,
    queryFn: async () => {
      const q = studentSearch.trim();
      const { data } = await supabase.from("students").select("id, first_name, last_name, admission_no").eq("school_id", schoolId).is("deleted_at", null).or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,admission_no.ilike.%${q}%`).limit(6);
      return data ?? [];
    },
  });

  const handleCreateTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleName.trim()) { toast.error("Textbook title is required"); return; }
    setSavingTitle(true);
    try {
      const { error } = await supabase.from("textbook_titles").insert({
        school_id: schoolId,
        title: titleName.trim(),
        isbn: isbn.trim() || null,
        publisher: publisher.trim() || null,
        grade,
        subject_id: selectedSubjectId || null,
        total_copies: 0,
      });
      if (error) throw error;
      toast.success("Textbook title added to LTSM catalogue");
      setTitleName(""); setIsbn(""); setPublisher(""); setShowAddTitle(false);
      void qc.invalidateQueries({ queryKey: ["textbook-titles", schoolId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to add title");
    } finally {
      setSavingTitle(false);
    }
  };

  const handleGenerateCopies = async () => {
    if (!selectedTitleId) { toast.error("Please pick a textbook title"); return; }
    if (!barcodePrefix.trim()) { toast.error("Barcode prefix is required (e.g. MATH-G10)"); return; }
    if (copyCount < 1 || copyCount > 200) { toast.error("Please enter between 1 and 200 copies"); return; }
    setGeneratingCopies(true);
    try {
      const prefix = barcodePrefix.trim().toUpperCase();
      const newCopies = Array.from({ length: copyCount }, (_, i) => ({
        school_id: schoolId,
        title_id: selectedTitleId,
        barcode: `${prefix}-${String(i + 1).padStart(3, "0")}`,
        condition: "new",
        status: "available",
      }));
      const { error } = await supabase.from("textbook_copies").insert(newCopies);
      if (error) throw error;
      await supabase.from("textbook_titles").update({ total_copies: (copies.data?.length ?? 0) + copyCount }).eq("id", selectedTitleId);
      toast.success(`Generated ${copyCount} inventory copies with barcode prefix ${prefix}`);
      setBarcodePrefix("");
      void qc.invalidateQueries({ queryKey: ["textbook-copies", selectedTitleId] });
      void qc.invalidateQueries({ queryKey: ["textbook-titles", schoolId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to generate copies");
    } finally {
      setGeneratingCopies(false);
    }
  };

  const handleIssueBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueBarcode.trim()) { toast.error("Please enter or scan a textbook barcode"); return; }
    if (!selectedStudent) { toast.error("Please select a recipient learner"); return; }
    setIssuing(true);
    try {
      const code = issueBarcode.trim().toUpperCase();
      const { data: copy, error: copyErr } = await supabase.from("textbook_copies").select("id, status, title_id").eq("school_id", schoolId).eq("barcode", code).maybeSingle();
      if (copyErr || !copy) { toast.error(`Barcode "${code}" not found in inventory`); setIssuing(false); return; }
      if (copy.status === "issued") { toast.error(`Copy "${code}" is currently issued to another learner`); setIssuing(false); return; }
      const todayStr = new Date().toISOString().slice(0, 10);
      const { error: issueErr } = await supabase.from("textbook_issues").insert({
        school_id: schoolId,
        copy_id: copy.id,
        student_id: selectedStudent.id,
        issued_on: todayStr,
        due_on: dueDate,
        fee: 0,
        fee_paid: false,
      });
      if (issueErr) throw issueErr;
      await supabase.from("textbook_copies").update({ status: "issued" }).eq("id", copy.id);
      toast.success(`Issued ${code} to ${selectedStudent.name}`);
      setIssueBarcode(""); setSelectedStudent(null); setStudentSearch("");
      void qc.invalidateQueries({ queryKey: ["textbook-issues", schoolId] });
      void qc.invalidateQueries({ queryKey: ["textbook-copies"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to issue textbook");
    } finally {
      setIssuing(false);
    }
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnBarcode.trim()) { toast.error("Please scan or type the returned barcode"); return; }
    setProcessingReturn(true);
    try {
      const code = returnBarcode.trim().toUpperCase();
      const { data: copy } = await supabase.from("textbook_copies").select("id").eq("school_id", schoolId).eq("barcode", code).maybeSingle();
      if (!copy) { toast.error(`Barcode "${code}" was not found`); setProcessingReturn(false); return; }
      const { data: issue } = await supabase.from("textbook_issues").select("id").eq("copy_id", copy.id).is("returned_on", null).order("issued_on", { ascending: false }).maybeSingle();
      if (!issue) { toast.error(`No active loan record for barcode "${code}"`); setProcessingReturn(false); return; }
      const todayStr = new Date().toISOString().slice(0, 10);
      const nextStatus = returnCondition === "lost" ? "lost" : "available";
      await supabase.from("textbook_issues").update({
        returned_on: todayStr,
        return_condition: returnCondition,
        fee: replacementFee,
        fee_paid: replacementFee === 0,
        notes: returnNotes.trim() || null,
      }).eq("id", issue.id);
      await supabase.from("textbook_copies").update({ condition: returnCondition, status: nextStatus }).eq("id", copy.id);
      toast.success(`Book return logged. Condition: ${returnCondition}${replacementFee > 0 ? ` (R${replacementFee} fee)` : ""}`);
      setReturnBarcode(""); setReturnNotes(""); setReplacementFee(0);
      void qc.invalidateQueries({ queryKey: ["textbook-issues", schoolId] });
      void qc.invalidateQueries({ queryKey: ["textbook-copies"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to process return");
    } finally {
      setProcessingReturn(false);
    }
  };

  return (
    <Card
      title="Textbook & LTSM Inventory Manager"
      description="Official CAPS Learning & Teaching Support Material tracker. Catalog books, generate barcode batches, issue to learners, and track year-end returns and replacement fees."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === "catalog" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <BookOpen className="h-4 w-4" /> LTSM Catalogue & Copies
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("issue")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === "issue" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <Barcode className="h-4 w-4" /> Issue to Learner
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("returns")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === "returns" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <RotateCcw className="h-4 w-4" /> Returns & Loss Recovery
          </button>
        </div>
                                                 {activeTab === "catalog" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Registered textbook titles: <strong>{titles.data?.length ?? 0}</strong></p>
              <button
                type="button"
                onClick={() => setShowAddTitle(!showAddTitle)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
              >
                <Plus className="h-4 w-4" /> {showAddTitle ? "Close Form" : "Add Textbook Title"}
              </button>
            </div>

            {showAddTitle && (
              <form onSubmit={handleCreateTitle} className="p-4 border rounded-xl bg-card space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Textbook Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Platinum Mathematics Grade 10"
                      value={titleName}
                      onChange={(e) => setTitleName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Target Grade</label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                    >
                      {["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"].map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Publisher</label>
                    <input
                      type="text"
                      placeholder="e.g. Pearson / Oxford University Press"
                      value={publisher}
                      onChange={(e) => setPublisher(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">ISBN (Optional)</label>
                    <input
                      type="text"
                      placeholder="978-0-123456-78-9"
                      value={isbn}
                      onChange={(e) => setIsbn(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={savingTitle} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                    {savingTitle ? "Saving..." : "Save Title to Catalogue"}
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {titles.data?.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTitleId(t.id)}
                  className={`p-4 border rounded-xl cursor-pointer transition ${
                    selectedTitleId === t.id ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm">{t.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.grade} • {t.publisher || "Publisher unspecified"}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">{t.total_copies} Copies</span>
                  </div>
                </div>
              ))}
            </div>

            {selectedTitleId && (
              <div className="p-4 border rounded-xl bg-muted/20 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Barcode className="h-4 w-4 text-primary" /> Physical Copies & Barcode Batch
                  </h4>
                  <p className="text-xs text-muted-foreground">Total tracked copies: <strong>{copies.data?.length ?? 0}</strong></p>
                </div>
                <div className="flex flex-wrap items-end gap-3 p-3 bg-card border rounded-lg">
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Barcode Prefix</label>
                    <input
                      type="text"
                      placeholder="e.g. MATH-G10"
                      value={barcodePrefix}
                      onChange={(e) => setBarcodePrefix(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background"
                    />
                  </div>
                  <div className="w-24">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={copyCount}
                      onChange={(e) => setCopyCount(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateCopies}
                    disabled={generatingCopies}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium"
                  >
                    {generatingCopies ? "Generating..." : "Generate Barcodes"}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {copies.data?.map((c) => (
                    <div key={c.id} className="p-2 border rounded-md bg-background text-xs flex justify-between items-center">
                      <span className="font-mono font-medium">{c.barcode}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize font-medium ${
                        c.status === "available" ? "bg-emerald-100 text-emerald-800" : c.status === "issued" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                      }`}>{c.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "issue" && (
          <form onSubmit={handleIssueBook} className="space-y-4 max-w-xl p-4 border rounded-xl bg-card">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Textbook Barcode</label>
              <input
                type="text"
                placeholder="Scan or type barcode (e.g. MATH-G10-001)"
                value={issueBarcode}
                onChange={(e) => setIssueBarcode(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Search Learner</label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Type name, surname or admission number..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-background"
                />
              </div>
              {studentResults.data && studentResults.data.length > 0 && !selectedStudent && (
                <div className="mt-1 border rounded-lg bg-card shadow-sm divide-y">
                  {studentResults.data.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedStudent({ id: s.id, name: `${s.first_name} ${s.last_name}`, admission: s.admission_no });
                        setStudentSearch(`${s.first_name} ${s.last_name} (${s.admission_no})`);
                      }}
                      className="p-2 text-xs hover:bg-muted cursor-pointer flex justify-between"
                    >
                      <span className="font-medium">{s.first_name} {s.last_name}</span>
                      <span className="font-mono text-muted-foreground">Adm: {s.admission_no}</span>
                    </div>
                  ))}
                </div>
              )}
              {selectedStudent && (
                <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex justify-between items-center">
                  <span>Selected: <strong>{selectedStudent.name}</strong> ({selectedStudent.admission})</span>
                  <button type="button" onClick={() => { setSelectedStudent(null); setStudentSearch(""); }} className="text-emerald-700 underline text-[11px]">Change</button>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Expected Return Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                required
              />
            </div>
            <button type="submit" disabled={issuing} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              {issuing ? "Logging Issue..." : "Confirm Textbook Issue"}
            </button>
          </form>
        )}

        {activeTab === "returns" && (
          <div className="space-y-6">
            <form onSubmit={handleProcessReturn} className="p-4 border rounded-xl bg-card space-y-4 max-w-xl">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Scan or Type Returned Barcode</label>
                <input
                  type="text"
                  placeholder="e.g. MATH-G10-001"
                  value={returnBarcode}
                  onChange={(e) => setReturnBarcode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Condition on Return</label>
                  <select
                    value={returnCondition}
                    onChange={(e) => setReturnCondition(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                  >
                    <option value="good">Good / Fair (No charge)</option>
                    <option value="damaged">Damaged / Torn</option>
                    <option value="lost">Lost / Missing</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Replacement Fee (R)</label>
                  <input
                    type="number"
                    min={0}
                    value={replacementFee}
                    onChange={(e) => setReplacementFee(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes / Inspector Comment</label>
                <input
                  type="text"
                  placeholder="e.g. Water damage to back pages"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                />
              </div>
              <button type="submit" disabled={processingReturn} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                {processingReturn ? "Logging..." : "Process Return & Update Inventory"}
              </button>
            </form>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Active & Recent Loans Audit Trail</h4>
              <div className="border rounded-xl overflow-x-auto bg-card">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-2.5 text-left">Barcode</th>
                      <th className="p-2.5 text-left">Learner</th>
                      <th className="p-2.5 text-left">Issued</th>
                      <th className="p-2.5 text-left">Due</th>
                      <th className="p-2.5 text-left">Status</th>
                      <th className="p-2.5 text-left">Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {issues.data?.map((iss: any) => (
                      <tr key={iss.id} className="hover:bg-muted/20">
                        <td className="p-2.5 font-mono font-medium">{iss.textbook_copies?.barcode || "—"}</td>
                        <td className="p-2.5">
                          {iss.students?.first_name} {iss.students?.last_name}
                          <span className="text-muted-foreground block text-[10px]">Adm: {iss.students?.admission_no}</span>
                        </td>
                        <td className="p-2.5">{iss.issued_on}</td>
                        <td className="p-2.5">{iss.due_on}</td>
                        <td className="p-2.5">
                          {iss.returned_on ? (
                            <span className="text-emerald-700 font-medium">Returned ({iss.returned_on})</span>
                          ) : (
                            <span className="text-amber-700 font-medium">Active Loan</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          {iss.fee > 0 ? <span className="font-semibold text-red-600">R{iss.fee}</span> : <span className="text-muted-foreground">R0</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
                    }
                
