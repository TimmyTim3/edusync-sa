import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "./Shell";
import { toast } from "sonner";
import { UserCheck, Plus, Search, Award } from "lucide-react";

interface Props {
  schoolId: string;
}

const ACCOMMODATION_LABELS: Record<string, { label: string; desc: string; badge: string }> = {
  extra_time: { label: "Extra Time", desc: "15 min per hour concession", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  scribe: { label: "Appointed Scribe", desc: "Designated writer for written exams", badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  reader: { label: "Appointed Reader", desc: "Designated reader for examination papers", badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" },
  separate_venue: { label: "Separate Venue", desc: "Individual / quiet examination room", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  enlarged_print: { label: "Enlarged Print / Braille", desc: "A3 enlargement or braille transcription", badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300" },
  computer: { label: "Computer / Assistive Device", desc: "Approved non-networked laptop / speech tool", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  medical_concession: { label: "Medical Concession", desc: "Rest breaks, glucose monitoring, meds access", badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
};

export function LearnerAccommodations({ schoolId }: Props) {
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; admission: string } | null>(null);
  const [accommodationType, setAccommodationType] = useState<string>("extra_time");
  const [dbeReference, setDbeReference] = useState("");
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [medicalNotes, setMedicalNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const searchResults = useQuery({
    queryKey: ["search-students-accommodations", schoolId, studentSearch],
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

  const accommodations = useQuery({
    queryKey: ["learner-accommodations", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learner_accommodations")
        .select(`
          id, accommodation, dbe_reference, valid_from, valid_to, medical_notes, status, created_at,
          students ( id, first_name, last_name, admission_no )
        `)
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleCreateAccommodation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error("Please search and select a learner first");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("learner_accommodations").insert({
        school_id: schoolId,
        student_id: selectedStudent.id,
        accommodation: accommodationType,
        dbe_reference: dbeReference.trim() || null,
        valid_from: validFrom,
        valid_to: validTo || null,
        medical_notes: medicalNotes.trim() || null,
        status: "active",
      });
      if (error) throw error;

      toast.success(`Exam accommodation logged for ${selectedStudent.name}`);
      qc.invalidateQueries({ queryKey: ["learner-accommodations", schoolId] });
      setShowAddModal(false);
      setSelectedStudent(null);
      setStudentSearch("");
      setDbeReference("");
      setMedicalNotes("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save accommodation");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, nextStatus: "active" | "expired" | "withdrawn") => {
    try {
      const { error } = await supabase.from("learner_accommodations").update({ status: nextStatus }).eq("id", id);
      if (error) throw error;
      toast.success(`Status updated to ${nextStatus}`);
      qc.invalidateQueries({ queryKey: ["learner-accommodations", schoolId] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update accommodation status");
    }
  };

  const filteredList = accommodations.data?.filter((acc: any) => {
    const matchesType = filterType === "all" || acc.accommodation === filterType;
    const term = searchTerm.toLowerCase();
    const student = acc.students;
    const matchesSearch =
      !term ||
      student?.first_name?.toLowerCase().includes(term) ||
      student?.last_name?.toLowerCase().includes(term) ||
      student?.admission_no?.toLowerCase().includes(term) ||
      acc.dbe_reference?.toLowerCase().includes(term);
    return matchesType && matchesSearch;
  });

  const activeCount = accommodations.data?.filter((a: any) => a.status === "active").length || 0;
  const extraTimeCount = accommodations.data?.filter((a: any) => a.accommodation === "extra_time" && a.status === "active").length || 0;
  const scribeCount = accommodations.data?.filter((a: any) => a.accommodation === "scribe" && a.status === "active").length || 0;
  const venueCount = accommodations.data?.filter((a: any) => a.accommodation === "separate_venue" && a.status === "active").length || 0;

  return (
    <Card
      title="Learner Accommodations & Exam Concessions"
      description="Official Department of Basic Education (DBE) special concessions tracker. Record approved extra time, scribes, readers, separate venues, and medical concessions for term tests and matric examinations."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-muted/40 rounded-xl border">
            <span className="text-[11px] text-muted-foreground block font-medium">Total Active Concessions</span>
            <span className="text-xl font-bold text-foreground">{activeCount}</span>
          </div>
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <span className="text-[11px] text-blue-700 dark:text-blue-300 block font-medium">Extra Time</span>
            <span className="text-xl font-bold text-blue-700 dark:text-blue-300">{extraTimeCount}</span>
          </div>
          <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800">
            <span className="text-[11px] text-purple-700 dark:text-purple-300 block font-medium">Scribes / Readers</span>
            <span className="text-xl font-bold text-purple-700 dark:text-purple-300">{scribeCount}</span>
          </div>
          <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <span className="text-[11px] text-amber-700 dark:text-amber-300 block font-medium">Separate Venues</span>
            <span className="text-xl font-bold text-amber-700 dark:text-amber-300">{venueCount}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex flex-1 gap-2 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search candidate name or admission no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border rounded-lg text-xs bg-background"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-xs bg-background"
            >
              <option value="all">All Concessions</option>
              {Object.entries(ACCOMMODATION_LABELS).map(([key, info]) => (
                <option key={key} value={key}>{info.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowAddModal(!showAddModal)}
            className="px-3.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            {showAddModal ? "Close" : "Log New DBE Concession"}
          </button>
        </div>
                {showAddModal && (
          <form onSubmit={handleCreateAccommodation} className="p-4 border rounded-xl bg-card space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <Award className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Record DBE Concession / Medical Accommodation</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground block">Find Learner (Name or Adm No)</label>
                {selectedStudent ? (
                  <div className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/30">
                    <div>
                      <span className="text-xs font-bold text-foreground block">{selectedStudent.name}</span>
                      <span className="text-[11px] text-muted-foreground">Adm: {selectedStudent.admission}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(null)}
                      className="text-xs text-red-600 font-medium hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type at least 2 letters..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-xs bg-background"
                    />
                    {searchResults.data && searchResults.data.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 border rounded-lg bg-card shadow-lg max-h-40 overflow-y-auto divide-y">
                        {searchResults.data.map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              setSelectedStudent({ id: st.id, name: `${st.first_name} ${st.last_name}`, admission: st.admission_no });
                              setStudentSearch("");
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 text-xs flex justify-between"
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

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground block">Concession Type</label>
                <select
                  value={accommodationType}
                  onChange={(e) => setAccommodationType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs bg-background"
                >
                  {Object.entries(ACCOMMODATION_LABELS).map(([key, info]) => (
                    <option key={key} value={key}>{info.label} ({info.desc})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground block">DBE Reference / Case Number</label>
                <input
                  type="text"
                  placeholder="e.g. DBE/GP/2026/CONC-892 (or leave empty if school-internal)"
                  value={dbeReference}
                  onChange={(e) => setDbeReference(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs bg-background font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Valid From</label>
                  <input
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs bg-background"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Valid To</label>
                  <input
                    type="date"
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs bg-background"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Clinical / Medical Notes & Invigilator Instructions</label>
              <textarea
                rows={2}
                placeholder="e.g. Educational psychologist report on file. Candidate permitted 15 min rest break per 2-hour exam session. Needs seating near exit."
                value={medicalNotes}
                onChange={(e) => setMedicalNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-background"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-2 border rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold"
              >
                {saving ? "Saving..." : "Save DBE Concession"}
              </button>
            </div>
          </form>
        )}

        <div className="border rounded-xl overflow-x-auto bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="p-3 text-left">Candidate / Learner</th>
                <th className="p-3 text-left">Concession Approved</th>
                <th className="p-3 text-left">DBE Reference</th>
                <th className="p-3 text-left">Validity Period</th>
                <th className="p-3 text-left">Invigilator Notes</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredList?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No concessions found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredList?.map((acc: any) => {
                  const conf = ACCOMMODATION_LABELS[acc.accommodation] || { label: acc.accommodation, badge: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={acc.id} className="hover:bg-muted/20">
                      <td className="p-3">
                        <span className="font-semibold text-foreground block">
                          {acc.students?.last_name}, {acc.students?.first_name}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Adm: {acc.students?.admission_no}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${conf.badge}`}>
                          {conf.label}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">
                        {acc.dbe_reference || <span className="italic text-muted-foreground/60">School Internal</span>}
                      </td>
                      <td className="p-3 text-[11px]">
                        <span>{acc.valid_from}</span>
                        {acc.valid_to && <span className="text-muted-foreground"> → {acc.valid_to}</span>}
                      </td>
                      <td className="p-3 max-w-xs truncate text-[11px] text-muted-foreground" title={acc.medical_notes || ""}>
                        {acc.medical_notes || "—"}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          acc.status === "active" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                          acc.status === "expired" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                          "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}>
                          {acc.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {acc.status === "active" ? (
                          <button
                            onClick={() => handleUpdateStatus(acc.id, "withdrawn")}
                            className="px-2 py-1 text-[10px] border rounded hover:bg-muted text-red-600 font-medium"
                          >
                            Withdraw
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(acc.id, "active")}
                            className="px-2 py-1 text-[10px] border rounded hover:bg-muted text-emerald-600 font-medium"
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
                        }
