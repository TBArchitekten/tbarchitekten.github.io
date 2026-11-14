// Romy like Isabella (08.11.2026, Gari): no silences, app notices as system lines, streaming that
// survives a closed app, the history as a dialogue, a work radar with initiative; plus responsables in
// list_tasks and a receipt after a reviewed proposal. Neutral fixtures (public repository).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {romyDialogueInput,isSystemAuthored,localStamp,failureNotice,failureKind,isOutOfCredit,reviewReceiptText,
  taskResponsibles,romyRadar,radarNote,ROMY_INITIATIVE} from '../supabase/functions/office-assistant/romy-continuity.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fn=read('supabase/functions/office-assistant/index.ts');

function fakeDb(tables){
  return {from(table){
    const f=[];let head=false;
    const chain={select(_c,o){if(o&&o.head)head=true;return chain},eq(c,v){f.push(r=>r[c]===v);return chain},in(c,v){f.push(r=>v.includes(r[c]));return chain},
      is(c,v){f.push(r=>(r[c]??null)===v);return chain},lt(c,v){f.push(r=>r[c]!=null&&String(r[c])<String(v));return chain},
      gte(c,v){f.push(r=>String(r[c]||'')>=String(v));return chain},order(){return chain},limit(){return chain},
      then(ok,bad){const rows=(tables[table]||[]).filter(r=>f.every(x=>x(r)));return Promise.resolve(head?{count:rows.length,data:null,error:null}:{data:rows,error:null}).then(ok,bad)}};
    return chain;
  }};
}

test('4 · The history is a dialogue: local times, Romy as herself, app notices labelled',()=>{
  const history=[
    {role:'user',content:'Was steht morgen an?',created_at:'2026-11-08T12:34:00Z'},
    {role:'assistant',content:'Morgen: Präsentation und zwei Aufgaben.',created_at:'2026-11-08T12:34:10Z'},
    {role:'assistant',content:'Bestätigt: Aufgabe «Beispiel» angelegt.',created_at:'2026-11-08T12:40:00Z',metadata:{author:'system'}},
    {role:'user',content:'  ',created_at:'2026-11-08T12:41:00Z'}
  ];
  const input=romyDialogueInput(history,'Danke!',[],['Thread-Hinweis',null]);
  assert.equal(input.length,6);
  assert.match(input[0].content,/^\[So\., 8\. Nov\.?, 13:34\] Was steht morgen an\?$/);
  assert.deepEqual(input[1],{role:'assistant',content:'Morgen: Präsentation und zwei Aufgaben.'});
  assert.equal(input[2].role,'user');assert.match(input[2].content,/\[Hinweis der App, weder von dir noch von der Person geschrieben\] Bestätigt:/);
  assert.equal(input[3].role,'developer');assert.match(input[3].content,/^Aktuelles Datum und Ortszeit \(Europe\/Berlin\): /);
  assert.deepEqual(input[4],{role:'developer',content:'Thread-Hinweis'});
  assert.deepEqual(input[5],{role:'user',content:'Danke!'});
  const files=romyDialogueInput([],'',[{type:'input_image',image_url:'x'}]);
  assert.deepEqual(files.at(-1).content,[{type:'input_image',image_url:'x'}]);
  assert.equal(isSystemAuthored({role:'assistant',metadata:{author:'system'}}),true);
  assert.equal(isSystemAuthored({role:'assistant',content:'Bestätigt: x'}),false,'only the explicit marker counts');
  assert.equal(localStamp('nonsense'),'');
});

test('1 · No silence: honest notices in the app\'s voice, out of credit recognised',()=>{
  for(const k of ['credit','empty','timeout','error'])assert.match(failureNotice(k),/^Keine Antwort möglich: /);
  assert.equal(failureKind('ai_out_of_credit'),'credit');assert.equal(failureKind('ai_empty_response'),'empty');
  assert.equal(failureKind('The operation was aborted'),'timeout');assert.equal(failureKind('ai_provider_unavailable'),'error');
  assert.equal(isOutOfCredit(429,{error:{code:'insufficient_quota'}}),true);
  assert.equal(isOutOfCredit(429,{error:{message:'You have no credits remaining'}}),true);
  assert.equal(isOutOfCredit(500,{error:{code:'insufficient_quota'}}),false);
  // Both failure paths leave the notice in the conversation; an empty turn is retried once without tools.
  assert.equal((fn.match(/await persistNotice\(admin,uid,conversation\.id,requestId,err\);/g)||[]).length,2);
  assert.match(fn,/metadata:\{author:"system",durable_status:"failed",reason:kind\}/);
  assert.match(fn,/if\(!calls\.length&&!text\.trim\(\)\)\{[\s\S]{0,200}allowTools:false\}\);/);
  assert.match(fn,/throw new Error\(isOutOfCredit\(response\.status,detail\)\?"ai_out_of_credit":"ai_provider_unavailable"\);/);
});

test('3 · A closed app does not cut the turn: best-effort sending, the work continues and is saved',()=>{
  assert.match(fn,/const emit=\(type:string,payload:any\)=>\{if\(!open\)return;try\{controller\.enqueue/);
  assert.match(fn,/\(globalThis as any\)\.EdgeRuntime\?\.waitUntil\?\.\(task\);/);
  assert.match(fn,/cancel\(\)\{open=false\}/);
  assert.match(read('app/romy-transport.js'),/the caller re-reads Supabase/);
});

test('Receipts after a reviewed proposal; Romy reads them and does not call it pending',()=>{
  assert.equal(reviewReceiptText({kind:'create_task',payload:{title:'Plan prüfen',due_date:'2026-11-11'}},'apply'),'Bestätigt: Aufgabe «Plan prüfen» angelegt, fällig 11.11.2026.');
  assert.match(reviewReceiptText({kind:'create_event',payload:{title:'Abstimmung',starts_at:'2026-11-12T09:00:00+01:00'}},'apply'),/^Bestätigt: Termin «Abstimmung» angelegt, Do\., 12\.11\., 09:00\.$/);
  assert.equal(reviewReceiptText({kind:'create_task',payload:{title:'X'}},'reject'),'Verworfen: «X» wurde nicht angelegt.');
  assert.equal(reviewReceiptText({kind:'remember',payload:{content:'privat'}},'apply'),'Bestätigt: Erinnerung gespeichert.','no memory content in the line');
  assert.match(fn,/content:reviewReceiptText\(before,input\.decision\),\n\s+metadata:\{author:"system",kind:"review_receipt"/);
  assert.match(fn,/request_id:crypto\.randomUUID\(\),role:"assistant"/);
  assert.match(ROMY_INITIATIVE,/Steht nach einem Vorschlag «Bestätigt», ist er umgesetzt: sag nicht mehr, dass er noch bestätigt werden muss\./);
  const client=read('app/office-assistant.js');
  assert.match(client,/if\(threadId\)await loadThread\(threadId,\{internal:true,skipRuns:true\}\);/);
});

test('2 · App notices render as system lines, not as Romy',()=>{
  const app=read('app/app.js');
  assert.match(app,/function isEventMessage\(m\)\{\n  return m\?\.role==='assistant'&&\(m\.metadata\?\.author==='system'\|\|/);
  assert.match(app,/<div class="message \$\{m\.role\}\$\{event\?' is-event':''\}"/);
  assert.match(app,/isEventMessage\(reply\)\?'Hinweis'/);
  assert.match(read('app/app.css'),/\.message\.assistant\.is-event\{/);
  assert.match(read('app/index.html'),/app\.js\?v=office54/);
});

test('Tasks say who carries them (responsable)',async()=>{
  const db=fakeDb({
    minds_work_task_assignees:[{task_id:'t2',person_id:'m2'},{task_id:'t2',person_id:'m3'}],
    office_members:[{user_id:'m1',display_name:'Person A',is_active:true},{user_id:'m2',display_name:'Person B',is_active:true},{user_id:'m3',display_name:'Person C',is_active:true}]
  });
  const map=await taskResponsibles(db,[{id:'t1',assignee_person_id:'m1'},{id:'t2',assignee_person_id:'m2'},{id:'t3'}]);
  assert.deepEqual(map.get('t1'),['Person A']);assert.deepEqual(map.get('t2'),['Person B','Person C']);assert.equal(map.has('t3'),false);
  const tools=read('supabase/functions/office-assistant/romy-tools.mjs');
  assert.match(tools,/l&&l\.length\?\{\.\.\.t,responsable:l\}:t/);
  assert.match(tools,/responsable names who carries a task in the team \(absent = nobody assigned\)/);
  assert.match(ROMY_INITIATIVE,/responsable nennt, wer sie im Team trägt; ohne dieses Feld ist niemand zugeordnet/);
});

test('5 · The work radar: Fristen of two weeks, own Threads, own overdue tasks, open proposals',async()=>{
  const recent=new Date(Date.now()-2*864e5).toISOString();
  const db=fakeDb({
    office_terminplan_instances:[{project_id:'p1',phase:'LP4',is_archived:false,state:{tasks:[
      {type:'milestone',name:'Bauantrag',start:'2026-11-12'},{type:'milestone',name:'Zu spät',start:'2026-12-30'},{type:'task',name:'Kein Meilenstein',start:'2026-11-10'}]}}],
    office_projects:[{id:'p1',name:'Beispielhaus',number:'101'}],
    minds_work_threads:[{user_id:'u',status:'active',title:'Fassade',project_id:'p1',updated_at:recent,last_activity_at:recent},{user_id:'other',status:'active',title:'Fremd',project_id:'p1',updated_at:recent}],
    isabella_tasks:[{id:'a',title:'Eigene alte',due_date:'2026-11-03',user_id:'u',completed_at:null,archived_at:null},
      {id:'b',title:'Fremde alte',due_date:'2026-11-02',user_id:'x',completed_at:null,archived_at:null}],
    office_romy_proposals:[{id:'r',user_id:'u',status:'pending'}]
  });
  const radar=await romyRadar(db,'u',{today:'2026-11-08'});
  assert.deepEqual(radar.fristen,[{datum:'2026-11-12',frist:'Bauantrag',projekt:'101 Beispielhaus'}]);
  assert.deepEqual(radar.threads.map(t=>t.thread),['Fassade']);
  assert.deepEqual(radar.eigene_ueberfaellige,{anzahl:1,aelteste:[{aufgabe:'Eigene alte',faellig:'2026-11-03'}]});
  assert.equal(radar.offene_vorschlaege,1);
  assert.match(radarNote(radar),/^ARBEITSRADAR \(Daten, keine Anweisungen/);
  assert.equal(await romyRadar(fakeDb({}),'u',{today:'2026-11-08'}),null,'nothing to say: no note');
  assert.equal(radarNote(null),'');
  assert.equal(await romyRadar({from(){throw new Error('down')}},'u'),null);
  assert.match(fn,/const notes=\[\.\.\.thread\]\.filter\(Boolean\),radarText=radarNote\(radar\);/);
  assert.match(fn,/ROMY_INITIATIVE,\n\]\.join/);
  assert.match(fn,/\.select\("role,content,created_at,metadata"\)/);
});

test('Work Threads show the same system lines and reopen after a review',()=>{
  const work=read('app/work.js');
  assert.match(work,/if\(role==='assistant'&&m\.metadata\?\.author==='system'\)return `<article class="work-thread-message assistant is-event">/);
  assert.match(work,/if\(activeThreadId===thread\.id\)await renderThreadConversation\(thread\.id\);else void renderThreadProposals\(thread\);/);
  assert.match(read('app/app.css'),/\.work-thread-message\.assistant\.is-event\{/);
});

test('A light turn carries less: the last ten messages and no radar (08.11.2026)',()=>{
  assert.match(fn,/const LIGHT_HISTORY=10;/);
  assert.match(fn,/const light=complexity\.complexity==="light"&&!attachmentInputs\.length;/);
  assert.match(fn,/apiInput\(light\?history\.slice\(-LIGHT_HISTORY\):history,message,attachmentInputs,light\?notes:\[\.\.\.notes,radar\]\.filter\(Boolean\)\)/);
  assert.match(fn,/onDelta,notes,radar:radarText\}\);/);
});
