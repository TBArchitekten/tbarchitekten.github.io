/*
 * TBA Office · Terminplan network analysis v1.
 * Pure, deterministic, side-effect-free. Does NOT reschedule without confirmation.
 * The day-granular Office convention treats EA+0 as same-day handover.
 * This is not the hour-granular MS Project default.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.TBATerminplanPlanning=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const RELS=new Set(['EA','AA','EE','AE']);
  const clone=x=>JSON.parse(JSON.stringify(x));
  const day=s=>new Date(s+'T00:00:00Z');
  const iso=d=>d.toISOString().slice(0,10);
  function validDate(s){
    if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
    const d=day(s);return Number.isFinite(d.getTime())&&iso(d)===s;
  }
  function dependencies(t){
    if(Array.isArray(t?.dependencies))return t.dependencies;
    return t?.pred?[{pred:t.pred,rel:t.rel||'EA',lagDays:0}]:[];
  }
  function workday(s,calendar){
    const d=day(s),w=d.getUTCDay();
    return w!==0&&w!==6&&!calendar.has(s);
  }
  function calendarOf(state){
    const raw=state?.project?.calendar?.nonWorkingDates;
    if(raw!==undefined&&(!Array.isArray(raw)||raw.some(s=>!validDate(s))))
      throw Error('Projektkalender enthält ungültige Tage.');
    return new Set(raw||[]);
  }
  function calendarIndex(state){
    const tasks=state?.tasks||[];
    const bounds=[state?.project?.start,state?.project?.end];
    for(const t of tasks)bounds.push(t.start,t.end,t.deadline,t.protectedDate);
    const dates=bounds.filter(validDate).sort();
    if(!dates.length)throw Error('Keine gültigen Termine.');
    const from=day(dates[0]),to=day(dates[dates.length-1]);
    if((to-from)/86400000>365*12)throw Error('Netzplanzeitraum überschreitet 12 Jahre.');
    from.setUTCDate(from.getUTCDate()-400);
    to.setUTCDate(to.getUTCDate()+400);
    const exceptions=calendarOf(state),days=[],index=new Map();
    for(let d=new Date(from);d<=to;d.setUTCDate(d.getUTCDate()+1)){
      const s=iso(d);
      if(workday(s,exceptions)){index.set(s,days.length);days.push(s)}
    }
    return {index,days,exceptions};
  }
  function edgeOffset(dep,predSpan,succSpan){
    const lag=dep.lagDays??0;
    switch(dep.rel||'EA'){
      case 'EA':return predSpan+lag;
      case 'AA':return lag;
      case 'EE':return predSpan+lag-succSpan;
      case 'AE':return lag-succSpan;
      default:throw Error('Unbekannte Anordnungsbeziehung.');
    }
  }
  function topology(tasks){
    const byId=new Map(),order=[],color=new Map(),successors=new Map();
    for(const t of tasks){
      if(!t?.id||byId.has(t.id))throw Error('Vorgang-ID fehlt oder ist doppelt.');
      byId.set(t.id,t);
    }
    for(const t of tasks){
      const fingerprints=new Set();
      for(const dep of dependencies(t)){
        if(!dep||!byId.has(dep.pred)||!RELS.has(dep.rel||'EA')||
           !Number.isInteger(dep.lagDays??0)||Math.abs(dep.lagDays??0)>260)
          throw Error('Ungültiger oder fehlender Vorgänger bei '+t.id+'.');
        const key=dep.pred+':'+(dep.rel||'EA');
        if(fingerprints.has(key))throw Error('Doppelte Verknüpfung bei '+t.id+'.');
        fingerprints.add(key);
        if(!successors.has(dep.pred))successors.set(dep.pred,[]);
        successors.get(dep.pred).push(t.id);
      }
    }
    function visit(id){
      const c=color.get(id)||0;
      if(c===1)throw Error('Zyklische Abhängigkeit im Netzplan.');
      if(c===2)return;
      color.set(id,1);
      for(const dep of dependencies(byId.get(id)))visit(dep.pred);
      color.set(id,2);order.push(id);
    }
    for(const id of byId.keys())visit(id);
    return {byId,order,successors};
  }
  function analyze(state){
    try{
      const tasks=state?.tasks||[];
      if(!tasks.length)throw Error('Keine Vorgänge vorhanden.');
      const graph=topology(tasks),cal=calendarIndex(state);
      const records=new Map();
      for(const t of tasks){
        if(!validDate(t.start)||!validDate(t.end)||t.end<t.start)throw Error('Ungültige Vorgangstermine: '+t.id);
        const start=cal.index.get(t.start),end=cal.index.get(t.end);
        if(start===undefined||end===undefined)throw Error('Vorgang beginnt oder endet arbeitsfrei: '+t.id);
        if(t.type==='milestone'&&start!==end)throw Error('Meilenstein mit Dauer: '+t.id);
        records.set(t.id,{task:t,start,end,span:end-start,latest:null,freeFloatAT:null,totalFloatAT:null,critical:false});
      }
      for(const t of tasks)for(const dep of dependencies(t)){
        const p=records.get(dep.pred),s=records.get(t.id),offset=edgeOffset(dep,p.span,s.span);
        if(s.start<p.start+offset)
          throw Error('Anordnungsbeziehung verletzt: '+dep.pred+' → '+t.id+' (Netzplan zuerst korrigieren).');
      }
      const horizon=Math.max(...[...records.values()].map(r=>r.end));
      for(const id of [...graph.order].reverse()){
        const r=records.get(id);
        let latest=horizon-r.span;
        let free=latest-r.start;
        const cap=[r.task.deadline,r.task.protectedDate].filter(Boolean).sort()[0];
        if(cap){
          if(!validDate(cap))throw Error('Ungültiger Termin bei '+id);
          // A deadline may be a weekend/holiday; last preceding workday is the
          // effective comparison date, without changing the stored deadline.
          let capIndex=cal.index.get(cap);
          if(capIndex===undefined){
            const day=cap+'T00:00:00Z';
            const stamp=Date.parse(day);
            capIndex=cal.days.findLastIndex(d=>Date.parse(d+'T00:00:00Z')<=stamp);
          }
          if(capIndex<0||capIndex===undefined)throw Error('Deadline liegt außerhalb des Projektkalenders: '+id);
          latest=Math.min(latest,capIndex-r.span);
          free=Math.min(free,capIndex-r.span-r.start);
        }
        for(const succId of graph.successors.get(id)||[]){
          const s=records.get(succId);
          for(const dep of dependencies(s.task).filter(x=>x.pred===id)){
            const offset=edgeOffset(dep,r.span,s.span);
            latest=Math.min(latest,s.latest-offset);
            free=Math.min(free,s.start-offset-r.start);
          }
        }
        r.latest=latest;
        r.totalFloatAT=latest-r.start;
        r.freeFloatAT=free;
        r.critical=r.totalFloatAT<=0;
      }
      const result={};
      for(const [id,r] of records)result[id]={
        start:r.task.start,end:r.task.end,
        totalFloatAT:r.totalFloatAT,freeFloatAT:r.freeFloatAT,
        critical:r.critical,deadlineMiss:!!r.task.deadline&&r.task.end>r.task.deadline,
        protectedMiss:!!r.task.protectedDate&&r.task.end>r.task.protectedDate
      };
      return {valid:true,reason:null,byId:result,criticalCount:Object.values(result).filter(r=>r.critical).length,
        projectFinish:cal.days[horizon],calendar:cal,taskCount:tasks.length};
    }catch(e){return {valid:false,reason:e?.message||'Netzplan nicht auswertbar',byId:{},criticalCount:0,taskCount:state?.tasks?.length||0}};
  }
  function captureBaseline(state,label,recordedAt){
    if(!state?.project||!Array.isArray(state.tasks))throw Error('Ungültiger Terminplan');
    const name=String(label||'').trim().slice(0,120);
    if(!name)throw Error('Bezeichnung für Basisplan erforderlich.');
    if(!recordedAt||!Number.isFinite(Date.parse(recordedAt)))throw Error('Zeitpunkt fehlt.');
    const copy=clone(state),baselines=copy.project.baselines||[];
    if(!Array.isArray(baselines)||baselines.length>=10)throw Error('Maximal 10 Basispläne. Vorherige Stände bleiben erhalten.');
    const no=baselines.reduce((n,b)=>Math.max(n,Number(String(b.id||'').replace('BL-',''))||0),0)+1;
    const baseline={id:'BL-'+String(no).padStart(3,'0'),label:name,recordedAt,
      project:{start:copy.project.start,end:copy.project.end},
      tasks:copy.tasks.map(t=>({id:t.id,name:t.name,start:t.start,end:t.end,effortHours:t.effortHours??null}))};
    copy.project.baselines=[...baselines,baseline];
    copy.project.activeBaselineId=baseline.id;
    return {state:copy,baseline};
  }
  function selectedBaseline(state){
    const list=state?.project?.baselines||[];
    return list.find(b=>b.id===state.project.activeBaselineId)||list[list.length-1]||null;
  }
  function baselineVariance(state,baseline){
    if(!baseline)return {};
    const old=new Map((baseline.tasks||[]).map(t=>[t.id,t]));
    const result={};
    const diff=(a,b)=>validDate(a)&&validDate(b)?Math.round((day(a)-day(b))/86400000):null;
    for(const t of state.tasks||[]){
      const previous=old.get(t.id);
      result[t.id]=previous?{
        startDeltaKT:diff(t.start,previous.start),
        finishDeltaKT:diff(t.end,previous.end),
        baselineStart:previous.start,baselineFinish:previous.end,
        baselineEffortHours:previous.effortHours??null
      }:null;
    }
    return result;
  }
  // Forward-only successor proposal: successors are not changed unless the editor
  // separately confirms and writes this clone through the revisioned save path.
  function previewSuccessors(state,originId){
    const copy=clone(state),graph=topology(copy.tasks),cal=calendarIndex(copy);
    if(!graph.byId.has(originId))throw Error('Bitte einen Vorgang auswählen.');
    const before=analyze(copy);
    const byId=graph.byId,changed=[],visited=new Set([originId]);
    const reachable=new Set();
    const collect=id=>{
      for(const successor of graph.successors.get(id)||[])if(!reachable.has(successor)){
        reachable.add(successor);collect(successor);
      }
    };
    collect(originId);
    for(const id of graph.order){
      if(!reachable.has(id))continue;
      const t=byId.get(id);
      if(!validDate(t.start)||!validDate(t.end)||t.end<t.start||!cal.index.has(t.start)||!cal.index.has(t.end))
        throw Error('Nachfolger hat einen ungültigen oder arbeitsfreien Termin.');
      const span=cal.index.get(t.end)-cal.index.get(t.start);
      let required=cal.index.get(t.start);
      for(const dep of dependencies(t)){
        const p=byId.get(dep.pred);
        if(!cal.index.has(p.start)||!cal.index.has(p.end))throw Error('Vorgänger liegt außerhalb des Arbeitskalenders.');
        const pspan=cal.index.get(p.end)-cal.index.get(p.start);
        required=Math.max(required,cal.index.get(p.start)+edgeOffset(dep,pspan,span));
      }
      if(required>cal.index.get(t.start)){
        if(required+span>=cal.days.length)throw Error('Verschiebung überschreitet Projektkalender.');
        changed.push({id,name:t.name,before:{start:t.start,end:t.end},
          after:{start:cal.days[required],end:cal.days[required+span]}});
        t.start=cal.days[required];t.end=cal.days[required+span];
      }
      visited.add(id);
    }
    // Keep the visible Gantt range inclusive of explicitly confirmed successors.
    const latest=(copy.tasks||[]).reduce((m,t)=>t.end>m?t.end:m,copy.project.end||'');
    if(!copy.project.end||latest>copy.project.end)copy.project.end=latest;
    const after=analyze(copy);
    if(!after.valid)throw Error(after.reason);
    return {state:copy,updates:changed,affectedIds:[...reachable],
      beforeValid:before.valid,afterValid:after.valid,
      missedDeadlines:changed.filter(x=>{
        const t=byId.get(x.id);
        return !!(t.deadline&&t.end>t.deadline||t.protectedDate&&t.end>t.protectedDate);
      }).map(x=>x.id)};
  }
  /*
   * Read-only "Was wäre wenn?" calculation. A later Fachplaner DELIVERY
   * extends the finish while retaining the recorded start, unlike moving
   * the entire bar. Then only documented dependency successors are moved
   * forward in a detached clone; no write, model output, or approval.
   * Current CPM includes soft deadline caps; do NOT present criticalCount
   * as a pure project-finish-critical-path metric.
   */
  function simulateFinishDelay(state,originId,extraAT){
    if(!Number.isInteger(extraAT)||extraAT<1||extraAT>130)
      return {valid:false,reason:'Bitte 1 bis 130 zusätzliche Arbeitstage angeben.'};
    try{
      const source=clone(state),byId=new Map((source.tasks||[]).map(t=>[t.id,t]));
      const target=byId.get(originId);
      if(!target)throw Error('Bitte einen eindeutig identifizierten Vorgang auswählen.');
      const before=analyze(source);
      if(!before.valid)throw Error('Der bestehende Netzplan ist nicht konsistent: '+before.reason);
      const cal=calendarIndex(source);
      const oldEnd=cal.index.get(target.end);
      if(oldEnd===undefined||oldEnd+extraAT>=cal.days.length)
        throw Error('Liefertermin außerhalb des verfügbaren Arbeitskalenders.');
      const priorEnd=target.end,priorStart=target.start;
      target.end=cal.days[oldEnd+extraAT];
      if(target.type==='milestone')target.start=target.end;
      // The simulation expands the horizon in the clone, never the source.
      if(target.end>source.project.end)source.project.end=target.end;
      const cascade=previewSuccessors(source,originId);
      const after=analyze(cascade.state);
      if(!after.valid)throw Error('Der hypothetische Nachfolgerplan ist nicht auswertbar: '+after.reason);
      const newTasks=new Map(cascade.state.tasks.map(t=>[t.id,t]));
      const warnings=[],previousWarnings=[];
      for(const t of state.tasks||[]){
        const hypothetic=newTasks.get(t.id);
        if(!hypothetic)continue;
        for(const [field,kind] of [['deadline','Deadline'],['protectedDate','geschützter Abgabetermin']]){
          if(!t[field])continue;
          if(t.end>t[field])previousWarnings.push({id:t.id,name:t.name,kind,limit:t[field]});
          if(hypothetic.end>t[field])
            warnings.push({id:t.id,name:t.name,kind,limit:t[field],end:hypothetic.end,
              newOverrun:t.end<=t[field]});
        }
      }
      const startIndex=cal.index.get(before.projectFinish),endIndex=cal.index.get(after.projectFinish);
      return {
        valid:true,kind:'read_only_finish_delay',taskId:originId,taskName:target.name,
        extraAT,assumption:'start_unchanged_finish_extended',
        before:{start:priorStart,end:priorEnd,projectFinish:before.projectFinish,
          totalFloatAT:before.byId[originId]?.totalFloatAT??null,criticalCount:before.criticalCount},
        after:{start:target.start,end:target.end,projectFinish:after.projectFinish,
          totalFloatAT:after.byId[originId]?.totalFloatAT??null,criticalCount:after.criticalCount},
        projectFinishDeltaAT:endIndex-startIndex,
        changedSuccessors:cascade.updates,
        affectedCount:cascade.affectedIds.length,
        newWarnings:warnings.filter(x=>x.newOverrun),
        allWarnings:warnings,existingWarnings:previousWarnings,
        changedIndicatorIds:Object.keys(after.byId).filter(id=>
          after.byId[id].critical&&!before.byId[id]?.critical).sort(),
        disclaimer:'Nur eingetragene Beziehungen; keine Kapazitäts-/Ressourcensimulation. Kritischindikator berücksichtigt bestehende Deadline-Grenzen.',
        sourceUnmodified:true
      };
    }catch(e){return {valid:false,reason:e?.message||'Keine belastbare Netzplansimulation möglich.'};}
  }
  return Object.freeze({validDate,dependencies,calendarOf,topology,analyze,captureBaseline,
    selectedBaseline,baselineVariance,previewSuccessors,simulateFinishDelay});
});
