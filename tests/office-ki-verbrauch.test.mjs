// KI-Verbrauch der Office-Funktionen (27.11.2026): der Helfer liest den Verbrauch aus jeder Antwort von OpenAI und
// schreibt ihn ohne Person nach office_ki_verbrauch; jede Funktion des Office, die OpenAI ruft, benutzt ihn.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {verbrauchAus,websuchen,verbrauchsZeile,verbrauchSchreiben,dienstFuer} from '../supabase/functions/_office/ki-verbrauch.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const PROJEKT = '7b3d2a10-1111-4222-8333-444455556666';

test('liest den Verbrauch der Responses-API und der Embeddings', () => {
  assert.deepEqual(verbrauchAus({usage: {input_tokens: 1200, input_tokens_details: {cached_tokens: 200}, output_tokens: 300, total_tokens: 1500}}),
    {input: 1200, cached: 200, output: 300, total: 1500});
  assert.deepEqual(verbrauchAus({usage: {prompt_tokens: 40, total_tokens: 40}}), {input: 40, cached: 0, output: 0, total: 40});
  assert.deepEqual(verbrauchAus({usage: {total_tokens: 12}}), {input: 12, cached: 0, output: 0, total: 12});
  assert.deepEqual(verbrauchAus({usage: {input_tokens: 10, output_tokens: 5}}), {input: 10, cached: 0, output: 5, total: 15});
  // Mehr zwischengespeichert als Eingabe gibt es nicht; Unsinn zählt als null.
  assert.equal(verbrauchAus({usage: {input_tokens: 10, input_tokens_details: {cached_tokens: 99}}}).cached, 10);
  assert.deepEqual(verbrauchAus({usage: {input_tokens: -5, output_tokens: 'x'}}), {input: 0, cached: 0, output: 0, total: 0});
  assert.deepEqual(verbrauchAus(null), {input: 0, cached: 0, output: 0, total: 0});
});

test('zählt Websuchen der Antwort', () => {
  assert.equal(websuchen({output: [{type: 'web_search_call'}, {type: 'message'}, {type: 'web_search_call'}]}), 2);
  assert.equal(websuchen({}), 0);
});

test('baut eine Zeile ohne Person, mit gültigem Projekt und bereinigten Angaben', () => {
  const zeile = verbrauchsZeile({funktion: 'kosten', modell: 'gpt-5.6', projectId: PROJEKT.toUpperCase(),
    payload: {model: 'gpt-5.6-sol-2026-10-01', usage: {input_tokens: 100, output_tokens: 20}, output: [{type: 'web_search_call'}]},
    details: {schritt: 'antwort', anhaenge: 2, Boese: 'x', name: {verschachtelt: true}, lang: 'x'.repeat(90)}});
  assert.deepEqual(zeile, {funktion: 'kosten', modell: 'gpt-5.6-sol-2026-10-01', input_tokens: 100, cached_input_tokens: 0,
    output_tokens: 20, total_tokens: 120, project_id: PROJEKT, details: {schritt: 'antwort', anhaenge: 2, lang: 'x'.repeat(40), websuchen: 1}});
  assert.ok(!('user_id' in zeile));
  assert.equal(verbrauchsZeile({funktion: 'kosten', payload: {usage: {total_tokens: 5}}, projectId: 'kein-projekt'}).project_id, null);
  assert.equal(verbrauchsZeile({funktion: 'kosten', payload: {usage: {total_tokens: 5}}}).modell, 'unbekannt');
  assert.equal(verbrauchsZeile({funktion: 'Kosten!', payload: {usage: {total_tokens: 5}}}), null);
  assert.equal(verbrauchsZeile({funktion: 'kosten', payload: {usage: {}}}), null);
});

test('schreibt mit dem Dienst und hält bei einem Fehler nie die Antwort auf', async () => {
  const geschrieben = [];
  const dienst = {from: tabelle => ({insert: async zeile => { geschrieben.push([tabelle, zeile]); return {error: null}; }})};
  assert.equal(await verbrauchSchreiben(dienst, {funktion: 'produkte', modell: 'gpt-5.6', payload: {usage: {input_tokens: 3, output_tokens: 4}}}), true);
  assert.equal(geschrieben[0][0], 'office_ki_verbrauch');
  assert.equal(geschrieben[0][1].total_tokens, 7);
  assert.equal(await verbrauchSchreiben(dienst, {funktion: 'produkte', payload: {}}), false);
  assert.equal(geschrieben.length, 1);
  const fehler = console.error;
  console.error = () => {};
  try {
    assert.equal(await verbrauchSchreiben({from: () => ({insert: async () => ({error: {code: '42501'}})})},
      {funktion: 'produkte', payload: {usage: {total_tokens: 1}}}), false);
    assert.equal(await verbrauchSchreiben({from: () => { throw new Error('netz'); }},
      {funktion: 'produkte', payload: {usage: {total_tokens: 1}}}), false);
  } finally { console.error = fehler; }
  assert.equal(await verbrauchSchreiben(null, {funktion: 'produkte', payload: {usage: {total_tokens: 1}}}), false);
});

test('der Dienst-Client entsteht nur mit Adresse und Schlüssel', () => {
  const env = werte => ({get: k => werte[k]});
  const erzeugt = [];
  const createClient = (...args) => { erzeugt.push(args); return {ok: true}; };
  assert.deepEqual(dienstFuer(createClient, env({SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k'})), {ok: true});
  assert.equal(erzeugt[0][0], 'https://x.supabase.co');
  assert.equal(erzeugt[0][2].auth.persistSession, false);
  assert.equal(dienstFuer(createClient, env({SUPABASE_URL: 'https://x.supabase.co'})), null);
  assert.equal(dienstFuer(null, env({SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k'})), null);
});

test('jede Funktion des Office, die OpenAI ruft, schreibt ihren Verbrauch', () => {
  const erwartet = {
    'supabase/functions/office-kosten-ai/index.ts': ['funktion:"kosten"', 'projectId:inst.project_id'],
    'supabase/functions/office-dokumente-ai/index.ts': ['funktion:"dokumente"', 'projectId:dok.project_id'],
    'supabase/functions/office-produkt-ai/index.ts': ['funktion:"produkte"'],
    'supabase/functions/office-terminplan-ai/index.ts': ['funktion:"terminplan"', 'schritt:"einordnen"', 'projectId:plan.project_id'],
    'supabase/functions/office-assistant/index.ts': ['funktion:"romy_chat"', 'await merken(payload,"antwort")', 'await merken(again,"antwort")', '"einordnen"'],
    'supabase/functions/office-assistant/romy-capability-runtime.ts': ['funktion:"romy_faehigkeit"', 'einmal:String(run.id)'],
    'supabase/functions/office-assistant/romy-semantic-memory.mjs': ['funktion:"romy_gedaechtnis"'],
    'supabase/functions/office-romy-mission-runner/index.ts': ['funktion:"romy_auftrag"', 'runCheckpoint(mission,ai,admin)']
  };
  for (const [datei, stellen] of Object.entries(erwartet)) {
    const code = read(datei);
    assert.match(code, /from "\.\.\/_office\/ki-verbrauch\.mjs"/, datei);
    for (const stelle of stellen) assert.ok(code.includes(stelle), datei + ' fehlt ' + stelle);
  }
  const datei = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(x => x.endsWith('_office_ki_verbrauch.sql'));
  assert.equal(datei.length, 1);
  const migration = read('supabase/migrations/' + datei[0]);
  assert.doesNotMatch(migration, /user_id/);
  assert.match(migration, /revoke all on public\.office_ki_verbrauch from public, anon, authenticated;/);
  assert.match(migration, /enable row level security/);
});

test('neue Aufrufe an OpenAI in Office-Funktionen bleiben nicht ungezählt', () => {
  const wurzel = new URL('../supabase/functions/', import.meta.url);
  // Der Einordner des Chats liefert seinen Verbrauch an index.ts zurück, das ihn schreibt.
  const vomAufruferGezaehlt = new Set(['office-assistant/romy-router.mjs']);
  const ungezaehlt = [];
  for (const ordner of readdirSync(wurzel).filter(x => x.startsWith('office-'))) {
    for (const datei of readdirSync(new URL(ordner + '/', wurzel)).filter(x => /\.(ts|mjs|js)$/.test(x))) {
      const code = readFileSync(new URL(ordner + '/' + datei, wurzel), 'utf8');
      if (!/api\.openai\.com\/v1\/(responses|embeddings)/.test(code)) continue;
      if (vomAufruferGezaehlt.has(ordner + '/' + datei)) continue;
      if (!code.includes('_office/ki-verbrauch.mjs')) ungezaehlt.push(ordner + '/' + datei);
    }
  }
  assert.deepEqual(ungezaehlt, []);
});
