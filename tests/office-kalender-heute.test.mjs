// Gari, 27.11.2026: der Kalender öffnet immer auf heute (nicht auf dem zuletzt angesehenen Tag), und das «+» am Ende
// der Reiter sitzt in der Mitte des blauen Kreises.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Kalender: jeder Start beginnt mit heute, in Schreibtisch und Kalender',()=>{
  const dash=read('app/dashboard.js'),app=read('app/app.js');
  // Schreibtisch: gespeicherte Einstellungen bleiben, nur der Tag beginnt bei heute.
  assert.match(dash,/const start = \{navCollapsed:true,selectedDate:M\.dayKey\(new Date\(\)\)\};\n    try \{ return \{\.\.\.M\.sanitizePreferences\(JSON\.parse\(localStorage\.getItem\(KEY\) \|\| 'null'\)\),\.\.\.start\}; \}\n    catch \{ return \{\.\.\.M\.defaultPreferences\(\),\.\.\.start\}; \}/);
  // Kalender der App: der gespeicherte Zustand bringt den alten Tag mit; er wird beim Laden durch heute ersetzt.
  assert.match(app,/x\.date=today\(\);return x\n\}catch\{return JSON\.parse\(JSON\.stringify\(base\)\)\}\}/);
  assert.match(app,/const base=\{[^}]*date:today\(\)/,'ohne gespeicherten Zustand ohnehin heute');
});

test('Romy: der Schreibtisch bleibt, mit Kalender, Heute und Arbeitsplan daneben',()=>{
  // Gari, 28.11.2026: «se me hacía mucho más práctica … como tipo Dashboard». Am 27.11. war er für einen Abend auf das
  // Gespräch allein reduziert worden; das darf nicht wiederkommen, ohne dass Gari es will.
  const dash=read('app/dashboard.js'),css=read('app/office-assistant.css');
  assert.match(dash,/parts=Object\.fromEntries\(M\.PANELS\.map\(k=>\[k,panel\(k\)\]\)\);/);
  assert.match(read('app/dashboard-model.js'),/const PANELS = \['chat', 'calendar', 'today', 'plan'\];/);
  assert.doesNotMatch(dash,/desk-shell--allein|const PANELS = \['chat'\]/);
  assert.doesNotMatch(css,/desk-shell--allein/);
});

test('Kalender: über Mitternacht offen rückt «heute» nach, ein bewusst gewählter Tag bleibt',()=>{
  const dash=read('app/dashboard.js'),app=read('app/app.js');
  assert.match(dash,/const wasToday = prefs\.selectedDate === todayKey;\n    todayKey = now;\n    if \(!wasToday\) return;\n    prefs\.selectedDate = now;remember\(\);\n    app\(\)\?\.selectCalendarDate\?\.\(now\);scheduleRender\(\);/);
  assert.match(app,/const now=today\(\);if\(now!==calendarToday\)\{const wasToday=state\.date===calendarToday;calendarToday=now;if\(wasToday\)\{state\.date=now;save\(\);if\(state\.screen==='calendar'\)renderCalendar\(\)\}\}/);
});

test('Reiter «+»: gezeichnetes Kreuz, Kreis ausdrücklich mittig',()=>{
  const shell=read('app/shell.js'),css=read('app/work-polish.css');
  assert.match(shell,/class="work-tab-plus"[^>]*hidden><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M8 3v10M3 8h10"\/><\/svg><\/button>/);
  assert.doesNotMatch(shell,/class="work-tab-plus"[^>]*>\+<\/button>/,'kein Schriftzeichen mehr');
  assert.match(css,/\.work-tab-plus::before\{\n  content:"";position:absolute;inset:0;margin:auto;width:28px;height:28px;/);
  assert.match(css,/\.work-tab-plus svg\{display:block;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round\}/);
  // Neue Fassungen werden geladen.
  const index=read('app/index.html');
  for(const v of ['./work-polish.css?v=8','./shell.js?v=office67','./app.js?v=office62','./dashboard.js?v=office44'])assert.ok(index.includes(v),v);
});
