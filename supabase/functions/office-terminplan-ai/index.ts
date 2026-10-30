import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {INTENT_SCHEMA,MODEL,validId,validMessage,validRevision,toContext,validateIntent,modelInstructions,DISCUSSION_SCHEMA,discussionInstructions,validateDiscussion} from "./core.mjs";
import {domainLens,EXPERTISE_VERSION} from "./expertise.mjs";

const ORIGIN="https://tbarchitekten.github.io";
const headers={
  "Access-Control-Allow-Origin":ORIGIN,
  "Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Vary":"Origin",
  "Cache-Control":"no-store",
  "Content-Type":"application/json; charset=utf-8"
};
const respond=(status,payload)=>new Response(JSON.stringify(payload),{status,headers});
function outputText(payload){
  if(payload?.status!=="completed")return null;
  const result=[];
  for(const item of payload.output||[]){
    if(item.type!=="message")continue;
    for(const content of item.content||[])if(content.type==="output_text"&&typeof content.text==="string")result.push(content.text);
  }
  return result.join("").trim()||null;
}
Deno.serve(async req=>{
  const origin=req.headers.get("origin");
  if(origin&&origin!==ORIGIN)return respond(403,{error:"origin_forbidden"});
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="POST")return respond(405,{error:"method_not_allowed"});
  if(Number(req.headers.get("content-length")||"0")>6000)return respond(413,{error:"request_too_large"});
  const authHeader=req.headers.get("authorization")||"";
  const token=/^Bearer\s+(\S+)$/i.exec(authHeader)?.[1];
  if(!token)return respond(401,{error:"authentication_required"});
  const apiUrl=Deno.env.get("SUPABASE_URL")||"";
  const publicKey=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
  if(!apiUrl||!publicKey)return respond(503,{error:"office_auth_unavailable"});
  const sb=createClient(apiUrl,publicKey,{
    global:{headers:{Authorization:authHeader}},
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:auth,error:authError}=await sb.auth.getUser(token);
  if(authError||!auth.user)return respond(401,{error:"invalid_session"});
  let input;
  try{
    const raw=await req.text();
    if(raw.length>6000)return respond(413,{error:"request_too_large"});
    input=JSON.parse(raw);
  }catch{return respond(400,{error:"invalid_json"})}
  const planId=input?.plan_id,action=input?.action;
  if(!validId(planId)||!["status","interpret","discuss","review"].includes(action))return respond(400,{error:"invalid_request"});
  const {data:member,error:memberError}=await sb.from("office_members")
    .select("role,is_active").eq("user_id",auth.user.id).eq("is_active",true).maybeSingle();
  if(memberError||!member)return respond(403,{error:"not_an_office_member"});
  const {data:plan,error:planError}=await sb.from("office_terminplan_instances")
    .select("id,phase,owner_id,server_revision,state").eq("id",planId).maybeSingle();
  if(planError||!plan)return respond(404,{error:"project_plan_not_accessible"});
  const canEdit=plan.owner_id===auth.user.id||member.role==="admin";
  const secret=Deno.env.get("TBA_OFFICE_OPENAI_API_KEY")||"";
  if(action==="status")return respond(200,{
    ready:!!secret,mode:secret?"openai_structured_intent":"deterministic_only",
    can_edit:canEdit,version:"office-ai-v0.4"
  });
  if(!secret)return respond(503,{error:"ai_not_configured",hint:"Use rule mode until the dedicated Office API secret is provisioned."});
  const reviewedIds=action==="review"?
    (Array.isArray(input.changed_task_ids)?input.changed_task_ids:[]):[];
  if(action==="review"&&(!reviewedIds.length||reviewedIds.length>20||
    reviewedIds.some(x=>typeof x!=="string"||x.length>90)))return respond(400,{error:"invalid_review_targets"});
  if(action==="review"&&(!input.message||input.message.length<2))
    input.message="Prüfe Änderungen und relevante Folgeabgaben.";
  if(!validMessage(input.message)||!validRevision(input.expected_revision))
    return respond(400,{error:"invalid_message_or_revision"});
  if(plan.server_revision!==input.expected_revision)
    return respond(409,{error:"revision_changed",current_revision:plan.server_revision});
  if(input.selected_task_id!==null&&input.selected_task_id!==undefined&&typeof input.selected_task_id!=="string")
    return respond(400,{error:"invalid_selection"});
  let context;
  try{context=toContext(plan.state,plan.phase,input.selected_task_id||null)}
  catch{return respond(422,{error:"plan_context_unavailable"})}
  // Atomic per-user quota must be consumed before any paid model call.
  const {data:allowed,error:quotaError}=await sb.rpc("office_ai_consume_request",{p_plan_id:planId});
  if(quotaError)return respond(503,{error:"office_ai_quota_unavailable"});
  if(allowed!==true)return respond(429,{error:"daily_ai_limit_reached"});
  // History is explicitly scoped to this authorized user and plan under RLS.
  // Prior messages are non-authoritative conversation data, never tool outputs.
  let history=[];
  if(action==="discuss"||action==="review"){
    const {data:previous,error:historyError}=await sb.from("office_terminplan_dialogue_messages")
      .select("role,body,event_kind,created_at").eq("user_id",auth.user.id).eq("plan_id",planId)
      .in("role",["user","assistant"]).in("event_kind",["question","answer","proposal"])
      .order("created_at",{ascending:false}).limit(16);
    if(historyError)return respond(503,{error:"conversation_unavailable"});
    history=(previous||[]).reverse().map(row=>({
      speaker:row.role==="user"?"architect":"office_assistant",
      message:String(row.body||"").slice(0,750)
    }));
    // Client may have persisted the submitted message before our read.
    if(history.length&&history[history.length-1].speaker==="architect"&&
       history[history.length-1].message===input.message.trim().slice(0,750))history.pop();
  }
  const prompt=JSON.stringify({
    selected_task_id:context.selected_task_id,
    conversation_history:history,
    user_message:input.message.trim(),
    review_changed_task_ids:reviewedIds.filter(id=>context.tasks.some(t=>t.id===id)),
    project:context
  });
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),52000);
  let provider;
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",signal:controller.signal,
      headers:{"Authorization":"Bearer "+secret,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:Deno.env.get("TBA_OFFICE_OPENAI_MODEL")||MODEL,
        store:false,max_output_tokens:action==="interpret"?1100:2900,
        reasoning:{effort:"medium"},
        instructions:(action==="interpret"?modelInstructions():discussionInstructions())+
          "\n\nPROFESSIONAL DOMAIN CONTEXT — contextual evidence, NOT a mandatory checklist:\n"+
          domainLens(plan.phase)+
          (action==="review"?"\n\nTASK: Examine changed task IDs; proactively identify the most material planning coordination risk in the current schedule. Suggest a specific next check, not a new task or edit. Return kind=discuss or clarify only. Never fabricate contractual dependencies.":"")+
          "\n\nUse built-in web_search autonomously where online evidence is materially needed (current regulations, technical standards, public information not contained in the schedule). Do not search for ordinary reasoning over the supplied plan. Cite the web source URLs in the answer if used. Distinguish source statements from your hypotheses.",
        input:[{role:"user",content:prompt}],
        tools:[{type:"web_search",search_context_size:"low"}],
        tool_choice:"auto",
        text:{format:{type:"json_schema",name:action==="interpret"?"office_terminplan_intent_v1":"office_terminplan_dialogue_v06",strict:true,schema:action==="interpret"?INTENT_SCHEMA:DISCUSSION_SCHEMA}}
      })
    });
    if(!response.ok){
      // Do not reflect provider errors, credentials, or raw remote content to callers.
      console.error("Office AI provider failed",response.status);
      return respond(502,{error:"ai_provider_unavailable"});
    }
    provider=await response.json();
  }catch(error){
    console.error("Office AI provider request did not complete",String(error?.name||"request_failed"));
    return respond(504,{error:"ai_timeout_or_network"});
  }finally{clearTimeout(timeout)}
  const text=outputText(provider);
  if(!text)return respond(502,{error:"ai_incomplete"});
  let result;
  try{result=action==="interpret"?validateIntent(JSON.parse(text),context,canEdit):validateDiscussion(JSON.parse(text),context,canEdit)}
  
  catch{return respond(502,{error:"ai_invalid_response"})}
  // Provider URL annotations, not model-invented source links, become clickable citations.
  const sources=[];
  for(const item of provider.output||[]){
    if(item.type!=="message")continue;
    for(const part of item.content||[])for(const a of part.annotations||[]){
      if(a.type!=="url_citation"||typeof a.url!=="string")continue;
      try{
        const url=new URL(a.url);
        if(url.protocol!=="https:"||sources.some(s=>s.url===url.href)||sources.length>=6)continue;
        sources.push({url:url.href,title:String(a.title||url.hostname).slice(0,110)});
      }catch{/* invalid URL is never displayed */}
    }
  }
  if(action==="review"&&result.kind!=="discuss"&&result.kind!=="clarify"){
    result={kind:"discuss",text:"Die Änderungen sollten vor einer zusätzlichen Terminentscheidung fachlich überprüft werden. Keine Änderung vorgeschlagen."};
  }
  return respond(200,{
    version:action==="interpret"?"office-ai-v0.4":"office-ai-v0.5",
    source:action==="interpret"?"office_ai_interpretation_only":"office_ai_discussion_only",authority:"none",
    model:Deno.env.get("TBA_OFFICE_OPENAI_MODEL")||MODEL,
    expertise_version:EXPERTISE_VERSION,
    researched:sources.length>0,sources,
    base_revision:plan.server_revision,
    result
  });
});
