// Tatsächliche Kosten des Monats bei OpenAI (27.11.2026, Monatslimit): die reinen Hilfen der Funktion office-ki-kosten
// und ihre Regeln (nur Administratoren, Schlüssel nur als Secret, nichts gespeichert, Anmeldung nötig).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {monatsBeginnUtc, kostenUrl, zusammenfassen, VERSION} from '../supabase/functions/office-ki-kosten/core.mjs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Monatsbeginn in UTC und die Abfrage der Costs-API', () => {
  assert.equal(monatsBeginnUtc(new Date('2026-11-27T16:00:00Z')), Date.UTC(2026, 10, 1) / 1000);
  assert.equal(monatsBeginnUtc(new Date('2026-12-01T00:30:00Z')), Date.UTC(2026, 11, 1) / 1000);
  const url = new URL(kostenUrl(1793577600, 'seite_2'));
  assert.equal(url.origin + url.pathname, 'https://api.openai.com/v1/organization/costs');
  assert.equal(url.searchParams.get('start_time'), '1793577600');
  assert.equal(url.searchParams.get('bucket_width'), '1d');
  assert.equal(url.searchParams.get('group_by'), 'project_id');
  assert.equal(url.searchParams.get('limit'), '31');
  assert.equal(url.searchParams.get('page'), 'seite_2');
  assert.equal(new URL(kostenUrl(1)).searchParams.has('page'), false);
  assert.match(VERSION, /^office-ki-kosten-v\d+$/);
});

test('Seiten der Costs-API: Summe, je Tag und je Projekt mit Namen', () => {
  const tag = (d, results) => ({object: 'bucket', start_time: Date.UTC(2026, 10, d) / 1000, end_time: Date.UTC(2026, 10, d + 1) / 1000, results});
  const r = (value, project_id) => ({object: 'organization.costs.result', amount: {value, currency: 'usd'}, project_id, line_item: null});
  const seiten = [
    {object: 'page', data: [tag(1, [r(0.25, 'proj_a'), r(1, 'proj_b')]), tag(2, [])], has_more: true, next_page: 'x'},
    {object: 'page', data: [tag(3, [r('0.5', 'proj_a'), r(null, null)])], has_more: false}
  ];
  const s = zusammenfassen(seiten, {proj_a: 'Office'}, new Date('2026-11-03T09:00:00Z'));
  assert.equal(s.verfuegbar, true);
  assert.equal(s.monat, '2026-11');
  assert.equal(s.usd, 1.75);
  assert.deepEqual(s.tage, [{tag: '2026-11-01', usd: 1.25}, {tag: '2026-11-03', usd: 0.5}]);
  assert.deepEqual(s.projekte, [{id: 'proj_b', name: null, usd: 1}, {id: 'proj_a', name: 'Office', usd: 0.75}, {id: null, name: null, usd: 0}]);
  assert.equal(s.stand, '2026-11-03T09:00:00.000Z');
  assert.deepEqual(zusammenfassen([], {}, new Date('2026-11-03T09:00:00Z')).tage, []);
});

test('Nur Administratoren, der Schlüssel nur als Secret, nichts gespeichert, Anmeldung nötig', () => {
  const src = read('supabase/functions/office-ki-kosten/index.ts');
  assert.match(src, /if\(origin&&origin!==ORIGIN\)return respond\(403/);
  assert.match(src, /sb\.auth\.getUser\(token\)/);
  assert.match(src, /member\.role!=="admin"\)return respond\(403,\{error:"admin_only"\}\)/);
  assert.match(src, /Deno\.env\.get\("OPENAI_ADMIN_KEY"\)/);
  assert.match(src, /verfuegbar:false,grund:"kein_schluessel"/);
  assert.match(src, /verfuegbar:false,grund:"schluessel_abgelehnt"/);
  assert.doesNotMatch(src, /console\.(log|error|warn)/);
  assert.doesNotMatch(src, /\.insert\(|\.upsert\(|\.update\(|SERVICE_ROLE/);
  assert.doesNotMatch(src, /respond\([^)]*key[^)]*\)/i);
  assert.match(read('supabase/config.toml'), /\[functions\.office-ki-kosten\]\nverify_jwt = true\nentrypoint = "\.\/functions\/office-ki-kosten\/index\.ts"/);
  // Die Seite fragt die Funktion, kommt aber ohne sie aus.
  const seite = read('office-uebersicht.js');
  assert.match(seite, /sb\.functions\.invoke\('office-ki-kosten'/);
  assert.match(seite, /return error\|\|!data\?null:data;/);
});
