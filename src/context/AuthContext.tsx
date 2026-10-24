import { createContext, useContext, useState, useEffect } from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string);
const TOKEN_KEY = "pra_auth_token";

export type StaffRole = "doctor" | "receptionist" | "pharmacist" | "lab" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: StaffRole;
  doctorId: string | null;   // set only for role='doctor'
  clinicWhatsapp: string;
  speciality: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, pin: string) => Promise<string | null>; // returns error string or null
  logout: () => void;
  // legacy helpers — keep so existing pages don't break
  doctorId: string;
  doctorName: string;
  clinicName: string;
}

const FALLBACK_DOCTOR_ID = "8c33abe0-5d2e-4613-9437-c7c375e8d162";

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => "Not initialised",
  logout: () => {},
  doctorId: FALLBACK_DOCTOR_ID,
  doctorName: "Dr. Kumar",
  clinicName: "Dr. Kumar Child Care Clinic",
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: validate stored token
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.role) setUser(mapUser(data));
        else localStorage.removeItem(TOKEN_KEY);
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, pin: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return err.detail || "Invalid username or PIN";
      }
      const data = await res.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(mapUser(data));
      return null;
    } catch {
      return "Network error — please try again";
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  // Legacy helpers: pages that read doctorId/doctorName still work
  const doctorId = user?.doctorId || FALLBACK_DOCTOR_ID;
  const doctorName = user?.role === "doctor" ? user.name : "Dr. Kumar";
  const clinicName = "TrueCare Family Clinic";

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, doctorId, doctorName, clinicName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

function mapUser(data: Record<string, unknown>): AuthUser {
  return {
    id: data.id as string,
    name: data.name as string,
    username: data.username as string,
    role: data.role as StaffRole,
    doctorId: (data.doctor_id as string) || null,
    clinicWhatsapp: (data.clinic_whatsapp as string) || "",
    speciality: (data.speciality as string) || "",
  };
}
