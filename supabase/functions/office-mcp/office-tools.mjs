// TBA Office connector · tool handlers (Claude works inside the office with the employee's own login).
// Every query runs with the signed-in employee's token, so the office's Row Level Security is the
// boundary: project tasks, Terminpläne and project desktops are shared among active members;
// personal tasks and the calendar stay private. Same shape as Window's connector (window-tools.mjs).
export const TZ='Europe/Berlin';
const DAY=864e5;
export const BUCKET='minds-work';

export function localDay(date=new Date(),tz=TZ){
  const p=new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const g=t=>(p.find(x=>x.type===t)||{}).value||'';
  return g('year')+'-'+g('month')+'-'+g('day');
}
export function addDays(iso,n){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
export const clip=(s,n)=>{const t=String(s||'');return t.length>n?t.slice(0,n)+'…':t};
export const isDay=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))&&!isNaN(Date.parse(String(s)+'T12:00:00Z'));
const isId=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s||''));

// A message the model can show as-is.
export class ToolError extends Error{constructor(message){super(message);this.name='ToolError'}}
export function must(res,label){
  if(res&&res.error)throw new Error(label+': '+(res.error.message||res.error.code||'query_failed'));
  return res?res.data:null;
}
const TASK_COLS='id,title,due_date,start_date,completed_at,archived_at,notes,project_id,work_status,priority,work_bucket_id,user_id,assignee_person_id,updated_at';

// Like Window: a multi-day task belongs to every day from its start until its due date.
export function inRange(t,day,until){
  return (t.due_date&&t.due_date<=until)||(t.start_date&&t.start_date<=until&&(!t.due_date||t.due_date>=day));
}
// Plain text from files people keep on the desktop. Binary formats go through extractText (PDF, Word, Excel).
const TEXT_TYPES=/^(text\/|application\/(json|xml|csv|x-yaml|yaml|rtf)|message\/rfc822)/i;
const TEXT_NAMES=/\.(txt|md|csv|tsv|json|xml|html?|eml|ics|yaml|yml|log)$/i;

/** @param {{sb:any,userId:string,now?:()=>Date,uuid?:()=>string,tz?:string,
 *   extractText?:((bytes:Uint8Array,mime:string,name:string)=>Promise<{text:string,note?:string}>)|null}} options */
export function createOfficeTools({sb,userId,now=()=>new Date(),uuid=()=>crypto.randomUUID(),tz=TZ,extractText=null}){
  if(!sb||!userId)throw new Error('office_tools_need_employee');
  const today=()=>localDay(now(),tz);

  async function projectList(){
    const rows=must(await sb.from('isabella_projects').select('id,client_key,name,number,archived').order('name',{ascending:true}),'projects')||[];
    return rows.filter(p=>!p.archived);
  }
  async function projectNames(){return new Map((await projectList()).map(p=>[p.id,p.name]))}
  async function resolveProject(ref){
    const r=String(ref||'').trim();
    if(!r)throw new ToolError('Gib das Projekt an (Name, Nummer oder id).');
    const list=await projectList();
    const exact=list.find(p=>p.id===r||p.client_key===r||String(p.number||'')===r||norm(p.name)===norm(r));
    if(exact)return exact;
    const partial=list.filter(p=>norm(p.name).includes(norm(r))||norm(r).includes(norm(p.name)));
    if(partial.length===1)return partial[0];
    if(partial.length>1)throw new ToolError('Mehrere Projekte passen zu "'+r+'": '+partial.map(p=>p.name).join(', ')+'.');
    throw new ToolError('Projekt "'+r+'" nicht gefunden. Projekte im Office: '+(list.map(p=>p.name).join(', ')||'keine')+'.');
  }
  async function memberNames(){
    const rows=must(await sb.from('office_members').select('user_id,display_name').eq('is_active',true),'members')||[];
    return new Map(rows.map(m=>[m.user_id,m.display_name]));
  }
  function taskOut(t,names,people){
    return {id:t.id,title:t.title,due:t.due_date||null,start:t.start_date||null,done:!!t.completed_at,
      project:names.get(t.project_id)||null,status:t.work_status||null,priority:t.priority&&t.priority!=='normal'?t.priority:undefined,
      assignee:people&&t.assignee_person_id?people.get(t.assignee_person_id)||undefined:undefined,
      mine:t.user_id===userId||t.assignee_person_id===userId||undefined,notes:t.notes?clip(t.notes,600):undefined};
  }

  async function listProjects(){
    const list=await projectList();
    return {projects:list.map(p=>({id:p.id,number:p.number||undefined,name:p.name}))};
  }

  async function listTasks({range='open',day:askedDay,project,query,mine=false,limit=80}={}){
    if(!['today','week','open','done_recent'].includes(range))throw new ToolError('range: today, week, open oder done_recent.');
    if(askedDay!=null&&!/^\d{4}-\d{2}-\d{2}$/.test(String(askedDay)))throw new ToolError('day: YYYY-MM-DD.');
    // A specific day (e.g. tomorrow) works like today: everything due by then and still open, plus multi-day tasks running.
    if(askedDay)range='day';
    const now0=today(),day=askedDay||now0,until=range==='week'?addDays(day,7):day,cap=Math.min(Math.max(Number(limit)||80,1),200);
    const [names,people]=await Promise.all([projectNames(),memberNames()]);
    const p=project?await resolveProject(project):null;
    let q=sb.from('isabella_tasks').select(TASK_COLS).is('archived_at',null);
    if(p)q=q.eq('project_id',p.id);
    if(query)q=q.ilike('title','%'+String(query).replace(/[%_,()]/g,' ').trim()+'%');
    if(range==='done_recent')q=q.not('completed_at','is',null).gte('completed_at',new Date(now().getTime()-14*DAY).toISOString()).order('completed_at',{ascending:false});
    else{
      q=q.is('completed_at',null);
      if(range!=='open')q=q.or('due_date.lte.'+until+',start_date.lte.'+until);
      q=q.order('due_date',{ascending:true,nullsFirst:false});
    }
    let rows=must(await q.limit(Math.max(cap,120)),'tasks')||[];
    if(range==='today'||range==='week'||range==='day')rows=rows.filter(t=>inRange(t,day,until));
    let assigned=new Set();
    if(rows.length){
      const a=await sb.from('minds_work_task_assignees').select('task_id').eq('person_id',userId).in('task_id',rows.map(t=>t.id));
      if(!a.error)assigned=new Set((a.data||[]).map(r=>r.task_id));
    }
    let out=rows.map(t=>({...taskOut(t,names,people),mine:t.user_id===userId||t.assignee_person_id===userId||assigned.has(t.id)||undefined,
      overdue:!t.completed_at&&t.due_date&&t.due_date<now0||undefined}));
    if(mine)out=out.filter(t=>t.mine);
    return {today:now0,day,range,project:p?p.name:null,count:Math.min(out.length,cap),tasks:out.slice(0,cap)};
  }

  async function listEvents({from,to}={}){
    const start=isDay(from)?from:today(),end=isDay(to)?to:addDays(start,7);
    if(end<start)throw new ToolError('Das Enddatum liegt vor dem Startdatum.');
    if(Date.parse(end)-Date.parse(start)>120*DAY)throw new ToolError('Höchstens 120 Tage auf einmal.');
    const fromIso=new Date(new Date(start+'T00:00:00Z').getTime()-2*3600e3).toISOString(),toIso=new Date(addDays(end,1)+'T00:00:00Z').toISOString();
    const names=await projectNames();
    const rows=must(await sb.from('isabella_events').select('id,title,starts_at,ends_at,all_day,notes,project_id')
      .eq('user_id',userId).lt('starts_at',toIso).gte('ends_at',fromIso).order('starts_at',{ascending:true}).limit(200),'events')||[];
    const fmt=iso=>new Intl.DateTimeFormat('de-DE',{timeZone:tz,weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
    return {from:start,to:end,timezone:tz,events:rows.map(e=>({id:e.id,title:e.title,starts:e.all_day?localDay(new Date(e.starts_at),tz):fmt(e.starts_at),
      ends:e.all_day?undefined:fmt(e.ends_at),all_day:!!e.all_day||undefined,project:names.get(e.project_id)||undefined,notes:e.notes?clip(e.notes,400):undefined}))};
  }

  // Fristen = the milestones of the Terminpläne (like Heute and Kalender in the office app).
  async function deadlines({project,days=60}={}){
    const p=project?await resolveProject(project):null,day=today(),until=addDays(day,Math.min(Math.max(Number(days)||60,1),366));
    let q=sb.from('office_terminplan_instances').select('id,project_id,phase,state,is_archived').eq('is_archived',false);
    if(p)q=q.eq('project_id',p.id);
    const plans=must(await q.limit(100),'plans')||[],names=await projectNames(),out=[];
    for(const plan of plans){
      const tasks=Array.isArray(plan?.state?.tasks)?plan.state.tasks:[];
      for(const t of tasks){
        if(t?.type!=='milestone')continue;
        const date=String(t.start||t.end||'').slice(0,10);
        if(!isDay(date)||date<day||date>until)continue;
        out.push({date,title:String(t.name||'Meilenstein'),project:names.get(plan.project_id)||null,plan:plan.phase?'Terminplan '+plan.phase:'Terminplan'});
      }
    }
    out.sort((a,b)=>a.date.localeCompare(b.date));
    return {from:day,to:until,project:p?p.name:null,deadlines:out.slice(0,100)};
  }

  async function overview(){
    const day=today();
    const [tasks,events,projects,fristen]=await Promise.all([
      listTasks({range:'today',limit:60}),
      listEvents({from:day,to:addDays(day,1)}),
      listProjects(),
      deadlines({days:21})
    ]);
    return {today:day,timezone:tz,tasks_today_and_overdue:tasks.tasks,events_today_and_tomorrow:events.events,
      deadlines_next_3_weeks:fristen.deadlines,projects:projects.projects};
  }

  function folderPaths(folderRows){
    const byId=new Map(folderRows.map(f=>[f.id,f])),cache=new Map();
    return id=>{if(!id)return '';if(cache.has(id))return cache.get(id);const parts=[];let cur=byId.get(id),guard=0;
      while(cur&&guard++<12){parts.unshift(cur.name);cur=byId.get(cur.parent_id)}const v=parts.join(' / ');cache.set(id,v);return v};
  }

  async function projectContext({project}={}){
    const p=await resolveProject(project),names=new Map([[p.id,p.name]]),day=today();
    const [team,buckets,tasks,folders,files,fristen,people]=await Promise.all([
      sb.from('office_project_members').select('user_id').eq('project_id',p.id),
      sb.from('minds_work_buckets').select('id,name,sort_order,archived').eq('project_id',p.id).order('sort_order',{ascending:true}),
      sb.from('isabella_tasks').select(TASK_COLS).eq('project_id',p.id).is('archived_at',null).is('completed_at',null).order('due_date',{ascending:true,nullsFirst:false}).limit(150),
      sb.from('minds_work_folders').select('id,parent_id,name').eq('project_id',p.id).limit(300),
      sb.from('minds_work_files').select('id,folder_id,name,mime_type,size_bytes,created_at').eq('project_id',p.id).order('created_at',{ascending:false}).limit(400),
      deadlines({project:p.id,days:120}),
      memberNames()
    ]);
    const bucketRows=(must(buckets,'buckets')||[]).filter(b=>!b.archived),bucketName=new Map(bucketRows.map(b=>[b.id,b.name]));
    const folderRows=must(folders,'folders')||[],pathOf=folderPaths(folderRows);
    return {project:{id:p.id,number:p.number||undefined,name:p.name},today:day,
      team:(must(team,'team')||[]).map(m=>people.get(m.user_id)||'Mitglied'),
      buckets:bucketRows.map(b=>b.name),
      open_tasks:(must(tasks,'tasks')||[]).map(t=>({...taskOut(t,names,people),bucket:bucketName.get(t.work_bucket_id)||undefined,project:undefined,
        overdue:t.due_date&&t.due_date<day||undefined})),
      deadlines:fristen.deadlines,
      desktop:{folders:folderRows.map(f=>pathOf(f.id)).filter(Boolean).sort(),
        files:(must(files,'files')||[]).map(f=>({id:f.id,name:f.name,folder:pathOf(f.folder_id)||undefined,type:f.mime_type||undefined,
          size_kb:Math.round(Number(f.size_bytes||0)/1024),added:String(f.created_at||'').slice(0,10)}))}};
  }

  async function searchFiles({query,project,limit=20}={}){
    const q=String(query||'').trim();
    if(q.length<2)throw new ToolError('Mindestens zwei Zeichen für die Suche.');
    const p=project?await resolveProject(project):null,cap=Math.min(Math.max(Number(limit)||20,1),50);
    const like='%'+q.replace(/[%_,()]/g,' ').trim()+'%';
    let files=sb.from('minds_work_files').select('id,folder_id,name,mime_type,size_bytes,created_at,project_id').ilike('name',like);
    let folders=sb.from('minds_work_folders').select('id,parent_id,name,project_id').ilike('name',like);
    if(p){files=files.eq('project_id',p.id);folders=folders.eq('project_id',p.id)}
    const [a,b]=await Promise.all([files.order('created_at',{ascending:false}).limit(cap),folders.limit(20)]);
    const fileRows=must(a,'search_files')||[],folderHits=must(b,'search_folders')||[];
    // Files inside matching folders count too (e.g. "Statik" finds everything in the Statik folder).
    let inFolders=[];
    if(folderHits.length){
      inFolders=must(await sb.from('minds_work_files').select('id,folder_id,name,mime_type,size_bytes,created_at,project_id').in('folder_id',folderHits.map(f=>f.id)).order('created_at',{ascending:false}).limit(cap),'folder_files')||[];
    }
    const projectIds=[...new Set([...fileRows,...inFolders].map(f=>f.project_id))];
    const allFolders=projectIds.length?must(await sb.from('minds_work_folders').select('id,parent_id,name').in('project_id',projectIds).limit(800),'paths')||[]:[];
    const pathOf=folderPaths(allFolders),names=await projectNames(),seen=new Set(),results=[];
    for(const f of [...fileRows,...inFolders]){
      if(seen.has(f.id))continue;seen.add(f.id);
      results.push({id:f.id,name:f.name,project:names.get(f.project_id)||null,folder:pathOf(f.folder_id)||undefined,type:f.mime_type||undefined,
        size_kb:Math.round(Number(f.size_bytes||0)/1024),added:String(f.created_at||'').slice(0,10)});
    }
    return {query:q,project:p?p.name:null,results:results.slice(0,cap),
      note:'Die Suche findet Datei- und Ordnernamen. Den Inhalt liest read_file.'};
  }

  async function readFile({file_id,offset=0,max_chars=30000}={}){
    const id=String(file_id||'').trim();
    if(!isId(id))throw new ToolError('Gib eine file_id aus search_files oder project_context an.');
    const f=must(await sb.from('minds_work_files').select('id,name,mime_type,size_bytes,storage_path,project_id,folder_id,created_at').eq('id',id).maybeSingle(),'file');
    if(!f)throw new ToolError('Diese Datei gibt es im Office nicht (oder du hast keinen Zugriff).');
    if(Number(f.size_bytes||0)>40*1024*1024)throw new ToolError('Die Datei ist zu groß zum Lesen (über 40 MB).');
    const dl=await sb.storage.from(BUCKET).download(f.storage_path);
    if(dl.error||!dl.data)throw new Error('download: '+(dl.error?.message||'empty'));
    const bytes=new Uint8Array(await dl.data.arrayBuffer());
    const mime=String(f.mime_type||''),name=String(f.name||'');
    let text='',note;
    if(TEXT_TYPES.test(mime)||TEXT_NAMES.test(name))text=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
    else if(extractText){
      const r=await extractText(bytes,mime,name);
      text=r?.text||'';note=r?.note;
    }
    if(!text&&!note)note='Aus diesem Dateityp kann der Connector keinen Text lesen ('+(mime||name.split('.').pop()||'unbekannt')+').';
    const start=Math.max(0,Number(offset)||0),cap=Math.min(Math.max(Number(max_chars)||30000,1000),60000);
    const part=text.slice(start,start+cap),next=start+part.length<text.length?start+part.length:null;
    const names=await projectNames();
    return {file:{id:f.id,name,project:names.get(f.project_id)||null,type:mime||undefined,added:String(f.created_at||'').slice(0,10)},
      offset:start,next_offset:next,total_chars:text.length,text:part,note};
  }

  async function createTask({title,project,due_date,start_date,notes}={}){
    const t=String(title||'').trim();
    if(!t)throw new ToolError('Die Aufgabe braucht einen Titel.');
    if(t.length>300)throw new ToolError('Der Titel ist zu lang (höchstens 300 Zeichen).');
    if(due_date&&!isDay(due_date))throw new ToolError('due_date im Format JJJJ-MM-TT.');
    if(start_date&&!isDay(start_date))throw new ToolError('start_date im Format JJJJ-MM-TT.');
    if(start_date&&due_date&&start_date>due_date)throw new ToolError('Der Beginn liegt nach der Fälligkeit.');
    const p=project?await resolveProject(project):null,id=uuid(),stamp=now().toISOString();
    const row={id,client_key:id,user_id:userId,title:t,due_date:due_date||null,start_date:start_date||null,notes:String(notes||'').slice(0,4000),
      project_id:p?p.id:null,metadata:{source:'claude_connector'},created_at:stamp,updated_at:stamp};
    const saved=must(await sb.from('isabella_tasks').insert(row).select('id,title,due_date,start_date,project_id').single(),'create_task');
    return {created:{id:saved.id,title:saved.title,due:saved.due_date,start:saved.start_date,project:p?p.name:null},
      note:p?'Die Aufgabe ist im Planner des Projekts für das Team sichtbar.':'Persönliche Aufgabe, nur für dich sichtbar.'};
  }

  async function updateTask({task_id,title,due_date,start_date,notes,done}={}){
    const id=String(task_id||'').trim();
    if(!isId(id))throw new ToolError('Gib task_id an.');
    const current=must(await sb.from('isabella_tasks').select(TASK_COLS).eq('id',id).maybeSingle(),'task');
    if(!current)throw new ToolError('Diese Aufgabe gibt es im Office nicht (oder du hast keinen Zugriff).');
    const patch={updated_at:now().toISOString()};
    if(title!==undefined){const t=String(title).trim();if(!t)throw new ToolError('Der Titel darf nicht leer sein.');patch.title=t.slice(0,300)}
    if(due_date!==undefined){if(due_date!==null&&due_date!==''&&!isDay(due_date))throw new ToolError('due_date im Format JJJJ-MM-TT.');patch.due_date=due_date||null}
    if(start_date!==undefined){if(start_date!==null&&start_date!==''&&!isDay(start_date))throw new ToolError('start_date im Format JJJJ-MM-TT.');patch.start_date=start_date||null}
    const s=patch.start_date!==undefined?patch.start_date:current.start_date,d=patch.due_date!==undefined?patch.due_date:current.due_date;
    if(s&&d&&s>d)throw new ToolError('Der Beginn läge nach der Fälligkeit.');
    if(notes!==undefined)patch.notes=String(notes||'').slice(0,4000);
    if(done!==undefined)patch.completed_at=done?(current.completed_at||now().toISOString()):null;
    if(Object.keys(patch).length===1)throw new ToolError('Keine Änderung angegeben.');
    const saved=must(await sb.from('isabella_tasks').update(patch).eq('id',id).select(TASK_COLS).maybeSingle(),'update_task');
    if(!saved)throw new ToolError('Diese Aufgabe darfst du nicht ändern (nur Ersteller, Zuständige oder das Projektteam).');
    return {updated:taskOut(saved,await projectNames(),await memberNames())};
  }

  return {listProjects,overview,projectContext,deadlines,searchFiles,readFile,listTasks,listEvents,createTask,updateTask,resolveProject};
}
