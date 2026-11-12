/* TBA Office Terminplan: presentation-only selection of dependency lines.
 * All dependencies remain part of the canonical plan and all scheduling audits.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.TBATerminplanLinkView=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const MODES=Object.freeze(['hidden','selected','all']);
  function normalizeMode(value){
    return MODES.includes(value)?value:'selected';
  }
  function visibleConnections(tasks,visibleIds,mode,selectedId,dependenciesOf){
    const view=normalizeMode(mode);
    if(view==='hidden'||!Array.isArray(tasks))return [];
    const visible=new Set(visibleIds||[]);
    if(view==='selected'&&(!selectedId||!visible.has(selectedId)))return [];
    const all=[];
    for(const task of tasks){
      if(!task?.id||!visible.has(task.id))continue;
      const deps=typeof dependenciesOf==='function'?dependenciesOf(task):(Array.isArray(task.dependencies)?task.dependencies:[]);
      if(!Array.isArray(deps))continue;
      for(const dep of deps){
        if(!dep?.pred||!visible.has(dep.pred))continue;
        if(view==='selected'&&task.id!==selectedId&&dep.pred!==selectedId)continue;
        all.push({
          pred:dep.pred,target:task.id,rel:dep.rel||'EA',
          direction:view==='all'?'all':task.id===selectedId?'incoming':'outgoing'
        });
      }
    }
    return all;
  }
  return Object.freeze({MODES,normalizeMode,visibleConnections});
});
