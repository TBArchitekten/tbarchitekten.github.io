// Faithful adaptation of Window's resolveInputFiles from Isabella Capability Runtime.
// TBA Office project files are shared through their own Storage RLS; generated
// artifacts are per-employee. No service role reads user source files.
export const INPUT_EXTENSIONS=new Set(["doc","docx","pdf","xls","xlsx","ppt","pptx","csv","zip","html","htm","txt","json","md","png","jpg","jpeg","webp"]);
const INPUT_MIME_BY_EXT:Record<string,string>={
  doc:"application/msword",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf:"application/pdf",xls:"application/vnd.ms-excel",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt:"application/vnd.ms-powerpoint",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv:"text/csv",zip:"application/zip",html:"text/html",htm:"text/html",txt:"text/plain",json:"application/json",md:"text/markdown",
  png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp"
};
const MAX_INPUT_FILE_BYTES=12*1024*1024;
const MAX_INPUT_TOTAL_BYTES=24*1024*1024;
function safeFilename(v:any){
  const raw=String(v||"input").split("/").pop()||"input";
  return raw.replace(/[^a-zA-Z0-9._() -]+/g,"-").replace(/^[-. ]+|[-. ]+$/g,"").slice(0,180)||"input";
}
function extension(v:any){const m=String(v||"").toLowerCase().match(/\.([a-z0-9]+)$/);return m?.[1]||""}
export function inputRefs(v:any){
  const seen=new Set<string>(),out:any[]=[];
  for(const raw of (Array.isArray(v)?v:[]).slice(0,8)){
    const source=String(raw?.source||"").trim(),id=uuid(raw?.id);
    if(!id||!["artifact","work_file"].includes(source))continue;
    const key=source+":"+id;if(seen.has(key))continue;seen.add(key);
    out.push({source,id});
    if(out.length>=6)break;
  }
  return out;
}
function bytesToBase64(bytes:Uint8Array){
  let out="";for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));
  return btoa(out);
}
export async function resolveRomyInputFiles(sb:any,userId:string,refs:any[]){
  const resolved:any[]=[];let total=0;
  for(const ref of refs){
    let row:any=null,bucket="",name="",mime="";
    if(ref.source==="artifact"){
      const {data}=await sb.from("office_romy_artifacts")
        .select("id,user_id,title,mime_type,storage_path")
        .eq("id",ref.id).eq("user_id",userId).maybeSingle();
      if(!data)throw new Error("input_artifact_not_found");
      row=data;bucket="office-romy-artifacts";name=safeFilename(data.title||"artifact");mime=String(data.mime_type||"application/octet-stream");
    }else{
      const {data}=await sb.from("minds_work_files")
        .select("id,user_id,project_id,name,mime_type,size_bytes,storage_path")
        .eq("id",ref.id).maybeSingle();
      if(!data)throw new Error("input_work_file_not_found");
      row=data;bucket="minds-work";name=safeFilename(data.name||"work-file");mime=String(data.mime_type||"application/octet-stream");
      if(Number(data.size_bytes||0)>MAX_INPUT_FILE_BYTES)throw new Error("input_file_too_large");
    }
    const ext=extension(name);
    if(!INPUT_EXTENSIONS.has(ext))throw new Error("input_file_type_not_supported:"+ext);
    if(!mime||mime==="application/octet-stream")mime=INPUT_MIME_BY_EXT[ext]||"application/octet-stream";
    const {data:blob,error}=await sb.storage.from(bucket).download(row.storage_path);
    if(error||!blob)throw new Error("input_file_download_failed");
    const bytes=new Uint8Array(await blob.arrayBuffer());
    if(!bytes.length||bytes.length>MAX_INPUT_FILE_BYTES)throw new Error("input_file_size_invalid");
    total+=bytes.length;if(total>MAX_INPUT_TOTAL_BYTES)throw new Error("input_files_total_too_large");
    resolved.push({
      source:ref.source,id:ref.id,name,mime,size:bytes.length,
      file_data:`data:${mime};base64,${bytesToBase64(bytes)}`
    });
  }
  return resolved;
}


export function appendCurrentTurnUploads(files:any[],loaded:any[]){
 const out=[...files];
 for(const item of Array.isArray(loaded)?loaded:[]){
  if(item?.type!=="input_file")continue;
  const name=safeFilename(item.filename||"chat-upload"),ext=extension(name);
  if(!INPUT_EXTENSIONS.has(ext))continue;
  const file_data=String(item.file_data||"");
  if(!file_data.startsWith("data:")||file_data.length>17*1024*1024)continue;
  if(out.length>=6)break;
  out.push({source:"chat_attachment",id:null,name,mime:INPUT_MIME_BY_EXT[ext]||"application/octet-stream",
   size:Math.floor(file_data.length*3/4),file_data});
 }
 const total=out.reduce((sum,x)=>sum+Number(x.size||0),0);
 if(total>24*1024*1024)throw new Error("input_files_total_too_large");
 return out;
}
