// TBA Office · Versand von Romys Mitteilungen auf das iPhone (27.11.2026, Claude, auf Wunsch von Gari).
// pg_cron ruft die Funktion jede Minute, aber nur wenn eine Mitteilung fällig ist (office_push_v1). Sie prüft ihr
// eigenes Geheimnis (verify_jwt = false), holt die fälligen Mitteilungen, verschlüsselt jede für jedes angemeldete
// iPhone der Person mit dessen Schlüssel und schickt sie an APNs. Apple sieht nur «Romy · Neue Mitteilung».
// Konfiguration: APNS_KEY_P8 und APNS_KEY_ID in Supabase → Edge Functions → Secrets (die Push-Schlüsseldatei von
// Apple, legt Gari selbst an). Team ID und Bundle ID der App sind öffentlich und stehen in isabella_runtime_secrets
// (office_push_apns_team, office_push_apns_bundle); APNS_TEAM_ID und APNS_BUNDLE_ID als Secrets gehen vor.
// Nie Token, Schlüssel oder Texte ins Protokoll.
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {anbieterToken,anfrage,ausgang,einordnen,geheimnisPasst,inhalt,jwtAusSpeicher,versiegeln} from "./core.mjs";

const antwort=(status:number,daten:unknown)=>new Response(JSON.stringify(daten),{status,
  headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const JWT_SCHLUESSEL="office_push_apns_jwt";

Deno.serve(async req=>{
  if(req.method!=="POST")return antwort(405,{error:"method_not_allowed"});
  let body:any={};
  try{body=await req.json()}catch{return antwort(400,{error:"invalid_json"})}
  const url=Deno.env.get("SUPABASE_URL")||"";
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!service)return antwort(401,{error:"unauthorized"});
  const sb=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  // Das Geheimnis des Versands und die zwei öffentlichen Angaben (Team und App) stehen in der Datenbank, nie im Repo.
  const {data:werte}=await sb.from("isabella_runtime_secrets").select("key,value")
    .in("key",["office_push","office_push_apns_team","office_push_apns_bundle"]);
  const wert=(k:string)=>String((werte||[]).find((w:any)=>w.key===k)?.value||"").trim();
  if(!wert("office_push")||!geheimnisPasst(String(body?.secret||""),wert("office_push")))return antwort(401,{error:"unauthorized"});

  const p8=Deno.env.get("APNS_KEY_P8")||"",keyId=(Deno.env.get("APNS_KEY_ID")||"").trim();
  const teamId=(Deno.env.get("APNS_TEAM_ID")||"").trim()||wert("office_push_apns_team");
  const bundle=(Deno.env.get("APNS_BUNDLE_ID")||"").trim()||wert("office_push_apns_bundle");
  if(!p8||!keyId||!teamId||!bundle)return antwort(503,{error:"apns_not_configured"});

  // Ein Anbieter-Token für alle Mitteilungen dieses Laufs, aus dem Speicher, solange es jung genug ist.
  let jwt:string;
  try{
    const {data:gespeichert}=await sb.from("isabella_runtime_secrets").select("value").eq("key",JWT_SCHLUESSEL).maybeSingle();
    const alt=jwtAusSpeicher(gespeichert?.value,keyId,teamId);
    if(alt)jwt=alt;
    else{
      const neu=await anbieterToken({p8,keyId,teamId});
      jwt=neu.token;
      await sb.from("isabella_runtime_secrets").upsert({key:JWT_SCHLUESSEL,
        value:JSON.stringify({kid:keyId,iss:teamId,iat:neu.iat,token:neu.token})},{onConflict:"key"});
    }
  }catch(e){
    console.error("office_push_jwt_failed",e instanceof Error?e.message:"unknown");
    return antwort(503,{error:"apns_key_invalid"});
  }

  const {data:faellig,error:holFehler}=await sb.rpc("office_push_holen",{p_limit:20});
  if(holFehler)return antwort(500,{error:"claim_failed"});
  const zaehler={verarbeitet:0,gesendet:0,wartet:0,ohne_geraet:0,abgelaufen:0,fehlgeschlagen:0};
  let tokenErneuern=false;

  for(const n of (faellig||[]) as any[]){
    zaehler.verarbeitet++;
    const ergebnisse:any[]=[];
    const {data:geraete,error:gFehler}=await sb.from("office_push_geraete")
      .select("id,apns_token,umgebung,bundle_id,schluessel").eq("user_id",n.user_id).eq("aktiv",true)
      .order("last_seen_at",{ascending:false}).limit(5);
    if(gFehler){
      ergebnisse.push({was:"spaeter",status:0,grund:"Geräte nicht lesbar"});
    }else{
      for(const g of (geraete||[]) as any[]){
        if(g.bundle_id!==bundle){
          // Nur die eigene App bekommt Mitteilungen; ein fremdes Ziel wird abgemeldet.
          ergebnisse.push({geraet:g.id,was:"geraet_weg",status:0,grund:"FremdeApp"});
          await sb.from("office_push_geraete").update({aktiv:false,updated_at:new Date().toISOString()}).eq("id",g.id);
          continue;
        }
        try{
          const versiegelt=await versiegeln(g.schluessel,inhalt(n));
          const r=anfrage({geraet:g,jwt,nachricht:n,versiegelt});
          const res=await fetch(r.url,{method:"POST",headers:r.headers,body:r.body,signal:AbortSignal.timeout(15000)});
          let grund="";
          if(res.status!==200){try{grund=String((await res.json())?.reason||"")}catch{grund=""}}
          else await res.body?.cancel();
          const was=einordnen(res.status,grund);
          ergebnisse.push({geraet:g.id,was,status:res.status,grund:grund||undefined,apns_id:res.headers.get("apns-id")||undefined});
          if(was==="geraet_weg")
            await sb.from("office_push_geraete").update({aktiv:false,updated_at:new Date().toISOString()}).eq("id",g.id);
          if(was==="token_neu")tokenErneuern=true;
        }catch(e){
          const name=e instanceof Error?e.name:"";
          const nachricht=e instanceof Error?e.message:"";
          // Ein kaputter Schlüssel oder ein ungültiges Token ist ein Gerätefehler, das Netz ein späterer Versuch.
          const geraetFehler=nachricht==="device_key_invalid"||nachricht==="device_token_invalid"||nachricht==="unknown_environment";
          ergebnisse.push({geraet:g.id,was:geraetFehler?"fehler":"spaeter",status:0,
            grund:geraetFehler?nachricht:name==="TimeoutError"?"Zeitüberschreitung":"Netzwerk"});
        }
      }
    }
    const a=ausgang({ergebnisse,versuche:Number(n.versuche)||1,gueltigBis:n.gueltig_bis});
    zaehler[a.status as keyof typeof zaehler]++;
    await sb.from("office_push_nachrichten").update({
      status:a.status,lease_bis:null,ergebnis:ergebnisse,
      naechster_versuch:a.naechster_versuch||n.naechster_versuch,
      gesendet_am:a.status==="gesendet"?new Date().toISOString():null
    }).eq("id",n.id).eq("status","wird_gesendet");
  }

  // Apple hat das Anbieter-Token abgelehnt: beim nächsten Versuch ein neues.
  if(tokenErneuern)await sb.from("isabella_runtime_secrets").update({value:""}).eq("key",JWT_SCHLUESSEL);
  return antwort(200,{ok:true,...zaehler});
});
