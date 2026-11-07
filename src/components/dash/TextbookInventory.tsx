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
      `).eq("school_id", schoolId).order("issued_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const searchResults = useQuery({
    queryKey: ["search-students-textbooks", schoolId, studentSearch],
    enabled: studentSearch.trim().length >= 2,
    queryFn: async () => {
      const q = studentSearch.trim();
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, admission_no")
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,admission_no.ilike.%${q}%`)
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleCreateTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleName.trim()) return;
    setSavingTitle(true);
    try {
      const { error } = await supabase.from("textbook_titles").insert({
        school_id: schoolId,
        title: titleName.trim(),
        isbn: isbn.trim() || null,
        publisher: publisher.trim() || null,
        grade,
        subject_id: selectedSubjectId || null,
      });
      if (error) throw error;
      toast.success("Textbook title cataloged successfully");
      setTitleName("");
      setIsbn("");
      setPublisher("");
      setShowAddTitle(false);
      qc.invalidateQueries({ queryKey: ["textbook-titles", schoolId] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to add title");
    } finally {
      setSavingTitle(false);
    }
  };

  const handleGenerateCopies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTitleId || !barcodePrefix.trim() || copyCount <= 0) return;
    setGeneratingCopies(true);
    try {
      const newRows = Array.from({ length: Math.min(copyCount, 150) }).map((_, idx) => ({
        school_id: schoolId,
        title_id: selectedTitleId,
        barcode: `${barcodePrefix.trim().toUpperCase()}-${String(idx + 1).padStart(3, "0")}`,
        condition: "good",
        status: "available",
      }));
      const { error } = await supabase.from("textbook_copies").insert(newRows as any);
      if (error) throw error;
      await supabase.from("textbook_titles").update({
        total_copies: (copies.data?.length || 0) + newRows.length,
      }).eq("id", selectedTitleId);

      toast.success(`Generated ${newRows.length} inventory barcode copies`);
      setBarcodePrefix("");
      qc.invalidateQueries({ queryKey: ["textbook-copies", selectedTitleId] });
      qc.invalidateQueries({ queryKey: ["textbook-titles", schoolId] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate copies");
    } finally {
      setGeneratingCopies(false);
    }
  };

  const handleIssueBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueBarcode.trim() || !selectedStudent) {
      toast.error("Please enter a barcode and select a learner");
      return;
    }
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
      });
      if (issueErr) throw issueErr;

      await supabase.from("textbook_copies").update({ status: "issued" }).eq("id", copy.id);
      toast.success(`Book ${code} issued to ${selectedStudent.name}`);
      setIssueBarcode("");
      setSelectedStudent(null);
      setStudentSearch("");
      qc.invalidateQueries({ queryKey: ["textbook-issues", schoolId] });
      qc.invalidateQueries({ queryKey: ["textbook-copies"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to issue textbook");
    } finally {
      setIssuing(false);
    }
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnBarcode.trim()) return;
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
        notes: returnNotes.trim() || null,
      }).eq("id", issue.id);

      await supabase.from("textbook_copies").update({
        status: nextStatus,
        condition: returnCondition === "lost" ? "damaged" : returnCondition,
      }).eq("id", copy.id);

      toast.success(`Copy ${code} returned (${returnCondition}).`);
      setReturnBarcode("");
      setReplacementFee(0);
      setReturnNotes("");
      qc.invalidateQueries({ queryKey: ["textbook-issues", schoolId] });
      qc.invalidateQueries({ queryKey: ["textbook-copies"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to process return");
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
        <div className="flex border-b border-border text-xs font-medium gap-4">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "catalog" ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground"
            }`}
          >
            <BookOpen className="h-4 w-4" /> Textbook Catalog & Barcodes
          </button>
          <button
            onClick={() => setActiveTab("issue")}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "issue" ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground"
            }`}
          >
            <Barcode className="h-4 w-4" /> Issue to Learner
          </button>
          <button
            onClick={() => setActiveTab("returns")}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === "returns" ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground"
            }`}
          >
            <RotateCcw className="h-4 w-4" /> Returns & Lost Books
          </button>
        </div>

        {activeTab === "catalog" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{titles.data?.length || 0} Titles cataloged</span>
              <button
                onClick={() => setShowAddTitle(!showAddTitle)}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold flex items-center gap-1"
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
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Grade</label>
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
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Subject</label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                    >
                      <option value="">Select CAPS Subject (optional)</option>
                      {subjects.data?.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Publisher & ISBN</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Publisher (e.g. Pearson)"
                        value={publisher}
                        onChange={(e) => setPublisher(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                      />
                      <input
                        type="text"
                        placeholder="ISBN"
                        value={isbn}
                        onChange={(e) => setIsbn(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                      />
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={savingTitle} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold">
                  {savingTitle ? "Saving..." : "Save Title to Catalog"}
                </button>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-xl divide-y max-h-72 overflow-y-auto bg-card">
                {titles.data?.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTitleId(t.id)}
                    className={`w-full p-3 text-left flex justify-between items-center transition-colors ${
                      selectedTitleId === t.id ? "bg-primary/10 border-l-4 border-l-primary" : "hover:bg-muted/40"
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-foreground block">{t.title}</span>
                      <span className="text-[11px] text-muted-foreground">{t.grade} • {t.publisher || "DBE"}</span>
                    </div>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-muted">
                      {t.total_copies || 0} copies
                    </span>
                  </button>
                ))}
              </div>

              {selectedTitleId ? (
                <div className="p-4 border rounded-xl bg-card space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Barcode Batch Generator</h4>
                  <form onSubmit={handleGenerateCopies} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Prefix</label>
                        <input
                          type="text"
                          placeholder="e.g. MATH-G10"
                          value={barcodePrefix}
                          onChange={(e) => setBarcodePrefix(e.target.value)}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Copies to Add</label>
                        <input
                          type="number"
                          min={1}
                          max={150}
                          value={copyCount}
                          onChange={(e) => setCopyCount(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background"
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={generatingCopies} className="w-full py-2 bg-secondary text-secondary-foreground rounded-lg text-xs font-medium">
                      {generatingCopies ? "Generating..." : `Generate ${copyCount} Barcodes`}
                    </button>
                  </form>
                  <div className="border rounded-lg max-h-36 overflow-y-auto divide-y text-xs font-mono">
                    {copies.data?.map((c) => (
                      <div key={c.id} className="p-2 flex justify-between">
                        <span>{c.barcode}</span>
                        <span className={`text-[10px] uppercase font-bold ${c.status === "available" ? "text-emerald-600" : "text-amber-600"}`}>
                          {c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-8 border rounded-xl bg-muted/20 text-center text-xs text-muted-foreground flex flex-col items-center justify-center">
                  <Barcode className="h-8 w-8 mb-2 opacity-40" />
                  Select a title on the left to view or generate barcode copies.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "issue" && (
          <form onSubmit={handleIssueBook} className="p-4 border rounded-xl bg-card space-y-4 max-w-xl">
            <h4 className="text-sm font-semibold">Issue Textbook Copy to Learner</h4>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Scan or Type Barcode</label>
              <input
                type="text"
                placeholder="e.g. MATH-G10-001"
                value={issueBarcode}
                onChange={(e) => setIssueBarcode(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Find Learner</label>
              {selectedStudent ? (
                <div className="flex items-center justify-between p-2 border rounded-lg bg-muted/40">
                  <span className="text-xs font-medium">{selectedStudent.name} ({selectedStudent.admission})</span>
                  <button type="button" onClick={() => setSelectedStudent(null)} className="text-xs text-red-600">Change</button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search learner name or admission no..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                  />
                  {searchResults.data && searchResults.data.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 border rounded-lg bg-card shadow-lg max-h-40 overflow-y-auto divide-y">
                      {searchResults.data.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            setSelectedStudent({ id: st.id, name: `${st.first_name} ${st.last_name}`, admission: st.admission_no });
                            setStudentSearch("");
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-xs flex justify-between"
                        >
                          <span>{st.first_name} {st.last_name}</span>
                          <span className="font-mono text-muted-foreground">Adm: {st.admission_no}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Return Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
                required
              />
            </div>
            <button type="submit" disabled={issuing} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
              {issuing ? "Issuing..." : "Confirm Book Issue"}
            </button>
          </form>
        )}

        {activeTab === "returns" && (
          <div className="space-y-6">
            <form onSubmit={handleProcessReturn} className="p-4 border rounded-xl bg-card space-y-4 max-w-xl">
              <h4 className="text-sm font-semibold">Process Book Return or Report Lost</h4>
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
                          
