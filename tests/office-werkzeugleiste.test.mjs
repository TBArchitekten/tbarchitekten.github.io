// Eine Werkzeugzeile je Reiter (B2, 27.11.2026): shared/werkzeugleiste.js wirkt nur im Reiter von Work und verschiebt
// Elemente, statt sie zu kopieren. Das Verhalten im Browser prüft tests/browser/office-terminplan-reiter.chromium.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Außerhalb des Reiters tut die Werkzeugzeile nichts',()=>{
  const window={};
  const document={documentElement:{classList:{contains:()=>false,add(){throw new Error('nicht im Reiter')}}},
    querySelector(){throw new Error('nicht im Reiter')}};
  runInNewContext(read('shared/werkzeugleiste.js'),{window,document,MutationObserver:class{observe(){}}});
  assert.equal(window.TBA_WERKZEUGLEISTE.einreihen({leiste:{},selten:['#x']}),null);
});

test('Verschieben statt kopieren, später Eingefügtes wandert nach, nur Tokens',()=>{
  const js=read('shared/werkzeugleiste.js'),css=read('shared/werkzeugleiste.css');
  assert.doesNotMatch(js,/cloneNode|innerHTML\s*=/);
  assert.match(js,/menue\.insertBefore\(el,nach\|\|null\)/);
  assert.match(js,/new MutationObserver\(verschiebe\)/);
  assert.doesNotMatch(css,/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  assert.match(css,/@media print\{\.wz-mehr,\.wz-menue,\.wz-hilfe\{display:none!important\}\}/);
});

test('Terminplan: Kopfzeile im Reiter ausgeblendet, Leiste eingereiht',()=>{
  const html=read('terminplan.html');
  assert.match(html,/html\.im-reiter \.office-plan-head\{display:none\}/);
  assert.match(html,/html\.im-reiter \.app\{height:100%\}/);
  assert.match(html,/<link rel="stylesheet" href="\.\/shared\/werkzeugleiste\.css\?v=\d+">/);
  assert.match(html,/<script src="\.\/shared\/werkzeugleiste\.js\?v=\d+"><\/script>\s*<script>\s*\/\/ Eine Werkzeugzeile/);
  for(const sel of ["'#exportCsvBtn'","'#printBtn'","'.tp-feature-actions'","'#addGroupBtn'"])assert.ok(html.includes(sel),sel);
  assert.match(html,/status:\['#officeMode','#saveState'\],hilfe:'#tpHelp'/);
  // Erklärungen hinter «?»: die Anleitung verlässt das Menü und steht vor «•••».
  const js=read('shared/werkzeugleiste.js');
  assert.match(js,/hilfe\.setAttribute\('aria-label',name\);hilfe\.title=name;hilfe\.textContent='\?';/);
  assert.match(js,/leiste\.insertBefore\(hilfe,knopf\)/);
});
