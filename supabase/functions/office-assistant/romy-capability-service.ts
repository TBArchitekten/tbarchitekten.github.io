// Office adapter around Window's general_execution provider runtime.
// All source files are fetched with the employee JWT. Only the server writes
// durable jobs and generated outputs. No autonomous Office/project mutations.
import {
 GENERAL_EXECUTION_MODEL,startGeneralExecution,reconcileRomyRun,
 romyArtifactRows,deliverRomyCompletion,cancelGeneralExecution
} from "./romy-capability-runtime.ts";
import {
 inputRefs,resolveRomyInputFiles,appendCurrentTurnUploads
} from "./romy-capability-inputs.ts";
import { normalizeSkillTrace } from "./skill-registry.ts";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OUTPUTS=new Set(["docx","pdf","xlsx","pptx","csv","zip","html","txt","json","image","markdown"]);
const ACTIVE=new Set(["queued","in_progress"]);
const uuid=s=>typeof s==="string"&&ID.test(s);
const allowedOutputs=v=>[...new Set((Array.isArray(v)?v:[])
 .map(x=>String(x||"").toLowerCase()).filter(x=>OUTPUTS.has(x)))].slice(0,4);
function statusInfo(run,artifacts=[]){
 return {status:run.status,run_id:run.id,title:run.title,
  summary:String(run.summary||""),error:run.error||null,
  artifacts,complete:run.status==="completed",
  requires_user_review:false,private_to_employee:true};
}
export async function startRomyCapability({admin,userDb,userId,conversationId,requestId,callId,args,uploads,skillTrace,apiKey}){
 const objective=String(args?.objective||"").trim();
 const title=String(args?.title||objective.slice(0,120)||"Arbeitsauftrag").trim().slice(0,240);
 if(!objective||objective.length>20000||!title)return {error:"invalid_objective"};
 if(!callId||String(callId).length>200)return {error:"invalid_tool_call_id"};
 const {data:existing}=await admin.from("office_romy_capability_runs")
   .select("*").eq("user_id",userId).eq("request_id",requestId)
   .eq("tool_call_id",callId).maybeSingle();
 if(existing)return statusInfo(existing,await romyArtifactRows(admin,existing,existing.artifact_ids||[]));
 const refs=inputRefs(args?.input_files);
 const resolved=await resolveRomyInputFiles(userDb,userId,refs);
 const inputFiles=appendCurrentTurnUploads(resolved,uploads);
 const desired=allowedOutputs(args?.desired_outputs);
 const metadata={runtime_version:"capability-runtime-v0.3.0",
   model:GENERAL_EXECUTION_MODEL,desired_outputs:desired,
   input_files:inputFiles.map(({source,id,name,mime,size})=>({source,id,name,mime,size})),
   skill_trace:normalizeSkillTrace(skillTrace),delivered_to_chat:false,
   source:"romy_office_governed_tool"};
 const {data:run,error:insertError}=await admin.from("office_romy_capability_runs")
   .insert({user_id:userId,conversation_id:conversationId,request_id:requestId,
     tool_call_id:callId,title,request:objective,status:"queued",metadata})
   .select("*").single();
 if(insertError||!run)return {error:"capability_run_create_failed"};
 try{
  const provider=await startGeneralExecution(apiKey,{
    objective,title,desired_outputs:desired,model:GENERAL_EXECUTION_MODEL,
    input_files:inputFiles,
    context:{office:"TBA Office",skill_trace:metadata.skill_trace}
  });
  const responseId=String(provider?.id||"");
  if(!responseId)throw new Error("provider_response_id_missing");
  const status=ACTIVE.has(String(provider?.status||""))?String(provider.status):"in_progress";
  const now=new Date().toISOString();
  const {data:updated,error:updateError}=await admin.from("office_romy_capability_runs")
    .update({provider_response_id:responseId,status,started_at:now,updated_at:now,
      metadata:{...metadata,provider_status:provider?.status||null}})
    .eq("id",run.id).eq("user_id",userId).select("*").single();
  if(updateError||!updated)throw new Error("capability_started_but_save_failed");
  return statusInfo(updated);
 }catch(err){
  const message=String((err as Error)?.message||"capability_start_failed").slice(0,1200);
  await admin.from("office_romy_capability_runs")
    .update({status:"failed",error:message,completed_at:new Date().toISOString()})
    .eq("id",run.id).eq("user_id",userId);
  return {error:"capability_start_failed",run_id:run.id,detail:message};
 }
}
export async function romyCapabilityStatus({admin,userId,runId,apiKey}){
 if(!uuid(runId))return {error:"invalid_run_id"};
 const {data:run,error}=await admin.from("office_romy_capability_runs")
   .select("*").eq("id",runId).eq("user_id",userId).maybeSingle();
 if(error||!run)return {error:"capability_run_not_found"};
 let current=run,artifacts=[];
 if(ACTIVE.has(run.status)&&run.provider_response_id){
  try{
   const rec=await reconcileRomyRun(admin,apiKey,run);
   current=rec.run;artifacts=rec.artifacts;
  }catch(err){return {error:"capability_reconciliation_unavailable",run_id:run.id,status:run.status};}
 }
 if(current.status==="completed"){
  if(!artifacts.length)artifacts=await romyArtifactRows(admin,current,current.artifact_ids||[]);
  if(!current.metadata?.delivered_to_chat&&artifacts.length){
   const delivered=await deliverRomyCompletion(admin,current,artifacts,current.summary||"");
   if(delivered)await admin.from("office_romy_capability_runs")
     .update({metadata:{...current.metadata,delivered_to_chat:true}})
     .eq("id",current.id).eq("user_id",userId);
  }
 }
 return statusInfo(current,artifacts);
}
export async function romyCapabilityCancel({admin,userId,runId,apiKey}){
 if(!uuid(runId))return {error:"invalid_run_id"};
 const {data:run}=await admin.from("office_romy_capability_runs")
   .select("*").eq("id",runId).eq("user_id",userId).maybeSingle();
 if(!run)return {error:"capability_run_not_found"};
 if(!ACTIVE.has(run.status))return statusInfo(run);
 if(run.provider_response_id){
  try{await cancelGeneralExecution(apiKey,run.provider_response_id)}
  catch{return {error:"provider_cancel_unconfirmed",run_id:run.id,status:run.status}}
 }
 const now=new Date().toISOString();
 const {data:done,error}=await admin.from("office_romy_capability_runs")
   .update({status:"cancelled",completed_at:now,updated_at:now})
   .eq("id",run.id).eq("user_id",userId).in("status",["queued","in_progress"])
   .select("*").maybeSingle();
 if(error)return {error:"capability_cancel_failed"};
 return statusInfo(done||run);
}
