// Synthetischer Supabase-Ersatz für das Controlling in Chromium (25.11.2026). Kein Netz, keine echten Daten: Projekte,
// Personen und Beträge sind erfunden. Daten überleben Seitenwechsel im selben Tab (sessionStorage). Nachgebildet wie in
// der Datenbank (Migrationen office_controlling_v1, _zugang und _nur_liste): Rolle aus window.__ctRolle ('admin' = Admin
// auf der Liste, 'admin-ohne-liste', 'member' oder 'buchhaltung' = Mitglied außerhalb der Teams auf der Liste); voller
// Zugang = auf der Liste office_controlling_zugang; Stunden je Person, Sätze und Einstellungen liest und schreibt nur
// voller Zugang, die Liste ändern nur Admins auf der Liste; office_controlling_summen rechnet wie die
// Funktion (Stunden kumuliert, fehlende Person zählt weiter, Zuwachs zum Satz am Stichtag, Gehalt nur für Admins und
// nur vollständig). Eindeutig: ein Stand je Paket und Tag, eine Zeile je Person und Stand, ein Satz je Person und Tag.
// Seit office_controlling_annahmen: Wochenstunden je Satz (Person B arbeitet 25 von 40 h), Vollzeit-Wochenstunden und ein
// erfundener Gemeinkostenfaktor (2); der Wert zum Gehalt rechnet mit den Jahresstunden der Person. Seit
// office_controlling_jahresstunden: die Angaben der Herleitung aus dem Kalender (leer); seit office_controlling_urlaub
// Urlaubstage und Arbeitstage je Woche an den Sätzen (leer). Seit 26.11.2026 liest jede Abfrage den Stand aus dem
// sessionStorage, damit zwei Rahmen im selben Tab dieselben Daten sehen (Test: andere offene Seiten rechnen neu).
(function(){
  const ROLLE=['member','buchhaltung','admin-ohne-liste'].includes(window.__ctRolle)?window.__ctRolle:'admin';
  const UID='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
  const P1='a1111111-1111-4111-8111-111111111111',P2='a2222222-2222-4222-8222-222222222222',P3='a3333333-3333-4333-8333-333333333333';
  const K1='b1111111-1111-4111-8111-111111111111',K2='b2222222-2222-4222-8222-222222222222';
  const S1='c1111111-1111-4111-8111-111111111111',S2='c2222222-2222-4222-8222-222222222222';
  const KEY='tba_controlling_fake_db_v4';
  const session={access_token:'fake',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,
    user:{id:UID,email:'test@fixture.invalid',aud:'authenticated',role:'authenticated'}};
  const zeit=t=>new Date(t).toISOString();
  const start=()=>({
    office_members:[{user_id:UID,email:'test@fixture.invalid',display_name:'Test Admin',role:'admin',is_active:true,must_change_password:false},
      {user_id:B,email:'b@fixture.invalid',display_name:'Person B',role:'member',is_active:true,must_change_password:false},
      {user_id:C,email:'c@fixture.invalid',display_name:'Person C',role:'member',is_active:true,must_change_password:false}],
    office_projects:[{id:P1,number:'T-01',name:'Testhaus',status:'aktiv',projektleiter_id:UID},
      {id:P2,number:'T-02',name:'Nachbarhaus',status:'aktiv',projektleiter_id:UID},
      {id:P3,number:'T-03',name:'Studie',status:'aktiv',projektleiter_id:UID}],
    office_project_members:[{project_id:P1,user_id:UID},{project_id:P1,user_id:B},{project_id:P2,user_id:UID},{project_id:P3,user_id:UID}],
    office_controlling_pakete:[
      {id:K1,project_id:P1,bezeichnung:'LPH 3',leistung:'Entwurfsplanung',honorar_netto:100000,nebenkosten_prozent:5,kalkulationssatz:80,status:'beauftragt',
        vorlaeufig:true,notiz:null,created_by:UID,created_at:zeit('2026-11-01'),updated_at:zeit('2026-11-01')},
      {id:K2,project_id:P2,bezeichnung:'LPH 1–2',leistung:null,honorar_netto:50000,nebenkosten_prozent:5,kalkulationssatz:80,status:'abgeschlossen',
        vorlaeufig:false,notiz:null,created_by:UID,created_at:zeit('2026-09-01'),updated_at:zeit('2026-09-01')}],
    office_controlling_staende:[
      {id:S1,paket_id:K1,stichtag:'2026-11-01',leistungsstand:40,notiz:null,created_by:UID,created_at:zeit('2026-11-01'),updated_at:zeit('2026-11-01')},
      {id:S2,paket_id:K2,stichtag:'2026-10-01',leistungsstand:null,notiz:'Schlussstand',created_by:UID,created_at:zeit('2026-10-01'),updated_at:zeit('2026-10-01')}],
    office_controlling_stunden:[
      {id:crypto.randomUUID(),stand_id:S1,person_id:UID,person_name:null,stunden:300,created_by:UID,created_at:zeit('2026-11-01')},
      {id:crypto.randomUUID(),stand_id:S1,person_id:B,person_name:null,stunden:250,created_by:UID,created_at:zeit('2026-11-01')},
      {id:crypto.randomUUID(),stand_id:S2,person_id:null,person_name:null,stunden:400,created_by:UID,created_at:zeit('2026-10-01')}],
    office_controlling_zahlungen:[
      {id:crypto.randomUUID(),paket_id:K1,datum:'2026-10-15',bezeichnung:'1. Abschlag',netto:21000,mwst:3990,status:'bezahlt',vorlaeufig:false,notiz:null,
        created_by:UID,created_at:zeit('2026-10-15'),updated_at:zeit('2026-10-15')}],
    office_controlling_saetze:[
      {id:crypto.randomUUID(),person_id:B,gueltig_ab:'2026-01-01',kalkulationssatz:90,monatsgehalt:3000,wochenstunden:25,urlaubstage:null,arbeitstage_woche:null,notiz:null,created_by:UID,created_at:zeit('2026-01-01'),updated_at:zeit('2026-01-01')},
      {id:crypto.randomUUID(),person_id:UID,gueltig_ab:'2026-01-01',kalkulationssatz:null,monatsgehalt:4000,wochenstunden:null,urlaubstage:null,arbeitstage_woche:null,notiz:null,created_by:UID,created_at:zeit('2026-01-01'),updated_at:zeit('2026-01-01')}],
    office_controlling_einstellungen:[{id:true,arbeitgeberanteil_prozent:21,jahresstunden:1600,vollzeit_wochenstunden:40,gemeinkostenfaktor:2,
      annahmen_notiz:null,annahmen_bestaetigt:null,urlaubstage:null,krankheitstage:null,weitere_tage:null,projektanteil_prozent:null,updated_at:zeit('2026-11-01')}],
    office_controlling_zugang:[]
  });
  let db=null;try{db=JSON.parse(sessionStorage.getItem(KEY)||'null')}catch{}
  if(!db)db=start();
  db.office_members.find(m=>m.user_id===UID).role=ROLLE.startsWith('admin')?'admin':'member';
  // Wie beim Einspielen der Migration office_controlling_nur_liste: der Admin steht auf der Liste.
  if(ROLLE==='admin'&&!db.office_controlling_zugang.some(z=>z.user_id===UID))db.office_controlling_zugang.push({user_id:UID,created_by:UID,created_at:zeit('2026-11-25')});
  // Buchhaltung: in keinem Team, leitet kein Projekt, steht in office_controlling_zugang.
  if(ROLLE==='buchhaltung'){
    db.office_project_members=db.office_project_members.filter(m=>m.user_id!==UID);
    for(const p of db.office_projects)if(p.projektleiter_id===UID)p.projektleiter_id=B;
    if(!db.office_controlling_zugang.some(z=>z.user_id===UID))db.office_controlling_zugang.push({user_id:UID,created_by:B,created_at:zeit('2026-11-25')});
  }
  const sichern=()=>{try{sessionStorage.setItem(KEY,JSON.stringify(db))}catch{}};
  sichern();
  const kopie=x=>JSON.parse(JSON.stringify(x));
  const jetzt=()=>new Date().toISOString();
  window.__fake={get db(){return db},sichern,aufrufe:[],UID,B,C,P1,P2,P3,K1,K2,S1,S2,ROLLE};

  const istAdmin=ROLLE.startsWith('admin');
  const voll=db.office_controlling_zugang.some(z=>z.user_id===UID);
  const imTeam=pid=>voll||db.office_projects.some(p=>p.id===pid&&p.projektleiter_id===UID)||db.office_project_members.some(m=>m.project_id===pid&&m.user_id===UID);
  const paketLesbar=kid=>{const k=db.office_controlling_pakete.find(x=>x.id===kid);return !!k&&imTeam(k.project_id)};
  const standLesbar=sid=>{const s=db.office_controlling_staende.find(x=>x.id===sid);return !!s&&paketLesbar(s.paket_id)};
  const NUR_ADMIN=new Set(['office_controlling_stunden','office_controlling_saetze','office_controlling_einstellungen']);
  function sichtbar(table,r){
    if(table==='office_controlling_pakete')return imTeam(r.project_id);
    if(table==='office_controlling_staende'||table==='office_controlling_zahlungen')return paketLesbar(r.paket_id);
    if(NUR_ADMIN.has(table))return voll;
    if(table==='office_controlling_zugang')return istAdmin||r.user_id===UID;
    return true;
  }
  const rls={data:null,error:{code:'42501',message:'new row violates row-level security policy'}};
  const doppelt={data:null,error:{code:'23505',message:'duplicate key value violates unique constraint'}};
  const pkey=h=>h.person_id||(h.person_name?'name:'+String(h.person_name).trim().toLowerCase():'team');
  function eindeutig(table,zeilen){
    const sig={office_controlling_staende:r=>r.paket_id+'|'+r.stichtag,office_controlling_stunden:r=>r.stand_id+'|'+pkey(r),
      office_controlling_saetze:r=>r.person_id+'|'+r.gueltig_ab}[table];
    if(!sig)return true;
    const s=zeilen.map(sig);return new Set(s).size===s.length;
  }
  function entfernen(table,ids){
    db[table]=db[table].filter(r=>!ids.includes(r.id));
    if(table==='office_controlling_pakete'){
      const st=db.office_controlling_staende.filter(s=>ids.includes(s.paket_id)).map(s=>s.id);
      db.office_controlling_zahlungen=db.office_controlling_zahlungen.filter(z=>!ids.includes(z.paket_id));
      entfernen('office_controlling_staende',st);
    }
    if(table==='office_controlling_staende')db.office_controlling_stunden=db.office_controlling_stunden.filter(h=>!ids.includes(h.stand_id));
  }

  function builder(table){
    const filter=[];let op='select',daten=null,einzeln=false,zurueck=false,sort=null,grenze=null;
    const q={
      select(){if(op!=='select')zurueck=true;return q},
      eq(c,v){filter.push(r=>String(r[c])===String(v));return q},
      in(c,v){const s=new Set((v||[]).map(String));filter.push(r=>s.has(String(r[c])));return q},
      order(c,o){sort=[c,o?.ascending!==false];return q},
      limit(n){grenze=n;return q},
      insert(p){op='insert';daten=p;return q},
      update(p){op='update';daten=p;return q},
      delete(){op='delete';return q},
      single(){einzeln=true;return q},maybeSingle(){einzeln=true;return q},
      then(ok,bad){return Promise.resolve(lauf()).then(ok,bad)}
    };
    function lauf(){
      // Wie eine Datenbank für alle Seiten desselben Tabs (etwa zwei Rahmen): vor jeder Abfrage den letzten Stand lesen.
      try{const s=sessionStorage.getItem(KEY);if(s)db=JSON.parse(s)}catch{}
      window.__fake.aufrufe.push({table,op,daten:daten?kopie(daten):null});
      const zeilen=db[table]||(db[table]=[]);
      const controlling=table.startsWith('office_controlling_');
      if(op!=='select'&&table==='office_controlling_zugang'&&!(istAdmin&&voll))return rls;
      if(op!=='select'&&controlling&&!voll)return rls;
      if(op==='insert'){
        const neu=(Array.isArray(daten)?daten:[daten]).map(p=>{
          const r={id:crypto.randomUUID(),created_by:UID,created_at:jetzt(),...kopie(p)};
          if(table!=='office_controlling_stunden')r.updated_at=jetzt();
          if(table==='office_controlling_zahlungen'){r.status=r.status||'bezahlt';r.mwst=r.mwst??0;r.vorlaeufig=!!r.vorlaeufig}
          if(table==='office_controlling_pakete'){r.nebenkosten_prozent=r.nebenkosten_prozent??5;r.kalkulationssatz=r.kalkulationssatz??85;r.status=r.status||'beauftragt';r.vorlaeufig=!!r.vorlaeufig}
          return r;
        });
        if(neu.some(r=>r.created_by!==UID))return rls;
        if(!eindeutig(table,[...zeilen,...neu]))return doppelt;
        zeilen.push(...neu);sichern();
        return {data:zurueck?(einzeln?kopie(neu[0]):kopie(neu)):null,error:null};
      }
      let treffer=zeilen.filter(r=>sichtbar(table,r)&&filter.every(f=>f(r)));
      if(op==='update'){
        const probe=kopie(db[table]);
        for(const r of probe)if(treffer.some(t=>t.id===r.id||(table==='office_controlling_einstellungen'&&t.id===r.id)))Object.assign(r,kopie(daten));
        if(!eindeutig(table,probe))return doppelt;
        for(const r of treffer){Object.assign(r,kopie(daten));if('updated_at' in r)r.updated_at=jetzt()}
        sichern();
        return {data:zurueck?(einzeln?(treffer[0]?kopie(treffer[0]):null):kopie(treffer)):null,error:null};
      }
      if(op==='delete'){entfernen(table,treffer.map(r=>r.id));sichern();return {data:null,error:null}}
      if(sort)treffer=[...treffer].sort((a,b)=>{const x=a[sort[0]],y=b[sort[0]];
        if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;
        return (String(x)<String(y)?-1:String(x)>String(y)?1:0)*(sort[1]?1:-1)});
      if(grenze)treffer=treffer.slice(0,grenze);
      return {data:einzeln?(treffer[0]?kopie(treffer[0]):null):kopie(treffer),error:null};
    }
    return q;
  }

  // office_controlling_summen wie in der Datenbank.
  const r2=x=>Math.round(x*100)/100;
  function eintragAm(personId,tag,feld){
    return db.office_controlling_saetze.filter(s=>s.person_id===personId&&s[feld]!=null&&s.gueltig_ab<=tag).sort((a,b)=>b.gueltig_ab.localeCompare(a.gueltig_ab))[0]||null;
  }
  function satzAm(personId,tag,feld){const e=eintragAm(personId,tag,feld);return e?Number(e[feld]):null}
  function summen(pid){
    if(!imTeam(pid))return [];
    const e=db.office_controlling_einstellungen[0];
    const out=[];
    for(const k of db.office_controlling_pakete.filter(x=>x.project_id===pid)){
      const st=db.office_controlling_staende.filter(s=>s.paket_id===k.id).sort((a,b)=>a.stichtag.localeCompare(b.stichtag));
      const ids=new Set(st.map(s=>s.id)),hs=db.office_controlling_stunden.filter(h=>ids.has(h.stand_id));
      const personen=new Map();for(const h of hs)personen.set(pkey(h),h.person_id||null);
      const letzte=new Map();let wertK=0,wertG=0,vollstaendig=true;
      for(const s of st){
        let stunden=0,hier=true,zuG=0;
        for(const [key,personId] of personen){
          const zeile=hs.find(h=>h.stand_id===s.id&&pkey(h)===key);
          const kum=zeile?Number(zeile.stunden):(letzte.get(key)||0),delta=kum-(letzte.get(key)||0);
          letzte.set(key,kum);stunden+=kum;
          const satzK=(personId&&satzAm(personId,s.stichtag,'kalkulationssatz'))??Number(k.kalkulationssatz);
          const g=personId?eintragAm(personId,s.stichtag,'monatsgehalt'):null;
          wertK+=delta*satzK;
          const vollzeit=Number(e.vollzeit_wochenstunden??40),woche=Number(g?.wochenstunden??vollzeit);
          const jahr=Number(e.jahresstunden)*woche/vollzeit+(g?.urlaubstage!=null&&e.urlaubstage!=null
            ?(Number(e.urlaubstage)*woche/5-Number(g.urlaubstage)*woche/Number(g.arbeitstage_woche??5))*Number(e.projektanteil_prozent??100)/100:0);
          if(g==null){if(delta!==0)hier=false}else zuG+=delta*Number(g.monatsgehalt)*12*(1+Number(e.arbeitgeberanteil_prozent)/100)/jahr;
        }
        if(!hier)vollstaendig=false;
        wertG+=zuG;
        out.push({stand_id:s.id,paket_id:k.id,stichtag:s.stichtag,leistungsstand:s.leistungsstand,stunden,wert_kalkulation:r2(wertK),
          wert_gehalt:voll&&vollstaendig?r2(wertG):null});
      }
    }
    return out;
  }
  async function rpc(name,args){
    window.__fake.aufrufe.push({table:'rpc:'+name,op:'rpc',daten:kopie(args||{})});
    if(name!=='office_controlling_summen')return {data:null,error:{message:'unbekannte Funktion'}};
    return {data:summen(args?.p_project),error:null};
  }
  const client={
    auth:{getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session.user},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},
    from:t=>builder(t),rpc
  };
  window.supabase={createClient:()=>client};
})();
