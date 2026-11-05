import {createClient} from "npm:@supabase/supabase-js@2.57.0";
// Office background checkpoints only. No projects/tasks/calendar/storage tools or external web search.
const ORIGIN="https://tbarchitekten.github.io";
const SECRET_HEADER="x-romy-runner-secret";
const MODEL="gpt-6-astra";
const respond=(status,data)=>new Response(JSON.stringify(data),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
});
const clean=(x,n)=>String(x||"").trim().slice(0,n);
const STATES=new Set(["continue","waiting_for_user","waiting_until","completed"]);
function resultObject(payload){
 const parts=[];
 for(const item of payload?.output||[]){
  if(item.type!=="message")continue;
  for(const part of item.content||[])if(part.type==="output_text"&&part.text)parts.push(part.text);
 }
 const full=parts.join("").trim().replace(/^\x60{3}(?:json)?\s*/i,"").replace(/\s*\x60{3}$/,"");
 let parsed=null;try{parsed=JSON.parse(full)}catch{return {status:"waiting_for_user",summary:"Die Antwort konnte nicht verifiziert werden.",question:"Bitte klären Sie, wie fortgefahren werden soll."}}
 const status=STATES.has(parsed?.status)?parsed.status:"waiting_for_user";
 return {
  status,summary:clean(parsed?.summary,9000),question:clean(parsed?.question,2500),
  wake_at:clean(parsed?.wake_at,60),sources:Array.isArray(parsed?.sources)?parsed.sources.slice(0,6):[]
 };
}
function nextWake(value){
 const stamp=new Date(value);
 if(!Number.isFinite(stamp.getTime())||stamp.getTime()<=Date.now()||stamp.getTime()>Date.now()+7*86400000)return null;
 return stamp.toISOString();
}
async function runCheckpoint(m,apiKey){
 const prompt=[
  "You are Romy's bounded persistent work checkpoint. This is a PRIVATE, read-only, user-approved work objective.",
  "Never simulate actions or claim to have accessed a project, document, calendar, email, website, or employee data.",
  "No tools or external actions are available. Work only on the explicitly approved objective and the previous checkpoint summary.",
  "Do not fabricate evidence or facts. State missing data and ask the employee if necessary.",
  "Do not infer that a future event did not happen merely because no confirmation has arrived.",
  "Your response must be JSON object with status continue|waiting_for_user|waiting_until|completed; summary; question; wake_at.",
  "Use completed only when the explicit completion criterion is genuinely fulfilled by work you can perform without external data.",
  "Use waiting_for_user when an approval, file, real-world verification or employee decision is required.",
  "Use waiting_until only for an actual user-specified future time in the objective; never invent a deadline or condition.",
  "No background execution may change project state, grant permission, send messages externally or create accepted memories.",
  "Mission objective: "+clean(m.objective,6000),
  "Completion criterion: "+clean(m.completion_criterion,2400),
  "Previous verified checkpoint summary: "+clean(m.summary,8000),
  "Iteration "+m.iteration+" of "+m.max_iterations+"."
 ].join("\n");
 const abort=new AbortController();
 const timer=setTimeout(()=>abort.abort(),70000);
 try{
  const response=await fetch("https://api.openai.com/v1/responses",{
   method:"POST",signal:abort.signal,
   headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
   body:JSON.stringify({model:MODEL,store:false,max_output_tokens:2000,
     input:[{role:"user",content:prompt}],
     text:{format:{type:"json_object"}}})
  });
  if(!response.ok)throw Error("mission_provider_status_"+response.status);
  const data=await response.json();
  if(data.status!=="completed")throw Error("mission_provider_incomplete");
  return resultObject(data);
 }finally{clearTimeout(timer)}
}
Deno.serve(async req=>{
 if(req.method!=="POST")return respond(405,{error:"method_not_allowed"});
 if(Number(req.headers.get("content-length")||0)>1024)return respond(413,{error:"payload_too_large"});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
   ai=Deno.env.get("TBA_OFFICE_OPENAI_API_KEY");
 if(!url||!key||!ai)return respond(503,{error:"runtime_not_configured"});
 const token=req.headers.get(SECRET_HEADER)||"";
 if(!/^[a-f0-9]{64}$/.test(token))return respond(401,{error:"unauthorized"});
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:authorized,error:authError}=await admin.rpc("office_romy_runner_authorized",{p_secret:token});
 if(authError||authorized!==true)return respond(401,{error:"unauthorized"});
 const {data:claimed,error:claimError}=await admin.rpc("office_romy_claim_missions",{p_limit:2});
 if(claimError)return respond(503,{error:"claim_unavailable"});
 const results=[];
 for(const mission of claimed||[]){
  try{
   const outcome=await runCheckpoint(mission,ai);
   const state=outcome.status==="continue"?"queued":outcome.status;
   const wake=state==="waiting_until"?nextWake(outcome.wake_at):null;
   const finalState=state==="waiting_until"&&!wake?"waiting_for_user":state;
   const {data:committed,error:finishError}=await admin.rpc("office_romy_finish_mission",{
    p_id:mission.id,p_lease:mission.lease_token,p_status:finalState,
    p_summary:outcome.summary,p_question:outcome.question||null,
    p_next_wake:wake,p_error:null
   });
   results.push({mission_id:mission.id,stored:!finishError&&committed===true,status:finalState});
  }catch(error){
   const code=clean(error?.message,200)||"mission_checkpoint_unavailable";
   // Failed checkpoints remain explicit; do not fabricate completion or silently retry forever.
   await admin.rpc("office_romy_finish_mission",{
    p_id:mission.id,p_lease:mission.lease_token,p_status:"failed",
    p_summary:"Die Ausführung wurde unterbrochen. Es wurden keine Änderungen an Büro-Daten vorgenommen.",
    p_question:"Bitte prüfen Sie die Ausführung, bevor Sie einen neuen Auftrag anlegen.",
    p_next_wake:null,p_error:code
   });
   results.push({mission_id:mission.id,status:"failed"});
  }
 }
 return respond(200,{ok:true,claimed:(claimed||[]).length,results});
});
