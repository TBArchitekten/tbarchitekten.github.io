// TBA Office · adapter for Window's ORIGINAL assistant screen.
// Do not build a second chat interface. Only wire Window's composer, message
// renderer, navigation and modal to Office's per-employee Supabase history.
(()=>{
'use strict';
// The reviewed common Window engine is the default; this file only runs as
// an explicitly selected fallback. No automatic downgrade after errors.
if(window.APP_CHAT_RUNTIME!=='legacy')return;
const sb=window.MINDS_SUPABASE;
const screen=document.getElementById('assistantScreen');
const app=()=>window.ISABELLA_APP;
if(!sb||!screen)return;

let ownerId=null,threadId=null,threads=[],rows=[],busy=false,loadVersion=0,capabilityTimer=null,capabilityPollBusy=false;
const composer=screen.querySelector('.composer-wrap');
const statusEl=document.createElement('div');
statusEl.id='officeAssistantStatus';
statusEl.className='office-assistant-status';
statusEl.setAttribute('role','status');
statusEl.setAttribute('aria-live','polite');
statusEl.hidden=true;
composer?.insertBefore(statusEl,composer.firstChild);
function status(label=''){
  statusEl.textContent=label;
  statusEl.hidden=!label;
}
function errorMessage(code){
  const errors={
    request_already_received:'Die Nachricht wurde bereits empfangen. Bitte prüfen Sie den Verlauf.',
    conversation_not_found:'Dieses Gespräch ist für Ihr Konto nicht verfügbar.',
    member_not_active:'Ihr Office-Zugang ist nicht aktiv.',
    ai_provider_unavailable:'Der KI-Dienst antwortet derzeit nicht.',
    ai_timeout_or_network:'Die Antwort ist unbestätigt. Prüfen Sie den Verlauf vor erneutem Senden.',
    assistant_not_configured:'Der Assistent ist serverseitig nicht vollständig eingerichtet.',
    request_registration_unavailable:'Die Anfrage konnte nicht sicher erfasst werden.',
  };
  return errors[code]||'Die Antwort konnte nicht bestätigt werden. Prüfen Sie den Gesprächsverlauf.';
}
function display(content=rows){
  app()?.setOfficeMessages?.(content);
}
async function refreshThreads(){
  if(!ownerId)return false;
  // Project Threads (Work) are Romy conversations too, but they live in Work, not in this list.
  const {data,error}=await sb.from('office_assistant_conversations')
    .select('id,title,updated_at').eq('user_id',ownerId).eq('work_thread',false)
    .order('updated_at',{ascending:false}).limit(100);
  if(error){status('Die Gesprächsliste konnte nicht geladen werden.');return false}
  threads=data||[];
  return true;
}
async function loadThread(id,{internal=false,skipRuns=false}={}){
  if(!ownerId||!id||(busy&&!internal))return false;
  const serial=++loadVersion;
  const all=[];
  for(let offset=0;;offset+=1000){
    const {data,error}=await sb.from('office_assistant_messages')
      .select('id,role,content,attachments,metadata,created_at').eq('conversation_id',id)
      .order('created_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+999);
    if(serial!==loadVersion)return false;
    if(error){status('Die Nachrichten konnten nicht geladen werden.');return false}
    all.push(...(data||[]));
    if(!data||data.length<1000)break;
  }
  threadId=id;rows=all;display();status('');
  void showPendingProposals();
  if(!skipRuns)void checkCapabilityRuns(id);
  return true;
}
function startNew(){
  if(busy)return;
  ++loadVersion;clearTimeout(capabilityTimer);capabilityTimer=null;threadId=null;rows=[];display();status('');
  document.getElementById('chatInput')?.focus();
}
async function renameThread(thread){
  if(busy)return;
  const name=window.prompt('Gespräch umbenennen:',thread.title);
  if(name===null||name.trim()===thread.title)return;
  if(!name.trim()||name.trim().length>140){status('Ungültiger Gesprächstitel.');return}
  const {error}=await sb.from('office_assistant_conversations')
    .update({title:name.trim()}).eq('id',thread.id).eq('user_id',ownerId);
  if(error){status('Umbenennen fehlgeschlagen.');return}
  await refreshThreads();openHistory();
}
async function deleteThread(thread){
  if(busy)return;
  if(!window.confirm('Gespräch „'+thread.title+'“ endgültig löschen?'))return;
  const {error}=await sb.from('office_assistant_conversations')
    .delete().eq('id',thread.id).eq('user_id',ownerId);
  if(error){status('Gespräch konnte nicht gelöscht werden.');return}
  if(threadId===thread.id)startNew();
  await refreshThreads();openHistory();
}
function element(tag,text,className){
  const el=document.createElement(tag);
  if(text!=null)el.textContent=String(text);
  if(className)el.className=className;
  return el;
}
function openHistory(){
  if(!ownerId||busy)return;
  app()?.openModal?.('Meine Gespräche','');
  const body=document.getElementById('modalBody');
  if(!body)return;
  body.replaceChildren();
  const controls=element('div',null,'office-assistant-history-controls');
  const newBtn=element('button','＋ Neues Gespräch','secondary');
  newBtn.type='button';
  newBtn.addEventListener('click',()=>{app()?.closeModal?.();startNew()});
  controls.appendChild(newBtn);
  body.appendChild(controls);
  if(!threads.length){
    body.appendChild(element('p','Noch keine Gespräche.','small'));
    return;
  }
  const list=element('div',null,'office-assistant-history');
  for(const thread of threads){
    const line=element('div',null,'office-assistant-history-row');
    const open=element('button',thread.title,'office-assistant-history-open');
    open.type='button';
    if(thread.id===threadId)open.setAttribute('aria-current','true');
    open.addEventListener('click',async()=>{
      app()?.closeModal?.();
      await loadThread(thread.id);
    });
    const rename=element('button','✎','office-assistant-history-edit');
    rename.type='button';rename.setAttribute('aria-label','Umbenennen: '+thread.title);
    rename.addEventListener('click',()=>void renameThread(thread));
    const remove=element('button','×','office-assistant-history-edit');
    remove.type='button';remove.setAttribute('aria-label','Löschen: '+thread.title);
    remove.addEventListener('click',()=>void deleteThread(thread));
    line.append(open,rename,remove);list.appendChild(line);
  }
  body.appendChild(list);
}

async function checkCapabilityRuns(conversationId){
 if(!ownerId||!conversationId||threadId!==conversationId||capabilityPollBusy)return;
 clearTimeout(capabilityTimer);capabilityTimer=null;
 capabilityPollBusy=true;
 const owner=ownerId;
 try{
  const {data,error}=await sb.from('office_romy_capability_runs')
    .select('id,status,metadata').eq('user_id',owner)
    .eq('conversation_id',conversationId).order('updated_at',{ascending:false}).limit(35);
  if(error||ownerId!==owner||threadId!==conversationId)return;
  const outstanding=(data||[]).filter(run=>
    ['queued','in_progress'].includes(run.status)||
    (run.status==='completed'&&!run.metadata?.delivered_to_chat)).slice(0,5);
  let changed=false,pending=false;
  for(const run of outstanding){
   if(ownerId!==owner||threadId!==conversationId)return;
   try{
    const {data:result,error:queryError}=await sb.functions.invoke('office-assistant',{
      body:{action:'capability_status',run_id:run.id}
    });
    if(queryError||result?.error){pending=true;continue}
    if(result?.status==='completed'){changed=true;continue}
    if(['queued','in_progress'].includes(result?.status)){pending=true;continue}
    if(result?.status!==run.status)changed=true;
   }catch{pending=true}
  }
  if(changed&&ownerId===owner&&threadId===conversationId)
    await loadThread(conversationId,{internal:true,skipRuns:true});
  if(pending&&ownerId===owner&&threadId===conversationId){
    capabilityTimer=setTimeout(()=>void checkCapabilityRuns(conversationId),15000);
  }
 }finally{capabilityPollBusy=false}
}
async function openCapabilityRuns(){
 if(!ownerId||busy)return;
 const owner=ownerId;
 const {data,error}=await sb.from('office_romy_capability_runs')
   .select('id,conversation_id,title,status,summary,error,created_at')
   .eq('user_id',owner).order('created_at',{ascending:false}).limit(50);
 if(error||owner!==ownerId){status('Die Arbeitsaufträge konnten nicht geladen werden.');return}
 app()?.openModal?.('Meine Arbeitsaufträge','');
 const body=document.getElementById('modalBody');if(!body)return;
 body.replaceChildren();
 body.appendChild(element('p','Ausführungen bleiben Ihrem Konto zugeordnet. Fertige Dateien erscheinen im jeweiligen Gespräch.','small'));
 const list=element('div',null,'office-assistant-history');
 for(const run of data||[]){
  const row=element('div',null,'office-assistant-history-row');
  const details=element('div',null,'office-memory-content');
  details.appendChild(element('strong',run.title||'Arbeitsauftrag'));
  details.appendChild(element('p',run.status==='completed'?'Abgeschlossen':run.status==='in_progress'?'In Bearbeitung':run.status==='queued'?'Eingereiht':run.status==='cancelled'?'Abgebrochen':'Fehlgeschlagen'));
  if(run.summary)details.appendChild(element('p',run.summary.slice(0,400)));
  const open=element('button','Gespräch','office-assistant-history-edit');
  open.type='button';
  open.addEventListener('click',async()=>{app()?.closeModal?.();await loadThread(run.conversation_id)});
  row.append(details,open);
  if(['queued','in_progress'].includes(run.status)){
   const cancel=element('button','Abbrechen','office-assistant-history-edit');
   cancel.type='button';
   cancel.addEventListener('click',async()=>{
    if(!window.confirm('Diesen laufenden Arbeitsauftrag abbrechen?'))return;
    cancel.disabled=true;
    const {data:result,error:cancelError}=await sb.functions.invoke('office-assistant',{
      body:{action:'capability_cancel',run_id:run.id}
    });
    if(cancelError||result?.error){status('Abbruch nicht bestätigt.');cancel.disabled=false;return}
    void openCapabilityRuns();
   });
   row.appendChild(cancel);
  }
  list.appendChild(row);
 }
 if(!data?.length)list.appendChild(element('p','Noch keine Arbeitsaufträge.','small'));
 body.appendChild(list);
}
function showAttachmentNotice(){
  status('Dieses Dateiformat ist noch nicht verfügbar. PDF, Office-Dokumente, Text und Bilder werden unterstützt.');
}
async function showPendingProposals(){
  if(!ownerId||!threadId)return;
  const current=threadId;
  const {data,error}=await sb.from('office_romy_proposals')
    .select('id,kind,payload,status').eq('conversation_id',threadId).eq('status','pending')
    .order('created_at',{ascending:true});
  if(error||current!==threadId)return;
  const target=document.getElementById('messages');
  if(!target)return;
  target.querySelectorAll('.romy-pending-review').forEach(x=>x.remove());
  for(const p of data||[]){
    const item=element('div',null,'romy-pending-review');
    const title=p.kind==='remember'?'Erinnerungsvorschlag':p.kind==='create_event'?'Terminvorschlag':p.kind==='start_mission'?'Fortlaufenden Auftrag prüfen':p.kind==='control_mission'?'Auftrag steuern':'Aufgabenvorschlag';
    item.appendChild(element('strong',title));
    const details=p.payload||{};
    const when=p.kind==='remember'
      ?(details.memory_kind==='preference'?'Präferenz':'Information')
      :p.kind==='create_event'
        ?[details.starts_at,details.ends_at].filter(Boolean).join(' – ')
        :p.kind==='start_mission'?'Arbeit im Hintergrund · nur Auswertung'+(details.approved_wake_at?' · Wiederaufnahme '+details.approved_wake_at:'')
        :p.kind==='control_mission'?'Bestätigung erforderlich'
        :(details.due_date||'Ohne Fälligkeitsdatum');
    item.appendChild(element('p',p.kind==='remember'
      ?String(details.content||'')+' · '+when
      :(p.kind==='start_mission'?String(details.objective||''):String(details.title||''))+' · '+when));
    if(details.notes)item.appendChild(element('p',String(details.notes)));
    const actions=element('div',null,'romy-review-actions');
    for(const [name,decision] of [['Bestätigen','apply'],['Verwerfen','reject']]){
      const button=element('button',name);
      button.type='button';
      button.addEventListener('click',async()=>{
        if(decision==='apply'&&!window.confirm(p.kind==='remember'
          ?'Diese Information als persönliche Erinnerung speichern?\n\n'+String(details.content||'')
          :p.kind==='start_mission'
            ?'Diesen fortlaufenden, ausschließlich lesenden Analyseauftrag starten?\n\n'+String(details.objective||'')+'\n\nFertig wenn: '+String(details.completion_criterion||'')
            :p.kind==='control_mission'
              ?'Diesen Auftrag wirklich '+(details.action==='cancel'?'abbrechen':'wieder aufnehmen')+'?'
              :'„'+String(details.title||'')+'“ in TBA Office anlegen?'))return;
        actions.querySelectorAll('button').forEach(b=>b.disabled=true);
        try{
          const {data:result,error:actionError}=await sb.functions.invoke('office-assistant',{
            body:{action:'review_proposal',proposal_id:p.id,decision}
          });
          if(actionError||result?.error)throw Error(result?.error||'review_failed');
          status(decision==='apply'
            ?(p.kind==='remember'?'Erinnerung bestätigt und gespeichert.':p.kind==='start_mission'?'Auftrag bestätigt. Die Ausführung ist vorgesehen, noch nicht abgeschlossen.':p.kind==='control_mission'?'Auftragsstatus bestätigt.':'Änderung bestätigt und im Office gespeichert.')
            :'Vorschlag verworfen.');
          await window.ISABELLA_SYNC_PULL_NOW?.();
          // The server wrote the receipt into the conversation: show it as a system line.
          if(threadId)await loadThread(threadId,{internal:true,skipRuns:true});
          else void showPendingProposals();
        }catch(error){
          status('Der Vorschlag konnte nicht angewendet werden. Bitte prüfen Sie die Berechtigung.');
          actions.querySelectorAll('button').forEach(b=>b.disabled=false);
        }
      });
      actions.appendChild(button);
    }
    item.appendChild(actions);target.appendChild(item);
  }
}
async function send(message,{attachments=[],replyTo=null}={}){
  await initialized;
  if(busy)return;
  if(!ownerId){status('Bitte melden Sie sich erneut im Office an.');return}
  const text=String(message||'').trim();
  if(!text&&!attachments.length)return;
  if(!globalThis.crypto?.randomUUID){status('Dieser Browser unterstützt keine sichere Nachrichten-ID.');return}
  busy=true;
  const requestId=crypto.randomUUID(),targetThread=threadId;
  const optimistic={id:requestId,role:'user',content:text,attachments,created_at:new Date().toISOString()};
  display([...rows,optimistic]);
  const sendButton=document.getElementById('sendButton');
  if(sendButton)sendButton.disabled=true;
  let failure='';
  status('Romy antwortet …');
  try{
    const result=await window.TBA_ROMY_TRANSPORT.send({
      message:text,conversationId:targetThread,requestId,replyTo,attachments,
      onDelta:(_delta,partial)=>display([...rows,optimistic,
        {id:requestId+':assistant',role:'assistant',content:partial,
          created_at:new Date().toISOString()}]),
    });
    if(result?.conversation_id&&result?.reply)threadId=result.conversation_id;
    else failure=errorMessage('invalid_reply');
  }catch(error){
    console.error('romy_transport_failed',String(error?.message||'request_error'));
    failure=errorMessage(error?.message||'request_unconfirmed');
  }finally{
    busy=false;
    if(sendButton)sendButton.disabled=false;
    await refreshThreads();
    const target=threadId||threads[0]?.id;
    if(target)await loadThread(target,{internal:true});
    else{rows=[];display();}
    if(failure)status(failure);
  }
}
function addMenuButton(id,title,action){
  if(document.getElementById(id))return;
  const signout=document.getElementById('officeSignOut');
  if(!signout?.parentElement)return;
  const button=element('button',title,'office-assistant-menu-action');
  button.id=id;button.type='button';
  button.addEventListener('click',()=>{
    document.getElementById('closeDrawer')?.click();
    action();
  });
  signout.parentElement.insertBefore(button,signout);
}
async function openMemories(){
  if(!ownerId||busy)return;
  const {data,error}=await sb.from('office_romy_memories')
    .select('id,kind,content,created_at,source_conversation_id')
    .eq('status','accepted').eq('user_id',ownerId)
    .order('created_at',{ascending:false}).limit(300);
  if(error){status('Persönliche Erinnerungen konnten nicht geladen werden.');return}
  app()?.openModal?.('Meine Erinnerungen','');
  const body=document.getElementById('modalBody');
  if(!body)return;
  body.replaceChildren();
  body.appendChild(element('p','Nur bestätigte Erinnerungen Ihres Kontos. Vorschläge werden erst nach Ihrer Bestätigung übernommen.','small'));
  if(!data?.length){body.appendChild(element('p','Noch keine bestätigten Erinnerungen.','small'));return}
  const list=element('div',null,'office-assistant-history');
  for(const memory of data){
    const row=element('div',null,'office-assistant-history-row');
    const content=element('div',null,'office-memory-content');
    content.appendChild(element('strong',memory.kind==='preference'?'Präferenz':'Information'));
    content.appendChild(element('p',memory.content));
    const retract=element('button','Deaktivieren','office-assistant-history-edit');
    retract.type='button';
    retract.setAttribute('aria-label','Erinnerung deaktivieren');
    retract.addEventListener('click',async()=>{
      if(!window.confirm('Diese Erinnerung deaktivieren? Sie wird Romy danach nicht mehr als gültige Erinnerung angeboten.'))return;
      retract.disabled=true;
      const {data:updated,error:retractError}=await sb.from('office_romy_memories')
        .update({status:'retracted',retracted_at:new Date().toISOString()})
        .eq('id',memory.id).eq('user_id',ownerId).eq('status','accepted')
        .select('id').maybeSingle();
      if(retractError||!updated){retract.disabled=false;status('Erinnerung konnte nicht deaktiviert werden.');return}
      row.remove();
      status('Die Erinnerung wurde deaktiviert. Der Prüfverlauf bleibt erhalten.');
    });
    row.append(content,retract);list.appendChild(row);
  }
  body.appendChild(list);
}
addMenuButton('officeAssistantHistory','Meine Gespräche',()=>void refreshThreads().then(openHistory));
addMenuButton('officeAssistantMemories','Meine Erinnerungen',()=>void openMemories());
addMenuButton('officeAssistantRuns','Meine Arbeitsaufträge',()=>void openCapabilityRuns());
addMenuButton('officeAssistantNew','Neues Gespräch',startNew);
async function init(){
  const {data:{session},error}=await sb.auth.getSession();
  if(error||!session){status('Bitte melden Sie sich im Office an.');return}
  const {data:member, error:memberError}=await sb.from('office_members')
    .select('is_active,must_change_password').eq('user_id',session.user.id).maybeSingle();
  if(memberError||!member?.is_active||member.must_change_password){
    status('Ihr Office-Zugang ist nicht aktiv.');return;
  }
  ownerId=session.user.id;
  rows=[];display();
  if(await refreshThreads()&&threads.length)await loadThread(threads[0].id);
}
const initialized=init();
sb.auth.onAuthStateChange?.((_event,session)=>{
  if(ownerId&&session?.user?.id!==ownerId){
    clearTimeout(capabilityTimer);capabilityTimer=null;
    ownerId=null;threadId=null;threads=[];rows=[];display();
  }
});
window.TBA_OFFICE_ASSISTANT={send,openHistory,startNew,showAttachmentNotice};
})();
