(()=>{
  'use strict';
  const CFG=window.TBA_OFFICE_CONFIG,C=window.TBA_OFFICE_CORE;
  // Die Startseite ist nur noch die Anmeldung (27.11.2026, Gari: «cuando entro a Systemstatus se vuelve a colar la
  // versión de pantalla que no debe de ser … hace hasta un login entremedio»). Alles andere lebt in der App (./app/):
  // alte Adressen führen sofort dorthin, ohne dass die Anmeldung oder eine alte Ansicht aufblitzt. Hier bleiben das
  // Anmelden und das eigene Passwort (beim ersten Anmelden Pflicht, sonst über #password).
  function appZiel(hash){
    if(/^#section=/.test(hash))return './app/'+hash;
    const r=C.viewFromHash(hash);
    const projekt=r.view==='project'&&r.id?'&project='+encodeURIComponent(r.id):'';
    if(r.view==='kalender')return './app/#section=calendar';
    if(r.view==='members')return './app/#section=mitglieder';
    if(['plans','tools','kinutzung','systemstatus'].includes(r.view))return './app/#section='+r.view;
    return './app/#section=work'+projekt;
  }
  const zurApp=()=>location.hash&&location.hash!=='#'&&location.hash!=='#password';
  if(zurApp()){location.replace(appZiel(location.hash));return}
  window.addEventListener('hashchange',()=>{if(zurApp())location.replace(appZiel(location.hash))});

  // In the Window app the app holds the Office session and lends it through the bridge
  // (shared/supabase-client.js); this page never asks for a second sign-in there.
  const sb=window.MINDS_SUPABASE||supabase.createClient(CFG.url,CFG.key,{auth:{storageKey:CFG.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const inApp=!!window.WINDOW_NATIVE?.available;
  // Sessions of the previous Office backend (Bernried Project Hub) are no longer valid here.
  try{localStorage.removeItem('tba-office-auth-v1')}catch{}

  const $=s=>document.querySelector(s);
  const views={auth:$('#authView'),password:$('#passwordView')};
  let member=null,booting=null,passwordVoluntary=false;
  function showOnly(name){for(const [k,el] of Object.entries(views))el.hidden=k!==name}

  async function ownMembership(uid){
    const {data,error}=await sb.from('office_members')
      .select('user_id,email,display_name,role,is_active,must_change_password')
      .eq('user_id',uid).eq('is_active',true).maybeSingle();
    if(error)throw error;
    return data;
  }
  async function boot(session){
    if(!session&&inApp){void window.WINDOW_NATIVE.call('session.signIn');location.replace('./app/');return}
    if(!session){showOnly('auth');return}
    member=await ownMembership(session.user.id);
    if(!member){
      await sb.auth.signOut();
      showOnly('auth');
      $('#loginMessage').textContent='Für dieses Konto ist kein Office-Zugang freigeschaltet.';
      return;
    }
    if(member.must_change_password){openPassword(false);return}
    if(location.hash==='#password'){openPassword(true);return}
    location.replace('./app/');
  }
  // onAuthStateChange and getSession may both fire at start: boot once at a time.
  function bootSafely(session){
    booting=(booting||Promise.resolve()).then(()=>boot(session)).catch(err=>{
      console.error(err);showOnly('auth');
      $('#loginMessage').textContent='Office konnte nicht geladen werden.';
    });
    return booting;
  }

  // ── Own password ─────────────────────────────────────────────────────────
  function openPassword(voluntary){
    passwordVoluntary=voluntary;
    $('#passwordTitle').textContent=voluntary?'Passwort ändern':'Eigenes Passwort festlegen';
    $('#passwordLead').textContent=voluntary?'Neues Passwort für Ihren Office-Zugang.':'Sie haben sich mit einem Startpasswort angemeldet. Legen Sie jetzt Ihr eigenes fest – nur Sie kennen es.';
    $('#passwordRule').textContent=`Mindestens ${CFG.minPasswordLength} Zeichen. Ein Satz aus mehreren Wörtern ist sicher und leicht zu merken.`;
    $('#cancelPassword').hidden=!voluntary;
    $('#passwordForm').reset();$('#passwordMessage').textContent='';
    showOnly('password');$('#newPassword').focus();
  }
  $('#passwordForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const msg=$('#passwordMessage'),pw=$('#newPassword').value;
    const problem=C.passwordProblem(pw,$('#newPasswordRepeat').value,CFG.minPasswordLength);
    if(problem){msg.textContent=problem;return}
    const submit=e.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;
    try{
      const {error}=await sb.auth.updateUser({password:pw});
      if(error){msg.textContent=C.authErrorText(error);return}
      if(member?.must_change_password){
        const {error:flagError}=await sb.rpc('office_password_changed');
        if(flagError){msg.textContent='Passwort gespeichert, aber der Status konnte nicht aktualisiert werden. Bitte neu laden.';return}
      }
      location.replace('./app/');
    }finally{submit.disabled=false}
  });
  $('#cancelPassword').onclick=()=>{if(passwordVoluntary)location.replace('./app/')};

  // ── Sign-in ──────────────────────────────────────────────────────────────
  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    $('#loginMessage').textContent='';
    const submit=e.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;
    try{
      const {data,error}=await sb.auth.signInWithPassword({email:$('#email').value.trim().toLowerCase(),password:$('#password').value});
      if(error){$('#loginMessage').textContent='Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.';return}
      $('#password').value='';
      await bootSafely(data.session);
    }finally{submit.disabled=false}
  });

  sb.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')showOnly('auth')});
  sb.auth.getSession().then(({data})=>bootSafely(data.session)).catch(console.error);
})();
