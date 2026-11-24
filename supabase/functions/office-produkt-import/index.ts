// TBA Office · Import von Unterlagen in die Produktbibliothek (24.11.2026, Claude; Wunsch von Gari am 24.11.2026).
// Gari gibt Claude Datenblätter und Angebote; Claude legt die Einträge an und die Dateien mit dieser Funktion in den
// privaten Bucket, damit niemand sie von Hand hochladen muss. Ohne Anmeldung eines Mitglieds (verify_jwt = false):
// es gilt nur ein einmaliger Schlüssel im Kopf «x-import-token», dessen SHA-256 mit Ablaufzeit in office_import_tokens
// steht. Ohne gültigen Schlüssel antwortet die Funktion 401 und tut nichts. Nie Inhalte oder Schlüssel ins Protokoll.
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {BUCKET,inhaltPasst,pfadFuer,pruefeAnfrage,schluesselForm,sha256Hex} from "./core.mjs";

const respond=(status:number,payload:unknown)=>new Response(JSON.stringify(payload),{status,
  headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});

Deno.serve(async req=>{
  if(req.method!=="POST")return respond(405,{error:"method_not_allowed"});
  const token=req.headers.get("x-import-token")||"";
  if(!schluesselForm(token))return respond(401,{error:"import_closed"});
  const apiUrl=Deno.env.get("SUPABASE_URL")||"";
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!apiUrl||!serviceKey)return respond(401,{error:"import_closed"});
  const admin=createClient(apiUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});

  const hash=await sha256Hex(token);
  const {data:schluessel,error:se}=await admin.from("office_import_tokens").select("id")
    .eq("token_sha256",hash).gt("gueltig_bis",new Date().toISOString()).maybeSingle();
  if(se||!schluessel)return respond(401,{error:"import_closed"});

  const url=new URL(req.url);
  const anfrage=pruefeAnfrage(url.searchParams,req.headers.get("content-type"),req.headers.get("content-length"));
  if(anfrage.fehler)return respond(400,{error:anfrage.fehler});

  const {data:eintrag,error:pe}=await admin.from("office_produkte").select("id,created_by,archiviert")
    .eq("id",anfrage.produkt).maybeSingle();
  if(pe||!eintrag||eintrag.archiviert)return respond(404,{error:"product_not_found"});

  const bytes=new Uint8Array(await req.arrayBuffer());
  if(!inhaltPasst(bytes,anfrage.mime))return respond(400,{error:"content_mismatch"});

  const pfad=pfadFuer(eintrag.created_by,eintrag.id,anfrage.endung);
  const {error:upErr}=await admin.storage.from(BUCKET).upload(pfad,bytes,{contentType:anfrage.mime,upsert:false});
  if(upErr)return respond(502,{error:"upload_failed"});
  const {data:dok,error:insErr}=await admin.from("office_produkt_dokumente").insert({
    produkt_id:eintrag.id,art:anfrage.art,name:anfrage.name,storage_path:pfad,mime_type:anfrage.mime,
    size_bytes:bytes.length,seiten:anfrage.seiten,created_by:eintrag.created_by
  }).select("id").single();
  if(insErr||!dok){
    await admin.storage.from(BUCKET).remove([pfad]);
    return respond(502,{error:"document_not_saved"});
  }
  return respond(200,{id:dok.id,storage_path:pfad,size_bytes:bytes.length});
});
