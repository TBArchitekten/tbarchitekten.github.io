// 07.11.2026, Gari: Romy said nothing was pending for tomorrow although "Test" (due 04.11) was still open;
// in Office the Kategorie is superfluous (everything is work); "Neu anlegen" in the calendar must show every field.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shapeTaskRows,executeRomyTool} from '../supabase/functions/office-assistant/romy-tools.mjs';
import {createOfficeTools} from '../supabase/functions/office-mcp/office-tools.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const me='11111111-1111-4111-8111-111111111111';
const rows=[
  {id:'a',title:'Test',due_date:'2026-11-04',start_date:'2026-11-04',completed_at:null,user_id:me},
  {id:'b',title:'Heute',due_date:'2026-11-07',completed_at:null,user_id:me},
  {id:'c',title:'Morgen',due_date:'2026-11-08',completed_at:null,user_id:me},
  {id:'d',title:'Mehrtägig',start_date:'2026-11-06',due_date:'2026-11-10',completed_at:null,user_id:me},
  {id:'e',title:'Übermorgen',due_date:'2026-11-09',completed_at:null,user_id:me}];

test('Romy, a specific day (tomorrow): still-open older tasks count, overdue measured against today', ()=>{
  const out=shapeTaskRows(rows,{day:'2026-11-08',range:'day',userId:me,today:'2026-11-07'});
  assert.deepEqual(out.map(t=>[t.id,!!t.overdue,!!t.in_progress]),
    [['a',true,false],['b',false,false],['c',false,false],['d',false,true]]);
  const src=read('supabase/functions/office-assistant/romy-tools.mjs');
  assert.match(src,/day:\{type:"string",description:"YYYY-MM-DD, for 'what is pending on <day>' \(e\.g\. tomorrow\)"\}/);
  assert.match(src,/never use due_from\/due_to for such questions/);
  assert.match(read('supabase/functions/office-assistant/index.ts'),/Für morgen oder einen anderen Tag: list_tasks mit day/);
});

test('Romy list_tasks with day: the query takes everything due by that day and still open', async()=>{
  const ops=[];
  const chain=new Proxy({},{get(_,name){
    if(name==='then')return ok=>ok({data:rows.slice(0,4),error:null});
    return (...args)=>{ops.push([name,...args]);return chain};
  }});
  const userDb={from:()=>chain};
  const r=await executeRomyTool('list_tasks',{day:'2026-11-08'},{userDb,userId:me});
  assert.equal(r.day,'2026-11-08');assert.equal(r.range,'day');
  assert.ok(ops.some(o=>o[0]==='or'&&o[1]==='due_date.lte.2026-11-08,start_date.lte.2026-11-08'));
  assert.ok(r.tasks.find(t=>t.id==='a').overdue);
  assert.equal((await executeRomyTool('list_tasks',{day:'8.11.'},{userDb,userId:me})).error,'invalid_day');
});

test('Connector list_tasks with day behaves the same', async()=>{
  const sb={from:t=>{const c=new Proxy({},{get(_,n){if(n==='then')return ok=>ok({data:t==='isabella_tasks'?rows:[],error:null});return ()=>c}});return c}};
  const tools=createOfficeTools({sb,userId:me,now:()=>new Date('2026-11-07T18:00:00Z')});
  const r=await tools.listTasks({day:'2026-11-08'});
  assert.equal(r.range,'day');assert.equal(r.today,'2026-11-07');
  assert.deepEqual(r.tasks.map(t=>[t.id,!!t.overdue]),[['a',true],['b',false],['c',false],['d',false]]);
});

test('Office: no Kategorie in the task editor, the Termin forms, Heute or the menu; new items are "Arbeit"', ()=>{
  const detail=read('app/task-detail.js'),app=read('app/app.js'),shell=read('app/shell.js'),ahora=read('app/ahora.js'),sync=read('app/sync.js');
  assert.match(detail,/const HIDE_CATEGORY=!!window\.TBA_OFFICE_CONFIG;/);
  assert.match(detail,/\(HIDE_CATEGORY\?'':'<label>Kategorie<select id="taskDetailCategory">'/);
  assert.match(detail,/const categoryKey=opts\.categoryKey\|\|\(HIDE_CATEGORY\?'arbeit':null\);/);
  assert.match(detail,/category_id:categoryField\?\(categoryField\.value\|\|null\):\(ctx\.categoryId\|\|null\)/);
  assert.match(app,/\$\{OFFICE\?'':`<label>Kategorie<select id="editCategory">/);
  assert.match(app,/\$\{OFFICE\?'':`<label>Kategorie<select id="newCat">/);
  assert.match(app,/categoryId:OFFICE\?'arbeit':/);
  assert.match(app,/const groups=OFFICE\n\s*\?\[\.\.\.state\.projects\.map/);
  assert.doesNotMatch(shell,/data-action="categories"/);
  assert.doesNotMatch(ahora,/nameOf\(state\.categories/);
  assert.equal((sync.match(/categoryId:catKey\.get\([te]\.category_id\)\|\|'arbeit'/g)||[]).length,2);
});

test('"Neu anlegen": a task opens the complete editor with the date; Termin has every field; the switch keeps what was typed', ()=>{
  const app=read('app/app.js'),detail=read('app/task-detail.js');
  assert.match(app,/function newPanel\(presetDate=null,kind='task',draft=\{\}\)\{/);
  assert.match(app,/void window\.MINDS_TASK_DETAIL\.open\(\{date,projectKey:draft\.projectKey\|\|null,/);
  assert.match(app,/onSwitchKind:d=>newPanel\(presetDate,'event',d\)/);
  for(const id of ['newTitle','newDate','newTime','newDuration','newProject','newNotes'])assert.ok(app.includes('id="'+id+'"'),id);
  assert.match(app,/duration:Math\.max\(5,Number\(\$\('#newDuration'\)\.value\)\|\|60\),notes:\$\('#newNotes'\)\.value\|\|''/);
  assert.doesNotMatch(app,/MINDS_TASK_DETAIL\.createQuick\(/,'no short form any more');
  assert.match(detail,/id="taskDetailToEvent"/);
  assert.match(detail,/const t=ctx\.task\|\|ctx\.draft\|\|\{\}/);
  assert.match(detail,/ctx\.draft=readDraft\(\);/,'choosing a project keeps the typed title and dates');
});
