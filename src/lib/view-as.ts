/**
 * Admin "view as member": the app runs inside an admin's phone-sized frame whose window.name
 * carries the member id. The admin's own session is used (admin RLS reads), the signed-in user
 * is swapped for the member on the client, and every write to the backend is refused.
 */
const PREFIX = "boa-view-as:";
export type ViewAs = { id: string; email: string; name: string };

export function viewAsFrameName(m: ViewAs) { return PREFIX + encodeURIComponent(JSON.stringify(m)); }

export const viewAs: ViewAs | null = (() => {
  try {
    if (typeof window === "undefined" || window.self === window.top || !window.name.startsWith(PREFIX)) return null;
    const v = JSON.parse(decodeURIComponent(window.name.slice(PREFIX.length)));
    return typeof v?.id === "string" ? v : null;
  } catch { return null; }
})();

/** Read-only functions the member screens may call. */
const READ_RPCS = new Set(["has_role", "has_investment_access", "has_transfer_pin", "has_staff_pin", "is_support_staff", "coin_activity", "coin_activity_all", "my_coin_address", "my_coin_addresses", "coin_address_for"]);

export function isAllowedRequest(url: string, method: string, backend: string) {
  if (!url.startsWith(backend)) return true;
  const m = method.toUpperCase();
  const path = url.slice(backend.length);
  if (path.startsWith("/auth/v1/")) return m === "GET" || path.startsWith("/auth/v1/token");
  if (m === "GET" || m === "HEAD") return true;
  const rpc = path.match(/^\/rest\/v1\/rpc\/([a-z_]+)/);
  return !!rpc && READ_RPCS.has(rpc[1]);
}

/** Must run before the backend client is created. */
export function installViewAsFetchGuard(backend: string) {
  if (!viewAs) return;
  const real = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || (input instanceof Request ? input.method : "GET");
    if (!isAllowedRequest(url, method, backend)) {
      window.dispatchEvent(new Event("view-as-blocked"));
      return Promise.resolve(new Response(JSON.stringify({ message: "View only — admin preview. Nothing was changed.", code: "VIEW_ONLY" }), { status: 403, headers: { "Content-Type": "application/json" } }));
    }
    return real(input, init);
  };
}

/** Swap the signed-in user for the member and stop sign-out from ending the admin's session. */
export function patchAuthForViewAs(auth: any) {
  if (!viewAs) return;
  const swap = (u: any) => u ? { ...u, id: viewAs.id, email: viewAs.email, user_metadata: { ...(u.user_metadata || {}), full_name: viewAs.name } } : u;
  const getUser = auth.getUser.bind(auth);
  auth.getUser = async (...a: any[]) => { const r = await getUser(...a); return { ...r, data: { ...r.data, user: swap(r.data?.user) } }; };
  const getSession = auth.getSession.bind(auth);
  auth.getSession = async () => { const r = await getSession(); const s = r.data?.session; return { ...r, data: { session: s ? { ...s, user: swap(s.user) } : s } }; };
  const onChange = auth.onAuthStateChange.bind(auth);
  auth.onAuthStateChange = (cb: any) => onChange((e: any, s: any) => cb(e, s ? { ...s, user: swap(s.user) } : s));
  auth.signOut = async () => { window.dispatchEvent(new Event("view-as-blocked")); return { error: null }; };
}
