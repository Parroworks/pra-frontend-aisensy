/**
 * The backend now requires a login token on every dashboard API call. Rather than touching ~40 call sites,
 * wrap fetch once: any request to the API gets `Authorization: Bearer <token>`, and a 401 (expired or invalid
 * session) clears the token and returns to the login screen. Other URLs are left alone.
 */
const API_BASE = ((import.meta.env.VITE_API_URL as string) || "").replace(/\/$/, "");
const TOKEN_KEY = "pra_auth_token";

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function installAuthFetch(): void {
  if (!API_BASE) return;
  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input);
    if (!url.startsWith(API_BASE)) return original(input, init);

    let token: string | null = null;
    try { token = localStorage.getItem(TOKEN_KEY); } catch { /* storage unavailable */ }

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

    const res = await original(input, { ...init, headers });

    // Session expired / invalid → back to the login screen (the auth endpoints handle their own 401s).
    if (res.status === 401 && token && !url.includes("/api/auth/")) {
      try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
      window.location.reload();
    }
    return res;
  };
}
