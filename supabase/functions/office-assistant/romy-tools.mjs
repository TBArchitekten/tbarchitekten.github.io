import { validOfficeDate, berlinDateRangeUtc, parseExplicitZonedInstant } from "./romy-time.mjs";
import { searchRomySemanticMemory } from "./romy-semantic-memory.mjs";
// Adapted tool boundary for Romy using Window's explicit tool/approval discipline.
// Queries execute with the employee's JWT and the Office RLS policies,
// never with a shared service-role reader.
export const ROMY_TOOLS=[
 {type:"function",name:"list_skills",description:"List versioned procedures ported from Window; Skills teach workflows but never grant permissions.",strict:false,parameters:{type:"object",properties:{},additionalProperties:false}},
 {type:"function",name:"load_skill",description:"Load a trusted full Window Skill by exact slug. Maximum four complementary Skills per turn; it cannot authorize actions.",strict:false,parameters:{type:"object",properties:{slug:{type:"string"}},required:["slug"],additionalProperties:false}},
 {type:"function",name:"search_personal_memory",description:"Search this employee's confirmed private memories only; not arbitrary past chat claims or model inferences.",strict:false,parameters:{type:"object",properties:{query:{type:"string"},kind:{type:"string",enum:["fact","preference"]}},additionalProperties:false}},
 {type:"function",name:"search_semantic_history",
 description:"Find conceptually relevant passages in this employee's own past conversations and confirmed memories, even when vocabulary differs. Results have original source IDs and provenance. A past message is NOT an accepted fact. Indexing is bounded and may not cover very old conversations.",
 strict:false,parameters:{type:"object",properties:{query:{type:"string"}},required:["query"],additionalProperties:false}},
 {type:"function",name:"search_conversation_history",
 description:"Search the current employee's prior private conversations, with message provenance and dates. Results are historical conversation, not accepted autobiographical memory. Never use other employees' conversations.",
 strict:false,parameters:{type:"object",properties:{query:{type:"string"}},required:["query"],additionalProperties:false}},
 {type:"function",name:"search_generated_artifacts",
 description:"Find private output files previously generated for this employee, by exact UUID, title, format and creation date. Returns safe artifact IDs for execute_artifact_task input_files; generated files are deliverables, not confirmed project facts.",
 strict:false,parameters:{type:"object",properties:{query:{type:"string"},kind:{type:"string"}},additionalProperties:false}},
 {type:"function",name:"propose_remember",description:"Propose a fact or preference to remember. Must be reviewed by this employee; cannot save accepted memory autonomously.",strict:false,parameters:{type:"object",properties:{kind:{type:"string",enum:["fact","preference"]},content:{type:"string"}},required:["kind","content"],additionalProperties:false}},

 {type:"function",name:"list_missions",description:"Read this employee's own persistent commitments and states. A queued/running mission is not completed. Deliveries remain in the originating conversation.",strict:false,parameters:{type:"object",properties:{},additionalProperties:false}},
 {type:"function",name:"propose_start_mission",
 description:"Propose a persistent, read-only research/planning objective that may continue for several checkpoints after explicit employee review. It cannot write project data, send messages externally, modify calendar/tasks, or accept memories. Requires a grounded completion criterion.",
 strict:false,parameters:{type:"object",properties:{
  objective:{type:"string"},completion_criterion:{type:"string"}
 },required:["objective","completion_criterion"],additionalProperties:false}},
 {type:"function",name:"propose_control_mission",description:"Request employee approval to resume or cancel their own mission. It must be reviewed; no silent control.",strict:false,parameters:{type:"object",properties:{mission_id:{type:"string"},action:{type:"string",enum:["resume","cancel"]}},required:["mission_id","action"],additionalProperties:false}},
 {type:"function",name:"list_projects",description:"Read the office project catalog (shared with active office members).",strict:false,parameters:{type:"object",properties:{},additionalProperties:false}},
 {type:"function",name:"list_tasks",description:"Read office tasks visible to this employee. Project tasks are shared; personal tasks are owner-only. Filter optionally by due date or project UUID.",strict:false,parameters:{type:"object",properties:{project_id:{type:"string"},due_from:{type:"string"},due_to:{type:"string"}},additionalProperties:false}},
 {type:"function",name:"list_calendar",description:"Read the employee's own calendar appointments overlapping an inclusive date range in Europe/Berlin. Do not assume colleagues' availability.",strict:false,parameters:{type:"object",properties:{from:{type:"string"},to:{type:"string"}},additionalProperties:false}},
 {type:"function",name:"list_files",description:"List filenames and metadata in the shared Office or project Desktop. project_id can be omitted for the shared Büro root.",strict:false,parameters:{type:"object",properties:{project_id:{type:"string"},search:{type:"string"},scope:{type:"string",enum:["office","project","all"]}},additionalProperties:false}},
 {type:"function",name:"read_text_file",description:"Read text/markdown/CSV/JSON source material from a shared Desktop file by exact file UUID. Other formats may require an attachment; do not pretend to read them.",strict:false,parameters:{type:"object",properties:{file_id:{type:"string"}},required:["file_id"],additionalProperties:false}},
 {type:"function",name:"create_document",
 description:"Produce an actual downloadable DOCX, PDF or TXT document from drafted content, using the original Window artifact makers. The document is privately stored for this employee; it is not automatically project truth or shared with Office Desktop.",
 strict:false,parameters:{type:"object",properties:{
   kind:{type:"string",enum:["docx","pdf","txt"]},
   title:{type:"string"},
   content:{type:"string",description:"Complete document content written for the employee, with Markdown headings and paragraphs; not a brief description."}
 },required:["kind","title","content"],additionalProperties:false}},
 {type:"function",name:"execute_artifact_task",
 description:"Use Window's real general_execution Capability Runtime and Code Interpreter to create a final usable XLSX/PPTX/PDF/DOCX/CSV/ZIP or other supported file. The job is private and asynchronous; no shared Office or project changes. Returns a durable run_id for later status.",
 strict:false,parameters:{type:"object",properties:{
  objective:{type:"string",description:"The complete user-requested deliverable task."},
  title:{type:"string"},
  desired_outputs:{type:"array",items:{type:"string",enum:["docx","pdf","xlsx","pptx","csv","zip","html","txt","json","image","markdown"]}},
  input_files:{type:"array",items:{type:"object",properties:{
    source:{type:"string",enum:["work_file","artifact"]},
    id:{type:"string"}
   },required:["source","id"],additionalProperties:false},
   description:"Optional precise UUID references to Office Desktop files or this employee's generated artifacts. Current chat attachments are included automatically."}
 },required:["objective"],additionalProperties:false}},
 {type:"function",name:"check_artifact_task",
 description:"Retrieve the status and actual output metadata of a previously started private Romy general_execution task by its run UUID. Never claim it completed until the provider and stored artifacts confirm it.",
 strict:false,parameters:{type:"object",properties:{run_id:{type:"string"}},required:["run_id"],additionalProperties:false}},
 {type:"function",name:"propose_create_task",description:"Register a proposal to CREATE a task, not an actual change. It will be applied only after the employee explicitly approves it.",strict:false,parameters:{type:"object",properties:{title:{type:"string"},due_date:{type:"string"},project_id:{type:"string"},notes:{type:"string"}},required:["title"],additionalProperties:false}},
 {type:"function",name:"propose_create_event",description:"Register a proposal to CREATE an appointment in the user's personal calendar. It is NOT written until the employee explicitly confirms.",strict:false,parameters:{type:"object",properties:{title:{type:"string"},starts_at:{type:"string",description:"ISO-8601 with explicit UTC Z or timezone offset for Europe/Berlin (e.g. +01:00/+02:00); never infer an ungrounded clock time."},ends_at:{type:"string",description:"ISO-8601 with explicit UTC Z or timezone offset for Europe/Berlin."},project_id:{type:"string"},notes:{type:"string"}},required:["title","starts_at","ends_at"],additionalProperties:false}},
];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId=s=>typeof s==="string"&&UUID.test(s);
const validDate=validOfficeDate;
const normalized=(s,max)=>String(s||"").trim().slice(0,max);
const err=(code)=>({error:code});
const safeArray=(data,max=100)=>Array.isArray(data)?data.slice(0,max):[];
async function checkedQuery(promise){
 const {data,error}=await promise;
 if(error)throw new Error("office_read_failed");
 return data||[];
}
async function registerProposal({admin,requestId,userId,conversationId,kind,payload}){
 const {data,error}=await admin.from("office_romy_proposals").insert({
   request_id:requestId,user_id:userId,conversation_id:conversationId,kind,payload,
 }).select("id").single();
 if(error)throw new Error("proposal_register_failed");
 return {proposal_id:data.id,kind,requires_explicit_confirmation:true,payload,
   status:"pending",message:"The employee must inspect and approve this proposal before it changes office data."};
}
export async function executeRomyTool(name,args,{userDb,admin,userId,conversationId,requestId,apiKey}){
 const a=args&&typeof args==="object"&&!Array.isArray(args)?args:{};
 if(name==="search_semantic_history"){
  return await searchRomySemanticMemory({userDb,admin,userId,query:a.query,apiKey});
 }
 if(name==="search_personal_memory"){
  let q=userDb.from("office_romy_memories")
    .select("id,kind,content,created_at,source_conversation_id,source_request_id")
    .eq("status","accepted");
  if(a.kind&&["fact","preference"].includes(a.kind))q=q.eq("kind",a.kind);
  if(a.query){const pattern="%"+normalized(a.query,180).replace(/[\\%_]/g,m=>"\\"+m)+"%";q=q.ilike("content",pattern);}
  const rows=await checkedQuery(q.order("created_at",{ascending:false}).limit(80));
  return {memories:safeArray(rows,80),scope:"confirmed_private_memory_for_employee",
    has_more_possible:rows.length===80,provenance:"owner_reviewed_proposals"};
 }
 if(name==="search_conversation_history"){
  const query=normalized(a.query,160);
  if(!query)return err("search_query_required");
  const pattern="%"+query.replace(/[\\%_]/g,m=>"\\"+m)+"%";
  const rows=await checkedQuery(userDb.from("office_assistant_messages")
    .select("id,conversation_id,role,content,created_at")
    .ilike("content",pattern).order("created_at",{ascending:false}).limit(30));
  return {messages:safeArray(rows,30).map(row=>({...row,content:String(row.content||"").slice(0,2000),truncated:String(row.content||"").length>2000})),scope:"only_current_employee_via_message_RLS",
    provenance:"historic_conversation_not_accepted_memory",
    has_more_possible:rows.length===30};
 }
 if(name==="search_generated_artifacts"){
  let q=userDb.from("office_romy_artifacts")
    .select("id,kind,title,mime_type,size_bytes,created_at,conversation_id")
    .order("created_at",{ascending:false}).limit(80);
  if(a.kind)q=q.eq("kind",normalized(a.kind,30));
  if(a.query)q=q.ilike("title","%"+normalized(a.query,130).replace(/[\\%_]/g,m=>"\\"+m)+"%");
  const rows=await checkedQuery(q);
  return {artifacts:safeArray(rows,80),scope:"only_current_employee_owned_artifacts",
    source_for_execute_artifact_task:"artifact",verified_project_fact:false,
    has_more_possible:rows.length===80};
 }
 if(name==="propose_remember"){
  const kind=String(a.kind||""),content=String(a.content||"").trim();
  if(!["fact","preference"].includes(kind)||!content)return err("invalid_memory_proposal");
  return await registerProposal({admin,requestId,userId,conversationId,kind:"remember",
    payload:{memory_kind:kind,content,source_conversation_id:conversationId,
      source_request_id:requestId}});
 }
 if(name==="list_missions"){
  const rows=await checkedQuery(userDb.from("office_romy_missions")
    .select("id,objective,completion_criterion,status,iteration,max_iterations,summary,blocker_question,next_wake_at,created_at,updated_at")
    .order("updated_at",{ascending:false}).limit(50));
  return {missions:safeArray(rows,50),scope:"employee_private_confirmed_objectives",writes_authorized:false};
 }
 if(name==="propose_start_mission"){
  const objective=normalized(a.objective,6001),completion=normalized(a.completion_criterion,2401);
  if(objective.length<5||objective.length>6000||!completion||completion.length>2400)return err("invalid_mission_objective");
  return await registerProposal({admin,requestId,userId,conversationId,kind:"start_mission",
    payload:{title:objective.slice(0,100),objective,completion_criterion:completion,
      consent_scope:"read_only_private_mission",max_iterations:5}});
 }
 if(name==="propose_control_mission"){
  if(!validId(a.mission_id)||!["resume","cancel"].includes(a.action))return err("invalid_mission_control");
  const {data,error}=await userDb.from("office_romy_missions")
    .select("id,status,objective").eq("id",a.mission_id).maybeSingle();
  if(error||!data)return err("mission_not_accessible");
  return await registerProposal({admin,requestId,userId,conversationId,kind:"control_mission",
    payload:{mission_id:data.id,action:a.action,title:a.action+" · "+data.objective.slice(0,80),
      current_status:data.status}});
 }
 if(name==="list_projects"){
  const rows=await checkedQuery(userDb.from("office_projects")
    .select("id,number,name,status,projektleiter_id").order("number").limit(150));
  return {projects:safeArray(rows,150)};
 }
 if(name==="list_tasks"){
  if(a.project_id&&!validId(a.project_id))return err("invalid_project_id");
  if(a.due_from&&!validDate(a.due_from)||a.due_to&&!validDate(a.due_to))return err("invalid_date");
  let q=userDb.from("isabella_tasks")
    .select("id,title,due_date,start_date,completed_at,project_id,work_status,priority,notes")
    .is("archived_at",null);
  if(a.project_id)q=q.eq("project_id",a.project_id);
  if(a.due_from)q=q.gte("due_date",a.due_from);
  if(a.due_to)q=q.lte("due_date",a.due_to);
  const rows=await checkedQuery(q.order("due_date",{ascending:true,nullsFirst:false}).limit(250));
  return {tasks:safeArray(rows,250),scope:"RLS-visible office project tasks plus this employee's personal tasks"};
 }
 if(name==="list_calendar"){
  if(!validDate(a.from)||!validDate(a.to)||a.to<a.from)return err("invalid_date_range");
  const bounds=berlinDateRangeUtc(a.from,a.to);
  const rows=await checkedQuery(userDb.from("isabella_events")
    .select("id,title,starts_at,ends_at,all_day,project_id,notes")
    .lt("starts_at",bounds.endExclusive).gt("ends_at",bounds.start)
    .order("starts_at").limit(250));
  return {events:safeArray(rows,250),scope:"only this employee's own calendar via RLS",
    timezone:"Europe/Berlin",date_from:a.from,date_to:a.to,
    may_have_more:rows.length===250};
 }
 if(name==="list_files"){
  if(a.project_id&&!validId(a.project_id))return err("invalid_project_id");
  let q=userDb.from("minds_work_files")
    .select("id,project_id,folder_id,name,mime_type,size_bytes,created_at");
  const scope=String(a.scope||"");
  if(scope==="all")q=q;
  else q=a.project_id?q.eq("project_id",a.project_id):q.is("project_id",null);
  if(a.search)q=q.ilike("name","%"+normalized(a.search,100).replace(/[\\%_]/g,m=>"\\"+m)+"%");
  const rows=await checkedQuery(q.order("name").limit(200));
  return {files:safeArray(rows,200),scope:a.scope==="all"?"all_office_projects":a.project_id||"Büro",content_read:false,has_more_possible:rows.length===200};
 }
 if(name==="read_text_file"){
  if(!validId(a.file_id))return err("invalid_file_id");
  const {data:file,error}=await userDb.from("minds_work_files")
    .select("id,name,mime_type,size_bytes,storage_path").eq("id",a.file_id).maybeSingle();
  if(error||!file)return err("file_not_accessible");
  if(!/\.(txt|md|csv|json|eml)$/i.test(file.name)&&
      !/^(text\/|application\/json)/i.test(String(file.mime_type||"")))
    return {error:"requires_binary_document_reader",name:file.name,format:file.mime_type};
  if(Number(file.size_bytes)>1024*1024)
    return {error:"large_source_needs_segmented_reader",name:file.name,size_bytes:file.size_bytes};
  const {data:blob,error:downloadError}=await userDb.storage.from("minds-work").download(file.storage_path);
  if(downloadError||!blob)return err("file_not_accessible");
  const text=await blob.text();
  return {file_id:file.id,name:file.name,text:text.slice(0,60000),truncated:text.length>60000};
 }
 if(name==="propose_create_task"){
  const title=normalized(a.title,200);
  if(!title)return err("missing_title");
  if(a.due_date&&!validDate(a.due_date))return err("invalid_due_date");
  if(a.project_id&&!validId(a.project_id))return err("invalid_project_id");
  return await registerProposal({admin,requestId,userId,conversationId,kind:"create_task",
    payload:{title,due_date:a.due_date||null,project_id:a.project_id||null,notes:normalized(a.notes,4000)}});
 }
 if(name==="propose_create_event"){
  const title=normalized(a.title,200);
  const start=parseExplicitZonedInstant(a.starts_at),end=parseExplicitZonedInstant(a.ends_at);
  if(!title||!start||!end||end<=start)return err("event_time_requires_explicit_timezone");
  if(a.project_id&&!validId(a.project_id))return err("invalid_project_id");
  return await registerProposal({admin,requestId,userId,conversationId,kind:"create_event",
    payload:{title,starts_at:start,ends_at:end,
      project_id:a.project_id||null,notes:normalized(a.notes,4000)}});
 }
 return err("unsupported_tool");
}
export async function reviewRomyProposal({userDb,admin,userId,proposalId,decision}){
 if(!validId(proposalId)||!["apply","reject"].includes(decision))return {error:"invalid_review"};
 const {data:proposal,error}=await userDb.from("office_romy_proposals")
   .select("id,user_id,kind,payload,status,conversation_id,request_id").eq("id",proposalId).maybeSingle();
 if(error||!proposal||proposal.user_id!==userId)return {error:"proposal_not_found"};
 if(proposal.status!=="pending")return {error:"proposal_already_reviewed"};
 const status=decision==="reject"?"rejected":"applying";
 const {data:locked,error:lockError}=await admin.from("office_romy_proposals")
   .update({status,reviewed_at:new Date().toISOString()})
   .eq("id",proposalId).eq("user_id",userId).eq("status","pending").select("id").maybeSingle();
 if(lockError||!locked)return {error:"proposal_already_reviewed"};
 if(decision==="reject")return {status:"rejected",proposal_id:proposalId};
 const {kind,payload:p}=proposal;
 let table,values;
 if(kind==="remember"){
   if(!["fact","preference"].includes(p.memory_kind)||!String(p.content||"").trim())
     return {error:"invalid_memory_proposal"};
   const {data:memory,error:memoryError}=await admin.from("office_romy_memories")
     .insert({user_id:userId,kind:p.memory_kind,content:String(p.content).trim(),
       source_conversation_id:proposal.conversation_id,source_request_id:proposal.request_id})
     .select("id").single();
   if(memoryError||!memory){
     await admin.from("office_romy_proposals")
       .update({status:"pending",reviewed_at:null}).eq("id",proposalId).eq("status","applying");
     return {error:"memory_store_failed"};
   }
   const {error:receiptError}=await admin.from("office_romy_proposals")
     .update({status:"applied",result_id:memory.id}).eq("id",proposalId).eq("status","applying");
   if(receiptError)throw new Error("memory_receipt_unavailable");
   return {status:"applied",proposal_id:proposalId,result_id:memory.id,kind:"remember"};
 }
 if(kind==="start_mission"){
   const objective=String(p.objective||"").trim(),criterion=String(p.completion_criterion||"").trim();
   if(objective.length<5||objective.length>6000||!criterion||criterion.length>2400){
     await admin.from("office_romy_proposals").update({status:"rejected"})
      .eq("id",proposalId).eq("status","applying");
     return {error:"invalid_mission_proposal"};
   }
   const {data:mission,error:missionError}=await admin.from("office_romy_missions").insert({
     user_id:userId,conversation_id:proposal.conversation_id,request_id:proposal.request_id,
     proposal_id:proposalId,objective,completion_criterion:criterion,
     max_iterations:5,status:"queued"
   }).select("id").single();
   if(missionError||!mission){
     await admin.from("office_romy_proposals").update({status:"pending",reviewed_at:null})
      .eq("id",proposalId).eq("status","applying");
     return {error:"mission_create_failed"};
   }
   await admin.from("office_romy_mission_events").insert({
     mission_id:mission.id,user_id:userId,iteration:0,event_type:"created",
     summary:"Approved by employee"
   });
   const {error:receiptError}=await admin.from("office_romy_proposals")
     .update({status:"applied",result_id:mission.id})
     .eq("id",proposalId).eq("status","applying");
   if(receiptError)return {error:"mission_receipt_unavailable"};
   return {status:"applied",kind:"start_mission",proposal_id:proposalId,
     result_id:mission.id,mission_id:mission.id};
 }
 if(kind==="control_mission"){
   const action=String(p.action||""),missionId=String(p.mission_id||"");
   if(!validId(missionId)||!["resume","cancel"].includes(action)){
     await admin.from("office_romy_proposals").update({status:"rejected"})
      .eq("id",proposalId).eq("status","applying");
     return {error:"invalid_mission_control"};
   }
   const {data:current}=await userDb.from("office_romy_missions")
     .select("id,status,iteration").eq("id",missionId).maybeSingle();
   if(!current||!["queued","running","waiting_for_user","waiting_until"].includes(current.status)||
      (action==="resume"&&!["waiting_for_user","waiting_until"].includes(current.status))){
     await admin.from("office_romy_proposals").update({status:"pending",reviewed_at:null})
      .eq("id",proposalId).eq("status","applying");
     return {error:"mission_state_conflict"};
   }
   const patch=action==="cancel"?
    {status:"cancelled",lease_token:null,lease_until:null,next_wake_at:null,updated_at:new Date().toISOString()}:
    {status:"queued",lease_token:null,lease_until:null,next_wake_at:null,
     max_iterations:Math.min(8,Number(current.iteration)+3),updated_at:new Date().toISOString()};
   const {data:modified,error:updateError}=await admin.from("office_romy_missions")
     .update(patch).eq("id",missionId).eq("user_id",userId).eq("status",current.status)
     .select("id,status").maybeSingle();
   if(updateError||!modified){
     await admin.from("office_romy_proposals").update({status:"pending",reviewed_at:null})
      .eq("id",proposalId).eq("status","applying");
     return {error:"mission_state_conflict"};
   }
   await admin.from("office_romy_mission_events").insert({
     mission_id:missionId,user_id:userId,iteration:Number(current.iteration),
     event_type:action==="cancel"?"cancelled":"resumed",summary:"Confirmed by employee"
   });
   await admin.from("office_romy_proposals").update({status:"applied",result_id:missionId})
    .eq("id",proposalId).eq("status","applying");
   return {status:"applied",kind:"control_mission",mission_id:missionId,
     mission_status:modified.status,proposal_id:proposalId};
 }
 if(kind==="create_task"){
   table="isabella_tasks";
   values={user_id:userId,title:normalized(p.title,200),due_date:p.due_date||null,
    project_id:p.project_id||null,notes:normalized(p.notes,4000),
    metadata:{source:"romy_confirmed",proposal_id:proposalId}};
 }else if(kind==="create_event"){
   table="isabella_events";
   values={user_id:userId,title:normalized(p.title,200),starts_at:p.starts_at,
    ends_at:p.ends_at,project_id:p.project_id||null,notes:normalized(p.notes,4000),
    metadata:{source:"romy_confirmed",proposal_id:proposalId}};
 }else{
   await admin.from("office_romy_proposals").update({status:"rejected"}).eq("id",proposalId);
   return {error:"unsupported_proposal"};
 }
 const {data:created,error:writeError}=await userDb.from(table).insert(values).select("id").single();
 if(writeError||!created){
   await admin.from("office_romy_proposals").update({status:"pending",reviewed_at:null})
     .eq("id",proposalId).eq("status","applying");
   return {error:"office_action_denied_by_permissions"};
 }
 const {error:finishError}=await admin.from("office_romy_proposals")
   .update({status:"applied",result_id:created.id}).eq("id",proposalId).eq("status","applying");
 if(finishError)throw new Error("proposal_receipt_unavailable");
 return {status:"applied",proposal_id:proposalId,result_id:created.id,kind};
}
