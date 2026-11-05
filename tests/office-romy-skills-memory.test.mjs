import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROMY_SYSTEM_SKILLS,listRomySystemSkills,findRomySystemSkill} from '../supabase/functions/office-assistant/romy-skills.mjs';
import {ROMY_TOOLS} from '../supabase/functions/office-assistant/romy-tools.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Romy reuses Window Skills with versioned inspectable procedures',()=>{
 const slugs=['investigar','organizar-dia','preparar-reunion','comunicacion-de-es','seguimiento','recordar-contexto'];
 assert.deepEqual(listRomySystemSkills().map(x=>x.slug),slugs);
 assert.equal(ROMY_SYSTEM_SKILLS.length,6);
 assert.equal(findRomySystemSkill('preparar-reunion')?.version,2);
 for(const skill of ROMY_SYSTEM_SKILLS){
   assert.ok(skill.instructions.length>100,skill.slug);
   assert.ok(skill.description,skill.slug);
   assert.ok(skill.preferred_tools.length>0,skill.slug);
 }
 assert.match(findRomySystemSkill('preparar-reunion').instructions,/Office adapter/);
 assert.match(findRomySystemSkill('recordar-contexto').instructions,/owner-reviewed/);
 assert.equal(findRomySystemSkill('unknown'),null);
});

test('Romy imports the exact Window registry: Skills teach, tools govern',()=>{
 const code=read('supabase/functions/office-assistant/skill-registry.ts');
 const server=read('supabase/functions/office-assistant/index.ts');
 for(const key of [
   'MAX_COMPOSED_SKILLS=4','normalizeSkillRecord','composeSkillTrace',
   'skillLoadEnvelope','authority:"inherits_runtime_policy"','grants:[]',
   'unavailable_tools'
 ])assert.ok(code.includes(key),'Missing Window Skill invariant '+key);
 assert.ok(server.includes('from "./skill-registry.ts"'));
 assert.ok(server.includes('skillLoadEnvelope(manifest,skillTrace)'));
 assert.ok(server.includes('composeSkillTrace(skillTrace,manifest)'));
 assert.ok(server.includes('id.startsWith("propose_")?"confirm":"allow"'));
 assert.ok(server.includes('skill_trace:result.skill_trace'));
 assert.ok(ROMY_TOOLS.some(x=>x.name==='list_skills'));
 assert.ok(ROMY_TOOLS.some(x=>x.name==='load_skill'));
});

test('Memory can only become accepted after its owner reviews a proposal',()=>{
 const sql=read('supabase/migrations/20261105013000_office_romy_skills_memory_v1.sql');
 const tool=read('supabase/functions/office-assistant/romy-tools.mjs');
 for(const s of [
   'alter table public.office_romy_memories enable row level security',
   'revoke all on public.office_romy_memories from public,anon,authenticated',
   'grant select on public.office_romy_memories to authenticated',
   'grant update(status,retracted_at)',
   "status='retracted'",
   'owner_reviewed_proposal',
   'source_conversation_id',
   'source_request_id',
   'user_id=(select auth.uid())',
   "check(kind in ('create_task','create_event','remember'))",
   "add column skill_trace jsonb"
 ])assert.ok(sql.includes(s),'Memory/migration invariant missing '+s);
 assert.ok(!sql.includes('grant insert on public.office_romy_memories to authenticated'));
 assert.ok(!sql.includes('grant delete on public.office_romy_memories to authenticated'));
 for(const key of [
   'name:"propose_remember"','name:"search_personal_memory"',
   'kind:"remember"','source_request_id:proposal.request_id',
   '.insert({user_id:userId,kind:p.memory_kind','memory_receipt_unavailable'
 ])assert.ok(tool.includes(key),'Missing reviewed memory flow '+key);
 assert.ok(!tool.includes('autoAcceptMemory'));
});

test('Romy uses the existing Window modal for review, trace and owner retraction',()=>{
 const ui=read('app/office-assistant.js'),html=read('app/index.html');
 for(const needle of [
   'Meine Erinnerungen','Erinnerungsvorschlag','Erinnerung bestätigt',
   "office_romy_memories","status:'retracted'","openMemories()",
   "window.confirm(p.kind==='remember'"
 ])assert.ok(ui.includes(needle),'Memory UI missing '+needle);
 assert.ok(html.includes('office-assistant.js?v=office33'));
 assert.ok(html.includes('app.js?v=office35'));
 assert.ok(!ui.includes('office-chat-layout'));
 new Function(ui);
});
