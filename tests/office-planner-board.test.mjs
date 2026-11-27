// Das Planner-Board behält seine Stelle (Gari, 23.11.2026): Wer in den Buckets ganz rechts etwas änderte, landete
// danach wieder bei den Buckets ganz links, als hätte die Seite neu geladen.
// Ursache: renderPlanner ersetzt #workBody bei jedem Neuzeichnen, das neue Board stand wieder links.
// Der Browser-Test tests/browser/office-planner-board.chromium.mjs prüft das Verhalten (vorher 1718 px, danach 0);
// dieser Test hält die Stellen fest, damit die CI es ohne Browser sieht.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const work=read('app/work.js');

test('renderPlanner merkt sich das Board vor dem Neuzeichnen und stellt es danach wieder her',()=>{
  const start=work.indexOf('async function renderPlanner(preview=false){');
  assert.ok(start>0);
  const ende=work.indexOf('\nasync function ',start+10);
  const fn=work.slice(start,ende>0?ende:undefined);
  // Gleich zu Beginn (vor loadPlanner, das warten kann) und noch einmal unmittelbar vor dem Ersetzen.
  assert.match(fn,/^async function renderPlanner\(preview=false\)\{\n  rememberBoard\(\$\('#workBody'\)\);/);
  const merken=fn.indexOf('  rememberBoard(body);'),ersetzen=fn.indexOf('body.innerHTML=`<div class="work-planner-toolbar">'),
    zurueck=fn.indexOf('  restoreBoard(body);');
  assert.ok(merken>0&&ersetzen>merken&&zurueck>ersetzen,'Reihenfolge: merken, ersetzen, wiederherstellen');
  assert.ok(zurueck<fn.indexOf('  if(preview){',ersetzen),'wiederhergestellt wird vor den Handlern des Musters');
});

test('gemerkt wird je Board: seitliche Position, Position in jedem Bucket, offene «Erledigte Aufgaben»',()=>{
  assert.match(work,/data-work-board-project="\$\{esc\(String\(preview\?'muster':boardKey\(\)\|\|''\)\)\}"/);
  assert.match(work,/boardMemory=\{project:board\.dataset\.workBoardProject\|\|'',left:board\.scrollLeft,top:board\.scrollTop,page:body\.scrollTop,buckets\};/);
  assert.match(work,/top:b\.querySelector\('\.work-bucket-scroll'\)\?\.scrollTop\|\|0,\s*done:!!b\.querySelector\('details\.work-completed'\)\?\.open/);
  // Ein anderes Projekt (oder das Muster) beginnt links: nur dasselbe Board bekommt seine Stelle zurück.
  assert.match(work,/if\(!board\|\|!m\|\|!m\.project\|\|m\.project!==board\.dataset\.workBoardProject\)return;/);
  assert.match(work,/board\.scrollLeft=m\.left;board\.scrollTop=m\.top;body\.scrollTop=m\.page;/);
  // Nichts davon wird gespeichert oder an die Datenbank geschickt.
  const teil=work.slice(work.indexOf('let boardMemory=null;'),work.indexOf('function isMusterPlanner('));
  assert.doesNotMatch(teil,/localStorage|sessionStorage|sb\.|fetch\(/);
});

test('work.js wird mit neuer Version geladen',()=>{
  assert.match(read('app/index.html'),/<script src="\.\/work\.js\?v=office64"><\/script>/);
});
