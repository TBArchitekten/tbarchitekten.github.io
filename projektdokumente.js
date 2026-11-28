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
   Produkt im Projekt frei.
   Mustermappe als eigenes Werkzeug (25.11.2026, Gari): ?werkzeug=mustermappe zeigt je Projekt die Mappen (Tools ›
   Mustermappe), nicht mehr eine Karte im Projektstart. Als Reiter in Work läuft die Seite in einem Rahmen: ohne
   Rücksprung in die App, mit TBA_OFFICE_TOOL (Revision der Mappe, Speichern auf Zuruf) und ?neu=1 zum Anlegen.
   Weitere Listen (28.11.2026, Gari: die Listen des Projektstarts im Projekt bearbeiten wie die Entscheidungsliste, statt
   ein Excel herunterzuladen): Fachplanerbedarf, Schnittstellen, Fragenliste und Eingang, gleich bearbeitet (Zelle,
   Filter, Details mit Verlauf, Excel). Angelegt werden sie mit den Zeilen der Bürovorlage (projektdokumente-vorlagen.js)
   oder leer; danach gehören sie dem Projekt. Termine als Meilenstein: das Datum kommt aus dem Terminplan des Projekts. */
(()=>{
'use strict';
const K=window.TBA_PROJEKTDOKUMENTE,X=window.TBA_PROJEKTDOKUMENTE_EXPORT,OFFICE=window.TBA_OFFICE_CONFIG;
const Z=window.TBA_PROJEKTDOKUMENTE_ZAHLEN,R=window.TBA_KOSTEN_RECHNEN,P=window.TBA_KOSTEN_POOL;
// Vorbelegung der weiteren Listen aus der Bürovorlage.
const V=window.TBA_PD_VORLAGEN||{};
const sb=window.MINDS_SUPABASE||(window.supabase&&OFFICE?window.supabase.createClient(OFFICE.url,OFFICE.key,
  {auth:{storageKey:OFFICE.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null);
const inApp=!!window.WINDOW_NATIVE?.available;
// Als Reiter in Work (Rahmen): nie die Startseite oder die App im Rahmen öffnen.
const IM_REITER=window.self!==window.top;
const root=document.getElementById('pd'),dialog=document.getElementById('pdDialog');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kopie=x=>JSON.parse(JSON.stringify(x??{}));
const gleich=(a,b)=>JSON.stringify(a??'')===JSON.stringify(b??'');
const ZEILE='id,dokument_id,nr,daten,server_revision,created_by,updated_by,created_at,updated_at,quelle';
const DOK='id,art,owner_id,meta,server_revision,updated_at';
const LETZTES='tba.office.projektdokumente.projekt';
const LISTEN=['klaerungsliste','entscheidungsliste',...K.WEITERE];
// Romy liest und schlägt vor für diese beiden Listen (office-dokumente-ai).
const MIT_ROMY=['klaerungsliste','entscheidungsliste'];
// Kompakte Ansicht wie im Entwurf: 8 Spalten je Liste (die Entscheidungsliste mit der Spalte «Vorlage»). Die weiteren
// Listen: die im Kern als kompakt markierten Spalten.
const KOMPAKT={klaerungsliste:['nr','disziplinen','ort','sachverhalt','verantwortlich','frist','status','ag'],
  entscheidungsliste:['nr','thema','frage','optionen','bis','status','entscheidung','_vorlage'],
  ...Object.fromEntries(K.WEITERE.map(a=>[a,K.SPALTEN[a].filter(sp=>sp.kompakt).map(sp=>sp.key)]))};
const VORLAGE_SPALTE={key:'_vorlage',kopf:'Vorlage',typ:'vorlage'};
// Die neue Zeile: Feld, das eingetippt wird, die Spalte dafür (im Eingang steht die Disziplin in der ersten Spalte) und der Hinweis.
const NEU_FELD={klaerungsliste:'sachverhalt',entscheidungsliste:'thema',fachplanerbedarf:'disziplin',schnittstellen:'thema',fragenliste:'frage',eingang:'disziplin'};
const NEU_SPALTE={eingang:'nr'};
const NEU_TEXT={klaerungsliste:'Sachverhalt',entscheidungsliste:'Thema',fachplanerbedarf:'Disziplin',schnittstellen:'Thema oder Bauteil',fragenliste:'Frage',eingang:'Disziplin (z. B. GEO)'};
const NEU_KNOPF={klaerungsliste:'Zeile',entscheidungsliste:'Entscheidung',fachplanerbedarf:'Disziplin',schnittstellen:'Schnittstelle',fragenliste:'Frage',eingang:'Disziplin'};
// Was die Bürovorlage in einer Liste vorbereitet hat (Text der Karte «Anlegen») und wann die Liste im Ablauf dran ist.
const VORLAGE_TEXT={
  fachplanerbedarf:'je Disziplin das Leistungsbild, wann sie in der Regel erforderlich ist, und ein Vorschlag für den Umfang in LPH 3',
  schnittstellen:'Grundlagen, Themen und Bauteile, Zuarbeit: je Thema ein Vorschlag, wer plant, koordiniert, mitwirkt und Angaben liefert, dazu Lieferung und Format',
  fragenliste:'je Disziplin die Fragen für das Paket der Planungsgrundlagen (M01) und den Kick-off (M02), mit Zweck, Grundlage und Termin',
  eingang:'je Disziplin der Lieferumfang für Arbeitsstand 01 (M03) und Endstand (M07), als Vorschlag für den Kick-off'};
const WANN={fachplanerbedarf:[['Entscheidung bis','M00A']],schnittstellen:[['v0 mit','M01'],['v1 im Kick-off','M02']],
  fragenliste:[['mit','M01'],['beantwortet bis','M02']],eingang:[['Arbeitsstand 01','M03'],['Endstand','M07']]};
const HINWEIS={
  fachplanerbedarf:'Entscheidungshilfe für den Auftraggeber: je Disziplin «erforderlich?», die Begründung für das Projekt und die Empfehlung des Büros. Die Beauftragung ist Sache des Auftraggebers.',
  schnittstellen:K.LEGENDE.map(([k,t])=>k+' '+t).join(' · '),
  fragenliste:'Fragen ohne Bezug zum Projekt auf «entfällt» setzen, nicht löschen. Zum Versand an eine Fachplanung nach Disziplin filtern: die Liste zeigt dann ihre Fragen und die an alle.',
  eingang:'Erwartet werden die Beiträge zu den Meilensteinen des Terminplans (M03 und M07); «Stand» ergibt sich aus Eingang, Vollständigkeit und Rückmeldung.'};

let nutzer=null,mitglied=null,mitglieder=[],projekte=[],team=[];
let projekt=null,dokumente={},zeilen=leer(),aufgaben=new Map(),geladenUm=0;
const ui={ansicht:'',werkzeug:'',art:'',vorlage:null,filter:'alle',disziplin:'',suche:'',alleSpalten:false,auswahl:new Set(),detail:null,
  verlauf:null,edit:null,meldung:'',meldungArt:'info',staende:null,spaeter:new Set(),romyText:null,ablauf:null};
const speicher={laeuft:0,fehler:''};
const VORSCHLAG='id,dokument_id,zeile_id,art,daten,fundstelle,begruendung,quelle,created_by,created_at';
const romy={bereit:false};
let vorschlaege=[];
const offene=art=>vorschlaege.filter(v=>artVon(v.dokument_id)===art);
function leer(){return Object.fromEntries(K.ARTEN.map(a=>[a,[]]))}
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
  if(error||!session){if(inApp){void window.WINDOW_NATIVE.call('session.signIn');fehler('Bitte in der App anmelden.');return}
    if(IM_REITER){fehler('Bitte in TBA Office neu anmelden.');return}
    location.href='./';return}
  nutzer=session.user;
  const {data:m,error:me}=await sb.from('office_members').select('user_id,role,display_name,is_active,must_change_password')
    .eq('user_id',nutzer.id).eq('is_active',true).maybeSingle();
  if(me||!m){fehler('Kein Zugriff auf TBA Office.');return}
  if(m.must_change_password){if(inApp||IM_REITER){fehler('Bitte zuerst im Browser auf tbarchitekten.github.io das Startpasswort ändern.');return}location.href='./';return}
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
    romy.pruefung=romy.pruefung||romyStatus();
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
  ui.werkzeug=p.get('werkzeug')==='mustermappe'?'mustermappe':'';
  if(!pid){
    let letztes='';try{letztes=localStorage.getItem(LETZTES)||''}catch{}
    const ziel=projekte.find(x=>x.id===letztes&&x.status==='aktiv'&&darf(x));
    if(ziel){gehe({werkzeug:ui.werkzeug,projekt:ziel.id},{ersetzen:true});return}
    zeigeProjektwahl();return;
  }
  if(!projekt||projekt.id!==pid){
    projekt=projekte.find(x=>x.id===pid)||null;ui.detail=null;
    if(!projekt){fehler('Projekt nicht gefunden.');return}
    if(!darf(projekt)){zeigeProjektwahl('Die Dokumente eines Projekts sieht das Projektteam und die Projektleitung. Für «'+projekt.number+' '+projekt.name+'» bist du nicht eingetragen.');return}
    root.innerHTML='<div class="pd-wrap"><p class="meta">Dokumente werden geladen …</p></div>';
    await ladeProjekt();
    ui.ablauf=ablaufLesen();
  }
  const liste=p.get('liste'),vorlage=p.get('vorlage');
  if(vorlage){
    const v=zeilen.entscheidungsvorlagen.find(x=>x.id===vorlage);
    ui.ansicht=istMappe(v)?'mappe':'vorlage';ui.vorlage=vorlage;ui.staende=null;
    if(ui.ansicht==='mappe'&&mm.offen!==vorlage){mm.offen=vorlage;mm.seite=null;mm.geladen=''}
    render();void ladeStaende(vorlage);
  }
  else if(ui.werkzeug){
    ui.ansicht='mappen';ui.detail=null;
    // ?neu=1 (Reiter «Mustermappe» in Work, «Mustermappe anlegen»): einmal den Dialog, das Neuladen öffnet ihn nicht wieder.
    const neu=p.get('neu')==='1';
    if(neu)history.replaceState(null,'',url({werkzeug:ui.werkzeug,projekt:pid}));
    if(neu&&IM_REITER)zeichne('<div class="pd-wrap"><p class="meta">Neue Mustermappe …</p></div>',null);else render();
    if(neu)neueMappeDialog();
  }
  else if(LISTEN.includes(liste)){
    if(ui.art!==liste){ui.filter='alle';ui.disziplin='';ui.suche='';ui.detail=null}
    ui.ansicht='liste';ui.art=liste;render();
  }else{
    ui.ansicht='uebersicht';ui.detail=null;render();
    // ?ablauf=besprechung (aus dem Panorama): einmal den Dialog, das Neuladen öffnet ihn nicht wieder.
    if(p.get('ablauf')==='besprechung'){history.replaceState(null,'',url({projekt:pid}));void (romy.pruefung||(romy.pruefung=romyStatus())).then(()=>besprechungDialog())}
  }
}
async function ladeProjekt(){
  dokumente={};zeilen=leer();aufgaben=new Map();K.setzeTermine({});termineDa=false;
  const {data:docs,error}=await sb.from('office_projektdokumente').select(DOK).eq('project_id',projekt.id);
  if(error)throw error;
  for(const d of docs||[])dokumente[d.art]=d;
  await Promise.all([ladeZeilen(),ladeTermine()]);
  try{localStorage.setItem(LETZTES,projekt.id)}catch{}
}
// Daten der Meilensteine (M00 … M11) aus dem Terminplan des Projekts: der Plan der LPH 3 zuerst, sonst der zuletzt
// geänderte. Nur gelesen; geändert wird ein Termin im Terminplan.
let termineDa=false;
async function ladeTermine(){
  const {data,error}=await sb.from('office_terminplan_instances').select('phase,state,updated_at').eq('project_id',projekt.id)
    .eq('is_archived',false).order('updated_at',{ascending:false}).limit(10);
  if(error){console.warn('Terminplan',error);return}
  const liste={};
  const plaene=[...(data||[])].sort((a,b)=>Number(b.phase==='LPH3')-Number(a.phase==='LPH3'));
  for(const p of plaene)for(const t of Array.isArray(p.state?.tasks)?p.state.tasks:[]){
    if(t?.type!=='milestone')continue;
    const m=/^(M\d{2}[A-Z]?)(?![A-Za-z0-9])/.exec(String(t.name||'').trim()),tag=String(t.start||'').slice(0,10);
    if(m&&K.gueltigIso(tag)&&!(m[1] in liste))liste[m[1]]=tag;
  }
  K.setzeTermine(liste);termineDa=Object.keys(liste).length>0;
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
    await Promise.all([ladeZeilen(),ladeTermine()]);
    // Nicht mitten im Ziehen oder Zuschneiden einer Mustermappe neu zeichnen.
    if(!ui.edit&&!mm.zug&&!mm.zuschnitt)render();
  }catch(e){console.warn('Auffrischen',e)}
}

// ---------- Speichern ----------
function meldung(text,art='info'){ui.meldung=text;ui.meldungArt=art;zeigeMeldung()}
// Im Reiter von Work schwebt die Meldung über der Mappe (sie verschiebt die Bühne nicht) und geht nach einigen Sekunden.
let meldungUhr=null;
function zeigeMeldung(){
  const el=root.querySelector('[data-meldung]');if(!el)return;
  el.className='pd-meldung'+(ui.meldung?' '+ui.meldungArt:'');el.textContent=ui.meldung||'';
  clearTimeout(meldungUhr);
  if(IM_REITER&&ui.meldung&&ui.ansicht==='mappe')meldungUhr=setTimeout(()=>{ui.meldung='';zeigeMeldung()},ui.meldungArt==='warn'?12000:6000);
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
        if(!srv){zeilen[art]=zeilen[art].filter(x=>x!==z);meldung(K.DOKUMENTE[art].zeile+' '+K.nummer(art,z.nr,z.daten)+' wurde inzwischen gelöscht.','warn');render();break}
        const m=K.zusammenfuehren(z.basis,z.daten,srv.daten||{});
        z.daten=m.daten;z.basis=kopie(srv.daten);z.rev=srv.server_revision;
        if(m.kollisionen.length)meldung(K.nummer(art,z.nr,z.daten)+': '+m.kollisionen.map(k=>'«'+K.feldName(art,k)+'»').join(', ')+' wurde gleichzeitig von '+(name(srv.updated_by)||'jemand anderem')+' geändert; deine Eingabe gilt.','warn');
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
// Eine weitere Liste anlegen: mit den Zeilen der Bürovorlage (in einem Schritt, die Datenbank nummeriert in dieser
// Reihenfolge) oder leer. Hat die Liste inzwischen Zeilen (jemand anderes war schneller), bleibt es bei denen.
async function anlegen(art,{vorlage=false}={}){
  const dok=await sichereDokument(art);
  if(vorlage){
    const {data:da,error:e1}=await sb.from('office_projektdokument_zeilen').select('id').eq('dokument_id',dok.id).limit(1);
    if(e1)throw e1;
    if(da&&da.length){await ladeZeilen();meldung('Die Liste hat inzwischen schon Zeilen; die Vorlage wurde nicht noch einmal eingefügt.','warn');render();return}
    const reihen=(V[art]||[]).map(d=>({dokument_id:dok.id,daten:kopie(d)}));
    if(reihen.length){
      const {data,error}=await sb.from('office_projektdokument_zeilen').insert(reihen).select(ZEILE);
      if(error)throw error;
      zeilen[art]=(data||[]).map(lokal).sort((a,b)=>a.nr-b.nr);
    }
    meldung(K.DOKUMENTE[art].kurz+' mit '+reihen.length+' '+(reihen.length===1?K.DOKUMENTE[art].zeile:K.DOKUMENTE[art].zeilen)+' der Bürovorlage angelegt.');
  }
  render();
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
  // Weitere Listen: was man in der Vorlage von Hand mitändern würde.
  if(art==='fragenliste'){
    if(key==='status'&&wert==='beantwortet'&&!d.beantwortet_am)d.beantwortet_am=heute();
    if(key==='antwort'&&String(wert||'').trim()&&!String(z.daten.antwort||'').trim()&&d.status==='offen'){d.status='beantwortet';if(!d.beantwortet_am)d.beantwortet_am=heute()}
    if(key==='disziplin'&&wert&&!String(d.code||'').trim())d.code=K.naechsterCode(zeilen.fragenliste,wert);
  }
  if(art==='fachplanerbedarf'){
    if(key==='beauftragt'&&wert==='ja')d.status='beauftragt';
    if(key==='beauftragt'&&wert==='angefragt'&&d.status==='offen')d.status='angefragt';
    if(key==='status'&&wert==='beauftragt')d.beauftragt='ja';
    if(key==='erforderlich'&&wert==='nein'&&d.status==='offen')d.status='entfällt';
  }
  // Nach der Abstimmung (v1) ist jede Änderung an Zuständigkeit oder Lieferung eine Änderung des abgestimmten Stands.
  if(art==='schnittstellen'&&d.status==='v1 abgestimmt'&&/^(z_|liefert$|format$|lieferung)/.test(key))d.status='geändert';
  const p=K.pruefe(art,d);
  if(p){meldung(p,'warn');return false}
  z.daten=d;markiere(z);return true;
}

// ---------- Ansicht: Rahmen ----------
function kopf({zurueck,kicker,titel,meta='',aktionen='',intro=''}){
  return '<a class="pd-back" href="'+esc(zurueck[0])+'" data-nav>'+esc(zurueck[1])+'</a>'+
    '<header class="pd-head"><div class="pd-head-text"><p class="kicker">'+esc(kicker)+'</p><h1>'+esc(titel)+'</h1>'+
    (intro?'<p class="pd-intro">'+intro+'</p>':'')+(meta?'<p class="meta">'+meta+'</p>':'')+'</div>'+
    (aktionen?'<div class="pd-actions">'+aktionen+'</div>':'')+'</header>'+meldungHtml();
}
function meldungHtml(){return '<p class="pd-meldung'+(ui.meldung?' '+ui.meldungArt:'')+'" data-meldung role="status" aria-live="polite">'+esc(ui.meldung)+'</p>'}
const projektName=()=>projekt?projekt.number+' · '+projekt.name:'';
const url=p=>'?'+new URLSearchParams(Object.entries(p).filter(([,v])=>v)).toString();
function render(){
  document.title='TBA Office · '+(['mappe','mappen'].includes(ui.ansicht)?'Mustermappe':'Projektstart');
  if(ui.ansicht==='liste')renderListe();
  else if(ui.ansicht==='vorlage')renderVorlage();
  else if(ui.ansicht==='mappe')renderMappe();
  else if(ui.ansicht==='mappen')renderMappen();
  else renderUebersicht();
}
// Neu zeichnen, ohne Eingaben zu verlieren. Chrome meldet beim Ersetzen des DOM noch change und focusout der alten
// Felder; die gelten nicht (zeichnet). Was im Feld mit dem Fokus steht, wandert als Text ins neue Feld (feste ids);
// übernommen wird es erst beim Verlassen des Felds.
let zeichnet=false;
// Text direkt auf der Seite (contenteditable, 26.11.2026): Wert und Cursor bleiben beim Neuzeichnen, wie bei Feldern.
function textPos(el){
  const sel=window.getSelection();if(!sel||!sel.rangeCount)return null;
  const r=sel.getRangeAt(0);if(!el.contains(r.startContainer)||!el.contains(r.endContainer))return null;
  const vor=document.createRange();vor.selectNodeContents(el);vor.setEnd(r.startContainer,r.startOffset);const a=vor.toString().length;
  vor.setEnd(r.endContainer,r.endOffset);return [a,vor.toString().length];
}
function setzeTextPos(el,pos){
  if(!pos)return;
  const stelle=n=>{const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let rest=n,t;while((t=w.nextNode())){if(rest<=t.length)return [t,rest];rest-=t.length}return [el,el.childNodes.length]};
  try{const r=document.createRange(),[a,ao]=stelle(pos[0]),[b,bo]=stelle(pos[1]);r.setStart(a,ao);r.setEnd(b,bo);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r)}catch{}
}
function vorZeichnen(){
  const a=document.activeElement;
  if(!a||!root.contains(a))return null;
  const edit=a.matches('[data-edit]')?{z:a.dataset.z,k:a.dataset.k}:null;
  if(!edit&&!a.id)return null;
  if(a.isContentEditable)return {id:a.id,edit:null,text:a.innerText,pos:textPos(a)};
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
  if(gleicheStelle&&typeof fokus.text==='string'){
    if(n.isContentEditable&&n.innerText!==fokus.text)n.textContent=fokus.text;
    n.focus({preventScroll:true});setzeTextPos(n,fokus.pos);return;
  }
  if(gleicheStelle&&fokus.wert!==null&&n.value!==fokus.wert)n.value=fokus.wert;
  n.focus({preventScroll:!!fokus});
  if(gleicheStelle&&fokus.pos&&n.setSelectionRange){try{n.setSelectionRange(fokus.pos[0],fokus.pos[1])}catch{}}
  else if(editor&&n.select&&n.tagName==='INPUT')n.select();
}
let renderTimer=0;
function spaeterRendern(){clearTimeout(renderTimer);renderTimer=setTimeout(render,0)}
const MAPPE_INTRO='Je Themenpaket eine Mappe A3 quer: Positionen mit dem Code aus dem Plan, Kandidaten aus der Produktbibliothek, Texte und Bilder auf der Seite. Vorgestellt im Bemusterungstermin; entschieden wird in der Entscheidungsliste.';
function zeigeProjektwahl(hinweis=''){
  const meine=projekte.filter(p=>p.status==='aktiv'&&darf(p)),mappe=ui.werkzeug==='mustermappe';
  const fokus=vorZeichnen();
  const html='<div class="pd-wrap">'+kopf({zurueck:['./app/#section=tools','‹ Werkzeuge'],kicker:mappe?'Werkzeuge · Mustermappe':'Werkzeuge · Projektstart',titel:mappe?'Mustermappe':'Projektstart',
    intro:mappe?esc(MAPPE_INTRO):'Die Bürovorlagen werden Dokumente des Projekts: hier bearbeiten und als Word, Excel oder PDF ausgeben, wenn Fachplaner oder Bauherr sie brauchen. Das Muster bleibt, wie es ist; jedes Projekt bekommt seine eigene Fassung.',
    aktionen:mappe?'':'<a class="btn" href="./projektstart.html">Muster ansehen</a>'})+
    (hinweis?'<div class="pd-banner warn">'+esc(hinweis)+'</div>':'')+
    '<section class="card pd-wahl"><h2>Projekt wählen</h2>'+(meine.length?'<div class="pd-wahl-liste">'+meine.map(p=>
      '<a class="pd-wahl-projekt" href="'+esc(url({werkzeug:ui.werkzeug,projekt:p.id}))+'" data-nav><span class="pd-nr">'+esc(p.number)+'</span> '+esc(p.name)+'</a>').join('')+'</div>'
      :'<p class="meta">Du bist in keinem aktiven Projekt eingetragen. Die Projektleitung trägt das Team unter Werkzeuge › Projekte ein.</p>')+'</section></div>';
  zeichne(html,fokus);
}

// ---------- Übersicht ----------
// ---------- Abläufe (Gari, 27.11.2026: so umsetzen, wie vorgeschlagen) ----------
// Ein Ablauf führt durch wiederkehrende Arbeit des Büros und benutzt dabei die vorhandenen Werkzeuge. «Besprechung
// nachbereiten»: Romy liest das Protokoll einmal für die Klärungsliste und einmal für die Entscheidungsliste; danach
// prüft das Team die Vorschläge (nichts ohne «Übernehmen»), legt für neue Klärungen mit Verantwortlichem und Frist
// Aufgaben im Planner an, prüft ihre Fristen gegen den Terminplan und teilt das Ergebnis ins Projektwissen. Was zur
// Besprechung gehört, sind die Zeilen, die aus ihren Vorschlägen übernommen wurden (neu oder geändert; gemerkt beim
// Übernehmen, auch wenn sie danach von Hand weiter bearbeitet werden). Der Stand des Ablaufs bleibt in diesem Fenster,
// je Projekt.
const ablaufSchluessel=()=>'tba-office.ablauf.'+(projekt?.id||'');
function ablaufLesen(){try{const x=JSON.parse(sessionStorage.getItem(ablaufSchluessel())||'null');return x&&x.art==='besprechung'&&x.quelle?x:null}catch{return null}}
function ablaufMerken(){try{if(ui.ablauf)sessionStorage.setItem(ablaufSchluessel(),JSON.stringify(ui.ablauf));else sessionStorage.removeItem(ablaufSchluessel())}catch{}}
function ablaufZeilen(art,{geaendert=false}={}){
  const a=ui.ablauf,ids=new Set([...(a?.zeilen?.[art]||[]),...(geaendert?a?.geaendert?.[art]||[]:[])]);
  return a?zeilen[art].filter(z=>ids.has(z.id)):[];
}
function ablaufNotieren(art,id,v,geaendert=false){
  const a=ui.ablauf;if(!a||!id||v?.quelle!==a.quelle)return;
  const feld=geaendert?'geaendert':'zeilen';a[feld]=a[feld]||{};
  a[feld][art]=[...new Set([...(a[feld][art]||[]),id])];ablaufMerken();
}
const ablaufOffen=z=>!['gelöst','entfällt'].includes(z.daten.status);
function besprechungDialog(){
  if(!romy.bereit){meldung('Romy ist gerade nicht erreichbar; die Besprechung lässt sich später nachbereiten.','warn');return}
  dialog.innerHTML='<form class="pd-dlg"><h2>Besprechung nachbereiten</h2>'+
    '<p class="meta">Romy liest das Protokoll und schlägt für die Klärungsliste und die Entscheidungsliste neue Zeilen und Änderungen vor, jede mit Fundstelle. '+
    'Danach führt der Ablauf durch Aufgaben, Fristen und das Projektwissen. Nichts ändert sich, bis jemand «Übernehmen» drückt.</p>'+
    '<label class="pd-feld"><span>Besprechung</span><input class="pd-in" name="quelle" placeholder="z. B. Protokoll Jour fixe 05" required maxlength="120" autocomplete="off"></label>'+
    '<label class="pd-feld"><span>Protokoll (PDF oder Bild, bis 8 MB)</span><input class="pd-in" type="file" name="datei" accept="application/pdf,image/png,image/jpeg,image/webp"></label>'+
    '<label class="pd-feld"><span>oder Text einfügen</span><textarea class="pd-in" name="text" rows="6" placeholder="Text des Protokolls oder der Mitschrift"></textarea></label>'+
    '<label class="pd-feld"><span>Hinweis an Romy (optional)</span><input class="pd-in" name="hinweis" placeholder="z. B. nur TOP 3 bis 7" autocomplete="off"></label>'+
    '<p class="pd-dlg-fehler" data-dlg-fehler></p><div class="pd-dlg-aktionen"><button type="button" class="btn" data-dlg="abbrechen">Abbrechen</button><button type="submit" class="btn btn-primary">Protokoll lesen</button></div></form>';
  const form=dialog.querySelector('form'),f=dialog.querySelector('[data-dlg-fehler]');
  form.querySelector('[data-dlg="abbrechen"]').onclick=()=>dialog.close();
  form.onsubmit=async e=>{
    e.preventDefault();
    const datei=form.datei.files[0],text=form.text.value.trim(),quelle=form.quelle.value.trim();
    if(!datei&&!text){f.textContent='Bitte das Protokoll wählen oder Text einfügen.';return}
    if(datei&&datei.size>8*1024*1024){f.textContent='Die Datei ist größer als 8 MB.';return}
    const knopf=form.querySelector('button[type="submit"]');knopf.disabled=true;f.textContent='';
    const ablauf={art:'besprechung',quelle,texte:[],hinweise:[],n:{},zeilen:{},geaendert:{},fristen:false,geteilt:false};
    try{
      const attachments=datei?[{name:datei.name.slice(0,180),mime:datei.type,size:datei.size,data:await alsDataUrl(datei)}]:undefined;
      for(const [i,art] of ['klaerungsliste','entscheidungsliste'].entries()){
        knopf.textContent='Romy liest ('+(i+1)+' von 2) …';
        const dok=await sichereDokument(art);
        const antwort=await romyAufruf({action:'vorschlaege',dokument_id:dok.id,quelle,text,hinweis:form.hinweis.value.trim(),attachments});
        ablauf.n[art]=await vorschlaegeSpeichern(art,antwort.result.vorschlaege,antwort.quelle||quelle);
        if(antwort.result.text)ablauf.texte.push(antwort.result.text);
        ablauf.hinweise.push(...(antwort.result.hinweise||[]));
      }
      ui.ablauf=ablauf;ablaufMerken();dialog.close();ui.ansicht='uebersicht';render();
    }catch(err){f.textContent=err?.message||'Romy ist gerade nicht erreichbar.';knopf.disabled=false;knopf.textContent='Protokoll lesen'}
  };
  dialog.showModal();
}
function ablaufPanel(){
  const a=ui.ablauf;if(!a)return '';
  const vs=art=>offene(art).filter(v=>v.quelle===a.quelle).length,vk=vs('klaerungsliste'),ve=vs('entscheidungsliste');
  const kl=ablaufZeilen('klaerungsliste'),en=ablaufZeilen('entscheidungsliste');
  const fuerAufgaben=kl.filter(z=>ablaufOffen(z)&&!z.daten.aufgabe_id&&String(z.daten.verantwortlich||'').trim()&&z.daten.frist);
  const mitFrist=ablaufZeilen('klaerungsliste',{geaendert:true}).filter(z=>ablaufOffen(z)&&z.daten.frist);
  const schritt=(nr,titel,text,knopf,fertig)=>'<li class="pd-ablauf-schritt'+(fertig?' fertig':'')+'"><span class="pd-ablauf-nr" aria-hidden="true">'+(fertig?'✓':nr)+'</span>'+
    '<div><strong>'+esc(titel)+'</strong><p class="meta">'+text+'</p></div>'+(knopf?'<div class="pd-ablauf-knopf">'+knopf+'</div>':'')+'</li>';
  const liste=art=>'<a href="'+esc(url({projekt:projekt.id,liste:art}))+'" data-nav>'+esc(K.DOKUMENTE[art].kurz)+'</a>';
  return '<section class="card pd-ablauf" aria-label="Besprechung nachbereiten"><div class="pd-ablauf-kopf"><div><p class="kicker">Ablauf · Besprechung nachbereiten</p><h2>'+esc(a.quelle)+'</h2></div>'+
      '<button type="button" class="btn btn-quiet" data-act="ablauf-ende">Ablauf beenden</button></div>'+
    (a.texte.length?'<p class="pd-ablauf-romy"><strong>Romy:</strong> '+esc(a.texte.join(' '))+'</p>':'')+
    (a.hinweise.length?'<ul class="pd-ablauf-hinweise">'+a.hinweise.map(h=>'<li>'+esc(h)+'</li>').join('')+'</ul>':'')+
    '<ol class="pd-ablauf-schritte">'+
    schritt(1,'Vorschläge prüfen',vk+ve?'Offen: '+vk+' in der '+liste('klaerungsliste')+', '+ve+' in der '+liste('entscheidungsliste')+'. Jeden übernehmen oder verwerfen.'
      :'Alle Vorschläge sind übernommen oder verworfen: '+kl.length+(kl.length===1?' Klärung':' Klärungen')+' und '+en.length+(en.length===1?' Entscheidung':' Entscheidungen')+' aus dieser Besprechung.','',!(vk+ve))+
    schritt(2,'Aufgaben im Planner',fuerAufgaben.length?fuerAufgaben.length+(fuerAufgaben.length===1?' neue Klärung hat':' neue Klärungen haben')+' Verantwortliche und Frist, aber noch keine Aufgabe.'
      :'Keine neue Klärung mit Verantwortlichem und Frist ohne Aufgabe.',fuerAufgaben.length?'<button type="button" class="btn" data-act="ablauf-aufgaben">Aufgaben anlegen ('+fuerAufgaben.length+')</button>':'',!fuerAufgaben.length&&!(vk+ve))+
    schritt(3,'Fristen gegen den Terminplan',a.fristen?'Geprüft; was nicht passt, steht als Vorschlag in der '+liste('klaerungsliste')+'.':mitFrist.length?mitFrist.length+(mitFrist.length===1?' offene Klärung':' offene Klärungen')+' mit Frist aus dieser Besprechung.'
      :'Noch keine offene Klärung mit Frist aus dieser Besprechung.',mitFrist.length&&!a.fristen?'<button type="button" class="btn btn-romy" data-act="ablauf-fristen">Mit Romy prüfen</button>':'',a.fristen)+
    schritt(4,'Ins Projektwissen',a.geteilt?'Geteilt; die KI arbeitet es beim nächsten Mal in die Seiten ein.':'Das Ergebnis der Besprechung (Romys Zusammenfassung und die übernommenen Zeilen) für das Projektteam.',
      a.geteilt?'':'<button type="button" class="btn" data-act="ablauf-teilen"'+(vk+ve?' title="Erst die Vorschläge prüfen"':'')+'>Ins Projektwissen</button>',a.geteilt)+
    '</ol></section>';
}
async function ablaufTeilen(){
  const a=ui.ablauf;if(!a)return;
  await alleSpeichern();
  const zeile=(art,z)=>'- '+K.nummer(art,z.nr,z.daten)+' · '+[art==='klaerungsliste'?z.daten.sachverhalt||z.daten.ort:z.daten.thema||z.daten.frage,
    art==='klaerungsliste'?z.daten.verantwortlich:'',z.daten.frist?'bis '+K.datumLang(z.daten.frist):'',z.daten.status].map(x=>String(x||'').trim()).filter(Boolean).join(' · ');
  const kl=ablaufZeilen('klaerungsliste'),en=ablaufZeilen('entscheidungsliste');
  const inhalt=['Besprechung: '+a.quelle+' (nachbereitet am '+K.datumLang(heute())+').',a.texte.length?'Romy: '+a.texte.join(' '):'',
    kl.length?'Klärungen:\n'+kl.map(z=>zeile('klaerungsliste',z)).join('\n'):'',en.length?'Entscheidungen (offen, bis der Bauherr entscheidet):\n'+en.map(z=>zeile('entscheidungsliste',z)).join('\n'):''].filter(Boolean).join('\n\n');
  const {error}=await sb.rpc('office_wissen_beitrag_teilen',{p_project:projekt.id,p_titel:('Besprechung: '+a.quelle).slice(0,200),p_inhalt:inhalt,p_art:'notiz',p_quelle:a.quelle.slice(0,300),p_seite:null});
  if(error){meldung('Das konnte nicht ins Projektwissen gehen. Gehört Ihr Konto zum Projektteam?','warn');return}
  a.geteilt=true;ablaufMerken();meldung('Im Projektwissen geteilt; die KI arbeitet es beim nächsten Mal ein.');render();
}
function renderUebersicht(){
  const zk=K.zaehle('klaerungsliste',zeilen.klaerungsliste),ze=K.zaehle('entscheidungsliste',zeilen.entscheidungsliste);
  const warten=K.wartendeEntscheidungspunkte(zeilen.klaerungsliste,zeilen.entscheidungsliste);
  const vorlagen=zeilen.entscheidungsvorlagen.filter(v=>!istMappe(v));
  const projektwahl='<label class="pd-projekt"><span>Projekt</span><select data-act="projekt">'+projekte.filter(p=>p.status==='aktiv'&&darf(p)).map(p=>
    '<option value="'+esc(p.id)+'"'+(p.id===projekt.id?' selected':'')+'>'+esc(p.number+' · '+p.name)+'</option>').join('')+'</select></label>';
  const karte=(art,code,zahlen,extra)=>{
    const da=!!dokumente[art],ohne=K.WEITERE.includes(art)&&!zeilen[art].length;
    const vs=offene(art),quellen=[...new Set(vs.map(v=>v.quelle).filter(Boolean))];
    return '<article class="card pd-karte"><div class="pd-karte-kopf"><h3>'+esc(K.DOKUMENTE[art].kurz)+(art==='klaerungsliste'?' · Koordination':'')+'</h3><span class="pd-code">'+esc(code)+'</span></div>'+
      '<p class="pd-karte-zahl">'+(da&&!ohne?esc(K.zusammenfassung(art,zahlen)):da?'Noch leer.':'Noch nicht angelegt.')+'</p>'+
      (vs.length?'<p class="pd-romy-hinweis">Romy: '+vs.length+(vs.length===1?' Vorschlag':' Vorschläge')+(quellen.length?' aus '+quellen.map(q=>'«'+esc(q)+'»').join(', '):'')+'</p>':'')+(extra||'')+
      '<div class="pd-karte-aktionen"><a class="btn btn-primary" href="'+esc(url({projekt:projekt.id,liste:art}))+'" data-nav>'+(da?'Öffnen':'Anlegen')+'</a>'+
      (da&&!ohne?'<button type="button" class="btn" data-act="excel" data-art="'+art+'">Excel</button>':'')+'</div></article>';
  };
  // Wann die Liste im Ablauf dran ist, mit dem Datum aus dem Terminplan.
  const wann=art=>'<p class="pd-wann">'+(WANN[art]||[]).map(([t,c])=>esc(t)+' '+'<span class="pd-ms" title="'+esc(K.meilensteinName(c))+'">'+esc(c)+'</span>'+
    (K.terminVon(c)?' '+esc(K.datumKurz(K.terminVon(c))):'')).join(' · ')+'</p>';
  const weitere=K.WEITERE.map(art=>{const zz=K.zaehle(art,zeilen[art]);return karte(art,K.DOKUMENTE[art].code,zz,wann(art))}).join('');
  const folgt=(titel,code,text)=>'<article class="card pd-karte pd-folgt"><div class="pd-karte-kopf"><h3>'+esc(titel)+'</h3><span class="pd-code">'+esc(code)+'</span></div>'+
    '<p class="meta">'+esc(text)+'</p><p class="pd-folgt-text">Noch nicht gebaut</p></article>';
  const vorlagenListe=vorlagen.length?'<ul class="pd-vorlagen">'+vorlagen.map(v=>{
    const inh=K.vorlageInhalt(v,zeilen.entscheidungsliste,{projekt});
    return '<li><a href="'+esc(url({projekt:projekt.id,vorlage:v.id}))+'" data-nav><span class="pd-nr">'+esc(inh.nr)+'</span> '+esc(inh.titel)+'</a> · '+
      (v.daten.status==='vorgelegt'?'vorgelegt am '+esc(K.datumKurz(v.daten.vorgelegt_am)):'in Arbeit')+'</li>';
  }).join('')+'</ul>':'<p class="meta">Noch keine Vorlage. Eine Vorlage entsteht aus Entscheidungen der Entscheidungsliste.</p>';
  const fokus=vorZeichnen();
  // Im Reiter «Listen» von Work (Gari, 27.11.2026: «listen»): ohne Kopf, Projektwahl und Rückweg, denn das Projekt wählt
  // Work; das Muster bleibt unter Werkzeuge.
  const kopfHtml=IM_REITER?meldungHtml():kopf({zurueck:['./app/#section=tools','‹ Werkzeuge'],kicker:'Werkzeuge · Projektstart · '+projektName(),titel:'Projektstart',
    intro:'Die Bürovorlagen werden Dokumente des Projekts: hier bearbeiten und als Word, Excel oder PDF ausgeben, wenn Fachplaner oder Bauherr sie brauchen. Das Muster bleibt, wie es ist; jedes Projekt bekommt seine eigene Fassung.',
    aktionen:projektwahl+'<a class="btn" href="./projektstart.html">Muster ansehen</a>'});
  const html='<div class="pd-wrap'+(IM_REITER?' pd-im-reiter':'')+'">'+kopfHtml+ablaufPanel()+
    (ui.ablauf?'':'<section class="pd-abschnitt"><h2>Abläufe</h2><p class="meta">wiederkehrende Arbeit des Büros, Schritt für Schritt mit den Werkzeugen des Office</p><div class="pd-grid">'+
      '<article class="card pd-karte"><div class="pd-karte-kopf"><h3>Besprechung nachbereiten</h3></div><p class="meta">Romy liest das Protokoll und schlägt Klärungen und Entscheidungen vor, '+
      'jede mit Fundstelle. Danach: Aufgaben im Planner, Fristen gegen den Terminplan, das Ergebnis ins Projektwissen.</p>'+
      '<div class="pd-karte-aktionen">'+(romy.bereit?'<button type="button" class="btn btn-primary" data-act="ablauf-besprechung">Protokoll lesen …</button>':'<span class="meta">Romy ist gerade nicht erreichbar.</span>')+'</div></article>'+
      '</div></section>')+
    '<section class="pd-abschnitt"><h2>Listen</h2><p class="meta">bearbeiten wie im Büro-Excel · jede Spalte mit Typ · Ausgabe als Excel</p><div class="pd-grid">'+
    karte('klaerungsliste','L3.KLA',zk,zk.aufgaben?'<p class="meta">'+zk.aufgaben+(zk.aufgaben===1?' Punkt als Aufgabe':' Punkte als Aufgabe')+' im Planner</p>':'')+
    karte('entscheidungsliste','L3.ENV · L3.A3',ze,warten.length?'<p class="pd-hinweis">'+warten.length+(warten.length===1?' Entscheidungspunkt aus der Klärungsliste wartet':' Entscheidungspunkte aus der Klärungsliste warten')+'</p>':'')+
    weitere+
    folgt('Planliste','L3.PLI','Planliste, Dokumente, Ausgaben, Verteiler, Austausch, Ablage')+
    '</div></section>'+
    '<section class="pd-abschnitt"><h2>Texte</h2><p class="meta">feste Abschnitte, Daten des Projekts schon eingesetzt · Ausgabe als Word oder PDF</p><div class="pd-grid">'+
    '<article class="card pd-karte"><div class="pd-karte-kopf"><h3>Entscheidungsvorlagen</h3><span class="pd-code">L3.ENV.1</span></div>'+vorlagenListe+
    '<div class="pd-karte-aktionen"><button type="button" class="btn btn-primary" data-act="neue-vorlage">Neue Vorlage</button></div></article>'+
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
  'vorbereitet':'offen','vorgelegt':'klaerung','entschieden':'ok','vertagt':'att',
  'beantwortet':'ok','Termin vereinbart':'klaerung','angefragt':'klaerung','Angebot liegt vor':'klaerung','empfohlen':'ag','beauftragt':'ok',
  'v0 Vorschlag':'offen','offen – Kick-off':'att','v1 abgestimmt':'ok','geändert':'att'};
// Auswahlwerte der weiteren Listen als Marke: ja/nein, beauftragt, Rückmeldung.
const WERT_KLASSE={erforderlich:{ja:'klaerung','prüfen':'att'},beauftragt:{ja:'ok',angefragt:'klaerung'},vollstaendig:{ja:'ok',nein:'att'},
  rueckmeldung:{'stimmt überein':'ok','Vorbehalt':'att','ausstehend':'offen'}};
// Farbe eines Felds der Schnittstellenmatrix wie in der Vorlage: das erste von ? G B K F M V, das vorkommt.
function zKlasse(v){const t=String(v||'').toUpperCase();for(const c of '?GBKFMV')if(t.includes(c))return c==='?'?'q':c.toLowerCase();return ''}
function standKlasse(t){return t==='bestätigt'||t==='eindeutig'?'st-ok':/überfällig$/.test(t)?'chip-err':/^(Vorbehalt|offen|keine|mehrere)|unvollständig$/.test(t)?'st-att':t==='Rückmeldung ausstehend'?'st-klaerung':'st-offen'}
function zellInhalt(art,z,sp){
  const d=z.daten,k=sp.key;
  if(k==='nr')return '<span class="pd-nr">'+esc(K.nummer(art,z.nr,z.daten))+'</span>';
  if(sp.typ==='meilenstein'){
    const v=String(d[k]||'').trim();if(!v)return '';
    const code=K.istMeilenstein(v)?v:'',iso=K.terminVon(v);
    const ueber=!!iso&&K.ueberfaellig(art,d)&&K.faelligAm(art,d)===iso;
    return (code?'<span class="pd-ms" title="'+esc(K.meilensteinName(code)||'Meilenstein')+(iso?'':' · ohne Datum im Terminplan')+'">'+esc(code)+'</span>':'')+
      (iso?(code?' ':'')+esc(K.datumKurz(iso)):'')+(ueber?' <span class="chip chip-err">überfällig</span>':'');
  }
  if(sp.typ==='zustaendigkeit'){const v=String(d[k]||'').trim();return v?'<span class="pd-z pd-z-'+zKlasse(v)+'">'+esc(v)+'</span>':''}
  if(art==='schnittstellen'&&k==='eindeutig'){const t=K.zustaendigkeit(d);return !t?'':t==='–'?'<span class="pd-mute">–</span>':'<span class="chip '+standKlasse(t)+'">'+esc(t)+'</span>'}
  if(art==='eingang'&&k==='stand'){const t=K.eingangStand(d);return t?'<span class="chip '+standKlasse(t)+'">'+esc(t)+'</span>':''}
  if(WERT_KLASSE[k]&&K.WEITERE.includes(art)&&d[k]){const c=WERT_KLASSE[k][d[k]];return c?'<span class="chip st-'+c+'">'+esc(d[k])+'</span>':'<span class="pd-mute">'+esc(d[k])+'</span>'}
  if(art==='fachplanerbedarf'&&k==='disziplin'&&!ui.alleSpalten)
    return '<span title="'+esc(d.regel?'In der Regel erforderlich, wenn: '+d.regel:'')+'">'+esc(d.disziplin)+'</span>'+(d.kuerzel&&d.kuerzel!=='–'?' <span class="pd-ms">'+esc(d.kuerzel)+'</span>':'')+
      (d.leistungsbild?'<span class="pd-unter">'+esc(d.leistungsbild)+'</span>':'');
  // Eingang ohne eigenes Büro: das Büro aus dem Fachplanerbedarf (gleiches Kürzel), grau, bis jemand eines einträgt.
  if(art==='eingang'&&k==='buero'&&!String(d.buero||'').trim()){
    const f=zeilen.fachplanerbedarf.find(x=>x.daten.kuerzel===d.disziplin&&String(x.daten.buero||'').trim());
    return f?'<span class="pd-mute" title="aus dem Fachplanerbedarf">'+esc(f.daten.buero)+'</span>':'';
  }
  if(art==='fragenliste'&&k==='frage'&&!ui.alleSpalten&&d.wer&&d.wer!==K.WER_FRAGT[0])return esc(d.frage)+'<span class="pd-unter">'+esc(d.wer)+'</span>';
  if(art==='schnittstellen'&&k==='thema'&&!ui.alleSpalten&&d.kg&&d.kg!=='–')return esc(d.thema)+'<span class="pd-unter">KG '+esc(d.kg)+'</span>';
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
  if(sp.typ==='meilenstein')return '<input'+a+' value="'+esc(terminEingabe(v))+'" placeholder="M03 oder TT.MM." autocomplete="off" list="pdMeilensteine">';
  if(sp.typ==='zustaendigkeit')return '<select'+a+' aria-label="'+esc(sp.kopf)+'"><option value=""></option>'+sp.werte.map(w=>'<option'+(w===v?' selected':'')+' title="'+esc(K.LEGENDE.find(l=>l[0]===w)?.[1]||'')+'">'+esc(w)+'</option>').join('')+'</select>';
  return '<input'+a+' value="'+esc(v)+'" autocomplete="off">';
}
// Termin zum Bearbeiten: der Code oder das Datum, wie man es eintippt.
const terminEingabe=v=>K.istMeilenstein(v)?String(v).trim():K.datumLang(v)||String(v??'');
function meilensteinListe(){
  return '<datalist id="pdMeilensteine">'+K.MEILENSTEINE.map(([c,t])=>{const d=K.terminVon(c);return '<option value="'+c+'">'+esc(t+(d?' · '+K.datumLang(d):''))+'</option>'}).join('')+'</datalist>';
}
const BEARBEITBAR=['text','lang','datum','auswahl','mehrfach','meilenstein','zustaendigkeit'];
// Disziplinen für den Filter: in der Schnittstellenmatrix die Spalten der Matrix, sonst die Liste der Vorlage ohne «alle».
function disziplinWahl(art){
  const liste=art==='schnittstellen'?K.MATRIX.map(m=>[m[2],m[1]]):K.DISZIPLINEN.filter(d=>d[0]!=='ALLE');
  return '<label class="pd-sel"><span>Disziplin</span><select data-act="disziplin"><option value="">alle</option>'+liste.map(([c,l])=>'<option value="'+c+'"'+(ui.disziplin===c?' selected':'')+' title="'+esc(l)+'">'+c+'</option>').join('')+'</select></label>';
}
// Leere weitere Liste: anlegen mit den Zeilen der Bürovorlage oder leer beginnen.
function anlegenPanel(art){
  const n=(V[art]||[]).length,doc=K.DOKUMENTE[art];
  return '<section class="card pd-anlegen"><h2>'+(dokumente[art]?esc(doc.kurz)+' ist noch leer':esc(doc.kurz)+' anlegen')+'</h2>'+
    (n?'<p>Die Bürovorlage hat '+n+' '+esc(n===1?doc.zeile:doc.zeilen)+' vorbereitet: '+esc(VORLAGE_TEXT[art]||'')+'. Danach gehört die Liste dem Projekt: ändern, ergänzen, auf «entfällt» setzen.</p>':'')+
    '<div class="pd-karte-aktionen">'+(n?'<button type="button" class="btn btn-primary" data-act="anlegen-vorlage">Mit '+(n===1?'der':'den')+' '+n+' '+esc(n===1?doc.zeile:doc.zeilen)+' der Bürovorlage '+(dokumente[art]?'füllen':'anlegen')+'</button>':'')+
    (dokumente[art]?'':'<button type="button" class="btn" data-act="anlegen-leer">Leer anlegen</button>')+'</div></section>';
}
// Schnittstellen: nach Gruppen (Reihenfolge des ersten Auftretens), Zeilen ohne Gruppe am Ende unter «Weitere».
function nachGruppen(alle,sicht){
  const reihe=[];for(const z of alle){const g=String(z.daten.gruppe||'');if(!reihe.includes(g))reihe.push(g)}
  reihe.sort((a,b)=>(a===''?1:0)-(b===''?1:0));
  const rang=new Map(reihe.map((g,i)=>[g,i]));
  return [...sicht].sort((a,b)=>rang.get(String(a.daten.gruppe||''))-rang.get(String(b.daten.gruppe||''))||a.nr-b.nr);
}
function renderListe(){
  const art=ui.art,doc=K.DOKUMENTE[art],alle=zeilen[art],weitere=K.WEITERE.includes(art),mitRomy=romy.bereit&&MIT_ROMY.includes(art);
  // Die Zahlen an den Filtern gelten für die gewählte Disziplin (die Fragen an die TWP: wie viele offen, wie viele überfällig).
  const zahlen=K.zaehle(art,alle),fz=K.zaehleFilter(art,ui.disziplin?K.filtere(art,alle,{disziplin:ui.disziplin}):alle);
  let sicht=K.filtere(art,alle,{filter:ui.filter,disziplin:ui.disziplin,suche:ui.suche});
  if(art==='schnittstellen')sicht=nachGruppen(alle,sicht);
  const spalten=spaltenFuer(art);
  const runde=art==='klaerungsliste'?(dokumente[art]?.meta?.runde||'01'):'';
  const meta=(runde?'Runde '+esc(runde)+' · ':'')+esc(K.zusammenfassung(art,zahlen))+' · <span data-speicher>'+esc(speicherText())+'</span>';
  // Die Fragenliste für eine Fachplanung: Excel mit ihren Fragen und denen an alle.
  const excelText=art==='fragenliste'&&ui.disziplin?'Excel für '+ui.disziplin:'Excel';
  const aktionen='<button type="button" class="btn btn-primary" data-act="neu">+ '+esc(NEU_KNOPF[art]||'Zeile')+'</button>'+
    (mitRomy?'<button type="button" class="btn btn-romy" data-act="romy">Romy fragen</button>':'')+
    '<button type="button" class="btn" data-act="spalten" aria-pressed="'+ui.alleSpalten+'">'+(ui.alleSpalten?'Kompakt':'Alle Spalten')+'</button>'+
    (alle.length||!weitere?'<button type="button" class="btn" data-act="excel" data-art="'+art+'">'+esc(excelText)+'</button>':'');
  const filter='<div class="pd-filter">'+K.FILTER[art].map(([k,l])=>'<button type="button" class="chip" data-act="filter" data-f="'+esc(k)+'" aria-pressed="'+(ui.filter===k)+'">'+esc(l)+' '+fz[k]+'</button>').join('')+
    (K.MIT_DISZIPLIN.includes(art)?disziplinWahl(art):'')+
    (art==='klaerungsliste'?'<label class="pd-sel"><span>Runde</span><select data-act="runde">'+K.RUNDEN.map(r=>'<option'+(r===runde?' selected':'')+'>'+r+'</option>').join('')+'</select></label>':'')+
    '<input type="search" class="pd-suche" id="pd-suche" data-act="suche" placeholder="Suchen" value="'+esc(ui.suche)+'" aria-label="In der Liste suchen"></div>';
  let banner=romyBanner(art);
  if(HINWEIS[art])banner+='<p class="pd-listenhinweis'+(art==='schnittstellen'?' pd-legende':'')+'">'+esc(HINWEIS[art])+'</p>';
  if(weitere&&!termineDa&&K.SPALTEN[art].some(sp=>sp.typ==='meilenstein'))
    banner+='<p class="pd-listenhinweis">Im Terminplan des Projekts stehen noch keine Meilensteine M00 … M11; die Termine bleiben bis dahin ohne Datum. Ein Datum lässt sich auch direkt eintragen.</p>';
  if(art==='entscheidungsliste'){
    const warten=K.wartendeEntscheidungspunkte(zeilen.klaerungsliste,zeilen.entscheidungsliste).filter(z=>!ui.spaeter.has(z.id));
    const naechste=K.nummer('entscheidungsliste',(alle.reduce((m,z)=>Math.max(m,z.nr),0))+1);
    banner+=warten.map(z=>'<div class="pd-banner info">In der Klärungsliste ist Nr '+z.nr+' ('+esc(K.kurz(z.daten.sachverhalt,80))+') als Entscheidungspunkt des Auftraggebers markiert, steht aber noch nicht hier.'+
      '<div class="pd-banner-actions"><button type="button" class="btn" data-act="ep-uebernehmen" data-z="'+z.id+'">Als '+esc(naechste)+' übernehmen</button><button type="button" class="btn btn-quiet" data-act="ep-spaeter" data-z="'+z.id+'">Später</button></div></div>').join('');
  }
  const auswahl=[...ui.auswahl].map(id=>alle.find(z=>z.id===id)).filter(Boolean);
  const eigene=art==='klaerungsliste'?'<button type="button" class="btn" data-act="aufgaben">Aufgaben im Planner anlegen</button><button type="button" class="btn" data-act="in-entscheidungen">In die Entscheidungsliste</button>'
    :art==='entscheidungsliste'?'<button type="button" class="btn" data-act="vorlage-auswahl">Vorlage aus der Auswahl</button>'
    :art==='fragenliste'?'<button type="button" class="btn" data-act="fragen-kopieren">Für die Mail kopieren</button>':'';
  const leiste=auswahl.length?'<div class="pd-auswahl" role="region" aria-label="Auswahl"><strong>'+auswahl.length+(auswahl.length===1?' Zeile':' Zeilen')+' ausgewählt</strong>'+eigene+
    (mitRomy?'<span class="pd-auswahl-romy">Romy:</span>'+(art==='klaerungsliste'?'<button type="button" class="btn" data-act="romy-fachplaner">Frage an die Fachplaner formulieren</button><button type="button" class="btn" data-act="romy-fristen">Fristen mit dem Terminplan prüfen</button>'
      :'<button type="button" class="btn" data-act="romy-bestaetigung">Bestätigung als Mail entwerfen</button>')+'<button type="button" class="btn" data-act="romy-frage">Frage stellen …</button>':'')+
    '<button type="button" class="btn btn-quiet" data-act="auswahl-weg">Auswahl aufheben</button></div>':'';
  const kopfzeile='<tr><th class="pd-check"><input type="checkbox" data-act="alle" aria-label="Alle auswählen"'+(sicht.length&&sicht.every(z=>ui.auswahl.has(z.id))?' checked':'')+'></th>'+
    spalten.map(sp=>'<th class="pd-t-'+sp.typ+'" scope="col"'+(sp.typ==='zustaendigkeit'?' title="'+esc(sp.kopf)+'"':'')+'>'+esc(kopfText(art,sp))+'</th>').join('')+'</tr>';
  let gruppe=null;
  const reihen=sicht.map(z=>{
    const d=z.daten;
    const kl=['pd-zeile'];if(K.erledigt(art,d))kl.push('pd-erledigt');if(ui.detail===z.id)kl.push('pd-aktiv');if(K.ueberfaellig(art,d))kl.push('pd-ueber');
    const g=art==='schnittstellen'?String(d.gruppe||''):null;
    const kopfG=g!==null&&g!==gruppe?'<tr class="pd-gruppe"><th colspan="'+(spalten.length+1)+'" scope="rowgroup">'+esc(g||'Weitere')+'</th></tr>':'';
    gruppe=g;
    return kopfG+'<tr class="'+kl.join(' ')+'" data-zeile="'+z.id+'"><td class="pd-check"><input type="checkbox" data-act="waehle" data-z="'+z.id+'" aria-label="Zeile '+esc(K.nummer(art,z.nr,z.daten))+' auswählen"'+(ui.auswahl.has(z.id)?' checked':'')+'></td>'+
      spalten.map(sp=>zelle(art,z,sp,geaendert(art,z).has(sp.key))).join('')+'</tr>'+aenderungsZeilen(art,z,spalten.length);
  }).join('')+neueVorschlaege(art,spalten);
  const neuIndex=spalten.findIndex(sp=>sp.key===(NEU_SPALTE[art]||NEU_FELD[art]));
  const naechsteNr=K.nummer(art,(alle.reduce((m,z)=>Math.max(m,z.nr),0))+1);
  const neuZeile='<tr class="pd-neu"><td class="pd-check"></td>'+spalten.map((sp,i)=>i===neuIndex?'<td class="pd-c" colspan="'+(spalten.length-i)+'"><input class="pd-in pd-neu-in" data-neu placeholder="Neue Zeile: '+esc(NEU_TEXT[art]||'Thema')+' eintippen, Enter legt sie an und springt in die nächste Spalte" aria-label="Neue Zeile"></td>':i<neuIndex?'<td class="pd-c">'+(i===0&&!['fragenliste','eingang'].includes(art)?'<span class="pd-mute">'+esc(naechsteNr)+'</span>':'')+'</td>':'').join('')+'</tr>';
  const fuss='<p class="meta pd-fuss">'+(ui.alleSpalten?'Alle '+(spalten.length)+' Spalten wie in der Bürovorlage.':'Kompakt: '+KOMPAKT[art].filter(k=>k!=='_vorlage').length+' von '+K.SPALTEN[art].length+' Spalten. «Alle Spalten» zeigt alle Spalten der Bürovorlage.')+
    ' Klick in eine Zelle bearbeitet sie; Enter oder Tab springt weiter, Esc bricht ab. '+(art==='eingang'?'Die Disziplin':'Die Nummer')+' öffnet die Details.'+(sicht.length<alle.length?' Gefiltert: '+sicht.length+' von '+alle.length+'.':'')+'</p>';
  const tabelle=weitere&&!alle.length?anlegenPanel(art)+(dokumente[art]?'<div class="pd-tabelle-wrap pd-tabelle-leer"><table class="pd-tabelle"><thead>'+kopfzeile+'</thead><tbody>'+neuZeile+'</tbody></table></div>':'')
    :'<div class="pd-tabelle-wrap"><table class="pd-tabelle'+(ui.alleSpalten?' pd-alle':'')+(art==='schnittstellen'?' pd-matrix':'')+'"><thead>'+kopfzeile+'</thead><tbody>'+reihen+neuZeile+'</tbody></table></div>'+fuss;
  const fokus=vorZeichnen();
  const html='<div class="pd-wrap pd-liste-wrap'+(ui.detail?' mit-detail':'')+'">'+kopf({zurueck:[url({projekt:projekt.id}),IM_REITER?'‹ Listen':'‹ Projektstart'],kicker:IM_REITER?'Listen':'Projektstart · '+projektName(),titel:doc.titel,meta,aktionen})+
    (alle.length||!weitere?filter:'')+banner+leiste+tabelle+
    '<datalist id="pdDisziplinen">'+K.DISZIPLINEN.map(([c,l])=>'<option value="'+c+'">'+esc(l)+'</option>').join('')+'</datalist>'+
    (K.SPALTEN[art].some(sp=>sp.typ==='meilenstein')?meilensteinListe():'')+
    (art==='schnittstellen'?'<datalist id="pdGruppen">'+[...new Set(alle.map(z=>String(z.daten.gruppe||'')).filter(Boolean))].map(g=>'<option value="'+esc(g)+'"></option>').join('')+'</datalist>':'')+
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
  if(sp.typ==='meilenstein'){const t=K.leseTermin(roh);if(t===null){meldung('Termin bitte als Meilenstein (z. B. M03) oder als Datum TT.MM. eingeben.','warn');return {ok:false}}return {ok:true,wert:t}}
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
  else if(t==='meilenstein')input='<input class="pd-in"'+a+' value="'+esc(terminEingabe(v))+'" placeholder="M03 oder TT.MM.JJJJ" data-typ="meilenstein" list="pdMeilensteine" autocomplete="off">';
  else if(t==='berechnet')input='<p class="pd-berechnet" id="f-'+key+'">'+esc(K.zellText(art,key,z.daten,{nr:z.nr})||'–')+'</p>';
  else if(t==='zustaendigkeit')input='<select class="pd-in"'+a+'><option value=""></option>'+(sp?.werte||[]).map(x=>'<option'+(x===v?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select>';
  else if(t==='auswahl'||t==='janein'){const w=werte||sp?.werte||[];input='<select class="pd-in"'+a+'><option value=""></option>'+w.map(x=>'<option'+(x===v?' selected':'')+'>'+esc(x)+'</option>').join('')+(v&&!w.includes(v)?'<option selected>'+esc(v)+'</option>':'')+'</select>'}
  else if(t==='liste')input='<input class="pd-in"'+a+' value="'+esc(v)+'" list="'+esc(werte)+'" autocomplete="off">';
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
  if(K.WEITERE.includes(art)){
    // Alle Spalten der Vorlage als Felder; dazu, was nicht als Spalte steht (Code der Frage, Disziplin im Eingang, Gruppe).
    const vorne=art==='fragenliste'?[feldEingabe(art,z,'code',{label:'Nr (Code der Frage)',hinweis:'Vergeben mit der Disziplin, z. B. TWP-07.'})]
      :art==='eingang'?[feldEingabe(art,z,'disziplin',{typ:'auswahl',werte:K.DISZIPLINEN.map(x=>x[0])})]
      :art==='schnittstellen'?[feldEingabe(art,z,'gruppe',{typ:'liste',werte:'pdGruppen',label:'Gruppe',hinweis:'z. B. «B · Themen und Bauteile»; ohne Gruppe steht die Zeile unter «Weitere».'})]:[];
    const matrix=art==='schnittstellen'?'<div class="pd-feld"><label>Zuständigkeit</label><div class="pd-matrix-felder">'+K.MATRIX.map(([k,kopf])=>'<label class="pd-ofeld"><span>'+esc(kopf)+'</span>'+
      '<select class="pd-in" data-feld="'+k+'" data-z="'+z.id+'" id="f-'+k+'"><option value=""></option>'+K.ZUSTAENDIGKEIT.map(x=>'<option'+(x===d[k]?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>').join('')+
      '</div><p class="meta">'+esc(HINWEIS.schnittstellen)+'</p></div>':'';
    felder=vorne.join('')+K.SPALTEN[art].filter(sp=>sp.key!=='nr'&&sp.typ!=='zustaendigkeit').map(sp=>sp.key==='eindeutig'?matrix+feldEingabe(art,z,sp.key):feldEingabe(art,z,sp.key)).join('');
  }else if(art==='klaerungsliste'){
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
  if(K.WEITERE.includes(art)){}
  else if(art==='klaerungsliste'){
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
  return '<aside class="pd-detail" aria-label="Details"><div class="pd-detail-kopf"><h2>'+esc(K.DOKUMENTE[art].zeile)+' '+esc(K.nummer(art,z.nr,z.daten))+' · Details</h2><button type="button" class="pd-x" data-act="detail-zu" aria-label="Details schließen">×</button></div>'+
    '<div class="pd-detail-inhalt">'+felder+(verknuepft.length?'<h3>Verknüpft</h3><ul class="pd-verknuepft">'+verknuepft.join('')+'</ul>':'')+
    (romy.bereit&&MIT_ROMY.includes(art)?'<h3>Romy</h3><div class="pd-feld"><label for="r-frage">Frage zu dieser Zeile</label><textarea class="pd-in" id="r-frage" rows="2" placeholder="z. B. Was ändert sich in der Kostenberechnung, wenn der Unterzug deckengleich wird?"></textarea>'+
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
  // Die Fragenliste für eine Fachplanung (Filter «Disziplin»): ihre Fragen und die an alle, wie in der Vorlage zum Versand.
  const fuer=art==='fragenliste'&&ui.ansicht==='liste'&&ui.art===art&&ui.disziplin?ui.disziplin:'';
  const liste=fuer?K.filtere(art,zeilen[art],{disziplin:fuer}):zeilen[art];
  const blatt=X.listenBlatt(K,art,liste,{projekt:projektName()+(fuer?' · Fragen an '+fuer:'')});
  laden(dateiName(projekt.number+'_'+K.DOKUMENTE[art].kurz+(fuer?'_'+fuer:'')+'_'+heute())+'.xlsx',X.xlsx(blatt),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
// Ausgewählte Fragen als Text für eine Mail an die Fachplanung, je Zeile Code, Thema, Frage und Termin.
async function fragenKopieren(liste){
  if(!liste.length)return;
  const text=[...liste].sort((a,b)=>a.nr-b.nr).map(z=>{const d=z.daten;
    return K.nummer('fragenliste',z.nr,d)+' · '+(d.thema?d.thema+': ':'')+String(d.frage||'').trim()+(d.bis?' (gebraucht bis '+K.terminText(d.bis,heute(),{lang:true})+')':'')}).join('\n');
  try{await navigator.clipboard.writeText(text);meldung(liste.length+(liste.length===1?' Frage':' Fragen')+' kopiert; in die Mail einfügen.')}
  catch{
    dialog.innerHTML='<form method="dialog" class="pd-dlg"><h2>Fragen für die Mail</h2><p class="meta">Markieren und kopieren.</p><textarea class="pd-in" rows="12" readonly>'+esc(text)+'</textarea>'+
      '<div class="pd-dlg-aktionen"><button class="btn btn-primary">Schließen</button></div></form>';
    dialog.showModal();dialog.querySelector('textarea')?.select();
  }
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
  if(!v){root.innerHTML='<div class="pd-wrap">'+kopf({zurueck:[url({projekt:projekt.id}),IM_REITER?'‹ Listen':'‹ Projektstart'],kicker:IM_REITER?'Listen':'Projektstart · '+projektName(),titel:'Entscheidungsvorlage'})+'<div class="pd-banner warn">Diese Vorlage gibt es nicht mehr.</div></div>';return}
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
    kicker:(IM_REITER?'Listen':'Projektstart · '+projektName())+' · Vorlage '+inh.nr,titel:'Entscheidungsvorlage '+inh.nr,meta,aktionen})+
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
const mm={offen:'',seite:null,produkte:new Map(),fotos:new Map(),urls:new Map(),geladen:'',laedt:null,pdfjs:null,ansicht:mmAnsichtLesen()};
// Arbeitsfläche der Mappe (Gari, 26.11.2026): Zoom «Einpassen» (die ganze Seite im Fenster), «Seitenbreite» oder in
// Prozent (100 % = A3 in Originalgröße), Raster ein oder aus, Seitenliste und Eigenschaften ein- und ausblenden.
// Gemerkt je Gerät; ohne Speicher (privates Fenster) gilt die Grundeinstellung.
// Eigenschaften sind zu Beginn aus (Gari, 27.11.2026); wer sie einschaltet, behält sie. Ansichten von vor diesem Tag
// (ohne v:2) beginnen einmal mit ausgeschalteten Eigenschaften, der Rest bleibt.
function mmAnsichtLesen(){
  const grund={zoom:'fit',raster:false,seiten:true,rechts:false,teil:'seite'};
  try{const x=JSON.parse(localStorage.getItem('tba-office.mustermappe.ansicht')||'null');
    if(x&&typeof x==='object')return {zoom:x.zoom==='breite'||(typeof x.zoom==='number'&&x.zoom>=.2&&x.zoom<=4)?x.zoom:'fit',raster:!!x.raster,seiten:x.seiten!==false,
      rechts:x.v>=2&&x.rechts===true,teil:['seite','position','mappe'].includes(x.teil)?x.teil:'seite'}}catch{}
  return grund;
}
function mmAnsichtMerken(){try{localStorage.setItem('tba-office.mustermappe.ansicht',JSON.stringify({...mm.ansicht,v:2}))}catch{}}
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
function mappeSeite(v){const l=M.seitenVon(v.daten);return l.find(x=>x.id===mm.seite)||l[0]||null}

// Die Mappen eines Projekts (Werkzeug Mustermappe): je Themenpaket eine Karte mit Positionen, Seiten, Termin und Stand.
function renderMappen(){
  const liste=mappen();
  const projektwahl='<label class="pd-projekt"><span>Projekt</span><select data-act="projekt">'+projekte.filter(p=>p.status==='aktiv'&&darf(p)).map(p=>
    '<option value="'+esc(p.id)+'"'+(p.id===projekt.id?' selected':'')+'>'+esc(p.number+' · '+p.name)+'</option>').join('')+'</select></label>';
  const karte=v=>{
    const n=(v.daten.punkte||[]).length,seiten=M.seitenVon(v.daten).length,ziel=esc(url({projekt:projekt.id,vorlage:v.id}));
    return '<article class="card pd-karte mm-karte"><div class="pd-karte-kopf"><h3><a href="'+ziel+'" data-nav>'+esc(v.daten.titel||'Mustermappe')+'</a></h3><span class="pd-code">L3.MAP.1</span></div>'+
      '<p class="pd-karte-zahl">'+n+(n===1?' Position':' Positionen')+' · '+seiten+(seiten===1?' Seite':' Seiten')+'</p>'+
      '<p class="meta">'+(v.daten.besprechung_am?'Bemusterung am '+esc(K.datumLang(v.daten.besprechung_am)):'Bemusterungstermin noch offen')+' · '+
        (v.daten.status==='vorgelegt'?'vorgelegt am '+esc(K.datumKurz(v.daten.vorgelegt_am)):'in Arbeit')+'</p>'+
      '<div class="pd-karte-aktionen"><a class="btn btn-primary" href="'+ziel+'" data-nav>Öffnen</a></div></article>';
  };
  const fokus=vorZeichnen();
  const html='<div class="pd-wrap pd-mappen-wrap">'+kopf({zurueck:['./app/#section=tools','‹ Werkzeuge'],kicker:'Werkzeuge · Mustermappe · '+projektName(),titel:'Mustermappen',
    intro:esc(MAPPE_INTRO),aktionen:projektwahl+'<button type="button" class="btn btn-primary" data-act="mm-neu">Neue Mustermappe</button>'})+
    (liste.length?'<div class="pd-grid">'+liste.map(karte).join('')+'</div>'
      :'<section class="card pd-karte"><p class="pd-karte-zahl">Für dieses Projekt gibt es noch keine Mustermappe.</p><p class="meta">«Neue Mustermappe» legt die erste an, zum Beispiel für die Bodenbeläge.</p></section>')+
    '</div>';
  zeichne(html,fokus);
}
// Eine kleine Seite für den Streifen: wie im PDF gesetzt, Bilder erst beim Hinsehen geladen.
function miniHtml(x,inh,j,n){return M.seiteHtml(x,inh,{nr:j+1,gesamt:n,modus:'druck',bild:bildUrl}).replace(/<img /g,'<img loading="lazy" decoding="async" ')}
// Die kleine Seite der offenen Seite folgt der Bühne (nach Text, Rahmen oder Bild), ohne die Mappe neu zu zeichnen.
function miniAuffrischen(){
  const v=vorlageZeile();if(ui.ansicht!=='mappe'||!v||!istMappe(v))return;
  const inh=mappeJetzt(v),j=inh.seiten.findIndex(x=>x.id===mm.seite),ort=root.querySelector('.mm-seitenliste li.active .mm-mini');
  if(j>=0&&ort)ort.innerHTML=miniHtml(inh.seiten[j],inh,j,inh.seiten.length);
}
// Eigenschaften in Reitern (B2, 27.11.2026, wie im Entwurf): «Seite» (Hinweise, Übersatz, Rahmen, die Seite), «Position»
// (die Position der Seite) und «Mappe» (Positionen, Angaben, Termin, Stände). Gemerkt wie Zoom und Raster.
const MM_TEILE=[['seite','Seite'],['position','Position'],['mappe','Mappe']];
function eigenschaften(v,inh,seite){
  const t=mappeSeitenleiste(v,inh,seite),teil=mm.ansicht.teil;
  return '<aside class="mm-rechts" data-teil="'+teil+'" aria-label="Eigenschaften"><div class="mm-teile" role="group" aria-label="Eigenschaften für">'+
      MM_TEILE.map(([k,l])=>'<button type="button" data-act="mm-teil" data-teil="'+k+'" aria-pressed="'+(k===teil)+'">'+l+'</button>').join('')+'</div>'+
    '<div class="mm-teil" data-teil="seite"><div data-mm-hinweise>'+mappeHinweise(v,seite)+'</div><div data-mm-uebersatz></div><div data-mm-rahmen>'+layoutKarte()+'</div>'+t.seite+'</div>'+
    '<div class="mm-teil" data-teil="position">'+(t.position||'<section class="card"><h2>Position</h2><p class="meta">Diese Seite zeigt keine Position. Vergleichs- und '+
      'Materialseiten gehören zu einer Position; alle Positionen stehen unter «Mappe».</p></section>')+'</div>'+
    '<div class="mm-teil" data-teil="mappe">'+t.mappe+'</div></aside>';
}
function teilZeigen(teil){
  if(!MM_TEILE.some(([k])=>k===teil))return;
  if(mm.ansicht.teil!==teil){mm.ansicht.teil=teil;mmAnsichtMerken()}
  const r=root.querySelector('.mm-rechts');if(!r||r.dataset.teil===teil)return;
  r.dataset.teil=teil;r.scrollTop=0;
  r.querySelectorAll('[data-act="mm-teil"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.teil===teil)));
}
function renderMappe(){
  const v=vorlageZeile();
  if(!v||!istMappe(v)){renderVorlage();return}
  mappeNachladen(v);
  if(!quellen.daten&&!quellen.laedt)void ladeQuellen().then(()=>{if(ui.ansicht==='mappe')spaeterRendern()});
  const inh=mappeJetzt(v),seiten=inh.seiten;
  if(!seiten.some(x=>x.id===mm.seite))mm.seite=seiten[0]?.id||null;
  const i=Math.max(0,seiten.findIndex(x=>x.id===mm.seite)),seite=seiten[i]||null;
  const vorgelegt=v.daten.status==='vorgelegt';
  const aktionen='<button type="button" class="btn" data-act="mm-praes">Präsentieren</button><button type="button" class="btn" data-act="mm-pdf">PDF</button>'+
    '<button type="button" class="btn btn-primary" data-act="vorlegen">'+(vorgelegt?'Erneut vorlegen':'Als vorgelegt markieren')+'</button>';
  const meta=esc('Vorlage zur Bemusterung'+(inh.termin?' am '+K.datumLang(inh.termin):''))+' · '+(vorgelegt?'vorgelegt am '+esc(K.datumLang(v.daten.vorgelegt_am)):'Entwurf')+
    ' · <span data-speicher>'+esc(speicherText())+'</span>';
  // Seiten als Bilder (B2, 27.11.2026, wie im Entwurf): ein Streifen mit kleinen Seiten statt der Liste in Worten. Der
  // Knopf liegt über der ganzen Karte (Nummer und Name sind seine Beschriftung); «+» fügt eine Seite oder eine Position
  // hinzu, «neuer Stand» markiert Seiten, deren Produkt in der Bibliothek neuer ist.
  const neuerStand=x=>{
    if(!['vergleich','material'].includes(x.typ))return false;
    const z=zeilen.entscheidungsliste.find(q=>q.id===x.punkt);
    return !!z&&K.optionen(z.daten).some(o=>o.produkt_id&&(x.typ!=='material'||o.id===x.option)&&M.veraltet(o,mm.produkte.get(o.produkt_id)));
  };
  const hinzu=[['frei','Freie Seite · Bild oder PDF'],['uebersicht','Übersicht'],['deckblatt','Deckblatt']].concat(...inh.punkte.map(p=>
    [['vergleich|'+p.id,(p.code||p.nr)+' · Vergleich']].concat(p.optionen.map(o=>['material|'+p.id+'|'+o.id,(p.code||p.nr)+' · '+o.id+' '+K.kurz(o.name,28)+' · Material']))));
  const nav='<nav class="mm-nav mm-streifen" aria-label="Seiten der Mappe"><div class="mm-streifen-kopf"><h2>Seiten · '+seiten.length+'</h2>'+
      '<span class="mm-plus"><button type="button" class="mm-plus-knopf" data-act="mm-plus" aria-haspopup="true" aria-expanded="false" aria-label="Seite oder Position hinzufügen" title="Seite oder Position hinzufügen">+</button>'+
      '<span class="mm-plus-menue" role="group" aria-label="Hinzufügen" hidden><button type="button" data-act="mm-position-neu">Position hinzufügen …</button>'+
      hinzu.map(([w,t])=>'<button type="button" data-act="mm-seite-neu" data-wert="'+esc(w)+'">'+esc(t)+'</button>').join('')+'</span></span></div>'+
    '<ol class="mm-seitenliste">'+seiten.map((x,j)=>{
      const p=inh.punkte.find(q=>q.id===x.punkt),o=p?.optionen.find(q=>q.id===x.option),an=x.id===seite?.id,neu=neuerStand(x);
      return '<li class="'+(an?'active':'')+'"><span class="mm-mini" aria-hidden="true">'+miniHtml(x,inh,j,seiten.length)+'</span>'+
        '<button type="button" data-act="mm-seite" data-id="'+esc(x.id)+'"'+(an?' aria-current="page"':'')+'><span class="mm-nr">'+(j+1)+'</span><span>'+esc(M.seiteName(x,p,o))+'</span>'+
        (neu?'<span class="mm-mini-marke">neuer Stand</span>':'')+'</button></li>';
    }).join('')+'</ol></nav>';
  const a=mm.ansicht,schalter=(act,t,an,titel)=>'<button type="button" class="btn mm-schalter" data-act="'+act+'" aria-pressed="'+(an?'true':'false')+'" title="'+esc(titel)+'">'+t+'</button>';
  const info='Seite '+(i+1)+' von '+seiten.length+' · A3 quer';
  // Im Reiter von Work (B2, 27.11.2026): eine Zeile über der ganzen Mappe statt Überschrift, Unterzeile und zweiter
  // Leiste. Welche Mappe offen ist, zeigt die Leiste von Work; «gespeichert» (Entwurf oder vorgelegt im Tooltip),
  // «Präsentieren», «PDF» und «Vorlegen» rücken ans Ende der Zeile, das Raster unter «•••».
  const stand=(vorgelegt?'vorgelegt am '+K.datumLang(v.daten.vorgelegt_am):'Entwurf');
  const zeile=IM_REITER?'<span class="meta mm-zeile-stand" title="'+esc('Vorlage zur Bemusterung'+(inh.termin?' am '+K.datumLang(inh.termin):'')+' · '+stand)+'">'+
      '<span data-speicher>'+esc(speicherText())+'</span></span>'+
    '<span class="mm-aktionen"><button type="button" class="btn" data-act="mm-praes">Präsentieren</button><button type="button" class="btn" data-act="mm-pdf">PDF</button>'+
      '<button type="button" class="btn btn-primary" data-act="vorlegen" title="Als vorgelegt markieren">'+(vorgelegt?'Erneut vorlegen':'Vorlegen')+'</button></span>'+
    '<span class="mm-mehr"><button type="button" class="mm-mehr-knopf" data-act="mm-mehr" aria-haspopup="true" aria-expanded="false" aria-label="Weitere Befehle" title="Weitere Befehle">•••</button>'+
      '<span class="mm-mehr-menue" role="group" aria-label="Weitere Befehle" hidden>'+schalter('mm-raster','Raster',a.raster,'Raster der Seite zeigen: 12 × 8 Felder, Grundlinie 4 mm')+'</span></span>':'';
  // Im Reiter mit reduzierter Leiste wählt man die Mappe am Anfang der Zeile (shared/reiter-fassung.js füllt den Ort).
  const werkzeug='<div class="mm-werkzeug'+(IM_REITER?' mm-zeile':'')+'">'+(IM_REITER?'<span data-reiter-fassung hidden></span>':'')+
    schalter('mm-links','Seiten',a.seiten,'Seitenliste ein- oder ausblenden')+
    // Rückgängig und Wiederholen (Etappe 2): Knöpfe und Strg/⌘+Z, Strg+Y oder ⇧⌘Z außerhalb der Textfelder.
    '<span class="mm-verlauf" role="group" aria-label="Verlauf"><button type="button" class="btn" data-act="mm-zurueck" aria-label="Rückgängig" disabled>'+MM_ICON.zurueck+'</button>'+
    '<button type="button" class="btn" data-act="mm-vor" aria-label="Wiederholen" disabled>'+MM_ICON.vor+'</button></span>'+
    '<span class="meta mm-seiteninfo" data-mm-kontext data-grund="'+esc(info)+'" title="'+esc(info)+'">'+esc(info)+'</span>'+
    '<span class="mm-zoom" role="group" aria-label="Zoom"><button type="button" class="btn" data-act="mm-zoom-minus" aria-label="Verkleinern">−</button>'+
    '<select class="pd-in" data-act="mm-zoom" aria-label="Zoom">'+zoomOptionen()+'</select><button type="button" class="btn" data-act="mm-zoom-plus" aria-label="Vergrößern">+</button></span>'+
    // Übersatz als Hinweis in der Leiste: ein Klick wählt den ersten Rahmen, der nicht passt.
    '<button type="button" class="mm-pille" data-act="mm-uebersatz" data-mm-pille hidden></button>'+
    (IM_REITER?'':schalter('mm-raster','Raster',a.raster,'Raster der Seite zeigen: 12 × 8 Felder, Grundlinie 4 mm'))+schalter('mm-rechts','Eigenschaften',a.rechts,'Eigenschaften ein- oder ausblenden')+
    zeile+'</div>';
  const mitte='<section class="mm-mitte" aria-label="Seite '+(i+1)+' von '+seiten.length+'">'+(IM_REITER?'':werkzeug)+
    '<div class="mm-buehne'+(a.raster?' raster':'')+'">'+(seite?M.seiteHtml(seite,inh,{nr:i+1,gesamt:seiten.length,modus:'bearbeiten',bild:bildUrl}):'<p class="meta">Die Mappe hat keine Seite.</p>')+'</div>'+
    // Beim Zuschneiden schwebt die Leiste unten über der Bühne: die Seite bleibt, wo sie ist.
    '<div class="mm-zs-ort" data-mm-zs></div></section>';
  const fokus=vorZeichnen();
  const html='<div class="pd-wrap pd-mappe-wrap'+(ui.detail?' mit-detail':'')+'">'+(IM_REITER?werkzeug+meldungHtml():kopf({zurueck:[url({werkzeug:'mustermappe',projekt:projekt.id}),'‹ Mustermappen'],
    kicker:'Mustermappe · '+projektName(),titel:inh.titel,meta,aktionen}))+
    '<div class="mm'+(a.seiten?'':' ohne-seiten')+(a.rechts?'':' ohne-rechts')+'">'+nav+mitte+eigenschaften(v,inh,seite)+'</div>'+
    '<div class="pd-druck mm-druck" aria-hidden="true">'+M.mappeHtml(inh,{modus:'druck',bild:bildUrl})+'</div>'+(ui.detail?detailPanel('entscheidungsliste'):'')+'</div>';
  zeichne(html,fokus);
  mmNachZeichnen();
  if(IM_REITER&&ui.meldung)zeigeMeldung();
}
// Zoom: Einpassen (ganze Seite in der Bühne), Seitenbreite oder Prozent von A3 in Originalgröße (420 mm = 1587 px).
const MM_A3=1587,MM_STUFEN=[.25,.33,.5,.67,.75,1,1.25,1.5,2,3];
function zoomOptionen(){
  const z=mm.ansicht.zoom,zahl=typeof z==='number';
  const stufen=zahl&&!MM_STUFEN.includes(z)?[...MM_STUFEN,z].sort((a,b)=>a-b):MM_STUFEN;
  return '<option value="fit"'+(z==='fit'?' selected':'')+' data-mm-fit>Einpassen</option><option value="breite"'+(z==='breite'?' selected':'')+'>Seitenbreite</option>'+
    stufen.map(x=>'<option value="'+x+'"'+(zahl&&x===z?' selected':'')+'>'+Math.round(x*100)+' %</option>').join('');
}
function mmBreite(b,art=mm.ansicht.zoom){
  const cs=getComputedStyle(b),w=b.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),h=b.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
  // Unter 1181 px wächst die Bühne mit der Seite: dann passt «Einpassen» die Breite ein.
  const fit=window.matchMedia('(min-width:1181px)').matches&&h>100?Math.min(w,h*420/297):w;
  return Math.max(160,Math.floor(art==='fit'?fit:art==='breite'?w:MM_A3*art));
}
function zoomAnwenden(){
  const b=root.querySelector('.mm-buehne');if(!b)return;
  const br=mmBreite(b);b.style.setProperty('--mm-breite',br+'px');
  const fit=root.querySelector('[data-mm-fit]');if(fit)fit.textContent='Einpassen · '+Math.round(mmBreite(b,'fit')/MM_A3*100)+' %';
}
// Zoomen um einen Punkt der Bühne (Strg oder ⌘ und Mausrad, auf dem Trackpad mit zwei Fingern): der Punkt bleibt stehen.
function zoomAuf(stufe,um=null){
  const b=root.querySelector('.mm-buehne');if(!b)return;
  const alt=mmBreite(b),neu=Math.min(4,Math.max(.2,Math.round(stufe*100)/100));
  const r=b.getBoundingClientRect(),x=um?um.x-r.left:b.clientWidth/2,y=um?um.y-r.top:b.clientHeight/2;
  const fx=(b.scrollLeft+x)/Math.max(1,b.scrollWidth),fy=(b.scrollTop+y)/Math.max(1,b.scrollHeight);
  mm.ansicht.zoom=neu;mmAnsichtMerken();zoomAnwenden();
  const w=root.querySelector('[data-act="mm-zoom"]');if(w)w.innerHTML=zoomOptionen();zoomAnwenden();
  if(mmBreite(b)!==alt){b.scrollLeft=fx*b.scrollWidth-x;b.scrollTop=fy*b.scrollHeight-y}
}
function zoomSchritt(richtung){
  const b=root.querySelector('.mm-buehne');if(!b)return;
  const jetzt=mmBreite(b)/MM_A3;
  const ziel=richtung>0?MM_STUFEN.find(x=>x>jetzt+.005)||MM_STUFEN.at(-1):[...MM_STUFEN].reverse().find(x=>x<jetzt-.005)||MM_STUFEN[0];
  zoomAuf(ziel);
}
function mmNachZeichnen(){
  const g=root.querySelector('.mm');if(!g)return;
  g.style.setProperty('--mm-oben',Math.round(g.getBoundingClientRect().top+window.scrollY)+'px');
  zoomAnwenden();
  mm.beobachter?.disconnect();
  const b=root.querySelector('.mm-buehne');
  if(b&&'ResizeObserver' in window){mm.beobachter=new ResizeObserver(()=>{zoomAnwenden();uebersatzPruefen();zuschnittGeist()});mm.beobachter.observe(b)}
  uebersatzPruefen();
  // Etappe 2: Auswahl, laufendes Zuschneiden und Verlauf überstehen das Neuzeichnen.
  ebeneZeichnen();zuschnittZeigen();verlaufKnoepfe();
}
// Übersatz wie in InDesign: ein Rahmen, dessen Inhalt nicht hineinpasst, wird rot markiert und rechts genannt; im PDF
// wird an der letzten ganzen Zeile abgeschnitten (alle Zeilen stehen auf der Grundlinie). Wie im Entwurf B2 je Rahmen,
// wie viel zu viel ist, «Rahmen vergrößern» (Rahmen, die sich verschieben lassen) und «Mit Romy kürzen» (ein längerer
// Text, solange Romy erreichbar ist).
const ZAHLWORT=['','eine','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn','elf','zwölf'];
function uebersatzPruefen(){
  cancelAnimationFrame(mm.uebersatzRaf);
  mm.uebersatzRaf=requestAnimationFrame(()=>{
    const b=root.querySelector('.mm-buehne'),ziel=root.querySelector('[data-mm-uebersatz]');if(!b)return;
    const namen=[],eintraege=[];
    for(const r of b.querySelectorAll('.mm-r[data-rahmen]')){
      const ueber=r.scrollHeight>r.clientHeight+1;r.classList.toggle('mm-uebersatz',ueber);
      if(!ueber)continue;
      const tab=r.querySelector('.mm-kennwerte'),unten=r.getBoundingClientRect().bottom+.5;
      const weg=tab?[...tab.rows].filter(tr=>tr.getBoundingClientRect().bottom>unten).length:0;
      namen.push(r.dataset.rahmen+(weg?' ('+weg+(weg===1?' Kennwert':' Kennwerte')+' nicht auf der Seite)':''));
      const el=weg?null:kuerzText(r),m=kuerzMass(r,el);
      const was=weg?(weg===1?'Ein Kennwert steht':weg+' Kennwerte stehen')+' nicht auf der Seite.'
        :'Der Text passt nicht: etwa '+(m.zuViel===1?'eine Zeile':(ZAHLWORT[m.zuViel]||m.zuViel)+' Zeilen')+' zu viel.';
      const knoepfe=[];
      if(r.dataset.mmr)knoepfe.push('<button type="button" class="btn" data-act="mm-groesser" data-k="'+esc(r.dataset.mmr)+'">Rahmen vergrößern</button>');
      if(romy.bereit&&el?.id&&m.zeichen>=20&&m.zeichen<m.len)knoepfe.push(mm.kuerzt===el.id
        ?'<button type="button" class="btn btn-romy" disabled>Romy kürzt …</button>'
        :'<button type="button" class="btn btn-romy" data-act="mm-kuerzen" data-ed="'+esc(el.id)+'">Mit Romy kürzen</button>');
      eintraege.push('<div class="mm-ue" role="group" aria-label="'+esc(r.dataset.rahmen)+'"><span><b>'+esc(r.dataset.rahmen)+'</b> · '+esc(was)+'</span>'+
        (knoepfe.length?'<div class="mm-knoepfe">'+knoepfe.join('')+'</div>':'')+'</div>');
    }
    if(ziel)ziel.innerHTML=namen.length?'<div class="mm-intern mm-uebersatz-liste" role="status"><strong>Passt nicht ganz in den Rahmen</strong>'+eintraege.join('')+
      '<span class="mm-ue-pdf">Kürzen oder weniger zeigen; im PDF steht nur, was in den Rahmen passt.</span></div>':'';
    const pille=root.querySelector('[data-mm-pille]');
    if(pille){
      pille.hidden=!namen.length;
      pille.textContent=namen.length===1?'1 Übersatz':namen.length+' Übersätze';
      pille.title=namen.length?'Passt nicht ganz in den Rahmen: '+namen.join(' · '):'';
    }
  });
}
// Der Text eines Rahmens, den Romy kürzen kann: der längste mehrzeilige Text darin (keine Kennwerte), ab 40 Zeichen.
function kuerzText(r){
  let best=null,n=0;
  for(const el of r.querySelectorAll('.mm-ed[aria-multiline="true"]')){
    if(el.closest('table'))continue;
    const l=mmText(el).trim().length;if(l>n){best=el;n=l}
  }
  return n>=40?best:null;
}
// Wie viele Zeilen zu viel sind und auf wie viele Zeichen der Text müsste (mit etwas Luft, weil Zeilen verschieden
// umbrechen). Gemessen in der Seite selbst, ohne Zoom: Zeilenhöhe, Höhe des Texts, Überstand des Rahmens.
function kuerzMass(r,el){
  const fehlt=r.scrollHeight-r.clientHeight,cs=getComputedStyle(el||r);
  let lh=parseFloat(cs.lineHeight);if(!(lh>0))lh=(parseFloat(cs.fontSize)||12)*1.25;
  const zuViel=Math.max(1,Math.ceil((fehlt-1)/lh));
  if(!el)return {zuViel,zeilen:0,zeichen:0,len:0};
  const len=mmText(el).trim().length,jetzt=Math.max(1,Math.round(el.offsetHeight/lh)),zeilen=jetzt-zuViel;
  return {zuViel,zeilen,zeichen:zeilen>0?Math.floor(len*zeilen/jetzt*.92):0,len};
}
// «Mit Romy kürzen» (Entwurf B2): Romy schlägt einen kürzeren Text vor, so lang, wie der Rahmen fasst. Im Dialog lässt
// er sich noch ändern; «Übernehmen» setzt ihn wie getippt (ein Schritt im Verlauf). Ohne «Übernehmen» ändert sich nichts.
async function mitRomyKuerzen(id){
  const v=vorlageZeile(),el=id?document.getElementById(id):null,r=el?.closest('.mm-r[data-rahmen]');
  if(!v||!istMappe(v)||!el||!r||mm.kuerzt)return;
  const m=kuerzMass(r,el),alt=mmText(el).trim(),name=r.dataset.rahmen;
  if(!(m.zeichen>=20&&m.zeichen<alt.length)){meldung('Der Rahmen «'+name+'» ist zu klein, um den Text sinnvoll zu kürzen: bitte vergrößern.','warn');return}
  const seite=mappeSeite(v),pz=seite?.punkt?zeileVon(seite.punkt):null;
  mm.kuerzt=id;uebersatzPruefen();
  try{
    await alleSpeichern();
    const antwort=await romyAufruf({action:'kuerzen',dokument_id:v.dokument_id,zeile_id:v.id,text:alt,zeichen:m.zeichen,zeilen:m.zeilen,rahmen:name,
      position:String(pz?.daten?.thema||seite?.titel||'')});
    if(antwort.result.unveraendert){meldung('Romy hat «'+name+'» nicht kürzer bekommen.','warn');return}
    kuerzDialog({id,name,alt,ziel:m.zeichen,...antwort.result});
  }finally{mm.kuerzt=null;uebersatzPruefen()}
}
function kuerzDialog({id,name,alt,ziel,neu,begruendung='',hinweise=[],zu_lang=false}){
  const warn=[...(zu_lang?['Noch etwas zu lang für den Rahmen.']:[]),...hinweise];
  dialog.innerHTML='<form class="pd-dlg pd-kuerzen"><div class="pd-detail-kopf"><h2>Mit Romy kürzen · «'+esc(name)+'»</h2><button type="button" class="pd-x" data-dlg="zu" aria-label="Schließen">×</button></div>'+
    '<p class="meta">In den Rahmen passen etwa '+ziel+' Zeichen, bisher sind es '+alt.length+'. Vor dem Übernehmen lesen und anpassen.</p>'+
    (warn.length?'<ul class="pd-kuerzen-warn">'+warn.map(h=>'<li>'+esc(h)+'</li>').join('')+'</ul>':'')+
    '<label class="pd-feld"><span>Gekürzt</span><textarea class="pd-in" name="neu" rows="8">'+esc(neu)+'</textarea></label>'+
    '<p class="meta" data-kuerz-zahl aria-live="polite"></p>'+(begruendung?'<p class="meta">Romy: '+esc(begruendung)+'</p>':'')+
    '<details class="pd-kuerzen-bisher"><summary>Bisher</summary><p>'+esc(alt)+'</p></details>'+
    '<div class="pd-dlg-aktionen"><button type="button" class="btn" data-dlg="verwerfen">Verwerfen</button><button type="submit" class="btn btn-primary">Übernehmen</button></div></form>';
  const form=dialog.querySelector('form'),ta=form.elements.neu,zahl=form.querySelector('[data-kuerz-zahl]');
  const zaehlen=()=>{const n=ta.value.trim().length;zahl.textContent=n+' Zeichen'+(n>ziel?' · etwa '+(n-ziel)+' zu viel':'')};
  ta.oninput=zaehlen;zaehlen();
  for(const k of form.querySelectorAll('[data-dlg="zu"],[data-dlg="verwerfen"]'))k.onclick=()=>dialog.close();
  form.onsubmit=e=>{e.preventDefault();const t=ta.value.trim();dialog.close();if(t)kuerzUebernehmen(id,name,t)};
  dialog.showModal();ta.focus();
}
function kuerzUebernehmen(id,name,t){
  const v=vorlageZeile(),el=document.getElementById(id);
  if(!v||!istMappe(v)||!el){meldung('Der Text ist nicht mehr auf der Seite; nichts geändert.','warn');return}
  const schritt=vorher('Text «'+name+'» gekürzt',[v,...mappePunkte(v)]);
  el.textContent=t;
  if(!mappeEingabe(el))return;
  nachher(schritt);render();meldung('«'+name+'» gekürzt.');
}
// «Rahmen vergrößern»: so viele Felder nach unten, wie der Text braucht (ein Feld und sein Abstand sind 32 mm), höchstens
// bis zum Ende des Rasters. Ein Schritt im Verlauf; was danach überlappt, nennt die Karte «Layout».
function rahmenGroesser(key){
  const el=rahmenEl(key),blatt=el?.closest('.mm-seite');if(!el||!blatt)return;
  const g=geoAus(el.dataset.mmrG),Z=M.RASTER.zeilen,proMm=blatt.getBoundingClientRect().width/M.RASTER.breite;
  const schritt=(M.RASTER.feld+M.RASTER.abstand)*proMm,fehlt=el.scrollHeight-el.clientHeight;
  const mehr=Math.max(1,Math.ceil(fehlt/Math.max(1,schritt))),h=Math.min(g.h+mehr,Z-g.r+1);
  if(h<=g.h){meldung('Unter «'+(el.dataset.mmrName||key)+'» ist im Raster kein Platz mehr: den Rahmen verschieben oder den Text kürzen.','warn');return}
  waehle(key);
  layoutAendern(key,{...g,h},'Rahmen «'+(el.dataset.mmrName||key)+'» vergrößert');
  if(h<g.h+mehr)meldung('«'+(el.dataset.mmrName||key)+'» reicht jetzt bis zum Ende des Rasters; passt es noch nicht, den Text kürzen.','warn');
}
// Ein Klick auf den Hinweis in der Leiste: Eigenschaften zeigen, den ersten Rahmen wählen, der nicht passt, und ihn in
// den Blick holen.
function uebersatzZeigen(){
  teilZeigen('seite');
  if(!mm.ansicht.rechts){
    mm.ansicht.rechts=true;mmAnsichtMerken();root.querySelector('.mm')?.classList.remove('ohne-rechts');
    root.querySelector('[data-act="mm-rechts"]')?.setAttribute('aria-pressed','true');zoomAnwenden();
  }
  const r=root.querySelector('.mm-buehne .mm-r.mm-uebersatz[data-mmr]');
  if(r){waehle(r.dataset.mmr);r.scrollIntoView({block:'nearest',inline:'nearest'})}
  root.querySelector('[data-mm-uebersatz]')?.scrollIntoView({block:'nearest'});
}
// Kleine Menüs der Mappe: «•••» im Reiter (seltene Befehle) und «+» über dem Streifen (Seite oder Position hinzufügen).
// Ein Klick daneben, Esc oder Scrollen schließt; ein Schalter darin lässt «•••» offen. «+» liegt im scrollenden Streifen
// und steht deshalb fest im Fenster, unter seinem Knopf.
function menue(name,auf){
  const m=root.querySelector('.mm-'+name+'-menue'),k=root.querySelector('[data-act="mm-'+name+'"]');if(!m||!k)return;
  m.hidden=!auf;k.setAttribute('aria-expanded',String(!!auf));
  if(!auf)return;
  if(name==='plus'){const r=k.getBoundingClientRect();m.style.top=Math.round(r.bottom+6)+'px';m.style.left=Math.round(Math.max(8,Math.min(r.left,innerWidth-m.offsetWidth-8)))+'px'}
  m.querySelector('button')?.focus();
}
const offenesMenue=()=>root.querySelector('.mm-mehr-menue:not([hidden]),.mm-plus-menue:not([hidden])');
document.addEventListener('pointerdown',e=>{
  const m=offenesMenue();if(m&&!e.target.closest?.('.mm-mehr,.mm-plus'))menue(m.matches('.mm-plus-menue')?'plus':'mehr',false);
},true);
document.addEventListener('keydown',e=>{
  const m=offenesMenue();if(e.key!=='Escape'||!m)return;
  const n=m.matches('.mm-plus-menue')?'plus':'mehr';
  e.preventDefault();e.stopPropagation();menue(n,false);root.querySelector('[data-act="mm-'+n+'"]')?.focus();
},true);
document.addEventListener('scroll',e=>{if(!e.target.closest?.('.mm-plus-menue')&&root.querySelector('.mm-plus-menue:not([hidden])'))menue('plus',false)},true);
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
  // Für diese Mappe geänderte Texte (26.11.2026): je Text «zurücksetzen» auf den Stand der Bibliothek.
  const alle=K.optionen(z.daten);
  const aufSeite=seite.typ==='material'?[alle.find(o=>o.id===seite.option)||alle[0]].filter(Boolean)
    :(Array.isArray(seite.optionen)?alle.filter(o=>seite.optionen.includes(o.id)):alle).slice(0,M.MAX_KANDIDATEN);
  for(const o of aufSeite){
    const g=M.geaenderteTexte(o,M.anpassbarAuf(seite));
    if(g.length)li.push('<li class="mm-geaendert-zeile"><span><strong>'+esc(o.id)+': in dieser Mappe geändert.</strong> Die Produktbibliothek bleibt, wie sie ist.</span><span class="mm-knoepfe">'+
      g.map(x=>'<button type="button" class="btn" data-act="mm-zuruecksetzen" data-z="'+z.id+'" data-o="'+esc(o.id)+'" data-feld="'+x.feld+'">'+esc(x.name)+' zurücksetzen</button>').join('')+'</span></li>');
  }
  return li.length?'<div class="mm-intern"><strong>Nur im Büro sichtbar</strong><ul>'+li.join('')+'</ul></div>':'';
}
// Nach dem Tippen: nur die Hinweise unter der Seite neu, das Feld mit dem Fokus bleibt.
function mappeHinweiseNeu(){
  clearTimeout(mm.hinweisTimer);
  mm.hinweisTimer=setTimeout(()=>{const v=vorlageZeile(),h=root.querySelector('[data-mm-hinweise]');if(v&&h&&istMappe(v))h.innerHTML=mappeHinweise(v,mappeSeite(v));uebersatzPruefen()},250);
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
  const aendern='<button type="button" class="pd-link" data-act="mm-bild" data-z="'+esc(o._z)+'" data-o="'+esc(o.id)+'" data-i="0">'+
    (liste.length?'Eigenes Bild oder Ausschnitt …':'Eigenes Bild hochladen …')+'</button>';
  if(!liste.length)return '<p class="meta">'+esc(o.id)+': kein Foto in der Bibliothek.</p>'+aendern;
  const gew=Array.isArray(o.muster_fotos)?o.muster_fotos:[];
  // Etappe 2: die Fotos lassen sich auch auf die Seite ziehen, auf ein Foto der Variante oder einen freien Platz.
  return '<div class="pd-feld"><span>Fotos '+esc(o.id)+(gew.length?'':' · automatisch das erste')+'</span><div class="mm-thumbs">'+liste.slice(0,8).map(d=>{
    const n=gew.findIndex(f=>f.id===d.id),url=bildUrl(d.storage_path);
    return '<button type="button" class="mm-thumb" draggable="true" data-act="mm-foto" data-z="'+esc(o._z)+'" data-o="'+esc(o.id)+'" data-d="'+esc(d.id)+'" aria-pressed="'+(n>=0?'true':'false')+'" aria-label="'+esc('Foto '+(d.name||'')+(n>=0?', Nummer '+(n+1):''))+'" title="Klicken wählt, auf die Seite ziehen setzt es dort ein">'+
      (url?'<img src="'+esc(url)+'" alt="" draggable="false">':'')+(n>=0?'<b>'+(n+1)+'</b>':'')+'</button>';
  }).join('')+'</div>'+aendern+'</div>';
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
  }else if(seite?.typ==='frei'||seite?.typ==='deckblatt'){
    // Bild der freien Seite oder Titelbild des Deckblatts (26.11.2026): ein Bild oder eine Seite aus einem PDF.
    karte+='<p class="meta">'+(seite.typ==='frei'?'Ein Bild oder ein PDF, etwa ein Plan aus Archicad oder eine Seite aus InDesign; vom PDF kommt eine Seite als Bild auf die Seite.'
        :'Titel, Projekt und Termin kommen aus den Angaben der Mappe. Darüber ein Titelbild (optional), etwa ein Rendering; ohne Bild bleibt die Fläche weiß.')+'</p>'+
      '<label class="pd-feld"><span>Seite im PDF</span><input class="pd-in" type="number" min="1" max="2000" data-act="mm-pdf-seite" value="'+esc(seite.pdf_seite||1)+'"></label>'+
      '<label class="btn">'+(seite.bild?.pfad?'Anderes Bild oder PDF':seite.typ==='frei'?'Bild oder PDF hochladen':'Titelbild hochladen')+'<input type="file" class="pb-datei" hidden accept="image/jpeg,image/png,image/webp,application/pdf" data-act="mm-datei"></label>'+
      (seite.bild?.pfad?' <button type="button" class="btn" data-act="mm-bild-weg">Bild entfernen</button>':'');
  }else karte+='<p class="meta">Die Übersicht entsteht aus den Positionen; bei Strategie A und B getrennt.</p>';
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
    ang('besprechung_am','Bemusterungstermin','TT.MM.JJJJ')+ang('auftraggeber','Bauherr')+ang('strategie_a','Strategie A','kurz, z. B. Terrazzo und Eiche')+ang('strategie_b','Strategie B')+ang('verfasser','Verfasser')+
    // Kopfzeile wie im Archicad-Master (26.11.2026): «Projekt | Phase | Untertitel» auf jeder Seite.
    '<h3>Kopfzeile</h3><p class="meta">Steht auf jeder Seite oben links, wie im Archicad-Master; leer gilt der graue Vorschlag.</p>'+
    ang('kopf_projekt','Projekt',[projekt?.number,projekt?.name].filter(Boolean).join(' ')||'Projektadresse')+ang('kopf_phase','Phase','z. B. Entwurf')+
    ang('kopf_untertitel','Untertitel',v.daten.titel||'Mustermappe')+'</section>';
  const termin=terminKarte(v);
  const staende=ui.staende===null?'<p class="meta">wird geladen …</p>':ui.staende.length?'<ul class="pd-staende">'+ui.staende.map(s=>'<li><button type="button" class="pd-link" data-act="stand" data-id="'+s.id+'">'+esc(s.bezeichnung)+'</button><span>'+esc([K.datumLang(String(s.created_at).slice(0,10)),name(s.created_by)].filter(Boolean).join(' · '))+'</span></li>').join('')+'</ul>'
    :'<p class="meta">Noch kein Stand. Beim Vorlegen wird der Stand festgehalten und bleibt unverändert.</p>';
  return {seite:karte,position,mappe:positionen+angaben+termin+'<section class="card" data-staende><h2>Stände</h2>'+staende+'</section>'};
}
function neueMappeDialog(){
  dialog.innerHTML='<form method="dialog" class="pd-dlg"><h2>Neue Mustermappe</h2><p class="meta">Eine Mappe je Themenpaket. Die Positionen (Codes aus dem Plan) und ihre Kandidaten aus der Produktbibliothek kommen danach.</p>'+
    '<label class="pd-feld"><span>Themenpaket</span><select class="pd-in" name="paket">'+M.THEMEN.map(t=>'<option>'+esc(t)+'</option>').join('')+'</select></label>'+
    '<label class="pd-feld"><span>Bemusterungstermin (falls schon bekannt)</span><input class="pd-in" name="termin" placeholder="TT.MM.JJJJ" autocomplete="off"></label>'+
    '<p class="pd-dlg-fehler" data-dlg-fehler></p><div class="pd-dlg-aktionen"><button type="button" class="btn" data-dlg="abbrechen">Abbrechen</button><button type="submit" class="btn btn-primary">Mappe anlegen</button></div></form>';
  const form=dialog.querySelector('form');
  form.querySelector('[data-dlg="abbrechen"]').onclick=()=>dialog.close();
  // Im Reiter: Work erfährt, wenn das Anlegen abgebrochen wird, und öffnet die neue Mappe über die Adresse der Seite.
  let angelegt=false;
  if(IM_REITER)dialog.addEventListener('close',()=>{if(!angelegt)window.parent.postMessage({tbaOfficeTool:'abgebrochen'},location.origin)},{once:true});
  form.onsubmit=e=>{
    e.preventDefault();const t=K.leseDatum(form.termin.value);
    if(t===null){dialog.querySelector('[data-dlg-fehler]').textContent='Datum bitte als TT.MM.JJJJ eingeben.';return}
    angelegt=true;dialog.close();
    void sicher(async()=>{const v=await neueZeile('entscheidungsvorlagen',M.neueMappe({themenpaket:form.paket.value,verfasser:meinName(),termin:t}));
      if(IM_REITER){await alleSpeichern();location.assign(url({projekt:projekt.id,vorlage:v.id}));return}
      gehe({projekt:projekt.id,vorlage:v.id})});
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
  const t=vorher('Position '+code+' angelegt',[v]);
  v.daten={...v.daten,punkte:[...(v.daten.punkte||[]),z.id],seiten:[...M.seitenVon(v.daten),seite]};markiere(v);nachher(t);
  mm.seite=seite.id;mm.ansicht.teil='position';mm.ansicht.rechts=true;mmAnsichtMerken();meldung('Position '+code+' angelegt; sie steht auch in der Entscheidungsliste.');render();
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
  // Rückgängig nimmt den Kandidaten wieder aus der Position; in der Musterliste bleibt er (wie bei «entfernen»).
  const t=vorher('Kandidat '+p.name+' hinzugefügt',[z]);
  if(!setze('entscheidungsliste',z,'optionen',[...K.optionen(z.daten),M.kandidat(K.optionen(z.daten),p,{produkt:Z.produktText(p,ver)})]))return;
  nachher(t);
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
// Ein Bild (oder eine Seite aus einem PDF) in den Speicher der Mappe: Dokument, wer hochlädt, Datei. Für freie Seiten
// und für eigene Bilder einer Variante; die Produktbibliothek ändert sich dabei nie.
async function bildHochladen(datei,pdfSeite=1){
  let blob=datei,typ=datei.type||'',name=datei.name||'Bild';
  if(typ==='application/pdf'||/\.pdf$/i.test(name)){
    if(datei.size>40*1024*1024)throw new Error('Das PDF ist größer als 40 MB.');
    meldung('PDF wird gelesen …');
    const r=await pdfAlsBild(datei,Number(pdfSeite)||1);
    blob=r.blob;typ='image/jpeg';name=name.replace(/\.pdf$/i,'')+' · Seite '+r.seite+' von '+r.seiten;
  }
  const f=M.bildPruefen(typ,blob.size);if(f)throw new Error(f);
  const dok=await sichereDokument('entscheidungsvorlagen');
  const pfad=M.dateiPfad(dok.id,nutzer.id,crypto.randomUUID(),typ);
  const {error}=await sb.storage.from(M.BUCKET).upload(pfad,blob,{contentType:typ,upsert:false});
  if(error)throw new Error('Das Bild wurde nicht hochgeladen: '+(error.message||'Fehler'));
  await signiere(M.BUCKET,[pfad]);
  return {pfad,name:String(name).slice(0,160)};
}
async function freiesBild(v,seiteId,datei){
  if(!datei)return;
  const seite=M.seitenVon(v.daten).find(x=>x.id===seiteId);if(!seite)return;
  const {pfad,name}=await bildHochladen(datei,Number(seite.pdf_seite)||1);
  const t=vorher(seite.typ==='deckblatt'?'Titelbild gesetzt':'Bild der Seite gesetzt',[v]);
  seitePatch(v,seiteId,{bild:{pfad,name},...(seite.typ==='frei'?{titel:seite.titel||String(name).replace(/\.(jpe?g|png|webp)$/i,'').slice(0,120)}:{})});
  nachher(t);
  meldung(seite.typ==='deckblatt'?'Das Titelbild steht auf dem Deckblatt.':'Das Bild steht auf der Seite.');render();
}

// ---------- Mustermappe: Bild ändern (Gari, 26.11.2026) ----------
// Jedes Foto einer Variante lässt sich auf der Seite ersetzen: durch ein anderes aus der Produktbibliothek oder ein
// eigenes Bild (bleibt in der Mappe), und zuschneiden: im Rahmen verschieben und vergrößern. Hat die Variante noch keine
// Wahl, gilt das erste Foto der Bibliothek; eine Änderung hält es dann als gewählt fest.
function fotosDerVariante(o){
  const eigene=M.fotoListe(o?.muster_fotos);
  if(eigene.length)return eigene;
  const erstes=(mm.fotos.get(o?.produkt_id)||[])[0];
  return erstes?[{id:erstes.id,pfad:erstes.storage_path}]:[];
}
function bildVariante(ziel=mm.bild){
  const z=ziel?zeileVon(ziel.z):null,o=z?K.optionen(z.daten).find(x=>x.id===ziel.o):null;
  return z&&o?{z,o}:null;
}
function bildDialog(z,oid,i){
  mm.bild={z:z.id,o:oid,i:Math.max(0,Number(i)||0)};
  bildDialogZeichnen();
  if(!dialog.open)dialog.showModal();
  dialog.addEventListener('close',()=>{mm.bild=null},{once:true});
}
// ziel: die Stelle, für die der Dialog offen war; ein Bild, das noch lädt, landet dort auch, wenn der Dialog schon zu ist.
function bildAendern(f,{neuesBild=null,ziel=mm.bild,text='Bild geändert',gruppe=''}={}){
  const x=bildVariante(ziel);if(!x)return [];
  const neu=f(fotosDerVariante(x.o));
  const t=vorher(text,[x.z],{gruppe});
  optionenPatch(x.z,x.o.id,o=>({...o,muster_fotos:neu}));nachher(t);
  if(ziel===mm.bild){
    if(neuesBild){const k=neu.findIndex(b=>b.pfad===neuesBild);if(k>=0)mm.bild.i=k}
    mm.bild.i=Math.min(mm.bild.i,neu.length);
  }
  render();if(mm.bild)bildDialogZeichnen();
  return neu;
}
// Seitenverhältnis des Rahmens, wie er im PDF steht: die Seite einmal unsichtbar wie im Druck setzen und messen. Beim
// Bearbeiten sind die Felder etwas höher als der gedruckte Text, die Fotos dadurch flacher; der Ausschnitt gilt fürs PDF.
function rahmenImPdf(zid,oid,i){
  const v=vorlageZeile(),seite=v&&istMappe(v)?mappeSeite(v):null;
  if(!seite||seite.punkt!==zid||(seite.typ!=='vergleich'&&seite.typ!=='material'))return 0;
  const inh=mappeJetzt(v),p=inh.punkte.find(x=>x.id===zid);if(!p)return 0;
  const box=document.createElement('div');box.className='mm-messen';box.setAttribute('aria-hidden','true');
  box.innerHTML=M.seiteHtml(seite,inh,{modus:'druck',bild:bildUrl});
  document.body.append(box);
  try{
    const r=box.querySelector('[data-mmfoto="'+CSS.escape(oid+'|'+i)+'"]')?.getBoundingClientRect();
    return r&&r.width>0&&r.height>0?r.width/r.height:0;
  }finally{box.remove()}
}
const ausschnittStil=(img,a)=>{
  img.style.objectPosition=a.x+'% '+a.y+'%';img.style.transformOrigin=a.x+'% '+a.y+'%';img.style.transform=a.z>1?'scale('+a.z+')':'';
};
function bildDialogZeichnen(fokus=''){
  const x=bildVariante();if(!x){if(dialog.open)dialog.close();return}
  const {z,o}=x,liste=fotosDerVariante(o),i=Math.min(mm.bild.i,liste.length),f=liste[i]||null;
  // Ohne gewähltes Foto zeigt die Seite das erste der Bibliothek; das lässt sich ersetzen, nicht entfernen.
  const standard=!M.fotoListe(o.muster_fotos).length;
  // Seitenverhältnis wie der Rahmen im PDF; sonst wie auf der Bühne, sonst 4:3.
  const imPdf=f?rahmenImPdf(z.id,o.id,i):0;
  if(imPdf)mm.bild.verhaeltnis=imPdf;
  else{const r=root.querySelector('[data-bildplatz="'+CSS.escape(z.id+'|'+o.id+'|'+i)+'"]')?.getBoundingClientRect();if(r&&r.width>0&&r.height>0)mm.bild.verhaeltnis=r.width/r.height}
  const verh=Math.min(4,Math.max(.5,mm.bild.verhaeltnis||4/3));
  const a={x:50,y:50,z:1,...(f?.ausschnitt||{})};
  const url=f?bildUrl(f.pfad,f.quelle==='mappe'?M.BUCKET:M.BUCKET_PRODUKTE):'';
  const bib=mm.fotos.get(o.produkt_id)||[];
  const stelle=i===0?'großes Bild':'Bild '+(i+1);
  dialog.innerHTML='<div class="pd-dlg pd-dlg-breit mm-bild-dlg"><div class="pd-detail-kopf"><h2>Bild · Variante '+esc(o.id)+', '+stelle+'</h2>'+
    '<button type="button" class="pd-x" data-bd="zu" aria-label="Schließen">×</button></div><div class="mm-bild-raster"><section>'+
    (url?'<h3>Ausschnitt, wie im PDF</h3><div class="mm-ausschnitt" tabindex="0" role="group" aria-label="Ausschnitt: ziehen oder mit den Pfeiltasten verschieben, mit + und − vergrößern" style="--verh:'+verh.toFixed(3)+';aspect-ratio:'+verh.toFixed(3)+'">'+
        '<img src="'+esc(url)+'" alt="" draggable="false"></div>'+
        '<label class="pd-feld"><span>Vergrößern</span><input type="range" min="1" max="'+M.ZOOM_MAX+'" step="0.05" value="'+a.z+'" data-bd="zoom"></label>'+
        '<div class="mm-knoepfe"><button type="button" class="btn" data-bd="mitte">Ausschnitt zurücksetzen</button>'+
        (i>0?'<button type="button" class="btn" data-bd="gross">Als großes Bild</button>':'')+(standard?'':'<button type="button" class="btn" data-bd="weg">Bild entfernen</button>')+'</div>'+
        '<p class="meta">'+(standard?'Das erste Foto aus der Produktbibliothek, solange kein anderes gewählt ist. ':'')+'Der Ausschnitt gilt für dieses Bild auf allen Seiten der Mappe.</p>'
      :'<h3>Noch kein Bild</h3><p class="meta">Rechts eines aus der Produktbibliothek wählen oder ein eigenes hochladen.</p>')+
    '</section><section><h3>'+(f?'Anderes Bild':'Bild wählen')+'</h3>'+
    (bib.length?'<p class="meta">Aus der Produktbibliothek</p><div class="mm-thumbs">'+bib.slice(0,12).map(d=>{const u=bildUrl(d.storage_path);
        return '<button type="button" class="mm-thumb" data-bd="bib" data-d="'+esc(d.id)+'" aria-pressed="'+(f?.pfad===d.storage_path?'true':'false')+'" aria-label="'+esc('Foto '+(d.name||''))+'">'+(u?'<img src="'+esc(u)+'" alt="">':'')+'</button>'}).join('')+'</div>'
      :'<p class="meta">In der Produktbibliothek gibt es dazu kein Foto.</p>')+
    '<label class="btn">Eigenes Bild hochladen<input type="file" class="pb-datei" hidden accept="image/jpeg,image/png,image/webp,application/pdf" data-bd="datei"></label>'+
    '<label class="pd-feld"><span>Seite im PDF (bei einem PDF)</span><input class="pd-in" type="number" min="1" max="2000" value="'+esc(mm.bild.pdfSeite||1)+'" data-bd="pdfseite"></label>'+
    '<p class="meta">JPG, PNG oder WebP bis 15 MB, oder eine Seite aus einem PDF. Das Bild bleibt in dieser Mappe; die Produktbibliothek ändert sich nicht.</p>'+
    '</section></div><p class="pd-dlg-fehler" data-dlg-fehler></p><div class="pd-dlg-aktionen"><button type="button" class="btn btn-primary" data-bd="zu">Fertig</button></div></div>';
  const box=dialog.querySelector('.mm-bild-dlg'),fehler=t=>{box.querySelector('[data-dlg-fehler]').textContent=t||''};
  const los=f2=>{fehler('');Promise.resolve().then(f2).catch(e=>{console.error('Mustermappe · Bild',e);fehler(e?.message||'Das hat nicht geklappt.')})};
  box.addEventListener('click',e=>{
    const b=e.target.closest('[data-bd]');if(!b)return;
    const was=b.dataset.bd;
    if(was==='zu')dialog.close();
    else if(was==='bib'){const d=bib.find(x=>x.id===b.dataset.d);if(d)los(()=>bildAendern(l=>M.fotoSetzen(l,i,{id:d.id,pfad:d.storage_path}),{neuesBild:d.storage_path,text:'Foto aus der Bibliothek gewählt'}))}
    else if(was==='mitte')los(()=>bildAendern(l=>M.fotoAusschnitt(l,i,null),{text:'Ausschnitt zurückgesetzt'}));
    else if(was==='gross')los(()=>{mm.bild.i=0;bildAendern(l=>M.fotoNachVorn(l,i),{text:'Als großes Bild gesetzt'})});
    else if(was==='weg')los(()=>{const rest=bildAendern(l=>M.fotoEntfernen(l,i),{text:'Bild entfernt'});dialog.close();
      meldung(!rest.length&&bib.length?'Bild entfernt. Die Seite zeigt wieder das erste Foto aus der Produktbibliothek.':'Bild entfernt.')});
  });
  box.addEventListener('change',e=>{
    const el=e.target;
    if(el.dataset.bd==='pdfseite')mm.bild.pdfSeite=Math.max(1,Math.floor(Number(el.value))||1);
    else if(el.dataset.bd==='datei'){
      const datei=el.files?.[0];if(!datei)return;
      el.closest('label')?.classList.add('laedt');fehler('');
      bildHochladenUndSetzen(datei,i).catch(err=>{console.error('Mustermappe · Bild',err);fehler(err?.message||'Das Bild wurde nicht hochgeladen.');el.closest('label')?.classList.remove('laedt')});
    }
    else if(el.dataset.bd==='zoom'&&f)los(()=>bildAendern(l=>M.fotoAusschnitt(l,i,{...a}),{text:'Ausschnitt geändert',gruppe:'ausschnitt-'+i}));
  });
  if(!url)return;
  // Ausschnitt: ziehen, Pfeiltasten, + und −; gespeichert wird beim Loslassen.
  const feld=box.querySelector('.mm-ausschnitt'),img=feld.querySelector('img'),zoom=box.querySelector('[data-bd="zoom"]');
  ausschnittStil(img,a);
  zoom.addEventListener('input',()=>{a.z=Number(zoom.value)||1;ausschnittStil(img,a)});
  let zug=null;
  feld.addEventListener('pointerdown',e=>{zug={px:e.clientX,py:e.clientY,x:a.x,y:a.y};feld.setPointerCapture?.(e.pointerId);feld.classList.add('zieht')});
  feld.addEventListener('pointermove',e=>{
    if(!zug)return;
    const b=feld.getBoundingClientRect();
    a.x=Math.min(100,Math.max(0,zug.x-(e.clientX-zug.px)/b.width*100/a.z));
    a.y=Math.min(100,Math.max(0,zug.y-(e.clientY-zug.py)/b.height*100/a.z));
    ausschnittStil(img,a);
  });
  const loslassen=()=>{if(!zug)return;zug=null;feld.classList.remove('zieht');los(()=>bildAendern(l=>M.fotoAusschnitt(l,i,{...a}),{text:'Ausschnitt geändert',gruppe:'ausschnitt-'+i}))};
  feld.addEventListener('pointerup',loslassen);feld.addEventListener('pointercancel',loslassen);
  feld.addEventListener('keydown',e=>{
    const schritt=e.shiftKey?10:2,k=e.key;
    if(k==='ArrowLeft')a.x=Math.max(0,a.x-schritt);else if(k==='ArrowRight')a.x=Math.min(100,a.x+schritt);
    else if(k==='ArrowUp')a.y=Math.max(0,a.y-schritt);else if(k==='ArrowDown')a.y=Math.min(100,a.y+schritt);
    else if(k==='+'||k==='=')a.z=Math.min(M.ZOOM_MAX,Math.round((a.z+.1)*100)/100);else if(k==='-')a.z=Math.max(1,Math.round((a.z-.1)*100)/100);
    else return;
    e.preventDefault();ausschnittStil(img,a);zoom.value=a.z;
    clearTimeout(mm.bildTimer);mm.bildTimer=setTimeout(()=>los(()=>{bildAendern(l=>M.fotoAusschnitt(l,i,{...a}),{text:'Ausschnitt geändert',gruppe:'ausschnitt-'+i});dialog.querySelector('.mm-ausschnitt')?.focus()}),400);
  });
  if(fokus==='ausschnitt')feld.focus();
}
async function bildHochladenUndSetzen(datei,i){
  const ziel=mm.bild;if(!ziel)return;
  const {pfad,name}=await bildHochladen(datei,ziel.pdfSeite||1);
  bildAendern(l=>M.fotoSetzen(l,i,{id:'m-'+crypto.randomUUID(),pfad,quelle:'mappe',name}),{neuesBild:pfad,ziel,text:'Eigenes Bild hochgeladen'});
  meldung('Das Bild steht auf der Seite; es bleibt in dieser Mappe.');
}
// ---------- Mustermappe, Etappe 2 (Gari, 26.11.2026): Rahmen, Zuschneiden, Fotos ziehen, Rückgängig ----------
// Gelernt von InDesign, Canva und Figma (Recherche vom 26.11.2026), aber auf dem TBA-Raster: ein Rahmen springt beim
// Verschieben und beim Ändern der Größe von Feld zu Feld (12 × 8); die Vorlage bleibt das Layout zum Anfangen.
// Texte bleiben mit einem Klick zu schreiben (Etappe 1); verschoben wird am Griff über dem Rahmen, ein Foto auch an
// sich selbst. Doppelklick auf ein Foto schneidet es auf der Seite zu; Fotos kommen aus der Bibliothek (rechts) oder
// vom Schreibtisch auf die Seite. Jede Änderung ist ein Schritt im Verlauf der Mappe.
const MM_ICON={
  zurueck:'<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M7.5 4 3.5 8l4 4M4 8h8a4.5 4.5 0 0 1 0 9H9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  vor:'<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="m12.5 4 4 4-4 4M16 8H8a4.5 4.5 0 0 0 0 9h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'};
const MAC=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent||'');
const TASTE={zurueck:MAC?'⌘Z':'Strg+Z',vor:MAC?'⇧⌘Z':'Strg+Y'};

// Verlauf je Mappe: ein Schritt hält die geänderten Felder der Zeilen (Mappe, Positionen) vorher und nachher; Seiten
// und Varianten je id. Rückgängig setzt nur diese Felder zurück: was inzwischen anderswo geändert wurde, bleibt. Im
// Textfeld gilt das Rückgängig des Browsers; nach dem Verlassen des Felds ist die ganze Eingabe ein Schritt.
const VERLAUF_MAX=80;
const klon=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const MIT_ID={seiten:true,optionen:true};
function verlauf(){
  const v=vorlageZeile();if(!v||!istMappe(v))return null;
  if(mm.verlauf?.mappe!==v.id)mm.verlauf={mappe:v.id,zurueck:[],vor:[]};
  return mm.verlauf;
}
function vorher(text,liste,{gruppe=''}={}){
  return {text,gruppe,seite:mm.seite,vor:[...new Set((liste||[]).filter(Boolean))].map(z=>({z,daten:klon(z.daten)||{}}))};
}
function unterschiede(a,b){
  const out=[];
  for(const k of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){
    const x=a?.[k],y=b?.[k];if(gleich(x,y))continue;
    if(MIT_ID[k]&&Array.isArray(x)&&Array.isArray(y)&&gleich(x.map(e=>e?.id),y.map(e=>e?.id))){
      x.forEach((e,i)=>{const f=y[i]||{};for(const kk of new Set([...Object.keys(e||{}),...Object.keys(f)]))
        if(!gleich(e?.[kk],f[kk]))out.push({liste:k,id:e?.id,feld:kk,vor:klon(e?.[kk]),nach:klon(f[kk])})});
    }else out.push({feld:k,vor:klon(x),nach:klon(y)});
  }
  return out;
}
function nachher(t){
  const vl=verlauf();if(!t||!vl)return false;
  const teile=t.vor.map(({z,daten})=>({id:z.id,teile:unterschiede(daten,z.daten)})).filter(x=>x.teile.length);
  if(!teile.length)return false;
  const oben=vl.zurueck.at(-1),jetzt=Date.now();
  if(t.gruppe&&oben?.gruppe===t.gruppe&&jetzt-oben.um<1500){
    // Mehrere Schritte derselben Art kurz hintereinander (Pfeiltasten, Ausschnitt) sind ein Schritt.
    for(const x of teile){
      const y=oben.teile.find(q=>q.id===x.id);if(!y){oben.teile.push(x);continue}
      for(const p of x.teile){const q=y.teile.find(r=>r.liste===p.liste&&r.id===p.id&&r.feld===p.feld);if(q)q.nach=p.nach;else y.teile.push(p)}
    }
    oben.um=jetzt;
  }else{vl.zurueck.push({text:t.text,gruppe:t.gruppe,seite:t.seite,um:jetzt,teile});if(vl.zurueck.length>VERLAUF_MAX)vl.zurueck.shift()}
  vl.vor=[];verlaufKnoepfe();
  if(ui.ansicht==='mappe')requestAnimationFrame(miniAuffrischen);
  return true;
}
function teilSetzen(daten,p,wert){
  const d={...daten};
  if(p.liste){
    const l=Array.isArray(d[p.liste])?d[p.liste]:null,i=l?l.findIndex(e=>e?.id===p.id):-1;if(i<0)return daten;
    const e={...l[i]};if(wert===undefined)delete e[p.feld];else e[p.feld]=klon(wert);
    d[p.liste]=l.map((x,j)=>j===i?e:x);
  }else if(wert===undefined)delete d[p.feld];else d[p.feld]=klon(wert);
  return d;
}
function verlaufSchritt(richtung){
  const vl=verlauf();if(!vl)return;
  const e=(richtung<0?vl.zurueck:vl.vor).pop();
  if(!e){meldung(richtung<0?'Nichts zum Rückgängigmachen.':'Nichts zum Wiederholen.');return}
  if(mm.zuschnitt)zuschnittEnde(false);
  const aktiv=document.activeElement;if(aktiv?.isContentEditable)aktiv.blur();
  for(const x of e.teile){
    const z=zeileVon(x.id);if(!z)continue;
    let d=z.daten;for(const p of (richtung<0?[...x.teile].reverse():x.teile))d=teilSetzen(d,p,richtung<0?p.vor:p.nach);
    z.daten=d;markiere(z);
  }
  (richtung<0?vl.vor:vl.zurueck).push(e);
  const v=vorlageZeile();
  if(v&&e.seite&&e.seite!==mm.seite&&M.seitenVon(v.daten).some(x=>x.id===e.seite)){mm.seite=e.seite;mm.auswahl=null}
  meldung((richtung<0?'Rückgängig: ':'Wiederholt: ')+e.text+'.');
  render();
}
function verlaufKnoepfe(){
  const vl=verlauf(),z=root.querySelector('[data-act="mm-zurueck"]'),w=root.querySelector('[data-act="mm-vor"]');
  const a=vl?.zurueck.at(-1),b=vl?.vor.at(-1);
  if(z){z.disabled=!a;z.title='Rückgängig'+(a?': '+a.text:'')+' ('+TASTE.zurueck+')'}
  if(w){w.disabled=!b;w.title='Wiederholen'+(b?': '+b.text:'')+' ('+TASTE.vor+')'}
}
// Text auf der Seite: vom Fokus bis zum Verlassen ein Schritt (Mappe und Position der Seite).
function textBeginn(el){
  if(mm.textSchritt?.id===el.id&&el.id)return;
  textEnde();
  const v=vorlageZeile();if(!v||!istMappe(v))return;
  const seite=mappeSeite(v),z=seite?.punkt?zeileVon(seite.punkt):null;
  const name=el.closest('.mm-r[data-mmr]')?.dataset.mmrName;
  mm.textSchritt={id:el.id,t:vorher(name?'Text in «'+name+'»':'Text geändert',[v,z])};
}
function textEnde(){const s=mm.textSchritt;mm.textSchritt=null;if(s)nachher(s.t)}

// Auswahl und Ebene: über der gewählten Rahmen ein Kasten mit Griff (Name des Rahmens) und acht Anfassern, über dem
// Rahmen unter dem Zeiger nur Umriss und Griff. Größen in Pixeln: bei jedem Zoom gleich gut zu greifen.
const geoAus=t=>{const [c,r,w,h]=String(t||'').split(',').map(Number);return {c,r,w,h}};
const geoText=g=>g.c+','+g.r+','+g.w+','+g.h;
const gleicheGeo=(a,b)=>!!a&&!!b&&a.c===b.c&&a.r===b.r&&a.w===b.w&&a.h===b.h;
const zwischen=(x,a,b)=>Math.min(b,Math.max(a,x));
function rahmenEl(key){return key?root.querySelector('.mm-buehne .mm-satz>.mm-r[data-mmr="'+CSS.escape(key)+'"]'):null}
function geoSetzen(el,g){if(!el)return;el.style.gridColumn=g.c+' / span '+g.w;el.style.gridRow=g.r+' / span '+g.h;el.dataset.mmrG=geoText(g)}
function waehle(key,{zeigen=false}={}){
  const v=vorlageZeile(),seite=v&&istMappe(v)?mappeSeite(v):null;
  const neu=key&&seite?{seite:seite.id,key}:null;
  // Ein angeklickter Rahmen (nicht das Schreiben darin): seine Eigenschaften stehen unter «Seite».
  if(neu&&zeigen)teilZeigen('seite');
  if(gleich(neu,mm.auswahl))return;
  mm.auswahl=neu;ebeneZeichnen();layoutKarteNeu();
}
function kastenHtml(el,art){
  const key=el.dataset.mmr,g=geoAus(el.dataset.mmrG),zs=art==='wahl'&&mm.zuschnitt;
  // Wer im Rahmen schreibt, bekommt keine Anfasser an den Kanten (dort beginnt der Text); Griff und Umriss bleiben.
  // Esc im Text oder ein Klick auf den Griff zeigt sie.
  const tippt=art==='wahl'&&!!document.activeElement?.isContentEditable&&el.contains(document.activeElement);
  const griff=zs?'':'<span class="mm-rw-griff" data-griff="'+esc(key)+'" title="Ziehen: Rahmen verschieben"><span aria-hidden="true">⠿</span>'+esc(el.dataset.mmrName||key)+'</span>';
  const anfasser=art==='wahl'&&!zs&&!tippt?['n','ne','e','se','s','sw','w','nw'].map(h=>'<i class="mm-rw-h" data-h="'+h+'"></i>').join(''):'';
  return '<div class="mm-rw mm-rw-'+(zs?'zuschnitt':art)+'" data-rw="'+esc(key)+'" style="grid-column:'+g.c+' / span '+g.w+';grid-row:'+g.r+' / span '+g.h+'">'+griff+anfasser+'<span class="mm-rw-mass" hidden></span></div>';
}
function ebeneZeichnen(){
  const eb=root.querySelector('.mm-buehne .mm-ebene');
  root.querySelectorAll('.mm-buehne .mm-r.mm-gewaehlt').forEach(x=>x.classList.remove('mm-gewaehlt'));
  if(!eb){kontextZeigen();return}
  const v=vorlageZeile(),seite=v&&istMappe(v)?mappeSeite(v):null;
  if(mm.auswahl&&mm.auswahl.seite!==seite?.id)mm.auswahl=null;
  const wahl=rahmenEl(mm.auswahl?.key);
  if(mm.auswahl&&!wahl)mm.auswahl=null;
  const ueber=mm.hover&&mm.hover!==mm.auswahl?.key&&!mm.zuschnitt?rahmenEl(mm.hover):null;
  eb.innerHTML=(ueber?kastenHtml(ueber,'hover'):'')+(wahl?kastenHtml(wahl,'wahl'):'');
  wahl?.classList.add('mm-gewaehlt');
  zuschnittGeist();kontextZeigen();
}
// Was gewählt ist, steht in der Werkzeugleiste: Name, Felder, Millimeter, Seitenverhältnis. Beim Zuschneiden schwebt
// unten über der Bühne eine Leiste mit Regler, «Zurücksetzen», «Abbrechen» und «Fertig».
function kontextZeigen(){
  const el=root.querySelector('[data-mm-kontext]'),ort=root.querySelector('[data-mm-zs]');
  if(mm.zuschnitt){
    if(ort&&!ort.querySelector('[data-act="mm-zs-zoom"]'))ort.innerHTML='<div class="mm-zs-leiste" role="group" aria-label="Zuschneiden"><strong>Zuschneiden</strong>'+
      '<label>Vergrößern <input type="range" min="1" max="'+M.ZOOM_MAX+'" step="0.05" data-act="mm-zs-zoom"></label>'+
      '<button type="button" class="btn" data-act="mm-zs-mitte">Zurücksetzen</button><button type="button" class="btn" data-act="mm-zs-ab">Abbrechen</button>'+
      '<button type="button" class="btn btn-primary" data-act="mm-zs-ok">Fertig</button></div>';
    const r=ort?.querySelector('[data-act="mm-zs-zoom"]');if(r)r.value=mm.zuschnitt.a.z;
    if(el)el.textContent=el.title='Zuschneiden · Enter übernimmt, Esc bricht ab';
    return;
  }
  if(ort&&ort.firstChild)ort.innerHTML='';
  if(!el)return;
  const r=rahmenEl(mm.auswahl?.key);
  if(!r){el.textContent=el.title=el.dataset.grund||'';return}
  const m=M.rahmenMass(geoAus(r.dataset.mmrG));
  el.textContent=el.title=(r.dataset.mmrName||'')+' · '+m.felder+' · '+m.mm+' · '+m.verhaeltnis;
}
// Rechts: der gewählte Rahmen (Größe, Stelle, Überlappung, wie die Vorlage, ausblenden), ausgeblendete Rahmen und
// «Ganze Seite wie die Vorlage».
function spanne(a,n){return n>1?a+'–'+(a+n-1):String(a)}
function ueberlappt(a,b){return a.c<b.c+b.w&&b.c<a.c+a.w&&a.r<b.r+b.h&&b.r<a.r+a.h}
function layoutKarte(){
  const v=vorlageZeile(),seite=v&&istMappe(v)?mappeSeite(v):null;if(!seite)return '';
  const liste=M.rahmenDerSeite(seite,mappeJetzt(v)).rahmen;if(!liste.length)return '';
  const da=liste.filter(r=>!r.aus),aus=liste.filter(r=>r.aus),eigen=liste.filter(r=>r.eigen||r.aus);
  const x=mm.auswahl&&mm.auswahl.seite===seite.id?da.find(r=>r.key===mm.auswahl.key):null;
  let h='<section class="card mm-layout-karte"><h2>Layout</h2>';
  if(x){
    const m=M.rahmenMass(x.geo),ueber=da.filter(r=>r.key!==x.key&&ueberlappt(r.geo,x.geo)).map(r=>r.titel);
    h+='<p class="mm-layout-name"><strong>'+esc(x.titel)+'</strong> · '+esc(m.felder)+'</p><p class="mm-layout-mass">'+esc(m.mm+' · '+m.verhaeltnis)+'</p>'+
      '<p class="meta">Spalte '+spanne(x.geo.c,x.geo.w)+', Zeile '+spanne(x.geo.r,x.geo.h)+(x.eigen?' · angepasst (Vorlage: '+esc(M.rahmenMass(x.std).felder)+')':' · wie die Vorlage')+'</p>'+
      (ueber.length?'<p class="meta mm-layout-ueber">Überlappt '+esc(ueber.join(', '))+'; Text liegt über Fotos.</p>':'')+
      '<div class="mm-knoepfe">'+(x.eigen?'<button type="button" class="btn" data-act="mm-rahmen-vorlage" data-k="'+esc(x.key)+'">Wie die Vorlage</button>':'')+
      '<button type="button" class="btn" data-act="mm-rahmen-aus" data-k="'+esc(x.key)+'">Ausblenden</button></div>';
  }else h+='<p class="meta">Einen Rahmen anklicken: am Griff verschieben, an Ecken und Kanten die Größe ändern. Er rastet auf den Feldern des Rasters ein.</p>';
  if(aus.length)h+='<p class="meta">Ausgeblendet</p><div class="mm-knoepfe">'+aus.map(r=>'<button type="button" class="btn" data-act="mm-rahmen-ein" data-k="'+esc(r.key)+'">'+esc(r.titel)+' einblenden</button>').join('')+'</div>';
  if(eigen.length)h+='<p class="meta">'+(eigen.length===1?'Ein Rahmen weicht':eigen.length+' Rahmen weichen')+' von der Vorlage ab.</p>'+
    '<div class="mm-knoepfe"><button type="button" class="btn" data-act="mm-layout-vorlage">Ganze Seite wie die Vorlage</button></div>';
  return h+'<p class="meta mm-layout-hilfe">Pfeiltasten: ein Feld weiter, mit Umschalt größer oder kleiner. Doppelklick auf ein Foto: zuschneiden. '+
    'Fotos von rechts auf die Seite ziehen, eigene Bilder vom Schreibtisch. Rückgängig: '+TASTE.zurueck+'.</p></section>';
}
function layoutKarteNeu(){const el=root.querySelector('[data-mm-rahmen]');if(el)el.innerHTML=layoutKarte()}
// Einen Rahmen setzen (geo) oder wie die Vorlage (null); gleich wie die Vorlage heißt: keine Abweichung.
function layoutAendern(key,geo,text,{gruppe='',ganz=false}={}){
  const v=vorlageZeile(),seite=v&&istMappe(v)?mappeSeite(v):null;if(!seite)return;
  const basis=M.layoutBasis(seite,mappeJetzt(v)),el=rahmenEl(key);
  const std=el?geoAus(el.dataset.mmrStd):null,wert=geo&&!geo.aus&&gleicheGeo(geo,std)?null:geo;
  const t=vorher(text,[v],{gruppe});
  seitenSetzen(v,M.seitenVon(v.daten).map(x=>{
    if(x.id!==seite.id)return x;
    const n={...x},l=ganz?M.layoutVorlage(x.layout,basis):M.layoutSetzen(x.layout,basis,key,wert);
    if(l)n.layout=l;else delete n.layout;return n;
  }));
  nachher(t);
  if(geo?.aus&&mm.auswahl?.key===key)mm.auswahl=null;
  render();
}
function rahmenKlick(act,key){
  const titel=rahmenEl(key)?.dataset.mmrName||M.rahmenDerSeite(mappeSeite(vorlageZeile()),mappeJetzt(vorlageZeile())).rahmen.find(r=>r.key===key)?.titel||key;
  if(act==='mm-rahmen-vorlage')layoutAendern(key,null,'Rahmen «'+titel+'» wie die Vorlage');
  else if(act==='mm-rahmen-aus'){layoutAendern(key,{aus:true},'Rahmen «'+titel+'» ausgeblendet');meldung('«'+titel+'» ausgeblendet; rechts unter «Layout» wieder einblenden.')}
  else if(act==='mm-rahmen-ein'){layoutAendern(key,null,'Rahmen «'+titel+'» eingeblendet');waehle(key)}
  else if(act==='mm-layout-vorlage'){mm.auswahl=null;layoutAendern('',null,'Seite wie die Vorlage',{ganz:true})}
}

// Ziehen am Griff (verschieben), an einem Anfasser (Größe) oder an einem Foto (verschieben, erst ab 4 px: sonst ist es
// ein Klick). Gerechnet in Millimetern des Blatts: ein Feld plus Abstand sind 32 mm; es rastet am nächsten Feld ein.
const ANFASSER={n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],sw:[-1,1],w:[-1,0],nw:[-1,-1]};
function neueGeo(a,art,dx,dy){
  const P=M.RASTER.feld+M.RASTER.abstand,S=M.RASTER.spalten,Z=M.RASTER.zeilen;
  if(art==='griff'||art==='foto')return {c:zwischen(a.c+Math.round(dx/P),1,S-a.w+1),r:zwischen(a.r+Math.round(dy/P),1,Z-a.h+1),w:a.w,h:a.h};
  const [sx,sy]=ANFASSER[art]||[0,0];let {c,r,w,h}=a;
  if(sx>0)w=zwischen(Math.round(a.c+a.w-1+dx/P),a.c,S)-a.c+1;
  if(sx<0){const s2=zwischen(Math.round(a.c+dx/P),1,a.c+a.w-1);w=a.c+a.w-s2;c=s2}
  if(sy>0)h=zwischen(Math.round(a.r+a.h-1+dy/P),a.r,Z)-a.r+1;
  if(sy<0){const s2=zwischen(Math.round(a.r+dy/P),1,a.r+a.h-1);h=a.r+a.h-s2;r=s2}
  return {c,r,w,h};
}
function zugBeginn(e,key,art){
  const el=rahmenEl(key),blatt=el?.closest('.mm-seite');if(!el||!blatt)return;
  const breite=blatt.getBoundingClientRect().width;if(!(breite>0))return;
  mm.zug={key,art,el,start:geoAus(el.dataset.mmrG),g:geoAus(el.dataset.mmrG),px:e.clientX,py:e.clientY,proMm:breite/M.RASTER.breite,id:e.pointerId,los:art!=='foto'};
  if(mm.zug.los)zugLos(e);
}
function zugLos(e){
  const b=root.querySelector('.mm-buehne');mm.zug.los=true;
  b?.classList.add('zieht');try{b?.setPointerCapture(e.pointerId)}catch{}
  mm.hover=null;waehle(mm.zug.key);ebeneZeichnen();
}
function zugBewegen(e){
  const z=mm.zug;if(!z||e.pointerId!==z.id)return;
  if(!z.los){if(Math.hypot(e.clientX-z.px,e.clientY-z.py)<4)return;zugLos(e)}
  e.preventDefault();
  const g=neueGeo(z.start,z.art,(e.clientX-z.px)/z.proMm,(e.clientY-z.py)/z.proMm);
  if(gleicheGeo(g,z.g))return;
  z.g=g;geoSetzen(z.el,g);
  const box=root.querySelector('.mm-buehne .mm-rw-wahl');geoSetzen(box,g);
  const m=M.rahmenMass(g),mass=box?.querySelector('.mm-rw-mass');
  if(mass){mass.hidden=false;mass.textContent=m.felder+' · '+m.mm+' · '+m.verhaeltnis}
  kontextZeigen();uebersatzPruefen();
}
function zugEnde(e,abbrechen=false){
  const z=mm.zug;if(!z||(e&&e.pointerId!==z.id))return;
  mm.zug=null;root.querySelector('.mm-buehne')?.classList.remove('zieht');
  if(!z.los)return;
  // Der Klick nach dem Loslassen wählt nichts ab.
  mm.klickSperre=true;setTimeout(()=>{mm.klickSperre=false},0);
  if(abbrechen||gleicheGeo(z.g,z.start)){geoSetzen(z.el,z.start);ebeneZeichnen();uebersatzPruefen();return}
  const name=z.el.dataset.mmrName||z.key,groesse=z.g.w!==z.start.w||z.g.h!==z.start.h;
  layoutAendern(z.key,z.g,'Rahmen «'+name+'» '+(groesse?'in der Größe geändert':'verschoben'));
}

// Zuschneiden auf der Seite (Doppelklick auf ein Foto einer Variante): ziehen verschiebt das Bild im Rahmen, das Rad
// oder der Regler vergrößert (bis dreifach); hell daneben das ganze Bild. Enter oder «Fertig» übernimmt, Esc bricht ab,
// ein Klick daneben übernimmt. Der Ausschnitt gehört zum Foto und gilt auf allen Seiten (wie im Dialog «Bild ändern»).
function zuschnittPlatz(){const zs=mm.zuschnitt;return zs?root.querySelector('.mm-buehne [data-bildplatz="'+CSS.escape(zs.zid+'|'+zs.oid+'|'+zs.i)+'"]'):null}
function zuschnittBeginn(platz){
  const img=platz?.querySelector('img.mm-foto-bild');if(!img)return;
  if(mm.zuschnitt)zuschnittEnde(true);
  const [zid,oid,i]=platz.dataset.bildplatz.split('|'),z=zeileVon(zid),o=z?K.optionen(z.daten).find(x=>x.id===oid):null;
  const f=o?fotosDerVariante(o)[Number(i)]:null;if(!f)return;
  const a={x:50,y:50,z:1,...(f.ausschnitt||{})};
  mm.zuschnitt={zid,oid,i:Number(i),a,start:{...a}};
  const r=platz.closest('.mm-r[data-mmr]');
  mm.hover=null;if(r)mm.auswahl={seite:mm.seite,key:r.dataset.mmr};
  zuschnittZeigen();
}
function zuschnittZeigen(){
  const zs=mm.zuschnitt;if(!zs)return;
  const platz=zuschnittPlatz(),img=platz?.querySelector('img.mm-foto-bild');
  if(!img){mm.zuschnitt=null;ebeneZeichnen();return}
  platz.classList.add('mm-zuschnitt');ausschnittStil(img,zs.a);
  if(!img.complete)img.addEventListener('load',zuschnittGeist,{once:true});
  ebeneZeichnen();
}
// Das ganze Bild hell um den Rahmen: dieselbe Rechnung wie object-fit: cover, object-position und scale im Rahmen.
function zuschnittMasse(){
  const zs=mm.zuschnitt,platz=zuschnittPlatz(),img=platz?.querySelector('img.mm-foto-bild');
  if(!zs||!img||!img.naturalWidth||!img.naturalHeight)return null;
  const W=platz.clientWidth,H=platz.clientHeight,s0=Math.max(W/img.naturalWidth,H/img.naturalHeight);
  return {W,H,DW:img.naturalWidth*s0,DH:img.naturalHeight*s0,src:img.currentSrc||img.src};
}
function zuschnittGeist(){
  const box=root.querySelector('.mm-buehne .mm-rw-zuschnitt');if(!box)return;
  box.querySelector('.mm-zs-geist')?.remove();
  const m=zuschnittMasse(),a=mm.zuschnitt?.a;if(!m||!a)return;
  const g=document.createElement('img');g.className='mm-zs-geist';g.alt='';g.src=m.src;g.draggable=false;
  const x=a.x/100,y=a.y/100;
  Object.assign(g.style,{left:x*(m.W-a.z*m.DW)+'px',top:y*(m.H-a.z*m.DH)+'px',width:a.z*m.DW+'px',height:a.z*m.DH+'px'});
  box.prepend(g);
}
function zuschnittAnwenden(){
  const zs=mm.zuschnitt,img=zuschnittPlatz()?.querySelector('img.mm-foto-bild');if(!zs||!img)return;
  ausschnittStil(img,zs.a);zuschnittGeist();
  const r=root.querySelector('[data-act="mm-zs-zoom"]');if(r&&Number(r.value)!==zs.a.z)r.value=zs.a.z;
}
function zuschnittZoom(z){const zs=mm.zuschnitt;if(!zs)return;zs.a.z=Math.round(zwischen(z,1,M.ZOOM_MAX)*100)/100;zuschnittAnwenden()}
// Verschieben so, dass das Bild dem Zeiger folgt: der linke Rand steht bei x·(W − z·DW).
function zuschnittSchieben(dx,dy){
  const zs=mm.zuschnitt,m=zuschnittMasse();if(!zs||!zs.zug)return;
  const sx=m?m.W-zs.a.z*m.DW:-(zuschnittPlatz()?.clientWidth||1),sy=m?m.H-zs.a.z*m.DH:-(zuschnittPlatz()?.clientHeight||1);
  if(sx<-0.5)zs.a.x=Math.round(zwischen(zs.zug.x+dx*100/sx,0,100)*10)/10;
  if(sy<-0.5)zs.a.y=Math.round(zwischen(zs.zug.y+dy*100/sy,0,100)*10)/10;
  zuschnittAnwenden();
}
function zuschnittEnde(uebernehmen){
  const zs=mm.zuschnitt;if(!zs)return;
  const platz=zuschnittPlatz(),img=platz?.querySelector('img.mm-foto-bild');
  mm.zuschnitt=null;platz?.classList.remove('mm-zuschnitt');
  if(uebernehmen&&!gleich(M.ausschnittVon(zs.a),M.ausschnittVon(zs.start))){
    fotoAendern(zs.zid,zs.oid,l=>M.fotoAusschnitt(l,zs.i,zs.a),'Foto zugeschnitten');
    meldung('Ausschnitt übernommen; er gilt für dieses Foto auf allen Seiten der Mappe.');
    return;
  }
  if(img)ausschnittStil(img,zs.start);
  ebeneZeichnen();
}
// Fotos einer Variante ändern, als ein Schritt im Verlauf (Ziehen, Zuschneiden auf der Seite).
function fotoAendern(zid,oid,f,text){
  const z=zeileVon(zid),o=z?K.optionen(z.daten).find(x=>x.id===oid):null;if(!o)return null;
  const neu=f(fotosDerVariante(o));
  const t=vorher(text,[z]);
  optionenPatch(z,oid,x=>({...x,muster_fotos:neu}));
  nachher(t);render();return neu;
}

// Fotos auf die Seite ziehen: aus der Bibliothek (rechts, Fotos der Varianten dieser Seite) auf ein Foto derselben
// Variante oder den freien Platz für Bild 2 und 3; eigene Bilder (oder ein PDF) vom Schreibtisch auf jedes Foto, auf
// das Bild einer freien Seite oder das Titelbild. Eigene Bilder bleiben in der Mappe, die Bibliothek ändert sich nicht.
function ablageZeigen(art){
  const b=root.querySelector('.mm-buehne');if(!b)return;
  b.classList.add('ablage');
  const sel=art==='datei'?'[data-bildplatz]':'[data-bildplatz^="'+CSS.escape(art.z+'|'+art.o+'|')+'"]';
  b.querySelectorAll('.mm-ablage-ziel').forEach(x=>x.classList.remove('mm-ablage-ziel'));
  b.querySelectorAll(sel).forEach(x=>x.classList.add('mm-ablage-ziel'));
  b.querySelectorAll('.mm-r-ablage').forEach(x=>x.classList.toggle('sichtbar',!!x.querySelector('.mm-ablage-ziel')));
  if(art==='datei'){const v=vorlageZeile(),seite=v&&istMappe(v)?mappeSeite(v):null;
    if(seite&&(seite.typ==='frei'||seite.typ==='deckblatt'))rahmenEl('bild')?.classList.add('mm-ablage-ziel')}
}
function ablageEnde(){
  clearTimeout(mm.ablageTimer);mm.ziehtFoto=null;mm.ziehtDatei=false;
  const b=root.querySelector('.mm-buehne');if(!b)return;
  b.classList.remove('ablage');
  b.querySelectorAll('.mm-ablage-ziel,.mm-ablage-hier').forEach(x=>x.classList.remove('mm-ablage-ziel','mm-ablage-hier'));
  b.querySelectorAll('.mm-r-ablage.sichtbar').forEach(x=>x.classList.remove('sichtbar'));
}
function ablageZiel(t){return t?.closest?.('.mm-buehne .mm-ablage-ziel')||null}
function fotoAblegen(ziel,foto){
  const [zid,oid,i]=String(ziel.dataset.bildplatz||'').split('|');
  if(zid!==foto.z||oid!==foto.o){meldung('Dieses Foto gehört zu Variante '+foto.o+'.','warn');return}
  const z=zeileVon(zid),o=z?K.optionen(z.daten).find(x=>x.id===oid):null,d=(mm.fotos.get(o?.produkt_id)||[]).find(x=>x.id===foto.d);
  if(!d)return;
  fotoAendern(zid,oid,l=>M.fotoSetzen(l,Number(i),{id:d.id,pfad:d.storage_path}),'Foto auf die Seite gezogen');
}
async function dateiAblegen(ziel,datei,anzahl){
  const mehr=anzahl>1?' Von mehreren Dateien gilt die erste.':'';
  if(ziel.dataset.bildplatz){
    const [zid,oid,i]=ziel.dataset.bildplatz.split('|');
    meldung('Bild wird hochgeladen …');
    const {pfad,name}=await bildHochladen(datei,1);
    fotoAendern(zid,oid,l=>M.fotoSetzen(l,Number(i),{id:'m-'+crypto.randomUUID(),pfad,quelle:'mappe',name}),'Eigenes Bild auf die Seite gezogen');
    meldung('Das Bild steht auf der Seite; es bleibt in dieser Mappe.'+mehr);return;
  }
  const v=vorlageZeile(),seite=v&&istMappe(v)?mappeSeite(v):null;
  if(seite){meldung('Bild wird hochgeladen …');await freiesBild(v,seite.id,datei);if(mehr)meldung(ui.meldung+mehr)}
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
// Etappe 2: was hier geändert wird, ist ein Schritt im Verlauf (Rückgängig); die Texte nennen ihn.
const MM_SCHRITT={'mm-hoch':'Seite verschoben','mm-runter':'Seite verschoben','mm-seite-weg':'Seite entfernt','mm-material':'Materialseite angelegt',
  'mm-foto':'Foto gewählt','mm-bild-weg':'Bild entfernt','mm-zuruecksetzen':'Text zurückgesetzt','mm-uebernehmen':'Neuer Stand übernommen',
  'mm-position-weg':'Position aus der Mappe genommen','mm-kandidat-weg':'Kandidat entfernt','mm-seite-neu':'Seite hinzugefügt'};
function mappeKlick(act,el){
  const v=vorlageZeile();if(!v||!istMappe(v))return;
  const t=MM_SCHRITT[act]?vorher(MM_SCHRITT[act],[v,...mappePunkte(v)]):null;
  try{mappeKlickInnen(act,el,v)}finally{nachher(t)}
}
function mappeKlickInnen(act,el,v){
  const z=el.dataset.z?zeileVon(el.dataset.z):null;
  if(el.closest('.mm-plus-menue'))menue('plus',false);
  if(act==='mm-zurueck'||act==='mm-vor'){verlaufSchritt(act==='mm-zurueck'?-1:1);return}
  if(act.startsWith('mm-rahmen-')||act==='mm-layout-vorlage'){rahmenKlick(act,el.dataset.k);return}
  if(act==='mm-zs-ok'||act==='mm-zs-ab'){zuschnittEnde(act==='mm-zs-ok');return}
  if(act==='mm-zs-mitte'){if(mm.zuschnitt){mm.zuschnitt.a={x:50,y:50,z:1};zuschnittZeigen()}return}
  if(act==='mm-mehr'||act==='mm-plus'){const n=act.slice(3);menue(n,!!root.querySelector('.mm-'+n+'-menue')?.hidden);return}
  if(act==='mm-teil'){teilZeigen(el.dataset.teil);return}
  if(act==='mm-groesser'){rahmenGroesser(el.dataset.k);return}
  if(act==='mm-kuerzen'){void sicher(()=>mitRomyKuerzen(el.dataset.ed));return}
  if(act==='mm-seite-neu'){menue('plus',false);seiteNeu(v,el.dataset.wert);return}
  if(act==='mm-uebersatz'){uebersatzZeigen();return}
  if(act==='mm-seite'){mm.seite=el.dataset.id;mm.auswahl=null;render();root.querySelector('.mm-mitte')?.scrollIntoView({block:'nearest'})}
  else if(act==='mm-zoom-plus'||act==='mm-zoom-minus')zoomSchritt(act==='mm-zoom-plus'?1:-1);
  else if(act==='mm-raster'){mm.ansicht.raster=!mm.ansicht.raster;mmAnsichtMerken();root.querySelector('.mm-buehne')?.classList.toggle('raster',mm.ansicht.raster);el.setAttribute('aria-pressed',String(mm.ansicht.raster))}
  else if(act==='mm-links'||act==='mm-rechts'){
    const k=act==='mm-links'?'seiten':'rechts';mm.ansicht[k]=!mm.ansicht[k];mmAnsichtMerken();
    root.querySelector('.mm')?.classList.toggle(act==='mm-links'?'ohne-seiten':'ohne-rechts',!mm.ansicht[k]);el.setAttribute('aria-pressed',String(mm.ansicht[k]));zoomAnwenden();
  }
  else if(act==='mm-kw-neu')kennwertAnhaengen(el.dataset.z,el.dataset.o);
  else if(act==='mm-pdf')void sicher(()=>mappeDrucken(v));
  else if(act==='mm-praes')void sicher(async()=>{await alleSpeichern();praesOeffnen(v);void mappeLaden(v).then(()=>praesZeichnen()).catch(()=>{})});
  else if(act==='mm-alle-freigeben')void sicher(()=>alleFreigeben(v));
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
  else if(act==='mm-bild'&&z)bildDialog(z,el.dataset.o,el.dataset.i);
  else if(act==='mm-zuruecksetzen'&&z){
    optionenPatch(z,el.dataset.o,o=>M.zuruecksetzen(o,el.dataset.feld));
    meldung((M.ANPASSUNG_NAME[el.dataset.feld]||'Text')+' von '+el.dataset.o+' wieder wie in der Produktbibliothek.');render();
  }
}
const MM_AENDERUNG={'mm-zeige':'Anzeige auf der Seite geändert','mm-seite-option':'Kandidaten der Seite geändert',
  'mm-material-option':'Variante der Seite geändert'};
function mappeAenderung(el){
  const v=vorlageZeile();if(!v||!istMappe(v))return false;
  const text=el.matches('[data-mmfeld]')?'Angaben der Position geändert':MM_AENDERUNG[el.dataset.act];
  const t=text?vorher(text,[v,...mappePunkte(v)]):null;
  try{return mappeAenderungInnen(el,v)}finally{nachher(t)}
}
function mappeAenderungInnen(el,v){
  const act=el.dataset.act;
  if(act==='mm-zoom'){const w=el.value;if(w==='fit'||w==='breite'){mm.ansicht.zoom=w;mmAnsichtMerken();zoomAnwenden()}else if(Number(w)>0)zoomAuf(Number(w));return true}
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
// Tippen auf der Seite (26.11.2026: direkt im Text der Seite, wie im PDF): gespeichert wird nach einer kurzen Pause,
// neu gezeichnet erst beim Verlassen. Einzeilige Texte (Name, Hersteller, Kennwerte) ohne Zeilenumbruch.
function mmText(el){
  if(!el.isContentEditable)return el.value;
  let t=el.innerText.replace(/\r/g,'');if(t.endsWith('\n'))t=t.slice(0,-1);
  return el.hasAttribute('data-einzeilig')?t.replace(/\s*\n\s*/g,' '):t;
}
function kennwerteAusTabelle(tab){
  return [...tab.tBodies[0].rows].map(tr=>({feld:mmText(tr.cells[0]).trim(),wert:mmText(tr.cells[1]).trim()}));
}
function mappeEingabe(el){
  const v=vorlageZeile();if(!v||!istMappe(v))return false;
  if(el.isContentEditable&&!el.textContent&&el.innerHTML)el.innerHTML='';
  const wert=mmText(el);
  if(el.matches('[data-mmtext]')){const z=zeileVon(el.dataset.z);if(z){z.daten={...z.daten,[el.dataset.mmtext]:wert};markiere(z)}}
  else if(el.matches('[data-mmopt],[data-mmanp],[data-mmkw]')){
    // Texte der Variante für diese Mappe (26.11.2026): gleich wie die Bibliothek heißt nicht geändert.
    const kw=el.matches('[data-mmkw]'),tab=kw?el.closest('table'):null;
    const [zid,oid,feld=kw?'kennwerte':'beschreibung']=(el.dataset.mmanp||el.dataset.mmopt||el.dataset.mmkw).split('|'),z=zeileVon(zid);
    if(z){
      let neu=null;
      z.daten={...z.daten,optionen:K.optionen(z.daten).map(o=>o.id===oid?(neu=M.anpassen(o,feld,kw?kennwerteAusTabelle(tab):wert)):o)};markiere(z);
      const g=!!neu&&M.geaendert(neu)[feld],ziel=tab||el;
      ziel.classList.toggle('mm-geaendert',g);
      if(g)ziel.title='In dieser Mappe geändert';else ziel.removeAttribute('title');
      mappeHinweiseNeu();
    }
  }
  else if(el.matches('[data-mmseite]')){
    const [sid,k]=el.dataset.mmseite.split('|');
    v.daten={...v.daten,seiten:M.seitenVon(v.daten).map(x=>x.id===sid?{...x,[k]:wert}:x)};markiere(v);
  }
  else if(el.matches('[data-mmvorlage]')){v.daten={...v.daten,[el.dataset.mmvorlage]:wert};markiere(v)}
  else return false;
  uebersatzPruefen();return true;
}
// «+ Kennwert»: eine leere Zeile in der Tabelle; gespeichert wird, sobald etwas darin steht.
function kennwertAnhaengen(zid,oid){
  const tab=root.querySelector('.mm-buehne table[data-mmkwtab="'+CSS.escape(zid+'|'+oid)+'"]');if(!tab)return;
  const body=tab.tBodies[0],n=body.rows.length,vorlage=body.rows[0];if(!vorlage)return;
  const leer=[...body.rows].find(tr=>!mmText(tr.cells[0]).trim()&&!mmText(tr.cells[1]).trim());
  if(leer){leer.cells[0].focus();return}
  const tr=vorlage.cloneNode(true);
  [...tr.cells].forEach((c,j)=>{c.textContent='';c.id='mm-'+zid+'-'+oid+'-kw'+n+(j?'w':'f')});
  body.append(tr);tr.cells[0].focus();uebersatzPruefen();
}
// Enter in einer Kennwerte-Zelle: weiter zum Wert, dann zur nächsten Zeile (am Ende eine neue).
function kennwertWeiter(el){
  const tr=el.closest('tr'),tab=el.closest('table');
  if(el.cellIndex===0){tr.cells[1].focus();return}
  const naechste=tr.nextElementSibling;
  if(naechste)naechste.cells[0].focus();
  else{const [zid,oid]=tab.dataset.mmkwtab.split('|');kennwertAnhaengen(zid,oid)}
}

// ---------- Mustermappe: Präsentieren im Bemusterungstermin (Schritt 2, 24.11.2026) ----------
// Die Seite groß, daneben die Entscheidung je Position: gewählte Variante oder «vertagt», Entscheider und Datum (der
// Termin), der Termin als Fundstelle. Eingetragen wird in der Entscheidungsliste, wie mit «Entscheidung eintragen»;
// danach gibt «In der Produktbibliothek freigeben» die gewählten Produkte im Projekt frei.
let praesEl=null;
function praesOeffnen(v){
  if(praesEl)return;
  const l=M.seitenVon(v.daten);
  mm.praes={i:Math.max(0,l.findIndex(x=>x.id===mm.seite)),panel:false};
  praesEl=document.createElement('div');
  praesEl.className='mm-praes';praesEl.setAttribute('role','dialog');praesEl.setAttribute('aria-modal','true');praesEl.setAttribute('aria-label','Mustermappe präsentieren');
  praesEl.addEventListener('click',praesKlick);
  praesEl.addEventListener('submit',praesSenden);
  document.body.append(praesEl);document.documentElement.classList.add('mm-praes-offen');
  praesZeichnen();
  try{const r=praesEl.requestFullscreen?.();if(r&&r.catch)r.catch(()=>{})}catch{}
  praesEl.querySelector('[data-praes="weiter"]')?.focus();
}
function praesSchliessen(){
  if(!praesEl)return;
  try{if(document.fullscreenElement){const r=document.exitFullscreen?.();if(r&&r.catch)r.catch(()=>{})}}catch{}
  const v=vorlageZeile(),l=v?M.seitenVon(v.daten):[];
  if(l[mm.praes?.i])mm.seite=l[mm.praes.i].id;
  praesEl.remove();praesEl=null;mm.praes=null;
  document.documentElement.classList.remove('mm-praes-offen');
  render();
}
function praesSeite(v){
  const l=M.seitenVon(v.daten);
  mm.praes.i=Math.min(Math.max(0,mm.praes.i),Math.max(0,l.length-1));
  return {l,seite:l[mm.praes.i]||null};
}
function praesZeichnen(){
  const v=vorlageZeile();if(!praesEl||!v)return;
  const inh=mappeJetzt(v),{l,seite}=praesSeite(v),i=mm.praes.i,n=l.length;
  const z=seite&&['vergleich','material'].includes(seite.typ)?zeilen.entscheidungsliste.find(x=>x.id===seite.punkt):null;
  const p=z?inh.punkte.find(x=>x.id===z.id):null;
  const ent=inh.punkte.filter(x=>x.status==='entschieden').length;
  const fokus=praesEl.contains(document.activeElement)?document.activeElement.dataset.praes||'':'';
  praesEl.innerHTML='<div class="mm-praes-kopf"><strong>'+esc(inh.titel)+'</strong><span>'+esc(projektName())+'</span>'+
    '<span class="mm-praes-zahl" role="status">Entschieden: '+ent+' von '+inh.punkte.length+'</span><button type="button" class="btn" data-praes="ende">Beenden</button></div>'+
    '<div class="mm-praes-mitte"><div class="mm-praes-buehne">'+(seite?M.seiteHtml(seite,inh,{nr:i+1,gesamt:n,modus:'druck',bild:bildUrl}):'')+'</div>'+
    (mm.praes.panel&&z&&p?praesPanel(v,z,p):'')+'</div>'+
    '<div class="mm-praes-fuss"><button type="button" class="btn" data-praes="zurueck" aria-label="Vorige Seite"'+(i===0?' disabled':'')+'>‹</button>'+
    '<span class="mm-praes-nr">Seite '+(i+1)+' von '+n+'</span><button type="button" class="btn" data-praes="weiter" aria-label="Nächste Seite"'+(i>=n-1?' disabled':'')+'>›</button>'+
    (p?'<span class="mm-praes-pos">'+esc([p.code,p.bezeichnung].filter(Boolean).join(' · '))+(p.status==='entschieden'?' · entschieden: '+esc(M.gewaehlt(p)):p.status==='vertagt'?' · vertagt':'')+'</span>'+
      (mm.praes.panel?'':'<button type="button" class="btn btn-primary" data-praes="panel">'+(p.status==='entschieden'?'Entscheidung ändern':'Entscheidung erfassen')+'</button>'):'')+'</div>';
  const ziel=mm.praes.panel?praesEl.querySelector('.mm-praes-panel input[name="wahl"]:checked')||praesEl.querySelector('.mm-praes-panel input[name="wahl"]'):fokus?praesEl.querySelector('[data-praes="'+fokus+'"]:not(:disabled)'):null;
  ziel?.focus();
}
function praesPanel(v,z,p){
  const d=z.daten;
  const gew=d.status==='entschieden'?(/^\s*([A-H])\s*[:·.)]/.exec(s0(d.entscheidung))?.[1]||''):d.status==='vertagt'?'vertagt':s0(d.empfehlung);
  const wer=s0(d.entscheider)||s0(v.daten.auftraggeber)||'Bauherr';
  const am=s0(d.entschieden_am)||s0(v.daten.besprechung_am)||heute();
  const bem=d.status==='entschieden'?(/ – (.*)$/.exec(s0(d.entscheidung))?.[1]||''):d.status==='vertagt'?s0(d.annahme):'';
  return '<form class="mm-praes-panel" data-praes-form data-z="'+esc(z.id)+'"><p class="mm-praes-art">Entscheidung im Termin</p><h2>'+esc([p.code,p.bezeichnung].filter(Boolean).join(' · '))+'</h2>'+
    '<fieldset class="mm-praes-wahl"><legend>Gewählt</legend>'+p.optionen.map(o=>'<label><input type="radio" name="wahl" value="'+esc(o.id)+'"'+(o.id===gew?' checked':'')+'><span><strong>'+esc(o.id+' · '+o.name)+'</strong>'+
      (o.id===p.empfehlung?'<small>Empfehlung des Büros</small>':'')+'</span></label>').join('')+
    '<label><input type="radio" name="wahl" value="vertagt"'+(gew==='vertagt'?' checked':'')+'><span><strong>Vertagt</strong><small>Annahme für die Weiterplanung als Bemerkung</small></span></label></fieldset>'+
    '<div class="pd-zwei"><label class="pd-feld"><span>Entscheider</span><input class="pd-in" name="wer" value="'+esc(wer)+'" autocomplete="off"></label>'+
    '<label class="pd-feld"><span>am</span><input class="pd-in" name="am" value="'+esc(K.datumLang(am))+'" autocomplete="off"></label></div>'+
    '<label class="pd-feld"><span>Bemerkung</span><textarea class="pd-in" name="bem" rows="2" placeholder="z. B. Muster Eiche natur, geölt">'+esc(bem)+'</textarea></label>'+
    '<p class="pd-dlg-fehler" data-praes-fehler role="alert"></p><div class="mm-knoepfe"><button type="button" class="btn" data-praes="panel-zu">Abbrechen</button><button type="submit" class="btn btn-primary">Eintragen</button></div>'+
    '<p class="meta">Geht in die Entscheidungsliste, mit dem Termin als Fundstelle. Danach «In der Produktbibliothek freigeben».</p></form>';
}
const s0=x=>x===null||x===undefined?'':String(x);
function praesKlick(e){
  const b=e.target.closest('[data-praes]');if(!b||!mm.praes)return;
  const v=vorlageZeile();if(!v)return;
  const a=b.dataset.praes;
  if(a==='ende'){praesSchliessen();return}
  if(a==='weiter'||a==='zurueck'){mm.praes.i+=a==='weiter'?1:-1;mm.praes.panel=false;praesZeichnen();return}
  if(a==='panel'){mm.praes.panel=true;praesZeichnen();return}
  if(a==='panel-zu'){mm.praes.panel=false;praesZeichnen()}
}
function praesSenden(e){
  const f=e.target.closest('[data-praes-form]');if(!f)return;
  e.preventDefault();
  const z=zeileVon(f.dataset.z),fehl=f.querySelector('[data-praes-fehler]');if(!z)return;
  const wahl=f.querySelector('input[name="wahl"]:checked')?.value||'',am=K.leseDatum(f.am.value),wer=f.wer.value.trim(),bem=f.bem.value.trim();
  if(!wahl){fehl.textContent='Bitte eine Variante wählen oder «Vertagt».';return}
  if(!am){fehl.textContent='Datum bitte als TT.MM.JJJJ eingeben.';return}
  const quelle='Bemusterungstermin am '+K.datumLang(am);
  let neu={...z.daten};
  if(wahl==='vertagt'){
    for(const k of ['entscheidung','entschieden_am','entscheider','bestaetigt_am'])delete neu[k];
    neu={...neu,status:'vertagt',annahme:bem||s0(z.daten.annahme),fundstelle:s0(z.daten.fundstelle)||quelle};
  }else{
    const o=K.optionen(z.daten).find(x=>x.id===wahl);if(!o)return;
    if(!wer){fehl.textContent='Wer hat entschieden?';return}
    const name=s0(o.muster_produkt?.name)||s0(o.text)||s0(o.produkt);
    neu={...neu,status:'entschieden',entscheidung:wahl+': '+name+(bem?' – '+bem:''),entschieden_am:am,entscheider:wer,fundstelle:s0(z.daten.fundstelle)||quelle};
  }
  const p=K.pruefe('entscheidungsliste',neu);if(p){fehl.textContent=p;return}
  z.daten=neu;markiere(z);
  mm.praes.panel=false;praesZeichnen();
}
document.addEventListener('keydown',e=>{
  if(!praesEl||!mm.praes)return;
  if(e.target.closest?.('input,textarea,select')){if(e.key==='Escape'&&mm.praes.panel){mm.praes.panel=false;praesZeichnen()}return}
  if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();const b=praesEl.querySelector('[data-praes="weiter"]');if(b&&!b.disabled)b.click()}
  else if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();const b=praesEl.querySelector('[data-praes="zurueck"]');if(b&&!b.disabled)b.click()}
  else if(e.key==='Escape'){e.preventDefault();if(mm.praes.panel){mm.praes.panel=false;praesZeichnen()}else praesSchliessen()}
});
// Nach dem Termin: die Entscheidungen der Mappe und die Freigabe in der Produktbibliothek, einzeln oder alle.
function terminKarte(v){
  const punkte=mappePunkte(v),ent=punkte.filter(z=>z.daten.status==='entschieden'),vert=punkte.filter(z=>z.daten.status==='vertagt');
  if(!ent.length&&!vert.length)return '<section class="card"><h2>Entschieden wird im Termin</h2><p class="meta">Die Mappe wird im Bemusterungstermin vorgestellt; dort wird entschieden, nicht auf dem Blatt. '+
    '«Präsentieren» zeigt die Seiten groß und nimmt je Position die Entscheidung auf: in der Entscheidungsliste, mit dem Termin als Fundstelle.</p></section>';
  const q=quellen.daten;
  const frei=z=>{const o=K.optionen(z.daten).find(x=>x.id===gewaehlteVariante(z.daten));const ver=q&&o?.produkt_id?Z.verwendungIm(o.produkt_id,projekt.id,q.verwendungen):null;return ver?.status==='freigegeben'};
  const offen=ent.filter(z=>gewaehlteVariante(z.daten)&&!frei(z));
  return '<section class="card"><h2>Entscheidungen der Bemusterung</h2><ul class="pd-punkte">'+[...ent,...vert].map(z=>{
      const m=z.daten.muster||{};
      return '<li><span class="pd-nr">'+esc(m.code||K.nummer('entscheidungsliste',z.nr))+'</span> '+esc(z.daten.status==='entschieden'?z.daten.entscheidung:'vertagt'+(z.daten.annahme?': '+z.daten.annahme:''))+
        (z.daten.status==='entschieden'?' <span class="meta">('+esc(K.datumLang(z.daten.entschieden_am))+', '+esc(z.daten.entscheider)+')</span>':'')+
        (frei(z)?' <span class="chip chip-ok">freigegeben</span>':'')+'</li>';
    }).join('')+'</ul>'+
    (offen.length?'<button type="button" class="btn btn-primary" data-act="mm-alle-freigeben">In der Produktbibliothek freigeben ('+offen.length+')</button>':'')+
    '<p class="meta">Freigeben setzt das gewählte Produkt im Projekt auf «freigegeben» und die übrigen Kandidaten auf «verworfen».</p></section>';
}
async function alleFreigeben(v){
  await ladeQuellen();
  if(!quellen.daten)throw new Error(quellen.fehler||'Die Produktbibliothek ist gerade nicht erreichbar.');
  const liste=mappePunkte(v).filter(z=>z.daten.status==='entschieden'&&gewaehlteVariante(z.daten)&&K.optionen(z.daten).some(o=>o.produkt_id));
  if(!liste.length){meldung('Noch keine Entscheidung mit einem Produkt aus der Bibliothek.','warn');return}
  if(!window.confirm(liste.length+(liste.length===1?' Position':' Positionen')+' in der Produktbibliothek freigeben? Die übrigen Kandidaten stehen danach im Projekt als «verworfen».'))return;
  for(const z of liste)await freigeben(z,gewaehlteVariante(z.daten),true);
  meldung('In der Produktbibliothek freigegeben: '+liste.length+(liste.length===1?' Position.':' Positionen.'));render();
}

// ---------- Romy ----------
const ROMY_FEHLER={no_terminplan:'Für dieses Projekt gibt es keinen Terminplan mit Terminen.',document_or_text_required:'Bitte eine Datei wählen oder Text einfügen.',
  one_document_required:'Bitte nur eine Datei.',invalid_attachments:'Diese Datei kann Romy nicht lesen: PDF oder Bild bis 8 MB.',ai_not_configured:'Romy ist im Office noch nicht eingerichtet.',
  no_access:'Kein Zugriff auf dieses Dokument.',ai_timeout_or_network:'Romy hat nicht rechtzeitig geantwortet. Bitte noch einmal versuchen.',rows_required:'Bitte zuerst Zeilen auswählen.',
  instruction_required:'Bitte sagen, was Romy ändern soll.',question_required:'Bitte eine Frage eingeben.',invalid_task:'Das geht in dieser Liste nicht.',
  text_required:'Kein Text zum Kürzen.',invalid_length:'Der Rahmen ist zu klein, um den Text sinnvoll zu kürzen: bitte vergrößern.',
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
    const neu=await neueZeile(art,d,{vorschlagId:v.id});
    ablaufNotieren(art,neu?.id,v);
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
    ablaufNotieren(art,z.id,v,true);
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
    '<td class="pd-c" colspan="'+breite+'"><strong>Romy schlägt für '+esc(K.nummer(art,z.nr,z.daten))+' vor:</strong> '+esc(K.aenderungText(art,z.daten,v.daten))+
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
  if(ui.ansicht==='mappe'&&e.target.closest?.('.mm-buehne'))blattKlick(e);
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
  else if(act==='anlegen-vorlage'){el.disabled=true;void sicher(()=>anlegen(art,{vorlage:true}))}
  else if(act==='anlegen-leer'){el.disabled=true;void sicher(()=>anlegen(art))}
  else if(act==='fragen-kopieren')void sicher(()=>fragenKopieren([...ui.auswahl].map(zeileVon).filter(Boolean)));
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
  else if(act==='ablauf-besprechung')besprechungDialog();
  else if(act==='ablauf-ende'){ui.ablauf=null;ablaufMerken();render()}
  else if(act==='ablauf-aufgaben'){const l=ablaufZeilen('klaerungsliste').filter(z=>ablaufOffen(z)&&!z.daten.aufgabe_id&&String(z.daten.verantwortlich||'').trim()&&z.daten.frist);void sicher(()=>aufgabenAnlegen(l))}
  else if(act==='ablauf-fristen'){const ids=ablaufZeilen('klaerungsliste',{geaendert:true}).filter(z=>ablaufOffen(z)&&z.daten.frist).map(z=>z.id);
    void sicher(async()=>{await romyAuswahl('fristen_terminplan',{ids});if(ui.ablauf){ui.ablauf.fristen=true;ablaufMerken();render()}})}
  else if(act==='ablauf-teilen')void sicher(()=>ablaufTeilen());
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
  if(el.matches('[data-act="projekt"]')){ui.meldung='';gehe({werkzeug:ui.ansicht==='mappen'?ui.werkzeug:'',projekt:el.value});return}
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
  if(ui.ansicht==='mappe'&&el.matches('[data-act="mm-zs-zoom"]')){zuschnittZoom(Number(el.value)||1);return}
  if(ui.ansicht==='mappe'&&el.matches('.mm-ed')){mappeEingabe(el);return}
  if(el.matches('textarea[data-vfeld]')){const z=zeileVon(el.dataset.z);if(z){z.daten={...z.daten,[el.dataset.vfeld]:el.value};if(Array.isArray(z.daten._romy))z.daten._romy=z.daten._romy.filter(k=>k!==el.dataset.vfeld);markiere(z)}wachse(el);return}
  if(el.matches('textarea.pd-in[data-edit]'))el.style.height=Math.max(el.scrollHeight,60)+'px';
});
root.addEventListener('paste',e=>{
  const el=e.target.closest?.('.mm-ed');if(!el||ui.ansicht!=='mappe')return;
  e.preventDefault();
  let t=(e.clipboardData?.getData('text/plain')||'').replace(/\r/g,'');
  if(el.hasAttribute('data-einzeilig'))t=t.replace(/\s*\n\s*/g,' ');
  document.execCommand('insertText',false,t);
});
root.addEventListener('wheel',e=>{
  if(!(e.ctrlKey||e.metaKey)||ui.ansicht!=='mappe'||!e.target.closest?.('.mm-buehne'))return;
  e.preventDefault();
  const b=root.querySelector('.mm-buehne');if(!b)return;
  const jetzt=mmBreite(b)/MM_A3;
  zoomAuf(jetzt*Math.exp(-Math.max(-60,Math.min(60,e.deltaY))/300),{x:e.clientX,y:e.clientY});
},{passive:false});
root.addEventListener('focusout',e=>{
  if(zeichnet)return;
  const el=e.target;
  // Text auf der Seite: das Verlassen schließt den Schritt im Verlauf (Etappe 2).
  if(ui.ansicht==='mappe'&&el.matches?.('.mm-ed')){textEnde();setTimeout(()=>{if(ui.ansicht==='mappe'&&!mm.zug)ebeneZeichnen()},0)}
  // Kennwerte: beim Verlassen des Rahmens neu zeichnen (leere Zeilen fallen weg); «+ Kennwert» liegt im Rahmen.
  if(ui.ansicht==='mappe'&&el.matches('[data-mmkw]')){if(!el.closest('.mm-r')?.contains(e.relatedTarget))spaeterRendern();return}
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
  // Esc im Text der Seite: aus dem Text heraus, der Rahmen bleibt gewählt (mit Anfassern, Pfeiltasten verschieben).
  if(ui.ansicht==='mappe'&&el.matches?.('.mm-buehne .mm-ed')&&e.key==='Escape'){e.preventDefault();el.blur();return}
  if(ui.ansicht==='mappe'&&el.matches?.('.mm-ed[data-einzeilig]')&&e.key==='Enter'){
    e.preventDefault();
    if(el.matches('[data-mmkw]'))kennwertWeiter(el);else el.blur();
    return;
  }
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
      const wert=art==='eingang'?text.toUpperCase():text;
      const d={...K.leereZeile(art,{runde:dok?.meta?.runde||''}),[NEU_FELD[art]]:wert};
      const z=await neueZeile(art,d);
      const spalte=NEU_SPALTE[art]||NEU_FELD[art];
      ui.edit={z:z.id,k:naechsteZelle(art,z,spalte,1)||spalte};renderListe();
    });
    return;
  }
  if(el.matches('td[data-k]')&&e.key==='Enter'){el.click()}
});
// ---------- Mustermappe, Etappe 2: Ereignisse auf der Seite ----------
// Klick wählt einen Rahmen (ein Text bekommt dabei den Fokus wie bisher); daneben wählt ab.
function blattKlick(e){
  if(mm.klickSperre||mm.zuschnitt)return;
  const r=e.target.closest('.mm-satz>.mm-r[data-mmr]');
  if(r){waehle(r.dataset.mmr,{zeigen:!e.target.closest('.mm-ed')});return}
  if(!e.target.closest('.mm-rw'))waehle(null);
}
root.addEventListener('focusin',e=>{
  if(zeichnet||ui.ansicht!=='mappe'||!e.target.matches?.('.mm-buehne .mm-ed'))return;
  textBeginn(e.target);
  const r=e.target.closest('.mm-satz>.mm-r[data-mmr]');if(r)waehle(r.dataset.mmr);
});
root.addEventListener('pointerdown',e=>{
  if(ui.ansicht!=='mappe'||e.button>0)return;
  const t=e.target;
  if(mm.zuschnitt){
    const platz=zuschnittPlatz();
    if(platz&&platz.contains(t)){
      e.preventDefault();mm.zuschnitt.zug={px:e.clientX,py:e.clientY,x:mm.zuschnitt.a.x,y:mm.zuschnitt.a.y,id:e.pointerId};
      try{platz.setPointerCapture(e.pointerId)}catch{}
      platz.classList.add('zieht');return;
    }
    // Ein Klick daneben übernimmt den Ausschnitt (nicht in der Leiste mit den Reglern).
    if(!t.closest?.('[data-mm-zs]'))zuschnittEnde(true);
    return;
  }
  const anfasser=t.closest?.('.mm-ebene [data-h]'),griff=t.closest?.('.mm-ebene [data-griff]');
  if(anfasser||griff){
    e.preventDefault();
    if(document.activeElement?.isContentEditable)document.activeElement.blur();
    const key=griff?griff.dataset.griff:anfasser.closest('[data-rw]')?.dataset.rw;
    if(key)zugBeginn(e,key,griff?'griff':anfasser.dataset.h);
    return;
  }
  const foto=t.closest?.('.mm-buehne .mm-satz>.mm-r-foto[data-mmr]');
  if(foto&&!t.closest('button,a,input,label,.mm-bild-knoepfe'))zugBeginn(e,foto.dataset.mmr,'foto');
});
root.addEventListener('pointermove',e=>{
  if(ui.ansicht!=='mappe')return;
  if(mm.zug){zugBewegen(e);return}
  const zs=mm.zuschnitt;
  if(zs?.zug){if(e.pointerId===zs.zug.id)zuschnittSchieben(e.clientX-zs.zug.px,e.clientY-zs.zug.py);return}
  if(e.pointerType==='touch'||zs)return;
  // Unter dem Zeiger: Umriss und Griff; kurz stehen lassen, damit der Griff über dem Rahmen zu erreichen ist.
  const r=e.target.closest?.('.mm-buehne .mm-satz>.mm-r[data-mmr]'),key=r?.dataset.mmr||e.target.closest?.('.mm-buehne .mm-rw')?.dataset.rw||null;
  clearTimeout(mm.hoverTimer);
  if(key===mm.hover)return;
  if(key){mm.hover=key;ebeneZeichnen()}
  else mm.hoverTimer=setTimeout(()=>{mm.hover=null;ebeneZeichnen()},250);
});
function zugLoslassen(e){
  if(mm.zug){zugEnde(e,e.type==='pointercancel');return}
  const zs=mm.zuschnitt;
  if(zs?.zug&&e.pointerId===zs.zug.id){zs.zug=null;zuschnittPlatz()?.classList.remove('zieht')}
}
root.addEventListener('pointerup',zugLoslassen);root.addEventListener('pointercancel',zugLoslassen);
root.addEventListener('dblclick',e=>{
  if(ui.ansicht!=='mappe')return;
  const platz=e.target.closest?.('.mm-buehne [data-bildplatz]');
  if(!platz||e.target.closest('button')||!platz.querySelector('img.mm-foto-bild'))return;
  e.preventDefault();window.getSelection()?.removeAllRanges();zuschnittBeginn(platz);
});
root.addEventListener('wheel',e=>{
  if(!mm.zuschnitt||ui.ansicht!=='mappe'||e.ctrlKey||e.metaKey)return;
  const platz=zuschnittPlatz();if(!platz||!platz.contains(e.target))return;
  e.preventDefault();zuschnittZoom(mm.zuschnitt.a.z*Math.exp(-Math.max(-60,Math.min(60,e.deltaY))/300));
},{passive:false});
// Tasten außerhalb der Textfelder: Rückgängig und Wiederholen; Pfeiltasten verschieben den gewählten Rahmen um ein
// Feld, mit Umschalt ändern sie seine Größe; Esc wählt ab. Beim Zuschneiden: Pfeile, + und −, Enter und Esc.
document.addEventListener('keydown',e=>{
  if(ui.ansicht!=='mappe'||praesEl||dialog.open)return;
  const t=e.target,imFeld=!!t.closest?.('input,textarea,select,[contenteditable]'),k=String(e.key||'').toLowerCase();
  const mod=(e.metaKey||e.ctrlKey)&&!e.altKey;
  if(mod&&(k==='z'||k==='y')){if(imFeld)return;e.preventDefault();verlaufSchritt(k==='y'||e.shiftKey?1:-1);return}
  const zs=mm.zuschnitt;
  if(zs){
    if(e.key==='Escape'){e.preventDefault();zuschnittEnde(false);return}
    if(imFeld||t.closest?.('button'))return;
    const schritt=e.shiftKey?10:2;
    if(e.key==='Enter'){e.preventDefault();zuschnittEnde(true)}
    else if(e.key==='+'||e.key==='='){e.preventDefault();zuschnittZoom(zs.a.z+.1)}
    else if(e.key==='-'){e.preventDefault();zuschnittZoom(zs.a.z-.1)}
    else if(e.key.startsWith('Arrow')){
      e.preventDefault();
      if(e.key==='ArrowLeft')zs.a.x=zwischen(zs.a.x-schritt,0,100);else if(e.key==='ArrowRight')zs.a.x=zwischen(zs.a.x+schritt,0,100);
      else if(e.key==='ArrowUp')zs.a.y=zwischen(zs.a.y-schritt,0,100);else if(e.key==='ArrowDown')zs.a.y=zwischen(zs.a.y+schritt,0,100);
      zuschnittAnwenden();
    }
    return;
  }
  if(imFeld||!mm.auswahl)return;
  if(e.key==='Escape'){waehle(null);return}
  const pfeil={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(!pfeil||mod||e.altKey)return;
  const el=rahmenEl(mm.auswahl.key);if(!el)return;
  e.preventDefault();
  const g=geoAus(el.dataset.mmrG),S=M.RASTER.spalten,Z=M.RASTER.zeilen;
  const n=e.shiftKey?{...g,w:zwischen(g.w+pfeil[0],1,S-g.c+1),h:zwischen(g.h+pfeil[1],1,Z-g.r+1)}
    :{...g,c:zwischen(g.c+pfeil[0],1,S-g.w+1),r:zwischen(g.r+pfeil[1],1,Z-g.h+1)};
  if(gleicheGeo(n,g))return;
  layoutAendern(mm.auswahl.key,n,'Rahmen «'+(el.dataset.mmrName||mm.auswahl.key)+'» '+(e.shiftKey?'in der Größe geändert':'verschoben'),
    {gruppe:'tasten-'+mm.auswahl.key+(e.shiftKey?'-groesse':'')});
});
// Ziehen und Ablegen: Fotos der Bibliothek (rechts) und Dateien vom Schreibtisch. Bilder auf der Seite selbst werden
// nicht gezogen (das verschiebt den Rahmen). Eine Datei neben der Seite öffnet der Browser nicht.
root.addEventListener('dragstart',e=>{
  if(ui.ansicht!=='mappe')return;
  const t=e.target.closest?.('.mm-thumb[data-act="mm-foto"]');
  if(!t){if(e.target.closest?.('.mm-buehne'))e.preventDefault();return}
  mm.ziehtFoto={z:t.dataset.z,o:t.dataset.o,d:t.dataset.d};
  if(e.dataTransfer){
    e.dataTransfer.effectAllowed='copy';
    try{e.dataTransfer.setData('text/plain',t.getAttribute('aria-label')||'Foto')}catch{}
    const img=t.querySelector('img');if(img&&e.dataTransfer.setDragImage)e.dataTransfer.setDragImage(img,32,24);
  }
  ablageZeigen(mm.ziehtFoto);
});
root.addEventListener('dragend',()=>{if(mm.ziehtFoto)ablageEnde()});
document.addEventListener('dragover',e=>{
  if(ui.ansicht!=='mappe')return;
  const dateien=[...(e.dataTransfer?.types||[])].includes('Files');
  if(!dateien&&!mm.ziehtFoto)return;
  e.preventDefault();
  if(dateien&&!mm.ziehtDatei){mm.ziehtDatei=true;ablageZeigen('datei')}
  const ziel=ablageZiel(e.target);
  if(e.dataTransfer)e.dataTransfer.dropEffect=ziel?'copy':'none';
  root.querySelectorAll('.mm-ablage-hier').forEach(x=>{if(x!==ziel)x.classList.remove('mm-ablage-hier')});
  ziel?.classList.add('mm-ablage-hier');
  // Eine Datei, die das Fenster wieder verlässt, meldet kein Ende: nach einer Sekunde ohne dragover aufräumen.
  if(mm.ziehtDatei){clearTimeout(mm.ablageTimer);mm.ablageTimer=setTimeout(ablageEnde,1000)}
});
document.addEventListener('drop',e=>{
  if(ui.ansicht!=='mappe')return;
  const dateien=[...(e.dataTransfer?.files||[])],foto=mm.ziehtFoto;
  if(!dateien.length&&!foto)return;
  e.preventDefault();
  const ziel=ablageZiel(e.target);ablageEnde();
  if(!ziel){meldung(dateien.length?'Zum Ablegen auf ein Foto der Seite ziehen (oder auf das Bild einer freien Seite).':'Zum Ablegen auf ein Foto dieser Variante ziehen.');return}
  if(dateien.length)void sicher(()=>dateiAblegen(ziel,dateien[0],dateien.length));
  else fotoAblegen(ziel,foto);
});
function feldAusPanel(el){
  const z=zeileVon(el.dataset.z),art=artVon(z?.dokument_id);if(!z||!art)return false;
  const key=el.dataset.feld;
  let wert=el.value;
  if(el.dataset.typ==='datum'){const iso=K.leseDatum(wert);if(iso===null){meldung('Datum bitte als TT.MM.JJJJ eingeben.','warn');return false}wert=iso}
  if(el.dataset.typ==='meilenstein'){const t=K.leseTermin(wert);if(t===null){meldung('Termin bitte als Meilenstein (z. B. M03) oder als Datum TT.MM.JJJJ eingeben.','warn');return false}wert=t}
  if(art==='eingang'&&key==='disziplin')wert=String(wert||'').trim().toUpperCase();
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
  if(!window.confirm(K.DOKUMENTE[art].zeile+' '+K.nummer(art,z.nr,z.daten)+' wirklich löschen? Im Verlauf bleibt sie sichtbar.'))return;
  if(z.timer){clearTimeout(z.timer);z.timer=null}
  const {error}=await sb.from('office_projektdokument_zeilen').delete().eq('id',z.id);
  if(error)throw error;
  zeilen[art]=zeilen[art].filter(x=>x!==z);
  for(const k of zeilen.klaerungsliste)if(k.daten.entscheidung_id===z.id){const d={...k.daten};delete d.entscheidung_id;k.daten=d;markiere(k)}
  for(const v of zeilen.entscheidungsvorlagen)if((v.daten.punkte||[]).includes(z.id)){v.daten={...v.daten,punkte:v.daten.punkte.filter(x=>x!==z.id)};markiere(v)}
  ui.detail=null;ui.auswahl.delete(z.id);meldung(K.DOKUMENTE[art].zeile+' '+K.nummer(art,z.nr,z.daten)+' gelöscht.');render();
}
window.addEventListener('beforeunload',e=>{
  if(ungespeichert()){void alleSpeichern();e.preventDefault();e.returnValue=''}
});
// Für Work (Reiter «Mustermappe»): Revision der offenen Mappe, ob etwas aussteht, und Speichern, bevor Work den Rahmen
// schließt oder eine andere Mappe lädt.
window.TBA_OFFICE_TOOL=Object.freeze({kind:'mustermappe',revision:()=>vorlageZeile()?.rev||0,
  pending:()=>ungespeichert()||speicher.laeuft>0,flush:()=>alleSpeichern()});

void start();
})();
