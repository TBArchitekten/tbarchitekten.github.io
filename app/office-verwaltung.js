// TBA Office · Administration in der App (27.11.2026, Gari: «cuando entro a Systemstatus se vuelve a colar la versión de
// pantalla que no debe de ser … revísalo en todos lados que esto no pase»). KI-Nutzung, Systemstatus und Mitglieder sind
// Bildschirme der App (#section=kinutzung, systemstatus, mitglieder), «Passwort ändern» ist ein Dialog der App. Die
// Startseite ist nur noch die Anmeldung. Was KI-Nutzung und Systemstatus zeigen, kommt aus ../office-uebersicht.js; die
// Zugänge verwaltet die Funktion office-admin. Die Datenbank prüft die Rolle jedes Mal selbst; hier sehen Personen ohne
// Administration nur einen Hinweis.
(()=>{
  'use strict';
  const C=window.TBA_OFFICE_CORE,CFG=window.TBA_OFFICE_CONFIG;
  const sb=()=>window.MINDS_SUPABASE;
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const SEITEN={kinutzung:'officeKiNutzung',systemstatus:'officeSystemstatus',mitglieder:'officeMitglieder'};
  let mitglied=window.TBA_OFFICE_MEMBER||null,offen=null;

  function zeigen(name){
    const host=document.getElementById(SEITEN[name]||'');
    if(!host)return;
    offen=name;
    // Die Rolle kommt mit der Synchronisierung (office:member); bis dahin wartet die Seite.
    if(!mitglied){host.innerHTML='<div class="empty">Lade …</div>';return}
    if(mitglied.role!=='admin'){host.innerHTML='<div class="empty">Diese Seite ist nur für die Administration.</div>';return}
    const U=window.TBA_OFFICE_UEBERSICHT;
    if(name==='kinutzung')void U?.kiNutzung(host,sb());
    if(name==='systemstatus')void U?.systemstatus(host,sb());
    if(name==='mitglieder')mitglieder(host);
  }
  window.addEventListener('office:member',e=>{
    const vorher=mitglied;mitglied=e.detail||null;
    if(!vorher&&offen&&window.ISABELLA_APP?.getState?.()?.screen===offen)zeigen(offen);
  });

  // ── Mitglieder ──────────────────────────────────────────────────────────
  async function admin(action,payload={}){
    const {data,error}=await sb().functions.invoke('office-admin',{body:{action,...payload}});
    if(error){
      let code='';
      try{code=(await error.context?.json?.())?.error||''}catch{}
      throw new Error(C.adminErrorText(code));
    }
    return data;
  }
  const tagDe=iso=>{try{return new Date(iso).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}catch{return ''}};
  function mitglieder(host){
    host.innerHTML=`
      <div class="page-head">
        <div>
          <p class="eyebrow">Administration</p>
          <h1>Mitglieder</h1>
          <p class="lead">Zugänge anlegen, Rollen ändern, Passwörter zurücksetzen. Es werden keine E-Mails verschickt: Das Startpasswort geben Sie persönlich weiter.</p>
        </div>
      </div>
      <form class="card member-form" data-member-form>
        <label>Büro-E-Mail<input name="email" type="email" placeholder="name@bernhardarchitekten.com" required></label>
        <label>Name<input name="name" type="text" maxlength="80" required></label>
        <label>Rolle
          <select name="rolle">${Object.entries(C.ROLE_LABELS).map(([v,l])=>`<option value="${esc(v)}"${v==='member'?' selected':''}>${esc(l)}</option>`).join('')}</select>
        </label>
        <button class="primary" type="submit">Zugang anlegen</button>
      </form>
      <p class="message" data-member-meldung aria-live="polite"></p>
      <div class="card start-password" data-start-passwort hidden role="status">
        <div>
          <p class="eyebrow">Startpasswort · nur jetzt sichtbar</p>
          <p class="muted" data-start-fuer></p>
          <code data-start-wert></code>
        </div>
        <div class="start-password-actions">
          <button type="button" class="primary" data-start-kopieren>Kopieren</button>
          <button type="button" data-start-weg>Ausblenden</button>
        </div>
      </div>
      <section class="section" data-leitfaden hidden>
        <div class="section-title"><h2>Leitfaden «Was darf ins TBA Office?»</h2></div>
        <div class="card leitfaden-card">
          <p class="muted" data-leitfaden-stand></p>
          <button type="button" data-leitfaden-knopf></button>
        </div>
        <p class="message" data-leitfaden-meldung aria-live="polite"></p>
      </section>
      <section class="section">
        <div class="section-title"><h2>Zugänge</h2><span class="count" data-member-zahl>0</span></div>
        <div class="card row-list" data-member-liste></div>
      </section>`;
    const q=s=>host.querySelector(s),meldung=q('[data-member-meldung]');
    const startPasswort=(email,passwort)=>{
      q('[data-start-fuer]').textContent='Für '+email+'. Persönlich weitergeben; beim ersten Anmelden wird ein eigenes Passwort festgelegt.';
      q('[data-start-wert]').textContent=passwort;
      q('[data-start-passwort]').hidden=false;
    };
    q('[data-start-kopieren]').onclick=async e=>{
      const knopf=e.currentTarget;
      try{await navigator.clipboard.writeText(q('[data-start-wert]').textContent);knopf.textContent='Kopiert'}
      catch{knopf.textContent='Bitte manuell kopieren'}
      setTimeout(()=>{knopf.textContent='Kopieren'},2000);
    };
    q('[data-start-weg]').onclick=()=>{q('[data-start-passwort]').hidden=true;q('[data-start-wert]').textContent=''};
    const form=q('[data-member-form]');
    form.onsubmit=async e=>{
      e.preventDefault();
      const knopf=form.querySelector('button[type="submit"]');knopf.disabled=true;meldung.textContent='';
      try{
        const r=await admin('create',{email:form.email.value.trim().toLowerCase(),display_name:form.name.value.trim(),role:form.rolle.value});
        startPasswort(r.email,r.start_password);
        form.reset();await liste();
      }catch(err){meldung.textContent=err.message}
      finally{knopf.disabled=false}
    };
    // Leitfaden «Was darf auf den Desktop?» (25.11.2026): hier freischalten und sehen, wer ihn bestätigt hat.
    // Freigeschaltet zeigt das Office ihn allen einmal beim Öffnen (office-leitfaden.js). Fehlt die Tabelle, bleibt
    // der Abschnitt verborgen.
    async function leitfaden(){
      const abschnitt=q('[data-leitfaden]');
      try{
        const {data:l,error}=await sb().from('office_leitfaeden').select('version,aktiv,geaendert_am').eq('leitfaden','desktop').maybeSingle();
        if(error||!l){abschnitt.hidden=true;return null}
        const {data:b,error:be}=await sb().from('office_leitfaden_bestaetigungen').select('user_id,bestaetigt_am')
          .eq('leitfaden','desktop').eq('version',l.version);
        const gelesen=new Map(be?[]:(b||[]).map(x=>[x.user_id,x.bestaetigt_am]));
        q('[data-leitfaden-stand]').textContent=l.aktiv
          ?`Freigeschaltet seit ${tagDe(l.geaendert_am)} (Stand ${C.formatDate(l.version)}). Wer das Office öffnet, liest ihn einmal und bestätigt mit «Gelesen»; bei jedem Zugang steht, wann.`
          :`Noch nicht freigeschaltet (Stand ${C.formatDate(l.version)}). Freigeschaltet zeigt das Office ihn allen einmal beim Öffnen; bestätigt wird mit «Gelesen».`;
        const knopf=q('[data-leitfaden-knopf]');
        knopf.textContent=l.aktiv?'Ausschalten':'Freischalten';
        knopf.className=l.aktiv?'':'primary';
        knopf.disabled=false;
        knopf.onclick=async()=>{
          knopf.disabled=true;q('[data-leitfaden-meldung]').textContent='';
          const {data,error:ue}=await sb().from('office_leitfaeden').update({aktiv:!l.aktiv}).eq('leitfaden','desktop').select('aktiv');
          if(ue||!data?.length){q('[data-leitfaden-meldung]').textContent='Das hat nicht geklappt. Freischalten kann nur die Administration.';knopf.disabled=false;return}
          await liste();
        };
        abschnitt.hidden=false;
        return {aktiv:l.aktiv===true,gelesen};
      }catch{abschnitt.hidden=true;return null}
    }
    async function liste(){
      const ziel=q('[data-member-liste]');
      ziel.innerHTML='<div class="empty">Lade Zugänge …</div>';
      const ich=window.TBA_OFFICE_MEMBER?.user_id||mitglied?.user_id||'';
      try{
        const [{members:alle},lf]=await Promise.all([admin('list'),leitfaden()]);
        q('[data-member-zahl]').textContent=String(alle.filter(m=>m.is_active).length);
        ziel.innerHTML='';
        for(const m of alle){
          const zeile=document.createElement('div');zeile.className='row member-row'+(m.is_active?'':' is-inactive');
          const selbst=m.user_id===ich;
          const gelesen=lf?.aktiv&&m.is_active
            ?`<div class="row-sub member-leitfaden">${lf.gelesen.has(m.user_id)?'Leitfaden gelesen am '+esc(tagDe(lf.gelesen.get(m.user_id))):'Leitfaden noch nicht bestätigt'}</div>`:'';
          zeile.innerHTML=`<span><div class="row-title">${esc(m.display_name)}</div><div class="row-sub">${esc(m.email)}</div>${gelesen}</span>
            <select data-rolle ${selbst?'disabled':''} aria-label="Rolle">${Object.entries(C.ROLE_LABELS).map(([v,l])=>`<option value="${esc(v)}" ${m.role===v?'selected':''}>${esc(l)}</option>`).join('')}</select>
            <div class="row-sub row-sub-date">${m.must_change_password?'Startpasswort aktiv':m.last_sign_in_at?'Zuletzt '+esc(C.formatDate(m.last_sign_in_at.slice(0,10))):'Noch nicht angemeldet'}</div>
            <button type="button" data-zuruecksetzen ${!m.is_active?'disabled':''}>Passwort zurücksetzen</button>
            <button type="button" data-aktiv ${selbst?'disabled':''}>${m.is_active?'Deaktivieren':'Aktivieren'}</button>`;
          zeile.querySelector('[data-rolle]').onchange=async e=>{
            try{await admin('update',{user_id:m.user_id,role:e.target.value});meldung.textContent=''}
            catch(err){meldung.textContent=err.message;e.target.value=m.role}
          };
          zeile.querySelector('[data-zuruecksetzen]').onclick=async e=>{
            e.target.disabled=true;
            try{const r=await admin('reset_password',{user_id:m.user_id});startPasswort(m.email,r.start_password);await liste()}
            catch(err){meldung.textContent=err.message;e.target.disabled=false}
          };
          zeile.querySelector('[data-aktiv]').onclick=async e=>{
            e.target.disabled=true;
            try{await admin('update',{user_id:m.user_id,is_active:!m.is_active});await liste()}
            catch(err){meldung.textContent=err.message;e.target.disabled=false}
          };
          ziel.append(zeile);
        }
      }catch(err){ziel.innerHTML='<div class="empty">'+esc(err.message)+'</div>'}
    }
    void liste();
  }

  // ── Eigenes Passwort ändern (Dialog der App; das erste Passwort nach dem Startpasswort setzt die Anmeldung) ──
  function passwort(){
    const app=window.ISABELLA_APP;if(!app?.openModal)return;
    app.openModal('Passwort ändern',`<form class="office-passwort" data-passwort-form>
      <p class="muted">Neues Passwort für Ihren Office-Zugang. Mindestens ${esc(CFG.minPasswordLength)} Zeichen; ein Satz aus mehreren Wörtern ist sicher und leicht zu merken.</p>
      <label>Neues Passwort<input name="neu" type="password" autocomplete="new-password" required></label>
      <label>Neues Passwort wiederholen<input name="wieder" type="password" autocomplete="new-password" required></label>
      <p class="message" data-passwort-meldung aria-live="polite"></p>
      <div class="office-passwort-knoepfe"><button type="button" data-passwort-abbrechen>Abbrechen</button><button class="primary" type="submit">Passwort speichern</button></div>
    </form>`);
    const form=document.querySelector('[data-passwort-form]');if(!form)return;
    const meldung=form.querySelector('[data-passwort-meldung]');
    form.querySelector('[data-passwort-abbrechen]').onclick=()=>app.closeModal();
    form.neu.focus();
    form.onsubmit=async e=>{
      e.preventDefault();
      const neu=form.neu.value,problem=C.passwordProblem(neu,form.wieder.value,CFG.minPasswordLength);
      if(problem){meldung.textContent=problem;return}
      const knopf=form.querySelector('button[type="submit"]');knopf.disabled=true;meldung.textContent='';
      try{
        const {error}=await sb().auth.updateUser({password:neu});
        if(error){meldung.textContent=C.authErrorText(error);return}
        form.innerHTML='<p class="office-passwort-ok">Ihr neues Passwort ist gespeichert.</p><div class="office-passwort-knoepfe"><button type="button" class="primary" data-passwort-fertig>Fertig</button></div>';
        form.querySelector('[data-passwort-fertig]').onclick=()=>app.closeModal();
      }catch(err){meldung.textContent=C.authErrorText(err)}
      finally{knopf.disabled=false}
    };
  }

  // Menü «Mehr»: die Seiten öffnen in der App, ohne die Seite zu wechseln.
  document.querySelectorAll('[data-office-verwaltung]').forEach(link=>link.addEventListener('click',e=>{
    e.preventDefault();
    document.getElementById('closeDrawer')?.click();
    const name=link.dataset.officeVerwaltung;
    if(name==='passwort'){passwort();return}
    window.ISABELLA_APP?.show?.(name);
    history.replaceState(null,'','#section='+name);
  }));

  window.TBA_OFFICE_VERWALTUNG={zeigen,passwort,SEITEN:Object.keys(SEITEN)};
})();
