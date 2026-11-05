import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Romy ports the actual Word/PDF document builders from Window, not a second UI',()=>{
 const builder=read('supabase/functions/office-assistant/romy-documents.ts');
 for(const name of ['makeDocx','makePdf','docxParagraphs','wrapLine']){
   assert.ok(builder.includes('function '+name+'('),'Window source missing: '+name);
 }
 for(const library of ['npm:docx@9.5.1','npm:pdf-lib@1.17.1']){
   assert.ok(builder.includes(library));
 }
 assert.match(builder,/export async function createRomyDocument/);
 assert.ok(builder.includes('provenance:"generated_deliverable_not_project_truth"'));
 assert.ok(builder.includes('office-romy-artifacts'));
 assert.ok(builder.includes('userId+"/chat/"+conversationId+"/"+requestId'));
 assert.ok(builder.includes('crypto.subtle.digest("SHA-256"'));
 assert.ok(builder.includes('already_exists:true'));
});

test('Office artifacts are private in both PostgreSQL and Storage',()=>{
 const sql=read('supabase/migrations/20261105011000_office_romy_document_artifacts_v1.sql');
 for(const needle of [
   'alter table public.office_romy_artifacts enable row level security',
   'revoke all on public.office_romy_artifacts from public,anon,authenticated',
   'grant select on public.office_romy_artifacts to authenticated',
   'user_id=(select auth.uid())',
   '(select private.office_is_member())',
   "values ('office-romy-artifacts','office-romy-artifacts',false",
   "bucket_id='office-romy-artifacts'",
   '(storage.foldername(objects.name))[1]=(select auth.uid())::text',
   'foreign key(conversation_id,user_id)',
   "metadata jsonb not null default '{}'::jsonb"
 ])assert.ok(sql.includes(needle),'missing private artifact invariant: '+needle);
 assert.ok(!sql.includes('grant insert on public.office_romy_artifacts to authenticated'));
 assert.ok(!sql.includes('grant update on public.office_romy_artifacts to authenticated'));
 assert.ok(!sql.includes('for insert to authenticated'));
});

test('Romy can generate real documents through the governed tool path',()=>{
 const edge=read('supabase/functions/office-assistant/index.ts');
 const tool=read('supabase/functions/office-assistant/romy-tools.mjs');
 for(const needle of [
   'name:"create_document"','kind:{type:"string",enum:["docx","pdf","txt"]}',
   'required:["kind","title","content"]'
 ])assert.ok(tool.includes(needle),'document tool missing '+needle);
 for(const needle of [
   'import { createRomyDocument } from "./romy-documents.ts"',
   'call.name==="create_document"',
   'await createRomyDocument({admin,userId:uid,conversationId,requestId',
   'metadata:{artifacts,skill_trace:skillTrace}',
   'persistReply(admin,uid,conversation.id,requestId,result.reply,result.artifacts,result.skill_trace)'
 ])assert.ok(edge.includes(needle),'Romy server missing '+needle);
 assert.ok(edge.includes('reviewRomyProposal'));
 assert.ok(edge.includes('getUser(token)'));
});

test('Generated files reuse existing Window artifact cards and survive chat reload',()=>{
 const app=read('app/app.js');
 const ui=read('app/office-assistant.js');
 const html=read('app/index.html');
 assert.ok(app.includes("OFFICE?'office-romy-artifacts':'minds-artifacts'"));
 assert.ok(app.includes('artifacts:Array.isArray(m.metadata?.artifacts)?m.metadata.artifacts:[]'));
 assert.ok(ui.includes(".select('id,role,content,attachments,metadata,created_at')"));
 assert.ok(app.includes('data-artifact-file'));
 assert.ok(app.includes('hydrateArtifactFiles('));
 assert.ok(html.includes('app.js?v=office31'));
 assert.ok(html.includes('office-assistant.js?v=office32'));
 new Function(app);new Function(ui);
});
