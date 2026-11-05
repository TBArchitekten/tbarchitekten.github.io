import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {loadRomyAttachments} from '../supabase/functions/office-assistant/romy-attachments.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='a8ab0c32-0fab-410b-bfd1-a333cfa34491';
const path=owner+'/chat/2026-11-04/sample.pdf';

test('Romy uses the existing Window attachment UI, not a new picker',()=>{
  const app=read('app/app.js'),html=read('app/index.html');
  const assistant=read('app/office-assistant.js');
  const transport=read('app/romy-transport.js');
  const edge=read('supabase/functions/office-assistant/index.ts');
  assert.ok(app.includes("const CHAT_UPLOAD_MAX_BYTES=12*1024*1024"));
  assert.ok(app.includes("const CHAT_UPLOAD_MAX_TOTAL_BYTES=24*1024*1024"));
  assert.ok(app.includes("sb.storage.from(OFFICE?'office-romy-uploads':'isabella-uploads').upload"));
  assert.ok(app.includes("attachButton.onclick=()=>imageInput.click()"));
  assert.ok(app.includes("const attachments=files.length?await uploadChatFiles(files):[]"));
  assert.ok(!app.includes("if(OFFICE&&pendingChatFiles.length)"));
  assert.ok(app.includes("attachments:Array.isArray(m.attachments)?m.attachments:[]"));
  assert.ok(assistant.includes(".select('id,role,content,attachments,metadata,created_at')"));
  assert.ok(assistant.includes('replyTo,attachments,'));
  assert.ok(transport.includes('reply_to:replyTo||null,attachments'));
  assert.ok(edge.includes('loadRomyAttachments(db,uid,attachments)'));
  assert.ok(edge.includes('attachments:attached.metadata'));
  assert.ok(edge.includes('attachmentInputs:attached.inputs'));
  assert.ok(html.includes('app.js?v=office34'));
  assert.ok(html.includes('office-assistant.js?v=office33'));
  assert.ok(html.includes('romy-transport.js?v=office27'));
  new Function(assistant);new Function(transport);new Function(app);
});

test('Per-member Romy uploads have a private bucket with no anon policies',()=>{
  const sql=read('supabase/migrations/20261104235500_office_romy_uploads_v1.sql');
  assert.ok(sql.includes("values ('office-romy-uploads','office-romy-uploads',false,12582912)"));
  for(const policy of ['office_romy_uploads_read','office_romy_uploads_insert','office_romy_uploads_delete'])
    assert.ok(sql.includes('create policy '+policy));
  assert.ok(sql.includes('storage.foldername(objects.name)'));
  assert.ok(sql.includes('(select auth.uid())::text'));
  assert.ok(sql.includes("and (storage.foldername(objects.name))[2]='chat'"));
  assert.ok(!sql.includes('to anon'));
  assert.ok(sql.includes('add column attachments jsonb not null'));
  assert.ok(sql.includes("jsonb_array_length(attachments)>0"));
});

test('Attachment input and output are Window-format, with owner isolation',async()=>{
  let downloads=0;
  const db={storage:{from(bucket){
    assert.equal(bucket,'office-romy-uploads');
    return {async download(p){
      downloads++;assert.equal(p,path);
      return {data:new Blob(['hello'],{type:'application/pdf'}),error:null};
    }};
  }}};
  const result=await loadRomyAttachments(db,owner,[{path,mime:'application/pdf',name:'a.pdf',size:5}]);
  assert.equal(downloads,1);
  assert.equal(result.metadata[0].path,path);
  assert.equal(result.inputs[0].type,'input_file');
  assert.ok(result.inputs[0].file_data.startsWith('data:application/pdf;base64,'));
  await assert.rejects(()=>loadRomyAttachments(db,owner,[{path:'another-person/chat/2026-11-04/a.pdf',mime:'application/pdf'}]),/invalid_attachment/);
  await assert.rejects(()=>loadRomyAttachments(db,owner,Array.from({length:4},()=>({path,mime:'application/pdf'}))),/too_many_attachments/);
  assert.equal(downloads,1);
});
