// Synthetischer Supabase-Ersatz für die Projektdokumente in Chromium (24.11.2026). Kein Netz, keine echten Daten.
// Die Daten überleben Seitenwechsel im selben Tab (sessionStorage). Wie die Datenbank: Nummern vergibt der «Server»,
// jede Zeile hat eine Serverrevision (+1 je Update, bedingtes Update per Filter), der Verlauf entsteht je Feld,
// «entschieden» braucht Datum, Entscheider und Entscheidung.
(function(){
  const UID='11111111-1111-4111-8111-111111111111',PID='22222222-2222-4222-8222-222222222222',P2='33333333-3333-4333-8333-333333333333';
  const KEY='tba_dokumente_fake_db_v1';
  const PR1='66666666-6666-4666-8666-666666666661',PR2='66666666-6666-4666-8666-666666666662',KB='tba.office.kostenberechnung.v1';
  const INDIZES=[{quartal:'2022-Q3',wert:'118.9'},{quartal:'2025-Q4',wert:'138.2'},{quartal:'2026-Q3',wert:'141.7'}];
  const pos=(id,titel,menge,wert,kostenstand,zeile=0)=>({id,kg:'352',titel,menge,einheit:'m²',mengenquelle:{art:'archicad'},
    kennwert:{art:'eigen',wert,fundstelle:'Ansatz Test',kostenstand},...(zeile?{archivZeile:zeile}:{})});
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
    office_projektdokument_vorschlaege:[],isabella_tasks:[],
    // Ein Terminplan des Testprojekts für «Fristen mit dem Terminplan prüfen».
    office_terminplan_instances:[{id:'55555555-5555-4555-8555-555555555555',project_id:PID,phase:'LPH3',is_archived:false,
      state:{tasks:[{id:'t1',name:'Vorabzug TWP',type:'milestone',start:'2026-12-04'}]}}],
    // Zahlen der Varianten: Produktbibliothek, Kostenberechnung des Testprojekts und zwei alte (Datenpool), erfunden.
    // Mustermappe: Merkmale mit Seite, Fehlendes und Stand der Bibliothek; ein Foto für das Parkett.
    office_produkte:[{id:PR1,typ:'produkt',kategorie:'bodenbelag',name:'Parkett Eiche geölt',hersteller:'Holz AG',serie:'',familie:'Parkett',beschreibung:'Massivparkett Eiche, geölt.',status:'geprueft',archiviert:false,
        merkmale:[{feld:'Aufbau',wert:'massiv 16 mm',seite:4},{feld:'Brandverhalten',wert:'Cfl-s1',seite:5}],fehlend:['R-Gruppe'],updated_at:'2026-11-20T10:00:00.000Z'},
      {id:PR2,typ:'produkt',kategorie:'bodenbelag',name:'Naturstein Jura',hersteller:'Stein GmbH',serie:'',familie:'',beschreibung:'',status:'entwurf',archiviert:false,merkmale:[],fehlend:[],updated_at:'2026-11-18T10:00:00.000Z'}],
    office_produkt_preise:[{id:'66666666-6666-4666-8666-666666666671',produkt_id:PR1,art:'angebot_eingebaut',betrag:185,einheit:'m²',stand:'2025-11-10',quelle:'Angebot Schreinerei Test',projekt_bezeichnung:'T-90 Altbau',kg:'352',kommentar:''},
      {id:'66666666-6666-4666-8666-666666666672',produkt_id:PR1,art:'listenpreis_material',betrag:64.9,einheit:'m²',stand:'2026-05-02',quelle:'Preisliste 2026',projekt_bezeichnung:'',kg:'',kommentar:''}],
    office_produkt_dokumente:[{id:'66666666-6666-4666-8666-666666666681',produkt_id:PR1,art:'datenblatt'},
      {id:'66666666-6666-4666-8666-666666666682',produkt_id:PR1,art:'bild',name:'Eiche Oberfläche',storage_path:UID+'/'+PR1+'/eiche.jpg',created_at:'2026-11-20T10:00:00.000Z'}],
    storage:{},
    office_produkt_verwendungen:[],
    office_kosten_templates:[{id:'66666666-6666-4666-8666-666666666691',is_active:true,state:{indizes:INDIZES,indexReihe:'Baupreisindex Test',ustProzent:'19'}}],
    office_kosten_instances:[
      {id:'66666666-6666-4666-8666-6666666666a1',project_id:PID,project_number:'T-01',project_name:'Testhaus',is_archived:false,updated_at:'2026-11-20T10:00:00.000Z',
        state:{schema:KB,kostenstand:'2026-Q4',indizes:INDIZES,ustProzent:'19',positionen:[pos('a','Parkett Wohnräume','210','180','2026-Q4'),pos('b','Fliesen Bäder','38.5','95','2026-Q4')]}},
      {id:'66666666-6666-4666-8666-6666666666a2',project_id:'66666666-6666-4666-8666-6666666666b1',project_number:'T-90',project_name:'Altbau',is_archived:true,updated_at:'2026-01-01T00:00:00.000Z',
        state:{schema:KB,kostenstand:'2022-Q3',indizes:INDIZES,archiv:{reifegrad:'berechnung'},positionen:[pos('x1','Parkett Eiche geölt','120','180','2022-Q3',12),pos('x2','Naturstein Platten','80','200','2022-Q3',13)]}},
      {id:'66666666-6666-4666-8666-6666666666a3',project_id:'66666666-6666-4666-8666-6666666666b2',project_number:'T-91',project_name:'Musterhof',is_archived:true,updated_at:'2026-01-02T00:00:00.000Z',
        state:{schema:KB,kostenstand:'2022-Q3',indizes:INDIZES,archiv:{reifegrad:'berechnung'},positionen:[pos('y1','Parkett Eiche','95','180','2022-Q3',40)]}}]
  });
  let db=null;try{db=JSON.parse(sessionStorage.getItem(KEY)||'null')}catch{}
  if(!db)db=start();
  const sichern=()=>{try{sessionStorage.setItem(KEY,JSON.stringify(db))}catch{}};
  sichern();
  const kopie=x=>JSON.parse(JSON.stringify(x));
  let lid=db.office_projektdokument_aenderungen.length;
  function protokoll(z,alt,vorgang){
    const vid=z.quelle==='romy'?z.vorschlag_id:null;
    if(vorgang==='angelegt'){db.office_projektdokument_aenderungen.push({id:++lid,dokument_id:z.dokument_id,zeile_id:z.id,nr:z.nr,vorgang,feld:null,alt:null,neu:kopie(z.daten),quelle:z.quelle,vorschlag_id:vid,user_id:UID,created_at:jetzt()});return}
    const keys=new Set([...Object.keys(z.daten||{}),...Object.keys(alt||{})]);
    for(const k of keys){
      if(k.startsWith('_'))continue;
      if(JSON.stringify(z.daten[k]??'')===JSON.stringify(alt?.[k]??''))continue;
      db.office_projektdokument_aenderungen.push({id:++lid,dokument_id:z.dokument_id,zeile_id:z.id,nr:z.nr,vorgang:'geaendert',feld:k,alt:alt?.[k]??null,neu:z.daten[k]??null,quelle:z.quelle,vorschlag_id:vid,user_id:UID,created_at:jetzt()});
    }
  }
  function regeln(z,alt){
    const dok=db.office_projektdokumente.find(d=>d.id===z.dokument_id);
    if(dok?.art==='entscheidungsliste'&&z.daten?.status==='entschieden'&&!(z.daten.entschieden_am&&z.daten.entscheider&&z.daten.entscheidung))
      return 'Eine Entscheidung braucht Datum, Entscheider und Entscheidung';
    if(dok?.art==='entscheidungsliste'&&z.quelle==='romy'&&['entschieden_am','entscheidung','entscheider','bestaetigt_am'].some(k=>JSON.stringify(z.daten?.[k]??null)!==JSON.stringify(alt?.[k]??null)))
      return 'Romy trägt keine Entscheidung ein';
    return '';
  }
  const VERBOTEN=['entschieden_am','entscheidung','entscheider','bestaetigt_am'];
  window.__fake={get db(){return db},sichern,aufrufe:[],anfragen:[],fehler:null,ki:null,PID,UID,
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
          if(table==='office_projektdokument_staende')r.created_by=r.created_by||UID;
          if(table==='office_projektdokument_vorschlaege'){
            if(VERBOTEN.some(k=>k in (r.daten||{}))||r.daten?.status==='entschieden')return {data:null,error:{message:'violates check constraint office_projektdokument_vorschlag_ohne_entscheidung'}};
            r.status='offen';r.created_by=UID;r.entschieden_von=null;r.entschieden_am=null;
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
            if(r.quelle==='hand')r.vorschlag_id=null;
            const f=regeln(r,alt);if(f){Object.assign(r,vorher);return {data:null,error:{message:f}}}
            r.updated_by=UID;
          }
          if(table==='office_projektdokument_vorschlaege'){
            if(vorher.status!=='offen'){Object.assign(r,vorher);return {data:null,error:{message:'Über diesen Vorschlag ist schon entschieden'}}}
            r.entschieden_von=UID;r.entschieden_am=jetzt();
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
  // Romy (office-dokumente-ai) antwortet fest; ein Test kann window.__fake.ki ersetzen.
  const ok=(body,result)=>({data:{version:'office-dokumente-ai-v1',authority:'none',model:'test-modell',aufgabe:body.aufgabe||body.action,quelle:body.quelle||'',result},error:null});
  async function invoke(name,{body}={}){
    window.__fake.anfragen.push({name,body:kopie(body||{})});
    if(name!=='office-dokumente-ai')return {data:null,error:{message:'keine Funktion im Test'}};
    if(window.__fake.ki)return window.__fake.ki(body);
    if(body.action==='status')return {data:{ready:true,version:'office-dokumente-ai-v1',model:'test-modell'},error:null};
    const dok=db.office_projektdokumente.find(d=>d.id===body.dokument_id);
    const zeilen=db.office_projektdokument_zeilen.filter(z=>z.dokument_id===body.dokument_id);
    const q=body.quelle||'Protokoll';
    if(body.action==='vorschlaege'&&dok?.art==='klaerungsliste'){
      const eins=zeilen.find(z=>z.nr===1);
      return ok(body,{text:'Im Protokoll stehen zwei neue Klärungen und eine neue Frist.',hinweise:['TOP 9 betrifft die Bemusterung, keine Klärung.'],vorschlaege:[
        {art:'neu',zeile_id:null,nr:null,daten:{disziplinen:['HLS','TWP'],ort:'Decke über EG, Achse B/2',sachverhalt:'Aussparung für den Steigschacht fehlt im Positionsplan',verantwortlich:'TWP',frist:'2026-12-06',protokoll:'Koordination 02'},
          fundstelle:q+', S. 2, TOP 4',begruendung:'Im Protokoll als offener Punkt geführt.'},
        {art:'neu',zeile_id:null,nr:null,daten:{disziplinen:['HLS','BPH'],ort:'Außenanlage Nord',sachverhalt:'Außengerät der Wärmepumpe: Abstand zur Grenze wegen Schall prüfen',verantwortlich:'HLS',frist:'2026-12-10',ag:'ja',protokoll:'Koordination 02'},
          fundstelle:q+', S. 3, TOP 7',begruendung:''},
        ...(eins?[{art:'aenderung',zeile_id:eins.id,nr:1,daten:{frist:'2026-12-08'},fundstelle:q+', S. 2, TOP 3',begruendung:'TWP liefert die Lösung erst mit dem Vorabzug.'}]:[])]});
    }
    if(body.action==='vorschlaege')return ok(body,{text:'Eine Frage an den Auftraggeber.',hinweise:[],vorschlaege:[
      // Romy darf keine Entscheidung vorschlagen: der Client entfernt Status und Entscheider.
      {art:'neu',zeile_id:null,nr:null,daten:{thema:'Fenster, Material',frage:'Holz oder Holz-Aluminium für die Fenster?',optionen:[{id:'A',text:'Holz'},{id:'B',text:'Holz-Aluminium'}],status:'entschieden',entscheider:'AG'},
        fundstelle:q+', S. 1',begruendung:'Im Protokoll als offene Frage.'}]});
    if(body.action==='auswahl'&&body.aufgabe==='fristen_terminplan'){
      const z=zeilen.find(x=>x.id===body.zeilen_ids[0]);
      return ok(body,{text:'Eine Frist passt nicht zum Terminplan.',hinweise:[],vorschlaege:[{art:'aenderung',zeile_id:z.id,nr:z.nr,daten:{frist:'2026-12-02'},
        fundstelle:'Terminplan: Vorabzug TWP (04.12.2026)',begruendung:'Die Lösung muss vor dem Vorabzug stehen.'}]});
    }
    if(body.action==='auswahl')return ok(body,{text:body.aufgabe==='bestaetigung'?'Betreff: Bestätigung Ihrer Entscheidung\n\nSehr geehrte Damen und Herren,\nwir bestätigen …'
      :body.aufgabe==='frage'?'Antwort von Romy zur Frage: '+body.frage:'An TWP:\n– Nr 1: Bitte Lösung für den Unterzug bis 05.12.',hinweise:[]});
    // «Zahlen holen»: Romy wählt nur Verweise aus den Kandidaten; für A ein erfundener Verweis, der wegfallen muss.
    if(body.action==='zahlen'){
      const k=body.kandidaten||{},ref=(l,re)=>(l||[]).find(x=>re.test(x.bezeichnung||x.name||''))?.ref||'';
      return ok(body,{text:'Für B passen ein Wert aus dem Datenpool und die Fläche der Kostenberechnung.',hinweise:['Für B gibt es kein Produkt in der Produktbibliothek.'],
        optionen:[{id:'B',produkt:'',kennwert:ref(k.pool,/Naturstein/),menge:ref(k.kobe,/Parkett Wohnräume/),begruendung:'Gleiche Fläche wie A; Wert aus zwei alten Kostenberechnungen.'},
          {id:'A',produkt:'p999',kennwert:'erfunden',menge:'',begruendung:'nichts'}]});
    }
    if(body.action==='text'){
      const z=zeilen.find(x=>x.id===body.zeile_id),alt=String(z?.daten?.[body.feld]||'');
      return ok(body,{neu:(alt?alt+' ':'')+'Der Unterschied beträgt 5.004,30 € netto.',begruendung:'Betrag aus der Kostenberechnung eingesetzt.',hinweise:[],zeile_id:body.zeile_id,feld:body.feld});
    }
    return {data:null,error:{message:'unbekannte Aktion'}};
  }
  // Storage: hochgeladene Bilder als data-URL im sessionStorage; Fotos der Bibliothek als kleines SVG.
  const FOTO='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#b9a27e"/></svg>');
  const alsUrl=b=>new Promise((ok,bad)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=bad;r.readAsDataURL(b)});
  function speicher(bucket){
    const ablage=()=>db.storage||(db.storage={});
    const url=p=>ablage()[bucket+'/'+p]?.url||(bucket==='office-produkte'?FOTO:null);
    return {
      async upload(pfad,datei,opt){
        window.__fake.aufrufe.push({table:'storage:'+bucket,op:'upload',daten:{pfad,typ:opt?.contentType||datei.type,groesse:datei.size}});
        if(ablage()[bucket+'/'+pfad])return {data:null,error:{message:'The resource already exists'}};
        ablage()[bucket+'/'+pfad]={typ:opt?.contentType||datei.type,groesse:datei.size,url:await alsUrl(datei)};sichern();
        return {data:{path:pfad},error:null};
      },
      async createSignedUrls(pfade){return {data:pfade.map(p=>({path:p,signedUrl:url(p),error:url(p)?null:'not found'})),error:null}},
      async createSignedUrl(p){return url(p)?{data:{signedUrl:url(p)},error:null}:{data:null,error:{message:'not found'}}},
      async remove(pfade){for(const p of pfade)delete ablage()[bucket+'/'+p];sichern();return {data:[],error:null}}
    };
  }
  const client={
    auth:{getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session.user},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},
    from:t=>builder(t),rpc:async(name,args)=>{(window.__fake.rpc=window.__fake.rpc||[]).push({name,args:kopie(args||{})});return {data:null,error:null}},functions:{invoke},storage:{from:speicher}
  };
  window.supabase={createClient:()=>client};
})();
