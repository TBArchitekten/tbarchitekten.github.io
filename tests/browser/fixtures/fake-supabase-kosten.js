// Synthetischer Supabase-Ersatz für die Kostenberechnung in Chromium (21.11.2026). Kein Netz, keine echten Daten,
// keine DIN-Titel: die Gruppen heißen neutral. Die Daten überleben Seitenwechsel im selben Tab (sessionStorage).
// Updates verhalten sich wie PostgREST mit dem Revisions-Trigger: Filter auf server_revision, danach +1.
(function(){
  const UID='11111111-1111-4111-8111-111111111111',PID='22222222-2222-4222-8222-222222222222',TID='33333333-3333-4333-8333-333333333333';
  const KEY='tba_kosten_fake_db_v1';
  const session={access_token:'fake',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,
    user:{id:UID,email:'test@fixture.invalid',aud:'authenticated',role:'authenticated'}};
  // Aufbau wie DIN 276:2018-12 (1. bis 3. Ebene, «Sonstiges zur KG» optional), Titel neutral.
  const struktur={'100':[['110',0],['120',8],['130',2]],'200':[['210',6],['220',8],['230',0],['240',2],['250',2]],
    '300':[['310',4],['320',6],['330',8],['340',7],['350',5],['360',6],['370',8],['380',7],['390',8]],
    '400':[['410',3],['420',4],['430',4],['440',7],['450',8],['460',6],['470',8],['480',5],['490',8]],
    '500':[['510',4],['520',5],['530',8],['540',8],['550',8],['560',3],['570',4],['580',3],['590',8]],
    '600':[['610',0],['620',0],['630',0],['640',3],['690',0]],
    '700':[['710',5],['720',5],['730',4],['740',8],['750',2],['760',6],['790',1]],
    '800':[['810',0],['820',0],['830',0],['840',0],['890',0]]};
  const katalog=[];
  for(const [e1,zweite] of Object.entries(struktur)){
    katalog.push({kg:e1,titel:'Gruppe '+e1});
    for(const [e2,n] of zweite){
      katalog.push({kg:e2,titel:'Gruppe '+e2});
      if(!n)continue;
      for(let i=1;i<=n;i++)katalog.push({kg:e2.slice(0,2)+i,titel:'Gruppe '+e2.slice(0,2)+i});
      katalog.push({kg:e2.slice(0,2)+'9',titel:'Sonstiges zur KG '+e2,optional:true});
    }
  }
  const muster={schema:'tba.office.kostenberechnung.v1',norm:'DIN 276:2018-12',ebene:3,kostenstand:'',ustProzent:'19',
    bezug:{BGF:'',BRI:'',NUF:'',AF:''},bezugHerkunft:'',kostenvorgabe:'',kostenschaetzung:{},ursachen:{},
    regionalfaktor:{wert:'',fundstelle:''},zuschlag:{wert:'',notiz:'An eigenen Angeboten kalibrieren'},
    indexReihe:'Baupreisindex (Testreihe)',indizes:[],katalog,
    gruppen:{'100':{status:'entfaellt',notiz:'trägt der Bauherr'},'800':{status:'entfaellt',notiz:'trägt der Bauherr'},
      '370':{status:'entfaellt',notiz:'im Hochbau in der Regel nicht (im Muster vorbelegt)'}},
    vorlagen:{'200':{modus:'betrag'},'390':{modus:'betrag'},'392':{modus:'menge',einheit:'m²',hinweis:'Gerüstfläche'},
      '400':{modus:'betrag',art:'fachplanung',hinweis:'Kostenbeitrag der Fachplanung'},'600':{modus:'betrag'},'700':{modus:'betrag'}},
    positionen:[],rezepte:{},importe:[],annahmen:''};
  const jetzt=()=>new Date().toISOString();
  const start=()=>({
    office_members:[{user_id:UID,email:'test@fixture.invalid',display_name:'Test Leitung',role:'projektleiter',is_active:true,must_change_password:false}],
    office_projects:[{id:PID,number:'T-01',name:'Testhaus',status:'aktiv',projektleiter_id:UID},
      {id:'44444444-4444-4444-8444-444444444444',number:'T-02',name:'Archiv',status:'archiviert',projektleiter_id:UID}],
    office_project_members:[],
    office_kosten_templates:[{id:TID,title:'Kostenberechnung LPH 3',description:'Synthetisches Muster für den Browsertest.',norm:'DIN 276:2018-12',
      version:'1.0',status:'Entwurf',is_active:true,state:muster,updated_at:jetzt()}],
    office_kosten_instances:[],office_kosten_versions:[],office_kosten_dialogue_messages:[]
  });
  let db=null;try{db=JSON.parse(sessionStorage.getItem(KEY)||'null')}catch{}
  if(!db)db=start();
  const sichern=()=>{try{sessionStorage.setItem(KEY,JSON.stringify(db))}catch{}};
  sichern();
  const kopie=x=>JSON.parse(JSON.stringify(x));
  window.__fake={get db(){return db},sichern,aufrufe:[],fehler:null,PID,TID,UID,ki:null,anfragen:[]};
  // KI-Assistent: Status «bereit» und ein fester Vorschlag (Element mit zwei Positionen in KG 335, eine ohne Preis,
  // dazu «entfällt» für KG 394). Ein Test kann window.__fake.ki ersetzen.
  const vorschlagStandard=body=>({version:'office-kosten-ai-v1',authority:'none',model:'test-modell',base_revision:body.expected_revision,can_edit:true,quellen:[],
    result:{kind:'vorschlag',text:'Aus dem Angebot: ein Element mit zwei Positionen; der Oberputz hat noch keinen Preis.',fragen:[],
      hinweise:['Position «Oberputz»: Preis ohne Quelle und Fundstelle nicht übernommen.'],
      vorschlag:{elemente:[{ref:'E1',kg:'335',titel:'WDVS Mineralwolle 160 mm + Putz',notiz:''}],
        positionen:[
          {kg:'335',element:'E1',gewerk:'PU',titel:'Dämmung Mineralwolle 160 mm',ort:'',modus:'menge',menge:'412.5',einheit:'m²',mengenquelle:'manuell',
            ep:'128',betrag:'',quelle:'angebot',fundstelle:'Angebot Test, Pos. 1',kostenstand:'',brutto:false,notiz:''},
          {kg:'335',element:'E1',gewerk:'PU',titel:'Oberputz',ort:'',modus:'menge',menge:'412.5',einheit:'m²',mengenquelle:'manuell',
            ep:'',betrag:'',quelle:'',fundstelle:'',kostenstand:'',brutto:false,notiz:''}],
        aenderungen:[],entfallen:[{kg:'394',begruendung:'kein Bedarf laut Test'}]}}});
  async function invoke(name,{body}={}){
    window.__fake.anfragen.push({name,body:kopie(body||{})});
    if(window.__fake.ki)return window.__fake.ki(name,body);
    if(name!=='office-kosten-ai')return {data:null,error:{message:'unbekannte Funktion'}};
    if(body?.action==='status')return {data:{ready:true,version:'office-kosten-ai-v1',model:'test-modell',can_edit:true},error:null};
    return {data:vorschlagStandard(body),error:null};
  }
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
    from:t=>builder(t),rpc:async()=>({data:null,error:null}),functions:{invoke}
  };
  window.supabase={createClient:()=>client};
})();
