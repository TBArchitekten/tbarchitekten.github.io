/* TBA Office · Fehler aus dem Browser melden (Gari, 27.11.2026).
   Was in einer Seite schiefgeht (Skriptfehler, abgelehntes Versprechen), geht an office_client_fehler_melden, damit
   die tägliche Codeprüfung mit echten Fehlern arbeitet. Nur Technisches: Meldung, Ort im Code, Seite ohne Parameter,
   Browser in Kurzform; E-Mail-Adressen, Tokens und Parameter in fremden Adressen werden hier schon entfernt (und in
   der Datenbank noch einmal). Höchstens acht Meldungen je Seitenaufruf, jede nur einmal; Rauschen (fremde Skripte,
   Erweiterungen, ResizeObserver, abgebrochene Anfragen) bleibt draußen. Ein Fehler beim Melden stört die Seite nie. */
(() => {
  'use strict';
  if (window.TBA_OFFICE_FEHLER) return;
  const MAX = 8;
  const gesehen = new Set();
  let gesendet = 0;
  const kurz = (v, n) => String(v ?? '').slice(0, n);
  const ohneHerkunft = t => String(t ?? '').split(location.origin).join('');
  const saeubern = (t, n) => kurz(String(t ?? '')
    .replace(/(https?:\/\/[^\s?#'")]+)[?#][^\s'")]*/g, '$1')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[E-Mail]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[Token]'), n);
  const RAUSCHEN = [/^Script error\.?$/i, /ResizeObserver loop/i, /AbortError/i, /aborted/i];
  const rauschen = msg => !msg || RAUSCHEN.some(re => re.test(msg));
  const fremd = datei => !!datei && !/^https?:/i.test(datei);
  const browser = () => {
    const ua = navigator.userAgent || '';
    const m = ua.match(/(Edg|Firefox|Chrome|Version)\/(\d+)/);
    const name = m ? (m[1] === 'Version' ? 'Safari' : m[1] === 'Edg' ? 'Edge' : m[1]) + ' ' + m[2] : '';
    const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : '';
    return kurz([name, os, window.webkit?.messageHandlers?.windowNative ? 'Window-App' : ''].filter(Boolean).join(' · '), 120);
  };
  const version = () => {
    const s = [...document.scripts].map(x => x.getAttribute('src') || '').find(x => /\?v=/.test(x) && !/shared\//.test(x));
    return s ? kurz(s.replace(/^.*\//, ''), 40) : '';
  };
  async function melden(art, nachricht, ort, stapel) {
    const meldung = saeubern(ohneHerkunft(nachricht), 300);
    if (rauschen(meldung) || gesendet >= MAX) return false;
    const schluessel = art + '|' + meldung + '|' + ort;
    if (gesehen.has(schluessel)) return false;
    gesehen.add(schluessel); gesendet++;
    const sb = window.MINDS_SUPABASE;
    if (!sb || typeof sb.rpc !== 'function') return false;
    try {
      await sb.rpc('office_client_fehler_melden', {
        p_seite: kurz(location.pathname, 120) || '/',
        p_art: art,
        p_nachricht: meldung,
        p_ort: saeubern(ohneHerkunft(ort), 200) || null,
        p_stapel: saeubern(ohneHerkunft(stapel), 1200) || null,
        p_browser: browser() || null,
        p_version: version() || null
      });
      return true;
    } catch { return false; }
  }
  window.addEventListener('error', event => {
    if (!event || !event.message || fremd(event.filename)) return;
    const ort = event.filename ? event.filename + ':' + (event.lineno || 0) + ':' + (event.colno || 0) : '';
    void melden('fehler', event.message, ort, event.error && event.error.stack);
  });
  window.addEventListener('unhandledrejection', event => {
    const grund = event && event.reason;
    const nachricht = grund && grund.message ? grund.message : String(grund ?? '');
    if (grund && grund.name === 'AbortError') return;
    void melden('promise', nachricht, '', grund && grund.stack);
  });
  window.TBA_OFFICE_FEHLER = Object.freeze({ saeubern, melden });
})();
