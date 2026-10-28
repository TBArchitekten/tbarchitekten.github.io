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
 return Object.freeze({VERSION,stable,target,quantity,answer,review,receipt,fromModelIntent});
});
