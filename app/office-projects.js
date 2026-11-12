// Canonical Office project management inside the single authenticated Window shell.
(()=>{
'use strict';
const root=document.getElementById('projectsScreen');
if(!root)return;
const qs=s=>root.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sb=()=>window.MINDS_SUPABASE;
let busy=false,projects=[],plans=[],templates=[],members=[],team=[],userId=null,role='member';
const selectedProject=()=>new URLSearchParams(String(location.hash||'').replace(/^#/,'')).get('project');
const status=text=>{qs('#officeProjectsStatus').textContent=text||''};
function openProjects(){
  window.ISABELLA_APP?.show?.('projects');
  history.replaceState(null,'','#section=projects');
  void refresh();
}
function openPlans(){
  window.ISABELLA_APP?.show?.('plans');
  history.replaceState(null,'','#section=plans');
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
    const assigned=team.filter(t=>t.project_id===project.id);
    const names=assigned.map(t=>members.find(m=>m.user_id===t.user_id)?.display_name).filter(Boolean);
    const card=document.createElement('article');card.className='office-project-card';
    const title=document.createElement('h2');title.textContent=project.name;
    const number=document.createElement('span');number.className='office-project-number';number.textContent=project.number;
    const meta=document.createElement('p');meta.className='office-project-meta';
    meta.textContent='Mitglieder: '+(names.join(' · ')||'Noch keine')+' · '+(project.status==='aktiv'?'Aktiv':'Archiviert')+' · '+related.length+' Terminpläne';
    meta.classList.add('office-project-team-list');
    card.append(number,title,meta);
    const actions=document.createElement('div');actions.className='office-project-actions';
    const work=document.createElement('button');work.type='button';work.textContent='In Work öffnen';work.onclick=()=>openWork(project.id);actions.append(work);
    const people=document.createElement('button');people.type='button';people.textContent='Mitglieder';people.onclick=()=>manageMembers(project);actions.append(people);
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
function showPlans(){
  const templateHost=document.getElementById('officePlansTemplates');
  const instanceHost=document.getElementById('officePlansInstances');
  if(!templateHost||!instanceHost)return;
  templateHost.replaceChildren();instanceHost.replaceChildren();
  const available=templates.filter(t=>t.is_active!==false).sort((a,b)=>a.phase.localeCompare(b.phase));
  for(const template of available){
    const card=document.createElement('article');card.className='office-project-card office-plan-library-card';
    const number=document.createElement('span');number.className='office-project-number';number.textContent=template.phase+' · MUSTER';
    const title=document.createElement('h2');title.textContent=template.title;
    const metadata=document.createElement('p');metadata.className='office-project-meta';
    metadata.textContent='Version '+template.version+' · Originalvorlage · schreibgeschützt';
    const actions=document.createElement('div');actions.className='office-project-actions';
    const open=document.createElement('a');open.href='../terminplan.html?template='+encodeURIComponent(template.id);
    open.textContent='Muster ansehen';open.className='office-plan-library-link';
    actions.append(open);card.append(number,title,metadata,actions);templateHost.append(card);
  }
  // Versioned LPH3 Muster-Planner: a review-only master, never an extra project board.
  const plannerCard=document.createElement('article');plannerCard.className='office-project-card office-plan-library-card';
  const plannerNumber=document.createElement('span');plannerNumber.className='office-project-number';
  plannerNumber.textContent='LPH3 · MUSTER-PLANNER';
  const plannerTitle=document.createElement('h2');plannerTitle.textContent='Muster-Planner LPH 3';
  const plannerMeta=document.createElement('p');plannerMeta.className='office-project-meta';
  plannerMeta.textContent='Entwurf v0.2 · 8 Buckets · 57 TBA-Aufgaben · schreibgeschützte Vorlage';
  const plannerActions=document.createElement('div');plannerActions.className='office-project-actions';
  const plannerOpen=document.createElement('a');plannerOpen.href='../muster-planner.html';
  plannerOpen.textContent='Muster-Planner ansehen';plannerOpen.className='office-plan-library-link';
  plannerActions.append(plannerOpen);plannerCard.append(plannerNumber,plannerTitle,plannerMeta,plannerActions);
  templateHost.append(plannerCard);
  if(!available.length){const empty=document.createElement('p');empty.textContent='Keine aktiven Terminplan-Muster verfügbar.';templateHost.append(empty)}
  for(const plan of plans){
    const project=projects.find(p=>p.id===plan.project_id);
    const card=document.createElement('article');card.className='office-project-card office-plan-library-card';
    const number=document.createElement('span');number.className='office-project-number';
    number.textContent=project?project.number+' · '+plan.phase:plan.phase;
    const title=document.createElement('h2');title.textContent=project?.name||'Projektterminplan';
    const meta=document.createElement('p');meta.className='office-project-meta';
    meta.textContent='Projektterminplan · Zuletzt geändert: '+String(plan.updated_at||'').slice(0,10);
    const actions=document.createElement('div');actions.className='office-project-actions';
    const open=document.createElement('a');open.href='../terminplan.html?id='+encodeURIComponent(plan.id);
    open.textContent='Terminplan öffnen';open.className='office-plan-library-link';
    actions.append(open);card.append(number,title,meta,actions);instanceHost.append(card);
  }
  if(!plans.length){
    const empty=document.createElement('p');empty.textContent='Noch kein Projektterminplan angelegt.';instanceHost.append(empty);
  }
  const create=document.createElement('button');create.type='button';create.textContent='+ Projektterminplan erstellen';
  create.className='office-projects-new office-plan-create';
  create.onclick=()=>{
    const active=projects.filter(p=>p.status==='aktiv');
    if(!active.length){openProjects();return}
    if(active.length===1){newPlan(active[0]);return}
    const choices=active.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.number+' · '+p.name)+'</option>').join('');
    window.ISABELLA_APP?.openModal?.('Projekt wählen',
      '<form id="officeSelectPlanProject" class="form"><label>Projekt<select name="project">'+choices+
      '</select></label><button type="submit" class="primary">Weiter</button></form>');
    const form=document.getElementById('officeSelectPlanProject');
    if(form)form.onsubmit=e=>{e.preventDefault();const project=active.find(p=>p.id===form.elements.project.value);
      window.ISABELLA_APP?.closeModal?.();if(project)newPlan(project)};
  };
  instanceHost.append(create);
  const guide=document.createElement('a');
  guide.href='../terminplan-hilfe.html';
  guide.target='_blank';
  guide.rel='noopener noreferrer';
  guide.textContent='Terminplan-Handbuch · Werkzeug, LPH 3 und LPH 5';
  guide.className='office-plan-library-link';
  guide.style.display='inline-block';
  guide.style.margin='14px 0';
  instanceHost.append(guide);
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
    const [pr,pl,me,tp,pm]=await Promise.all([
      sb().from('office_projects').select('id,number,name,status,projektleiter_id').order('number').limit(250),
      sb().from('office_terminplan_instances').select('id,project_id,phase,updated_at').eq('is_archived',false).limit(500),
      sb().from('office_members').select('user_id,display_name,role,is_active,must_change_password').eq('is_active',true).eq('must_change_password',false).limit(250),
      sb().from('office_terminplan_templates').select('id,phase,version,state,title').eq('is_active',true).limit(50),
      sb().from('office_project_members').select('project_id,user_id').limit(1000)
    ]);
    if(pr.error||pl.error||me.error||tp.error||pm.error)throw (pr.error||pl.error||me.error||tp.error||pm.error);
    projects=pr.data||[];plans=pl.data||[];members=me.data||[];templates=tp.data||[];team=pm.data||[];
    qs('#officeProjectsNew').hidden=false;
    status('');showProjects();showPlans();
    const plansStatus=document.getElementById('officePlansStatus');if(plansStatus)plansStatus.textContent='';
  }catch(error){status(error?.message||'Projekte nicht erreichbar.');
    const plansStatus=document.getElementById('officePlansStatus');if(plansStatus)plansStatus.textContent=error?.message||'Terminpläne nicht erreichbar.'}
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
    '<label id="officePlanCommissioningOption"><input type="checkbox" name="fachplanerAlreadyCommissioned"> Erforderliche Fachplaner sind bereits beauftragt (Beauftragungsphase überspringen)</label>'+
    '<label id="officePlanPostIssueOption"><input type="checkbox" name="includePostIssueLPH5"> Optionale Fortschreibung nach erster LPH-5-Ausgabe mitplanen (nur bei bekanntem Ausführungs-/Vergabeablauf)</label>'+
    '<p id="officeCreatePlanPreview" class="small" aria-live="polite"></p>'+
    '<p class="small">Auch ein Startdatum in der Vergangenheit ist möglich. Die Mustertermine werden entsprechend verschoben; Fortschritte werden nicht automatisch als erledigt markiert. Bayernweite Feiertage werden berücksichtigt (lokale Feiertage später im Projektkalender ergänzen). Das Muster bleibt unverändert.</p>'+
    '<p id="officeCreatePlanError" class="small" role="alert"></p>'+
    '<button type="submit" class="primary">Terminplan anlegen</button></form>');
  const form=document.getElementById('officeCreatePlanForm');
  if(!form)return;
  const preview=document.getElementById('officeCreatePlanPreview');
  function updateCommissioningVisibility(){
    const chosen=available.find(x=>x.id===form.elements.template.value);
    const enabled=chosen?.phase==='LPH3'&&chosen?.state?.project?.scheduleModel==='network-v1';
    document.getElementById('officePlanCommissioningOption').hidden=!enabled;
    if(!enabled)form.elements.fachplanerAlreadyCommissioned.checked=false;
    const postIssue=chosen?.phase==='LPH5'&&chosen?.state?.project?.scheduleModel==='network-v1'&&
      chosen.state.tasks.some(t=>t.planningCondition==='post_issue_optional');
    document.getElementById('officePlanPostIssueOption').hidden=!postIssue;
    if(!postIssue)form.elements.includePostIssueLPH5.checked=false;
  }
  function updatePlanPreview(){
    updateCommissioningVisibility();
    const chosen=available.find(x=>x.id===form.elements.template.value);
    const start=form.elements.start.value;
    if(!chosen||!/^\d{4}-\d{2}-\d{2}$/.test(start)){
      preview.textContent='Bitte Muster und Projektstart wählen.';return;
    }
    const parsed=core.parseDate(start);
    if(!Number.isFinite(parsed.getTime())||core.isWeekend(parsed)){
      preview.textContent='Bitte einen gültigen Werktag wählen.';return;
    }
    try{
      const draft=core.cloneStateForProject(chosen.state,{
        start,number:project.number,name:project.name,phase:chosen.phase,
        version:chosen.version,today:core.todayKey(),
        fachplanerAlreadyCommissioned:form.elements.fachplanerAlreadyCommissioned.checked,
        includePostIssueLPH5:form.elements.includePostIssueLPH5.checked
      });
      preview.textContent=(draft.tasks||[]).length+' Vorgänge und Meilensteine · Voraussichtliches Ende: '+
        core.formatDate(draft.project.end)+'. Alle Termine bleiben nach dem Anlegen bearbeitbar.';
    }catch(e){preview.textContent=e?.message||'Die Vorlage kann mit diesem Datum nicht verschoben werden.';}
  }
  form.elements.template.addEventListener('change',updatePlanPreview);
  form.elements.start.addEventListener('input',updatePlanPreview);
  form.elements.fachplanerAlreadyCommissioned.addEventListener('change',updatePlanPreview);
  form.elements.includePostIssueLPH5.addEventListener('change',updatePlanPreview);
  updatePlanPreview();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const template=available.find(x=>x.id===form.elements.template.value);
    const start=form.elements.start.value;
    const error=document.getElementById('officeCreatePlanError');
    if(!template||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(core.parseDate(start).getTime())||core.isWeekend(core.parseDate(start))){
      error.textContent='Bitte einen gültigen Werktag und ein Muster wählen.';return;
    }
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;
    try{
      const state=core.cloneStateForProject(template.state,{
        start,number:project.number,name:project.name,phase:template.phase,
        version:template.version,today:core.todayKey(),
        fachplanerAlreadyCommissioned:form.elements.fachplanerAlreadyCommissioned.checked,
        includePostIssueLPH5:form.elements.includePostIssueLPH5.checked
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
function membersMarkup(selected=[]){
  const set=new Set(selected);
  return '<div class="office-project-team" role="group" aria-label="Projektmitglieder">'+
    members.map(m=>'<label><input type="checkbox" name="colleague" value="'+esc(m.user_id)+'" '+
      (set.has(m.user_id)?'checked':'')+'><span>'+esc(m.display_name)+'</span></label>').join('')+
    (members.length?'':'<p>Weitere Mitarbeiter erscheinen hier, sobald sie im Office registriert sind.</p>')+'</div>';
}
async function saveTeam(projectId,oldIds,newIds){
  const old=new Set(oldIds),next=new Set(newIds),errors=[];
  const add=[...next].filter(id=>!old.has(id)),remove=[...old].filter(id=>!next.has(id));
  if(add.length){
    const {error}=await sb().from('office_project_members').insert(add.map(id=>({project_id:projectId,user_id:id,added_by:userId})));
    if(error)errors.push(error.message);
  }
  for(const id of remove){
    const {error}=await sb().from('office_project_members').delete().eq('project_id',projectId).eq('user_id',id);
    if(error)errors.push(error.message);
  }
  if(errors.length)throw Error('Mitglieder nicht vollständig gespeichert: '+errors.join('; '));
}
function manageMembers(project,onSaved=null){
  const existing=team.filter(x=>x.project_id===project.id).map(x=>x.user_id);
  window.ISABELLA_APP?.openModal?.('Mitglieder · '+project.name,
    '<form id="officeProjectMembersForm" class="form">'+
    '<p class="small">Mehrere Mitarbeitende können zusammenarbeiten. Dies ist keine Rangliste.</p>'+
    membersMarkup(existing)+
    '<p id="officeProjectMembersError" class="small" role="alert"></p>'+
    '<button type="submit" class="primary">Mitglieder speichern</button></form>');
  const form=document.getElementById('officeProjectMembersForm');
  if(!form)return;
  form.onsubmit=async e=>{
    e.preventDefault();const b=form.querySelector('[type="submit"]');b.disabled=true;
    try{
      const chosen=[...form.querySelectorAll('input[name="colleague"]:checked')].map(x=>x.value);
      await saveTeam(project.id,existing,chosen);
      window.ISABELLA_APP?.closeModal?.();
      await refresh();
      onSaved?.();
    }catch(error){document.getElementById('officeProjectMembersError').textContent=error.message;b.disabled=false}
  };
}
function newProject(){
  window.ISABELLA_APP?.openModal?.('Neues Projekt',
    '<form id="officeCreateProjectForm" class="form">'+
    '<label>Projektnummer<input name="number" required maxlength="20" autocomplete="off"></label>'+
    '<label>Projektname<input name="name" required maxlength="120" autocomplete="off"></label>'+
    '<p class="small">Mitglieder · gemeinsam, ohne Projektleitungshierarchie</p>'+
    membersMarkup([userId])+
    '<p id="officeCreateProjectError" class="small" role="alert"></p>'+
    '<button type="submit" class="primary">Projekt anlegen</button></form>');
  const form=document.getElementById('officeCreateProjectForm');if(!form)return;
  form.onsubmit=async e=>{
    e.preventDefault();
    const number=form.elements.number.value.trim(),name=form.elements.name.value.trim();
    if(!number||!name)return;
    const chosen=new Set([userId,...[...form.querySelectorAll('input[name="colleague"]:checked')].map(x=>x.value)]);
    const button=form.querySelector('[type="submit"]');button.disabled=true;
    const {data,error}=await sb().from('office_projects').insert({
      number,name,projektleiter_id:null
    }).select('id').single();
    if(error){
      document.getElementById('officeCreateProjectError').textContent=
        error.code==='23505'?'Diese Projektnummer ist bereits vergeben.':'Projekt konnte nicht angelegt werden: '+error.message;
      button.disabled=false;return;
    }
    try{await saveTeam(data.id,[],[...chosen]);}
    catch(teamError){
      // Project remains canonical, and team can be completed via "Mitglieder" later.
      status('Projekt angelegt, aber Mitglieder müssen nachgetragen werden: '+teamError.message);
    }
    window.ISABELLA_APP?.closeModal?.();
    history.replaceState(null,'','#section=projects&project='+encodeURIComponent(data.id));
    await refresh();
    window.ISABELLA_SYNC_PULL_NOW?.();
  };
}

qs('#officeProjectsNew').addEventListener('click',newProject);
qs('#officeProjectsBack').addEventListener('click',()=>{
  window.ISABELLA_APP?.show?.('tools');
  history.replaceState(null,'','#section=tools');
});
document.getElementById('officeToolsManage')?.addEventListener('click',openProjects);
document.getElementById('officeToolsPlans')?.addEventListener('click',openPlans);
document.getElementById('officePlansBack')?.addEventListener('click',()=>{window.ISABELLA_APP?.show?.('tools');history.replaceState(null,'','#section=tools')});
document.getElementById('officePlansDrawer')?.addEventListener('click',()=>{
  document.getElementById('closeDrawer')?.click();openPlans();
});
document.getElementById('officeProjectsDrawer')?.addEventListener('click',event=>{
  event.preventDefault();
  document.getElementById('closeDrawer')?.click();
  openProjects();
});
// Work (Window's work.js) opens the same team editor and Terminplan creation, without leaving the app.
async function projectById(id){await refresh();return projects.find(x=>x.id===id)||null}
async function openTeam(id,onSaved=null){
  const project=await projectById(id);
  if(!project){status('Projekt nicht gefunden.');return}
  manageMembers(project,onSaved);
}
async function openNewPlan(id){
  const project=await projectById(id);
  if(project)newPlan(project);
}
window.TBA_OFFICE_PROJECTS={render:refresh,open:openProjects,openPlans,openTeam,openNewPlan};
})();