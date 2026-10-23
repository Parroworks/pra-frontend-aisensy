import { useState, useEffect, useCallback, useRef } from "react";
import { api, type DashboardStats, type QueueStatus, type Appointment, type Patient, type Prescription, type FollowUp, type Query, type Review } from "../lib/api";
import { subscribeToQueue, subscribeToPatients, subscribeToQueries } from "../lib/realtime";
import { useAuth } from "../context/AuthContext";

function today() {
  return new Date().toISOString().slice(0, 10);
}

type HookResult<T> = { data: T; loading: boolean; error: string | null; refetch: () => void };

function useApiData<T>(fetcher: () => Promise<T>, defaultValue: T, pollMs?: number): HookResult<T> {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    if (!pollMs) return;
    const t = setInterval(fetch, pollMs);
    return () => clearInterval(t);
  }, [fetch, pollMs]);

  return { data, loading, error, refetch: fetch };
}

export function useDashboardStats() {
  const { doctorId } = useAuth();
  return useApiData<DashboardStats>(
    () => api.dashboard.getStats(doctorId),
    {
      today_appointments: 0,
      current_token: 0,
      total_patients: 0,
      pending_followups: 0,
      today_completed: 0,
      weekly_appointments: [],
      top_diagnoses: [],
    }
  );
}

export function useQueue(doctorIdOverride?: string) {
  const { doctorId: authDoctorId } = useAuth();
  const doctorId = doctorIdOverride ?? authDoctorId;
  const [data, setData] = useState<QueueStatus>({
    current_token: 0,
    total_today: 0,
    waiting: 0,
    completed: 0,
    appointments: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await api.queue.status(doctorId, today());
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchData();
    const unsub = subscribeToQueue(doctorId, today(), fetchData);
    return unsub;
  }, [fetchData, doctorId]);

  const callNext = useCallback(async () => {
    await api.queue.callNext(doctorId);
    fetchData();
  }, [doctorId, fetchData]);

  const callPrev = useCallback(async () => {
    await api.queue.callPrev(doctorId);
    fetchData();
  }, [doctorId, fetchData]);

  const setToken = useCallback(async (token: number) => {
    await api.queue.setToken(doctorId, token);
    fetchData();
  }, [doctorId, fetchData]);

  return { data, loading, error, refetch: fetchData, callNext, callPrev, setToken };
}

export function useAppointments(date?: string, dateFrom?: string, dateTo?: string, doctorIdOverride?: string) {
  const { doctorId: authDoctorId } = useAuth();
  const doctorId = doctorIdOverride ?? authDoctorId;
  const [data, setData] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setData(await api.appointments.list(doctorId, date, dateFrom, dateTo)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unknown error"); }
    finally { setLoading(false); }
  }, [doctorId, date, dateFrom, dateTo]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}

export function useTodayAppointments(doctorIdOverride?: string) {
  const { doctorId: authDoctorId } = useAuth();
  const doctorId = doctorIdOverride ?? authDoctorId;
  const [data, setData] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try { setData(await api.appointments.today(doctorId)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unknown error"); }
    finally { if (!silent) setLoading(false); }
  }, [doctorId]);

  useEffect(() => {
    refetch();
    const t = setInterval(() => refetch(true), 30_000);
    return () => clearInterval(t);
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function usePatients(search?: string) {
  const { doctorId } = useAuth();
  const [data, setData] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await api.patients.list(doctorId, search);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [doctorId, search]);

  useEffect(() => {
    fetchData();
    const unsub = subscribeToPatients(doctorId, fetchData);
    return unsub;
  }, [fetchData, doctorId]);

  return { data, loading, error, refetch: fetchData };
}

export function usePrescriptions(patientId?: string) {
  const { doctorId } = useAuth();
  return useApiData<Prescription[]>(
    () => api.prescriptions.list(doctorId, patientId),
    []
  );
}

export function useFollowUps() {
  const { doctorId } = useAuth();
  const hook = useApiData<FollowUp[]>(
    () => api.followups.list(doctorId),
    [],
    30_000,
  );

  const triggerWhatsapp = useCallback(async () => {
    await api.followups.triggerWhatsapp();
    hook.refetch();
  }, [hook.refetch]);

  const triggerCalls = useCallback(async () => {
    await api.followups.triggerCalls();
    hook.refetch();
  }, [hook.refetch]);

  return { ...hook, triggerWhatsapp, triggerCalls };
}

export function useQueries() {
  const { doctorId } = useAuth();
  const [data, setData] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await api.queries.list(doctorId);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchData();
    const unsub = subscribeToQueries(doctorId, fetchData);
    return unsub;
  }, [fetchData, doctorId]);

  const answer = useCallback(async (id: string, text: string) => {
    await api.queries.answer(id, text);
    fetchData();
  }, [fetchData]);

  const unreadCount = data.filter((q) => q.status === "Pending").length;

  return { data, loading, error, refetch: fetchData, answer, unreadCount };
}

export function useReviews() {
  const { doctorId } = useAuth();
  return useApiData<Review[]>(() => api.reviews.list(doctorId), []);
}
