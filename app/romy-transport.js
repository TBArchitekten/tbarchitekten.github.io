// Reuse Window/apps/isabella/ai.js parseFastSse algorithm and event protocol,
// replacing only the endpoint with the member-scoped TBA Office Romy function.
(()=>{
"use strict";
function parseFastSse(buffer,onEvent){
 let rest=buffer;
 while(true){
  const i=rest.indexOf('\n\n');if(i<0)break;
  const block=rest.slice(0,i);rest=rest.slice(i+2);
  const data=block.split('\n').filter(x=>x.startsWith('data:'))
    .map(x=>x.slice(5).trim()).join('\n');
  if(!data||data==='[DONE]')continue;
  try{onEvent(JSON.parse(data))}catch{}
 }
 return rest;
}
async function send({message,conversationId,requestId,onDelta,replyTo}){
 const sb=window.MINDS_SUPABASE,cfg=window.MINDS_SUPABASE_CONFIG;
 const {data:{session}}=await sb.auth.getSession();
 if(!session||!cfg?.url||!cfg?.publishableKey)throw new Error('authentication_required');
 const response=await fetch(cfg.url+'/functions/v1/office-assistant',{
  method:'POST',
  headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+session.access_token,
    'Content-Type':'application/json',Accept:'text/event-stream'},
  body:JSON.stringify({message,conversation_id:conversationId,request_id:requestId,
    stream:true,reply_to:replyTo||null}),
 });
 if(!response.ok||!response.body){
  let err={};try{err=await response.json()}catch{}
  throw new Error(err.error||'assistant_stream_unavailable');
 }
 const decoder=new TextDecoder(),reader=response.body.getReader();
 let buffer='',result=null,error=null,partial='';
 while(true){
  const {value,done}=await reader.read();if(done)break;
  buffer+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
  buffer=parseFastSse(buffer,event=>{
   if(event?.type==='text_delta'){
    const delta=String(event.delta||'');partial+=delta;
    onDelta?.(delta,partial);
   }else if(event?.type==='result')result=event;
   else if(event?.type==='error')error=event.error||event.message||'assistant_stream_failed';
  });
 }
 if(error)throw new Error(error);
 if(result)return result;
 // The response may already have been persisted: the caller re-reads Supabase
 // instead of automatically starting a second, potentially billable model call.
 const failure=new Error('unconfirmed_stream_result');
 failure.partial=partial;
 throw failure;
}
window.TBA_ROMY_TRANSPORT={send,parseFastSse};
})();
