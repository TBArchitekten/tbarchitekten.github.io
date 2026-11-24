// Herstellerkatalog und Import von Unterlagen (24.11.2026). Statische Prüfungen ohne Netz; das Verhalten prüfen
// tests/browser/office-herstellerkatalog.chromium.mjs und tests/sql/office-herstellerkatalog-acceptance.sql.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARTEN,MAX_BYTES,inhaltPasst,pfadFuer,pruefeAnfrage,schluesselForm,sha256Hex} from '../supabase/functions/office-produkt-import/core.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const mig=read('supabase/migrations/20261124180000_office_herstellerkatalog_v1.sql');
const fn=read('supabase/functions/office-produkt-import/index.ts');
const seite=read('herstellerkatalog.html');
const ui=read('herstellerkatalog.js');
const pb=read('produktbibliothek.js');
const shell=read('app/shell.js');
const projekte=read('app/office-projects.js');
const ohneKommentare=s=>s.replace(/--[^\n]*/g,'');

test('Migration: Katalog des Office mit RLS über die Office-Helfer, nichts Destruktives',()=>{
  for(const t of ['office_hersteller','office_hersteller_kontakte','office_import_tokens']){
    assert.match(mig,new RegExp('create table public\\.'+t+' \\('));
    assert.match(mig,new RegExp('alter table public\\.'+t+' enable row level security;'));
  }
  assert.match(mig,/alter table public\.office_produkte add column hersteller_id uuid references public\.office_hersteller\(id\) on delete set null;/);
  assert.match(mig,/create unique index office_hersteller_firma_key on public\.office_hersteller \(lower\(btrim\(firma\)\)\) where not archiviert;/);
  assert.match(mig,/kategorien <@ array\['bodenbelag','wandbelag','decke','fassade','fenster_tueren','sanitaer','licht','beschlaege','sonstiges'\]/);
  assert.match(mig,/art in \('recherche','anfrage','unterlagen','muster','angebot','beratung','auftrag'\)/);
  // Policies nur mit den Office-Helfern; Firmen werden nicht gelöscht, Kontakte nur vom Urheber oder Admin.
  const policies=[...mig.matchAll(/create policy (\w+) on public\.(\w+)\s+for (\w+)/g)].map(m=>[m[1],m[2],m[3]]);
  assert.deepEqual(policies.filter(p=>p[1]==='office_hersteller').map(p=>p[2]),['select','insert','update']);
  assert.deepEqual(policies.filter(p=>p[1]==='office_hersteller_kontakte').map(p=>p[2]),['select','insert','update','delete']);
  assert.equal(policies.filter(p=>p[1]==='office_import_tokens').length,0,'die Schlüssel liest nur der Server');
  assert.match(mig,/revoke all on public\.office_hersteller, public\.office_hersteller_kontakte, public\.office_import_tokens\s+from public, anon, authenticated;/);
  assert.doesNotMatch(mig,/grant [^;]*office_import_tokens/);
  assert.match(mig,/created_by = \(select auth\.uid\(\)\) or \(select private\.office_is_admin\(\)\)/);
  assert.equal((mig.match(/\(select private\.office_is_member\(\)\)/g)||[]).length>=8,true);
  const sql=ohneKommentare(mig);
  assert.doesNotMatch(sql,/\b(drop|delete from|truncate)\b/i,'keine destruktive Anweisung');
  assert.match(mig,/token_sha256 text not null unique check \(token_sha256 ~ '\^\[0-9a-f\]\{64\}\$'\)/);
});

test('Import: einmaliger Schlüssel (nur Hash mit Ablauf), strenge Prüfung von Art, Typ und Inhalt',async()=>{
  // Funktion: ohne gültigen Schlüssel 401, nichts weiter; Pfad wie im Browser; bei Fehler Datei wieder weg.
  assert.match(fn,/req\.headers\.get\("x-import-token"\)/);
  assert.match(fn,/if\(!schluesselForm\(token\)\)return respond\(401,\{error:"import_closed"\}\);/);
  assert.match(fn,/from\("office_import_tokens"\)\.select\("id"\)\s*\.eq\("token_sha256",hash\)\.gt\("gueltig_bis",new Date\(\)\.toISOString\(\)\)/);
  assert.match(fn,/await admin\.storage\.from\(BUCKET\)\.remove\(\[pfad\]\);/);
  assert.doesNotMatch(fn,/console\.(log|info|warn|error)/,'nie Inhalte oder Schlüssel ins Protokoll');
  assert.match(read('supabase/config.toml'),/\[functions\.office-produkt-import\]\nverify_jwt = false\nentrypoint = "\.\/functions\/office-produkt-import\/index\.ts"/);
  // Schlüssel: Form und Hash.
  assert.equal(schluesselForm('kurz'),false);
  assert.equal(schluesselForm('a'.repeat(43)),true);
  assert.equal(schluesselForm('a'.repeat(42)+'!'),false);
  assert.equal(await sha256Hex('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  // Anfrage.
  const P='11111111-1111-4111-8111-111111111111';
  const q=o=>new URLSearchParams(o);
  assert.deepEqual(pruefeAnfrage(q({produkt:P,art:'datenblatt',name:'Datenblatt.pdf',seiten:'4'}),'application/pdf','1000'),
    {produkt:P,art:'datenblatt',name:'Datenblatt.pdf',seiten:4,mime:'application/pdf',endung:'pdf'});
  assert.equal(pruefeAnfrage(q({produkt:'x',art:'datenblatt',name:'a'}),'application/pdf','1').fehler,'invalid_product');
  assert.equal(pruefeAnfrage(q({produkt:P,art:'angebot',name:'a'}),'application/pdf','1').fehler,'invalid_kind','nur Arten, die die Tabelle kennt');
  assert.equal(pruefeAnfrage(q({produkt:P,art:'bild',name:'a'}),'application/pdf','1').fehler,'invalid_type');
  assert.equal(pruefeAnfrage(q({produkt:P,art:'sonstiges',name:'a'}),'text/html','1').fehler,'invalid_type');
  assert.equal(pruefeAnfrage(q({produkt:P,art:'sonstiges',name:'a',seiten:'0'}),'application/pdf','1').fehler,'invalid_pages');
  assert.equal(pruefeAnfrage(q({produkt:P,art:'sonstiges',name:'a'}),'application/pdf',String(MAX_BYTES+1)).fehler,'request_too_large');
  assert.equal(pruefeAnfrage(q({produkt:P,art:'sonstiges',name:''}),'application/pdf','1').fehler,'invalid_name');
  assert.deepEqual([...ARTEN].sort(),['bild','datenblatt','epd','leistungserklaerung','pflegeanleitung','preisliste','sonstiges','verlegeanleitung','zertifikat']);
  // Inhalt passt zur Art.
  const pdf=new TextEncoder().encode('%PDF-1.7\n');
  assert.equal(inhaltPasst(pdf,'application/pdf'),true);
  assert.equal(inhaltPasst(pdf,'image/png'),false);
  assert.equal(inhaltPasst(new Uint8Array([0xff,0xd8,0xff,0xe0]),'image/jpeg'),true);
  assert.equal(inhaltPasst(new Uint8Array([]),'application/pdf'),false);
  assert.equal(pfadFuer(P,P,'pdf','22222222-2222-4222-8222-222222222222'),P+'/'+P+'/22222222-2222-4222-8222-222222222222.pdf');
  assert.throws(()=>pfadFuer('x',P,'pdf'));
});

test('Seite: eigene Seite im Werkzeugkasten, gleicher Client und dieselbe Gestalt wie die Produktbibliothek',()=>{
  assert.match(seite,/<html lang="de">/);
  assert.match(seite,/<title>TBA Office · Herstellerkatalog<\/title>/);
  assert.match(seite,/<link rel="stylesheet" href="\.\/shared\/minds-design-tokens\.css\?v=2">\n<link rel="stylesheet" href="\.\/produktbibliothek\.css\?v=office4">\n<link rel="stylesheet" href="\.\/herstellerkatalog\.css\?v=office1">/);
  assert.match(seite,/<script src="\.\/shared\/supabase-client\.js\?v=office4"><\/script>/);
  assert.match(seite,/<script src="\.\/herstellerkatalog\.js\?v=office1"><\/script>/);
  assert.match(seite,/<meta name="robots" content="noindex">/);
  assert.match(shell,/id="officeToolsHersteller" aria-label="Herstellerkatalog öffnen"/);
  assert.match(shell,/NAV_ICONS\.hersteller='<svg /);
  assert.match(projekte,/getElementById\('officeToolsHersteller'\)\?\.addEventListener\('click',\(\)=>\{\s*window\.location\.href='\.\.\/herstellerkatalog\.html';/);
  // Daten: nur die Tabellen des Katalogs und der Bibliothek, Firma nie gelöscht (archivieren).
  for(const t of ['office_hersteller','office_hersteller_kontakte','office_produkte','office_projects','office_members'])assert.match(ui,new RegExp("from\\('"+t+"'\\)"));
  assert.doesNotMatch(ui,/from\('office_hersteller'\)\.delete/);
  assert.match(ui,/update\(\{archiviert:!f\.archiviert\}\)/);
  // Oberfläche auf Deutsch.
  for(const s of ['Firma anlegen','Kontakt eintragen','Kontakt in Projekten','In der Produktbibliothek','Wer im Büro','anderes Projekt …',
    'Diese Firma steht schon im Katalog.','Noch keine Kontaktdaten.'])assert.ok(ui.includes(s),s);
});

test('Produktbibliothek: Karte und Produktblatt zeigen den Kontakt; Firma beim Anlegen verknüpft',()=>{
  assert.match(pb,/sb\.from\('office_hersteller'\)\.select\('id,firma,adresse,telefon,email,website,ansprechpartner,archiviert'\)/);
  assert.match(pb,/daten\.hersteller=herst\.error\?\[\]:\(herst\.data\|\|\[\]\);/,'ohne Katalog bleibt die Bibliothek wie bisher');
  assert.match(pb,/\$\{kontaktKurz\(e\)\}/);
  assert.match(pb,/\$\{herstellerBox\(e\)\}/);
  assert.equal((pb.match(/hersteller_id:herstellerIdFuer\(f\.get\('hersteller'\)\)/g)||[]).length,2,'Leser und Formular');
  assert.match(pb,/if\(ui\.hersteller\)liste=liste\.filter\(e=>e\.hersteller_id===ui\.hersteller\);/);
  assert.match(read('produktbibliothek.html'),/produktbibliothek\.js\?v=office6/);
});
