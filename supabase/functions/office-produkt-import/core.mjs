// TBA Office · Import von Unterlagen in die Produktbibliothek: prüfbare Regeln ohne Netz (24.11.2026, Claude).
// Die Edge Function (index.ts) legt Dateien, die Gari Claude gibt, in den privaten Bucket und trägt sie als Dokument
// eines Bibliothekseintrags ein. Sie hat keine Anmeldung eines Mitglieds, darum gilt nur ein einmaliger Schlüssel:
// in der Datenbank steht sein SHA-256 mit Ablaufzeit (office_import_tokens), nie der Schlüssel selbst.

export const BUCKET="office-produkte";
export const MAX_BYTES=26214400; // wie die Prüfung in office_produkt_dokumente (25 MB)
// Wie die erlaubten Arten in office_produkt_dokumente (Migration 20261123180000).
export const ARTEN=new Set(["datenblatt","preisliste","verlegeanleitung","pflegeanleitung","leistungserklaerung","epd",
  "zertifikat","bild","sonstiges"]);
export const MIMES=new Map([["application/pdf","pdf"],["image/jpeg","jpg"],["image/png","png"],["image/webp","webp"]]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{43,128}$/;

export async function sha256Hex(text){
  const bytes=new TextEncoder().encode(String(text));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
// Nur die Form prüfen; ob der Schlüssel gilt, sagt die Datenbank (Hash und Ablaufzeit).
export function schluesselForm(token){return typeof token==="string"&&TOKEN.test(token)}

// Angaben aus der Adresse (?produkt=…&art=…&name=…&seiten=…) und dem Content-Type.
export function pruefeAnfrage(params,contentType,laenge){
  const produkt=String(params.get("produkt")||"");
  const art=String(params.get("art")||"");
  const name=String(params.get("name")||"").trim();
  const seitenText=params.get("seiten");
  const mime=String(contentType||"").split(";")[0].trim().toLowerCase();
  if(!UUID.test(produkt))return {fehler:"invalid_product"};
  if(!ARTEN.has(art))return {fehler:"invalid_kind"};
  if(name.length<1||name.length>200)return {fehler:"invalid_name"};
  if(!MIMES.has(mime))return {fehler:"invalid_type"};
  if(art==="bild"&&mime==="application/pdf")return {fehler:"invalid_type"};
  let seiten=null;
  if(seitenText!==null&&seitenText!==""){
    seiten=Number(seitenText);
    if(!Number.isInteger(seiten)||seiten<1||seiten>2000)return {fehler:"invalid_pages"};
  }
  const n=Number(laenge);
  if(Number.isFinite(n)&&n>MAX_BYTES)return {fehler:"request_too_large"};
  return {produkt,art,name,seiten,mime,endung:MIMES.get(mime)};
}

// Was ankommt, muss zur Art passen: ein PDF beginnt mit «%PDF», die Bilder mit ihrer Kennung.
export function inhaltPasst(bytes,mime){
  const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(b.length<1||b.length>MAX_BYTES)return false;
  const kopf=(...z)=>z.every((x,i)=>b[i]===x);
  if(mime==="application/pdf")return kopf(0x25,0x50,0x44,0x46);
  if(mime==="image/jpeg")return kopf(0xff,0xd8,0xff);
  if(mime==="image/png")return kopf(0x89,0x50,0x4e,0x47);
  if(mime==="image/webp")return kopf(0x52,0x49,0x46,0x46)&&b[8]===0x57&&b[9]===0x45&&b[10]===0x42&&b[11]===0x50;
  return false;
}

// Pfad wie beim Hochladen im Browser: <Person>/<Eintrag>/<Datei>. Person ist, wer den Eintrag angelegt hat.
export function pfadFuer(person,produkt,endung,uuid=crypto.randomUUID()){
  if(!UUID.test(String(person))||!UUID.test(String(produkt)))throw new Error("invalid_path");
  return person+"/"+produkt+"/"+uuid+"."+endung;
}
