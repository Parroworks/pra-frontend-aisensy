import { useState, useEffect } from "react";
import { Login } from "./components/pages/Login";
import { Sidebar } from "./components/Sidebar";
import type { Page } from "./components/Sidebar";
import { useQueries, useFollowUps, useTodayAppointments } from "../hooks/usePRAData";
import { Topbar } from "./components/Topbar";
import { BillingBanner } from "./components/BillingBanner";
import { Dashboard } from "./components/pages/Dashboard";
import { Appointments } from "./components/pages/Appointments";
import { Queue } from "./components/pages/Queue";
import { Patients } from "./components/pages/Patients";
import { Prescriptions } from "./components/pages/Prescriptions";
import { LabReports } from "./components/pages/LabReports";
import { Queries } from "./components/pages/Queries";
import { FollowUps } from "./components/pages/FollowUps";
import { Reviews } from "./components/pages/Reviews";
import { Analytics } from "./components/pages/Analytics";
import { Settings } from "./components/pages/Settings";
import { ClinicMedicines } from "./components/pages/ClinicMedicines";
import { NewAppointment } from "./components/pages/NewAppointment";
import { PatientRegistration } from "./components/pages/PatientRegistration";
import { PrescriptionWriter } from "./components/pages/PrescriptionWriter";
import { Availability } from "./components/pages/Availability";
import { Dispensary } from "./components/pages/Dispensary";
import { ConsultationsPage } from "./components/pages/ConsultationsPage";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

function AppShell() {
  const { doctorId } = useAuth();
  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [newApptPatientId, setNewApptPatientId] = useState<string>("");
  const [rxParams, setRxParams] = useState<{ patientId?: string; appointmentId?: string; prescriptionId?: string }>({});
  const { data: queries } = useQueries();
  const { data: followUps } = useFollowUps();
  const { data: todayAppointments } = useTodayAppointments(doctorId);
  const [consultationsBadge, setConsultationsBadge] = useState(0);

  const queriesBadge     = queries.filter(q => q.status === "Pending").length;
  const followupsBadge   = followUps.filter(f => !f.completed_at && (f.call_status === "Pending" || f.call_status === "Whatsapp-Sent")).length;
  const appointmentsBadge = todayAppointments.filter(a => a.status !== "Cancelled").length;

  // Poll today's active consultations for badge count
  useEffect(() => {
    async function fetchBadge() {
      try {
        const res = await api.consultations.today(doctorId);
        const active = res.consultations.filter(c =>
          ["scheduled", "waiting", "in_progress"].includes(c.status)
        ).length;
        setConsultationsBadge(active);
      } catch {/* non-critical */ }
    }
    fetchBadge();
    const t = setInterval(fetchBadge, 60_000);
    return () => clearInterval(t);
  }, [doctorId]);

  const goToNewAppt = (patientId = "") => {
    setNewApptPatientId(patientId);
    setActivePage("new-appointment");
  };

  const renderPage = () => {
    const k = activePage;
    switch (activePage) {
      case "dashboard": return <Dashboard key={k} onNavigate={setActivePage} />;
      case "appointments": return <Appointments key={k} onPrescribe={(patientId, appointmentId) => { setRxParams({ patientId, appointmentId }); setActivePage("new-prescription"); }} />;
      case "availability": return <Availability key={k} />;
      case "queue": return <Queue key={k} onPrescribe={(patientId, appointmentId) => { setRxParams({ patientId, appointmentId }); setActivePage("new-prescription"); }} />;
      case "patients": return <Patients key={k} />;
      case "prescriptions": return (
        <Prescriptions
          key={k}
          onNewPrescription={() => { setRxParams({}); setActivePage("new-prescription"); }}
          onEditPrescription={(patientId, prescriptionId) => { setRxParams({ patientId, prescriptionId }); setActivePage("new-prescription"); }}
        />
      );
      case "medicines": return <ClinicMedicines key={k} />;
      case "medicines-alerts": return <ClinicMedicines key={k} initialTab="alerts" />;
      case "dispensary": return <Dispensary key={k} />;
      case "consultations": return <ConsultationsPage key={k} />;
      case "lab": return <LabReports key={k} />;
      case "queries": return <Queries key={k} />;
      case "followups": return <FollowUps key={k} />;
      case "reviews": return <Reviews key={k} />;
      case "analytics": return <Analytics key={k} />;
      case "settings": return <Settings key={k} />;
      case "new-appointment": return (
        <NewAppointment
          key={newApptPatientId}
          patientId={newApptPatientId}
          onNavigate={setActivePage}
          onRegisterPatient={() => setActivePage("register-patient")}
        />
      );
      case "new-prescription": return (
        <PrescriptionWriter
          key={JSON.stringify(rxParams)}
          patientId={rxParams.patientId}
          appointmentId={rxParams.appointmentId}
          prescriptionId={rxParams.prescriptionId}
          onNavigate={(p) => setActivePage(p as Page)}
        />
      );
      case "register-patient": return (
        <PatientRegistration
          onNavigate={setActivePage}
          onBookAppointment={(patientId) => goToNewAppt(patientId)}
        />
      );
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        queriesBadge={queriesBadge}
        followupsBadge={followupsBadge}
        appointmentsBadge={appointmentsBadge}
        consultationsBadge={consultationsBadge}
      />
      <div className="lg:ml-60 ml-0 flex flex-col min-h-screen">
        <Topbar activePage={activePage} />
        <BillingBanner />
        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Login />;

  return <AppShell />;
}
