// TBA Office · KI-Verbrauch der eigenen Funktionen (27.11.2026, Claude, auf Wunsch von Gari).
// Jede Antwort von OpenAI nennt ihren Verbrauch (usage). Er landet in office_ki_verbrauch, je Funktion und Projekt,
// ohne Person: im Office wird die Nutzung nie je Mitarbeiter gezählt. Schreiben darf nur der Dienst; die Übersicht für
// Administratoren liest nur Summen. Ein Fehler hier hält nie eine Antwort auf: alles ist abgefangen.
// Eigener Ordner (_office), weil _shared die Dateien des Motors aus Window enthält.

const FUNKTION = /^[a-z][a-z0-9_]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ganz = wert => {
  const n = Math.floor(Number(wert));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 2000000000) : 0;
};

// Responses-API (input_tokens, output_tokens) und Embeddings (prompt_tokens, total_tokens).
export function verbrauchAus(payload) {
  const u = payload && typeof payload.usage === "object" && payload.usage ? payload.usage : {};
  const input = ganz(u.input_tokens ?? u.prompt_tokens);
  const output = ganz(u.output_tokens ?? u.completion_tokens);
  const cached = Math.min(input, ganz(u.input_tokens_details?.cached_tokens ?? u.prompt_tokens_details?.cached_tokens));
  const total = ganz(u.total_tokens) || input + output;
  return {input: input || (output ? 0 : total), cached, output, total};
}

// Websuchen kosten bei OpenAI je Aufruf extra; gezählt werden sie, damit die Schätzung sie kennt.
export function websuchen(payload) {
  return (Array.isArray(payload?.output) ? payload.output : []).filter(x => x?.type === "web_search_call").length;
}

export function verbrauchsZeile({funktion, modell, payload, projectId = null, details = {}} = {}) {
  if (!FUNKTION.test(String(funktion || ""))) return null;
  const v = verbrauchAus(payload);
  if (!(v.total > 0)) return null;
  const extra = {};
  for (const [schluessel, wert] of Object.entries(details && typeof details === "object" ? details : {})) {
    if (!/^[a-z_]{1,30}$/.test(schluessel)) continue;
    if (typeof wert === "number" && Number.isFinite(wert)) extra[schluessel] = wert;
    else if (typeof wert === "boolean") extra[schluessel] = wert;
    else if (typeof wert === "string" && wert) extra[schluessel] = wert.slice(0, 40);
  }
  const suchen = websuchen(payload);
  if (suchen) extra.websuchen = suchen;
  return {
    funktion,
    modell: String(payload?.model || modell || "unbekannt").slice(0, 80),
    input_tokens: v.input,
    cached_input_tokens: v.cached,
    output_tokens: v.output,
    total_tokens: v.total,
    project_id: UUID.test(String(projectId || "")) ? String(projectId).toLowerCase() : null,
    details: extra
  };
}

// Der Dienst-Client (Service Role) bleibt auf dem Server; createClient reicht die Funktion herein.
export function dienstFuer(createClient, env = globalThis.Deno?.env) {
  const url = env?.get?.("SUPABASE_URL") || "", schluessel = env?.get?.("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !schluessel || typeof createClient !== "function") return null;
  return createClient(url, schluessel, {auth: {persistSession: false, autoRefreshToken: false}});
}

export async function verbrauchSchreiben(dienst, angaben) {
  try {
    const zeile = verbrauchsZeile(angaben);
    if (!zeile || !dienst) return false;
    const {error} = await dienst.from("office_ki_verbrauch").insert(zeile);
    if (error) {
      console.error("office_ki_verbrauch_nicht_gespeichert", String(error.code || ""));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
