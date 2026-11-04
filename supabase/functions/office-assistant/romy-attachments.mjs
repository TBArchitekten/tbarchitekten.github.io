// Adapted from Window/isabella-chat loadChatAttachments and bytesToBase64.
// Office bucket and JWT ownership are separate from Gari's personal Window.
function bytesToBase64(bytes){
 let out="";const step=0x8000;
 for(let i=0;i<bytes.length;i+=step)
   out+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+step)));
 return btoa(out);
}
const IMAGES=new Set(["image/jpeg","image/png","image/webp"]);
const FILES=new Set([
 "application/pdf","text/plain","text/markdown","text/csv","application/json",
 "application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document",
 "application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation",
 "application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","message/rfc822"
]);
export async function loadRomyAttachments(userDb,userId,raw){
 const items=Array.isArray(raw)?raw:[];
 if(items.length>3)throw new Error("too_many_attachments");
 const inputs=[],metadata=[];let total=0;
 for(const item of items){
  const path=String(item?.path||"").trim();
  const mime=String(item?.mime||"").trim().toLowerCase();
  const name=String(item?.name||"Datei").slice(0,180);
  if(!path.startsWith(userId+"/chat/")||(!IMAGES.has(mime)&&!FILES.has(mime)))
   throw new Error("invalid_attachment");
  // The caller's JWT and private Storage RLS, not a service-role reader.
  const {data,error}=await userDb.storage.from("office-romy-uploads").download(path);
  if(error||!data)throw new Error("attachment_not_accessible");
  const bytes=new Uint8Array(await data.arrayBuffer());
  if(!bytes.length||bytes.length>12*1024*1024||total+bytes.length>24*1024*1024)
   throw new Error("attachment_size_invalid");
  total+=bytes.length;
  const encoded=bytesToBase64(bytes);
  inputs.push(IMAGES.has(mime)
   ?{type:"input_image",image_url:"data:"+mime+";base64,"+encoded,detail:"auto"}
   :{type:"input_file",file_data:"data:"+mime+";base64,"+encoded,filename:name});
  metadata.push({path,mime,name,size:bytes.length});
 }
 return {inputs,metadata};
}
