import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { useAuth } from "../../context/AuthContext";
import { useBilling, type Cycle, type PlanId } from "../../hooks/useBilling";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export function BillingBanner() {
  const { user } = useAuth();
  const { state, choosePlan, checkout } = useBilling();
  const [open, setOpen] = useState(false);
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem("billing_banner_hidden") === "1"; } catch { return false; }
  });

  if (!state || state.exempt) return null;

  const canManage = user?.role === "doctor" || user?.role === "admin";
  const days = state.days_left ?? 0;
  const label = state.kind === "trial" ? "free trial" : "subscription";
  const urgent = state.paused;
  const soon = !state.paused && days <= 5;

  let message: string;
  if (state.paused) {
    message = `Your ${label} has ended. WhatsApp assistant, reminders and follow-up calls are paused until you subscribe.`;
  } else if (days === 0) {
    message = `Your ${label} ends today.`;
  } else if (soon) {
    message = `Your ${label} ends in ${days} day${days === 1 ? "" : "s"} (${fmtDate(state.ends_at)}).`;
  } else if (state.kind === "trial") {
    message = `Free trial: ${days} days left. Choose the plan you'd like — you won't be asked to pay until the trial ends.`;
  } else {
    return null; // paid and not close to the end
  }

  const dismissible = !urgent && !soon;
  if (dismissible && hidden) return null;

  const tone = urgent
    ? "bg-red-50 border-red-200 text-red-800"
    : soon
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : "bg-emerald-50 border-emerald-200 text-emerald-900";
  const Icon = urgent ? AlertTriangle : soon ? Clock : CheckCircle2;

  const select = async (plan: PlanId) => {
    setError(null);
    setBusy(true);
    try { await choosePlan(plan, cycle); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const pay = async () => {
    setError(null);
    setBusy(true);
    try {
      window.location.href = await checkout();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className={`flex items-start gap-3 border-b px-4 py-2.5 text-[13px] ${tone}`} role={urgent ? "alert" : "status"}>
        <Icon size={16} className="mt-0.5 shrink-0" />
        <p className="flex-1 leading-snug">{message}</p>
        <button
          onClick={() => { setCycle(state.cycle ?? "monthly"); setOpen(true); }}
          className="shrink-0 rounded-md bg-white/80 px-3 py-1 text-[12px] font-semibold shadow-sm hover:bg-white"
        >
          {state.paused ? "Choose plan & pay" : state.plan ? "Manage plan" : "Choose plan"}
        </button>
        {dismissible && (
          <button
            aria-label="Dismiss"
            onClick={() => { setHidden(true); try { sessionStorage.setItem("billing_banner_hidden", "1"); } catch { /* ignore */ } }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose your plan</DialogTitle>
            <DialogDescription>
              {state.can_pay
                ? "Select a plan and pay to resume your WhatsApp services."
                : `Pick the plan you want. No payment details are needed now — payment opens when your ${label} ends on ${fmtDate(state.ends_at)}. You can change your choice any time.`}
            </DialogDescription>
          </DialogHeader>

          <div className="mx-auto inline-flex rounded-lg border border-slate-200 p-0.5 text-[13px]">
            {(["monthly", "annual"] as Cycle[]).map(c => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={`rounded-md px-4 py-1.5 font-medium ${cycle === c ? "bg-emerald-500 text-white" : "text-slate-600"}`}
              >
                {c === "monthly" ? "Monthly" : "Annual (save ~17%)"}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(state.plans) as PlanId[]).map(id => {
              const p = state.plans[id];
              const selected = state.plan === id && state.cycle === cycle;
              const price = cycle === "monthly" ? p.monthly : p.annual_per_month;
              return (
                <div key={id} className={`rounded-xl border p-4 ${selected ? "border-emerald-500 ring-2 ring-emerald-200" : "border-slate-200"}`}>
                  <p className="text-[15px] font-semibold text-slate-800">{p.label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{inr(price)}<span className="text-[12px] font-normal text-slate-500"> /month</span></p>
                  {cycle === "annual" && <p className="text-[12px] text-slate-500">{inr(p.annual_total)} billed yearly</p>}
                  <p className="mt-1 text-[11px] text-slate-400">+ GST as applicable</p>
                  <button
                    disabled={busy || !canManage || selected}
                    onClick={() => select(id)}
                    className={`mt-4 w-full rounded-lg py-2 text-[13px] font-semibold ${selected ? "bg-emerald-50 text-emerald-700" : "bg-slate-900 text-white hover:bg-slate-800"} disabled:opacity-60`}
                  >
                    {selected ? "Selected ✓" : "Select"}
                  </button>
                </div>
              );
            })}
          </div>

          {!canManage && <p className="text-[12px] text-slate-500">Only the doctor or clinic admin can change the plan.</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}

          {state.can_pay && canManage && (
            <div className="space-y-2">
              <button
                onClick={pay}
                disabled={busy || !state.plan || !state.payments_enabled}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-[14px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                {busy && <Loader2 size={15} className="animate-spin" />} Pay &amp; resume services
              </button>
              {!state.plan && <p className="text-center text-[12px] text-slate-500">Select a plan above first.</p>}
              {!state.payments_enabled && <p className="text-center text-[12px] text-amber-700">Online payment isn't enabled yet — please contact support to subscribe.</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
