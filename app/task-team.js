/* Build 99C · Canonical team responsibility + dated effort allocations.
 * Colleagues have no login and no inferred calendar availability. */
(()=>{
'use strict';
const sb=window.MINDS_SUPABASE,$=s=>document.querySelector(s);
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const yes=x=>Array.isArray(x)?x:[];
const validDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x));
const localDay=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const teamIds=ctx=>yes(ctx.teamIds);
async function read(taskId,primaryPersonId=null){
  if(!taskId)return {ids:[],allocations:[]};
  const [a,b]=await Promise.all([
    sb.from('minds_work_task_assignees').select('person_id,created_at').eq('task_id',taskId)
      .order('created_at',{ascending:true}).order('person_id',{ascending:true}),
    sb.from('minds_work_task_allocations').select('person_id,work_date,planned_minutes,note,updated_at')
      .eq('task_id',taskId).order('work_date')
  ]);
  if(a.error||b.error)throw a.error||b.error;
  // Deterministic secondary ordering; the legacy primary is the authoritative first person.
  // Reopening a task must not promote a secondary due to unordered database results.
  const links=[...yes(a.data)].filter(x=>x.person_id).sort((x,y)=>
    String(x.created_at||'').localeCompare(String(y.created_at||''))||
    String(x.person_id).localeCompare(String(y.person_id)));
  const ids=[...new Set(links.map(x=>x.person_id))];
  if(primaryPersonId&&ids.includes(primaryPersonId)){
    ids.splice(ids.indexOf(primaryPersonId),1);ids.unshift(primaryPersonId);
  }
  return {ids,allocations:yes(b.data)};
}
const name=(ctx,id)=>ctx.choices.people.find(x=>x.id===id)?.name||'Teammitglied';
function selectorHtml(ctx){
  const people=ctx.choices.people;
  return '<div class="minds-task-team-choice" role="group" aria-label="Verantwortlich für die Aufgabe">'+
    (people.length?people.map(person=>{
      const selected=teamIds(ctx).includes(person.id);
      return '<button type="button" class="minds-task-team-chip'+(selected?' is-selected':'')+
        '" data-team-person="'+E(person.id)+'" aria-pressed="'+selected+'">'+E(person.name)+'</button>';
    }).join(''):'<span class="minds-task-muted">Personen unter Work → Team hinzufügen.</span>')+
    (!teamIds(ctx).length&&ctx.task?.assignee&&!ctx.task?.assignee_person_id?
      '<span class="minds-task-muted">Frühere Zuweisung: '+E(ctx.task.assignee)+'</span>':'')+
    '<span id="taskTeamAssignStatus" class="minds-task-muted" aria-live="polite"></span></div>';
}
function allocationsHtml(ctx){
  const allocations=yes(ctx.allocations);
  const items=allocations.map(a=>'<div class="minds-team-allocation-row"><span>'+E(name(ctx,a.person_id))+
    ' · '+E(a.work_date)+'</span><strong>'+E(String(a.planned_minutes))+' min</strong>'+
    '<button type="button" data-team-allocation-remove="'+E(a.person_id)+'" data-team-allocation-date="'+
    E(a.work_date)+'" aria-label="Geplanten Tag entfernen">×</button></div>').join('');
  const options=teamIds(ctx).map(id=>'<option value="'+E(id)+'">'+E(name(ctx,id))+'</option>').join('');
  return '<div class="minds-task-section minds-team-allocations" data-team-allocations>'+
    '<div class="minds-task-section-head"><strong>Geplante Teamstunden</strong></div>'+
    '<p class="minds-task-muted">Interne Planung, ohne Uhrzeiten.</p>'+
    '<div id="taskTeamAllocRows">'+(items||'<span class="minds-task-muted">Keine geplanten Tage.</span>')+'</div>'+
    '<div class="minds-team-alloc-form"><select aria-label="Person" id="taskTeamPerson">'+options+'</select>'+
    '<input type="date" id="taskTeamDate" aria-label="Tag" value="'+
    E(ctx.task?.start_date||ctx.task?.due_date||localDay())+'">'+
    '<input type="number" id="taskTeamMinutes" aria-label="Geplante Minuten" min="15" max="720" step="15" value="120">'+
    '<button type="button" id="taskTeamAdd"'+(!ctx.task||!options?' disabled':'')+'>＋ Tag hinzufügen</button></div>'+
    '<div id="taskTeamStatus" class="minds-task-muted" aria-live="polite"></div></div>';
}
function status(msg){
  for(const id of ['#taskTeamStatus','#taskTeamAssignStatus']){
    const e=$(id);if(e)e.textContent=msg;
  }
}
function refreshChips(ctx){
  document.querySelectorAll('[data-team-person]').forEach(btn=>{
    const selected=teamIds(ctx).includes(btn.dataset.teamPerson);
    btn.classList.toggle('is-selected',selected);btn.setAttribute('aria-pressed',String(selected));
  });
  const list=$('#taskTeamPerson');
  if(list)list.innerHTML=teamIds(ctx).map(id=>'<option value="'+E(id)+'">'+E(name(ctx,id))+'</option>').join('');
  const button=$('#taskTeamAdd');if(button)button.disabled=!ctx.task||!teamIds(ctx).length;
}
function refreshRows(ctx){
  const area=$('[data-team-allocations]');if(!area)return;
  const rows=$('#taskTeamAllocRows');if(!rows)return;
  rows.innerHTML=ctx.allocations?.length?ctx.allocations.map(a=>
    '<div class="minds-team-allocation-row"><span>'+E(name(ctx,a.person_id))+' · '+E(a.work_date)+
    '</span><strong>'+E(String(a.planned_minutes))+' min</strong>'+
    '<button type="button" data-team-allocation-remove="'+E(a.person_id)+'" data-team-allocation-date="'+E(a.work_date)+'" aria-label="Geplanten Tag entfernen">×</button></div>'
  ).join(''):'<span class="minds-task-muted">Keine geplanten Tage.</span>';
}
async function assign(ctx,id,api){
  if(ctx.blocked)return;
  const previous=teamIds(ctx),next=previous.includes(id)?previous.filter(x=>x!==id):[...previous,id];
  if(!ctx.task){ctx.teamIds=next;refreshChips(ctx);return}
  await ctx.queue;
  if(ctx.blocked)return;
  const pressed=$$('[data-team-person]');pressed.forEach(x=>x.disabled=true);
  try{
    const {data,error}=await sb.rpc('minds_work_set_task_assignees',{
      p_task_id:ctx.task.id,p_person_ids:next,p_expected_updated_at:ctx.task.updated_at
    });
    if(error)throw error;
    ctx.teamIds=yes(data);
    const {data:latest,error:readError}=await sb.from('isabella_tasks').select('*').eq('id',ctx.task.id).single();
    if(readError||!latest)throw readError||new Error('Die Änderung konnte nicht bestätigt werden.');
    ctx.task=latest;
    refreshChips(ctx);status('Verantwortliche gespeichert.');
    void window.ISABELLA_SYNC_PULL_NOW?.().catch(()=>{});
    if(typeof ctx.opts?.onUpdated==='function')void Promise.resolve(ctx.opts.onUpdated()).catch(()=>{});
  }catch(err){status('Nicht gespeichert: '+(err?.message||err));refreshChips(ctx)}
  finally{pressed.forEach(x=>x.disabled=false)}
}
const $$=s=>[...document.querySelectorAll(s)];
async function allocate(ctx){
  if(!ctx.task)return;
  await ctx.queue;
  const person_id=$('#taskTeamPerson')?.value,work_date=$('#taskTeamDate')?.value,
    planned_minutes=Number($('#taskTeamMinutes')?.value);
  if(!teamIds(ctx).includes(person_id)||!validDate(work_date)||!Number.isInteger(planned_minutes)
    ||planned_minutes<15||planned_minutes>720||planned_minutes%15){
    status('Bitte Person, Datum und Minuten wählen (15–720, in 15er-Schritten).');return;
  }
  const btn=$('#taskTeamAdd');btn.disabled=true;status('Speichere Planung …');
  try{
    const {data,error}=await sb.from('minds_work_task_allocations')
      .upsert({task_id:ctx.task.id,person_id,work_date,planned_minutes},
        {onConflict:'task_id,person_id,work_date'})
      .select('person_id,work_date,planned_minutes,note,updated_at');
    if(error||!data?.length)throw error||new Error('Die Stundenplanung wurde nicht bestätigt.');
    ctx.allocations=(await read(ctx.task.id,ctx.task.assignee_person_id)).allocations;
    refreshRows(ctx);status('Geplanter Tag gespeichert. Er blockiert keinen persönlichen Kalender.');
    void window.ISABELLA_SYNC_PULL_NOW?.().catch(()=>{});
  }catch(err){status('Nicht gespeichert: '+(err?.message||err))}
  finally{btn.disabled=false}
}
async function removeAllocation(ctx,person_id,work_date){
  if(!ctx.task)return;
  status('Entferne Planung …');
  const {data,error}=await sb.from('minds_work_task_allocations').delete()
    .eq('task_id',ctx.task.id).eq('person_id',person_id).eq('work_date',work_date)
    .select('task_id');
  if(error||!data?.length){status('Planung nicht entfernt: '+(error?.message||'no encontrada'));return}
  ctx.allocations=(await read(ctx.task.id,ctx.task.assignee_person_id)).allocations;refreshRows(ctx);status('Planung entfernt.');
  void window.ISABELLA_SYNC_PULL_NOW?.().catch(()=>{});
}
function bind(ctx){
  $$('[data-team-person]').forEach(button=>button.addEventListener('click',()=>void assign(ctx,button.dataset.teamPerson)));
  $('#taskTeamAdd')?.addEventListener('click',()=>void allocate(ctx));
  $('[data-team-allocations]')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-team-allocation-remove]');
    if(button)void removeAllocation(ctx,button.dataset.teamAllocationRemove,button.dataset.teamAllocationDate);
  });
}
window.MINDS_TASK_TEAM={read,selectorHtml,allocationsHtml,bind,teamIds};
})();