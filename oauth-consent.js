/* TBA Office · OAuth consent for connectors (Claude), like Window's.
   Supabase Auth's OAuth 2.1 server of the office project sends the browser here with ?authorization_id=…
   We make sure the employee is signed in (office e-mail and password, the same session as the office
   start page), show which app asks and where it will return, and approve or deny. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const cfg=window.TBA_OFFICE_CONFIG;
const sb=cfg&&window.supabase?.createClient?window.supabase.createClient(cfg.url,cfg.key,{auth:{storageKey:cfg.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null;
const params=new URLSearchParams(location.search);
const authorizationId=params.get('authorization_id')||'';
const show=id=>{for(const s of ['loading','signin','consent','done'])$(s).hidden=s!==id};
const status=(text,isError=false)=>{const el=$('status');el.textContent=text||'';el.classList.toggle('error',!!isError)};
const errorText=e=>String(e?.message||e||'Unbekannter Fehler');
function go(url){
  try{const u=new URL(url);if(!/^https?:$/.test(u.protocol))throw new Error('redirect')}catch{status('Die Rücksprungadresse ist ungültig.',true);return}
  show('done');location.replace(url);
}
function hostOf(uri){try{return new URL(uri).host}catch{return ''}}
async function session(){const {data}=await sb.auth.getSession();return data?.session||null}
// Only active members with their own password, like every office page.
async function activeMember(user){
  const {data,error}=await sb.from('office_members').select('is_active,must_change_password').eq('user_id',user.id).maybeSingle();
  if(error||!data?.is_active)return 'Kein aktiver Office-Zugang.';
  if(data.must_change_password)return 'Bitte zuerst im Office das Startpasswort ändern.';
  return '';
}
async function loadConsent(){
  show('loading');status('');
  const s=await session();
  const problem=s?.user?await activeMember(s.user):'Bitte anmelden.';
  if(problem){show('done');$('doneTitle').textContent='Verbindung nicht möglich';$('doneText').textContent=problem;return}
  const api=sb?.auth?.oauth;
  if(!api?.getAuthorizationDetails){show('done');$('doneTitle').textContent='Verbindung nicht möglich';$('doneText').textContent='Diese Version des Supabase-Clients kennt den OAuth-Server nicht. Bitte später neu laden.';return}
  const {data,error}=await api.getAuthorizationDetails(authorizationId);
  if(error){show('done');$('doneTitle').textContent='Die Anfrage ist nicht mehr gültig';$('doneText').textContent='Geh zurück zur App und starte die Verbindung neu. ('+errorText(error)+')';return}
  // Already approved earlier: Supabase hands back the redirect straight away.
  if(data?.redirect_url&&!data?.authorization_id){go(data.redirect_url);return}
  const client=data?.client||{};
  const name=client.name||client.client_name||data?.client_name||'Eine App';
  const redirect=data?.redirect_uri||client.redirect_uri||'';
  $('clientName').textContent=name;
  $('consentTitle').textContent=name+' mit TBA Office verbinden?';
  $('clientHost').textContent=redirect?'Rücksprung zu: '+hostOf(redirect):'';
  $('account').textContent=s.user.email?'Konto: '+s.user.email:'';
  show('consent');
}
async function decide(approve){
  $('approve').disabled=$('deny').disabled=true;
  status(approve?'Verbinde …':'Breche ab …');
  const api=sb.auth.oauth;
  const {data,error}=approve?await api.approveAuthorization(authorizationId):await api.denyAuthorization(authorizationId);
  if(error||!data?.redirect_url){$('approve').disabled=$('deny').disabled=false;status('Die Antwort konnte nicht gesendet werden: '+errorText(error||'keine Rücksprungadresse'),true);return}
  go(data.redirect_url);
}
function signIn(){
  show('signin');
  const submit=async()=>{
    const email=$('email').value.trim().toLowerCase(),password=$('password').value;
    if(!email||!password){status('Bitte E-Mail und Passwort eingeben.',true);return}
    $('signInButton').disabled=true;status('Anmelden …');
    const {error}=await sb.auth.signInWithPassword({email,password});
    $('password').value='';
    if(error){$('signInButton').disabled=false;status('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.',true);return}
    await loadConsent();
  };
  $('signInButton').onclick=()=>void submit();
  $('password').addEventListener('keydown',e=>{if(e.key==='Enter')void submit()});
}
async function start(){
  if(!sb){show('done');$('doneTitle').textContent='Office nicht erreichbar';$('doneText').textContent='Die Verbindung zum Office konnte nicht geladen werden. Bitte neu laden.';return}
  if(!/^[A-Za-z0-9_-]{8,200}$/.test(authorizationId)){show('done');$('doneTitle').textContent='Keine Verbindungsanfrage';$('doneText').textContent='Öffne diese Seite aus der App, die du verbinden willst (z. B. Claude → Connectors).';return}
  $('approve').onclick=()=>void decide(true);
  $('deny').onclick=()=>void decide(false);
  try{(await session())?await loadConsent():signIn()}catch(e){status(errorText(e),true)}
}
void start();
})();
