import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {chatTurnModel,documentModel} from '../supabase/functions/office-assistant/chat-model-routing.mjs';
import {interactiveTurnContract} from '../supabase/functions/office-assistant/turn-capability-contract.mjs';
import {ROMY_TOOLS} from '../supabase/functions/office-assistant/romy-tools.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Romy reuses Window model routing and removes unsanctioned manual modes',()=>{
 assert.equal(chatTurnModel({complexity:'light',env:{}}).tier,'fast');
 assert.equal(chatTurnModel({complexity:'deep',env:{}}).tier,'deep');
 assert.equal(documentModel({}),'gpt-5.6-terra');
 const router=read('supabase/functions/office-assistant/romy-router.mjs');
 assert.ok(router.includes('routeRomyTurn'));
 assert.ok(router.includes('decision_model'));
 assert.ok(router.includes('neutral_fallback'));
 assert.ok(read('supabase/functions/office-assistant/index.ts').includes('routeRomyTurn({message,history,apiKey'));

 assert.equal(interactiveTurnContract({surface:'chat_browser'}).tools,'governed');
 const f=read('app/office-assistant.js');
 for(const removed of ['Antwortmodus',"mode='standard'",'maximal 4000'])assert.ok(!f.includes(removed));
 assert.ok(f.includes('TBA_ROMY_TRANSPORT.send'));
});
test('Romy reuses Window SSE parser correctly across chunks',()=>{
 const src=read('app/romy-transport.js'),sandbox={window:{}};
 runInNewContext(src,sandbox);
 const events=[],parse=sandbox.window.TBA_ROMY_TRANSPORT.parseFastSse;
 let leftover=parse('event: text_delta\ndata: {"type":"text_',e=>events.push(e));
 assert.equal(events.length,0);
 leftover=parse(leftover+'delta","delta":"Hallo"}\n\nevent: result\ndata: {"type":"result","reply":"Hallo"}\n\n',e=>events.push(e));
 assert.equal(leftover,'');
 assert.equal(JSON.stringify(events),JSON.stringify([{type:'text_delta',delta:'Hallo'},{type:'result',reply:'Hallo'}]));
});
test('Romy requires explicit owner review before actions, enforced by user RLS',()=>{
 const code=read('supabase/functions/office-assistant/romy-tools.mjs');
 const sql=read('supabase/migrations/20261104234500_office_romy_proposals_review_v1.sql');
 assert.equal(ROMY_TOOLS.filter(x=>x.name.startsWith('propose_')).length,5);
 for(const k of ['reviewRomyProposal','userDb.from(table).insert(values)','const status=decision==="reject"?"rejected":"applying"','eq("status","pending")']){
   assert.ok(code.includes(k),'missing '+k);
 }
 assert.ok(sql.includes('office_romy_proposals_owner_read'));
 assert.ok(sql.includes('user_id=(select auth.uid())'));
 assert.ok(sql.includes('grant select on public.office_romy_proposals to authenticated'));
 assert.ok(!sql.includes('grant insert on public.office_romy_proposals to authenticated'));
});
test('Romy keeps original Window composer and private histories, no extra chat UI',()=>{
 const app=read('app/app.js'),html=read('app/index.html'),front=read('app/office-assistant.js');
 assert.ok(html.includes('romy-transport.js?v=office27'));
 assert.ok(html.indexOf('romy-transport.js')<html.indexOf('office-assistant.js'));
 assert.ok(app.includes('setOfficeMessages:'));
 assert.ok(front.includes('showPendingProposals'));
 assert.ok(front.includes('Meine Gespräche'));
 assert.ok(!front.includes('office-chat-layout'));
 new Function(front);
});

test('Romy validates full canonical UUIDs for conversation and request identity',()=>{
 const code=read('supabase/functions/office-assistant/index.ts');
 const literal=code.split('const UUID=')[1]?.split(';')[0];
 assert.ok(literal,'UUID regex exists');
 const pattern=Function('return '+literal)();
 assert.equal(pattern.test('123e4567-e89b-42d3-a456-426614174000'),true);
 assert.equal(pattern.test('123e4567-e89b-42d3-426614174000'),false);
 assert.equal(pattern.test('not-a-uuid'),false);
});
