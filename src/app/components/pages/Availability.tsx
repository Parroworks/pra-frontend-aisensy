import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays, Sun, Moon, AlertTriangle, CheckCircle2,
  RefreshCw, Trash2, Save, ChevronLeft, ChevronRight, Ban,
} from "lucide-react";
import { api } from "../../../lib/api";
import type { AvailabilityInfo, ClinicScheduleResponse, ClinicScheduleDay } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";

const API_BASE = (import.meta.env.VITE_API_URL as string);

// ── helpers ────────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function fmt24to5(t: string) { return t.slice(0, 5); }

function fmtDateFull(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fmtDateShort(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function dotColor(av: AvailabilityInfo): "green" | "amber" | "red" {
  if (av.is_holiday) return "red";
  if (!av.morning.enabled && !av.evening.enabled) return "red";
  if (!av.has_override) return "green";
  if (!av.morning.enabled || !av.evening.enabled) return "amber";
  // Custom time range (not full default)
  return "amber";
}

function genTimeOptions(start: string, end: string, dur: number): string[] {
  const options: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh * 60 + sm;
  const endMins = eh * 60 + em;
  while (cur <= endMins) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    cur += dur;
  }
  return options;
}

// ── Clinic config (fetched once) ──────────────────────────────────────────────

interface ClinicCfg {
  morning_start: string; morning_end: string;
  evening_start: string; evening_end: string;
  duration: number;
}

async function fetchClinicCfg(DOCTOR_ID: string): Promise<ClinicCfg> {
  const keys = [
    "clinic.slot_start_morning", "clinic.slot_end_morning",
    "clinic.slot_start_evening", "clinic.slot_end_evening",
    "clinic.slot_duration_minutes",
  ];
  const res = await fetch(`${API_BASE}/config/${DOCTOR_ID}`);
  const all: { config_key: string; config_value: string }[] = await res.json();
  const map: Record<string, string> = {};
  all.filter(r => keys.includes(r.config_key)).forEach(r => { map[r.config_key] = r.config_value; });
  return {
    morning_start: map["clinic.slot_start_morning"] ?? "09:30",
    morning_end:   map["clinic.slot_end_morning"]   ?? "14:30",
    evening_start: map["clinic.slot_start_evening"] ?? "17:00",
    evening_end:   map["clinic.slot_end_evening"]   ?? "22:00",
    duration:      Number(map["clinic.slot_duration_minutes"] ?? 10),
  };
}

const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const DAY_DISPLAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function getDayName(isoDate: string): string {
  return DAY_NAMES[new Date(isoDate + "T00:00:00").getDay()];
}
function getDayDisplay(isoDate: string): string {
  return DAY_DISPLAY[new Date(isoDate + "T00:00:00").getDay()];
}

/** Returns the clinic schedule day info for a given date. */
function dayInfo(isoDate: string, clinicSchedule: ClinicScheduleResponse | null, cfg: ClinicCfg): ClinicScheduleDay {
  const dayName = getDayName(isoDate);
  if (clinicSchedule?.schedule[dayName]) return clinicSchedule.schedule[dayName];
  return {
    enabled: true,
    slot_duration_minutes: cfg.duration,
    morning: { enabled: true, start: cfg.morning_start, end: cfg.morning_end },
    evening: { enabled: true, start: cfg.evening_start, end: cfg.evening_end },
  };
}

// ── Toggle component ────────────────────────────────────────────────────────

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`flex items-center gap-1.5 px-2 py-1 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-[13px] font-semibold border transition-all ${
        on
          ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
          : "bg-amber-50 text-amber-700 border-amber-300"
      }`}
    >
      {on ? <CheckCircle2 size={14} /> : <Ban size={14} />}
      {on ? "Open" : "Blocked"}
    </button>
  );
}

// ── Time Select ─────────────────────────────────────────────────────────────

function TimeSelect({ value, onChange, options, disabled }: {
  value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="px-3 py-2 text-[13px] border border-slate-200 rounded-xl text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {options.map(o => <option key={o} value={o}>{fmt12(o)}</option>)}
    </select>
  );
}

// ── Status row for upcoming summary ─────────────────────────────────────────

function statusText(av: AvailabilityInfo, di: ClinicScheduleDay): string {
  if (av.is_holiday) return `Holiday${av.holiday_name ? ` — ${av.holiday_name}` : " / Closed"}`;
  if (!av.morning.enabled && !av.evening.enabled) return !di.enabled ? "Closed (weekly)" : "Fully blocked";
  if (!av.morning.enabled) return `Evening only: ${fmt12(av.evening.start)} – ${fmt12(av.evening.end)}`;
  if (!av.evening.enabled) return `Morning only: ${fmt12(av.morning.start)} – ${fmt12(av.morning.end)}`;
  if (!av.has_override) return "Normal schedule";
  const mCustom = av.morning.start !== di.morning.start || av.morning.end !== di.morning.end;
  const eCustom = av.evening.start !== di.evening.start || av.evening.end !== di.evening.end;
  if (mCustom || eCustom) return "Custom hours";
  return "Normal schedule";
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export function Availability() {
  const { doctorId: DOCTOR_ID, clinicName, doctorName } = useAuth();
  const today = todayISO();
  const [cfg, setCfg] = useState<ClinicCfg | null>(null);
  const [clinicSchedule, setClinicSchedule] = useState<ClinicScheduleResponse | null>(null);
  const [calData, setCalData] = useState<Record<string, AvailabilityInfo>>({});
  const [calLoading, setCalLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today);
  const [calWeekStart, setCalWeekStart] = useState(today); // start of visible calendar window

  // Panel form state
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [morningEnabled, setMorningEnabled] = useState(true);
  const [morningStart, setMorningStart] = useState("");
  const [morningEnd, setMorningEnd] = useState("");
  const [eveningEnabled, setEveningEnabled] = useState(true);
  const [eveningStart, setEveningStart] = useState("");
  const [eveningEnd, setEveningEnd] = useState("");
  const [mError, setMError] = useState("");
  const [eError, setEError] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Load clinic config + weekly schedule once
  useEffect(() => {
    fetchClinicCfg(DOCTOR_ID).then(c => {
      setCfg(c);
    }).catch(() => {});

    api.clinicSchedule.get(DOCTOR_ID).then(d => setClinicSchedule(d)).catch(() => {});
  }, []);

  // Load range (today + 30 days) on mount
  const loadRange = useCallback(async () => {
    setCalLoading(true);
    try {
      const end = addDays(today, 30);
      const list = await api.availability.range(DOCTOR_ID, today, end);
      const map: Record<string, AvailabilityInfo> = {};
      list.forEach(av => { map[av.date] = av; });
      setCalData(map);
    } catch { /* silent */ } finally {
      setCalLoading(false);
    }
  }, [today]);

  useEffect(() => { loadRange(); }, [loadRange]);

  // Load panel state when selected date changes
  useEffect(() => {
    const av = calData[selectedDate];
    if (!av || !cfg) return;
    const di = dayInfo(selectedDate, clinicSchedule, cfg);
    setIsHoliday(av.is_holiday);
    setHolidayName(av.holiday_name ?? "");
    setMorningEnabled(av.morning.enabled);
    setMorningStart(av.morning.start || di.morning.start);
    setMorningEnd(av.morning.end || di.morning.end);
    setEveningEnabled(av.evening.enabled);
    setEveningStart(av.evening.start || di.evening.start);
    setEveningEnd(av.evening.end || di.evening.end);
    setMError(""); setEError("");
    setSaveStatus("idle");
  }, [selectedDate, calData, cfg, clinicSchedule]);

  // ── validation ──────────────────────────────────────────────────────────────
  const t2m = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  const validate = () => {
    if (isHoliday || !cfg) return true;
    let ok = true;
    if (morningEnabled) {
      if (t2m(morningStart) >= t2m(morningEnd)) { setMError("Start must be before end time"); ok = false; }
      else setMError("");
    } else setMError("");
    if (eveningEnabled) {
      if (t2m(eveningStart) >= t2m(eveningEnd)) { setEError("Start must be before end time"); ok = false; }
      else setEError("");
    } else setEError("");
    return ok;
  };

  // ── save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      await api.availability.set({
        doctor_id: DOCTOR_ID,
        availability_date: selectedDate,
        is_holiday: isHoliday,
        holiday_name: isHoliday ? (holidayName || null) : null,
        morning_enabled: isHoliday ? false : morningEnabled,
        morning_start: morningEnabled && !isHoliday ? morningStart : null,
        morning_end: morningEnabled && !isHoliday ? morningEnd : null,
        evening_enabled: isHoliday ? false : eveningEnabled,
        evening_start: eveningEnabled && !isHoliday ? eveningStart : null,
        evening_end: eveningEnabled && !isHoliday ? eveningEnd : null,
      });
      setSaveStatus("saved");
      setSaveMsg("Saved successfully");
      await loadRange();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setSaveStatus("error");
      setSaveMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── reset ───────────────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    setResetting(true);
    try {
      await api.availability.delete(DOCTOR_ID, selectedDate);
      setConfirmReset(false);
      if (cfg) {
        const di = dayInfo(selectedDate, clinicSchedule, cfg);
        setIsHoliday(!di.enabled); setHolidayName("");
        setMorningEnabled(di.enabled && di.morning.enabled);
        setMorningStart(di.morning.start); setMorningEnd(di.morning.end);
        setEveningEnabled(di.enabled && di.evening.enabled);
        setEveningStart(di.evening.start); setEveningEnd(di.evening.end);
      }
      setSaveStatus("saved"); setSaveMsg("Reset to default clinic hours");
      await loadRange();
    } catch { setSaveStatus("error"); setSaveMsg("Reset failed"); }
    finally { setResetting(false); }
  };

  // ── calendar strip: 30-day window ────────────────────────────────────────
  const calDates = Array.from({ length: 30 }, (_, i) => addDays(today, i));
  // Split into weeks for pagination
  const WEEK = 7;
  const weekStartIdx = calDates.indexOf(calWeekStart) === -1 ? 0 : calDates.indexOf(calWeekStart);
  const visibleDates = calDates.slice(weekStartIdx, weekStartIdx + WEEK);
  const canPrev = weekStartIdx > 0;
  const canNext = weekStartIdx + WEEK < calDates.length;

  const dotCls = (color: "green" | "amber" | "red") =>
    color === "green" ? "bg-emerald-400" :
    color === "amber" ? "bg-amber-400" : "bg-rose-400";

  // Upcoming 7 days summary
  const summaryDates = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  if (!cfg) {
    return (
      <div className="p-7 flex items-center gap-3 text-slate-400 text-[13px]">
        <RefreshCw size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  const di = dayInfo(selectedDate, clinicSchedule, cfg);
  const dayLabel = getDayDisplay(selectedDate);
  const isNormallyClosed = !di.enabled;
  const morningOpts = genTimeOptions(di.morning.start, di.morning.end, di.slot_duration_minutes);
  const eveningOpts = genTimeOptions(di.evening.start, di.evening.end, di.slot_duration_minutes);

  return (
    <div className="p-7 space-y-6 max-w-3xl">

      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22 }} className="text-slate-800">
          Availability Management
        </h1>
        <p className="text-[13px] text-slate-500 mt-1">{clinicName} · {doctorName}</p>
      </div>

      {/* ── Calendar strip ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }} className="text-slate-800 flex items-center gap-2">
            <CalendarDays size={15} className="text-emerald-500" /> Next 30 Days
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={() => canPrev && setCalWeekStart(calDates[weekStartIdx - WEEK] ?? today)}
              disabled={!canPrev}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors">
              <ChevronLeft size={15} />
            </button>
            <button onClick={() => canNext && setCalWeekStart(calDates[weekStartIdx + WEEK] ?? calDates[calDates.length - WEEK])}
              disabled={!canNext}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {calLoading ? (
          <div className="flex gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {visibleDates.map(date => {
              const av = calData[date];
              const color = av ? dotColor(av) : "green";
              const isSelected = date === selectedDate;
              const isToday = date === today;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl text-center transition-all ${
                    isSelected
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className={`text-[10px] font-semibold ${isSelected ? "text-emerald-100" : "text-slate-400"}`}>
                    {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" })}
                  </span>
                  <span className={`text-[14px] font-bold ${isToday && !isSelected ? "text-emerald-600" : ""}`}>
                    {new Date(date + "T00:00:00").getDate()}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/80" : dotCls(color)}`} />
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-4 pt-3 border-t border-slate-50">
          {([["green", "Fully open"], ["amber", "Partially blocked"], ["red", "Closed / Holiday"]] as const).map(([c, l]) => (
            <div key={c} className="flex items-center gap-1.5 text-[11px] text-slate-500 whitespace-nowrap">
              <span className={`w-2 h-2 rounded-full ${dotCls(c)}`} /> {l}
            </div>
          ))}
        </div>
      </div>

      {/* ── Date panel ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15 }} className="text-slate-800">
          {fmtDateFull(selectedDate)}
        </h3>

        {/* Normally-closed day banner */}
        {isNormallyClosed && !isHoliday && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-semibold text-amber-800">This day is normally closed</div>
              <div className="text-[12px] text-amber-600 mt-0.5">
                {dayLabel} is marked as a closed day in Weekly Schedule. You can still open it for this specific date below.
              </div>
            </div>
          </div>
        )}

        {/* Holiday toggle */}
        <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <input
            id="holiday-chk"
            type="checkbox"
            checked={isHoliday}
            onChange={e => { setIsHoliday(e.target.checked); setMError(""); setEError(""); }}
            className="mt-0.5 w-4 h-4 accent-rose-500 cursor-pointer"
          />
          <label htmlFor="holiday-chk" className="flex-1 cursor-pointer">
            <div className="text-[13px] font-semibold text-slate-800">Mark as Holiday</div>
            <div className="text-[11px] text-slate-400 mt-0.5">No appointments on this day</div>
          </label>
        </div>

        {isHoliday && (
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Holiday Name (optional)
            </label>
            <input
              value={holidayName}
              onChange={e => setHolidayName(e.target.value)}
              placeholder="e.g. Pongal, Doctor Conference"
              className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
            />
          </div>
        )}

        {!isHoliday && (
          <>
            {/* Morning session */}
            <div className="border border-slate-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Sun size={15} className="text-amber-500 flex-shrink-0" />
                  <span className="text-[13px] font-semibold text-slate-700 whitespace-nowrap">Morning Session</span>
                  <span className="text-[11px] text-slate-400 break-words min-w-0">{dayLabel} schedule: {fmt12(di.morning.start)} – {fmt12(di.morning.end)}</span>
                </div>
                <Toggle on={morningEnabled} onChange={setMorningEnabled} label="Morning" />
              </div>

              {morningEnabled ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-slate-500 w-24">Available from</span>
                    <TimeSelect value={morningStart} onChange={setMorningStart} options={morningOpts.slice(0, -1)} />
                    <span className="text-[12px] text-slate-400">to</span>
                    <TimeSelect
                      value={morningEnd}
                      onChange={setMorningEnd}
                      options={morningOpts.filter(o => o > morningStart)}
                    />
                  </div>
                  {mError && <p className="text-[12px] text-rose-600">{mError}</p>}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-[12px] text-amber-700">
                  <AlertTriangle size={13} /> Morning appointments blocked on this date
                </div>
              )}
            </div>

            {/* Evening session */}
            <div className="border border-slate-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Moon size={15} className="text-indigo-500 flex-shrink-0" />
                  <span className="text-[13px] font-semibold text-slate-700 whitespace-nowrap">Evening Session</span>
                  <span className="text-[11px] text-slate-400 break-words min-w-0">{dayLabel} schedule: {fmt12(di.evening.start)} – {fmt12(di.evening.end)}</span>
                </div>
                <Toggle on={eveningEnabled} onChange={setEveningEnabled} label="Evening" />
              </div>

              {eveningEnabled ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-slate-500 w-24">Available from</span>
                    <TimeSelect value={eveningStart} onChange={setEveningStart} options={eveningOpts.slice(0, -1)} />
                    <span className="text-[12px] text-slate-400">to</span>
                    <TimeSelect
                      value={eveningEnd}
                      onChange={setEveningEnd}
                      options={eveningOpts.filter(o => o > eveningStart)}
                    />
                  </div>
                  {eError && <p className="text-[12px] text-rose-600">{eError}</p>}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-[12px] text-amber-700">
                  <AlertTriangle size={13} /> Evening appointments blocked on this date
                </div>
              )}
            </div>
          </>
        )}

        {/* Save message */}
        {saveStatus !== "idle" && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium ${
            saveStatus === "saved"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-rose-50 border border-rose-200 text-rose-700"
          }`}>
            {saveStatus === "saved" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {saveMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[13px] font-semibold rounded-xl shadow-sm shadow-emerald-200 transition-colors whitespace-nowrap"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </button>

          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-semibold rounded-xl hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Trash2 size={13} /> Reset to Default
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              <span className="text-[12px] text-rose-700">Reset to default clinic hours?</span>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="text-[12px] font-semibold text-rose-600 hover:text-rose-800"
              >
                {resetting ? "Resetting…" : "Yes, reset"}
              </button>
              <button onClick={() => setConfirmReset(false)} className="text-[12px] text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Upcoming 7-day summary ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }} className="text-slate-800 mb-4">
          Upcoming Week
        </h3>
        <div className="space-y-1">
          {summaryDates.map((date, i) => {
            const av = calData[date];
            const color = av ? dotColor(av) : "green";
            const label = i === 0 ? "Today" : fmtDateShort(date);
            const dayDi = dayInfo(date, clinicSchedule, cfg);
            const statusStr = av ? statusText(av, dayDi) : (!dayDi.enabled ? "Closed (weekly)" : "Normal schedule");
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  date === selectedDate ? "bg-emerald-50 border border-emerald-200" : "hover:bg-slate-50"
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls(color)}`} />
                <span className="text-[13px] font-semibold text-slate-700 w-24">{label}</span>
                <span className={`text-[12px] ${
                  color === "red" ? "text-rose-600 font-semibold" :
                  color === "amber" ? "text-amber-600" : "text-slate-400"
                }`}>{statusStr}</span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
