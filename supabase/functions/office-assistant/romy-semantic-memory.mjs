// Romy semantic retrieval: a read of private owner-scoped canonical sources.
// Embeddings are auxiliary indexes, never memories or project facts.
export const ROMY_EMBEDDING_MODEL="text-embedding-3-small";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm=(s,n)=>String(s||"").trim().slice(0,n);
const validVector=v=>Array.isArray(v)&&v.length===1536&&v.every(x=>typeof x==="number"&&Number.isFinite(x));
const vectorString=v=>"["+v.map(x=>String(x)).join(",")+"]";
export function semanticCandidates(messages,memories,indexed,limit=24){
  const seenMessages=new Set((indexed||[]).map(x=>x.message_id).filter(Boolean));
  const seenMemories=new Set((indexed||[]).map(x=>x.memory_id).filter(Boolean));
  const originals=[];
  for(const m of memories||[]){
    if(!uuid.test(String(m.id||""))||seenMemories.has(m.id)||m.status!=="accepted")continue;
    const content=norm(m.content,1800);
    if(content.length>=3)originals.push({source:"memory",id:m.id,content});
  }
  for(const m of messages||[]){
    if(!uuid.test(String(m.id||""))||seenMessages.has(m.id)||!["user","assistant"].includes(m.role))continue;
    const content=norm(m.content,1800);
    if(content.length>=3)originals.push({source:"message",id:m.id,content});
  }
  return {pending:originals.slice(0,limit),unindexed_in_window:originals.length};
}
export function parseEmbeddings(payload,expected){
  const items=Array.isArray(payload?.data)?payload.data.slice().sort((a,b)=>a.index-b.index):[];
  if(items.length!==expected||items.some((x,i)=>x.index!==i||!validVector(x.embedding)))
    throw Error("embedding_provider_invalid_response");
  return items.map(x=>x.embedding);
}
async function embedTexts(texts,apiKey){
  if(!apiKey)return {error:"office_semantic_provider_not_configured"};
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),24000);
  try{
    const response=await fetch("https://api.openai.com/v1/embeddings",{
      method:"POST",signal:controller.signal,
      headers:{"Content-Type":"application/json",Authorization:"Bearer "+apiKey},
      body:JSON.stringify({model:ROMY_EMBEDDING_MODEL,input:texts})
    });
    if(!response.ok)return {error:"office_semantic_provider_unavailable"};
    return {vectors:parseEmbeddings(await response.json(),texts.length)};
  }catch{return {error:"office_semantic_provider_unavailable"}}
  finally{clearTimeout(timeout)}
}
async function rows(query){
  const {data,error}=await query;
  if(error)throw Error("semantic_sources_unavailable");
  return data||[];
}
export async function searchRomySemanticMemory({userDb,admin,userId,query,apiKey}){
  const term=norm(query,280);
  if(term.length<3)return {error:"semantic_query_required"};
  if(!uuid.test(userId))return {error:"not_authorized"};
  try{
    // All source reads use the employee JWT (RLS), never service role.
    const [messages,memories,indexed]=await Promise.all([
      rows(userDb.from("office_assistant_messages")
        .select("id,role,content,conversation_id,created_at")
        .order("created_at",{ascending:false}).limit(240)),
      rows(userDb.from("office_romy_memories")
        .select("id,content,status,source_conversation_id,created_at")
        .eq("status","accepted").order("created_at",{ascending:false}).limit(60)),
      rows(userDb.from("office_romy_embeddings")
        .select("message_id,memory_id").eq("user_id",userId).limit(1000))
    ]);
    const {pending,unindexed_in_window}=semanticCandidates(messages,memories,indexed,24);
    const embedded=await embedTexts([term,...pending.map(x=>x.content)],apiKey);
    if(embedded.error)return {error:embedded.error,scope:"only_employee_private_sources"};
    const [queryVector,...documentVectors]=embedded.vectors;
    // Only already-authorized, canonical source IDs are indexed by the privileged writer.
    const msg=[],mem=[];
    for(let i=0;i<pending.length;i++){
      const x=pending[i],row={user_id:userId,embedding:vectorString(documentVectors[i]),embedded_model:ROMY_EMBEDDING_MODEL};
      if(x.source==="message")msg.push({...row,message_id:x.id});
      else mem.push({...row,memory_id:x.id});
    }
    if(msg.length){
      const {error}=await admin.from("office_romy_embeddings").upsert(msg,{onConflict:"message_id"});
      if(error)throw Error("semantic_index_write_failed");
    }
    if(mem.length){
      const {error}=await admin.from("office_romy_embeddings").upsert(mem,{onConflict:"memory_id"});
      if(error)throw Error("semantic_index_write_failed");
    }
    const {data,error}=await userDb.rpc("office_romy_semantic_recall",{
      p_embedding:vectorString(queryVector),p_limit:12
    });
    if(error)throw Error("semantic_recall_failed");
    return {
      matches:(data||[]).map(x=>({
        source_type:x.source_type,source_id:x.source_id,conversation_id:x.conversation_id,
        content:norm(x.content,2200),occurred_at:x.occurred_at,
        score:Number.isFinite(Number(x.score))?Number(x.score):null,
        provenance:x.provenance
      })),
      scope:"only_employee_private_sources",
      meaning:"historic_conversations_are_not_accepted_memories",
      indexed_this_call:pending.length,
      unindexed_in_window:Math.max(0,unindexed_in_window-pending.length),
      searched_recent_messages:messages.length,
      searched_confirmed_memories:memories.length,
      window_limit_note:messages.length===240?"older_unindexed_history_may_exist":null,
      semantic_model:ROMY_EMBEDDING_MODEL
    };
  }catch(error){
    return {error:String(error?.message||"semantic_search_failed"),scope:"only_employee_private_sources"};
  }
}
