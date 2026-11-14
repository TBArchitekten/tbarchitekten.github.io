// Die Oberfläche auf Deutsch (14.11.2026, Gari: «continúa con las cadenas en español»).
//
// Die App des Office ist eine Portierung von Window. Dabei blieben spanische Zeilen an Stellen
// stehen, die ein Mitglied tatsächlich liest: die Etikette jedes Vorschlags im Gespräch, die
// Formulare zum Prüfen eines Vorschlags, die Quittungen nach dem Speichern, Romys Arbeitsraum und
// der Eingang. Dieser Test hält jene Stellen auf Deutsch fest.
//
// Was NICHT geprüft wird: Code hinter Ansichten, die das Office-Profil nicht hat (Ideen, der
// Vorschlags-Feed, Lecturas/Sofía, Thoughts, die Selbstprüfung von Window, die Wissen-Ansicht und
// die in <div class="office-hidden-actions" hidden> geparkten Panels). Dort steht weiter Spanisch;
// erreichbar ist es nicht.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('app/app.js'),shell=read('app/shell.js'),work=read('app/work.js');

test('Die Etikette eines Vorschlags im Gespräch ist deutsch',()=>{
  // Jeder Vorschlag zu einer Aufgabe oder einem Termin läuft durch diesen Zweig.
  assert.match(app,/const actionName=action==='update'\?'Ändern':action==='delete'\?'Löschen':action==='complete'\?'Abschließen':action==='archive'\?'Archivieren':'Anlegen';/);
  assert.match(app,/const bits=\[actionName,p\.kind==='event'\?'Termin':'Aufgabe',p\.title,p\.date\];/);
  assert.ok(!app.includes("'Modificar':action==='delete'?'Eliminar'"),'alte spanische Aktionsnamen');
  assert.ok(!app.includes("bits.push('recordatorio '"),'spanische Erinnerungszeile');
  for(const label of ['Wissen speichern','Fähigkeit anlegen','Romy verbessern'])
    assert.ok(app.includes("['"+label+"'"),'fehlt: '+label);
});

test('Die Formulare zum Prüfen eines Vorschlags sind deutsch',()=>{
  for(const title of ['Künftige Erinnerung prüfen','Erwartung prüfen','Kontinuität prüfen',
    'Projektwissen prüfen','Neue Fähigkeit prüfen','Verbesserung von Romy prüfen'])
    assert.ok(app.includes("modal('"+title+"'"),'fehlt: '+title);
  for(const gone of ['Revisar memoria futura','Revisar expectativa','Revisar continuidad',
    'Revisar conocimiento de proyecto','Revisar nueva Skill','Revisar mejora de Isabella'])
    assert.ok(!app.includes("modal('"+gone+"'"),'noch spanisch: '+gone);
});

test('Die Quittungen nach dem Speichern sind deutsch',()=>{
  for(const line of ['Keine Änderung.','Als erledigt markiert.',
    'Die Erwartung braucht einen Namen, was erwartet wird, und ein Datum.',
    'Die Erinnerung konnte noch nicht gespeichert werden: ',
    'Die Fähigkeit konnte nicht aktiviert werden: '])
    assert.ok(app.includes("sayEvent('"+line+"')")||app.includes("sayEvent('"+line),'fehlt: '+line);
  // Der unbekannte Projektname verwirft seit dem 14.11. keine Bestätigung mehr; die deutsche
  // Fassung dieser Zeile lebt jetzt in resolveProposalProject und bei Projektwissen.
  assert.match(app,/ist kein Projekt im Office/);
  for(const gone of ['Sin cambios.','Marcada como completada.','No pude identificar el proyecto',
    'No pude guardar esa expectativa','No pude activar la habilidad','No pude cambiar ese trabajo'])
    assert.ok(!app.includes("sayEvent('"+gone),'noch spanisch: '+gone);
});

test('Romy spricht im Office von sich als Romy, nicht als Isabella',()=>{
  assert.ok(app.includes("modal('Romys Arbeit'"),'der Arbeitsraum heißt nicht Romys Arbeit');
  assert.ok(!app.includes("modal('Trabajo de Isabella'"));
  assert.ok(work.includes("'<p class=\"cockpit-pflege\"><b>Romy, '"),'die Pflegezeile nennt noch Isabella');
  assert.ok(!work.includes("'propuesta de Isabella'"));
});

test('Der Eingang ist deutsch und zeigt nur den Tab, den das Office hat',()=>{
  assert.match(shell,/<h1>Eingang<\/h1>/);
  assert.match(shell,/data-bandeja-view="confirm">Zu bestätigen</);
  // isabella-feed und isabella-ideas gibt es im Office nicht: diese Tabs bleiben verborgen.
  assert.match(shell,/data-bandeja-view="suggest" hidden>/);
  assert.match(shell,/data-bandeja-view="ideas" hidden>/);
  for(const gone of ['<h1>Bandeja</h1>','Por confirmar','Desliza para actualizar','Lo que Isabella propone'])
    assert.ok(!shell.includes(gone),'noch spanisch: '+gone);
});

test('Die Übersetzungstabelle der App wächst nicht weiter',()=>{
  // OFFICE_NOTICE_DE liest nur noch den Verlauf: Zeilen, die vor dem 14.11.2026 auf Spanisch
  // gespeichert wurden. Neue Zeilen entstehen dort deutsch, wo sie geschrieben werden.
  const table=app.slice(app.indexOf('const OFFICE_NOTICE_DE=['),app.indexOf('const OFFICE_ES_DAYS='));
  const rows=(table.match(/^\s*\[\//gm)||[]).length;
  assert.ok(rows<=15,'die Tabelle hat '+rows+' Zeilen; eine spanische Meldung gehört an ihrer Quelle korrigiert');
  assert.match(app,/What is\n\/\/ left of this table is a reader for the history/);
});
