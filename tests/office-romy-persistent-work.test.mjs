import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROMY_TOOLS,executeRomyTool} from '../supabase/functions/office-assistant/romy-tools.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const mission='99999999-9999-4999-8999-999999999999';
test('Persistent work requires a distinct explicit proposal; read-only access is private',async()=>{
 const names=ROMY_TOOLS.map(x=>x.name);
 for(const tool of ['propose_start_mission','propose_control_mission','list_missions'])
  assert.ok(names.includes(tool));
 const calls=[];
 const rows=[
  {id:mission,status:'waiting_for_user',objective:'Read-only planning',
   completion_criterion:'Review',iteration:1,max_iterations:5}
 ];
 const userDb={from(table){assert.equal(table,'office_romy_missions');
   return {
     select(){return this},
     order(){return this},
     eq(){return this},
     limit(){return Promise.resolve({data:rows,error:null})},
     maybeSingle(){return Promise.resolve({data:rows[0],error:null})}
   };
 }};
 const admin={from(table){assert.equal(table,'office_romy_proposals');return {
   insert(row){calls.push(row);return {select(){return {single:async()=>({data:{id:mission},error:null})}}}}
 }}};
 const v=await executeRomyTool('propose_start_mission',{objective:'Review project dependencies carefully',completion_criterion:'Produce a draft for approval'},
  {userDb,admin,userId:mission,conversationId:mission,requestId:mission,apiKey:null});
 assert.equal(v.kind,'start_mission');
 assert.equal(v.requires_explicit_confirmation,true);
 assert.equal(calls[0].kind,'start_mission');
 const list=await executeRomyTool('list_missions',{},{
   userDb,admin,userId:mission,conversationId:mission,requestId:mission});
 assert.equal(list.missions.length,1);assert.equal(list.writes_authorized,false);
});
test('Worker never receives a service role read tool for Office projects',()=>{
 const worker=read('supabase/functions/office-romy-mission-runner/index.ts');
 const sql=read('supabase/migrations/20261105143000_office_romy_persistent_work_v1.sql');
 const cron=read('supabase/migrations/20261105144000_office_romy_mission_schedule_v1.sql');
 assert.match(worker,/office_romy_runner_authorized/);
 assert.match(worker,/office_romy_claim_missions/);
 assert.match(worker,/office_romy_finish_mission/);
 assert.match(worker,/if\(authorized!==true/); // auth rejection is explicit
 assert.match(worker,/No tools or external actions are available/);
 assert.doesNotMatch(worker,/minds_work_files|read_text_file|list_projects|propose_create_event/);
 assert.match(sql,/enable row level security/g);
 assert.match(sql,/grant select on public\.office_romy_missions to authenticated/);
 assert.doesNotMatch(sql,/grant (insert|update|delete) on public\.office_romy_missions to authenticated/);
 assert.match(sql,/for update of m skip locked/);
 assert.match(sql,/lease_token=p_lease/);
 assert.match(sql,/unique\(mission_id,iteration,event_type\)/);
 assert.match(sql,/office_assistant_messages/);
 assert.match(cron,/private\.office_romy_runner_config/);
 assert.match(cron,/cron\.schedule/);
 assert.match(cron,/office-romy-mission-runner/);
 assert.match(cron,/grant execute on function public\.office_romy_runner_authorized\(text\) to service_role/);
});
test('Romy missions never modify Office data automatically',()=>{
 const tools=read('supabase/functions/office-assistant/romy-tools.mjs');
 const frontend=read('app/office-assistant.js');
 assert.match(tools,/kind:"start_mission"/);
 assert.match(tools,/kind:"control_mission"/);
 assert.match(tools,/status==="pending"/);
 assert.match(tools,/reviewRomyProposal/);
 assert.match(frontend,/p\.kind==='start_mission'/);
 assert.match(frontend,/p\.kind==='control_mission'/);
 assert.match(frontend,/review_proposal/);
});
