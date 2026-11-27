// Heute · der eine Tag (Gari, 27.11.2026): «Braucht Sie», «Heute erledigen», «Bald fällig», «Überfällig» mit «Aufräumen»,
// «Demnächst» über fünf Tage und das Wetter in Augsburg. Der Terminplan wird nur im Terminplan geändert: Heute verschiebt
// keine Aufgabe, die ihr Datum aus einem Terminplan hat, und mahnt den Terminplan nicht an.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ahora=read('app/ahora.js'),app=read('app/app.js'),shell=read('app/shell.js'),css=read('app/ahora-bandeja.css');

test('die Abschnitte in ihrer Reihenfolge',()=>{
  const reihenfolge=['ahoraInbox','ahoraDay','ahoraBald','ahoraUeberfaellig','ahoraNext'].map(id=>shell.indexOf('id="'+id+'"'));
  assert.ok(reihenfolge.every(i=>i>0),'alle Abschnitte stehen im Bildschirm');
  assert.deepEqual([...reihenfolge].sort((a,b)=>a-b),reihenfolge,'Braucht Sie, Tag, Bald fällig, Überfällig, Demnächst');
  for(const text of ['Braucht Sie','Heute erledigen','Bald fällig','Überfällig · ','Aufräumen','Demnächst','Auf heute','Nächste Woche'])
    assert.ok(ahora.includes(text),'fehlt: '+text);
  assert.match(ahora,/const NEXT_DAYS=5,NEXT_MAX=8,BALD_MAX=3,INBOX_ERST=3;/);
});

test('Überfällig ist zugeklappt, und Aufgaben aus dem Terminplan bewegt nur der Terminplan',()=>{
  assert.match(ahora,/let inboxAlle=false,aufraeumen=false,ueberfaelligOffen=false,/);
  assert.match(ahora,/function ausTerminplan\(t\)\{return !!t\?\.metadata\?\.office_planner\?\.terminplan\?\.instance_id\}/);
  assert.match(ahora,/if\(ausTerminplan\(t\)\)return '<div class="ahora-aufraeumen">'\+erledigt\+'<span class="ahora-hinweis">Datum nur im Terminplan<\/span><\/div>';/);
  // Die App verweigert es auch selbst.
  assert.match(app,/if\(!t\|\|t\.date===date\|\|t\.metadata\?\.office_planner\?\.terminplan\?\.instance_id\)return false;/);
  assert.match(app,/mutation\('task','move_date',before,t,'manual'\);save\(\);renderCalendar\(\);/);
  assert.match(app,/  moveTaskToDate,/);
  // Keine Mahnung, den Terminplan zu aktualisieren.
  assert.doesNotMatch(ahora,/Terminplan (aktualisieren|veraltet|prüfen)/);
});

test('der Montag nach heute',()=>{
  const body=ahora.slice(ahora.indexOf('function naechsterMontag'),ahora.indexOf('function nameOf'));
  const naechsterMontag=new Function(body+';return naechsterMontag')();
  assert.equal(naechsterMontag('2026-11-27'),'2026-11-30');   // Freitag
  assert.equal(naechsterMontag('2026-11-29'),'2026-11-30');   // Sonntag
  assert.equal(naechsterMontag('2026-11-30'),'2026-12-07');   // Montag: der nächste
});

test('Wetter in Augsburg, von Open-Meteo, mit Quelle und ohne Schlüssel',()=>{
  assert.match(app,/const OFFICE_WETTER=\{ort:'Augsburg',breite:48\.3705,laenge:10\.8978,/);
  assert.match(app,/fetch\('https:\/\/api\.open-meteo\.com\/v1\/forecast\?'\+q\.toString\(\)\)/);
  assert.match(app,/Wetterdaten: Open-Meteo\.com/);
  assert.match(app,/if\(OFFICE\)\{renderOfficeWeather\(\);return\}/);
  const code=app.slice(app.indexOf('function wetterCode'),app.indexOf('function officeWetterHolen'));
  const wetterCode=new Function(code+';return wetterCode')();
  assert.deepEqual(wetterCode(0),['☀️','Klar']);
  assert.deepEqual(wetterCode(3),['☁️','Bedeckt']);
  assert.deepEqual(wetterCode(63),['🌧️','Regen']);
  assert.deepEqual(wetterCode(73),['❄️','Schneefall']);
  assert.deepEqual(wetterCode(95),['⛈️','Gewitter']);
  assert.deepEqual(wetterCode(999),['🌡️','Wetter']);
});

test('neue Regeln nur mit Farben aus den Tokens',()=>{
  const neu=css.slice(css.indexOf('/* Heute · der eine Tag und der eine Eingang'));
  assert.ok(neu.length>200);
  assert.doesNotMatch(neu,/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
});

test('das Diktat spricht «Sie», wie das ganze Office',()=>{
  const shell=read('app/shell.js');
  assert.match(shell,/placeholder="Hier erscheint die Transkription\."/);
  assert.match(app,/setText\('Sie können die Nachricht auch tippen\.'\)/);
  const diktat=shell.slice(shell.indexOf('<div id="focusMode"'),shell.indexOf('<div id="modalBackdrop"'));
  assert.doesNotMatch(diktat,/\b(du|dein|deine|dich|dir)\b/i);
});
