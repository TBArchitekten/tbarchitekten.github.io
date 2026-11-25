// Controlling, 25.11.2026 (Gari): Honorar laut Vertrag gegen die Stunden zum Kalkulationssatz, Leistungsstand,
// Zahlungen mit Netto und MwSt, Prognose; Sätze und Gehälter nur für Admins. Hier: der Rechenkern, die Seite, die Karte
// unter Tools, der Reiter in Work und die Rechte in der Migration. Das Verhalten der Rechte prüft
// tests/sql/office-controlling-acceptance.sql im isolierten Supabase, die Seite tests/browser/office-controlling.chromium.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const K=require('../controlling-kern.js');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const MIGRATION='supabase/migrations/20261125085053_office_controlling_v1.sql';
const NAMEN=new Set(['dd428b9e787711c2','2993f8453f06da87','879d13f4257efdfd','9b7a0f2e159a5d55','bd84dc633654d437','eb203bf139e410c2','a3e187e1bef887dd','a19d126e91d01af4']);

test('Zahlen wie im Büro eingegeben: Tausenderpunkt, Komma, Euro',()=>{
  assert.equal(K.leseZahl('112.000'),112000);
  assert.equal(K.leseZahl('21.008,40 €'),21008.4);
  assert.equal(K.leseZahl('85'),85);
  assert.equal(K.leseZahl('85,5'),85.5);
  assert.equal(K.leseZahl('85.5'),85.5);
  assert.equal(K.leseZahl('732 h'),732);
  assert.equal(K.leseZahl(''),null);
  assert.equal(K.leseZahl('etwa 80'),null);
});

test('Brutto alles inklusive: 25.000 € → 21.008,40 € netto (20.008,00 € Honorar + 1.000,40 € Nebenkosten) + 3.991,60 € MwSt',()=>{
  assert.deepEqual(K.ausBrutto(25000),{netto:21008.4,mwst:3991.6});
  assert.equal(K.honorarAnteil(21008.4,5),20008);
  assert.equal(K.r2(21008.4-K.honorarAnteil(21008.4,5)),1000.4);
});

test('Kennzahlen eines laufenden Pakets: Budget, erarbeitet, offen, Ergebnis und Prognose',()=>{
  const paket={honorar_netto:100000,nebenkosten_prozent:5,kalkulationssatz:80,status:'beauftragt'};
  const staende=[{stichtag:'2026-10-01',leistungsstand:20,stunden:200,wert_kalkulation:16000,wert_gehalt:null},
    {stichtag:'2026-11-01',leistungsstand:40,stunden:550,wert_kalkulation:46500,wert_gehalt:17696.25}];
  const zahlungen=[{netto:21000,mwst:3990,status:'bezahlt'},{netto:10500,mwst:1995,status:'gestellt'}];
  const k=K.kennzahlen(paket,staende,zahlungen);
  assert.equal(k.budget,1250);
  assert.equal(k.stand,'2026-11-01','der jüngste Stand zählt');
  assert.deepEqual([k.stunden,k.wert,k.leistungsstand],[550,46500,40]);
  assert.deepEqual([k.bezahlt,k.gestellt,k.erarbeitet,k.offen,k.nichtAbgerechnet],[20000,10000,40000,20000,10000]);
  assert.equal(k.ergebnisBisher,-6500);
  assert.equal(k.jeStunde,72.73);
  assert.deepEqual([k.prognoseStunden,k.prognoseWert,k.prognoseErgebnis],[1375,116250,-16250]);
  assert.deepEqual([k.gehalt,k.ergebnisGehalt,k.prognoseGehalt],[17696.25,22303.75,55759.38]);
  assert.equal(k.nebenkosten,5000);
  assert.equal(k.zahlungen,2);
});

test('Abgeschlossen heißt 100 %; ohne Leistungsstand keine Prognose; vorläufig färbt das Paket',()=>{
  const fertig=K.kennzahlen({honorar_netto:50000,nebenkosten_prozent:5,kalkulationssatz:80,status:'abgeschlossen'},
    [{stichtag:'2026-10-01',leistungsstand:null,stunden:400,wert_kalkulation:32000,wert_gehalt:null}],[]);
  assert.deepEqual([fertig.leistungsstand,fertig.erarbeitet,fertig.ergebnisBisher,fertig.prognoseErgebnis,fertig.jeStunde],[100,50000,18000,18000,125]);
  assert.equal(fertig.zahlungen,0);
  const offen=K.kennzahlen({honorar_netto:112000,nebenkosten_prozent:5,kalkulationssatz:85,status:'beauftragt',vorlaeufig:true},
    [{stichtag:'2026-11-25',leistungsstand:null,stunden:732,wert_kalkulation:62220,wert_gehalt:null}],
    [{netto:21008.4,mwst:3991.6,status:'bezahlt',vorlaeufig:true},{netto:21008.4,mwst:3991.6,status:'bezahlt',vorlaeufig:true}]);
  assert.equal(offen.budget,1317.65);
  assert.equal(offen.bezahlt,40016);
  assert.deepEqual([offen.leistungsstand,offen.erarbeitet,offen.offen,offen.prognoseErgebnis,offen.jeStunde],[null,null,null,null,null]);
  assert.equal(offen.vorlaeufig,true);
  const leer=K.kennzahlen({honorar_netto:9000,nebenkosten_prozent:5,kalkulationssatz:85,status:'beauftragt'},[],[]);
  assert.deepEqual([leer.stand,leer.stunden,leer.budget,leer.anteilStunden],[null,0,105.88,0]);
});

test('Sätze: der jüngste ab dem Tag gültige; Stundensatz aus dem Gehalt wie die Datenbank',()=>{
  const s=[{person_id:'a',gueltig_ab:'2026-01-01',kalkulationssatz:100,monatsgehalt:4000},{person_id:'a',gueltig_ab:'2026-11-15',kalkulationssatz:120,monatsgehalt:null}];
  assert.equal(K.satzAm(s,'a','2026-11-01'),100);
  assert.equal(K.satzAm(s,'a','2026-11-20'),120);
  assert.equal(K.satzAm(s,'a','2026-11-20','monatsgehalt'),4000,'ein Eintrag ohne Gehalt lässt das alte gelten');
  assert.equal(K.satzAm(s,'b','2026-11-20'),null);
  assert.equal(K.gehaltSatz(4000,{arbeitgeberanteil_prozent:21,jahresstunden:1600}),36.3,'wie A_s1_gehalt in der Abnahme: 10 h → 363,00 €');
  assert.equal(K.gehaltSatz(0,{}),null);
});

test('Übersicht: laufende Pakete zuerst, darin die schlechteste Prognose oben',()=>{
  const e=(status,prognose,b)=>({paket:{status,bezeichnung:b},k:{prognoseErgebnis:prognose}});
  const l=[e('abgeschlossen',5000,'A'),e('beauftragt',2000,'B'),e('beauftragt',-3000,'C'),e('angeboten',null,'D'),e('beauftragt',null,'E')].sort(K.ordnung);
  assert.deepEqual(l.map(x=>x.paket.bezeichnung),['C','B','E','D','A']);
});

test('Seite: Tokens zuerst, Kern vor der Seite, Marke im Rahmen, Anmeldung wie die anderen Werkzeuge',()=>{
  const html=read('controlling.html'),js=read('controlling.js');
  assert.match(html,/<link rel="stylesheet" href="\.\/shared\/minds-design-tokens\.css\?v=2">\n<link rel="stylesheet" href="\.\/produktbibliothek\.css\?v=office5">\n<link rel="stylesheet" href="\.\/controlling\.css\?v=office3">/);
  assert.match(html,/supabase-js@2\.57\.0\/dist\/umd\/supabase\.min\.js/);
  assert.ok(html.indexOf('controlling-kern.js?v=office2')<html.indexOf('controlling.js?v=office3'));
  assert.ok(html.includes("<script>if(window.self!==window.top)document.documentElement.classList.add('im-reiter')</script>"));
  assert.match(js,/const IM_REITER=window\.self!==window\.top;/);
  assert.match(js,/if\(IM_REITER\)\{fehler\('Bitte in TBA Office neu anmelden\.'\);return\}/);
  assert.match(js,/window\.TBA_OFFICE_TOOL=Object\.freeze\(\{kind:'controlling',/);
  assert.match(read('controlling.css'),/\.im-reiter \.ct-zur-uebersicht\{display:none\}/);
  // Texte aus der Datenbank nur maskiert.
  assert.ok(!/'\+(p|z|s|x|pr)\.(bezeichnung|leistung|notiz|name|display_name)\+'/.test(js),'unmaskierter Text');
});

test('Sichtbarkeit: Personen, Sätze, Gehälter und Einstellungen fragt die Seite nur mit vollem Zugang ab; schreiben ebenso',()=>{
  const js=read('controlling.js');
  const laden=js.slice(js.indexOf('async function ladeAlles'),js.indexOf('function zeichne'));
  const vollTeil=laden.slice(laden.indexOf('if(voll){'));
  for(const t of ['office_controlling_stunden','office_controlling_saetze','office_controlling_einstellungen']){
    assert.ok(vollTeil.includes("sb.from('"+t+"')"),t);
    assert.equal(laden.indexOf("sb.from('"+t+"')"),laden.indexOf('if(voll){')+vollTeil.indexOf("sb.from('"+t+"')"),'nur mit vollem Zugang: '+t);
  }
  assert.match(js,/sb\.rpc\('office_controlling_summen',\{p_project:id\}\)/);
  // Voller Zugang: Admin oder eigener Eintrag in office_controlling_zugang; den Zugang vergeben nur Admins.
  // Seit office_controlling_nur_liste: nur die Liste, Admin allein reicht nicht; vergeben: Admin auf der Liste.
  assert.match(js,/istAdmin=m\.role==='admin';\n  voll=await hatZugang\(\);/);
  assert.match(js,/\(istAdmin&&voll\?zugangBox\(aktive\):''\)/);
  // Bearbeiten-Knöpfe nur mit vollem Zugang.
  for(const k of ['data-stand-neu','data-zahlung-neu','data-paket-bearbeiten','data-paket-neu'])
    assert.match(js,new RegExp("voll\\?[^:]*"+k),k);
});

test('Migration Zugang: Buchhaltung sieht und schreibt wie ein Admin, ohne Admin zu werden; nichts wird entfernt',()=>{
  const datei=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>/^\d{14}_office_controlling_zugang\.sql$/.test(f));
  assert.equal(datei.length,1);
  const sql=read('supabase/migrations/'+datei[0]),ohne=sql.replace(/--.*$/gm,'');
  assert.doesNotMatch(ohne,/\b(drop|truncate|delete\s+from|alter\s+table\s+\S+\s+drop)\b/i,'nichts Destruktives');
  assert.match(sql,/create table public\.office_controlling_zugang \(\n  user_id uuid primary key references public\.office_members\(user_id\) on delete cascade,/);
  assert.match(sql,/for insert to authenticated with check \(\(select private\.office_is_admin\(\)\) and created_by = \(select auth\.uid\(\)\)\);/);
  assert.match(sql,/or exists \(select 1 from public\.office_controlling_zugang z\n                 join public\.office_members m on m\.user_id = z\.user_id\n                 where z\.user_id = \(select auth\.uid\(\)\) and m\.is_active\)/);
  assert.match(sql,/\(select private\.office_controlling_voll\(\)\) as admin/);
  for(const t of ['stunden','saetze'])assert.match(sql,new RegExp('create policy office_controlling_'+t+'_voll_lesen on public\\.office_controlling_'+t));
  for(const t of ['pakete','staende','zahlungen','stunden','saetze'])for(const a of ['anlegen','aendern','entfernen'])
    assert.match(sql,new RegExp('create policy office_controlling_'+t+'_voll_'+a+' '),t+' '+a);
  const abnahme=read('tests/sql/office-controlling-acceptance.sql');
  assert.match(abnahme,/D_pakete=1; D_stunden=4; D_saetze=2; D_einstellungen=1; D_s1_gehalt=363\.00; D_zugang_eigen=1; D_zahlung_anlegen=ok; /);
  assert.match(abnahme,/D_zugang_vergeben=verweigert; C_zugang=0; C_pakete_danach=0; /);
});

test('Migration: neue Tabellen mit RLS, Lesen über das Projekt, Personen und Sätze nur Admins, Summen ohne Personen',()=>{
  const sql=read(MIGRATION);
  const ohne=sql.replace(/--.*$/gm,'');
  assert.doesNotMatch(ohne,/\b(drop|truncate|delete\s+from|alter\s+table\s+\S+\s+drop)\b/i,'nichts Destruktives');
  for(const t of ['pakete','staende','stunden','zahlungen','saetze','einstellungen'])
    assert.match(sql,new RegExp('alter table public\\.office_controlling_'+t+' enable row level security;'),t);
  assert.match(sql,/create policy office_controlling_stunden_lesen on public\.office_controlling_stunden\n  for select to authenticated using \(\(select private\.office_is_admin\(\)\)\);/);
  assert.match(sql,/create policy office_controlling_saetze_lesen on public\.office_controlling_saetze\n  for select to authenticated using \(\(select private\.office_is_admin\(\)\)\);/);
  assert.match(sql,/create policy office_controlling_pakete_lesen on public\.office_controlling_pakete\n  for select to authenticated using \(\(select private\.office_controlling_lesen\(project_id\)\)\);/);
  assert.match(sql,/language sql stable security definer set search_path = '' as \$\$\n  with zugang as/);
  assert.match(sql,/case when \(select admin from zugang\) and l\.gehalt_vollstaendig then round\(coalesce\(l\.wert_g, 0\), 2\) end/);
  assert.match(sql,/revoke all on function public\.office_controlling_summen\(uuid\) from public, anon;/);
  // Der Schutz-Trigger fragt Felder nur im Zweig ihrer Tabelle ab (PL/pgSQL plant jeden Ausdruck für sich).
  assert.match(sql,/if tg_table_name = 'office_controlling_pakete' then\n    if new\.project_id is distinct from old\.project_id then/);
  const abnahme=read('tests/sql/office-controlling-acceptance.sql');
  assert.match(abnahme,/B_stunden=0; B_saetze=0; B_einstellungen=0;/);
  assert.match(read('.github/workflows/verify.yml'),/tests\/sql\/office-controlling-acceptance\.sql/);
});

test('Tools und Work: Karte «Controlling», Reiter je Projekt nach der Kostenberechnung',()=>{
  const shell=read('app/shell.js'),work=read('app/work.js'),projekte=read('app/office-projects.js');
  assert.match(shell,/id="officeToolsControlling" aria-label="Controlling öffnen"/);
  assert.match(shell,/NAV_ICONS\.controlling='<svg /);
  assert.match(projekte,/getElementById\('officeToolsControlling'\)\?\.addEventListener\('click',\(\)=>\{\n  window\.location\.href='\.\.\/controlling\.html';/);
  assert.match(work,/controlling:\{page:'\.\.\/controlling\.html',name:'Controlling',single:true,\n  src:pid=>'\.\.\/controlling\.html\?projekt='\+encodeURIComponent\(pid\)\},/);
});

test('Keine Namen aus Projekten und Team, keine spanischen Wörter',()=>{
  for(const f of ['controlling.html','controlling.js','controlling-kern.js','controlling.css',MIGRATION,'tests/sql/office-controlling-acceptance.sql',
    'tests/browser/fixtures/fake-supabase-controlling.js','tests/browser/office-controlling.chromium.mjs',
    ...readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>/_office_(controlling_zugang|controlling_nur_liste|project_abschnitte)\.sql$/.test(f)).map(f=>'supabase/migrations/'+f)]){
    const s=read(f);
    // Namen von Projekten, Bauherren und Kolleginnen nur als Prüfsumme (sha256, 16 Zeichen), damit sie selbst nicht im
    // öffentlichen Repo stehen.
    for(const w of new Set(s.toLowerCase().match(/[a-zäöüß]+/g)||[]))
      assert.ok(!NAMEN.has(createHash('sha256').update(w).digest('hex').slice(0,16)),f+' enthält einen Namen aus dem Büro');
    assert.ok(!/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(s.replace(/@supabase\/supabase-js@2\.57\.0/g,'').replace(/[\w.+-]+@[\w-]+\.invalid\b/g,'')),f+' enthält eine E-Mail-Adresse');
    assert.ok(!/\b(para|que|como|desde|proyecto|pagos|horas|sueldo|también|cálculo)\b/i.test(s),'spanische Wörter in '+f);
  }
});

test('Rechnung wie die des Büros: Abschlag zzgl. Nebenkosten = Netto, zzgl. MwSt = Brutto, aus jedem Eingang auf den Cent',()=>{
  const r={abschlag:18388.36,nebenkosten:919.42,netto:19307.78,mwst:3668.48,brutto:22976.26};
  assert.deepEqual(K.rechnung({abschlag:18388.36},5),r);
  assert.deepEqual(K.rechnung({netto:19307.78},5),r);
  assert.deepEqual(K.rechnung({brutto:22976.26},5),r);
  assert.deepEqual(K.rechnung({brutto:25000},5),{abschlag:20008,nebenkosten:1000.4,netto:21008.4,mwst:3991.6,brutto:25000});
  assert.equal(K.rechnung({},5),null);
  assert.equal(K.r2(1.005),1.01,'kaufmännisch gerundet');
  // Vom Netto zurück zum Abschlag trifft den Cent, solange die Nebenkosten aus dem Abschlag gerundet sind.
  for(let c=1;c<300000;c+=37){const a=c/100;assert.equal(K.honorarAnteil(K.rechnung({abschlag:a},5).netto,5),a,String(a))}
  // Bezahlt: je Zahlung ihr Abschlag, dann die Summe (wie die Tabelle).
  const k=K.kennzahlen({honorar_netto:90365.63,nebenkosten_prozent:5,kalkulationssatz:85,status:'beauftragt'},[],
    [{netto:19307.78,mwst:3668.48,status:'bezahlt'},{netto:19307.78,mwst:3668.48,status:'bezahlt'}]);
  assert.equal(k.bezahlt,36776.72);
});

test('Zahlungen: Spalten in der Reihenfolge der Rechnung, die MwSt folgt dem Netto (Gari und die Buchhaltung, 25.11.2026)',()=>{
  const js=read('controlling.js');
  const kopf=js.slice(js.indexOf('function zahlungenTabelle'),js.indexOf('const body=',js.indexOf('function zahlungenTabelle')));
  const reihe=['Abschlag (AZ)','Nebenkosten</th>','>Netto<','>MwSt<','>Brutto<'].map(t=>kopf.indexOf(t));
  assert.ok(reihe.every(i=>i>0)&&reihe.every((i,n)=>!n||i>reihe[n-1]),'Abschlag, Nebenkosten, Netto, MwSt, Brutto: '+reihe);
  assert.match(js,/for\(const f of \['abschlag','netto','brutto'\]\)form\[f\]\.addEventListener\('input',\(\)=>\{\n    const w=K\.leseZahl\(form\[f\]\.value\);setze\(w==null\?null:K\.rechnung\(\{\[f\]:w\},nk\),f\);/);
  // So wird gerechnet: im Projektblatt und in der Übersicht.
  assert.equal((js.match(/data-rechenweg aria-haspopup="dialog"/g)||[]).length,2);
  assert.match(js,/addEventListener\('click',\(\)=>rechenweg\(p\)\)/);
  assert.match(js,/addEventListener\('click',\(\)=>rechenweg\(null\)\)/);
  assert.match(js,/Alle Beträge in Euro netto, ohne MwSt; das Honorar ohne Nebenkosten\./);
});

test('Migration nur Liste: Sätze, Gehälter, Stunden je Person und Annahmen nur mit Eintrag, auch für Admins; nichts entfernt',()=>{
  const datei=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>/^\d{14}_office_controlling_nur_liste\.sql$/.test(f));
  assert.equal(datei.length,1);
  const sql=read('supabase/migrations/'+datei[0]),ohne=sql.replace(/--.*$/gm,'');
  assert.doesNotMatch(ohne,/\b(drop|truncate|delete\s+from|alter\s+table\s+\S+\s+drop)\b/i,'nichts Destruktives');
  // Heutige Admins behalten ihren Zugang: sie kommen auf die Liste, bevor die Liste allein zählt.
  assert.ok(sql.indexOf("where m.role = 'admin' and m.is_active")<sql.indexOf('create or replace function private.office_controlling_voll()'));
  assert.match(sql,/create or replace function private\.office_controlling_voll\(\) returns boolean\nlanguage sql stable security definer set search_path = '' as \$\$\n  select exists \(select 1 from public\.office_controlling_zugang z/);
  assert.doesNotMatch(sql.slice(sql.indexOf('create or replace function private.office_controlling_voll()')),/office_is_admin/,'Admin allein reicht nicht');
  for(const t of ['saetze','stunden','einstellungen'])
    assert.match(sql,new RegExp('create policy office_controlling_'+t+'_nur_liste on public\\.office_controlling_'+t+'\\n  as restrictive for all to authenticated'),t);
  assert.match(sql,/office_controlling_zugang_nur_liste_vergeben on public\.office_controlling_zugang\n  as restrictive for insert/);
  const abnahme=read('tests/sql/office-controlling-acceptance.sql');
  assert.match(abnahme,/A2_stunden=0; A2_saetze=0; A2_einstellungen=0; A2_s1_gehalt=null; A2_aendert_ohne_liste=0; A2_selbst=verweigert; A_nimmt_A2_auf=ok; /);
});
