import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const runtime=()=>read('supabase/functions/office-assistant/romy-capability-runtime.ts');
const service=()=>read('supabase/functions/office-assistant/romy-capability-service.ts');
const inputs=()=>read('supabase/functions/office-assistant/romy-capability-inputs.ts');

test('Romy ports Window general_execution rather than inventing XLSX/PPTX makers',()=>{
 const r=runtime();
 for(const needle of [
   'CAPABILITY_RUNTIME_VERSION="capability-runtime-v0.3.0"',
   'GENERAL_EXECUTION_MODEL="gpt-6-astra"',
   'startGeneralExecution','retrieveGeneralExecution','cancelGeneralExecution',
   'type:"code_interpreter",container:{type:"auto",memory_limit:"4g"}',
   'model,background:true,store:true',
   'max_tool_calls:24',
   'allOutputFiles(apiKey,payload)',
   'downloadContainerFile(apiKey,file)',
   'container_file_citation'
 ])assert.ok(r.includes(needle),'missing Window runtime feature '+needle);
 for(const ext of ['docx','pdf','xlsx','pptx','csv','zip','html','txt','json'])
   assert.match(r,new RegExp('\\b'+ext+':\\{kind:'));
 assert.ok(!r.includes('makePowerpoint('));
 assert.ok(!r.includes('makeExcel('));
});

test('Office runtime isolates sources, metadata and generated files by employee',()=>{
 const sql=read('supabase/migrations/20261105054909_office_romy_capability_runtime_v1.sql');
 for(const needle of [
  'office_romy_capability_runs_owner_select',
  "revoke all on public.office_romy_capability_runs from public,anon,authenticated",
  'grant select on public.office_romy_capability_runs to authenticated',
  'user_id=(select auth.uid())',
  '(select private.office_is_member())',
  'unique(request_id,tool_call_id)',
  'foreign key(conversation_id,user_id)',
  "capability='general_execution'",
  "'xlsx','pptx'",
  'capability_run_id uuid references'
 ])assert.ok(sql.includes(needle),'security invariant missing '+needle);
 for(const removed of ['grant insert on public.office_romy_capability_runs to authenticated',
   'grant update on public.office_romy_capability_runs to authenticated','for insert to authenticated'])
    assert.ok(!sql.includes(removed),'browser cannot forge run state');
 const r=runtime();
 assert.ok(r.includes('admin.storage.from("office-romy-artifacts")'));
 assert.ok(r.includes('.eq("user_id",run.user_id)'));
 assert.ok(r.includes('content_sha256:hash'));
 assert.ok(r.includes('source_kind')===false||!r.includes('minds_artifacts'));
 assert.ok(r.includes('generated_deliverable_not_project_truth'));
 assert.ok(r.includes('deliverRomyCompletion'));
 assert.ok(r.includes('office_assistant_messages'));
});

test('Original Window input-file integrity preserved under Office RLS',()=>{
 const s=inputs();
 for(const key of [
  'MAX_INPUT_FILE_BYTES=12*1024*1024',
  'MAX_INPUT_TOTAL_BYTES=24*1024*1024',
  'if(out.length>=6)break',
  'inputRefs',
  'resolveRomyInputFiles',
  'office_romy_artifacts',
  'office-romy-artifacts',
  'minds_work_files','minds-work',
  'storage.from(bucket).download(row.storage_path)',
  'data:'
 ])assert.ok(s.includes(key),'file guard missing '+key);
 assert.ok(s.includes('.eq("id",ref.id).eq("user_id",userId).maybeSingle()'),'private artifact owner check');
 assert.ok(s.includes('input_work_file_not_found'));
 assert.ok(s.includes('kind==="image"?"png"'));
 assert.ok(s.includes('item?.type!=="input_file"&&item?.type!=="input_image"'));
 assert.ok(!s.includes('SUPABASE_SERVICE_ROLE_KEY'),'never read source with service role');
});

test('Chat integrates governed execution tools, status and cancellation after JWT/member check',()=>{
 const edge=read('supabase/functions/office-assistant/index.ts');
 const tools=read('supabase/functions/office-assistant/romy-tools.mjs');
 const svc=service();
 for(const name of ['execute_artifact_task','check_artifact_task']){
   assert.ok(tools.includes('name:"'+name+'"'),name);
 }
 for(const snippet of [
   'from "./romy-capability-service.ts"',
   'call.name==="execute_artifact_task"',
   'startRomyCapability({',
   'call.name==="check_artifact_task"',
   'action==="capability_status"',
   'action==="capability_cancel"',
   'action==="capability_list"',
   'member_not_active'
 ])assert.ok(edge.includes(snippet),'edge missing '+snippet);
 assert.ok(svc.includes('eq("user_id",userId)'),'owner scoping');
 assert.ok(svc.includes('.eq("request_id",requestId)'));
 assert.ok(svc.includes('.eq("tool_call_id",callId)'));
 assert.ok(svc.includes('resolveRomyInputFiles(userDb,userId,refs)'),'source JWT');
 assert.ok(svc.includes('startGeneralExecution(apiKey'));
 assert.ok(svc.includes('reconcileRomyRun(admin,apiKey,run)'));
 assert.ok(svc.includes('cancelGeneralExecution(apiKey,run.provider_response_id)'));
 assert.ok(svc.includes('return {error:"provider_cancel_unconfirmed"'),'do not fake cancellation');
});

test('Romy keeps the original Window chat and offers resumable private jobs',()=>{
 const ui=read('app/office-assistant.js');
 const app=read('app/app.js');
 const html=read('app/index.html');
 for(const needle of [
   "checkCapabilityRuns(conversationId)",
   "office_romy_capability_runs",
   "action:'capability_status'",
   "action:'capability_cancel'",
   "Meine Arbeitsaufträge",
   "ownerId===owner",
   "threadId===conversationId",
   "loadThread(conversationId,{internal:true,skipRuns:true})"
 ])assert.ok(ui.includes(needle),'UI run recovery missing '+needle);
 assert.ok(ui.includes('window.confirm('));
 assert.ok(ui.includes('app()?.openModal?.('));
 assert.ok(ui.includes("clearTimeout(capabilityTimer)"));
 assert.ok(html.includes('office-assistant.js?v=office35'));
 assert.ok(app.includes('generated-artifact generated-file'));
 assert.ok(app.includes("OFFICE?'office-romy-artifacts':'minds-artifacts'"));
 assert.ok(!ui.includes('office-chat-layout'));
 new Function(ui);
});

test('Skills guide new general_execution without silently granting authority',()=>{
 const skills=read('supabase/functions/office-assistant/romy-skills.mjs');
 assert.ok(skills.includes('execute_artifact_task'));
 assert.ok(skills.includes('Work Threads are not available in Office'));
 assert.ok(!skills.includes('general execution runtime are not available'));
 assert.ok(read('supabase/functions/office-assistant/index.ts').includes('skillTrace=composeSkillTrace'));
});
