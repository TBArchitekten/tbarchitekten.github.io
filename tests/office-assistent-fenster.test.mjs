// Ein Fenster für alle Assistenten des Office (Gari, 24.11.2026): Terminplan und Kostenberechnung nutzen dasselbe
// Fenster (assistant-surface.css, assistant-window.js). Das Verhalten prüft tests/browser/office-assistent-fenster.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fenster=read('assistant-window.js'),css=read('assistant-surface.css');

test('Lage als nächste Bildschirmecke mit Abstand',()=>{
  const win={innerWidth:1000,innerHeight:800,localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>({matches:false}),document:{}};
  vm.runInNewContext(fenster,{window:win});
  const A=win.TBA_ASSISTANT_WINDOW;
  assert.deepEqual({...A.ausRechteck(658,726,242,54)},{ecke:'ru',x:100,y:20});
  assert.deepEqual({...A.ausRechteck(20,30,242,54)},{ecke:'lo',x:20,y:30});
  assert.deepEqual({...A.ausRechteck(30,500,470,280)},{ecke:'lu',x:30,y:20});
  assert.deepEqual({...A.ausRechteck(600,40,300,200)},{ecke:'ro',x:100,y:40});
});

test('Beide Assistenten im selben Fenster; die Seiten verschieben nichts selbst',()=>{
  const tp=read('terminplan.html'),kb=read('kostenberechnung.html'),client=read('kosten-assistent.js');
  for(const [name,html] of [['terminplan.html',tp],['kostenberechnung.html',kb]]){
    assert.match(html,/assistant-surface\.css\?v=office38/,name);
    assert.match(html,/<script src="\.\/assistant-window\.js\?v=1"><\/script>/,name);
  }
  assert.doesNotMatch(tp,/assistantFloating|assistantWindowState|applyAssistantPosition|office-plan-assistant-window-v1/,'kein eigenes Verschieben mehr');
  assert.match(tp,/key:'terminplan',titel:'Terminplan Assistent',isPopout:assistantIsPopout,/);
  assert.match(client,/key:'kostenberechnung',titel:'Kosten Assistent',/);
  assert.match(client,/class="assistant-head"/);
  assert.match(client,/class="assistant-body as-body" id="asBody" hidden/);
  assert.match(client,/<button type="submit" class="as-senden" id="asSenden" aria-label="Senden">Senden<\/button>/);
});

test('Fenster: offen und zu verschiebbar, Größe an der freien Ecke, am Telefon fest unten',()=>{
  // Ziehen erst ab einigen Pixeln, damit ein Klick auf den Reiter weiter öffnet; nach dem Ziehen öffnet er nicht.
  assert.match(fenster,/if\(Math\.hypot\(dx,dy\)<SCHWELLE\)return;/);
  assert.match(fenster,/panel\.addEventListener\('click',e=>\{if\(geschoben\)\{geschoben=false;e\.preventDefault\(\);e\.stopPropagation\(\)\}\},true\);/);
  assert.match(fenster,/const frei=!isPopout&&!schmal\(\)&&!!lage;/);
  assert.match(fenster,/root\.localStorage\.setItem\(SPEICHER\+key,JSON\.stringify\(lage\)\)/);
  for(const e of ['ru','lu','ro','lo'])
    assert.match(css,new RegExp('\\.assistant-panel\\.is-placed\\[data-ecke="'+e+'"\\]\\{'));
  assert.match(css,/\.assistant-panel\.is-open \.assistant-resize\{display:block\}/);
  assert.match(css,/@media\(max-width:600px\)\{\n \.assistant-head\{cursor:default;touch-action:auto\}\n \.assistant-resize\{display:none!important\}\n\}/);
});
