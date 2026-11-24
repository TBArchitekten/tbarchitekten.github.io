// Work, 24.11.2026 (Gari): Terminplan und Kostenberechnung sind Reiter wie Planner, Desktop und Panorama; der Status
// einer Karte steht als Etikett da (Vorschlag A); die Beschreibung eines Buckets nur beim Zeigen auf den Titel oder über
// «Info». Statische Prüfungen; das Verhalten prüfen die Chromium-Tests office-planner-karten, office-kostenberechnung
// und office-terminplan-reiter.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const shell=read('app/shell.js'),work=read('app/work.js'),index=read('app/index.html');

test('Reiter: Terminplan und Kostenberechnung sind Ansichten von Work, mit eigenem Platz für die Werkzeugseite',()=>{
  assert.match(shell,/<button data-work-view="planner">Planner<\/button>\s*<button data-work-view="terminplan" hidden>Terminplan<\/button>\s*<button data-work-view="kosten" hidden>Kostenberechnung<\/button>/);
  assert.match(shell,/<div id="workBody" class="work-body">[^\n]*<\/div>\s*<div id="workToolHost" class="work-tool-host" hidden><\/div>/);
  assert.doesNotMatch(shell+work,/data-work-tool="|openProjectTool|work-tool-menu/,'kein Menü mehr, das Work verlässt');
  assert.match(work,/:isToolView\(view\)\?renderTool\(view\)/);
  assert.match(work,/\['overview','planner','terminplan','kosten'\]\.includes\(b\.dataset\.workView\)\)b\.hidden=projectKey===OFFICE_ROOT/);
  // Die Seite läuft in einem Rahmen und bleibt beim Wechsel offen; Work leitet nicht um.
  assert.match(work,/frame=document\.createElement\('iframe'\)/);
  assert.doesNotMatch(work,/location\.assign\(page/);
  assert.match(work,/if\(body\)body\.hidden=tool;/);
  // Vor dem Schließen eines Rahmens oder einer anderen Fassung wird gespeichert, was aussteht.
  assert.match(work,/if\(frame\)await flushToolFrame\(frame\);\n showToolFrame\(pane,kind,pick\);/);
  assert.match(work,/void flushToolFrame\(pane\.querySelector\('iframe'\)\)\.finally\(\(\)=>pane\.remove\(\)\)/);
  // Neu laden nur, wenn jemand anderes gespeichert hat, nichts aussteht und niemand in der Seite arbeitet.
  assert.match(work,/api&&!api\.pending\(\)&&!frame\.contentDocument\?\.hasFocus\(\)&&Number\(row\?\.server_revision\)>Number\(api\.revision\(\)\)/);
  // Panorama und «Neuer Terminplan» öffnen den Reiter.
  assert.match(work,/data-work-open-tool="terminplan" data-work-tool-id="/);
  assert.match(work,/openNewPlan\?\.\(button\.dataset\.officeNewPlan,\{onCreated:id=>openToolTab\('terminplan',id\)\}\)/);
  const projects=read('app/office-projects.js');
  assert.match(projects,/if\(typeof onCreated==='function'\)\{window\.ISABELLA_APP\?\.closeModal\?\.\(\);onCreated\(data\.id\);return\}/);
  // Nur eine Kostenberechnung «anlegen» im Rahmen; abgebrochen meldet die Seite selbst.
  assert.match(work,/e\.origin!==location\.origin\|\|e\.data\?\.tbaOfficeTool!=='abgebrochen'/);
  for(const v of ['work.js?v=office53','shell.js?v=office54','office-projects.js?v=office58','work-polish.css?v=4','work-buckets.css?v=4'])
    assert.ok(index.includes(v),'Version fehlt: '+v);
});

test('Werkzeugseiten im Rahmen: ohne Rücksprung, nie die App im Rahmen, Revision und Speichern für Work',()=>{
  const tp=read('terminplan.html'),kb=read('kostenberechnung.js'),kbHtml=read('kostenberechnung.html'),kbCss=read('kostenberechnung.css');
  const marke="<script>if(window.self!==window.top)document.documentElement.classList.add('im-reiter')</script>";
  assert.ok(tp.includes(marke)&&kbHtml.includes(marke));
  assert.match(tp,/html\.im-reiter #officeBack\{display:none\}/);
  assert.match(kbCss,/\.im-reiter \.kb-back\{display:none\}/);
  assert.match(tp,/window\.TBA_OFFICE_TOOL=Object\.freeze\(\{\n\s*kind:'terminplan',\n\s*revision:\(\)=>serverRevision,\n\s*pending:\(\)=>!!\(pendingSave\|\|inFlightSave\),/);
  assert.match(kb,/window\.TBA_OFFICE_TOOL=Object\.freeze\(\{kind:'kosten',revision:\(\)=>serverRevision,pending:\(\)=>ausstehend\|\|laeuft,flush:\(\)=>speichernJetzt\(\)\}\)/);
  assert.match(kb,/if\(IM_REITER\)\{fehler\('Bitte in TBA Office neu anmelden\.'\);return\}/);
  assert.match(kb,/if\(IM_REITER\)dialog\.addEventListener\('close',\(\)=>\{if\(!angelegt\)window\.parent\.postMessage\(\{tbaOfficeTool:'abgebrochen'\},location\.origin\)\},\{once:true\}\)/);
  assert.match(kbHtml,/kostenberechnung\.css\?v=office9/);
  assert.match(kbHtml,/kostenberechnung\.js\?v=office12/);
});

test('Im Rahmen leiht die Seite die Brücke der App (die App nimmt nur den Hauptrahmen an)',()=>{
  const client=read('shared/supabase-client.js');
  assert.match(client,/const parentNative = window\.parent !== window \? window\.parent\.WINDOW_NATIVE : null;/);
  assert.ok(client.indexOf('parentNative.call(message.type, message)')<client.indexOf('if (!bridge) bridge = window.webkit?.messageHandlers?.windowNative;'),
    'erst die Brücke der App, dann die eigene');
  for(const p of ['app/index.html','index.html','terminplan.html','kostenberechnung.html','produktbibliothek.html','projektdokumente.html','app/live/index.html'])
    assert.match(read(p),/supabase-client\.js\?v=office4/,p);
});

test('Karte: Status als Etikett neben dem Datum (Vorschlag A), der Kreis nur zum Erledigen',()=>{
  const css=read('app/work-polish.css');
  assert.match(work,/\$\{state\.label\?`<span class="work-task-state is-\$\{state\.key\}">\$\{esc\(state\.label\)\}<\/span>`:''\}/);
  assert.match(work,/aria-label="\$\{t\.completed_at\?'Wieder öffnen':'Erledigen'\}: \$\{esc\(t\.title\)\}"/);
  assert.doesNotMatch(work,/'is-progress':''|'is-waiting':''/);
  assert.doesNotMatch(css,/work-task-toggle\.is-progress|work-task-toggle\.is-waiting/);
  assert.match(css,/\.work-task-state\.is-progress\{background:#e8f1ff;color:#1559c4\}/);
  assert.match(css,/\.work-task-state\.is-waiting\{background:#fff1d9;color:#94590a\}/);
});

test('Bucket: Beschreibung beim Zeigen auf den Titel oder über «Info», im Muster weiter sichtbar',()=>{
  const css=read('app/work-buckets.css');
  assert.match(work,/class="work-bucket-explanation\$\{preview\?'':' is-tip'\}"/);
  assert.match(work,/data-work-bucket-info="\$\{b\.id\}"/);
  assert.match(work,/info:b\.classList\.contains\('is-info-open'\)/,'«Info» bleibt nach dem Neuzeichnen offen');
  assert.match(css,/\.work-bucket-explanation\.is-tip\{display:none\}/);
  assert.match(css,/\.work-bucket\.is-info-open \.work-bucket-explanation\.is-tip\{display:block\}/);
  assert.match(css,/:has\(\.work-bucket-grab:hover\) \.work-bucket-explanation\.is-tip \.work-bucket-explanation-body\{\n\s*position:absolute;/);
});
