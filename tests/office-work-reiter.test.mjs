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
  assert.match(shell,/<button data-work-view="planner">Planner<\/button>\s*<button data-work-view="terminplan" hidden>Terminplan<\/button>\s*<button data-work-view="kosten" hidden>Kostenberechnung<\/button>\s*<button data-work-view="controlling" hidden>Controlling<\/button>\s*<button data-work-view="mustermappe" hidden>Mustermappe<\/button>\s*<button data-work-view="produkte" hidden>Produkte<\/button>\s*<button data-work-view="hersteller" hidden>Hersteller<\/button>/);
  assert.match(shell,/<div id="workBody" class="work-body">[^\n]*<\/div>\s*<div id="workToolHost" class="work-tool-host" hidden><\/div>/);
  assert.doesNotMatch(shell+work,/data-work-tool="|openProjectTool|work-tool-menu/,'kein Menü mehr, das Work verlässt');
  assert.match(work,/:isToolView\(view\)\?renderTool\(view\)/);
  // Jedes Werkzeug von Work ist ein Reiter des Projekts (nicht im Büro).
  assert.match(work,/\['overview','planner'\]\.includes\(b\.dataset\.workView\)\|\|isToolView\(b\.dataset\.workView\)\)b\.hidden=projectKey===OFFICE_ROOT/);
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
  for(const v of ['work.js?v=office55','shell.js?v=office57','office-projects.js?v=office62','work-polish.css?v=6','work-buckets.css?v=4'])
    assert.ok(index.includes(v),'Version fehlt: '+v);
});

test('Werkzeugseiten im Rahmen: ohne Rücksprung, nie die App im Rahmen, Revision und Speichern für Work',()=>{
  const tp=read('terminplan.html'),kb=read('kostenberechnung.js'),kbHtml=read('kostenberechnung.html'),kbCss=read('kostenberechnung.css');
  const marke="<script>if(window.self!==window.top)document.documentElement.classList.add('im-reiter')</script>";
  assert.ok(tp.includes(marke)&&kbHtml.includes(marke));
  assert.match(tp,/html\.im-reiter #officeBack\{display:none\}/);
  // Im Reiter auch ohne «Office · Kostenberechnung» und ohne den Projektnamen als Überschrift (Gari, 24.11.2026).
  assert.match(kbCss,/\.im-reiter \.kb-back,\.im-reiter \.kb-head \.kicker,\.im-reiter \.kb-head h1\{display:none\}/);
  assert.match(tp,/\$\('#officePlanLabel'\)\.textContent=IN_WORK&&phase\?phase:\[title,phase\]\.filter\(Boolean\)\.join\(' · '\);/);
  assert.match(tp,/window\.TBA_OFFICE_TOOL=Object\.freeze\(\{\n\s*kind:'terminplan',\n\s*revision:\(\)=>serverRevision,\n\s*pending:\(\)=>!!\(pendingSave\|\|inFlightSave\),/);
  assert.match(kb,/window\.TBA_OFFICE_TOOL=Object\.freeze\(\{kind:'kosten',revision:\(\)=>serverRevision,pending:\(\)=>ausstehend\|\|laeuft,flush:\(\)=>speichernJetzt\(\)\}\)/);
  assert.match(kb,/if\(IM_REITER\)\{fehler\('Bitte in TBA Office neu anmelden\.'\);return\}/);
  assert.match(kb,/if\(IM_REITER\)dialog\.addEventListener\('close',\(\)=>\{if\(!angelegt\)window\.parent\.postMessage\(\{tbaOfficeTool:'abgebrochen'\},location\.origin\)\},\{once:true\}\)/);
  assert.match(kbHtml,/kostenberechnung\.css\?v=office11/);
  assert.match(kbHtml,/kostenberechnung\.js\?v=office13/);
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
  assert.match(css,/\.work-task-state\.is-progress\{background:var\(--m-blue-soft\);color:var\(--m-information\)\}/);
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

// Mustermappe, Produkte und Hersteller (Gari, 25.11.2026): die Mappe eines Projekts als Reiter wie Terminplan und
// Kostenberechnung; Produkte und Hersteller zeigen nur, was für das Projekt ausgewählt ist.
test('Reiter Mustermappe, Produkte, Hersteller: Mappen je Projekt, eine Seite je Projekt für Produkte und Hersteller',()=>{
  // Die Mappen: Zeilen der Entscheidungsvorlagen mit form «mustermappe», in der Reihenfolge des Anlegens; die Wahl heißt nach dem Themenpaket.
  assert.match(work,/mustermappe:\{page:'\.\.\/projektdokumente\.html',name:'Mustermappe',idParam:'vorlage',load:loadMustermappen,/);
  assert.match(work,/\.eq\('project_id',pid\)\.eq\('art','entscheidungsvorlagen'\)/);
  assert.match(work,/\.in\('dokument_id',ids\)\.eq\('daten->>form','mustermappe'\)\.order\('nr'\)/);
  assert.match(work,/phase:r\.themenpaket\|\|r\.titel\|\|'Mustermappe'/);
  assert.match(work,/new URLSearchParams\(neu\?\{projekt:pid,werkzeug:'mustermappe',neu:'1'\}:\{projekt:pid,vorlage:id\}\)/);
  assert.match(work,/searchParams\.get\(tool\.idParam\|\|'id'\)/);
  // «Neue Mustermappe» neben der Wahl; vorher speichert die offene Mappe; der Dialog bleibt offen, bis er angelegt oder abgebrochen ist.
  assert.match(work,/bar\.hidden=rows\.length<\(tool\.add\?1:2\);/);
  assert.match(work,/<button type="button" class="work-tool-add" data-work-tool-create>'\+esc\(tool\.add\)\+'<\/button>/);
  assert.match(work,/if\(kind==='mustermappe'\)\{const frame=pane\.querySelector\('iframe'\);if\(frame\)await flushToolFrame\(frame\);showToolFrame\(pane,kind,pid,true\);return\}/);
  assert.match(work,/if\(frame&&pane\.dataset\.creating==='1'\)return;\n rememberToolPick\(pid,kind,pick\);/);
  // Produkte und Hersteller: eine Seite je Projekt, mit ?projekt=; Work verfolgt dort keine Fassung.
  assert.match(work,/produkte:\{page:'\.\.\/produktbibliothek\.html',name:'Produkte',single:true,\n  src:pid=>'\.\.\/produktbibliothek\.html\?projekt='\+encodeURIComponent\(pid\)\}/);
  assert.match(work,/hersteller:\{page:'\.\.\/herstellerkatalog\.html',name:'Hersteller',single:true,\n  src:pid=>'\.\.\/herstellerkatalog\.html\?projekt='\+encodeURIComponent\(pid\)\}/);
  assert.match(work,/if\(tool\.single\)\{if\(!pane\.querySelector\('\.work-tool-stage iframe'\)\)showToolFrame\(pane,kind,pid\);return\}/);
  assert.match(work,/const tool=WORK_TOOLS\[kind\];\n if\(tool\.single\)return;/);
  // Präsentieren darf im Rahmen den ganzen Bildschirm nehmen.
  assert.match(work,/frame\.allow='fullscreen';/);
  const css=read('app/work-polish.css');
  assert.match(css,/body\[data-section="work"\] \.work-tool-add\{\n  border:1px dashed var\(--m-border-strong\)/);
  // Werkzeugkarte «Mustermappe» unter Tools; sie öffnet die Mappen je Projekt.
  assert.match(shell,/id="officeToolsMappe" aria-label="Mustermappe öffnen"/);
  assert.match(shell,/NAV_ICONS\.mappe='<svg /);
  assert.match(read('app/office-projects.js'),/getElementById\('officeToolsMappe'\)\?\.addEventListener\('click',\(\)=>\{\n  window\.location\.href='\.\.\/projektdokumente\.html\?werkzeug=mustermappe';/);
});

test('Seiten im Reiter eines Projekts: Marke im Rahmen, kein Sprung in die App, Links bleiben im Projekt',()=>{
  const marke="<script>if(window.self!==window.top)document.documentElement.classList.add('im-reiter')</script>";
  for(const p of ['projektdokumente.html','produktbibliothek.html','herstellerkatalog.html'])assert.ok(read(p).includes(marke),p);
  const pd=read('projektdokumente.js'),pdCss=read('projektdokumente.css'),pb=read('produktbibliothek.js'),hk=read('herstellerkatalog.js'),pbCss=read('produktbibliothek.css');
  for(const [name,js] of [['projektdokumente.js',pd],['produktbibliothek.js',pb],['herstellerkatalog.js',hk]]){
    assert.match(js,/const IM_REITER=window\.self!==window\.top;/,name);
    assert.match(js,/if\(IM_REITER\)\{fehler\('Bitte in TBA Office neu anmelden\.'\);return\}/,name);
  }
  // Mustermappe: Revision der offenen Mappe, Speichern auf Zuruf, Abbrechen gemeldet, die neue Mappe über die Adresse.
  assert.match(pd,/window\.TBA_OFFICE_TOOL=Object\.freeze\(\{kind:'mustermappe',revision:\(\)=>vorlageZeile\(\)\?\.rev\|\|0,\n  pending:\(\)=>ungespeichert\(\)\|\|speicher\.laeuft>0,flush:\(\)=>alleSpeichern\(\)\}\)/);
  assert.match(pd,/if\(IM_REITER\)dialog\.addEventListener\('close',\(\)=>\{if\(!angelegt\)window\.parent\.postMessage\(\{tbaOfficeTool:'abgebrochen'\},location\.origin\)\},\{once:true\}\)/);
  assert.match(pd,/if\(IM_REITER\)\{await alleSpeichern\(\);location\.assign\(url\(\{projekt:projekt\.id,vorlage:v\.id\}\)\);return\}/);
  assert.match(pdCss,/\.im-reiter \.pd-back\[href\^="\.\/app\/"\],\.im-reiter \.pd-mappe-wrap>\.pd-back,\.im-reiter \.pd-mappe-wrap \.pd-head \.kicker\{display:none\}/);
  assert.match(pbCss,/\.im-reiter \.pb-back\[href\^="\.\/app\/"\]\{display:none\}/);
  // Produkte und Hersteller: ?projekt= filtert; jeder Link zwischen den beiden Seiten behält das Projekt.
  for(const js of [pb,hk]){
    assert.match(js,/const PROJEKT=UUID\.test\(params\.get\('projekt'\)\|\|''\)\?params\.get\('projekt'\):null;/);
    assert.match(js,/\/\\\/\(produktbibliothek\|herstellerkatalog\)\\\.html\$\/\.test\(u\.pathname\)/);
    assert.match(js,/if\(PROJEKT\)document\.addEventListener\('click',ev=>\{/);
  }
  assert.match(pb,/if\(PROJEKT\)\{ui\.projekt=PROJEKT;ui\.kategorie='alle'\}/);
  assert.match(hk,/const imProjekt=f=>kontakteVon\(f\)\.some\(k=>k\.projekt_id===PROJEKT\)\|\|imProjektProdukte\(f\)\.length>0;/);
  assert.match(hk,/sb\.from\('office_produkt_verwendungen'\)\.select\('produkt_id,projekt_id,code,status'\)\.eq\('projekt_id',PROJEKT\)/);
});

test('Projekte: Nummer und Name bearbeiten, nur Admin oder Projektleitung (wie die Datenbank)',()=>{
  const projects=read('app/office-projects.js');
  assert.match(projects,/if\(role==='admin'\|\|project\.projektleiter_id===userId\)\{\n      const edit=document\.createElement\('button'\);edit\.type='button';edit\.textContent='Bearbeiten';edit\.onclick=\(\)=>editProject\(project\);/);
  assert.match(projects,/sb\(\)\.from\('office_projects'\)\.update\(\{number,name\}\)\.eq\('id',project\.id\)\.select\('id'\)\.maybeSingle\(\)/);
  assert.match(projects,/saveError\?\.code==='23505'\?'Diese Projektnummer ist bereits vergeben\.'/);
});
