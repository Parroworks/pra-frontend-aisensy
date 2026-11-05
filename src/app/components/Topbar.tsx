import { Bell, Search, Calendar, LogOut, Clock, KeyRound } from "lucide-react";
import { useState, useEffect } from "react";
import type { Page } from "./Sidebar";
import { useAuth } from "../../context/AuthContext";
import { ChangePinModal } from "./ChangePinModal";

const pageTitles: Record<Page, string> = {
  dashboard: "Overview",
  appointments: "Appointments",
  availability: "Availability Management",
  queue: "Live Queue",
  patients: "Patients",
  prescriptions: "Prescriptions",
  lab: "Lab Reports",
  queries: "Patient Queries",
  followups: "Follow-ups",
  reviews: "Reviews",
  analytics: "Analytics",
  settings: "Clinic Settings",
  medicines: "Medicines",
  "medicines-alerts": "Medicines",
  "dispensary": "Dispensary",
  "consultations": "Online Consultations",
  "new-appointment": "New Appointment",
  "register-patient": "Register Patient",
  "new-prescription": "New Prescription",
};

export function Topbar({ activePage }: { activePage: Page }) {
  const { user, logout } = useAuth();
  const [now, setNow] = useState(new Date());
  const [pinOpen, setPinOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (activePage === "settings" && user?.role === "doctor") {
    pageTitles["settings"] = "Doctor Settings";
  } else {
    pageTitles["settings"] = "Clinic Settings";
  }

  const dateStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  const roleLabel = user?.speciality || (user?.role === "doctor" ? "General Physician" : user?.role ?? "");

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center px-7 gap-4 sticky top-0 z-40 shadow-sm pl-16 md:pl-7">
      <div className="flex-1">
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17 }} className="text-slate-800">
          {pageTitles[activePage]}
        </h1>
      </div>

      {/* Search */}
      <div className="relative hidden md:block">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search patients, reports…"
          className="pl-8 pr-4 py-1.5 text-[13px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 w-56 transition-all"
        />
      </div>

      {/* Date + Time */}
      <div className="hidden lg:flex items-center gap-2 text-[12px] text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
        <Calendar size={13} className="text-emerald-500" />
        {dateStr}
        <span className="w-px h-3 bg-slate-300" />
        <Clock size={13} className="text-emerald-500" />
        <span className="font-medium text-slate-600 tabular-nums">{timeStr}</span>
      </div>

      {/* Live dot */}
      <div className="hidden md:flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        Live
      </div>

      {/* Bell */}
      <button className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
        <Bell size={17} />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
      </button>

      {/* User + Logout */}
      {user && (
        <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="text-right">
            <p className="text-[12px] font-semibold text-slate-700 leading-tight">{user.name}</p>
            <p className="text-[11px] text-slate-400">{roleLabel}</p>
          </div>
          <button
            onClick={() => setPinOpen(true)}
            title="Change PIN"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <KeyRound size={15} />
          </button>
          <button
            onClick={logout}
            title="Sign out"
            className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      )}

      {pinOpen && <ChangePinModal onClose={() => setPinOpen(false)} />}
    </header>
  );
}
