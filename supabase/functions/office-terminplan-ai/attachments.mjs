// One-turn, non-persistent PDF/image input boundary for Office Terminplan.
export const MAX_PLAN_FILE_BYTES=8*1024*1024;
export const MAX_PLAN_TOTAL_BYTES=12*1024*1024;
const MIME=new Set(['application/pdf','image/jpeg','image/png','image/webp']);
export function normalizePlanAttachments(raw){
  if(raw==null)return {parts:[],sources:[]};
  if(!Array.isArray(raw)||raw.length>3)throw Error('invalid_attachments');
  const parts=[],sources=[];let total=0;
  for(const file of raw){
    const mime=String(file?.mime||''),name=String(file?.name||'').trim(),data=String(file?.data||'');
    if(!MIME.has(mime)||!name||name.length>180||/[\\/\x00-\x1f]/.test(name))throw Error('invalid_attachment_type');
    const prefix='data:'+mime+';base64,';
    if(!data.startsWith(prefix))throw Error('invalid_attachment_encoding');
    const encoded=data.slice(prefix.length);
    if(encoded.length<8||encoded.length>Math.ceil(MAX_PLAN_FILE_BYTES*4/3)+8||
       !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
       throw Error('invalid_attachment_base64');
    const bytes=atob(encoded);
    if(!bytes.length||bytes.length>MAX_PLAN_FILE_BYTES)throw Error('invalid_attachment_size');
    total+=bytes.length;
    if(total>MAX_PLAN_TOTAL_BYTES||Number(file.size)!==bytes.length)throw Error('invalid_attachment_total');
    if(mime==='application/pdf'&&!bytes.startsWith('%PDF-'))throw Error('invalid_pdf_signature');
    if(mime==='image/jpeg'&&!(bytes.charCodeAt(0)===255&&bytes.charCodeAt(1)===216&&bytes.charCodeAt(2)===255))throw Error('invalid_image_signature');
    if(mime==='image/png'&&!(bytes.charCodeAt(0)===137&&bytes.slice(1,4)==='PNG'))throw Error('invalid_image_signature');
    if(mime==='image/webp'&&!(bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP'))throw Error('invalid_image_signature');
    parts.push(mime==='application/pdf'?{type:'input_file',filename:name,file_data:data}:{type:'input_image',image_url:data,detail:'high'});
    sources.push({name,mime,size:bytes.length});
  }
  return {parts,sources};
}
