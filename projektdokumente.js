/* TBA Office · Projektstart · Dokumente des Projekts (24.11.2026, Claude, Auftrag Gari; Entwurf vom 24.11. freigegeben).
   Die Bürovorlagen LPH 3 werden Dokumente des Projekts: Klärungsliste und Entscheidungsliste wie im Büro-Excel (jede
   Spalte mit Typ, kompakt oder alle Spalten, Filter, Bearbeiten in der Zelle, Details mit Verlauf), dazu die
   Entscheidungsvorlage als Text mit festen Abschnitten. Ausgabe als Excel, Word und PDF (Drucken).
   Daten: office_projektdokumente und office_projektdokument_zeilen (jede Zeile mit eigener Serverrevision; bei
   gleichzeitiger Bearbeitung werden die Felder zusammengeführt, K.zusammenfuehren). Den Verlauf schreibt die Datenbank.
   Eine Klärung mit Verantwortlichem und Frist wird eine Aufgabe im Planner; ein Entscheidungspunkt des Auftraggebers
   wird eine Entscheidung; eine Entscheidung kommt in eine Vorlage. «entschieden» setzt nur das Projektteam, mit Datum,
   Entscheider und Entscheidung. Das Muster bleibt projektstart.html mit den Bürovorlagen zum Herunterladen. */
(()=>{
'use strict';
const K=window.TBA_PROJEKTDOKUMENTE,X=window.TBA_PROJEKTDOKUMENTE_EXPORT,OFFICE=window.TBA_OFFICE_CONFIG;
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
  verlauf:null,edit:null,meldung:'',meldungArt:'info',staende:null,spaeter:new Set()};
const speicher={laeuft:0,fehler:''};
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
  if(vorlage){ui.ansicht='vorlage';ui.vorlage=vorlage;ui.staende=null;render();void ladeStaende(vorlage)}
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
  if(!ids.length)return;
  const {data,error}=await sb.from('office_projektdokument_zeilen').select(ZEILE).in('dokument_id',ids).order('nr');
  if(error)throw error;
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
  const vorlagen=zeilen.entscheidungsvorlagen;
  const projektwahl='<label class="pd-projekt"><span>Projekt</span><select data-act="projekt">'+projekte.filter(p=>p.status==='aktiv'&&darf(p)).map(p=>
    '<option value="'+esc(p.id)+'"'+(p.id===projekt.id?' selected':'')+'>'+esc(p.number+' · '+p.name)+'</option>').join('')+'</select></label>';
  const karte=(art,code,zahlen,extra)=>{
    const da=!!dokumente[art];
    return '<article class="card pd-karte"><div class="pd-karte-kopf"><h3>'+esc(K.DOKUMENTE[art].kurz)+(art==='klaerungsliste'?' · Koordination':'')+'</h3><span class="pd-code">'+esc(code)+'</span></div>'+
      '<p class="pd-karte-zahl">'+(da?esc(K.zusammenfassung(art,zahlen)):'Noch nicht angelegt.')+'</p>'+(extra||'')+
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
    folgt('Projektstartvermerk','L3.PSV.1 · M00','Projektdaten, Beteiligte, Termine und Vereinbarungen zum Start')+
    folgt('Kick-off Fachplanung','L3.A1.ABS','Tagesordnung und Protokoll des Kick-offs mit den Fachplanern')+
    '</div></section>'+
    '<section class="pd-abschnitt"><h2>So hängt es zusammen</h2><ol class="pd-kette">'+
    [['Eingang','Protokoll, Mail oder Plan im Schreibtisch des Projekts'],
     ['Romy schlägt vor','neue Zeilen und Änderungen, jede mit Fundstelle; nichts ohne «Übernehmen» (kommt als Nächstes)'],
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
function zelle(art,z,sp){
  const romy=Array.isArray(z.daten._romy)&&z.daten._romy.includes(sp.key);
  if(ui.edit&&ui.edit.z===z.id&&ui.edit.k===sp.key)return '<td class="pd-c pd-c-edit pd-t-'+sp.typ+'">'+editor(art,z,sp)+'</td>';
  return '<td class="pd-c pd-t-'+sp.typ+(romy?' pd-romy':'')+'" data-z="'+z.id+'" data-k="'+sp.key+'">'+zellInhalt(art,z,sp)+(romy?'<span class="pd-r" title="von Romy vorgeschlagen und übernommen">R</span>':'')+'</td>';
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
    '<button type="button" class="btn" data-act="spalten" aria-pressed="'+ui.alleSpalten+'">'+(ui.alleSpalten?'Kompakt':'Alle Spalten')+'</button>'+
    '<button type="button" class="btn" data-act="excel" data-art="'+art+'">Excel</button>';
  const filter='<div class="pd-filter">'+K.FILTER[art].map(([k,l])=>'<button type="button" class="chip" data-act="filter" data-f="'+esc(k)+'" aria-pressed="'+(ui.filter===k)+'">'+esc(l)+' '+fz[k]+'</button>').join('')+
    (art==='klaerungsliste'?'<label class="pd-sel"><span>Disziplin</span><select data-act="disziplin"><option value="">alle</option>'+K.DISZIPLINEN.filter(d=>d[0]!=='ALLE').map(([c,l])=>'<option value="'+c+'"'+(ui.disziplin===c?' selected':'')+' title="'+esc(l)+'">'+c+'</option>').join('')+'</select></label>'
      +'<label class="pd-sel"><span>Runde</span><select data-act="runde">'+K.RUNDEN.map(r=>'<option'+(r===runde?' selected':'')+'>'+r+'</option>').join('')+'</select></label>':'')+
    '<input type="search" class="pd-suche" id="pd-suche" data-act="suche" placeholder="Suchen" value="'+esc(ui.suche)+'" aria-label="In der Liste suchen"></div>';
  let banner='';
  if(art==='entscheidungsliste'){
    const warten=K.wartendeEntscheidungspunkte(zeilen.klaerungsliste,zeilen.entscheidungsliste).filter(z=>!ui.spaeter.has(z.id));
    const naechste=K.nummer('entscheidungsliste',(alle.reduce((m,z)=>Math.max(m,z.nr),0))+1);
    banner=warten.map(z=>'<div class="pd-banner info">In der Klärungsliste ist Nr '+z.nr+' ('+esc(K.kurz(z.daten.sachverhalt,80))+') als Entscheidungspunkt des Auftraggebers markiert, steht aber noch nicht hier.'+
      '<div class="pd-banner-actions"><button type="button" class="btn" data-act="ep-uebernehmen" data-z="'+z.id+'">Als '+esc(naechste)+' übernehmen</button><button type="button" class="btn btn-quiet" data-act="ep-spaeter" data-z="'+z.id+'">Später</button></div></div>').join('');
  }
  const auswahl=[...ui.auswahl].map(id=>alle.find(z=>z.id===id)).filter(Boolean);
  const leiste=auswahl.length?'<div class="pd-auswahl" role="region" aria-label="Auswahl"><strong>'+auswahl.length+(auswahl.length===1?' Zeile':' Zeilen')+' ausgewählt</strong>'+
    (art==='klaerungsliste'?'<button type="button" class="btn" data-act="aufgaben">Aufgaben im Planner anlegen</button><button type="button" class="btn" data-act="in-entscheidungen">In die Entscheidungsliste</button>'
      :'<button type="button" class="btn" data-act="vorlage-auswahl">Vorlage aus der Auswahl</button>')+
    '<button type="button" class="btn btn-quiet" data-act="auswahl-weg">Auswahl aufheben</button></div>':'';
  const kopfzeile='<tr><th class="pd-check"><input type="checkbox" data-act="alle" aria-label="Alle auswählen"'+(sicht.length&&sicht.every(z=>ui.auswahl.has(z.id))?' checked':'')+'></th>'+
    spalten.map(sp=>'<th class="pd-t-'+sp.typ+'" scope="col">'+esc(kopfText(art,sp))+'</th>').join('')+'</tr>';
  const reihen=sicht.map(z=>{
    const d=z.daten;
    const kl=['pd-zeile'];if(K.erledigt(art,d))kl.push('pd-erledigt');if(ui.detail===z.id)kl.push('pd-aktiv');if(K.ueberfaellig(art,d))kl.push('pd-ueber');
    return '<tr class="'+kl.join(' ')+'" data-zeile="'+z.id+'"><td class="pd-check"><input type="checkbox" data-act="waehle" data-z="'+z.id+'" aria-label="Zeile '+esc(K.nummer(art,z.nr))+' auswählen"'+(ui.auswahl.has(z.id)?' checked':'')+'></td>'+
      spalten.map(sp=>zelle(art,z,sp)).join('')+'</tr>';
  }).join('');
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
  return '<div class="pd-optionen">'+opts.map((o,i)=>'<div class="pd-option"><div class="pd-option-kopf"><strong>Variante '+esc(o.id)+'</strong><button type="button" class="pd-link" data-act="option-weg" data-z="'+z.id+'" data-i="'+i+'">entfernen</button></div>'+
    f(i,'text','Beschreibung')+'<div class="pd-option-zahlen">'+f(i,'produkt','Produkt','z. B. BO-01')+f(i,'kennwert','Kennwert netto','€/m²')+f(i,'menge','Menge','m²')+f(i,'betrag','Betrag netto','leer: Kennwert × Menge')+'</div>'+
    f(i,'quelle','Quelle der Zahlen','z. B. Kostenberechnung, KG …')+'<div class="pd-option-zahlen">'+f(i,'kosten','Kosten')+f(i,'termine','Termine')+f(i,'qualitaet','Qualität · Gestaltung')+f(i,'genehmigung','Genehmigung')+'</div></div>').join('')+
    '<button type="button" class="btn" data-act="option-neu" data-z="'+z.id+'">+ Variante</button></div>';
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
    const romy=x.quelle==='romy'?' · Vorschlag von Romy, übernommen von '+esc(wer):' · '+esc(wer);
    if(x.vorgang==='angelegt')return '<li><span>'+esc(wann)+'</span> angelegt'+romy+'</li>';
    return '<li><span>'+esc(wann)+'</span> '+esc(K.feldName(art,x.feld))+': '+esc(wertText(art,x.feld,x.neu))+' <span class="pd-mute">(vorher '+esc(wertText(art,x.feld,x.alt))+')</span>'+romy+'</li>';
  }).join('')+'</ol>';
}
async function ladeVerlauf(z){
  ui.verlauf={id:z.id,eintraege:[],laedt:true};
  const {data,error}=await sb.from('office_projektdokument_aenderungen').select('id,vorgang,feld,alt,neu,quelle,user_id,created_at').eq('zeile_id',z.id).order('id',{ascending:false}).limit(60);
  ui.verlauf={id:z.id,eintraege:error?[]:(data||[]),fehler:!!error};
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
    if(b.feld&&b.punkt){
      const z=zeilen.entscheidungsliste.find(x=>x.id===b.punkt);if(!z)return htmlAusBloecken([b]);
      const romy=Array.isArray(z.daten._romy)&&z.daten._romy.includes(b.feld);
      const ta='<textarea class="dv-text'+(romy?' pd-romy':'')+'" id="v-'+z.id+'-'+b.feld+'" data-vfeld="'+b.feld+'" data-z="'+z.id+'" rows="2" placeholder="'+esc(TEXTFELDER[b.feld])+'">'+esc(z.daten[b.feld])+'</textarea>';
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
  const quellen=punkte.flatMap(z=>K.optionen(z.daten).filter(o=>o.betrag||o.kennwert||o.quelle).map(o=>{
    const b=K.betragVon(o);
    return '<li><strong>'+esc(K.nummer('entscheidungsliste',z.nr)+' · '+o.id)+'</strong> '+(b.cent!==null?esc(K.euro(b.cent))+(b.berechnet?' (Kennwert × Menge)':''):'ohne Betrag')+
      '<span>'+esc(o.quelle||'Quelle fehlt')+'</span></li>';
  }));
  const staende=ui.staende===null?'<p class="meta">wird geladen …</p>':ui.staende.length?'<ul class="pd-staende">'+ui.staende.map(s=>'<li><button type="button" class="pd-link" data-act="stand" data-id="'+s.id+'">'+esc(s.bezeichnung)+'</button><span>'+esc(K.datumLang(String(s.created_at).slice(0,10)))+' · '+esc(name(s.created_by))+'</span></li>').join('')+'</ul>'
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
    '<section class="card"><h2>Zahlen und Quellen</h2>'+(quellen.length?'<ul class="pd-quellen">'+quellen.join('')+'</ul>':'<p class="meta">Noch keine Beträge. Unter «Varianten und Details» je Variante Kennwert, Menge oder Betrag mit Quelle eintragen.</p>')+'</section>'+
    '<section class="card"><h2>Wenn der Auftraggeber entschieden hat</h2><p class="meta">In der Entscheidungsliste «Entscheidung eintragen»: mit Datum und Entscheider, danach die Bestätigung in Textform. Die Vorlage zeigt dann die Entscheidung statt der Ankreuzfelder.</p></section>'+
    '<section class="card"><h2>Stände</h2>'+staende+'</section>'+
    '</aside></div><div class="pd-druck" aria-hidden="true">'+htmlAusBloecken(bl)+'</div>'+(ui.detail?detailPanel('entscheidungsliste'):'')+'</div>';
  zeichne(html,fokus);
  for(const t of root.querySelectorAll('textarea.dv-text'))wachse(t);
}
function wachse(t){t.style.height='auto';t.style.height=Math.max(t.scrollHeight,44)+'px'}
async function ladeStaende(vid){
  const {data,error}=await sb.from('office_projektdokument_staende').select('id,bezeichnung,inhalt,created_by,created_at').eq('zeile_id',vid).order('created_at',{ascending:false});
  ui.staende=error?[]:(data||[]);
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
  const inh=inhaltVon(v);
  dialog.innerHTML='<form method="dialog" class="pd-dlg"><h2>Vorlage '+esc(inh.nr)+' vorlegen</h2>'+
    '<p>Der Stand wird festgehalten und bleibt unverändert. Die Entscheidungen der Vorlage stehen danach in der Entscheidungsliste als «vorgelegt», mit diesem Datum.</p>'+
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
  const inh=inhaltVon(v,am);
  const {error}=await sb.from('office_projektdokument_staende').insert({dokument_id:dokumente.entscheidungsvorlagen.id,zeile_id:v.id,
    bezeichnung:'Vorlage '+inh.nr+' · vorgelegt am '+K.datumLang(am),inhalt:inh,html:htmlAusBloecken(K.vorlageBloecke(inh))});
  if(error)throw error;
  meldung('Vorgelegt; der Stand ist festgehalten.');
  ui.staende=null;render();void ladeStaende(v.id);
}
function standDialog(id){
  const s=(ui.staende||[]).find(x=>x.id===id);if(!s)return;
  dialog.innerHTML='<div class="pd-dlg pd-dlg-breit"><div class="pd-detail-kopf"><h2>'+esc(s.bezeichnung)+'</h2><button type="button" class="pd-x" data-dlg="zu" aria-label="Schließen">×</button></div>'+
    '<p class="meta">Festgehalten am '+esc(K.datumLang(String(s.created_at).slice(0,10)))+' von '+esc(name(s.created_by)||'jemandem')+'; dieser Stand ändert sich nicht.</p>'+
    '<div class="pd-papier pd-papier-stand">'+htmlAusBloecken(K.vorlageBloecke(s.inhalt||{punkte:[],projekt:{}}))+'</div></div>';
  dialog.querySelector('[data-dlg="zu"]').onclick=()=>dialog.close();
  dialog.showModal();
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
  else if(act==='loeschen')void sicher(()=>loeschen(zeileVon(el.dataset.z)));
  else if(act==='word'){const v=vorlageZeile();if(v)void sicher(()=>word(v))}
  else if(act==='drucken')void sicher(async()=>{await alleSpeichern();renderVorlage();window.print()});
  else if(act==='vorlegen'){const v=vorlageZeile();if(v)vorlegenDialog(v)}
  else if(act==='stand')standDialog(el.dataset.id);
  else if(act==='punkt-details'){const z=zeileVon(el.dataset.z);if(z){ui.detail=z.id;ui.verlauf=null;renderVorlage()}}
  else if(act==='punkt-weg')void sicher(()=>punktWeg(el.dataset.z));
});
root.addEventListener('change',e=>{
  if(zeichnet)return;
  const el=e.target;
  if(el.matches('[data-act="projekt"]')){ui.meldung='';gehe({projekt:el.value});return}
  if(el.matches('[data-act="disziplin"]')){ui.disziplin=el.value;renderListe();return}
  if(el.matches('[data-act="runde"]')){void sicher(async()=>{await sichereDokument('klaerungsliste');await setzeMeta('klaerungsliste',{runde:el.value});renderListe()});return}
  if(el.matches('[data-act="punkt-neu"]')){if(el.value)void sicher(()=>punktNeu(el.value));return}
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
  if(gleich(o[i][el.dataset.ofeld],el.value))return false;
  o[i][el.dataset.ofeld]=el.value;
  return setze('entscheidungsliste',z,'optionen',o);
}
function vmeta(el){
  const v=vorlageZeile();if(!v)return;
  let wert=el.value;
  if(el.dataset.vmeta==='besprechung_am'){const iso=K.leseDatum(wert);if(iso===null){meldung('Datum bitte als TT.MM.JJJJ eingeben.','warn');return}wert=iso}
  if(gleich(v.daten[el.dataset.vmeta],wert))return;
  v.daten={...v.daten,[el.dataset.vmeta]:wert};markiere(v);
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
