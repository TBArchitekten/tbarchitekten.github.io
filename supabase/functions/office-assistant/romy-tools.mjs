import { validOfficeDate, berlinDateRangeUtc, parseExplicitZonedInstant } from "./romy-time.mjs";
// Adapted tool boundary for Romy using Window's explicit tool/approval discipline.
// Queries execute with the employee's JWT and the Office RLS policies,
// never with a shared service-role reader.
export const ROMY_TOOLS=[
 {type:"function",name:"list_projects",description:"Read the office project catalog (shared with active office members).",strict:false,parameters:{type:"object",properties:{},additionalProperties:false}},
 {type:"function",name:"list_tasks",description:"Read office tasks visible to this employee. Project tasks are shared; personal tasks are owner-only. Filter optionally by due date or project UUID.",strict:false,parameters:{type:"object",properties:{project_id:{type:"string"},due_from:{type:"string"},due_to:{type:"string"}},additionalProperties:false}},
 {type:"function",name:"list_calendar",description:"Read the employee's own calendar appointments overlapping an inclusive date range in Europe/Berlin. Do not assume colleagues' availability.",strict:false,parameters:{type:"object",properties:{from:{type:"string"},to:{type:"string"}},additionalProperties:false}},
 {type:"function",name:"list_files",description:"List filenames and metadata in the shared Office or project Desktop. project_id can be omitted for the shared Büro root.",strict:false,parameters:{type:"object",properties:{project_id:{type:"string"},search:{type:"string"}},additionalProperties:false}},
 {type:"function",name:"read_text_file",description:"Read text/markdown/CSV/JSON source material from a shared Desktop file by exact file UUID. Other formats may require an attachment; do not pretend to read them.",strict:false,parameters:{type:"object",properties:{file_id:{type:"string"}},required:["file_id"],additionalProperties:false}},
 {type:"function",name:"create_document",
 description:"Produce an actual downloadable DOCX, PDF or TXT document from drafted content, using the original Window artifact makers. The document is privately stored for this employee; it is not automatically project truth or shared with Office Desktop.",
 strict:false,parameters:{type:"object",properties:{
   kind:{type:"string",enum:["docx","pdf","txt"]},
   title:{type:"string"},
   content:{type:"string",description:"Complete document content written for the employee, with Markdown headings and paragraphs; not a brief description."}
 },required:["kind","title","content"],additionalProperties:false}},
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
export async function executeRomyTool(name,args,{userDb,admin,userId,conversationId,requestId}){
 const a=args&&typeof args==="object"&&!Array.isArray(args)?args:{};
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
  q=a.project_id?q.eq("project_id",a.project_id):q.is("project_id",null);
  if(a.search)q=q.ilike("name","%"+normalized(a.search,100)+"%");
  const rows=await checkedQuery(q.order("name").limit(200));
  return {files:safeArray(rows,200),scope:a.project_id||"Büro",content_read:false};
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
   .select("id,user_id,kind,payload,status").eq("id",proposalId).maybeSingle();
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
