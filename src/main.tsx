import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { PrescriptionWriter } from "./app/components/pages/PrescriptionWriter.tsx";
import { PatientRegistration } from "./app/components/pages/PatientRegistration.tsx";
import { NewAppointment } from "./app/components/pages/NewAppointment.tsx";
import "./styles/index.css";
import { AuthProvider } from "./context/AuthContext.tsx";
import { installAuthFetch } from "./lib/authFetch.ts";

installAuthFetch();   // send the login token with every API call

const pathname = window.location.pathname;

const RootComponent =
  pathname.startsWith("/prescriptions/new") ? PrescriptionWriter :
  pathname.startsWith("/patients/new") ? PatientRegistration :
  pathname.startsWith("/appointments/new") ? NewAppointment :
  App;

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <RootComponent />
  </AuthProvider>
);
