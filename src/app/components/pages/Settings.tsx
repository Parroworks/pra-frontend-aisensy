import { useState, useEffect, useCallback } from "react";
import {
  Save, Building2, Clock, Bell, MessageSquare, RefreshCw,
  CheckCircle, AlertCircle, Loader2, ShieldAlert, CalendarDays,
  Sun, Moon, Copy, Video,
} from "lucide-react";
import type { ClinicScheduleResponse, ClinicScheduleDay, ClinicScheduleSession, DoctorOnlineSettings, OnlineDayEntry, OnlineDaySession } from "../../../lib/api";
import { api } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";

const API_BASE = (import.meta.env.VITE_API_URL as string);

type ConfigRow = {
  config_key: string;
  config_value: string;
  config_type: string;
  description: string;
  updated_at: string;
};
type SaveState = "idle" | "saving" | "saved" | "error";

// ── Generic helpers ───────────────────────────────────────────────────────────

function keyLabel(key: string): string {
  return key
    .replace(/^(clinic|scheduler|feature|template)\./, "")
    .replace(/\./g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function genTimeOptions(start: string, end: string, dur: number): string[] {
  const opts: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur <= endMin) {
    const h = Math.floor(cur / 60);
    const mn = cur % 60;
    opts.push(`${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}`);
    cur += dur;
  }
  return opts;
}

// ── Config (non-schedule rows) ────────────────────────────────────────────────

function useConfig() {
  const { doctorId: DOCTOR_ID } = useAuth();
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/config/${DOCTOR_ID}`);
      const data = await r.json();
      // Exclude per-day schedule rows — those are managed by WeeklyScheduleSection
      setRows((data as ConfigRow[]).filter(row => !row.config_key.startsWith("clinic.schedule.")));
    } catch {
      setError("Failed to load config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { rows, loading, error, reload };
}

type SaveKeyResult = { ok: true } | { ok: false; blocked?: string };

async function saveKey(doctorId: string, key: string, value: string): Promise<SaveKeyResult> {
  try {
    const r = await fetch(`${API_BASE}/config/${doctorId}/${encodeURIComponent(key)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config_value: value }),
    });
    if (r.status === 409) {
      const body = await r.json().catch(() => ({}));
      return { ok: false, blocked: body.message || "Active appointments exist — cannot change slot settings." };
    }
    return r.ok ? { ok: true } : { ok: false };
  } catch {
    return { ok: false };
  }
}

async function reloadScheduler(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/config/reload-scheduler`, { method: "POST" });
    return r.ok;
  } catch {
    return false;
  }
}

// ── UI sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center`}>{icon}</div>
      <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15 }} className="text-slate-800">{title}</h3>
    </div>
  );
}

function ConfigField({ row, onChange }: { row: ConfigRow; onChange: (key: string, value: string) => void }) {
  const label = keyLabel(row.config_key);
  if (row.config_type === "boolean") {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
        <div>
          <div className="text-[13px] font-medium text-slate-700">{label}</div>
          {row.description && <div className="text-[11px] text-slate-400">{row.description}</div>}
        </div>
        <input type="checkbox" checked={row.config_value === "true"}
          onChange={(e) => onChange(row.config_key, e.target.checked ? "true" : "false")}
          className="accent-emerald-500 w-4 h-4 cursor-pointer" />
      </div>
    );
  }
  if (row.config_type === "time") {
    return (
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{label}</label>
        <input type="time" value={row.config_value} onChange={(e) => onChange(row.config_key, e.target.value)}
          className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 bg-white" />
        {row.description && <p className="text-[11px] text-slate-400 mt-1">{row.description}</p>}
      </div>
    );
  }
  if (row.config_type === "string" && row.config_key.startsWith("template.")) {
    return (
      <div className="col-span-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{label}</label>
        <textarea rows={5} value={row.config_value} onChange={(e) => onChange(row.config_key, e.target.value)}
          className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 bg-white font-mono resize-y" />
        {row.description && <p className="text-[11px] text-slate-400 mt-1">{row.description}</p>}
      </div>
    );
  }
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{label}</label>
      <input value={row.config_value} onChange={(e) => onChange(row.config_key, e.target.value)}
        className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 bg-white" />
      {row.description && <p className="text-[11px] text-slate-400 mt-1">{row.description}</p>}
    </div>
  );
}

// ── Weekly Schedule Section ───────────────────────────────────────────────────

const DAYS_META = [
  { key: "monday",    label: "Mon", full: "Monday" },
  { key: "tuesday",  label: "Tue", full: "Tuesday" },
  { key: "wednesday",label: "Wed", full: "Wednesday" },
  { key: "thursday", label: "Thu", full: "Thursday" },
  { key: "friday",   label: "Fri", full: "Friday" },
  { key: "saturday", label: "Sat", full: "Saturday" },
  { key: "sunday",   label: "Sun", full: "Sunday" },
];

function TimeDropdown({
  value, onChange, options, disabled,
}: {
  value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      className="px-2 py-1 text-[12px] border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed min-w-0 flex-shrink">
      {options.map(o => <option key={o} value={o}>{fmt12(o)}</option>)}
    </select>
  );
}

const FULL_DAY_START = "06:00";
const FULL_DAY_END   = "23:30";

function DayRow({
  dayMeta, dayData, onChange, onCopyToWeekdays,
}: {
  dayMeta: typeof DAYS_META[0];
  dayData: ClinicScheduleDay;
  onChange: (updates: Partial<ClinicScheduleDay> | { morning?: Partial<ClinicScheduleSession>; evening?: Partial<ClinicScheduleSession> }) => void;
  onCopyToWeekdays: () => void;
}) {
  const isWeekday = !["saturday", "sunday"].includes(dayMeta.key);
  const dur = dayData.slot_duration_minutes || 10;
  const [showDurInfo, setShowDurInfo] = useState(false);

  const allOpts    = genTimeOptions(FULL_DAY_START, FULL_DAY_END, dur);
  const mStartOpts = allOpts.slice(0, -1);
  const mEndOpts   = allOpts.filter(o => o > dayData.morning.start);
  const eStartOpts = allOpts.slice(0, -1);
  const eEndOpts   = allOpts.filter(o => o > dayData.evening.start);

  const updateSession = (session: "morning" | "evening", patch: Partial<ClinicScheduleSession>) =>
    onChange({ [session]: { ...dayData[session], ...patch } });

  return (
    <div className={`rounded-xl border transition-all ${dayData.enabled ? "bg-white border-slate-100" : "bg-slate-50/60 border-slate-100"}`}>
      {/* Header row */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <span className="text-[13px] font-bold text-slate-700 w-8 shrink-0">{dayMeta.label}</span>
        <button type="button"
          onClick={() => onChange({ enabled: !dayData.enabled })}
          className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border transition-colors ${
            dayData.enabled
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
          }`}>
          {dayData.enabled ? "Open" : "Closed"}
        </button>

        {dayData.enabled && (
          <>
            {/* Slot duration per day */}
            <div className="flex items-center gap-1 ml-3">
              <Clock size={11} className="text-slate-400" />
              <select
                value={dur}
                onChange={e => { onChange({ slot_duration_minutes: Number(e.target.value) }); setShowDurInfo(true); }}
                className="px-2 py-0.5 text-[11px] border border-slate-200 rounded-lg text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-300"
              >
                {[5, 10, 15, 20, 30].map(v => <option key={v} value={v}>{v} min</option>)}
              </select>
            </div>

            {showDurInfo && (
              <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5">
                Dates with existing bookings keep their old slot times. New duration applies to empty dates only.
              </span>
            )}

            {isWeekday && (
              <button type="button" onClick={onCopyToWeekdays}
                className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-600 transition-colors">
                <Copy size={10} /> Copy to weekdays
              </button>
            )}
          </>
        )}
      </div>

      {dayData.enabled ? (
        <div className="border-t border-slate-50 px-3.5 pb-2.5 pt-2 space-y-2">
          {/* Morning row */}
          <div className="flex flex-wrap items-center gap-2">
            <Sun size={11} className="text-amber-400 shrink-0" />
            <span className="text-[11px] text-slate-500 w-14 shrink-0">Morning</span>
            <button type="button"
              onClick={() => updateSession("morning", { enabled: !dayData.morning.enabled })}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border mr-1 transition-colors ${
                dayData.morning.enabled
                  ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  : "bg-slate-100 text-slate-400 border-slate-200"
              }`}>
              {dayData.morning.enabled ? "On" : "Off"}
            </button>
            {dayData.morning.enabled ? (
              <div className="flex items-center gap-1 flex-wrap min-w-0">
                <TimeDropdown value={dayData.morning.start} options={mStartOpts}
                  onChange={v => updateSession("morning", { start: v })} />
                <span className="text-[11px] text-slate-400">–</span>
                <TimeDropdown value={dayData.morning.end} options={mEndOpts.length ? mEndOpts : [dayData.morning.end]}
                  onChange={v => updateSession("morning", { end: v })} />
              </div>
            ) : (
              <span className="text-[11px] text-slate-400">Not available</span>
            )}
          </div>

          {/* Evening row */}
          <div className="flex flex-wrap items-center gap-2">
            <Moon size={11} className="text-indigo-400 shrink-0" />
            <span className="text-[11px] text-slate-500 w-14 shrink-0">Evening</span>
            <button type="button"
              onClick={() => updateSession("evening", { enabled: !dayData.evening.enabled })}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border mr-1 transition-colors ${
                dayData.evening.enabled
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                  : "bg-slate-100 text-slate-400 border-slate-200"
              }`}>
              {dayData.evening.enabled ? "On" : "Off"}
            </button>
            {dayData.evening.enabled ? (
              <div className="flex items-center gap-1 flex-wrap min-w-0">
                <TimeDropdown value={dayData.evening.start} options={eStartOpts}
                  onChange={v => updateSession("evening", { start: v })} />
                <span className="text-[11px] text-slate-400">–</span>
                <TimeDropdown value={dayData.evening.end} options={eEndOpts.length ? eEndOpts : [dayData.evening.end]}
                  onChange={v => updateSession("evening", { end: v })} />
              </div>
            ) : (
              <span className="text-[11px] text-slate-400">Not available</span>
            )}
          </div>
        </div>
      ) : (
        <p className="px-3.5 pb-2.5 text-[11px] text-slate-400">Closed — no appointments</p>
      )}
    </div>
  );
}

function WeeklyScheduleSection() {
  const { doctorId: DOCTOR_ID } = useAuth();
  const [remote, setRemote] = useState<ClinicScheduleResponse | null>(null);
  const [local, setLocal]   = useState<ClinicScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/clinic/schedule?doctor_id=${DOCTOR_ID}`)
      .then(r => r.json())
      .then((d: ClinicScheduleResponse) => {
        setRemote(d);
        setLocal(JSON.parse(JSON.stringify(d)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateDay = (dayKey: string, updates: Partial<ClinicScheduleDay>) => {
    if (!local) return;
    setLocal({
      ...local,
      schedule: { ...local.schedule, [dayKey]: { ...local.schedule[dayKey], ...updates } },
    });
    setSaveState("idle");
  };

  const copyToWeekdays = (srcKey: string) => {
    if (!local) return;
    const src = local.schedule[srcKey];
    const newSchedule = { ...local.schedule };
    ["monday","tuesday","wednesday","thursday","friday"].forEach(d => {
      newSchedule[d] = {
        ...newSchedule[d],
        slot_duration_minutes: src.slot_duration_minutes,
        morning: { ...src.morning },
        evening: { ...src.evening },
      };
    });
    setLocal({ ...local, schedule: newSchedule });
    setSaveState("idle");
  };

  const handleSave = async () => {
    if (!local) return;
    setSaveState("saving");
    setSaveMsg("");
    try {
      const r = await fetch(`${API_BASE}/clinic/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor_id: DOCTOR_ID, schedule: local.schedule }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }
      const updated: ClinicScheduleResponse = await r.json();
      setRemote(updated);
      setLocal(JSON.parse(JSON.stringify(updated)));
      setSaveState("saved");
      setSaveMsg("Weekly schedule saved.");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (e) {
      setSaveState("error");
      setSaveMsg(e instanceof Error ? e.message : "Save failed");
    }
  };

  const handleReset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    if (!local) return;
    const newSchedule: Record<string, ClinicScheduleDay> = {};
    DAYS_META.forEach(({ key }) => {
      const open = key !== "sunday";
      newSchedule[key] = {
        enabled: open,
        slot_duration_minutes: 10,
        morning: { enabled: open, start: "09:30", end: "13:30" },
        evening: { enabled: open, start: "17:30", end: "21:30" },
      };
    });
    setLocal({ ...local, schedule: newSchedule });
    setConfirmReset(false);
    setSaveState("idle");
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-3 text-slate-400 text-[13px]">
          <Loader2 size={16} className="animate-spin" /> Loading weekly schedule…
        </div>
      </div>
    );
  }

  if (!local) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <SectionHeader
        icon={<CalendarDays size={16} className="text-teal-600" />}
        title="Weekly Schedule"
        color="bg-teal-50"
      />
      <p className="text-[12px] text-slate-400 mb-5 -mt-2">
        Set default clinic hours per day. These apply to all future dates unless overridden in Availability.
      </p>

      {/* Per-day rows */}
      <div className="space-y-2">
        {DAYS_META.map(dm => (
          <DayRow
            key={dm.key}
            dayMeta={dm}
            dayData={local.schedule[dm.key]}
            onChange={updates => updateDay(dm.key, updates as Partial<ClinicScheduleDay>)}
            onCopyToWeekdays={() => copyToWeekdays(dm.key)}
          />
        ))}
      </div>

      {/* Save message */}
      {saveState !== "idle" && saveMsg && (
        <div className={`mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium ${
          saveState === "saved"
            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
            : "bg-rose-50 border border-rose-200 text-rose-700"
        }`}>
          {saveState === "saved" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {saveMsg}
        </div>
      )}

      {/* Footer */}
      <div className="mt-5 flex items-center gap-4 flex-wrap">
        <button onClick={handleSave} disabled={saveState === "saving"}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-colors">
          {saveState === "saving" ? <Loader2 size={14} className="animate-spin" />
            : saveState === "saved" ? <CheckCircle size={14} />
            : saveState === "error" ? <AlertCircle size={14} />
            : <Save size={14} />}
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved!" : saveState === "error" ? "Error — retry" : "Save Weekly Schedule"}
        </button>

        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)}
            className="text-[13px] text-slate-400 hover:text-slate-600 transition-colors underline-offset-2 hover:underline">
            Reset to Default
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            <span className="text-[12px] text-rose-700">Reset Mon–Sat to full hours, Sun to closed?</span>
            <button onClick={handleReset} className="text-[12px] font-semibold text-rose-600 hover:text-rose-800">Yes, reset</button>
            <button onClick={() => setConfirmReset(false)} className="text-[12px] text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Settings component ───────────────────────────────────────────────────

// ── Online Consultation Section ───────────────────────────────────────────────

const DAYS_ORDER = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

function genHours(from = "05:00", to = "23:30", step = 15) {
  const opts: string[] = [];
  const [sh, sm] = from.split(":").map(Number);
  const [eh, em] = to.split(":").map(Number);
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur <= endMin) {
    const h = Math.floor(cur / 60), m = cur % 60;
    opts.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
    cur += step;
  }
  return opts;
}
const HOUR_OPTS = genHours();

const DEFAULT_DAY_ENTRY = (day: string): OnlineDayEntry => ({
  day,
  morning: { enabled: false, start: "10:00", end: "13:30" },
  evening: { enabled: true,  start: "20:00", end: "21:00" },
});

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function SessionRow({
  label, icon, session, onChange, overlapError,
}: {
  label: string;
  icon: React.ReactNode;
  session: OnlineDaySession;
  onChange: (updates: Partial<OnlineDaySession>) => void;
  overlapError?: string;
}) {
  return (
    <div className="flex flex-col gap-1 pl-2">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange({ enabled: !session.enabled })}
          className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border transition-all min-w-[58px] justify-center ${
            session.enabled
              ? overlapError ? "bg-red-100 text-red-700 border-red-200" : "bg-blue-100 text-blue-700 border-blue-200"
              : "bg-slate-50 text-slate-400 border-slate-200"
          }`}
        >
          {icon} {session.enabled ? "On" : "Off"}
        </button>
        {session.enabled ? (
          <div className="flex items-center gap-2">
            <select
              value={session.start}
            onChange={e => onChange({ start: e.target.value })}
            className="text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            {HOUR_OPTS.map(o => <option key={o} value={o}>{fmt12(o)}</option>)}
          </select>
          <span className="text-[11px] text-slate-400">–</span>
          <select
            value={session.end}
            onChange={e => onChange({ end: e.target.value })}
            className="text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            {HOUR_OPTS.map(o => <option key={o} value={o}>{fmt12(o)}</option>)}
          </select>
          <span className="text-[11px] text-blue-500 font-semibold">💻 Online</span>
        </div>
      ) : (
        <span className="text-[12px] text-slate-300">{label} — not available</span>
      )}
      </div>
      {overlapError && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-600 font-medium ml-1">
          <AlertCircle size={11} /> {overlapError}
        </div>
      )}
    </div>
  );
}

function getOverlapError(
  day: string,
  session: "morning" | "evening",
  onlineStart: string,
  onlineEnd: string,
  clinicSchedule: ClinicScheduleResponse | null,
): string | undefined {
  if (!clinicSchedule) return undefined;
  const dayData = clinicSchedule.schedule[day];
  if (!dayData || !dayData.enabled) return undefined;
  const clinicSess = dayData[session];
  if (!clinicSess || !clinicSess.enabled) return undefined;
  if (timesOverlap(onlineStart, onlineEnd, clinicSess.start, clinicSess.end)) {
    return `Overlaps with in-clinic ${session} (${fmt12(clinicSess.start)}–${fmt12(clinicSess.end)})`;
  }
  return undefined;
}

function OnlineConsultationSection() {
  const { doctorId: DOCTOR_ID } = useAuth();
  const [settings, setSettings] = useState<DoctorOnlineSettings>({
    online_consultation_enabled: false,
    online_consultation_hours: [],
    online_consultation_fee: 0,
  });
  const [clinicSchedule, setClinicSchedule] = useState<ClinicScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    Promise.all([
      api.doctors.getOnlineSettings(DOCTOR_ID),
      fetch(`${API_BASE}/clinic/schedule?doctor_id=${DOCTOR_ID}`).then(r => r.json()),
    ]).then(([s, sched]) => {
        const migrated = (s.online_consultation_hours || []).map((h: OnlineDayEntry & { start?: string; end?: string }) => {
          if (!h.morning && !h.evening) {
            return {
              day: h.day,
              morning: { enabled: false, start: "10:00", end: "13:30" },
              evening: { enabled: true, start: (h as { start?: string }).start || "20:00", end: (h as { end?: string }).end || "21:00" },
            } as OnlineDayEntry;
          }
          return h;
        });
        setSettings({ ...s, online_consultation_hours: migrated });
        setClinicSchedule(sched as ClinicScheduleResponse);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function getDay(day: string): OnlineDayEntry | undefined {
    return settings.online_consultation_hours.find(h => h.day === day);
  }

  function toggleDay(day: string) {
    if (getDay(day)) {
      setSettings(s => ({ ...s, online_consultation_hours: s.online_consultation_hours.filter(h => h.day !== day) }));
    } else {
      setSettings(s => ({ ...s, online_consultation_hours: [...s.online_consultation_hours, DEFAULT_DAY_ENTRY(day)] }));
    }
  }

  function updateSession(day: string, session: "morning" | "evening", updates: Partial<OnlineDaySession>) {
    setSettings(s => ({
      ...s,
      online_consultation_hours: s.online_consultation_hours.map(h =>
        h.day === day ? { ...h, [session]: { ...h[session], ...updates } } : h
      ),
    }));
  }

  const hasAnyOverlap = settings.online_consultation_hours.some(entry => {
    for (const sess of ["morning", "evening"] as const) {
      const s = entry[sess];
      if (s?.enabled && getOverlapError(entry.day, sess, s.start, s.end, clinicSchedule)) return true;
    }
    return false;
  });

  async function handleSave() {
    if (hasAnyOverlap) return;
    setSaveState("saving");
    try {
      await api.doctors.updateOnlineSettings(DOCTOR_ID, settings);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
    }
  }

  if (loading) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <Video size={14} className="text-blue-600" />
          </div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }} className="text-[15px] text-slate-800">
            Online Consultations
          </span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-[12px] font-medium text-slate-500">{settings.online_consultation_enabled ? "Enabled" : "Disabled"}</span>
          <div
            onClick={() => setSettings(s => ({ ...s, online_consultation_enabled: !s.online_consultation_enabled }))}
            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${settings.online_consultation_enabled ? "bg-blue-500" : "bg-slate-300"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${settings.online_consultation_enabled ? "left-5" : "left-0.5"}`} />
          </div>
        </label>
      </div>

      {settings.online_consultation_enabled && (
        <>
          <p className="text-[12px] text-slate-400 mb-5">Configure which days and sessions are available for online consultations. Each day has Morning and Evening sessions.</p>
          <div className="space-y-4">
            {DAYS_ORDER.map(day => {
              const entry = getDay(day);
              const isOpen = !!entry;
              return (
                <div key={day} className="border border-slate-100 rounded-xl overflow-hidden">
                  {/* Day header */}
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50">
                    <span className="text-[13px] font-bold text-slate-600 w-12">{DAY_LABELS[day]}</span>
                    <button
                      onClick={() => toggleDay(day)}
                      className={`text-[11px] font-bold px-3 py-1 rounded-lg border transition-all ${
                        isOpen ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-400 border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      {isOpen ? "Open" : "Closed"}
                    </button>
                    {!isOpen && <span className="text-[12px] text-slate-300">No online consultations</span>}
                  </div>

                  {/* Sessions */}
                  {isOpen && entry && (
                    <div className="px-4 py-3 space-y-3">
                      <SessionRow
                        label="Morning"
                        icon={<Sun size={10} />}
                        session={entry.morning}
                        onChange={u => updateSession(day, "morning", u)}
                        overlapError={entry.morning.enabled ? getOverlapError(day, "morning", entry.morning.start, entry.morning.end, clinicSchedule) : undefined}
                      />
                      <SessionRow
                        label="Evening"
                        icon={<Moon size={10} />}
                        session={entry.evening}
                        onChange={u => updateSession(day, "evening", u)}
                        overlapError={entry.evening.enabled ? getOverlapError(day, "evening", entry.evening.start, entry.evening.end, clinicSchedule) : undefined}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-2">
        {hasAnyOverlap && (
          <div className="flex items-center gap-2 text-[12px] text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={13} /> Fix overlapping times with in-clinic schedule before saving.
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saveState === "saving" || hasAnyOverlap}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white text-[13px] font-semibold px-5 py-2 rounded-xl shadow-sm transition-colors"
          >
            {saveState === "saving" ? <Loader2 size={14} className="animate-spin" />
              : saveState === "saved" ? <CheckCircle size={14} />
              : saveState === "error" ? <AlertCircle size={14} />
              : <Save size={14} />}
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved!" : saveState === "error" ? "Error" : "Save Online Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  const { doctorId: DOCTOR_ID, user } = useAuth();
  const isDoctor = user?.role === "doctor";
  const { rows, loading, error, reload } = useConfig();
  const [localRows, setLocalRows] = useState<ConfigRow[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [reloadState, setReloadState] = useState<SaveState>("idle");
  const [blockedMessage, setBlockedMessage] = useState("");

  useEffect(() => { setLocalRows(rows); }, [rows]);

  const handleChange = (key: string, value: string) => {
    setLocalRows(prev => prev.map(r => r.config_key === key ? { ...r, config_value: value } : r));
    setSaveState("idle");
    setBlockedMessage("");
  };

  const handleSave = async () => {
    setSaveState("saving");
    setBlockedMessage("");
    const original = rows.reduce<Record<string, string>>((acc, r) => { acc[r.config_key] = r.config_value; return acc; }, {});
    const changed = localRows.filter(r => r.config_value !== original[r.config_key]);

    const results = await Promise.all(changed.map(r => saveKey(DOCTOR_ID, r.config_key, r.config_value)));
    const blocked = results.find((r): r is { ok: false; blocked: string } => !r.ok && !!("blocked" in r && r.blocked));
    if (blocked) {
      setSaveState("error");
      setBlockedMessage(blocked.blocked!);
      return;
    }
    const allOk = results.every(r => r.ok);
    setSaveState(allOk ? "saved" : "error");
    if (allOk) { await reload(); setTimeout(() => setSaveState("idle"), 2500); }
  };

  const handleReloadScheduler = async () => {
    setReloadState("saving");
    const ok = await reloadScheduler();
    setReloadState(ok ? "saved" : "error");
    setTimeout(() => setReloadState("idle"), 2500);
  };

  if (loading) {
    return (
      <div className="p-7 flex items-center gap-3 text-slate-400 text-[13px]">
        <Loader2 size={16} className="animate-spin" /> Loading settings…
      </div>
    );
  }
  if (error) return <div className="p-7 text-red-500 text-[13px]">{error}</div>;

  const by = (prefix: string) => localRows.filter(r => r.config_key.startsWith(prefix));
  const byKey = (key: string) => localRows.find(r => r.config_key === key);

  const clinicInfoRows = [byKey("clinic.doctor_name"), byKey("clinic.name")].filter(Boolean) as ConfigRow[];
  const featureOther    = by("feature.").filter(r => r.config_type !== "boolean");
  const schedulerRows   = by("scheduler.");
  const featureFlagRows = by("feature.").filter(r => r.config_type === "boolean");
  const templateRows    = by("template.");

  return (
    <div className="p-7 space-y-6 max-w-3xl">

      {/* ── Clinic Information (admin only) ────────────── */}
      {!isDoctor && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionHeader icon={<Building2 size={16} className="text-emerald-600" />} title="Clinic Information" color="bg-emerald-50" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...clinicInfoRows, ...featureOther].map(r => (
              <ConfigField key={r.config_key} row={r} onChange={handleChange} />
            ))}
          </div>
        </div>
      )}

      {/* ── Weekly Schedule (merged) ───────────────────── */}
      <WeeklyScheduleSection />

      {/* ── Online Consultations ──────────────────────── */}
      <OnlineConsultationSection />

      {/* ── Scheduler Timings ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <SectionHeader icon={<Clock size={16} className="text-blue-600" />} title="Scheduler Timings (IST)" color="bg-blue-50" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "scheduler.visit_summary.time",
            "scheduler.morning_reminders.time",
            "scheduler.evening_reminders.time",
            "scheduler.followup_whatsapp.time",
            "scheduler.followup_calls.time",
            "scheduler.review_requests.time",
          ].map(key => {
            const r = schedulerRows.find(row => row.config_key === key);
            return r ? <ConfigField key={r.config_key} row={r} onChange={handleChange} /> : null;
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
          <button onClick={handleReloadScheduler} disabled={reloadState === "saving"}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white text-[13px] font-semibold px-4 py-2 rounded-xl shadow-sm transition-colors">
            {reloadState === "saving" ? <Loader2 size={14} className="animate-spin" />
              : reloadState === "saved" ? <CheckCircle size={14} />
              : reloadState === "error" ? <AlertCircle size={14} />
              : <RefreshCw size={14} />}
            {reloadState === "saving" ? "Reloading…" : reloadState === "saved" ? "Reloaded!" : reloadState === "error" ? "Error" : "Reload Scheduler"}
          </button>
          <span className="text-[11px] text-slate-400">Save first, then reload scheduler to apply timing changes.</span>
        </div>
      </div>

      {/* ── Feature Flags ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <SectionHeader icon={<Bell size={16} className="text-violet-600" />} title="Feature Flags" color="bg-violet-50" />
        <div className="space-y-1">
          {featureFlagRows.map(r => <ConfigField key={r.config_key} row={r} onChange={handleChange} />)}
        </div>
      </div>

      {/* ── Message Templates (admin only) ────────────── */}
      {!isDoctor && templateRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <SectionHeader icon={<MessageSquare size={16} className="text-amber-600" />} title="Message Templates" color="bg-amber-50" />
          <p className="text-[11px] text-slate-400 mb-4">
            Use <code className="bg-slate-100 px-1 rounded">{"{name}"}</code>,{" "}
            <code className="bg-slate-100 px-1 rounded">{"{clinic}"}</code>,{" "}
            <code className="bg-slate-100 px-1 rounded">{"{doctor}"}</code>,{" "}
            <code className="bg-slate-100 px-1 rounded">{"{diagnosis}"}</code>,{" "}
            <code className="bg-slate-100 px-1 rounded">{"{review_link}"}</code> as placeholders.
          </p>
          <div className="grid grid-cols-1 gap-4">
            {templateRows.map(r => <ConfigField key={r.config_key} row={r} onChange={handleChange} />)}
          </div>
        </div>
      )}

      {/* ── Blocked warning ───────────────────────────── */}
      {blockedMessage && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <ShieldAlert size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[13px] font-semibold text-amber-800 mb-0.5">Slot settings locked</div>
            <div className="text-[12px] text-amber-700">{blockedMessage}</div>
          </div>
        </div>
      )}

      {/* ── Save Button (non-schedule rows) ───────────── */}
      <div className="flex items-center gap-4">
        <button onClick={handleSave} disabled={saveState === "saving"}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-[13px] font-semibold px-6 py-2.5 rounded-xl shadow-sm shadow-emerald-200 transition-colors">
          {saveState === "saving" ? <Loader2 size={15} className="animate-spin" />
            : saveState === "saved" ? <CheckCircle size={15} />
            : saveState === "error" ? <AlertCircle size={15} />
            : <Save size={15} />}
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved!" : saveState === "error" ? "Save failed" : "Save Settings"}
        </button>
        {saveState === "error" && !blockedMessage && (
          <span className="text-[12px] text-red-500">Some changes failed to save. Please retry.</span>
        )}
      </div>

    </div>
  );
}
