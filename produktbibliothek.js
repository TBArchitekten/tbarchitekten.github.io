/* TBA Office · Produktbibliothek (23.11.2026, Claude; Entwurf von Gari am 23.11.2026 freigegeben).
   Gari wünschte eine Bibliothek wie bei Programa, aber für Materialien, zuerst Bodenbeläge: einmal erfassen, in jedem
   Projekt verwenden. Ansichten nach dem Entwurf: Bibliothek (Karten mit Preis und Herkunft), Produktblatt (Merkmale mit
   Seite im Datenblatt, Dokumente, Preise, Verwendung in Projekten), Datenblatt prüfen und übernehmen (Romy liest, die
   Person prüft; gespeichert wird erst dann) und von Hand anlegen. Jeder Preis trägt Art, Stand und Quelle; ein Ansatz,
   der in mehreren alten Kostenberechnungen gleich steht, zählt als eine Quelle. Daten: office_produkte und Nachbarn
   (Migration 20261123180000), Dateien im privaten Bucket «office-produkte», Leser: Edge Function office-produkt-ai. */
(()=>{
'use strict';
const OFFICE=window.TBA_OFFICE_CONFIG;
const sb=window.MINDS_SUPABASE||(window.supabase&&OFFICE?window.supabase.createClient(OFFICE.url,OFFICE.key,
  {auth:{storageKey:OFFICE.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null);
const inApp=!!window.WINDOW_NATIVE?.available;
const BUCKET='office-produkte',FUNKTION='office-produkt-ai',LESER_VERSION='office-produkt-ai-v1';
const MAX_LESEN=8*1024*1024,MAX_DATEI=25*1024*1024;
const params=new URLSearchParams(location.search);
const ID=params.get('id'),NEU=params.get('neu'),BEARBEITEN=params.get('bearbeiten');
const root=document.getElementById('pb'),dialog=document.getElementById('pbDialog');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KATEGORIEN=[['bodenbelag','Bodenbeläge','Bodenbelag','BO'],['wandbelag','Wandbeläge','Wandbelag','WA'],['decke','Decken','Decke','DE'],
  ['fassade','Fassade','Fassade','FA'],['fenster_tueren','Fenster und Türen','Fenster und Türen','FE'],['sanitaer','Sanitär','Sanitär','SA'],
  ['beschlaege','Beschläge','Beschlag','BE'],['sonstiges','Sonstiges','Sonstiges','SO']];
const KAT=new Map(KATEGORIEN.map(([k,mehr,eins,kurz])=>[k,{mehr,eins,kurz}]));
const PREISARTEN={listenpreis_material:'Listenpreis Material',angebot_material:'Angebot Material',angebot_eingebaut:'Angebot eingebaut',
  ansatz_kobe:'Ansatz Kostenberechnung',abrechnung:'Abrechnung'};
const EINGEBAUT=new Set(['angebot_eingebaut','abrechnung','ansatz_kobe']);
const MARKT=new Set(['angebot_eingebaut','abrechnung','angebot_material']);
const DOKARTEN={datenblatt:'Datenblatt',preisliste:'Preisliste',verlegeanleitung:'Verlegeanleitung',pflegeanleitung:'Pflegeanleitung',
  leistungserklaerung:'Leistungserklärung',epd:'Umweltdeklaration (EPD)',zertifikat:'Zertifikat',bild:'Bild',sonstiges:'Sonstiges'};
const STATI=['vorgeschlagen','bemustert','freigegeben','ausgeschrieben','beauftragt','verworfen'];
const EINHEITEN=['m²','m','m³','St','psch','kg','t','h'];
const MIMES=['application/pdf','image/jpeg','image/png','image/webp'];
const FEHLER={not_an_office_member:'Kein Zugriff auf TBA Office.',ai_not_configured:'Der Leser ist noch nicht eingerichtet.',
  invalid_attachments:'Die Datei kann der Leser nicht lesen (PDF, JPG, PNG oder WebP bis 8 MB).',one_document_required:'Bitte genau ein Dokument wählen.',
  request_too_large:'Die Datei ist zu groß für den Leser (bis 8 MB).',ai_timeout_or_network:'Der Leser hat nicht rechtzeitig geantwortet.',
  ai_provider_unavailable:'Der Leser ist gerade nicht erreichbar.',ai_incomplete:'Der Leser hat keine vollständige Antwort geliefert.',
  ai_invalid_response:'Die Antwort des Lesers war nicht prüfbar.',office_ai_quota_unavailable:'Der Leser ist gerade nicht erreichbar.',
  ai_request_not_allowed:'Kein Zugriff auf den Leser.',library_unavailable:'Die Bibliothek ist gerade nicht erreichbar.'};
const zahlFmt=new Intl.NumberFormat('de-DE',{maximumFractionDigits:2});
const zahl=n=>zahlFmt.format(Number(n));
const datum=iso=>{if(!iso)return '';const d=new Date(iso.length===10?iso+'T12:00:00':iso);return Number.isFinite(d.getTime())?d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}):''};
const jahr=iso=>iso?String(iso).slice(0,4):'';
const katName=k=>KAT.get(k)?.mehr||'Sonstiges';
const katEins=k=>KAT.get(k)?.eins||'Sonstiges';
// Kostengruppe der Bodenbeläge nach DIN 276:2018-12: auf der Bodenplatte 324, auf Decken 353 (Muster der Kostenberechnung).
const KG_HINWEIS={bodenbelag:'die Kostengruppe ergibt sich aus der Verwendung: auf der Bodenplatte KG 324, auf Decken KG 353'};

let nutzer=null,mitglied=null;
const daten={produkte:[],preise:[],dokumente:[],verwendungen:[],projekte:[],team:new Set()};
const ui={kategorie:'bodenbelag',suche:'',herkunft:'alle',sort:'zuletzt',archiv:false};
let bilder=new Map();

function fehler(text){root.innerHTML='<div class="pb-wrap"><a class="pb-back" href="./app/#section=tools">‹ Werkzeuge</a><div class="pb-banner warn">'+esc(text)+'</div></div>'}
function meldung(text,art='info'){const el=root.querySelector('[data-meldung]');if(el){el.className='pb-banner '+art;el.textContent=text;el.hidden=!text}}

// ---------- Start ----------
async function start(){
  if(!sb){fehler('Office-Verbindung nicht verfügbar.');return}
  const {data,error}=await sb.auth.getSession();
  const session=data?.session;
  if(error||!session){if(inApp){void window.WINDOW_NATIVE.call('session.signIn');fehler('Bitte in der App anmelden.');return}location.href='./';return}
  nutzer=session.user;
  const {data:m,error:me}=await sb.from('office_members').select('role,display_name,is_active,must_change_password')
    .eq('user_id',nutzer.id).eq('is_active',true).maybeSingle();
  if(me||!m){fehler('Kein Zugriff auf TBA Office.');return}
  if(m.must_change_password){if(inApp){fehler('Bitte zuerst im Browser auf tbarchitekten.github.io das Startpasswort ändern.');return}location.href='./';return}
  mitglied=m;
  try{
    await ladeAlles();
    if(ID)await zeigeProdukt(ID);
    else if(BEARBEITEN){const e=UUID.test(BEARBEITEN)&&daten.produkte.find(p=>p.id===BEARBEITEN);if(e)zeigeFormular(e);else fehler('Diesen Eintrag gibt es nicht (mehr) in der Bibliothek.')}
    else if(NEU==='datenblatt')zeigeLeser();
    else if(NEU==='hand')zeigeFormular(null);
    else await zeigeListe();
  }catch(e){console.error('Produktbibliothek',e);fehler(e?.message||'Produktbibliothek nicht erreichbar.')}
}
async function ladeAlles(){
  const [pr,pe,dok,ver,proj,team]=await Promise.all([
    sb.from('office_produkte').select('*').order('updated_at',{ascending:false}).limit(2000),
    sb.from('office_produkt_preise').select('*').order('stand',{ascending:false,nullsFirst:false}).limit(10000),
    sb.from('office_produkt_dokumente').select('*').order('created_at',{ascending:false}).limit(5000),
    sb.from('office_produkt_verwendungen').select('*').order('updated_at',{ascending:false}).limit(5000),
    sb.from('office_projects').select('id,number,name,status,projektleiter_id').order('number').limit(500),
    sb.from('office_project_members').select('project_id').eq('user_id',nutzer.id).limit(500)
  ]);
  const err=pr.error||pe.error||dok.error||ver.error||proj.error||team.error;if(err)throw err;
  daten.produkte=pr.data||[];daten.preise=pe.data||[];daten.dokumente=dok.data||[];daten.verwendungen=ver.data||[];
  daten.projekte=proj.data||[];daten.team=new Set((team.data||[]).map(x=>x.project_id));
}
const projekt=id=>daten.projekte.find(p=>p.id===id)||null;
const projektName=p=>p?[p.number,p.name].filter(Boolean).join(' · '):'';
// Die Verwendung im Projekt ändern Projektteam und Projektleitung (wie die Policy in der Datenbank); Admins auch.
const darfProjekt=p=>!!p&&p.status==='aktiv'&&(mitglied?.role==='admin'||p.projektleiter_id===nutzer?.id||daten.team.has(p.id));
const eigeneProjekte=()=>daten.projekte.filter(darfProjekt);

// ---------- Preise mit Herkunft ----------
function quelleVon(x){return x.projekt_id?projektName(projekt(x.projekt_id)):(x.projekt_bezeichnung||'')}
function preiseVon(e){return daten.preise.filter(x=>x.produkt_id===e.id)}
function familienPreise(e){
  if(!e.familie)return [];
  const ids=new Set(daten.produkte.filter(p=>p.id!==e.id&&!p.archiviert&&p.familie===e.familie).map(p=>p.id));
  return daten.preise.filter(x=>ids.has(x.produkt_id));
}
// Gleicher Betrag in mehreren Kostenberechnungen: vermutlich übernommen, nicht neu ermittelt; zählt als eine Quelle.
function uebernommen(liste){
  const gruppen=new Map();
  for(const x of liste.filter(x=>x.art==='ansatz_kobe')){
    const k=Number(x.betrag).toFixed(2)+'|'+x.einheit;
    if(!gruppen.has(k))gruppen.set(k,[]);gruppen.get(k).push(x);
  }
  const raus=[];
  for(const g of gruppen.values()){
    const herkunft=new Set(g.map(quelleVon).filter(Boolean));
    if(g.length>=2&&herkunft.size>=2){
      const jahre=g.map(x=>jahr(x.stand)).filter(Boolean).sort();
      raus.push({betrag:Number(g[0].betrag),einheit:g[0].einheit,anzahl:g.length,von:jahre[0]||'',bis:jahre[jahre.length-1]||''});
    }
  }
  return raus;
}
function quellenZahl(liste){
  const kopien=uebernommen(liste);
  let n=liste.length;for(const k of kopien)n-=k.anzahl-1;
  return n;
}
function preisBild(e){
  const eigene=preiseVon(e),familie=eigene.length?[]:familienPreise(e),liste=eigene.length?eigene:familie;
  const bild={haupt:'',zusatz:'',meta:'',badges:[],ausFamilie:!eigene.length&&familie.length>0,liste};
  if(!liste.length){bild.haupt='noch kein Preis';bild.meta=e.typ==='produkt'?'Noch nie angesetzt':'Noch kein Ansatz';return bild}
  const eingebaut=liste.filter(x=>EINGEBAUT.has(x.art)),material=liste.filter(x=>x.art==='listenpreis_material'||x.art==='angebot_material');
  const basis=eingebaut.length?eingebaut:material;
  const einheit=haeufigste(basis.map(x=>x.einheit));
  const werte=basis.filter(x=>x.einheit===einheit).map(x=>Number(x.betrag)).sort((a,b)=>a-b);
  const min=werte[0],max=werte[werte.length-1];
  bild.haupt=(min===max?zahl(min):zahl(min)+'–'+zahl(max))+' €/'+einheit;
  bild.zusatz=eingebaut.length?'eingebaut':'Material';
  const markt=liste.filter(x=>MARKT.has(x.art)).length,ansaetze=liste.filter(x=>x.art==='ansatz_kobe').length;
  if(eingebaut.length){
    if(markt)bild.meta=markt===1?'aus 1 Angebot oder Abrechnung':'aus '+markt+' Angeboten oder Abrechnungen';
    else bild.meta='Ansatz in '+ansaetze+(ansaetze===1?' Kostenberechnung':' Kostenberechnungen')+', kein Angebot';
  }else bild.meta='Listenpreis, ohne Verlegung';
  if(bild.ausFamilie)bild.meta+=' · Familie «'+e.familie+'»';
  bild.badges=hinweiseFuer(liste);
  return bild;
}
// Hinweise zu einer Liste von Preisen: übernommener Ansatz (zählt als eine Quelle), große Spanne eingebaut, nur eine Quelle.
function hinweiseFuer(liste){
  const raus=[];
  for(const k of uebernommen(liste))raus.push(['att',(k.von&&k.von!==k.bis?'seit '+k.von+' ':'')+'unverändert übernommen']);
  const eingebaut=liste.filter(x=>EINGEBAUT.has(x.art));
  if(eingebaut.length>1){
    const einheit=haeufigste(eingebaut.map(x=>x.einheit)),werte=eingebaut.filter(x=>x.einheit===einheit).map(x=>Number(x.betrag));
    const min=Math.min(...werte),max=Math.max(...werte);
    if(werte.length>1&&min>0&&max/min>=2)raus.push(['att','Spanne × '+zahl(Math.round(max/min*10)/10)+': Umfang prüfen']);
  }
  if(liste.length&&quellenZahl(liste)===1)raus.push(['mute','1 Quelle']);
  return raus;
}
const KOPIE_TEXT='Gleicher Betrag in mehreren Kostenberechnungen: vermutlich ein übernommener Ansatz, kein neu ermittelter Preis. Er zählt als eine Quelle.';
function haeufigste(liste){const z=new Map();for(const x of liste)z.set(x,(z.get(x)||0)+1);let best=liste[0]||'m²',n=0;for(const [k,v] of z)if(v>n){best=k;n=v}return best}
function dokumenteVon(e){return daten.dokumente.filter(d=>d.produkt_id===e.id)}
function verwendungenVon(e){return daten.verwendungen.filter(v=>v.produkt_id===e.id)}
function verwendungsZeile(e){
  const v=verwendungenVon(e).filter(x=>x.status!=='verworfen');
  if(!v.length)return 'in keinem laufenden Projekt';
  const p=projekt(v[0].projekt_id);
  return [p?.name||'Projekt',v[0].code,v[0].status].filter(Boolean).join(' · ')+(v.length>1?' · +'+(v.length-1):'');
}

// ---------- Bild der Karte ----------
function farbeVon(e){
  if(/^#[0-9a-f]{6}$/i.test(e.farbe||''))return e.farbe;
  let h=0;for(const c of String(e.familie||e.name))h=(h*31+c.charCodeAt(0))>>>0;
  return ['#d9d3c5','#c8c5bd','#cbd0d6','#d6cbbd','#c9cfc5','#d3cfd8'][h%6];
}
// Ohne Bild deutet die Karte das Material an (wie im Entwurf): Holz in Dielen, Stein und Estrich gesprenkelt,
// Fliesen im Raster, Textil fein gestreift. Nur Andeutung, kein Produktfoto.
function texturVon(e){
  const t=[e.familie,e.name,e.beschreibung].filter(Boolean).join(' ').toLowerCase();
  if(/parkett|diele|holz|eiche|esche|nussbaum|lärche|douglas/.test(t))
    return 'repeating-linear-gradient(90deg,rgba(90,60,30,.2) 0 2px,transparent 2px 58px),repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 1px,transparent 1px 7px)';
  if(/fliese|feinstein|keramik|mosaik/.test(t))
    return 'linear-gradient(90deg,rgba(255,255,255,.55) 0 2px,transparent 2px),linear-gradient(0deg,rgba(255,255,255,.55) 0 2px,transparent 2px)';
  if(/stein|kalk|marmor|granit|terrazzo|estrich|beton|zement/.test(t))
    return 'radial-gradient(circle at 20% 30%,rgba(90,80,60,.3) 0 1.5px,transparent 2.5px),radial-gradient(circle at 70% 60%,rgba(80,72,58,.25) 0 1px,transparent 2px)';
  if(/teppich|textil|velours|schlinge|sisal/.test(t))
    return 'repeating-linear-gradient(45deg,rgba(0,0,0,.05) 0 1px,transparent 1px 4px)';
  return '';
}
function texturGroesse(bild){return bild.startsWith('linear-gradient(90deg,rgba(255,255,255')?'60px 60px':bild.startsWith('radial')?'37px 41px,29px 31px':''}
async function ladeBilder(liste){
  const wahl=new Map();
  for(const d of daten.dokumente)if(d.art==='bild'&&!wahl.has(d.produkt_id)&&liste.some(e=>e.id===d.produkt_id))wahl.set(d.produkt_id,d.storage_path);
  if(!wahl.size)return;
  const {data,error}=await sb.storage.from(BUCKET).createSignedUrls([...wahl.values()],900);
  if(error||!Array.isArray(data))return;
  const proPfad=new Map(data.filter(x=>x.signedUrl).map(x=>[x.path,x.signedUrl]));
  for(const [id,pfad] of wahl)if(proPfad.has(pfad))bilder.set(id,proPfad.get(pfad));
}
function swatch(e,klasse='pb-swatch'){
  const url=bilder.get(e.id);
  if(url)return '<div class="'+klasse+'" aria-hidden="true"><img src="'+esc(url)+'" alt=""></div>';
  const bild=texturVon(e),groesse=texturGroesse(bild);
  return '<div class="'+klasse+'" aria-hidden="true" style="background-color:'+esc(farbeVon(e))+(bild?';background-image:'+bild:'')+(groesse?';background-size:'+groesse:'')+'"></div>';
}
const badge=([art,text])=>'<span class="chip chip-'+art+'">'+esc(text)+'</span>';

// ---------- Bibliothek ----------
async function zeigeListe(){
  const sichtbar=daten.produkte.filter(e=>ui.archiv?e.archiviert:!e.archiviert);
  await ladeBilder(sichtbar);
  renderListe();
}
function gefiltert(){
  const q=ui.suche.trim().toLowerCase();
  let liste=daten.produkte.filter(e=>(ui.archiv?e.archiviert:!e.archiviert)&&(ui.kategorie==='alle'||e.kategorie===ui.kategorie));
  if(q)liste=liste.filter(e=>[e.name,e.hersteller,e.serie,e.familie,e.beschreibung,...(e.merkmale||[]).map(m=>m.feld+' '+m.wert)]
    .filter(Boolean).join(' ').toLowerCase().includes(q));
  if(ui.herkunft!=='alle')liste=liste.filter(e=>{const l=preisBild(e).liste;
    if(ui.herkunft==='markt')return l.some(x=>MARKT.has(x.art));
    if(ui.herkunft==='ansatz')return l.some(x=>x.art==='ansatz_kobe');
    if(ui.herkunft==='liste')return l.some(x=>x.art==='listenpreis_material');
    return !l.length});
  const preis=e=>{const l=preisBild(e).liste.filter(x=>EINGEBAUT.has(x.art));return l.length?Math.min(...l.map(x=>Number(x.betrag))):Infinity};
  if(ui.sort==='preis')liste.sort((a,b)=>preis(a)-preis(b));
  else if(ui.sort==='projekte')liste.sort((a,b)=>verwendungenVon(b).length-verwendungenVon(a).length);
  else if(ui.sort==='name')liste.sort((a,b)=>a.name.localeCompare(b.name,'de'));
  return liste;
}
function hinweisText(){
  const ansaetze=daten.preise.filter(x=>x.art==='ansatz_kobe'),markt=daten.preise.filter(x=>MARKT.has(x.art));
  if(!daten.preise.length)return 'Jeder Preis trägt seine Herkunft: Listenpreis aus dem Datenblatt, Angebot, Ansatz einer Kostenberechnung oder Abrechnung.';
  const teile=['Jeder Preis trägt seine Herkunft.'];
  if(ansaetze.length){
    const quellen=new Set(ansaetze.map(quelleVon).filter(Boolean)),jahre=ansaetze.map(x=>jahr(x.stand)).filter(Boolean).sort();
    const spanne=jahre.length?(jahre[0]===jahre[jahre.length-1]?jahre[0]:jahre[0]+'–'+jahre[jahre.length-1]):'';
    teile.push('Die Ansätze stammen aus '+(quellen.size<=1?'einer Kostenberechnung':quellen.size+' Kostenberechnungen')+(spanne?' ('+spanne+')':'')+': Schätzungen, keine Angebote.');
  }
  teile.push(markt.length?(markt.length===1?'1 Preis stammt':markt.length+' Preise stammen')+' aus Angeboten oder Abrechnungen.':'Erst ein Angebot oder eine Abrechnung macht daraus einen Marktpreis.');
  return teile.join(' ');
}
function renderListe(){
  const zaehler=new Map();for(const e of daten.produkte)if(ui.archiv?e.archiviert:!e.archiviert)zaehler.set(e.kategorie,(zaehler.get(e.kategorie)||0)+1);
  const chips=[...KATEGORIEN.map(([k,mehr])=>[k,mehr+(zaehler.get(k)?' · '+zaehler.get(k):'')]),['alle','Alle']]
    .map(([k,text])=>'<button type="button" class="pill" aria-pressed="'+(ui.kategorie===k)+'" data-kat="'+k+'">'+esc(text)+'</button>').join('');
  root.innerHTML=`<div class="pb-wrap">
    <a class="pb-back" href="./app/#section=tools">‹ Werkzeuge</a>
    <header class="pb-head"><div class="pb-head-text"><p class="kicker">Werkzeuge</p><h1>Produktbibliothek</h1>
      <p class="pb-intro">Einmal erfassen, in jedem Projekt verwenden: Produkte mit Herstellerdatenblatt, Preisen mit ihrer Herkunft und den Projekten, in denen sie stecken.</p></div>
      <div class="pb-actions"><a class="btn btn-primary" href="./produktbibliothek.html?neu=datenblatt">${ICON_HOCH}Herstellerdatenblatt hochladen</a>
      <a class="btn" href="./produktbibliothek.html?neu=hand">Von Hand anlegen</a></div></header>
    <div class="pb-banner" data-meldung hidden></div>
    <section class="card pb-filter" aria-label="Suchen und filtern">
      <div class="pb-filter-zeile">
        <div class="pb-gruppe pb-gruppe-suche"><label for="pbSuche" class="meta">Suchen</label>
        <input id="pbSuche" class="pb-input pb-suche" type="search" value="${esc(ui.suche)}" placeholder="Produkt, Hersteller, Eigenschaft (z. B. R10, Cfl-s1)"></div>
        <div class="pb-gruppe"><label for="pbHerkunft" class="meta">Preis aus</label>
        <select id="pbHerkunft" class="pb-input">${[['alle','allen Quellen'],['markt','Angebot oder Abrechnung'],['ansatz','Kostenberechnung (Ansatz)'],['liste','Datenblatt (Listenpreis)'],['ohne','noch ohne Preis']]
          .map(([k,t])=>'<option value="'+k+'"'+(ui.herkunft===k?' selected':'')+'>'+t+'</option>').join('')}</select></div>
        <div class="pb-gruppe"><label for="pbSort" class="meta">Sortieren</label>
        <select id="pbSort" class="pb-input">${[['zuletzt','zuletzt geändert'],['preis','Preis eingebaut'],['projekte','Anzahl Projekte'],['name','Name']]
          .map(([k,t])=>'<option value="'+k+'"'+(ui.sort===k?' selected':'')+'>'+t+'</option>').join('')}</select></div>
        <button type="button" class="btn btn-quiet" data-archiv aria-pressed="${ui.archiv}">${ui.archiv?'Zurück zur Bibliothek':'Archiv'}</button>
      </div>
      <div class="pb-pills" role="group" aria-label="Kategorie">${chips}</div>
    </section>
    <div class="pb-banner info">${esc(hinweisText())}</div>
    <p class="meta pb-zahl" data-zahl aria-live="polite"></p>
    <div data-ergebnis></div>
  </div>`;
  // Nur das Ergebnis neu zeichnen: das Suchfeld behält Fokus und Tastatur.
  root.querySelector('#pbSuche').addEventListener('input',ev=>{ui.suche=ev.target.value;renderErgebnis()});
  root.querySelector('#pbHerkunft').addEventListener('change',ev=>{ui.herkunft=ev.target.value;renderErgebnis()});
  root.querySelector('#pbSort').addEventListener('change',ev=>{ui.sort=ev.target.value;renderErgebnis()});
  root.querySelector('[data-archiv]').addEventListener('click',()=>{ui.archiv=!ui.archiv;void zeigeListe()});
  root.querySelectorAll('[data-kat]').forEach(b=>b.addEventListener('click',()=>{
    ui.kategorie=b.dataset.kat;root.querySelectorAll('[data-kat]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderErgebnis()}));
  renderErgebnis();
}
function renderErgebnis(){
  const el=root.querySelector('[data-ergebnis]');if(!el)return;
  const liste=gefiltert(),anzahl=root.querySelector('[data-zahl]');
  if(anzahl)anzahl.textContent=liste.length+' '+(liste.length===1?'Eintrag':'Einträge')+(ui.kategorie!=='alle'?' · '+katName(ui.kategorie):'')+(KG_HINWEIS[ui.kategorie]?' · '+KG_HINWEIS[ui.kategorie]:'');
  el.innerHTML=`${liste.length?'<div class="pb-grid">'+liste.map(karte).join('')+'</div>':
      '<div class="card pb-leer"><p>'+(daten.produkte.length?'Nichts gefunden. Andere Kategorie oder weniger Suchbegriffe?':'Die Bibliothek ist noch leer.')+'</p>'+
      '<p class="meta">Am schnellsten mit einem Herstellerdatenblatt: Romy liest es, du prüfst, die Bibliothek übernimmt.</p></div>'}`;
  el.querySelectorAll('[data-zu-projekt]').forEach(b=>b.addEventListener('click',()=>zuProjekt(daten.produkte.find(e=>e.id===b.dataset.zuProjekt))));
}
function karte(e){
  const b=preisBild(e),doks=dokumenteVon(e);
  const badges=[...b.badges];
  if(e.typ==='produkt')badges.push(e.status==='geprueft'&&doks.some(d=>d.art==='datenblatt')?['src','Datenblatt geprüft']:
    doks.some(d=>d.art==='datenblatt')?['mute','Datenblatt ungeprüft']:['mute','Datenblatt fehlt']);
  if(e.bestand)badges.push(['mute','Bestand']);
  const unter=e.typ==='leistung'?'Leistung, kein Produkt':(e.hersteller||'Hersteller offen');
  return `<article class="card pb-karte">
    ${swatch(e)}
    <div class="pb-karte-text">
      <h2><a href="./produktbibliothek.html?id=${esc(e.id)}">${esc(e.name)}</a></h2>
      <p class="meta">${esc([unter,e.familie!==e.name?e.familie:''].filter(Boolean).join(' · '))}</p>
      <p class="pb-preis${b.liste.length?'':' leer'}">${esc(b.haupt)}${b.zusatz?' <span>'+esc(b.zusatz)+'</span>':''}</p>
      <p class="meta">${esc(b.meta)}</p>
      ${badges.length?'<div class="pb-chips">'+badges.map(badge).join('')+'</div>':''}
      <p class="pb-verwendung">${esc(verwendungsZeile(e))}</p>
      <div class="pb-karte-aktionen"><button type="button" class="btn" data-zu-projekt="${esc(e.id)}">Zu Projekt</button></div>
    </div></article>`;
}

// ---------- Produktblatt ----------
async function zeigeProdukt(id){
  const e=daten.produkte.find(p=>p.id===id);
  if(!e){fehler('Diesen Eintrag gibt es nicht (mehr) in der Bibliothek.');return}
  await ladeBilder([e]);
  renderProdukt(e);
}
function renderProdukt(e){
  const doks=dokumenteVon(e),eigene=preiseVon(e),familie=familienPreise(e),verw=verwendungenVon(e);
  const datenblatt=doks.find(d=>d.art==='datenblatt');
  const merkmale=(e.merkmale||[]).filter(m=>m&&m.feld);
  const kopf=[e.typ==='leistung'?'Leistung, kein Produkt':(e.hersteller||'Hersteller offen'),e.serie?'Serie '+e.serie:'',e.familie?'Familie «'+e.familie+'»':'',
    e.status==='geprueft'&&e.geprueft_am?'geprüft am '+datum(e.geprueft_am):'Entwurf'].filter(Boolean).join(' · ');
  const hinweise=hinweiseFuer(eigene),hinweiseFamilie=hinweiseFuer(familie);
  root.innerHTML=`<div class="pb-wrap">
    <a class="pb-back" href="./produktbibliothek.html">‹ Produktbibliothek</a>
    <header class="pb-head"><div class="pb-head-text"><p class="kicker">${e.typ==='leistung'?'Leistung':'Produkt'} · ${esc(katEins(e.kategorie))}${e.bestand?' · Bestand':''}${e.archiviert?' · archiviert':''}</p>
      <h1>${esc(e.name)}</h1><p class="pb-intro">${esc(kopf)}</p></div>
      <div class="pb-actions"><button type="button" class="btn btn-primary" data-zu-projekt>Zu Projekt</button>
        <a class="btn" href="./produktbibliothek.html?bearbeiten=${esc(e.id)}">Bearbeiten</a>
        <button type="button" class="btn" data-archivieren>${e.archiviert?'Zurückholen':'Archivieren'}</button></div></header>
    <div class="pb-banner" data-meldung hidden></div>
    <div class="pb-cols">
      <div class="pb-side">
        ${swatch(e,'pb-swatch gross')}
        ${e.beschreibung?'<section class="card pb-box"><p>'+esc(e.beschreibung)+'</p></section>':''}
        <section class="card pb-box"><h2 class="pb-h2">Dokumente</h2>
          ${doks.length?'<ul class="pb-doks">'+doks.map(d=>`<li><span><b>${esc(DOKARTEN[d.art]||d.art)}</b><br><span class="meta">${esc(d.name)}${d.seiten?' · '+d.seiten+' S.':''}${d.gelesen_am?' · von Romy gelesen':''}</span></span>
            <span class="pb-dok-aktionen">${d.mime_type==='application/pdf'&&!d.gelesen_am&&d.size_bytes<=MAX_LESEN?'<button type="button" class="btn btn-quiet" data-dok-lesen="'+esc(d.id)+'">Romy lesen lassen</button>':''}<button type="button" class="btn btn-quiet" data-oeffnen="${esc(d.id)}">Öffnen</button>${d.created_by===nutzer.id||mitglied.role==='admin'?'<button type="button" class="btn btn-quiet btn-danger" data-dok-weg="'+esc(d.id)+'">Entfernen</button>':''}</span></li>`).join('')+'</ul>':'<p class="meta">Noch kein Dokument.</p>'}
          <div class="pb-dok-neu">
            <label class="meta" for="pbDokArt">Art</label>
            <select id="pbDokArt" class="pb-input">${Object.entries(DOKARTEN).map(([k,t])=>'<option value="'+k+'"'+(k===(datenblatt?'preisliste':'datenblatt')?' selected':'')+'>'+esc(t)+'</option>').join('')}</select>
            <label class="btn">Dokument hochladen<input type="file" id="pbDokDatei" class="pb-datei" accept=".pdf,.jpg,.jpeg,.png,.webp"></label>
          </div>
          <p class="meta">Ein Dokument kann Romy danach lesen; neue Angaben und Preise kommen erst nach deiner Prüfung dazu.</p>
        </section>
      </div>
      <div class="pb-main">
        <section class="card pb-box"><div class="pb-box-kopf"><h2 class="pb-h2">Technische Daten</h2><p class="meta">${datenblatt?'Jede Angabe nennt die Seite im Datenblatt':'Ohne Datenblatt: Angaben von Hand'}</p></div>
          ${merkmale.length?'<dl class="pb-merkmale">'+merkmale.map(m=>`<div><dt>${esc(m.feld)}</dt><dd>${esc(m.wert)}${m.seite&&datenblatt?' <button type="button" class="pb-seite" data-seite="'+Number(m.seite)+'" data-dok="'+esc(m.dokument_id||datenblatt.id)+'">S. '+Number(m.seite)+'</button>':''}</dd></div>`).join('')+'</dl>':'<p class="meta">Noch keine Angaben.</p>'}
          ${(e.fehlend||[]).length?'<p class="pb-fehlt">Nicht im Datenblatt: '+esc((e.fehlend||[]).join(' · '))+'</p>':''}
        </section>
        <section class="card pb-box"><div class="pb-box-kopf"><h2 class="pb-h2">Preise</h2><p class="meta">netto · jeder Preis mit Stand, Art und Quelle</p></div>
          ${eigene.length?preisTabelle(eigene,true):'<p class="meta">Für diesen Eintrag ist noch kein Preis eingetragen.</p>'}
          ${hinweise.length?'<div class="pb-chips">'+hinweise.map(badge).join('')+'</div>':''}
          ${uebernommen(eigene).length?'<p class="pb-warn">'+KOPIE_TEXT+'</p>':''}
          ${eigene.some(x=>x.art==='listenpreis_material')&&!eigene.some(x=>EINGEBAUT.has(x.art))?'<p class="meta">Ein Listenpreis ist kein eingebauter Preis: Kleber, Verlegen und Zubehör kommen aus dem Element der Kostenberechnung'+(e.familie?' «'+esc(e.familie)+'»':'')+'.</p>':''}
          <button type="button" class="btn" data-preis-neu>Preis eintragen</button>
          ${familie.length?'<h3 class="pb-h3">Preise der Familie «'+esc(e.familie)+'»</h3><p class="meta">Aus anderen Einträgen derselben Familie, zum Vergleich.</p>'+
            (hinweiseFamilie.length?'<div class="pb-chips">'+hinweiseFamilie.map(badge).join('')+'</div>':'')+
            (uebernommen(familie).length?'<p class="pb-warn">'+KOPIE_TEXT+'</p>':'')+preisTabelle(familie,false,true):''}
        </section>
        <section class="card pb-box"><h2 class="pb-h2">Verwendet in</h2>
          ${verw.length?verwendungsTabelle(verw):'<p class="meta">In keinem Projekt.</p>'}
        </section>
      </div>
    </div>
  </div>`;
  root.querySelector('[data-zu-projekt]').addEventListener('click',()=>zuProjekt(e));
  root.querySelector('[data-archivieren]').addEventListener('click',()=>archivieren(e));
  root.querySelector('[data-preis-neu]').addEventListener('click',()=>preisDialog(e));
  root.querySelectorAll('[data-oeffnen]').forEach(b=>b.addEventListener('click',()=>oeffneDokument(b.dataset.oeffnen)));
  root.querySelectorAll('[data-seite]').forEach(b=>b.addEventListener('click',()=>oeffneDokument(b.dataset.dok,Number(b.dataset.seite))));
  root.querySelectorAll('[data-dok-weg]').forEach(b=>b.addEventListener('click',()=>dokumentEntfernen(e,b.dataset.dokWeg)));
  root.querySelectorAll('[data-preis-weg]').forEach(b=>b.addEventListener('click',()=>preisEntfernen(e,b.dataset.preisWeg)));
  root.querySelectorAll('[data-dok-lesen]').forEach(b=>b.addEventListener('click',()=>bestehendesLesen(e,b.dataset.dokLesen)));
  root.querySelectorAll('[data-status]').forEach(s=>s.addEventListener('change',()=>statusAendern(e,s.dataset.status,s.value)));
  root.querySelector('#pbDokDatei').addEventListener('change',ev=>{const f=ev.target.files?.[0];if(f)void dokumentHochladen(e,f,root.querySelector('#pbDokArt').value)});
}
function preisTabelle(liste,eigene,familie=false){
  const zeilen=liste.slice().sort((a,b)=>String(b.stand||'').localeCompare(String(a.stand||''))).map(x=>{
    const darf=eigene&&(x.created_by===nutzer.id||mitglied.role==='admin');
    const herkunft=[quelleVon(x),x.menge?zahl(x.menge)+' '+x.einheit:''].filter(Boolean).join(' · ');
    const quelle=[x.kg?'KG '+x.kg:'',x.quelle,x.seite?'S. '+x.seite:''].filter(Boolean).join(' · ');
    const eintrag=familie?daten.produkte.find(p=>p.id===x.produkt_id):null;
    return `<tr><td class="num-l">${esc(x.stand?datum(x.stand):'—')}</td>
      <td><span class="chip ${MARKT.has(x.art)?'chip-ok':x.art==='listenpreis_material'?'chip-src':'chip-mute'}">${esc(PREISARTEN[x.art]||x.art)}</span></td>
      <td class="num">${esc(zahl(x.betrag))}</td><td>${esc(x.einheit)}</td>
      <td>${esc(herkunft||'—')}</td><td>${esc(quelle||'—')}${eintrag?'<br><a class="meta" href="./produktbibliothek.html?id='+esc(eintrag.id)+'">'+esc(eintrag.name)+'</a>':''}${x.kommentar?'<br><span class="meta">'+esc(x.kommentar)+'</span>':''}</td>
      <td>${darf?'<button type="button" class="btn btn-quiet btn-danger" data-preis-weg="'+esc(x.id)+'">Entfernen</button>':''}</td></tr>`}).join('');
  return `<div class="pb-tabelle"><table><thead><tr><th scope="col">Stand</th><th scope="col">Art</th><th scope="col" class="num">€ netto</th><th scope="col">Einheit</th>
    <th scope="col">Projekt · Menge</th><th scope="col">Quelle</th><th scope="col"><span class="sr">Aktion</span></th></tr></thead><tbody>${zeilen}</tbody></table></div>`;
}
function verwendungsTabelle(liste){
  return `<div class="pb-tabelle"><table><thead><tr><th scope="col">Projekt</th><th scope="col">Code</th><th scope="col">Räume</th><th scope="col" class="num">Menge</th><th scope="col">Stand der Bemusterung</th></tr></thead><tbody>${
    liste.map(v=>{const p=projekt(v.projekt_id),darf=darfProjekt(p);
      return `<tr><td>${esc(projektName(p)||'Projekt')}</td><td>${esc(v.code||'—')}</td><td>${esc(v.raeume||'—')}</td>
        <td class="num">${v.menge!=null?esc(zahl(v.menge)+' '+(v.einheit||'')):'—'}</td>
        <td>${darf?'<label class="sr" for="st-'+esc(v.id)+'">Stand</label><select id="st-'+esc(v.id)+'" class="pb-input" data-status="'+esc(v.id)+'">'+STATI.map(s=>'<option'+(s===v.status?' selected':'')+'>'+s+'</option>').join('')+'</select>':esc(v.status)}
        ${v.notiz?'<br><span class="meta">'+esc(v.notiz)+'</span>':''}</td></tr>`}).join('')}</tbody></table></div>`;
}
async function oeffneDokument(id,seite){
  const d=daten.dokumente.find(x=>x.id===id);if(!d)return;
  const fenster=window.open('','_blank');
  const {data,error}=await sb.storage.from(BUCKET).createSignedUrl(d.storage_path,600);
  if(error||!data?.signedUrl){fenster?.close();meldung('Das Dokument ist gerade nicht erreichbar.','warn');return}
  const url=data.signedUrl+(seite&&d.mime_type==='application/pdf'?'#page='+seite:'');
  if(fenster)fenster.location.href=url;else location.href=url;
}
async function dokumentHochladen(e,datei,art){
  if(!MIMES.includes(datei.type)){meldung('Bitte ein PDF oder Bild (JPG, PNG, WebP).','warn');return}
  if(datei.size>MAX_DATEI){meldung('Die Datei ist größer als 25 MB.','warn');return}
  meldung('Wird hochgeladen …');
  try{
    const d=await speichereDokument(e.id,datei,art,null,null);
    daten.dokumente.unshift(d);if(d.art==='bild')await ladeBilder([e]);
    renderProdukt(e);meldung('Hochgeladen: '+d.name+'.','info');
  }catch(err){console.error('Dokument',err);meldung('Das Dokument konnte nicht gespeichert werden: '+(err?.message||err),'warn')}
}
async function speichereDokument(produktId,datei,art,seiten,gelesen){
  const endung={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[datei.type]||'bin';
  const pfad=nutzer.id+'/'+produktId+'/'+crypto.randomUUID()+'.'+endung;
  const {error:upErr}=await sb.storage.from(BUCKET).upload(pfad,datei,{contentType:datei.type,upsert:false});
  if(upErr)throw upErr;
  const {data,error}=await sb.from('office_produkt_dokumente').insert({produkt_id:produktId,art,name:String(datei.name||'Dokument').slice(0,200),
    storage_path:pfad,mime_type:datei.type,size_bytes:datei.size,seiten:seiten||null,gelesen_am:gelesen?new Date().toISOString():null}).select('*').single();
  if(error){await sb.storage.from(BUCKET).remove([pfad]);throw error}
  return data;
}
// Jeder Dialog beginnt leer: ein altes «ja» in returnValue darf beim Schließen mit Esc nicht mehr zählen.
function oeffneDialog(html,beimSchliessen=null){
  dialog.onclose=null;dialog.returnValue='';dialog.innerHTML=html;dialog.onclose=beimSchliessen;dialog.showModal();
  return dialog.querySelector('form');
}
function frage(titel,text,ja,neinText='Abbrechen'){
  return new Promise(ok=>{
    oeffneDialog(`<form method="dialog" class="pb-frage"><h2>${esc(titel)}</h2><p>${esc(text)}</p>
      <div class="pb-actions"><button value="ja" class="btn btn-primary">${esc(ja)}</button><button value="nein" class="btn">${esc(neinText)}</button></div></form>`,
      ()=>ok(dialog.returnValue==='ja'));
  });
}
async function dokumentEntfernen(e,id){
  const d=daten.dokumente.find(x=>x.id===id);if(!d)return;
  if(!await frage('Dokument entfernen?','«'+d.name+'» wird aus der Bibliothek entfernt. Angaben und Preise, die daraus übernommen wurden, bleiben.','Entfernen'))return;
  const {error}=await sb.from('office_produkt_dokumente').delete().eq('id',id);
  if(error){meldung('Das Dokument konnte nicht entfernt werden: '+error.message,'warn');return}
  await sb.storage.from(BUCKET).remove([d.storage_path]);
  daten.dokumente=daten.dokumente.filter(x=>x.id!==id);
  if(d.art==='bild'){bilder.delete(e.id);await ladeBilder([e])}
  renderProdukt(e);
}
async function preisEntfernen(e,id){
  if(!await frage('Preis entfernen?','Der Preis wird aus der Bibliothek entfernt.','Entfernen'))return;
  const {error}=await sb.from('office_produkt_preise').delete().eq('id',id);
  if(error){meldung('Der Preis konnte nicht entfernt werden: '+error.message,'warn');return}
  daten.preise=daten.preise.filter(x=>x.id!==id);renderProdukt(e);
}
async function statusAendern(e,id,status){
  const {data,error}=await sb.from('office_produkt_verwendungen').update({status}).eq('id',id).select('*').maybeSingle();
  if(error||!data){meldung('Der Stand konnte nicht geändert werden'+(error?': '+error.message:'.'),'warn');renderProdukt(e);return}
  daten.verwendungen=daten.verwendungen.map(v=>v.id===id?data:v);meldung('Stand geändert: '+status+'.','info');
}
async function archivieren(e){
  const zurueck=e.archiviert;
  if(!zurueck&&!await frage('Archivieren?','«'+e.name+'» verschwindet aus der Bibliothek, bleibt aber mit Preisen und Dokumenten im Archiv.','Archivieren'))return;
  const {data,error}=await sb.from('office_produkte').update({archiviert:!zurueck}).eq('id',e.id).select('*').single();
  if(error){meldung('Das hat nicht geklappt: '+error.message,'warn');return}
  daten.produkte=daten.produkte.map(p=>p.id===e.id?data:p);renderProdukt(data);
}

// ---------- Preis eintragen ----------
function preisDialog(e){
  const projekte=daten.projekte.filter(p=>p.status==='aktiv');
  const form=oeffneDialog(`<form method="dialog" class="pb-form" id="pbPreisForm"><h2>Preis eintragen</h2><p class="meta">${esc(e.name)}</p>
    <div class="pb-felder">
      <label>Art<select name="art" class="pb-input">${Object.entries(PREISARTEN).map(([k,t])=>'<option value="'+k+'">'+esc(t)+'</option>').join('')}</select></label>
      <label>€ netto<input name="betrag" class="pb-input" inputmode="decimal" required placeholder="z. B. 85,50"></label>
      <label>Einheit<select name="einheit" class="pb-input">${EINHEITEN.map(x=>'<option>'+x+'</option>').join('')}</select></label>
      <label>Stand<input name="stand" type="date" class="pb-input"></label>
      <label>Projekt<select name="projekt" class="pb-input"><option value="">—</option>${projekte.map(p=>'<option value="'+esc(p.id)+'">'+esc(projektName(p))+'</option>').join('')}<option value="frei">anderes Projekt …</option></select></label>
      <label>anderes Projekt<input name="projektText" class="pb-input" maxlength="160" placeholder="Projektnummer oder Name"></label>
      <label>Menge<input name="menge" class="pb-input" inputmode="decimal"></label>
      <label>KG<input name="kg" class="pb-input" inputmode="numeric" maxlength="3" placeholder="z. B. 353"></label>
      <label class="breit">Quelle<input name="quelle" class="pb-input" maxlength="300" placeholder="z. B. Angebot Firma, Preisliste S. 4"></label>
      <label class="breit">Kommentar<input name="kommentar" class="pb-input" maxlength="1000"></label>
    </div>
    <p class="pb-banner warn" data-dialog-fehler hidden></p>
    <div class="pb-actions"><button value="speichern" class="btn btn-primary">Speichern</button><button value="abbrechen" class="btn" formnovalidate>Abbrechen</button></div></form>`);
  form.addEventListener('submit',async ev=>{
    if(ev.submitter?.value!=='speichern')return;
    ev.preventDefault();
    const f=new FormData(form),betrag=dezimal(f.get('betrag')),menge=f.get('menge')?dezimal(f.get('menge')):null,kg=String(f.get('kg')||'').trim();
    const fehlerEl=dialog.querySelector('[data-dialog-fehler]');
    if(betrag===null||(f.get('menge')&&menge===null)||(kg&&!/^[1-8]\d\d$/.test(kg))){fehlerEl.textContent='Bitte Betrag, Menge und KG als Zahl angeben.';fehlerEl.hidden=false;return}
    const projektWahl=String(f.get('projekt')||'');
    const zeile={produkt_id:e.id,art:f.get('art'),betrag,einheit:f.get('einheit'),stand:f.get('stand')||null,
      projekt_id:UUID.test(projektWahl)?projektWahl:null,projekt_bezeichnung:projektWahl==='frei'?(String(f.get('projektText')||'').trim().slice(0,160)||null):null,
      menge,kg:kg||null,quelle:String(f.get('quelle')||'').trim().slice(0,300)||null,kommentar:String(f.get('kommentar')||'').trim().slice(0,1000)||null};
    const {data,error}=await sb.from('office_produkt_preise').insert(zeile).select('*').single();
    if(error){fehlerEl.textContent='Nicht gespeichert: '+error.message;fehlerEl.hidden=false;return}
    daten.preise.unshift(data);dialog.close();renderProdukt(e);meldung('Preis eingetragen.','info');
  });
}
function dezimal(t){const v=String(t??'').trim().replace(/\s/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.');
  if(!/^\d{1,12}(\.\d{1,4})?$/.test(v))return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}

// ---------- Zu Projekt ----------
function naechsterCode(projektId,kategorie){
  const kurz=KAT.get(kategorie)?.kurz||'SO';
  const benutzt=new Set(daten.verwendungen.filter(v=>v.projekt_id===projektId&&v.code).map(v=>v.code));
  for(let i=1;i<1000;i++){const c=kurz+'-'+String(i).padStart(2,'0');if(!benutzt.has(c))return c}
  return '';
}
function zuProjekt(e){
  if(!e)return;
  const projekte=eigeneProjekte();
  if(!projekte.length){
    oeffneDialog('<form method="dialog" class="pb-frage"><h2>Zu Projekt</h2><p>In keinem aktiven Projekt bist du im Team oder in der Projektleitung. Die Projektleitung kann dich im Projekt aufnehmen.</p><div class="pb-actions"><button class="btn">Schließen</button></div></form>');
    return;
  }
  const erstes=projekte[0].id;
  const form=oeffneDialog(`<form method="dialog" class="pb-form"><h2>Zu Projekt</h2><p class="meta">${esc(e.name)}</p>
    <div class="pb-felder">
      <label class="breit">Projekt<select name="projekt" class="pb-input">${projekte.map(p=>'<option value="'+esc(p.id)+'">'+esc(projektName(p))+'</option>').join('')}</select></label>
      <label>Code<input name="code" class="pb-input" value="${esc(naechsterCode(erstes,e.kategorie))}" maxlength="8" pattern="[A-Za-z]{1,4}-[0-9]{1,3}" title="z. B. BO-01"></label>
      <label>Stand<select name="status" class="pb-input">${STATI.slice(0,5).map(s=>'<option>'+s+'</option>').join('')}</select></label>
      <label class="breit">Räume<input name="raeume" class="pb-input" maxlength="400" placeholder="z. B. Wohnen, Essen, Flur EG"></label>
      <label>Menge<input name="menge" class="pb-input" inputmode="decimal"></label>
      <label>Einheit<select name="einheit" class="pb-input">${EINHEITEN.map(x=>'<option>'+x+'</option>').join('')}</select></label>
      <label class="breit">Notiz<input name="notiz" class="pb-input" maxlength="1000"></label>
    </div>
    <p class="meta">Der Code verbindet Produkt, Räume in Archicad und Kostenberechnung; je Projekt gibt es ihn einmal.</p>
    <p class="pb-banner warn" data-dialog-fehler hidden></p>
    <div class="pb-actions"><button value="speichern" class="btn btn-primary">Hinzufügen</button><button value="abbrechen" class="btn" formnovalidate>Abbrechen</button></div></form>`);
  form.projekt.addEventListener('change',()=>{form.code.value=naechsterCode(form.projekt.value,e.kategorie)});
  form.addEventListener('submit',async ev=>{
    if(ev.submitter?.value!=='speichern')return;
    ev.preventDefault();
    const f=new FormData(form),fehlerEl=dialog.querySelector('[data-dialog-fehler]');
    const code=String(f.get('code')||'').trim().toUpperCase(),menge=f.get('menge')?dezimal(f.get('menge')):null;
    if((code&&!/^[A-Z]{1,4}-\d{1,3}$/.test(code))||(f.get('menge')&&menge===null)){fehlerEl.textContent='Code wie BO-01 und Menge als Zahl.';fehlerEl.hidden=false;return}
    const {data,error}=await sb.from('office_produkt_verwendungen').insert({produkt_id:e.id,projekt_id:f.get('projekt'),code:code||null,
      status:f.get('status'),raeume:String(f.get('raeume')||'').trim()||null,menge,einheit:menge!==null?f.get('einheit'):null,
      notiz:String(f.get('notiz')||'').trim()||null}).select('*').single();
    if(error){fehlerEl.textContent=error.code==='23505'?'Diesen Code gibt es im Projekt schon.':'Nicht gespeichert: '+error.message;fehlerEl.hidden=false;return}
    daten.verwendungen.unshift(data);dialog.close();
    if(ID)renderProdukt(e);else renderErgebnis();
    meldung('Zum Projekt hinzugefügt: '+[projektName(projekt(data.projekt_id)),data.code].filter(Boolean).join(' · ')+'.','info');
  });
}

// ---------- Datenblatt prüfen und übernehmen ----------
const leser={datei:null,url:'',ergebnis:null,kategorie:'bodenbelag',ziel:null,dokId:null};
function zeigeLeser(){
  root.innerHTML=`<div class="pb-wrap">
    <a class="pb-back" href="./produktbibliothek.html">‹ Produktbibliothek</a>
    <header class="pb-head"><div class="pb-head-text"><p class="kicker">Produktbibliothek · Datenblatt</p><h1>Herstellerdatenblatt hochladen</h1>
      <p class="pb-intro">Romy liest das Dokument und schlägt vor, was die Bibliothek übernehmen kann. Nichts wird gespeichert, bevor du prüfst; jede Angabe nennt ihre Seite, was fehlt, steht als fehlend da.</p></div></header>
    <div class="pb-banner" data-meldung hidden></div>
    <section class="card pb-box pb-wahl">
      <div class="pb-felder">
        <label>Kategorie<select id="pbLeserKat" class="pb-input">${KATEGORIEN.map(([k,,eins])=>'<option value="'+k+'"'+(k===leser.kategorie?' selected':'')+'>'+esc(eins)+'</option>').join('')}</select></label>
        <label class="breit">Datei (PDF oder Bild, für Romy bis 8 MB)<input type="file" id="pbLeserDatei" class="pb-input" accept=".pdf,.jpg,.jpeg,.png,.webp"></label>
      </div>
      <div class="pb-actions"><button type="button" class="btn btn-primary" data-lesen disabled>Romy lesen lassen</button>
        <button type="button" class="btn" data-ohne-lesen disabled>Ohne Lesen von Hand übernehmen</button></div>
    </section>
  </div>`;
  const datei=root.querySelector('#pbLeserDatei'),lesen=root.querySelector('[data-lesen]'),ohne=root.querySelector('[data-ohne-lesen]');
  root.querySelector('#pbLeserKat').addEventListener('change',ev=>{leser.kategorie=ev.target.value});
  datei.addEventListener('change',()=>{
    const f=datei.files?.[0]||null;leser.datei=f;
    if(f&&!MIMES.includes(f.type)){meldung('Bitte ein PDF oder Bild (JPG, PNG, WebP).','warn');lesen.disabled=ohne.disabled=true;return}
    if(f&&f.size>MAX_DATEI){meldung('Die Datei ist größer als 25 MB.','warn');lesen.disabled=ohne.disabled=true;return}
    meldung(f&&f.size>MAX_LESEN?'Größer als 8 MB: Romy kann es nicht lesen, du kannst es aber von Hand übernehmen.':'',f&&f.size>MAX_LESEN?'warn':'info');
    lesen.disabled=!f||f.size>MAX_LESEN;ohne.disabled=!f;
  });
  lesen.addEventListener('click',()=>void lassLesen());
  ohne.addEventListener('click',()=>{leser.ergebnis=leeresErgebnis();renderPruefen()});
}
function leeresErgebnis(){return {erkannt:true,text:'',dokument_art:'datenblatt',seiten:null,
  produkt:{name:'',hersteller:'',serie:'',kategorie:leser.kategorie,familie:'',beschreibung:'',farbe:''},merkmale:[],fehlend:[],preise:[]}}
// Der Leser nimmt Namen bis 180 Zeichen ohne Schrägstriche und Steuerzeichen.
const dateiname=n=>String(n||'').replace(/[\\/\x00-\x1f]/g,'_').trim().slice(0,180)||'Dokument';
const alsDataUrl=f=>new Promise((ok,bad)=>{const r=new FileReader();r.onload=()=>typeof r.result==='string'?ok(r.result):bad(Error('Datei nicht lesbar'));r.onerror=()=>bad(Error('Datei nicht lesbar'));r.readAsDataURL(f)});
async function frageLeser(datei,kategorie){
  const data=await alsDataUrl(datei);
  const {data:antwort,error}=await sb.functions.invoke(FUNKTION,{body:{action:'lesen',kategorie,attachments:[{name:dateiname(datei.name),mime:datei.type,size:datei.size,data}]}});
  if(error||!antwort||antwort.error){
    let grund=antwort?.error||'';
    if(!grund&&error?.context){try{const r=error.context.clone?error.context.clone():error.context;const j=await r.json();grund=typeof j?.error==='string'?j.error:''}catch{}}
    throw Error(FEHLER[grund]||'Der Leser hat nicht geantwortet ('+(grund||'nicht erreichbar')+').');
  }
  if(antwort.version!==LESER_VERSION||antwort.authority!=='none'||!antwort.result)throw Error('Die Antwort des Lesers ist nicht prüfbar.');
  return antwort.result;
}
async function lassLesen(){
  if(!leser.datei)return;
  root.querySelectorAll('button').forEach(b=>b.disabled=true);
  meldung('Romy liest «'+leser.datei.name+'» … das dauert meist unter einer Minute.','info');
  try{
    leser.ergebnis=await frageLeser(leser.datei,leser.kategorie);
    if(!leser.ergebnis.produkt.kategorie)leser.ergebnis.produkt.kategorie=leser.kategorie;
    renderPruefen();
  }catch(e){
    console.error('Leser',e);
    meldung((e?.message||'Der Leser hat nicht geantwortet.')+' Du kannst das Dokument trotzdem von Hand übernehmen.','warn');
    root.querySelectorAll('button').forEach(b=>b.disabled=false);
  }
}
// Ein Dokument, das schon in der Bibliothek liegt, nachträglich lesen: neue Angaben und Preise kommen zum Eintrag dazu.
async function bestehendesLesen(e,dokId){
  const d=daten.dokumente.find(x=>x.id===dokId);if(!d)return;
  meldung('Romy liest «'+d.name+'» …','info');
  try{
    const {data,error}=await sb.storage.from(BUCKET).download(d.storage_path);
    if(error||!data)throw Error('Das Dokument ist gerade nicht erreichbar.');
    if(data.size>MAX_LESEN)throw Error('Größer als 8 MB: Romy kann es nicht lesen.');
    const datei=new File([data],d.name,{type:d.mime_type});
    leser.datei=datei;leser.kategorie=e.kategorie;leser.ziel=e;leser.dokId=d.id;
    leser.ergebnis=await frageLeser(datei,e.kategorie);
    renderPruefen();
  }catch(err){console.error('Leser',err);meldung(err?.message||'Der Leser hat nicht geantwortet.','warn')}
}
function renderPruefen(){
  const r=leser.ergebnis,ziel=leser.ziel,p=r.produkt;
  if(leser.url)URL.revokeObjectURL(leser.url);
  leser.url=leser.datei?URL.createObjectURL(leser.datei):'';
  const istPdf=leser.datei?.type==='application/pdf';
  const familien=[...new Set(daten.produkte.map(x=>x.familie).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
  const aehnlich=p.name?daten.produkte.filter(x=>!x.archiviert&&x.id!==ziel?.id&&(x.name.toLowerCase()===p.name.toLowerCase()||
    (p.hersteller&&x.hersteller&&x.hersteller.toLowerCase()===p.hersteller.toLowerCase()&&x.name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]||'#')))):[];
  const projekte=eigeneProjekte();
  root.innerHTML=`<div class="pb-wrap">
    <a class="pb-back" href="${ziel?'./produktbibliothek.html?id='+esc(ziel.id):'./produktbibliothek.html'}">‹ ${ziel?esc(ziel.name):'Produktbibliothek'}</a>
    <header class="pb-head"><div class="pb-head-text"><p class="kicker">Produktbibliothek · Datenblatt</p>
      <h1>${r.text?'Romy hat das Dokument gelesen':'Dokument von Hand übernehmen'}</h1>
      <p class="pb-intro">${esc(r.text||'Trag ein, was die Bibliothek übernehmen soll. Gespeichert wird erst mit «Prüfen und übernehmen».')}</p></div></header>
    <div class="pb-banner" data-meldung hidden></div>
    ${r.erkannt===false?'<div class="pb-banner warn">Das sieht nicht nach einem Herstellerdokument aus. Du kannst es trotzdem von Hand übernehmen.</div>':''}
    <div class="pb-cols">
      <section class="card pb-box pb-vorschau" aria-label="Dokument">
        <p class="pb-dateiname">${esc(leser.datei?.name||'')}</p>
        ${leser.url?(istPdf?'<iframe title="Dokument" src="'+esc(leser.url)+'" data-vorschau></iframe>':'<img src="'+esc(leser.url)+'" alt="Hochgeladenes Dokument">'):''}
      </section>
      <form class="pb-main pb-pruefen" id="pbPruefen">
        <section class="card pb-box"><div class="pb-box-kopf"><h2 class="pb-h2">Erkannte Angaben</h2><p class="meta">Haken entfernen, was nicht stimmt; Werte lassen sich ändern</p></div>
          <div class="pb-merkmal-liste">${(r.merkmale.length?r.merkmale:[{feld:'',wert:'',seite:null}]).map((m,i)=>merkmalZeile(m,i,istPdf)).join('')}</div>
          <button type="button" class="btn btn-quiet" data-merkmal-neu>Angabe hinzufügen</button>
        </section>
        ${r.fehlend.length?'<section class="card pb-box pb-fehlt-box"><h2 class="pb-h2">Nicht im Dokument</h2><p>'+esc(r.fehlend.join(' · '))+'</p></section>':''}
        <section class="card pb-box"><h2 class="pb-h2">Preise aus dem Dokument</h2>
          ${r.preise.length?r.preise.map((x,i)=>preisZeile(x,i)).join(''):'<p class="meta">Das Dokument nennt keinen Preis.</p>'}
          <p class="meta">Ein Listenpreis ist kein eingebauter Preis: Kleber, Verlegen und Zubehör kommen aus dem Element der Kostenberechnung.</p>
        </section>
        <section class="card pb-box"><h2 class="pb-h2">${ziel?'Eintrag':'Zuordnung'}</h2>
          ${ziel?'<p>Neue Angaben und Preise kommen zu «'+esc(ziel.name)+'» dazu; vorhandene Angaben mit demselben Namen werden ersetzt.</p>':`
          <div class="pb-felder">
            <label>Typ<select name="typ" class="pb-input"><option value="produkt">Produkt</option><option value="leistung">Leistung, kein Produkt</option></select></label>
            <label>Kategorie<select name="kategorie" class="pb-input">${KATEGORIEN.map(([k,,eins])=>'<option value="'+k+'"'+(k===(p.kategorie||leser.kategorie)?' selected':'')+'>'+esc(eins)+'</option>').join('')}</select></label>
            <label class="breit">Name<input name="name" class="pb-input" required maxlength="200" value="${esc(p.name)}"></label>
            <label>Hersteller<input name="hersteller" class="pb-input" maxlength="160" value="${esc(p.hersteller)}"></label>
            <label>Serie<input name="serie" class="pb-input" maxlength="160" value="${esc(p.serie)}"></label>
            <label class="breit">Familie (Element der Kostenberechnung)<input name="familie" class="pb-input" maxlength="160" list="pbFamilien" value="${esc(p.familie)}" placeholder="z. B. Parkett, vollflächig geklebt"></label>
            <label class="breit">Beschreibung<input name="beschreibung" class="pb-input" maxlength="600" value="${esc(p.beschreibung)}"></label>
            <label>Farbe der Karte<input name="farbe" type="color" class="pb-input pb-farbe" value="${esc(p.farbe||'#d9d3c5')}"></label>
            <label>Dokument<select name="dokart" class="pb-input">${Object.entries(DOKARTEN).filter(([k])=>k!=='bild').map(([k,t])=>'<option value="'+k+'"'+(k===r.dokument_art?' selected':'')+'>'+esc(t)+'</option>').join('')}</select></label>
          </div>
          <datalist id="pbFamilien">${familien.map(f=>'<option value="'+esc(f)+'"></option>').join('')}</datalist>
          ${aehnlich.length?'<p class="pb-warn">Ähnlich in der Bibliothek: '+aehnlich.map(x=>'<a href="./produktbibliothek.html?id='+esc(x.id)+'">'+esc(x.name)+'</a>').join(', ')+'. Vielleicht gehört das Dokument dorthin.</p>':'<p class="meta">In der Bibliothek gibt es dieses Produkt noch nicht.</p>'}
          ${projekte.length?`<div class="pb-felder"><label class="breit">Gleich in ein Projekt (optional)<select name="projekt" class="pb-input"><option value="">kein Projekt</option>${projekte.map(x=>'<option value="'+esc(x.id)+'">'+esc(projektName(x))+'</option>').join('')}</select></label>
            <label>Code<input name="code" class="pb-input" maxlength="8" placeholder="z. B. BO-01"></label></div>`:''}`}
        </section>
        <div class="pb-actions"><button type="submit" class="btn btn-primary">Prüfen und übernehmen</button>
          <a class="btn" href="${ziel?'./produktbibliothek.html?id='+esc(ziel.id):'./produktbibliothek.html'}">Verwerfen</a></div>
      </form>
    </div>
  </div>`;
  const form=root.querySelector('#pbPruefen');
  root.querySelector('[data-merkmal-neu]').addEventListener('click',()=>{
    const liste=root.querySelector('.pb-merkmal-liste'),i=liste.children.length;
    liste.insertAdjacentHTML('beforeend',merkmalZeile({feld:'',wert:'',seite:null},i,istPdf));
  });
  root.addEventListener('click',zeigeSeite);
  if(form.projekt)form.projekt.addEventListener('change',()=>{form.code.value=form.projekt.value?naechsterCode(form.projekt.value,form.kategorie.value):''});
  form.addEventListener('submit',ev=>{ev.preventDefault();void uebernehmen(form)});
}
// Ein Klick auf «S. 4» blättert die Vorschau auf die Seite, die der Leser genannt hat (gleiche Funktion: nur einmal gebunden).
function zeigeSeite(ev){
  const b=ev.target.closest?.('[data-zeige-seite]');if(!b)return;
  const f=root.querySelector('[data-vorschau]');if(f&&leser.url)f.src=leser.url+'#page='+Number(b.dataset.zeigeSeite);
}
function merkmalZeile(m,i,istPdf){
  return `<div class="pb-merkmal"><input type="checkbox" id="mk${i}" name="mk_an_${i}" ${m.feld||m.wert?'checked':''} aria-label="Übernehmen">
    <label class="sr" for="mf${i}">Feld</label><input id="mf${i}" name="mk_feld_${i}" class="pb-input" maxlength="60" value="${esc(m.feld)}" placeholder="Feld">
    <label class="sr" for="mw${i}">Wert</label><input id="mw${i}" name="mk_wert_${i}" class="pb-input" maxlength="200" value="${esc(m.wert)}" placeholder="Wert">
    <label class="sr" for="ms${i}">Seite</label><input id="ms${i}" name="mk_seite_${i}" class="pb-input pb-kurz" inputmode="numeric" maxlength="4" value="${m.seite||''}" placeholder="S.">
    ${m.seite&&istPdf?'<button type="button" class="pb-seite" data-zeige-seite="'+Number(m.seite)+'">S. '+Number(m.seite)+'</button>':''}</div>`;
}
function preisZeile(x,i){
  return `<div class="pb-merkmal pb-preiszeile"><input type="checkbox" id="pr${i}" name="pr_an_${i}" checked aria-label="Preis übernehmen">
    <label class="sr" for="pa${i}">Art</label><select id="pa${i}" name="pr_art_${i}" class="pb-input">${Object.entries(PREISARTEN).filter(([k])=>k!=='ansatz_kobe'&&k!=='abrechnung').map(([k,t])=>'<option value="'+k+'"'+(k===x.art?' selected':'')+'>'+esc(t)+'</option>').join('')}</select>
    <label class="sr" for="pw${i}">Betrag</label><input id="pw${i}" name="pr_betrag_${i}" class="pb-input pb-kurz" inputmode="decimal" value="${esc(String(x.betrag).replace('.',','))}">
    <label class="sr" for="pe${i}">Einheit</label><select id="pe${i}" name="pr_einheit_${i}" class="pb-input pb-kurz">${EINHEITEN.map(u=>'<option'+(u===x.einheit?' selected':'')+'>'+u+'</option>').join('')}</select>
    <label class="sr" for="ps${i}">Stand</label><input id="ps${i}" name="pr_stand_${i}" type="date" class="pb-input" value="${esc(x.stand||'')}">
    <input type="hidden" name="pr_seite_${i}" value="${x.seite||''}"><input type="hidden" name="pr_bezug_${i}" value="${esc(x.bezug||'')}">
    <span class="meta">${esc([x.seite?'S. '+x.seite:'',x.bezug].filter(Boolean).join(' · '))}</span></div>`;
}
async function uebernehmen(form){
  const f=new FormData(form),ziel=leser.ziel,r=leser.ergebnis;
  const knopf=form.querySelector('[type="submit"]');knopf.disabled=true;
  const merkmale=[],gesehen=new Set();
  for(let i=0;f.has('mk_feld_'+i);i++){
    if(!f.get('mk_an_'+i))continue;
    const feld=String(f.get('mk_feld_'+i)||'').trim().slice(0,60),wert=String(f.get('mk_wert_'+i)||'').trim().slice(0,200);
    const seite=Number(f.get('mk_seite_'+i));
    if(!feld||!wert||gesehen.has(feld.toLowerCase()))continue;
    gesehen.add(feld.toLowerCase());merkmale.push({feld,wert,seite:Number.isInteger(seite)&&seite>=1&&seite<=2000?seite:null});
  }
  const preise=[];
  for(let i=0;f.has('pr_betrag_'+i);i++){
    if(!f.get('pr_an_'+i))continue;
    const betrag=dezimal(f.get('pr_betrag_'+i));if(betrag===null)continue;
    const seite=Number(f.get('pr_seite_'+i));
    preise.push({art:f.get('pr_art_'+i),betrag,einheit:f.get('pr_einheit_'+i),stand:f.get('pr_stand_'+i)||null,
      seite:Number.isInteger(seite)&&seite>=1&&seite<=2000?seite:null,bezug:String(f.get('pr_bezug_'+i)||'').trim()});
  }
  try{
    let eintrag=ziel,dokId=leser.dokId;
    const fehlend=(r.fehlend||[]).filter(x=>!gesehen.has(String(x).toLowerCase())).slice(0,20);
    if(!eintrag){
      const name=String(f.get('name')||'').trim();
      if(!name)throw Error('Bitte einen Namen angeben.');
      const {data,error}=await sb.from('office_produkte').insert({typ:f.get('typ'),kategorie:f.get('kategorie'),name:name.slice(0,200),
        hersteller:String(f.get('hersteller')||'').trim()||null,serie:String(f.get('serie')||'').trim()||null,
        familie:String(f.get('familie')||'').trim()||null,beschreibung:String(f.get('beschreibung')||'').trim()||null,
        farbe:/^#[0-9a-f]{6}$/i.test(String(f.get('farbe')||''))?String(f.get('farbe')):null,
        merkmale,fehlend,status:'geprueft'}).select('*').single();
      if(error)throw error;
      eintrag=data;
    }else{
      // Vorhandene Angaben mit demselben Feldnamen ersetzen, neue dazunehmen.
      const neu=new Map((eintrag.merkmale||[]).map(m=>[String(m.feld).toLowerCase(),m]));
      for(const m of merkmale)neu.set(m.feld.toLowerCase(),{...m,dokument_id:dokId});
      const alleFehlend=[...new Set([...(eintrag.fehlend||[]),...fehlend])].filter(x=>!neu.has(String(x).toLowerCase())).slice(0,20);
      const {data,error}=await sb.from('office_produkte').update({merkmale:[...neu.values()].slice(0,40),fehlend:alleFehlend}).eq('id',eintrag.id).select('*').single();
      if(error)throw error;
      eintrag=data;
    }
    if(leser.datei&&!dokId){
      const d=await speichereDokument(eintrag.id,leser.datei,String(f.get('dokart')||r.dokument_art||'datenblatt'),r.seiten,!!r.text);
      dokId=d.id;
      // Merkmale verweisen auf das gespeicherte Dokument.
      const mitDok=(eintrag.merkmale||[]).map(m=>({...m,dokument_id:m.seite?d.id:null}));
      const {error:dokErr}=await sb.from('office_produkte').update({merkmale:mitDok}).eq('id',eintrag.id);
      if(dokErr)console.warn('Merkmale ohne Dokumentverweis',dokErr);
    }else if(dokId){
      await sb.from('office_produkt_dokumente').update({gelesen_am:new Date().toISOString(),seiten:r.seiten||null}).eq('id',dokId);
    }
    if(preise.length){
      const {error}=await sb.from('office_produkt_preise').insert(preise.map(x=>({produkt_id:eintrag.id,art:x.art,betrag:x.betrag,einheit:x.einheit,
        stand:x.stand,seite:x.seite,dokument_id:dokId||null,quelle:String(leser.datei?.name||'Dokument').slice(0,300),
        kommentar:x.bezug?x.bezug.slice(0,1000):null})));
      if(error)throw error;
    }
    const projektId=f.get('projekt');
    if(projektId&&UUID.test(String(projektId))){
      const code=String(f.get('code')||'').trim().toUpperCase();
      const {error}=await sb.from('office_produkt_verwendungen').insert({produkt_id:eintrag.id,projekt_id:projektId,code:/^[A-Z]{1,4}-\d{1,3}$/.test(code)?code:null});
      if(error)console.warn('Verwendung',error);
    }
    location.href='./produktbibliothek.html?id='+encodeURIComponent(eintrag.id);
  }catch(e){
    console.error('Übernehmen',e);knopf.disabled=false;
    meldung('Nicht übernommen: '+(e?.message||e),'warn');window.scrollTo({top:0,behavior:'smooth'});
  }
}

// ---------- Von Hand anlegen und bearbeiten ----------
function zeigeFormular(e){
  const familien=[...new Set(daten.produkte.map(x=>x.familie).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
  const m=(e?.merkmale||[]).filter(x=>x&&x.feld);
  root.innerHTML=`<div class="pb-wrap">
    <a class="pb-back" href="${e?'./produktbibliothek.html?id='+esc(e.id):'./produktbibliothek.html'}">‹ ${e?esc(e.name):'Produktbibliothek'}</a>
    <header class="pb-head"><div class="pb-head-text"><p class="kicker">Produktbibliothek</p><h1>${e?'Eintrag bearbeiten':'Von Hand anlegen'}</h1>
      <p class="pb-intro">${e?'Änderungen gelten für die ganze Bibliothek.':'Für ein Produkt ohne Datenblatt oder eine Leistung ohne Produkt, etwa einen Heizestrich.'}</p></div></header>
    <div class="pb-banner" data-meldung hidden></div>
    <form class="card pb-box" id="pbFormular">
      <div class="pb-felder">
        <label>Typ<select name="typ" class="pb-input"><option value="produkt"${e?.typ!=='leistung'?' selected':''}>Produkt</option><option value="leistung"${e?.typ==='leistung'?' selected':''}>Leistung, kein Produkt</option></select></label>
        <label>Kategorie<select name="kategorie" class="pb-input">${KATEGORIEN.map(([k,,eins])=>'<option value="'+k+'"'+(k===(e?.kategorie||'bodenbelag')?' selected':'')+'>'+esc(eins)+'</option>').join('')}</select></label>
        <label class="breit">Name<input name="name" class="pb-input" required maxlength="200" value="${esc(e?.name||'')}"></label>
        <label>Hersteller<input name="hersteller" class="pb-input" maxlength="160" value="${esc(e?.hersteller||'')}"></label>
        <label>Serie<input name="serie" class="pb-input" maxlength="160" value="${esc(e?.serie||'')}"></label>
        <label class="breit">Familie (Element der Kostenberechnung)<input name="familie" class="pb-input" maxlength="160" list="pbFamilien" value="${esc(e?.familie||'')}"></label>
        <label class="breit">Beschreibung<input name="beschreibung" class="pb-input" maxlength="4000" value="${esc(e?.beschreibung||'')}"></label>
        <label class="breit">Link zur Herstellerseite<input name="quelle_url" class="pb-input" type="url" maxlength="600" pattern="https://.*" value="${esc(e?.quelle_url||'')}" placeholder="https://…"></label>
        <label>Farbe der Karte<input name="farbe" type="color" class="pb-input pb-farbe" value="${esc(e?.farbe||'#d9d3c5')}"></label>
        <label>Status<select name="status" class="pb-input"><option value="entwurf"${e?.status!=='geprueft'?' selected':''}>Entwurf</option><option value="geprueft"${e?.status==='geprueft'?' selected':''}>geprüft</option></select></label>
        <label class="pb-check"><input type="checkbox" name="bestand"${e?.bestand?' checked':''}> Leistung im Bestand</label>
      </div>
      <datalist id="pbFamilien">${familien.map(f=>'<option value="'+esc(f)+'"></option>').join('')}</datalist>
      <h2 class="pb-h2">Technische Daten</h2>
      <div class="pb-merkmal-liste">${(m.length?m:[{feld:'',wert:'',seite:null}]).map((x,i)=>merkmalZeile(x,i,false)).join('')}</div>
      <button type="button" class="btn btn-quiet" data-merkmal-neu>Angabe hinzufügen</button>
      <div class="pb-actions"><button type="submit" class="btn btn-primary">Speichern</button>
        <a class="btn" href="${e?'./produktbibliothek.html?id='+esc(e.id):'./produktbibliothek.html'}">Abbrechen</a></div>
    </form>
  </div>`;
  const form=root.querySelector('#pbFormular');
  root.querySelector('[data-merkmal-neu]').addEventListener('click',()=>{const l=root.querySelector('.pb-merkmal-liste');l.insertAdjacentHTML('beforeend',merkmalZeile({feld:'',wert:'',seite:null},l.children.length,false))});
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();
    const f=new FormData(form),knopf=form.querySelector('[type="submit"]');knopf.disabled=true;
    const merkmale=[],gesehen=new Set(),alt=new Map((e?.merkmale||[]).map(x=>[String(x.feld).toLowerCase(),x]));
    for(let i=0;f.has('mk_feld_'+i);i++){
      if(!f.get('mk_an_'+i))continue;
      const feld=String(f.get('mk_feld_'+i)||'').trim().slice(0,60),wert=String(f.get('mk_wert_'+i)||'').trim().slice(0,200),seite=Number(f.get('mk_seite_'+i));
      if(!feld||!wert||gesehen.has(feld.toLowerCase()))continue;
      gesehen.add(feld.toLowerCase());
      merkmale.push({feld,wert,seite:Number.isInteger(seite)&&seite>=1&&seite<=2000?seite:null,dokument_id:alt.get(feld.toLowerCase())?.dokument_id||null});
    }
    const url=String(f.get('quelle_url')||'').trim();
    const zeile={typ:f.get('typ'),kategorie:f.get('kategorie'),name:String(f.get('name')||'').trim().slice(0,200),
      hersteller:String(f.get('hersteller')||'').trim()||null,serie:String(f.get('serie')||'').trim()||null,familie:String(f.get('familie')||'').trim()||null,
      beschreibung:String(f.get('beschreibung')||'').trim()||null,quelle_url:/^https:\/\//.test(url)?url:null,
      farbe:/^#[0-9a-f]{6}$/i.test(String(f.get('farbe')||''))?String(f.get('farbe')):null,status:f.get('status'),bestand:!!f.get('bestand'),merkmale,
      fehlend:(e?.fehlend||[]).filter(x=>!gesehen.has(String(x).toLowerCase()))};
    const q=e?sb.from('office_produkte').update(zeile).eq('id',e.id):sb.from('office_produkte').insert(zeile);
    const {data,error}=await q.select('*').single();
    if(error){knopf.disabled=false;meldung('Nicht gespeichert: '+error.message,'warn');return}
    location.href='./produktbibliothek.html?id='+encodeURIComponent(data.id);
  });
}

const ICON_HOCH='<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 11V2.5M4.5 6 8 2.5 11.5 6M2.5 11.5v2h11v-2"/></svg>';
window.TBA_PRODUKTBIBLIOTHEK={preisBild,uebernommen,quellenZahl,dezimal,naechsterCode};
void start();
})();
