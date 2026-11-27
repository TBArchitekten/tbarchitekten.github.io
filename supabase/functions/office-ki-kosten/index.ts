// TBA Office · tatsächliche Kosten des Monats bei OpenAI (27.11.2026, Gari: «Sobre el Monatslimit, sí prepáralo como
// propones»). Nur für Administratoren. Liest mit einem Admin-Schlüssel von OpenAI, der nur lesen darf (Secret
// OPENAI_ADMIN_KEY, angelegt von der Inhaberin oder dem Inhaber der OpenAI-Organisation), die Costs-API: Summe seit
// Monatsbeginn, je Tag und je OpenAI-Projekt. Speichert nichts und gibt den Schlüssel nie weiter. Ohne Schlüssel
// antwortet sie {verfuegbar:false}; die KI-Nutzung schätzt dann aus den Tokens.
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {VERSION,monatsBeginnUtc,kostenUrl,zusammenfassen} from "./core.mjs";

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

Deno.serve(async req=>{
  const origin=req.headers.get("origin");
  if(origin&&origin!==ORIGIN)return respond(403,{error:"origin_forbidden"});
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="POST")return respond(405,{error:"method_not_allowed"});
  const authHeader=req.headers.get("authorization")||"";
  const token=/^Bearer\s+(\S+)$/i.exec(authHeader)?.[1];
  if(!token)return respond(401,{error:"authentication_required"});
  const apiUrl=Deno.env.get("SUPABASE_URL")||"";
  const publicKey=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
  if(!apiUrl||!publicKey)return respond(503,{error:"office_auth_unavailable"});
  // Mit der Sitzung der Person: nur aktive Administratoren.
  const sb=createClient(apiUrl,publicKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await sb.auth.getUser(token);
  if(authError||!auth.user)return respond(401,{error:"invalid_session"});
  const {data:member,error:memberError}=await sb.from("office_members")
    .select("role,is_active").eq("user_id",auth.user.id).eq("is_active",true).maybeSingle();
  if(memberError||!member||member.role!=="admin")return respond(403,{error:"admin_only"});

  const key=Deno.env.get("OPENAI_ADMIN_KEY")||"";
  if(!key)return respond(200,{verfuegbar:false,grund:"kein_schluessel",version:VERSION});
  const openai={Authorization:"Bearer "+key};
  const start=monatsBeginnUtc();
  // deno-lint-ignore no-explicit-any
  const seiten:any[]=[];
  let seite:string|null=null;
  try{
    for(let i=0;i<4;i++){
      const r=await fetch(kostenUrl(start,seite),{headers:openai,signal:AbortSignal.timeout(15000)});
      if(r.status===401||r.status===403)return respond(200,{verfuegbar:false,grund:"schluessel_abgelehnt",version:VERSION});
      if(!r.ok)return respond(502,{error:"openai_kosten_fehler",status:r.status});
      const daten=await r.json();
      seiten.push(daten);
      if(!daten?.has_more||!daten?.next_page)break;
      seite=String(daten.next_page);
    }
  }catch{return respond(502,{error:"openai_nicht_erreichbar"})}
  // Namen der OpenAI-Projekte (etwa Office und Window), soweit der Schlüssel sie lesen darf.
  const namen:Record<string,string>={};
  try{
    const r=await fetch("https://api.openai.com/v1/organization/projects?limit=100&include_archived=true",
      {headers:openai,signal:AbortSignal.timeout(10000)});
    if(r.ok){const d=await r.json();for(const p of d?.data||[])if(p?.id)namen[String(p.id)]=String(p.name||"")}
  }catch{/* ohne Namen weiter */}
  return respond(200,{...zusammenfassen(seiten,namen),version:VERSION});
});
