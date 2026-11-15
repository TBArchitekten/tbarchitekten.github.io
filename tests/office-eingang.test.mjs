// Der Eingang ist keine Sackgasse mehr (15.11.2026, Gari: «corrígelo y porta la Bandeja»).
//
// app.js, ahora.js und work.js rufen window.MINDS_BANDEJA. Die Datei, die das setzt, fehlte im
// Office: bandeja.js wurde beim Port aus Window ausgelassen. Folge: der Bildschirm blieb auf
// «Lese, was auf Bestätigung wartet …» stehen, und die Zeile «N zu bestätigen» in Heute erschien
// nie, weil lastCount() undefined war statt einer Zahl.
//
// Geprüft wird, dass die Datei genau die Schnittstelle bedient, die die drei Aufrufer erwarten,
// dass sie deutsch ist, und dass die beiden Ansichten, die das Office nicht hat, nicht mitkamen.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const bandeja=read('app/bandeja.js'),app=read('app/app.js'),ahora=read('app/ahora.js'),work=read('app/work.js');

test('bandeja.js bedient jedes Mitglied, das die Aufrufer erwarten',()=>{
  // Was die drei Dateien tatsächlich aufrufen — nicht was Window exportiert.
  const calls=new Set();
  for(const src of [app,ahora,work])
    for(const m of src.matchAll(/MINDS_BANDEJA\?\.([A-Za-z]+)\?\./g)) calls.add(m[1]);
  assert.ok(calls.size>=4,'zu wenige Aufrufe gefunden: '+[...calls]);
  // Als Eigenschaft (show:), als Methode (show()) oder als Kurzform (refreshCount,).
  for(const member of calls)
    assert.match(bandeja,new RegExp('^\\s*'+member+'\\s*[:(,]','m'),'bandeja.js setzt '+member+' nicht');
});

test('die Zahl in Heute bekommt eine Zahl, kein undefined',()=>{
  assert.match(ahora,/const n=Number\(window\.MINDS_BANDEJA\?\.lastCount\?\.\(\)\);/);
  assert.match(bandeja,/lastCount:\(\)=>count,/);
  assert.match(bandeja,/let entries=null,loadError='',loading=null,count=null,/);
});

test('der Eingang spricht deutsch',()=>{
  for(const line of ['Lese, was auf Bestätigung wartet …','Nichts zu bestätigen.','Ohne Projekt',
    'Zum Aktualisieren nach unten ziehen.','Zu bestätigen · '])
    assert.ok(bandeja.includes(line),'fehlt: '+line);
  assert.ok(!/Por confirmar|Sin proyecto|Leyendo lo que|Nada por confirmar/.test(bandeja),'noch spanische Zeilen');
});

test('Vorschläge und Ideen kamen nicht mit',()=>{
  // isabella-feed und isabella-ideas gibt es im Office nicht; die Tabs sind in shell.js verborgen.
  for(const gone of ['renderSuggestions','renderIdeas','shown.suggest','shown.ideas'])
    assert.ok(!bandeja.includes(gone),'aus Window mitgekommen: '+gone);
  const shell=read('app/shell.js');
  assert.match(shell,/data-bandeja-view="suggest" hidden>/);
  assert.match(shell,/data-bandeja-view="ideas" hidden>/);
});

test('der Eingang liest dieselbe Quelle wie die Akte-Pflege schreibt',()=>{
  assert.match(bandeja,/from\('minds_work_memory'\)\.select\(SELECT\)\.eq\('status','proposed'\)/);
  assert.match(bandeja,/\.in\('memory_type',\['deadline','decision','commitment','open_question'\]\)/);
  // Die Karten und die Ein-Tipp-Entscheidungen gehören work.js, nicht dieser Datei.
  assert.match(bandeja,/function akte\(\)\{return window\.MINDS_WORK\?\.akte\|\|null\}/);
  assert.match(work,/window\.MINDS_WORK=\{akte:\{card:akteCard,toConfirm:akteToConfirm,decide:saveAkteDecision,toTask:saveAkteTask\}/);
});
