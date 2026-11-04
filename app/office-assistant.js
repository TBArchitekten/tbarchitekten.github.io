// TBA Office · adapter for Window's ORIGINAL assistant screen.
// Do not build a second chat interface. Only wire Window's composer, message
// renderer, navigation and modal to Office's per-employee Supabase history.
(()=>{
'use strict';
const sb=window.MINDS_SUPABASE;
const screen=document.getElementById('assistantScreen');
const app=()=>window.ISABELLA_APP;
if(!sb||!screen)return;

let ownerId=null,threadId=null,threads=[],rows=[],busy=false,loadVersion=0,mode='standard';
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
  const {data,error}=await sb.from('office_assistant_conversations')
    .select('id,title,updated_at').eq('user_id',ownerId)
    .order('updated_at',{ascending:false}).limit(100);
  if(error){status('Die Gesprächsliste konnte nicht geladen werden.');return false}
  threads=data||[];
  return true;
}
async function loadThread(id,{internal=false}={}){
  if(!ownerId||!id||(busy&&!internal))return false;
  const serial=++loadVersion;
  const {data,error}=await sb.from('office_assistant_messages')
    .select('id,role,content,created_at').eq('conversation_id',id)
    .order('created_at',{ascending:true}).order('id',{ascending:true}).limit(250);
  if(serial!==loadVersion)return false;
  if(error){status('Die Nachrichten konnten nicht geladen werden.');return false}
  threadId=id;rows=data||[];display();status('');
  return true;
}
function startNew(){
  if(busy)return;
  ++loadVersion;threadId=null;rows=[];display();status('');
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
  const label=element('label','Antwortmodus ','office-assistant-mode');
  const select=element('select');
  for(const [value,title] of [['standard','Schnell'],['gruendlich','Gründlich']]){
    const option=element('option',title);option.value=value;select.appendChild(option);
  }
  select.value=mode;
  select.addEventListener('change',()=>{mode=select.value});
  label.appendChild(select);
  controls.appendChild(label);
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
function showAttachmentNotice(){
  status('Dateianhänge im Büro-Chat sind noch nicht freigeschaltet. Text und Sprache funktionieren.');
}
async function send(message,{attachments=[]}={}){
  await initialized;
  if(busy)return;
  if(!ownerId){status('Bitte melden Sie sich erneut im Office an.');return}
  if(attachments.length){showAttachmentNotice();return}
  const text=String(message||'').trim();
  if(!text||text.length>4000){status('Bitte eine Nachricht mit maximal 4000 Zeichen eingeben.');return}
  if(!globalThis.crypto?.randomUUID){status('Dieser Browser unterstützt keine sichere Nachrichten-ID.');return}
  busy=true;
  const requestId=crypto.randomUUID();
  const targetThread=threadId;
  display([...rows,{id:requestId,role:'user',content:text,created_at:new Date().toISOString()}]);
  const sendButton=document.getElementById('sendButton');
  if(sendButton)sendButton.disabled=true;
  let failure='';
  status('Der Assistent antwortet …');
  try{
    const {data,error}=await sb.functions.invoke('office-assistant',{
      body:{message:text,mode,conversation_id:targetThread,request_id:requestId}
    });
    if(error){
      let body={};
      try{body=await error.context?.clone?.().json()}catch{}
      failure=errorMessage(body?.error);
    }else if(data?.conversation_id&&data?.reply){
      threadId=data.conversation_id;
    }else failure=errorMessage('invalid_reply');
  }catch(err){
    console.error('office_assistant_request_error',String(err?.name||'request_error'));
    failure=errorMessage('request_unconfirmed');
  }finally{
    busy=false;
    if(sendButton)sendButton.disabled=false;
    await refreshThreads();
    const toOpen=threadId||threads[0]?.id;
    if(toOpen)await loadThread(toOpen,{internal:true});
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
addMenuButton('officeAssistantHistory','Meine Gespräche',()=>void refreshThreads().then(openHistory));
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
    ownerId=null;threadId=null;threads=[];rows=[];display();
  }
});
window.TBA_OFFICE_ASSISTANT={send,openHistory,startNew,showAttachmentNotice};
})();
