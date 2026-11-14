// Ein Projektname kostet keine Bestätigung (14.11.2026, Gari).
//
// Romy schlug ein Commitment für «Schwarz» vor — ein Projekt, das es im Office nicht gibt; der
// Katalog kennt nur Bernried. Gari bestätigte den Vorschlag, und die App verwarf ihn, weil der Name
// nicht aufzulösen war. Das Ziel war weg. Jetzt wird es ohne Projektbezug gespeichert, und die
// Quittung sagt es. Nur Projektwissen bleibt streng: ein Claim ohne Projekt hat keinen Ort.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app/app.js',import.meta.url),'utf8');

// Die Funktion aus der ausgelieferten Datei holen und genau sie prüfen, nicht eine Kopie.
function lift(name){
  const start=app.indexOf('function '+name+'(');
  assert.ok(start>=0,'nicht gefunden: '+name);
  let depth=0,i=app.indexOf('{',start);
  const from=i;
  for(;i<app.length;i++){
    if(app[i]==='{')depth++;
    else if(app[i]==='}'&&--depth===0){i++;break}
  }
  const src=app.slice(start,i);
  const deps='const COMMITMENT_SCOPES=new Set(["global","personal","project","theory","other"]);';
  return new Function(deps+src+';return '+name+';')();
}

test('Ohne gefundenes Projekt wird daraus nie der Bereich «project»',()=>{
  const commitmentScope=lift('commitmentScope');
  // Genau der Fall von Gari: Romy schickt project:"Schwarz", der Katalog kennt es nicht.
  assert.equal(commitmentScope(null,'project'),'other');
  // Ein freier Text im Bereichsfeld verstößt gegen minds_commitments_scope_check.
  assert.equal(commitmentScope(null,'Schwarz'),'other');
  assert.equal(commitmentScope(null,''),'other');
  // Ein gültiger eigener Bereich bleibt, wie er ist.
  assert.equal(commitmentScope(null,'personal'),'personal');
  assert.equal(commitmentScope(null,'global'),'global');
  // Mit Projekt ist der Bereich immer «project».
  assert.equal(commitmentScope({id:'x'},'global'),'project');
});

test('Ein unbekannter Projektname verwirft die Bestätigung nicht mehr',()=>{
  // Die alte Abbruchstelle stand dreimal in der Datei; keine davon darf zurück sein.
  assert.ok(!app.includes("sayEvent('Das Projekt wurde nicht erkannt. Bitte den Namen korrigieren.');return}"),
    'der alte Abbruch bei unbekanntem Projekt ist wieder da');
  const uses=(app.match(/const \{project:proj,note:projectNote\}=await resolveProposalProject\(p\);/g)||[]).length;
  assert.equal(uses,3,'Erinnerung, Erwartung und Commitment holen das Projekt nicht alle über resolveProposalProject');
  assert.match(app,/ist kein Projekt im Office, deshalb ohne Projektbezug gespeichert/);
});

test('Jede der drei Quittungen sagt es, wenn ohne Projekt gespeichert wurde',()=>{
  // Standing Intent, Erwartung, Commitment (einfach) und Commitment (mit laufender Arbeit).
  const carried=(app.match(/\$\{projectNote\}|'\+projectNote\)|\+projectNote\);/g)||[]).length;
  assert.ok(carried>=4,'nur '+carried+' Quittungen tragen den Hinweis');
});

test('Projektwissen bleibt streng und nennt die Projekte, die es gibt',()=>{
  assert.match(app,/ist kein Projekt im Office\.`\+/);
  assert.match(app,/Es gibt: \$\{known\}\. Über «Anpassen» kannst du den Namen ändern\./);
});
