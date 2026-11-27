// Der eine Eingang (Gari, 27.11.2026: «una sola bandeja para lo que necesita a una persona y una sola vista del día»).
//
// Vorher gab es drei Orte für dieselben Vorschläge: den Bildschirm «Eingang» (nur über eine Zeile in Heute erreichbar),
// «Für dich» im Panorama und die Zeile «N zu bestätigen». Der Eingang bestätigte Entscheidungen direkt in der Tabelle,
// das Panorama über die Funktion des Wissens (mit Protokoll und nur für die Projektleitung). Jetzt: bandeja.js hält nur
// die Daten und die Zahl; Heute zeigt sie oben als «Braucht Sie» mit denselben Karten und Regeln wie das Panorama; wer
// den alten Eingang öffnet, landet dort.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const bandeja=read('app/bandeja.js'),app=read('app/app.js'),ahora=read('app/ahora.js'),work=read('app/work.js'),shell=read('app/shell.js');

test('bandeja.js bedient jedes Mitglied, das die Aufrufer erwarten',()=>{
  const calls=new Set();
  for(const src of [app,ahora,work])
    for(const m of src.matchAll(/MINDS_BANDEJA\?\.([A-Za-z]+)\?\./g)) calls.add(m[1]);
  assert.ok(calls.size>=4,'zu wenige Aufrufe gefunden: '+[...calls]);
  for(const member of calls)
    assert.match(bandeja,new RegExp('^\\s*'+member+'\\s*[:(,]','m'),'bandeja.js setzt '+member+' nicht');
});

test('der Eingang liest dieselbe Quelle wie das Wissen und die Pflege, nur was die Person entscheiden darf',()=>{
  assert.match(bandeja,/from\('minds_work_memory'\)\.select\(SELECT\)\.eq\('status','proposed'\)/);
  assert.match(bandeja,/\.in\('memory_type',\['deadline','decision','commitment','open_question'\]\)/);
  // Projektleitung des Projekts oder Admin, wie im Wissen und im Panorama; die Datenbank prüft es noch einmal.
  assert.match(bandeja,/return !!p&&\(admin\|\|p\.projektleiter_id===uid\)/);
  assert.match(bandeja,/from\('office_projects'\)\.select\('id,number,name,projektleiter_id'\)/);
  assert.doesNotMatch(bandeja,/innerHTML|bandejaConfirm|paintConfirm/,'der Eingang zeichnet nichts mehr selbst');
});

test('Heute zeigt den Eingang mit denselben Karten und Regeln wie das Panorama',()=>{
  assert.match(shell,/<section id="ahoraInbox" class="ahora-section ahora-inbox hidden" aria-labelledby="ahoraInboxTitle"><\/section>/);
  assert.doesNotMatch(shell,/ahoraBandejaLink/);
  assert.match(ahora,/Braucht Sie/);
  // Entscheidungen: die Karte des Panoramas (Wissen, Protokoll, «Stimmt etwas nicht?»), mit dem Projekt.
  assert.match(ahora,/W\.fuerDich\.karte\(r,\{projekt\}\)/);
  assert.match(ahora,/window\.MINDS_WORK\?\.fuerDich\?\.binden\?\.\(box,\{eintraege:items,projektVon:r=>r\.project_id,/);
  assert.match(work,/fuerDich:\{karte:fuerDichKarte,binden:fuerDichBinden\}/);
  assert.match(work,/fuerDichBinden\(body,\{eintraege:m\.pending,projektVon:\(\)=>projectId,meldung:setStatus,nachher:renderOverview\}\);/);
  assert.match(work,/const cards=ents\.map\(r=>fuerDichKarte\(r\)\);/);
  // Wer schreibt, verliert seinen Text nicht, wenn im Hintergrund neu gezeichnet wird.
  assert.match(ahora,/if\(!force&&\(box\.querySelector\('\[data-cockpit-rueck-form\]:not\(\[hidden\]\)'\)/);
});

test('wer den alten Eingang öffnet, landet in Heute',()=>{
  assert.match(app,/if\(OFFICE&&name==='bandeja'\)\{name='feed';options=\{\.\.\.options,inbox:true\}\}/);
  assert.match(app,/window\.MINDS_AHORA\?\.render\?\.\(\{inbox:!!options\.inbox\}\)/);
  assert.match(bandeja,/show:\(\)=>window\.ISABELLA_APP\?\.show\?\.\('feed',\{inbox:true\}\)/);
});

test('der Eingang spricht deutsch',()=>{
  for(const src of [bandeja,ahora])assert.doesNotMatch(src,/Por confirmar|Sin proyecto|Leyendo lo que|Nada por confirmar/);
  assert.match(bandeja,/Was auf Sie wartet, konnte gerade nicht gelesen werden\./);
});
