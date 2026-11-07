/* TBA Office · Supabase client for the Window-based app.
   Same contract as Window's shared/supabase-client.js (window.MINDS_SUPABASE), but it connects to the
   TBA Office project from ../office-config.js and shares the office sign-in session (same storage key),
   so signing in on the office start page is enough. Only the publishable key lives in the browser. */
(() => {
  const office = window.TBA_OFFICE_CONFIG;
  const config = office ? { url: office.url, publishableKey: office.key } : null;
  window.MINDS_SUPABASE_CONFIG = config ? Object.freeze(config) : null;
  if (!config || !window.supabase?.createClient) {
    console.warn('[TBA Office] Supabase is not available.');
    window.MINDS_SUPABASE = null;
    return;
  }
  const bridge = window.webkit?.messageHandlers?.windowNative;
  if (!bridge) {
    window.MINDS_SUPABASE = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        storageKey: office.storageKey,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
    return;
  }

  // Inside the Window iPhone app (account "Office") the app owns the office session, exactly as it
  // owns the personal one for Window: one sign-in in the app, one owner of the refresh token (the
  // Keychain). The page only borrows the current access token through the bridge (contract v1,
  // apps/isabella-ios/BRIDGE.md in Window) and never refreshes or stores a session of its own.
  const call = async (type, payload) => {
    try { return await bridge.postMessage(Object.assign({}, payload || {}, { v: 1, type })); }
    catch (error) { return { v: 1, ok: false, error: String(error?.message || error) }; }
  };
  window.WINDOW_NATIVE = Object.freeze({ available: true, version: 1, call });
  try { localStorage.removeItem(office.storageKey); } catch {}

  let cached = null;
  let pending = null;
  const listeners = new Set();
  const current = () => {
    if (cached && cached.expires_at - 60 > Date.now() / 1000) return Promise.resolve(cached);
    if (!pending) {
      pending = call('session.get')
        .then(reply => (cached = reply?.ok && reply.session?.access_token ? reply.session : null))
        .finally(() => { pending = null; });
    }
    return pending;
  };
  const asSession = s => s ? {
    access_token: s.access_token,
    token_type: 'bearer',
    expires_at: s.expires_at,
    expires_in: Math.max(0, Math.round(s.expires_at - Date.now() / 1000)),
    user: { id: s.user?.id, email: s.user?.email || undefined, aud: 'authenticated', role: 'authenticated' }
  } : null;
  const signInInApp = async () => {
    void call('session.signIn');
    return { data: { user: null, session: null }, error: { message: 'In der Window-App meldest du dich in der App an.' } };
  };

  const client = window.supabase.createClient(config.url, config.publishableKey, {
    accessToken: async () => (await current())?.access_token ?? null
  });
  client.auth = Object.freeze({
    getSession: async () => ({ data: { session: asSession(await current()) }, error: null }),
    getUser: async () => ({ data: { user: asSession(await current())?.user || null }, error: null }),
    refreshSession: async () => {
      cached = null;
      const session = asSession(await current());
      return { data: { session, user: session?.user || null }, error: null };
    },
    onAuthStateChange: (callback) => {
      listeners.add(callback);
      current().then(s => { if (listeners.has(callback)) callback('INITIAL_SESSION', asSession(s)); });
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },
    signOut: async () => { cached = null; await call('session.signOut'); return { error: null }; },
    signInWithPassword: signInInApp,
    signInWithOtp: signInInApp,
    verifyOtp: signInInApp
  });
  window.MINDS_SUPABASE = client;
})();
