/*
 * TBA Office · Terminplan dependency engine v0.2.
 * Pure deterministic checks; no network, browser state, or automatic rescheduling.
 * Canonical new representation: dependencies:[{pred,rel,lagDays}].
 * Old records: pred/rel remain readable and are not silently migrated.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.TBATerminplanEngine=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
  "use strict";
  const RELS=new Set(["EA","AA","EE","AE"]);
  function validDate(value){
    if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const date=new Date(value+"T00:00:00Z");
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
  }
  function calendarOf(state){
    const dates=state?.project?.calendar?.nonWorkingDates;
    return {nonWorkingDates:Array.isArray(dates)?dates.filter(validDate):[]};
  }
  function workday(date,calendar={}){
    if(!validDate(date))return false;
    const day=new Date(date+"T00:00:00Z").getUTCDay();
    return day!==0&&day!==6&&!(calendar.nonWorkingDates||[]).includes(date);
  }
  function shiftWorkdays(date,offset,calendar={}){
    if(!validDate(date)||!Number.isInteger(offset)||Math.abs(offset)>10000)throw new Error("Invalid workday shift");
    if(offset===0)return date;
    const d=new Date(date+"T00:00:00Z"),step=Math.sign(offset);
    let remain=Math.abs(offset);
    while(remain){
      d.setUTCDate(d.getUTCDate()+step);
      if(workday(d.toISOString().slice(0,10),calendar))remain--;
    }
    return d.toISOString().slice(0,10);
  }
  function dependencies(task){
    if(!task)return [];
    if(Array.isArray(task.dependencies))return task.dependencies;
    return task.pred?[{pred:task.pred,rel:task.rel||"EA",lagDays:0}]:[];
  }
  function issue(code,taskId,predId,extra={}){
    return {code,taskId:String(taskId||""),predecessorId:String(predId||""),severity:"error",
      key:code+":"+String(taskId||"")+":"+String(predId||"")+":"+(extra.relation||""),...extra};
  }
  function dependencyRule(predecessor,task,dep,calendar={}){
    const rel=dep.rel||"EA";
    if(!RELS.has(rel))return null;
    const source=rel==="EA"||rel==="EE"?"end":"start";
    const target=rel==="EA"||rel==="AA"?"start":"end";
    const lag=dep.lagDays??0;
    if(!Number.isInteger(lag)||Math.abs(lag)>260)return null;
    const minimum=shiftWorkdays(predecessor[source],lag,calendar);
    return {relation:rel,targetSide:target,minimum,actual:task[target],lagDays:lag};
  }
  function analyze(state){
    const tasks=Array.isArray(state?.tasks)?state.tasks:[];
    const project=state?.project||{};
    const calendar=calendarOf(state);
    const issues=[],map=new Map(),graph=new Map();
    const exceptions=project?.calendar?.nonWorkingDates;
    if(exceptions!==undefined&&(!Array.isArray(exceptions)||exceptions.some(x=>!validDate(x))))
      issues.push(issue("invalid_calendar","",""));
    for(const t of tasks){
      if(!t||typeof t.id!=="string"||!t.id){issues.push(issue("invalid_id","",""));continue;}
      if(map.has(t.id))issues.push(issue("duplicate_id",t.id,""));
      else map.set(t.id,t);
    }
    for(const t of tasks){
      if(!t||!t.id)continue;
      if(!validDate(t.start)||!validDate(t.end)){issues.push(issue("invalid_date",t.id,""));continue;}
      if(t.end<t.start)issues.push(issue("invalid_range",t.id,""));
      if(t.type==="milestone"&&t.end!==t.start)issues.push(issue("milestone_span",t.id,""));
      if(validDate(project.end)&&t.end>project.end)
        issues.push(issue("project_horizon",t.id,"",{severity:"warning",actual:t.end,minimum:project.end}));
      if(t.protectedDate!==undefined&&t.protectedDate!==""){
        if(!validDate(t.protectedDate))issues.push(issue("invalid_protected_date",t.id,""));
        else if(t.end>t.protectedDate)
          issues.push(issue("protected_deadline",t.id,"",{minimum:t.protectedDate,actual:t.end}));
      }
      const links=dependencies(t);
      const fingerprints=new Set();
      for(const dep of links){
        const pred=dep?.pred;
        const rel=dep?.rel||"EA";
        if(typeof pred!=="string"||!pred||!map.has(pred)){
          issues.push(issue("missing_predecessor",t.id,pred));continue;
        }
        if(!RELS.has(rel)){
          issues.push(issue("unsupported_relation",t.id,pred,{relation:rel}));continue;
        }
        if(!Number.isInteger(dep.lagDays??0)||Math.abs(dep.lagDays??0)>260){
          issues.push(issue("invalid_lag",t.id,pred,{relation:rel}));continue;
        }
        const id=pred+":"+rel;
        if(fingerprints.has(id))issues.push(issue("duplicate_dependency",t.id,pred,{relation:rel}));
        fingerprints.add(id);
        if(!graph.has(t.id))graph.set(t.id,[]);
        graph.get(t.id).push(pred);
        const predecessor=map.get(pred);
        if(!validDate(predecessor.start)||!validDate(predecessor.end))continue;
        const rule=dependencyRule(predecessor,t,dep,calendar);
        if(rule&&t[rule.targetSide]<rule.minimum)
          issues.push(issue("dependency_violation",t.id,pred,rule));
      }
    }
    for(const v of graph.values())v.sort();
    const colors=new Map(),stack=[],seenCycles=new Set();
    function visit(id){
      colors.set(id,1);stack.push(id);
      for(const pred of graph.get(id)||[]){
        if(!map.has(pred))continue;
        const color=colors.get(pred)||0;
        if(color===0)visit(pred);
        else if(color===1){
          const cycle=stack.slice(stack.indexOf(pred)).sort(),signature=cycle.join("|");
          if(!seenCycles.has(signature)){
            seenCycles.add(signature);
            issues.push(issue("cycle",cycle[0],"",{taskIds:cycle,key:"cycle:"+signature}));
          }
        }
      }
      stack.pop();colors.set(id,2);
    }
    for(const id of [...map.keys()].sort())if(!colors.get(id))visit(id);
    issues.sort((a,b)=>a.key.localeCompare(b.key));
    return {issues,count:issues.length,errors:issues.filter(i=>i.severity==="error").length};
  }
  function downstream(state,originIds){
    const tasks=Array.isArray(state?.tasks)?state.tasks:[];
    const index=new Map();
    for(const task of tasks)for(const dep of dependencies(task)){
      if(!dep?.pred||!task?.id)continue;
      if(!index.has(dep.pred))index.set(dep.pred,[]);
      index.get(dep.pred).push(task.id);
    }
    for(const v of index.values())v.sort();
    const roots=[...new Set(originIds||[])].sort(),seen=new Set(roots),queue=[...roots],result=[];
    for(let i=0;i<queue.length;i++)for(const id of index.get(queue[i])||[]){
      if(seen.has(id))continue;
      seen.add(id);queue.push(id);result.push(id);
    }
    return result;
  }
  function compare(previous,current){
    const old=new Map((previous?.tasks||[]).filter(t=>t?.id).map(t=>[t.id,t]));
    const now=new Map((current?.tasks||[]).filter(t=>t?.id).map(t=>[t.id,t]));
    const ids=[...new Set([...old.keys(),...now.keys()])].filter(id=>{
      const a=old.get(id),b=now.get(id);
      if(!a||!b)return true;
      return ["start","end","pred","rel","dependencies","protectedDate","type"]
        .some(key=>JSON.stringify(a[key])!==JSON.stringify(b[key]));
    }).sort();
    const past=new Set(analyze(previous).issues.map(x=>x.key));
    return {changedIds:ids,downstreamIds:downstream(current,ids),
      newIssues:analyze(current).issues.filter(x=>!past.has(x.key)),
      issues:analyze(current).issues};
  }
  function previewShift(state,taskId,offset){
    if(!Number.isInteger(offset)||offset===0||Math.abs(offset)>260)throw new Error("Shift must be 1–260 working days");
    const source=state?.tasks?.find(t=>t?.id===taskId);
    if(!source||!validDate(source.start)||!validDate(source.end))throw new Error("Select a valid task");
    const copy=JSON.parse(JSON.stringify(state)),target=copy.tasks.find(t=>t.id===taskId);
    const calendar=calendarOf(copy);
    target.start=shiftWorkdays(target.start,offset,calendar);
    target.end=shiftWorkdays(target.end,offset,calendar);
    const diff=compare(state,copy);
    return {state:copy,taskId,offset,before:{start:source.start,end:source.end},
      after:{start:target.start,end:target.end},
      affectedIds:diff.downstreamIds,newIssues:diff.newIssues,allIssues:diff.issues};
  }
  return Object.freeze({validDate,workday,calendarOf,shiftWorkdays,dependencies,dependencyRule,analyze,downstream,compare,previewShift});
});
