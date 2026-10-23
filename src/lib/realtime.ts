/**
 * Live updates by polling.
 *
 * These used to be Supabase Realtime subscriptions fed straight from the database. The backend is now the only thing
 * that talks to the database, so the dashboard simply asks again every few seconds while the tab is visible (and
 * immediately when it becomes visible). Same names and signatures as before, so callers did not change.
 *
 * Callers get a silent refresh: the callback is invoked with `true`, meaning "refresh without showing a spinner".
 */
type Refresh = (silent?: boolean) => void;

function poll(refresh: Refresh, intervalMs: number): () => void {
  const tick = () => { if (document.visibilityState === "visible") refresh(true); };
  const timer = window.setInterval(tick, intervalMs);
  document.addEventListener("visibilitychange", tick);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", tick);
  };
}

/** Today's queue / appointments for a doctor. */
export function subscribeToQueue(_doctorId: string, _date: string, onUpdate: Refresh): () => void {
  return poll(onUpdate, 8_000);
}

/** New patient questions. */
export function subscribeToQueries(_doctorId: string, onNew: Refresh): () => void {
  return poll(onNew, 15_000);
}

/** New patients. */
export function subscribeToPatients(_doctorId: string, onNew: Refresh): () => void {
  return poll(onNew, 30_000);
}
