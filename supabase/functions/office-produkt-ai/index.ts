// TBA Office · Datenblatt-Leser der Produktbibliothek (23.11.2026, Claude; Entwurf von Gari am 23.11.2026 freigegeben).
// Wie office-kosten-ai: Anmeldung und Office-Mitgliedschaft prüfen, jede Anfrage vor dem bezahlten Modellaufruf zählen
// (kein Tageslimit), ein Dokument lesen, Antwort nach festem Schema. Ohne Websuche: es zählt nur, was im Dokument
// steht. Der Leser speichert nichts; die Bibliothek übernimmt erst nach «Prüfen und übernehmen» im Client.
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {MODEL,VERSION,SCHEMA,anweisungen,pruefeAntwort,pruefeFamilien,validKategorie} from "./core.mjs";
import {normalizePlanAttachments} from "../office-terminplan-ai/attachments.mjs";
import {dienstFuer,verbrauchSchreiben} from "../_office/ki-verbrauch.mjs";

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
  if(Number(req.headers.get("content-length")||"0")>12*1024*1024)return respond(413,{error:"request_too_large"});
  const authHeader=req.headers.get("authorization")||"";
  const token=/^Bearer\s+(\S+)$/i.exec(authHeader)?.[1];
  if(!token)return respond(401,{error:"authentication_required"});
  const apiUrl=Deno.env.get("SUPABASE_URL")||"";
  const publicKey=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
  if(!apiUrl||!publicKey)return respond(503,{error:"office_auth_unavailable"});
  // Alles mit der Sitzung der Person: RLS entscheidet, was sie lesen darf.
  const sb=createClient(apiUrl,publicKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await sb.auth.getUser(token);
  if(authError||!auth.user)return respond(401,{error:"invalid_session"});
  // deno-lint-ignore no-explicit-any
  let input:any;
  try{
    const raw=await req.text();
    if(raw.length>12*1024*1024)return respond(413,{error:"request_too_large"});
    input=JSON.parse(raw);
  }catch{return respond(400,{error:"invalid_json"})}
  const action=input?.action;
  if(!["status","lesen"].includes(action))return respond(400,{error:"invalid_request"});
  const {data:member,error:memberError}=await sb.from("office_members")
    .select("role,is_active").eq("user_id",auth.user.id).eq("is_active",true).maybeSingle();
  if(memberError||!member)return respond(403,{error:"not_an_office_member"});
  const secret=Deno.env.get("TBA_OFFICE_OPENAI_API_KEY")||"";
  if(action==="status")return respond(200,{ready:!!secret,version:VERSION,model:MODEL});
  if(!secret)return respond(503,{error:"ai_not_configured"});
  let anhaenge;
  try{anhaenge=normalizePlanAttachments(input.attachments)}catch{return respond(400,{error:"invalid_attachments"})}
  if(anhaenge.parts.length!==1)return respond(400,{error:"one_document_required"});
  const kategorie=validKategorie(input.kategorie)?input.kategorie:"";
  // Die Familien der Bibliothek liest die Funktion selbst (unter RLS), damit Romy eine vorhandene wählt.
  const {data:familienZeilen,error:familienError}=await sb.from("office_produkte").select("familie")
    .not("familie","is",null).eq("archiviert",false).limit(500);
  if(familienError)return respond(503,{error:"library_unavailable"});
  const bekannte_familien=pruefeFamilien((familienZeilen||[]).map((x:{familie:string})=>x.familie));
  // Jede Anfrage wird vor dem bezahlten Modellaufruf gezählt; ein Tageslimit gibt es nicht.
  const {data:allowed,error:quotaError}=await sb.rpc("office_produkt_ai_consume_request");
  if(quotaError)return respond(503,{error:"office_ai_quota_unavailable"});
  if(allowed!==true)return respond(403,{error:"ai_request_not_allowed"});
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),120000);
  // deno-lint-ignore no-explicit-any
  let provider:any;
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",signal:controller.signal,
      headers:{"Authorization":"Bearer "+secret,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:MODEL,store:false,max_output_tokens:6000,reasoning:{effort:"low"},
        instructions:anweisungen(),
        input:[{role:"user",content:[
          {type:"input_text",text:JSON.stringify({dateiname:anhaenge.sources[0].name,kategorie_hinweis:kategorie,bekannte_familien})},
          ...anhaenge.parts]}],
        text:{format:{type:"json_schema",name:"office_produkt_datenblatt_v1",strict:true,schema:SCHEMA}}
      })
    });
    if(!response.ok){console.error("Office product AI provider failed",response.status);return respond(502,{error:"ai_provider_unavailable"})}
    provider=await response.json();
    // Verbrauch je Funktion, ohne Person (Übersicht für Administratoren); die Bibliothek gehört zu keinem Projekt.
    await verbrauchSchreiben(dienstFuer(createClient),{funktion:"produkte",modell:MODEL,payload:provider});
  }catch(error){
    console.error("Office product AI request did not complete",String((error as Error)?.name||"request_failed"));
    return respond(504,{error:"ai_timeout_or_network"});
  }finally{clearTimeout(timeout)}
  const text=outputText(provider);
  if(!text)return respond(502,{error:"ai_incomplete"});
  let result;
  try{result=pruefeAntwort(JSON.parse(text))}catch{return respond(502,{error:"ai_invalid_response"})}
  return respond(200,{version:VERSION,authority:"none",model:MODEL,quelle:anhaenge.sources[0].name,result});
});
