import { useCallback, useEffect, useState } from "react";

const BASE_URL = (import.meta.env.VITE_API_URL as string);
const TOKEN_KEY = "pra_auth_token";

export type PlanId = "starter" | "growth" | "pro";
export type Cycle = "monthly" | "annual";

export interface PlanInfo {
  label: string;
  monthly: number;
  annual_per_month: number;
  annual_total: number;
}

export interface BillingState {
  exempt: boolean;
  status: "trial" | "paid" | "active" | "expired";
  kind: "trial" | "paid" | "expired" | "exempt";
  paused: boolean;
  days_left: number | null;
  ends_at: string | null;
  can_pay: boolean;
  plan: PlanId | null;
  cycle: Cycle | null;
  subscription_id: string | null;
  plans: Record<PlanId, PlanInfo>;
  payments_enabled: boolean;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY) ?? "";
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Something went wrong");
  return data as T;
}

export function useBilling() {
  const [state, setState] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setState(await call<BillingState>("/api/billing/status"));
    } catch {
      setState(null); // billing is optional UI — never block the dashboard if it fails
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh(); // pick up a payment completed in another tab
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const choosePlan = async (plan: PlanId, cycle: Cycle) => {
    setState(await call<BillingState>("/api/billing/choose-plan", { method: "POST", body: JSON.stringify({ plan, cycle }) }));
  };

  const checkout = async (): Promise<string> => {
    const { checkout_url } = await call<{ checkout_url: string }>("/api/billing/checkout", { method: "POST" });
    return checkout_url;
  };

  return { state, loading, refresh, choosePlan, checkout };
}
