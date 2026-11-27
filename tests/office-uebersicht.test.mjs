// Übersicht für Administratoren (27.11.2026): KI-Nutzung mit Monatslimit und Systemstatus. Geprüft werden die Schätzung
// (Preise, lange Anfragen, Websuchen, Container), die Zusammenfassung (Tage, Durchschnitt, Monatslimit, Projekte), dass
// die Seite nie eine Person zeigt und Fremdtext maskiert, und dass nur Administratoren die Seiten sehen.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const U = require('../office-uebersicht.js');
const M = U.modell;
const MOTOR = require('../supabase/functions/_shared/credit-model.mjs');

test('Preise: Modelle, datierte Fassungen, unbekannte Modelle', () => {
  assert.equal(M.preisFuer('gpt-6.1-terra').output, 5);
  assert.equal(M.preisFuer('gpt-6.1-terra-2026-10-26').input, 1);
  assert.equal(M.preisFuer('gpt-5.6').id, 'gpt-5.6-sol');
  assert.equal(M.preisFuer('gpt-5.6-2026-09-01').id, 'gpt-5.6-sol');
  assert.equal(M.preisFuer('gpt-5.6-luna').id, 'gpt-5.6-luna');
  assert.equal(M.preisFuer('gpt-6.1-terrafirma'), null);
  // Die Modelle seit 27.11.2026.
  assert.deepEqual(M.preisFuer('gpt-6.2-sol'), {id: 'gpt-6.2-sol', input: 2, cached: 0.10, output: 10});
  assert.equal(M.preisFuer('gpt-6-luna').output, 0.50);
  assert.equal(M.preisFuer('gpt-6.2-astra').input, 8);
  assert.equal(M.preisFuer('gpt-6-astra').input, 10);
  assert.equal(M.preisFuer('gpt-99'), null);
  assert.equal(M.preisFuer(''), null);
});

test('Preise der Modelle, die auch Romys Motor kennt, sind dieselben', () => {
  let gleich = 0;
  for (const p of M.PREISE) {
    const motor = MOTOR.PRICE_TABLE.find(x => x.id === p.id);
    if (!motor) continue;
    gleich++;
    assert.deepEqual({input: p.input, cached: p.cached, output: p.output}, {input: motor.input, cached: motor.cached, output: motor.output}, p.id);
  }
  assert.ok(gleich >= 4);
  assert.equal(M.LANG_INPUT, (MOTOR.default || MOTOR).LONG_CONTEXT_INPUT);
});

test('Kosten: Eingabe, Cache, Ausgabe, lange Anfragen, Websuchen und Container', () => {
  const nah = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' ≠ ' + b);
  // 1 Mio. Eingabe (davon 200 000 im Cache) und 100 000 Ausgabe bei gpt-6.1-terra: 0,80 + 0,01 + 0,50.
  nah(M.kosten({modell: 'gpt-6.1-terra', input: 1e6, cached: 2e5, output: 1e5}).usd, 1.31);
  // Lang: doppelte Eingabe, 1,5-fache Ausgabe.
  nah(M.kosten({modell: 'gpt-6.1-terra', input: 3e5, output: 1e4, lang: true}).usd, 0.6 + 0.075);
  // Zwei Websuchen und ein Container kommen dazu.
  nah(M.kosten({modell: 'gpt-6.1-terra', input: 0, output: 0, websuchen: 2, container: 1}).usd, 0.05);
  // Embeddings melden nur eine Summe.
  nah(M.kosten({modell: 'text-embedding-3-small', total: 1e6}).usd, 0.02);
  // Ohne bekannten Preis: nur die Werkzeuge, und als unbepreist markiert.
  assert.deepEqual(M.kosten({modell: 'gpt-99', input: 1e6, websuchen: 1}), {usd: 0.01, bepreist: false});
});

const DATEN = {
  heute: '2026-11-27',
  stand: '2026-11-27T11:00:00Z',
  monat_beginn: '2026-11-01',
  guthaben: {betrag_usd: 10, warnen_ab_tage: 7, stand_am: '2026-11-25T08:00:00Z'},
  projekte: [{id: 'p1', nummer: 'T-1', name: 'Testprojekt'}],
  zeilen: [
    // Sieben volle Tage vor heute je 1 Mio. luna-Eingabe = 0,20 $ pro Tag.
    ...['20', '21', '22', '23', '24', '25', '26'].map(t => ({tag: '2026-11-' + t, quelle: 'romy', funktion: 'isabella_chat', modell: 'gpt-5.6-luna',
      aufrufe: 3, input: 1e6, cached: 0, output: 0, total: 1e6, nach_stand: t >= '25'})),
    {tag: '2026-11-27', quelle: 'office', funktion: 'kosten', modell: 'gpt-6.1-terra', projekt_id: 'p1', aufrufe: 2, input: 1e6, cached: 0, output: 0, total: 1e6, nach_stand: true},
    {tag: '2026-11-27', quelle: 'office', funktion: 'produkte', modell: 'gpt-6.1-terra', projekt_id: null, aufrufe: 1, input: 0, output: 0, total: 0, websuchen: 0, container: 1, nach_stand: true},
    {tag: '2026-11-27', quelle: 'office', funktion: 'dokumente', modell: 'gpt-99', projekt_id: 'p1', aufrufe: 4, input: 5, output: 5, total: 10, nach_stand: true},
    // Außerhalb der 30 Tage und des Monats: zählt weder für die Tage noch für den Monat.
    {tag: '2026-10-01', quelle: 'romy', funktion: 'isabella_chat', modell: 'gpt-5.6-luna', aufrufe: 1, input: 0, output: 0, total: 0, nach_stand: false}
  ]
};

test('Zusammenfassung: 30 Tage, Durchschnitt der sieben vollen Tage, Monat, Funktionen und Projekte', () => {
  const s = M.zusammenfassen(DATEN);
  const nah = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' ≠ ' + b);
  assert.equal(s.proTag.length, 30);
  assert.equal(s.proTag[29].tag, '2026-11-27');
  assert.equal(s.proTag[0].tag, '2026-10-29');
  nah(s.heuteUsd, 1 + 0.03);
  nah(s.durchschnitt, 0.2);
  // Diesen Monat im Office: sieben Tage je 0,20 und heute 1,03; ohne Monatslimit keine Rechnung dazu.
  nah(s.monatOffice, 1.4 + 1.03);
  assert.equal(s.monatslimit, null);
  assert.deepEqual(s.nachFunktion.map(f => f.schluessel), ['romy:isabella_chat', 'office:kosten', 'office:produkte', 'office:dokumente']);
  // Nur die Werkzeuge des Office stehen in den Projekten; Romys Motor gehört zu keinem.
  assert.deepEqual(s.nachProjekt.map(p => p.projekt_id), ['p1', null]);
  assert.deepEqual(s.ohnePreis, {aufrufe: 4, modelle: ['gpt-99']});
});

// Monatslimit (27.11.2026): heute um 12:00 Uhr in Berlin sind noch 3,5 Tage des Monats übrig.
test('Monatslimit nur mit der Schätzung des Office', () => {
  const nah = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, a + ' ≠ ' + b);
  const l = M.zusammenfassen({...DATEN, monatslimit: {limit_usd: 100, warnen_ab_prozent: 80}}).monatslimit;
  assert.equal(l.quelle, 'schaetzung');
  nah(l.ausgegeben, 2.43);
  nah(l.restTage, 3.5);
  nah(l.hochrechnung, 2.43 + 0.2 * 3.5);
  assert.equal(l.monatsEnde, '2026-11-30');
  assert.equal(l.stufe, 'ok');
});

test('Monatslimit mit Ablesung: die abgelesene Summe zählt fürs ganze Konto, danach die Schätzung', () => {
  const nah = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, a + ' ≠ ' + b);
  const mit = (limit, warnen = 80) => M.zusammenfassen({...DATEN, monatslimit: {limit_usd: limit, warnen_ab_prozent: warnen,
    ausgegeben_usd: 7.92, abgelesen_am: '2026-11-25T08:00:00Z'}}).monatslimit;
  const l = mit(100);
  assert.equal(l.quelle, 'ablesung');
  // Seit der Ablesung: 25. und 26. (je 0,20) und heute (1,03).
  nah(l.seitAblesung, 1.43);
  nah(l.ausgegeben, 7.92 + 1.43);
  // Bis zur Ablesung liefen 24⅓ Tage: 7,92 $ / 24⅓ liegt über dem Durchschnitt des Office.
  nah(l.rate, 7.92 / (24 + 8 / 24));
  nah(l.hochrechnung, 9.35 + l.rate * 3.5);
  assert.equal(l.stufe, 'ok');
  assert.equal(mit(12).stufe, 'knapp');      // Hochrechnung über 80 % von 12 $
  assert.equal(mit(11).stufe, 'nah');        // schon über 80 % von 11 $, Hochrechnung darunter
  assert.equal(mit(10).stufe, 'ueber');      // Hochrechnung über 10 $
  assert.equal(mit(9).stufe, 'erreicht');
});

test('Monatslimit mit den tatsächlichen Kosten bei OpenAI', () => {
  const nah = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, a + ' ≠ ' + b);
  const tage = Array.from({length: 26}, (_, i) => ({tag: '2026-11-' + String(i + 1).padStart(2, '0'), usd: 0.5}));
  const ist = {verfuegbar: true, usd: 13.5, stand: '2026-11-27T11:00:00Z', tage: [...tage, {tag: '2026-11-27', usd: 0.5}],
    projekte: [{id: 'a', name: 'Window', usd: 10.5}, {id: 'b', name: 'Office', usd: 3}]};
  const s = M.zusammenfassen({...DATEN, monatslimit: {limit_usd: 100, warnen_ab_prozent: 80, ausgegeben_usd: 7.92,
    abgelesen_am: '2026-11-25T08:00:00Z'}}, ist);
  const l = s.monatslimit;
  assert.equal(l.quelle, 'openai');
  nah(l.ausgegeben, 13.5);
  nah(l.rate, 0.5);
  nah(l.hochrechnung, 13.5 + 0.5 * 3.5);
  assert.equal(l.projekte.length, 2);
  const html = U.kiNutzungHtml({...DATEN, monatslimit: {limit_usd: 100, warnen_ab_prozent: 80}}, ist);
  assert.match(html, /Tatsächlich bei OpenAI seit 01\.11\., ganzes Konto/);
  assert.match(html, /Nach OpenAI-Projekt: Window 10,50/);
  assert.match(html, /Die Kosten liest die Seite selbst bei OpenAI/);
  // Ohne Schlüssel sagt die Seite, wie es genauer wird.
  const ohne = U.kiNutzungHtml({...DATEN, monatslimit: {limit_usd: 100, warnen_ab_prozent: 80}}, {verfuegbar: false, grund: 'kein_schluessel'});
  assert.match(ohne, /OPENAI_ADMIN_KEY/);
  assert.match(ohne, /Nur die Aufrufe des Office seit 01\.11\., geschätzt/);
  assert.match(U.kiNutzungHtml(DATEN), /Noch kein Monatslimit eingetragen/);
});

test('Die Seiten zeigen nie eine Person und maskieren fremden Text', () => {
  const html = U.kiNutzungHtml({...DATEN, projekte: [{id: 'p1', nummer: 'T-1', name: '<img src=x onerror=alert(1)>'}]});
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<img src=x'));
  assert.match(html, /<h1>KI-Nutzung<\/h1>/);
  assert.match(html, /Summen je Funktion und Projekt, nie je Person/);
  assert.match(html, /Monatslimit \(USD\)/);
  assert.match(html, /Diesen Monat laut OpenAI \(USD\)/);
  assert.doesNotMatch(html, /Guthaben/);
  assert.match(html, /aria-label="Geschätzte Kosten pro Tag, 30 Tage"/);
  const status = U.systemstatusHtml({stand: '2026-11-27T10:00:00Z', pruefungen: [
    {bereich: 'heartbeat', status: 'ok', zuletzt_ok: '2026-11-27T09:45:00Z', ok_24h: 96, fehler_24h: 0},
    {bereich: 'browserfehler', status: 'warnung', meldungen_24h: 25, verschiedene_24h: 1,
      haeufigste: [{nachricht: '<script>x</script>', seite: '/app/', ort: 'app.js:1:2', anzahl: 25, personen: 2}]},
    {bereich: 'zeitplaene', status: 'ok', jobs: [{name: 'office_push_v1', status: 'ok', zuletzt: '2026-11-27T09:59:00Z', fehler_24h: 0}]}
  ]}, {...DATEN, monatslimit: {limit_usd: 100, warnen_ab_prozent: 80}});
  assert.ok(status.includes('&lt;script&gt;x&lt;/script&gt;'));
  assert.match(status, /1 Bereich ansehen/);
  assert.match(status, /Mitteilungen aufs iPhone/);
  assert.match(status, /Monatslimit bei OpenAI/);
  assert.match(status, /Im Rahmen: ≈ 2,43/);
  assert.match(status, /2 Personen/);
  for (const text of [html, status]) assert.doesNotMatch(text, /user_id|E-Mail|@/);
  assert.doesNotMatch(read('office-uebersicht.js'), /Claude/);
});

test('Nur Administratoren: Menü, Seiten und die Funktionen der Datenbank', () => {
  const index = read('index.html'), app = read('app.js'), core = read('office-core.js'), shell = read('app/shell.js');
  assert.match(index, /data-view="kinutzung" data-admin-only hidden>KI-Nutzung</);
  assert.match(index, /data-view="systemstatus" data-admin-only hidden>Systemstatus</);
  assert.match(index, /<section id="kinutzungView" class="view view-wide" hidden><div id="kinutzungHost"><\/div><\/section>/);
  assert.match(index, /<script src="\.\/office-uebersicht\.js\?v=\d+"><\/script>\s*<script src="\.\/app\.js\?v=\d+">/);
  assert.match(core, /const VIEWS=\[[^\]]*'kinutzung','systemstatus'\]/);
  assert.match(app, /if\(ADMIN_VIEWS\.includes\(name\)&&member\?\.role!=='admin'\)name='work';/);
  assert.match(app, /TBA_OFFICE_UEBERSICHT\?\.kiNutzung\(\$\('#kinutzungHost'\),sb\)/);
  assert.match(shell, /<a class="drawer-link" href="\.\.\/#kinutzung" data-office-admin hidden>KI-Nutzung<\/a>/);
  assert.match(shell, /<a class="drawer-link" href="\.\.\/#systemstatus" data-office-admin hidden>Systemstatus<\/a>/);
  const sql = read('supabase/migrations/20261127102635_office_admin_uebersicht.sql');
  for (const f of ['office_ki_guthaben_eintragen', 'office_ki_nutzung', 'office_systemstatus']) {
    const rumpf = sql.slice(sql.indexOf('function public.' + f), sql.indexOf('$$;', sql.indexOf('function public.' + f)));
    assert.match(rumpf, /if not \(select private\.office_is_admin\(\)\) then\s+raise exception 'Nur für Administratoren\.' using errcode = '42501';/, f);
    assert.match(rumpf, /security definer\s+set search_path = ''/, f);
  }
  assert.match(sql, /revoke all on public\.office_ki_guthaben from public, anon, authenticated;/);
  // Monatslimit (27.11.2026): dieselben Regeln, und die KI-Nutzung reicht bis zum Monatsbeginn.
  const limit = read('supabase/migrations/20261127170000_office_ki_monatslimit.sql');
  for (const f of ['office_ki_monatslimit_eintragen', 'office_ki_nutzung']) {
    const rumpf = limit.slice(limit.indexOf('function public.' + f), limit.indexOf('$$;', limit.indexOf('function public.' + f)));
    assert.match(rumpf, /if not \(select private\.office_is_admin\(\)\) then\s+raise exception 'Nur für Administratoren\.' using errcode = '42501';/, f);
    assert.match(rumpf, /security definer\s+set search_path = ''/, f);
  }
  assert.match(limit, /alter table public\.office_ki_monatslimit enable row level security;\s+revoke all on public\.office_ki_monatslimit from public, anon, authenticated;/);
  assert.match(limit, /'monatslimit', v_monatslimit, 'monat_beginn', v_monat/);
  assert.match(limit, /grant execute on function public\.office_ki_monatslimit_eintragen\(numeric, numeric, integer\) to authenticated;/);
  assert.doesNotMatch(limit.slice(limit.indexOf('function public.office_ki_nutzung')), /u\.user_id|'user_id'/);
  // Die Nutzung gibt Romys Zeilen ohne Person aus.
  const nutzung = sql.slice(sql.indexOf('function public.office_ki_nutzung'), sql.indexOf('function public.office_systemstatus'));
  assert.doesNotMatch(nutzung, /u\.user_id|'user_id'/);
});
