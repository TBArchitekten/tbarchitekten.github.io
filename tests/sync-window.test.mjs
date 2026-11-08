import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {selectWindowFiles,gitBlobHash,syncWindow,ENGINE_FUNCTIONS,APP_SHARED_FILES} from '../scripts/sync-window.mjs';

const sha='a'.repeat(40),source=Buffer.from('export const testFixture = true;\n');
const blob=gitBlobHash(source);
const tree=[
  {path:'supabase/functions/_shared/assistant-profile.mjs',type:'blob',mode:'100644',sha:blob,size:source.length},
  {path:'supabase/functions/isabella-chat/index.ts',type:'blob',mode:'100644',sha:blob,size:source.length},
  {path:'supabase/functions/window-mcp/index.ts',type:'blob',mode:'100644',sha:blob,size:source.length},
  {path:'supabase/functions/sofia-chat/index.ts',type:'blob',mode:'100644',sha:blob,size:source.length},
  {path:'supabase/functions/isabella-push/index.ts',type:'blob',mode:'100644',sha:blob,size:source.length},
  {path:'apps/isabella/ai.js',type:'blob',mode:'100644',sha:blob,size:source.length},
  {path:'apps/isabella/app.js',type:'blob',mode:'100644',sha:blob,size:source.length},
  {path:'apps/isabella/sync.js',type:'blob',mode:'100644',sha:blob,size:source.length},
  {path:'apps/isabella/assistant-i18n.js',type:'blob',mode:'100644',sha:blob,size:source.length},
  {path:'apps/isabella/../../../secret.js',type:'blob',mode:'100644',sha:blob,size:source.length},
  {path:'supabase/functions/_shared/broken.mjs',type:'blob',mode:'120000',sha:blob,size:source.length}
];
test('Explicit allowlists never sync Office shell, foreign domains or Window-only functions',()=>{
  assert.ok(ENGINE_FUNCTIONS.has('isabella-chat'));
  assert.ok(!ENGINE_FUNCTIONS.has('isabella-push'));
  assert.ok(!APP_SHARED_FILES.has('app.js'));
  assert.deepEqual(selectWindowFiles(tree,'engine').map(x=>x.target),[
    'supabase/functions/_shared/assistant-profile.mjs',
    'supabase/functions/isabella-chat/index.ts'
  ]);
  assert.deepEqual(selectWindowFiles(tree,'app').map(x=>x.target),['app/ai.js','app/assistant-i18n.js']);
  assert.equal(selectWindowFiles(tree,'all').length,4);
  assert.throws(()=>selectWindowFiles(tree,'invalid'),/unsupported_sync_mode/);
  assert.throws(()=>selectWindowFiles(null),/window_tree_required/);
});
test('Pinned public blobs copy byte-exactly, with SHA-verified manifest and no production API',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'romy-sync-fixture-'));
  const calls=[];
  const fetchImpl=async url=>{
    calls.push(url);
    const object=url.includes('/git/trees/')?{truncated:false,tree:tree.slice(0,2)}:
      {encoding:'base64',content:source.toString('base64')};
    return {ok:true,json:async()=>object};
  };
  try{
    const manifest=await syncWindow({sha,mode:'engine',root:dir,token:'',fetchImpl});
    assert.equal(manifest.source_repository,'gari01234/minds');
    assert.equal(manifest.source_sha,sha);
    assert.equal(manifest.files.length,2);
    assert.deepEqual(Buffer.from(await readFile(join(dir,'supabase/functions/isabella-chat/index.ts'))),source);
    const persisted=JSON.parse(await readFile(join(dir,'docs/sync-window-engine-manifest.json'),'utf8'));
    assert.equal(persisted.files[0].sha,blob);
    assert.ok(calls.every(url=>url.startsWith('https://api.github.com/repos/gari01234/minds/')));
  }finally{await rm(dir,{recursive:true,force:true})}
});
test('Wrong source SHA, truncated tree and corrupted blob fail without copying',async()=>{
  await assert.rejects(syncWindow({sha:'main',fetchImpl:async()=>({ok:true,json:async()=>({})})}),/source_commit_sha_required/);
  await assert.rejects(syncWindow({sha,fetchImpl:async()=>({ok:true,json:async()=>({truncated:true,tree})})}),/source_tree_incomplete/);
});
