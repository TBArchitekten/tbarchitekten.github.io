/* Build 97B · One canonical, auto-saving task detail across Work, Chat and Tiempo.
 * Owner-scoped Supabase row is source of truth. Never silently overwrite conflicts. */
(()=>{
'use strict';
const sb=window.MINDS_SUPABASE,app=()=>window.ISABELLA_APP;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now();
let generation=0;
const status=(text,error=false)=>{
  const node=$('#taskDetailStatus');if(node){node.textContent=text;node.dataset.error=String(error)}
};
const fail=err=>status('Nicht gespeichert · '+(err?.message||String(err)),true);
const selectOption=(id,name,selected)=>'<option value="'+E(id)+'" '+(String(id)===String(selected)?'selected':'')+'>'+E(name)+'</option>';
const datesValid=(start,due)=>!start||!due||start<=due;
const yes=(value)=>Array.isArray(value)?value:[];
// TBA Office: everything here is work, so tasks carry the category "Arbeit" without asking (Gari, 07.11.2026).
const HIDE_CATEGORY=!!window.TBA_OFFICE_CONFIG;
async function readTask(opts){
  let query=sb.from('isabella_tasks').select('*');
  if(opts.taskId)query=query.eq('id',opts.taskId);
  else query=query.eq('client_key',opts.clientKey);
  const {data,error}=await query.maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('Die Aufgabe existiert nicht oder ist nicht verfügbar.');
  return data;
}
async function readChoices(projectId){
  const [pr,cat]=await Promise.all([
    sb.from('isabella_projects').select('id,client_key,name').order('name'),
    sb.from('isabella_categories').select('id,client_key,name').order('name')
  ]);
  if(pr.error||cat.error)throw pr.error||cat.error;
  const projects=pr.data||[],categories=cat.data||[];
  const project=projects.find(p=>p.id===projectId);
  const [buckets,people]=await Promise.all([
    project?sb.from('minds_work_buckets').select('id,name').eq('project_id',project.id).eq('archived',false).order('sort_order'):Promise.resolve({data:[],error:null}),
    project&&window.MINDS_WORK_TEAM?.members?window.MINDS_WORK_TEAM.members(project.id):Promise.resolve([])
  ]);
  if(buckets.error)throw buckets.error;
  return {projects,categories,buckets:buckets.data||[],people,project};
}
function errView(message){
  app()?.openModal?.('Aufgabe','<div class="minds-task-detail-error">'+E(message)+'</div>');
}
async function open(opts={}){
  const ticket=++generation;
  app()?.openModal?.('Aufgabe','<div class="minds-task-loading">Lade Aufgabe …</div>');
  if(!sb){errView('Keine Verbindung. Bitte Internet prüfen und die Aufgabe erneut öffnen.');return}
  let task=null;
  try{
    const auth=await sb.auth.getSession();
    if(!auth.data?.session)throw new Error('Zum Bearbeiten bitte anmelden.');
    if(opts.taskId||opts.clientKey)task=await readTask(opts);
    const state=app()?.getState?.()||{};
    let projectId=task?.project_id||opts.projectId||null;
    if(!projectId&&opts.projectKey){
      const project=(state.projects||[]).find(x=>x.id===opts.projectKey);
      const key=project?.id||opts.projectKey;
      const found=await sb.from('isabella_projects').select('id').eq('client_key',key).maybeSingle();
      if(found.error)throw found.error;
      projectId=found.data?.id||null;
    }
    let choices=await readChoices(projectId);
    if(ticket!==generation)return;
    if(!projectId&&task)projectId=task.project_id;
    const categoryKey=opts.categoryKey||(HIDE_CATEGORY?'arbeit':null);
    const categoryId=task?.category_id||choices.categories.find(c=>c.client_key===categoryKey)?.id||null;
    const teamData=task&&window.MINDS_TASK_TEAM?.read?await window.MINDS_TASK_TEAM.read(task.id,task.assignee_person_id):{ids:[],allocations:[]};
    const ctx={ticket,task,projectId,categoryId,choices,opts,queue:Promise.resolve(),blocked:false,
      draft:!task&&opts.draft?{...opts.draft}:null,
      // One key per new task: a second tap or a retry after a lost answer finds the same row instead of a copy.
      clientKey:task?null:uid(),
      teamIds:teamData.ids.length?teamData.ids:(task?.assignee_person_id?[task.assignee_person_id]:[]),
      allocations:teamData.allocations};
    render(ctx);
  }catch(error){if(ticket===generation)errView(error?.message||error)}
}
function render(ctx){
  if(ctx.ticket!==generation)return;
  // A new task keeps what was already typed (draft) when the form is drawn again, e.g. after choosing a project.
  const t=ctx.task||ctx.draft||{},choices=ctx.choices;
  const person=t.assignee_person_id||'',legacy=t.assignee&&!person;
  const statusValue=t.work_status||'not_started',priority=t.priority||'normal';
  const projectOptions=selectOption('','Ohne Projekt',t.project_id||ctx.projectId)+
    choices.projects.map(p=>selectOption(p.id,p.name,t.project_id||ctx.projectId)).join('');
  const categoryOptions=selectOption('','Ohne Kategorie',t.category_id||ctx.categoryId)+
    choices.categories.map(c=>selectOption(c.id,c.name,t.category_id||ctx.categoryId)).join('');
  const bucketOptions=selectOption('','Ohne Bucket',t.work_bucket_id||ctx.opts.bucketId)+
    choices.buckets.map(b=>selectOption(b.id,b.name,t.work_bucket_id||ctx.opts.bucketId)).join('');
  const peopleOptions=selectOption('','Ohne Verantwortliche',person)+
    choices.people.map(p=>selectOption(p.id,p.name,person)).join('')+
    (legacy?selectOption('__legacy__','Frühere Zuweisung · '+t.assignee,'__legacy__'):'');
  const checklist=yes(t.checklist),attachments=yes(t.attachments),links=yes(t.links);
  const officeInfo=HIDE_CATEGORY?(t.metadata?.office_planner||{}):{};
  const checks=checklist.map(c=>checkRow(c)).join('');
  const attachmentsHtml=attachments.map(a=>'<div class="minds-task-attachment"><button type="button" data-task-attachment="'+E(a.path||'')+'">'+E(a.name||'Anhang')+'</button></div>').join('');
  const linksHtml=links.map((l,i)=>'<div class="minds-task-link"><a target="_blank" rel="noopener noreferrer" href="'+
    (String(l.url||'').match(/^https?:\/\//i)?E(l.url):'#')+'">'+E(l.title||l.url||'Link')+'</a>'+
    '<button type="button" data-task-link-remove="'+i+'" title="Link entfernen">×</button></div>').join('');
  const estimate=Number(t.metadata?.planning?.estimated_minutes||0);
  // New from the calendar: the complete form at once, and one tap to make it a Termin instead.
  const kindSwitch=!ctx.task&&typeof ctx.opts.onSwitchKind==='function'
    ?'<div class="minds-new-kind" role="group" aria-label="Art"><button type="button" class="is-active" aria-pressed="true">Aufgabe</button>'+
      '<button type="button" id="taskDetailToEvent" aria-pressed="false">Termin</button></div>':'';
  const body='<div class="minds-task-detail" data-task-detail>'+kindSwitch+
    '<header class="minds-task-detail-top"><button type="button" class="minds-task-complete'+(t.completed_at?' is-done':'')+'" id="taskDetailComplete" aria-pressed="'+!!t.completed_at+'" aria-label="'+(t.completed_at?'Aufgabe wieder öffnen':'Als erledigt markieren')+'">'+
    (t.completed_at?'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12 4 4 10-10"/></svg>':'')+'</button><input id="taskDetailTitle" aria-label="Titel" placeholder="Titel der Aufgabe" value="'+E(t.title||ctx.opts.title||'')+'">'+
    '<button class="minds-task-more" type="button" id="taskDetailMore" aria-label="Aufgabenoptionen">···</button></header>'+
    '<div id="taskDetailMenu" class="minds-task-menu hidden">'+
    '<button type="button" data-task-action="archive">Archivieren</button>'+
    '<button type="button" data-task-action="delete" class="danger-text">Endgültig löschen …</button></div>'+
    '<div class="minds-task-fields">'+
    '<label>Projekt<select id="taskDetailProject">'+projectOptions+'</select></label>'+
    '<label>Bucket<select id="taskDetailBucket">'+bucketOptions+'</select></label>'+
    '<label>Beginn<input type="date" id="taskDetailStart" value="'+E(t.start_date||ctx.opts.startDate||'')+'"></label>'+
    '<label>Fällig<input type="date" id="taskDetailDue" value="'+E(t.due_date||ctx.opts.date||'')+'"></label>'+
    '<div class="minds-task-team-field"><span>Verantwortlich</span>'+window.MINDS_TASK_TEAM.selectorHtml(ctx)+'</div>'+
    '<label>Status<select id="taskDetailWorkStatus">'+
    [['not_started','Nicht begonnen'],['in_progress','In Bearbeitung'],['waiting','Warten'],['completed','Erledigt']]
      .map(([id,name])=>selectOption(id,name,statusValue)).join('')+'</select></label>'+
    '<label>Priorität<select id="taskDetailPriority">'+
    [['low','Niedrig'],['normal','Normal'],['important','Wichtig'],['urgent','Dringend']]
      .map(([id,name])=>selectOption(id,name,priority)).join('')+'</select></label>'+
    (HIDE_CATEGORY?'':'<label>Kategorie<select id="taskDetailCategory">'+categoryOptions+'</select></label>')+
    '<label>Geschätzte Zeit (min)<input id="taskDetailEstimate" type="number" min="0" max="43200" step="15" value="'+(estimate||'')+'" placeholder="Keine Schätzung"></label>'+
    '<label>Erinnerung<input id="taskDetailReminder" type="time" value="'+E(String(t.reminder_time||'').slice(0,5))+'"></label>'+
    '</div>'+
    '<label class="minds-task-long-field">Labels<input id="taskDetailLabels" value="'+E(yes(t.labels).join(', '))+'" placeholder="TGA, Bauherr, Freigabe"></label>'+
    '<label class="minds-task-long-field">Notizen<textarea id="taskDetailNotes" rows="3" placeholder="Notizen hinzufügen">'+E(t.notes||'')+'</textarea></label>'+
    (HIDE_CATEGORY?'<div class="minds-task-office-context">'+
      '<div class="minds-task-office-refs"><label>Aufgabe / Kennung<input id="taskDetailTaskCode" maxlength="100" placeholder="z. B. L3-ENT-01" value="'+E(officeInfo.task_code||'')+'"></label>'+
      '<label>Terminplan PSP<input id="taskDetailPSP" maxlength="180" placeholder="z. B. 01.01" value="'+E(officeInfo.terminplan_psp||'')+'"></label></div>'+
      '<label class="minds-task-long-field">Prüfbares Arbeitsergebnis<textarea id="taskDetailWorkResult" rows="2" placeholder="Welches konkrete Ergebnis muss die Aufgabe liefern?">'+E(officeInfo.work_result||'')+'</textarea></label>'+
      '<label class="minds-task-long-field">Fachliche Einordnung<textarea id="taskDetailProfessionalContext" rows="3" placeholder="Fachliche Grundlage, Grenzen und Schnittstellen">'+E(officeInfo.professional_context||'')+'</textarea></label>'+
      (officeInfo.applicability?'<div class="minds-task-office-applicability">Anwendbarkeit: '+E(officeInfo.applicability)+'</div>':'')+
    '</div>':'')+
    '<div class="minds-task-section"><div class="minds-task-section-head"><strong>Checklist</strong><span>'+checklist.filter(c=>c.done).length+'/'+checklist.length+'</span></div>'+
    '<div id="taskDetailChecks">'+checks+'</div><button type="button" class="minds-task-inline-add" id="taskDetailAddCheck">＋ Schritt hinzufügen</button></div>'+
    '<div class="minds-task-section"><div class="minds-task-section-head"><strong>Anhänge</strong>'+
    '<button type="button" class="minds-task-inline-add" id="taskDetailAddFile">＋ Datei hinzufügen</button></div>'+
    '<div id="taskDetailAttachments">'+(attachmentsHtml||'<span class="minds-task-muted">Keine Anhänge</span>')+'</div>'+
    '<input type="file" id="taskDetailFile" class="hidden" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"></div>'+
    '<div class="minds-task-section"><div class="minds-task-section-head"><strong>Links</strong>'+
    '<button type="button" class="minds-task-inline-add" id="taskDetailAddLink">＋ Link hinzufügen</button></div>'+
    '<div id="taskDetailLinks">'+linksHtml+'</div></div>'+
    window.MINDS_TASK_TEAM.allocationsHtml(ctx)+
    '<div class="minds-task-section"><div class="minds-task-section-head"><strong>Arbeitszeiten</strong>'+
    '<div class="minds-task-session-actions"><button type="button" class="minds-task-inline-add" id="taskDetailPropose">◇ Blöcke vorschlagen</button>'+ 
    '<button type="button" class="minds-task-inline-add" id="taskDetailBook">＋ Zeit reservieren</button></div></div>'+
    '<div id="taskDetailSessions"><span class="minds-task-muted">Die Reservierungen gehören zu derselben Aufgabe.</span></div></div>'+
    '<footer class="minds-task-footer"><span id="taskDetailStatus" role="status" aria-live="polite">'+
    (ctx.readOnly?'Muster · nur Ansicht · keine Änderungen am Projekt':ctx.task?'Änderungen werden automatisch gespeichert':'Felder ausfüllen und die Aufgabe anlegen')+'</span>'+
    (!ctx.task?'<button type="button" class="minds-task-create" id="taskDetailCreate">Aufgabe anlegen</button>':'')+
    '<button type="button" class="minds-task-reload hidden" id="taskDetailReload">Aktuelle Version laden</button></footer></div>';
  app()?.openModal?.(ctx.readOnly?'Muster-Aufgabe':ctx.task?'Aufgabe':'Neue Aufgabe',body);
  if(ctx.readOnly){
    const host=$('[data-task-detail]');
    host?.classList.add('is-muster-readonly');
    host?.querySelectorAll('input,textarea,select,button').forEach(el=>{el.disabled=true;});
    host?.querySelector('#taskDetailMenu')?.classList.add('hidden');
    return; // No autoguardado, Upload, Checklistenänderung, Archiv oder Zeitplanung.
  }
  bind(ctx);
  if(ctx.task)void loadSessions(ctx);
}
function checkRow(c){
  return '<div class="minds-task-check-row" data-task-check-id="'+E(c.id||uid())+'">'+
    '<input type="checkbox" data-task-check-done aria-label="Schritt erledigt" '+(c.done?'checked':'')+'>'+
    '<input type="text" data-task-check-text placeholder="Schritt hinzufügen …" value="'+E(c.text||'')+'">'+
    '<button type="button" data-task-check-remove title="Schritt entfernen">×</button></div>';
}
function bind(ctx){
  const field=(name,make)=>{const node=$(name);if(!node)return;
    node.addEventListener('change',()=>{void update(ctx,make(node.value))});
  };
  const blur=(name,make)=>{const node=$(name);if(!node)return;
    node.addEventListener('blur',()=>{void update(ctx,make(node.value))});
  };
  const dates=()=>datesValid($('#taskDetailStart').value,$('#taskDetailDue').value);
  const validDate=(make)=>value=>{
    if(!dates()){status('Der Beginn muss vor oder am Fälligkeitstag liegen.',true);return null}
    return make(value);
  };
  $('#taskDetailToEvent')?.addEventListener('click',()=>{
    const d=readDraft(),project=ctx.choices.projects.find(p=>p.id===($('#taskDetailProject')?.value||''));
    ctx.opts.onSwitchKind({title:d.title,date:d.due_date||d.start_date||ctx.opts.date||null,
      projectKey:project?.client_key||null,notes:d.notes,categoryKey:ctx.choices.categories.find(c=>c.id===d.category_id)?.client_key||null});
  });
  blur('#taskDetailTitle',value=>({title:value.trim()}));
  blur('#taskDetailNotes',value=>({notes:value}));
  // Keep professional results and Terminplan references in existing task metadata.
  // A deferred patch is computed against the latest saved metadata to avoid lost
  // edits when a user tabs quickly across the four optional fields.
  if(HIDE_CATEGORY){
    const officeMeta=()=>{
      const current=ctx.task?.metadata||ctx.draft?.metadata||{};
      return {metadata:{...current,office_planner:{
        ...(current.office_planner||{}),
        task_code:$('#taskDetailTaskCode')?.value.trim()||'',
        terminplan_psp:$('#taskDetailPSP')?.value.trim()||'',
        work_result:$('#taskDetailWorkResult')?.value.trim()||'',
        professional_context:$('#taskDetailProfessionalContext')?.value.trim()||''
      }}};
    };
    ['#taskDetailTaskCode','#taskDetailPSP','#taskDetailWorkResult','#taskDetailProfessionalContext'].forEach(selector=>{
      $(selector)?.addEventListener('blur',()=>{void update(ctx,officeMeta)});
    });
  }
  blur('#taskDetailLabels',value=>({labels:value.split(',').map(s=>s.trim()).filter(Boolean)}));
  field('#taskDetailStart',validDate(value=>({start_date:value||null})));
  field('#taskDetailDue',validDate(value=>({due_date:value||null})));
  field('#taskDetailBucket',value=>({work_bucket_id:value||null}));
  field('#taskDetailPriority',value=>({priority:value}));
  field('#taskDetailCategory',value=>({category_id:value||null}));
  field('#taskDetailReminder',value=>({reminder_time:$('#taskDetailDue').value?(value||null):null}));
  field('#taskDetailEstimate',value=>{
    const n=value===''?0:Number(value);
    if(!Number.isInteger(n)||n<0||n>43200){status('Schätzung außerhalb des zulässigen Bereichs.',true);return null}
    return {metadata:{...(ctx.task?.metadata||{}),planning:{...(ctx.task?.metadata?.planning||{}),estimated_minutes:n}}};
  });
  field('#taskDetailWorkStatus',value=>({work_status:value,completed_at:value==='completed'?(ctx.task?.completed_at||new Date().toISOString()):null}));
  field('#taskDetailProject',value=>{void changeProject(ctx,value||null);return null});
  $('#taskDetailComplete').onclick=()=>void update(ctx,{completed_at:ctx.task?.completed_at?null:new Date().toISOString(),
    work_status:ctx.task?.completed_at?'not_started':'completed'},true);
  $('#taskDetailMore').onclick=()=>$('#taskDetailMenu').classList.toggle('hidden');
  $$('[data-task-action]').forEach(b=>b.onclick=()=>void doAction(ctx,b.dataset.taskAction));
  $('#taskDetailReload').onclick=()=>void open(ctx.task?{taskId:ctx.task.id}:ctx.opts);
  $('#taskDetailAddCheck').onclick=()=>{const list=$('#taskDetailChecks');list.insertAdjacentHTML('beforeend',checkRow({id:uid(),text:'',done:false}));
    list.lastElementChild.querySelector('[data-task-check-text]')?.focus()};
  $('#taskDetailChecks').addEventListener('change',event=>{if(event.target.matches('[data-task-check-done]'))void updateChecks(ctx)});
  $('#taskDetailChecks').addEventListener('focusout',event=>{if(event.target.matches('[data-task-check-text]'))void updateChecks(ctx)});
  $('#taskDetailChecks').addEventListener('click',event=>{
    const button=event.target.closest('[data-task-check-remove]');
    if(!button)return;button.closest('.minds-task-check-row')?.remove();void updateChecks(ctx);
  });
  $('#taskDetailAddFile').onclick=()=>$('#taskDetailFile').click();
  $('#taskDetailFile').onchange=event=>{void uploadFiles(ctx,[...(event.target.files||[])]);event.target.value=''};
  $('#taskDetailAttachments').addEventListener('click',event=>{
    const btn=event.target.closest('[data-task-attachment]');if(btn)void openAttachment(btn.dataset.taskAttachment);
  });
  $('#taskDetailAddLink').onclick=()=>{
    const url=window.prompt('Link-Adresse (https://)');
    if(!url)return;
    if(!/^https?:\/\/\S+$/i.test(url)){status('Ungültige Adresse.',true);return}
    void update(ctx,{links:[...yes(ctx.task?.links),{url}]},true);
  };
  $('#taskDetailLinks').addEventListener('click',event=>{
    const b=event.target.closest('[data-task-link-remove]');if(!b)return;
    void update(ctx,{links:yes(ctx.task?.links).filter((_,i)=>i!==Number(b.dataset.taskLinkRemove))},true);
  });
  $('#taskDetailPropose').onclick=async()=>{
    if(!ctx.task){status('Bitte die Aufgabe zuerst anlegen.',true);return}
    await ctx.queue;
    if(ctx.blocked){status('Es gibt unbestätigte Änderungen. Bitte die Aufgabe vor dem Planen neu laden.',true);return}
    if(!window.MINDS_TIME_PLANNING?.open){status('Die Planung ist nicht verfügbar.',true);return}
    await window.MINDS_TIME_PLANNING.open({taskId:ctx.task.id});
  };
  $('#taskDetailBook').onclick=()=>{
    if(!ctx.task){status('Bitte die Aufgabe zuerst anlegen.',true);return}
    const key=ctx.task.client_key||ctx.task.id;
    if(!app()?.planTaskSession?.(key))status('Bitte die Aufgabe vor dem Reservieren synchronisieren.',true);
  };
  window.MINDS_TASK_TEAM?.bind?.(ctx);
  if(!ctx.task)$('#taskDetailCreate').onclick=()=>void createTask(ctx);
}
function collectChecks(){
  return $$('#taskDetailChecks [data-task-check-id]').map(row=>({
    id:row.dataset.taskCheckId,text:row.querySelector('[data-task-check-text]')?.value.trim()||'',
    done:!!row.querySelector('[data-task-check-done]')?.checked
  })).filter(c=>c.text);
}
function updateChecks(ctx){return update(ctx,{checklist:collectChecks()})}
async function perform(ctx,patch,rerender=false){
  if(ctx.blocked||ctx.ticket!==generation)return;
  if(!ctx.task){status('Bitte die Aufgabe zuerst anlegen.',true);return}
  try{
    const newer=new Date(Date.now()+1).toISOString();
    const {data,error}=await sb.from('isabella_tasks')
      .update({...patch,updated_at:newer})
      .eq('id',ctx.task.id).eq('updated_at',ctx.task.updated_at)
      .select('*').maybeSingle();
    if(error)throw error;
    if(!data){ctx.blocked=true;status('Konflikt: Die Aufgabe wurde an anderer Stelle geändert. Bitte neu laden, um nichts zu überschreiben.',true);
      $('#taskDetailReload')?.classList.remove('hidden');return}
    ctx.task=data;status('Gespeichert');
    if(rerender)render(ctx);
    void app()?.refresh?.();
    void window.ISABELLA_SYNC_PULL_NOW?.().catch(()=>{});
    if(typeof ctx.opts.onUpdated==='function')void Promise.resolve(ctx.opts.onUpdated()).catch(()=>{});
  }catch(error){ctx.blocked=true;fail(error);$('#taskDetailReload')?.classList.remove('hidden')}
}
function update(ctx,patch,rerender=false){
  if(!patch)return Promise.resolve();
  if(!ctx.task){status('Bitte die Aufgabe zuerst anlegen.',true);return Promise.resolve()}
  if(ctx.blocked){status('Bearbeitung angehalten: bitte den Fehler prüfen und neu laden.',true);return Promise.resolve()}
  const changes=()=>typeof patch==='function'?patch():patch;
  ctx.queue=ctx.queue.then(async()=>{
    if(ctx.blocked||ctx.ticket!==generation)return;
    const current=changes();
    if(!current||!Object.keys(current).length)return;
    const changed=Object.entries(current).filter(([k,v])=>JSON.stringify(ctx.task[k])!==JSON.stringify(v));
    if(!changed.length)return;
    status('Speichere …');
    await perform(ctx,Object.fromEntries(changed),rerender);
  });
  return ctx.queue;
}
async function changeProject(ctx,id){
  if(ctx.task&&ctx.allocations?.length){
    render(ctx);
    status('Vor dem Projektwechsel bitte die geplanten Teamtage entfernen.',true);
    return;
  }
  if(!ctx.task){
    ctx.draft=readDraft();if(ctx.draft.category_id!==undefined)ctx.categoryId=ctx.draft.category_id;
    ctx.projectId=id;ctx.opts.projectId=id;ctx.opts.bucketId=null;ctx.choices=await readChoices(id);
    if(ctx.ticket===generation)render(ctx);return;
  }
  await update(ctx,{project_id:id,assignee_person_id:null,assignee:null,work_bucket_id:null});
  if(ctx.blocked)return;
  ctx.projectId=id;ctx.opts.bucketId=null;ctx.choices=await readChoices(id);
  ctx.teamIds=[];ctx.allocations=[];
  if(ctx.ticket===generation)render(ctx);
}
// What is typed in a task that does not exist yet.
function readDraft(){
  const v=s=>$(s)?.value??'';
  return {title:v('#taskDetailTitle'),start_date:v('#taskDetailStart')||null,due_date:v('#taskDetailDue')||null,
    work_status:v('#taskDetailWorkStatus')||'not_started',priority:v('#taskDetailPriority')||'normal',
    category_id:$('#taskDetailCategory')?(v('#taskDetailCategory')||null):undefined,
    reminder_time:v('#taskDetailReminder')||null,labels:v('#taskDetailLabels').split(',').map(s=>s.trim()).filter(Boolean),
    notes:v('#taskDetailNotes'),checklist:$('#taskDetailChecks')?collectChecks():[],
    metadata:{planning:{estimated_minutes:Number(v('#taskDetailEstimate')||0)||0},
      ...(HIDE_CATEGORY?{office_planner:{
        task_code:v('#taskDetailTaskCode').trim(),terminplan_psp:v('#taskDetailPSP').trim(),
        work_result:v('#taskDetailWorkResult').trim(),
        professional_context:v('#taskDetailProfessionalContext').trim()
      }}:{})}};
}
async function createTask(ctx){
  const title=$('#taskDetailTitle')?.value.trim();
  if(!title){status('Bitte zuerst einen Titel eingeben.',true);return}
  if(!datesValid($('#taskDetailStart').value,$('#taskDetailDue').value)){
    status('Der Beginn muss vor oder am Fälligkeitstag liegen.',true);return;
  }
  const member=ctx.choices.people.find(p=>(ctx.teamIds||[]).includes(p.id));
  const estimate=Number($('#taskDetailEstimate').value||0);
  if(!Number.isInteger(estimate)||estimate<0||estimate>43200){status('Schätzung außerhalb des zulässigen Bereichs.',true);return}
  const projectId=$('#taskDetailProject').value||null;
  if(member&&!projectId){status('Bitte zuerst ein Projekt wählen, dann die Verantwortlichen.',true);return}
  const statusValue=$('#taskDetailWorkStatus').value;
  const categoryField=$('#taskDetailCategory');
  const row={title,project_id:projectId,category_id:categoryField?(categoryField.value||null):(ctx.categoryId||null),
    work_bucket_id:$('#taskDetailBucket').value||null,work_status:statusValue,
    priority:$('#taskDetailPriority').value,start_date:$('#taskDetailStart').value||null,
    due_date:$('#taskDetailDue').value||null,assignee_person_id:null,
    assignee:null,labels:$('#taskDetailLabels').value.split(',').map(s=>s.trim()).filter(Boolean),
    notes:$('#taskDetailNotes').value,checklist:collectChecks(),
    completed_at:statusValue==='completed'?new Date().toISOString():null,
    metadata:{planning:{estimated_minutes:estimate},
      ...(HIDE_CATEGORY?{office_planner:{
        task_code:$('#taskDetailTaskCode')?.value.trim()||'',
        terminplan_psp:$('#taskDetailPSP')?.value.trim()||'',
        work_result:$('#taskDetailWorkResult')?.value.trim()||'',
        professional_context:$('#taskDetailProfessionalContext')?.value.trim()||''
      }}:{})},reminder_time:$('#taskDetailDue').value?($('#taskDetailReminder').value||null):null,
    sort_order:0,work_sort_order:10};
  status('Lege an …');
  const button=$('#taskDetailCreate');button.disabled=true;
  try{
    row.client_key=ctx.clientKey||uid();ctx.clientKey=row.client_key;
    const owner=(await sb.auth.getSession())?.data?.session?.user?.id||null;
    const readBack=async()=>{
      let q=sb.from('isabella_tasks').select('*').eq('client_key',row.client_key);
      if(owner)q=q.eq('user_id',owner);
      const {data:found,error:readError}=await q.maybeSingle();
      if(readError)throw readError;
      return found;
    };
    let data=await readBack(),error=null;
    if(!data){
      const inserted=await sb.from('isabella_tasks').insert(row).select('*').single();
      data=inserted.data;error=inserted.error;
      if(error||!data){data=await readBack();if(data)error=null}
    }
    if(error||!data)throw error||new Error('Der Server hat die Aufgabe nicht bestätigt.');
    ctx.task=data;ctx.projectId=data.project_id;ctx.categoryId=data.category_id;
    if(ctx.teamIds?.length){
      const assigned=await sb.rpc('minds_work_set_task_assignees',{
        p_task_id:data.id,p_person_ids:ctx.teamIds,p_expected_updated_at:data.updated_at
      });
      if(assigned.error)throw assigned.error;
      const fresh=await readTask({taskId:data.id});
      ctx.task=fresh;
    }
    await app()?.refresh?.();
    void window.ISABELLA_SYNC_PULL_NOW?.().catch(()=>{});
    if(typeof ctx.opts.onUpdated==='function')void Promise.resolve(ctx.opts.onUpdated()).catch(()=>{});
    render(ctx);status('Aufgabe angelegt · Änderungen werden automatisch gespeichert');
  }catch(error){
    if(ctx.task){render(ctx);status('Die Aufgabe wurde angelegt, die Zuweisung ist aber noch nicht bestätigt: '+(error?.message||error),true)}
    else{fail(error);button.disabled=false}
  }
}
async function doAction(ctx,action){
  if(!ctx.task){status('Für diese Aktion gibt es noch keine Aufgabe.',true);return}
  $('#taskDetailMenu').classList.add('hidden');
  if(action==='archive'){
    if(!window.confirm('Diese Aufgabe archivieren? Sie kann später wiederhergestellt werden.'))return;
    await update(ctx,{archived_at:new Date().toISOString()},false);
    if(!ctx.blocked)app()?.closeModal?.();
  }else if(action==='delete'){
    if(!window.confirm('Diese Aufgabe endgültig löschen? Ihre Arbeitszeiten im Kalender werden nicht automatisch gelöscht.'))return;
    try{
      const {data,error}=await sb.from('isabella_tasks').delete().eq('id',ctx.task.id)
        .eq('updated_at',ctx.task.updated_at).select('id').maybeSingle();
      if(error||!data)throw error||new Error('Die Aufgabe wurde geändert. Bitte neu laden und erneut prüfen.');
      app()?.closeModal?.();
      if(typeof ctx.opts.onUpdated==='function')void Promise.resolve(ctx.opts.onUpdated()).catch(()=>{});
      void window.ISABELLA_SYNC_PULL_NOW?.().catch(()=>{});
    }catch(error){fail(error)}
  }
}
async function uploadFiles(ctx,files){
  if(!files.length)return;
  if(!ctx.task){status('Bitte die Aufgabe zuerst anlegen, dann Dateien anhängen.',true);return}
  const auth=await sb.auth.getSession(),userId=auth.data?.session?.user?.id;
  if(!userId){status('Nicht angemeldet.',true);return}
  const project=ctx.choices.projects.find(p=>p.id===ctx.task.project_id);
  for(const file of files){
    if(file.size>12*1024*1024){status('Die Datei ist größer als 12 MiB.',true);continue}
    const name=String(file.name||'archivo').replace(/[^a-zA-Z0-9._-]/g,'_');
    const path=userId+'/'+(project?.client_key||'personal')+'/tasks/'+ctx.task.id+'/'+uid()+'-'+name;
    status('Lade hoch: '+file.name+'…');
    const {error}=await sb.storage.from('minds-work').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
    if(error){fail(error);continue}
    await update(ctx,{attachments:[...yes(ctx.task.attachments),{id:uid(),name:file.name,path,
      mime:file.type||'application/octet-stream',size:file.size,created_at:new Date().toISOString()}]},true);
  }
}
async function openAttachment(path){
  if(!path)return;
  const {data,error}=await sb.storage.from('minds-work').createSignedUrl(path,60);
  if(error||!data?.signedUrl){fail(error||'Nicht verfügbar');return}
  window.open(data.signedUrl,'_blank','noopener,noreferrer');
}
async function loadSessions(ctx){
  const key=ctx.task?.client_key;if(!key)return;
  const {data,error}=await sb.from('isabella_events').select('client_key,title,starts_at,ends_at,metadata')
    .contains('metadata',{kind:'task_work_session_v1',task_client_key:key}).order('starts_at');
  if(error||ctx.ticket!==generation)return;
  const target=$('#taskDetailSessions');if(!target)return;
  target.innerHTML=(data||[]).map(e=>'<div class="minds-task-session">'+
    '<span>'+E(new Date(e.starts_at).toLocaleString('de-DE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+
    '</span><button type="button" data-task-session="'+E(e.client_key)+'">Bearbeiten ↗</button></div>').join('')||
    '<span class="minds-task-muted">Noch keine Reservierungen.</span>';
  target.querySelectorAll('[data-task-session]').forEach(b=>b.onclick=()=>app()?.editEventById?.(b.dataset.taskSession));
}

/** One-save task creation with authenticated canonical readback. The stable
 * client_key supports retry after a committed insert with a lost response. */
async function createQuick({title,date=null,categoryKey=null,projectKey=null,clientKey}={}){
  title=String(title||'').trim();
  if(!title)throw new Error('Bitte einen Titel eingeben.');
  if(date!=null&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+'T12:00:00Z').getTime())))
    throw new Error('Das Datum der Aufgabe ist ungültig.');
  if(typeof clientKey!=='string'||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(clientKey))
    throw new Error('Der Speicherversuch hat keine gültige Kennung.');
  if(!sb)throw new Error('Keine Verbindung. Bitte Internet prüfen und erneut versuchen.');
  const {data:auth,error:authError}=await sb.auth.getSession();
  const owner=auth?.session?.user?.id;
  if(authError||!owner)throw new Error('Zum Speichern bitte anmelden.');
  const choices=await readChoices(null);
  const category=categoryKey?choices.categories.find(c=>c.client_key===categoryKey||c.id===categoryKey):null;
  const project=projectKey?choices.projects.find(p=>p.client_key===projectKey||p.id===projectKey):null;
  if(categoryKey&&!category)throw new Error('Die Kategorie ist nicht mehr verfügbar. Bitte neu laden.');
  if(projectKey&&!project)throw new Error('Das Projekt ist nicht mehr verfügbar. Bitte neu laden.');
  const row={client_key:clientKey,title,due_date:date||null,
    category_id:category?.id||null,project_id:project?.id||null};
  const read=async()=>{
    const {data,error}=await sb.from('isabella_tasks')
      .select('id,client_key,user_id,title,due_date,category_id,project_id,updated_at')
      .eq('user_id',owner).eq('client_key',clientKey).maybeSingle();
    if(error)throw error;
    return data;
  };
  let task=await read();
  if(!task){
    const result=await sb.from('isabella_tasks').insert(row).select('id').maybeSingle();
    if(result.error){
      task=await read();
      if(!task)throw result.error;
    }else task=await read();
  }
  if(!task)throw new Error('Speichern konnte nicht bestätigt werden. Bitte erneut speichern.');
  if(task.client_key!==clientKey||task.user_id!==owner||task.title!==row.title||
     task.due_date!==row.due_date||task.category_id!==row.category_id||
     task.project_id!==row.project_id)
    throw new Error('Es gibt einen früheren Speicherstand mit anderen Daten. Die Aufgabe wurde nicht dupliziert.');
  return task;
}

// Open the SAME canonical task detail renderer with a read-only template object.
// The template never enters the task read/write, upload or allocation paths.
function preview({task,buckets=[],projectName='Muster LPH 3'}={}){
  if(!task||!task.id)return;
  const ticket=++generation;
  const ctx={ticket,task,projectId:'__muster_lph3__',categoryId:null,
    choices:{projects:[{id:'__muster_lph3__',name:projectName}],
      buckets:buckets.map(b=>({id:b.id,name:b.name})),categories:[],people:[]},
    opts:{bucketId:task.work_bucket_id},queue:Promise.resolve(),blocked:false,
    teamIds:[],allocations:[],readOnly:true};
  render(ctx);
}
window.MINDS_TASK_DETAIL={open,datesValid,createQuick,preview};
})();