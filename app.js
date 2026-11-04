(()=>{
  'use strict';
  const CFG=window.TBA_OFFICE_CONFIG,C=window.TBA_OFFICE_CORE;
  const sb=supabase.createClient(CFG.url,CFG.key,{auth:{storageKey:CFG.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  // Sessions of the previous Office backend (Bernried Project Hub) are no longer valid here.
  try{localStorage.removeItem('tba-office-auth-v1')}catch{}

  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const {esc,formatDate}=C;
  const views={auth:$('#authView'),password:$('#passwordView'),app:$('#appView')};
  let member=null,user=null,templates=[],instances=[],projects=[],members=[],creating=false,passwordVoluntary=false,booting=null,currentProjectId=null,currentProjectTab='panorama';

  function showOnly(name){for(const [k,el] of Object.entries(views))el.hidden=k!==name}
  // One view at a time; the sidebar marks its lens (Work holds the project pages, Tools the Muster).
  const LENS_OF={kalender:'kalender',work:'work',project:'work',tools:'tools',plans:'tools',members:null};
  function switchView(name,{id=null,tab='panorama',push=true}={}){
    if(name==='members'&&member?.role!=='admin')name='work';
    if(name==='project'&&!projects.some(p=>p.id===id))name='work';
    $$('.view').forEach(v=>v.hidden=true);
    $$('.lens-nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===LENS_OF[name]));
    ($('#'+name+'View')||$('#workView')).hidden=false;
    closeAccountMenu();
    if(name==='project'){currentProjectId=id;renderProjectPage();showProjectTab(tab)}
    if(name==='kalender')window.TBA_PLANNER?.openKalender();
    if(name==='members')void loadMembers();
    const hash=C.hashFor(name,id,name==='project'?tab:null);
    if(push&&location.hash!==hash)history.pushState(null,'',hash);
    window.scrollTo(0,0);
  }
  function routeFromHash(){const r=C.viewFromHash(location.hash);switchView(r.view,{id:r.id,tab:r.tab||'panorama',push:false})}
  // Project page: Panorama (facts and Terminpläne) and Planner (buckets and tasks).
  function showProjectTab(tab){
    currentProjectTab=tab==='planner'?'planner':'panorama';
    $$('[data-project-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.projectTab===currentProjectTab)));
    $('#projectPanorama').hidden=currentProjectTab!=='panorama';
    $('#projectPlanner').hidden=currentProjectTab!=='planner';
    $('#projectNewPlanBtn').hidden=currentProjectTab!=='panorama'||projects.find(p=>p.id===currentProjectId)?.status!=='aktiv';
    if(currentProjectTab==='planner')window.TBA_PLANNER?.openProject(currentProjectId);
  }
  $$('[data-project-tab]').forEach(b=>b.onclick=()=>{
    showProjectTab(b.dataset.projectTab);
    const hash=C.hashFor('project',currentProjectId,currentProjectTab);
    if(location.hash!==hash)history.pushState(null,'',hash);
  });
  window.addEventListener('popstate',routeFromHash);

  async function ownMembership(uid){
    const {data,error}=await sb.from('office_members')
      .select('user_id,email,display_name,role,is_active,must_change_password')
      .eq('user_id',uid).eq('is_active',true).maybeSingle();
    if(error)throw error;
    return data;
  }

  async function boot(session){
    if(!session){showOnly('auth');return}
    user=session.user;
    member=await ownMembership(user.id);
    if(!member){
      await sb.auth.signOut();
      showOnly('auth');
      $('#loginMessage').textContent='Für dieses Konto ist kein Office-Zugang freigeschaltet.';
      return;
    }
    if(member.must_change_password){openPassword(false);return}
    showOnly('app');
    $('#memberName').textContent=member.display_name||user.email||'TBA';
    $('#memberRoleLabel').textContent=C.ROLE_LABELS[member.role]||'';
    $('#memberInitials').textContent=C.initials(member.display_name||user.email);
    $$('[data-admin-only]').forEach(el=>el.hidden=member.role!=='admin');
    $$('[data-lead-only]').forEach(el=>el.hidden=!C.canLead(member.role));
    await loadData();
    routeFromHash();
  }
  // onAuthStateChange and getSession may both fire at start: boot once at a time.
  function bootSafely(session){
    booting=(booting||Promise.resolve()).then(()=>boot(session)).catch(err=>{
      console.error(err);showOnly('auth');
      $('#loginMessage').textContent='Office konnte nicht geladen werden.';
    });
    return booting;
  }

  async function loadData(){
    const [tplRes,planRes,projRes,memRes]=await Promise.all([
      sb.from('office_terminplan_templates').select('id,phase,title,description,version,status,state,updated_at').eq('is_active',true).order('phase'),
      sb.from('office_terminplan_instances').select('id,project_id,project_number,project_name,phase,template_version,owner_id,state,updated_at').eq('is_archived',false).order('updated_at',{ascending:false}),
      sb.from('office_projects').select('id,number,name,status,projektleiter_id').order('number'),
      sb.from('office_members').select('user_id,display_name,role,is_active').eq('is_active',true).order('display_name')
    ]);
    for(const r of [tplRes,planRes,projRes,memRes])if(r.error)throw r.error;
    templates=tplRes.data||[];instances=planRes.data||[];projects=projRes.data||[];members=memRes.data||[];
    renderTemplates();renderPlans();renderProjects();
    if(currentProjectId&&!$('#projectView').hidden)renderProjectPage();
  }
  const memberName=id=>members.find(m=>m.user_id===id)?.display_name||'—';

  function renderTemplates(){
    const host=$('#templateGrid');host.innerHTML='';
    if(!templates.length){host.innerHTML='<div class="empty">Noch keine Muster-Terminpläne hinterlegt.</div>';return}
    for(const tpl of templates){
      const card=document.createElement('article');card.className='template-card';
      card.className='card template-card';
      card.innerHTML=`<div class="top"><div><p class="eyebrow">${esc(tpl.phase)} · Version ${esc(tpl.version)}</p><h3>${esc(tpl.title)}</h3></div><span class="pill ${tpl.status==='Office Standard'?'is-blue':''}">${esc(tpl.status||'Muster')}</span></div>
        <p>${esc(tpl.description||'')}</p>
        <div class="template-actions"><button type="button" data-preview>Vorschau</button><button type="button" class="primary" data-create>Terminplan erstellen</button></div>`;
      card.querySelector('[data-preview]').onclick=()=>location.href='./terminplan.html?template='+encodeURIComponent(tpl.id);
      card.querySelector('[data-create]').onclick=()=>openCreate(tpl.phase);
      host.append(card);
    }
  }
  function planRow(p,{withProject=true}={}){
    const row=document.createElement('button');row.type='button';row.className='row';
    const stand=p.state?.project?.standDate||p.updated_at?.slice(0,10);
    const next=C.nextMilestone(p.state,C.todayKey());
    const title=withProject?`${esc(p.project_number||'—')} · ${esc(p.project_name)}`:esc(p.phase.replace('LPH','LPH '));
    const sub=[withProject?esc(p.phase.replace('LPH','LPH ')):'', 'Stand '+esc(formatDate(stand)),
      next?'Nächster Meilenstein: '+esc(next.name||'')+' · '+esc(formatDate(next.start)):''].filter(Boolean).join(' · ');
    row.innerHTML=`<span><div class="row-title">${title}</div><div class="row-sub">${sub}</div></span><span class="row-side">${esc(memberName(p.owner_id))}<span class="chevron" aria-hidden="true">›</span></span>`;
    row.onclick=()=>location.href='./terminplan.html?id='+encodeURIComponent(p.id);
    return row;
  }
  function renderPlans(){
    const host=$('#planList');$('#planCount').textContent=String(instances.length);host.innerHTML='';host.className=instances.length?'card row-list':'';
    if(!instances.length){host.innerHTML='<div class="empty">Noch keine Projektterminpläne. Erstelle den ersten aus einem Muster.</div>';return}
    for(const p of instances)host.append(planRow(p));
  }
  const planWord=n=>n+' '+(n===1?'Terminplan':'Terminpläne');
  function renderProjects(){
    const host=$('#projectList');host.innerHTML='';host.className=projects.length?'project-grid':'';
    if(!projects.length){host.innerHTML='<div class="empty">Noch keine Projekte. '+(C.canLead(member.role)?'Lege das erste mit „+ Neues Projekt“ an.':'Projektleiter oder Administration legen Projekte an.')+'</div>';return}
    for(const p of projects){
      const plans=instances.filter(i=>i.project_id===p.id).length;
      const card=document.createElement('button');card.type='button';card.className='project-card';
      card.innerHTML=`<p class="eyebrow">${esc(p.number)}</p><h3>${esc(p.name)}</h3>
        <span class="meta"><span>Projektleitung: ${esc(memberName(p.projektleiter_id))}</span><span>${planWord(plans)}</span></span>
        <span class="pill ${p.status==='aktiv'?'is-green':''}">${esc(p.status)}</span>`;
      card.onclick=()=>switchView('project',{id:p.id});
      host.append(card);
    }
  }
  function renderProjectPage(){
    const p=projects.find(x=>x.id===currentProjectId);if(!p)return;
    const plans=instances.filter(i=>i.project_id===p.id);
    $('#projectNumberLabel').textContent='Projekt '+p.number;
    $('#projectTitle').textContent=p.name;
    $('#projectFacts').innerHTML=`<div><p class="eyebrow">Projektleitung</p><strong>${esc(memberName(p.projektleiter_id))}</strong></div>
      <div><p class="eyebrow">Status</p><strong>${esc(p.status)}</strong></div>
      <div><p class="eyebrow">Terminpläne</p><strong>${plans.length}</strong></div>`;
    $('#projectPlanCount').textContent=planWord(plans.length);
    $('#projectNewPlanBtn').hidden=p.status!=='aktiv'||currentProjectTab!=='panorama';
    const host=$('#projectPlanList');host.innerHTML='';host.className=plans.length?'card row-list':'';
    if(!plans.length){host.innerHTML='<div class="empty">Noch kein Terminplan für dieses Projekt. Mit „+ Terminplan“ aus einem Office-Muster anlegen.</div>';return}
    for(const plan of plans)host.append(planRow(plan,{withProject:false}));
  }

  // ── Terminplan from a Muster, always attached to an Office project ──────
  function fillProjectSelect(selectedId=''){
    const sel=$('#projectSelect');
    const lead=C.canLead(member.role);
    sel.innerHTML=(projects.length?'':'<option value="" disabled selected>Noch keine Projekte</option>')+
      projects.filter(p=>p.status==='aktiv').map(p=>`<option value="${esc(p.id)}">${esc(p.number)} · ${esc(p.name)}</option>`).join('')+
      (lead?'<option value="__new">+ Neues Projekt anlegen …</option>':'');
    if(selectedId)sel.value=selectedId;
    else if(!projects.length&&lead)sel.value='__new';
    toggleNewProjectFields();
  }
  function toggleNewProjectFields(){
    const isNew=$('#projectSelect').value==='__new';
    $$('[data-new-project]').forEach(el=>el.hidden=!isNew);
    $('#projectNumber').required=isNew;$('#projectName').required=isNew;
  }
  function openCreate(phase='LPH3',projectId=''){
    $('#phase').value=phase;$('#projectStart').value=C.todayKey();
    $('#projectNumber').value='';$('#projectName').value='';$('#createMessage').textContent='';
    fillProjectSelect(projectId);
    if(!projects.length&&!C.canLead(member.role))$('#createMessage').textContent='Ein Projektleiter oder die Administration muss das Projekt zuerst anlegen.';
    $('#createDialog').showModal();
  }
  async function createProject(number,name,leadId){
    const {data,error}=await sb.from('office_projects').insert({number,name,projektleiter_id:leadId||null}).select('id,number,name,status,projektleiter_id').single();
    if(error){
      if(String(error.code)==='23505')throw new Error('Diese Projektnummer gibt es schon.');
      throw new Error('Das Projekt konnte nicht angelegt werden.');
    }
    projects.push(data);projects.sort((a,b)=>a.number.localeCompare(b.number,'de'));
    return data;
  }

  $('#createForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const msg=$('#createMessage');msg.textContent='';
    const phase=$('#phase').value,start=$('#projectStart').value;
    const tpl=templates.find(t=>t.phase===phase);
    if(!tpl){msg.textContent='Für diese Leistungsphase ist kein aktives Muster verfügbar.';return}
    if(!start)return;
    if(C.isWeekend(C.parseDate(start))){msg.textContent='Bitte einen Werktag als Projektstart wählen.';return}
    if(creating)return;creating=true;
    const submit=e.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;
    try{
      let project=projects.find(p=>p.id===$('#projectSelect').value);
      if($('#projectSelect').value==='__new'){
        const number=$('#projectNumber').value.trim(),name=$('#projectName').value.trim();
        if(!number||!name){msg.textContent='Bitte Projektnummer und Projektname angeben.';return}
        project=await createProject(number,name,member.role==='projektleiter'?user.id:null);
      }
      if(!project){msg.textContent='Bitte ein Projekt wählen.';return}
      const state=C.cloneStateForProject(tpl.state,{start,number:project.number,name:project.name,phase,version:tpl.version,today:C.todayKey()});
      const {data,error}=await sb.from('office_terminplan_instances').insert({
        project_id:project.id,template_id:tpl.id,template_version:tpl.version,
        project_number:project.number,project_name:project.name,phase,owner_id:user.id,state,source:'template'
      }).select('id').single();
      if(error)throw error;
      location.href='./terminplan.html?id='+encodeURIComponent(data.id);
    }catch(error){
      console.error(error);
      msg.textContent=error?.message&&!error.code?error.message:'Terminplan konnte nicht erstellt werden.';
    }finally{creating=false;submit.disabled=false}
  });
  $('#projectSelect').addEventListener('change',toggleNewProjectFields);

  // ── Projects ───────────────────────────────────────────────────────────
  $('#newProjectBtn').onclick=()=>{
    $('#newProjectNumber').value='';$('#newProjectName').value='';$('#projectMessage').textContent='';
    $('#newProjectLead').innerHTML='<option value="">— offen —</option>'+members.filter(m=>C.canLead(m.role))
      .map(m=>`<option value="${esc(m.user_id)}">${esc(m.display_name)}</option>`).join('');
    $('#newProjectLead').value=member.role==='projektleiter'?user.id:'';
    $('#projectDialog').showModal();
  };
  $('#projectForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const submit=e.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;
    try{
      const project=await createProject($('#newProjectNumber').value.trim(),$('#newProjectName').value.trim(),$('#newProjectLead').value);
      $('#projectDialog').close();renderProjects();switchView('project',{id:project.id});
    }catch(err){$('#projectMessage').textContent=err.message}
    finally{submit.disabled=false}
  });
  $('#cancelProject').onclick=()=>$('#projectDialog').close();

  // ── Members (admin) ──────────────────────────────────────────────────────
  async function admin(action,payload={}){
    const {data,error}=await sb.functions.invoke('office-admin',{body:{action,...payload}});
    if(error){
      let code='';
      try{code=(await error.context?.json?.())?.error||''}catch{}
      throw new Error(C.adminErrorText(code));
    }
    return data;
  }
  function showStartPassword(email,password){
    $('#startPasswordFor').textContent='Für '+email+'. Persönlich weitergeben; beim ersten Anmelden wird ein eigenes Passwort festgelegt.';
    $('#startPasswordValue').textContent=password;
    $('#startPasswordBox').hidden=false;
  }
  $('#copyStartPassword').onclick=async()=>{
    try{await navigator.clipboard.writeText($('#startPasswordValue').textContent);$('#copyStartPassword').textContent='Kopiert'}
    catch{$('#copyStartPassword').textContent='Bitte manuell kopieren'}
    setTimeout(()=>$('#copyStartPassword').textContent='Kopieren',2000);
  };
  $('#hideStartPassword').onclick=()=>{$('#startPasswordBox').hidden=true;$('#startPasswordValue').textContent=''};

  async function loadMembers(){
    if(member?.role!=='admin')return;
    const host=$('#memberList');host.innerHTML='<div class="empty">Lade Zugänge …</div>';
    try{
      const {members:list}=await admin('list');
      $('#memberCount').textContent=String(list.filter(m=>m.is_active).length);
      host.innerHTML='';
      for(const m of list){
        const row=document.createElement('div');row.className='row member-row'+(m.is_active?'':' is-inactive');
        const self=m.user_id===user.id;
        row.innerHTML=`<span><div class="row-title">${esc(m.display_name)}</div><div class="row-sub">${esc(m.email)}</div></span>
          <select data-role ${self?'disabled':''} aria-label="Rolle">${Object.entries(C.ROLE_LABELS).map(([v,l])=>`<option value="${v}" ${m.role===v?'selected':''}>${l}</option>`).join('')}</select>
          <div class="row-sub row-sub-date">${m.must_change_password?'Startpasswort aktiv':m.last_sign_in_at?'Zuletzt '+esc(formatDate(m.last_sign_in_at.slice(0,10))):'Noch nicht angemeldet'}</div>
          <button type="button" data-reset ${!m.is_active?'disabled':''}>Passwort zurücksetzen</button>
          <button type="button" data-active ${self?'disabled':''}>${m.is_active?'Deaktivieren':'Aktivieren'}</button>`;
        row.querySelector('[data-role]').onchange=async e=>{
          try{await admin('update',{user_id:m.user_id,role:e.target.value});$('#memberMessage').textContent=''}
          catch(err){$('#memberMessage').textContent=err.message;e.target.value=m.role}
        };
        row.querySelector('[data-reset]').onclick=async e=>{
          e.target.disabled=true;
          try{const r=await admin('reset_password',{user_id:m.user_id});showStartPassword(m.email,r.start_password);await loadMembers()}
          catch(err){$('#memberMessage').textContent=err.message;e.target.disabled=false}
        };
        row.querySelector('[data-active]').onclick=async e=>{
          e.target.disabled=true;
          try{await admin('update',{user_id:m.user_id,is_active:!m.is_active});await loadMembers()}
          catch(err){$('#memberMessage').textContent=err.message;e.target.disabled=false}
        };
        host.append(row);
      }
    }catch(err){host.innerHTML='<div class="empty">'+esc(err.message)+'</div>'}
  }
  $('#memberForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const submit=e.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;$('#memberMessage').textContent='';
    try{
      const email=$('#memberEmail').value.trim().toLowerCase();
      const r=await admin('create',{email,display_name:$('#memberDisplayName').value.trim(),role:$('#memberRole').value});
      showStartPassword(r.email,r.start_password);
      e.target.reset();await loadMembers();
    }catch(err){$('#memberMessage').textContent=err.message}
    finally{submit.disabled=false}
  });

  // ── Own password ─────────────────────────────────────────────────────────
  function openPassword(voluntary){
    passwordVoluntary=voluntary;
    $('#passwordTitle').textContent=voluntary?'Passwort ändern':'Eigenes Passwort festlegen';
    $('#passwordLead').textContent=voluntary?'Neues Passwort für Ihren Office-Zugang.':'Sie haben sich mit einem Startpasswort angemeldet. Legen Sie jetzt Ihr eigenes fest – nur Sie kennen es.';
    $('#passwordRule').textContent=`Mindestens ${CFG.minPasswordLength} Zeichen. Ein Satz aus mehreren Wörtern ist sicher und leicht zu merken.`;
    $('#cancelPassword').hidden=!voluntary;
    $('#passwordForm').reset();$('#passwordMessage').textContent='';
    showOnly('password');$('#newPassword').focus();
  }
  $('#passwordForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const msg=$('#passwordMessage'),pw=$('#newPassword').value;
    const problem=C.passwordProblem(pw,$('#newPasswordRepeat').value,CFG.minPasswordLength);
    if(problem){msg.textContent=problem;return}
    const submit=e.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;
    try{
      const {error}=await sb.auth.updateUser({password:pw});
      if(error){msg.textContent=C.authErrorText(error);return}
      if(member?.must_change_password){
        const {error:flagError}=await sb.rpc('office_password_changed');
        if(flagError){msg.textContent='Passwort gespeichert, aber der Status konnte nicht aktualisiert werden. Bitte neu laden.';return}
      }
      const {data}=await sb.auth.getSession();
      await bootSafely(data.session);
    }finally{submit.disabled=false}
  });
  $('#cancelPassword').onclick=()=>{if(passwordVoluntary)showOnly('app')};
  $('#changePasswordBtn').onclick=()=>{closeAccountMenu();openPassword(true)};

  // ── Sign-in ──────────────────────────────────────────────────────────────
  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    $('#loginMessage').textContent='';
    const submit=e.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;
    try{
      const {data,error}=await sb.auth.signInWithPassword({email:$('#email').value.trim().toLowerCase(),password:$('#password').value});
      if(error){$('#loginMessage').textContent='Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.';return}
      $('#password').value='';
      await bootSafely(data.session);
    }finally{submit.disabled=false}
  });

  $('#logoutBtn').onclick=async()=>{await sb.auth.signOut();location.hash='';location.reload()};
  $('#openTerminplanTool').onclick=()=>switchView('plans');
  $('#newPlanBtn').onclick=()=>openCreate('LPH3');
  $('#projectNewPlanBtn').onclick=()=>openCreate('LPH3',currentProjectId);
  $('#cancelCreate').onclick=()=>$('#createDialog').close();
  $$('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  $$('[data-go]').forEach(b=>b.onclick=()=>switchView(b.dataset.go));

  // Account menu at the foot of the sidebar: Mitglieder (admins), password, sign-out.
  function closeAccountMenu(){$('#accountMenu').hidden=true;$('#accountButton').setAttribute('aria-expanded','false')}
  $('#accountButton').onclick=e=>{
    e.stopPropagation();
    const open=$('#accountMenu').hidden;
    $('#accountMenu').hidden=!open;$('#accountButton').setAttribute('aria-expanded',String(open));
  };
  document.addEventListener('click',e=>{if(!e.target.closest('.lens-account'))closeAccountMenu()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAccountMenu()});

  // What planner.js needs from the page: the client, who is signed in, colleagues and projects.
  window.TBA_OFFICE_APP=Object.freeze({
    sb,
    get user(){return user},get member(){return member},
    get members(){return members},get projects(){return projects},
    memberName,
    leadsProject:id=>member?.role==='admin'||!!projects.find(p=>p.id===id&&p.projektleiter_id===user?.id),
    openProject:(id,tab)=>switchView('project',{id,tab})
  });
  sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT')showOnly('auth')});
  sb.auth.getSession().then(({data})=>bootSafely(data.session)).catch(console.error);
})();
