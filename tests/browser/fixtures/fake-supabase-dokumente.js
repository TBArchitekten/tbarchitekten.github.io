// Synthetischer Supabase-Ersatz für die Projektdokumente in Chromium (24.11.2026). Kein Netz, keine echten Daten.
// Die Daten überleben Seitenwechsel im selben Tab (sessionStorage). Wie die Datenbank: Nummern vergibt der «Server»,
// jede Zeile hat eine Serverrevision (+1 je Update, bedingtes Update per Filter), der Verlauf entsteht je Feld,
// «entschieden» braucht Datum, Entscheider und Entscheidung.
(function(){
  const UID='11111111-1111-4111-8111-111111111111',PID='22222222-2222-4222-8222-222222222222',P2='33333333-3333-4333-8333-333333333333';
  const KEY='tba_dokumente_fake_db_v1';
  const session={access_token:'fake',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,
    user:{id:UID,email:'test@fixture.invalid',aud:'authenticated',role:'authenticated'}};
  const jetzt=()=>new Date().toISOString();
  const start=()=>({
    office_members:[{user_id:UID,email:'test@fixture.invalid',display_name:'Test Leitung',role:'projektleiter',is_active:true,must_change_password:false},
      {user_id:'44444444-4444-4444-8444-444444444444',email:'b@fixture.invalid',display_name:'Test Team',role:'member',is_active:true,must_change_password:false}],
    office_projects:[{id:PID,number:'T-01',name:'Testhaus',status:'aktiv',projektleiter_id:UID},
      {id:P2,number:'T-02',name:'Fremdes Projekt',status:'aktiv',projektleiter_id:'44444444-4444-4444-8444-444444444444'}],
    office_project_members:[],
    office_projektdokumente:[],office_projektdokument_zeilen:[],office_projektdokument_aenderungen:[],office_projektdokument_staende:[],
    isabella_tasks:[]
  });
  let db=null;try{db=JSON.parse(sessionStorage.getItem(KEY)||'null')}catch{}
  if(!db)db=start();
  const sichern=()=>{try{sessionStorage.setItem(KEY,JSON.stringify(db))}catch{}};
  sichern();
  const kopie=x=>JSON.parse(JSON.stringify(x));
  let lid=db.office_projektdokument_aenderungen.length;
  function protokoll(z,alt,vorgang){
    if(vorgang==='angelegt'){db.office_projektdokument_aenderungen.push({id:++lid,dokument_id:z.dokument_id,zeile_id:z.id,nr:z.nr,vorgang,feld:null,alt:null,neu:kopie(z.daten),quelle:z.quelle,user_id:UID,created_at:jetzt()});return}
    const keys=new Set([...Object.keys(z.daten||{}),...Object.keys(alt||{})]);
    for(const k of keys){
      if(k.startsWith('_'))continue;
      if(JSON.stringify(z.daten[k]??'')===JSON.stringify(alt?.[k]??''))continue;
      db.office_projektdokument_aenderungen.push({id:++lid,dokument_id:z.dokument_id,zeile_id:z.id,nr:z.nr,vorgang:'geaendert',feld:k,alt:alt?.[k]??null,neu:z.daten[k]??null,quelle:z.quelle,user_id:UID,created_at:jetzt()});
    }
  }
  function regeln(z){
    const dok=db.office_projektdokumente.find(d=>d.id===z.dokument_id);
    if(dok?.art==='entscheidungsliste'&&z.daten?.status==='entschieden'&&!(z.daten.entschieden_am&&z.daten.entscheider&&z.daten.entscheidung))
      return 'Eine Entscheidung braucht Datum, Entscheider und Entscheidung';
    return '';
  }
  window.__fake={get db(){return db},sichern,aufrufe:[],fehler:null,PID,UID,
    // Eine gleichzeitige Änderung von jemand anderem: Feld setzen und Revision erhöhen.
    fremd(zeileId,feld,wert){const z=db.office_projektdokument_zeilen.find(x=>x.id===zeileId);z.daten={...z.daten,[feld]:wert};z.server_revision++;z.updated_at=jetzt();sichern()}};
  function builder(table){
    const filter=[];let op='select',daten=null,einzeln=false,zurueck=false,sort=null,grenze=null;
    const q={
      select(){if(op!=='select')zurueck=true;return q},
      eq(c,v){filter.push(r=>String(r[c])===String(v));return q},
      in(c,v){const s=new Set(v.map(String));filter.push(r=>s.has(String(r[c])));return q},
      gt(c,v){filter.push(r=>String(r[c])>String(v));return q},
      order(c,o){sort=[c,o?.ascending!==false];return q},
      limit(n){grenze=n;return q},
      insert(p){op='insert';daten=p;return q},
      update(p){op='update';daten=p;return q},
      delete(){op='delete';return q},
      single(){einzeln=true;return q},maybeSingle(){einzeln=true;return q},
      then(ok,bad){return Promise.resolve(lauf()).then(ok,bad)}
    };
    function lauf(){
      window.__fake.aufrufe.push({table,op,daten:daten?kopie(daten):null,filter:filter.length});
      if(window.__fake.fehler&&window.__fake.fehler(table,op))return {data:null,error:{message:'Testfehler'}};
      const zeilen=db[table]||(db[table]=[]);
      if(op==='insert'){
        const neu=[];
        for(const p of (Array.isArray(daten)?daten:[daten])){
          const r={id:crypto.randomUUID(),created_at:jetzt(),updated_at:jetzt(),...kopie(p)};
          if(table==='office_projektdokumente'){
            if(zeilen.some(d=>d.project_id===r.project_id&&d.art===r.art))return {data:null,error:{message:'duplicate key value violates unique constraint',code:'23505'}};
            r.server_revision=1;r.meta=r.meta||{};
          }
          if(table==='office_projektdokument_zeilen'){
            r.nr=zeilen.filter(z=>z.dokument_id===r.dokument_id).reduce((m,z)=>Math.max(m,z.nr),0)+1;
            r.server_revision=1;r.quelle=r.vorschlag_id?'romy':'hand';r.created_by=UID;r.updated_by=null;
            const f=regeln(r);if(f)return {data:null,error:{message:f}};
          }
          neu.push(r);
        }
        zeilen.push(...neu);
        if(table==='office_projektdokument_zeilen')for(const r of neu)protokoll(r,null,'angelegt');
        sichern();
        return {data:einzeln?kopie(neu[0]):kopie(neu),error:null};
      }
      let treffer=zeilen.filter(r=>filter.every(f=>f(r)));
      if(op==='update'){
        for(const r of treffer){
          const alt=kopie(r.daten||{});
          const vorher=kopie(r);
          Object.assign(r,kopie(daten));
          if(table==='office_projektdokument_zeilen'){
            r.quelle=daten.vorschlag_id&&daten.vorschlag_id!==vorher.vorschlag_id?'romy':'hand';
            const f=regeln(r);if(f){Object.assign(r,vorher);return {data:null,error:{message:f}}}
            r.updated_by=UID;
          }
          if('server_revision' in r)r.server_revision=Number(r.server_revision)+1;
          r.updated_at=jetzt();
          if(table==='office_projektdokument_zeilen')protokoll(r,alt,'geaendert');
        }
        sichern();return {data:zurueck?kopie(treffer):null,error:null};
      }
      if(op==='delete'){db[table]=zeilen.filter(r=>!treffer.includes(r));sichern();return {data:null,error:null}}
      if(sort)treffer=[...treffer].sort((a,b)=>{const x=a[sort[0]],y=b[sort[0]];return (typeof x==='number'&&typeof y==='number'?x-y:String(x)<String(y)?-1:String(x)>String(y)?1:0)*(sort[1]?1:-1)});
      if(grenze)treffer=treffer.slice(0,grenze);
      return {data:einzeln?(treffer[0]?kopie(treffer[0]):null):kopie(treffer),error:null};
    }
    return q;
  }
  const client={
    auth:{getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session.user},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},
    from:t=>builder(t),rpc:async()=>({data:null,error:null}),functions:{invoke:async()=>({data:null,error:{message:'keine Funktion im Test'}})}
  };
  window.supabase={createClient:()=>client};
})();
