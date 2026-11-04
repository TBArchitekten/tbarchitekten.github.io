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
  window.MINDS_SUPABASE = window.supabase.createClient(config.url, config.publishableKey, {
    auth: {
      storageKey: office.storageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
})();
