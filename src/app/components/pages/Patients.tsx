import { useState, useEffect, useRef } from "react";
import { Search, Phone, FileText, User, RefreshCw, Pencil, X, Check } from "lucide-react";
import { usePatients } from "../../../hooks/usePRAData";
import { PatientInfoPanel } from "../shared/PatientInfoPanel";
import { api } from "../../../lib/api";
import type { Patient } from "../../../lib/api";

const avatarColors = [
  "from-violet-400 to-purple-500", "from-pink-400 to-rose-500", "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500", "from-amber-400 to-orange-500", "from-rose-400 to-pink-500",
  "from-cyan-400 to-sky-500", "from-fuchsia-400 to-purple-500", "from-teal-400 to-cyan-500",
  "from-indigo-400 to-violet-500",
];

function PillGroup<T extends string>({ options, value, onChange }: {
  options: readonly T[]; value: T | ""; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
            value === opt ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
          }`}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function EditPatientPanel({ patient, onClose, onSaved }: {
  patient: Patient;
  onClose: () => void;
  onSaved: (updated: Patient) => void;
}) {
  const [name, setName] = useState(patient.name || "");
  const [mobile, setMobile] = useState(patient.mobile || "");
  const [dob, setDob] = useState((patient as Patient & { date_of_birth?: string }).date_of_birth || "");
  const [gender, setGender] = useState(patient.gender || "");
  const [language, setLanguage] = useState<"Tamil" | "English" | "Hindi" | "">(
    (patient.language as "Tamil" | "English" | "Hindi") || ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const genderDisplay = gender === "M" ? "Male" : gender === "F" ? "Female" : gender;

  const calcAge = (d: string) => {
    if (!d) return undefined;
    const born = new Date(d);
    const today = new Date();
    return today.getFullYear() - born.getFullYear() -
      ((today.getMonth() * 100 + today.getDate()) < (born.getMonth() * 100 + born.getDate()) ? 1 : 0);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name: name.trim(), mobile, gender: genderDisplay || gender, language };
      if (dob) { payload.date_of_birth = dob; payload.age = calcAge(dob); }
      const updated = await api.patients.update(patient.id, payload as Parameters<typeof api.patients.update>[1]);
      setSaved(true);
      setTimeout(() => { onSaved(updated); }, 800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-96 border-l border-slate-200 bg-white flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15 }} className="text-slate-800">
            Edit Patient
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{patient.patient_code || patient.name}</div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="p-5 space-y-5 flex-1">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Full Name *</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2.5 text-[13px] border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400" />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Mobile</label>
          <input value={mobile} onChange={e => setMobile(e.target.value)}
            className="w-full px-3 py-2.5 text-[13px] border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400" />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Date of Birth</label>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)}
              className="w-full px-3 py-2.5 text-[13px] border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400" />
          </div>
          <div className="w-20">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Age</label>
            <div className="w-full px-3 py-2.5 text-[13px] border border-slate-100 rounded-xl bg-slate-50 text-slate-500">
              {dob ? `${calcAge(dob)} yrs` : patient.age ? `${patient.age} yrs` : "—"}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Gender</label>
          <PillGroup
            options={["Male", "Female", "Other"] as const}
            value={(genderDisplay as "Male" | "Female" | "Other" | "")}
            onChange={v => setGender(v)}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Language</label>
          <PillGroup
            options={["Tamil", "English", "Hindi"] as const}
            value={language}
            onChange={v => setLanguage(v)}
          />
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 text-[12px] text-rose-700">{error}</div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
            saved ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
            "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-200 disabled:opacity-50"
          }`}
        >
          {saved ? <><Check size={14} /> Saved!</> : saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

export function Patients() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [localUpdates, setLocalUpdates] = useState<Record<string, Patient>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [search]);

  const { data: rawPatients, loading, error, refetch } = usePatients(debouncedSearch || undefined);

  // Merge local updates over server data
  const patients = rawPatients.map(p => localUpdates[p.id] ? { ...p, ...localUpdates[p.id] } : p);

  const handleSaved = (updated: Patient) => {
    setLocalUpdates(prev => ({ ...prev, [updated.id]: updated }));
    setEditingPatient(null);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 p-7 space-y-5 overflow-y-auto">
        {error && (
          <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
            <span className="text-[13px] text-rose-700 flex-1">Failed to load patients.</span>
            <button onClick={() => refetch()} className="flex items-center gap-1 text-[12px] font-semibold text-rose-600">
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or mobile…"
              className="pl-8 pr-4 py-2 text-[13px] bg-white border border-slate-200 rounded-xl w-full text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400"
            />
          </div>
          <div className="ml-auto text-[13px] text-slate-500">
            <span className="font-semibold text-slate-700">{loading ? "…" : patients.length}</span> patients
          </div>
        </div>

        {/* Summary pill */}
        <div className="flex gap-3">
          <div className="px-4 py-2 border rounded-xl text-[12px] font-semibold bg-slate-50 border-slate-200 text-slate-700">
            {loading ? "…" : patients.length} Total Patients
          </div>
        </div>

        {/* Patient cards grid */}
        {loading ? (
          <div className="text-center py-12 text-[13px] text-slate-400">Loading patients…</div>
        ) : patients.length === 0 ? (
          <div className="text-center py-12 text-[13px] text-slate-400">No patients found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patients.map((p, idx) => {
              const color = avatarColors[idx % avatarColors.length];
              const isSelected = selectedPatientId === p.id;
              return (
                <div key={p.id}
                  onClick={() => { setSelectedPatientId(isSelected ? null : p.id); setEditingPatient(null); }}
                  className={`bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md transition-all cursor-pointer group ${isSelected ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-100"}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white text-lg font-bold shadow-sm flex-shrink-0`}>
                      {p.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }} className="text-slate-800 truncate">{p.name}</span>
                        {p.patient_code && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-slate-50 border-slate-200 text-slate-500">{p.patient_code}</span>
                        )}
                      </div>
                      <div className="text-[12px] text-slate-400 mt-0.5">
                        {p.age ? `${p.age} yrs · ` : ""}
                        {p.gender === "M" ? "Male" : p.gender === "F" ? "Female" : p.gender || ""}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide">Mobile</div>
                      <div className="text-[12px] font-semibold text-slate-700 mt-0.5">{p.mobile || "—"}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide">Registered</div>
                      <div className="text-[12px] font-semibold text-slate-700 mt-0.5">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-all">
                      <User size={11} /> Profile
                    </button>
                    <button className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-all">
                      <FileText size={11} /> Records
                    </button>
                    {p.mobile && (
                      <button className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-all">
                        <Phone size={11} /> {p.mobile}
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setEditingPatient(editingPatient?.id === p.id ? null : p); setSelectedPatientId(null); }}
                      className={`ml-auto flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                        editingPatient?.id === p.id
                          ? "border-amber-300 bg-amber-50 text-amber-600"
                          : "border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50"
                      }`}
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right panel — edit takes priority over profile */}
      {editingPatient && (
        <EditPatientPanel
          patient={editingPatient}
          onClose={() => setEditingPatient(null)}
          onSaved={handleSaved}
        />
      )}
      {!editingPatient && selectedPatientId && (
        <PatientInfoPanel
          patientId={selectedPatientId}
          onClose={() => setSelectedPatientId(null)}
        />
      )}
    </div>
  );
}
