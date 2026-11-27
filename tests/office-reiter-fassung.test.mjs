// Die Fassung in der Werkzeugzeile (Work B2, 27.11.2026): mit reduzierter Leiste wählt man Terminplan, Kostenberechnung
// und Mappe am Anfang der Werkzeugzeile der Seite («Name ▾»), nicht in einer eigenen Zeile über dem Werkzeug. Liste und
// Wahl bleiben bei Work; die Seite zeigt nur an. Ohne Ort in der Seite bleibt die Zeile über dem Werkzeug.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Seite: nur im Reiter von Work, Liste und Wahl bei Work, Menü wie «•••»',()=>{
  const js=read('shared/reiter-fassung.js');
  assert.ok(js.includes("if(window.self===window.top)return;"),'nur im Reiter');
  assert.ok(js.includes('window.parent.TBA_WORK_FASSUNG'),'Liste und Wahl kommen von Work');
  for(const f of ['work.ort(window,','work.lage(window)','work.waehlen(window,id)','work.anlegen(window)'])assert.ok(js.includes(f),f);
  assert.ok(js.includes("querySelectorAll('[data-reiter-fassung]')"),'Ort in der Werkzeugzeile');
  assert.ok(js.includes("addEventListener('tba-work-fassung',planen)"),'Work meldet Änderungen');
  assert.ok(js.includes("e.key==='Escape'"),'Esc schließt');
  assert.ok(js.includes('aria-haspopup="true" aria-expanded="false"'),'Knopf mit Menü');
  assert.ok(js.includes('if(ort.dataset.fassungHtml===html)continue;'),'zeichnet nur neu, was sich ändert');
  assert.ok(!/fetch\(|supabase|localStorage/.test(js),'die Seite lädt und speichert nichts dafür');
  const css=read('shared/reiter-fassung.css');
  assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(css),'nur Tokens');
  assert.match(css,/@media print\{\[data-reiter-fassung\],\.wz-fassung-menue\{display:none!important\}\}/);
});

test('Werkzeuge: Ort am Anfang der Zeile, Skript und Stil geladen',()=>{
  const tp=read('terminplan.html'),kb=read('kostenberechnung.html'),pd=read('projektdokumente.html');
  for(const [name,html] of [['terminplan',tp],['kostenberechnung',kb],['projektdokumente',pd]]){
    assert.match(html,/<script src="\.\/shared\/reiter-fassung\.js\?v=1"><\/script>/,name);
    assert.match(html,/<link rel="stylesheet" href="\.\/shared\/reiter-fassung\.css\?v=1">/,name);
  }
  assert.ok(tp.indexOf("ort.dataset.reiterFassung=''")<tp.indexOf('window.TBA_WERKZEUGLEISTE?.einreihen('),'Terminplan: Ort vor dem Einreihen');
  assert.ok(tp.includes("document.querySelector('.app>.toolbar')?.prepend(ort)"),'am Anfang der Leiste');
  assert.ok(read('kostenberechnung.js').includes(`const zeile='<div class="kb-zeile"><span data-reiter-fassung hidden></span>'+tabs+`));
  assert.ok(read('projektdokumente.js').includes(`(IM_REITER?'<span data-reiter-fassung hidden></span>':'')+`));
});

test('Work: Fassungen aus der Leiste über dem Werkzeug, die reduziert entfällt, wenn die Seite einen Ort hat',()=>{
  const lens=read('app/work-lens.js'),css=read('app/work-lens.css');
  assert.ok(lens.includes('window.TBA_WORK_FASSUNG={'));
  assert.ok(lens.includes("['desk-enabled','minds-nav-collapsed','lens-work-an'].every(k=>document.body.classList.contains(k))"),'nur reduziert');
  assert.ok(lens.includes(".work-tool-bar [data-work-tool-pick=\"'+CSS.escape(String(id))+'\"]')?.click()"),'wählt wie die Leiste');
  assert.ok(lens.includes(".work-tool-bar [data-work-tool-create]')?.click()"),'«Neue Mustermappe» wie die Leiste');
  assert.ok(lens.includes("w.dispatchEvent(new w.Event('tba-work-fassung'))"),'meldet den Seiten');
  assert.ok(lens.includes("observe(document.body,{attributes:true,attributeFilter:['class']})"),'auf- und zuklappen');
  assert.ok(css.includes('body.desk-enabled.minds-nav-collapsed[data-section="work"].lens-work-an [data-work-tool-pane][data-fassung-im-werkzeug="1"] .work-tool-bar{display:none!important}'));
  const index=read('app/index.html');
  assert.match(index,/work-lens\.js\?v=4/);assert.match(index,/work-lens\.css\?v=4/);
});
