// TBA Office · Romy in den Dokumenten des Projekts (24.11.2026, Claude; Entwurf von Gari am 24.11.2026 freigegeben).
// Wie office-produkt-ai: Anmeldung und Office-Mitgliedschaft prüfen, das Dokument unter RLS lesen (wer es nicht sehen
// darf, bekommt nichts), jede Anfrage vor dem bezahlten Modellaufruf zählen, Antwort nach festem Schema prüfen.
// Die Funktion schreibt nichts: Vorschläge speichert der Client als Vorschlag, gelten tun sie erst nach «Übernehmen».
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {MODEL,VERSION,AUFGABEN,TEXTFELDER,GRENZE,schemaVorschlaege,SCHEMA_TEXT,SCHEMA_FELDTEXT,anweisungen,
  pruefeVorschlaege,pruefeText,pruefeFeldtext,kurzZeilen,termineAusPlaenen} from "./core.mjs";
import {normalizePlanAttachments} from "../office-terminplan-ai/attachments.mjs";

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
const text=(t:unknown,n:number)=>String(t??"").slice(0,n);
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
const heute=()=>new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Berlin"});

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
  if(!["status","vorschlaege","auswahl","text"].includes(action))return respond(400,{error:"invalid_request"});
  const {data:member,error:memberError}=await sb.from("office_members")
    .select("role,is_active").eq("user_id",auth.user.id).eq("is_active",true).maybeSingle();
  if(memberError||!member)return respond(403,{error:"not_an_office_member"});
  const secret=Deno.env.get("TBA_OFFICE_OPENAI_API_KEY")||"";
  if(action==="status")return respond(200,{ready:!!secret,version:VERSION,model:MODEL});
  if(!secret)return respond(503,{error:"ai_not_configured"});

  // Das Dokument und seine Zeilen unter RLS: wer nicht im Projektteam ist, sieht nichts.
  const dokumentId=String(input.dokument_id||"");
  if(!/^[0-9a-f-]{36}$/i.test(dokumentId))return respond(400,{error:"invalid_document"});
  const {data:dok,error:dokError}=await sb.from("office_projektdokumente").select("id,art,project_id").eq("id",dokumentId).maybeSingle();
  if(dokError)return respond(503,{error:"documents_unavailable"});
  if(!dok)return respond(403,{error:"no_access"});
  const art=dok.art;
  if(!["klaerungsliste","entscheidungsliste"].includes(art))return respond(400,{error:"invalid_document"});
  const [{data:zeilen,error:zeilenError},{data:projekt}]=await Promise.all([
    sb.from("office_projektdokument_zeilen").select("id,nr,daten").eq("dokument_id",dokumentId).order("nr").limit(GRENZE.zeilen),
    sb.from("office_projects").select("number,name").eq("id",dok.project_id).maybeSingle()]);
  if(zeilenError)return respond(503,{error:"documents_unavailable"});
  const alle=zeilen||[];
  const kopf={heute:heute(),projekt:{nummer:projekt?.number||"",name:projekt?.name||""},liste:art};

  // deno-lint-ignore no-explicit-any
  let aufgabe="",schema:any=null,teile:any[]=[],quelle="",pruefe:(a:unknown)=>unknown;
  if(action==="vorschlaege"){
    let anhaenge;
    try{anhaenge=normalizePlanAttachments(input.attachments)}catch{return respond(400,{error:"invalid_attachments"})}
    const eingefuegt=text(input.text,GRENZE.text).trim();
    if(anhaenge.parts.length>1)return respond(400,{error:"one_document_required"});
    if(!anhaenge.parts.length&&!eingefuegt)return respond(400,{error:"document_or_text_required"});
    quelle=text(input.quelle,200).trim()||anhaenge.sources[0]?.name||"eingefügter Text";
    aufgabe="vorschlaege";schema=schemaVorschlaege(art);
    teile=[{type:"input_text",text:JSON.stringify({...kopf,quelle,hinweis:text(input.hinweis,600),vorhandene_zeilen:kurzZeilen(art,alle)})},
      ...(eingefuegt?[{type:"input_text",text:"Material (eingefügter Text aus «"+quelle+"»):\n"+eingefuegt}]:[]),...anhaenge.parts];
    pruefe=a=>pruefeVorschlaege(a,{art,zeilen:alle});
  }else if(action==="auswahl"){
    aufgabe=String(input.aufgabe||"");
    if(!AUFGABEN.includes(aufgabe))return respond(400,{error:"invalid_task"});
    const ids=new Set((Array.isArray(input.zeilen_ids)?input.zeilen_ids:[]).slice(0,GRENZE.auswahl).map(String));
    // deno-lint-ignore no-explicit-any
    const gewaehlt=alle.filter((z:any)=>ids.has(z.id));
    if(!gewaehlt.length)return respond(400,{error:"rows_required"});
    if((aufgabe==="frage_fachplaner"||aufgabe==="fristen_terminplan")&&art!=="klaerungsliste")return respond(400,{error:"invalid_task"});
    if(aufgabe==="bestaetigung"&&art!=="entscheidungsliste")return respond(400,{error:"invalid_task"});
    // deno-lint-ignore no-explicit-any
    const nutzlast:any={...kopf,zeilen:kurzZeilen(art,gewaehlt)};
    if(aufgabe==="frage"){const frage=text(input.frage,2000).trim();if(!frage)return respond(400,{error:"question_required"});nutzlast.frage=frage}
    if(aufgabe==="fristen_terminplan"){
      const {data:plaene,error:planError}=await sb.from("office_terminplan_instances").select("phase,state")
        .eq("project_id",dok.project_id).eq("is_archived",false).order("updated_at",{ascending:false}).limit(5);
      if(planError)return respond(503,{error:"terminplan_unavailable"});
      nutzlast.terminplan=termineAusPlaenen(plaene);
      if(!nutzlast.terminplan.length)return respond(409,{error:"no_terminplan"});
      schema=schemaVorschlaege(art);
      // Nur die Frist darf sich ändern; alles andere aus der Antwort fällt weg.
      pruefe=a=>{const r=pruefeVorschlaege(a,{art,zeilen:gewaehlt});
        // deno-lint-ignore no-explicit-any
        r.vorschlaege=r.vorschlaege.filter((v:any)=>v.art==="aenderung").map((v:any)=>({...v,daten:v.daten.frist?{frist:v.daten.frist}:{}})).filter((v:any)=>v.daten.frist);
        return r};
      quelle="Terminplan";
    }else{schema=SCHEMA_TEXT;pruefe=a=>pruefeText(a)}
    teile=[{type:"input_text",text:JSON.stringify(nutzlast)}];
  }else{
    // Einen Abschnitt einer Entscheidungsvorlage neu formulieren.
    if(art!=="entscheidungsliste")return respond(400,{error:"invalid_document"});
    const feld=String(input.feld||"");
    if(!TEXTFELDER.includes(feld))return respond(400,{error:"invalid_field"});
    // deno-lint-ignore no-explicit-any
    const z=alle.find((x:any)=>x.id===String(input.zeile_id||""));
    if(!z)return respond(400,{error:"rows_required"});
    const auftrag=text(input.auftrag,1000).trim();
    if(!auftrag)return respond(400,{error:"instruction_required"});
    const alt=String(z.daten?.[feld]??"");
    aufgabe="text";schema=SCHEMA_FELDTEXT;
    teile=[{type:"input_text",text:JSON.stringify({...kopf,entscheidung:kurzZeilen(art,[z])[0],anlass:text(z.daten?.anlass,2500),abschnitt:feld,text:alt,auftrag})}];
    pruefe=a=>({...pruefeFeldtext(a,{alt}),zeile_id:z.id,feld});
  }

  // Jede Anfrage wird vor dem bezahlten Modellaufruf gezählt; ein Tageslimit gibt es nicht.
  const {data:allowed,error:quotaError}=await sb.rpc("office_projektdokument_ai_consume_request");
  if(quotaError)return respond(503,{error:"office_ai_quota_unavailable"});
  if(allowed!==true)return respond(403,{error:"ai_request_not_allowed"});
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),150000);
  // deno-lint-ignore no-explicit-any
  let provider:any;
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",signal:controller.signal,
      headers:{"Authorization":"Bearer "+secret,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:MODEL,store:false,max_output_tokens:action==="vorschlaege"?12000:5000,reasoning:{effort:action==="vorschlaege"?"medium":"low"},
        instructions:anweisungen(aufgabe,art),
        input:[{role:"user",content:teile}],
        text:{format:{type:"json_schema",name:"office_dokumente_"+aufgabe+"_v1",strict:true,schema}}
      })
    });
    if(!response.ok){console.error("Office document AI provider failed",response.status);return respond(502,{error:"ai_provider_unavailable"})}
    provider=await response.json();
  }catch(error){
    console.error("Office document AI request did not complete",String((error as Error)?.name||"request_failed"));
    return respond(504,{error:"ai_timeout_or_network"});
  }finally{clearTimeout(timeout)}
  const ausgabe=outputText(provider);
  if(!ausgabe)return respond(502,{error:"ai_incomplete"});
  let result;
  try{result=pruefe(JSON.parse(ausgabe))}catch(e){
    if(String((e as Error)?.message)==="unchanged")return respond(200,{version:VERSION,authority:"none",model:MODEL,result:{unveraendert:true}});
    return respond(502,{error:"ai_invalid_response"});
  }
  return respond(200,{version:VERSION,authority:"none",model:MODEL,aufgabe,quelle,result});
});
