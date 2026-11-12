/*
 * TBA Office Terminplan · presentation-only dependency links.
 * Four display modes share the same underlying immutable DAG.
 * "Übersicht" picks ONE representative predecessor per target using the
 * strongest currently scheduled start constraint (EA/AA/EE/AE + AT lag).
 * It is NOT a critical-path calculation and never removes another dependency.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.TBATerminplanLinkView=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const MODES=Object.freeze(['hidden','overview','selected','all']);
  const RELS=new Set(['EA','AA','EE','AE']);
  const ISO=/^\d{4}-\d{2}-\d{2}$/;
  function normalizeMode(value){
    return MODES.includes(value)?value:'overview';
  }
  function validDay(s){
    if(typeof s!=='string'||!ISO.test(s))return false;
    const n=Date.parse(s+'T00:00:00Z');
    return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s;
  }
  // Workday ordinals, using the exact project's weekend and non-working
  // calendar convention. Missing/invalid dates only affect display ranking.
  // The network engine remains the authority for validated schedules.
  function workIndices(tasks,calendar){
    const dates=[];
    for(const t of tasks){
      if(validDay(t?.start))dates.push(t.start);
      if(validDay(t?.end))dates.push(t.end);
    }
    if(!dates.length)return null;
    dates.sort();
    const first=Date.parse(dates[0]+'T00:00:00Z');
    const last=Date.parse(dates[dates.length-1]+'T00:00:00Z');
    if(last-first>86400000*365*12)return null;
    const exceptions=new Set(Array.isArray(calendar?.nonWorkingDates)?calendar.nonWorkingDates:[]);
    const index=new Map();
    let n=0;
    for(let day=first;day<=last;day+=86400000){
      const d=new Date(day),date=d.toISOString().slice(0,10);
      if(d.getUTCDay()!==0&&d.getUTCDay()!==6&&!exceptions.has(date))index.set(date,n++);
    }
    return index;
  }
  function constraint(dep,pred,target,index){
    if(!index||!RELS.has(dep.rel||'EA')||!Number.isInteger(dep.lagDays??0))return null;
    const ps=index.get(pred?.start),pe=index.get(pred?.end);
    const ss=index.get(target?.start),se=index.get(target?.end);
    if([ps,pe,ss,se].some(v=>v===undefined)||pe<ps||se<ss)return null;
    const lag=dep.lagDays??0,span=se-ss;
    switch(dep.rel||'EA'){
      case 'EA':return pe+lag;
      case 'AA':return ps+lag;
      case 'EE':return pe+lag-span;
      case 'AE':return ps+lag-span;
      default:return null;
    }
  }
  function edgeKey(edge){
    return [edge.pred,edge.target,edge.rel,edge.lagDays].join('\u001f');
  }
  function visibleConnections(tasks,visibleIds,mode,selectedId,dependenciesOf,calendar){
    const view=normalizeMode(mode);
    if(view==='hidden'||!Array.isArray(tasks))return [];
    const visible=new Set(visibleIds||[]);
    if(view==='selected'&&(!selectedId||!visible.has(selectedId)))return [];

    const byId=new Map(tasks.filter(t=>t?.id).map(t=>[t.id,t]));
    const all=[],grouped=new Map();
    for(const target of tasks){
      if(!target?.id)continue;
      const deps=typeof dependenciesOf==='function'?dependenciesOf(target):
        (Array.isArray(target.dependencies)?target.dependencies:[]);
      if(!Array.isArray(deps))continue;
      for(const dep of deps){
        if(!dep?.pred||!byId.has(dep.pred))continue;
        const edge={pred:dep.pred,target:target.id,rel:dep.rel||'EA',
          lagDays:dep.lagDays??0};
        all.push(edge);
        if(!grouped.has(target.id))grouped.set(target.id,[]);
        grouped.get(target.id).push(edge);
      }
    }
    const shown=edge=>visible.has(edge.pred)&&visible.has(edge.target);
    if(view==='all')return all.filter(shown).map(e=>({...e,direction:'all'}));
    if(view==='selected')return all.filter(e=>shown(e)&&(e.pred===selectedId||e.target===selectedId))
      .map(e=>({...e,direction:e.target===selectedId?'incoming':'outgoing'}));

    // Overview is computed from the full plan BEFORE filtering rows, so
    // searching/collapsing does not silently nominate a different predecessor.
    const index=workIndices(tasks,calendar);
    const chosen=new Map();
    for(const [targetId,edges] of grouped){
      const target=byId.get(targetId);
      const ranked=edges.map(e=>{
        const pred=byId.get(e.pred);
        return {
          edge:e,
          score:constraint(e,pred,target,index),
          cross:!!pred?.group&&!!target?.group&&pred.group!==target.group,
          milestone:pred?.type==='milestone'
        };
      });
      ranked.sort((a,b)=>{
        const av=a.score===null?-Infinity:a.score,bv=b.score===null?-Infinity:b.score;
        if(av!==bv)return bv-av;
        if(a.cross!==b.cross)return Number(b.cross)-Number(a.cross);
        if(a.milestone!==b.milestone)return Number(b.milestone)-Number(a.milestone);
        return edgeKey(a.edge).localeCompare(edgeKey(b.edge),'en');
      });
      if(ranked.length)chosen.set(targetId,ranked[0].edge);
    }
    const result=new Map();
    for(const edge of chosen.values()){
      if(shown(edge))result.set(edgeKey(edge),{...edge,direction:'overview'});
    }
    // Inspecting a task in overview adds its other DIRECT links, in the
    // familiar selection colors. This does not alter the representative links.
    if(selectedId&&visible.has(selectedId)){
      for(const edge of all){
        if(!shown(edge)||edge.target!==selectedId&&edge.pred!==selectedId)continue;
        result.set(edgeKey(edge),{...edge,
          direction:edge.target===selectedId?'incoming':'outgoing'});
      }
    }
    return [...result.values()];
  }
  return Object.freeze({MODES,normalizeMode,visibleConnections});
});
