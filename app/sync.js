(()=>{'use strict';
// TBA Office · Window's sync layer for an office of several people (adapted from gari01234/minds sync.js).
// Differences: office sign-in (start page), shared projects from isabella_projects (a view of office_projects),
// the Kalender holds one's own tasks plus those assigned to one, client_key is unique per table,
// and there is no memory, feed or conversation to sync (the assistant comes later).
const sb=window.MINDS_SUPABASE;
const app=window.ISABELLA_APP;
const $=s=>document.querySelector(s);
const authButton=$('#authButton'),status=$('#syncStatus');
let user=null,syncing=false,timer=null,hydrating=false,queuedSync=null;
let queuedSyncWaiters=[];
const pendingEntityMutations=new Set();
const setStatus=t=>{if(status)status.textContent=t};
const localDateTime=(date,time)=>new Date(date+'T'+(time||'09:00')+':00');
const pad=n=>String(n).padStart(2,'0');
const isoDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const timeOf=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
const MEMORY_KINDS=new Set(['fact','person','routine','episodic','preference','context']);
const MEMORY_KIND_ALIASES={schedule:'routine',habit:'routine',working_style:'preference',interaction:'preference',constraint:'context',goal:'context',priority:'context',value:'preference',project:'context',relation:'context',relationship:'person',work:'context',identity:'fact',note:'context',other:'context'};
function normalizeMemoryKind(kind){const k=String(kind||'context').trim().toLowerCase();return MEMORY_KINDS.has(k)?k:(MEMORY_KIND_ALIASES[k]||'context')}
function canonicalFeedPreferences(value={}){
  const p=value&&typeof value==='object'?value:{};
  return {mode:'situational_personal',instructions:String(p.instructions||'').trim(),weatherLocation:String(p.weatherLocation||'').trim(),topics:[],customTopics:[],following:[],followGraph:[]};
}
function apiError(e){return e?.message||String(e||'Unbekannter Fehler')}
async function init(){
  if(!sb||!app){setStatus('Nur lokal · Office nicht erreichbar');if(authButton)authButton.textContent='Nur lokal';return}
  const {data,error}=await sb.auth.getSession();
  if(error){setStatus('Anmeldung konnte nicht gelesen werden');return}
  user=data.session?.user||null;
  // Office sign-in happens on the start page; only active members with their own password get in.
  // In the Window app the app signs in (account "Office"): ask it instead of leaving the page.
  if(!user){openLogin();return}
  const {data:member,error:memberError}=await sb.from('office_members')
    .select('user_id,email,display_name,role,is_active,must_change_password').eq('user_id',user.id).eq('is_active',true).maybeSingle();
  if(memberError||!member||member.must_change_password){
    if(window.WINDOW_NATIVE?.available&&member?.must_change_password){setStatus('Bitte zuerst im Browser das Startpasswort ändern.');return}
    if(window.WINDOW_NATIVE?.available&&!memberError){setStatus('Kein aktiver Office-Zugang.');return}
    openLogin();return}
  window.TBA_OFFICE_MEMBER=Object.freeze({...member});
  // The local copy belongs to one person: a different sign-in on this browser starts from empty.
  if(app.getState().officeOwner!==user.id){
    hydrating=true;
    app.replaceState({tasks:[],events:[],deletedTaskIds:[],deletedEventIds:[],messages:[],memory:[],officeOwner:user.id});
    hydrating=false;
  }
  try{window.dispatchEvent(new CustomEvent('office:member',{detail:{...member}}))}catch{}
  paintAuth();
  await syncNow({initial:true});
  sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||!session)openLogin()});
  window.addEventListener('isabella:state',()=>{if(hydrating||!user)return;clearTimeout(timer);timer=setTimeout(()=>syncNow({pushOnly:true}),900)});
  window.addEventListener('isabella:mutation',e=>{if(!user||!e.detail)return;recordActivity(e.detail)});
  window.addEventListener('isabella:proposal-feedback',e=>{if(!user||!e.detail)return;recordProposalFeedback(e.detail)});
}
function paintAuth(){
  if(!authButton)return;
  authButton.textContent='Jetzt synchronisieren';
  authButton.onclick=()=>syncNow({});
  setStatus('Office verbunden · automatische Synchronisierung');
}
// The office signs in on its start page (email and password); there is no sign-in inside the app.
// In the Window iPhone app the native screen signs in (bridge session.signIn).
function openLogin(){
  if(window.WINDOW_NATIVE?.available){void window.WINDOW_NATIVE.call('session.signIn');return}
  location.replace('../');
}
async function ensureTaxonomy(state){
  const categories=(state.categories||[]).map((c,i)=>({user_id:user.id,client_key:c.id,name:c.name,color:c.color||null,sort_order:i}));
  if(categories.length){
    const {error}=await sb.from('isabella_categories').upsert(categories,{onConflict:'user_id,client_key'});
    if(error)throw error;
  }
  const {data:cats,error:ce}=await sb.from('isabella_categories').select('id,client_key,name,color').eq('user_id',user.id);
  if(ce)throw ce;
  const catByKey=new Map((cats||[]).map(c=>[c.client_key,c]));
  // Office projects are created on the office page; here they are only read (shared by the whole office).
  const {data:projs,error:pe}=await sb.from('isabella_projects').select('id,client_key,name,color,category_id,number,archived').eq('archived',false).order('number');
  if(pe)throw pe;
  return {cats:cats||[],projs:projs||[],catByKey,projByKey:new Map((projs||[]).map(p=>[p.client_key,p]))};
}
// The office projects as Window's local project list: id = client_key, all under "Arbeit".
function localProjects(maps){
  return (maps.projs||[]).map(p=>({id:p.client_key,categoryId:'arbeit',name:p.name,number:p.number||'',color:p.color||null}));
}
function taskRow(t,maps){
  if(t.done&&!t.completedAt)t.completedAt=new Date().toISOString();
  if(!t.done)t.completedAt=null;
  // A colleague's project task keeps its author (a trigger enforces it) and its own category.
  const foreign=!!t.ownerId&&t.ownerId!==user.id;
  return {user_id:user.id,client_key:t.id,title:t.title,due_date:t.date||null,completed_at:t.completedAt||null,archived_at:t.archivedAt||null,sort_order:Number(t.sortOrder||0),reminder_time:t.date?(t.reminderTime||null):null,category_id:foreign?(t.categoryRowId||null):maps.catByKey.get(t.categoryId)?.id||null,project_id:maps.projByKey.get(t.projectId)?.id||null,priority:t.priority||'normal',recurrence:t.recurrence||{},notes:t.notes||'',metadata:t.metadata||{},updated_at:t.updatedAt||new Date().toISOString()};
}
function eventRow(e,maps){
  const start=localDateTime(e.date,e.start),end=new Date(start.getTime()+((e.duration||60)*60000));
  return {user_id:user.id,client_key:e.id,title:e.title,starts_at:start.toISOString(),ends_at:end.toISOString(),all_day:!!e.allDay,category_id:maps.catByKey.get(e.categoryId)?.id||null,project_id:maps.projByKey.get(e.projectId)?.id||null,recurrence:e.recurrence||{},notes:e.notes||'',metadata:e.metadata||{},updated_at:e.updatedAt||new Date().toISOString()};
}
function entityRevisionTime(x){
  const n=Date.parse(String(x?.updatedAt||''));return Number.isFinite(n)?n:0;
}
function shouldKeepLocalEntity(kind,local,remote){
  if(!local)return false;
  if(pendingEntityMutations.has(kind+':'+local.id))return true;
  const localRevision=entityRevisionTime(local),remoteRevision=entityRevisionTime(remote);
  return localRevision>0&&localRevision>remoteRevision;
}
function mergeRemoteEntities(remote=[],local=[],kind='task'){
  const localById=new Map((local||[]).filter(x=>x?.id).map(x=>[x.id,x])),seen=new Set();
  const out=(remote||[]).map(x=>{
    seen.add(x.id);
    const localEntity=localById.get(x.id);
    return shouldKeepLocalEntity(kind,localEntity,x)?localEntity:x;
  });
  for(const x of local||[])if(x?.id&&!seen.has(x.id))out.push(x);
  return out;
}
function mergePulledEntityState(remoteTasks,remoteEvents,current,syncSnapshot){
  const deletedTaskIds=new Set(syncSnapshot?.deletedTaskIds||[]),deletedEventIds=new Set(syncSnapshot?.deletedEventIds||[]);
  const freshest={
    ...current,
    tasks:(current?.tasks||[]).filter(x=>!deletedTaskIds.has(x.id)),
    events:(current?.events||[]).filter(x=>!deletedEventIds.has(x.id)),
    deletedTaskIds:[...new Set([...(current?.deletedTaskIds||[]),...(syncSnapshot?.deletedTaskIds||[])])],
    deletedEventIds:[...new Set([...(current?.deletedEventIds||[]),...(syncSnapshot?.deletedEventIds||[])])]
  };
  return {...freshest,tasks:mergeRemoteEntities(remoteTasks,freshest.tasks||[],'task'),events:mergeRemoteEntities(remoteEvents,freshest.events||[],'event')};
}
async function persistEntityMutation(detail){
  const kind=String(detail?.entityType||'');
  if(!['task','event'].includes(kind)||!detail?.entityKey)return;
  // Colleagues' project Termine are read-only here (RLS allows only their author to change them).
  if(kind==='event'&&detail.after?.ownerId&&detail.after.ownerId!==user.id)return;
  const table=kind==='task'?'isabella_tasks':'isabella_events';
  if(detail.action==='delete'){
    const {error}=await sb.from(table).delete().eq('user_id',user.id).eq('client_key',detail.entityKey);
    if(error)throw error;
    return;
  }
  if(!detail.after)return;
  const maps=await ensureTaxonomy(app.getState());
  const row=kind==='task'?taskRow({...detail.after,updatedAt:detail.after.updatedAt||new Date().toISOString()},maps):eventRow({...detail.after,updatedAt:detail.after.updatedAt||new Date().toISOString()},maps);
  const {error}=await sb.from(table).upsert(row,{onConflict:'client_key'});
  if(error)throw error;
}
async function pushState(state,maps){
  const tombstones=[
    ...(state.deletedTaskIds||[]).map(client_key=>({user_id:user.id,entity_type:'task',client_key,deleted_at:new Date().toISOString()})),
    ...(state.deletedEventIds||[]).map(client_key=>({user_id:user.id,entity_type:'event',client_key,deleted_at:new Date().toISOString()}))
  ];
  if(tombstones.length){
    const {error}=await sb.from('isabella_deleted_items').upsert(tombstones,{onConflict:'user_id,entity_type,client_key'});
    if(error)throw error;
  }
  // Only own rows are pushed in bulk; colleagues' project tasks and Termine already live on the server.
  const own=x=>!x.ownerId||x.ownerId===user.id;
  const tasks=(state.tasks||[]).filter(own).map(t=>taskRow(t,maps));
  if(tasks.length){
    const {error}=await sb.from('isabella_tasks').upsert(tasks,{onConflict:'client_key',ignoreDuplicates:true});
    if(error)throw error;
  }
  if((state.deletedTaskIds||[]).length){
    const {error}=await sb.from('isabella_tasks').delete().eq('user_id',user.id).in('client_key',state.deletedTaskIds);
    if(error)throw error;
  }
  const events=(state.events||[]).filter(own).map(e=>eventRow(e,maps));
  if(events.length){
    const {error}=await sb.from('isabella_events').upsert(events,{onConflict:'client_key',ignoreDuplicates:true});
    if(error)throw error;
  }
  if((state.deletedEventIds||[]).length){
    const {error}=await sb.from('isabella_events').delete().eq('user_id',user.id).in('client_key',state.deletedEventIds);
    if(error)throw error;
  }
  // Memory, feed preferences and the conversation are not part of the office (yet).
}
function projectTaskRow(t,catKey,projKey){
  return {
    id:t.client_key||t.id,title:t.title,date:t.due_date||null,
    done:!!t.completed_at,completedAt:t.completed_at||null,
    archivedAt:t.archived_at||null,sortOrder:Number(t.sort_order||0),
    reminderTime:t.due_date&&t.reminder_time?String(t.reminder_time).slice(0,5):null,
    categoryId:catKey.get(t.category_id)||'arbeit',
    projectId:projKey.get(t.project_id)||null,priority:t.priority||'normal',
    recurrence:t.recurrence||{},notes:t.notes||'',metadata:t.metadata||{},
    startDate:t.start_date||null,assignee:t.assignee||null,
    assigneePersonId:t.assignee_person_id||null,
    workStatus:t.work_status||'not_started',
    workBucketId:t.work_bucket_id||null,workSortOrder:Number(t.work_sort_order||0),
    ownerId:t.user_id||null,categoryRowId:t.category_id||null,
    labels:Array.isArray(t.labels)?t.labels:[],
    checklist:Array.isArray(t.checklist)?t.checklist:[],
    attachments:Array.isArray(t.attachments)?t.attachments:[],
    links:Array.isArray(t.links)?t.links:[],
    updatedAt:t.updated_at||null
  };
}
// The Kalender is the calendar of your projects (decision of Gari, 07.11.2026): own tasks (personal or in
// a project), tasks assigned to you, and every dated task of the projects whose team you are in.
// Heute stays yours: it filters on `mine`.
let teamProjectIds=[];
async function loadTeamProjects(){
  const {data,error}=await sb.from('office_project_members').select('project_id').eq('user_id',user.id);
  if(error)return {error};
  teamProjectIds=[...new Set((data||[]).map(x=>x.project_id))];
  return {error:null};
}
let linkedTaskIds=new Set();
async function officeCalendarTasks(){
  const {data:links,error:le}=await sb.from('minds_work_task_assignees').select('task_id').eq('person_id',user.id);
  if(le)return {data:null,error:le};
  const linked=[...new Set((links||[]).map(x=>x.task_id))];linkedTaskIds=new Set(linked);
  const team=teamProjectIds.length?',and(project_id.in.('+teamProjectIds.join(',')+'),or(due_date.not.is.null,start_date.not.is.null))':'';
  const filter='user_id.eq.'+user.id+',assignee_person_id.eq.'+user.id+(linked.length?',id.in.('+linked.join(',')+')':'')+team;
  return await sb.from('isabella_tasks').select('*').or(filter).order('due_date',{ascending:true});
}
// Own Termine and the Termine of your projects (the team sees them; only the author changes them).
async function officeCalendarEvents(){
  const filter='user_id.eq.'+user.id+(teamProjectIds.length?',project_id.in.('+teamProjectIds.join(',')+')':'');
  return await sb.from('isabella_events').select('*').or(filter).order('starts_at',{ascending:true});
}
async function pullState(local,maps){
  const team=await loadTeamProjects();if(team.error)throw team.error;
  const [{data:tasks,error:te},{data:events,error:ee},{data:mem,error:me},{data:pref,error:pre},{data:assistantPref,error:ape},
    {data:assignees,error:asError},{data:allocations,error:alError},
    {data:teamPeople,error:peopleError}] = await Promise.all([
    officeCalendarTasks(),
    officeCalendarEvents(),
    Promise.resolve({data:[],error:null}),
    Promise.resolve({data:null,error:null}),
    Promise.resolve({data:null,error:null}),
    sb.from('minds_work_task_assignees').select('task_id,person_id,created_at'),
    sb.from('minds_work_task_allocations').select('task_id,person_id,work_date,planned_minutes'),
    sb.from('isabella_people').select('id,name').order('name')
  ]);
  if(te)throw te;if(ee)throw ee;if(me)throw me;if(pre)throw pre;if(ape)throw ape;
  if(asError)throw asError;if(alError)throw alError;if(peopleError)throw peopleError;
  const catKey=new Map(maps.cats.map(c=>[c.id,c.client_key])),projKey=new Map(maps.projs.map(p=>[p.id,p.client_key]));
  const deletedTaskIds=new Set(local.deletedTaskIds||[]);
  const deletedEventIds=new Set(local.deletedEventIds||[]);
  const teamIdsFor=(links,primary)=>{
    const ids=[...new Set([...links].filter(x=>x.person_id)
      .sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||''))||
        String(a.person_id).localeCompare(String(b.person_id)))
      .map(x=>x.person_id))];
    if(primary&&ids.includes(primary)){
      ids.splice(ids.indexOf(primary),1);ids.unshift(primary);
    }
    return ids;
  };
  const assignedByTask=new Map();
  for(const a of assignees||[]){
    if(!assignedByTask.has(a.task_id))assignedByTask.set(a.task_id,[]);
    assignedByTask.get(a.task_id).push(a);
  }
  const remoteTasks=(tasks||[]).filter(t=>!deletedTaskIds.has(t.client_key||t.id)).map(t=>{
    const ids=teamIdsFor(assignedByTask.get(t.id)||[],t.assignee_person_id);
    const assigned=ids.length?ids:(t.assignee_person_id?[t.assignee_person_id]:[]);
    return {...projectTaskRow(t,catKey,projKey),assigneePersonIds:assigned,
      mine:t.user_id===user.id||assigned.includes(user.id)||linkedTaskIds.has(t.id)};
  });
  const taskKeys=new Map((tasks||[]).map(t=>[t.id,t.client_key||t.id]));
  const teamAllocations=(allocations||[]).map(a=>({
    taskId:taskKeys.get(a.task_id),personId:a.person_id,date:a.work_date,plannedMinutes:a.planned_minutes
  })).filter(a=>a.taskId);
  const remoteEvents=(events||[]).filter(e=>!deletedEventIds.has(e.client_key||e.id)).map(e=>{const s=new Date(e.starts_at),en=new Date(e.ends_at);return{id:e.client_key||e.id,title:e.title,date:isoDate(s),start:timeOf(s),duration:Math.max(1,Math.round((en-s)/60000)),allDay:!!e.all_day,categoryId:catKey.get(e.category_id)||'arbeit',projectId:projKey.get(e.project_id)||null,recurrence:e.recurrence||{},notes:e.notes||'',metadata:e.metadata||{},updatedAt:e.updated_at||null,ownerId:e.user_id||null,mine:e.user_id===user.id}});
  const remoteMemory=(mem||[]).map(m=>({id:m.client_key||m.id,kind:m.kind,subject:m.subject,content:m.content,status:m.status,confidence:Number(m.confidence),source:m.source,exposure_scope_key:m.exposure_scope_key||'global',provenance_class:m.provenance_class||'owner',metadata:m.metadata||{}}));
  const freshest=mergePulledEntityState(remoteTasks,remoteEvents,app.getState(),local);
  const remoteFeed=(pref?.status!=='rejected'&&pref?.value&&typeof pref.value==='object')?canonicalFeedPreferences(pref.value):canonicalFeedPreferences(freshest.feedPreferences);
  const remoteAssistant=(assistantPref?.status!=='rejected'&&assistantPref?.value&&typeof assistantPref.value==='object')?{...(freshest.assistantPreferences||{}),...assistantPref.value}:freshest.assistantPreferences;
  return {...freshest,projects:localProjects(maps),teamPeople:teamPeople||[],teamAllocations,memory:remoteMemory,feedPreferences:remoteFeed,
    assistantPreferences:remoteAssistant,messages:freshest.messages};
}
async function recordProposalFeedback(detail){
  return; // no proposal log in the office yet
  try{
    const proposal=detail.proposal||{};
    await sb.from('isabella_proposal_feedback').insert({user_id:user.id,outcome:detail.outcome,proposal});
    if(proposal.request_id&&['accepted','rejected'].includes(String(detail.outcome||''))){
      await sb.rpc('minds_resolve_shadow_decision',{p_request_id:proposal.request_id,p_outcome:detail.outcome,p_reviewed:proposal});
    }
  }catch{}
}
async function recordActivity(detail){
  const pendingKey=String(detail.entityType||'')+':'+String(detail.entityKey||'');
  if(['task','event'].includes(String(detail.entityType||'')))pendingEntityMutations.add(pendingKey);
  try{
    const row={user_id:user.id,entity_type:detail.entityType,entity_key:detail.entityKey,action:detail.action,source:detail.source||'manual',before_state:detail.before||null,after_state:detail.after||null};
    if(detail.action==='delete'){
      const {error}=await sb.from('isabella_deleted_items').upsert({user_id:user.id,entity_type:detail.entityType,client_key:detail.entityKey,deleted_at:new Date().toISOString()},{onConflict:'user_id,entity_type,client_key'});
      if(error)throw error;
    }
    await persistEntityMutation(detail);
    void row; // Window also writes an activity log; the office keeps none.
  }catch(e){
    setStatus('Lokal gespeichert · Synchronisierung ausstehend: '+apiError(e));
  }finally{
    pendingEntityMutations.delete(pendingKey);
  }
}
async function syncNow(opts={}){
  if(!user)return false;
  if(syncing){
    queuedSync={...(queuedSync||{}),...opts};
    return new Promise(resolve=>queuedSyncWaiters.push(resolve));
  }
  syncing=true;let succeeded=false;setStatus('Synchronisiere …');
  try{
    const {data:deleted,error:de}=await sb.from('isabella_deleted_items').select('entity_type,client_key').eq('user_id',user.id);
    if(de)throw de;
    const deletedTasks=new Set((deleted||[]).filter(x=>x.entity_type==='task').map(x=>x.client_key));
    const deletedEvents=new Set((deleted||[]).filter(x=>x.entity_type==='event').map(x=>x.client_key));
    let local=app.getState();
    local={
      ...local,
      tasks:(local.tasks||[]).filter(x=>!deletedTasks.has(x.id)),
      events:(local.events||[]).filter(x=>!deletedEvents.has(x.id)),
      deletedTaskIds:[...new Set([...(local.deletedTaskIds||[]),...deletedTasks])],
      deletedEventIds:[...new Set([...(local.deletedEventIds||[]),...deletedEvents])]
    };
    local.feedPreferences=canonicalFeedPreferences(local.feedPreferences);
    const maps=await ensureTaxonomy(local);
    if(opts.initial||opts.pullOnly){
      const next=await pullState(local,maps);
      hydrating=true;app.replaceState(next);hydrating=false;
    }else{
      await pushState(local,maps);
      if(!opts.pushOnly){
        const next=await pullState(local,maps);
        hydrating=true;app.replaceState(next);hydrating=false;
      }
    }
    succeeded=true;
    setStatus('Synchronisiert · TBA Office');
    try{window.dispatchEvent(new CustomEvent('isabella:synced',{detail:{initial:!!opts.initial}}))}catch{}
  }catch(e){console.error(e);setStatus('Synchronisierung fehlgeschlagen: '+apiError(e))}
  finally{
    syncing=false;
    if(queuedSync){
      const next=queuedSync,waiters=queuedSyncWaiters.splice(0);
      queuedSync=null;
      setTimeout(()=>{
        void syncNow(next).then(ok=>waiters.forEach(resolve=>resolve(ok)),()=>waiters.forEach(resolve=>resolve(false)));
      },0);
    }
  }
  return succeeded;
}
window.ISABELLA_SYNC_NOW=(opts={})=>syncNow(opts);
window.ISABELLA_SYNC_PULL_NOW=()=>syncNow({pullOnly:true});
init();
})();