// Office-only adapter for the shared Window chat UI and Window AI client.
// The source of truth is Office conversations/conversation_messages under RLS.
// No second chat renderer, no browser-authored assistant turns, no silent fallback.
(()=>{
'use strict';
if(window.APP_PROFILE!=='office'||window.APP_CHAT_RUNTIME==='legacy')return;
const sb=window.MINDS_SUPABASE,app=()=>window.ISABELLA_APP;
if(!sb)return;
let ownerId=null,activeId=null,serial=0,loading=false;
const status=(value='')=>{
  let box=document.getElementById('officeAssistantStatus');
  if(!box){
    const composer=document.querySelector('#assistantScreen .composer-wrap');
    if(!composer)return;
    box=document.createElement('div');box.id='officeAssistantStatus';box.className='office-assistant-status';
    box.setAttribute('role','status');box.setAttribute('aria-live','polite');
    composer.prepend(box);
  }
  box.textContent=value;box.hidden=!value;
};
const node=(tag,text,className)=>{
  const el=document.createElement(tag);if(text!=null)el.textContent=String(text);
  if(className)el.className=className;
  return el;
};
async function authenticated(){
  const {data:{session},error}=await sb.auth.getSession();
  if(error||!session?.user?.id)return null;
  const {data:member,error:memberError}=await sb.from('office_members')
    .select('is_active,must_change_password').eq('user_id',session.user.id).maybeSingle();
  return !memberError&&member?.is_active&&!member.must_change_password?session.user.id:null;
}
async function history(){
  if(!ownerId)return {data:[],error:'not_authenticated'};
  return sb.from('conversations').select('id,title,updated_at')
    .eq('user_id',ownerId).eq('app_scope','isabella').eq('origin_kind','global')
    .order('updated_at',{ascending:false}).limit(100);
}
async function activate(id,{promote=false}={}){
  if(!ownerId||!id)return false;
  const {data:rows,error}=await sb.from('conversations').select('id')
    .eq('user_id',ownerId).eq('id',id).eq('app_scope','isabella')
    .eq('origin_kind','global').limit(1);
  if(error||rows?.length!==1)return false;
  if(promote){
    // Window's browser turn selects the newest conversation by updated_at.
    // Make this owner-authorized navigation the active conversation, atomically
    // in Office. Never let the client forge another person's conversation.
    const {data,error:updateError}=await sb.from('conversations')
      .update({updated_at:new Date().toISOString()})
      .eq('id',id).eq('user_id',ownerId).eq('app_scope','isabella')
      .select('id').maybeSingle();
    if(updateError||data?.id!==id)return false;
  }
  activeId=id;return true;
}
async function reconcile(){
  if(loading)return false;
  loading=true;
  const token=++serial;
  try{
    const owner=await authenticated();
    if(token!==serial)return false;
    if(!owner){
      ownerId=null;activeId=null;app()?.setOfficeMessages?.([]);
      status('Bitte im Office anmelden, um Romy zu nutzen.');
      return false;
    }
    if(ownerId!==owner){ownerId=owner;activeId=null;app()?.setOfficeMessages?.([])}
    const chats=await history();
    if(chats.error){status('Gesprächsverlauf momentan nicht verfügbar.');return false}
    const latest=(chats.data||[])[0]?.id||null;
    if(!activeId||!(chats.data||[]).some(c=>c.id===activeId))activeId=latest;
    if(!activeId){app()?.setOfficeMessages?.([]);status('');return true}
    const {data,error}=await sb.from('conversation_messages')
      .select('id,client_key,role,content,metadata,created_at,provisional')
      .eq('user_id',ownerId).eq('conversation_id',activeId)
      .eq('provisional',false).order('created_at',{ascending:true}).limit(300);
    if(token!==serial)return false;
    if(error){status('Die Nachrichten konnten nicht überprüft werden.');return false}
    // Temporary receipt overlay stays visible while Undo is valid. A remote
    // reply is always canonical; local-only events can never become truth.
    const receipts=app()?.getState?.().messages?.filter(m=>
      m.metadata?.direct_undo?.status==='ready'&&
      Date.parse(m.metadata.direct_undo.expires_at||'')>Date.now())||[];
    const remoteIds=new Set((data||[]).map(x=>x.id));
    const overlays=receipts.filter(x=>!remoteIds.has(x.id))
      .map(x=>({id:x.id,role:'assistant',content:x.text,metadata:x.metadata,created_at:x.at}));
    app()?.setOfficeMessages?.([...(data||[]),...overlays]);
    status('');
    return true;
  }catch{
    status('Der kanonische Chat ist momentan nicht verfügbar.');
    return false;
  }finally{loading=false}
}
async function startNew(){
  if(!ownerId){status('Bitte erst im Office anmelden.');return false}
  const {data,error}=await sb.from('conversations').insert({
    user_id:ownerId,origin_kind:'global',app_scope:'isabella',
    origin_anchor:{type:'assistant',id:'isabella',label:'Romy'},
    title:'Romy',mode:'memory',metadata:{app:'romy'}
  }).select('id').single();
  if(error||!data?.id){status('Neues Gespräch konnte nicht erstellt werden.');return false}
  activeId=data.id;app()?.setOfficeMessages?.([]);status('');
  document.getElementById('chatInput')?.focus();return true;
}
async function openHistory(){
  if(!ownerId)return;
  const {data,error}=await history();
  if(error){status('Gesprächsverlauf momentan nicht verfügbar.');return}
  app()?.openModal?.('Meine Gespräche','');
  const body=document.getElementById('modalBody');
  if(!body)return;body.replaceChildren();
  const button=node('button','＋ Neues Gespräch','secondary');
  button.type='button';button.addEventListener('click',async()=>{
    if(await startNew())app()?.closeModal?.()
  });body.appendChild(button);
  for(const c of data||[]){
    const row=node('div',null,'office-assistant-history-row');
    const open=node('button',c.title||'Romy','office-assistant-history-open');
    open.type='button';
    if(activeId===c.id)open.setAttribute('aria-current','true');
    open.addEventListener('click',async()=>{
      if(!await activate(c.id,{promote:true})){
        status('Dieses Gespräch ist nicht verfügbar.');return;
      }
      app()?.closeModal?.();await reconcile();
    });
    row.append(open);body.appendChild(row);
  }
}
function showAttachmentNotice(){
  status('Diese Datei kann zurzeit nicht überprüft werden. Kein Upload gilt als erfolgreich.');
}
function toggleLegacy(){
  const legacy=window.confirm('Alten Romy-Chat als Notfall-Alternative öffnen? Der neue Chat bleibt im Office gespeichert. Das Umschalten führt nicht zu einem Datenabgleich zwischen den zwei Verläufen.');
  if(!legacy)return;
  localStorage.setItem('tba_office_chat_backend','legacy');location.reload();
}
function addMenu(id,label,action){
  if(document.getElementById(id))return;
  const signout=document.getElementById('officeSignOut');
  if(!signout?.parentNode)return;
  const b=node('button',label,'office-assistant-menu-action');
  b.id=id;b.type='button';
  b.addEventListener('click',()=>{document.getElementById('closeDrawer')?.click();void action()});
  signout.parentNode.insertBefore(b,signout);
}
async function initialize(){
  // app.js declares ISABELLA_APP in the same synchronous document execution.
  addMenu('officeEngineHistory','Meine Gespräche',openHistory);
  addMenu('officeEngineNewChat','Neues Gespräch',startNew);
  addMenu('officeEngineFallback','Vorherige Romy-Version',toggleLegacy);
  await reconcile();
}
window.TBA_OFFICE_ENGINE_CHAT=Object.freeze({reconcile,openHistory,startNew,showAttachmentNotice,
  currentConversationId:()=>activeId});
sb.auth.onAuthStateChange?.((_evt,session)=>{
  if(ownerId&&session?.user?.id!==ownerId){
    ++serial;ownerId=null;activeId=null;
    app()?.setOfficeMessages?.([]);
  }
});
void initialize();
window.addEventListener('pageshow',()=>void reconcile());
})();
