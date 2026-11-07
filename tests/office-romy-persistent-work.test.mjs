import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROMY_TOOLS,executeRomyTool} from '../supabase/functions/office-assistant/romy-tools.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const mission='99999999-9999-4999-8999-999999999999';
test('Missions are hidden until they can read real Office data (Gari, 07.11.2026)',async()=>{
 const names=ROMY_TOOLS.map(x=>x.name);
 for(const tool of ['propose_start_mission','propose_control_mission','list_missions'])
  assert.ok(!names.includes(tool),tool+' is not offered to the model');
 const code=read('supabase/functions/office-assistant/romy-tools.mjs');
 assert.match(code,/export const ROMY_MISSIONS_ENABLED=false;/);
 for(const tool of ['propose_start_mission','propose_control_mission','list_missions']){
  const v=await executeRomyTool(tool,{objective:'x',completion_criterion:'y'},
   {userDb:null,admin:null,userId:mission,conversationId:mission,requestId:mission,apiKey:null});
  assert.equal(v.error,'missions_disabled');
 }
 assert.doesNotMatch(read('supabase/functions/office-assistant/index.ts'),/propose_start_mission/);
 const paused=read('supabase/migrations/20261107062251_office_romy_missions_paused.sql');
 assert.match(paused,/cron\.alter_job\(job_id := \(select jobid from cron\.job where jobname='office-romy-mission-runner'\), active := false\)/);
});
test('Worker never receives a service role read tool for Office projects',()=>{
 const worker=read('supabase/functions/office-romy-mission-runner/index.ts');
 const sql=read('supabase/migrations/20261105121203_office_romy_persistent_work_v1.sql');
 const cron=read('supabase/migrations/20261105121223_office_romy_mission_schedule_v1.sql');
 assert.match(worker,/office_romy_runner_authorized/);
 assert.match(worker,/office_romy_claim_missions/);
 assert.match(worker,/office_romy_finish_mission/);
 assert.match(worker,/authorized!==true/); // auth rejection is explicit
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
 assert.match(tools,/proposal.status!=="pending"/);
 assert.match(tools,/reviewRomyProposal/);
 assert.match(frontend,/p\.kind==='start_mission'/);
 assert.match(frontend,/p\.kind==='control_mission'/);
 assert.match(frontend,/review_proposal/);
});
