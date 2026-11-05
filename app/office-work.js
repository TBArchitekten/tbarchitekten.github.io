// TBA Office Work adapter. Reuses Window's workScreen, but exclusively reads Office tables.
(()=>{'use strict';
if(!document.body.classList.contains('office-app'))return;
const sb=()=>window.MINDS_SUPABASE;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=s=>String(s||'').trim();
const root='__office__';
let projectId=localStorage.getItem('office-work-project')||root,view=localStorage.getItem('office-work-view')||'desktop';
let catalog=[],project=null,buckets=[],tasks=[],folders=[],files=[],plans=[],team=[],members=[],folderId=null,userId=null,bound=false,seq=0,busy=false;
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
  if(!project)return void (buckets=[],tasks=[],folders=[],files=[],plans=[],team=[],members=[]);
  const responses=await Promise.all([
    client.from('office_task_buckets').select('id,project_id,name,position,is_archived').eq('project_id',project.id).eq('is_archived',false).order('position'),
    client.from('office_tasks').select('id,bucket_id,title,notes,priority,due_date,start_date,assignee_id,completed_at,position,kind').eq('project_id',project.id).order('position').limit(500),
    client.from('office_project_folders').select('id,name,parent_id,created_at').eq('project_id',project.id).order('name').limit(300),
    client.from('office_project_files').select('id,file_name,folder_id,storage_path,media_type,bytes,created_at').eq('project_id',project.id).order('created_at',{ascending:false}).limit(500),
    client.from('office_terminplan_instances').select('id,phase,updated_at').eq('project_id',project.id).eq('is_archived',false),
    client.from('office_project_members').select('user_id').eq('project_id',project.id),
    client.from('office_members').select('user_id,display_name').eq('is_active',true)
  ]);
  const err=responses.find(x=>x.error)?.error;
  if(err)throw err;
  [buckets,tasks,folders,files,plans,team,members]=responses.map(x=>x.data||[]);
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
  const board=buckets.map(b=>'<section class="work-bucket office-work-bucket" data-bucket-id="'+esc(b.id)+'">'+
    '<div class="work-bucket-header"><strong>'+esc(b.name)+'</strong>'+button('⋯','rename-bucket:'+b.id,'office-work-more')+'</div>'+
    '<div class="office-work-bucket-body" data-drop-bucket="'+esc(b.id)+'">'+tasks.filter(t=>t.bucket_id===b.id).map(t=>
      '<div class="office-work-task" draggable="true" data-drag-task="'+esc(t.id)+'">'+
      '<button type="button" data-office-work="edit-task:'+esc(t.id)+'">'+esc(t.title)+'</button>'+
      '<small>'+esc(t.due_date||'Ohne Termin')+(t.completed_at?' · Erledigt':'')+'</small></div>').join('')+
    '</div>'+button('+ Aufgabe','new-task:'+b.id,'office-work-add')+'</section>').join('');
  html('<div class="office-work-wrap"><div class="office-work-heading"><h2>Planner · '+esc(project.name)+'</h2>'+button('+ Bucket','new-bucket')+'</div>'+
    '<p>Ziehe Aufgaben in einen anderen Bucket. Änderungen werden unter deinem Office-Zugang gespeichert.</p>'+
    '<div class="office-work-board">'+board+'<div class="office-work-bucket office-work-bucket-empty">'+button('+ Bucket','new-bucket')+'</div></div>'+
    (buckets.length?'':'<p>Noch keine Buckets. Mit „+ Bucket“ beginnst du die Planung.</p>')+'</div>');
}
function desktop(){
  if(!project){
    html('<div class="office-work-wrap"><h2>Projekte</h2><p>Wähle ein Projekt, um Ordner, Dateien und Terminpläne zu sehen.</p>'+
      catalog.map(p=>'<button class="office-work-file" data-office-project="'+esc(p.id)+'">📁 '+esc(p.number+' · '+p.name)+'</button>').join('')+
      (!catalog.length?'<p>Keine Projekte angelegt. Erstelle eines unter Tools → Projekte.</p>':'')+'</div>');return;
  }
  const current=folders.find(f=>f.id===folderId);
  const children=folders.filter(f=>(f.parent_id||null)===(folderId||null));
  const documents=files.filter(f=>(f.folder_id||null)===(folderId||null));
  html('<div class="office-work-wrap"><div class="office-work-heading"><h2>Desktop · '+esc(project.name)+(current?' / '+esc(current.name):'')+'</h2>'+
    button('+ Ordner','new-folder')+button('Datei hinzufügen','upload-files')+'</div>'+
    (folderId?button('‹ Zurück','folder-up'):'')+
    '<div class="office-work-files">'+children.map(f=>'<button class="office-work-file" data-office-work="folder:'+esc(f.id)+'">📁 '+esc(f.name)+'</button>').join('')+
    documents.map(f=>'<button class="office-work-file" data-office-work="download:'+esc(f.id)+'">📄 '+esc(f.file_name)+' <small>'+Math.round(f.bytes/1024)+' KB</small></button>').join('')+
    (!children.length&&!documents.length?'<p>Dieser Ordner ist leer.</p>':'')+'</div>'+
    (!folderId&&plans.length?'<h3>Terminpläne</h3>'+plans.map(p=>'<a class="office-work-file" href="../terminplan.html?id='+encodeURIComponent(p.id)+'">📅 '+esc(p.phase)+'</a>').join(''):'')+
    '</div>');
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
  const task=tasks.find(x=>x.id===id),b=bucketId||task?.bucket_id||buckets[0]?.id;
  if(!b){status('Bitte zuerst einen Bucket erstellen');return}
  const options='<option value="">— keine Zuordnung —</option>'+
    members.filter(x=>team.some(t=>t.user_id===x.user_id)).map(m=>'<option value="'+esc(m.user_id)+'" '+(task?.assignee_id===m.user_id?'selected':'')+'>'+esc(m.display_name)+'</option>').join('');
  const which='<label>Bucket<select name="bucket">'+buckets.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===b?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label>';
  modal(task?'Aufgabe bearbeiten':'Neue Aufgabe',
    '<label>Aufgabe<input name="title" required maxlength="200" value="'+esc(task?.title||'')+'"></label>'+
    which+'<label>Fällig<input name="due" type="date" value="'+esc(task?.due_date||'')+'"></label>'+
    '<label>Mitglied<select name="assignee">'+options+'</select></label>',
    async f=>{
      const payload={title:String(f.get('title')||'').trim(),
        bucket_id:String(f.get('bucket')),due_date:f.get('due')||null,
        assignee_id:f.get('assignee')||null};
      if(!payload.title)throw Error('Titel fehlt');
      const q=task?sb().from('office_tasks').update(payload).eq('id',task.id).eq('project_id',project.id):
        sb().from('office_tasks').insert({...payload,project_id:project.id,kind:'aufgabe',position:tasks.length});
      const {error}=await q;if(error)throw error;
    });
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
