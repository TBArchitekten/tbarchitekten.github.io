import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('All five mobile tabs share the Window navigation order on Office root and app',()=>{
  const index=read('index.html');
  const shell=read('app/shell.js');
  const expected=['Romy','Heute','Kalender','Work','Tools'];
  const root=index.slice(index.indexOf('<nav id="lenses"'),index.indexOf('</nav>'));
  const inside=shell.slice(shell.indexOf('<nav id="mainNav"'),shell.indexOf('</nav>',shell.indexOf('<nav id="mainNav"')));
  const officeLinks=expected.map(label=>root.indexOf('aria-label="'+label+'"'));
  const appLinks=expected.map(label=>inside.indexOf('aria-label="'+label+'"'));
  assert.ok(officeLinks.every(x=>x>=0)&&appLinks.every(x=>x>=0));
  assert.deepEqual([...officeLinks].sort((a,b)=>a-b),officeLinks);
  assert.deepEqual([...appLinks].sort((a,b)=>a-b),appLinks);
  assert.equal((index.match(/id="accountButton"/g)||[]).length,1);
  assert.ok(index.indexOf('class="lens-account"')>index.indexOf('</nav>'));
});
test('Root navigation remains a five-button floating bar on mobile, with account outside',()=>{
  const css=read('style.css'),rootJs=read('app.js'),index=read('index.html');
  assert.ok(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))'));
  assert.ok(css.includes('#appView>.lens-account'));
  assert.ok(index.includes('href="./app/#section=assistant" aria-label="Romy"'));
  assert.ok(index.includes('style.css?v=office25'));
  assert.ok(index.includes('app.js?v=6'));
});
test('Tools opens inside the Window shell, while Terminplan remains available',()=>{
  const shell=read('app/shell.js'),app=read('app/app.js');
  assert.ok(shell.includes('id="toolsScreen"'));
  assert.ok(shell.includes('data-nav="tools"'));
  assert.ok(app.includes("'calendar','tools','projects','plans','readings'"));
  assert.ok(shell.includes('id="officeToolsPlans"'));
  assert.ok(!shell.includes('href="../#plans"'));
});
