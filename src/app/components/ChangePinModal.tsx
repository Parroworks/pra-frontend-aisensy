import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

const SIX_DIGITS = /^\d{6}$/;

export function ChangePinModal({ onClose }: { onClose: () => void }) {
  const { changePin } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!SIX_DIGITS.test(current)) return setError("Enter your current 6-digit PIN");
    if (!SIX_DIGITS.test(next)) return setError("The new PIN must be exactly 6 digits");
    if (next !== again) return setError("The new PINs do not match");
    setBusy(true);
    setError(null);
    const err = await changePin(current, next);
    setBusy(false);
    if (err) setError(err);
    else setDone(true);
  };

  const field = "w-full px-3 py-2 text-[14px] tracking-[0.3em] bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17 }} className="text-slate-800">Change PIN</h2>
        {done ? (
          <>
            <p className="mt-3 text-[13px] text-slate-600">Your PIN has been changed. Use the new PIN the next time you sign in.</p>
            <button onClick={onClose} className="mt-5 w-full rounded-lg bg-emerald-500 py-2 text-[14px] font-semibold text-white hover:bg-emerald-600">Done</button>
          </>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block text-[12px] font-medium text-slate-600">Current PIN
              <input type="password" inputMode="numeric" autoComplete="current-password" value={current}
                onChange={(e) => setCurrent(digits(e.target.value))} className={`mt-1 ${field}`} autoFocus />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">New PIN (6 digits)
              <input type="password" inputMode="numeric" autoComplete="new-password" value={next}
                onChange={(e) => setNext(digits(e.target.value))} className={`mt-1 ${field}`} />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">Repeat new PIN
              <input type="password" inputMode="numeric" autoComplete="new-password" value={again}
                onChange={(e) => setAgain(digits(e.target.value))} className={`mt-1 ${field}`} />
            </label>
            {error && <p className="text-[12px] text-rose-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2 text-[14px] text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-emerald-500 py-2 text-[14px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
                {busy ? "Saving…" : "Change PIN"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
