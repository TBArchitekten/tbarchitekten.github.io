// Projektstart · was ein Projekt braucht, und vier Muster (20.11.2026, Gari).
//
// Gari: «no preparar un documento, o a Romy, para que diga lo que necesita de información para
// avanzar». Nächste Woche teilt er Bernried mit zwei Kolleginnen und füllt es; bis dahin sagt
// niemand, welche Information sich zuerst lohnt. Dieses Blatt sagt es, und bringt die vier Muster
// der LPH-3-Vorgänge mit, die sich ohne Projektunterlagen vorbereiten lassen.
//
// Geprüft wird, dass das Blatt erreichbar ist, dass es Muster bleibt statt Bernried-Dokument, und
// dass die drei Stufen und die vier Muster vollständig sind.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const seite=read('projektstart.html'),shell=read('app/shell.js'),projekte=read('app/office-projects.js');

test('die Werkzeuge führen zum Projektstart',()=>{
  assert.match(shell,/id="officeToolsStart" aria-label="Projektstart öffnen"/);
  assert.match(shell,/<strong>Projektstart<\/strong>/);
  assert.match(projekte,/getElementById\('officeToolsStart'\)\?\.addEventListener\('click',\(\)=>\{\s*window\.location\.href='\.\.\/projektstart\.html';/);
  // und zurück: das Blatt liegt neben terminplan-hilfe.html, nicht in der App.
  assert.match(seite,/href="\.\/app\/#section=tools"/);
});

test('es ist ein Muster, kein Projektdokument',()=>{
  // Bernried darf höchstens als Beispiel vorkommen, nie als Inhalt des Blattes.
  const bernried=(seite.match(/Bernried/g)||[]).length;
  assert.ok(bernried<=2,'das Blatt ist auf Bernried geschrieben statt auf jedes Projekt ('+bernried+'×)');
  assert.match(seite,/Dies sind <strong>Muster<\/strong>, keine Projektdokumente/);
  assert.match(seite,/Sie sind ein Vorschlag und stehen zur Korrektur/);
});

test('die drei Stufen sagen, was sie freischalten',()=>{
  for(const stufe of ['Stufe 1 · Ohne das bleibt fast alles stehen',
    'Stufe 2 · Macht sie nützlich statt nur richtig','Stufe 3 · Macht sie vorausdenkend'])
    assert.ok(seite.includes(stufe),'fehlt: '+stufe);
  // Die drei, ohne die heute nichts geht.
  for(const was of ['Dokumente, irgendwelche','Die Beteiligten','Projektsteckbrief'])
    assert.ok(seite.includes(was),'fehlt in Stufe 1: '+was);
  // Jede Zeile sagt auch, wohin es im Office gehört — sonst ist die Liste nicht benutzbar.
  assert.ok((seite.match(/<th[^>]*>Wohin im Office<\/th>/g)||[]).length===3,'nicht jede Stufe sagt, wohin');
  // Und die Grenze: nicht alles gehört hinein.
  assert.match(seite,/Was Romy nicht braucht und nicht bekommen soll/);
});

test('die vier Muster sind vollständig und nennen ihre Vorgänge',()=>{
  for(const m of ['Schnittstellenmatrix LPH 3','Rückfragenkatalog an die Fachplanungen',
    'Entscheidungspunkt','Planliste und Dokumentenstruktur'])
    assert.ok(seite.includes(m),'fehlt: '+m);
  // Der Rückfragenkatalog deckt jede Fachplanung der Matrix ab.
  for(const fach of ['Tragwerk','HLS','Elektro','Bauphysik','Brandschutz'])
    assert.match(seite,new RegExp('<h4>'+fach+'</h4>'),'keine Rückfragen für '+fach);
  // Die Herkunft ist nachprüfbar: die acht vorbereitbaren Vorgänge der Vorlage.
  assert.match(seite,/t-source-0003/);
  assert.match(seite,/A3 · Koordination und Entscheidungsvorlage/);
  assert.match(seite,/23 nichts vorzubereiten/);
});

test('deutsch, und ohne spanische Reste',()=>{
  assert.match(seite,/<html lang="de">/);
  assert.ok(!/\b(para|que|como|desde|proyecto|archivo|tarea)\b/i.test(seite.replace(/<code>[^<]*<\/code>/g,'')),
    'spanische Wörter im Blatt');
});
