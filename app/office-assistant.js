// Personal assistant in TBA Office. No imported Window/Isabella memory, tools or chat state.
(()=>{
'use strict';
const sb=window.MINDS_SUPABASE;
const root=document.getElementById('assistantScreen');
if(!sb||!root)return;
let userId=null,conversationId=null,busy=false,threads=[],ticket=0;
const E=(tag,className,text)=>{
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined)el.textContent=String(text);
  return el;
};
const workspace=E('div','office-chat-layout');
workspace.innerHTML=`
  <aside class="office-chat-sidebar">
    <div class="office-chat-sidebar-head">
      <strong>Meine Gespräche</strong>
      <button type="button" id="officeChatNew">＋ Neu</button>
    </div>
    <div id="officeChatThreads" class="office-chat-threads" aria-label="Meine Gespräche"></div>
  </aside>
  <section class="office-chat-main" aria-label="Persönlicher Assistent">
    <header class="office-chat-head">
      <div><h1>Assistent</h1><small id="officeChatIdentity">Persönliches Gespräch</small></div>
      <label class="office-chat-mode-label">Antwortmodus
        <select id="officeChatMode" aria-label="Antwortmodus">
          <option value="standard">Schnell</option>
          <option value="gruendlich">Gründlich</option>
        </select>
      </label>
    </header>
    <div id="officeChatMessages" class="office-chat-messages" role="log" aria-live="polite"></div>
    <form id="officeChatForm" class="office-chat-form">
      <label for="officeChatInput" class="office-chat-sr-only">Ihre Nachricht</label>
      <textarea id="officeChatInput" rows="2" maxlength="4000" placeholder="Schreiben Sie Ihrem Assistenten …"></textarea>
      <button type="submit" id="officeChatSend">Senden</button>
    </form>
    <div id="officeChatStatus" class="office-chat-status" role="status" aria-live="polite"></div>
  </section>
`;
root.appendChild(workspace);
const $=sel=>workspace.querySelector(sel);
function status(message=''){const el=$('#officeChatStatus');if(el)el.textContent=message}
function errorText(error,body){
  const code=String(body?.error||'');
  const messages={
    request_already_received:'Diese Nachricht wurde bereits empfangen. Bitte laden Sie den Verlauf erneut.',
    conversation_not_found:'Dieses Gespräch ist für Ihr Konto nicht verfügbar.',
    member_not_active:'Ihr Office-Zugang ist nicht aktiv.',
    ai_provider_unavailable:'Der KI-Dienst ist momentan nicht verfügbar.',
    ai_timeout_or_network:'Die Anfrage hat zu lange gedauert. Bitte prüfen Sie den Verlauf vor erneutem Senden.',
    assistant_not_configured:'Der Assistent ist serverseitig noch nicht vollständig eingerichtet.',
    request_registration_unavailable:'Ihre Anfrage konnte nicht sicher erfasst werden. Bitte versuchen Sie es erneut.',
  };
  return messages[code]||'Die Nachricht konnte nicht abgeschlossen werden. Bitte prüfen Sie den Verlauf und versuchen Sie es erneut.';
}
function emptyState(){
  const wrap=E('div','office-chat-empty');
  wrap.appendChild(E('h2','', 'Ihr persönlicher Assistent'));
  wrap.appendChild(E('p','',
    'Ihre Gespräche gehören nur zu Ihrem Konto. Der Assistent kann derzeit keine Projektdateien, Aufgaben oder Kalender selbstständig lesen und nichts verändern.'));
  return wrap;
}
function bubble(role,content,provisional=false){
  const article=E('article','office-chat-bubble '+(role==='user'?'from-user':'from-assistant')+(provisional?' pending':'')); 
  article.appendChild(E('div','office-chat-bubble-author',role==='user'?'Sie':'Assistent'));
  article.appendChild(E('div','office-chat-bubble-text',content));
  return article;
}
function drawMessages(rows){
  const out=$('#officeChatMessages');out.replaceChildren();
  if(!(rows||[]).length){out.appendChild(emptyState());return}
  for(const m of rows)out.appendChild(bubble(m.role,m.content));
  out.scrollTop=out.scrollHeight;
}
function drawThreads(){
  const target=$('#officeChatThreads');target.replaceChildren();
  if(!threads.length)target.appendChild(E('p','office-chat-no-threads','Noch keine Gespräche.'));
  for(const t of threads){
    const row=E('div','office-chat-thread'+(t.id===conversationId?' active':''));
    const open=E('button','office-chat-thread-open',t.title);
    open.type='button';open.title=t.title;
    open.addEventListener('click',()=>void selectThread(t.id));
    const rename=E('button','office-chat-thread-small','✎');
    rename.type='button';rename.title='Gespräch umbenennen';
    rename.setAttribute('aria-label','Umbenennen: '+t.title);
    rename.addEventListener('click',()=>void renameThread(t));
    const remove=E('button','office-chat-thread-small','×');
    remove.type='button';remove.title='Gespräch löschen';
    remove.setAttribute('aria-label','Löschen: '+t.title);
    remove.addEventListener('click',()=>void deleteThread(t));
    row.append(open,rename,remove);target.appendChild(row);
  }
}
async function refreshThreads(){
  if(!userId)return;
  const {data,error}=await sb.from('office_assistant_conversations')
    .select('id,title,updated_at').eq('user_id',userId)
    .order('updated_at',{ascending:false}).limit(100);
  if(error){status('Gespräche konnten nicht geladen werden.');return}
  threads=data||[];drawThreads();
}
async function selectThread(id){
  if(busy)return;
  conversationId=id;drawThreads();
  const current=++ticket;
  status('Gespräch wird geladen …');
  const {data,error}=await sb.from('office_assistant_messages')
    .select('id,role,content,created_at').eq('conversation_id',id)
    .order('created_at',{ascending:true}).order('id',{ascending:true}).limit(250);
  if(ticket!==current)return;
  if(error){status('Nachrichten konnten nicht geladen werden.');return}
  drawMessages(data||[]);status('');
}
function newThread(){
  if(busy)return;
  ticket++;conversationId=null;drawThreads();drawMessages([]);status('');
  $('#officeChatInput').focus();
}
async function renameThread(thread){
  if(busy)return;
  const value=window.prompt('Neuer Gesprächstitel:',thread.title);
  if(value===null||value.trim()===thread.title)return;
  if(!value.trim()||value.trim().length>140){status('Bitte einen gültigen Titel angeben.');return}
  const {error}=await sb.from('office_assistant_conversations')
    .update({title:value.trim()}).eq('id',thread.id).eq('user_id',userId);
  if(error){status('Umbenennen fehlgeschlagen.');return}
  await refreshThreads();status('Titel aktualisiert.');
}
async function deleteThread(thread){
  if(busy)return;
  if(!window.confirm('Gespräch „'+thread.title+'“ mit allen Nachrichten endgültig löschen?'))return;
  const {error}=await sb.from('office_assistant_conversations')
    .delete().eq('id',thread.id).eq('user_id',userId);
  if(error){status('Das Gespräch konnte nicht gelöscht werden.');return}
  if(conversationId===thread.id)newThread();
  await refreshThreads();status('Gespräch gelöscht.');
}
async function send(event){
  event?.preventDefault?.();
  if(busy||!userId)return;
  const input=$('#officeChatInput'),message=input.value.trim();
  if(!message||message.length>4000)return;
  if(!crypto?.randomUUID){status('Dieser Browser unterstützt keine sichere Nachrichten-ID.');return}
  let failure='';
  busy=true;$('#officeChatSend').disabled=true;
  $('#officeChatMode').disabled=true;$('#officeChatNew').disabled=true;
  const target=$('#officeChatMessages');
  if(target.querySelector('.office-chat-empty'))target.replaceChildren();
  target.appendChild(bubble('user',message,true));
  target.scrollTop=target.scrollHeight;
  input.value='';input.disabled=true;
  status('Antwort wird vorbereitet …');
  try{
    const {data,error}=await sb.functions.invoke('office-assistant',{
      body:{message,mode:$('#officeChatMode').value,conversation_id:conversationId,request_id:crypto.randomUUID()}
    });
    if(error){
      let body={};
      try{body=await error.context?.clone?.().json()}catch{}
      failure=errorText(error,body);
      return;
    }
    if(!data?.conversation_id||!data?.reply)throw new Error('incomplete_reply');
    conversationId=data.conversation_id;
    await refreshThreads();
    await selectThread(conversationId);
    status('');
  }catch(error){
    console.error('office_assistant_ui_error',String(error?.name||'request_failed'));
    failure='Die Antwort konnte nicht bestätigt werden. Bitte prüfen Sie den Gesprächsverlauf.';
  }finally{
    busy=false;input.disabled=false;$('#officeChatSend').disabled=false;
    $('#officeChatMode').disabled=false;$('#officeChatNew').disabled=false;
    await refreshThreads();
    if(conversationId)await selectThread(conversationId);
    else drawMessages([]);
    if(failure)status(failure);
    if(!input.value)input.focus();
  }
}
async function init(){
  const {data:{session},error}=await sb.auth.getSession();
  if(error||!session){status('Bitte melden Sie sich im Office an.');return}
  const {data:member}=await sb.from('office_members')
    .select('display_name,is_active,must_change_password').eq('user_id',session.user.id).maybeSingle();
  if(!member?.is_active||member.must_change_password){status('Der Office-Zugang ist nicht aktiv.');return}
  userId=session.user.id;
  $('#officeChatIdentity').textContent=(member.display_name||'Ihr Konto')+' · Persönlicher Verlauf';
  drawMessages([]);await refreshThreads();
}
$('#officeChatNew').addEventListener('click',newThread);
$('#officeChatForm').addEventListener('submit',event=>void send(event));
$('#officeChatInput').addEventListener('keydown',event=>{
  if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)){event.preventDefault();void send(event)}
});
window.addEventListener('office:member',event=>{
  if(!event.detail?.is_active && userId){userId=null;newThread();status('Der Office-Zugang ist nicht aktiv.')}
});
void init();
})();
