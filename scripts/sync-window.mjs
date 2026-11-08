// Deterministic, reviewable synchronization from the public Window source.
// No credentials, deployments, Supabase connections or hidden write-through.
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const SOURCE_REPO='gari01234/minds';
export const ENGINE_FUNCTIONS=new Set([
  'isabella-agent-shadow','isabella-artifact','isabella-artifact-intake',
  'isabella-capability-runner','isabella-capability-runtime','isabella-chat',
  'isabella-chat-runner','isabella-delivery-runner','isabella-dream',
  'isabella-heartbeat','isabella-live-session','isabella-mission-runner',
  'isabella-operating-model','isabella-presence','isabella-routine-runner',
  'isabella-runtime-mcp','isabella-self-review','isabella-transcribe',
  'isabella-work-ingest-runner','window-akte-pflege'
]);
export const APP_SHARED_FILES=new Set([
  'ai.js','turn-integrity.js','chat-stream-recovery.js','final-round.js',
  'voice-output.js','assistant-i18n.js','office-personal.js',
  'live/canonical.js','live/transcript.js','live/live.js','live/live.css'
]);
const EXT=/\.(?:ts|mjs|js|json)$/i;
export function selectWindowFiles(tree,mode='engine'){
  if(!['engine','app','all'].includes(mode))throw Error('unsupported_sync_mode');
  if(!Array.isArray(tree))throw Error('window_tree_required');
  const out=[],targets=new Set;
  for(const item of tree){
    if(item?.type!=='blob'||item.mode!=='100644')continue;
    const path=String(item.path||''),sha=String(item.sha||'');
    if(!/^[0-9a-f]{40}$/i.test(sha)||!/^[a-zA-Z0-9_./-]+$/.test(path)||path.split('/').includes('..'))continue;
    let target=null;
    if(mode!=='app'&&EXT.test(path)&&path.startsWith('supabase/functions/')){
      const parts=path.split('/'),feature=parts[2];
      if(feature==='_shared'||ENGINE_FUNCTIONS.has(feature))target=path;
    }
    if(mode!=='engine'&&path.startsWith('apps/isabella/')){
      const p=path.slice('apps/isabella/'.length);
      if(APP_SHARED_FILES.has(p))target='app/'+p;
    }
    if(!target)continue;
    if(targets.has(target))throw Error('duplicate_sync_target');
    targets.add(target);
    out.push({source:path,target,sha,bytes:Number(item.size||0)});
  }
  return out.sort((a,b)=>a.target.localeCompare(b.target));
}
export function gitBlobHash(buffer){
  const bytes=Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer);
  return createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
}
async function readApi(path,token,fetchImpl){
  const url='https://api.github.com/repos/'+SOURCE_REPO+'/'+path;
  const response=await fetchImpl(url,{headers:{
    Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
    ...(token?{Authorization:'Bearer '+token}:{})
  }});
  if(!response.ok)throw Error('window_source_unavailable_'+response.status);
  return response.json();
}
export async function syncWindow({sha,mode='engine',root=process.cwd(),token=process.env.GITHUB_TOKEN||'',fetchImpl=fetch}={}){
  if(!/^[0-9a-f]{40}$/i.test(String(sha||'')))throw Error('source_commit_sha_required');
  const tree=await readApi('git/trees/'+sha+'?recursive=1',token,fetchImpl);
  if(tree.truncated||!Array.isArray(tree.tree))throw Error('source_tree_incomplete');
  const files=selectWindowFiles(tree.tree,mode);
  if(!files.length)throw Error('empty_source_selection');
  for(let i=0;i<files.length;i+=6){
    await Promise.all(files.slice(i,i+6).map(async file=>{
      if(file.bytes>1024*1024)throw Error('source_file_too_large');
      const blob=await readApi('git/blobs/'+file.sha,token,fetchImpl);
      if(blob.encoding!=='base64'||typeof blob.content!=='string')throw Error('invalid_source_blob');
      const buffer=Buffer.from(blob.content.replace(/\s/g,''),'base64');
      if(buffer.length!==file.bytes||gitBlobHash(buffer)!==file.sha)throw Error('source_blob_integrity_failed');
      const destination=resolve(root,file.target);
      if(!destination.startsWith(resolve(root)+'/'))throw Error('source_path_escape');
      await mkdir(dirname(destination),{recursive:true});
      await writeFile(destination,buffer);
    }));
  }
  const manifest={
    source_repository:SOURCE_REPO,
    source_sha:sha,
    mode,
    files:files.map(({source,target,sha,bytes})=>({source,target,sha,bytes}))
  };
  const manifestPath=resolve(root,'docs/sync-window-'+mode+'-manifest.json');
  await mkdir(dirname(manifestPath),{recursive:true});
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
  console.log('Window sync: '+files.length+' files from '+SOURCE_REPO+'@'+sha+'; manifest: '+manifestPath);
  return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const get=key=>process.argv.find(a=>a.startsWith('--'+key+'='))?.slice(key.length+3);
  syncWindow({sha:get('sha'),mode:get('mode')||'engine'}).catch(e=>{
    console.error('Window sync failed: '+(e instanceof Error?e.message:'unknown'));
    process.exitCode=1;
  });
}
