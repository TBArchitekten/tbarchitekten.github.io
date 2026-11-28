// TBA Office · Versand der Mitteilungen des Assistenten über APNs (27.11.2026, Claude, auf Wunsch von Gari). Reine Hilfsfunktionen
// ohne Netz und ohne Deno, damit sie in Node getestet werden: Anbieter-Token (JWT, ES256), Verschlüsselung für das
// iPhone (AES-256-GCM, wie CryptoKit «combined»), die Anfrage an APNs und was eine Antwort bedeutet.
// Apple sieht nur OEFFENTLICH; den eigentlichen Text entschlüsselt die Mitteilungserweiterung der Window-App.
// Seit dem 28.11.2026 gibt jede Person ihrem Assistenten einen eigenen Namen: der steht nur im verschlüsselten Titel
// (die Warteschlange trägt ihn ein); Apple sieht «TBA Office», ohne Namen.
export const APNS_HOSTS = {production: "https://api.push.apple.com", development: "https://api.sandbox.push.apple.com"};
export const OEFFENTLICH = {title: "TBA Office", body: "Neue Mitteilung"};
export const MAX_VERSUCHE = 6;
// Apple: ein neues Anbieter-Token höchstens alle 20 Minuten, gültig bis 60 Minuten. Wir erneuern nach 40.
export const JWT_MINUTEN = 40;

const enc = new TextEncoder();
const b64 = bytes => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const b64url = bytes => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));

// Die .p8-Datei von Apple, wie sie in den Secrets steht: mit oder ohne Kopf- und Fußzeile, Umbrüche egal.
export function p8ZuDer(text) {
  const roh = String(text || "")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");
  if (roh.length < 100 || !/^[A-Za-z0-9+/]+={0,2}$/.test(roh)) throw new Error("apns_key_invalid");
  return unb64(roh);
}

export async function anbieterToken({p8, keyId, teamId, jetzt = Date.now()}) {
  if (!/^[A-Z0-9]{10}$/.test(keyId || "") || !/^[A-Z0-9]{10}$/.test(teamId || "")) throw new Error("apns_ids_invalid");
  const key = await crypto.subtle.importKey("pkcs8", p8ZuDer(p8), {name: "ECDSA", namedCurve: "P-256"}, false, ["sign"]);
  const iat = Math.floor(jetzt / 1000);
  const kopf = b64url(enc.encode(JSON.stringify({alg: "ES256", kid: keyId})));
  const inhalt = b64url(enc.encode(JSON.stringify({iss: teamId, iat})));
  // WebCrypto liefert die ECDSA-Signatur roh (r ‖ s, 64 Byte): genau das Format von JWT ES256.
  const sig = new Uint8Array(await crypto.subtle.sign({name: "ECDSA", hash: "SHA-256"}, key, enc.encode(kopf + "." + inhalt)));
  return {token: kopf + "." + inhalt + "." + b64url(sig), iat};
}

// Ein gespeichertes Token wiederverwenden, solange es zum Schlüssel passt und jünger als JWT_MINUTEN ist.
export function jwtAusSpeicher(wert, keyId, teamId, jetzt = Date.now()) {
  try {
    const c = JSON.parse(String(wert || ""));
    const alter = jetzt / 1000 - Number(c.iat);
    if (c.kid === keyId && c.iss === teamId && typeof c.token === "string" && alter >= 0 && alter < JWT_MINUTEN * 60) return c.token;
  } catch { /* kein oder kaputter Speicher: neues Token */ }
  return null;
}

// AES-256-GCM mit dem Schlüssel des iPhones: Nonce (12 Byte) ‖ Geheimtext ‖ Tag (16 Byte), Base64.
export async function versiegeln(schluesselB64, nachricht, nonce = crypto.getRandomValues(new Uint8Array(12))) {
  let roh;
  try { roh = unb64(String(schluesselB64 || "")); } catch { roh = new Uint8Array(); }
  if (roh.length !== 32) throw new Error("device_key_invalid");
  const key = await crypto.subtle.importKey("raw", roh, {name: "AES-GCM"}, false, ["encrypt"]);
  const daten = enc.encode(JSON.stringify(nachricht));
  const geheim = new Uint8Array(await crypto.subtle.encrypt({name: "AES-GCM", iv: nonce, tagLength: 128}, key, daten));
  const alles = new Uint8Array(nonce.length + geheim.length);
  alles.set(nonce);
  alles.set(geheim, nonce.length);
  return b64(alles);
}

// Was die App nach dem Entschlüsseln zeigt: Titel, Text, wohin ein Tippen führt, Art und Kennung.
export function inhalt(m) {
  return {t: String(m.titel || "KI-Assistent").slice(0, 80), b: String(m.text || "").slice(0, 600), z: m.ziel || "romy", k: m.art, i: m.id};
}

export function anfrage({geraet, jwt, nachricht, versiegelt}) {
  const host = APNS_HOSTS[geraet.umgebung];
  if (!host) throw new Error("unknown_environment");
  if (!/^[0-9a-f]{64,200}$/.test(String(geraet.apns_token || ""))) throw new Error("device_token_invalid");
  const body = {aps: {alert: {...OEFFENTLICH}, sound: "default", "mutable-content": 1, "thread-id": "romy"}, o: 1, e: versiegelt};
  const ablauf = Math.max(0, Math.floor(new Date(nachricht.gueltig_bis).getTime() / 1000));
  return {
    url: `${host}/3/device/${geraet.apns_token}`,
    headers: {
      authorization: "bearer " + jwt,
      "apns-topic": geraet.bundle_id,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": String(ablauf),
      "apns-collapse-id": String(nachricht.id).slice(0, 64),
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

// Antwort von APNs → was zu tun ist (Apple, «Handling notification responses from APNs»).
export function einordnen(status, grund = "") {
  if (status === 200) return "zugestellt";
  if (status === 410) return "geraet_weg";
  if (status === 400 && ["BadDeviceToken", "DeviceTokenNotForTopic", "TopicDisallowed", "BadTopic"].includes(grund)) return "geraet_weg";
  if (status === 403 && ["ExpiredProviderToken", "InvalidProviderToken", "MissingProviderToken"].includes(grund)) return "token_neu";
  if (status === 0 || status === 429 || status >= 500) return "spaeter";
  return "fehler";
}

export function naechsterVersuch(versuche, jetzt = Date.now()) {
  const minuten = [1, 5, 15, 60, 180][Math.min(Math.max(Number(versuche) || 1, 1), 5) - 1];
  return new Date(jetzt + minuten * 60000).toISOString();
}

// Der Ausgang einer Mitteilung aus den Ergebnissen ihrer Geräte.
export function ausgang({ergebnisse, versuche, gueltigBis, jetzt = Date.now()}) {
  if (!ergebnisse.length) return {status: "ohne_geraet"};
  if (ergebnisse.some(e => e.was === "zugestellt")) return {status: "gesendet"};
  if (ergebnisse.some(e => e.was === "spaeter" || e.was === "token_neu")) {
    if (versuche >= MAX_VERSUCHE) return {status: "fehlgeschlagen"};
    const wann = naechsterVersuch(versuche, jetzt);
    return new Date(wann).getTime() < new Date(gueltigBis).getTime() ? {status: "wartet", naechster_versuch: wann} : {status: "abgelaufen"};
  }
  if (ergebnisse.every(e => e.was === "geraet_weg")) return {status: "ohne_geraet"};
  return {status: "fehlgeschlagen"};
}

// Geheimnis des Versands vergleichen, ohne über die Laufzeit etwas zu verraten.
export function geheimnisPasst(gegeben, erwartet) {
  const a = enc.encode(String(gegeben || "")), b = enc.encode(String(erwartet || ""));
  if (!b.length || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
