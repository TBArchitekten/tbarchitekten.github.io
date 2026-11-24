// Synthetischer Supabase-Ersatz für die Produktbibliothek in Chromium (23.11.2026). Kein Netz, keine echten Daten:
// Projekte, Hersteller und Kostenberechnungen heißen neutral. Daten und Dateien überleben Seitenwechsel im selben Tab
// (sessionStorage). Nachgebildet wie in der Datenbank: Stempel bei «geprüft», ein Code je Projekt, Urheber als Standard.
(function(){
  const UID='11111111-1111-4111-8111-111111111111',ANDERE='99999999-9999-4999-8999-999999999999';
  const P1='22222222-2222-4222-8222-222222222222',P2='33333333-3333-4333-8333-333333333333',P3='44444444-4444-4444-8444-444444444444';
  const L1='a1111111-1111-4111-8111-111111111111',L2='a2222222-2222-4222-8222-222222222222',S1='a3333333-3333-4333-8333-333333333333',
    A1='a4444444-4444-4444-8444-444444444444',D1='d1111111-1111-4111-8111-111111111111';
  // Herstellerkatalog (24.11.2026): H1 ist die Firma von S1, H2 ohne Produkt, H3 archiviert.
  const H1='f1111111-1111-4111-8111-111111111111',H2='f2222222-2222-4222-8222-222222222222',H3='f3333333-3333-4333-8333-333333333333';
  const KEY='tba_produkte_fake_db_v2';
  const session={access_token:'fake',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,
    user:{id:UID,email:'test@fixture.invalid',aud:'authenticated',role:'authenticated'}};
  const zeit=t=>new Date(t).toISOString();
  const PDF_B64=btoa('%PDF-1.4\n% Testdokument\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
  const pfad=(p,n)=>UID+'/'+p+'/'+n+'.pdf';
  const preis=(produkt_id,betrag,stand,bez,mehr={})=>({id:crypto.randomUUID(),produkt_id,art:'ansatz_kobe',betrag,einheit:'m²',stand,
    quelle:'Kostenberechnung (Test)',projekt_bezeichnung:bez,kg:'353',created_by:ANDERE,created_at:zeit('2026-11-20'),...mehr});
  const start=()=>({
    office_members:[{user_id:UID,email:'test@fixture.invalid',display_name:'Test Team',role:'member',is_active:true,must_change_password:false},
      {user_id:ANDERE,email:'andere@fixture.invalid',display_name:'Andere Person',role:'member',is_active:true,must_change_password:false}],
    office_projects:[{id:P1,number:'T-01',name:'Testhaus',status:'aktiv',projektleiter_id:ANDERE},
      {id:P2,number:'T-02',name:'Nachbarhaus',status:'aktiv',projektleiter_id:ANDERE},
      {id:P3,number:'T-03',name:'Archiv',status:'archiviert',projektleiter_id:UID}],
    office_project_members:[{project_id:P1,user_id:UID}],
    office_produkte:[
      {id:L1,typ:'leistung',kategorie:'bodenbelag',name:'Parkett, vollflächig geklebt',hersteller:null,serie:null,familie:'Parkett, vollflächig geklebt',
        beschreibung:'Ansatz aus alten Kostenberechnungen.',merkmale:[],fehlend:[],farbe:null,quelle_url:null,bestand:false,status:'entwurf',
        archiviert:false,created_by:ANDERE,created_at:zeit('2026-11-20'),updated_at:zeit('2026-11-21')},
      {id:L2,typ:'leistung',kategorie:'bodenbelag',name:'Heizestrich, schwimmend',hersteller:null,serie:null,familie:'Estrich',
        beschreibung:null,merkmale:[],fehlend:[],farbe:null,quelle_url:null,bestand:false,status:'entwurf',
        archiviert:false,created_by:ANDERE,created_at:zeit('2026-11-20'),updated_at:zeit('2026-11-20')},
      {id:S1,typ:'produkt',kategorie:'bodenbelag',name:'Kalkstein, geschliffen',hersteller:'Hersteller B',serie:null,familie:'Naturstein',
        beschreibung:null,merkmale:[{feld:'Rutschhemmung',wert:'R10',seite:2,dokument_id:D1},{feld:'Stärke',wert:'20 mm',seite:1,dokument_id:D1}],
        fehlend:['Emissionen'],farbe:'#d8cfbd',quelle_url:null,bestand:false,status:'geprueft',geprueft_von:ANDERE,geprueft_am:zeit('2026-11-19'),hersteller_id:H1,
        archiviert:false,created_by:ANDERE,created_at:zeit('2026-11-19'),updated_at:zeit('2026-11-19')},
      {id:A1,typ:'produkt',kategorie:'bodenbelag',name:'Teppich, alt',hersteller:'Hersteller C',serie:null,familie:null,beschreibung:null,
        merkmale:[],fehlend:[],farbe:null,quelle_url:null,bestand:false,status:'entwurf',archiviert:true,created_by:ANDERE,
        created_at:zeit('2026-11-01'),updated_at:zeit('2026-11-01')}],
    office_produkt_dokumente:[{id:D1,produkt_id:S1,art:'datenblatt',name:'Datenblatt Kalkstein.pdf',storage_path:pfad(S1,'b1111111-1111-4111-8111-111111111111'),
      mime_type:'application/pdf',size_bytes:atob(PDF_B64).length,seiten:2,gelesen_am:zeit('2026-11-19'),created_by:UID,created_at:zeit('2026-11-19')}],
    office_produkt_preise:[
      preis(L1,180,'2022-09-19','K-01'),preis(L1,180,'2022-09-19','K-01',{kg:'324'}),preis(L1,180,'2026-10-05','K-02'),preis(L1,180,'2026-10-30','K-03'),
      preis(L2,38,'2022-09-19','K-01',{kg:'324'}),preis(L2,95,'2024-03-01','K-04',{kg:'324'}),
      {id:crypto.randomUUID(),produkt_id:S1,art:'listenpreis_material',betrag:120,einheit:'m²',stand:'2026-01-01',quelle:'Datenblatt Kalkstein.pdf',
        dokument_id:D1,seite:2,created_by:UID,created_at:zeit('2026-11-19')}],
    office_produkt_verwendungen:[{id:crypto.randomUUID(),produkt_id:S1,projekt_id:P1,code:'BO-01',status:'bemustert',raeume:'Flur',menge:null,einheit:null,
      notiz:null,created_by:ANDERE,created_at:zeit('2026-11-19'),updated_at:zeit('2026-11-19')}],
    office_hersteller:[
      {id:H1,firma:'Hersteller B',typ:'hersteller',produkte:'Kalkstein, Treppenstufen',kategorien:['bodenbelag'],adresse:'Musterweg 1, 00000 Musterstadt',
        telefon:'+49 000 1234-0',email:'info@hersteller-b.invalid',website:'https://hersteller-b.invalid',ansprechpartner:'Frau Muster (Vertrieb)',notiz:null,
        archiviert:false,created_by:ANDERE,created_at:zeit('2026-11-24'),updated_at:zeit('2026-11-24')},
      {id:H2,firma:'Werkstatt Terrazzo',typ:'ausfuehrender',produkte:'Ortterrazzo, Musterplatten',kategorien:['bodenbelag'],adresse:null,
        telefon:'Tel. n. v.',email:null,website:'https://terrazzo.invalid',ansprechpartner:null,notiz:'Kontaktdaten nachrecherchieren',
        archiviert:false,created_by:ANDERE,created_at:zeit('2026-11-24'),updated_at:zeit('2026-11-24')},
      {id:H3,firma:'Alte Firma',typ:'vertrieb',produkte:null,kategorien:['sanitaer'],adresse:null,telefon:null,email:null,website:null,ansprechpartner:null,
        notiz:null,archiviert:true,created_by:ANDERE,created_at:zeit('2026-11-01'),updated_at:zeit('2026-11-01')}],
    office_hersteller_kontakte:[
      {id:crypto.randomUUID(),hersteller_id:H1,projekt_id:P1,projekt_bezeichnung:null,person_id:ANDERE,art:'angebot',datum:'2026-11-08',
        notiz:'Richtpreis erhalten',created_by:ANDERE,created_at:zeit('2026-11-24')},
      {id:crypto.randomUUID(),hersteller_id:H2,projekt_id:null,projekt_bezeichnung:'Wettbewerb 2025',person_id:null,art:'recherche',datum:'2025-05-02',
        notiz:null,created_by:ANDERE,created_at:zeit('2026-11-24')}],
    __dateien:{[pfad(S1,'b1111111-1111-4111-8111-111111111111')]:{type:'application/pdf',b64:PDF_B64}}
  });
  let db=null;try{db=JSON.parse(sessionStorage.getItem(KEY)||'null')}catch{}
  if(!db)db=start();
  const sichern=()=>{try{sessionStorage.setItem(KEY,JSON.stringify(db))}catch{}};
  sichern();
  const kopie=x=>JSON.parse(JSON.stringify(x));
  const jetzt=()=>new Date().toISOString();
  window.__fake={get db(){return db},sichern,aufrufe:[],fehler:null,leser:null,anfragen:[],UID,P1,P2,P3,L1,L2,S1,A1,D1,H1,H2,H3};

  // Datenblatt-Leser: ein fester Vorschlag mit Seitenangaben, einer fehlenden Angabe und einem Listenpreis.
  const vorschlag=body=>({version:'office-produkt-ai-v1',authority:'none',model:'test-modell',quelle:body?.attachments?.[0]?.name||'',
    result:{erkannt:true,text:'Datenblatt einer Landhausdiele. Der Listenpreis gilt nur für das Material.',dokument_art:'datenblatt',seiten:4,
      produkt:{name:'Landhausdiele Eiche 15 mm',hersteller:'Hersteller A',serie:'Serie Test',kategorie:'bodenbelag',
        familie:'Parkett, vollflächig geklebt',beschreibung:'Zweischichtdiele, geölt.',farbe:'#c8a274'},
      merkmale:[{feld:'Format',wert:'1900 × 190 mm',seite:2},{feld:'Stärke',wert:'15 mm',seite:2},
        {feld:'Brandverhalten',wert:'Cfl-s1',seite:3},{feld:'Werbung',wert:'die schönste Diele',seite:1}],
      fehlend:['Rutschhemmung','Emissionen'],
      preise:[{art:'listenpreis_material',betrag:62.5,einheit:'m²',stand:'2026-01-01',seite:4,bezug:'Sortierung Natur, 1900 × 190 mm'}]}});
  async function invoke(name,{body}={}){
    window.__fake.anfragen.push({name,body:kopie(body||{})});
    if(window.__fake.leser)return window.__fake.leser(name,body);
    if(name!=='office-produkt-ai')return {data:null,error:{message:'unbekannte Funktion'}};
    return {data:vorschlag(body),error:null};
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
      window.__fake.aufrufe.push({table,op,daten:daten?kopie(daten):null});
      if(window.__fake.fehler&&window.__fake.fehler(table,op))return {data:null,error:{message:'Testfehler'}};
      const zeilen=db[table]||(db[table]=[]);
      if(op==='insert'){
        const neu=(Array.isArray(daten)?daten:[daten]).map(p=>{
          const r={id:crypto.randomUUID(),created_by:UID,created_at:jetzt(),...kopie(p)};
          if(table==='office_produkte'){r.updated_at=jetzt();r.archiviert=r.archiviert||false;r.merkmale=r.merkmale||[];r.fehlend=r.fehlend||[];
            r.typ=r.typ||'produkt';r.status=r.status||'entwurf';r.bestand=!!r.bestand;
            if(r.status==='geprueft'){r.geprueft_von=UID;r.geprueft_am=jetzt()}}
          if(table==='office_produkt_verwendungen'){r.updated_at=jetzt();r.status=r.status||'vorgeschlagen'}
          if(table==='office_hersteller'){r.updated_at=jetzt();r.archiviert=r.archiviert||false;r.kategorien=r.kategorien||[]}
          return r;
        });
        if(table==='office_hersteller')for(const r of neu)
          if(zeilen.some(x=>!x.archiviert&&String(x.firma).trim().toLowerCase()===String(r.firma).trim().toLowerCase()))
            return {data:null,error:{code:'23505',message:'duplicate key value violates unique constraint'}};
        if(table==='office_produkt_verwendungen')for(const r of neu)
          if(r.code&&zeilen.some(x=>x.projekt_id===r.projekt_id&&x.code===r.code))
            return {data:null,error:{code:'23505',message:'duplicate key value violates unique constraint'}};
        zeilen.push(...neu);sichern();
        return {data:einzeln?kopie(neu[0]):kopie(neu),error:null};
      }
      let treffer=zeilen.filter(r=>filter.every(f=>f(r)));
      if(op==='update'){
        for(const r of treffer){
          const vorher=r.status;Object.assign(r,kopie(daten));
          if('updated_at' in r)r.updated_at=jetzt();
          if(table==='office_produkte'&&r.status!==vorher){if(r.status==='geprueft'){r.geprueft_von=UID;r.geprueft_am=jetzt()}else{r.geprueft_von=null;r.geprueft_am=null}}
        }
        sichern();
        return {data:zurueck?(einzeln?(treffer[0]?kopie(treffer[0]):null):kopie(treffer)):null,error:null};
      }
      if(op==='delete'){db[table]=zeilen.filter(r=>!treffer.includes(r));sichern();return {data:null,error:null}}
      if(sort)treffer=[...treffer].sort((a,b)=>{const x=a[sort[0]],y=b[sort[0]];
        if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;
        return (String(x)<String(y)?-1:String(x)>String(y)?1:0)*(sort[1]?1:-1)});
      if(grenze)treffer=treffer.slice(0,grenze);
      return {data:einzeln?(treffer[0]?kopie(treffer[0]):null):kopie(treffer),error:null};
    }
    return q;
  }

  // Speicher: Dateien als Base64 in sessionStorage, signierte Adressen zeigen auf den Testserver.
  const b64=async datei=>{const b=new Uint8Array(await datei.arrayBuffer());let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s)};
  const signiert=p=>location.origin+'/tests/browser/fixtures/signiert/'+encodeURIComponent(p.split('/').pop());
  function speicher(bucket){
    return {
      async upload(p,datei,opt){
        window.__fake.aufrufe.push({table:'storage:'+bucket,op:'upload',daten:{pfad:p,type:opt?.contentType}});
        if(!p.startsWith(UID+'/'))return {data:null,error:{message:'new row violates row-level security policy'}};
        if(db.__dateien[p])return {data:null,error:{message:'The resource already exists'}};
        db.__dateien[p]={type:opt?.contentType||datei.type,b64:await b64(datei)};sichern();return {data:{path:p},error:null};
      },
      async createSignedUrl(p){return db.__dateien[p]?{data:{signedUrl:signiert(p)},error:null}:{data:null,error:{message:'Object not found'}}},
      async createSignedUrls(liste){return {data:liste.map(p=>({path:p,signedUrl:db.__dateien[p]?signiert(p):null,error:db.__dateien[p]?null:'not found'})),error:null}},
      async download(p){const d=db.__dateien[p];if(!d)return {data:null,error:{message:'Object not found'}};
        const s=atob(d.b64),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);
        return {data:new Blob([b],{type:d.type}),error:null}},
      async remove(liste){for(const p of liste)delete db.__dateien[p];sichern();return {data:[],error:null}}
    };
  }
  const client={
    auth:{getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session.user},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},
    from:t=>builder(t),rpc:async()=>({data:true,error:null}),functions:{invoke},storage:{from:speicher}
  };
  window.supabase={createClient:()=>client};
})();
