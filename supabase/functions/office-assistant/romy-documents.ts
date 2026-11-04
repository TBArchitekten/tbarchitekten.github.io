// Exact document-maker core ported from Window/isabella-artifact/index.ts.
// Only ownership, storage and provenance are adapted to TBA Office / Romy.
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "npm:docx@9.5.1";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
function cleanTitle(v:any){return String(v||"Artefacto").trim().slice(0,160)||"Artefacto"}
function safeName(v:string){return v.normalize("NFKD").replace(/[^a-zA-Z0-9-_]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"artefacto"}
function b64Bytes(s:string){const bin=atob(s),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function normalizeText(s:string){return String(s||"").replace(/\r\n/g,"\n").replace(/\r/g,"\n").trim()}
function docxParagraphs(content:string){
  const lines=normalizeText(content).split("\n");
  const out:any[]=[];
  for(const raw of lines){
    const line=raw.trimEnd();
    if(!line.trim()){out.push(new Paragraph({text:""}));continue}
    const h=line.match(/^(#{1,3})\s+(.+)$/);
    if(h){
      const level=h[1].length===1?HeadingLevel.HEADING_1:h[1].length===2?HeadingLevel.HEADING_2:HeadingLevel.HEADING_3;
      out.push(new Paragraph({text:h[2],heading:level,spacing:{before:180,after:100}}));continue;
    }
    const bullet=line.match(/^[-*]\s+(.+)$/);
    if(bullet){out.push(new Paragraph({text:bullet[1],bullet:{level:0},spacing:{after:80}}));continue}
    out.push(new Paragraph({children:[new TextRun({text:line})],spacing:{after:100,line:300}}));
  }
  return out;
}
async function makeDocx(title:string,content:string){
  const doc=new Document({
    sections:[{properties:{},children:[
      new Paragraph({text:title,heading:HeadingLevel.TITLE,spacing:{after:260}}),
      ...docxParagraphs(content)
    ]}]
  });
  const buf=await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}
function wrapLine(text:string,font:any,size:number,maxWidth:number){
  const words=text.split(/\s+/).filter(Boolean),lines:string[]=[];let line="";
  for(const word of words){
    const candidate=line?line+" "+word:word;
    if(font.widthOfTextAtSize(candidate,size)<=maxWidth){line=candidate;continue}
    if(line)lines.push(line);
    if(font.widthOfTextAtSize(word,size)<=maxWidth){line=word;continue}
    let chunk="";
    for(const ch of word){
      const c=chunk+ch;
      if(font.widthOfTextAtSize(c,size)<=maxWidth)chunk=c;
      else{if(chunk)lines.push(chunk);chunk=ch}
    }
    line=chunk;
  }
  if(line)lines.push(line);
  return lines.length?lines:[""];
}
async function makePdf(title:string,content:string){
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const width=595.28,height=841.89,margin=56,maxWidth=width-margin*2;
  let page=pdf.addPage([width,height]),y=height-margin;
  const addPage=()=>{page=pdf.addPage([width,height]);y=height-margin};
  const drawWrapped=(text:string,f:any,size:number,gap:number)=>{
    for(const line of wrapLine(text,f,size,maxWidth)){
      if(y<margin+size+8)addPage();
      page.drawText(line,{x:margin,y:y-size,font:f,size,color:rgb(0.08,0.08,0.08)});
      y-=gap;
    }
  };
  drawWrapped(title,bold,22,29);y-=8;
  for(const raw of normalizeText(content).split("\n")){
    const line=raw.trim();
    if(!line){y-=9;continue}
    const h=line.match(/^(#{1,3})\s+(.+)$/);
    if(h){y-=6;drawWrapped(h[2],bold,h[1].length===1?17:h[1].length===2?15:13,23);y-=4;continue}
    const bullet=line.match(/^[-*]\s+(.+)$/);
    if(bullet){drawWrapped("• "+bullet[1],font,11,16);continue}
    drawWrapped(line,font,11,16);y-=3;
  }
  return await pdf.save();
}

async function sha256Hex(text:string){
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
 return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,"0")).join("");
}
export const ROMY_DOCUMENT_KINDS=Object.freeze(["docx","pdf","txt"]);
export async function createRomyDocument({admin,userId,conversationId,requestId,kind,title,content}:
  {admin:any,userId:string,conversationId:string,requestId:string,kind:string,title:string,content:string}){
 if(!ROMY_DOCUMENT_KINDS.includes(kind))return {error:"unsupported_document_format"};
 const clean=normalizeText(content),docTitle=cleanTitle(title);
 if(!clean)return {error:"document_content_required"};
 if(clean.length>180000)return {error:"document_too_large_for_inline_generation"};
 const hash=await sha256Hex(kind+"\n"+docTitle+"\n"+clean);
 const path=userId+"/chat/"+conversationId+"/"+requestId+"-"+hash.slice(0,20)+"."+kind;
 const {data:existing}=await admin.from("office_romy_artifacts")
   .select("id,kind,title,mime_type,storage_path,size_bytes").eq("storage_path",path)
   .eq("user_id",userId).maybeSingle();
 if(existing)return {status:"completed",artifact:existing,already_exists:true};
 let bytes:Uint8Array,mime:string;
 if(kind==="docx"){
  bytes=await makeDocx(docTitle,clean);
  mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
 }else if(kind==="pdf"){
  bytes=await makePdf(docTitle,clean);
  mime="application/pdf";
 }else{
  bytes=new TextEncoder().encode(clean);
  mime="text/plain;charset=utf-8";
 }
 if(bytes.length>25000000)return {error:"document_output_too_large"};
 const {error:uploadError}=await admin.storage.from("office-romy-artifacts").upload(path,bytes,{
   contentType:mime,upsert:false
 });
 if(uploadError){
   const {data:found}=await admin.from("office_romy_artifacts")
     .select("id,kind,title,mime_type,storage_path,size_bytes")
     .eq("storage_path",path).eq("user_id",userId).maybeSingle();
   return found?{status:"completed",artifact:found,already_exists:true}:{error:"document_upload_failed"};
 }
 const {data:row,error:recordError}=await admin.from("office_romy_artifacts")
   .insert({user_id:userId,conversation_id:conversationId,request_id:requestId,
     kind,title:docTitle,mime_type:mime,storage_path:path,
     size_bytes:bytes.length,content_sha256:hash})
   .select("id,kind,title,mime_type,storage_path,size_bytes").single();
 if(recordError){
   await admin.storage.from("office-romy-artifacts").remove([path]);
   return {error:"document_record_failed"};
 }
 return {status:"completed",artifact:row,provenance:"generated_deliverable_not_project_truth"};
}
