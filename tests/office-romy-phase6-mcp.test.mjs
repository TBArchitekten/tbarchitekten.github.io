import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOfficeAkteTools} from '../supabase/functions/office-mcp/office-akte.mjs';

const ALPHA='11111111-1111-4111-8111-111111111111';
const BETA='22222222-2222-4222-8222-222222222222';
const ADMIN='33333333-3333-4333-8333-333333333333';
const P='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const Q='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const base={resolveProject:async ref=>({id:ref==='P'?P:Q,name:ref==='P'?'Projekt P':'Projekt Q',number:ref,archived:false})};
function fakeSb(){
  const log=[];
  const tables={
    office_project_members:[{project_id:P,user_id:ALPHA},{project_id:Q,user_id:BETA}],
    minds_work_memory:[{id:'memo-p',project_id:P,title:'Thema A',body:'Ungeprüfte Notiz',status:'proposed',memory_type:'decision',provenance:[{kind:'fixture'}],updated_at:'2026-01-01'},
      {id:'memo-q',project_id:Q,title:'Thema Q',body:'Strikt privat',status:'confirmed',memory_type:'fact',provenance:[],updated_at:'2026-01-01'}],
    minds_work_claims:[{id:'claim-p',project_id:P,topic:'Thema A',statement:'Frage aus Testquelle',status:'proposed',provenance_class:'project_source',claim_type:'other',updated_at:'2026-01-01'},
      {id:'claim-q',project_id:Q,topic:'Thema Q',statement:'Fremder Testinhalt',status:'confirmed',provenance_class:'project_source',claim_type:'fact',updated_at:'2026-01-01'}],
    minds_project_model_revisions:[{id:'revision-p',project_id:P,status:'draft',reason:'Test',trigger_kind:'manual'}],
    minds_work_source_segments:[{id:'seg-p',project_id:P,file_id:'file-p',source_version:'0'.repeat(64),segment_no:1,locator:{page_start:3,page_end:3},content:'Fiktiver Inhalt Seite 3'}],
    minds_agent_runs:[{id:'run-a',user_id:ALPHA,feature:'chat',status:'completed',latency_ms:18,started_at:'2026-01-01'},
      {id:'run-b',user_id:BETA,feature:'chat',status:'failed',latency_ms:22,started_at:'2026-01-02'}]
  };
  function from(table){
    const ops=[],q={
      select:()=>q,
      eq:(field,value)=>(ops.push(['eq',field,value]),q),
      ilike:(field,pattern)=>(ops.push(['ilike',field,pattern]),q),
      order:() => q,
      maybeSingle:async()=>({data:selectRows()[0]||null,error:null}),
      limit:async size=>({data:selectRows().slice(0,size),error:null})
    };
    function selectRows(){
      return (tables[table]||[]).filter(row=>ops.every(([kind,key,val])=>
        kind==='eq'?row[key]===val:String(row[key]||'').toLocaleLowerCase('de-DE').includes(String(val||'').replaceAll('%','').toLocaleLowerCase('de-DE'))));
    }
    log.push({table,ops});
    return q;
  }
  return {sb:{from},log};
}
test('Phase 6: Office Akte requires explicit team membership even for non-team admin',async()=>{
  const {sb,log}=fakeSb();
  const alpha=createOfficeAkteTools({sb,userId:ALPHA,base});
  const p=await alpha.openProject({project:'P'});
  assert.equal(p.project.name,'Projekt P');
  assert.equal(p.entries[0].status,'proposed');
  assert.equal(p.claims[0].status,'proposed');
  assert.equal(p.claims.some(x=>x.id==='claim-q'),false);
  await assert.rejects(()=>alpha.openProject({project:'Q'}),/nicht verfügbar/);
  await assert.rejects(()=>createOfficeAkteTools({sb,userId:ADMIN,base}).openProject({project:'P'}),/nicht verfügbar/);
  assert.ok(log.some(x=>x.table==='office_project_members'&&x.ops.some(op=>op[1]==='user_id'&&op[2]===ALPHA)));
  assert.ok(log.some(x=>x.table==='minds_work_claims'&&x.ops.some(op=>op[1]==='project_id'&&op[2]===P)));
});
test('Phase 6: topics and page-cited sources never cross project membership',async()=>{
  const {sb}=fakeSb();
  const tools=createOfficeAkteTools({sb,userId:ALPHA,base});
  const topic=await tools.openTopic({project:'P',topic:'Thema A'});
  assert.equal(topic.claims[0].status,'proposed');
  assert.equal(topic.entries[0].status,'proposed');
  const results=await tools.searchAkte({project:'P',query:'Fiktiver'});
  assert.equal(results.sources[0].locator.page_start,3);
  assert.equal(results.sources[0].source_version,'0'.repeat(64));
  await assert.rejects(()=>tools.searchAkte({project:'Q',query:'Fremder'}),/nicht verfügbar/);
  await assert.rejects(()=>tools.openTopic({project:'Q',topic:'Thema Q'}),/nicht verfügbar/);
});
test('Phase 6: turn diagnostics read only authenticated owner metadata, no messages',async()=>{
  const {sb,log}=fakeSb();
  const own=await createOfficeAkteTools({sb,userId:ALPHA,base}).turnDiagnostics({limit:10});
  assert.equal(own.scope,'angemeldetes Konto');
  assert.equal(own.includes_message_content,false);
  assert.deepEqual(own.runs.map(r=>r.id),['run-a']);
  assert.ok(!JSON.stringify(own).includes('Fremder Testinhalt'));
  const other=await createOfficeAkteTools({sb,userId:BETA,base}).turnDiagnostics();
  assert.deepEqual(other.runs.map(r=>r.id),['run-b']);
  assert.ok(log.filter(x=>x.table==='minds_agent_runs').every(x=>x.ops.some(op=>op[1]==='user_id')));
});
test('Phase 6: OAuth identity and mandatory active membership precede MCP tools',()=>{
  const src=readFileSync(new URL('../supabase/functions/office-mcp/index.ts',import.meta.url),'utf8');
  for(const t of ['open_project','open_topic','search_akte','turn_diagnostics'])
    assert.ok(src.includes('server.registerTool("'+t+'"'));
  assert.ok(src.indexOf('sb.auth.getUser(token)')<src.indexOf('createOfficeAkteTools({sb,userId:data.user.id'));
  assert.ok(src.indexOf('must_change_password')<src.indexOf('createOfficeAkteTools({sb,userId:data.user.id'));
  const scope=readFileSync(new URL('../supabase/functions/office-mcp/office-akte.mjs',import.meta.url),'utf8');
  assert.match(scope,/office_project_members/);
  assert.doesNotMatch(src,/Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
});
