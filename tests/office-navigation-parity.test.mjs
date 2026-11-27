import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('All five mobile tabs share the Window navigation order in the app; the start page has no second navigation',()=>{
  // Seit dem 27.11.2026 ist die Startseite nur die Anmeldung: eine Navigation gibt es nur noch in der App.
  const index=read('index.html');
  const shell=read('app/shell.js');
  const expected=['Romy','Heute','Kalender','Work','Tools'];
  const inside=shell.slice(shell.indexOf('<nav id="mainNav"'),shell.indexOf('</nav>',shell.indexOf('<nav id="mainNav"')));
  const appLinks=expected.map(label=>inside.indexOf('aria-label="'+label+'"'));
  assert.ok(appLinks.every(x=>x>=0));
  assert.deepEqual([...appLinks].sort((a,b)=>a-b),appLinks);
  assert.doesNotMatch(index,/<nav|id="accountButton"|class="lens-account"/);
});
test('The start page loads its sign-in script and the shared styles with versions',()=>{
  const index=read('index.html');
  assert.ok(index.includes('style.css?v=office29'));
  assert.ok(index.includes('app.js?v=10'));
});
test('Tools opens inside the Window shell, while Terminplan remains available',()=>{
  const shell=read('app/shell.js'),app=read('app/app.js');
  assert.ok(shell.includes('id="toolsScreen"'));
  assert.ok(shell.includes('data-nav="tools"'));
  assert.ok(app.includes("'calendar','tools','projects','plans','readings'"));
  assert.ok(shell.includes('id="officeToolsPlans"'));
  assert.ok(!shell.includes('href="../#plans"'));
});
