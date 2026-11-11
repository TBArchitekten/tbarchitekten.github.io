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
  // Landesweite Feiertage in Bayern; kommunale Sonderregeln (z. B. Augsburger
  // Friedensfest, Mariä Himmelfahrt) müssen projektspezifisch ergänzt werden.
  function bavarianHolidays(year){
    if(!Number.isInteger(year)||year<1900||year>2100)throw Error('Ungültiges Kalenderjahr');
    const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
    const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
    const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4;
    const l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451);
    const v=h+l-7*m+114,month=Math.floor(v/31),day=v%31+1;
    const easter=new Date(Date.UTC(year,month-1,day));
    const easterOffset=n=>{const x=new Date(easter);x.setUTCDate(x.getUTCDate()+n);return iso(x)};
    return [
      year+'-01-01',year+'-01-06',year+'-05-01',year+'-10-03',
      year+'-11-01',year+'-12-25',year+'-12-26',
      easterOffset(-2),easterOffset(1),easterOffset(39),
      easterOffset(50),easterOffset(60)
    ].sort();
  }
  const validDateKey=s=>{
    if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
    const d=parseDate(s);return Number.isFinite(d.getTime())&&iso(d)===s;
  };
  function projectHolidayDates(startYear,endYear,extra=[]){
    const all=new Set(extra);
    for(let y=startYear;y<=endYear;y++)for(const date of bavarianHolidays(y))all.add(date);
    return [...all].sort();
  }
  function projectWorkingDate(date,blocked){
    const d=parseDate(date),wd=d.getUTCDay();
    return wd>0&&wd<6&&!blocked.has(date);
  }
  function workdayDatesFrom(anchor,blocked){
    if(!validDateKey(anchor))throw Error('Ungültiger Projektstart');
    let d=parseDate(anchor);
    while(!projectWorkingDate(iso(d),blocked))d.setUTCDate(d.getUTCDate()+1);
    const dates=[iso(d)];
    return index=>{
      if(!Number.isInteger(index)||index<0||index>2500)throw Error('Ungültiger Arbeitstag-Offset');
      while(dates.length<=index){
        do{d.setUTCDate(d.getUTCDate()+1)}while(!projectWorkingDate(iso(d),blocked));
        dates.push(iso(d));
      }
      return dates[index];
    };
  }
  function cloneStateForProject(templateState,{start,number,name,phase,version,today,fachplanerAlreadyCommissioned=false,includePostIssueLPH5=false}){
    if(!validDateKey(start)||isWeekend(parseDate(start)))throw Error('Bitte gültigen Werktag eingeben.');
    const state=JSON.parse(JSON.stringify(templateState));
    const templateBase=state.project.start;
    const fromYear=Number(start.slice(0,4)),originalExceptions=state.project?.calendar?.nonWorkingDates||[];
    const blocked=new Set(projectHolidayDates(fromYear,Math.min(2100,fromYear+5),originalExceptions));
    if(blocked.has(start))throw Error('Projektstart liegt auf einem Feiertag oder arbeitsfreien Tag.');
    const at=workdayDatesFrom(start,blocked);
    state.project={...state.project,
      name:number+' '+name+' · '+phase.replace('LPH','LPH '),
      projectNumber:number,projectName:name,phase,templateVersion:version,start,
      standDate:today,standLabel:'Projektstart',
      calendar:{...(state.project.calendar||{}),region:'DE-BY',nonWorkingDates:[...blocked].sort()}};
    if(state.project.scheduleModel==='network-v1'){
      const skip=phase==='LPH3'&&!!fachplanerAlreadyCommissioned;
      state.project.planningAssumptions={
        fachplanerAlreadyCommissioned:phase==='LPH3'&&skip,
        includePostIssueLPH5:phase==='LPH5'&&!!includePostIssueLPH5,
        requiredDisciplines:['TWP','HLS','ELT'],
        note:'BRS projektspezifisch ergänzen; Feiertage auf kommunale Besonderheiten prüfen. Bei LPH5 spätere Planläufe nur mit realen Voraussetzungen terminieren.'
      };
      state.tasks=(state.tasks||[]).filter(t=>
        (!skip||t.planningCondition!=='commissioning_pending')&&
        (phase!=='LPH5'||includePostIssueLPH5||t.planningCondition!=='post_issue_optional')
      );
      const byId=new Map(state.tasks.map(t=>[t.id,t]));
      if(skip){
        const gate=byId.get('t053');
        if(gate){
          gate.name='M00A · Fachplanerbeauftragung laut Eingabe bereits erfolgt';
          gate.dependencies=[{pred:'t002',rel:'AA',lagDays:0}];
          gate.pred='t002';gate.rel='AA';
        }
      }
      const scheduled=new Map(),visiting=new Set();
      function visit(id){
        if(scheduled.has(id))return scheduled.get(id);
        if(visiting.has(id))throw Error('Zyklische Terminplan-Verknüpfung');
        const task=byId.get(id);if(!task)throw Error('Unbekannter Vorgänger im Muster: '+id);
        visiting.add(id);
        const duration=task.type==='milestone'?0:task.durationAT;
        if(!Number.isInteger(duration)||duration<0||duration>260||(duration===0&&task.type!=='milestone'))
          throw Error('Ungültige Musterdauer: '+id);
        const span=Math.max(0,duration-1);
        let begin=Number.isInteger(task.earliestOffsetAT)?task.earliestOffsetAT:0;
        for(const dep of task.dependencies||[]){
          const prev=visit(dep.pred),lag=dep.lagDays??0,rel=dep.rel||'EA';
          if(!Number.isInteger(lag)||Math.abs(lag)>260)throw Error('Ungültiger Verknüpfungsabstand');
          if(rel==='EA')begin=Math.max(begin,prev.end+lag);
          else if(rel==='AA')begin=Math.max(begin,prev.start+lag);
          else if(rel==='EE')begin=Math.max(begin,prev.end+lag-span);
          else if(rel==='AE')begin=Math.max(begin,prev.start+lag-span);
          else throw Error('Unbekannter Verknüpfungstyp');
        }
        if(begin<0||begin+span>2500)throw Error('Muster außerhalb des Projektzeitraums');
        const dates={start:begin,end:begin+span};
        scheduled.set(id,dates);visiting.delete(id);
        return dates;
      }
      for(const task of state.tasks){
        const dates=visit(task.id);
        task.start=at(dates.start);task.end=at(dates.end);
        task.pred=task.dependencies?.[0]?.pred||'';
        task.rel=task.dependencies?.[0]?.rel||'EA';
      }
    }else{
      // Older LPH templates remain usable; generated dates now avoid Bavarian holidays.
      const base=templateBase;
      state.tasks=(state.tasks||[]).map(task=>{
        const first=workdayOffset(base,task.start),last=workdayOffset(base,task.end);
        return {...task,start:at(first),end:at(Math.max(first,last))};
      });
    }
    state.project.end=(state.tasks||[]).reduce((date,t)=>t.end>date?t.end:date,start);
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
  // Window-style addresses: #kalender, #work, #project=<id>, #project=<id>/planner, #tools, #plans, #members.
  const VIEWS=['kalender','work','project','tools','plans','members'];
  function viewFromHash(hash){
    const raw=String(hash||'').replace(/^#/,'');
    const [name,value]=raw.split('=');
    if(name==='project'){
      const m=/^([0-9a-f-]{36})(?:\/(planner))?$/i.exec(value||'');
      if(m)return {view:'project',id:m[1].toLowerCase(),tab:m[2]?'planner':'panorama'};
    }
    return {view:VIEWS.includes(name)&&name!=='project'?name:'work',id:null,tab:null};
  }
  function hashFor(view,id,tab){return view==='project'&&id?'#project='+id+(tab==='planner'?'/planner':''):'#'+view}

  // ── Planner and Kalender ───────────────────────────────────────────────
  const WEEKDAYS=['Mo','Di','Mi','Do','Fr','Sa','So'];
  const MONTHS=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const addDays=(s,n)=>{const d=parseDate(s);d.setUTCDate(d.getUTCDate()+n);return iso(d)};
  const mondayOf=s=>{const d=parseDate(s);return addDays(s,-((d.getUTCDay()+6)%7))};
  function weekDays(anchor){const mon=mondayOf(anchor);return Array.from({length:7},(_,i)=>addDays(mon,i))}
  // Six weeks from the Monday on or before the 1st: a stable month grid.
  function monthGrid(anchor){const first=anchor.slice(0,7)+'-01';const start=mondayOf(first);return Array.from({length:42},(_,i)=>addDays(start,i))}
  function isoWeek(s){
    const d=parseDate(s);d.setUTCDate(d.getUTCDate()+3-((d.getUTCDay()+6)%7));
    const jan4=new Date(Date.UTC(d.getUTCFullYear(),0,4));
    return 1+Math.round(((d-jan4)/864e5-3+((jan4.getUTCDay()+6)%7))/7);
  }
  function weekTitle(anchor){
    const days=weekDays(anchor),a=parseDate(days[0]),b=parseDate(days[6]);
    const span=a.getUTCMonth()===b.getUTCMonth()
      ?`${a.getUTCDate()}.–${b.getUTCDate()}. ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`
      :`${a.getUTCDate()}. ${MONTHS[a.getUTCMonth()]} – ${b.getUTCDate()}. ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
    return `KW ${isoWeek(days[0])} · ${span}`;
  }
  function monthTitle(anchor){const d=parseDate(anchor);return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`}
  function shiftAnchor(anchor,mode,dir){
    if(mode==='month'){const d=parseDate(anchor.slice(0,7)+'-01');d.setUTCMonth(d.getUTCMonth()+dir);return iso(d)}
    return addDays(anchor,7*dir);
  }
  // A person's Kalender: what is assigned to them, and their own unassigned tasks.
  function mineForCalendar(tasks,uid){
    return (tasks||[]).filter(t=>t&&(t.assignee_id===uid||(!t.assignee_id&&t.created_by===uid)));
  }
  function tasksOnDay(tasks,day){
    return (tasks||[]).filter(t=>t.due_date===day)
      .sort((a,b)=>(a.completed_at?1:0)-(b.completed_at?1:0)||(a.kind==='abgabe'?-1:0)-(b.kind==='abgabe'?-1:0)||String(a.title).localeCompare(String(b.title),'de'));
  }
  function overdueTasks(tasks,today){return (tasks||[]).filter(t=>!t.completed_at&&t.due_date&&t.due_date<today).sort((a,b)=>a.due_date.localeCompare(b.due_date))}
  function dueLabel(day,today){
    if(!day)return '';
    if(day===today)return 'Heute';
    if(day===addDays(today,1))return 'Morgen';
    if(day===addDays(today,-1))return 'Gestern';
    const d=parseDate(day);
    return `${WEEKDAYS[(d.getUTCDay()+6)%7]}., ${String(d.getUTCDate()).padStart(2,'0')}.${String(d.getUTCMonth()+1).padStart(2,'0')}.`+(day.slice(0,4)!==today.slice(0,4)?day.slice(2,4):'');
  }
  // Who may change a task or bucket in the page: the same rule as the database.
  function canEditTask(t,uid,leads){return !!t&&(t.created_by===uid||t.assignee_id===uid||(!!t.project_id&&!!leads))}
  function canDeleteTask(t,uid,leads){return !!t&&(t.created_by===uid||(!!t.project_id&&!!leads))}
  function canEditBucket(b,uid,leads){return !!b&&(b.created_by===uid||!!leads)}
  function nextPosition(items){return (items||[]).reduce((m,x)=>Math.max(m,Number(x.position)||0),0)+1}
  function checklistProgress(list){const items=Array.isArray(list)?list:[];return {done:items.filter(x=>x&&x.done).length,total:items.length}}
  const TASK_ERRORS=Object.freeze({
    personal_task_is_own:'Persönliche Aufgaben gehören nur Ihnen.',
    personal_task_without_bucket:'Persönliche Aufgaben haben keinen Bucket.',
    bucket_of_other_project:'Dieser Bucket gehört zu einem anderen Projekt.',
    assignee_not_member:'Diese Person hat keinen aktiven Office-Zugang.'
  });
  function taskErrorText(error){
    const msg=String(error?.message||'');
    for(const [code,text] of Object.entries(TASK_ERRORS))if(msg.includes(code))return text;
    if(String(error?.code)==='42501')return 'Dafür fehlt Ihnen die Berechtigung.';
    return 'Die Änderung konnte nicht gespeichert werden.';
  }

  return {iso,parseDate,isWeekend,nextWorkday,addWorkdays,workdayOffset,formatDate,esc,todayKey,
    cloneStateForProject,bavarianHolidays,projectHolidayDates,validDateKey,passwordProblem,ROLE_LABELS,canLead,adminErrorText,authErrorText,
    initials,nextMilestone,viewFromHash,hashFor,
    WEEKDAYS,MONTHS,addDays,mondayOf,weekDays,monthGrid,isoWeek,weekTitle,monthTitle,shiftAnchor,
    mineForCalendar,tasksOnDay,overdueTasks,dueLabel,canEditTask,canDeleteTask,canEditBucket,nextPosition,checklistProgress,taskErrorText};
});
