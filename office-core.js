// TBA Office · pure helpers shared by the Office page (tested in tests/office-core.test.mjs).
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TBA_OFFICE_CORE=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const iso=d=>d.toISOString().slice(0,10);
  const parseDate=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(Date.UTC(y,m-1,d))};
  const isWeekend=d=>{const wd=d.getUTCDay();return wd===0||wd===6};
  const nextWorkday=d=>{const x=new Date(d);while(isWeekend(x))x.setUTCDate(x.getUTCDate()+1);return x};
  function addWorkdays(start,offset){
    const d=nextWorkday(parseDate(start));
    let remaining=Math.max(0,Number(offset)||0);
    while(remaining>0){d.setUTCDate(d.getUTCDate()+1);if(!isWeekend(d))remaining--}
    return iso(d);
  }
  function workdayOffset(base,target){
    const b=nextWorkday(parseDate(base)),t=parseDate(target);
    const d=new Date(b);let count=0;
    while(d<t){d.setUTCDate(d.getUTCDate()+1);if(!isWeekend(d))count++}
    return count;
  }
  function formatDate(s){
    if(!s)return '—';
    return parseDate(s).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'});
  }
  function esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  function todayKey(now=new Date()){
    return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  }
  // A project copy of a Muster: same structure, dates moved by working days to the chosen start.
  function cloneStateForProject(templateState,{start,number,name,phase,version,today}){
    const state=JSON.parse(JSON.stringify(templateState));
    const base=state.project.start;
    const moveDate=value=>addWorkdays(start,workdayOffset(base,value));
    state.project={...state.project,name:`${number} ${name} · ${phase.replace('LPH','LPH ')}`,
      projectNumber:number,projectName:name,phase,templateVersion:version,start,
      end:moveDate(state.project.end),standDate:today,standLabel:'Projektstart'};
    state.tasks=(state.tasks||[]).map(task=>({...task,start:moveDate(task.start),end:moveDate(task.end)}));
    return state;
  }
  function passwordProblem(password,repeat,min=10){
    const p=String(password||'');
    if(p.length<min)return `Mindestens ${min} Zeichen.`;
    if(p!==String(repeat||''))return 'Die beiden Passwörter stimmen nicht überein.';
    if(/^(.)\1+$/.test(p))return 'Bitte kein Passwort aus einem einzigen Zeichen.';
    return null;
  }
  const ROLE_LABELS=Object.freeze({admin:'Administration',projektleiter:'Projektleiter/in',member:'Mitarbeiter/in'});
  const canLead=role=>role==='admin'||role==='projektleiter';
  const ADMIN_ERRORS=Object.freeze({
    invalid_email:'Bitte eine Büro-E-Mail-Adresse verwenden.',
    invalid_name:'Bitte einen Namen eingeben.',
    invalid_role:'Unbekannte Rolle.',
    account_exists_or_failed:'Für diese E-Mail gibt es schon einen Zugang.',
    member_failed:'Der Zugang konnte nicht angelegt werden.',
    cannot_demote_self:'Sie können sich nicht selbst die Administration entziehen.',
    last_admin:'Es muss mindestens eine aktive Administration geben.',
    admin_required:'Nur die Administration darf Zugänge verwalten.',
    reset_failed:'Das Passwort konnte nicht zurückgesetzt werden.',
    update_failed:'Die Änderung konnte nicht gespeichert werden.'
  });
  const adminErrorText=code=>ADMIN_ERRORS[code]||'Die Aktion ist fehlgeschlagen. Bitte erneut versuchen.';
  function authErrorText(error){
    const code=String(error?.code||''),msg=String(error?.message||'').toLowerCase();
    if(code==='weak_password'||msg.includes('pwned')||msg.includes('leaked'))return 'Dieses Passwort ist zu schwach oder in bekannten Datenlecks aufgetaucht. Bitte ein anderes wählen.';
    if(code==='same_password'||msg.includes('different from the old'))return 'Das neue Passwort muss sich vom bisherigen unterscheiden.';
    if(code==='reauthentication_needed')return 'Bitte melden Sie sich erneut an und ändern Sie das Passwort dann.';
    return 'Das Passwort konnte nicht gespeichert werden.';
  }
  // Two letters for the account avatar: "Edgar Martínez" → "EM", "titus" → "TI".
  function initials(name){
    const parts=String(name||'').trim().replace(/@.*$/,'').split(/[\s._-]+/).filter(Boolean);
    if(!parts.length)return '·';
    const letters=parts.length>1?parts[0][0]+parts[parts.length-1][0]:parts[0].slice(0,2);
    return letters.toUpperCase();
  }
  // The next milestone of a plan on or after today, for the project page.
  function nextMilestone(state,today){
    const tasks=Array.isArray(state&&state.tasks)?state.tasks:[];
    return tasks.filter(t=>t&&t.type==='milestone'&&typeof t.start==='string'&&t.start>=today)
      .sort((a,b)=>a.start.localeCompare(b.start)||String(a.name||'').localeCompare(String(b.name||''),'de'))[0]||null;
  }
  // Window-style addresses: #work, #project=<id>, #tools, #plans, #members.
  const VIEWS=['work','project','tools','plans','members'];
  function viewFromHash(hash){
    const raw=String(hash||'').replace(/^#/,'');
    const [name,value]=raw.split('=');
    if(name==='project'&&/^[0-9a-f-]{36}$/i.test(value||''))return {view:'project',id:value.toLowerCase()};
    return {view:VIEWS.includes(name)&&name!=='project'?name:'work',id:null};
  }
  function hashFor(view,id){return view==='project'&&id?'#project='+id:'#'+view}
  return {iso,parseDate,isWeekend,nextWorkday,addWorkdays,workdayOffset,formatDate,esc,todayKey,
    cloneStateForProject,passwordProblem,ROLE_LABELS,canLead,adminErrorText,authErrorText,
    initials,nextMilestone,viewFromHash,hashFor};
});
