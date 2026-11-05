// Canonical Office project management inside the single authenticated Window shell.
(()=>{
'use strict';
const root=document.getElementById('projectsScreen');
if(!root)return;
const qs=s=>root.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sb=()=>window.MINDS_SUPABASE;
let busy=false,projects=[],plans=[],templates=[],members=[],userId=null,role='member';
const selectedProject=()=>new URLSearchParams(String(location.hash||'').replace(/^#/,'')).get('project');
const status=text=>{qs('#officeProjectsStatus').textContent=text||''};
function openProjects(){
  window.ISABELLA_APP?.show?.('projects');
  history.replaceState(null,'','#section=projects');
  void refresh();
}
function openWork(id){
  window.ISABELLA_APP?.show?.('work');
  history.replaceState(null,'','#section=work&project='+encodeURIComponent(id));
  setTimeout(()=>window.MINDS_WORK?.open?.(id,'overview'),0);
}
function showProjects(){
  const host=qs('#officeProjectsList');host.replaceChildren();
  const target=selectedProject();
  const visible=target?projects.filter(x=>x.id===target):projects;
  if(!visible.length){
    host.innerHTML='<p class="office-project-empty">'+(target?'Projekt nicht gefunden oder kein Zugriff.':'Noch keine Projekte vorhanden.')+'</p>';
    return;
  }
  for(const project of visible){
    const related=plans.filter(x=>x.project_id===project.id);
    const lead=members.find(x=>x.user_id===project.projektleiter_id);
    const card=document.createElement('article');card.className='office-project-card';
    const title=document.createElement('h2');title.textContent=project.name;
    const number=document.createElement('span');number.className='office-project-number';number.textContent=project.number;
    const meta=document.createElement('p');meta.className='office-project-meta';
    meta.textContent='Projektleitung: '+(lead?.display_name||'—')+' · '+(project.status==='aktiv'?'Aktiv':'Archiviert')+' · '+related.length+' Terminpläne';
    card.append(number,title,meta);
    const actions=document.createElement('div');actions.className='office-project-actions';
    const work=document.createElement('button');work.type='button';work.textContent='In Work öffnen';work.onclick=()=>openWork(project.id);actions.append(work);
    if(!target){
      const details=document.createElement('button');details.type='button';details.textContent='Terminpläne ansehen';
      details.onclick=()=>{history.replaceState(null,'','#section=projects&project='+encodeURIComponent(project.id));showProjects()};
      actions.append(details);
    }
    if(target){
      const all=document.createElement('button');all.type='button';all.textContent='Alle Projekte';
      all.onclick=()=>{history.replaceState(null,'','#section=projects');showProjects()};
      actions.append(all);
    }
    if(project.status==='aktiv'){
      const template=document.createElement('button');template.type='button';template.textContent='+ Terminplan';
      template.onclick=()=>newPlan(project);actions.append(template);
    }
    card.append(actions);
    if(target){
      const box=document.createElement('div');box.className='office-project-plans';
      if(!related.length)box.textContent='Noch kein Terminplan vorhanden.';
      for(const plan of related){
        const a=document.createElement('a');a.href='../terminplan.html?id='+encodeURIComponent(plan.id);
        a.textContent=plan.phase+' · Stand '+String(plan.updated_at||'').slice(0,10);
        box.append(a);
      }
      card.append(box);
    }
    host.append(card);
  }
}
async function refresh(){
  if(busy)return;
  if(!sb()){status('Office-Verbindung nicht verfügbar.');return}
  busy=true;status('Lade Projekte …');
  try{
    const {data:{session},error}=await sb().auth.getSession();
    if(error||!session)throw Error('Bitte im Office anmelden.');
    userId=session.user.id;
    const {data:current,error:memberError}=await sb().from('office_members')
      .select('role,is_active,must_change_password').eq('user_id',userId).maybeSingle();
    if(memberError||!current?.is_active||current.must_change_password)throw Error('Office-Berechtigung prüfen.');
    role=current.role;
    const [pr,pl,me,tp]=await Promise.all([
      sb().from('office_projects').select('id,number,name,status,projektleiter_id').order('number').limit(250),
      sb().from('office_terminplan_instances').select('id,project_id,phase,updated_at').eq('is_archived',false).limit(500),
      sb().from('office_members').select('user_id,display_name,role,is_active').eq('is_active',true).limit(250),
      sb().from('office_terminplan_templates').select('id,phase,version,state,title').eq('is_active',true).limit(50)
    ]);
    if(pr.error||pl.error||me.error||tp.error)throw Error('Projekte konnten nicht geladen werden.');
    projects=pr.data||[];plans=pl.data||[];members=me.data||[];templates=tp.data||[];
    qs('#officeProjectsNew').hidden=!['admin','projektleiter'].includes(role);
    status('');showProjects();
  }catch(error){status(error?.message||'Projekte nicht erreichbar.')}
  finally{busy=false}
}
function newPlan(project){
  const core=window.TBA_OFFICE_CORE;
  if(!core||!userId||project.status!=='aktiv'){status('Terminplan-Muster nicht verfügbar.');return}
  const available=templates.filter(x=>x.phase&&x.state);
  if(!available.length){status('Kein aktives Terminplan-Muster vorhanden.');return}
  const options=available.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.phase+' · '+(x.title||x.version))+'</option>').join('');
  window.ISABELLA_APP?.openModal?.('Neuer Terminplan',
    '<form id="officeCreatePlanForm" class="form">'+
    '<p class="small">Projekt: '+esc(project.number)+' · '+esc(project.name)+'</p>'+
    '<label>Muster<select name="template" required>'+options+'</select></label>'+
    '<label>Projektstart<input type="date" name="start" required value="'+core.todayKey()+'"></label>'+
    '<p class="small">Das Muster bleibt unverändert. Erst nach Ihrer Bestätigung wird ein Projektterminplan angelegt.</p>'+
    '<p id="officeCreatePlanError" class="small" role="alert"></p>'+
    '<button type="submit" class="primary">Terminplan anlegen</button></form>');
  const form=document.getElementById('officeCreatePlanForm');
  if(!form)return;
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const template=available.find(x=>x.id===form.elements.template.value);
    const start=form.elements.start.value;
    const error=document.getElementById('officeCreatePlanError');
    if(!template||!start||core.isWeekend(core.parseDate(start))){
      error.textContent='Bitte einen gültigen Werktag und ein Muster wählen.';return;
    }
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;
    try{
      const state=core.cloneStateForProject(template.state,{
        start,number:project.number,name:project.name,phase:template.phase,
        version:template.version,today:core.todayKey()
      });
      const {data, error:saveError}=await sb().from('office_terminplan_instances').insert({
        project_id:project.id,template_id:template.id,template_version:template.version,
        project_number:project.number,project_name:project.name,
        phase:template.phase,owner_id:userId,state,source:'template'
      }).select('id').single();
      if(saveError||!data?.id)throw Error('Terminplan konnte nicht erstellt werden.');
      window.location.assign('../terminplan.html?id='+encodeURIComponent(data.id));
    }catch(e){error.textContent=e?.message||'Terminplan konnte nicht erstellt werden.';submit.disabled=false}
  });
}
function newProject(){
  if(!['admin','projektleiter'].includes(role))return;
  const options='<option value="">— offen —</option>'+members
    .filter(x=>['admin','projektleiter'].includes(x.role))
    .map(x=>'<option value="'+esc(x.user_id)+'">'+esc(x.display_name)+'</option>').join('');
  window.ISABELLA_APP?.openModal?.('Neues Projekt',
    '<form id="officeCreateProjectForm" class="form">'+
    '<label>Projektnummer<input name="number" required maxlength="20" autocomplete="off"></label>'+
    '<label>Projektname<input name="name" required maxlength="120" autocomplete="off"></label>'+
    '<label>Projektleitung<select name="lead">'+options+'</select></label>'+
    '<p id="officeCreateProjectError" class="small" role="alert"></p>'+
    '<button type="submit" class="primary">Projekt anlegen</button></form>');
  const form=document.getElementById('officeCreateProjectForm');
  if(!form)return;
  if(role==='projektleiter')form.elements.lead.value=userId;
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const number=form.elements.number.value.trim(),name=form.elements.name.value.trim(),
      lead=form.elements.lead.value||null;
    if(!number||!name)return;
    const button=form.querySelector('[type="submit"]');button.disabled=true;
    const {data,error}=await sb().from('office_projects')
      .insert({number,name,projektleiter_id:lead}).select('id').single();
    if(error){document.getElementById('officeCreateProjectError').textContent=
      error.code==='23505'?'Diese Projektnummer ist bereits vergeben.':'Projekt konnte nicht angelegt werden. Bitte Berechtigung und Daten prüfen.';
      button.disabled=false;return;}
    window.ISABELLA_APP?.closeModal?.();
    history.replaceState(null,'','#section=projects&project='+encodeURIComponent(data.id));
    await refresh();
    window.ISABELLA_SYNC_PULL_NOW?.();
  });
}
qs('#officeProjectsNew').addEventListener('click',newProject);
qs('#officeProjectsBack').addEventListener('click',()=>{
  window.ISABELLA_APP?.show?.('tools');
  history.replaceState(null,'','#section=tools');
});
document.getElementById('officeToolsManage')?.addEventListener('click',openProjects);
document.getElementById('officeProjectsDrawer')?.addEventListener('click',event=>{
  event.preventDefault();
  document.getElementById('closeDrawer')?.click();
  openProjects();
});
window.TBA_OFFICE_PROJECTS={render:refresh,open:openProjects};
})();