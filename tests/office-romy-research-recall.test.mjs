import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROMY_TOOLS} from '../supabase/functions/office-assistant/romy-tools.mjs';
import {ROMY_SYSTEM_SKILLS} from '../supabase/functions/office-assistant/romy-skills.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Romy reuses native Window web_search with its owner-scoped sources',()=>{
 const code=read('supabase/functions/office-assistant/index.ts');
 assert.ok(code.includes('{type:"web_search",search_context_size:"low"}'));
 assert.ok(code.includes('extractWebSources(payload)'));
 assert.ok(code.includes('metadata:{artifacts,skill_trace:skillTrace,sources}'));
 assert.ok(code.includes('sources:result.sources'));
 assert.ok(code.includes('allowed=new Set(["web_search",...ROMY_TOOLS'));
 assert.ok(code.includes('Keine vertraulichen Projektdaten'));
 const ui=read('app/app.js');
 assert.ok(ui.includes('sources:Array.isArray(m.metadata?.sources)?m.metadata.sources:[]'));
 assert.ok(ui.includes('message-sources'));
});

test('Private conversation history is searchable but never accepted memory',()=>{
 const names=ROMY_TOOLS.map(x=>x.name);
 assert.ok(names.includes('search_conversation_history'));
 const code=read('supabase/functions/office-assistant/romy-tools.mjs');
 assert.ok(code.includes('userDb.from("office_assistant_messages")'));
 assert.ok(code.includes('.ilike("content",pattern)'));
 assert.ok(code.includes('historic_conversation_not_accepted_memory'));
 assert.ok(code.includes('only_current_employee_via_message_RLS'));
 assert.ok(!code.includes('admin.from("office_assistant_messages")'));
 assert.ok(!code.includes('autoAcceptMemory'));
});

test('Generated artifacts are discoverable by owner for binary edit workflows',()=>{
 const names=ROMY_TOOLS.map(x=>x.name);
 assert.ok(names.includes('search_generated_artifacts'));
 assert.ok(names.includes('execute_artifact_task'));
 const code=read('supabase/functions/office-assistant/romy-tools.mjs');
 assert.ok(code.includes('userDb.from("office_romy_artifacts")'));
 assert.ok(code.includes('source_for_execute_artifact_task:"artifact"'));
 assert.ok(code.includes('verified_project_fact:false'));
 assert.ok(code.includes('only_current_employee_owned_artifacts'));
 assert.ok(code.includes('scope==="all"'));
 assert.ok(code.includes('all_office_projects'));
 const service=read('supabase/functions/office-assistant/romy-capability-inputs.ts');
 assert.ok(service.includes('eq("user_id",userId)'));
});

test('Window investigar Skill available and versioned; research never grants permission',()=>{
 const skill=ROMY_SYSTEM_SKILLS.find(x=>x.slug==='investigar');
 assert.equal(skill.version,1);
 assert.ok(skill.instructions.includes('Verifica afirmaciones actuales con fuentes fiables.'));
 assert.ok(skill.preferred_tools.includes('web_search'));
 assert.ok(skill.instructions.includes('fuentes externas no son memoria')||skill.instructions.includes('fuentes externas no son memoria'.replace('f','F'))||skill.instructions.includes('Las fuentes externas no son memoria'));
 const registry=read('supabase/functions/office-assistant/skill-registry.ts');
 assert.ok(registry.includes('authority:"inherits_runtime_policy"'));
 assert.ok(registry.includes('grants:[]'));
 const html=read('app/index.html');
 assert.ok(html.includes('app.js?v=office51'));
});
