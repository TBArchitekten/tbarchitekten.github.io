/* TBA Office: scoped deterministic conversation / proposal / receipt v0.3 */
(function(root,factory){
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.TBATerminplanDialogue=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
 "use strict";
 const VERSION="office-dialogue-v0.3";
 const WORDS={eins:1,ein:1,eine:1,zwei:2,drei:3,vier:4,fünf:5,sechs:6,sieben:7,acht:8,neun:9,zehn:10,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
 function norm(s){return String(s||"").normalize("NFKC").toLowerCase().trim().replace(/\s+/g," ")}
 function stable(s){if(Array.isArray(s))return "["+s.map(stable).join(",")+"]";if(s&&typeof s==="object")return "{"+Object.keys(s).sort().map(k=>JSON.stringify(k)+":"+stable(s[k])).join(",")+"}";return JSON.stringify(s)}
 function target(text,tasks,selected){
   const line=norm(text);
   const quoted=[...String(text).matchAll(/["„“«]([^"„“»]{2,160})["“»]/g)].map(m=>norm(m[1]));
   for(const quotedName of quoted){const found=tasks.filter(t=>norm(t.name)===quotedName);if(found.length===1)return found[0];if(found.length>1)return null;}
   const ids=tasks.filter(t=>t.id&&line.split(/[\s,.;:()]+/).some(word=>word==="#"+norm(t.id)));
   if(ids.length===1)return ids[0];if(ids.length>1)return null;
   const names=tasks.filter(t=>t.name&&norm(t.name).length>=6&&line.includes(norm(t.name)));
   if(names.length===1)return names[0];if(names.length>1)return null;
   return tasks.find(t=>t.id===selected)||null;
 }
 function quantity(text){
   const m=String(text).match(/\b(\d{1,3}|eins|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(arbeitstag(?:e|en)?|werktag(?:e|en)?|d[ií]as?\s+laborables?|working\s+days?|arbeitswoche(?:n)?|semanas?(?:\s+laborales)?|work\s*weeks?|woche(?:n)?)\b/i);
   if(!m)return null;
   const n=/^\d+$/.test(m[1])?Number(m[1]):WORDS[norm(m[1])];
   const week=/woche|semana|week/i.test(m[2]);
   const days=n*(week?5:1);
   if(!Number.isInteger(days)||days<1||days>260)return null;
   return {days,week};
 }
 function answer({message,state,engine,selectedTaskId,revision,requestId}){
   const raw=String(message||"").trim(),lower=norm(raw);
   if(!raw||raw.length>1500)return {kind:"answer",text:"Bitte eine kurze Nachricht (max. 1500 Zeichen) eingeben."};
   if(!engine)return {kind:"answer",text:"Prüfmotor nicht verfügbar. Keine Änderungen möglich."};
   const tasks=Array.isArray(state?.tasks)?state.tasks:[],selected=target(raw,tasks,selectedTaskId);
   const move=/verschieb|verleg|retras|mueve|pospon|move|shift|vorzieh|adelant/i.test(lower);
   const earlier=/vorzieh|adelant|früher|earlier/i.test(lower)&&!/verschieb|retras|move|shift/i.test(lower);
   const relations=/abhängig|vorgänger|nachfolger|betroffen|auswirkung|dependenc|sucesor|afectad|relaci[oó]n|consecuenc/i.test(lower);
   const conflicts=/konflikt|problem|warnung|prüf|valid|comprob|error|conflict/i.test(lower);
   if(/^(hilfe|ayuda|help)[.!]?$|was kannst du|qué puedes hacer/i.test(lower))
     return {kind:"answer",text:"Ich prüfe dokumentierte Abhängigkeiten und Konflikte und kann eine Terminverschiebung vorschlagen. Beispiele: „Welche Nachfolger sind betroffen?“ oder „Verschiebe den ausgewählten Vorgang um 5 Arbeitstage“. Keine automatische Änderung."};
   if(move){
     const q=quantity(raw);
     if(!q)return {kind:"answer",text:"Bitte Arbeitstage oder Wochen als Zahl angeben: „Verschiebe den ausgewählten Vorgang um 5 Arbeitstage“. Kalendertage sind nicht eindeutig."};
     if(!selected)return {kind:"answer",text:"Bitte einen Vorgang im Gantt auswählen oder seinen exakten Namen in Anführungszeichen nennen."};
     const offset=(earlier?-1:1)*q.days;
     try{
       const p=engine.previewShift(state,selected.id,offset);
       const proposal={request_id:String(requestId||""),kind:"shift_task_workdays",status:"proposed",source:"office_deterministic_engine",
         task_id:selected.id,offset_workdays:offset,base_revision:revision,base_fingerprint:stable(state),
         candidate_fingerprint:stable(p.state),before:p.before,after:p.after,affected_ids:p.affectedIds,
         new_issue_codes:p.newIssues.map(i=>i.code),requires_confirmation:true};
       return {kind:"proposal",proposal,preview:p,
         text:"Vorschlag für „"+selected.name+"“: "+p.before.start+" – "+p.before.end+" → "+p.after.start+" – "+p.after.end+
         ". "+p.affectedIds.length+" nachgelagerte Vorgänge, "+p.newIssues.length+" neue Regelhinweise. "+
         (q.week?"Woche = 5 Arbeitstage ohne nicht eingetragene Feiertage. ":"")+
         "Keine Folgeaufgabe wird automatisch verschoben. Noch nicht übernommen."};
     }catch(error){return {kind:"answer",text:"Keine gültige Vorschau: "+String(error.message||"Fehler")}}
   }
   if(conflicts){
     const issues=engine.analyze(state).issues;
     const matched=selected?issues.filter(x=>x.taskId===selected.id||x.predecessorId===selected.id):issues;
     return {kind:"answer",text:!matched.length?
        "Keine Regelverletzung in den eingetragenen Beziehungen gefunden. Nicht dokumentierte fachliche Abhängigkeiten bleiben unbekannt.":
        matched.slice(0,8).map(x=>(tasks.find(t=>t.id===x.taskId)?.name||x.taskId||"Projekt")+": "+x.code+
          (x.minimum?" (ab "+x.minimum+")":"")).join("\n")+
          (matched.length>8?"\nWeitere Hinweise: "+(matched.length-8):"")};
   }
   if(relations){
     if(!selected)return {kind:"answer",text:"Bitte einen konkreten Vorgang auswählen, damit ich die eingetragenen Nachfolger untersuchen kann."};
     const ids=engine.downstream(state,[selected.id]);
     return {kind:"answer",text:ids.length?
       "Dokumentierte Nachfolger ("+ids.length+"):\n"+ids.slice(0,12).map(id=>"• "+(tasks.find(t=>t.id===id)?.name||id)).join("\n")+
       "\nDies bedeutet potenzielle Folgen, nicht automatisch geänderte oder vertraglich verbindliche Termine.":
       "Keine Nachfolger eingetragen. Das beweist nicht, dass keine fachlichen Abhängigkeiten bestehen."};
   }
   return {kind:"answer",text:"Diese Anfrage kann ich noch nicht zuverlässig verstehen. Unterstützt sind eingetragene Abhängigkeiten, Regelkonflikte und Verschiebungen in Arbeitstagen mit Bestätigung. Keine Änderung vorgenommen."};
 }
 function review(proposal,state,engine,revision){
   if(!proposal||proposal.status!=="proposed"||proposal.kind!=="shift_task_workdays")
     return {ok:false,reason:"invalid_proposal"};
   if(!Number.isSafeInteger(revision)||revision!==proposal.base_revision)
     return {ok:false,reason:"revision_changed"};
   if(stable(state)!==proposal.base_fingerprint)return {ok:false,reason:"local_plan_changed"};
   try{
     const p=engine.previewShift(state,proposal.task_id,proposal.offset_workdays);
     if(stable(p.state)!==proposal.candidate_fingerprint)return {ok:false,reason:"proposal_changed"};
     return {ok:true,state:p.state,preview:p};
   }catch{return {ok:false,reason:"preview_error"}}
 }
 function receipt({requestId,planId,baseRevision,verifiedRevision,expectedState,observedState}){
   const ok=Number.isSafeInteger(verifiedRevision)&&verifiedRevision===baseRevision+1&&stable(expectedState)===stable(observedState);
   return {request_id:requestId,receipt_id:String(requestId)+":"+String(verifiedRevision||"none"),
    plan_id:planId,status:ok?"verified":"unverified",base_revision:baseRevision,
    verified_revision:ok?verifiedRevision:null,verification:"server_readback",source:"office_only"};
 }

 function fromModelIntent({serverResponse,state,engine,revision,requestId}){
   if(!serverResponse||serverResponse.version!=="office-ai-v0.4"||
      serverResponse.base_revision!==revision||
      serverResponse.source!=="office_ai_interpretation_only")
      return {kind:"answer",text:"KI-Ergebnis nicht mehr gültig. Keine Änderung vorgenommen."};
   const intent=serverResponse.result;
   if(!intent||!["shift","answer","clarify"].includes(intent.kind)||typeof intent.text!=="string")
     return {kind:"answer",text:"KI-Ergebnis konnte nicht überprüft werden. Keine Änderung."};
   if(intent.kind!=="shift")return {kind:"answer",text:intent.text.slice(0,1200)};
   const target=state?.tasks?.find(t=>t.id===intent.task_id);
   const offset=intent.offset_workdays;
   if(!target||!Number.isInteger(offset)||offset===0||Math.abs(offset)>130||!engine)
     return {kind:"answer",text:"KI-Vorschlag enthält keinen gültigen Vorgang oder Abstand. Keine Änderung."};
   try{
     const p=engine.previewShift(state,target.id,offset);
     const proposal={request_id:requestId,kind:"shift_task_workdays",status:"proposed",
       source:"office_ai_interpretation_engine_calculated",
       task_id:target.id,offset_workdays:offset,
       base_revision:revision,base_fingerprint:stable(state),
       candidate_fingerprint:stable(p.state),before:p.before,after:p.after,
       affected_ids:p.affectedIds,new_issue_codes:p.newIssues.map(i=>i.code),
       requires_confirmation:true};
     const text="KI-Interpretation: "+intent.text.trim().slice(0,800)+"\n"+
       "Berechnete Vorschau für „"+target.name+"“: "+p.before.start+" – "+p.before.end+
       " → "+p.after.start+" – "+p.after.end+". "+p.affectedIds.length+
       " nachgelagerte Vorgänge und "+p.newIssues.length+
       " zusätzliche Regelhinweise. Noch nichts geändert. Es wird nur dieser Vorgang verschoben.";
     return {kind:"proposal",text,proposal,preview:p};
   }catch(error){
     return {kind:"answer",text:"KI-Vorschlag im Planungsmodell nicht ausführbar: "+String(error.message||"ungültig")};
   }
 }

 function draftTasks(state,items,engine,requestId){
   if(!engine||!Array.isArray(items)||items.length<1||items.length>8)throw Error("invalid_draft");
   const groupIds=new Set((state.groups||[]).map(g=>g.id));
   const taskIds=new Set((state.tasks||[]).map(t=>t.id));
   const copy=JSON.parse(JSON.stringify(state));
   const names=new Set();
   const idPrefix="t-ai-"+String(requestId).replace(/[^a-zA-Z0-9]/g,"").slice(0,25);
   const created=[];
   for(let i=0;i<items.length;i++){
     const x=items[i],id=idPrefix+"-"+i;
     if(!x||!groupIds.has(x.group_id)||taskIds.has(id)||!engine.validDate(x.start)||
       !engine.validDate(x.end)||x.end<x.start||!["task","milestone"].includes(x.type)||
       (x.type==="milestone"&&x.end!==x.start)||typeof x.name!=="string"||
       x.name.trim().length<4||x.name.length>160||names.has(x.name.toLowerCase().trim())||
       typeof x.owner!=="string"||!x.owner.trim()||
       !["arch","fach","qa","cost","ag"].includes(x.category)||
       !Array.isArray(x.predecessors)||x.predecessors.length>10)throw Error("invalid_task");
     names.add(x.name.toLowerCase().trim());
     const dependencies=x.predecessors.map(dep=>{
       if(!taskIds.has(dep.task_id)||!["EA","AA","EE","AE"].includes(dep.relation)||
         !Number.isInteger(dep.lag_workdays)||Math.abs(dep.lag_workdays)>130)
         throw Error("invalid_predecessor");
       return {pred:dep.task_id,rel:dep.relation,lagDays:dep.lag_workdays};
     });
     const task={
       id,group:x.group_id,name:x.name.trim(),type:x.type,start:x.start,end:x.end,
       owner:x.owner.trim(),category:x.category,
       pred:dependencies[0]?.pred||"",rel:dependencies[0]?.rel||"EA",
       dependencies,progress:0,status:"Nicht begonnen",critical:false,note:""
     };
     copy.tasks.push(task);
     created.push(task);
     taskIds.add(id);
   }
   const before=engine.analyze(state),after=engine.analyze(copy);
   const oldIssues=new Set(before.issues.map(i=>i.key));
   return {state:copy,created,allIssues:after.issues,
     newIssues:after.issues.filter(i=>!oldIssues.has(i.key))};
 }

 function previewTaskEdits(state,items,engine){
   if(!engine||!Array.isArray(items)||items.length<1||items.length>8)throw Error("invalid_edit_batch");
   const copy=JSON.parse(JSON.stringify(state)),allIds=new Set(copy.tasks.map(t=>t.id));
   const seen=new Set(),changed=[];
   for(const x of items){
     const task=copy.tasks.find(t=>t.id===x?.task_id);
     if(!task||seen.has(task.id)||!engine.validDate(x.start)||!engine.validDate(x.end)||
       x.end<x.start||(task.type==="milestone"&&x.start!==x.end)||
       typeof x.owner!=="string"||x.owner.length>100||
       !Array.isArray(x.predecessors)||x.predecessors.length>10)throw Error("invalid_edit");
     seen.add(task.id);
     const links=x.predecessors.map(d=>{
       if(!allIds.has(d.task_id)||d.task_id===task.id||
         !["EA","AA","EE","AE"].includes(d.relation)||
         !Number.isInteger(d.lag_workdays)||Math.abs(d.lag_workdays)>130)
         throw Error("invalid_dependency");
       return {pred:d.task_id,rel:d.relation,lagDays:d.lag_workdays};
     });
     const before={start:task.start,end:task.end,owner:task.owner||"",
       dependencies:engine.dependencies(task)};
     task.start=x.start;task.end=x.end;task.owner=x.owner;
     task.dependencies=links;
     task.pred=links[0]?.pred||"";
     task.rel=links[0]?.rel||"EA";
     changed.push({id:task.id,name:task.name,before,after:{
       start:task.start,end:task.end,owner:task.owner,dependencies:links
     }});
   }
   const original=engine.analyze(state),now=engine.analyze(copy);
   const prior=new Set(original.issues.map(i=>i.key));
   return {state:copy,edited:changed,newIssues:now.issues.filter(i=>!prior.has(i.key)),
     downstreamIds:engine.downstream(copy,changed.map(x=>x.id))};
 }

 function fromDiscussion({serverResponse,state,engine,revision,requestId}){
   if(!serverResponse||serverResponse.version!=="office-ai-v0.5"||
     serverResponse.source!=="office_ai_discussion_only"||
     serverResponse.base_revision!==revision)
     return {kind:"answer",text:"Der Planstand hat sich geändert. Bitte Anfrage wiederholen."};
   const intent=serverResponse.result;
   if(!intent||!["discuss","clarify","shift","add_tasks","edit_tasks"].includes(intent.kind)||
      typeof intent.text!=="string")
     return {kind:"answer",text:"Unklare KI-Antwort. Keine Änderung."};
   if(intent.kind==="shift"){
     return fromModelIntent({
       serverResponse:{version:"office-ai-v0.4",source:"office_ai_interpretation_only",
         base_revision:revision,result:intent},
       state,engine,revision,requestId
     });
   }
   if(intent.kind==="edit_tasks"){
     try{
       const preview=previewTaskEdits(state,intent.draft_edits,engine);
       const proposal={
         request_id:requestId,kind:"edit_tasks",status:"proposed",
         source:"office_ai_discussion_deterministic_edits",
         base_revision:revision,base_fingerprint:stable(state),
         candidate_fingerprint:stable(preview.state),
         edited_tasks:preview.edited.map(e=>({id:e.id,name:e.name,
           start:e.after.start,end:e.after.end,owner:e.after.owner,dependencies:e.after.dependencies})),
         new_issue_codes:preview.newIssues.map(i=>i.code),
         requires_confirmation:true
       };
       const details=preview.edited.map(e=>e.name+
         ": "+e.before.start+" – "+e.before.end+" → "+e.after.start+" – "+e.after.end+
         " · "+e.before.owner+" → "+e.after.owner+
         " · Vorgänger "+e.before.dependencies.length+" → "+e.after.dependencies.length).join("\n");
       return {kind:"proposal",proposal,preview,
         text:intent.text+"\n\nPrüfvorschau für "+preview.edited.length+
         " Vorgänge:\n"+details+"\n\n"+preview.newIssues.length+
         " neue Regelhinweise; "+preview.downstreamIds.length+
         " nachgelagerte Vorgänge potenziell betroffen. Noch nichts gespeichert."};
     }catch(error){return {kind:"answer",text:"Entwurf nicht prüfbar: "+String(error.message||"ungültig")+". Bitte weiter abstimmen."}}
   }
   if(intent.kind!=="add_tasks")return {kind:"answer",text:intent.text};
   try{
     const preview=draftTasks(state,intent.draft_tasks,engine,requestId);
     const proposal={
       request_id:requestId,kind:"add_tasks",status:"proposed",
       source:"office_ai_discussion_deterministic_draft",
       base_revision:revision,base_fingerprint:stable(state),
       candidate_fingerprint:stable(preview.state),
       created_ids:preview.created.map(t=>t.id),
       created_tasks:preview.created.map(t=>({
         name:t.name,start:t.start,end:t.end,owner:t.owner,
         group:t.group,category:t.category,type:t.type,dependencies:t.dependencies
       })),
       new_issue_codes:preview.newIssues.map(i=>i.code),
       requires_confirmation:true
     };
     const details=preview.created.map(t=>"• "+t.name+" · "+t.start+" – "+t.end+
       " · "+t.owner+" · "+(state.groups||[]).find(g=>g.id===t.group)?.name).join("\n");
     return {kind:"proposal",proposal,preview,
       text:intent.text+"\n\nVorschau zur Freigabe ("+preview.created.length+
         " neue Vorgänge, "+preview.newIssues.length+" zusätzliche Regelhinweise):\n"+
         details+"\n\nBestehende Vorgänge bleiben unverändert. Noch nicht gespeichert."};
   }catch(error){
     return {kind:"answer",text:"Der Aufgabenentwurf konnte nicht geprüft werden ("+
       String(error?.message||"ungültige Daten")+"). Bitte die Details weiter besprechen."};
   }
 }

 // Review never trusts an old model response: all candidate state is recalculated locally.
 const reviewBase=review;
 function reviewAny(proposal,state,engine,revision){
   if(proposal?.kind!=="add_tasks"&&proposal?.kind!=="edit_tasks")return reviewBase(proposal,state,engine,revision);
   if(proposal.status!=="proposed"||proposal.base_revision!==revision||
      stable(state)!==proposal.base_fingerprint)return {ok:false,reason:"stale_plan"};
   try{
     if(proposal.kind==="edit_tasks"){
       const items=proposal.edited_tasks.map(t=>({
         task_id:t.id,start:t.start,end:t.end,owner:t.owner,
         predecessors:t.dependencies.map(d=>({task_id:d.pred,relation:d.rel,lag_workdays:d.lagDays}))
       }));
       const draft=previewTaskEdits(state,items,engine);
       if(stable(draft.state)!==proposal.candidate_fingerprint)
         return {ok:false,reason:"candidate_changed"};
       return {ok:true,state:draft.state,preview:draft};
     }
     const items=proposal.created_tasks.map(t=>({
       name:t.name,start:t.start,end:t.end,owner:t.owner,group_id:t.group,
       category:t.category,type:t.type,
       predecessors:t.dependencies.map(d=>({task_id:d.pred,relation:d.rel,lag_workdays:d.lagDays}))
     }));
     const draft=draftTasks(state,items,engine,proposal.request_id);
     if(stable(draft.state)!==proposal.candidate_fingerprint)
       return {ok:false,reason:"candidate_changed"};
     return {ok:true,state:draft.state,preview:draft};
   }catch{return {ok:false,reason:"invalid_candidate"}}
 }
 return Object.freeze({VERSION,stable,target,quantity,answer,review:reviewAny,receipt,fromModelIntent,fromDiscussion,draftTasks,previewTaskEdits});
});
