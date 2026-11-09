/*
 * TBA Office · General Terminplan governance UI (all LPH and existing plans).
 * Isolated view layer. Changes enter only through editor's revisioned save path.
 */
(function(root){
 'use strict';
 const planner=root.TBATerminplanPlanning;
 if(!planner)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const fmt=s=>s?new Date(s+'T00:00:00Z').toLocaleDateString('de-DE',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric'}):'—';
 const fmtDelta=n=>n===null||n===undefined?'—':(n>0?'+':'')+n+' KT';
 const hour=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('de-DE')+' h':'—';
 let bridge=null,dialog=null,activeBaseline=null,showBaseline=true,preview=null,lastResult=null;
 function button(label,id,handler){
   const b=document.createElement('button');b.className='btn';b.type='button';b.id=id;b.textContent=label;
   b.addEventListener('click',handler);return b;
 }
 function mounted(){
   return !!bridge&&!!dialog&&!!document.getElementById('tpInsights');
 }
 function mount(options){
   if(mounted())return;
   bridge=options;
   const toolbar=document.querySelector('.toolbar'),anchor=document.getElementById('exportCsvBtn');
   if(!toolbar||!anchor)return;
   const nav=document.createElement('span');nav.className='tp-feature-actions';
   nav.append(
     button('Auswertung · Netzplan','tpOpenAnalysis',()=>open()),
     button('Basisplan sichern','tpQuickBaseline',()=>saveBaseline())
   );
   const help=document.createElement('a');help.className='btn tp-help-link';help.id='tpHelp';
   help.href='./terminplan-hilfe.html';help.target='_blank';help.rel='noopener noreferrer';
   help.textContent='Anleitung';nav.append(help);
   anchor.before(nav);
   const summary=document.createElement('span');summary.id='tpInsights';summary.className='tp-insights';summary.setAttribute('aria-live','polite');
   document.querySelector('.statusbar')?.append(summary);
   dialog=document.createElement('dialog');dialog.id='tpAnalysisDialog';dialog.className='tp-analysis-dialog';
   dialog.innerHTML='<div class="tp-modal-head"><h2>Terminplan · Auswertung</h2><button type="button" id="tpClose" aria-label="Schließen">×</button></div>'+
     '<div class="tp-analysis-body"><p id="tpAnalysisSummary" class="tp-analysis-summary"></p>'+
     '<div class="tp-analysis-actions"><label>Basisplan <select id="tpBaselineSelect"></select></label>'+
     '<label><input id="tpShowBaseline" type="checkbox" checked> Soll-Termine im Gantt anzeigen</label>'+
     '<button type="button" id="tpSaveBaseline">Basisplan sichern</button></div>'+
     '<div class="tp-analysis-actions"><label>Folgetermine für ausgewählten Vorgang prüfen</label>'+
     '<button type="button" id="tpPreviewCascade">Folgetermine vorschlagen</button>'+
     '<button type="button" id="tpApplyCascade" hidden>Vorschlag übernehmen</button></div>'+
     '<p id="tpCascadeDetails" class="tp-cascade-text" aria-live="polite"></p>'+
     '<p class="tp-explainer">Netzpuffer: rechnerisch auf Basis der aktuellen Vorgänge, Anordnungsbeziehungen und des Projektkalenders; ohne Ressourcenabgleich. Ein nicht konsistenter Netzplan zeigt keine scheinbar exakten Puffer an. Kritisch: Gesamtpuffer ≤ 0 AT. Deadlines lösen Warnungen aus, verschieben aber keine Termine. Terminabweichungen zum Basisplan in Kalendertagen (KT).</p>'+
     '<div class="tp-table-wrap"><table class="tp-analysis-table"><thead><tr><th>PSP / Vorgang</th><th>Start</th><th>Ende</th><th>Gesamtpuffer</th><th>Freier Puffer</th><th>Deadline</th><th>Basisplan Δ Ende</th><th>Aufwand</th><th>Ist-Anfang / Ist-Ende</th></tr></thead><tbody id="tpAnalysisRows"></tbody></table></div></div>';
   document.body.appendChild(dialog);
   dialog.querySelector('#tpClose').onclick=()=>dialog.close();
   dialog.querySelector('#tpSaveBaseline').onclick=()=>saveBaseline();
   dialog.querySelector('#tpBaselineSelect').onchange=e=>{
     activeBaseline=e.target.value||null;preview=null;renderAnalysis();refresh();
   };
   dialog.querySelector('#tpShowBaseline').onchange=e=>{
     showBaseline=e.target.checked;refresh();
   };
   dialog.querySelector('#tpPreviewCascade').onclick=previewSuccessors;
   dialog.querySelector('#tpApplyCascade').onclick=applySuccessors;
   dialog.addEventListener('close',()=>{preview=null});
   refresh();
 }
 function selectedBaseline(){
   const list=bridge.read()?.project?.baselines||[];
   return list.find(x=>x.id===activeBaseline)||planner.selectedBaseline(bridge.read())||null;
 }
 function saveBaseline(){
   if(!bridge?.canEdit()){root.alert('Nur mit Bearbeitungsrecht und ohne Speicherkonflikt möglich.');return;}
   const state=bridge.read();
   const date=new Date().toLocaleDateString('de-DE');
   const label=root.prompt('Bezeichnung des neuen Basisplan-Snapshots', 'Freigabestand '+date);
   if(label===null)return;
   try{
     const r=planner.captureBaseline(state,label,new Date().toISOString());
     activeBaseline=r.baseline.id;preview=null;
     bridge.write(r.state);
     root.alert('Basisplan in der lokalen Planung ergänzt. Die bestätigte Speicherung wird über die Serverrevision geprüft.');
     if(dialog?.open)renderAnalysis();
   }catch(e){root.alert(e.message||'Basisplan konnte nicht erstellt werden.');}
 }
 function open(){
   if(!mounted())return;
   preview=null;
   renderAnalysis();dialog.showModal();
 }
 function previewSuccessors(){
   if(!bridge?.canEdit()){root.alert('Keine Bearbeitungsberechtigung.');return}
   const id=bridge.selected();
   if(!id){dialog.querySelector('#tpCascadeDetails').textContent='Bitte zuerst einen Vorgang im Gantt auswählen.';return;}
   try{
     const result=planner.previewSuccessors(bridge.read(),id);
     preview={...result,signature:JSON.stringify(bridge.read())};
     const text=result.updates.length?
       result.updates.length+' Nachfolger würden verschoben: '+result.updates.slice(0,8).map(x=>x.name+': '+fmt(x.after.start)+' – '+fmt(x.after.end)).join(' · ')+
       (result.updates.length>8?' · weitere '+(result.updates.length-8):'')+
       (result.missedDeadlines.length?' · Warnung: '+result.missedDeadlines.length+' Deadlines/geschützte Termine überschritten':'')
       :'Keine Nachfolger müssen verschoben werden.';
     dialog.querySelector('#tpCascadeDetails').textContent=text;
     dialog.querySelector('#tpApplyCascade').hidden=!result.updates.length;
   }catch(e){preview=null;dialog.querySelector('#tpCascadeDetails').textContent=e.message;dialog.querySelector('#tpApplyCascade').hidden=true;}
 }
 function applySuccessors(){
   if(!preview||!bridge?.canEdit())return;
   if(preview.signature!==JSON.stringify(bridge.read())){preview=null;renderAnalysis();root.alert('Der Plan wurde seit der Vorschau geändert. Bitte erneut prüfen.');return}
   if(preview.missedDeadlines.length&&!root.confirm('Der Vorschlag überschreitet geschützte Termine oder Deadlines. Trotzdem ausdrücklich übernehmen?'))return;
   if(!root.confirm(preview.updates.length+' Folgetermine gemäß Vorschau übernehmen? Der Änderungsvorgang wird versioniert gespeichert.'))return;
   const state=preview.state;preview=null;
   bridge.write(state);renderAnalysis();
 }
 function stats(){
   lastResult=planner.analyze(bridge.read());
   return lastResult;
 }
 function refresh(){
   if(!mounted())return;
   const state=bridge.read(),result=stats(),base=selectedBaseline(),variance=planner.baselineVariance(state,base);
   const deadlines=(state.tasks||[]).filter(t=>t.deadline&&t.end>t.deadline).length;
   document.getElementById('tpInsights').textContent=result.valid?
     'Netzplan: '+result.criticalCount+' kritisch · '+deadlines+' Deadline-Warnungen · '+(base?'Basisplan: '+base.label:'kein Basisplan'):
     'Netzprüfung: '+result.reason;
   document.getElementById('tpQuickBaseline').disabled=!bridge.canEdit();
   const baselineMap=new Map((base?.tasks||[]).map(t=>[t.id,t]));
   const dates=bridge.dates(),rows=bridge.rows(),width=bridge.cell();
   const index=new Map(dates.map((d,i)=>[d,i]));
   const timeline=document.getElementById('timelineBody');
   timeline?.querySelectorAll('.tp-baseline-bar').forEach(x=>x.remove());
   if(timeline&&base&&showBaseline&&dates.length){
     rows.forEach((row,i)=>{
       if(row.kind!=='task')return;
       const historic=baselineMap.get(row.id);
       if(!historic||!index.has(historic.start)||!index.has(historic.end))return;
       const a=index.get(historic.start),b=index.get(historic.end);
       const el=document.createElement('div');el.className='tp-baseline-bar';
       el.style.left=(a*width+3)+'px';el.style.width=(Math.max(5,(b-a+1)*width-6))+'px';
       el.style.top=(i*38+31)+'px';el.title='Basisplan: '+fmt(historic.start)+' – '+fmt(historic.end);
       timeline.append(el);
     });
   }
   for(const el of document.querySelectorAll('#timelineBody .bar[data-id],#timelineBody .milestone[data-id]')){
     const info=result.byId[el.dataset.id],task=(state.tasks||[]).find(x=>x.id===el.dataset.id);
     el.classList.toggle('tp-computed-critical',!!(result.valid&&info?.critical));
     el.classList.toggle('tp-deadline-late',!!(task?.deadline&&task.end>task.deadline));
     if(task&&info&&result.valid)el.title=task.name+' · Gesamtpuffer '+info.totalFloatAT+' AT · Freier Puffer '+info.freeFloatAT+' AT'+
       (variance[task.id]?' · Basisplan Δ Ende '+fmtDelta(variance[task.id].finishDeltaKT):'');
   }
   if(dialog.open)renderAnalysis();
 }
 function renderAnalysis(){
   if(!dialog)return;
   const state=bridge.read(),result=stats(),list=state.project?.baselines||[],base=selectedBaseline();
   const select=dialog.querySelector('#tpBaselineSelect'),old=base?.id||'';
   select.replaceChildren(new Option('— kein Basisplan —',''));
   for(const b of list)select.add(new Option(b.label+' · '+fmt(b.recordedAt.slice(0,10)),b.id));
   select.value=old;
   dialog.querySelector('#tpShowBaseline').checked=showBaseline;
   dialog.querySelector('#tpSaveBaseline').disabled=!bridge.canEdit()||list.length>=10;
   dialog.querySelector('#tpPreviewCascade').disabled=!bridge.canEdit();
   dialog.querySelector('#tpApplyCascade').disabled=!bridge.canEdit();
   dialog.querySelector('#tpApplyCascade').hidden=!preview?.updates?.length;
   if(!preview)dialog.querySelector('#tpCascadeDetails').textContent='';
   const deadlines=state.tasks.filter(t=>t.deadline&&t.end>t.deadline).length;
   dialog.querySelector('#tpAnalysisSummary').textContent=result.valid?
     'Planende: '+fmt(result.projectFinish)+' · Kritische Vorgänge: '+result.criticalCount+
     ' · Deadline-Überschreitungen: '+deadlines+' · Basispläne: '+list.length:
     'Keine belastbare Pufferberechnung: '+result.reason+'. Bitte Netzplanhinweise im Assistenten prüfen.';
   const variance=planner.baselineVariance(state,base),map=new Map(state.tasks.map(t=>[t.id,t]));
   const body=dialog.querySelector('#tpAnalysisRows');body.replaceChildren();
   const entries=bridge.rows().filter(r=>r.kind==='task');
   const shown=new Set(entries.map(x=>x.id));
   for(const t of [...entries,...state.tasks.filter(x=>!shown.has(x.id))]){
     const task=map.get(t.id);if(!task)continue;
     const network=result.byId[task.id],delta=variance[task.id],late=task.deadline&&task.end>task.deadline;
     const tr=document.createElement('tr');
     if(network?.critical&&result.valid)tr.className='tp-critical-row';
     const fields=[
       (t.wbs?t.wbs+' · ':'')+task.name,
       fmt(task.start),fmt(task.end),
       network&&result.valid?network.totalFloatAT+' AT':'—',
       network&&result.valid?network.freeFloatAT+' AT':'—',
       task.deadline?(fmt(task.deadline)+(late?' · überschritten':' · Ziel')):'—',
       delta?fmtDelta(delta.finishDeltaKT):'—',
       hour(task.effortHours),fmt(task.actualStart)+' / '+fmt(task.actualEnd)
     ];
     for(let i=0;i<fields.length;i++){
       const td=document.createElement('td');td.textContent=fields[i];
       if(i===0){td.className='tp-task-link';td.title='Im Gantt auswählen';td.tabIndex=0;
         const activate=()=>{bridge.focus(task.id);dialog.close()};
         td.onclick=activate;td.onkeydown=e=>{if(e.key==='Enter')activate()};
       }
       if(i===5&&late)td.className='tp-deadline-alert';
       tr.append(td);
     }
     body.append(tr);
   }
 }
 root.OfficePlanFeatures={mount,refresh,getNetwork:()=>lastResult};
})(window);
