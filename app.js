(()=>{
  'use strict';
  const CFG=window.TBA_OFFICE_CONFIG,C=window.TBA_OFFICE_CORE;
  const sb=supabase.createClient(CFG.url,CFG.key,{auth:{storageKey:CFG.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  // Sessions of the previous Office backend (Bernried Project Hub) are no longer valid here.
  try{localStorage.removeItem('tba-office-auth-v1')}catch{}

  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const {esc,formatDate}=C;
  const views={auth:$('#authView'),password:$('#passwordView'),app:$('#appView')};
  let member=null,user=null,templates=[],instances=[],projects=[],members=[],creating=false,passwordVoluntary=false,booting=null;

  function showOnly(name){for(const [k,el] of Object.entries(views))el.hidden=k!==name}
  function switchView(name){
    $$('.view').forEach(v=>v.hidden=true);
    $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    const view=$('#'+name+'View')||$('#toolsView');
    view.hidden=false;
    if(name==='members')void loadMembers();
  }

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
    $$('[data-admin-only]').forEach(el=>el.hidden=member.role!=='admin');
    $$('[data-lead-only]').forEach(el=>el.hidden=!C.canLead(member.role));
    await loadData();
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
  }
  const memberName=id=>members.find(m=>m.user_id===id)?.display_name||'—';

  function renderTemplates(){
    const host=$('#templateGrid');host.innerHTML='';
    if(!templates.length){host.innerHTML='<div class="empty">Noch keine Muster-Terminpläne hinterlegt.</div>';return}
    for(const tpl of templates){
      const card=document.createElement('article');card.className='template-card';
      card.innerHTML=`<div class="top"><div><div class="badge">${esc(tpl.phase)} · Version ${esc(tpl.version)}</div><h3>${esc(tpl.title)}</h3></div><span class="badge">${esc(tpl.status||'Muster')}</span></div>
        <p>${esc(tpl.description||'')}</p>
        <div class="template-actions"><button type="button" data-preview>Vorschau</button><button type="button" class="primary" data-create>Terminplan erstellen</button></div>`;
      card.querySelector('[data-preview]').onclick=()=>location.href='./terminplan.html?template='+encodeURIComponent(tpl.id);
      card.querySelector('[data-create]').onclick=()=>openCreate(tpl.phase);
      host.append(card);
    }
  }
  function renderPlans(){
    const host=$('#planList');$('#planCount').textContent=String(instances.length);host.innerHTML='';
    if(!instances.length){host.innerHTML='<div class="empty">Noch keine Projektterminpläne. Erstelle den ersten aus einem Muster.</div>';return}
    for(const p of instances){
      const row=document.createElement('div');row.className='plan-row';
      const stand=p.state?.project?.standDate||p.updated_at?.slice(0,10);
      row.innerHTML=`<div class="number">${esc(p.project_number||'—')}</div><div class="name">${esc(p.project_name)}</div><div class="phase">${esc(p.phase)}</div><div class="date">Stand ${esc(formatDate(stand))}</div><button type="button">Öffnen →</button>`;
      row.onclick=()=>location.href='./terminplan.html?id='+encodeURIComponent(p.id);
      host.append(row);
    }
  }
  function renderProjects(){
    const host=$('#projectList');host.innerHTML='';
    if(!projects.length){host.innerHTML='<div class="empty">Noch keine Projekte. '+(C.canLead(member.role)?'Lege das erste an.':'Projektleiter oder Administration legen Projekte an.')+'</div>';return}
    for(const p of projects){
      const plans=instances.filter(i=>i.project_id===p.id).length;
      const row=document.createElement('div');row.className='plan-row project-row';
      row.innerHTML=`<div class="number">${esc(p.number)}</div><div class="name">${esc(p.name)}</div><div class="phase">${esc(memberName(p.projektleiter_id))}</div><div class="date">${plans} ${plans===1?'Terminplan':'Terminpläne'}</div><span class="badge">${esc(p.status)}</span>`;
      host.append(row);
    }
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
  function openCreate(phase='LPH3'){
    $('#phase').value=phase;$('#projectStart').value=C.todayKey();
    $('#projectNumber').value='';$('#projectName').value='';$('#createMessage').textContent='';
    fillProjectSelect();
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
      await createProject($('#newProjectNumber').value.trim(),$('#newProjectName').value.trim(),$('#newProjectLead').value);
      $('#projectDialog').close();renderProjects();
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
        const row=document.createElement('div');row.className='plan-row member-row'+(m.is_active?'':' is-inactive');
        const self=m.user_id===user.id;
        row.innerHTML=`<div class="name">${esc(m.display_name)}<small>${esc(m.email)}</small></div>
          <select data-role ${self?'disabled':''} aria-label="Rolle">${Object.entries(C.ROLE_LABELS).map(([v,l])=>`<option value="${v}" ${m.role===v?'selected':''}>${l}</option>`).join('')}</select>
          <div class="date">${m.must_change_password?'Startpasswort aktiv':m.last_sign_in_at?'Zuletzt '+esc(formatDate(m.last_sign_in_at.slice(0,10))):'Noch nicht angemeldet'}</div>
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
  $('#changePasswordBtn').onclick=()=>openPassword(true);

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

  $('#logoutBtn').onclick=async()=>{await sb.auth.signOut();location.reload()};
  $('#openTerminplanTool').onclick=()=>switchView('plans');
  $('#newPlanBtn').onclick=()=>openCreate('LPH3');
  $('#cancelCreate').onclick=()=>$('#createDialog').close();
  $$('.nav-item').forEach(b=>b.onclick=()=>switchView(b.dataset.view));

  sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT')showOnly('auth')});
  sb.auth.getSession().then(({data})=>bootSafely(data.session)).catch(console.error);
})();
