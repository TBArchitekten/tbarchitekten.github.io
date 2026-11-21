// TBA Office · KI-Assistent der Kostenberechnung (21.11.2026, Claude). Wie office-terminplan-ai:
// Anmeldung und Office-Mitgliedschaft prüfen, die Kostenberechnung unter RLS mit der Sitzung der Person lesen,
// Tageskontingent vor jedem bezahlten Aufruf, Antwort nach festem Schema. Der Assistent schreibt nie in die
// Kostenberechnung: er liefert einen Vorschlag, den der Client erst nach «Prüfen und übernehmen» speichert.
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import "./kosten-rechnen.js"; // derselbe Rechenkern wie im Werkzeug (Kopie, per Test gleich gehalten)
import {MODEL,VERSION,SCHEMA,anweisungen,validId,validMessage,validRevision,pruefeTabelle,pruefeAuswahl,toContext,pruefeAntwort} from "./core.mjs";
import {normalizePlanAttachments} from "../office-terminplan-ai/attachments.mjs";

// deno-lint-ignore no-explicit-any
const R=(globalThis as any).TBA_KOSTEN_RECHNEN;
const ORIGIN="https://tbarchitekten.github.io";
const headers={
  "Access-Control-Allow-Origin":ORIGIN,
  "Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Vary":"Origin",
  "Cache-Control":"no-store",
  "Content-Type":"application/json; charset=utf-8"
};
const respond=(status:number,payload:unknown)=>new Response(JSON.stringify(payload),{status,headers});
// deno-lint-ignore no-explicit-any
function outputText(payload:any){
  if(payload?.status!=="completed")return null;
  const result:string[]=[];
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
  if(Number(req.headers.get("content-length")||"0")>18*1024*1024)return respond(413,{error:"request_too_large"});
  const authHeader=req.headers.get("authorization")||"";
  const token=/^Bearer\s+(\S+)$/i.exec(authHeader)?.[1];
  if(!token)return respond(401,{error:"authentication_required"});
  const apiUrl=Deno.env.get("SUPABASE_URL")||"";
  const publicKey=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
  if(!apiUrl||!publicKey||!R)return respond(503,{error:"office_auth_unavailable"});
  // Alles Weitere mit der Sitzung der Person: RLS entscheidet, was sie sehen darf.
  const sb=createClient(apiUrl,publicKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await sb.auth.getUser(token);
  if(authError||!auth.user)return respond(401,{error:"invalid_session"});
  // deno-lint-ignore no-explicit-any
  let input:any;
  try{
    const raw=await req.text();
    if(raw.length>18*1024*1024)return respond(413,{error:"request_too_large"});
    input=JSON.parse(raw);
  }catch{return respond(400,{error:"invalid_json"})}
  const instanceId=input?.instance_id,action=input?.action;
  if(!validId(instanceId)||!["status","frage"].includes(action))return respond(400,{error:"invalid_request"});
  const {data:member,error:memberError}=await sb.from("office_members")
    .select("role,is_active").eq("user_id",auth.user.id).eq("is_active",true).maybeSingle();
  if(memberError||!member)return respond(403,{error:"not_an_office_member"});
  const {data:inst,error:instError}=await sb.from("office_kosten_instances")
    .select("id,project_id,project_number,project_name,owner_id,server_revision,state").eq("id",instanceId).maybeSingle();
  if(instError||!inst)return respond(404,{error:"kostenberechnung_not_accessible"});
  // Bearbeiten wie in der Datenbank: wer sie angelegt hat, die Projektleitung, das Projektteam und Admins.
  let canEdit=inst.owner_id===auth.user.id||member.role==="admin";
  if(!canEdit&&inst.project_id){
    const [{data:project},{data:teammate}]=await Promise.all([
      sb.from("office_projects").select("projektleiter_id").eq("id",inst.project_id).maybeSingle(),
      sb.from("office_project_members").select("user_id").eq("project_id",inst.project_id).eq("user_id",auth.user.id).maybeSingle()
    ]);
    canEdit=project?.projektleiter_id===auth.user.id||!!teammate;
  }
  const secret=Deno.env.get("TBA_OFFICE_OPENAI_API_KEY")||"";
  if(action==="status")return respond(200,{ready:!!secret,version:VERSION,model:MODEL,can_edit:canEdit});
  if(!secret)return respond(503,{error:"ai_not_configured"});
  if(!validMessage(input.message)||!validRevision(input.expected_revision))return respond(400,{error:"invalid_message_or_revision"});
  if(inst.server_revision!==input.expected_revision)return respond(409,{error:"revision_changed",current_revision:inst.server_revision});
  let tabelle,anhaenge;
  try{tabelle=pruefeTabelle(input.tabelle)}catch{return respond(400,{error:"invalid_table"})}
  try{anhaenge=normalizePlanAttachments(input.attachments)}catch{return respond(400,{error:"invalid_attachments"})}
  const auswahl=pruefeAuswahl(input.auswahl);
  let context;
  try{context=toContext(inst.state,R,{projekt:[inst.project_number,inst.project_name].filter(Boolean).join(" · "),auswahl,darfBearbeiten:canEdit})}
  catch{return respond(422,{error:"kostenberechnung_context_unavailable"})}
  // Kontingent je Person und Tag, atomar vor dem bezahlten Modellaufruf.
  const {data:allowed,error:quotaError}=await sb.rpc("office_kosten_ai_consume_request",{p_instance_id:instanceId});
  if(quotaError)return respond(503,{error:"office_ai_quota_unavailable"});
  if(allowed!==true)return respond(429,{error:"daily_ai_limit_reached"});
  // Verlauf nur der eigenen Nachrichten zu dieser Kostenberechnung (RLS); Gesprächsdaten, keine Anweisungen.
  const {data:previous,error:historyError}=await sb.from("office_kosten_dialogue_messages")
    .select("role,body,event_kind,created_at").eq("user_id",auth.user.id).eq("instance_id",instanceId)
    .in("event_kind",["question","answer","proposal","receipt"]).order("created_at",{ascending:false}).limit(12);
  if(historyError)return respond(503,{error:"conversation_unavailable"});
  const message=String(input.message).trim();
  const verlauf=(previous||[]).reverse().map(row=>({sprecher:row.role==="user"?"architekt":"assistent",text:String(row.body||"").slice(0,750)}));
  // Der Client speichert die Frage selbst (mit «Anhänge: …»); steht sie schon im Verlauf, nicht doppelt schicken.
  const letzte=verlauf[verlauf.length-1];
  if(letzte?.sprecher==="architekt"&&letzte.text.startsWith(message.slice(0,200)))verlauf.pop();
  const gross=!!tabelle||anhaenge.parts.length>0;
  const content=[{type:"input_text",text:JSON.stringify({verlauf,nachricht:message,
    anhaenge:[...anhaenge.sources.map(x=>x.name),...(tabelle?[tabelle.name]:[])],kostenberechnung:context})}];
  // Die Tabelle als eigener Textteil: Zeilennummer, Tabulator, Zellen wie im Blatt.
  if(tabelle)content.push({type:"input_text",text:"anhang_tabelle «"+tabelle.name+"» (Zeilennummer, dann die Zellen, getrennt durch Tabulatoren):\n"+tabelle.text});
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),gross?135000:80000);
  // deno-lint-ignore no-explicit-any
  let provider:any;
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",signal:controller.signal,
      headers:{"Authorization":"Bearer "+secret,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:MODEL,store:false,max_output_tokens:gross?12000:6000,reasoning:{effort:gross?"low":"medium"},
        instructions:anweisungen(),
        input:[{role:"user",content:[...content,...anhaenge.parts]}],
        tools:[],
        text:{format:{type:"json_schema",name:"office_kosten_assistent_v1",strict:true,schema:SCHEMA}}
      })
    });
    if(!response.ok){console.error("Office cost AI provider failed",response.status);return respond(502,{error:"ai_provider_unavailable"})}
    provider=await response.json();
  }catch(error){
    console.error("Office cost AI request did not complete",String((error as Error)?.name||"request_failed"));
    return respond(504,{error:"ai_timeout_or_network"});
  }finally{clearTimeout(timeout)}
  const text=outputText(provider);
  if(!text)return respond(502,{error:"ai_incomplete"});
  let result;
  try{result=pruefeAntwort(JSON.parse(text),inst.state,R,{darfBearbeiten:canEdit})}
  catch{return respond(502,{error:"ai_invalid_response"})}
  return respond(200,{version:VERSION,authority:"none",model:MODEL,base_revision:inst.server_revision,can_edit:canEdit,
    quellen:[...anhaenge.sources.map(x=>x.name),...(tabelle?[tabelle.name]:[])],result});
});
