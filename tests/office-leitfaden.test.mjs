// Leitfaden «Was darf auf den Desktop?» mit Bestätigung «Gelesen» (Gari, 25.11.2026): wer das Office öffnet, liest
// den freigeschalteten Leitfaden einmal und bestätigt; die Admins schalten ihn in «Mitglieder» frei und sehen, wer
// bestätigt hat; im Desktop steht er zum Nachlesen. Statische Prüfungen; das Verhalten prüft
// tests/browser/office-leitfaden.chromium.mjs, die Rechte tests/sql/office-leitfaden-acceptance.sql.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migration=readdirSync(new URL('../supabase/migrations/',import.meta.url)).find(f=>/_office_leitfaden\.sql$/.test(f));
const sql=read('supabase/migrations/'+migration);
const modul=read('app/office-leitfaden.js');
const appIndex=read('app/index.html');
const work=read('app/work.js');
const css=read('app/office.css');
const root=read('index.html');
const rootJs=read('app.js');

test('Migration: zwei neue Tabellen mit RLS, nichts Destruktives, der Leitfaden beginnt ausgeschaltet',()=>{
  assert.match(migration,/^\d{14}_office_leitfaden\.sql$/);
  for(const t of ['office_leitfaeden','office_leitfaden_bestaetigungen']){
    assert.match(sql,new RegExp('create table public\\.'+t+' \\('));
    assert.match(sql,new RegExp('alter table public\\.'+t+' enable row level security;'));
    assert.match(sql,new RegExp('revoke all on public\\.'+t+' from public, anon, authenticated;'));
  }
  assert.doesNotMatch(sql.replace(/^--.*$/gm,''),/\b(drop|truncate|delete from|alter table [^;]* drop)\b/i,'nichts Destruktives');
  assert.match(sql,/insert into public\.office_leitfaeden \(leitfaden, version, aktiv\) values \('desktop', '2026-11-25', false\);/);
});

test('Migration 26.11.2026: neuer Stand «Was darf ins TBA Office?», nur die Version, nichts gelöscht',()=>{
  const datei=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>/^\d{14}_office_leitfaden_ins_office\.sql$/.test(f));
  assert.equal(datei.length,1);
  const neu=read('supabase/migrations/'+datei[0]);
  assert.match(neu,/^update public\.office_leitfaeden set version = '2026-11-26' where leitfaden = 'desktop' and version = '2026-11-25';$/m);
  assert.doesNotMatch(neu.replace(/^--.*$/gm,''),/\b(drop|truncate|delete|insert|create|alter|grant|revoke)\b/i);
});

test('Migration: freischalten nur Admins und nur «aktiv»; bestätigen nur für sich, nur den geltenden Stand, ohne eigene Zeit',()=>{
  assert.match(sql,/grant update \(aktiv\) on public\.office_leitfaeden to authenticated;/);
  assert.match(sql,/office_leitfaeden_lesen on public\.office_leitfaeden\s+for select to authenticated using \(\(select private\.office_is_member\(\)\)\);/);
  assert.match(sql,/office_leitfaeden_freischalten on public\.office_leitfaeden\s+for update to authenticated using \(\(select private\.office_is_admin\(\)\)\) with check \(\(select private\.office_is_admin\(\)\)\);/);
  assert.match(sql,/new\.geaendert_von := \(select auth\.uid\(\)\);/,'wer geändert hat, setzt die Datenbank');
  assert.match(sql,/grant insert \(user_id, leitfaden, version\) on public\.office_leitfaden_bestaetigungen to authenticated;/,'die Zeit setzt die Datenbank');
  assert.doesNotMatch(sql,/grant (update|delete)[^;]*office_leitfaden_bestaetigungen/,'der Beleg bleibt');
  assert.match(sql,/user_id = \(select auth\.uid\(\)\) or \(select private\.office_is_admin\(\)\)/,'lesen: die Person selbst und Admins');
  // Spalten im Unterabfrage-Vergleich ausdrücklich an die Tabelle gebunden (sonst vergleicht l mit sich selbst).
  assert.match(sql,/l\.leitfaden = office_leitfaden_bestaetigungen\.leitfaden/);
  assert.match(sql,/l\.version = office_leitfaden_bestaetigungen\.version/);
  assert.match(sql,/and l\.aktiv\)\);/);
});

test('Die Abnahme der Rechte läuft im isolierten Supabase',()=>{
  const wf=read('.github/workflows/verify.yml');
  assert.match(wf,/'tests\/sql\/office-leitfaden-\*\.sql'/);
  assert.match(wf,/< tests\/sql\/office-leitfaden-acceptance\.sql/);
  const abnahme=read('tests/sql/office-leitfaden-acceptance.sql');
  assert.match(abnahme,/^begin;$/m);assert.match(abnahme,/^rollback;$/m);
  assert.match(abnahme,/example\.invalid/);
});

test('Text: Stand der Migration, Grün, Gelb, Rot, keine Namen von Personen, KI statt Romy',()=>{
  assert.match(modul,/'2026-11-26':\{/);
  assert.match(modul,/titel:'Was darf ins TBA Office\?'/);
  // Seit 26.11.2026 für alles, was ins Office kommt (Gari), nicht nur den Desktop.
  assert.doesNotMatch(modul.slice(modul.indexOf('const TEXTE='),modul.indexOf('const zustand=')),/Desktop/);
  for(const h of ['Kurz gesagt','Grün: hochladen','Gelb: nur das Nötige, vorher prüfen','Rot: nicht hochladen','Gut zu wissen','Im Zweifel'])
    assert.ok(modul.includes(`h:'${h}'`),h);
  assert.match(modul,/Die Konten bei OpenAI und Supabase laufen auf das Büro\./);
  assert.match(modul,/Diese Seite ist eine Arbeitshilfe, keine Rechtsberatung\./);
  // Das Repository ist öffentlich: keine Namen (die Fassung für die Büroleitung nennt die Person, die die Konten führt).
  assert.doesNotMatch(modul.replace(/^\s*\/\/.*$/gm,''),/Mart[ií]nez|\bEdgar\b|\bGari\b|\bTitus\b|\bRomy\b|Isabella/);
  assert.doesNotMatch(modul,/Titus|Mart[ií]nez|\bEdgar\b/,'auch nicht in den Kommentaren');
});

test('Ablauf: nach der Mitgliedsprüfung, einmal je Stand, Bestätigung nur mit Person, Leitfaden und Stand',()=>{
  assert.match(appIndex,/<script src="\.\/office-leitfaden\.js\?v=office2"><\/script>\n<script src="\.\/sync\.js\?v=office8"><\/script>/,'vor sync.js geladen');
  assert.match(modul,/window\.addEventListener\('office:member',e=>void pruefen\(e\.detail\)\);/);
  assert.match(modul,/from\('office_leitfaeden'\)\.select\('version,aktiv'\)\.eq\('leitfaden',LEITFADEN\)\.maybeSingle\(\)/);
  assert.match(modul,/zustand\.aktiv=l\.aktiv===true&&!!TEXTE\[l\.version\];/,'unbekannter Stand: nichts zeigen');
  assert.match(modul,/\.insert\(\{user_id:zustand\.userId,leitfaden:LEITFADEN,version:zustand\.version\}\)/);
  assert.doesNotMatch(modul,/bestaetigt_am:/,'die Zeit setzt die Datenbank');
  assert.match(modul,/error\.code!=='23505'/,'schon bestätigt gilt');
  assert.match(modul,/d\.addEventListener\('cancel',e=>\{if\(pflicht\)e\.preventDefault\(\)\}\);/,'Escape schließt die Pflicht nicht');
  assert.match(modul,/data-leitfaden-weiter disabled>Weiter/);
});

test('Desktop: Link «Was darf ins TBA Office?», nur wenn freigeschaltet; Versionen',()=>{
  assert.match(work,/window\.TBA_OFFICE_LEITFADEN\?\.verfuegbar\?\.\(\)\?'<p class="work-desktop-leitfaden"><button type="button" data-work-leitfaden>Was darf ins TBA Office\?<\/button><\/p>':''/);
  assert.match(work,/\$\('\[data-work-leitfaden\]'\)\?\.addEventListener\('click',\(\)=>window\.TBA_OFFICE_LEITFADEN\?\.oeffnen\(\)\);/);
  assert.match(appIndex,/work\.js\?v=office69/);
  assert.match(appIndex,/office\.css\?v=office49/);
});

test('Gestaltung: nur Tokens, Grün, Gelb und Rot mit Wort, am Telefon über die ganze Fläche',()=>{
  const block=css.slice(css.indexOf('/* Leitfaden «Was darf auf den Desktop?»'));
  assert.ok(block.length>200);
  assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g,''),/#[0-9a-f]{3,8}\b|rgba?\(/i,'keine Farbe von Hand');
  assert.match(block,/\.is-gruen \.office-leitfaden-ton\{background:var\(--m-success\)\}/);
  assert.match(block,/\.is-gelb \.office-leitfaden-ton\{background:var\(--m-attention\)\}/);
  assert.match(block,/\.is-rot \.office-leitfaden-ton\{background:var\(--m-error\)\}/);
  assert.match(block,/@media\(max-width:640px\)\{\n \.office-leitfaden\{width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border:0;border-radius:0\}/);
});

test('Mitglieder: freischalten, ausschalten und wer wann bestätigt hat',()=>{
  // Seit dem 27.11.2026 ist «Mitglieder» eine Seite der App (office-verwaltung.js), nicht mehr der Startseite.
  const verwaltung=read('app/office-verwaltung.js');
  assert.match(verwaltung,/<section class="section" data-leitfaden hidden>/);
  assert.match(verwaltung,/<button type="button" data-leitfaden-knopf><\/button>/);
  assert.match(appIndex,/\.\/office-verwaltung\.js\?v=\d+/);
  assert.match(verwaltung,/from\('office_leitfaeden'\)\.update\(\{aktiv:!l\.aktiv\}\)\.eq\('leitfaden','desktop'\)\.select\('aktiv'\)/,'nur «aktiv»');
  assert.match(verwaltung,/'Leitfaden gelesen am '\+esc\(tagDe\(lf\.gelesen\.get\(m\.user_id\)\)\)/);
  assert.match(verwaltung,/'Leitfaden noch nicht bestätigt'/);
  assert.match(verwaltung,/const \[\{members:alle\},lf\]=await Promise\.all\(\[admin\('list'\),leitfaden\(\)\]\);/);
  assert.doesNotMatch(rootJs,/office_leitfaeden/);
  assert.doesNotMatch(root,/leitfadenSection/);
});
