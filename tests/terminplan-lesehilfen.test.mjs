// Terminplan lesbar (Gari, 27.11.2026: «las barras no se leen»; nächste Schritte freigegeben): Namen neben zu kurzen
// Balken, mitwandernde Namen beim Blättern, ein Kärtchen beim Zeigen, «Heute ± 4 Wochen», Lesemodus. Dazu der Fehler,
// der Namen beim Zeigen verdeckte: der linke Griff eines Balkens heißt «handle left» und bekam die Regel der Tabelle
// (.left: weiß, 300 bis 430 px breit).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../terminplan.html',import.meta.url),'utf8');
const css=html.slice(html.indexOf('<style>'),html.indexOf('</style>'));

test('die Regel der Tabelle trifft nur die Tabelle, nicht die Griffe der Balken',()=>{
  assert.doesNotMatch(css,/(^|\n)\s*\.left\{/,'keine Regel für jedes Element mit der Klasse left');
  assert.match(css,/section\.left\{\s*width:var\(--left-w\);min-width:300px;max-width:1200px;/);
  assert.match(html,/<section class="left" id="leftPanel">/);
  assert.match(css,/\.handle\{\s*position:absolute;top:3px;width:7px;/);
});

test('Namen neben zu kurzen Balken, sonst wandern sie mit',()=>{
  assert.match(html,/if\(textW\+18>width\)\{\s*bar\.classList\.add\('bar-kurz'\);/);
  assert.match(css,/\.bar\.bar-kurz \.bar-label\{visibility:hidden\}/);
  assert.match(html,/stickyBalken\.push\(\{label:bar\.querySelector\('\.bar-label'\),left,width,textW\}\)/);
  assert.match(html,/const dx=Math\.max\(0,Math\.min\(sl-b\.left,b\.width-b\.textW-18\)\);/);
  assert.match(html,/requestAnimationFrame\(\(\)=>\{syncing=false;stickyNamen\(\)\}\)/);
  // Breite ohne Layout: Canvas statt Messen im Dokument.
  assert.match(html,/textMass=document\.createElement\('canvas'\)\.getContext\('2d'\)/);
});

test('das Kärtchen nennt Zeitraum, Arbeitstage, Art, Vorgänger und den kritischen Weg',()=>{
  const tip=html.slice(html.indexOf('function tipHtml'),html.indexOf('const tip=document.createElement'));
  for(const teil of ["' AT'","ART_TEXT[t.category]","'Nach '+esc(v.name)","Auf dem kritischen Weg","% erledigt"])
    assert.ok(tip.includes(teil),'fehlt: '+teil);
  assert.match(html,/if\(e\.pointerType&&e\.pointerType!=='mouse'\)return;/);
  assert.match(html,/timelineBody\.addEventListener\('pointerdown',tipZu\);/);
  // Kein zweites Kärtchen vom Browser.
  assert.doesNotMatch(html,/bar\.title=t\.name/);
});

test('«Heute ± 4 Wochen» passt acht Wochen ins Fenster',()=>{
  assert.match(html,/<button class="btn" data-zoom="fenster"[^>]*>Heute ± 4 Wochen<\/button>/);
  assert.match(html,/cellWidth=zoom==='day'\?46:zoom==='week'\?28:zoom==='fenster'\?fensterBreite\(\):18;/);
  assert.match(html,/const FENSTER_TAGE=28;/);
  assert.match(html,/return Math\.max\(10,Math\.min\(60,Math\.floor\(\(w-8\)\/n\)\)\);/);
  // Schmale Tage: nur die Zahl, sehr schmale nur montags.
  assert.match(html,/:cellWidth>=14\?tag2:\(d\.getUTCDay\(\)===1\?tag2:''\);/);
});

test('Lesemodus: auswählen ja, ziehen, öffnen und Kontextmenü nein; die Tabelle schmal und danach wie vorher',()=>{
  assert.match(html,/<button class="btn" id="lesenBtn" type="button" aria-pressed="false"/);
  assert.match(html,/if\(!canEdit\)return;\s*if\(lesen\)return;/);
  assert.match(html,/bar\.ondblclick=\(\)=>\{if\(!lesen\)openTask\(t\.id\)\};/);
  assert.match(html,/m\.ondblclick=\(\)=>\{if\(!lesen\)openTask\(t\.id\)\};/);
  assert.match(html,/if\(lesen\)\{uiState\.leftWidthVorLesen=uiState\.leftWidth\|\|925;uiState\.leftWidth=tabelleBreite\(360\)\}/);
  assert.match(html,/lesen:saved\.lesen===true/);
  assert.match(css,/html\.tp-lesen \.handle\{display:none\}/);
});
