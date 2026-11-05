// TBA Office Work adapter. Reuses Window's workScreen, but exclusively reads Office tables.
(()=>{'use strict';
if(!document.body.classList.contains('office-app'))return;
const sb=()=>window.MINDS_SUPABASE;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=s=>String(s||'').trim();
const root='__office__';
let projectId=localStorage.getItem('office-work-project')||root,view=localStorage.getItem('office-work-view')||'desktop';
let catalog=[],project=null,buckets=[],tasks=[],folders=[],files=[],plans=[],team=[],members=[],taskAssignees=[],folderId=null,userId=null,bound=false,seq=0,busy=false;
const selected=()=>projectId===root?null:project;
const status=message=>{const x=$('#workStatus');if(x)x.textContent=message||''};
const html=s=>{const x=$('#workBody');if(x)x.innerHTML=s};
const button=(label,action,cls='')=>'<button type="button" data-office-work="'+action+'" class="'+cls+'">'+esc(label)+'</button>';
function currentLink(){history.replaceState(null,'','#section=work'+(projectId!==root?'&project='+encodeURIComponent(projectId):''))}
function setProject(id){projectId=id||root;localStorage.setItem('office-work-project',projectId);folderId=null;currentLink();void render()}
function setView(name){if(!['overview','desktop','planner'].includes(name))return;view=name;localStorage.setItem('office-work-view',name);void render()}
function paint(){
  $('#workProjectTitle').textContent=project?project.name:'Büro';
  const host=$('.work-project-switch');
  if(host)host.innerHTML='<button data-office-project="'+root+'">Büro</button>'+
    catalog.map(p=>'<button data-office-project="'+esc(p.id)+'">'+esc(p.number+' · '+p.name)+'</button>').join('');
  host?.querySelectorAll('[data-office-project]').forEach(b=>b.classList.toggle('active',b.dataset.officeProject===projectId));
  document.querySelectorAll('[data-work-view]').forEach(b=>{
    b.classList.toggle('active',b.dataset.workView===view);
    b.hidden=!project&&b.dataset.workView!=='desktop' || ['knowledge','threads'].includes(b.dataset.workView)
  });
}
async function load(){
  const client=sb();if(!client)throw Error('Office-Verbindung nicht verfügbar');
  const {data:{session},error:sessionError}=await client.auth.getSession();
  if(sessionError||!session)throw Error('Keine Office-Anmeldung');
  userId=session.user.id;
  const p=await client.from('office_projects').select('id,number,name,status,projektleiter_id').order('number').limit(250);
  if(p.error)throw p.error;
  catalog=p.data||[];
  project=catalog.find(x=>x.id===projectId)||null;
  if(!project&&projectId!==root){projectId=root;localStorage.setItem('office-work-project',root)}
  if(!project)return void (buckets=[],tasks=[],folders=[],files=[],plans=[],team=[],members=[],taskAssignees=[]);
  const responses=await Promise.all([
    client.from('office_task_buckets').select('id,project_id,name,position,is_archived').eq('project_id',project.id).eq('is_archived',false).order('position'),
    client.from('office_tasks').select('id,bucket_id,title,notes,priority,due_date,start_date,assignee_id,completed_at,position,kind').eq('project_id',project.id).order('position').limit(500),
    client.from('office_project_folders').select('id,name,parent_id,created_at').eq('project_id',project.id).order('name').limit(300),
    client.from('office_project_files').select('id,file_name,folder_id,storage_path,media_type,bytes,created_at').eq('project_id',project.id).order('created_at',{ascending:false}).limit(500),
    client.from('office_terminplan_instances').select('id,phase,updated_at').eq('project_id',project.id).eq('is_archived',false),
    client.from('office_project_members').select('user_id').eq('project_id',project.id),
    client.from('office_members').select('user_id,display_name').eq('is_active',true),
    client.from('office_task_assignees').select('task_id,user_id').eq('project_id',project.id).limit(1200)
  ]);
  const err=responses.find(x=>x.error)?.error;
  if(err)throw err;
  [buckets,tasks,folders,files,plans,team,members,taskAssignees]=responses.map(x=>x.data||[]);
  for(const task of tasks){const links=taskAssignees.filter(a=>a.task_id===task.id).map(a=>a.user_id);
    task.assignee_ids=links.length?links:(task.assignee_id?[task.assignee_id]:[])}
}
function overview(){
  const today=new Date().toISOString().slice(0,10);
  const future=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
  const upcoming=tasks.filter(t=>t.due_date&&t.due_date>=today&&t.due_date<=future&&!t.completed_at)
    .sort((a,b)=>a.due_date.localeCompare(b.due_date)).slice(0,25);
  html('<div class="office-work-wrap"><div class="office-work-heading"><h2>Panorama · '+esc(project.name)+'</h2>'+button('Planner öffnen','open-planner')+'</div>'+
    '<p>'+tasks.length+' Aufgaben · '+buckets.length+' Buckets · '+folders.length+' Ordner · '+files.length+' Dateien</p>'+
    '<h3>Demnächst · 14 Tage</h3>'+(upcoming.length?upcoming.map(t=>'<article class="office-work-item"><strong>'+esc(t.title)+'</strong><small>'+esc(t.due_date)+' · '+esc(buckets.find(b=>b.id===t.bucket_id)?.name||'Ohne Bucket')+'</small></article>').join(''):'<p>Keine bevorstehenden Aufgaben.</p>')+
    '<h3>Terminpläne</h3>'+(plans.length?plans.map(p=>'<a class="office-work-file" href="../terminplan.html?id='+encodeURIComponent(p.id)+'">'+esc(p.phase)+' · '+esc((p.updated_at||'').slice(0,10))+'</a>').join(''):'<p>Noch kein Terminplan.</p>')+'</div>');
}
function planner(){
  const surface=window.TBA_WINDOW_WORK_SURFACE;
  if(!surface){status('Window Work Oberfläche konnte nicht geladen werden.');return}
  html(surface.planner({project,buckets,tasks,members:members.filter(m=>team.some(t=>t.user_id===m.user_id))}));
  const body=$('#workBody');body.classList.remove('work-scroll-host');
  body.classList.remove('work-overview-host');
}
function desktop(){
  const surface=window.TBA_WINDOW_WORK_SURFACE;
  if(!surface){status('Window Desktop Oberfläche konnte nicht geladen werden.');return}
  const body=$('#workBody');body.classList.add('work-scroll-host');body.classList.remove('work-overview-host');
  if(!project){
    html('<div class="work-desktop-toolbar"><div class="work-breadcrumb"><strong>Büro</strong></div></div>'+
      '<div class="work-drop-hint">Projekte auswählen, um Ordner und Dateien zu verwalten.</div>'+
      '<div class="work-files">'+catalog.map(p=>'<button type="button" class="work-file work-folder" data-office-project="'+esc(p.id)+'">'+
        '<span class="work-file-icon">'+surface.tileIcon('folder')+'</span><strong>'+esc(p.name)+'</strong>'+
        '<small>'+esc(p.number)+' · Projekt</small></button>').join('')+
        (!catalog.length?'<div class="work-empty">Noch keine Projekte angelegt.</div>':'')+'</div>');
    return;
  }
  html(surface.desktop({project,folders,files,plans,folderId}));
}
function modal(title,fields,onSubmit){
  const app=window.ISABELLA_APP;
  if(!app?.openModal){status('Formular nicht verfügbar');return}
  app.openModal(title,'<form id="officeWorkDialog" class="form">'+fields+
    '<p id="officeWorkDialogError" role="alert" class="small"></p><button class="primary" type="submit">Speichern</button></form>');
  const form=$('#officeWorkDialog');if(!form){status('Formular konnte nicht geöffnet werden');return}
  form.onsubmit=async e=>{
    e.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;
    try{await onSubmit(new FormData(form));app.closeModal?.();await render()}
    catch(error){const out=$('#officeWorkDialogError');if(out)out.textContent='Speichern fehlgeschlagen: '+String(error.message||'Unbekannter Fehler');submit.disabled=false}
  };
}
function newBucket(){
  if(!project)return;
  modal('Neuer Bucket','<label>Name<input name="name" required maxlength="80" autocomplete="off"></label>',async f=>{
    const name=String(f.get('name')||'').trim();
    if(!name)throw Error('Name fehlt');
    const {error}=await sb().from('office_task_buckets').insert({project_id:project.id,name,position:buckets.length});
    if(error)throw error;
  });
}
function renameBucket(id){
  const b=buckets.find(x=>x.id===id);if(!b)return;
  modal('Bucket bearbeiten','<label>Name<input name="name" required maxlength="80" value="'+esc(b.name)+'"></label>',async f=>{
    const {error}=await sb().from('office_task_buckets').update({name:String(f.get('name')||'').trim()}).eq('id',id).eq('project_id',project.id);
    if(error)throw error;
  });
}
function editTask(id=null,bucketId=null){
  const task=tasks.find(x=>x.id===id)||null;
  const bucketIdChoice=bucketId||task?.bucket_id||null;
  const availableMembers=members.filter(x=>team.some(t=>t.user_id===x.user_id));
  const selected=new Set(task?.assignee_ids||[task?.assignee_id].filter(Boolean));
  const memberships=availableMembers.map(m=>'<label class="office-task-person"><input name="person" type="checkbox" value="'+esc(m.user_id)+'" '+
    (selected.has(m.user_id)?'checked':'')+'><span>'+esc(m.display_name)+'</span></label>').join('');
  const checklist=Array.isArray(task?.checklist)?task.checklist:[];
  const checklistRow=(c={})=>'<div class="work-check-row" data-check-id="'+esc(c.id||crypto.randomUUID())+'">'+
    '<input type="checkbox" name="checkdone" '+(c.done?'checked':'')+' aria-label="Erledigt">'+
    '<input type="text" name="checktext" maxlength="240" value="'+esc(c.text||'')+'" placeholder="Checklistenpunkt">'+
    '<button type="button" data-office-work="remove-check" aria-label="Checklistenpunkt entfernen">×</button></div>';
  const bucketOptions='<option value="">Ohne Bucket</option>'+
    buckets.map(b=>'<option value="'+esc(b.id)+'" '+(b.id===bucketIdChoice?'selected':'')+'>'+esc(b.name)+'</option>').join('');
  window.ISABELLA_APP?.openModal?.(task?'Aufgabe':'Neue Aufgabe',
    '<form id="officeWorkDialog" class="form work-task-form">'+
      '<label class="work-task-title-field">Titel<input name="title" required maxlength="200" value="'+esc(task?.title||'')+'"></label>'+
      '<div class="work-task-grid"><label>Bucket<select name="bucket">'+bucketOptions+'</select></label>'+
        '<label>Status<select name="status"><option value="open">Nicht begonnen</option><option value="completed" '+
          (task?.completed_at?'selected':'')+'>Erledigt</option></select></label></div>'+
      '<div class="work-task-grid"><label>Start<input type="date" name="start" value="'+esc(task?.start_date||'')+'"></label>'+
        '<label>Fällig<input type="date" name="due" value="'+esc(task?.due_date||'')+'"></label></div>'+
      '<div class="work-task-grid"><label>Priorität<select name="priority">'+
        [['niedrig','Niedrig'],['normal','Normal'],['hoch','Wichtig']].map(([v,l])=>
          '<option value="'+v+'" '+((task?.priority||'normal')===v?'selected':'')+'>'+l+'</option>').join('')+
        '</select></label><div><span class="office-task-team-label">Mitglieder</span>'+
          '<div class="office-task-people">'+memberships+'</div></div></div>'+
      '<label>Notizen<textarea name="notes" rows="4" maxlength="4000">'+esc(task?.notes||'')+'</textarea></label>'+
      '<div class="work-task-detail-section"><div class="work-check-head"><span>Checkliste</span>'+
        '<button type="button" data-office-work="add-check">＋ Punkt</button></div>'+
        '<div id="officeWorkChecklist">'+checklist.map(checklistRow).join('')+'</div></div>'+
      '<p id="officeWorkDialogError" role="alert" class="small"></p>'+
      '<button class="primary" type="submit">Speichern</button>'+
      (task?'<button type="button" class="secondary danger-text" data-office-work="delete-task:'+esc(task.id)+'">Aufgabe löschen</button>':'')+
    '</form>');
  const form=$('#officeWorkDialog');if(!form){status('Editor konnte nicht geöffnet werden');return}
  form.onclick=e=>{
    const el=e.target.closest('[data-office-work]');if(!el)return;
    if(el.dataset.officeWork==='add-check'){
      const list=$('#officeWorkChecklist');const wrap=document.createElement('div');
      wrap.innerHTML=checklistRow();list.append(wrap.firstElementChild);
    }
    if(el.dataset.officeWork==='remove-check')el.closest('.work-check-row')?.remove();
    if(el.dataset.officeWork.startsWith('delete-task:')){
      if(!confirm('Aufgabe „'+task.title+'“ wirklich löschen?'))return;
      void (async()=>{
        const {error}=await sb().from('office_tasks').delete().eq('id',task.id).eq('project_id',project.id);
        if(error){$('#officeWorkDialogError').textContent=error.message;return}
        window.ISABELLA_APP?.closeModal?.();await render();
      })();
    }
  };
  form.onsubmit=async e=>{
    e.preventDefault();const save=form.querySelector('[type="submit"]');save.disabled=true;
    try{
      const f=new FormData(form);
      const title=String(f.get('title')||'').trim();
      const due=f.get('due')||null,start=f.get('start')||null;
      if(!title)throw Error('Titel fehlt');
      if(start&&due&&start>due)throw Error('Der Start darf nicht nach dem Fälligkeitsdatum liegen.');
      const bucketId=f.get('bucket')||null;
      const assignees=[...form.querySelectorAll('input[name="person"]:checked')].map(x=>x.value);
      const checks=[...form.querySelectorAll('#officeWorkChecklist .work-check-row')].map(el=>({
        id:el.dataset.checkId,text:el.querySelector('[name="checktext"]').value.trim(),
        done:el.querySelector('[name="checkdone"]').checked
      })).filter(x=>x.text).slice(0,40);
      const payload={title,bucket_id:bucketId,start_date:start,due_date:due,
        notes:String(f.get('notes')||'').slice(0,4000),priority:f.get('priority'),
        checklist:checks,assignee_id:assignees[0]||null,
        completed_at:f.get('status')==='completed'?(task?.completed_at||new Date().toISOString()):null};
      const res=task
        ?await sb().from('office_tasks').update(payload).eq('id',task.id).eq('project_id',project.id).select('id').single()
        :await sb().from('office_tasks').insert({...payload,project_id:project.id,
          kind:'aufgabe',position:tasks.length*10}).select('id').single();
      if(res.error||!res.data?.id)throw res.error||Error('Aufgabe nicht gespeichert');
      await saveAssignees(res.data.id,assignees);
      window.ISABELLA_APP?.closeModal?.();await render();
    }catch(error){$('#officeWorkDialogError').textContent='Speichern nicht abgeschlossen: '+String(error.message||error);save.disabled=false}
  };
}
async function saveAssignees(taskId,ids){
  const existing=taskAssignees.filter(x=>x.task_id===taskId).map(x=>x.user_id);
  const old=new Set(existing),next=new Set(ids);
  const add=[...next].filter(x=>!old.has(x)),remove=existing.filter(x=>!next.has(x));
  if(add.length){
    const {error}=await sb().from('office_task_assignees').insert(add.map(user_id=>({
      task_id:taskId,project_id:project.id,user_id,assigned_by:userId})));
    if(error)throw error;
  }
  for(const user_id of remove){
    const {error}=await sb().from('office_task_assignees').delete().eq('task_id',taskId).eq('user_id',user_id);
    if(error)throw error;
  }
}
function newFolder(){
  if(!project)return;
  modal('Neuer Ordner','<label>Ordnername<input name="name" required maxlength="160"></label>',async f=>{
    const name=String(f.get('name')||'').trim();
    if(!name)throw Error('Name fehlt');
    const {error}=await sb().from('office_project_folders').insert({project_id:project.id,parent_id:folderId,created_by:userId,name});
    if(error)throw error;
  });
}
async function uploadFiles(){
  if(!project)return;
  const input=$('#workFileInput');if(!input)return;
  input.accept='.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt';
  input.onchange=async()=>{
    const selected=[...(input.files||[])];input.value='';
    if(!selected.length)return;
    busy=true;status('Dateien werden gespeichert …');
    try{
      for(const file of selected){
        if(!file.size||file.size>25*1000*1000)throw Error('Maximal 25 MB je Datei.');
        const id=crypto.randomUUID(),safe=String(file.name).replace(/[^\w.\-]+/g,'_').slice(0,150);
        const path=userId+'/'+project.id+'/'+id+'-'+safe;
        const {error}=await sb().storage.from('minds-work').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false,cacheControl:'60'});
        if(error)throw error;
        const {error:metaError}=await sb().from('office_project_files').insert({
          project_id:project.id,folder_id:folderId,storage_path:path,file_name:file.name.slice(0,240),
          media_type:file.type||'application/octet-stream',bytes:file.size,created_by:userId
        });
        if(metaError){
          await sb().storage.from('minds-work').remove([path]);
          throw metaError;
        }
      }
      await render();
    }catch(error){status('Datei konnte nicht gespeichert werden: '+String(error.message||error))}
    finally{busy=false}
  };
  input.click();
}
async function downloadFile(id){
  const f=files.find(x=>x.id===id);if(!f)return;
  const {data,error}=await sb().storage.from('minds-work').download(f.storage_path);
  if(error||!data){status('Datei nicht lesbar.');return}
  const url=URL.createObjectURL(data);
  const a=document.createElement('a');a.href=url;a.download=f.file_name;
  a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function moveTask(taskId,bucketId){
  if(!tasks.some(t=>t.id===taskId)||!buckets.some(b=>b.id===bucketId))return;
  const {error}=await sb().from('office_tasks').update({bucket_id:bucketId}).eq('id',taskId).eq('project_id',project.id);
  if(error)status('Aufgabe nicht verschoben: '+error.message);
  else void render();
}
function bind(){
  if(bound)return;bound=true;
  $('.work-project-switch')?.addEventListener('click',e=>{const x=e.target.closest('[data-office-project]');if(x)setProject(x.dataset.officeProject)});
  document.querySelectorAll('[data-work-view]').forEach(x=>x.onclick=()=>setView(x.dataset.workView));
  $('#workBody')?.addEventListener('click',e=>{
    const projectButton=e.target.closest('[data-office-project]');
    if(projectButton){setProject(projectButton.dataset.officeProject);return}
    const action=e.target.closest('[data-office-work]')?.dataset.officeWork;
    if(!action||busy)return;
    if(action==='open-planner')return setView('planner');
    if(action==='new-bucket')return newBucket();
    if(action==='new-folder')return newFolder();
    if(action==='upload-files')return uploadFiles();
    if(action==='folder-up'){folderId=folders.find(f=>f.id===folderId)?.parent_id||null;desktop();return}
    const [verb,id]=action.split(':');
    if(verb==='folder'){folderId=id;desktop()}
    if(verb==='rename-bucket')renameBucket(id);
    if(verb==='new-task')editTask(null,id);
    if(verb==='edit-task')editTask(id);
    if(verb==='download')void downloadFile(id);
  });
  let dragged=null;
  $('#workBody')?.addEventListener('dragstart',e=>{dragged=e.target.closest('[data-drag-task]')?.dataset.dragTask||null});
  $('#workBody')?.addEventListener('dragover',e=>{if(dragged&&e.target.closest('[data-drop-bucket]'))e.preventDefault()});
  $('#workBody')?.addEventListener('drop',e=>{const bucket=e.target.closest('[data-drop-bucket]')?.dataset.dropBucket;if(dragged&&bucket){e.preventDefault();void moveTask(dragged,bucket)}dragged=null});
  $('#workBody')?.addEventListener('dragend',()=>{dragged=null});
}
async function render(){
  const current=++seq;bind();status('');html('<p class="surface-loading">Work wird geladen …</p>');
  try{
    await load();if(current!==seq)return;
    paint();
    if(!project){view='desktop';paint();desktop();}
    else if(view==='planner')planner();
    else if(view==='overview')overview();
    else desktop();
  }catch(error){
    if(current!==seq)return;
    console.error('Office Work loading failed',error);
    status('Work konnte nicht geladen werden: '+String(error?.message||'Unbekannter Fehler'));
    html('<p>Work konnte nicht geöffnet werden. Bitte Anmeldung und Office-Verbindung prüfen.</p>'+button('Erneut versuchen','retry'));
    $('#workBody')?.querySelector('[data-office-work="retry"]')?.addEventListener('click',()=>void render());
  }
}
window.MINDS_WORK={
  render,refresh:render,open:(id,next='overview')=>{
    projectId=id||root;localStorage.setItem('office-work-project',projectId);
    view=['overview','desktop','planner'].includes(next)?next:'overview';
    localStorage.setItem('office-work-view',view);
    if(document.body.dataset.section==='work')void render();
  },
  context:()=>project?{id:project.id,key:project.id,name:project.name,active:document.body.dataset.section==='work',view}:null
};
if(document.body.dataset.section==='work')void render();
})();
