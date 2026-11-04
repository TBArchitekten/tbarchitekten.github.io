/* Build 99A · Proposal → preview → explicit user approval → verified calendar insert.
 * Supabase is authoritative; not an automatic teammate calendar or a worked-time log. */
(()=>{
'use strict';
const M=window.MINDS_TIME_PLAN_MODEL,sb=window.MINDS_SUPABASE;
const $=s=>document.querySelector(s);
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const uid=()=>window.crypto?.randomUUID?.()||'plan-'+Date.now()+'-'+Math.random().toString(36).slice(2);
let generation=0,submitting=false;
const msg=(value,bad=false)=>{const el=$('#mindsTimePlanStatus');if(el){el.textContent=value;el.dataset.error=bad?'true':'false'}};
const reasonText={
  invalid_hours:'Das Zeitfenster muss mindestens 30 Minuten lang sein.',
  invalid_limits:'Bitte die Grenzen pro Block und pro Tag prüfen (Vielfache von 15 Minuten).',
  missing_deadline:'Diese Aufgabe braucht zum Planen ein Fälligkeitsdatum.',
  missing_estimate:'Bitte zuerst eine Aufwandsschätzung eintragen.',
  invalid_today:'Das aktuelle Datum ist ungültig.',
  inconsistent_dates:'Der Beginn liegt nach der Fälligkeit. Bitte die Daten korrigieren.',
  overdue:'Die Frist ist abgelaufen. Bitte zuerst die Fälligkeit ändern.',
  horizon_too_long:'Der Zeitraum ist länger als 90 Tage. Bitte in der Aufgabe eingrenzen.',
  already_reserved:'Die Schätzung ist bereits durch reservierte Zeiten abgedeckt.',
  partial:'Der Aufwand passt nicht vollständig in die freien Zeiten.',
  ready:'Die Vorschläge vermeiden die Termine in Ihrem Kalender.'
};
async function readSnapshot(taskId){
  const auth=await sb.auth.getSession();
  if(!auth.data?.session?.user)throw new Error('Bitte anmelden.');
  const [{data:task,error:te},{data:events,error:ee,count}]=await Promise.all([
    sb.from('isabella_tasks').select('*').eq('id',taskId).maybeSingle(),
    sb.from('isabella_events')
      .select('client_key,title,starts_at,ends_at,all_day,metadata,recurrence',{count:'exact'})
      .order('starts_at',{ascending:false}).limit(2000)
  ]);
  if(te||ee)throw te||ee;
  if(!task||task.archived_at||task.completed_at)throw new Error('Die Aufgabe ist nicht mehr offen.');
  if(count>2000)throw new Error('Zu viele Termine, um den ganzen Kalender zu prüfen.');
  if((events||[]).some(e=>!M.rangeMs(e)))
    throw new Error('Ein Termin hat einen ungültigen Zeitraum. Bitte den Kalender prüfen.');
  const today=M.dateKey(new Date()),limit=M.addDays(today,90);
  const until=M.validDate(task.due_date)&&task.due_date<limit?task.due_date:limit;
  const expanded=M.expandRecurrence(events||[],today,until);
  if(expanded.unsupported)throw new Error(
    'Eine Terminserie kann nicht sicher ausgewertet werden. Bitte den Kalender prüfen.');
  return {task,events:expanded.events};
}
function formSettings(){
  return {from:$('#mindsPlanFrom')?.value,until:$('#mindsPlanUntil')?.value,
    block:Number($('#mindsPlanBlock')?.value),dailyCap:Number($('#mindsPlanCap')?.value),
    skipWeekends:!!$('#mindsPlanWeekends')?.checked};
}
const formatMin=n=>Math.floor(n/60)+' h '+String(n%60).padStart(2,'0')+' min';
function render(ctx){
  if(ctx.ticket!==generation)return;
  const initial=M.defaults(),t=ctx.snapshot.task;
  window.ISABELLA_APP?.openModal?.('Zeit planen',
    '<div class="minds-time-plan"><div class="minds-time-plan-heading"><strong>'+E(t.title)+'</strong>'+
    '<p>Vorschlag für <b>Ihren persönlichen Kalender</b>, nicht für den Kalender der Verantwortlichen. Es wird erst reserviert, wenn Sie bestätigen.</p></div>'+
    '<div class="minds-time-plan-inputs">'+
    '<label>Von<input type="time" id="mindsPlanFrom" value="'+initial.from+'"></label>'+
    '<label>Bis<input type="time" id="mindsPlanUntil" value="'+initial.until+'"></label>'+
    '<label>Höchstens pro Block (min)<input type="number" id="mindsPlanBlock" min="15" max="180" step="15" value="'+initial.block+'"></label>'+
    '<label>Höchstens pro Tag (min)<input type="number" id="mindsPlanCap" min="15" max="720" step="15" value="'+initial.dailyCap+'"></label></div>'+
    '<label class="minds-time-plan-weekends"><input type="checkbox" id="mindsPlanWeekends" checked> Wochenenden auslassen</label>'+
    '<div id="mindsTimePlanOverview"></div>'+
    '<div id="mindsTimePlanStatus" aria-live="polite"></div>'+
    '<div class="minds-time-plan-actions"><button type="button" id="mindsTimePlanConfirm" disabled>Vorgeschlagene Zeiten reservieren</button>'+
    '<button type="button" id="mindsTimePlanBack">Zurück zur Aufgabe</button></div></div>'
  );
  for(const id of ['mindsPlanFrom','mindsPlanUntil','mindsPlanBlock','mindsPlanCap','mindsPlanWeekends']){
    const el=$('#'+id);if(el)el.addEventListener('change',()=>preview(ctx));
  }
  $('#mindsTimePlanBack').onclick=()=>void window.MINDS_TASK_DETAIL?.open({taskId:ctx.taskId});
  $('#mindsTimePlanConfirm').onclick=()=>void commit(ctx);
  preview(ctx);
}
function preview(ctx){
  if(ctx.ticket!==generation)return;
  const settings=formSettings(),today=M.validDate(ctx.today)?ctx.today:null;
  const result=M.suggest({task:ctx.snapshot.task,events:ctx.snapshot.events,
    settings,today:today||undefined,now:new Date()});
  ctx.proposal=result;ctx.settings=settings;
  const slots=(result.slots||[]).map(slot=>
    '<div class="minds-time-plan-slot"><time>'+E(slot.date)+' · '+E(slot.start)+'</time>'+
    '<strong>'+E(formatMin(slot.duration))+'</strong></div>').join('');
  const summary=(result.estimatedMinutes?
    '<p>Schätzung gesamt: '+E(formatMin(result.estimatedMinutes))+
    ' · bereits reserviert: '+E(formatMin(result.alreadyReservedMinutes||0))+'</p>':'')+
    (result.plannedMinutes?'<p>Vorschlag: '+result.slots.length+' Blöcke · '+E(formatMin(result.plannedMinutes))+'</p>':'')+
    (result.unplannedMinutes?'<p class="is-warning">Passt nicht: '+E(formatMin(result.unplannedMinutes))+'</p>':'');
  $('#mindsTimePlanOverview').innerHTML='<p>'+E(reasonText[result.reason]||result.reason)+'</p>'+summary+
    '<div class="minds-time-plan-slots">'+slots+'</div>';
  $('#mindsTimePlanConfirm').disabled=!result.slots?.length||submitting;
  $('#mindsTimePlanConfirm').textContent='Reservieren: '+(result.slots?.length||0)+' Blöcke (bestätigen)';
  msg('Zeitfenster und Blöcke können vor dem Bestätigen angepasst werden.');
}
async function open({taskId}={}){
  const ticket=++generation;
  if(!taskId||!M||!sb)return;
  submitting=false;
  window.ISABELLA_APP?.openModal?.('Zeit planen','<p class="minds-time-plan-loading">Prüfe Termine und Fristen …</p>');
  try{
    // First flush any pending changes made in the canonical task editor.
    const ok=await window.ISABELLA_SYNC_NOW?.();
    if(ok!==true)throw new Error('Die Synchronisierung konnte nicht bestätigt werden. Bitte erneut versuchen.');
    const snapshot=await readSnapshot(taskId);
    if(ticket!==generation)return;
    render({ticket,taskId,snapshot});
  }catch(error){if(ticket===generation)window.ISABELLA_APP?.openModal?.('Planung nicht möglich',
    '<div class="minds-time-plan-error">'+E(error?.message||error)+'</div>')}
}
async function commit(ctx){
  if(submitting||ctx.ticket!==generation||!ctx.proposal?.slots?.length)return;
  const slots=ctx.proposal.slots,settings=ctx.settings;
  // The explicit 'Reservar N sesiones' button is the user's authorization.
  submitting=true;
  $('#mindsTimePlanConfirm').disabled=true;
  msg('Prüfe den Kalender erneut …');
  try{
    const flushed=await window.ISABELLA_SYNC_NOW?.();
    if(flushed!==true)throw new Error('Der Kalender konnte vor dem Reservieren nicht synchronisiert werden.');
    const fresh=await readSnapshot(ctx.taskId);
    const rebuilt=M.suggest({task:fresh.task,events:fresh.events,settings,now:new Date()});
    if(fresh.task.updated_at!==ctx.snapshot.task.updated_at||
      !M.sameSlots(slots,rebuilt.slots)){
      ctx.snapshot=fresh;ctx.proposal=rebuilt;submitting=false;
      preview(ctx);
      msg('Aufgabe oder Kalender wurden geändert. Bitte den neuen Vorschlag prüfen.',true);
      return;
    }
    const inserted=slots.map(slot=>({
      client_key:uid(),title:fresh.task.title,
      starts_at:new Date(slot.startsMs).toISOString(),ends_at:new Date(slot.endsMs).toISOString(),
      all_day:false,category_id:fresh.task.category_id,project_id:fresh.task.project_id,
      metadata:{kind:'task_work_session_v1',task_client_key:fresh.task.client_key,
        origin:'isabella_time_planning_v1',approval:'user_confirmed'}
    }));
    const {data,error}=await sb.from('isabella_events').insert(inserted).select('client_key');
    if(error||!data||data.length!==inserted.length)
      throw error||new Error('Der Server hat nicht alle Reservierungen bestätigt. Bitte den Kalender prüfen.');
    msg('Gespeichert; synchronisiere …');
    const synced=await window.ISABELLA_SYNC_PULL_NOW?.();
    const keys=new Set(inserted.map(x=>x.client_key));
    const seen=(window.ISABELLA_APP?.getState?.().events||[]).filter(e=>keys.has(e.id)).length;
    if(synced!==true||seen!==keys.size){
      msg('Gespeichert. Bitte den Kalender neu laden; nicht erneut anlegen.',true);
      return;
    }
    msg(inserted.length+' Blöcke gespeichert und bestätigt.');
    $('#mindsTimePlanConfirm').textContent='Reservierungen bestätigt';
    const back=$('#mindsTimePlanBack');if(back)back.textContent='Aufgabe und Zeiten ansehen';
    ctx.proposal={...ctx.proposal,slots:[]};
  }catch(error){msg('Plan nicht bestätigt: '+(error?.message||error),true)}
  finally{submitting=false}
}
window.MINDS_TIME_PLANNING={open};
})();