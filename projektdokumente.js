/* TBA Office · Projektstart · Dokumente des Projekts (24.11.2026, Claude, Auftrag Gari; Entwurf vom 24.11. freigegeben).
   Die Bürovorlagen LPH 3 werden Dokumente des Projekts: Klärungsliste und Entscheidungsliste wie im Büro-Excel (jede
   Spalte mit Typ, kompakt oder alle Spalten, Filter, Bearbeiten in der Zelle, Details mit Verlauf), dazu die
   Entscheidungsvorlage als Text mit festen Abschnitten. Ausgabe als Excel, Word und PDF (Drucken).
   Daten: office_projektdokumente und office_projektdokument_zeilen (jede Zeile mit eigener Serverrevision; bei
   gleichzeitiger Bearbeitung werden die Felder zusammengeführt, K.zusammenfuehren). Den Verlauf schreibt die Datenbank.
   Eine Klärung mit Verantwortlichem und Frist wird eine Aufgabe im Planner; ein Entscheidungspunkt des Auftraggebers
   wird eine Entscheidung; eine Entscheidung kommt in eine Vorlage. «entschieden» setzt nur das Projektteam, mit Datum,
   Entscheider und Entscheidung. Das Muster bleibt projektstart.html mit den Bürovorlagen zum Herunterladen.
   Romy (office-dokumente-ai, ab #146): Vorschläge aus Protokollen, Mails und Plänen, jeder mit Fundstelle, blau markiert in
   der Liste; erst «Übernehmen» ändert eine Zeile (Verlauf: «Vorschlag von Romy, übernommen von …»). Dazu Fragen an die
   Fachplaner, Fristen gegen den Terminplan, Bestätigung einer Entscheidung als Mail und Abschnitte der Vorlage neu
   formuliert (grün eingefügt, rot gestrichen). Eine Entscheidung trägt Romy nie ein.
   Zahlen der Varianten (zweiter Schritt, 24.11.2026): je Variante «Zahlen aus dem Office» – Produkt aus der
   Produktbibliothek (mit Musterliste des Projekts), Kennwert aus einem Preis, dem Datenpool oder der Kostenberechnung,
   Menge aus der Kostenberechnung, jede Zahl mit Fundstelle (projektdokumente-zahlen.js). Romy «Zahlen holen» wählt nur
   unter diesen Kandidaten und schlägt vor; nach der Entscheidung gibt «In der Produktbibliothek freigeben» das gewählte
   Produkt im Projekt frei. */
(()=>{
'use strict';
const K=window.TBA_PROJEKTDOKUMENTE,X=window.TBA_PROJEKTDOKUMENTE_EXPORT,OFFICE=window.TBA_OFFICE_CONFIG;
const Z=window.TBA_PROJEKTDOKUMENTE_ZAHLEN,R=window.TBA_KOSTEN_RECHNEN,P=window.TBA_KOSTEN_POOL;
const sb=window.MINDS_SUPABASE||(window.supabase&&OFFICE?window.supabase.createClient(OFFICE.url,OFFICE.key,
  {auth:{storageKey:OFFICE.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null);
const inApp=!!window.WINDOW_NATIVE?.available;
const root=document.getElementById('pd'),dialog=document.getElementById('pdDialog');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kopie=x=>JSON.parse(JSON.stringify(x??{}));
const gleich=(a,b)=>JSON.stringify(a??'')===JSON.stringify(b??'');
const ZEILE='id,dokument_id,nr,daten,server_revision,created_by,updated_by,created_at,updated_at,quelle';
const DOK='id,art,owner_id,meta,server_revision,updated_at';
const LETZTES='tba.office.projektdokumente.projekt';
const LISTEN=['klaerungsliste','entscheidungsliste'];
// Kompakte Ansicht wie im Entwurf: 8 Spalten je Liste (die Entscheidungsliste mit der Spalte «Vorlage»).
const KOMPAKT={klaerungsliste:['nr','disziplinen','ort','sachverhalt','verantwortlich','frist','status','ag'],
  entscheidungsliste:['nr','thema','frage','optionen','bis','status','entscheidung','_vorlage']};
const VORLAGE_SPALTE={key:'_vorlage',kopf:'Vorlage',typ:'vorlage'};
const NEU_FELD={klaerungsliste:'sachverhalt',entscheidungsliste:'thema'};

let nutzer=null,mitglied=null,mitglieder=[],projekte=[],team=[];
let projekt=null,dokumente={},zeilen=leer(),aufgaben=new Map(),geladenUm=0;
const ui={ansicht:'',art:'',vorlage:null,filter:'alle',disziplin:'',suche:'',alleSpalten:false,auswahl:new Set(),detail:null,
  verlauf:null,edit:null,meldung:'',meldungArt:'info',staende:null,spaeter:new Set(),romyText:null};
const speicher={laeuft:0,fehler:''};
const VORSCHLAG='id,dokument_id,zeile_id,art,daten,fundstelle,begruendung,quelle,created_by,created_at';
const romy={bereit:false};
let vorschlaege=[];
const offene=art=>vorschlaege.filter(v=>artVon(v.dokument_id)===art);
function leer(){return {klaerungsliste:[],entscheidungsliste:[],entscheidungsvorlagen:[]}}
const heute=()=>K.heuteIso();
const name=id=>mitglieder.find(m=>m.user_id===id)?.display_name||'';
const meinName=()=>mitglied?.display_name||name(nutzer?.id)||'';
const istAdmin=()=>mitglied?.role==='admin';
function darf(p){return !!p&&(istAdmin()||p.projektleiter_id===nutzer.id||team.some(t=>t.project_id===p.id&&t.user_id===nutzer.id))}
const artVon=dokId=>Object.keys(dokumente).find(a=>dokumente[a].id===dokId)||'';
const zeileVon=id=>{for(const a of K.ARTEN){const z=zeilen[a].find(x=>x.id===id);if(z)return z}return null};

// ---------- Start ----------
function fehler(text){root.innerHTML='<div class="pd-wrap"><a class="pd-back" href="./app/#section=tools">‹ Werkzeuge</a><div class="pd-banner warn">'+esc(text)+'</div></div>'}
async function start(){
  if(!sb||!K||!X){fehler('Office-Verbindung nicht verfügbar.');return}
  const {data,error}=await sb.auth.getSession();
  const session=data?.session;
  if(error||!session){if(inApp){void window.WINDOW_NATIVE.call('session.signIn');fehler('Bitte in der App anmelden.');return}location.href='./';return}
  nutzer=session.user;
  const {data:m,error:me}=await sb.from('office_members').select('user_id,role,display_name,is_active,must_change_password')
    .eq('user_id',nutzer.id).eq('is_active',true).maybeSingle();
  if(me||!m){fehler('Kein Zugriff auf TBA Office.');return}
  if(m.must_change_password){if(inApp){fehler('Bitte zuerst im Browser auf tbarchitekten.github.io das Startpasswort ändern.');return}location.href='./';return}
  mitglied=m;
  try{
    const [mm,pr,pm]=await Promise.all([
      sb.from('office_members').select('user_id,display_name,role,is_active'),
      sb.from('office_projects').select('id,number,name,status,projektleiter_id').order('number').limit(300),
      sb.from('office_project_members').select('project_id,user_id')]);
    if(pr.error)throw pr.error;
    mitglieder=mm.data||[m];projekte=pr.data||[];team=pm.data||[];
    window.addEventListener('popstate',()=>void route());
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&projekt&&Date.now()-geladenUm>30000)void auffrischen()});
    await route();
    void romyStatus();
  }catch(e){console.error('Projektdokumente',e);fehler(e?.message||'Projektdokumente nicht erreichbar.')}
}
const params=()=>new URLSearchParams(location.search);
function gehe(p,{ersetzen=false}={}){
  const u=new URLSearchParams();for(const [k,v] of Object.entries(p))if(v)u.set(k,v);
  history[ersetzen?'replaceState':'pushState'](null,'','?'+u.toString());
  void route();
}
async function route(){
  const p=params(),pid=p.get('projekt');
  ui.edit=null;ui.auswahl=new Set();
  if(!pid){
    let letztes='';try{letztes=localStorage.getItem(LETZTES)||''}catch{}
    const ziel=projekte.find(x=>x.id===letztes&&x.status==='aktiv'&&darf(x));
    if(ziel){gehe({projekt:ziel.id},{ersetzen:true});return}
    zeigeProjektwahl();return;
  }
  if(!projekt||projekt.id!==pid){
    projekt=projekte.find(x=>x.id===pid)||null;ui.detail=null;
    if(!projekt){fehler('Projekt nicht gefunden.');return}
    if(!darf(projekt)){zeigeProjektwahl('Die Dokumente eines Projekts sieht das Projektteam und die Projektleitung. Für «'+projekt.number+' '+projekt.name+'» bist du nicht eingetragen.');return}
    root.innerHTML='<div class="pd-wrap"><p class="meta">Dokumente werden geladen …</p></div>';
    await ladeProjekt();
  }
  const liste=p.get('liste'),vorlage=p.get('vorlage');
  if(vorlage){
    const v=zeilen.entscheidungsvorlagen.find(x=>x.id===vorlage);
    ui.ansicht=istMappe(v)?'mappe':'vorlage';ui.vorlage=vorlage;ui.staende=null;
    if(ui.ansicht==='mappe'&&mm.offen!==vorlage){mm.offen=vorlage;mm.seite=null;mm.geladen=''}
    render();void ladeStaende(vorlage);
  }
  else if(LISTEN.includes(liste)){
    if(ui.art!==liste){ui.filter='alle';ui.disziplin='';ui.suche='';ui.detail=null}
    ui.ansicht='liste';ui.art=liste;render();
  }else{ui.ansicht='uebersicht';ui.detail=null;render()}
}
async function ladeProjekt(){
  dokumente={};zeilen=leer();aufgaben=new Map();
  const {data:docs,error}=await sb.from('office_projektdokumente').select(DOK).eq('project_id',projekt.id);
  if(error)throw error;
  for(const d of docs||[])dokumente[d.art]=d;
  await ladeZeilen();
  try{localStorage.setItem(LETZTES,projekt.id)}catch{}
}
function lokal(r){return {...r,daten:kopie(r.daten),basis:kopie(r.daten),rev:r.server_revision}}
async function ladeZeilen(){
  const ids=Object.values(dokumente).map(d=>d.id);
  geladenUm=Date.now();
  if(!ids.length){vorschlaege=[];return}
  const [{data,error},vs]=await Promise.all([
    sb.from('office_projektdokument_zeilen').select(ZEILE).in('dokument_id',ids).order('nr'),
    sb.from('office_projektdokument_vorschlaege').select(VORSCHLAG).in('dokument_id',ids).eq('status','offen').order('created_at')]);
  if(error)throw error;
  vorschlaege=vs.error?[]:(vs.data||[]);
  const neu=leer();
  for(const r of data||[]){
    const art=artVon(r.dokument_id);if(!art)continue;
    const alt=zeilen[art].find(z=>z.id===r.id);
    // Was hier noch nicht gespeichert ist, bleibt; das Speichern führt es mit dem Server zusammen.
    if(alt&&(alt.timer||alt.inFlight||!gleich(alt.daten,alt.basis)))neu[art].push(alt);
    else neu[art].push(lokal(r));
  }
  for(const a of K.ARTEN)for(const z of zeilen[a])if((z.timer||z.inFlight)&&!neu[a].includes(z))neu[a].push(z);
  for(const a of K.ARTEN)neu[a].sort((x,y)=>x.nr-y.nr);
  zeilen=neu;
  await ladeAufgaben();
}
async function ladeAufgaben(){
  const ids=[...new Set(zeilen.klaerungsliste.map(z=>z.daten.aufgabe_id).filter(Boolean))];
  aufgaben=new Map();
  if(!ids.length)return;
  const {data}=await sb.from('isabella_tasks').select('id,title,due_date,completed_at,work_status').in('id',ids);
  for(const t of data||[])aufgaben.set(t.id,t);
}
async function auffrischen(){
  try{
    const {data:docs}=await sb.from('office_projektdokumente').select(DOK).eq('project_id',projekt.id);
    for(const d of docs||[])dokumente[d.art]=d;
    await ladeZeilen();
    if(!ui.edit)render();
  }catch(e){console.warn('Auffrischen',e)}
}

// ---------- Speichern ----------
function meldung(text,art='info'){ui.meldung=text;ui.meldungArt=art;zeigeMeldung()}
function zeigeMeldung(){
  const el=root.querySelector('[data-meldung]');if(!el)return;
  el.className='pd-meldung'+(ui.meldung?' '+ui.meldungArt:'');el.textContent=ui.meldung||'';
}
const ungespeichert=()=>K.ARTEN.some(a=>zeilen[a].some(z=>z.timer||z.inFlight));
function speicherText(){
  if(speicher.fehler)return 'Nicht gespeichert: '+speicher.fehler;
  if(speicher.laeuft||ungespeichert())return 'speichert …';
  return 'gespeichert';
}
function zeigeSpeicherstand(){
  const el=root.querySelector('[data-speicher]');if(!el)return;
  el.textContent=speicherText();el.classList.toggle('warn',!!speicher.fehler);
}
function markiere(z){clearTimeout(z.timer);z.timer=setTimeout(()=>{z.timer=null;void speichere(z)},350);zeigeSpeicherstand()}
async function sofort(z,opt){if(z.timer){clearTimeout(z.timer);z.timer=null}return speichere(z,opt)}
async function speichere(z,{vorschlagId=null}={}){
  if(z.inFlight){z.nochmal=true;return z.inFlight}
  const art=artVon(z.dokument_id);
  const lauf=(async()=>{
    speicher.laeuft++;zeigeSpeicherstand();
    try{
      for(let versuch=0;versuch<4;versuch++){
        if(gleich(z.daten,z.basis)&&!vorschlagId)break;
        const patch={daten:z.daten};if(vorschlagId)patch.vorschlag_id=vorschlagId;
        const {data,error}=await sb.from('office_projektdokument_zeilen').update(patch).eq('id',z.id).eq('server_revision',z.rev).select(ZEILE);
        if(error)throw error;
        if(data&&data.length){
          const r=data[0];z.basis=kopie(r.daten);z.rev=r.server_revision;z.updated_at=r.updated_at;z.updated_by=r.updated_by;z.quelle=r.quelle;
          speicher.fehler='';break;
        }
        // Jemand anderes hat die Zeile inzwischen gespeichert: Felder zusammenführen und neu versuchen.
        const {data:srv,error:e2}=await sb.from('office_projektdokument_zeilen').select(ZEILE).eq('id',z.id).maybeSingle();
        if(e2)throw e2;
        if(!srv){zeilen[art]=zeilen[art].filter(x=>x!==z);meldung(K.DOKUMENTE[art].zeile+' '+K.nummer(art,z.nr)+' wurde inzwischen gelöscht.','warn');render();break}
        const m=K.zusammenfuehren(z.basis,z.daten,srv.daten||{});
        z.daten=m.daten;z.basis=kopie(srv.daten);z.rev=srv.server_revision;
        if(m.kollisionen.length)meldung(K.nummer(art,z.nr)+': '+m.kollisionen.map(k=>'«'+K.feldName(art,k)+'»').join(', ')+' wurde gleichzeitig von '+(name(srv.updated_by)||'jemand anderem')+' geändert; deine Eingabe gilt.','warn');
      }
    }catch(e){console.error('Speichern',e);speicher.fehler=e?.message||'Verbindung';meldung('Nicht gespeichert: '+speicher.fehler,'warn')}
    finally{
      speicher.laeuft--;z.inFlight=null;zeigeSpeicherstand();
      if(z.nochmal){z.nochmal=false;void speichere(z)}
    }
  })();
  z.inFlight=lauf;return lauf;
}
async function alleSpeichern(){
  for(let runde=0;runde<5;runde++){
    const offen=K.ARTEN.flatMap(a=>zeilen[a]).filter(z=>z.timer||z.inFlight||z.nochmal);
    if(!offen.length)return;
    for(const z of offen){if(z.timer){clearTimeout(z.timer);z.timer=null;await speichere(z)}else if(z.inFlight)await z.inFlight}
  }
}
async function sichereDokument(art){
  if(dokumente[art])return dokumente[art];
  const meta=art==='klaerungsliste'?{runde:'01'}:{};
  const {data,error}=await sb.from('office_projektdokumente').insert({project_id:projekt.id,art,owner_id:nutzer.id,meta}).select(DOK).single();
  if(!error&&data){dokumente[art]=data;return data}
  const {data:da}=await sb.from('office_projektdokumente').select(DOK).eq('project_id',projekt.id).eq('art',art).maybeSingle();
  if(da){dokumente[art]=da;return da}
  throw new Error(projekt.status!=='aktiv'?'Im archivierten Projekt entstehen keine neuen Dokumente.':'Das Dokument konnte nicht angelegt werden.');
}
async function neueZeile(art,daten,{vorschlagId=null}={}){
  const dok=await sichereDokument(art);
  const payload={dokument_id:dok.id,daten};if(vorschlagId)payload.vorschlag_id=vorschlagId;
  const {data,error}=await sb.from('office_projektdokument_zeilen').insert(payload).select(ZEILE).single();
  if(error)throw error;
  const z=lokal(data);zeilen[art].push(z);zeilen[art].sort((a,b)=>a.nr-b.nr);
  return z;
}
async function setzeMeta(art,patch){
  const d=dokumente[art];if(!d)return;
  for(let i=0;i<2;i++){
    const {data,error}=await sb.from('office_projektdokumente').update({meta:{...(d.meta||{}),...patch}}).eq('id',d.id).eq('server_revision',d.server_revision).select(DOK);
    if(error)throw error;
    if(data&&data.length){dokumente[art]=data[0];return}
    const {data:neu}=await sb.from('office_projektdokumente').select(DOK).eq('id',d.id).maybeSingle();
    if(neu)Object.assign(d,neu);
  }
}
// Ein Feld setzen, mit den Folgen, die in der Bürovorlage von Hand nachgetragen werden.
function setze(art,z,key,wert){
  if(gleich(z.daten[key],wert))return true;
  const d={...z.daten,[key]:wert};
  if(Array.isArray(d._romy))d._romy=d._romy.filter(k=>k!==key);
  if(art==='klaerungsliste'&&key==='status'){
    if(['gelöst','entfällt'].includes(wert)&&!d.erledigt_am)d.erledigt_am=heute();
    if(wert==='Entscheidungspunkt')d.ag='ja';
  }
  if(art==='entscheidungsliste'&&key==='status'&&wert==='vorgelegt'&&!d.vorgelegt_am)d.vorgelegt_am=heute();
  const p=K.pruefe(art,d);
  if(p){meldung(p,'warn');return false}
  z.daten=d;markiere(z);return true;
}

// ---------- Ansicht: Rahmen ----------
function kopf({zurueck,kicker,titel,meta='',aktionen='',intro=''}){
  return '<a class="pd-back" href="'+esc(zurueck[0])+'" data-nav>'+esc(zurueck[1])+'</a>'+
    '<header class="pd-head"><div class="pd-head-text"><p class="kicker">'+esc(kicker)+'</p><h1>'+esc(titel)+'</h1>'+
    (intro?'<p class="pd-intro">'+intro+'</p>':'')+(meta?'<p class="meta">'+meta+'</p>':'')+'</div>'+
    (aktionen?'<div class="pd-actions">'+aktionen+'</div>':'')+'</header>'+
    '<p class="pd-meldung'+(ui.meldung?' '+ui.meldungArt:'')+'" data-meldung role="status" aria-live="polite">'+esc(ui.meldung)+'</p>';
}
const projektName=()=>projekt?projekt.number+' · '+projekt.name:'';
const url=p=>'?'+new URLSearchParams(Object.entries(p).filter(([,v])=>v)).toString();
function render(){
  if(ui.ansicht==='liste')renderListe();
  else if(ui.ansicht==='vorlage')renderVorlage();
  else if(ui.ansicht==='mappe')renderMappe();
  else renderUebersicht();
}
// Neu zeichnen, ohne Eingaben zu verlieren. Chrome meldet beim Ersetzen des DOM noch change und focusout der alten
// Felder; die gelten nicht (zeichnet). Was im Feld mit dem Fokus steht, wandert als Text ins neue Feld (feste ids);
// übernommen wird es erst beim Verlassen des Felds.
let zeichnet=false;
function vorZeichnen(){
  const a=document.activeElement;
  if(!a||!root.contains(a))return null;
  const edit=a.matches('[data-edit]')?{z:a.dataset.z,k:a.dataset.k}:null;
  if(!edit&&!a.id)return null;
  return {id:a.id,edit,wert:'value' in a&&a.tagName!=='SELECT'?a.value:null,pos:typeof a.selectionStart==='number'?[a.selectionStart,a.selectionEnd]:null};
}
function zeichne(html,fokus){
  zeichnet=true;
  try{root.innerHTML=html}finally{zeichnet=false}
  const editor=root.querySelector('[data-edit]');
  let n=null,gleicheStelle=false;
  if(editor){n=editor;gleicheStelle=!!fokus?.edit&&fokus.edit.z===editor.dataset.z&&fokus.edit.k===editor.dataset.k}
  else if(fokus?.id){n=document.getElementById(fokus.id);gleicheStelle=!!n}
  if(!n)return;
  if(gleicheStelle&&fokus.wert!==null&&n.value!==fokus.wert)n.value=fokus.wert;
  n.focus({preventScroll:!!fokus});
  if(gleicheStelle&&fokus.pos&&n.setSelectionRange){try{n.setSelectionRange(fokus.pos[0],fokus.pos[1])}catch{}}
  else if(editor&&n.select&&n.tagName==='INPUT')n.select();
}
let renderTimer=0;
function spaeterRendern(){clearTimeout(renderTimer);renderTimer=setTimeout(render,0)}
function zeigeProjektwahl(hinweis=''){
  const meine=projekte.filter(p=>p.status==='aktiv'&&darf(p));
  const fokus=vorZeichnen();
  const html='<div class="pd-wrap">'+kopf({zurueck:['./app/#section=tools','‹ Werkzeuge'],kicker:'Werkzeuge · Projektstart',titel:'Projektstart',
    intro:'Die Bürovorlagen werden Dokumente des Projekts: hier bearbeiten und als Word, Excel oder PDF ausgeben, wenn Fachplaner oder Bauherr sie brauchen. Das Muster bleibt, wie es ist; jedes Projekt bekommt seine eigene Fassung.',
    aktionen:'<a class="btn" href="./projektstart.html">Muster ansehen</a>'})+
    (hinweis?'<div class="pd-banner warn">'+esc(hinweis)+'</div>':'')+
    '<section class="card pd-wahl"><h2>Projekt wählen</h2>'+(meine.length?'<div class="pd-wahl-liste">'+meine.map(p=>
      '<a class="pd-wahl-projekt" href="'+esc(url({projekt:p.id}))+'" data-nav><span class="pd-nr">'+esc(p.number)+'</span> '+esc(p.name)+'</a>').join('')+'</div>'
      :'<p class="meta">Du bist in keinem aktiven Projekt eingetragen. Die Projektleitung trägt das Team unter Werkzeuge › Projekte ein.</p>')+'</section></div>';
  zeichne(html,fokus);
}

// ---------- Übersicht ----------
function renderUebersicht(){
  const zk=K.zaehle('klaerungsliste',zeilen.klaerungsliste),ze=K.zaehle('entscheidungsliste',zeilen.entscheidungsliste);
  const warten=K.wartendeEntscheidungspunkte(zeilen.klaerungsliste,zeilen.entscheidungsliste);
  const vorlagen=zeilen.entscheidungsvorlagen.filter(v=>!istMappe(v));
  const projektwahl='<label class="pd-projekt"><span>Projekt</span><select data-act="projekt">'+projekte.filter(p=>p.status==='aktiv'&&darf(p)).map(p=>
    '<option value="'+esc(p.id)+'"'+(p.id===projekt.id?' selected':'')+'>'+esc(p.number+' · '+p.name)+'</option>').join('')+'</select></label>';
  const karte=(art,code,zahlen,extra)=>{
    const da=!!dokumente[art];
    const vs=offene(art),quellen=[...new Set(vs.map(v=>v.quelle).filter(Boolean))];
    return '<article class="card pd-karte"><div class="pd-karte-kopf"><h3>'+esc(K.DOKUMENTE[art].kurz)+(art==='klaerungsliste'?' · Koordination':'')+'</h3><span class="pd-code">'+esc(code)+'</span></div>'+
      '<p class="pd-karte-zahl">'+(da?esc(K.zusammenfassung(art,zahlen)):'Noch nicht angelegt.')+'</p>'+
      (vs.length?'<p class="pd-romy-hinweis">Romy: '+vs.length+(vs.length===1?' Vorschlag':' Vorschläge')+(quellen.length?' aus '+quellen.map(q=>'«'+esc(q)+'»').join(', '):'')+'</p>':'')+(extra||'')+
      '<div class="pd-karte-aktionen"><a class="btn btn-primary" href="'+esc(url({projekt:projekt.id,liste:art}))+'" data-nav>'+(da?'Öffnen':'Anlegen')+'</a>'+
      (da?'<button type="button" class="btn" data-act="excel" data-art="'+art+'">Excel</button>':'')+'</div></article>';
  };
  const folgt=(titel,code,text)=>'<article class="card pd-karte pd-folgt"><div class="pd-karte-kopf"><h3>'+esc(titel)+'</h3><span class="pd-code">'+esc(code)+'</span></div>'+
    '<p class="meta">'+esc(text)+'</p><p class="pd-folgt-text">folgt nach dem ersten Schritt</p></article>';
  const vorlagenListe=vorlagen.length?'<ul class="pd-vorlagen">'+vorlagen.map(v=>{
    const inh=K.vorlageInhalt(v,zeilen.entscheidungsliste,{projekt});
    return '<li><a href="'+esc(url({projekt:projekt.id,vorlage:v.id}))+'" data-nav><span class="pd-nr">'+esc(inh.nr)+'</span> '+esc(inh.titel)+'</a> · '+
      (v.daten.status==='vorgelegt'?'vorgelegt am '+esc(K.datumKurz(v.daten.vorgelegt_am)):'in Arbeit')+'</li>';
  }).join('')+'</ul>':'<p class="meta">Noch keine Vorlage. Eine Vorlage entsteht aus Entscheidungen der Entscheidungsliste.</p>';
  const fokus=vorZeichnen();
  const html='<div class="pd-wrap">'+kopf({zurueck:['./app/#section=tools','‹ Werkzeuge'],kicker:'Werkzeuge · Projektstart · '+projektName(),titel:'Projektstart',
    intro:'Die Bürovorlagen werden Dokumente des Projekts: hier bearbeiten und als Word, Excel oder PDF ausgeben, wenn Fachplaner oder Bauherr sie brauchen. Das Muster bleibt, wie es ist; jedes Projekt bekommt seine eigene Fassung.',
    aktionen:projektwahl+'<a class="btn" href="./projektstart.html">Muster ansehen</a>'})+
    '<section class="pd-abschnitt"><h2>Listen</h2><p class="meta">bearbeiten wie im Büro-Excel · jede Spalte mit Typ · Ausgabe als Excel</p><div class="pd-grid">'+
    karte('klaerungsliste','L3.KLA',zk,zk.aufgaben?'<p class="meta">'+zk.aufgaben+(zk.aufgaben===1?' Punkt als Aufgabe':' Punkte als Aufgabe')+' im Planner</p>':'')+
    karte('entscheidungsliste','L3.ENV · L3.A3',ze,warten.length?'<p class="pd-hinweis">'+warten.length+(warten.length===1?' Entscheidungspunkt aus der Klärungsliste wartet':' Entscheidungspunkte aus der Klärungsliste warten')+'</p>':'')+
    folgt('Planliste','L3.PLI','Planliste, Dokumente, Ausgaben, Verteiler, Austausch, Ablage')+
    folgt('Fachplanerbedarf und Schnittstellen','Koordination','Fachplanerbedarf, Schnittstellenmatrix mit der Legende der ByAK, Fragen je Disziplin, Eingang der Rückmeldungen')+
    '</div></section>'+
    '<section class="pd-abschnitt"><h2>Texte</h2><p class="meta">feste Abschnitte, Daten des Projekts schon eingesetzt · Ausgabe als Word oder PDF</p><div class="pd-grid">'+
    '<article class="card pd-karte"><div class="pd-karte-kopf"><h3>Entscheidungsvorlagen</h3><span class="pd-code">L3.ENV.1</span></div>'+vorlagenListe+
    '<div class="pd-karte-aktionen"><button type="button" class="btn btn-primary" data-act="neue-vorlage">Neue Vorlage</button></div></article>'+
    '<article class="card pd-karte"><div class="pd-karte-kopf"><h3>Mustermappen</h3><span class="pd-code">L3.MAP.1</span></div>'+(mappen().length?'<ul class="pd-vorlagen">'+mappen().map(v=>
      '<li><a href="'+esc(url({projekt:projekt.id,vorlage:v.id}))+'" data-nav>'+esc(v.daten.titel||'Mustermappe')+'</a> · '+(v.daten.punkte||[]).length+((v.daten.punkte||[]).length===1?' Position':' Positionen')+' · '+
      (v.daten.status==='vorgelegt'?'vorgelegt am '+esc(K.datumKurz(v.daten.vorgelegt_am)):'in Arbeit')+'</li>').join('')+'</ul>'
      :'<p class="meta">Eine Mappe je Themenpaket: Seiten A3 quer aus den Positionen und der Produktbibliothek, vorgestellt im Bemusterungstermin.</p>')+
    '<div class="pd-karte-aktionen"><button type="button" class="btn btn-primary" data-act="mm-neu">Neue Mustermappe</button></div></article>'+
    folgt('Projektstartvermerk','L3.PSV.1 · M00','Projektdaten, Beteiligte, Termine und Vereinbarungen zum Start')+
    folgt('Kick-off Fachplanung','L3.A1.ABS','Tagesordnung und Protokoll des Kick-offs mit den Fachplanern')+
    '</div></section>'+
    '<section class="pd-abschnitt"><h2>So hängt es zusammen</h2><ol class="pd-kette">'+
    [['Eingang','Protokoll, Mail oder Plan im Schreibtisch des Projekts'],
     ['Romy schlägt vor','neue Zeilen und Änderungen, jede mit Fundstelle; nichts ohne «Übernehmen»'],
     ['Klärungsliste','verantwortlich und Frist → Aufgabe im Planner'],
     ['Entscheidungsliste','ein Entscheidungspunkt des Auftraggebers wird eine Entscheidung'],
     ['Entscheidungsvorlage','Varianten mit Kosten und Quelle, Folgen, Empfehlung; beim Vorlegen wird der Stand festgehalten'],
     ['Entscheidung','mit Datum und Entscheider, in Textform bestätigt']].map(([t,x],i)=>'<li><strong>'+(i+1)+' · '+esc(t)+'</strong><span>'+esc(x)+'</span></li>').join('')+'</ol></section>'+
    '<section class="pd-abschnitt"><h2>Ausgabe für Fachplaner und Bauherr</h2><p class="meta">Excel, Word und PDF im Aufbau der Bürovorlagen, aber mit den Daten des Projekts. Der Briefkopf des Büros fehlt noch.</p></section>'+
    '</div>';
  zeichne(html,fokus);
}

// ---------- Listen ----------
function spaltenFuer(art){
  const alle=K.SPALTEN[art].concat(art==='entscheidungsliste'?[VORLAGE_SPALTE]:[]);
  if(ui.alleSpalten)return alle;
  return KOMPAKT[art].map(k=>alle.find(sp=>sp.key===k));
}
function kopfText(art,sp){
  if(ui.alleSpalten)return sp.kopf;
  if(art==='entscheidungsliste'&&sp.key==='thema')return 'Thema · Herkunft';
  if(art==='entscheidungsliste'&&sp.key==='optionen')return 'Optionen · Empfehlung';
  return sp.kurz||sp.kopf;
}
const STATUS_KLASSE={'offen':'offen','in Klärung':'klaerung','gelöst':'ok','Vorbehalt':'att','Entscheidungspunkt':'ag','entfällt':'mute',
  'vorbereitet':'offen','vorgelegt':'klaerung','entschieden':'ok','vertagt':'att'};
function zellInhalt(art,z,sp){
  const d=z.daten,k=sp.key;
  if(k==='nr')return '<span class="pd-nr">'+esc(K.nummer(art,z.nr))+'</span>';
  if(k==='_vorlage'){
    const v=d.vorlage_id&&zeilen.entscheidungsvorlagen.find(x=>x.id===d.vorlage_id);
    return v?'<a href="'+esc(url({projekt:projekt.id,vorlage:v.id}))+'" data-nav>'+esc(K.nummer('entscheidungsvorlagen',v.nr))+' öffnen</a>'
      :'<button type="button" class="pd-link" data-act="vorlage-anlegen" data-z="'+z.id+'">Vorlage anlegen</button>';
  }
  if(sp.typ==='datum'){
    const t=K.datumKurz(d[k]);
    const ueber=(k==='frist'||k==='bis')&&K.ueberfaellig(art,d);
    return esc(t)+(ueber?' <span class="chip chip-err">überfällig</span>':'');
  }
  if(k==='status'){
    if(!d.status)return '';
    let t=d.status;
    if(art==='entscheidungsliste'&&d.status==='vorgelegt'&&d.vorgelegt_am)t+=' '+K.datumKurz(d.vorgelegt_am);
    if(art==='entscheidungsliste'&&d.status==='entschieden'&&d.entschieden_am)t+=' '+K.datumKurz(d.entschieden_am);
    return '<span class="chip st-'+(STATUS_KLASSE[d.status]||'offen')+'">'+esc(t)+'</span>';
  }
  if(sp.typ==='janein')return d[k]==='ja'?'<span class="chip st-ag">ja</span>':d[k]==='nein'?'<span class="pd-mute">nein</span>':'';
  if(art==='entscheidungsliste'&&k==='optionen'){
    const t=K.optionenText(d);
    return (t?esc(t):'<span class="pd-mute">Optionen ergänzen</span>')+(!ui.alleSpalten&&(d.empfehlung||d.begruendung)?'<span class="pd-unter">Empfehlung: '+esc(K.empfehlungText(d))+'</span>':'');
  }
  if(art==='entscheidungsliste'&&k==='thema')return esc(d.thema)+(!ui.alleSpalten&&d.herkunft?'<span class="pd-unter">'+esc(d.herkunft)+'</span>':'');
  if(art==='entscheidungsliste'&&k==='entscheidung'){
    if(d.status==='entschieden'){
      return esc(d.entscheidung)+(d.entscheider?' · '+esc(d.entscheider):'')+(K.ohneBestaetigung(d)?'<span class="chip chip-att">Bestätigung in Textform fehlt</span>':'');
    }
    if(!ui.alleSpalten&&d.annahme)return '<span class="pd-mute">offen · Annahme für die Weiterplanung:</span> '+esc(d.annahme);
    return d.entscheidung?esc(d.entscheidung):'<span class="pd-mute">–</span>';
  }
  const t=K.zellText(art,k,d,{nr:z.nr});
  let html=esc(t);
  if(art==='klaerungsliste'&&k==='sachverhalt'&&!ui.alleSpalten){
    const links=[];
    if(d.aufgabe_id){const a=aufgaben.get(d.aufgabe_id);links.push('<a href="./app/#section=work&amp;project='+esc(projekt.id)+'">Aufgabe im Planner'+(a?.completed_at?' · erledigt':'')+'</a>')}
    if(d.entscheidung_id){const e=zeilen.entscheidungsliste.find(x=>x.id===d.entscheidung_id);if(e)links.push('<a href="'+esc(url({projekt:projekt.id,liste:'entscheidungsliste'}))+'" data-nav>'+esc(K.nummer('entscheidungsliste',e.nr))+' in der Entscheidungsliste</a>')}
    if(links.length)html+='<span class="pd-unter">'+links.join(' · ')+'</span>';
  }
  return html;
}
function zelle(art,z,sp,vorschlag=false){
  const romy=Array.isArray(z.daten._romy)&&z.daten._romy.includes(sp.key);
  if(ui.edit&&ui.edit.z===z.id&&ui.edit.k===sp.key)return '<td class="pd-c pd-c-edit pd-t-'+sp.typ+'">'+editor(art,z,sp)+'</td>';
  return '<td class="pd-c pd-t-'+sp.typ+(romy?' pd-romy':'')+(vorschlag?' pd-vs-zelle':'')+'" data-z="'+z.id+'" data-k="'+sp.key+'">'+zellInhalt(art,z,sp)+(romy?'<span class="pd-r" title="von Romy vorgeschlagen und übernommen">R</span>':'')+'</td>';
}
function editor(art,z,sp){
  const v=z.daten[sp.key];
  const a=' class="pd-in" data-edit data-z="'+z.id+'" data-k="'+sp.key+'"';
  if(sp.typ==='lang')return '<textarea'+a+' rows="3">'+esc(v)+'</textarea>';
  if(sp.typ==='datum')return '<input'+a+' value="'+esc(K.datumLang(v))+'" placeholder="TT.MM." inputmode="numeric" autocomplete="off">';
  if(sp.typ==='auswahl')return '<select'+a+'><option value=""></option>'+sp.werte.map(w=>'<option'+(w===v?' selected':'')+'>'+esc(w)+'</option>').join('')+'</select>';
  if(sp.typ==='mehrfach')return '<input'+a+' value="'+esc(Array.isArray(v)?v.join(', '):'')+'" placeholder="z. B. TWP, HLS" autocomplete="off" list="pdDisziplinen">';
  return '<input'+a+' value="'+esc(v)+'" autocomplete="off">';
}
const BEARBEITBAR=['text','lang','datum','auswahl','mehrfach'];
function renderListe(){
  const art=ui.art,doc=K.DOKUMENTE[art],alle=zeilen[art];
  const zahlen=K.zaehle(art,alle),fz=K.zaehleFilter(art,alle);
  const sicht=K.filtere(art,alle,{filter:ui.filter,disziplin:ui.disziplin,suche:ui.suche});
  const spalten=spaltenFuer(art);
  const runde=art==='klaerungsliste'?(dokumente[art]?.meta?.runde||'01'):'';
  const meta=(runde?'Runde '+esc(runde)+' · ':'')+esc(K.zusammenfassung(art,zahlen))+' · <span data-speicher>'+esc(speicherText())+'</span>';
  const aktionen='<button type="button" class="btn btn-primary" data-act="neu">+ '+(art==='klaerungsliste'?'Zeile':'Entscheidung')+'</button>'+
    (romy.bereit?'<button type="button" class="btn btn-romy" data-act="romy">Romy fragen</button>':'')+
    '<button type="button" class="btn" data-act="spalten" aria-pressed="'+ui.alleSpalten+'">'+(ui.alleSpalten?'Kompakt':'Alle Spalten')+'</button>'+
    '<button type="button" class="btn" data-act="excel" data-art="'+art+'">Excel</button>';
  const filter='<div class="pd-filter">'+K.FILTER[art].map(([k,l])=>'<button type="button" class="chip" data-act="filter" data-f="'+esc(k)+'" aria-pressed="'+(ui.filter===k)+'">'+esc(l)+' '+fz[k]+'</button>').join('')+
    (art==='klaerungsliste'?'<label class="pd-sel"><span>Disziplin</span><select data-act="disziplin"><option value="">alle</option>'+K.DISZIPLINEN.filter(d=>d[0]!=='ALLE').map(([c,l])=>'<option value="'+c+'"'+(ui.disziplin===c?' selected':'')+' title="'+esc(l)+'">'+c+'</option>').join('')+'</select></label>'
      +'<label class="pd-sel"><span>Runde</span><select data-act="runde">'+K.RUNDEN.map(r=>'<option'+(r===runde?' selected':'')+'>'+r+'</option>').join('')+'</select></label>':'')+
    '<input type="search" class="pd-suche" id="pd-suche" data-act="suche" placeholder="Suchen" value="'+esc(ui.suche)+'" aria-label="In der Liste suchen"></div>';
  let banner=romyBanner(art);
  if(art==='entscheidungsliste'){
    const warten=K.wartendeEntscheidungspunkte(zeilen.klaerungsliste,zeilen.entscheidungsliste).filter(z=>!ui.spaeter.has(z.id));
    const naechste=K.nummer('entscheidungsliste',(alle.reduce((m,z)=>Math.max(m,z.nr),0))+1);
    banner+=warten.map(z=>'<div class="pd-banner info">In der Klärungsliste ist Nr '+z.nr+' ('+esc(K.kurz(z.daten.sachverhalt,80))+') als Entscheidungspunkt des Auftraggebers markiert, steht aber noch nicht hier.'+
      '<div class="pd-banner-actions"><button type="button" class="btn" data-act="ep-uebernehmen" data-z="'+z.id+'">Als '+esc(naechste)+' übernehmen</button><button type="button" class="btn btn-quiet" data-act="ep-spaeter" data-z="'+z.id+'">Später</button></div></div>').join('');
  }
  const auswahl=[...ui.auswahl].map(id=>alle.find(z=>z.id===id)).filter(Boolean);
  const leiste=auswahl.length?'<div class="pd-auswahl" role="region" aria-label="Auswahl"><strong>'+auswahl.length+(auswahl.length===1?' Zeile':' Zeilen')+' ausgewählt</strong>'+
    (art==='klaerungsliste'?'<button type="button" class="btn" data-act="aufgaben">Aufgaben im Planner anlegen</button><button type="button" class="btn" data-act="in-entscheidungen">In die Entscheidungsliste</button>'
      :'<button type="button" class="btn" data-act="vorlage-auswahl">Vorlage aus der Auswahl</button>')+
    (romy.bereit?'<span class="pd-auswahl-romy">Romy:</span>'+(art==='klaerungsliste'?'<button type="button" class="btn" data-act="romy-fachplaner">Frage an die Fachplaner formulieren</button><button type="button" class="btn" data-act="romy-fristen">Fristen mit dem Terminplan prüfen</button>'
      :'<button type="button" class="btn" data-act="romy-bestaetigung">Bestätigung als Mail entwerfen</button>')+'<button type="button" class="btn" data-act="romy-frage">Frage stellen …</button>':'')+
    '<button type="button" class="btn btn-quiet" data-act="auswahl-weg">Auswahl aufheben</button></div>':'';
  const kopfzeile='<tr><th class="pd-check"><input type="checkbox" data-act="alle" aria-label="Alle auswählen"'+(sicht.length&&sicht.every(z=>ui.auswahl.has(z.id))?' checked':'')+'></th>'+
    spalten.map(sp=>'<th class="pd-t-'+sp.typ+'" scope="col">'+esc(kopfText(art,sp))+'</th>').join('')+'</tr>';
  const reihen=sicht.map(z=>{
    const d=z.daten;
    const kl=['pd-zeile'];if(K.erledigt(art,d))kl.push('pd-erledigt');if(ui.detail===z.id)kl.push('pd-aktiv');if(K.ueberfaellig(art,d))kl.push('pd-ueber');
    return '<tr class="'+kl.join(' ')+'" data-zeile="'+z.id+'"><td class="pd-check"><input type="checkbox" data-act="waehle" data-z="'+z.id+'" aria-label="Zeile '+esc(K.nummer(art,z.nr))+' auswählen"'+(ui.auswahl.has(z.id)?' checked':'')+'></td>'+
      spalten.map(sp=>zelle(art,z,sp,geaendert(art,z).has(sp.key))).join('')+'</tr>'+aenderungsZeilen(art,z,spalten.length);
  }).join('')+neueVorschlaege(art,spalten);
  const neuIndex=spalten.findIndex(sp=>sp.key===NEU_FELD[art]);
  const neuZeile='<tr class="pd-neu"><td class="pd-check"></td>'+spalten.map((sp,i)=>i===neuIndex?'<td class="pd-c" colspan="'+(spalten.length-i)+'"><input class="pd-in pd-neu-in" data-neu placeholder="Neue Zeile: '+(art==='klaerungsliste'?'Sachverhalt':'Thema')+' eintippen, Enter legt sie an und springt in die nächste Spalte" aria-label="Neue Zeile"></td>':i<neuIndex?'<td class="pd-c">'+(i===0?'<span class="pd-mute">'+esc(K.nummer(art,(alle.reduce((m,z)=>Math.max(m,z.nr),0))+1))+'</span>':'')+'</td>':'').join('')+'</tr>';
  const fuss='<p class="meta pd-fuss">'+(ui.alleSpalten?'Alle '+(spalten.length)+' Spalten wie in der Bürovorlage.':'Kompakt: '+KOMPAKT[art].filter(k=>k!=='_vorlage').length+' von '+K.SPALTEN[art].length+' Spalten. «Alle Spalten» zeigt alle Spalten der Bürovorlage.')+
    ' Klick in eine Zelle bearbeitet sie; Enter oder Tab springt weiter, Esc bricht ab. Die Nummer öffnet die Details.'+(sicht.length<alle.length?' Gefiltert: '+sicht.length+' von '+alle.length+'.':'')+'</p>';
  const fokus=vorZeichnen();
  const html='<div class="pd-wrap pd-liste-wrap'+(ui.detail?' mit-detail':'')+'">'+kopf({zurueck:[url({projekt:projekt.id}),'‹ Projektstart'],kicker:'Projektstart · '+projektName(),titel:doc.titel,meta,aktionen})+
    filter+banner+leiste+
    '<div class="pd-tabelle-wrap"><table class="pd-tabelle'+(ui.alleSpalten?' pd-alle':'')+'"><thead>'+kopfzeile+'</thead><tbody>'+reihen+neuZeile+'</tbody></table></div>'+fuss+
    '<datalist id="pdDisziplinen">'+K.DISZIPLINEN.map(([c,l])=>'<option value="'+c+'">'+esc(l)+'</option>').join('')+'</datalist>'+
    (ui.detail?detailPanel(art):'')+'</div>';
  zeichne(html,fokus);
}
// Nächste bearbeitbare Zelle in der Zeile (Enter, Tab) oder die vorige (Umschalt+Tab).
function naechsteZelle(art,z,key,richtung=1){
  const spalten=spaltenFuer(art);
  let i=spalten.findIndex(sp=>sp.key===key);
  for(i+=richtung;i>=0&&i<spalten.length;i+=richtung)if(BEARBEITBAR.includes(spalten[i].typ))return spalten[i].key;
  return null;
}
function lies(art,sp,roh){
  if(sp.typ==='datum'){const iso=K.leseDatum(roh);if(iso===null){meldung('Datum bitte als TT.MM. oder TT.MM.JJJJ eingeben.','warn');return {ok:false}}return {ok:true,wert:iso}}
  if(sp.typ==='mehrfach'){
    const codes=[...new Set(String(roh).split(/[\s,;/]+/).map(x=>x.trim().toUpperCase()).filter(Boolean))];
    const fremd=codes.filter(c=>!sp.werte.includes(c));
    if(fremd.length){meldung('Unbekannte Disziplin: '+fremd.join(', ')+'. Möglich: '+sp.werte.join(', ')+'.','warn');return {ok:false}}
    return {ok:true,wert:codes};
  }
  return {ok:true,wert:String(roh).replace(/\s+$/,'')};
}
// Wert einer Zelle übernehmen, ohne neu zu zeichnen. Antwort: 'ok', 'falsch' (bleibt im Feld) oder 'dialog'.
function uebernimmZelle(el){
  const z=zeileVon(el.dataset.z),art=artVon(z?.dokument_id);if(!z||!art)return 'falsch';
  const sp=spaltenFuer(art).find(x=>x.key===el.dataset.k)||K.SPALTEN[art].find(x=>x.key===el.dataset.k);
  if(!sp)return 'falsch';
  const r=lies(art,sp,el.value);
  if(!r.ok)return 'falsch';
  if(art==='entscheidungsliste'&&sp.key==='status'&&r.wert==='entschieden'&&z.daten.status!=='entschieden')return 'dialog';
  if(!setze(art,z,sp.key,r.wert))return 'falsch';
  if(ui.meldung&&ui.meldungArt==='warn')ui.meldung='';
  return 'ok';
}
function bestaetige(el,{weiter=0}={}){
  const z=zeileVon(el.dataset.z),art=artVon(z?.dokument_id);if(!z||!art)return;
  const r=uebernimmZelle(el);
  if(r==='falsch'){el.focus();return}
  if(r==='dialog'){ui.edit=null;renderListe();entscheidungDialog(z);return}
  const naechste=weiter?naechsteZelle(art,z,el.dataset.k,weiter):null;
  ui.edit=naechste?{z:z.id,k:naechste}:null;
  renderListe();
}

// ---------- Details einer Zeile ----------
function feldEingabe(art,z,key,{typ,werte,lang=false,label=null,hinweis=''}={}){
  const sp=K.SPALTEN[art].find(x=>x.key===key);
  const t=typ||sp?.typ||(lang?'lang':'text'),v=z.daten[key];
  const a=' data-feld="'+key+'" data-z="'+z.id+'" id="f-'+key+'"';
  let input;
  if(t==='lang')input='<textarea class="pd-in"'+a+' rows="3">'+esc(v)+'</textarea>';
  else if(t==='datum')input='<input class="pd-in"'+a+' value="'+esc(K.datumLang(v))+'" placeholder="TT.MM.JJJJ" data-typ="datum" autocomplete="off">';
  else if(t==='auswahl'||t==='janein'){const w=werte||sp?.werte||[];input='<select class="pd-in"'+a+'><option value=""></option>'+w.map(x=>'<option'+(x===v?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select>'}
  else if(t==='mehrfach'){
    const gew=Array.isArray(v)?v:[];
    input='<div class="pd-codes" role="group" aria-label="'+esc(label||K.feldName(art,key))+'">'+(sp?.werte||[]).map(c=>'<button type="button" class="chip" data-act="code" data-z="'+z.id+'" data-feld="'+key+'" data-code="'+c+'" aria-pressed="'+gew.includes(c)+'" title="'+esc(K.DISZIPLINEN.find(d=>d[0]===c)?.[1]||'')+'">'+c+'</button>').join('')+'</div>';
  }
  else input='<input class="pd-in"'+a+' value="'+esc(v)+'" autocomplete="off">';
  const romy=Array.isArray(z.daten._romy)&&z.daten._romy.includes(key);
  return '<div class="pd-feld'+(romy?' pd-romy':'')+'"><label for="f-'+key+'">'+esc(label||sp?.kopf||K.feldName(art,key))+(romy?' <span class="pd-r">R</span>':'')+'</label>'+input+(hinweis?'<p class="meta">'+esc(hinweis)+'</p>':'')+'</div>';
}
function optionenEditor(z){
  const opts=K.optionen(z.daten);
  const f=(i,k,l,ph='')=>'<label class="pd-ofeld"><span>'+esc(l)+'</span><input class="pd-in" id="o-'+i+'-'+k+'" data-opt="'+i+'" data-ofeld="'+k+'" data-z="'+z.id+'" value="'+esc(opts[i][k])+'" placeholder="'+esc(ph)+'" autocomplete="off"></label>';
  if(opts.some(o=>o.produkt_id)&&!quellen.daten&&!quellen.laedt)void ladeQuellen().then(()=>{if(quellen.daten)spaeterRendern()});
  return '<div class="pd-optionen">'+opts.map((o,i)=>'<div class="pd-option"><div class="pd-option-kopf"><strong>Variante '+esc(o.id)+'</strong><button type="button" class="pd-link" data-act="option-weg" data-z="'+z.id+'" data-i="'+i+'">entfernen</button></div>'+
    f(i,'text','Beschreibung')+'<div class="pd-option-zahlen">'+f(i,'produkt','Produkt','z. B. BO-01')+f(i,'kennwert','Kennwert netto','€/m²')+f(i,'menge','Menge','m²')+f(i,'betrag','Betrag netto','leer: Kennwert × Menge')+'</div>'+
    herkunftZeile(o)+(Z&&R&&P?'<button type="button" class="btn" data-act="zahlen" data-z="'+z.id+'" data-i="'+i+'">Zahlen aus dem Office …</button>':'')+
    f(i,'quelle','Weitere Quelle (von Hand)','z. B. Angebot vom …')+'<div class="pd-option-zahlen">'+f(i,'kosten','Kosten')+f(i,'termine','Termine')+f(i,'qualitaet','Qualität · Gestaltung')+f(i,'genehmigung','Genehmigung')+'</div></div>').join('')+
    '<div class="pd-option-aktionen"><button type="button" class="btn" data-act="option-neu" data-z="'+z.id+'">+ Variante</button>'+
    (romy.bereit&&Z&&R&&P&&opts.some(o=>String(o.text||'').trim())?'<button type="button" class="btn btn-romy" data-act="romy-zahlen" data-z="'+z.id+'">Romy: Zahlen holen</button>':'')+'</div></div>';
}
function detailPanel(art){
  const z=zeilen[art].find(x=>x.id===ui.detail);if(!z)return '';
  const d=z.daten;
  let felder='';
  if(art==='klaerungsliste'){
    felder=['runde','erfasst_am','disziplinen','ort','plan','sachverhalt','loesung','verantwortlich','frist','status','ag','folgen','erledigt_am','protokoll'].map(k=>feldEingabe(art,z,k)).join('');
  }else{
    felder=feldEingabe(art,z,'thema')+feldEingabe(art,z,'herkunft')+feldEingabe(art,z,'anlass',{lang:true,label:'Anlass · Sachverhalt'})+feldEingabe(art,z,'frage')+
      feldEingabe(art,z,'gesichert',{lang:true})+feldEingabe(art,z,'angenommen',{lang:true,label:'Angenommen (zu bestätigen)'})+
      '<div class="pd-feld"><label>Optionen und Folgen je Option</label>'+optionenEditor(z)+'</div>'+
      feldEingabe(art,z,'empfehlung',{typ:'auswahl',werte:K.optionen(d).map(o=>o.id),label:'Empfehlung des Büros: Variante'})+feldEingabe(art,z,'begruendung',{lang:true,label:'Begründung der Empfehlung'})+
      feldEingabe(art,z,'kostenbezug',{label:'Kostenstand · Kostengruppe',hinweis:'z. B. Kostenstand 4. Quartal 2026, KG 352'})+
      feldEingabe(art,z,'festliegt')+feldEingabe(art,z,'wenn_spaeter',{lang:true})+feldEingabe(art,z,'bis')+feldEingabe(art,z,'annahme')+
      feldEingabe(art,z,'status')+feldEingabe(art,z,'vorgelegt_am')+
      '<div class="pd-entscheidung"><p class="pd-feld-titel">Entscheidung des Auftraggebers</p>'+
      (d.status==='entschieden'?'<p>'+esc(d.entscheidung)+' · '+esc(d.entscheider)+' · am '+esc(K.datumLang(d.entschieden_am))+'</p>'+feldEingabe(art,z,'bestaetigt_am',{hinweis:K.ohneBestaetigung(d)?'Die Bestätigung in Textform fehlt noch.':''}):'<p class="meta">Noch nicht entschieden.</p>')+
      '<button type="button" class="btn" data-act="entscheiden" data-z="'+z.id+'">'+(d.status==='entschieden'?'Entscheidung ändern':'Entscheidung eintragen')+'</button>'+
      (d.status==='entschieden'&&K.optionen(d).some(o=>o.produkt_id)?'<button type="button" class="btn" data-act="freigeben" data-z="'+z.id+'">In der Produktbibliothek freigeben</button>':'')+
      '<p class="meta">«entschieden» setzt nur, wer im Projektteam ist, mit Datum und Entscheider; Romy trägt nie eine Entscheidung ein.</p></div>';
  }
  const verknuepft=[];
  if(art==='klaerungsliste'){
    if(d.aufgabe_id){const a=aufgaben.get(d.aufgabe_id);verknuepft.push('<li>Aufgabe im Planner: <a href="./app/#section=work&amp;project='+esc(projekt.id)+'">'+esc(a?.title||'öffnen')+'</a>'+(a?.due_date?' · bis '+esc(K.datumKurz(a.due_date)):'')+(a?.completed_at?' · erledigt':'')+'</li>')}
    else verknuepft.push('<li><button type="button" class="pd-link" data-act="aufgabe" data-z="'+z.id+'">Aufgabe im Planner anlegen</button>'+(d.verantwortlich&&d.frist?'':' <span class="meta">(mit Verantwortlichem und Frist am besten)</span>')+'</li>');
    const e=d.entscheidung_id&&zeilen.entscheidungsliste.find(x=>x.id===d.entscheidung_id);
    if(e)verknuepft.push('<li>'+esc(K.nummer('entscheidungsliste',e.nr))+' in der Entscheidungsliste · '+esc(e.daten.status||'')+'</li>');
    else verknuepft.push('<li><button type="button" class="pd-link" data-act="in-entscheidungen-eine" data-z="'+z.id+'">In die Entscheidungsliste</button></li>');
  }else{
    const ref=d.herkunft_ref;
    if(ref?.zeile_id){const k=zeilen.klaerungsliste.find(x=>x.id===ref.zeile_id);verknuepft.push('<li>Aus der Klärungsliste: Nr '+esc(k?.nr??ref.nr)+(k?' · '+esc(K.kurz(k.daten.sachverhalt,70)):'')+'</li>')}
    const v=d.vorlage_id&&zeilen.entscheidungsvorlagen.find(x=>x.id===d.vorlage_id);
    verknuepft.push(v?'<li>Vorlage <a href="'+esc(url({projekt:projekt.id,vorlage:v.id}))+'" data-nav>'+esc(K.nummer('entscheidungsvorlagen',v.nr))+' öffnen</a></li>':'<li><button type="button" class="pd-link" data-act="vorlage-anlegen" data-z="'+z.id+'">Vorlage anlegen</button></li>');
  }
  if(d.fundstelle)verknuepft.push('<li>Fundstelle: '+esc(d.fundstelle)+'</li>');
  return '<aside class="pd-detail" aria-label="Details"><div class="pd-detail-kopf"><h2>'+esc(K.DOKUMENTE[art].zeile)+' '+esc(K.nummer(art,z.nr))+' · Details</h2><button type="button" class="pd-x" data-act="detail-zu" aria-label="Details schließen">×</button></div>'+
    '<div class="pd-detail-inhalt">'+felder+'<h3>Verknüpft</h3><ul class="pd-verknuepft">'+verknuepft.join('')+'</ul>'+
    (romy.bereit?'<h3>Romy</h3><div class="pd-feld"><label for="r-frage">Frage zu dieser Zeile</label><textarea class="pd-in" id="r-frage" rows="2" placeholder="z. B. Was ändert sich in der Kostenberechnung, wenn der Unterzug deckengleich wird?"></textarea>'+
      '<button type="button" class="btn btn-romy" data-act="romy-frage-zeile" data-z="'+z.id+'">Romy zu dieser Zeile fragen</button></div>':'')+
    '<h3>Verlauf</h3><div data-verlauf>'+verlaufHtml(art,z)+'</div>'+
    '<div class="pd-detail-fuss"><button type="button" class="btn btn-danger" data-act="loeschen" data-z="'+z.id+'">'+esc(K.DOKUMENTE[art].zeile)+' löschen</button></div></div></aside>';
}
function wertText(art,key,v){
  if(v===null||v===undefined||v==='')return '–';
  const sp=K.SPALTEN[art]?.find(x=>x.key===key);
  if(sp?.typ==='datum'||/_am$|^frist$|^bis$/.test(key))return K.datumKurz(v)||String(v);
  if(key==='optionen')return K.optionenText({optionen:v})||'–';
  if(Array.isArray(v))return v.join(', ')||'–';
  if(typeof v==='object')return key==='herkunft_ref'?'Nr '+(v.nr??''):'…';
  return K.kurz(v,80);
}
function verlaufHtml(art,z){
  if(!ui.verlauf||ui.verlauf.id!==z.id){void ladeVerlauf(z);return '<p class="meta">Verlauf wird geladen …</p>'}
  if(ui.verlauf.fehler)return '<p class="meta">Verlauf nicht erreichbar.</p>';
  const e=ui.verlauf.eintraege;
  if(!e.length)return '<p class="meta">Noch kein Eintrag.</p>';
  return '<ol class="pd-verlauf">'+e.map(x=>{
    const wer=name(x.user_id)||'jemand',wann=K.datumKurz(String(x.created_at).slice(0,10));
    const q=x.vorschlag_id&&ui.verlauf.quellen?.get(x.vorschlag_id);
    const romy=x.quelle==='romy'?' · Vorschlag von Romy'+(q?.fundstelle?' ('+esc(q.fundstelle)+')':'')+', übernommen von '+esc(wer):' · '+esc(wer);
    if(x.vorgang==='angelegt')return '<li><span>'+esc(wann)+'</span> angelegt'+romy+'</li>';
    return '<li><span>'+esc(wann)+'</span> '+esc(K.feldName(art,x.feld))+': '+esc(wertText(art,x.feld,x.neu))+' <span class="pd-mute">(vorher '+esc(wertText(art,x.feld,x.alt))+')</span>'+romy+'</li>';
  }).join('')+'</ol>';
}
async function ladeVerlauf(z){
  ui.verlauf={id:z.id,eintraege:[],laedt:true};
  const {data,error}=await sb.from('office_projektdokument_aenderungen').select('id,vorgang,feld,alt,neu,quelle,vorschlag_id,user_id,created_at').eq('zeile_id',z.id).order('id',{ascending:false}).limit(60);
  // Woher ein übernommener Vorschlag kam: Fundstelle des Vorschlags.
  const quellen=new Map(),ids=[...new Set((data||[]).map(x=>x.vorschlag_id).filter(Boolean))];
  if(ids.length){const {data:vs}=await sb.from('office_projektdokument_vorschlaege').select('id,fundstelle,quelle').in('id',ids);for(const v of vs||[])quellen.set(v.id,v)}
  ui.verlauf={id:z.id,eintraege:error?[]:(data||[]),fehler:!!error,quellen};
  const el=root.querySelector('[data-verlauf]');
  if(el&&ui.detail===z.id)el.innerHTML=verlaufHtml(artVon(z.dokument_id),z);
}
function oeffneDetail(z){ui.detail=z.id;ui.verlauf=null;ui.edit=null;render()}

// ---------- Entscheidung eintragen ----------
function entscheidungDialog(z){
  const d=z.daten,opts=K.optionen(d).filter(o=>String(o.text||'').trim());
  dialog.innerHTML='<form method="dialog" class="pd-dlg"><h2>Entscheidung eintragen · '+esc(K.nummer('entscheidungsliste',z.nr))+'</h2><p class="meta">'+esc(d.frage||d.thema||'')+'</p>'+
    (opts.length?'<div class="pd-wahl-optionen">'+opts.map(o=>'<button type="button" class="chip" data-wahl="'+esc(o.id+': '+o.text)+'">'+esc(o.id+': '+K.kurz(o.text,50))+'</button>').join('')+'</div>':'')+
    '<label class="pd-feld"><span>Entscheidung</span><textarea class="pd-in" name="entscheidung" rows="2" required>'+esc(d.entscheidung)+'</textarea></label>'+
    '<div class="pd-zwei"><label class="pd-feld"><span>entschieden am</span><input class="pd-in" name="am" value="'+esc(K.datumLang(d.entschieden_am||heute()))+'" required></label>'+
    '<label class="pd-feld"><span>Entscheider</span><input class="pd-in" name="wer" value="'+esc(d.entscheider)+'" placeholder="z. B. Auftraggeber, in der Besprechung M05" required></label></div>'+
    '<label class="pd-feld"><span>in Textform bestätigt am (falls schon)</span><input class="pd-in" name="bestaetigt" value="'+esc(K.datumLang(d.bestaetigt_am))+'" placeholder="TT.MM.JJJJ"></label>'+
    '<p class="pd-dlg-fehler" data-dlg-fehler></p><div class="pd-dlg-aktionen"><button type="button" class="btn" data-dlg="abbrechen">Abbrechen</button><button type="submit" class="btn btn-primary">Als entschieden speichern</button></div></form>';
  const form=dialog.querySelector('form');
  form.addEventListener('click',e=>{
    const w=e.target.closest('[data-wahl]');if(w){form.entscheidung.value=w.dataset.wahl;return}
    if(e.target.closest('[data-dlg="abbrechen"]'))dialog.close();
  });
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const am=K.leseDatum(form.am.value),best=K.leseDatum(form.bestaetigt.value);
    const f=dialog.querySelector('[data-dlg-fehler]');
    if(!am||best===null){f.textContent='Datum bitte als TT.MM.JJJJ eingeben.';return}
    const neu={...z.daten,status:'entschieden',entscheidung:form.entscheidung.value.trim(),entschieden_am:am,entscheider:form.wer.value.trim(),bestaetigt_am:best||''};
    const p=K.pruefe('entscheidungsliste',neu);if(p){f.textContent=p;return}
    z.daten=neu;markiere(z);dialog.close();render();
  });
  dialog.showModal();
}

// ---------- Zahlen der Varianten: Produktbibliothek, Datenpool, Kostenberechnung ----------
// Beim ersten Bedarf geladen; lesen darf das ganze Office (wie in Produktbibliothek und Kostenberechnung).
const quellen={daten:null,laedt:null,fehler:''};
const VERWENDUNG='id,produkt_id,projekt_id,code,status,menge,einheit';
function ladeQuellen(){
  if(quellen.laedt)return quellen.laedt;
  quellen.laedt=(async()=>{
    if(!Z||!R||!P){quellen.fehler='Die Rechenkerne sind nicht geladen.';return}
    try{
      const [pr,pp,pd,pv,ki,kt]=await Promise.all([
        sb.from('office_produkte').select('id,typ,kategorie,name,hersteller,serie,familie,beschreibung,status,archiviert').eq('archiviert',false).limit(2000),
        sb.from('office_produkt_preise').select('id,produkt_id,art,betrag,einheit,stand,quelle,projekt_bezeichnung,kg,kommentar').limit(5000),
        sb.from('office_produkt_dokumente').select('id,produkt_id,art').limit(5000),
        sb.from('office_produkt_verwendungen').select(VERWENDUNG).limit(5000),
        sb.from('office_kosten_instances').select('id,project_id,project_number,project_name,is_archived,updated_at,state').limit(300),
        sb.from('office_kosten_templates').select('id,state').eq('is_active',true).limit(1)]);
      if([pr,pp,pd,pv,ki,kt].some(x=>x.error))throw new Error('nicht erreichbar');
      quellen.daten={produkte:pr.data||[],preise:pp.data||[],dokumente:pd.data||[],verwendungen:pv.data||[],instanzen:ki.data||[],muster:(kt.data||[])[0]||null,pool:null,poolOhne:null};
      quellen.fehler='';
    }catch(e){console.error('Projektdokumente · Zahlen',e);quellen.fehler='Produktbibliothek und Kostenberechnungen sind gerade nicht erreichbar.';quellen.laedt=null}
  })();
  return quellen.laedt;
}
function kobeDesProjekts(){
  return (quellen.daten?.instanzen||[]).filter(i=>i.project_id===projekt?.id&&!i.is_archived)
    .sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')))[0]||null;
}
// Datenpool ohne die Kostenberechnung des Projekts: deren Positionen stehen eigens zur Wahl.
function poolEintraege(){
  const q=quellen.daten;if(!q)return [];
  const ohne=kobeDesProjekts()?.id||'';
  if(!q.pool||q.poolOhne!==ohne){q.pool=P.eintraege(q.instanzen.filter(i=>i.id!==ohne),R);q.poolOhne=ohne}
  return q.pool;
}
const zielJetzt=()=>Z.ziel({kobe:kobeDesProjekts(),muster:quellen.daten?.muster,heute:heute()});
const produktVon=id=>quellen.daten?.produkte.find(p=>p.id===id)||null;
function produktMarke(o){
  if(!o?.produkt_id||!quellen.daten||!Z)return '';
  const p=produktVon(o.produkt_id);if(!p)return '<span class="chip chip-att">nicht in der Produktbibliothek</span>';
  const d=Z.datenblatt(p,quellen.daten.dokumente);
  return '<span class="chip '+(d==='geprueft'?'chip-ok':'chip-att')+'">'+esc(Z.DATENBLATT[d])+'</span>';
}
function herkunftZeile(o){
  const li=[];
  if(o.produkt_id)li.push('<li><strong>Produkt</strong> '+produktMarke(o)+' <a href="./produktbibliothek.html?id='+encodeURIComponent(o.produkt_id)+'" target="_blank" rel="noopener noreferrer">in der Produktbibliothek</a></li>');
  if(o.kennwert_quelle)li.push('<li><strong>Kennwert</strong> '+esc(o.kennwert_quelle)+'</li>');
  if(o.menge_quelle)li.push('<li><strong>Menge</strong> '+esc(o.menge_quelle)+'</li>');
  if(Z&&!Z.einheitPasst(o))li.push('<li class="pd-warn">Die Einheiten von Kennwert und Menge passen nicht zusammen.</li>');
  return li.length?'<ul class="pd-herkunft">'+li.join('')+'</ul>':'';
}
// Ein Feld mit Fokus gilt, bevor ein Dialog die Variante liest.
function uebernimmOffeneFelder(){const el=document.activeElement;if(el?.matches?.('input[data-opt]'))optionFeld(el)}
function nimmZahl(z,i,teil,{kg=''}={}){
  const opts=K.optionen(z.daten).map(x=>({...x}));if(!opts[i])return;
  opts[i]=Z.setze(opts[i],teil);
  if(!setze('entscheidungsliste',z,'optionen',opts))return;
  // Kostenstand und KG stehen sonst nirgends: beim ersten Kennwert oder der ersten Menge vorgeschlagen, nie überschrieben.
  if(('kennwert' in teil||'menge' in teil)&&!String(z.daten.kostenbezug||'').trim())
    setze('entscheidungsliste',z,'kostenbezug',['Kostenstand '+R.quartalText(zielJetzt().kostenstand),kg?'KG '+kg:''].filter(Boolean).join(', '));
}

// Dialog «Zahlen für Variante …»: Gewählt, Produkt, Datenpool, Kostenberechnung des Projekts.
const zd={z:null,i:0,suche:'',gruppen:new Map(),positionen:new Map()};
function zahlenDialog(z,i){
  const o=K.optionen(z.daten)[i];if(!o)return;
  Object.assign(zd,{z,i,suche:String(o.text||'').trim(),gruppen:new Map(),positionen:new Map()});
  dialog.innerHTML='<form method="dialog" class="pd-dlg pd-dlg-breit pd-zahlen"><h2>Zahlen für Variante '+esc(o.id)+' · '+esc(K.nummer('entscheidungsliste',z.nr))+'</h2>'+
    '<p class="meta">Aus der Produktbibliothek, dem Datenpool (Kostenberechnungen des Büros) und der Kostenberechnung des Projekts. Jede Zahl behält ihre Fundstelle; das Dokument an den Auftraggeber nennt nur den Beleg, keine anderen Projekte.</p>'+
    '<label class="pd-feld"><span>Suchen</span><input class="pd-in" type="search" data-zsuche value="'+esc(zd.suche)+'" autocomplete="off" placeholder="z. B. Parkett Eiche"></label>'+
    '<div data-zinhalt aria-live="polite"><p class="meta">wird geladen …</p></div>'+
    '<p class="pd-dlg-fehler" data-dlg-fehler></p><div class="pd-dlg-aktionen"><button type="button" class="btn btn-primary" data-dlg="zu">Fertig</button></div></form>';
  const form=dialog.querySelector('form');
  form.addEventListener('click',e=>{
    const b=e.target.closest('[data-z-act]');
    if(b){e.preventDefault();void zahlAktion(b);return}
    if(e.target.closest('[data-dlg="zu"]'))dialog.close();
  });
  form.addEventListener('input',e=>{if(e.target.matches('[data-zsuche]')){clearTimeout(form._t);form._t=setTimeout(()=>{zd.suche=e.target.value;zeigeZahlen()},250)}});
  form.addEventListener('submit',e=>e.preventDefault());
  dialog.addEventListener('close',()=>{zd.z=null;render()},{once:true});
  dialog.showModal();
  void ladeQuellen().then(zeigeZahlen);
}
const eintragZeile=(links,knoepfe)=>'<li><span>'+links+'</span><span class="pd-zknoepfe">'+knoepfe+'</span></li>';
function zeigeZahlen(){
  const el=dialog.querySelector('[data-zinhalt]');if(!el||!zd.z)return;
  if(!quellen.daten){el.innerHTML='<p class="meta warn">'+esc(quellen.fehler||'Produktbibliothek und Kostenberechnungen sind gerade nicht erreichbar.')+'</p>';return}
  const q=quellen.daten,z=zd.z,o=K.optionen(z.daten)[zd.i];if(!o){el.innerHTML='';return}
  const zl=zielJetzt(),kobe=kobeDesProjekts(),b=K.betragVon(o),darfHier=darf(projekt);
  let h='<section class="pd-zwahl"><h3>Gewählt</h3><dl>'+
    '<div><dt>Produkt</dt><dd>'+(o.produkt?esc(o.produkt)+' '+produktMarke(o):'–')+'</dd></div>'+
    '<div><dt>Kennwert</dt><dd>'+(o.kennwert?esc(o.kennwert):'–')+(o.kennwert_quelle?'<span>'+esc(o.kennwert_quelle)+'</span>':'')+'</dd></div>'+
    '<div><dt>Menge</dt><dd>'+(o.menge?esc(o.menge):'–')+(o.menge_quelle?'<span>'+esc(o.menge_quelle)+'</span>':'')+'</dd></div>'+
    '<div><dt>Betrag netto</dt><dd>'+(b.cent!==null?esc(K.euro(b.cent))+(b.berechnet?' (Kennwert × Menge)':''):'–')+'</dd></div></dl>'+
    (Z.einheitPasst(o)?'':'<p class="pd-warn">Die Einheiten von Kennwert und Menge passen nicht zusammen.</p>')+
    '<p class="meta">Fortgeschrieben auf '+esc(R.quartalText(zl.kostenstand))+(zl.herkunft==='kobe'?', den Kostenstand der Kostenberechnung des Projekts.':' (heute): das Projekt hat noch keine Kostenberechnung.')+'</p></section>';
  // Produkt
  const gewaehlt=o.produkt_id?produktVon(o.produkt_id):null;
  h+='<section><h3>Produkt aus der Produktbibliothek</h3>';
  if(gewaehlt){
    const v=Z.verwendungIm(gewaehlt.id,projekt.id,q.verwendungen),preise=Z.preiseVon(gewaehlt.id,q.preise);
    h+='<p><strong>'+esc(Z.produktText(gewaehlt,v))+'</strong> '+produktMarke(o)+(v?' <span class="meta">· im Projekt '+esc(v.code)+', '+esc(v.status)+'</span>':'')+'</p>';
    if(!v&&darfHier)h+='<p><button type="button" class="btn" data-z-act="muster">In die Musterliste des Projekts ('+esc(Z.naechsterCode(projekt.id,gewaehlt.kategorie,q.verwendungen))+', vorgeschlagen)</button></p>';
    h+=preise.length?'<ul class="pd-zliste">'+preise.slice(0,6).map(x=>{const k=Z.kennwertAusPreis(x,gewaehlt,zl,R,P);
      return eintragZeile('<strong>'+esc(k.kennwert)+'</strong> '+esc(Z.PREISART[x.art]||x.art)+(x.stand?' · Stand '+esc(Z.monatText(x.stand)):'')+(k.hinweis?' <span class="pd-warn">'+esc(k.hinweis)+'</span>':''),
        '<button type="button" class="btn" data-z-act="preis" data-id="'+esc(x.id)+'">Als Kennwert</button>')}).join('')+'</ul>':'<p class="meta">Für dieses Produkt gibt es noch keinen Preis.</p>';
    h+='<p><button type="button" class="pd-link" data-z-act="produkt-weg">Verknüpfung mit dem Produkt lösen</button></p>';
  }
  const treffer=Z.produktSuche(q.produkte,zd.suche,P,{grenze:8}).filter(x=>x.p.id!==gewaehlt?.id);
  h+=treffer.length?'<ul class="pd-zliste">'+treffer.map(({p})=>{
      const v=Z.verwendungIm(p.id,projekt.id,q.verwendungen),pr=Z.preiseVon(p.id,q.preise)[0],c=pr?BigInt(Math.round(Number(pr.betrag)*100)):null;
      return eintragZeile('<strong>'+esc(p.name)+'</strong>'+(p.hersteller?' · '+esc(p.hersteller):'')+(v?' · '+esc(v.code):'')+
        '<span class="meta"> '+esc(Z.DATENBLATT[Z.datenblatt(p,q.dokumente)])+(c!==null?' · '+esc(Z.euroJe(c,pr.einheit))+' '+esc(Z.PREISART[pr.art]||''):'')+'</span>',
        '<button type="button" class="btn" data-z-act="produkt" data-id="'+esc(p.id)+'">Wählen</button>')}).join('')+'</ul>'
    :(gewaehlt?'':'<p class="meta">Nichts gefunden. Ein anderes Wort versuchen oder das Produkt in der <a href="./produktbibliothek.html" target="_blank" rel="noopener noreferrer">Produktbibliothek</a> anlegen.</p>');
  h+='</section>';
  // Datenpool: nur Werte in einer Einheit (die der Menge, sonst die häufigste)
  const alle=Z.poolGruppen(poolEintraege(),P,{text:zd.suche,ohneInstanz:kobe?.id||''});
  const mengeEinheit=/(m²|m³|St|kg|m|t)\s*$/.exec(String(o.menge||''))?.[1]||'';
  const zahl=new Map();for(const g of alle)zahl.set(g.einheit,(zahl.get(g.einheit)||0)+1);
  const einheit=mengeEinheit&&zahl.has(mengeEinheit)?mengeEinheit:[...zahl].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  const gruppen=alle.filter(g=>g.einheit===einheit);zd.gruppen=new Map(gruppen.map(g=>[g.key,g]));
  h+='<section><h3>Kennwert aus dem Datenpool</h3>';
  if(gruppen.length){
    const st=P.statistik(gruppen,zl,R),andere=[...zahl.keys()].filter(e=>e!==einheit);
    h+='<p class="meta">Je '+esc(einheit)+': '+st.n+(st.n===1?' unabhängiger Wert':' unabhängige Werte')+' aus '+st.projekte+(st.projekte===1?' Kostenberechnung':' Kostenberechnungen')+
      (st.n>=2?' · Spanne '+esc(Z.euro(st.minCent))+' bis '+esc(Z.euro(st.maxCent)):'')+(st.n>=3?' · Median '+esc(Z.euro(st.medianCent)):'')+
      (st.stand==='fortgeschrieben'?' · auf '+esc(R.quartalText(zl.kostenstand))+' fortgeschrieben':'')+(andere.length?' · auch in '+esc(andere.join(', ')):'')+'</p>';
    h+='<ul class="pd-zliste">'+gruppen.slice(0,6).map(g=>{const k=Z.kennwertAusPool(g,zl,R,P),u=g.ursprung;
      return eintragZeile('<strong>'+esc(k.kennwert)+'</strong> '+esc(K.kurz(u.bez,70))+'<span class="meta"> KG '+esc(u.kg)+(g.kopie?' · gleich in '+g.projekte.length+' Kostenberechnungen':'')+
        (u.kostenstand?' · Kostenstand '+esc(R.quartalText(u.kostenstand)):'')+'</span>','<button type="button" class="btn" data-z-act="pool" data-key="'+esc(g.key)+'">Als Kennwert</button>')}).join('')+'</ul>';
  }else h+='<p class="meta">'+(String(zd.suche).trim()?'Nichts gefunden. Ein anderes Wort versuchen.':'Ein Suchwort eingeben.')+'</p>';
  h+='</section>';
  // Kostenberechnung des Projekts
  h+='<section><h3>Aus der Kostenberechnung des Projekts</h3>';
  if(!kobe)h+='<p class="meta">Für dieses Projekt gibt es noch keine Kostenberechnung. <a href="./kostenberechnung.html" target="_blank" rel="noopener noreferrer">Kostenberechnungen öffnen</a></p>';
  else{
    const pos=Z.positionen(kobe,R,P,zd.suche,{grenze:8});zd.positionen=new Map(pos.map(x=>[x.id,x]));
    h+=pos.length?'<ul class="pd-zliste">'+pos.map(x=>eintragZeile('<strong>'+esc(Z.mengeText(x.menge,x.einheit,R))+'</strong> KG '+esc(x.kg)+' · '+esc(K.kurz(x.titel,70))+
        '<span class="meta">'+(x.epCent!==null?' '+esc(Z.euroJe(x.epCent,x.einheit)):'')+(x.mengenquelle?' · '+esc(x.mengenquelle):'')+'</span>',
        '<button type="button" class="btn" data-z-act="menge" data-id="'+esc(x.id)+'">Menge</button>'+(x.epCent!==null?'<button type="button" class="btn" data-z-act="ep" data-id="'+esc(x.id)+'">Kennwert</button>':''))).join('')+'</ul>'
      :'<p class="meta">Keine Position mit Menge gefunden'+(String(zd.suche).trim()?' für «'+esc(zd.suche)+'»':'')+'. <a href="./kostenberechnung.html?id='+encodeURIComponent(kobe.id)+'" target="_blank" rel="noopener noreferrer">Kostenberechnung öffnen</a></p>';
  }
  el.innerHTML=h+'</section>';
}
async function zahlAktion(b){
  const f=dialog.querySelector('[data-dlg-fehler]');if(f)f.textContent='';
  try{
    const q=quellen.daten,z=zd.z,i=zd.i,o=z&&K.optionen(z.daten)[i];if(!q||!o)return;
    const zl=zielJetzt(),kobe=kobeDesProjekts(),act=b.dataset.zAct;
    const kw=k=>k&&{kennwert:k.kennwert,kennwert_quelle:k.kennwert_quelle,kennwert_beleg:k.kennwert_beleg};
    let teil=null,kg='';
    if(act==='produkt'){const p=produktVon(b.dataset.id);if(p)teil={produkt:Z.produktText(p,Z.verwendungIm(p.id,projekt.id,q.verwendungen)),produkt_id:p.id}}
    else if(act==='produkt-weg')teil={produkt_id:''};
    else if(act==='preis'){const x=q.preise.find(r=>r.id===b.dataset.id);teil=x&&kw(Z.kennwertAusPreis(x,produktVon(x.produkt_id),zl,R,P))}
    else if(act==='pool')teil=kw(Z.kennwertAusPool(zd.gruppen.get(b.dataset.key),zl,R,P));
    else if(act==='menge'){const m=Z.mengeAusPosition(zd.positionen.get(b.dataset.id),kobe,R);if(m){teil={menge:m.menge,menge_quelle:m.menge_quelle,menge_beleg:m.menge_beleg,kobe_ref:m.kobe_ref};kg=m.kg}}
    else if(act==='ep'){const x=zd.positionen.get(b.dataset.id);teil=kw(Z.kennwertAusPosition(x,kobe,R));kg=x?.kg||''}
    else if(act==='muster'){b.disabled=true;await inMusterliste(z,i);zeigeZahlen();return}
    if(!teil)return;
    nimmZahl(z,i,teil,{kg});
    zeigeZahlen();
  }catch(e){console.error('Projektdokumente · Zahlen',e);if(f)f.textContent=e?.message||'Das hat nicht geklappt.'}
}
// Musterliste des Projekts = Verwendungen in der Produktbibliothek (Code und Stand).
async function neueVerwendung(p,status,notiz){
  const q=quellen.daten;
  for(let versuch=0;versuch<2;versuch++){
    const code=Z.naechsterCode(projekt.id,p.kategorie,q.verwendungen);
    const {data,error}=await sb.from('office_produkt_verwendungen').insert({produkt_id:p.id,projekt_id:projekt.id,code,status,created_by:nutzer.id,notiz:String(notiz||'').slice(0,1000)}).select(VERWENDUNG).single();
    if(!error){q.verwendungen.push(data);return data}
    if(error.code!=='23505')throw new Error('Die Produktbibliothek hat das nicht übernommen: '+(error.message||'Fehler'));
    const r=await sb.from('office_produkt_verwendungen').select(VERWENDUNG).limit(5000);if(!r.error)q.verwendungen=r.data||[];
  }
  throw new Error('Der Code ist inzwischen vergeben; bitte noch einmal.');
}
async function inMusterliste(z,i){
  const o=K.optionen(z.daten)[i],p=o&&produktVon(o.produkt_id);if(!p)return;
  if(Z.verwendungIm(p.id,projekt.id,quellen.daten.verwendungen))return;
  const v=await neueVerwendung(p,'vorgeschlagen','Variante '+o.id+' in '+K.nummer('entscheidungsliste',z.nr));
  nimmZahl(z,i,{produkt:Z.produktText(p,v)});
}

// Romy «Zahlen holen»: wählt unter den Kandidaten; der Vorschlag trägt die Zahlen aus den Daten, nicht aus dem Modell.
async function romyZahlen(z){
  await ladeQuellen();
  const q=quellen.daten;if(!q)throw new Error(quellen.fehler||'Produktbibliothek und Kostenberechnungen sind gerade nicht erreichbar.');
  const opts=K.optionen(z.daten).filter(o=>String(o.text||'').trim());
  if(!opts.length)throw new Error('Bitte zuerst die Varianten beschreiben.');
  const zl=zielJetzt(),kobe=kobeDesProjekts();
  const {liste,karte}=Z.kandidaten(opts,{produkte:q.produkte,preise:q.preise,dokumente:q.dokumente,verwendungen:q.verwendungen,projektId:projekt.id,pool:poolEintraege(),kobe,z:zl,R,P});
  if(!liste.produkte.length&&!liste.pool.length&&!liste.kobe.length)throw new Error('Weder in der Produktbibliothek noch im Datenpool noch in der Kostenberechnung gibt es etwas Passendes.');
  const dok=await sichereDokument('entscheidungsliste');
  await alleSpeichern();
  const antwort=await romyAufruf({action:'zahlen',dokument_id:dok.id,zeile_id:z.id,kostenstand:zl.kostenstand,kandidaten:liste});
  const r=antwort.result||{},neu=[],belege=new Set(),warum=[];
  for(const w of r.optionen||[]){
    const o=opts.find(x=>x.id===w.id);if(!o)continue;
    const teil=Z.aufloesen(w,{karte,instanz:kobe,R});
    if(!Object.keys(teil).length)continue;
    const n=Z.setze({id:o.id},teil),geaendert=Object.keys(n).filter(k=>k!=='id'&&String(n[k]??'')!==String(o[k]??''));
    if(!geaendert.length)continue;
    neu.push(Object.fromEntries([['id',o.id],...geaendert.map(k=>[k,n[k]])]));
    if(teil.produkt_id)belege.add('Produktbibliothek');
    if(/^Datenpool/.test(teil.kennwert_quelle||''))belege.add('Datenpool');
    if(teil.kobe_ref||/^Kostenberechnung/.test(teil.kennwert_quelle||''))belege.add('Kostenberechnung des Projekts');
    if(w.begruendung)warum.push(o.id+': '+w.begruendung);
  }
  ui.romyText={art:'entscheidungsliste',quelle:'Zahlen aus dem Office',text:r.text||'',hinweise:r.hinweise||[],n:neu.length};
  if(!neu.length){meldung('Romy hat keine neuen Zahlen gefunden.'+(r.hinweise?.length?' '+r.hinweise[0]:''),'info');return}
  await vorschlaegeSpeichern('entscheidungsliste',[{art:'aenderung',zeile_id:z.id,daten:{optionen:neu},
    fundstelle:[...belege].join(', ')||'Produktbibliothek, Datenpool, Kostenberechnung',begruendung:warum.join(' · ')}],'Zahlen aus dem Office');
  meldung('Romy schlägt Zahlen für '+neu.length+(neu.length===1?' Variante':' Varianten')+' vor. Übernehmen oder verwerfen.');
}

// Nach der Entscheidung: das gewählte Produkt in der Musterliste des Projekts freigeben.
function gewaehlteVariante(d){return /^\s*([A-H])\s*[:·.)]/.exec(String(d?.entscheidung||''))?.[1]||''}
function freigabeDialog(z){
  void ladeQuellen().then(()=>{
    const q=quellen.daten;if(!q){meldung(quellen.fehler||'Die Produktbibliothek ist gerade nicht erreichbar.','warn');return}
    const opts=K.optionen(z.daten).filter(o=>o.produkt_id&&produktVon(o.produkt_id));
    if(!opts.length){meldung('Keine Variante hat ein Produkt aus der Produktbibliothek.','warn');return}
    const vor=gewaehlteVariante(z.daten);
    dialog.innerHTML='<form class="pd-dlg"><h2>In der Produktbibliothek freigeben · '+esc(K.nummer('entscheidungsliste',z.nr))+'</h2><p class="meta">Entschieden: '+esc(z.daten.entscheidung)+'</p>'+
      '<label class="pd-feld"><span>Gewählte Variante</span><select class="pd-in" name="wahl">'+opts.map(o=>'<option value="'+esc(o.id)+'"'+(o.id===vor?' selected':'')+'>'+esc(o.id+' · '+K.kurz(o.produkt||o.text,70))+'</option>').join('')+'</select></label>'+
      '<label class="pd-wahl-zeile"><input type="checkbox" name="andere" checked> Die Produkte der übrigen Varianten im Projekt als «verworfen» führen</label>'+
      '<p class="meta">Die Musterliste des Projekts ist die Produktbibliothek: das gewählte Produkt steht danach mit seinem Code als «freigegeben» im Projekt.</p>'+
      '<p class="pd-dlg-fehler" data-dlg-fehler></p><div class="pd-dlg-aktionen"><button type="button" class="btn" data-dlg="abbrechen">Abbrechen</button><button type="submit" class="btn btn-primary">Freigeben</button></div></form>';
    const form=dialog.querySelector('form'),f=dialog.querySelector('[data-dlg-fehler]');
    form.querySelector('[data-dlg="abbrechen"]').onclick=()=>dialog.close();
    form.onsubmit=async e=>{
      e.preventDefault();const knopf=form.querySelector('[type="submit"]');knopf.disabled=true;
      try{await freigeben(z,form.wahl.value,form.andere.checked);dialog.close();meldung('In der Produktbibliothek freigegeben.');render()}
      catch(err){f.textContent=err?.message||'Das hat nicht geklappt.';knopf.disabled=false}
    };
    dialog.showModal();
  });
}
async function freigeben(z,wahl,andere){
  const q=quellen.daten;
  for(const o of K.optionen(z.daten).filter(x=>x.produkt_id)){
    const p=produktVon(o.produkt_id);if(!p)continue;
    const v=Z.verwendungIm(p.id,projekt.id,q.verwendungen);
    if(o.id===wahl){
      if(!v){await neueVerwendung(p,'freigegeben','Entschieden in '+K.nummer('entscheidungsliste',z.nr)+' (Variante '+o.id+')');continue}
      if(v.status==='freigegeben')continue;
      const {error}=await sb.from('office_produkt_verwendungen').update({status:'freigegeben'}).eq('id',v.id);if(error)throw error;
      v.status='freigegeben';
    }else if(andere&&v&&['vorgeschlagen','bemustert'].includes(v.status)){
      const {error}=await sb.from('office_produkt_verwendungen').update({status:'verworfen'}).eq('id',v.id);if(error)throw error;
      v.status='verworfen';
    }
  }
}

// ---------- Planner und Entscheidungsliste ----------
async function aufgabenAnlegen(liste){
  const ohne=liste.filter(z=>!z.daten.aufgabe_id);
  if(!ohne.length){meldung('Diese Punkte sind schon Aufgaben im Planner.');return}
  if(projekt.status!=='aktiv'){meldung('Im archivierten Projekt entstehen keine Aufgaben.','warn');return}
  let n=0;
  for(const z of ohne){
    const t=K.aufgabeAusKlaerung(z,{dokumentId:dokumente.klaerungsliste.id,projektId:projekt.id});
    const {data,error}=await sb.from('isabella_tasks').insert(t).select('id,title,due_date,completed_at,work_status').single();
    if(error){meldung('Die Aufgabe zu Nr '+z.nr+' konnte nicht angelegt werden.','warn');break}
    aufgaben.set(data.id,data);setze('klaerungsliste',z,'aufgabe_id',data.id);n++;
  }
  if(n)meldung(n===1?'Aufgabe im Planner angelegt.':n+' Aufgaben im Planner angelegt.');
  ui.auswahl=new Set();render();
}
async function inEntscheidungen(liste){
  let neu=0;
  for(const k of liste){
    if(k.daten.entscheidung_id&&zeilen.entscheidungsliste.some(e=>e.id===k.daten.entscheidung_id))continue;
    const e=await neueZeile('entscheidungsliste',K.entscheidungAusKlaerung(k));
    const patch={...k.daten,entscheidung_id:e.id};
    if(patch.ag!=='ja')patch.ag='ja';
    if(!['gelöst','entfällt','Entscheidungspunkt'].includes(patch.status))patch.status='Entscheidungspunkt';
    k.daten=patch;markiere(k);neu++;
  }
  meldung(neu?(neu===1?'Als Entscheidung übernommen; Frage und Optionen in der Entscheidungsliste ergänzen.':neu+' Entscheidungen übernommen.'):'Diese Punkte stehen schon in der Entscheidungsliste.');
  ui.auswahl=new Set();render();
}
async function vorlageAnlegen(ids){
  const frei=ids.map(id=>zeilen.entscheidungsliste.find(z=>z.id===id)).filter(Boolean);
  if(!frei.length){meldung('Erst eine Entscheidung in der Entscheidungsliste anlegen.','warn');return}
  const schon=frei.find(z=>z.daten.vorlage_id&&zeilen.entscheidungsvorlagen.some(v=>v.id===z.daten.vorlage_id));
  if(schon&&frei.length===1){gehe({projekt:projekt.id,vorlage:schon.daten.vorlage_id});return}
  const v=await neueZeile('entscheidungsvorlagen',{titel:'',punkte:frei.map(z=>z.id),status:'Entwurf',besprechung:'M04',verfasser:meinName()});
  for(const z of frei){z.daten={...z.daten,vorlage_id:v.id};markiere(z)}
  gehe({projekt:projekt.id,vorlage:v.id});
}
function neueVorlageDialog(){
  const liste=zeilen.entscheidungsliste.filter(z=>!['entschieden','entfällt'].includes(z.daten.status));
  if(!liste.length){meldung('Eine Vorlage entsteht aus Entscheidungen. Zuerst in der Entscheidungsliste eine Entscheidung anlegen.','warn');return}
  dialog.innerHTML='<form method="dialog" class="pd-dlg"><h2>Neue Entscheidungsvorlage</h2><p class="meta">Welche Entscheidungen gehören in die Vorlage? Eine reicht; mehrere bekommen eine Übersicht.</p>'+
    '<div class="pd-dlg-liste">'+liste.map(z=>'<label><input type="checkbox" name="e" value="'+z.id+'"'+(liste.length===1?' checked':'')+'> <span class="pd-nr">'+esc(K.nummer('entscheidungsliste',z.nr))+'</span> '+esc(z.daten.thema||'ohne Thema')+
      (z.daten.vorlage_id?' <span class="meta">(schon in einer Vorlage)</span>':'')+'</label>').join('')+'</div>'+
    '<div class="pd-dlg-aktionen"><button type="button" class="btn" data-dlg="abbrechen">Abbrechen</button><button type="submit" class="btn btn-primary">Vorlage anlegen</button></div></form>';
  const form=dialog.querySelector('form');
  form.querySelector('[data-dlg="abbrechen"]').onclick=()=>dialog.close();
  form.onsubmit=e=>{e.preventDefault();const ids=[...form.querySelectorAll('input[name="e"]:checked')].map(x=>x.value);if(!ids.length)return;dialog.close();void sicher(()=>vorlageAnlegen(ids))};
  dialog.showModal();
}

// ---------- Excel ----------
function laden(datei,bytes,typ){
  const blob=new Blob([bytes],{type:typ});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=datei;document.body.append(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
}
const dateiName=t=>t.normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/ß/g,'ss').replace(/[^\w.-]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
async function excel(art){
  await alleSpeichern();
  const blatt=X.listenBlatt(K,art,zeilen[art],{projekt:projektName()});
  laden(dateiName(projekt.number+'_'+K.DOKUMENTE[art].kurz+'_'+heute())+'.xlsx',X.xlsx(blatt),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

// ---------- Entscheidungsvorlage ----------
function vorlageZeile(){return zeilen.entscheidungsvorlagen.find(v=>v.id===ui.vorlage)||null}
function inhaltVon(v,stand=heute()){return K.vorlageInhalt(v,zeilen.entscheidungsliste,{projekt,stand,namen:{verfasser:name(v.created_by)}})}
// Lesefassung aus den Blöcken: Druck, PDF und festgehaltene Stände. Alles Eingegebene wird maskiert.
function htmlAusBloecken(bloecke){
  return bloecke.map(b=>{
    if(b.typ==='titel')return '<h2 class="dv-titel">'+esc(b.text)+'</h2>';
    if(b.typ==='unter')return '<p class="dv-unter">'+esc(b.text)+'</p>';
    if(b.typ==='h1')return '<h3 class="dv-h1'+(b.seitenumbruch?' dv-umbruch':'')+'">'+esc(b.text)+'</h3>';
    if(b.typ==='h2')return '<h4 class="dv-h2">'+esc(b.text)+'</h4>';
    if(b.typ==='klein')return '<p class="dv-klein">'+esc(b.text)+'</p>';
    if(b.typ==='felder')return '<table class="dv-felder">'+b.zeilen.map(([k,v])=>'<tr><th>'+esc(k)+'</th><td>'+esc(v)+'</td></tr>').join('')+'</table>';
    if(b.typ==='tabelle')return '<table class="dv-tabelle"><thead><tr>'+b.kopf.map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr></thead><tbody>'+
      b.zeilen.map(z=>'<tr>'+z.map((t,i)=>'<td'+((b.rechts||[]).includes(i)?' class="num"':'')+'>'+esc(t)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    if(b.typ==='auswahl')return '<ul class="dv-auswahl">'+b.zeilen.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>';
    if(b.typ==='unterschrift')return '<div class="dv-unterschrift"><span>'+esc(b.links)+'</span><span>'+esc(b.rechts)+'</span></div>';
    return '<p>'+esc(b.text).replace(/\n/g,'<br>')+'</p>';
  }).join('');
}
// Bearbeitungsfassung: dieselben Blöcke, die Texte der Entscheidung als Eingabefelder im Dokument.
const TEXTFELDER={anlass:'Anlass ergänzen',frage:'Frage an den Auftraggeber ergänzen',festliegt:'Was danach festliegt ergänzen',begruendung:'Begründung der Empfehlung'};
function bearbeitbar(bloecke){
  return bloecke.map(b=>{
    if(b.typ==='tabelle'&&b.varianten){
      const z=zeilen.entscheidungsliste.find(x=>x.id===b.varianten),opts=z?K.optionen(z.daten):[];
      return '<table class="dv-tabelle"><thead><tr>'+b.kopf.map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr></thead><tbody>'+
        b.zeilen.map((r,j)=>{const marke=produktMarke(opts.find(o=>o.id===b.ids[j]));
          return '<tr>'+r.map((c,k)=>'<td'+((b.rechts||[]).includes(k)?' class="num"':'')+'>'+esc(c)+(k===1&&marke?' '+marke:'')+'</td>').join('')+'</tr>'}).join('')+'</tbody></table>';
    }
    if(b.feld&&b.punkt){
      const z=zeilen.entscheidungsliste.find(x=>x.id===b.punkt);if(!z)return htmlAusBloecken([b]);
      const romy=Array.isArray(z.daten._romy)&&z.daten._romy.includes(b.feld);
      const vs=offene('entscheidungsliste').find(v=>v.art==='aenderung'&&v.zeile_id===z.id&&b.feld in (v.daten||{}));
      const ta=vs?diffHtml(z.daten[b.feld],vs.daten[b.feld],vs):'<textarea class="dv-text'+(romy?' pd-romy':'')+'" id="v-'+z.id+'-'+b.feld+'" data-vfeld="'+b.feld+'" data-z="'+z.id+'" rows="2" placeholder="'+esc(TEXTFELDER[b.feld])+'">'+esc(z.daten[b.feld])+'</textarea>';
      if(b.feld==='begruendung'){
        const opts=K.optionen(z.daten);
        return '<p class="dv-empfehlung">Das Büro empfiehlt Variante <select class="pd-in" id="v-'+z.id+'-empfehlung" data-vfeld="empfehlung" data-z="'+z.id+'"><option value="">offen</option>'+
          opts.map(o=>'<option'+(o.id===z.daten.empfehlung?' selected':'')+'>'+esc(o.id)+'</option>').join('')+'</select></p>'+ta;
      }
      return ta;
    }
    return htmlAusBloecken([b]);
  }).join('');
}
function renderVorlage(){
  const v=vorlageZeile();
  if(!v){root.innerHTML='<div class="pd-wrap">'+kopf({zurueck:[url({projekt:projekt.id}),'‹ Projektstart'],kicker:'Projektstart · '+projektName(),titel:'Entscheidungsvorlage'})+'<div class="pd-banner warn">Diese Vorlage gibt es nicht mehr.</div></div>';return}
  const inh=inhaltVon(v),bl=K.vorlageBloecke(inh);
  const punkte=inh.punkte.map(p=>zeilen.entscheidungsliste.find(z=>z.id===p.id)).filter(Boolean);
  const vorgelegt=v.daten.status==='vorgelegt';
  const aktionen='<button type="button" class="btn" data-act="word">Word</button><button type="button" class="btn" data-act="drucken">PDF</button>'+
    '<button type="button" class="btn btn-primary" data-act="vorlegen">'+(vorgelegt?'Erneut vorlegen':'Als vorgelegt markieren')+'</button>';
  const meta=(vorgelegt?'vorgelegt am '+esc(K.datumLang(v.daten.vorgelegt_am)):'Entwurf')+' · <span data-speicher>'+esc(speicherText())+'</span>';
  const ang=(k,l,ph='')=>'<label class="pd-feld"><span>'+esc(l)+'</span><input class="pd-in" id="m-'+k+'" data-vmeta="'+k+'" value="'+esc(k==='besprechung_am'?K.datumLang(v.daten[k]):v.daten[k])+'" placeholder="'+esc(ph)+'" autocomplete="off"></label>';
  const freie=zeilen.entscheidungsliste.filter(z=>!(v.daten.punkte||[]).includes(z.id)&&!['entschieden','entfällt'].includes(z.daten.status));
  if(punkte.some(z=>K.optionen(z.daten).some(o=>o.produkt_id))&&!quellen.daten&&!quellen.laedt)void ladeQuellen().then(()=>{if(quellen.daten&&ui.ansicht==='vorlage')spaeterRendern()});
  const zahlen=punkte.flatMap(z=>K.optionen(z.daten).filter(o=>o.betrag||o.kennwert||o.menge||o.produkt||o.quelle).map(o=>{
    const b=K.betragVon(o);
    const zeilenQ=[o.produkt&&'Produkt: '+o.produkt,o.kennwert&&'Kennwert '+o.kennwert+(o.kennwert_quelle?' · '+o.kennwert_quelle:''),
      o.menge&&'Menge '+o.menge+(o.menge_quelle?' · '+o.menge_quelle:''),o.quelle&&'Von Hand: '+o.quelle].filter(Boolean);
    return '<li><strong>'+esc(K.nummer('entscheidungsliste',z.nr)+' · '+o.id)+'</strong> '+(b.cent!==null?esc(K.euro(b.cent))+(b.berechnet?' (Kennwert × Menge)':''):'ohne Betrag')+
      (o.produkt_id?' '+produktMarke(o):'')+zeilenQ.map(x=>'<span>'+esc(x)+'</span>').join('')+(zeilenQ.length?'':'<span>Quelle fehlt</span>')+'</li>';
  }));
  const vsVarianten=offene('entscheidungsliste').filter(v=>v.art==='aenderung'&&Array.isArray(v.daten?.optionen)&&punkte.some(z=>z.id===v.zeile_id));
  const staende=ui.staende===null?'<p class="meta">wird geladen …</p>':ui.staende.length?'<ul class="pd-staende">'+ui.staende.map(s=>'<li><button type="button" class="pd-link" data-act="stand" data-id="'+s.id+'">'+esc(s.bezeichnung)+'</button><span>'+esc([K.datumLang(String(s.created_at).slice(0,10)),name(s.created_by)].filter(Boolean).join(' · '))+'</span></li>').join('')+'</ul>'
    :'<p class="meta">Noch kein Stand. Beim Vorlegen wird der Stand festgehalten und bleibt unverändert.</p>';
  const fokus=vorZeichnen();
  const html='<div class="pd-wrap pd-vorlage-wrap'+(ui.detail?' mit-detail':'')+'">'+kopf({zurueck:[url({projekt:projekt.id,liste:'entscheidungsliste'}),'‹ Entscheidungsliste'],
    kicker:'Projektstart · '+projektName()+' · Vorlage '+inh.nr,titel:'Entscheidungsvorlage '+inh.nr,meta,aktionen})+
    '<div class="pd-vorlage"><article class="pd-papier" aria-label="Entscheidungsvorlage">'+(punkte.length?bearbeitbar(bl):'<p class="meta">Diese Vorlage hat noch keine Entscheidung. Rechts eine hinzufügen.</p>')+'</article>'+
    '<aside class="pd-seite">'+
    '<section class="card"><h2>Angaben der Vorlage</h2>'+ang('titel','Titel',inh.titel)+ang('auftraggeber','Auftraggeber')+ang('besprechung','Besprechung','M04')+ang('besprechung_am','Datum der Besprechung','TT.MM.JJJJ')+
      ang('verfasser','Verfasser')+ang('freigabe','Freigabe Büroleitung','Name, Datum')+'</section>'+
    '<section class="card"><h2>Entscheidungen in dieser Vorlage</h2><ul class="pd-punkte">'+punkte.map(z=>'<li><span class="pd-nr">'+esc(K.nummer('entscheidungsliste',z.nr))+'</span> '+esc(z.daten.thema||'ohne Thema')+
      ' · '+esc(z.daten.status||'')+'<span class="pd-punkt-aktionen"><button type="button" class="pd-link" data-act="punkt-details" data-z="'+z.id+'">Varianten und Details</button>'+
      (punkte.length>1?'<button type="button" class="pd-link" data-act="punkt-weg" data-z="'+z.id+'">entfernen</button>':'')+'</span></li>').join('')+'</ul>'+
      (freie.length?'<label class="pd-feld"><span>Entscheidung hinzufügen</span><select class="pd-in" data-act="punkt-neu"><option value="">wählen …</option>'+freie.map(z=>'<option value="'+z.id+'">'+esc(K.nummer('entscheidungsliste',z.nr)+' · '+(z.daten.thema||'ohne Thema'))+'</option>').join('')+'</select></label>':'')+'</section>'+
    '<section class="card"><h2>Zahlen und Quellen</h2>'+(zahlen.length?'<ul class="pd-quellen">'+zahlen.join('')+'</ul>':'<p class="meta">Noch keine Beträge. Unter «Varianten und Details» je Variante «Zahlen aus dem Office» oder Kennwert, Menge und Betrag von Hand.</p>')+
      vsVarianten.map(v=>{const z=zeileVon(v.zeile_id);return '<div class="pd-vs-karte"><p><strong>Romy schlägt für '+esc(K.nummer('entscheidungsliste',z?.nr))+' vor:</strong> '+esc(K.aenderungText('entscheidungsliste',z?.daten,v.daten))+'</p>'+
        (v.begruendung?'<p class="meta">'+esc(v.begruendung)+'</p>':'')+'<p class="meta">Fundstelle: '+esc(v.fundstelle)+'</p>'+vsKnoepfe(v)+'</div>'}).join('')+
      (romy.bereit&&Z&&R&&P?punkte.filter(z=>K.optionen(z.daten).some(o=>String(o.text||'').trim())).map(z=>'<button type="button" class="btn btn-romy" data-act="romy-zahlen" data-z="'+z.id+'">Romy: Zahlen für '+esc(K.nummer('entscheidungsliste',z.nr))+' holen</button>').join(''):'')+
      '<p class="meta">Im Dokument steht je Zahl nur der Beleg; die Fundstellen mit Projekt und Zeile bleiben hier.</p></section>'+
    '<section class="card"><h2>Wenn der Auftraggeber entschieden hat</h2><p class="meta">In der Entscheidungsliste «Entscheidung eintragen»: mit Datum und Entscheider, danach die Bestätigung in Textform. Die Vorlage zeigt dann die Entscheidung statt der Ankreuzfelder.</p></section>'+
    (romy.bereit&&punkte.length?'<section class="card"><h2>Romy</h2><p class="meta">Romy formuliert einen Abschnitt neu: grün eingefügt, rot gestrichen. Nichts ändert sich ohne «Übernehmen».</p>'+
      '<label class="pd-feld"><span>Abschnitt</span><select class="pd-in" id="r-abschnitt">'+punkte.flatMap(z=>[['anlass','Anlass'],['frage','Frage an den Auftraggeber'],['begruendung','Empfehlung des Büros'],['festliegt','Was danach festliegt']]
        .map(([f,l])=>'<option value="'+z.id+'|'+f+'">'+esc((punkte.length>1?K.nummer('entscheidungsliste',z.nr)+' · ':'')+l)+'</option>')).join('')+'</select></label>'+
      '<label class="pd-feld"><span>Auftrag an Romy</span><input class="pd-in" id="r-auftrag" placeholder="z. B. kürzer und für den Bauherrn verständlich" autocomplete="off"></label>'+
      '<button type="button" class="btn btn-romy" data-act="romy-abschnitt">Romy fragen</button>'+
      (offene('entscheidungsliste').filter(v=>punkte.some(z=>z.id===v.zeile_id)).length?'<p class="meta pd-romy-hinweis">'+offene('entscheidungsliste').filter(v=>punkte.some(z=>z.id===v.zeile_id)).length+' Vorschlag offen</p>':'')+'</section>':'')+
    '<section class="card"><h2>Stände</h2>'+staende+'</section>'+
    '</aside></div><div class="pd-druck" aria-hidden="true">'+htmlAusBloecken(bl)+'</div>'+(ui.detail?detailPanel('entscheidungsliste'):'')+'</div>';
  zeichne(html,fokus);
  for(const t of root.querySelectorAll('textarea.dv-text'))wachse(t);
}
function wachse(t){t.style.height='auto';t.style.height=Math.max(t.scrollHeight,44)+'px'}
async function ladeStaende(vid){
  const {data,error}=await sb.from('office_projektdokument_staende').select('id,bezeichnung,inhalt,created_by,created_at').eq('zeile_id',vid).order('created_at',{ascending:false});
  ui.staende=error?[]:(data||[]);
  if(ui.ansicht==='mappe'&&ui.vorlage===vid){if(!root.querySelector(':focus'))renderMappe();else{const el=root.querySelector('[data-staende]');if(el)el.innerHTML='<h2>Stände</h2>'+(ui.staende.length?'<ul class="pd-staende">'+ui.staende.map(s=>'<li><button type="button" class="pd-link" data-act="stand" data-id="'+s.id+'">'+esc(s.bezeichnung)+'</button></li>').join('')+'</ul>':'<p class="meta">Noch kein Stand.</p>')}return}
  if(ui.ansicht==='vorlage'&&ui.vorlage===vid&&!root.querySelector(':focus'))renderVorlage();
  else if(ui.ansicht==='vorlage'){const el=root.querySelector('.pd-seite section:last-child');if(el)el.innerHTML='<h2>Stände</h2>'+(ui.staende.length?'<ul class="pd-staende">'+ui.staende.map(s=>'<li><button type="button" class="pd-link" data-act="stand" data-id="'+s.id+'">'+esc(s.bezeichnung)+'</button><span>'+esc(K.datumLang(String(s.created_at).slice(0,10)))+'</span></li>').join('')+'</ul>':'<p class="meta">Noch kein Stand.</p>')}
}
async function word(v){
  await alleSpeichern();
  const inh=inhaltVon(v);
  const bytes=X.docx({titel:'Entscheidungsvorlage '+inh.nr+' · '+inh.titel,bloecke:K.vorlageBloecke(inh),fusszeile:projektName()+' · Entscheidungsvorlage '+inh.nr+' · Stand '+K.datumLang(inh.stand)});
  laden(dateiName(projekt.number+'_Entscheidungsvorlage_'+inh.nr+'_'+heute())+'.docx',bytes,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
function vorlegenDialog(v){
  const inh=inhaltVon(v),mappe=istMappe(v);
  dialog.innerHTML='<form method="dialog" class="pd-dlg"><h2>'+(mappe?esc(v.daten.titel||'Mustermappe')+' vorlegen':'Vorlage '+esc(inh.nr)+' vorlegen')+'</h2>'+
    (mappe?'<p>Der Stand der Mappe wird festgehalten und bleibt unverändert. Ihre Positionen stehen danach in der Entscheidungsliste als «vorgelegt», mit diesem Datum. Entschieden wird im Bemusterungstermin.</p>'
      :'<p>Der Stand wird festgehalten und bleibt unverändert. Die Entscheidungen der Vorlage stehen danach in der Entscheidungsliste als «vorgelegt», mit diesem Datum.</p>')+
    '<label class="pd-feld"><span>vorgelegt am</span><input class="pd-in" name="am" value="'+esc(K.datumLang(heute()))+'" required></label>'+
    '<p class="pd-dlg-fehler" data-dlg-fehler></p><div class="pd-dlg-aktionen"><button type="button" class="btn" data-dlg="abbrechen">Abbrechen</button><button type="submit" class="btn btn-primary">Vorlegen und Stand festhalten</button></div></form>';
  const form=dialog.querySelector('form');
  form.querySelector('[data-dlg="abbrechen"]').onclick=()=>dialog.close();
  form.onsubmit=e=>{
    e.preventDefault();const am=K.leseDatum(form.am.value);
    if(!am){dialog.querySelector('[data-dlg-fehler]').textContent='Datum bitte als TT.MM.JJJJ eingeben.';return}
    dialog.close();void sicher(()=>vorlegen(v,am));
  };
  dialog.showModal();
}
async function vorlegen(v,am){
  for(const id of v.daten.punkte||[]){
    const z=zeilen.entscheidungsliste.find(x=>x.id===id);if(!z)continue;
    // Erneut vorgelegt: das Datum der letzten Vorlage gilt; Entschiedenes und Entfallenes bleibt.
    if(['vorbereitet','vertagt','vorgelegt',''].includes(z.daten.status||'')){z.daten={...z.daten,status:'vorgelegt',vorgelegt_am:am};markiere(z)}
  }
  v.daten={...v.daten,status:'vorgelegt',vorgelegt_am:am};markiere(v);
  await alleSpeichern();
  if(speicher.fehler)throw new Error('Erst speichern, dann vorlegen: '+speicher.fehler);
  // Die Mappe hält ihren Inhalt mit dem übernommenen Stand der Bibliothek und den Pfaden der Fotos fest; angezeigt wird
  // ein Stand immer aus diesem Inhalt (maskiert), nie aus dem gespeicherten HTML.
  const mappe=istMappe(v),inh=mappe?mappeJetzt(v,am):inhaltVon(v,am);
  const {error}=await sb.from('office_projektdokument_staende').insert({dokument_id:dokumente.entscheidungsvorlagen.id,zeile_id:v.id,
    bezeichnung:(mappe?inh.titel:'Vorlage '+inh.nr)+' · vorgelegt am '+K.datumLang(am),inhalt:inh,html:mappe?M.mappeHtml(inh,{modus:'druck'}):htmlAusBloecken(K.vorlageBloecke(inh))});
  if(error)throw error;
  meldung('Vorgelegt; der Stand ist festgehalten.');
  ui.staende=null;render();void ladeStaende(v.id);
}
function standDialog(id){
  const s=(ui.staende||[]).find(x=>x.id===id);if(!s)return;
  if(M&&s.inhalt?.schema===M.SCHEMA){void sicher(()=>mappeStandZeigen(s));return}
  dialog.innerHTML='<div class="pd-dlg pd-dlg-breit"><div class="pd-detail-kopf"><h2>'+esc(s.bezeichnung)+'</h2><button type="button" class="pd-x" data-dlg="zu" aria-label="Schließen">×</button></div>'+
    '<p class="meta">Festgehalten am '+esc(K.datumLang(String(s.created_at).slice(0,10)))+' von '+esc(name(s.created_by)||'jemandem')+'; dieser Stand ändert sich nicht.</p>'+
    '<div class="pd-papier pd-papier-stand">'+htmlAusBloecken(K.vorlageBloecke(s.inhalt||{punkte:[],projekt:{}}))+'</div></div>';
  dialog.querySelector('[data-dlg="zu"]').onclick=()=>dialog.close();
  dialog.showModal();
}

// ---------- Mustermappe (L3.MAP.1, 24.11.2026) ----------
// Eine Entscheidungsvorlage in Seitenform (mustermappe-kern.js): jede Position ist eine Entscheidung der
// Entscheidungsliste, ihre Kandidaten sind die Varianten mit Produkt aus der Produktbibliothek. Die Seite zeigt den
// Stand der Bibliothek, der beim «Übernehmen» galt; ein neuerer steht als Hinweis daneben. Entschieden wird im
// Bemusterungstermin (Gari, 24.11.2026), eingetragen in der Entscheidungsliste; die Seiten tragen keine Unterschrift.
const M=window.TBA_MUSTERMAPPE;
const PRODUKT_VOLL='id,name,hersteller,serie,familie,kategorie,beschreibung,merkmale,fehlend,status,updated_at';
// pdf.js in der «legacy»-Fassung: läuft auch in etwas älteren Browsern (Safari, iPad) und im Chromium des CI.
const PDFJS='https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/legacy/build/';
const mm={offen:'',seite:null,lesen:false,produkte:new Map(),fotos:new Map(),urls:new Map(),geladen:'',laedt:null,pdfjs:null};
const istMappe=v=>!!M&&M.istMappe(v);
const mappen=()=>zeilen.entscheidungsvorlagen.filter(istMappe);
function mappePunkte(v){return (v?.daten?.punkte||[]).map(id=>zeilen.entscheidungsliste.find(z=>z.id===id)).filter(Boolean)}
function bildUrl(pfad,bucket=M.BUCKET_PRODUKTE){const x=mm.urls.get(bucket+'|'+pfad);return x&&x.bis>Date.now()?x.url:''}
// Signierte Adressen für eine Stunde; abgelaufene werden beim nächsten Zeichnen neu geholt.
async function signiere(bucket,pfade){
  const jetzt=Date.now(),offen=[...new Set((pfade||[]).filter(Boolean))].filter(p=>{const x=mm.urls.get(bucket+'|'+p);return !x||x.bis<jetzt+120000});
  if(!offen.length||!sb.storage)return;
  const {data,error}=await sb.storage.from(bucket).createSignedUrls(offen,3600);
  if(error||!Array.isArray(data))return;
  for(const x of data)if(x?.signedUrl&&x.path)mm.urls.set(bucket+'|'+x.path,{url:x.signedUrl,bis:jetzt+3500000});
}
function mappeJetzt(v,stand=heute()){
  const inh=M.mappeInhalt(v,zeilen.entscheidungsliste,{projekt,stand,nummer:n=>K.nummer('entscheidungsliste',n)});
  return M.mitStandardFotos(inh,id=>(mm.fotos.get(id)||[]).map(d=>({id:d.id,pfad:d.storage_path})));
}
async function mappeLaden(v,{neu=false}={}){
  const ids=[...new Set(mappePunkte(v).flatMap(z=>K.optionen(z.daten).map(o=>o.produkt_id)).filter(Boolean))];
  const fehlen=neu?ids:ids.filter(id=>!mm.produkte.has(id));
  if(fehlen.length){
    const [pr,dk]=await Promise.all([
      sb.from('office_produkte').select(PRODUKT_VOLL).in('id',fehlen),
      sb.from('office_produkt_dokumente').select('id,produkt_id,art,name,storage_path,created_at').in('produkt_id',fehlen).eq('art','bild').order('created_at')]);
    if(pr.error)throw pr.error;
    for(const p of pr.data||[])mm.produkte.set(p.id,p);
    for(const id of fehlen)mm.fotos.set(id,(dk.data||[]).filter(d=>d.produkt_id===id));
  }
  const pf=M.allePfade(mappeJetzt(v));
  const alle=[...pf.produkt,...ids.flatMap(id=>(mm.fotos.get(id)||[]).map(d=>d.storage_path))];
  await Promise.all([signiere(M.BUCKET_PRODUKTE,alle),signiere(M.BUCKET,pf.mappe)]);
}
function mappeNachladen(v){
  if(mm.geladen===v.id||mm.laedt)return;
  mm.laedt=mappeLaden(v,{neu:true}).catch(e=>{console.warn('Mustermappe · Bibliothek',e);meldung('Die Produktbibliothek ist gerade nicht erreichbar; die Seiten zeigen den übernommenen Stand.','warn')})
    .finally(()=>{mm.laedt=null;mm.geladen=v.id;if(ui.ansicht==='mappe')spaeterRendern()});
}
function seitenSetzen(v,liste){v.daten={...v.daten,seiten:liste};markiere(v)}
function seitePatch(v,id,patch){seitenSetzen(v,M.seitenVon(v.daten).map(x=>x.id===id?{...x,...patch}:x))}
function mmWachse(t){t.style.height='auto';t.style.height=t.scrollHeight+'px'}
function mappeSeite(v){const l=M.seitenVon(v.daten);return l.find(x=>x.id===mm.seite)||l[0]||null}

function renderMappe(){
  const v=vorlageZeile();
  if(!v||!istMappe(v)){renderVorlage();return}
  mappeNachladen(v);
  if(!quellen.daten&&!quellen.laedt)void ladeQuellen().then(()=>{if(ui.ansicht==='mappe')spaeterRendern()});
  const inh=mappeJetzt(v),seiten=inh.seiten;
  if(!seiten.some(x=>x.id===mm.seite))mm.seite=seiten[0]?.id||null;
  const i=Math.max(0,seiten.findIndex(x=>x.id===mm.seite)),seite=seiten[i]||null;
  const vorgelegt=v.daten.status==='vorgelegt';
  const aktionen='<button type="button" class="btn" data-act="mm-pdf">PDF</button>'+
    '<button type="button" class="btn btn-primary" data-act="vorlegen">'+(vorgelegt?'Erneut vorlegen':'Als vorgelegt markieren')+'</button>';
  const meta=esc('Vorlage zur Bemusterung'+(inh.termin?' am '+K.datumLang(inh.termin):''))+' · '+(vorgelegt?'vorgelegt am '+esc(K.datumLang(v.daten.vorgelegt_am)):'Entwurf')+
    ' · <span data-speicher>'+esc(speicherText())+'</span>';
  const nav='<nav class="card mm-nav" aria-label="Seiten der Mappe"><h2>Seiten</h2><ol class="mm-seitenliste">'+seiten.map((x,j)=>{
      const p=inh.punkte.find(q=>q.id===x.punkt),o=p?.optionen.find(q=>q.id===x.option),an=x.id===seite?.id;
      return '<li class="'+(an?'active':'')+'"><button type="button" data-act="mm-seite" data-id="'+esc(x.id)+'"'+(an?' aria-current="page"':'')+'><span class="mm-nr">'+(j+1)+'</span><span>'+esc(M.seiteName(x,p,o))+'</span></button></li>';
    }).join('')+'</ol>'+
    '<label class="pd-feld"><span>Seite hinzufügen</span><select class="pd-in" data-act="mm-neue-seite"><option value="">wählen …</option>'+
      '<option value="frei">Freie Seite · Bild oder PDF</option><option value="uebersicht">Übersicht</option><option value="deckblatt">Deckblatt</option>'+
      inh.punkte.map(p=>'<option value="vergleich|'+esc(p.id)+'">'+esc((p.code||p.nr)+' · Vergleich')+'</option>'+
        p.optionen.map(o=>'<option value="material|'+esc(p.id)+'|'+esc(o.id)+'">'+esc((p.code||p.nr)+' · '+o.id+' '+K.kurz(o.name,28)+' · Material')+'</option>').join('')).join('')+
    '</select></label><button type="button" class="btn" data-act="mm-position-neu">Position hinzufügen</button></nav>';
  const mitte='<section class="mm-mitte" aria-label="Seite '+(i+1)+' von '+seiten.length+'"><div class="mm-werkzeug"><span class="meta">Seite '+(i+1)+' von '+seiten.length+' · A3 quer · gestrichelt: Text der Mappe</span>'+
    '<button type="button" class="btn" data-act="mm-zoom" aria-pressed="'+(mm.lesen?'true':'false')+'">'+(mm.lesen?'Ganze Seite':'Lesegröße')+'</button></div>'+
    '<div class="mm-buehne'+(mm.lesen?' lesen':'')+'">'+(seite?M.seiteHtml(seite,inh,{nr:i+1,gesamt:seiten.length,modus:'bearbeiten',bild:bildUrl}):'<p class="meta">Die Mappe hat keine Seite.</p>')+'</div>'+
    mappeHinweise(v,seite)+'</section>';
  const fokus=vorZeichnen();
  const html='<div class="pd-wrap pd-mappe-wrap'+(ui.detail?' mit-detail':'')+'">'+kopf({zurueck:[url({projekt:projekt.id}),'‹ Projektstart'],
    kicker:'Projektstart · '+projektName()+' · Mustermappe',titel:inh.titel,meta,aktionen})+
    '<div class="mm">'+nav+mitte+'<aside class="mm-rechts" aria-label="Einstellungen">'+mappeSeitenleiste(v,inh,seite)+'</aside></div>'+
    '<div class="pd-druck mm-druck" aria-hidden="true">'+M.mappeHtml(inh,{modus:'druck',bild:bildUrl})+'</div>'+(ui.detail?detailPanel('entscheidungsliste'):'')+'</div>';
  zeichne(html,fokus);
  for(const t of root.querySelectorAll('textarea.mm-text'))mmWachse(t);
}
// Was nur das Büro sieht: neuer Stand in der Bibliothek, Datenblatt, was im Datenblatt fehlt.
function mappeHinweise(v,seite){
  const z=seite&&['vergleich','material'].includes(seite.typ)?zeilen.entscheidungsliste.find(x=>x.id===seite.punkt):null;
  if(!z)return '';
  const opts=K.optionen(z.daten).filter(o=>o.produkt_id&&(seite.typ!=='material'||o.id===seite.option));
  const li=[];
  for(const o of opts){
    const p=mm.produkte.get(o.produkt_id);
    if(M.veraltet(o,p))li.push('<li class="mm-neu"><span><strong>'+esc(o.id)+': neuer Stand in der Bibliothek.</strong> Die Seite zeigt noch den Stand vom '+esc(K.datumLang(String(o.muster_produkt?.stand||'').slice(0,10)))+'.</span><span class="mm-knoepfe"><button type="button" class="btn btn-primary" data-act="mm-uebernehmen" data-z="'+z.id+'" data-o="'+esc(o.id)+'">Übernehmen</button><a class="btn" href="./produktbibliothek.html?id='+encodeURIComponent(o.produkt_id)+'" target="_blank" rel="noopener noreferrer">Ansehen</a></span></li>');
    const fehlt=o.muster_produkt?.fehlend||[];
    if(fehlt.length)li.push('<li>'+esc(o.id)+': nicht im Datenblatt: '+esc(fehlt.join(' · '))+'</li>');
    if(!mm.produkte.has(o.produkt_id)&&mm.geladen===v.id)li.push('<li>'+esc(o.id)+': nicht mehr in der Produktbibliothek.</li>');
  }
  return li.length?'<div class="mm-intern"><strong>Nur im Büro sichtbar</strong><ul>'+li.join('')+'</ul></div>':'';
}
function mmFeld(z,k,l,{platz='',lang=false}={}){
  const w=z.daten.muster?.[k]||'',id='mf-'+z.id+'-'+k;
  return '<label class="pd-feld"><span>'+esc(l)+'</span>'+(lang?'<textarea class="pd-in" id="'+id+'" data-mmfeld="'+k+'" data-z="'+z.id+'" rows="2" placeholder="'+esc(platz)+'">'+esc(w)+'</textarea>'
    :'<input class="pd-in" id="'+id+'" data-mmfeld="'+k+'" data-z="'+z.id+'" value="'+esc(w)+'" placeholder="'+esc(platz)+'" autocomplete="off">')+'</label>';
}
function kandidatenWahl(v,z){
  const q=quellen.daten;
  if(!q)return '<p class="meta">'+esc(quellen.fehler||'Produktbibliothek wird geladen …')+'</p>';
  const schon=new Set(K.optionen(z.daten).map(o=>o.produkt_id).filter(Boolean));
  const frei=q.produkte.filter(p=>!schon.has(p.id));
  const imProjekt=frei.filter(p=>Z.verwendungIm(p.id,projekt.id,q.verwendungen));
  const kat=M.KATEGORIEN[v.daten.themenpaket]||[];
  const passend=frei.filter(p=>!imProjekt.includes(p)&&kat.includes(p.kategorie)),rest=frei.filter(p=>!imProjekt.includes(p)&&!passend.includes(p));
  const opt=p=>'<option value="'+esc(p.id)+'">'+esc(K.kurz([p.name,p.hersteller].filter(Boolean).join(' · '),70))+'</option>';
  const gruppe=(l,t)=>l.length?'<optgroup label="'+esc(t)+'">'+l.map(opt).join('')+'</optgroup>':'';
  return '<label class="pd-feld"><span>Kandidat aus der Bibliothek</span><select class="pd-in" data-act="mm-kandidat" data-z="'+z.id+'"><option value="">wählen …</option>'+
    gruppe(imProjekt,'Musterliste des Projekts')+gruppe(passend,'Produktbibliothek · '+(v.daten.themenpaket||''))+gruppe(rest,'weitere')+'</select></label>';
}
function fotoWahl(o){
  const liste=mm.fotos.get(o.produkt_id)||[];
  if(!liste.length)return '<p class="meta">'+esc(o.id)+': kein Foto in der Bibliothek.</p>';
  const gew=Array.isArray(o.muster_fotos)?o.muster_fotos:[];
  return '<div class="pd-feld"><span>Fotos '+esc(o.id)+(gew.length?'':' · automatisch das erste')+'</span><div class="mm-thumbs">'+liste.slice(0,8).map(d=>{
    const n=gew.findIndex(f=>f.id===d.id),url=bildUrl(d.storage_path);
    return '<button type="button" class="mm-thumb" data-act="mm-foto" data-z="'+esc(o._z)+'" data-o="'+esc(o.id)+'" data-d="'+esc(d.id)+'" aria-pressed="'+(n>=0?'true':'false')+'" aria-label="'+esc('Foto '+(d.name||'')+(n>=0?', Nummer '+(n+1):''))+'">'+
      (url?'<img src="'+esc(url)+'" alt="">':'')+(n>=0?'<b>'+(n+1)+'</b>':'')+'</button>';
  }).join('')+'</div></div>';
}
function mappeSeitenleiste(v,inh,seite){
  const z=seite&&['vergleich','material'].includes(seite.typ)?zeilen.entscheidungsliste.find(x=>x.id===seite.punkt):null;
  const opts=z?K.optionen(z.daten):[];
  const zeige=(k,l)=>'<label><input type="checkbox" data-act="mm-zeige" data-k="'+k+'"'+(seite?.zeige?.[k]===false?'':' checked')+'> '+esc(l)+'</label>';
  let karte='<section class="card"><h2>'+esc(seite?M.SEITEN[seite.typ]:'Seite')+'</h2>';
  if(seite?.typ==='vergleich'){
    const auf=Array.isArray(seite.optionen)?seite.optionen:opts.map(o=>o.id);
    karte+=(opts.length?'<p class="meta">Kandidaten auf der Seite, höchstens drei</p><div class="mm-wahl">'+opts.map(o=>'<label><input type="checkbox" data-act="mm-seite-option" data-o="'+esc(o.id)+'"'+(auf.includes(o.id)?' checked':'')+'> '+esc(o.id+' · '+K.kurz(o.text||o.produkt,48))+'</label>').join('')+'</div>':'')+
      '<p class="meta">Auf der Seite zeigen</p><div class="mm-wahl">'+zeige('kennwerte','Kennwerte')+zeige('kosten','Kosten')+zeige('empfehlung','Empfehlung')+'</div>'+
      opts.filter(o=>o.produkt_id&&auf.includes(o.id)).map(o=>fotoWahl({...o,_z:z.id})).join('');
  }else if(seite?.typ==='material'){
    karte+='<label class="pd-feld"><span>Variante</span><select class="pd-in" data-act="mm-material-option">'+opts.map(o=>'<option value="'+esc(o.id)+'"'+(o.id===seite.option?' selected':'')+'>'+esc(o.id+' · '+K.kurz(o.text||o.produkt,48))+'</option>').join('')+'</select></label>'+
      '<p class="meta">Auf der Seite zeigen</p><div class="mm-wahl">'+zeige('kennwerte','Kennwerte')+zeige('kosten','Kosten')+zeige('empfehlung','Empfehlung')+'</div>'+
      opts.filter(o=>o.produkt_id&&o.id===seite.option).map(o=>fotoWahl({...o,_z:z.id})).join('');
  }else if(seite?.typ==='frei'){
    karte+='<p class="meta">Ein Bild oder ein PDF, etwa ein Plan aus Archicad oder eine Seite aus InDesign; vom PDF kommt eine Seite als Bild auf die Seite.</p>'+
      '<label class="pd-feld"><span>Seite im PDF</span><input class="pd-in" type="number" min="1" max="2000" data-act="mm-pdf-seite" value="'+esc(seite.pdf_seite||1)+'"></label>'+
      '<label class="btn">'+(seite.bild?.pfad?'Anderes Bild oder PDF':'Bild oder PDF hochladen')+'<input type="file" class="pb-datei" hidden accept="image/jpeg,image/png,image/webp,application/pdf" data-act="mm-datei"></label>'+
      (seite.bild?.pfad?' <button type="button" class="btn" data-act="mm-bild-weg">Bild entfernen</button>':'');
  }else karte+='<p class="meta">'+(seite?.typ==='uebersicht'?'Die Übersicht entsteht aus den Positionen; bei Strategie A und B getrennt.':'Titel, Projekt und Termin kommen aus den Angaben der Mappe.')+'</p>';
  karte+='<div class="mm-knoepfe"><button type="button" class="btn" data-act="mm-hoch" aria-label="Seite nach oben">↑</button><button type="button" class="btn" data-act="mm-runter" aria-label="Seite nach unten">↓</button>'+
    '<button type="button" class="btn" data-act="mm-seite-weg">Seite entfernen</button></div></section>';
  let position='';
  if(z){
    const m=z.daten.muster||{};
    position='<section class="card"><h2>Position '+esc(m.code||K.nummer('entscheidungsliste',z.nr))+'</h2>'+
      '<div class="pd-zwei">'+mmFeld(z,'code','Code im Plan',{platz:'B2'})+mmFeld(z,'bezeichnung','Bezeichnung',{platz:'Holz – Eiche'})+'</div>'+
      '<label class="pd-feld"><span>Strategie</span><select class="pd-in" id="mf-'+z.id+'-strategie" data-mmfeld="strategie" data-z="'+z.id+'">'+M.STRATEGIEN.map(([k,l])=>'<option value="'+k+'"'+(k===(m.strategie||'')?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>'+
      mmFeld(z,'zonen','Zonen',{platz:'z. B. Ausstellung 537 m² · Kabinett 45'})+mmFeld(z,'flaeche','Fläche',{platz:'z. B. 630 m²'})+
      mmFeld(z,'anforderungen','Anforderungen',{platz:'z. B. R9 · Aufbau ≤ 15 mm',lang:true})+mmFeld(z,'hinweise','Zu beachten',{platz:'für den Bauherrn',lang:true})+
      '<div class="pd-zwei">'+mmFeld(z,'kosten','Kostenrahmen',{platz:'z. B. 60–215 €/m²'})+mmFeld(z,'kosten_beleg','Beleg',{platz:'z. B. Richtwerte'})+'</div>'+
      '<label class="pd-feld"><span>Empfehlung des Büros</span><select class="pd-in" id="mf-'+z.id+'-empfehlung" data-mmfeld="empfehlung" data-z="'+z.id+'"><option value="">offen</option>'+opts.map(o=>'<option'+(o.id===z.daten.empfehlung?' selected':'')+'>'+esc(o.id)+'</option>').join('')+'</select></label>'+
      '<h3>Kandidaten</h3><ul class="mm-kandliste">'+opts.map(o=>{
        const p=mm.produkte.get(o.produkt_id);
        return '<li><span><strong>'+esc(o.id)+'</strong> '+esc(K.kurz(o.text||o.produkt,60))+' '+produktMarke(o)+'</span>'+(M.veraltet(o,p)?'<span class="chip chip-att">neuer Stand in der Bibliothek</span>':'')+
          '<span class="mm-knoepfe"><button type="button" class="pd-link" data-act="mm-material" data-z="'+z.id+'" data-o="'+esc(o.id)+'">Materialseite</button>'+
          '<button type="button" class="pd-link" data-act="mm-kandidat-weg" data-z="'+z.id+'" data-o="'+esc(o.id)+'">entfernen</button></span></li>';
      }).join('')+'</ul>'+kandidatenWahl(v,z)+
      '<button type="button" class="pd-link" data-act="punkt-details" data-z="'+z.id+'">Varianten und Details in der Entscheidungsliste</button></section>';
  }
  const punkte=mappePunkte(v);
  const positionen='<section class="card"><h2>Positionen</h2>'+(punkte.length?'<ul class="pd-punkte">'+punkte.map(x=>{
      const m=x.daten.muster||{},s1=M.seitenVon(v.daten).find(y=>y.punkt===x.id);
      return '<li><span class="pd-nr">'+esc(m.code||K.nummer('entscheidungsliste',x.nr))+'</span> '+esc(m.bezeichnung||x.daten.thema||'')+' · '+esc(x.daten.status||'')+
        '<span class="pd-punkt-aktionen">'+(s1?'<button type="button" class="pd-link" data-act="mm-seite" data-id="'+esc(s1.id)+'">Seite</button>':'')+
        (x.daten.status==='entschieden'?'<button type="button" class="pd-link" data-act="freigeben" data-z="'+x.id+'">In der Produktbibliothek freigeben</button>':'')+
        '<button type="button" class="pd-link" data-act="mm-position-weg" data-z="'+x.id+'">aus der Mappe nehmen</button></span></li>';
    }).join('')+'</ul>':'<p class="meta">Noch keine Position. Eine Position ist ein Eintrag der Entscheidungsliste mit Code aus dem Plan.</p>')+
    '<button type="button" class="btn" data-act="mm-position-neu">Position hinzufügen</button></section>';
  const ang=(k,l,ph='')=>'<label class="pd-feld"><span>'+esc(l)+'</span><input class="pd-in" id="m-'+k+'" data-vmeta="'+k+'" value="'+esc(k==='besprechung_am'?K.datumLang(v.daten[k]):v.daten[k])+'" placeholder="'+esc(ph)+'" autocomplete="off"></label>';
  const angaben='<section class="card"><h2>Angaben der Mappe</h2>'+ang('titel','Titel')+
    '<label class="pd-feld"><span>Themenpaket</span><select class="pd-in" id="m-themenpaket" data-vmeta="themenpaket">'+M.THEMEN.map(t=>'<option'+(t===v.daten.themenpaket?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>'+
    ang('besprechung_am','Bemusterungstermin','TT.MM.JJJJ')+ang('auftraggeber','Bauherr')+ang('strategie_a','Strategie A','kurz, z. B. Terrazzo und Eiche')+ang('strategie_b','Strategie B')+ang('verfasser','Verfasser')+'</section>';
  const termin='<section class="card"><h2>Entschieden wird im Termin</h2><p class="meta">Die Mappe wird im Bemusterungstermin vorgestellt; dort wird entschieden, nicht auf dem Blatt. '+
    'Eintragen in der Entscheidungsliste mit Datum, Entscheider und dem Termin als Fundstelle; danach «In der Produktbibliothek freigeben».</p></section>';
  const staende=ui.staende===null?'<p class="meta">wird geladen …</p>':ui.staende.length?'<ul class="pd-staende">'+ui.staende.map(s=>'<li><button type="button" class="pd-link" data-act="stand" data-id="'+s.id+'">'+esc(s.bezeichnung)+'</button><span>'+esc([K.datumLang(String(s.created_at).slice(0,10)),name(s.created_by)].filter(Boolean).join(' · '))+'</span></li>').join('')+'</ul>'
    :'<p class="meta">Noch kein Stand. Beim Vorlegen wird der Stand festgehalten und bleibt unverändert.</p>';
  return karte+position+positionen+angaben+termin+'<section class="card" data-staende><h2>Stände</h2>'+staende+'</section>';
}
function neueMappeDialog(){
  dialog.innerHTML='<form method="dialog" class="pd-dlg"><h2>Neue Mustermappe</h2><p class="meta">Eine Mappe je Themenpaket. Die Positionen (Codes aus dem Plan) und ihre Kandidaten aus der Produktbibliothek kommen danach.</p>'+
    '<label class="pd-feld"><span>Themenpaket</span><select class="pd-in" name="paket">'+M.THEMEN.map(t=>'<option>'+esc(t)+'</option>').join('')+'</select></label>'+
    '<label class="pd-feld"><span>Bemusterungstermin (falls schon bekannt)</span><input class="pd-in" name="termin" placeholder="TT.MM.JJJJ" autocomplete="off"></label>'+
    '<p class="pd-dlg-fehler" data-dlg-fehler></p><div class="pd-dlg-aktionen"><button type="button" class="btn" data-dlg="abbrechen">Abbrechen</button><button type="submit" class="btn btn-primary">Mappe anlegen</button></div></form>';
  const form=dialog.querySelector('form');
  form.querySelector('[data-dlg="abbrechen"]').onclick=()=>dialog.close();
  form.onsubmit=e=>{
    e.preventDefault();const t=K.leseDatum(form.termin.value);
    if(t===null){dialog.querySelector('[data-dlg-fehler]').textContent='Datum bitte als TT.MM.JJJJ eingeben.';return}
    dialog.close();
    void sicher(async()=>{const v=await neueZeile('entscheidungsvorlagen',M.neueMappe({themenpaket:form.paket.value,verfasser:meinName(),termin:t}));gehe({projekt:projekt.id,vorlage:v.id})});
  };
  dialog.showModal();
}
function positionDialog(v){
  dialog.innerHTML='<form method="dialog" class="pd-dlg"><h2>Position hinzufügen</h2><p class="meta">Eine Position ist ein Eintrag der Entscheidungsliste: Code aus dem Plan, Bezeichnung und Strategie. Die Kandidaten kommen danach aus der Produktbibliothek.</p>'+
    '<div class="pd-zwei"><label class="pd-feld"><span>Code im Plan</span><input class="pd-in" name="code" placeholder="z. B. B2" required maxlength="12" autocomplete="off"></label>'+
    '<label class="pd-feld"><span>Bezeichnung</span><input class="pd-in" name="bez" placeholder="z. B. Holz – Eiche" required maxlength="120" autocomplete="off"></label></div>'+
    '<label class="pd-feld"><span>Strategie</span><select class="pd-in" name="strategie">'+M.STRATEGIEN.map(([k,l])=>'<option value="'+k+'">'+esc(l)+'</option>').join('')+'</select></label>'+
    '<div class="pd-dlg-aktionen"><button type="button" class="btn" data-dlg="abbrechen">Abbrechen</button><button type="submit" class="btn btn-primary">Position anlegen</button></div></form>';
  const form=dialog.querySelector('form');
  form.querySelector('[data-dlg="abbrechen"]').onclick=()=>dialog.close();
  form.onsubmit=e=>{
    e.preventDefault();const code=form.code.value.trim(),bez=form.bez.value.trim();if(!code||!bez)return;
    dialog.close();void sicher(()=>positionAnlegen(v,{code,bezeichnung:bez,strategie:form.strategie.value}));
  };
  dialog.showModal();
}
async function positionAnlegen(v,{code,bezeichnung,strategie}){
  const z=await neueZeile('entscheidungsliste',M.neuePosition({code,bezeichnung,strategie,titel:v.daten.titel,vorlageId:v.id}));
  const seite={id:M.neueId(),typ:'vergleich',punkt:z.id};
  v.daten={...v.daten,punkte:[...(v.daten.punkte||[]),z.id],seiten:[...M.seitenVon(v.daten),seite]};markiere(v);
  mm.seite=seite.id;meldung('Position '+code+' angelegt; sie steht auch in der Entscheidungsliste.');render();
}
function positionWeg(v,id){
  const z=zeileVon(id);
  v.daten={...v.daten,punkte:(v.daten.punkte||[]).filter(x=>x!==id)};
  v.daten.seiten=M.seitenVon(v.daten);markiere(v);
  if(z&&z.daten.vorlage_id===v.id){const d={...z.daten};delete d.vorlage_id;z.daten=d;markiere(z)}
  if(ui.detail===id)ui.detail=null;
  meldung('Aus der Mappe genommen; die Entscheidung bleibt in der Entscheidungsliste.');render();
}
async function kandidatHinzu(v,z,produktId){
  await ladeQuellen();
  const q=quellen.daten;if(!q)throw new Error(quellen.fehler||'Die Produktbibliothek ist gerade nicht erreichbar.');
  const liste=K.optionen(z.daten);
  if(liste.length>=8)throw new Error('Mehr als acht Kandidaten passen nicht in eine Position.');
  const {data:p,error}=await sb.from('office_produkte').select(PRODUKT_VOLL).eq('id',produktId).maybeSingle();
  if(error||!p)throw new Error('Das Produkt ist gerade nicht erreichbar.');
  mm.produkte.set(p.id,p);
  let ver=Z.verwendungIm(p.id,projekt.id,q.verwendungen);
  // Jeder Kandidat steht in der Musterliste des Projekts (Verwendung «vorgeschlagen»), wie «In die Musterliste».
  if(!ver)ver=await neueVerwendung(p,'vorgeschlagen','Kandidat für '+(z.daten.thema||K.nummer('entscheidungsliste',z.nr))+' in der Mustermappe');
  if(!setze('entscheidungsliste',z,'optionen',[...K.optionen(z.daten),M.kandidat(K.optionen(z.daten),p,{produkt:Z.produktText(p,ver)})]))return;
  const {data:dk}=await sb.from('office_produkt_dokumente').select('id,produkt_id,art,name,storage_path,created_at').eq('produkt_id',p.id).eq('art','bild').order('created_at');
  mm.fotos.set(p.id,dk||[]);
  await signiere(M.BUCKET_PRODUKTE,(dk||[]).map(d=>d.storage_path));
  meldung(p.name+' ist Kandidat; in der Musterliste des Projekts «vorgeschlagen».');render();
}
function kandidatWeg(v,z,oid){
  const o=K.optionen(z.daten).find(x=>x.id===oid);if(!o)return;
  if(!window.confirm('Kandidat '+oid+' ('+(o.text||o.produkt||'')+') aus der Position nehmen? In der Musterliste bleibt das Produkt.'))return;
  setze('entscheidungsliste',z,'optionen',K.optionen(z.daten).filter(x=>x.id!==oid));
  if(z.daten.empfehlung===oid)setze('entscheidungsliste',z,'empfehlung','');
  seitenSetzen(v,M.seitenVon(v.daten).filter(x=>!(x.typ==='material'&&x.punkt===z.id&&x.option===oid))
    .map(x=>x.typ==='vergleich'&&x.punkt===z.id&&Array.isArray(x.optionen)?{...x,optionen:x.optionen.filter(i=>i!==oid)}:x));
  render();
}
function optionenPatch(z,oid,f){
  setze('entscheidungsliste',z,'optionen',K.optionen(z.daten).map(o=>o.id===oid?f({...o}):o));
}
function seiteNeu(v,wert){
  const [typ,punkt,option]=String(wert||'').split('|');
  if(!M.SEITEN[typ])return;
  const seite={id:M.neueId(),typ,...(punkt?{punkt}:{}),...(option?{option}:{})};
  const liste=M.seitenVon(v.daten),i=liste.findIndex(x=>x.id===mm.seite);
  liste.splice(i<0?liste.length:i+1,0,seite);
  seitenSetzen(v,liste);mm.seite=seite.id;render();
}
async function pdfAlsBild(datei,nr){
  if(!mm.pdfjs){
    try{mm.pdfjs=await import(PDFJS+'pdf.min.mjs');mm.pdfjs.GlobalWorkerOptions.workerSrc=PDFJS+'pdf.worker.min.mjs'}
    catch(e){console.warn('pdf.js',e);throw new Error('Das PDF kann hier gerade nicht gelesen werden. Bitte die Seite als Bild (JPG oder PNG) exportieren.')}
  }
  const aufgabe=mm.pdfjs.getDocument({data:new Uint8Array(await datei.arrayBuffer())}),doc=await aufgabe.promise;
  try{
    const seite=Math.min(Math.max(1,Math.floor(nr)||1),doc.numPages);
    const p=await doc.getPage(seite);
    const v1=p.getViewport({scale:1}),scale=Math.min(4,3200/Math.max(v1.width,v1.height));
    const vp=p.getViewport({scale});
    const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);
    const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);
    await p.render({canvas:c,canvasContext:ctx,viewport:vp}).promise;
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));
    if(!blob)throw new Error('Die PDF-Seite konnte nicht als Bild gespeichert werden.');
    return {blob,seite,seiten:doc.numPages};
  }finally{void aufgabe.destroy?.()}
}
async function freiesBild(v,seiteId,datei){
  if(!datei)return;
  const seite=M.seitenVon(v.daten).find(x=>x.id===seiteId);if(!seite)return;
  let blob=datei,typ=datei.type||'',name=datei.name||'Bild';
  if(typ==='application/pdf'||/\.pdf$/i.test(name)){
    if(datei.size>40*1024*1024)throw new Error('Das PDF ist größer als 40 MB.');
    meldung('PDF wird gelesen …');
    const r=await pdfAlsBild(datei,Number(seite.pdf_seite)||1);
    blob=r.blob;typ='image/jpeg';name=name.replace(/\.pdf$/i,'')+' · Seite '+r.seite+' von '+r.seiten;
  }
  const f=M.bildPruefen(typ,blob.size);if(f)throw new Error(f);
  const dok=await sichereDokument('entscheidungsvorlagen');
  const pfad=M.dateiPfad(dok.id,nutzer.id,crypto.randomUUID(),typ);
  const {error}=await sb.storage.from(M.BUCKET).upload(pfad,blob,{contentType:typ,upsert:false});
  if(error)throw new Error('Das Bild wurde nicht hochgeladen: '+(error.message||'Fehler'));
  seitePatch(v,seiteId,{bild:{pfad,name:String(name).slice(0,160)},titel:seite.titel||String(name).replace(/\.(jpe?g|png|webp)$/i,'').slice(0,120)});
  await signiere(M.BUCKET,[pfad]);meldung('Das Bild steht auf der Seite.');render();
}
async function mappeDrucken(v){
  await alleSpeichern();
  try{await mappeLaden(v)}catch(e){console.warn('Mustermappe · Fotos',e)}
  render();
  const d=root.querySelector('.mm-druck');if(!d)return;
  await Promise.all([...d.querySelectorAll('img')].map(i=>i.complete?null:new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true})})));
  // A3 quer nur für diesen Druck; die Entscheidungsvorlage bleibt A4.
  const st=document.createElement('style');st.textContent='@page{size:A3 landscape;margin:0}';document.head.append(st);
  document.documentElement.classList.add('mm-drucken');
  window.addEventListener('afterprint',()=>{st.remove();document.documentElement.classList.remove('mm-drucken')},{once:true});
  window.print();
}
async function mappeStandZeigen(st){
  const inh=st.inhalt||{seiten:[],punkte:[],projekt:{}},pf=M.allePfade(inh);
  await Promise.all([signiere(M.BUCKET_PRODUKTE,pf.produkt),signiere(M.BUCKET,pf.mappe)]);
  dialog.innerHTML='<div class="pd-dlg pd-dlg-breit"><div class="pd-detail-kopf"><h2>'+esc(st.bezeichnung)+'</h2><button type="button" class="pd-x" data-dlg="zu" aria-label="Schließen">×</button></div>'+
    '<p class="meta">Festgehalten am '+esc(K.datumLang(String(st.created_at).slice(0,10)))+' von '+esc(name(st.created_by)||'jemandem')+'; dieser Stand ändert sich nicht.</p>'+
    '<div class="mm-stand">'+M.mappeHtml(inh,{modus:'druck',bild:bildUrl})+'</div></div>';
  dialog.querySelector('[data-dlg="zu"]').onclick=()=>dialog.close();
  dialog.showModal();
}
function mappeKlick(act,el){
  const v=vorlageZeile();if(!v||!istMappe(v))return;
  const z=el.dataset.z?zeileVon(el.dataset.z):null;
  if(act==='mm-seite'){mm.seite=el.dataset.id;render();root.querySelector('.mm-mitte')?.scrollIntoView({block:'nearest'})}
  else if(act==='mm-zoom'){mm.lesen=!mm.lesen;render()}
  else if(act==='mm-pdf')void sicher(()=>mappeDrucken(v));
  else if(act==='mm-position-neu')positionDialog(v);
  else if(act==='mm-position-weg'){if(window.confirm('Die Position aus der Mappe nehmen? In der Entscheidungsliste bleibt sie.'))positionWeg(v,el.dataset.z)}
  else if(act==='mm-hoch'||act==='mm-runter'){seitenSetzen(v,M.seiteVerschieben(M.seitenVon(v.daten),mm.seite,act==='mm-hoch'?-1:1));render()}
  else if(act==='mm-seite-weg'){
    const l=M.seitenVon(v.daten);if(l.length<2){meldung('Eine Seite braucht die Mappe.','warn');return}
    const i=l.findIndex(x=>x.id===mm.seite);if(i<0)return;
    if(!window.confirm('Seite '+(i+1)+' entfernen? Die Position und ihre Kandidaten bleiben.'))return;
    l.splice(i,1);seitenSetzen(v,l);mm.seite=(l[i]||l[i-1]).id;render();
  }
  else if(act==='mm-material'&&z){
    const l=M.seitenVon(v.daten),da=l.find(x=>x.typ==='material'&&x.punkt===z.id&&x.option===el.dataset.o);
    if(da){mm.seite=da.id;render();return}
    const i=Math.max(...l.map((x,j)=>x.punkt===z.id?j:-1));
    const seite={id:M.neueId(),typ:'material',punkt:z.id,option:el.dataset.o};
    l.splice(i<0?l.length:i+1,0,seite);seitenSetzen(v,l);mm.seite=seite.id;render();
  }
  else if(act==='mm-kandidat-weg'&&z)kandidatWeg(v,z,el.dataset.o);
  else if(act==='mm-uebernehmen'&&z){
    optionenPatch(z,el.dataset.o,o=>{const p=mm.produkte.get(o.produkt_id);return p?{...o,muster_produkt:M.produktAuszug(p)}:o});
    meldung('Neuer Stand übernommen.');render();
  }
  else if(act==='mm-foto'&&z){
    const o=K.optionen(z.daten).find(x=>x.id===el.dataset.o),d=(mm.fotos.get(o?.produkt_id)||[]).find(x=>x.id===el.dataset.d);
    if(o&&d){optionenPatch(z,o.id,x=>({...x,muster_fotos:M.fotosUmschalten(x.muster_fotos,{id:d.id,pfad:d.storage_path})}));render()}
  }
  else if(act==='mm-bild-weg'){const s1=mappeSeite(v);if(s1){const d={...s1};delete d.bild;seitenSetzen(v,M.seitenVon(v.daten).map(x=>x.id===s1.id?d:x));render()}}
}
function mappeAenderung(el){
  const v=vorlageZeile();if(!v||!istMappe(v))return false;
  const act=el.dataset.act;
  if(act==='mm-neue-seite'){if(el.value)seiteNeu(v,el.value);return true}
  if(act==='mm-kandidat'){const z=zeileVon(el.dataset.z);if(z&&el.value){const id=el.value;el.disabled=true;void sicher(()=>kandidatHinzu(v,z,id))}return true}
  const seite=mappeSeite(v);
  if(act==='mm-zeige'&&seite){seitePatch(v,seite.id,{zeige:{...(seite.zeige||{}),[el.dataset.k]:el.checked}});spaeterRendern();return true}
  if(act==='mm-seite-option'&&seite){
    const z=zeileVon(seite.punkt),alle=z?K.optionen(z.daten).map(o=>o.id):[];
    let auf=Array.isArray(seite.optionen)?seite.optionen.filter(i=>alle.includes(i)):alle.slice(0,M.MAX_KANDIDATEN);
    auf=el.checked?[...new Set([...auf,el.dataset.o])]:auf.filter(i=>i!==el.dataset.o);
    if(auf.length>M.MAX_KANDIDATEN){meldung('Auf eine Vergleichsseite passen höchstens drei Kandidaten.','warn');el.checked=false;return true}
    seitePatch(v,seite.id,{optionen:alle.filter(i=>auf.includes(i))});spaeterRendern();return true;
  }
  if(act==='mm-material-option'&&seite){seitePatch(v,seite.id,{option:el.value});spaeterRendern();return true}
  if(act==='mm-pdf-seite'&&seite){seitePatch(v,seite.id,{pdf_seite:Math.max(1,Math.floor(Number(el.value))||1)});return true}
  if(act==='mm-datei'&&seite){const f=el.files?.[0];if(f)void sicher(()=>freiesBild(v,seite.id,f));return true}
  if(el.matches('[data-mmfeld]')){
    const z=zeileVon(el.dataset.z);if(!z)return true;
    const k=el.dataset.mmfeld;
    if(k==='empfehlung'){setze('entscheidungsliste',z,'empfehlung',el.value);spaeterRendern();return true}
    const m={...(z.daten.muster||{}),[k]:el.value.trim()};
    if((z.daten.muster||{})[k]===m[k])return true;
    setze('entscheidungsliste',z,'muster',m);
    if(k==='code'||k==='bezeichnung')setze('entscheidungsliste',z,'thema',M.thema(m));
    spaeterRendern();return true;
  }
  return false;
}
// Tippen auf der Seite: gespeichert wird nach einer kurzen Pause, neu gezeichnet erst beim Verlassen des Felds.
function mappeEingabe(el){
  const v=vorlageZeile();if(!v||!istMappe(v))return false;
  if(el.matches('textarea[data-mmtext]')){const z=zeileVon(el.dataset.z);if(z){z.daten={...z.daten,[el.dataset.mmtext]:el.value};markiere(z)}}
  else if(el.matches('textarea[data-mmopt]')){
    const [zid,oid]=el.dataset.mmopt.split('|'),z=zeileVon(zid);
    if(z){z.daten={...z.daten,optionen:K.optionen(z.daten).map(o=>o.id===oid?{...o,muster_text:el.value}:o)};markiere(z)}
  }
  else if(el.matches('textarea[data-mmseite]')){
    const [sid,k]=el.dataset.mmseite.split('|');
    v.daten={...v.daten,seiten:M.seitenVon(v.daten).map(x=>x.id===sid?{...x,[k]:el.value}:x)};markiere(v);
  }
  else if(el.matches('textarea[data-mmvorlage]')){v.daten={...v.daten,[el.dataset.mmvorlage]:el.value};markiere(v)}
  else return false;
  mmWachse(el);return true;
}

// ---------- Romy ----------
const ROMY_FEHLER={no_terminplan:'Für dieses Projekt gibt es keinen Terminplan mit Terminen.',document_or_text_required:'Bitte eine Datei wählen oder Text einfügen.',
  one_document_required:'Bitte nur eine Datei.',invalid_attachments:'Diese Datei kann Romy nicht lesen: PDF oder Bild bis 8 MB.',ai_not_configured:'Romy ist im Office noch nicht eingerichtet.',
  no_access:'Kein Zugriff auf dieses Dokument.',ai_timeout_or_network:'Romy hat nicht rechtzeitig geantwortet. Bitte noch einmal versuchen.',rows_required:'Bitte zuerst Zeilen auswählen.',
  instruction_required:'Bitte sagen, was Romy ändern soll.',question_required:'Bitte eine Frage eingeben.',invalid_task:'Das geht in dieser Liste nicht.',
  candidates_required:'Romy braucht Kandidaten: in der Produktbibliothek, im Datenpool oder in der Kostenberechnung ist nichts Passendes.',options_required:'Bitte zuerst die Varianten beschreiben.'};
async function romyStatus(){
  try{const {data,error}=await sb.functions.invoke('office-dokumente-ai',{body:{action:'status'}});romy.bereit=!error&&data?.ready===true}catch{romy.bereit=false}
  if(romy.bereit&&!ui.edit&&!dialog.open&&projekt)render();
}
async function romyAufruf(body){
  const {data,error}=await sb.functions.invoke('office-dokumente-ai',{body});
  if(error){
    let code='';try{code=(await error.context?.json?.())?.error||''}catch{}
    throw new Error(ROMY_FEHLER[code]||'Romy ist gerade nicht erreichbar.');
  }
  if(!data?.result)throw new Error('Romy ist gerade nicht erreichbar.');
  return data;
}
// Vorschläge speichern: für alle im Projekt sichtbar, bis jemand sie übernimmt oder verwirft. Eine Entscheidung ist
// nie dabei (die Datenbank lehnt sie auch ab).
async function vorschlaegeSpeichern(art,liste,quelle){
  const dok=dokumente[art];if(!dok)return 0;
  const neu=(liste||[]).map(v=>({dokument_id:dok.id,zeile_id:v.art==='aenderung'?v.zeile_id:null,art:v.art,daten:K.ohneEntscheidung(v.daten),
    fundstelle:String(v.fundstelle||'').slice(0,400),begruendung:String(v.begruendung||'').slice(0,2000),quelle:String(quelle||'').slice(0,300)}))
    .filter(v=>['neu','aenderung'].includes(v.art)&&(v.art==='neu'||v.zeile_id)&&Object.keys(v.daten).length&&K.vorschlagErlaubt(v.daten));
  if(!neu.length)return 0;
  const {data,error}=await sb.from('office_projektdokument_vorschlaege').insert(neu).select(VORSCHLAG);
  if(error)throw error;
  vorschlaege.push(...(data||[]));
  return (data||[]).length;
}
async function vorschlagStatus(v,status){
  const {error}=await sb.from('office_projektdokument_vorschlaege').update({status}).eq('id',v.id);
  if(error)throw error;
  vorschlaege=vorschlaege.filter(x=>x.id!==v.id);
}
async function uebernehmen(v){
  const art=artVon(v.dokument_id);if(!art)return;
  await alleSpeichern();
  if(v.art==='neu'){
    const d={...K.leereZeile(art,{runde:dokumente[art]?.meta?.runde||''}),...v.daten,fundstelle:v.fundstelle,_romy:Object.keys(v.daten)};
    await neueZeile(art,d,{vorschlagId:v.id});
  }else{
    const z=zeileVon(v.zeile_id);
    if(!z){await vorschlagStatus(v,'verworfen');meldung('Die Zeile gibt es nicht mehr; der Vorschlag ist verworfen.','warn');return}
    const neu={...z.daten,...v.daten};
    if(Array.isArray(v.daten.optionen))neu.optionen=K.optionenZusammen(z.daten.optionen,v.daten.optionen);
    if(art==='klaerungsliste'&&['gelöst','entfällt'].includes(v.daten.status)&&!neu.erledigt_am)neu.erledigt_am=heute();
    if(art==='entscheidungsliste'&&v.daten.status==='vorgelegt'&&!neu.vorgelegt_am)neu.vorgelegt_am=heute();
    neu._romy=[...new Set([...(Array.isArray(z.daten._romy)?z.daten._romy:[]),...Object.keys(v.daten)])];
    const p=K.pruefe(art,neu);if(p)throw new Error(p);
    z.daten=neu;
    await speichere(z,{vorschlagId:v.id});
    if(speicher.fehler)throw new Error('Nicht gespeichert: '+speicher.fehler);
  }
  await vorschlagStatus(v,'uebernommen');
}
function geaendert(art,z){return new Set(offene(art).filter(v=>v.art==='aenderung'&&v.zeile_id===z.id).flatMap(v=>Object.keys(v.daten||{})))}
function vsKnoepfe(v){return '<span class="pd-vs-aktionen"><button type="button" class="btn btn-romy" data-act="vs-ja" data-id="'+esc(v.id)+'">Übernehmen</button><button type="button" class="btn btn-quiet" data-act="vs-nein" data-id="'+esc(v.id)+'">Verwerfen</button></span>'}
function romyBanner(art){
  const vs=offene(art);let html='';
  if(vs.length){
    const quellen=[...new Set(vs.map(v=>v.quelle).filter(Boolean))];
    html+='<div class="pd-banner romy">Romy hat '+(quellen.length?'in '+quellen.map(q=>'«'+esc(q)+'»').join(', ')+' ':'')+vs.length+(vs.length===1?' Vorschlag':' Vorschläge')+
      ' gemacht. Sie stehen blau markiert in der Liste; jeden einzeln übernehmen oder verwerfen.<div class="pd-banner-actions">'+
      '<button type="button" class="btn btn-romy" data-act="vs-alle-ja">'+(vs.length===1?'Übernehmen':'Alle '+vs.length+' übernehmen')+'</button><button type="button" class="btn btn-quiet" data-act="vs-alle-nein">'+(vs.length===1?'Verwerfen':'Alle verwerfen')+'</button></div></div>';
  }
  const t=ui.romyText;
  if(t&&t.art===art)html+='<div class="pd-romy-antwort"><button type="button" class="pd-x" data-act="romy-text-zu" aria-label="Schließen">×</button><strong>Romy</strong> · '+esc(t.quelle)+': '+esc(t.text||'')+
    (t.n===0?' Keine neuen Vorschläge.':'')+(t.hinweise.length?'<ul>'+t.hinweise.map(h=>'<li>'+esc(h)+'</li>').join('')+'</ul>':'')+'</div>';
  return html;
}
function aenderungsZeilen(art,z,breite){
  return offene(art).filter(v=>v.art==='aenderung'&&v.zeile_id===z.id).map(v=>'<tr class="pd-vorschlag pd-vs-aenderung" data-vorschlag="'+esc(v.id)+'"><td class="pd-check"></td>'+
    '<td class="pd-c" colspan="'+breite+'"><strong>Romy schlägt für '+esc(K.nummer(art,z.nr))+' vor:</strong> '+esc(K.aenderungText(art,z.daten,v.daten))+
    (v.begruendung?'<span class="pd-unter">'+esc(v.begruendung)+'</span>':'')+'<span class="pd-unter">Fundstelle: '+esc(v.fundstelle)+'</span>'+vsKnoepfe(v)+'</td></tr>').join('');
}
function neueVorschlaege(art,spalten){
  return offene(art).filter(v=>v.art==='neu').map(v=>{
    const z={id:'',nr:0,daten:v.daten||{},dokument_id:v.dokument_id};
    return '<tr class="pd-vorschlag" data-vorschlag="'+esc(v.id)+'"><td class="pd-check"></td>'+spalten.map(sp=>{
      if(sp.key==='nr')return '<td class="pd-c pd-t-nr"><span class="chip pd-neu-marke">neu</span></td>';
      if(sp.key==='_vorlage')return '<td class="pd-c"></td>';
      const inhalt=zellInhalt(art,z,sp);
      if(sp.key===NEU_FELD[art])return '<td class="pd-c pd-t-'+sp.typ+'">'+inhalt+'<span class="pd-unter">Fundstelle: '+esc(v.fundstelle)+'</span>'+
        (v.begruendung?'<span class="pd-unter">'+esc(v.begruendung)+'</span>':'')+vsKnoepfe(v)+'</td>';
      return '<td class="pd-c pd-t-'+sp.typ+'">'+inhalt+'</td>';
    }).join('')+'</tr>';
  }).join('');
}
function diffHtml(alt,neu,v){
  const teile=K.wortDiff(alt||'',neu||'');
  return '<div class="pd-diff" aria-label="Vorschlag von Romy">'+teile.map(t=>t.typ==='gleich'?esc(t.text):t.typ==='neu'?'<ins>'+esc(t.text)+'</ins>':'<del>'+esc(t.text)+'</del>').join('')+'</div>'+
    '<p class="pd-vs-zeile"><span>Romy: '+esc(v.begruendung||'neu formuliert')+'</span>'+vsKnoepfe(v)+'</p>';
}
const alsDataUrl=datei=>new Promise((ok,bad)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=()=>bad(new Error('Die Datei ist nicht lesbar.'));r.readAsDataURL(datei)});
function romyDialog(art){
  dialog.innerHTML='<form class="pd-dlg"><h2>Romy: Vorschläge aus einem Dokument</h2>'+
    '<p class="meta">Romy liest ein Protokoll, eine Mail oder einen Plan und schlägt für die '+esc(K.DOKUMENTE[art].kurz)+' neue Zeilen und Änderungen vor, jede mit Fundstelle. Nichts ändert sich, bis jemand «Übernehmen» drückt.</p>'+
    '<label class="pd-feld"><span>Quelle</span><input class="pd-in" name="quelle" placeholder="z. B. Protokoll Koordination 02" required autocomplete="off"></label>'+
    '<label class="pd-feld"><span>Datei (PDF oder Bild, bis 8 MB)</span><input class="pd-in" type="file" name="datei" accept="application/pdf,image/png,image/jpeg,image/webp"></label>'+
    '<label class="pd-feld"><span>oder Text einfügen</span><textarea class="pd-in" name="text" rows="6" placeholder="Text aus der Mail oder dem Protokoll"></textarea></label>'+
    '<label class="pd-feld"><span>Hinweis an Romy (optional)</span><input class="pd-in" name="hinweis" placeholder="z. B. nur TOP 3 bis 7" autocomplete="off"></label>'+
    '<p class="pd-dlg-fehler" data-dlg-fehler></p><div class="pd-dlg-aktionen"><button type="button" class="btn" data-dlg="abbrechen">Abbrechen</button><button type="submit" class="btn btn-primary">Vorschläge holen</button></div></form>';
  const form=dialog.querySelector('form'),f=dialog.querySelector('[data-dlg-fehler]');
  form.querySelector('[data-dlg="abbrechen"]').onclick=()=>dialog.close();
  form.onsubmit=async e=>{
    e.preventDefault();
    const datei=form.datei.files[0],text=form.text.value.trim(),quelle=form.quelle.value.trim();
    if(!datei&&!text){f.textContent='Bitte eine Datei wählen oder Text einfügen.';return}
    if(datei&&datei.size>8*1024*1024){f.textContent='Die Datei ist größer als 8 MB.';return}
    const knopf=form.querySelector('button[type="submit"]');knopf.disabled=true;knopf.textContent='Romy liest …';f.textContent='';
    try{
      const dok=await sichereDokument(art);
      const attachments=datei?[{name:datei.name.slice(0,180),mime:datei.type,size:datei.size,data:await alsDataUrl(datei)}]:undefined;
      const antwort=await romyAufruf({action:'vorschlaege',dokument_id:dok.id,quelle,text,hinweis:form.hinweis.value.trim(),attachments});
      const q=antwort.quelle||quelle;
      const n=await vorschlaegeSpeichern(art,antwort.result.vorschlaege,q);
      ui.romyText={art,quelle:q,text:antwort.result.text||'',hinweise:antwort.result.hinweise||[],n};
      dialog.close();render();
    }catch(err){f.textContent=err?.message||'Romy ist gerade nicht erreichbar.';knopf.disabled=false;knopf.textContent='Vorschläge holen'}
  };
  dialog.showModal();
}
async function romyAuswahl(aufgabe,{frage='',ids=[...ui.auswahl]}={}){
  const art=artVon(zeileVon(ids[0])?.dokument_id)||ui.art,dok=dokumente[art];
  if(!dok||!ids.length){meldung('Bitte zuerst Zeilen auswählen.','warn');return}
  meldung('Romy arbeitet …');
  await alleSpeichern();
  const antwort=await romyAufruf({action:'auswahl',aufgabe,dokument_id:dok.id,zeilen_ids:ids,frage});
  ui.meldung='';
  if(aufgabe==='fristen_terminplan'){
    const n=await vorschlaegeSpeichern(art,antwort.result.vorschlaege,'Terminplan');
    ui.romyText={art,quelle:'Terminplan',text:antwort.result.text||'',hinweise:antwort.result.hinweise||[],n};
    render();return;
  }
  zeigeMeldung();
  textDialog({frage_fachplaner:'Frage an die Fachplaner',bestaetigung:'Bestätigung in Textform',frage:'Romy antwortet'}[aufgabe]||'Romy',antwort.result.text,{mail:aufgabe!=='frage'});
}
function textDialog(titel,text,{mail=false}={}){
  dialog.innerHTML='<div class="pd-dlg"><div class="pd-detail-kopf"><h2>'+esc(titel)+'</h2><button type="button" class="pd-x" data-dlg="zu" aria-label="Schließen">×</button></div>'+
    '<p class="meta">Von Romy formuliert; vor dem Senden lesen und anpassen.</p><textarea class="pd-in pd-romy-ausgabe" rows="14" aria-label="Text von Romy">'+esc(text)+'</textarea>'+
    '<div class="pd-dlg-aktionen"><button type="button" class="btn" data-dlg="kopieren">Kopieren</button>'+(mail?'<a class="btn btn-primary" data-dlg="mail" href="mailto:">Als E-Mail öffnen</a>':'')+'</div></div>';
  const ta=dialog.querySelector('textarea');
  dialog.querySelector('[data-dlg="zu"]').onclick=()=>dialog.close();
  dialog.querySelector('[data-dlg="kopieren"]').onclick=async e=>{try{await navigator.clipboard.writeText(ta.value);e.target.textContent='Kopiert'}catch{ta.select()}};
  const a=dialog.querySelector('[data-dlg="mail"]');
  if(a)a.onclick=()=>{const t=ta.value,m=/^Betreff:\s*(.+)\n+/.exec(t);a.href='mailto:?subject='+encodeURIComponent(m?m[1].trim():titel)+'&body='+encodeURIComponent(m?t.slice(m[0].length):t)};
  dialog.showModal();
}
function frageDialog(fn){
  dialog.innerHTML='<form class="pd-dlg"><h2>Romy fragen</h2><label class="pd-feld"><span>Frage zu den ausgewählten Zeilen</span><textarea class="pd-in" name="frage" rows="3" required placeholder="z. B. Was ändert sich in der Kostenberechnung, wenn der Unterzug deckengleich wird?"></textarea></label>'+
    '<div class="pd-dlg-aktionen"><button type="button" class="btn" data-dlg="abbrechen">Abbrechen</button><button type="submit" class="btn btn-primary">Fragen</button></div></form>';
  const form=dialog.querySelector('form');
  form.querySelector('[data-dlg="abbrechen"]').onclick=()=>dialog.close();
  form.onsubmit=e=>{e.preventDefault();const frage=form.frage.value.trim();if(!frage)return;dialog.close();void sicher(()=>fn(frage))};
  dialog.showModal();
}
async function romyAbschnitt(zeileId,feld,auftrag){
  const dok=dokumente.entscheidungsliste;if(!dok)return;
  meldung('Romy arbeitet …');
  await alleSpeichern();
  const antwort=await romyAufruf({action:'text',dokument_id:dok.id,zeile_id:zeileId,feld,auftrag});
  if(antwort.result.unveraendert){meldung('Romy hat nichts geändert.');return}
  const n=await vorschlaegeSpeichern('entscheidungsliste',[{art:'aenderung',zeile_id:zeileId,daten:{[feld]:antwort.result.neu},
    fundstelle:'Auftrag an Romy: «'+auftrag.slice(0,200)+'»',begruendung:antwort.result.begruendung}],'Entscheidungsvorlage');
  meldung(n?'Romy hat einen Vorschlag gemacht: grün eingefügt, rot gestrichen.':'Romy hat nichts geändert.');
  render();
}
async function alleVorschlaege(art,ja){
  const liste=offene(art);
  let n=0;
  for(const v of [...liste.filter(x=>x.art==='neu'),...liste.filter(x=>x.art==='aenderung')]){
    if(ja)await uebernehmen(v);else await vorschlagStatus(v,'verworfen');
    n++;
  }
  meldung(n?(ja?(n===1?'Übernommen.':n+' Vorschläge übernommen.'):(n===1?'Verworfen.':n+' Vorschläge verworfen.')):'');
  render();
}

// ---------- Ereignisse ----------
async function sicher(f){try{await f()}catch(e){console.error('Projektdokumente',e);meldung(e?.message||'Das hat nicht geklappt.','warn');render()}}
root.addEventListener('click',e=>{
  const nav=e.target.closest('a[data-nav]');
  if(nav&&!e.metaKey&&!e.ctrlKey&&nav.getAttribute('href').startsWith('?')){e.preventDefault();ui.meldung='';history.pushState(null,'',nav.getAttribute('href'));void route();return}
  const el=e.target.closest('[data-act]');
  if(!el){
    const c=e.target.closest('td[data-k]');
    if(c&&ui.ansicht==='liste'){
      const z=zeileVon(c.dataset.z),art=ui.art,sp=spaltenFuer(art).find(x=>x.key===c.dataset.k);
      if(!z||!sp)return;
      if(e.target.closest('a,button'))return;
      if(sp.typ==='janein'){setze(art,z,sp.key,z.daten[sp.key]==='ja'?'nein':'ja');renderListe();return}
      if(BEARBEITBAR.includes(sp.typ)){ui.edit={z:z.id,k:sp.key};renderListe();return}
      oeffneDetail(z);
    }
    return;
  }
  const act=el.dataset.act,art=ui.art;
  if(act==='mm-neu'){neueMappeDialog();return}
  if(act.startsWith('mm-')&&ui.ansicht==='mappe'){if(el.matches('select,input'))return;mappeKlick(act,el);return}
  if(act==='filter'){ui.filter=el.dataset.f;renderListe()}
  else if(act==='spalten'){ui.alleSpalten=!ui.alleSpalten;renderListe()}
  else if(act==='excel')void sicher(()=>excel(el.dataset.art));
  else if(act==='neu'){const i=root.querySelector('[data-neu]');if(i){i.focus();i.scrollIntoView({block:'nearest'})}}
  else if(act==='waehle'){if(el.checked)ui.auswahl.add(el.dataset.z);else ui.auswahl.delete(el.dataset.z);renderListe()}
  else if(act==='alle'){const sicht=K.filtere(art,zeilen[art],{filter:ui.filter,disziplin:ui.disziplin,suche:ui.suche});ui.auswahl=el.checked?new Set(sicht.map(z=>z.id)):new Set();renderListe()}
  else if(act==='auswahl-weg'){ui.auswahl=new Set();renderListe()}
  else if(act==='aufgaben')void sicher(()=>aufgabenAnlegen([...ui.auswahl].map(zeileVon).filter(Boolean)));
  else if(act==='aufgabe')void sicher(()=>aufgabenAnlegen([zeileVon(el.dataset.z)].filter(Boolean)));
  else if(act==='in-entscheidungen')void sicher(()=>inEntscheidungen([...ui.auswahl].map(zeileVon).filter(Boolean)));
  else if(act==='in-entscheidungen-eine')void sicher(()=>inEntscheidungen([zeileVon(el.dataset.z)].filter(Boolean)));
  else if(act==='ep-uebernehmen')void sicher(async()=>{const k=zeileVon(el.dataset.z);if(k)await inEntscheidungen([k])});
  else if(act==='ep-spaeter'){ui.spaeter.add(el.dataset.z);renderListe()}
  else if(act==='vorlage-anlegen')void sicher(()=>vorlageAnlegen([el.dataset.z]));
  else if(act==='vorlage-auswahl')void sicher(()=>vorlageAnlegen([...ui.auswahl]));
  else if(act==='neue-vorlage')neueVorlageDialog();
  else if(act==='detail-zu'){ui.detail=null;render()}
  else if(act==='code'){
    const z=zeileVon(el.dataset.z),a=artVon(z?.dokument_id);if(!z)return;
    const alt=Array.isArray(z.daten[el.dataset.feld])?z.daten[el.dataset.feld]:[];
    const neu=alt.includes(el.dataset.code)?alt.filter(c=>c!==el.dataset.code):[...alt,el.dataset.code];
    setze(a,z,el.dataset.feld,K.SPALTEN[a].find(x=>x.key==='disziplinen').werte.filter(c=>neu.includes(c)));render();
  }
  else if(act==='option-neu'){const z=zeileVon(el.dataset.z);const o=K.optionen(z.daten);setze('entscheidungsliste',z,'optionen',[...o,{id:K.naechsteOptionId(o),text:''}]);render()}
  else if(act==='option-weg'){const z=zeileVon(el.dataset.z);const o=K.optionen(z.daten).filter((_,i)=>i!==Number(el.dataset.i));setze('entscheidungsliste',z,'optionen',o);render()}
  else if(act==='entscheiden'){const z=zeileVon(el.dataset.z);if(z)entscheidungDialog(z)}
  else if(act==='zahlen'){const z=zeileVon(el.dataset.z);if(z){uebernimmOffeneFelder();zahlenDialog(z,Number(el.dataset.i))}}
  else if(act==='romy-zahlen'){const z=zeileVon(el.dataset.z);if(z){el.disabled=true;el.textContent='Romy sucht …';void sicher(async()=>{uebernimmOffeneFelder();await romyZahlen(z);render()})}}
  else if(act==='freigeben'){const z=zeileVon(el.dataset.z);if(z)freigabeDialog(z)}
  else if(act==='loeschen')void sicher(()=>loeschen(zeileVon(el.dataset.z)));
  else if(act==='word'){const v=vorlageZeile();if(v)void sicher(()=>word(v))}
  else if(act==='drucken')void sicher(async()=>{await alleSpeichern();renderVorlage();window.print()});
  else if(act==='vorlegen'){const v=vorlageZeile();if(v)vorlegenDialog(v)}
  else if(act==='stand')standDialog(el.dataset.id);
  else if(act==='punkt-details'){const z=zeileVon(el.dataset.z);if(z){ui.detail=z.id;ui.verlauf=null;render()}}
  else if(act==='punkt-weg')void sicher(()=>punktWeg(el.dataset.z));
  else if(act==='romy')romyDialog(ui.art);
  else if(act==='vs-ja')void sicher(async()=>{const v=vorschlaege.find(x=>x.id===el.dataset.id);if(!v)return;el.disabled=true;await uebernehmen(v);meldung('Übernommen.');render()});
  else if(act==='vs-nein')void sicher(async()=>{const v=vorschlaege.find(x=>x.id===el.dataset.id);if(!v)return;el.disabled=true;await vorschlagStatus(v,'verworfen');meldung('Verworfen.');render()});
  else if(act==='vs-alle-ja')void sicher(()=>alleVorschlaege(ui.art,true));
  else if(act==='vs-alle-nein')void sicher(()=>alleVorschlaege(ui.art,false));
  else if(act==='romy-text-zu'){ui.romyText=null;render()}
  else if(act==='romy-fachplaner')void sicher(()=>romyAuswahl('frage_fachplaner'));
  else if(act==='romy-fristen')void sicher(()=>romyAuswahl('fristen_terminplan'));
  else if(act==='romy-bestaetigung')void sicher(()=>romyAuswahl('bestaetigung'));
  else if(act==='romy-frage')frageDialog(frage=>romyAuswahl('frage',{frage}));
  else if(act==='romy-frage-zeile'){const f=root.querySelector('#r-frage')?.value.trim();if(!f){meldung('Bitte eine Frage eingeben.','warn');return}void sicher(()=>romyAuswahl('frage',{frage:f,ids:[el.dataset.z]}))}
  else if(act==='romy-abschnitt'){
    const [zid,feld]=String(root.querySelector('#r-abschnitt')?.value||'').split('|'),auftrag=root.querySelector('#r-auftrag')?.value.trim();
    if(!auftrag){meldung('Bitte sagen, was Romy ändern soll.','warn');return}
    void sicher(()=>romyAbschnitt(zid,feld,auftrag));
  }
});
root.addEventListener('change',e=>{
  if(zeichnet)return;
  const el=e.target;
  if(el.matches('[data-act="projekt"]')){ui.meldung='';gehe({projekt:el.value});return}
  if(el.matches('[data-act="disziplin"]')){ui.disziplin=el.value;renderListe();return}
  if(el.matches('[data-act="runde"]')){void sicher(async()=>{await sichereDokument('klaerungsliste');await setzeMeta('klaerungsliste',{runde:el.value});renderListe()});return}
  if(el.matches('[data-act="punkt-neu"]')){if(el.value)void sicher(()=>punktNeu(el.value));return}
  if(ui.ansicht==='mappe'&&el.matches('[data-act^="mm-"],[data-mmfeld]')&&mappeAenderung(el))return;
  // Eine Auswahl gilt sofort; die Zelle bleibt offen, bis Enter, Tab oder ein Klick daneben sie schließt.
  if(el.matches('select[data-edit]')){const r=uebernimmZelle(el);if(r==='dialog'){const z=zeileVon(el.dataset.z);ui.edit=null;renderListe();if(z)entscheidungDialog(z)}else zeigeSpeicherstand();return}
  if(el.matches('[data-feld]')){if(feldAusPanel(el))spaeterRendern();return}
  if(el.matches('input[data-opt]')){if(optionFeld(el))spaeterRendern();return}
  if(el.matches('select[data-vfeld]')){const z=zeileVon(el.dataset.z);if(z&&setze('entscheidungsliste',z,el.dataset.vfeld,el.value))spaeterRendern();return}
  if(el.matches('[data-vmeta]')){vmeta(el);return}
});
root.addEventListener('input',e=>{
  if(zeichnet)return;
  const el=e.target;
  if(el.matches('[data-act="suche"]')){ui.suche=el.value;clearTimeout(el._t);el._t=setTimeout(()=>{renderListe();const s=root.querySelector('[data-act="suche"]');if(s){s.focus();s.setSelectionRange(s.value.length,s.value.length)}},250);return}
  if(ui.ansicht==='mappe'&&el.matches('textarea.mm-text')){mappeEingabe(el);return}
  if(el.matches('textarea[data-vfeld]')){const z=zeileVon(el.dataset.z);if(z){z.daten={...z.daten,[el.dataset.vfeld]:el.value};if(Array.isArray(z.daten._romy))z.daten._romy=z.daten._romy.filter(k=>k!==el.dataset.vfeld);markiere(z)}wachse(el);return}
  if(el.matches('textarea.pd-in[data-edit]'))el.style.height=Math.max(el.scrollHeight,60)+'px';
});
root.addEventListener('focusout',e=>{
  if(zeichnet)return;
  const el=e.target;
  if(el.matches('[data-edit]')){
    // Der Wert gilt sofort, auch wenn ein Klick in eine andere Zelle folgt; dieser Klick zeichnet dann neu.
    if(!el.isConnected||!ui.edit||ui.edit.z!==el.dataset.z||ui.edit.k!==el.dataset.k)return;
    const r=uebernimmZelle(el),z=zeileVon(el.dataset.z);
    setTimeout(()=>{
      if(!ui.edit||ui.edit.z!==el.dataset.z||ui.edit.k!==el.dataset.k)return;
      ui.edit=null;renderListe();if(r==='dialog'&&z)entscheidungDialog(z);
    },0);
    return;
  }
  if(el.matches('input[data-feld],textarea[data-feld]')){if(feldAusPanel(el))spaeterRendern()}
  else if(el.matches('input[data-opt]')){if(optionFeld(el))spaeterRendern()}
  else if(el.matches('[data-vmeta]'))vmeta(el);
  else if(el.matches('textarea[data-vfeld]')&&ui.ansicht==='vorlage'){const d=root.querySelector('.pd-druck');const v=vorlageZeile();if(d&&v)d.innerHTML=htmlAusBloecken(K.vorlageBloecke(inhaltVon(v)))}
});
root.addEventListener('keydown',e=>{
  const el=e.target;
  if(el.matches('[data-edit]')){
    if(e.key==='Escape'){e.preventDefault();ui.edit=null;ui.meldung='';renderListe();return}
    if(e.key==='Tab'){e.preventDefault();bestaetige(el,{weiter:e.shiftKey?-1:1});return}
    if(e.key==='Enter'&&!(el.tagName==='TEXTAREA'&&e.shiftKey)){e.preventDefault();bestaetige(el,{weiter:1});return}
    return;
  }
  if(el.matches('[data-neu]')&&e.key==='Enter'){
    e.preventDefault();const text=el.value.trim();if(!text)return;el.disabled=true;
    void sicher(async()=>{
      const art=ui.art,dok=await sichereDokument(art);
      const d={...K.leereZeile(art,{runde:dok?.meta?.runde||''}),[NEU_FELD[art]]:text};
      const z=await neueZeile(art,d);
      ui.edit={z:z.id,k:naechsteZelle(art,z,NEU_FELD[art],1)||NEU_FELD[art]};renderListe();
    });
    return;
  }
  if(el.matches('td[data-k]')&&e.key==='Enter'){el.click()}
});
function feldAusPanel(el){
  const z=zeileVon(el.dataset.z),art=artVon(z?.dokument_id);if(!z||!art)return false;
  const key=el.dataset.feld;
  let wert=el.value;
  if(el.dataset.typ==='datum'){const iso=K.leseDatum(wert);if(iso===null){meldung('Datum bitte als TT.MM.JJJJ eingeben.','warn');return false}wert=iso}
  if(art==='entscheidungsliste'&&key==='status'&&wert==='entschieden'&&z.daten.status!=='entschieden'){el.value=z.daten.status||'';entscheidungDialog(z);return false}
  if(gleich(z.daten[key],wert))return false;
  if(!setze(art,z,key,wert)){el.value=z.daten[key]??'';return false}
  return true;
}
function optionFeld(el){
  const z=zeileVon(el.dataset.z);if(!z)return false;
  const o=K.optionen(z.daten).map(x=>({...x}));const i=Number(el.dataset.opt);if(!o[i])return false;
  const k=el.dataset.ofeld;
  if(gleich(o[i][k],el.value))return false;
  o[i][k]=el.value;
  // Eine von Hand geänderte Zahl hat nicht mehr die Fundstelle der übernommenen.
  if(k==='kennwert')Object.assign(o[i],{kennwert_quelle:'',kennwert_beleg:''});
  if(k==='menge')Object.assign(o[i],{menge_quelle:'',menge_beleg:'',kobe_ref:''});
  return setze('entscheidungsliste',z,'optionen',o);
}
function vmeta(el){
  const v=vorlageZeile();if(!v)return;
  let wert=el.value;
  if(el.dataset.vmeta==='besprechung_am'){const iso=K.leseDatum(wert);if(iso===null){meldung('Datum bitte als TT.MM.JJJJ eingeben.','warn');return}wert=iso}
  if(gleich(v.daten[el.dataset.vmeta],wert))return;
  v.daten={...v.daten,[el.dataset.vmeta]:wert};markiere(v);
  if(istMappe(v)){spaeterRendern();return}
  const d=root.querySelector('.pd-druck');if(d)d.innerHTML=htmlAusBloecken(K.vorlageBloecke(inhaltVon(v)));
}
async function punktNeu(id){
  const v=vorlageZeile(),z=zeileVon(id);if(!v||!z)return;
  v.daten={...v.daten,punkte:[...(v.daten.punkte||[]),id]};markiere(v);
  z.daten={...z.daten,vorlage_id:v.id};markiere(z);renderVorlage();
}
async function punktWeg(id){
  const v=vorlageZeile(),z=zeileVon(id);if(!v)return;
  v.daten={...v.daten,punkte:(v.daten.punkte||[]).filter(x=>x!==id)};markiere(v);
  if(z&&z.daten.vorlage_id===v.id){const d={...z.daten};delete d.vorlage_id;z.daten=d;markiere(z)}
  if(ui.detail===id)ui.detail=null;
  renderVorlage();
}
async function loeschen(z){
  if(!z)return;const art=artVon(z.dokument_id);
  if(!window.confirm(K.DOKUMENTE[art].zeile+' '+K.nummer(art,z.nr)+' wirklich löschen? Im Verlauf bleibt sie sichtbar.'))return;
  if(z.timer){clearTimeout(z.timer);z.timer=null}
  const {error}=await sb.from('office_projektdokument_zeilen').delete().eq('id',z.id);
  if(error)throw error;
  zeilen[art]=zeilen[art].filter(x=>x!==z);
  for(const k of zeilen.klaerungsliste)if(k.daten.entscheidung_id===z.id){const d={...k.daten};delete d.entscheidung_id;k.daten=d;markiere(k)}
  for(const v of zeilen.entscheidungsvorlagen)if((v.daten.punkte||[]).includes(z.id)){v.daten={...v.daten,punkte:v.daten.punkte.filter(x=>x!==z.id)};markiere(v)}
  ui.detail=null;ui.auswahl.delete(z.id);meldung(K.DOKUMENTE[art].zeile+' '+K.nummer(art,z.nr)+' gelöscht.');render();
}
window.addEventListener('beforeunload',e=>{
  if(ungespeichert()){void alleSpeichern();e.preventDefault();e.returnValue=''}
});

void start();
})();
