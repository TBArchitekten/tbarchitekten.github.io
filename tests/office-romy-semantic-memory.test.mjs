import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {semanticCandidates,parseEmbeddings,searchRomySemanticMemory,ROMY_EMBEDDING_MODEL}
  from '../supabase/functions/office-assistant/romy-semantic-memory.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const user='11111111-1111-4111-8111-111111111111';
const m1='22222222-2222-4222-8222-222222222222';
const m2='33333333-3333-4333-8333-333333333333';
const accepted='44444444-4444-4444-8444-444444444444';
const vector=Array.from({length:1536},(_,i)=>i/1536);
test('Recall candidates preserve accepted versus historical conversation provenance',()=>{
 const indexed=[{message_id:m1,memory_id:null}];
 const {pending,unindexed_in_window}=semanticCandidates([
   {id:m1,role:'user',content:'already embedded'},
   {id:m2,role:'assistant',content:'Earlier schedule decisions'},
   {id:'malformed',role:'user',content:'wrong ID'},
   {id:m1,role:'tool',content:'tool execution not autobiographical'}
 ],[
   {id:accepted,status:'accepted',content:'User explicitly approved a preference'},
   {id:m1,status:'retracted',content:'Do not index retracted memory'}
 ],indexed,10);
 assert.equal(unindexed_in_window,2);
 assert.deepEqual(pending.map(x=>x.source),['memory','message']);
 assert.deepEqual(pending.map(x=>x.id),[accepted,m2]);
});
test('Embedding result requires exact dimensions and finite vectors',()=>{
 const good=[{index:0,embedding:vector},{index:1,embedding:vector}];
 assert.equal(parseEmbeddings({data:good},2).length,2);
 assert.throws(()=>parseEmbeddings({data:good},1));
 assert.throws(()=>parseEmbeddings({data:[{index:0,embedding:[0,1]}]},1));
 assert.throws(()=>parseEmbeddings({data:[{index:0,embedding:vector.map((n,i)=>i===8?NaN:n)}]},1));
 assert.equal(ROMY_EMBEDDING_MODEL,'text-embedding-3-small');
});
test('Semantic tool uses employee RLS for sources and recall, server for embedding writes',async()=>{
 const calls=[],upserts=[];
 const rowsByTable={
   office_assistant_messages:[{id:m2,role:'user',content:'Kita Abgabe Bernried',conversation_id:m1,created_at:'2026-11-05T08:00:00Z'}],
   office_romy_memories:[{id:accepted,status:'accepted',content:'Freigaben separat prüfen',source_conversation_id:m1,created_at:'2026-11-05T08:00:00Z'}],
   office_romy_embeddings:[]
 };
 const userDb={
   from(table){calls.push({type:'table',table});return {
     select(){return this},eq(){return this},order(){return this},
     limit(){return Promise.resolve({data:rowsByTable[table]??[],error:null})}
   }},
   rpc(name,args){calls.push({type:'rpc',name,args});return Promise.resolve({
     data:[{source_type:'conversation',source_id:m2,conversation_id:m1,
       content:'Kita Abgabe Bernried',occurred_at:'2026-11-05T08:00:00Z',
       score:.9,provenance:'historic_conversation_not_accepted_memory'}],error:null})}
 };
 const admin={from(table){assert.equal(table,'office_romy_embeddings');return {
   upsert(rows,opts){upserts.push({rows,opts});return Promise.resolve({error:null})}
 }}};
 const previous=globalThis.fetch;
 globalThis.fetch=async(_url,opts)=>{
   const data=JSON.parse(opts.body);
   assert.equal(data.model,ROMY_EMBEDDING_MODEL);
   return {ok:true,json:async()=>({
     data:data.input.map((_,i)=>({index:i,embedding:vector}))})};
 };
 try{
   const result=await searchRomySemanticMemory({userDb,admin,userId:user,query:'Welche Frist für Bernried?',apiKey:'mock-key'});
   assert.equal(result.matches.length,1);
   assert.equal(result.matches[0].source_id,m2);
   assert.equal(result.matches[0].provenance,'historic_conversation_not_accepted_memory');
   assert.equal(result.indexed_this_call,2);
   assert.equal(upserts.length,2);
   assert.equal(calls.filter(x=>x.type==='rpc').length,1);
   assert.deepEqual(calls.filter(x=>x.type==='table').map(x=>x.table),
     ['office_assistant_messages','office_romy_memories','office_romy_embeddings']);
 }finally{globalThis.fetch=previous}
});
test('Schema prevents cross-employee writes, removes retracted sources and preserves RLS',()=>{
 const sql=read('supabase/migrations/20261105121124_office_romy_semantic_recall_v1.sql');
 const tool=read('supabase/functions/office-assistant/romy-tools.mjs');
 const edge=read('supabase/functions/office-assistant/index.ts');
 assert.match(sql,/embedding extensions\.vector\(1536\)/);
 assert.match(sql,/references public\.office_assistant_messages\(id\) on delete cascade/);
 assert.match(sql,/references public\.office_romy_memories\(id\) on delete cascade/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/grant select on public\.office_romy_embeddings to authenticated/);
 assert.doesNotMatch(sql,/grant (insert|update|delete) on public\.office_romy_embeddings to authenticated/);
 assert.match(sql,/e\.user_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/r\.status='accepted'/);
 assert.match(sql,/office_romy_retraction_vector_cleanup/);
 assert.match(tool,/name:"search_semantic_history"/);
 assert.match(edge,/executeRomyTool\(call\.name,args/);
 assert.match(edge,/conversationId,requestId,apiKey/);
});
