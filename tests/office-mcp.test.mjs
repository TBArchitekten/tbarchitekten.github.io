// The TBA Office connector for Claude (step 4, decision of Gari 07.11.2026: like Window's, may read everything).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOfficeTools,ToolError,inRange} from '../supabase/functions/office-mcp/office-tools.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const ME='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222';
const P='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
// A tiny stand-in for supabase-js: records each query and answers from `answer(table, query)`.
function fakeSb(answer,log=[]){
  const make=table=>{
    const q={table,ops:[]};
    const chain=new Proxy({},{get(_,name){
      if(name==='then')return (ok,bad)=>Promise.resolve(answer(table,q)).then(data=>({data,error:null})).then(ok,bad);
      return (...args)=>{q.ops.push([name,...args]);if(['insert','update'].includes(name))q.write=args[0];return chain};
    }});
    log.push(q);return chain;
  };
  return {from:make,storage:{from:()=>({download:async()=>({data:new Blob([answer('storage',{})]),error:null})})}};
}
const projects=[{id:P,client_key:'bernried',name:'Bernried',number:'2401',archived:false}];
const now=()=>new Date('2026-11-07T10:00:00Z');

test('today: overdue and multi-day tasks in progress, own and assigned marked, like Window and Romy', async()=>{
  const tasks=[
    {id:'t1',title:'Test',due_date:'2026-11-04',completed_at:null,user_id:ME,project_id:null},
    {id:'t2',title:'Heute',due_date:'2026-11-07',completed_at:null,user_id:OTHER,assignee_person_id:ME,project_id:P},
    {id:'t3',title:'Mehrtägig',start_date:'2026-11-05',due_date:'2026-11-12',completed_at:null,user_id:OTHER,project_id:P},
    {id:'t4',title:'Später',start_date:'2026-11-10',due_date:'2026-11-12',completed_at:null,user_id:ME,project_id:P}];
  const sb=fakeSb((t)=>t==='isabella_projects'?projects:t==='office_members'?[{user_id:ME,display_name:'Gari'},{user_id:OTHER,display_name:'Anna'}]
    :t==='isabella_tasks'?tasks:t==='minds_work_task_assignees'?[{task_id:'t3'}]:[]);
  const tools=createOfficeTools({sb,userId:ME,now});
  const r=await tools.listTasks({range:'today'});
  assert.equal(r.today,'2026-11-07');
  assert.deepEqual(r.tasks.map(t=>[t.id,!!t.overdue,!!t.mine,t.project]),[['t1',true,true,null],['t2',false,true,'Bernried'],['t3',false,true,'Bernried']]);
  assert.equal(r.tasks[1].assignee,'Gari');
  assert.equal(inRange({start_date:'2026-11-10',due_date:'2026-11-12'},'2026-11-07','2026-11-14'),true);
});

test('Fristen are the Terminplan milestones in range', async()=>{
  const plans=[{id:'p',project_id:P,phase:'LPH3',state:{tasks:[{type:'milestone',name:'Abgabe Entwurf',start:'2026-11-16'},{type:'task',name:'Entwurf',start:'2026-11-08'},{type:'milestone',name:'Alt',start:'2026-10-01'}]}}];
  const sb=fakeSb(t=>t==='isabella_projects'?projects:t==='office_terminplan_instances'?plans:[]);
  const r=await createOfficeTools({sb,userId:ME,now}).deadlines({});
  assert.deepEqual(r.deadlines,[{date:'2026-11-16',title:'Abgabe Entwurf',project:'Bernried',plan:'Terminplan LPH3'}]);
});

test('read_file: text directly, PDF/Word/Excel through extractText, paged', async()=>{
  const file={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Protokoll.txt',mime_type:'text/plain',size_bytes:10,storage_path:'x',project_id:P,created_at:'2026-11-01T00:00:00Z'};
  const sb=fakeSb(t=>t==='isabella_projects'?projects:t==='minds_work_files'?file:t==='storage'?'abcdefghij':[]);
  const tools=createOfficeTools({sb,userId:ME,now});
  const r=await tools.readFile({file_id:file.id,max_chars:1000});
  assert.equal(r.text,'abcdefghij');assert.equal(r.next_offset,null);assert.equal(r.file.project,'Bernried');
  let called=null;
  const pdf={...file,name:'Statik.pdf',mime_type:'application/pdf'};
  const sb2=fakeSb(t=>t==='isabella_projects'?projects:t==='minds_work_files'?pdf:t==='storage'?'%PDF':[]);
  const r2=await createOfficeTools({sb:sb2,userId:ME,now,extractText:async(b,m,n)=>{called=[m,n];return {text:'x'.repeat(2500)}}}).readFile({file_id:file.id,max_chars:1000});
  assert.deepEqual(called,['application/pdf','Statik.pdf']);
  assert.equal(r2.text.length,1000);assert.equal(r2.next_offset,1000);assert.equal(r2.total_chars,2500);
  await assert.rejects(()=>tools.readFile({file_id:'nope'}),ToolError);
});

test('search_files finds names and the files inside matching folders', async()=>{
  const F='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const sb=fakeSb((t,q)=>{
    if(t==='isabella_projects')return projects;
    if(t==='minds_work_folders')return q.ops.some(o=>o[0]==='ilike')?[{id:F,name:'Statik',parent_id:null,project_id:P}]:[{id:F,name:'Statik',parent_id:null}];
    if(t==='minds_work_files')return q.ops.some(o=>o[0]==='in')?[{id:'f2',name:'Pos 12.pdf',folder_id:F,project_id:P}]:[{id:'f1',name:'Statik Freigabe.pdf',folder_id:null,project_id:P}];
    return [];
  });
  const r=await createOfficeTools({sb,userId:ME,now}).searchFiles({query:'Statik'});
  assert.deepEqual(r.results.map(x=>[x.id,x.folder||'']),[['f1',''],['f2','Statik']]);
});

test('create_task writes as the employee; update_task refused when RLS returns nothing', async()=>{
  const log=[];
  const sb=fakeSb((t,q)=>t==='isabella_projects'?projects:t==='isabella_tasks'&&q.write?{id:q.write.id,title:q.write.title,due_date:q.write.due_date,project_id:q.write.project_id}:[],log);
  const tools=createOfficeTools({sb,userId:ME,now,uuid:()=>'dddddddd-dddd-4ddd-8ddd-dddddddddddd'});
  const r=await tools.createTask({title:'Fenster prüfen',project:'Bernried',due_date:'2026-11-10'});
  const ins=log.find(q=>q.table==='isabella_tasks'&&q.write).write;
  assert.equal(ins.user_id,ME);assert.equal(ins.client_key,ins.id);assert.equal(ins.project_id,P);assert.deepEqual(ins.metadata,{source:'claude_connector'});
  assert.equal(r.created.project,'Bernried');
  await assert.rejects(()=>tools.createTask({title:'x',due_date:'10.11.2026'}),ToolError);
  const sb2=fakeSb((t,q)=>t==='isabella_projects'?projects:t==='isabella_tasks'?(q.write?null:{id:'t',title:'x',user_id:OTHER}):[]);
  await assert.rejects(()=>createOfficeTools({sb:sb2,userId:ME,now}).updateTask({task_id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',done:true}),/nicht ändern/);
});

test('The server: OAuth metadata, own 401, active members only, no service key, deploy without gateway JWT', ()=>{
  const src=read('supabase/functions/office-mcp/index.ts');
  assert.match(src,/const RESOURCE=SUPABASE_URL\+"\/functions\/v1\/office-mcp";/);
  assert.match(src,/authorization_servers:\[SUPABASE_URL\+"\/auth\/v1"\]/);
  assert.match(src,/"WWW-Authenticate":`Bearer resource_metadata="\$\{METADATA_URL\}"/);
  assert.match(src,/if\(memberError\|\|!member\?\.is_active\)return json\(\{error:"not_an_active_member"/);
  assert.match(src,/if\(member\.must_change_password\)/);
  assert.doesNotMatch(src,/SERVICE_ROLE|service_role/);
  for(const tool of ['overview','list_projects','project_context','list_deadlines','search_files','read_file','list_tasks','list_events','create_task','update_task'])
    assert.ok(src.includes('server.registerTool("'+tool+'"'),tool);
  const cfg=read('supabase/config.toml');
  assert.match(cfg,/\[functions\.office-mcp\]\nverify_jwt = false/);
  const consent=read('oauth-consent.html');
  assert.match(consent,/TBA Office/);
});
