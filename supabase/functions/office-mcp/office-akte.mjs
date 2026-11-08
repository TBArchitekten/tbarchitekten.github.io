// Office-only MCP read adapter. The Window engine remains source-of-truth for
// voice/chat; these queries use the caller's Office JWT under RLS.
import {ToolError,norm,clip} from './office-tools.mjs';

const MAX_PROJECT_ITEMS=30;
const must=(result,label)=>{
  if(result?.error)throw new ToolError('Die '+label+' konnten nicht gelesen werden.');
  return result?.data??[];
};
function limited(value,n=400){return clip(String(value??''),n)}
function safeTerm(value){
  const s=String(value||'').trim();
  if(!s||s.length>160)throw new ToolError('Bitte einen Suchbegriff mit höchstens 160 Zeichen eingeben.');
  return s;
}
export function createOfficeAkteTools({sb,userId,base}){
  if(!sb||!userId||!base?.resolveProject)throw new TypeError('office_akte_context_required');
  async function scopedProject(reference){
    const requested=String(reference||'').trim();
    if(!requested)throw new ToolError('Bitte ein Projekt angeben.');
    // A readable project catalogue is not authority over its Akte.
    const p=await base.resolveProject(requested);
    const {data,error}=await sb.from('office_project_members')
      .select('project_id').eq('project_id',p.id).eq('user_id',userId).maybeSingle();
    if(error||!data||data.project_id!==p.id||p.archived===true)
      throw new ToolError('Die Projektakte ist für dieses Konto nicht verfügbar.');
    return p;
  }
  const claimsFor=async(projectId,limit=MAX_PROJECT_ITEMS)=>must(
    await sb.from('minds_work_claims')
      .select('id,statement,topic,claim_type,status,provenance_class,updated_at')
      .eq('project_id',projectId).order('updated_at',{ascending:false})
      .limit(Math.min(Math.max(limit,1),100)),'Projekt-Claims');
  const entriesFor=async(projectId,limit=MAX_PROJECT_ITEMS)=>must(
    await sb.from('minds_work_memory')
      .select('id,memory_type,title,body,status,provenance,updated_at')
      .eq('project_id',projectId).order('updated_at',{ascending:false})
      .limit(Math.min(Math.max(limit,1),100)),'Projekt-Einträge');
  async function openProject({project}={}){
    const p=await scopedProject(project);
    const [memo,claims,revisions]=await Promise.all([
      entriesFor(p.id),
      claimsFor(p.id),
      sb.from('minds_project_model_revisions')
        .select('id,status,reason,trigger_kind,created_at')
        .eq('project_id',p.id).order('created_at',{ascending:false}).limit(5)
    ]);
    const models=must(revisions,'Projektmodell');
    return {project:{id:p.id,name:p.name,number:p.number||null},
      evidence:'Quellen, Status und bestätigte Inhalte sind getrennt; proposed bedeutet nicht bestätigt.',
      entries:memo.map(e=>({id:e.id,type:e.memory_type,title:limited(e.title,150),text:limited(e.body,700),status:e.status,provenance:e.provenance,updated_at:e.updated_at})),
      claims:claims.map(c=>({id:c.id,topic:c.topic,statement:limited(c.statement,500),type:c.claim_type,status:c.status,provenance_class:c.provenance_class,updated_at:c.updated_at})),
      model_revisions:models};
  }
  async function openTopic({project,topic}={}){
    const p=await scopedProject(project),search=safeTerm(topic);
    const [memo,claims]=await Promise.all([entriesFor(p.id,100),claimsFor(p.id,100)]);
    const topics=[...new Set(claims.map(x=>String(x.topic||'').trim()).filter(Boolean))];
    const equal=topics.filter(t=>norm(t)===norm(search));
    const partial=topics.filter(t=>norm(t).includes(norm(search)));
    const choices=equal.length?equal:partial;
    if(choices.length>1)return {project:p.name,ambiguous:true,candidates:choices.slice(0,12),items:[]};
    const selected=choices[0]||search;
    const matchedClaims=claims.filter(c=>norm(c.topic)===norm(selected));
    const matchedMemo=memo.filter(e=>norm(e.title)===norm(selected) || norm(e.title).includes(norm(selected)));
    return {project:p.name,topic:selected,found:matchedClaims.length+matchedMemo.length>0,
      claims:matchedClaims.map(c=>({id:c.id,statement:limited(c.statement,1200),status:c.status,provenance_class:c.provenance_class})),
      entries:matchedMemo.map(e=>({id:e.id,title:e.title,text:limited(e.body,1200),status:e.status,provenance:e.provenance}))};
  }
  async function searchAkte({project,query,limit=12}={}){
    const p=await scopedProject(project),term=safeTerm(query);
    const cap=Math.max(1,Math.min(Number(limit)||12,25));
    // Escape LIKE wildcards: user-provided punctuation cannot expand a search.
    const pattern='%'+term.replace(/[\\%_]/g,'\\$&')+'%';
    const [claims,segments]=await Promise.all([
      sb.from('minds_work_claims')
        .select('id,statement,topic,status,provenance_class')
        .eq('project_id',p.id).ilike('statement',pattern).limit(cap),
      sb.from('minds_work_source_segments')
        .select('id,file_id,source_version,segment_no,locator,content')
        .eq('project_id',p.id).ilike('content',pattern).limit(cap)
    ]);
    return {project:p.name,query:term,claims:must(claims,'Projekt-Claims').slice(0,cap).map(c=>({
      id:c.id,topic:c.topic,status:c.status,provenance_class:c.provenance_class,statement:limited(c.statement,850)
    })),sources:must(segments,'Quellensegmente').slice(0,cap).map(s=>({
      id:s.id,file_id:s.file_id,source_version:s.source_version,segment_no:s.segment_no,
      locator:s.locator,text:limited(s.content,1400)
    }))};
  }
  async function turnDiagnostics({limit=20}={}){
    const cap=Math.max(1,Math.min(Number(limit)||20,50));
    const runs=must(await sb.from('minds_agent_runs')
      .select('id,feature,status,started_at,completed_at,latency_ms')
      .eq('user_id',userId).order('started_at',{ascending:false})
      .limit(cap),'Turn-Diagnosen');
    return {scope:'angemeldetes Konto',includes_message_content:false,
      count:runs.length,runs:runs.map(r=>({
        id:r.id,feature:r.feature,status:r.status,
        started_at:r.started_at,completed_at:r.completed_at,latency_ms:r.latency_ms
      }))};
  }
  return {openProject,openTopic,searchAkte,turnDiagnostics,scopedProject};
}
