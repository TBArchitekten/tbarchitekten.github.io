// Synthetischer Supabase-Ersatz für die Kostenberechnung in Chromium (21.11.2026). Kein Netz, keine echten Daten,
// keine DIN-Titel: die Gruppen heißen neutral. Die Daten überleben Seitenwechsel im selben Tab (sessionStorage).
// Updates verhalten sich wie PostgREST mit dem Revisions-Trigger: Filter auf server_revision, danach +1.
(function(){
  const UID='11111111-1111-4111-8111-111111111111',PID='22222222-2222-4222-8222-222222222222',TID='33333333-3333-4333-8333-333333333333';
  const KEY='tba_kosten_fake_db_v1';
  const session={access_token:'fake',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,
    user:{id:UID,email:'test@fixture.invalid',aud:'authenticated',role:'authenticated'}};
  const katalog=[];
  for(const e of ['100','200','300','400','500','600','700','800']){
    katalog.push({kg:e,titel:'Gruppe '+e});
    for(let z=1;z<=(e==='300'||e==='400'?9:3);z++){const k=e[0]+z+'0';katalog.push({kg:k,titel:'Gruppe '+k});
      if(e==='300')for(let d=1;d<=9;d++)katalog.push({kg:e[0]+z+d,titel:'Gruppe '+e[0]+z+d});}
  }
  katalog.sort((a,b)=>a.kg.localeCompare(b.kg));
  const betrag=(kg,art)=>({id:'m:'+kg,kg,titel:'Gruppe '+kg,modus:'betrag',betrag:null,kennwert:art?{art}:{}});
  const muster={schema:'tba.office.kostenberechnung.v1',norm:'DIN 276:2018-12',ebene:3,kostenstand:'',ustProzent:'19',
    bezug:{BGF:'',BRI:'',NUF:'',AF:''},bezugHerkunft:'',kostenvorgabe:'',kostenschaetzung:{},ursachen:{},
    regionalfaktor:{wert:'',fundstelle:''},zuschlag:{wert:'',notiz:'An eigenen Angeboten kalibrieren'},
    indexReihe:'Baupreisindex (Testreihe)',indizes:[],katalog,
    gruppen:{'100':{status:'entfaellt',notiz:'trägt der Bauherr'},'800':{status:'entfaellt',notiz:'trägt der Bauherr'}},
    positionen:[betrag('210'),betrag('220'),betrag('230'),betrag('391'),
      {id:'m:392',kg:'392',titel:'Gruppe 392',modus:'menge',menge:null,einheit:'m²',mengenquelle:{art:'manuell',text:''},kennwert:{}},
      ...['410','420','430','440','450','460','480'].map(k=>betrag(k,'fachplanung')),betrag('500'),betrag('600'),betrag('730'),betrag('740'),betrag('760')],
    rezepte:{},importe:[],annahmen:''};
  const jetzt=()=>new Date().toISOString();
  const start=()=>({
    office_members:[{user_id:UID,email:'test@fixture.invalid',display_name:'Test Leitung',role:'projektleiter',is_active:true,must_change_password:false}],
    office_projects:[{id:PID,number:'T-01',name:'Testhaus',status:'aktiv',projektleiter_id:UID},
      {id:'44444444-4444-4444-8444-444444444444',number:'T-02',name:'Archiv',status:'archiviert',projektleiter_id:UID}],
    office_project_members:[],
    office_kosten_templates:[{id:TID,title:'Kostenberechnung LPH 3',description:'Synthetisches Muster für den Browsertest.',norm:'DIN 276:2018-12',
      version:'1.0',status:'Entwurf',is_active:true,state:muster,updated_at:jetzt()}],
    office_kosten_instances:[],office_kosten_versions:[]
  });
  let db=null;try{db=JSON.parse(sessionStorage.getItem(KEY)||'null')}catch{}
  if(!db)db=start();
  const sichern=()=>{try{sessionStorage.setItem(KEY,JSON.stringify(db))}catch{}};
  sichern();
  const kopie=x=>JSON.parse(JSON.stringify(x));
  window.__fake={get db(){return db},sichern,aufrufe:[],fehler:null,PID,TID,UID};
  function builder(table){
    const filter=[];let op='select',daten=null,einzeln=false,zurueck=false,sort=null,grenze=null;
    const q={
      select(){if(op!=='select')zurueck=true;return q},
      eq(c,v){filter.push(r=>String(r[c])===String(v));return q},
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
        const neu=(Array.isArray(daten)?daten:[daten]).map(p=>({id:crypto.randomUUID(),created_at:jetzt(),updated_at:jetzt(),
          ...(table==='office_kosten_instances'?{server_revision:1,is_archived:false}:{}),...kopie(p)}));
        zeilen.push(...neu);sichern();
        return {data:einzeln?kopie(neu[0]):kopie(neu),error:null};
      }
      let treffer=zeilen.filter(r=>filter.every(f=>f(r)));
      if(op==='update'){
        for(const r of treffer){Object.assign(r,kopie(daten));if('server_revision' in r)r.server_revision=Number(r.server_revision)+1;r.updated_at=jetzt()}
        sichern();return {data:zurueck?kopie(treffer):null,error:null};
      }
      if(op==='delete'){db[table]=zeilen.filter(r=>!treffer.includes(r));sichern();return {data:null,error:null}}
      if(sort)treffer=[...treffer].sort((a,b)=>(String(a[sort[0]])<String(b[sort[0]])?-1:String(a[sort[0]])>String(b[sort[0]])?1:0)*(sort[1]?1:-1));
      if(grenze)treffer=treffer.slice(0,grenze);
      return {data:einzeln?(treffer[0]?kopie(treffer[0]):null):kopie(treffer),error:null};
    }
    return q;
  }
  const client={
    auth:{getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session.user},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},
    from:t=>builder(t),rpc:async()=>({data:null,error:null})
  };
  window.supabase={createClient:()=>client};
})();
