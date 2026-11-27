// B2 (27.11.2026): Projekt und Abschnitte in der Seitenleiste. Statische Prüfungen; das Verhalten prüft
// tests/browser/office-work-seitenleiste.chromium.mjs in Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Die Seitenleiste spiegelt die Reiter und lässt die Logik in work.js',()=>{
  const index=read('app/index.html'),lens=read('app/work-lens.js'),work=read('app/work.js');
  assert.ok(index.indexOf('./work.js?v=')<index.indexOf('./work-lens.js?v='),'nach work.js geladen');
  assert.match(index,/<link rel="stylesheet" href="\.\/work-lens\.css\?v=\d+">/);
  // Klicks gehen an die Reiter und die Projektwahl von work.js; kein eigener Zustand.
  assert.match(lens,/\.work-tabs \[data-work-view="'\+CSS\.escape\(v\.dataset\.lensView\)\+'"\]'\)\?\.click\(\)/);
  assert.match(lens,/\.work-project-switch \[data-work-project="'\+CSS\.escape\(p\.dataset\.lensProject\)\+'"\]'\)\?\.click\(\)/);
  assert.match(lens,/new MutationObserver\(planen\)/);
  assert.doesNotMatch(lens,/localStorage|sb\.from|MINDS_SUPABASE/);
  // Fremdtext (Projektnamen) wird maskiert.
  assert.match(lens,/const esc=s=>/);
  assert.match(work,/window\.TBA_WORK_ABSCHNITTE=\{oeffnen:knopf=>oeffneAbschnittMenu\(knopf\)\};/);
  assert.match(work,/if\(knopf\.closest\('#desktopLenses'\)\)\{/);
  assert.match(work,/closest\?\.\('#workAbschnitteMenu,\[data-work-abschnitte\],\[data-lens-plus\]'\)/);
});

test('Nur am Desktop und nur mit Farben aus den Tokens',()=>{
  const css=read('app/work-lens.css');
  const desktop=css.slice(css.indexOf('@media (min-width:950px)'),css.indexOf('/* Planner: Titel'));
  assert.match(desktop,/body\.desk-enabled\[data-section="work"\]\.lens-work-an \.work-tabs\{display:none!important\}/);
  assert.match(desktop,/body\.desk-enabled\.minds-nav-collapsed \.lens-work-label\{display:none\}/);
  assert.match(css,/^#lensWork\{display:none\}/m);
  assert.doesNotMatch(css,/#[0-9a-fA-F]{3,8}\b|rgba?\(/,'keine Farbwerte außer Tokens');
});

test('Planner: Filter in der Leiste des Boards',()=>{
  const work=read('app/work.js');
  assert.match(work,/<div class="work-planner-toolbar"><div><strong>Board<\/strong>[^`]*\$\{preview\?'':plannerFilterBar\(plannerFilter\(\)\)\}<span class="work-planner-actions">/);
  assert.doesNotMatch(work,/<\/span><\/div>\n    \$\{preview\?'':plannerFilterBar\(plannerFilter\(\)\)\}/);
});
