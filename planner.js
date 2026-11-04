// TBA Office · Planner (per project) and Kalender (per person), in Window's design.
// Reads and writes office_task_buckets and office_tasks; the database enforces who may change what,
// the page only mirrors those rules to hide what a person cannot do.
(()=>{
  'use strict';
  const C=window.TBA_OFFICE_CORE;
  const A=()=>window.TBA_OFFICE_APP;
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const {esc}=C;
  const TASK_COLS='id,project_id,bucket_id,title,kind,notes,start_date,due_date,assignee_id,priority,checklist,position,completed_at,created_by,updated_at';
  const icon=d=>`<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON={
    calendar:icon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'),
    checklist:icon('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>'),
    plus:icon('<path d="M12 5v14M5 12h14"/>'),
    flag:icon('<path d="M4 21V4M4 4h12l-2 4 2 4H4"/>')
  };
  const uid=()=>A().user?.id;
  const today=()=>C.todayKey();
  const projectOf=id=>A().projects.find(p=>p.id===id)||null;
  const leads=projectId=>!!projectId&&A().leadsProject(projectId);

  // ── Shared: one task card and one task editor for Planner and Kalender ─────
  function dueChip(t){
    if(!t.due_date)return '';
    const overdue=!t.completed_at&&t.due_date<today();
    return `<span class="due-chip ${overdue?'is-overdue':''}" title="Fällig am ${esc(C.formatDate(t.due_date))}">${ICON.calendar}<time datetime="${esc(t.due_date)}">${esc(C.dueLabel(t.due_date,today()))}</time></span>`;
  }
  function taskCard(t){
    const editable=C.canEditTask(t,uid(),leads(t.project_id));
    const {done,total}=C.checklistProgress(t.checklist);
    const name=t.assignee_id?A().memberName(t.assignee_id):'';
    return `<article class="task-card ${t.completed_at?'is-done':''}" data-task="${esc(t.id)}" tabindex="0" ${editable?'draggable="true"':''} aria-label="${esc(t.title)}">
      <div class="task-title-row">
        <button type="button" class="task-toggle ${t.completed_at?'is-checked':''}" data-toggle="${esc(t.id)}" ${editable?'':'disabled'}
          aria-pressed="${!!t.completed_at}" aria-label="${t.completed_at?'Wieder öffnen':'Erledigt'}: ${esc(t.title)}">${t.completed_at?'✓':''}</button>
        <strong>${esc(t.title)}</strong>
      </div>
      <footer>
        <div class="task-chips">
          ${t.kind==='abgabe'?`<span class="kind-chip">${ICON.flag}Abgabe</span>`:''}
          ${dueChip(t)}
          ${total?`<span class="meta-chip" title="Checkliste">${ICON.checklist}${done}/${total}</span>`:''}
          ${t.priority==='hoch'?'<span class="priority-chip">Hoch</span>':''}
        </div>
        ${name?`<div class="task-assignee" title="Verantwortlich: ${esc(name)}"><span class="avatar small" aria-hidden="true">${esc(C.initials(name))}</span><span>${esc(name)}</span></div>`:''}
      </footer>
    </article>`;
  }

  async function setDone(t,done){
    const {error}=await A().sb.from('office_tasks').update({completed_at:done?new Date().toISOString():null}).eq('id',t.id);
    if(error)throw error;
  }

  let editing=null;
  function fillSelect(sel,options,value){
    sel.innerHTML=options.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');
    sel.value=value??'';
  }
  function memberOptions(){return [['','— niemand —'],...A().members.map(m=>[m.user_id,m.display_name])]}
  async function bucketsFor(projectId){
    if(!projectId)return [];
    if(projectId===board.projectId)return board.buckets;
    const {data,error}=await A().sb.from('office_task_buckets').select('id,project_id,name,position,is_archived,created_by')
      .eq('project_id',projectId).eq('is_archived',false).order('position');
    if(error)throw error;
    return data||[];
  }
  async function refreshProjectFields(){
    const projectId=$('#taskProject').value;
    const personal=!projectId;
    $$('[data-task-project-only]').forEach(el=>el.hidden=personal);
    if(personal)return;
    const buckets=await bucketsFor(projectId);
    const keep=editing?.task?.project_id===projectId?editing.task.bucket_id:editing?.bucketId;
    fillSelect($('#taskBucket'),[['','Ohne Bucket'],...buckets.map(b=>[b.id,b.name])],buckets.some(b=>b.id===keep)?keep:'');
  }
  function renderChecklist(list){
    const host=$('#taskChecklist');
    host.innerHTML=list.map((x,i)=>`<div class="check-row">
      <input type="checkbox" data-check-done="${i}" ${x.done?'checked':''} aria-label="Erledigt">
      <input type="text" data-check-text="${i}" value="${esc(x.text||'')}" maxlength="200" placeholder="Punkt">
      <button type="button" class="icon-btn" data-check-remove="${i}" aria-label="Punkt entfernen">×</button></div>`).join('');
    host.querySelectorAll('[data-check-remove]').forEach(b=>b.onclick=()=>{
      const items=readChecklist();items.splice(Number(b.dataset.checkRemove),1);renderChecklist(items);
    });
  }
  function readChecklist(){
    return [...$('#taskChecklist').querySelectorAll('.check-row')].map(row=>({
      text:row.querySelector('[data-check-text]').value.trim(),done:row.querySelector('[data-check-done]').checked
    }));
  }
  // task: existing row or null; defaults: {projectId, bucketId, due, onSaved}
  async function openTask(task,defaults={}){
    const projects=A().projects.filter(p=>p.status==='aktiv'||p.id===task?.project_id);
    const projectId=task?task.project_id:(defaults.projectId??'');
    editing={task,bucketId:defaults.bucketId||'',onSaved:defaults.onSaved||(()=>{})};
    const editable=!task||C.canEditTask(task,uid(),leads(task.project_id));
    const deletable=!!task&&C.canDeleteTask(task,uid(),leads(task.project_id));
    $('#taskDialogTitle').textContent=task?(editable?'Aufgabe bearbeiten':'Aufgabe'):'Neue Aufgabe';
    const ctxProject=projectId?projectOf(projectId):null;
    $('#taskContext').textContent=ctxProject?ctxProject.number+' · '+ctxProject.name:(projectId?'Projekt':'Persönlich');
    $('#taskTitle').value=task?.title||'';
    $('#taskKind').value=task?.kind||'aufgabe';
    fillSelect($('#taskProject'),[['','Persönlich (nur für Sie)'],...projects.map(p=>[p.id,p.number+' · '+p.name])],projectId||'');
    $('#taskProject').disabled=!!task||!!defaults.lockProject;
    fillSelect($('#taskAssignee'),memberOptions(),task?(task.assignee_id||''):(defaults.assignee??(projectId?'':uid())));
    $('#taskStart').value=task?.start_date||'';
    $('#taskDue').value=task?.due_date||defaults.due||'';
    $('#taskPriority').value=task?.priority||'normal';
    $('#taskDone').checked=!!task?.completed_at;
    $('#taskNotes').value=task?.notes||'';
    renderChecklist(Array.isArray(task?.checklist)?task.checklist:[]);
    await refreshProjectFields();
    $('#taskForm').querySelectorAll('input,select,textarea').forEach(el=>{if(el.id!=='taskProject')el.disabled=!editable});
    $('#taskAddCheck').hidden=!editable;
    $('#taskSave').hidden=!editable;
    $('#taskReadOnly').hidden=editable;
    $('#taskDelete').hidden=!deletable;
    $('#taskDelete').textContent='Löschen';delete $('#taskDelete').dataset.armed;
    $('#taskMessage').textContent='';
    $('#taskDialog').showModal();
    if(editable)$('#taskTitle').focus();
  }
  $('#taskProject').addEventListener('change',()=>{
    if(!editing.task&&$('#taskProject').value&&$('#taskAssignee').value==='')$('#taskAssignee').value=uid();
    void refreshProjectFields();
  });
  $('#taskAddCheck').onclick=()=>{const items=readChecklist();items.push({text:'',done:false});renderChecklist(items);$('#taskChecklist').querySelector('.check-row:last-child [data-check-text]')?.focus()};
  $('#taskCancel').onclick=()=>$('#taskDialog').close();
  $('#taskForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const msg=$('#taskMessage');msg.textContent='';
    const title=$('#taskTitle').value.trim();if(!title){msg.textContent='Bitte einen Titel eingeben.';return}
    const start=$('#taskStart').value||null,due=$('#taskDue').value||null;
    if(start&&due&&start>due){msg.textContent='Der Beginn liegt nach der Fälligkeit.';return}
    const projectId=$('#taskProject').value||null;
    const done=$('#taskDone').checked;
    const payload={
      title,kind:$('#taskKind').value,start_date:start,due_date:due,priority:$('#taskPriority').value,
      notes:$('#taskNotes').value.trim(),checklist:readChecklist().filter(x=>x.text),
      bucket_id:projectId?($('#taskBucket').value||null):null,
      assignee_id:projectId?($('#taskAssignee').value||null):null,
      completed_at:done?(editing.task?.completed_at||new Date().toISOString()):null
    };
    const submit=$('#taskSave');submit.disabled=true;
    try{
      let res;
      if(editing.task)res=await A().sb.from('office_tasks').update(payload).eq('id',editing.task.id).select('id').single();
      else{
        const siblings=projectId?board.tasks.filter(t=>(t.bucket_id||null)===payload.bucket_id):[];
        res=await A().sb.from('office_tasks').insert({...payload,project_id:projectId,created_by:uid(),position:C.nextPosition(siblings)}).select('id').single();
      }
      if(res.error)throw res.error;
      $('#taskDialog').close();
      await editing.onSaved();
    }catch(err){console.error(err);msg.textContent=C.taskErrorText(err)}
    finally{submit.disabled=false}
  });
  // Deleting asks twice in the button itself, no browser dialog.
  $('#taskDelete').onclick=async()=>{
    const btn=$('#taskDelete');
    if(!btn.dataset.armed){btn.dataset.armed='1';btn.textContent='Wirklich löschen?';return}
    btn.disabled=true;
    try{
      const {error}=await A().sb.from('office_tasks').delete().eq('id',editing.task.id);
      if(error)throw error;
      $('#taskDialog').close();await editing.onSaved();
    }catch(err){$('#taskMessage').textContent=C.taskErrorText(err)}
    finally{btn.disabled=false}
  };

  // ── Planner: the buckets of one project ───────────────────────────────────
  const board={projectId:null,buckets:[],tasks:[],dragId:null};
  async function loadBoard(projectId){
    const sb=A().sb;
    const [b,t]=await Promise.all([
      sb.from('office_task_buckets').select('id,project_id,name,position,is_archived,created_by').eq('project_id',projectId).eq('is_archived',false).order('position'),
      sb.from('office_tasks').select(TASK_COLS).eq('project_id',projectId).order('position')
    ]);
    if(b.error)throw b.error;if(t.error)throw t.error;
    board.projectId=projectId;board.buckets=b.data||[];board.tasks=t.data||[];
  }
  function columns(){
    const active=new Set(board.buckets.map(b=>b.id));
    const loose=board.tasks.filter(t=>!t.bucket_id||!active.has(t.bucket_id));
    return [...(loose.length||!board.buckets.length?[{id:'',name:'Ohne Bucket',virtual:true,tasks:loose}]:[]),
      ...board.buckets.map(b=>({...b,tasks:board.tasks.filter(t=>t.bucket_id===b.id)}))];
  }
  function renderBoard(){
    const host=$('#projectPlanner');
    const project=projectOf(board.projectId);
    const isLead=leads(board.projectId);
    const canAdd=project?.status==='aktiv';
    const open=board.tasks.filter(t=>!t.completed_at).length;
    host.innerHTML=`<div class="planner-toolbar">
        <div><strong>Board</strong><span>${open} offen · ${board.buckets.length} ${board.buckets.length===1?'Bucket':'Buckets'}</span></div>
        ${canAdd?'<button type="button" class="primary" data-add-bucket>+ Bucket</button>':''}
      </div>
      <div class="board">${columns().map((col,i,all)=>{
        const openTasks=col.tasks.filter(t=>!t.completed_at),doneTasks=col.tasks.filter(t=>t.completed_at);
        const menu=!col.virtual&&C.canEditBucket(col,uid(),isLead);
        const realIndex=board.buckets.findIndex(b=>b.id===col.id);
        return `<section class="bucket" data-bucket="${esc(col.id)}">
          <header class="bucket-head">
            <strong>${esc(col.name)}</strong><span class="bucket-count" aria-label="${openTasks.length} offen">${openTasks.length}</span>
            ${menu?`<div class="bucket-actions">
              <button type="button" class="bucket-more" data-bucket-menu-btn="${esc(col.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Aktionen für ${esc(col.name)}">•••</button>
              <div class="bucket-menu" data-bucket-menu="${esc(col.id)}" role="menu" hidden>
                <button type="button" role="menuitem" data-rename-bucket="${esc(col.id)}">Umbenennen</button>
                <button type="button" role="menuitem" data-shift-bucket="${esc(col.id)}" data-dir="-1" ${realIndex===0?'disabled':''}>Nach links</button>
                <button type="button" role="menuitem" data-shift-bucket="${esc(col.id)}" data-dir="1" ${realIndex===board.buckets.length-1?'disabled':''}>Nach rechts</button>
                <button type="button" role="menuitem" class="is-danger" data-archive-bucket="${esc(col.id)}">Entfernen</button>
              </div></div>`:''}
          </header>
          ${canAdd?`<button type="button" class="add-task" data-add-task="${esc(col.id)}">${ICON.plus}Aufgabe hinzufügen</button>`:''}
          <div class="task-list">${openTasks.map(taskCard).join('')}</div>
          ${doneTasks.length?`<details class="completed"><summary>Erledigte Aufgaben <span>${doneTasks.length}</span></summary><div class="task-list">${doneTasks.map(taskCard).join('')}</div></details>`:''}
        </section>`;}).join('')}</div>`;
    wireBoard(host);
  }
  async function reloadBoard(){
    try{await loadBoard(board.projectId);renderBoard()}
    catch(err){console.error(err);$('#projectPlanner').innerHTML='<div class="empty">Der Planner konnte nicht geladen werden.</div>'}
  }
  function closeBucketMenus(){$$('[data-bucket-menu]').forEach(m=>m.hidden=true);$$('[data-bucket-menu-btn]').forEach(b=>b.setAttribute('aria-expanded','false'))}
  function wireBoard(host){
    host.querySelector('[data-add-bucket]')?.addEventListener('click',()=>openBucket(null));
    host.querySelectorAll('[data-add-task]').forEach(b=>b.onclick=()=>openTask(null,{projectId:board.projectId,bucketId:b.dataset.addTask,lockProject:true,onSaved:reloadBoard}));
    host.querySelectorAll('[data-task]').forEach(card=>{
      const t=board.tasks.find(x=>x.id===card.dataset.task);
      card.onclick=e=>{if(e.target.closest('[data-toggle]'))return;openTask(t,{onSaved:reloadBoard})};
      card.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('[data-toggle]')){e.preventDefault();openTask(t,{onSaved:reloadBoard})}};
      card.ondragstart=e=>{board.dragId=t.id;card.classList.add('is-dragging');e.dataTransfer?.setData('text/plain',t.id)};
      card.ondragend=()=>{board.dragId=null;card.classList.remove('is-dragging');$$('.bucket.is-drop-target').forEach(x=>x.classList.remove('is-drop-target'))};
    });
    host.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=async e=>{
      e.stopPropagation();const t=board.tasks.find(x=>x.id===b.dataset.toggle);b.disabled=true;
      try{await setDone(t,!t.completed_at);await reloadBoard()}catch(err){console.error(err);b.disabled=false}
    });
    host.querySelectorAll('.bucket').forEach(col=>{
      col.ondragover=e=>{if(!board.dragId)return;e.preventDefault();col.classList.add('is-drop-target')};
      col.ondragleave=e=>{if(!col.contains(e.relatedTarget))col.classList.remove('is-drop-target')};
      col.ondrop=async e=>{
        e.preventDefault();col.classList.remove('is-drop-target');
        const t=board.tasks.find(x=>x.id===board.dragId);board.dragId=null;if(!t)return;
        const target=col.dataset.bucket||null;if((t.bucket_id||null)===target)return;
        const {error}=await A().sb.from('office_tasks').update({bucket_id:target,position:C.nextPosition(board.tasks.filter(x=>(x.bucket_id||null)===target))}).eq('id',t.id);
        if(error)console.error(error);
        await reloadBoard();
      };
    });
    host.querySelectorAll('[data-bucket-menu-btn]').forEach(btn=>btn.onclick=e=>{
      e.stopPropagation();
      const menu=host.querySelector(`[data-bucket-menu="${btn.dataset.bucketMenuBtn}"]`),opening=menu.hidden;
      closeBucketMenus();if(opening){menu.hidden=false;btn.setAttribute('aria-expanded','true')}
    });
    host.querySelectorAll('[data-rename-bucket]').forEach(b=>b.onclick=()=>{closeBucketMenus();openBucket(board.buckets.find(x=>x.id===b.dataset.renameBucket))});
    host.querySelectorAll('[data-shift-bucket]').forEach(b=>b.onclick=async()=>{
      closeBucketMenus();
      const order=board.buckets.map(x=>x.id),i=order.indexOf(b.dataset.shiftBucket),j=i+Number(b.dataset.dir);
      if(i<0||j<0||j>=order.length)return;
      [order[i],order[j]]=[order[j],order[i]];
      // Positions follow the visible order, so equal positions never block a move.
      const changed=order.map((id,k)=>({id,position:k+1})).filter(x=>board.buckets.find(y=>y.id===x.id).position!==x.position);
      for(const x of changed){const {error}=await A().sb.from('office_task_buckets').update({position:x.position}).eq('id',x.id);if(error){console.error(error);break}}
      await reloadBoard();
    });
    host.querySelectorAll('[data-archive-bucket]').forEach(b=>b.onclick=async()=>{
      if(!b.dataset.armed){b.dataset.armed='1';b.textContent='Wirklich entfernen? Aufgaben bleiben erhalten.';return}
      closeBucketMenus();
      const {error}=await A().sb.from('office_task_buckets').update({is_archived:true}).eq('id',b.dataset.archiveBucket);
      if(error)console.error(error);
      await reloadBoard();
    });
  }
  document.addEventListener('click',e=>{if(!e.target.closest('.bucket-actions'))closeBucketMenus()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeBucketMenus()});

  let bucketEditing=null;
  function openBucket(bucket){
    bucketEditing=bucket;
    $('#bucketDialogTitle').textContent=bucket?'Bucket umbenennen':'Neuer Bucket';
    $('#bucketName').value=bucket?.name||'';$('#bucketMessage').textContent='';
    $('#bucketDialog').showModal();$('#bucketName').focus();
  }
  $('#bucketCancel').onclick=()=>$('#bucketDialog').close();
  $('#bucketForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const name=$('#bucketName').value.trim();if(!name)return;
    const res=bucketEditing
      ?await A().sb.from('office_task_buckets').update({name}).eq('id',bucketEditing.id)
      :await A().sb.from('office_task_buckets').insert({project_id:board.projectId,name,created_by:uid(),position:C.nextPosition(board.buckets)});
    if(res.error){$('#bucketMessage').textContent=C.taskErrorText(res.error);return}
    $('#bucketDialog').close();await reloadBoard();
  });

  async function openProject(projectId){
    const host=$('#projectPlanner');
    if(board.projectId!==projectId)host.innerHTML='<div class="empty">Lade Planner …</div>';
    board.projectId=projectId;
    await reloadBoard();
  }

  // ── Kalender: one person's tasks and Abgaben ──────────────────────────────
  const cal={mode:'week',anchor:null,tasks:[]};
  async function loadCalendar(){
    const me=uid();
    const {data,error}=await A().sb.from('office_tasks').select(TASK_COLS)
      .or(`assignee_id.eq.${me},and(assignee_id.is.null,created_by.eq.${me})`);
    if(error)throw error;
    cal.tasks=C.mineForCalendar(data||[],me);
  }
  function calChip(t,compact=false){
    const p=t.project_id?projectOf(t.project_id):null;
    const editable=C.canEditTask(t,uid(),leads(t.project_id));
    return `<div class="cal-chip ${t.kind==='abgabe'?'is-abgabe':''} ${t.completed_at?'is-done':''}" data-cal-task="${esc(t.id)}" role="button" tabindex="0" title="${esc(t.title)}">
      ${compact?'':`<button type="button" class="task-toggle mini ${t.completed_at?'is-checked':''}" data-cal-toggle="${esc(t.id)}" ${editable?'':'disabled'} aria-pressed="${!!t.completed_at}" aria-label="${t.completed_at?'Wieder öffnen':'Erledigt'}: ${esc(t.title)}">${t.completed_at?'✓':''}</button>`}
      <span class="cal-chip-text"><span class="cal-chip-title">${t.kind==='abgabe'?'Abgabe · ':''}${esc(t.title)}</span>${!compact&&p?`<span class="cal-chip-meta">${esc(p.number)}</span>`:''}</span>
    </div>`;
  }
  function renderCalendar(){
    const now=today();
    if(!cal.anchor)cal.anchor=now;
    $('#calTitle').textContent=cal.mode==='week'?C.weekTitle(cal.anchor):C.monthTitle(cal.anchor);
    $$('[data-cal-mode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.calMode===cal.mode)));
    const overdue=C.overdueTasks(cal.tasks,now);
    $('#calOverdue').innerHTML=overdue.length?`<div class="card overdue-card"><div class="overdue-head"><strong>Überfällig</strong><span>${overdue.length}</span></div>
      <div class="overdue-list">${overdue.map(t=>`<div class="overdue-item">${calChip(t)}<span class="overdue-date">${esc(C.dueLabel(t.due_date,now))}</span></div>`).join('')}</div></div>`:'';
    const body=$('#calBody');
    if(cal.mode==='week'){
      body.innerHTML=`<div class="cal-week">${C.weekDays(cal.anchor).map((day,i)=>{
        const items=C.tasksOnDay(cal.tasks,day),d=C.parseDate(day);
        return `<section class="cal-day ${day===now?'is-today':''} ${i>4?'is-weekend':''}" data-day="${day}">
          <header><span class="cal-dow">${C.WEEKDAYS[i]}</span><span class="cal-date">${d.getUTCDate()}</span></header>
          <div class="cal-items">${items.map(t=>calChip(t)).join('')}</div>
          <button type="button" class="cal-add" data-cal-add="${day}" aria-label="Aufgabe am ${esc(C.formatDate(day))}">${ICON.plus}</button>
        </section>`;}).join('')}</div>`;
    }else{
      const month=cal.anchor.slice(0,7);
      body.innerHTML=`<div class="cal-month"><div class="cal-month-head">${C.WEEKDAYS.map(w=>`<span>${w}</span>`).join('')}</div>
        <div class="cal-month-grid">${C.monthGrid(cal.anchor).map((day,i)=>{
          const items=C.tasksOnDay(cal.tasks,day),d=C.parseDate(day);
          return `<div class="cal-cell ${day.slice(0,7)!==month?'is-other':''} ${day===now?'is-today':''} ${i%7>4?'is-weekend':''}" data-cell="${day}">
            <span class="cal-cell-date">${d.getUTCDate()}</span>
            ${items.slice(0,3).map(t=>calChip(t,true)).join('')}
            ${items.length>3?`<button type="button" class="cal-more" data-cal-week="${day}">+${items.length-3} weitere</button>`:''}
          </div>`;}).join('')}</div></div>`;
    }
    const undated=cal.tasks.filter(t=>!t.due_date&&!t.completed_at);
    $('#calUndatedSection').hidden=!undated.length;
    $('#calUndatedCount').textContent=String(undated.length);
    $('#calUndated').innerHTML=undated.map(t=>`<div class="row">${calChip(t)}<span class="row-side">${t.project_id?esc(projectOf(t.project_id)?.number||''):'Persönlich'}</span></div>`).join('');
    wireCalendar();
  }
  async function reloadCalendar(){
    try{await loadCalendar();renderCalendar()}
    catch(err){console.error(err);$('#calBody').innerHTML='<div class="empty">Der Kalender konnte nicht geladen werden.</div>'}
  }
  function wireCalendar(){
    const view=$('#kalenderView');
    view.querySelectorAll('[data-cal-task]').forEach(chip=>{
      const t=cal.tasks.find(x=>x.id===chip.dataset.calTask);
      chip.onclick=e=>{if(e.target.closest('[data-cal-toggle]'))return;openTask(t,{onSaved:reloadCalendar})};
      chip.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('[data-cal-toggle]')){e.preventDefault();openTask(t,{onSaved:reloadCalendar})}};
    });
    view.querySelectorAll('[data-cal-toggle]').forEach(b=>b.onclick=async e=>{
      e.stopPropagation();const t=cal.tasks.find(x=>x.id===b.dataset.calToggle);b.disabled=true;
      try{await setDone(t,!t.completed_at);await reloadCalendar()}catch(err){console.error(err);b.disabled=false}
    });
    view.querySelectorAll('[data-cal-add]').forEach(b=>b.onclick=()=>openTask(null,{due:b.dataset.calAdd,onSaved:reloadCalendar}));
    view.querySelectorAll('[data-cal-week]').forEach(b=>b.onclick=e=>{e.stopPropagation();cal.mode='week';cal.anchor=b.dataset.calWeek;renderCalendar()});
  }
  $('#calPrev').onclick=()=>{cal.anchor=C.shiftAnchor(cal.anchor||today(),cal.mode,-1);renderCalendar()};
  $('#calNext').onclick=()=>{cal.anchor=C.shiftAnchor(cal.anchor||today(),cal.mode,1);renderCalendar()};
  $('#calToday').onclick=()=>{cal.anchor=today();renderCalendar()};
  $$('[data-cal-mode]').forEach(b=>b.onclick=()=>{cal.mode=b.dataset.calMode;renderCalendar()});
  $('#calNewTask').onclick=()=>openTask(null,{onSaved:reloadCalendar});

  async function openKalender(){
    if(!A()?.user)return;
    if(!cal.tasks.length)$('#calBody').innerHTML='<div class="empty">Lade Kalender …</div>';
    await reloadCalendar();
  }

  window.TBA_PLANNER=Object.freeze({openProject,openKalender});
})();
