import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {gitBlobHash,ENGINE_FUNCTIONS} from '../scripts/sync-window.mjs';
import {resolveAssistantProfile,profileFirstName,profileInstructions,profileTools} from '../supabase/functions/_shared/assistant-profile.mjs';
import {promptComponentSizes} from '../supabase/functions/_shared/light-conversation-context.mjs';
import {officeMilestonesFromPlans} from '../supabase/functions/_shared/office-terminplan.mjs';

const path=p=>new URL('../'+p,import.meta.url);
const read=p=>readFileSync(path(p),'utf8');
test('Pinned Window engine is byte-identical to the 95 Git blobs in its committed manifest',()=>{
  const manifest=JSON.parse(read('docs/sync-window-engine-manifest.json'));
  assert.equal(manifest.source_repository,'gari01234/minds');
  assert.match(manifest.source_sha,/^[0-9a-f]{40}$/);
  assert.equal(manifest.files.length,96);
  for(const row of manifest.files){
    assert.ok(row.target.startsWith('supabase/functions/'));
    assert.equal(gitBlobHash(readFileSync(path(row.target))),row.sha,row.target+' diverged from its reviewed origin');
  }
});
test('Office profile uses individual first name, strips Window-only tools, retains identical Window branch',()=>{
  const raw='Eres Isabella y trabajas con Gari en Window.';
  const windowProfile=resolveAssistantProfile('window'),office=resolveAssistantProfile('office');
  assert.equal(windowProfile.id,'window');assert.equal(office.assistant_name,'Romy');
  assert.equal(profileFirstName('Alex Beispiel'),'Alex');
  assert.equal(profileInstructions(raw,'window'),raw);
  const profiled=profileInstructions(raw,'office','Alex Beispiel');
  assert.match(profiled,/Romy/);assert.match(profiled,/Alex/);
  assert.match(profiled,/alemán/);assert.doesNotMatch(profiled,/Gari|Isabella/);
  const tools=[
    {type:'function',name:'search_calendar',description:'Consulta las tareas de Gari'},
    {type:'function',name:'consult_sofia',description:'Thoughts de Isabella'}
  ];
  const filtered=profileTools(tools,'office','Alex');
  assert.deepEqual(filtered.map(x=>x.name),['search_calendar']);
  assert.match(filtered[0].description,/Alex/);
  const before=promptComponentSizes({instructions:raw,tools});
  const after=promptComponentSizes({instructions:profiled,tools:filtered});
  assert.equal(after.tools_count,1);
  console.log('romy_phase2_prompt_component_sizes',JSON.stringify({window:before,office:after}));
});
test('Office Terminplan is read-only and project-bounded, while D1 leaves reviewed receipt and Undo gates',()=>{
  const p='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',q='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const rows=[
    {id:'p-plan',project_id:p,state:{tasks:[{type:'milestone',name:'Fiktive Frist P',start:'2026-11-15'}]}},
    {id:'q-plan',project_id:q,state:{tasks:[{type:'milestone',name:'Fiktive Frist Q',start:'2026-11-16'}]}}
  ];
  const allowed=officeMilestonesFromPlans(rows,[{id:p,name:'Project P'}],{from:'2026-11-01',to:'2026-11-30'});
  assert.deepEqual(allowed.map(x=>x.title),['Fiktive Frist P']);
  const sql=read('supabase/migrations/20261108213000_office_window_direct_create_default_v1.sql');
  assert.match(sql,/create_mode set default 'direct'/);
  assert.match(sql,/on conflict\s*\(user_id\)\s*do nothing/i);
  const authority=read('supabase/migrations/20261108211500_office_window_engine_rpc_authority_v1.sql');
  assert.match(authority,/minds_commit_direct_calendar_create_v01/);
  assert.match(authority,/minds_undo_direct_calendar_create_v01/);
  assert.match(authority,/direct_creation_not_authorized/);
  assert.ok(ENGINE_FUNCTIONS.has('isabella-chat'));
  for(const x of ['window-mcp','sofia-chat','isabella-push','isabella-ideas','isabella-feed','isabella-code-preparation']){
    assert.ok(!existsSync(path('supabase/functions/'+x+'/index.ts')),x+' must remain excluded from Office deployable tree');
  }
});

test('Phases 3–4: shared Window browser modules match the pinned source Git blobs',()=>{
  const manifest=JSON.parse(read('docs/sync-window-app-manifest.json'));
  assert.equal(manifest.source_repository,'gari01234/minds');
  assert.match(manifest.source_sha,/^[0-9a-f]{40}$/);
  assert.equal(manifest.mode,'app');
  assert.deepEqual(manifest.files.map(x=>x.target).sort(),[
    'app/ai.js','app/assistant-i18n.js','app/chat-stream-recovery.js',
    'app/final-round.js','app/office-personal.js','app/turn-integrity.js','app/voice-output.js'
  ]);
  for(const entry of manifest.files){
    assert.equal(gitBlobHash(readFileSync(path(entry.target))),entry.sha,entry.target+' is not the same code as Window');
    assert.equal(readFileSync(path(entry.target)).length,entry.bytes,entry.target+' byte count drift');
  }
});
