/* TBA Office · Kostenberechnung (21.11.2026, Claude, Auftrag Gari: den Entwurf als Werkzeug im Office umsetzen).
   Oberfläche nach dem Entwurf vom 21.11.: oben die Antwort (Summe, Abweichung, was fehlt), darunter die
   Gliederung nach DIN 276 bis zur 3. Ebene; jede Kostengruppe ist sichtbar und hat einen Stand, jede Zahl
   zeigt ihre Herkunft. Daten wie beim Terminplan: Muster → Projekt-Kostenberechnung (JSON-Stand, bedingtes
   Speichern über server_revision) → Stände. Rechnen: kosten-rechnen.js. Archicad-Import: kosten-import.js.
   23.11.2026: Kostenarchiv (alte Kostenberechnungen des Büros, nur lesen) und Datenpool «Kennwert aus eigenen
   Projekten» in den Details einer Position (kosten-pool.js): Werte mit Herkunft, gleiche Werte zählen einmal. */
(()=>{
'use strict';
const R=window.TBA_KOSTEN_RECHNEN,I=window.TBA_KOSTEN_IMPORT,A=window.TBA_KOSTEN_ASSISTENT,P=window.TBA_KOSTEN_POOL,OFFICE=window.TBA_OFFICE_CONFIG;
const sb=window.MINDS_SUPABASE||(window.supabase&&OFFICE?window.supabase.createClient(OFFICE.url,OFFICE.key,
  {auth:{storageKey:OFFICE.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null);
const inApp=!!window.WINDOW_NATIVE?.available;
// Als Reiter in Work (Rahmen, 24.11.2026): ohne Rücksprung-Link, und die Seite springt nie zur Startseite oder in die
// App (das hieße die App in der App). Work bekommt Bescheid, wenn das Anlegen abgebrochen wird.
const IM_REITER=window.self!==window.top;
const params=new URLSearchParams(location.search);
const ID=params.get('id'),MUSTER_ID=params.get('muster');
// ?neu=<Projekt-ID>: aus dem Reiter «Kostenberechnung» eines Projekts ohne Kostenberechnung (Work), mit diesem Projekt.
const NEU=params.get('neu');
const root=document.getElementById('kb'),dialog=document.getElementById('kbDialog');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const datum=iso=>{const d=new Date(iso);return Number.isFinite(d.getTime())?d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}):''};
const heuteIso=()=>new Date().toISOString().slice(0,10);
const ICON_IMPORT='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
const ICON_PLUS='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
const ANLEITUNG='<a class="btn btn-quiet" href="./kostenberechnung-hilfe.html" target="_blank" rel="noopener noreferrer">Anleitung</a>';
// Klassifizierung für den Klassifizierungs-Manager von Archicad, aus der Gliederung dieser Kostenberechnung (Anleitung, Teil III).
const KNOPF_KLASSIFIZIERUNG='<button type="button" class="btn btn-quiet" data-act="klassifizierung">Klassifizierung für Archicad (.xml)</button>';
const TABS=[['uebersicht','Übersicht'],['positionen','Positionen'],['quellen','Quellen'],['vergleich','Vergleich'],['bericht','Bericht']];
const KG_MUSTER=/^[1-8]\d\d$/;

let nutzer=null,mitglied=null,doc=null,st=null,calc=null,baum=null,istMuster=false,istArchiv=false,kannBearbeiten=false;
// Datenpool: alle anderen Kostenberechnungen des Büros, beim ersten Öffnen geladen (lesen darf das ganze Office).
let poolDaten=null,poolLaedt=null,poolTimer=0;
// Ansicht je Browser merken (Gliederung, Zeilenhöhe, Spaltenbreiten); fehlt der Speicher, gelten die Vorgaben.
const PREFS_KEY='tba.office.kostenberechnung.ansicht';
function ladePrefs(){try{return JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')||{}}catch{return {}}}
const PREFS=ladePrefs();
const ui={tab:'uebersicht',offen:new Set(['300']),filter:'300',auswahl:null,kgAuswahl:null,elAuswahl:null,brutto:false,loeschen:null,staende:null,importVorschau:null,meldung:'',markiert:new Set(),pool:null,poolGruppen:null,
  sicht:PREFS.sicht==='gewerke'?'gewerke':'kg',zeilen:PREFS.zeilen==='kompakt'?'kompakt':'voll',breiteBez:Number(PREFS.bez)||null,breiteKom:Number(PREFS.kom)||null};
function merkePrefs(){try{localStorage.setItem(PREFS_KEY,JSON.stringify({sicht:ui.sicht,zeilen:ui.zeilen,bez:ui.breiteBez,kom:ui.breiteKom}))}catch{}}
let serverRevision=0,speichernTimer=null,laeuft=false,ausstehend=false,konflikt=false,speicherText='';

// Kostenstand ist der Zeitpunkt der Ermittlung (DIN 276): wählbar bis zum laufenden Quartal, nicht in die Zukunft
// (Gari, 24.11.2026). Für das laufende Quartal ist der Baupreisindex meist noch nicht veröffentlicht; dann schreibt
// die Kostenberechnung bis zum letzten Wert fort und sagt es. Ein schon gespeicherter Wert bleibt wählbar.
function quartale(mit=''){
  const jetzt=new Date(),j0=jetzt.getFullYear(),q0=Math.floor(jetzt.getMonth()/3)+1,aus=[];
  for(let j=j0;j>=2018;j--)for(let q=4;q>=1;q--)if(j<j0||q<=q0)aus.push(j+'-Q'+q);
  if(mit&&R.quartalIndex(mit)!==null&&!aus.includes(mit))aus.unshift(mit);
  return aus;
}
// Vom Muster vorbelegt (24.11.2026): ein «entfällt», das so aus dem Muster kommt, zählt nicht als geklärt, bis man die
// Kostengruppe für das Projekt bearbeitet oder bestätigt (kosten-rechnen.js). Neue Kostenberechnungen tragen die Marke
// ab dem Anlegen; ältere bekommen sie beim Laden, wo der Eintrag noch genau dem Muster entspricht.
function markiereVorbelegt(stand,musterGruppen){
  for(const [kg,g] of Object.entries(stand?.gruppen||{})){
    const m=musterGruppen?.[kg];
    if(g&&g.vorbelegt===undefined&&g.status==='entfaellt'&&m?.status==='entfaellt'&&String(m.notiz||'')===String(g.notiz||''))g.vorbelegt=true;
  }
  return stand;
}
function letzterIndex(){return (st?.indizes||[]).filter(x=>Number(R.dezimal(x.wert))>0&&R.quartalIndex(x.quartal)!==null).map(x=>x.quartal).sort((a,b)=>R.quartalIndex(a)-R.quartalIndex(b)).pop()||''}
function aktuellesQuartal(){const d=new Date();return d.getFullYear()+'-Q'+(Math.floor(d.getMonth()/3)+1)}
const titel=kg=>R.katalogTitel(st,kg);
const kgName=kg=>'KG '+kg+(titel(kg)?' '+titel(kg):'');
function ustVon(cent){return R.teile(BigInt(cent)*R.mikro(R.dezimal(st.ustProzent)??'19'),100n*1000000n)}
function anzeigeCent(cent){if(cent===null||cent===undefined)return null;return ui.brutto?BigInt(cent)+ustVon(cent):BigInt(cent)}
const betrag=(cent,o)=>R.euro(anzeigeCent(cent),o);

// ---------- Start ----------
function fehler(text){root.innerHTML='<div class="kb-wrap"><a class="kb-back" href="./app/#section=tools">‹ Werkzeuge</a><div class="kb-banner warn">'+esc(text)+'</div></div>'}
async function start(){
  if(!sb||!R||!I){fehler('Office-Verbindung nicht verfügbar.');return}
  const {data,error}=await sb.auth.getSession();
  const session=data?.session;
  if(error||!session){if(inApp){void window.WINDOW_NATIVE.call('session.signIn');fehler('Bitte in der App anmelden.');return}
    if(IM_REITER){fehler('Bitte in TBA Office neu anmelden.');return}
    location.href='./';return}
  nutzer=session.user;
  const {data:m,error:me}=await sb.from('office_members').select('role,display_name,is_active,must_change_password')
    .eq('user_id',nutzer.id).eq('is_active',true).maybeSingle();
  if(me||!m){fehler('Kein Zugriff auf TBA Office.');return}
  if(m.must_change_password){if(inApp||IM_REITER){fehler('Bitte zuerst im Browser auf tbarchitekten.github.io das Startpasswort ändern.');return}location.href='./';return}
  mitglied=m;
  try{
    if(ID)await ladeKostenberechnung(ID);
    else if(MUSTER_ID)await ladeMuster(MUSTER_ID);
    else if(NEU&&IM_REITER){
      await ladeListe();history.replaceState(null,'',location.pathname);
      root.innerHTML='<div class="kb-wrap"><p class="meta">Neue Kostenberechnung …</p></div>';dialogNeu(NEU);
    }
    else{await zeigeListe();if(NEU){history.replaceState(null,'',location.pathname);dialogNeu(NEU)}}
  }catch(e){console.error('Kostenberechnung',e);fehler(e?.message||'Kostenberechnung nicht erreichbar.')}
}

// ---------- Liste ----------
let listeDaten=null;
async function ladeListe(){
  const [tp,ins,pr,pm,ar]=await Promise.all([
    sb.from('office_kosten_templates').select('id,title,version,norm,status,description,updated_at,state').eq('is_active',true).order('title'),
    sb.from('office_kosten_instances').select('id,project_id,project_number,project_name,phase,template_id,updated_at,state').eq('is_archived',false).order('updated_at',{ascending:false}).limit(200),
    sb.from('office_projects').select('id,number,name,status,projektleiter_id').order('number').limit(250),
    sb.from('office_project_members').select('project_id').eq('user_id',nutzer.id).limit(500),
    sb.from('office_kosten_instances').select('id,project_id,project_number,project_name,phase,updated_at,is_archived,state').eq('is_archived',true).order('project_number').limit(100)
  ]);
  const err=tp.error||ins.error||pr.error||pm.error||ar.error;if(err)throw err;
  const team=new Set((pm.data||[]).map(x=>x.project_id));
  const projekte=(pr.data||[]).filter(p=>p.status==='aktiv'&&(mitglied.role==='admin'||p.projektleiter_id===nutzer.id||team.has(p.id)));
  listeDaten={muster:tp.data||[],instanzen:ins.data||[],projekte,archiv:ar.data||[]};
  const musterGruppen=new Map(listeDaten.muster.map(t=>[t.id,t.state?.gruppen]));
  for(const i of listeDaten.instanzen)if(i.template_id&&i.state)markiereVorbelegt(i.state,musterGruppen.get(i.template_id));
}
async function zeigeListe(){
  await ladeListe();
  const karten=listeDaten.muster.map(t=>'<article class="card"><span class="nr">Muster · '+esc(t.norm)+'</span><h2>'+esc(t.title)+'</h2>'+
    '<p class="meta">Version '+esc(t.version)+' · '+esc(t.status)+' · schreibgeschützt</p><p class="meta">'+esc(t.description)+'</p>'+
    '<div class="acts"><a class="btn" href="./kostenberechnung.html?muster='+encodeURIComponent(t.id)+'">Muster ansehen</a></div></article>').join('')
    ||'<p class="meta">Kein aktives Muster vorhanden.</p>';
  const instanzen=listeDaten.instanzen.map(i=>{
    let summe='',stand='';
    try{const e=R.berechne(i.state);summe=R.euro(e.gesamt.bekanntCent)+' netto';stand=e.gesamt.vollstaendig?'vollständig':e.vollstaendigkeit.prozent+' % geklärt'}catch{summe='Stand nicht lesbar'}
    return '<article class="card"><span class="nr">'+esc(i.project_number)+' · '+esc(i.phase)+'</span><h2>'+esc(i.project_name)+'</h2>'+
      '<p class="meta">'+esc(summe)+(stand?' · '+esc(stand):'')+'</p><p class="meta">Zuletzt geändert: '+esc(datum(i.updated_at))+'</p>'+
      '<div class="acts"><a class="btn btn-primary" href="./kostenberechnung.html?id='+encodeURIComponent(i.id)+'">Öffnen</a></div></article>';
  }).join('')||'<p class="meta">Noch keine Kostenberechnung angelegt.</p>';
  root.innerHTML='<div class="kb-wrap"><a class="kb-back" href="./app/#section=tools">‹ Werkzeuge</a>'+
    '<header class="kb-head"><div class="kb-head-text"><p class="kicker">Office · Kostenberechnung</p><h1>Kostenberechnungen</h1>'+
    '<p class="kb-intro">Muster nach DIN 276:2018-12 bis zur 3. Ebene übernehmen, Mengen aus Archicad und Beiträge der Fachplanung zusammenführen und mit der Kostenschätzung vergleichen.</p></div>'+
    '<div class="kb-actions">'+ANLEITUNG+(listeDaten.projekte.length&&listeDaten.muster.length?'<button type="button" class="btn btn-primary" data-act="neu">'+ICON_PLUS+'Kostenberechnung anlegen</button>':'')+'</div>'+
    '</header><h2 class="lib">Muster · nur Ansicht</h2><div class="liste">'+karten+'</div>'+
    '<h2 class="lib">Projekt-Kostenberechnungen</h2><div class="liste">'+instanzen+'</div>'+kostenarchiv(listeDaten.archiv)+
    '<p class="meta" style="margin-top:22px"><a href="./kostenberechnung-hilfe.html" target="_blank" rel="noopener noreferrer">Anleitung zur Kostenberechnung · Ablauf, Archicad, Kennwerte und Bericht</a></p></div>';
}
// ---------- Kostenarchiv ----------
// Alte Kostenberechnungen des Büros, als archivierte Projekte angelegt und nur zu lesen. Ihre Positionen sind der Datenpool.
const HERKUNFT_REIHE=['angebot','fachplanung','bki','eigen','abgerechnet','geschaetzt','ohne'];
const euroEp=(cent,eh)=>cent===null||cent===undefined?'–':R.euro(cent,{nachkomma:true})+(eh?'/'+eh:'');
function reifegradText(r){return r==='feststellung'?'abgerechnet':r==='laufend'?'laufende Kostenberechnung':(P?.REIFEGRAD[r]||'Kostenberechnung')+', keine Abrechnung'}
function herkunftBalken(h){
  const summe=HERKUNFT_REIHE.reduce((s,k)=>s+(h[k]||0),0)||1;
  return '<span class="hk-bar" aria-hidden="true">'+HERKUNFT_REIHE.filter(k=>h[k]).map(k=>'<span class="hk-'+k+'" style="width:'+(100*h[k]/summe).toFixed(1)+'%"></span>').join('')+'</span>'+
    '<span class="meta">'+HERKUNFT_REIHE.filter(k=>h[k]).map(k=>esc(P.HERKUNFT[k])+' '+h[k]).join(' · ')+'</span>';
}
function kostenarchiv(liste){
  if(!P||!liste?.length)return '';
  const zeilen=P.archivZeilen(liste,R);
  const e=P.eintraege(liste,R),kopien=P.uebernommen(e),auff=P.auffaellig(e);
  const tabelle='<section class="card archiv-karte"><div class="tbl"><table class="kb-table archiv-tab"><thead><tr><th>Projekt</th><th>Gebäude</th><th>Stand</th>'+
    '<th class="num">KG 300 netto</th><th class="num">je m² BGF</th><th class="num">Positionen</th><th>Herkunft der Preise</th><th></th></tr></thead><tbody>'+
    zeilen.map(z=>'<tr><td><strong>'+esc(z.nr)+'</strong><br><span class="meta">'+esc(z.name)+'</span></td>'+
      '<td>'+esc(z.gebaeude||'–')+'<br><span class="meta">'+esc([z.bauweise,z.massnahme].filter(Boolean).join(' · '))+'</span></td>'+
      '<td>'+esc(z.dokument||'–')+'<br><span class="meta">'+esc(reifegradText(z.reifegrad))+'</span></td>'+
      '<td class="num">'+R.euro(z.kg300Cent)+'</td><td class="num">'+(z.jeBgfCent!==null?R.euro(z.jeBgfCent):'<span class="meta">BGF fehlt</span>')+'</td>'+
      '<td class="num">'+z.positionen+(z.inSumme<z.positionen?'<br><span class="meta">'+z.inSumme+' in der Summe</span>':'')+'</td>'+
      '<td class="hk">'+herkunftBalken(z.herkunft)+'</td>'+
      '<td><a class="btn" href="./kostenberechnung.html?id='+encodeURIComponent(z.id)+'">Öffnen</a></td></tr>').join('')+
    '</tbody></table></div></section>';
  const mitBgf=zeilen.filter(z=>z.jeBgfCent!==null).sort((a,b)=>(a.jeBgfCent<b.jeBgfCent?-1:1));
  const maxBgf=mitBgf.reduce((m,z)=>z.jeBgfCent>m?z.jeBgfCent:m,1n);
  const karteBgf='<section class="card archiv-k"><h2 class="kb-h2">KG 300 je m² BGF</h2>'+mitBgf.map(z=>'<div class="mini"><span>'+esc(z.nr)+' <span class="meta">'+esc(z.gebaeude)+'</span></span><span class="num">'+R.euro(z.jeBgfCent)+'</span></div>'+
    '<span class="bar"><span style="width:'+(Number(z.jeBgfCent*1000n/maxBgf)/10)+'%"></span></span>').join('')+
    '<p class="meta" style="margin-top:10px">Je Stand der Kostenberechnung, nicht fortgeschrieben. Im Datenpool rechnet der Baupreisindex der neuen Kostenberechnung die Werte auf ihren Stand, sobald er eingetragen ist.</p></section>';
  const jahre=kopien.length?[Math.min(...kopien.map(k=>k.von||9999)),Math.max(...kopien.map(k=>k.bis||0))]:null;
  const karteKopien='<section class="card archiv-k"><div class="k-kopf"><h2 class="kb-h2">Übernommen statt neu ermittelt</h2><span class="chip chip-src">im Datenpool je eine Quelle</span></div>'+
    (kopien.length?'<p class="meta" style="margin:6px 0 8px">'+kopien.length+(kopien.length===1?' Ansatz steht':' Ansätze stehen')+' mit gleichem Preis und gleicher Leistung in zwei oder mehr Kostenberechnungen'+
      (jahre&&jahre[0]<jahre[1]?' ('+jahre[0]+'–'+jahre[1]+')':'')+'. Ihr Kostenstand ist der des ältesten Vorkommens.</p>'+
      kopien.slice(0,6).map(k=>'<div class="mini"><span>'+esc(kurz(k.titel,46))+' <span class="meta">'+esc(k.projekte.join(', '))+'</span></span><span class="num">'+euroEp(k.epCent,k.einheit)+'</span></div>').join(''):
      '<p class="meta">Keine gleichen Ansätze gefunden.</p>')+'</section>';
  // 23.11.2026, abends: Steht eine Seite eines Falls im Original nicht in der Summe, sagt die Karte es (auch für die Vergleichswerte).
  // Zuerst die Fälle, in denen beide Seiten in ihrer Summe stehen: sie betreffen die Summen der Originale.
  const ausserhalbFall=a=>a.e.nichtInSumme||a.n.every(x=>x.nichtInSumme);
  const ausserhalb=auff.filter(ausserhalbFall).length;
  auff.sort((a,b)=>(ausserhalbFall(a)?1:0)-(ausserhalbFall(b)?1:0));
  const eine=' eine Zeile, die im Original nicht in der Summe steht.',mehrere=' Zeilen, die im Original nicht in der Summe stehen.';
  const hinweisAuff=!ausserhalb?'':ausserhalb===auff.length?(auff.length===1?'Der Fall betrifft'+eine:'Alle '+auff.length+' Fälle betreffen'+mehrere):
    ausserhalb+' von '+auff.length+' Fällen '+(ausserhalb===1?'betrifft'+eine:'betreffen'+mehrere);
  const karteAuff='<section class="card archiv-k"><h2 class="kb-h2">Auffällig, bitte prüfen</h2>'+
    (auff.length?(hinweisAuff?'<p class="meta" style="margin:6px 0 8px">'+esc(hinweisAuff)+'</p>':'')+
      auff.slice(0,4).map(a=>'<p class="auff"><strong>'+esc(a.e.nr)+'</strong> · '+esc(kurz(a.e.bez,60))+': '+euroEp(a.e.epCent,a.e.einheit)+
      (a.e.menge?' für '+esc(R.zahl(a.e.menge,2))+' '+esc(a.e.einheit):'')+(a.e.nichtInSumme?' (nicht in der Summe)':'')+'. In '+esc(a.vergleich.join(', '))+
      ' dieselbe Leistung '+(a.minCent===a.maxCent?euroEp(a.minCent,a.e.einheit):euroEp(a.minCent)+' bis '+euroEp(a.maxCent,a.e.einheit))+
      (!a.e.nichtInSumme&&a.n.every(x=>x.nichtInSumme)?' (dort nicht in der Summe)':'')+'.</p>').join('')+
      (auff.length>4?'<p class="meta">'+(auff.length-4)+' weitere im Datenpool markiert.</p>':''):'<p class="meta">Nichts auffällig.</p>')+'</section>';
  return '<h2 class="lib" id="kostenarchiv">Kostenarchiv</h2>'+
    '<p class="meta" style="margin:-8px 0 14px">'+zeilen.length+(zeilen.length===1?' alte Kostenberechnung':' alte Kostenberechnungen')+' des Büros · nur lesen. Ihre Positionen sind der Datenpool: '+
    'in jeder Kostenberechnung holt «Kennwert aus eigenen Projekten» in den Details einer Position Werte mit Herkunft.</p>'+tabelle+
    '<div class="archiv-karten">'+karteBgf+karteKopien+karteAuff+'</div>'+
    '<p class="meta" style="margin-top:12px">Weitere alte Kostenberechnungen kommen über Claude ins Archiv: das Excel des Büros (sonst das PDF) wird Zeile für Zeile gelesen, '+
    'die Summen je Kostengruppe werden gegen das Original geprüft, und das Projekt wird als archiviert angelegt.</p>';
}
function dialogNeu(vorwahl=null){
  const d=listeDaten;if(!d)return;
  const q=aktuellesQuartal();
  dialog.innerHTML='<form class="dlg" id="kbNeu" method="dialog"><h2>Kostenberechnung anlegen</h2>'+
    '<label class="feld">Projekt<select name="projekt" required>'+d.projekte.map(p=>'<option value="'+esc(p.id)+'"'+(p.id===vorwahl?' selected':'')+'>'+esc(p.number+' · '+p.name)+'</option>').join('')+'</select></label>'+
    '<label class="feld">Muster<select name="muster" required>'+d.muster.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.title+' · '+t.version)+'</option>').join('')+'</select></label>'+
    '<label class="feld">Kostenstand<select name="kostenstand">'+quartale().map(x=>'<option value="'+x+'"'+(x===q?' selected':'')+'>'+esc(R.quartalText(x))+'</option>').join('')+'</select></label>'+
    '<p class="meta att" id="kbNeuFehler" role="alert"></p>'+
    '<div class="dlg-actions"><button type="button" class="btn" data-dlg="zu">Abbrechen</button><button class="btn btn-primary" type="submit">Anlegen</button></div></form>';
  let angelegt=false;
  if(IM_REITER)dialog.addEventListener('close',()=>{if(!angelegt)window.parent.postMessage({tbaOfficeTool:'abgebrochen'},location.origin)},{once:true});
  dialog.showModal();
  dialog.querySelector('#kbNeu').addEventListener('submit',async ev=>{
    ev.preventDefault();
    const f=ev.target,knopf=f.querySelector('[type="submit"]');knopf.disabled=true;
    const projekt=d.projekte.find(p=>p.id===f.elements.projekt.value),muster=d.muster.find(t=>t.id===f.elements.muster.value);
    try{
      if(!projekt||!muster)throw Error('Bitte Projekt und Muster wählen.');
      const state=JSON.parse(JSON.stringify(muster.state));state.kostenstand=f.elements.kostenstand.value;
      for(const g of Object.values(state.gruppen||{}))if(g?.status==='entfaellt')g.vorbelegt=true;
      const {data,error}=await sb.from('office_kosten_instances').insert({project_id:projekt.id,template_id:muster.id,template_version:muster.version,
        project_number:projekt.number,project_name:projekt.name,phase:'LPH3',owner_id:nutzer.id,state}).select('id').single();
      if(error||!data?.id)throw Error('Die Kostenberechnung konnte nicht angelegt werden.');
      angelegt=true;
      location.assign('./kostenberechnung.html?id='+encodeURIComponent(data.id));
    }catch(e){f.querySelector('#kbNeuFehler').textContent=e?.message||'Fehler beim Anlegen.';knopf.disabled=false}
  });
}

// ---------- Laden ----------
async function ladeKostenberechnung(id){
  const {data:row,error}=await sb.from('office_kosten_instances')
    .select('id,project_id,project_number,project_name,phase,owner_id,template_id,template_version,state,server_revision,updated_at,is_archived').eq('id',id).maybeSingle();
  if(error)throw error;
  if(!row)throw Error('Kostenberechnung nicht gefunden.');
  if(row.state?.schema!==R.SCHEMA)throw Error('Unbekannter Stand der Kostenberechnung.');
  if(row.template_id&&!row.is_archived){
    const {data:m}=await sb.from('office_kosten_templates').select('gruppen:state->gruppen').eq('id',row.template_id).maybeSingle();
    if(m?.gruppen)markiereVorbelegt(row.state,m.gruppen);
  }
  doc=row;st=row.state;serverRevision=Number(row.server_revision);
  if(!Number.isSafeInteger(serverRevision)||serverRevision<1)throw Error('Keine gültige Serverrevision.');
  let leitet=false,team=false;
  if(mitglied.role!=='admin'&&row.owner_id!==nutzer.id){
    const [p,t]=await Promise.all([sb.from('office_projects').select('projektleiter_id').eq('id',row.project_id).maybeSingle(),
      sb.from('office_project_members').select('user_id').eq('project_id',row.project_id).eq('user_id',nutzer.id).maybeSingle()]);
    leitet=p.data?.projektleiter_id===nutzer.id;team=!!t.data;
  }
  kannBearbeiten=mitglied.role==='admin'||row.owner_id===nutzer.id||leitet||team;
  // Archiv: eine alte Kostenberechnung bleibt, wie sie war; sie liefert Kennwerte, geändert wird sie nicht.
  istArchiv=row.is_archived===true;if(istArchiv)kannBearbeiten=false;
  speicherText=istArchiv?'Archiv · nur lesen':'gespeichert · Revision '+serverRevision;
  ui.tab=tabAusHash()||'uebersicht';
  render();
  void ladeStaende();
}
async function ladeMuster(id){
  const {data:row,error}=await sb.from('office_kosten_templates').select('id,title,version,norm,status,state,updated_at').eq('id',id).eq('is_active',true).maybeSingle();
  if(error)throw error;if(!row)throw Error('Muster nicht gefunden.');
  istMuster=true;kannBearbeiten=false;
  doc={id:row.id,project_name:row.title,project_number:'Muster',phase:'LPH3',updated_at:row.updated_at,version:row.version,status:row.status};
  st=JSON.parse(JSON.stringify(row.state));if(!st.kostenstand)st.kostenstand=aktuellesQuartal();
  ui.tab='uebersicht';render();
}

// ---------- Speichern (wie der Terminplan: nur auf die erwartete Revision) ----------
function geaendert(){
  if(!kannBearbeiten||istMuster)return;
  ausstehend=true;speicherText='Änderungen werden gespeichert …';zeigeSpeicherstatus();
  clearTimeout(speichernTimer);speichernTimer=setTimeout(()=>{void speichern()},700);
}
async function speichern(){
  if(laeuft||!ausstehend||konflikt)return;
  laeuft=true;ausstehend=false;
  const stand=JSON.parse(JSON.stringify(st));
  try{
    const {data,error}=await sb.from('office_kosten_instances').update({state:stand}).eq('id',doc.id).eq('server_revision',serverRevision).select('id,server_revision,updated_at');
    if(error)throw error;
    if(!data||data.length!==1)throw Object.assign(Error('Revision'),{code:'REVISION'});
    serverRevision=Number(data[0].server_revision);doc.updated_at=data[0].updated_at;
    speicherText='gespeichert · Revision '+serverRevision;
  }catch(e){
    console.error('Kostenberechnung speichern',e);
    konflikt=true;speicherText='';
    render();
  }finally{
    laeuft=false;zeigeSpeicherstatus();
    if(ausstehend&&!konflikt)void speichern();
  }
}
async function speichernJetzt(){clearTimeout(speichernTimer);while(laeuft)await new Promise(r=>setTimeout(r,80));if(ausstehend)await speichern()}
function zeigeSpeicherstatus(){const el=document.getElementById('kbSave');if(el)el.textContent=istMuster?'':speicherText}
window.addEventListener('beforeunload',e=>{if(ausstehend||laeuft){e.preventDefault();e.returnValue=''}});
// Für Work (Reiter): Revision und ausstehende Speicherung abfragen; vor dem Schließen des Rahmens speichern.
window.TBA_OFFICE_TOOL=Object.freeze({kind:'kosten',revision:()=>serverRevision,pending:()=>ausstehend||laeuft,flush:()=>speichernJetzt()});
function sichernAlsDatei(){
  const blob=new Blob([JSON.stringify({kostenberechnung:doc?.id,revision:serverRevision,state:st},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Kostenberechnung-'+(doc?.project_number||'')+'-'+heuteIso()+'.json';
  document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}

// Lesen genügt: wer die Kostenberechnung sehen darf, bekommt ihre Gliederung als Datei für Archicad.
function klassifizierungLaden(){
  let xml;
  try{xml=I.klassifizierungXml(st.katalog)}catch(e){ui.meldung=e?.message||'Die Klassifizierung konnte nicht erzeugt werden.';render();return}
  const blob=new Blob([xml],{type:'application/xml;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='DIN276-2018_TBA_Archicad-Klassifizierung.xml';
  document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}

// ---------- Stände ----------
async function ladeStaende(){
  if(!doc||istMuster)return;
  const {data,error}=await sb.from('office_kosten_versions').select('id,label,created_at,server_revision,state').eq('instance_id',doc.id).order('created_at',{ascending:false}).limit(20);
  ui.staende=error?[]:(data||[]).map(v=>{let s='';try{s=R.euro(R.berechne(v.state).gesamt.bekanntCent)}catch{}return {id:v.id,label:v.label,datum:v.created_at,revision:v.server_revision,summe:s}});
  if(ui.tab==='bericht')render();
}
async function standFesthalten(label){
  await speichernJetzt();
  if(konflikt)return;
  const {error}=await sb.from('office_kosten_versions').insert({instance_id:doc.id,label:label.slice(0,160),state:st,server_revision:serverRevision,created_by:nutzer.id});
  ui.meldung=error?'Der Stand konnte nicht festgehalten werden.':'Stand «'+label+'» festgehalten.';
  await ladeStaende();render();
}

// ---------- Gliederung ----------
// Baum aus dem Katalog des Stands (die DIN-276-Gliederung steht nur im Muster, nie in diesem Code).
function baueBaum(){
  const kinder=new Map(),eintrag=new Map(),posJeKg=new Map();
  for(const k of st.katalog||[]){
    if(!KG_MUSTER.test(String(k.kg)))continue;
    eintrag.set(k.kg,k);
    const e=R.ebene(k.kg);if(e<2)continue;
    const p=e===3?k.kg.slice(0,2)+'0':k.kg[0]+'00';
    if(!kinder.has(p))kinder.set(p,[]);kinder.get(p).push(k);
  }
  for(const p of st.positionen||[]){const kg=String(p.kg||'');if(!posJeKg.has(kg))posJeKg.set(kg,[]);posJeKg.get(kg).push(p)}
  return {kinder,eintrag,posJeKg};
}
const kinderVon=kg=>baum.kinder.get(kg)||[];
const positionenIn=kg=>baum.posJeKg.get(kg)||[];
// Vorgaben des Musters je KG (Rechenweise, Einheit, Quelle, Hinweis); die genauere Ebene gewinnt.
function vorlage(kg){const v=st.vorlagen||{};if(!KG_MUSTER.test(kg))return {};return Object.assign({},v[kg[0]+'00'],v[kg.slice(0,2)+'0'],v[kg])}
function pauschalIn(kg){return R.kette(kg).find(x=>x!==kg&&(calc.knoten.get(x)?.direkt||0)>0)||''}
function entfaelltMit(kg){return R.kette(kg).find(x=>x!==kg&&st.gruppen?.[x]?.status==='entfaellt')||''}
function blaetterUnter(kg){return [...calc.blaetter.keys()].filter(b=>b===kg||R.liegtUnter(b,kg))}
function chipKg(n){
  if(!n)return '';
  if(n.status==='entfaellt')return istArchiv?'<span class="chip chip-mute">ohne Ansatz</span>':'<span class="chip">entfällt</span>';
  if(n.blatt){
    if(n.status==='enthalten')return '<span class="chip chip-src">in Pauschale</span>';
    if(n.status==='frei')return '<span class="chip chip-mute">optional</span>';
    if(n.status==='leer')return '<span class="chip chip-att">ohne Ansatz</span>';
    if(n.status==='offen')return '<span class="chip chip-att">'+n.offen+' offen</span>';
    return '<span class="chip chip-ok">vollständig</span>';
  }
  if(n.zuKlaeren)return '<span class="chip chip-att">'+n.zuKlaeren+' zu klären</span>';
  if(n.offen)return '<span class="chip chip-att">'+n.offen+' offen</span>';
  if(n.kgGesamt||n.anzahl)return '<span class="chip chip-ok">vollständig</span>';
  return '<span class="chip chip-mute">–</span>';
}

// ---------- Rendern ----------
function render(){
  if(!st)return;
  renderSpaeter=false;
  calc=R.berechne(st);baum=baueBaum();
  if(ui.kgAuswahl&&!calc.knoten.has(ui.kgAuswahl))ui.kgAuswahl=null;
  if(ui.elAuswahl&&!(st.elemente||[]).some(e=>e.id===ui.elAuswahl))ui.elAuswahl=null;
  const aktiv=document.activeElement?.dataset?.key||null,imInspektor=!!document.activeElement?.closest?.('.inspektor');
  const kopf='<a class="kb-back" href="./kostenberechnung.html">‹ Kostenberechnungen</a>'+
    '<header class="kb-head"><div class="kb-head-text"><p class="kicker">Office · Kostenberechnung'+(istMuster?' · Muster':'')+(istArchiv?' · Archiv':'')+'</p>'+
    '<h1>'+esc(doc.project_name)+'</h1><p class="kb-intro">'+esc([doc.project_number!=='Muster'?doc.project_number:'',istArchiv?(st.archiv?.dokumentKurz||'Archiv'):doc.phase==='LPH3'?'LPH 3':doc.phase,
      (st.norm||'DIN 276')+' bis zur 3. Ebene','Kostenstand '+(R.quartalText(st.kostenstand)||'offen'),istMuster?'Version '+doc.version:'Stand '+datum(doc.updated_at)].filter(Boolean).join(' · '))+'</p></div>'+
    '<div class="kb-actions">'+ANLEITUNG+
    (kannBearbeiten?'<button type="button" class="btn" data-act="import">'+ICON_IMPORT+'Mengen aus Archicad</button>':'')+
    '<button type="button" class="btn btn-primary" data-act="tab" data-tab="bericht">Bericht für die Kostenbesprechung</button></div></header>'+
    '<p class="kb-save meta" id="kbSave"></p>';
  let banner='';
  if(istMuster)banner='<div class="kb-banner info">Muster · nur Ansicht. Eine Kostenberechnung für ein Projekt legst du in der <a href="./kostenberechnung.html">Übersicht</a> an; das Muster bleibt dabei unverändert.</div>';
  else if(istArchiv)banner=archivBanner();
  else if(!kannBearbeiten)banner='<div class="kb-banner info">Nur Ansicht: Fortschreiben können das Projektteam, die Projektleitung und wer die Kostenberechnung angelegt hat.</div>';
  if(konflikt)banner+='<div class="kb-banner warn"><strong>Nicht gespeichert.</strong> Auf dem Server liegt ein neuerer Stand, oder die Verbindung ist unterbrochen. Deine Änderungen sind noch in diesem Fenster.'+
    '<div class="kb-banner-actions"><button type="button" class="btn" data-act="sichern">Meine Fassung als Datei sichern</button><button type="button" class="btn" data-act="neuladen">Neu laden</button></div></div>';
  if(ui.meldung)banner+='<div class="kb-banner info" role="status">'+esc(ui.meldung)+'</div>';
  const tabs='<nav class="tabs" role="tablist" aria-label="Ansichten">'+TABS.map(([k,t])=>'<button type="button" class="tab" role="tab" data-act="tab" data-tab="'+k+'" aria-selected="'+(ui.tab===k)+'">'+t+'</button>').join('')+'</nav>';
  const inhalt={uebersicht:tabUebersicht,positionen:tabPositionen,quellen:tabQuellen,vergleich:tabVergleich,bericht:tabBericht}[ui.tab]||tabUebersicht;
  // Eine Werkzeugzeile im Reiter von Work (B2, 27.11.2026): keine Kopfzeile; Ansichten, knappe Angaben (voll im Tooltip),
  // Speicherstand, «Mengen aus Archicad» und «?» für die Anleitung in einer Zeile. Den Bericht öffnet sein Reiter.
  if(IM_REITER){
    const angaben=[istArchiv?(st.archiv?.dokumentKurz||'Archiv'):doc.phase==='LPH3'?'LPH 3':doc.phase,st.norm||'DIN 276',
      'Kostenstand '+(R.quartalText(st.kostenstand)||'offen')].filter(Boolean).join(' · ');
    const voll=[doc.project_number!=='Muster'?doc.project_number:'',angaben,(st.norm||'DIN 276')+' bis zur 3. Ebene',
      istMuster?'Version '+doc.version:'Stand '+datum(doc.updated_at)].filter(Boolean).join(' · ');
    // Mit reduzierter Leiste in Work wählt man die Fassung am Anfang der Zeile (shared/reiter-fassung.js füllt den Ort).
    const zeile='<div class="kb-zeile"><span data-reiter-fassung hidden></span>'+tabs+'<span class="kb-zeile-info" title="'+esc(voll)+'">'+esc(angaben)+'</span>'+
      '<p class="kb-save meta" id="kbSave"></p>'+
      (kannBearbeiten?'<button type="button" class="btn" data-act="import">'+ICON_IMPORT+'Mengen aus Archicad</button>':'')+
      '<a class="kb-hilfe" href="./kostenberechnung-hilfe.html" target="_blank" rel="noopener noreferrer" title="Anleitung" aria-label="Anleitung">?</a></div>';
    root.innerHTML='<div class="kb-wrap">'+banner+zeile+'<section id="kbBody">'+inhalt()+'</section></div>'+datalistKg()+datalistGw();
  }else
  root.innerHTML='<div class="kb-wrap">'+kopf+banner+tabs+'<section id="kbBody">'+inhalt()+'</section></div>'+datalistKg()+datalistGw();
  root.classList.toggle('mit-inspektor',ui.tab==='positionen'&&!!root.querySelector('.inspektor'));
  if(ui.tab==='positionen')hoehenAnpassen();
  assistent?.sync();
  zeigeSpeicherstatus();
  if(aktiv){const el=(imInspektor&&root.querySelector('.inspektor')||root).querySelector('[data-key="'+CSS.escape(aktiv)+'"]');if(el){el.focus({preventScroll:true});if(el.select&&el.type==='text')try{el.setSelectionRange(el.value.length,el.value.length)}catch{}}}
}
function archivBanner(){
  const a=st.archiv||{};
  const satz=[a.gebaeude,a.bauweise,a.massnahme,a.ort].filter(Boolean).join(' · ');
  return '<div class="kb-banner info archiv"><strong>Archiv · nur lesen.</strong> '+esc(a.dokument||'Alte Kostenberechnung')+(a.stand?' vom '+esc(datum(a.stand)):'')+
    (a.quelle?' · '+esc(a.quelle):'')+'.'+(satz?' '+esc(satz)+'.':'')+' Reifegrad: '+esc(reifegradText(a.reifegrad||'berechnung'))+'. '+
    'Die Positionen sind Kennwerte für neue Kostenberechnungen: dort in den Details einer Position «Kennwert aus eigenen Projekten» wählen.'+
    (a.hinweise?.length?'<ul class="archiv-hinweise">'+a.hinweise.map(h=>'<li>'+esc(h)+'</li>').join('')+'</ul>':'')+'</div>';
}
function datalistGw(){
  const codes=[...new Set([...(st.positionen||[]).map(p=>R.gewerkKurz(p.gewerk)).filter(Boolean),...Object.keys(st.gewerke||{})])].sort();
  return '<datalist id="kbGwListe">'+codes.map(c=>'<option value="'+esc(c)+'">'+esc(st.gewerke?.[c]||'')+'</option>').join('')+'</datalist>';
}
function datalistKg(){return '<datalist id="kbKgListe">'+(st.katalog||[]).map(k=>'<option value="'+esc(k.kg)+'">'+esc(k.kg+' '+k.titel)+'</option>').join('')+'</datalist>'}

// Übersicht
function tabUebersicht(){
  const g=calc.gesamt,vgl=calc.ksSummeCent,vorgabe=calc.vorgabe,v=calc.vollstaendigkeit;
  const proz=(a,b)=>b&&b!==0n?Number(R.teile(BigInt(a)*10000n,BigInt(b)))/100:null;
  const karten='<section class="sum" aria-label="Zusammenfassung">'+
    '<div class="card"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 8px;align-items:center"><p class="sum-label">Kostenberechnung</p>'+
      (g.vollstaendig?'<span class="chip chip-ok">vollständig</span>':'<span class="chip chip-att">vorläufig</span>')+'</div>'+
      '<p class="big">'+betrag(g.bekanntCent)+'</p><p class="meta">'+(ui.brutto?'brutto · netto '+R.euro(g.bekanntCent):'netto · brutto '+R.euro(calc.bruttoCent))+'</p>'+
      (calc.kennzahlen.jeBGF!==null?'<p class="meta">Bauwerk '+R.euro(calc.kennzahlen.jeBGF)+'/m² BGF</p>':'')+'</div>'+
    '<div class="card"><p class="sum-label">Kostenschätzung</p>'+(vgl===null?'<p class="big">–</p><p class="meta"><button type="button" class="btn btn-quiet" style="padding:0;min-height:0" data-act="tab" data-tab="vergleich">Werte eintragen</button></p>':
      '<p class="big">'+betrag(vgl)+'</p><p class="meta '+(calc.deltaSummeCent>0n?'att':'okc')+'">'+R.euro(anzeigeCent(calc.deltaSummeCent),{vorzeichen:true})+' · '+R.prozent(proz(calc.deltaSummeCent,vgl),{vorzeichen:true})+'</p>')+'</div>'+
    '<div class="card"><p class="sum-label">Kostenvorgabe</p>'+(vorgabe.cent===null?'<p class="big">–</p><p class="meta"><button type="button" class="btn btn-quiet" style="padding:0;min-height:0" data-act="tab" data-tab="quellen">Budget eintragen</button></p>':
      '<p class="big">'+betrag(vorgabe.cent)+'</p><p class="meta '+(vorgabe.differenzCent>0n?'att':'okc')+'">'+(vorgabe.differenzCent>0n?'überschritten um '+R.euro(anzeigeCent(vorgabe.differenzCent)):'unterschritten um '+R.euro(anzeigeCent(-vorgabe.differenzCent)))+'</p>')+'</div>'+
    '<div class="card"><p class="sum-label">Vollständigkeit</p><p class="big">'+v.prozent+' %</p><span class="bar" style="margin:4px 0 10px"><span style="width:'+v.prozent+'%"></span></span>'+
      '<p class="meta">'+v.erledigt+' von '+v.gesamt+(v.nachKg?' Kostengruppen geklärt':' Positionen vollständig belegt')+'</p>'+
      (v.vorbelegt?'<p class="meta">'+v.vorbelegt+' weitere vom Muster als «entfällt» vorbelegt, nicht mitgezählt.</p>':'')+'</div></section>';
  const erste=(st.katalog||[]).filter(k=>R.ebene(k.kg)===1);
  const bgf=R.dezimal(st.bezug?.BGF),mitBgf=!!(bgf&&Number(bgf)>0);
  const anteil=b=>g.bekanntCent>0n&&b>0n?R.prozent(Number(R.teile(b*1000n,g.bekanntCent))/10):'';
  const jeBgf=b=>mitBgf&&b>0n?R.euro(R.teile(b*1000000n,R.mikro(bgf))):'';
  const chev=(kg,hat)=>hat?'<button type="button" class="chev" data-act="aufklappen" data-kg="'+esc(kg)+'" aria-expanded="'+ui.offen.has(kg)+'" aria-label="KG '+esc(kg)+(ui.offen.has(kg)?' zuklappen':' aufklappen')+'">›</button>':'<span class="chev" aria-hidden="true"></span>';
  const werte=(b,aus,kn,fett)=>'<span class="num"'+(fett?' style="font-weight:650"':'')+'>'+(aus?(istArchiv?'–':'entfällt'):(kn?.status==='enthalten'?'<span class="meta">in Pauschale</span>':R.euro(b)))+'</span>'+
    '<span class="num hide-s">'+(aus||kn?.status==='enthalten'?'':R.euro(bruttoVon(b)))+'</span><span class="num hide-s meta">'+(aus?'':anteil(b))+'</span>'+(mitBgf?'<span class="num hide-s meta">'+(aus?'':jeBgf(b))+'</span>':'');
  let zeilen='';
  for(const k of erste){
    const kn=calc.knoten.get(k.kg),aus=kn?.status==='entfaellt',b=kn?.bekanntCent||0n;
    zeilen+='<div class="row'+(aus?' aus':'')+'"><span class="name"><span class="kg">'+esc(k.kg)+'</span>'+esc(k.titel)+'</span>'+werte(b,aus,null,k.kg==='300')+
      '<span class="hide-s">'+chipKg(kn)+'</span>'+chev(k.kg,kinderVon(k.kg).length>0)+'</div>';
    if(!ui.offen.has(k.kg))continue;
    if(positionenIn(k.kg).length)zeilen+=zeileUebersicht({kg:k.kg,titel:'Pauschal für die ganze KG '+k.kg},'sub',null,werte,chev);
    for(const x of kinderVon(k.kg)){
      zeilen+=zeileUebersicht(x,'sub',calc.knoten.get(x.kg),werte,chev);
      if(!ui.offen.has(x.kg))continue;
      for(const y of kinderVon(x.kg))zeilen+=zeileUebersicht(y,'sub2',calc.knoten.get(y.kg),werte,chev);
    }
  }
  const liste='<section class="card main'+(mitBgf?' mit-bgf':'')+'" aria-label="Kosten nach Kostengruppen" style="overflow:hidden"><div class="card-head"><h2 class="kb-h2">Kosten nach Kostengruppen</h2></div>'+
    '<div class="row head"><span>Kostengruppe</span><span class="num">Netto</span><span class="num hide-s">Brutto</span><span class="num hide-s">Anteil</span>'+(mitBgf?'<span class="num hide-s">€/m² BGF</span>':'')+'<span class="hide-s">Stand</span><span></span></div>'+zeilen+
    '<div class="sumrow"><div><p style="margin:0;font-weight:700">Summe netto'+(g.vollstaendig?'':', vorläufig')+'</p>'+
    '<p class="meta">zzgl. '+esc(R.zahl(st.ustProzent))+' % USt. '+R.euro(calc.ustCent)+' · brutto '+R.euro(calc.bruttoCent)+'</p></div>'+
    '<p class="num" style="margin:0;font-size:22px;font-weight:700;letter-spacing:-.02em">'+R.euro(g.bekanntCent)+'</p></div></section>';
  return karten+'<div class="cols">'+liste+'<aside class="side" aria-label="Was noch fehlt">'+karteFehlt()+karteArchicad()+karteHerkunft()+'</aside></div>';
}
function zeileUebersicht(k,klasse,kn,werte,chev){
  const pauschal=!kn,aus=kn?.status==='entfaellt';
  const b=pauschal?positionenIn(k.kg).reduce((s,p)=>{const r=calc.positionen.find(x=>x.id===p.id);return s+(r?.betragCent&&!r.ausgeschlossen?r.betragCent:0n)},0n):(kn.bekanntCent||0n);
  return '<div class="row '+klasse+' klick'+(aus?' aus':'')+'" data-act="kg-gehe" data-kg="'+esc(k.kg)+'" role="button" tabindex="0">'+
    '<span class="name">'+(pauschal?'<span class="meta">'+esc(k.titel)+'</span>':'<span class="kg">'+esc(k.kg)+'</span>'+esc(k.titel))+'</span>'+
    werte(b,aus,kn,false)+'<span class="hide-s">'+(pauschal?'':chipKg(kn))+'</span>'+(pauschal?'<span class="chev" aria-hidden="true"></span>':chev(k.kg,kinderVon(k.kg).length>0))+'</div>';
}
// Was die ganze Kostenberechnung betrifft, zuerst; dann Positionen, offene Kostengruppen, zuletzt Hinweise.
const RANG_FEHLT={doppelt:0,grundlage:1,ursache:2,position:3,leer:4,gruppe:5,paar:6,bezug:7,vergleich:8,hinweis:9};
function sortiereFehlt(f){return [...f].sort((a,b)=>(a.schwere==='hoch'?0:1)-(b.schwere==='hoch'?0:1)||(RANG_FEHLT[a.art]??9)-(RANG_FEHLT[b.art]??9))}
// Archicad nennt den Bauteiltyp oft im Namen des Aufbaus («AW-01 KS 17,5 + WDVS 16»): nicht doppelt zeigen.
function aufbauText(p){
  const a=String(p.aufbau||'').trim(),t=String(p.bauteiltyp||'').trim();
  if(!a||a===t)return '';
  return t&&a.startsWith(t)?a.slice(t.length).replace(/^[\s·:–-]+/,''):a;
}
function karteFehlt(){
  const f=calc.fehlt;
  if(!f.length)return '<section class="card" style="padding:18px 20px"><h2 class="kb-h2">Was noch fehlt</h2><p class="meta" style="margin-top:8px">Nichts. Jede Kostengruppe ist geklärt, jede Position hat Menge, Kennwert und Quelle.</p></section>';
  const sortiert=sortiereFehlt(f);
  const zeige=ui.alleFehlt?sortiert:sortiert.slice(0,7);
  return '<section class="card" style="padding:18px 20px 8px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2 class="kb-h2">Was noch fehlt</h2><span class="chip chip-att">'+f.length+' offen</span></div>'+
    '<div style="margin-top:6px">'+zeige.map(x=>'<div class="todo"><span class="dot '+(x.schwere==='hoch'?'hoch':'info')+'"></span><div style="min-width:0">'+
      '<button type="button" class="todo-link" data-act="goto" data-art="'+esc(x.art)+'" data-kg="'+esc(x.kg||'')+'" data-id="'+esc(x.positionId||'')+'" data-code="'+esc(x.code||'')+'">'+esc(x.text)+'</button></div></div>').join('')+'</div>'+
    (f.length>7?'<p style="margin:6px 0 10px"><button type="button" class="btn btn-quiet" style="padding:0" data-act="alle-fehlt" aria-expanded="'+!!ui.alleFehlt+'">'+
      (ui.alleFehlt?'Weniger anzeigen':'Alle '+f.length+' ansehen')+'</button></p>':'')+'</section>';
}
function karteArchicad(){
  const imp=st.importe||[];
  if(!imp.length)return '<section class="card" style="padding:18px 20px"><h2 class="kb-h2">Mengen aus Archicad</h2><p class="meta" style="margin:6px 0 12px">Noch kein Import. Die Interaktive Auswertung «TBA Kosten · Mengen» als Excel speichern und hier einlesen. Wie das Modell dafür klassifiziert wird, steht in der Anleitung, Teil III.</p>'+
    '<div class="kb-xml-zeile">'+(kannBearbeiten?'<button type="button" class="btn" data-act="import">'+ICON_IMPORT+'Mengen einlesen</button>':'')+KNOPF_KLASSIFIZIERUNG+'</div></section>';
  const letzter=imp[0],aend=I.vergleiche(imp[1]?.gruppen||null,letzter.gruppen).filter(x=>x.art!=='gleich');
  const typen=new Set(letzter.gruppen.map(g=>g.bauteiltyp).filter(Boolean)).size;
  return '<section class="card" style="padding:18px 20px"><h2 class="kb-h2">Mengen aus Archicad</h2><p class="meta" style="margin:4px 0 10px">Letzter Import '+esc(datum(letzter.datum))+(letzter.datei?' · '+esc(letzter.datei):'')+' · '+typen+' Bauteiltypen · '+letzter.gruppen.length+' Gruppen</p>'+
    (imp.length>1?'<p style="margin:10px 0 4px;font-size:13px;font-weight:600">Seit dem Import vom '+esc(datum(imp[1].datum))+'</p>'+
      (aend.length?aend.slice(0,6).map(x=>'<div class="mini"><span>'+esc((x.bauteiltyp||'ohne Typ')+' · KG '+x.kg)+'</span><span class="num">'+
        (x.art==='neu'?'neu':x.art==='entfernt'?'entfernt':esc((x.delta.startsWith('-')?'−'+R.zahl(x.delta.slice(1)):'+'+R.zahl(x.delta))+' '+x.einheit))+'</span></div>').join(''):'<p class="meta">keine Änderungen</p>'):'')+
    '<div class="kb-xml-zeile">'+KNOPF_KLASSIFIZIERUNG+'</div></section>';
}
function karteHerkunft(){
  const h=Object.entries(calc.herkunft).filter(([,c])=>c>0n).sort((a,b)=>(b[1]>a[1]?1:-1));
  if(!h.length)return '';
  const summe=h.reduce((s,[,c])=>s+c,0n);
  return '<section class="card" style="padding:18px 20px"><h2 class="kb-h2">Herkunft der Beträge</h2><div style="margin-top:8px">'+h.map(([art,c])=>
    '<div class="mini"><span>'+esc(R.ARTEN[art]?.label||'ohne Quelle')+'</span><span class="num">'+R.prozent(Number(R.teile(c*1000n,summe))/10)+'</span></div>').join('')+'</div></section>';
}

// Positionen: die Tabelle wie im Büro-Excel (Vergleich: Phase0, California, ORCA). Jede Kostengruppe bis zur 3. Ebene ist
// eine Zeile, darunter ihre Positionen und Elemente (Gruppen von Positionen, etwa «WDVS Mineralwolle + Putz»).
// Spalten KG · GW · Bezeichnung · Ort · Menge · EH · EP netto · Netto · Brutto · Quelle · Kommentar; Bearbeiten direkt in der
// Zeile, alles Weitere (Herkunft, Fundstelle, Kostenstand) rechts in den Details. Dieselben Positionen lassen sich nach
// Gewerken (GW) zeigen; beide Sichten ergeben dieselbe Summe.
const SPALTEN=[['kg','KG'],['gw','GW'],['bez','Bezeichnung'],['ort','Ort'],['menge','Menge'],['eh','EH'],['ep','EP netto'],['netto','Netto'],['brutto','Brutto'],['quelle','Quelle'],['kom','Kommentar']];
const ZAHL_SPALTEN=new Set(['menge','ep','netto','brutto']);
const zelle=(k,inhalt)=>'<span class="c-'+k+(ZAHL_SPALTEN.has(k)?' num':'')+'" role="cell">'+inhalt+'</span>';
const zelleMitte=inhalt=>'<span class="c-mitte" role="cell">'+inhalt+'</span>'; // Ort bis EP zusammen
const euroGenau=c=>c===null||c===undefined?'–':R.euro(c,{nachkomma:true});
// Preise in der Zeile wie im Excel mit zwei Nachkommastellen (130,00); mehr nur, wenn eingegeben.
const preis=x=>{const d=R.dezimal(x);return d===null||d===undefined?'':new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:4}).format(Number(d))};
function bruttoVon(cent){return cent===null||cent===undefined?null:BigInt(cent)+ustVon(cent)}
const elementeIn=kg=>(st.elemente||[]).filter(e=>e&&e.kg===kg);
function chipFilter(kg,text,an,aus){return '<button type="button" class="chip'+(aus?' chip-aus':'')+'" data-act="filter" data-kg="'+esc(kg)+'" aria-pressed="'+an+'">'+esc(text)+'</button>'}
// Eingabe direkt in der Zeile; ohne Schreibrecht nur Text.
function textFeld(key,wert,{ph='',mehrzeilig=false,label='',zahl=false}={}){
  if(!kannBearbeiten)return '<span class="ct'+(zahl?' num':'')+'">'+esc(wert||'')+'</span>';
  const a=' data-key="'+esc(key)+'" aria-label="'+esc(label)+'"'+(ph?' placeholder="'+esc(ph)+'"':'');
  return mehrzeilig?'<textarea class="ci" rows="1"'+a+'>'+esc(wert||'')+'</textarea>':
    '<input class="ci'+(zahl?' num':'')+'" type="text"'+(zahl?' inputmode="decimal"':'')+a+' value="'+esc(wert??'')+'">';
}
function einheitFeld(key,wert){
  if(!kannBearbeiten)return '<span class="ct">'+esc(wert||'')+'</span>';
  return '<select class="ci" data-key="'+esc(key)+'" aria-label="Einheit">'+R.EINHEITEN.map(e=>'<option'+(e===(wert||'m²')?' selected':'')+'>'+esc(e)+'</option>').join('')+'</select>';
}
const mehrKnopf=(act,id,label)=>'<button type="button" class="mehr" data-act="'+act+'" data-id="'+esc(id)+'" aria-label="'+esc(label)+'">⋯</button>';
function kopfTabelle(){
  return '<div class="pos kopf" role="row">'+SPALTEN.map(([k,t])=>'<span class="c-'+k+(ZAHL_SPALTEN.has(k)?' num':'')+'" role="columnheader">'+t+
    (k==='bez'||k==='kom'?'<span class="zieh" data-zieh="'+k+'" title="Spaltenbreite ziehen" aria-hidden="true"></span>':'')+'</span>').join('')+'</div>';
}
function tabPositionen(){
  const ergebnis=new Map(calc.positionen.map(r=>[r.id,r]));
  const gw=ui.sicht==='gewerke',f=gw?'':ui.filter,erste=(st.katalog||[]).filter(k=>R.ebene(k.kg)===1);
  const zuKlaeren=[...calc.blaetter.values()].filter(s=>s==='leer'||s==='offen').length;
  let chips='';
  if(!gw){
    chips='<div class="filter" role="group" aria-label="Kostengruppen 1. Ebene">'+chipFilter('','Alle',!f)+chipFilter('offen','Zu klären · '+zuKlaeren,f==='offen')+
      erste.map(k=>chipFilter(k.kg,k.kg,!!f&&f!=='offen'&&f[0]===k.kg[0],calc.knoten.get(k.kg)?.status==='entfaellt')).join('')+'</div>';
    if(f&&f!=='offen'){
      const e1=f[0]+'00',zweite=kinderVon(e1);
      if(zweite.length)chips+='<div class="filter" role="group" aria-label="Kostengruppen 2. Ebene">'+chipFilter(e1,'Alle in '+e1,f===e1)+
        zweite.map(k=>chipFilter(k.kg,k.kg+' '+k.titel,f===k.kg||(R.ebene(f)===3&&f.slice(0,2)===k.kg.slice(0,2)),calc.knoten.get(k.kg)?.status==='entfaellt')).join('')+'</div>';
    }
  }
  const nurOffen=f==='offen';
  let zeilen='';
  if(gw)zeilen=zeilenGewerke(ergebnis);
  else if(!f||nurOffen)for(const k of erste)zeilen+=zeilenKnoten(k,ergebnis,nurOffen,true);
  else{
    const e=R.ebene(f),k=baum.eintrag.get(f);
    if(k){
      if(e===3||!kinderVon(f).length)zeilen=zeilenBlatt(k,ergebnis,false);
      else{
        zeilen=zeileKopf(k)+zeilenPauschal(f,ergebnis,false);
        for(const c of kinderVon(f))zeilen+=zeilenKnoten(c,ergebnis,false,true);
      }
    }
  }
  const ohneKg=(st.positionen||[]).filter(p=>!baum.eintrag.has(String(p.kg||'')));
  if(!gw&&(!f||nurOffen)&&ohneKg.length)zeilen+='<div class="pos grp" role="row">'+zelle('kg','–')+zelle('gw','')+
    zelle('bez','<span class="bez-zeile"><strong>Ohne gültige Kostengruppe</strong></span><small>Kostengruppe in den Details eintragen</small>')+zelleMitte('')+zelle('netto','')+zelle('brutto','')+zelle('quelle','')+zelle('kom','')+'</div>'+
    ohneKg.map(p=>zeilePosition(p,ergebnis.get(p.id),{mitKg:true})).join('');
  const summe=gw||!f?calc.gesamt.bekanntCent:(nurOffen?null:(calc.knoten.get(f)?.bekanntCent??0n));
  const kopfText=gw?'Nach Gewerken':!f?'Alle Kostengruppen':nurOffen?'Zu klären':kgName(f);
  const neuKg=ui.kgAuswahl&&calc.knoten.get(ui.kgAuswahl)?.blatt?ui.kgAuswahl:(f&&f!=='offen'&&R.ebene(f)===3?f:'');
  const werkzeuge='<div class="tbl-werkzeuge">'+
    '<div class="seg" role="group" aria-label="Gliederung"><button type="button" data-act="sicht" data-wert="kg" aria-pressed="'+!gw+'">Kostengruppen</button><button type="button" data-act="sicht" data-wert="gewerke" aria-pressed="'+gw+'">Gewerke</button></div>'+
    '<div class="seg" role="group" aria-label="Zeilenhöhe"><button type="button" data-act="zeilen" data-wert="kompakt" aria-pressed="'+(ui.zeilen==='kompakt')+'">Einzeilig</button><button type="button" data-act="zeilen" data-wert="voll" aria-pressed="'+(ui.zeilen!=='kompakt')+'">Ganzer Text</button></div>'+
    (kannBearbeiten&&!gw?'<button type="button" class="btn" data-act="pos-neu" data-kg="'+esc(neuKg)+'">'+ICON_PLUS+'Position</button>':'')+'</div>';
  const stil='--kb-bez:'+(Number(ui.breiteBez)||300)+'px;--kb-kom:'+(Number(ui.breiteKom)||210)+'px';
  const tabelle='<section class="card tabelle-karte" aria-label="Positionen"><div class="card-head"><h2 class="kb-h2">'+esc(kopfText)+'</h2>'+werkzeuge+'</div>'+
    '<div class="tbl"><div class="ktab '+(ui.zeilen==='kompakt'?'einzeilig':'voll')+'" role="table" aria-label="Kostenberechnung" style="'+stil+'">'+kopfTabelle()+
    (zeilen||'<p class="leer">'+(nurOffen?'Nichts zu klären. Jede Kostengruppe hat einen Ansatz, entfällt oder ist in einer Pauschale enthalten.':'Keine Kostengruppen in dieser Auswahl.')+'</p>')+
    (summe!==null&&zeilen?'<div class="pos summe" role="row">'+zelle('kg','')+zelle('gw','')+zelle('bez','Summe'+(gw||!f?(calc.gesamt.vollstaendig?'':', vorläufig'):' der Auswahl'))+zelleMitte('')+
      zelle('netto',euroGenau(summe))+zelle('brutto',euroGenau(bruttoVon(summe)))+zelle('quelle','')+zelle('kom','')+'</div>':'')+
    '</div></div></section>';
  return chips+tabelle+inspektor(ergebnis);
}
// Details rechts: Position, Element oder Kostengruppe. Auf breiten Bildschirmen neben der Tabelle, sonst darüber.
function inspektor(ergebnis){
  const pos=(st.positionen||[]).find(p=>p.id===ui.auswahl);
  const el=!pos&&ui.elAuswahl?(st.elemente||[]).find(e=>e.id===ui.elAuswahl):null;
  const inhalt=pos?(ui.pool?.id===pos.id&&P?panelPool(pos):panelPosition(pos,ergebnis.get(pos.id))):el?panelElement(el):(ui.kgAuswahl?panelKg(ui.kgAuswahl):'');
  if(!inhalt)return '';
  return '<aside class="inspektor" aria-label="Details"><div class="inspektor-kopf"><span class="meta">Details</span><button type="button" class="inspektor-zu" data-act="schliessen" aria-label="Details schließen">×</button></div>'+inhalt+'</aside>';
}
function istProblem(p,ergebnis){const r=ergebnis.get(p.id);return !!r&&!r.ausgeschlossen&&(r.status==='offen'||r.hinweise.length>0)}
function zeilenKnoten(k,ergebnis,nurOffen,mitKopf){
  const kinder=kinderVon(k.kg);
  if(!kinder.length)return zeilenBlatt(k,ergebnis,nurOffen);
  let innen=zeilenPauschal(k.kg,ergebnis,nurOffen);
  for(const c of kinder)innen+=zeilenKnoten(c,ergebnis,nurOffen,R.ebene(c.kg)===2);
  if(nurOffen&&!innen)return '';
  return (mitKopf?zeileKopf(k):'')+innen;
}
function zeileKopf(k){
  const n=calc.knoten.get(k.kg),e=R.ebene(k.kg),aus=n?.status==='entfaellt',netto=n?.bekanntCent||0n;
  return '<div class="pos '+(e===1?'grp1':'grp')+(ui.kgAuswahl===k.kg?' sel':'')+(aus?' aus':'')+'" role="row" data-act="kg" data-kg="'+esc(k.kg)+'">'+
    zelle('kg',esc(k.kg))+zelle('gw','')+
    zelle('bez','<span class="bez-zeile"><button type="button" class="bez-link" data-act="kg" data-kg="'+esc(k.kg)+'">'+esc(k.titel)+'</button>'+chipKg(n)+'</span>'+
      (n?.kgGesamt?'<small>'+n.geklaert+' von '+n.kgGesamt+' geklärt</small>':''))+
    zelleMitte('')+zelle('netto',aus?'entfällt':euroGenau(netto))+zelle('brutto',aus?'':euroGenau(bruttoVon(netto)))+zelle('quelle','')+
    zelle('kom',aus?'<span class="ct">'+esc(st.gruppen?.[k.kg]?.notiz||'')+'</span>':'')+'</div>';
}
function zeilenPauschal(kg,ergebnis,nurOffen){
  const liste=positionenIn(kg).filter(p=>!nurOffen||istProblem(p,ergebnis));
  return liste.map(p=>zeilePosition(p,ergebnis.get(p.id),{pauschal:kg})).join('');
}
// Kostengruppe der 3. Ebene (oder Blatt der 2.): ihre Zeile, dann die Positionen ohne Element, dann jedes Element mit seinen Positionen.
function zeilenBlatt(k,ergebnis,nurOffen){
  const n=calc.knoten.get(k.kg),alle=positionenIn(k.kg);
  if(nurOffen&&!(n?.status==='leer'||n?.status==='offen'||alle.some(p=>istProblem(p,ergebnis))))return '';
  const aus=n?.status==='entfaellt',mit=entfaelltMit(k.kg),pau=n?.status==='enthalten'?pauschalIn(k.kg):'';
  const klein=aus?(mit?'Entfällt mit KG '+mit:''):pau?'in der Pauschale von KG '+pau:((st.vorlagen||{})[k.kg]?.hinweis||'');
  const plus=kannBearbeiten&&!aus&&!nurOffen?'<span class="zeile-akt"><button type="button" class="zeile-plus" data-act="pos-neu" data-kg="'+esc(k.kg)+'" data-quelle="tabelle">'+ICON_PLUS+'Position</button>'+
    '<button type="button" class="zeile-plus" data-act="el-neu" data-kg="'+esc(k.kg)+'">'+ICON_PLUS+'Element</button></span>':'';
  let html='<div class="pos kgz'+(ui.kgAuswahl===k.kg?' sel':'')+(aus?' aus':'')+(n?.status==='leer'?' leer-kg':'')+'" role="row" data-act="kg" data-kg="'+esc(k.kg)+'">'+
    zelle('kg',esc(k.kg))+zelle('gw','')+
    zelle('bez','<span class="bez-zeile"><button type="button" class="bez-link" data-act="kg" data-kg="'+esc(k.kg)+'">'+esc(k.titel)+'</button>'+chipKg(n)+'</span>'+(klein?'<small>'+esc(klein)+'</small>':''))+
    zelleMitte(plus)+zelle('netto',aus?'entfällt':(n?.anzahl?euroGenau(n.bekanntCent||0n):'–'))+zelle('brutto',aus||!n?.anzahl?'':euroGenau(bruttoVon(n.bekanntCent||0n)))+
    zelle('quelle','')+zelle('kom',aus&&!mit?'<span class="ct">'+esc(st.gruppen?.[k.kg]?.notiz||'')+'</span>':'')+'</div>';
  if(aus&&!alle.length)return html;
  const ids=new Set(elementeIn(k.kg).map(e=>e.id));
  const zeige=p=>!nurOffen||istProblem(p,ergebnis);
  html+=alle.filter(p=>!ids.has(p.element)).filter(zeige).map(p=>zeilePosition(p,ergebnis.get(p.id))).join('');
  for(const el of elementeIn(k.kg)){
    const inEl=alle.filter(p=>p.element===el.id);
    if(nurOffen&&!inEl.some(zeige))continue;
    html+=zeileElement(el,aus)+inEl.filter(zeige).map(p=>zeilePosition(p,ergebnis.get(p.id),{imElement:true})).join('');
  }
  return html;
}
function zeileElement(el,aus){
  const s=calc.elemente?.get(el.id)||{bekanntCent:0n,anzahl:0,offen:0};
  const plus=kannBearbeiten&&!aus?'<span class="zeile-akt"><button type="button" class="zeile-plus" data-act="pos-neu" data-kg="'+esc(el.kg)+'" data-el="'+esc(el.id)+'" data-quelle="tabelle">'+ICON_PLUS+'Position</button></span>':'';
  return '<div class="pos el'+(ui.elAuswahl===el.id?' sel':'')+(aus?' aus':'')+'" role="row" data-act="el" data-id="'+esc(el.id)+'">'+
    zelle('kg',mehrKnopf('el',el.id,'Details zum Element'))+zelle('gw','')+
    zelle('bez',textFeld('el:'+el.id+':titel',el.titel,{ph:'Element, z. B. WDVS Mineralwolle + Putz',mehrzeilig:true,label:'Bezeichnung des Elements'}))+
    zelleMitte(plus)+zelle('netto',s.anzahl?euroGenau(s.bekanntCent):'–')+zelle('brutto',s.anzahl?euroGenau(bruttoVon(s.bekanntCent)):'')+
    zelle('quelle',s.offen?'<span class="chip chip-att">'+s.offen+' offen</span>':'')+
    zelle('kom',textFeld('el:'+el.id+':notiz',el.notiz,{mehrzeilig:true,label:'Kommentar zum Element'}))+'</div>';
}
function kurz(t,n){t=String(t||'');return t.length>n?t.slice(0,n-1)+'…':t}
function zeilePosition(p,r,{imElement=false,pauschal='',mitKg=false}={}){
  const k='pos:'+p.id+':',kw=p.kennwert||{},betragModus=p.modus==='betrag';
  const aus=r.status==='entfaellt'||r.ausgeschlossen,art=R.ARTEN[kw.art],ausText=p.archivNichtInSumme?'nicht in der Summe':'entfällt';
  const katTitel=titel(p.kg),eigen=p.titel&&p.titel!==katTitel?p.titel:'';
  const name=pauschal?eigen:(eigen||[p.bauteiltyp,aufbauText(p)].filter(Boolean).join(' · '));
  const transformiert=!betragModus&&(r.kette?.schritte||[]).some(s=>s.art!=='start'&&s.art!=='ende');
  const fehlt=r.fehlt.map(x=>({kg:'Kostengruppe',menge:'Menge',betrag:'Betrag',kennwert:'EP',mengenquelle:'Herkunft der Menge',quelle:'Quelle',fundstelle:'Fundstelle'}[x]||x)).join(', ');
  const dot='<span class="stand '+(aus?'aus':r.status==='offen'?'offen':'ok')+'" title="'+esc(aus?ausText:r.status==='offen'?'offen: '+fehlt:'vollständig')+'"></span>';
  let ep;
  if(betragModus)ep=textFeld(k+'betrag',preis(p.betrag),{label:'Betrag netto',zahl:true});
  else if(transformiert)ep='<button type="button" class="ep-kette" data-act="waehle" data-id="'+esc(p.id)+'" title="Herkunft des Einheitspreises">'+euroGenau(r.kennwertCent)+
    '<small>aus '+esc(R.zahl(kw.wert,2))+' € '+esc(art?.kurz||'')+'</small></button>';
  else ep=textFeld(k+'kennwert.wert',preis(kw.wert),{label:'Einheitspreis netto',zahl:true});
  const fundFehlt=art?.fundstelle&&!String(kw.fundstelle||'').trim();
  const quelle=art?'<button type="button" class="chip q'+(kw.art==='annahme'?'':' chip-src')+(fundFehlt?' chip-att':'')+'" data-act="waehle" data-id="'+esc(p.id)+'" title="'+esc(kw.fundstelle||'Fundstelle fehlt')+'">'+
      esc(art.kurz)+(kw.fundstelle?' · '+esc(kurz(kw.fundstelle,16)):(fundFehlt?' · Fundstelle?':''))+'</button>':
    '<button type="button" class="chip q chip-att" data-act="waehle" data-id="'+esc(p.id)+'">Quelle fehlt</button>';
  return '<div class="pos zeile'+(imElement?' im-el':'')+(pauschal?' pauschal':'')+(ui.auswahl===p.id?' sel':'')+(aus?' aus':'')+(ui.markiert.has(p.id)?' neu':'')+'" role="row" data-act="waehle" data-id="'+esc(p.id)+'">'+
    zelle('kg',mitKg?'<span class="ct">'+esc(p.kg||'–')+'</span>':mehrKnopf('waehle',p.id,'Details zur Position'))+
    zelle('gw',textFeld(k+'gewerk',p.gewerk,{label:'Gewerk'}))+
    zelle('bez','<span class="bez-pos">'+dot+textFeld(k+'titel',name,{ph:pauschal?'Pauschal für KG '+pauschal:'Bezeichnung',mehrzeilig:true,label:'Bezeichnung'})+'</span>'+
      (p.ausImportEntfernt?'<small class="att">nicht mehr im Modell</small>':''))+
    zelle('ort',textFeld(k+'ort',p.ort,{label:'Ort'}))+
    zelle('menge',betragModus?'<span class="ct num">1</span>':textFeld(k+'menge',R.zahl(p.menge,3),{label:'Menge',zahl:true}))+
    zelle('eh',betragModus?'<span class="ct">psch</span>':einheitFeld(k+'einheit',p.einheit))+
    zelle('ep',ep)+
    zelle('netto',aus?ausText:(r.betragCent!==null?euroGenau(r.betragCent):'<span class="offen">offen</span>'))+
    zelle('brutto',aus||r.betragCent===null?'':euroGenau(bruttoVon(r.betragCent)))+
    zelle('quelle',aus?'<span class="chip">'+ausText+'</span>':quelle)+
    zelle('kom',textFeld(k+'notiz',p.notiz,{mehrzeilig:true,label:'Kommentar'}))+'</div>';
}
// Dieselben Positionen nach Gewerken; das Kürzel steht in der Spalte GW.
function zeilenGewerke(ergebnis){
  const gruppen=new Map();
  for(const p of st.positionen||[]){
    const r=ergebnis.get(p.id);if(!r||r.ausgeschlossen||!baum.eintrag.has(String(p.kg||'')))continue;
    const g=R.gewerkKurz(p.gewerk);if(!gruppen.has(g))gruppen.set(g,[]);gruppen.get(g).push(p);
  }
  const codes=[...gruppen.keys()].sort((a,b)=>(a===''?1:0)-(b===''?1:0)||a.localeCompare(b,'de'));
  let html='';
  for(const c of codes){
    const s=calc.gewerke.get(c)||{bekanntCent:0n,anzahl:0,offen:0},name=c?(st.gewerke?.[c]||''):'Ohne Gewerk';
    html+='<div class="pos grp" role="row">'+zelle('kg','')+zelle('gw','<strong>'+esc(c||'–')+'</strong>')+
      zelle('bez','<span class="bez-zeile"><strong>'+esc(name||'Gewerk '+c)+'</strong>'+(s.offen?'<span class="chip chip-att">'+s.offen+' offen</span>':'')+'</span><small>'+s.anzahl+(s.anzahl===1?' Position':' Positionen')+'</small>')+
      zelleMitte('')+zelle('netto',euroGenau(s.bekanntCent))+zelle('brutto',euroGenau(bruttoVon(s.bekanntCent)))+zelle('quelle','')+zelle('kom','')+'</div>';
    html+=gruppen.get(c).sort((a,b)=>String(a.kg).localeCompare(String(b.kg))).map(p=>zeilePosition(p,ergebnis.get(p.id),{mitKg:true})).join('');
  }
  return html;
}
function panelKg(kg){
  const n=calc.knoten.get(kg);if(!n)return '';
  const kinder=kinderVon(kg),poss=positionenIn(kg),markiert=st.gruppen?.[kg]?.status==='entfaellt',mit=entfaelltMit(kg),v=vorlage(kg);
  const els=elementeIn(kg),elIds=new Set(els.map(e=>e.id));
  const pau=n.status==='enthalten'?pauschalIn(kg):'';
  let stand;
  const vom=n.vorbelegt&&n.blatt?' Vom Muster vorbelegt: zählt erst als geklärt, wenn du es für dieses Projekt bestätigst.':'';
  if(mit)stand='Entfällt mit KG '+mit+(st.gruppen[mit].notiz?': '+st.gruppen[mit].notiz:'')+'.'+vom;
  else if(markiert)stand='Entfällt. Was hier steht, zählt nicht zur Summe und nicht als offen.'+(st.gruppen[kg].vorbelegt?' Vom Muster vorbelegt: zählt erst als geklärt, wenn du es für dieses Projekt bestätigst.':'');
  else if(n.blatt)stand={leer:'Ohne Ansatz: noch nicht entschieden. Eine Position oder ein Element anlegen oder «entfällt» setzen.',frei:'Optional. Bleibt sie leer, zählt sie nicht als offen.',
    enthalten:'In der Pauschale von KG '+pau+' enthalten.',offen:n.offen+(n.offen===1?' Position ist':' Positionen sind')+' noch nicht vollständig belegt.',
    vollstaendig:'Vollständig belegt.',entfaellt:'Alle Positionen entfallen.'}[n.status]||'';
  else stand=n.geklaert+' von '+n.kgGesamt+' Kostengruppen geklärt'+(n.zuKlaeren?', '+n.zuKlaeren+' zu klären':'')+'.';
  let html='<section class="card panel"><p class="kicker">Kostengruppe · '+['','1. Ebene','2. Ebene','3. Ebene'][R.ebene(kg)]+'</p><h2>'+esc(kgName(kg))+'</h2>'+
    '<p class="meta">'+esc(stand)+(n.bekanntCent>0n?' <strong style="color:var(--kb-ink)">'+R.euro(n.bekanntCent,{nachkomma:true})+'</strong> netto':'')+'</p>'+
    (v.hinweis?'<p class="meta hinweis">'+esc(v.hinweis)+'</p>':'');
  if(kannBearbeiten&&!mit){
    html+='<div class="kg-akt">';
    if(markiert){
      html+='<div class="form" style="width:100%">'+feld('Begründung','gruppe:'+kg+':notiz',st.gruppen[kg].notiz||'',{attr:'placeholder="z. B. nicht vorhanden"'})+'</div>'+
        (st.gruppen[kg].vorbelegt?'<button type="button" class="btn btn-primary" data-act="kg-bestaetigen" data-kg="'+esc(kg)+'">Für dieses Projekt bestätigen</button>':'')+
        '<button type="button" class="btn" data-act="kg-wieder" data-kg="'+esc(kg)+'">Wieder aufnehmen</button>';
    }else{
      html+=(kinder.length?'':'<button type="button" class="btn btn-primary" data-act="pos-neu" data-kg="'+esc(kg)+'">'+ICON_PLUS+'Position anlegen</button>'+
        '<button type="button" class="btn" data-act="el-neu" data-kg="'+esc(kg)+'">'+ICON_PLUS+'Element anlegen</button>')+
        '<button type="button" class="btn" data-act="kg-entfaellt" data-kg="'+esc(kg)+'">Entfällt</button>';
      if(kinder.length){
        const rest=blaetterUnter(kg).filter(b=>calc.blaetter.get(b)==='leer');
        html+='<button type="button" class="btn" data-act="pos-neu" data-kg="'+esc(kg)+'">'+ICON_PLUS+'Pauschale für die ganze KG</button>'+
          (rest.length?'<button type="button" class="btn" data-act="kg-rest" data-kg="'+esc(kg)+'">Übrige '+rest.length+' ohne Ansatz: entfällt</button>':'');
      }
    }
    html+='</div>';
  }
  if(!kinder.length&&!markiert&&!mit)html+='<p class="meta" style="margin-top:10px">Ein <strong>Element</strong> fasst mehrere Positionen zusammen, etwa «WDVS Mineralwolle 160–200 mm + Putz» mit Dämmung, Putz und Anschlüssen; die Summe steht am Element.</p>';
  const posName=p=>p.titel&&p.titel!==titel(p.kg)?p.titel:(p.bauteiltyp||'Position');
  const posZeile=p=>{const r=calc.positionen.find(x=>x.id===p.id);return '<button type="button" class="kg-kind" data-act="waehle" data-id="'+esc(p.id)+'"><span>'+esc(posName(p))+'</span><span class="num">'+(r?.betragCent!=null?R.euro(r.betragCent):'offen')+'</span></button>'};
  const direkt=poss.filter(p=>!elIds.has(p.element));
  if(direkt.length)html+='<p class="sec">'+(kinder.length?'Pauschale':'Positionen')+'</p>'+direkt.map(posZeile).join('');
  if(els.length)html+='<p class="sec">Elemente</p>'+els.map(e=>{const s=calc.elemente?.get(e.id);
    return '<button type="button" class="kg-kind" data-act="el" data-id="'+esc(e.id)+'"><span>'+esc(e.titel||'Element ohne Namen')+'</span><span class="num">'+(s?R.euro(s.bekanntCent):'–')+'</span></button>'}).join('');
  if(kinder.length)html+='<p class="sec">Kostengruppen</p>'+kinder.map(c=>'<button type="button" class="kg-kind" data-act="kg" data-kg="'+esc(c.kg)+'"><span><span class="kg">'+esc(c.kg)+'</span>'+esc(c.titel)+'</span>'+chipKg(calc.knoten.get(c.kg))+'</button>').join('');
  return html+'</section>';
}
function panelElement(el){
  const s=calc.elemente?.get(el.id)||{bekanntCent:0n,anzahl:0,offen:0};
  const poss=(st.positionen||[]).filter(p=>p.element===el.id);
  let html='<section class="card panel"><p class="kicker">Element · KG '+esc(el.kg)+'</p><h2>'+esc(el.titel||'Neues Element')+'</h2>'+
    '<p class="meta">'+s.anzahl+(s.anzahl===1?' Position':' Positionen')+(s.offen?', '+s.offen+' offen':'')+' · <strong style="color:var(--kb-ink)">'+R.euro(s.bekanntCent,{nachkomma:true})+'</strong> netto</p>'+
    '<p style="margin:8px 0 0"><button type="button" class="btn btn-quiet" style="padding:0;min-height:0" data-act="kg" data-kg="'+esc(el.kg)+'">Zur KG '+esc(el.kg)+'</button></p>'+
    '<div class="form" style="margin-top:14px">'+feld('Bezeichnung','el:'+el.id+':titel',el.titel,{attr:'placeholder="z. B. WDVS Mineralwolle 160–200 mm + Putz"'})+
    feld('Kommentar','el:'+el.id+':notiz',el.notiz,{attr:'placeholder="z. B. Angabe Hersteller"'})+'</div>';
  if(kannBearbeiten)html+='<div class="kg-akt"><button type="button" class="btn btn-primary" data-act="pos-neu" data-kg="'+esc(el.kg)+'" data-el="'+esc(el.id)+'">'+ICON_PLUS+'Position im Element</button>'+
    '<button type="button" class="btn" data-act="el-loesen" data-id="'+esc(el.id)+'">Element auflösen</button>'+
    '<button type="button" class="btn btn-danger" data-act="el-weg" data-id="'+esc(el.id)+'">'+(ui.loeschen===el.id?'Wirklich löschen?':'Mit Positionen löschen')+'</button></div>'+
    '<p class="meta" style="margin-top:8px">Auflösen lässt die Positionen in der KG stehen; Löschen entfernt das Element mit seinen Positionen.</p>';
  if(poss.length)html+='<p class="sec">Positionen</p>'+poss.map(p=>{const r=calc.positionen.find(x=>x.id===p.id);
    return '<button type="button" class="kg-kind" data-act="waehle" data-id="'+esc(p.id)+'"><span>'+esc(p.titel||'Position')+'</span><span class="num">'+(r?.betragCent!=null?R.euro(r.betragCent):'offen')+'</span></button>'}).join('');
  return html+'</section>';
}
function vorbelegtHinweis(kg){
  return '<span class="meta vorbelegt">Vom Muster vorbelegt'+(kannBearbeiten?' · <button type="button" class="link" data-act="kg-bestaetigen" data-kg="'+esc(kg)+'">für dieses Projekt bestätigen</button>':'')+'</span>';
}
function feld(label,key,wert,{attr='',typ='text',hinweis=''}={}){
  return '<label class="feld">'+esc(label)+'<input type="'+typ+'" data-key="'+esc(key)+'" value="'+esc(wert??'')+'"'+(kannBearbeiten?'':' readonly')+' '+attr+'>'+(hinweis?'<span class="meta" style="font-weight:400">'+esc(hinweis)+'</span>':'')+'</label>';
}
function auswahl(label,key,wert,optionen,hinweis=''){
  return '<label class="feld">'+esc(label)+'<select data-key="'+esc(key)+'"'+(kannBearbeiten?'':' disabled')+'>'+optionen.map(([v,t])=>'<option value="'+esc(v)+'"'+(String(v)===String(wert??'')?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select>'+
    (hinweis?'<span class="meta" style="font-weight:400">'+esc(hinweis)+'</span>':'')+'</label>';
}
function haken(label,key,an){return '<label class="check"><input type="checkbox" data-key="'+esc(key)+'"'+(an?' checked':'')+(kannBearbeiten?'':' disabled')+'>'+esc(label)+'</label>'}
function schalterAn(kw,name){if(typeof kw?.[name]==='boolean')return kw[name];return !!R.ARTEN[kw?.art]?.[name]}
function panelPosition(p,r){
  const k='pos:'+p.id+':';const kw=p.kennwert||{};
  const artOpt=[['','Bitte wählen'],...Object.entries(R.ARTEN).map(([a,x])=>[a,x.label])];
  const qOpt=[['','wie die Kostenberechnung'],...quartale(kw.kostenstand).map(q=>[q,R.quartalText(q)])];
  const gruppe=KG_MUSTER.test(String(p.kg||''))&&kinderVon(p.kg).length>0;
  const els=KG_MUSTER.test(String(p.kg||''))?elementeIn(p.kg):[];
  const el=els.find(e=>e.id===p.element);
  let html='<section class="card panel"><p class="kicker">'+(gruppe?'Pauschale':'Position')+(el?' · Element «'+esc(kurz(el.titel||'ohne Namen',40))+'»':'')+'</p><h2>'+esc(kgName(p.kg)||'Neue Position')+'</h2>'+
    '<p class="meta">'+(r.status==='entfaellt'?(p.archivNichtInSumme?'nicht in der Summe der Kostenberechnung':'entfällt'):r.betragCent!==null?(p.modus==='betrag'?'Betrag ':esc(R.zahl(p.menge,2))+' '+esc(p.einheit||'')+' × '+R.euro(r.kennwertCent,{nachkomma:true})+' = ')+'<strong style="color:var(--kb-ink)">'+R.euro(r.betragCent,{nachkomma:true})+'</strong> netto':
      'Offen: '+esc(r.fehlt.map(f=>({kg:'Kostengruppe',menge:'Menge',betrag:'Betrag',kennwert:'Kennwert',mengenquelle:'Herkunft der Menge',quelle:'Quelle',fundstelle:'Fundstelle'}[f]||f)).join(', ')))+'</p>'+
    (gruppe?'<p class="meta hinweis">Gilt für die ganze KG '+esc(p.kg)+'. Ihre Unter-Kostengruppen ohne eigene Position gelten als enthalten.</p>':'')+
    (p.assistent?'<p class="meta">Vom Assistenten vorgeschlagen, übernommen am '+esc(datum(p.assistent))+'.</p>':'')+
    (KG_MUSTER.test(String(p.kg||''))?'<p style="margin:8px 0 0"><button type="button" class="btn btn-quiet" style="padding:0;min-height:0" data-act="kg" data-kg="'+esc(p.kg)+'">Zur KG '+esc(p.kg)+'</button></p>':'')+
    (P&&p.modus!=='betrag'?'<div class="pool-auf"><button type="button" class="btn" data-act="pool" data-id="'+esc(p.id)+'">Kennwert aus eigenen Projekten</button>'+
      '<span class="meta">'+(istArchiv?'Vergleichen mit den anderen Kostenberechnungen des Büros.':'Werte mit Herkunft aus den Kostenberechnungen des Büros, auch aus dem Kostenarchiv.')+'</span></div>':'')+
    '<div class="form" style="margin-top:14px"><div class="two">'+feld('Kostengruppe',k+'kg',p.kg,{attr:'list="kbKgListe" inputmode="numeric" maxlength="3"'})+feld('Gewerk (GW)',k+'gewerk',p.gewerk,{attr:'list="kbGwListe" maxlength="8" placeholder="z. B. BM"'})+'</div>'+
    feld('Bezeichnung',k+'titel',p.titel&&p.titel!==titel(p.kg)?p.titel:'',{attr:'placeholder="'+esc(gruppe?'Pauschal für KG '+p.kg:'z. B. Wärmedämmung Mineralfaser 200 mm')+'"'})+
    '<div class="two">'+feld('Ort',k+'ort',p.ort,{attr:'placeholder="z. B. EG / OG"'})+
    (els.length?auswahl('Element',k+'element',p.element||'',[['','– kein Element –'],...els.map(e=>[e.id,e.titel||'Element ohne Namen'])]):feld('Bauteiltyp',k+'bauteiltyp',p.bauteiltyp,{attr:'placeholder="z. B. AW-01"'}))+'</div>'+
    (els.length?feld('Bauteiltyp',k+'bauteiltyp',p.bauteiltyp,{attr:'placeholder="z. B. AW-01"'}):'')+
    feld('Kommentar',k+'notiz',p.notiz)+
    '<div class="seg" role="group" aria-label="Berechnung"><button type="button" data-act="modus" data-id="'+esc(p.id)+'" data-wert="menge" aria-pressed="'+(p.modus!=='betrag')+'"'+(kannBearbeiten?'':' disabled')+'>Menge × EP</button>'+
    '<button type="button" data-act="modus" data-id="'+esc(p.id)+'" data-wert="betrag" aria-pressed="'+(p.modus==='betrag')+'"'+(kannBearbeiten?'':' disabled')+'>Pauschal</button></div>';
  if(p.modus==='betrag'){
    html+='<div class="two">'+feld('Betrag netto (€)',k+'betrag',R.zahl(p.betrag,2),{attr:'inputmode="decimal"'})+auswahl('Quelle',k+'kennwert.art',kw.art,artOpt)+'</div>'+
      feld('Fundstelle',k+'kennwert.fundstelle',kw.fundstelle,{attr:'placeholder="z. B. Kostenbeitrag HLS vom …"'});
  }else{
    html+='<div class="two">'+feld('Menge',k+'menge',R.zahl(p.menge,3),{attr:'inputmode="decimal"'})+
      auswahl('Einheit',k+'einheit',p.einheit||'m²',R.EINHEITEN.map(e=>[e,e]))+'</div>'+
      auswahl('Herkunft der Menge',k+'mengenquelle.art',p.mengenquelle?.art||'',[['','Bitte wählen'],...Object.entries(R.MENGENQUELLEN)])+
      feld('Mengennachweis',k+'mengenquelle.text',p.mengenquelle?.text,{attr:'placeholder="z. B. Auswertung Archicad vom …"'})+
      '<p class="sec">Einheitspreis (Kennwert)</p><div class="two">'+feld('Wert laut Quelle (€ je '+(p.einheit||'Einheit')+')',k+'kennwert.wert',R.zahl(kw.wert,4),{attr:'inputmode="decimal"'})+auswahl('Quelle',k+'kennwert.art',kw.art,artOpt)+'</div>'+
      feld('Fundstelle',k+'kennwert.fundstelle',kw.fundstelle,{attr:'placeholder="z. B. BKI Bauelemente 2026, S. …"'})+
      auswahl('Kostenstand des Kennwerts',k+'kennwert.kostenstand',kw.kostenstand||'',qOpt)+
      '<div>'+haken('Wert enthält Umsatzsteuer (brutto)',k+'kennwert.brutto',schalterAn(kw,'brutto'))+haken('Regionalfaktor anwenden',k+'kennwert.regional',schalterAn(kw,'regional'))+
      haken('Zuschlag für Gemeinkosten, Wagnis und Gewinn',k+'kennwert.zuschlag',schalterAn(kw,'zuschlag'))+haken('Mit dem Baupreisindex fortschreiben',k+'kennwert.indexieren',kw.indexieren!==false)+'</div>';
    if(r.kette?.schritte?.length){
      html+='<p class="sec">Herkunft des Kennwerts</p>'+r.kette.schritte.map(s=>{
        const wert=R.euro(R.centAusMikro(s.ergebnis),{nachkomma:true});
        if(s.art==='start')return '<div class="step"><p>'+esc(s.text)+'</p><p class="num">'+wert+'</p>'+(s.detail?'<p class="meta">'+esc(s.detail)+'</p><p></p>':'')+'</div>';
        if(s.art==='ende')return '<div class="step ende"><p>'+esc(s.text)+'</p><p class="num">'+wert+' netto</p></div>';
        return '<div class="step"><p>'+esc(s.text)+'</p><p class="num">'+s.op+' '+esc(R.zahl(R.textAusMikro(s.faktor),6))+' = '+wert+'</p>'+(s.detail?'<p class="meta">'+esc(s.detail)+'</p><p></p>':'')+'</div>';
      }).join('')+r.hinweise.filter(h=>h!=='index_vorlaeufig').map(h=>'<p class="meta att" style="margin-top:6px">'+esc({index_fehlt:'Baupreisindex für '+(R.quartalText(kw.kostenstand)||'den Kostenstand')+' oder '+R.quartalText(st.kostenstand)+' fehlt (Quellen).',
        regionalfaktor_fehlt:'Regionalfaktor fehlt (Quellen).',zuschlag_fehlt:'Zuschlag fehlt (Quellen).',nicht_mehr_im_modell:'Diese Menge kam aus Archicad und fehlt im letzten Import.'}[h]||h)+'</p>').join('');
    }
  }
  if(kannBearbeiten)html+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">'+
    '<button type="button" class="btn" data-act="hoch" data-id="'+esc(p.id)+'" aria-label="Position nach oben">↑</button>'+
    '<button type="button" class="btn" data-act="runter" data-id="'+esc(p.id)+'" aria-label="Position nach unten">↓</button>'+
    '<button type="button" class="btn" data-act="kopie" data-id="'+esc(p.id)+'">Duplizieren</button>'+
    '<button type="button" class="btn" data-act="entfaellt" data-id="'+esc(p.id)+'">'+(p.status==='entfaellt'?'Wieder aufnehmen':'Entfällt')+'</button>'+
    '<button type="button" class="btn btn-danger" data-act="loeschen" data-id="'+esc(p.id)+'">'+(ui.loeschen===p.id?'Wirklich löschen?':'Löschen')+'</button></div>';
  return html+'</div></section>';
}

// ---------- Datenpool: Kennwert aus eigenen Projekten ----------
function poolStart(p){
  const eigen=p.titel&&p.titel!==titel(p.kg)?p.titel:'';
  return {id:p.id,text:eigen,verwandt:false,alleKg:!KG_MUSTER.test(String(p.kg||'')),nurAngebote:false,nurNeubau:false,andereEinheiten:false};
}
async function ladePool(){
  if(poolLaedt)return poolLaedt;
  poolLaedt=(async()=>{
    const {data,error}=await sb.from('office_kosten_instances').select('id,project_number,project_name,is_archived,state').limit(300);
    if(error)poolDaten={fehler:'Der Datenpool ist gerade nicht erreichbar.',eintraege:[],instanzen:0};
    else{const andere=(data||[]).filter(i=>i.id!==doc?.id);poolDaten={eintraege:P.eintraege(andere,R),instanzen:andere.length}}
    zeigePoolErgebnis();
  })();
  return poolLaedt;
}
function zeigePoolErgebnis(){
  const p=ui.pool&&(st?.positionen||[]).find(x=>x.id===ui.pool.id),el=root.querySelector('#kbPoolErgebnis');
  if(p&&el)el.innerHTML=poolErgebnis(p);
}
function poolChip(f,text,an){return '<button type="button" class="chip" data-act="pool-filter" data-f="'+f+'" aria-pressed="'+!!an+'">'+esc(text)+'</button>'}
function panelPool(p){
  const o=ui.pool,mitKg=KG_MUSTER.test(String(p.kg||'')),verwandt=mitKg?P.VERWANDT[p.kg]||[]:[];
  const chips=(mitKg?poolChip('kg','nur KG '+p.kg,!o.alleKg):'')+(verwandt.length&&!o.alleKg?poolChip('verwandt','auch KG '+verwandt.join(', '),o.verwandt):'')+
    poolChip('angebote','nur Angebote',o.nurAngebote)+poolChip('neubau','nur Neubau',o.nurNeubau)+poolChip('einheiten','auch andere Einheiten',o.andereEinheiten);
  return '<section class="card panel pool" aria-label="Kennwert aus eigenen Projekten"><p class="kicker">Datenpool</p><h2>Kennwert aus eigenen Projekten</h2>'+
    '<p class="meta">Für '+esc(kgName(p.kg)||'die Position')+(p.titel&&p.titel!==titel(p.kg)?' · '+esc(kurz(p.titel,60)):'')+(p.einheit?' · je '+esc(p.einheit):'')+'</p>'+
    '<div class="form" style="margin-top:12px"><label class="feld">Suchen in allen Kostenberechnungen<input type="search" data-pool="suche" value="'+esc(o.text)+'" placeholder="z. B. Parkett, XPS, Innentür" autocomplete="off"></label></div>'+
    '<div class="filter pool-filter" role="group" aria-label="Filter des Datenpools">'+chips+'</div>'+
    '<div id="kbPoolErgebnis" aria-live="polite">'+poolErgebnis(p)+'</div>'+
    '<p style="margin:14px 0 0"><button type="button" class="btn btn-quiet" style="padding:0;min-height:0" data-act="pool-zu">‹ Zurück zur Position</button></p></section>';
}
function standText(e){return e.dokument||(e.kostenstand?R.quartalText(e.kostenstand):'')}
function poolGruppeHtml(g,p,stat){
  const u=g.ursprung,n=P.normiere(g.epCent,u.kostenstand,st,R),auff=stat.auffaellig.has(g.key);
  const chips=(g.kopie?'<span class="chip chip-src">gleich in '+g.projekte.length+' Kostenberechnungen</span>':'')+(auff?'<span class="chip chip-att">auffällig</span>':'')+
    (g.nichtInSumme?'<span class="chip chip-mute">nicht in der Summe</span>':'')+(g.abgerechnet?'<span class="chip chip-ok">abgerechnet</span>':'');
  const index=n.gleich?'':n.fehlt?'Stand '+R.quartalText(u.kostenstand)+' · ohne Baupreisindex unverändert':
    '≈ '+euroEp(n.cent,g.einheit)+' mit dem Baupreisindex '+R.quartalText(u.kostenstand)+' → '+R.quartalText(st.kostenstand)+(n.vorlaeufig?' (Index bis '+R.quartalText(n.vorlaeufig)+')':'');
  const jahre=[...new Set(g.vorkommen.map(e=>String(e.kostenstand).slice(0,4)).filter(Boolean))].sort();
  const kopie=g.kopie?'<p class="meta hinweis">Derselbe Wert in '+g.projekte.length+' Kostenberechnungen'+(jahre.length>1?' ('+jahre[0]+'–'+jahre[jahre.length-1]+')':'')+
    ': vermutlich übernommen, zählt als eine Quelle'+(g.vorkommen.some(e=>e.herkunft==='angebot')?'':', ohne Angebot')+'. Kostenstand ist der des ältesten Vorkommens.</p>':'';
  const liste='<ul class="pool-vork">'+g.vorkommen.slice(0,6).map(e=>'<li><strong>'+esc(e.nr)+'</strong> '+esc(e.projekt)+(e.quelle?' · '+esc(e.quelle):'')+' · '+esc(kurz(e.bez,70))+
    '<br><span class="meta">'+(e.menge?esc(R.zahl(e.menge,2))+' '+esc(e.einheit)+' · ':'')+esc(standText(e))+' · '+esc(P.HERKUNFT[e.herkunft]||'')+' · '+esc(reifegradText(e.reifegrad))+
    (e.nichtInSumme?' · nicht in der Summe':'')+'</span></li>').join('')+(g.vorkommen.length>6?'<li class="meta">… und '+(g.vorkommen.length-6)+' weitere</li>':'')+'</ul>';
  const knopf=g.passt===false?'<p class="meta">Andere Einheit ('+esc(g.einheit)+'): nur zum Vergleich.</p>':
    kannBearbeiten&&p.modus!=='betrag'?'<button type="button" class="btn btn-primary" data-act="pool-nehmen" data-gruppe="'+esc(g.key)+'">Als Kennwert übernehmen</button>':'';
  return '<article class="pool-gruppe'+(auff?' auffaellig':'')+'"><div class="pool-kopf"><strong class="num">'+euroEp(g.epCent,g.einheit)+'</strong>'+chips+'</div>'+
    (index?'<p class="meta">'+esc(index)+'</p>':'')+kopie+liste+knopf+'</article>';
}
function poolErgebnis(p){
  if(poolDaten===null){void ladePool();return '<p class="meta">Kennwerte werden geladen …</p>'}
  if(poolDaten.fehler)return '<p class="meta att">'+esc(poolDaten.fehler)+'</p>';
  const o=ui.pool,mitKg=KG_MUSTER.test(String(p.kg||''));
  const treffer=P.suche(poolDaten.eintraege,{text:o.text,kg:mitKg?p.kg:'',verwandt:o.verwandt,alleKg:o.alleKg||!mitKg,einheit:p.einheit||'',
    andereEinheiten:o.andereEinheiten,nurAngebote:o.nurAngebote,nurNeubau:o.nurNeubau,ohneInstanz:doc?.id});
  const gruppen=P.gruppiere(treffer);ui.poolGruppen=new Map(gruppen.map(g=>[g.key,g]));
  if(!gruppen.length)return '<p class="meta" style="margin-top:12px">Nichts gefunden'+(o.alleKg||!mitKg?'':' in KG '+esc(p.kg))+'. Ein anderes Wort'+
    (o.alleKg||!mitKg?'':', «auch KG …» oder alle Kostengruppen')+' versuchen.</p>'+(o.alleKg||!mitKg?'':'<p><button type="button" class="btn" data-act="pool-filter" data-f="kg">In allen Kostengruppen suchen</button></p>');
  const stat=P.statistik(gruppen,st,R),eh=p.einheit||gruppen[0].einheit;
  const satz={gleich:'Alle Werte im Kostenstand dieser Kostenberechnung.',
    fortgeschrieben:'Spanne und Median auf '+R.quartalText(st.kostenstand)+' fortgeschrieben, mit dem Baupreisindex dieser Kostenberechnung.',
    ohneIndex:'Werte wie eingetragen: der Baupreisindex für ihre Quartale fehlt hier noch (Quellen › Baupreisindex). Ein übernommener Kennwert wird fortgeschrieben, sobald er eingetragen ist.'}[stat.stand];
  const neu=gruppen.filter(g=>!g.bestand),bestand=gruppen.filter(g=>g.bestand);
  return '<p class="pool-sum"><strong>'+treffer.length+(treffer.length===1?' Wert':' Werte')+'</strong> aus '+stat.projekte+(stat.projekte===1?' Kostenberechnung':' Kostenberechnungen')+
      ' · '+stat.n+' unabhängig'+(stat.n>=2?' · Spanne '+euroEp(stat.minCent)+' bis '+euroEp(stat.maxCent,eh):'')+(stat.n>=3?' · Median '+euroEp(stat.medianCent,eh):'')+'</p>'+
    '<p class="meta">'+esc(satz)+(stat.n>0&&stat.n<5?' Wenige Werte: die Spanne ist eine Orientierung, keine Statistik.':'')+'</p>'+
    neu.map(g=>poolGruppeHtml(g,p,stat)).join('')+
    (bestand.length?'<p class="sec">Im Bestand (Sanierung, Umbau)</p>'+bestand.map(g=>poolGruppeHtml(g,p,stat)).join(''):'')+
    '<p class="meta" style="margin-top:12px">Gefunden in '+stat.projekte+' von '+poolDaten.instanzen+' Kostenberechnungen. Pauschalen und Beträge ohne Einheit sind keine Kennwerte.</p>'+
    '<p class="meta" style="margin-top:6px"><a href="./produktbibliothek.html?suche='+encodeURIComponent(o.text||'')+'" target="_blank" rel="noopener noreferrer">In der Produktbibliothek suchen ›</a> '+
    'Ein Angebot zum gewählten Produkt ist die bessere Quelle als ein alter Ansatz.</p>';
}

// Quellen und Grundlagen
function tabQuellen(){
  const letzter=letzterIndex(),ohneIndex=q=>!!letzter&&R.quartalIndex(q)>R.quartalIndex(letzter);
  const standOpt=quartale(st.kostenstand).map(q=>[q,R.quartalText(q)+(ohneIndex(q)?' · Index noch nicht veröffentlicht':'')]);
  const indizes=(st.indizes||[]).map((x,i)=>'<tr><td>'+'<select data-key="index:'+i+':quartal" aria-label="Quartal"'+(kannBearbeiten?'':' disabled')+'>'+quartale(x.quartal).map(q=>[q,R.quartalText(q)]).map(([v,t])=>'<option value="'+v+'"'+(v===x.quartal?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></td>'+
    '<td><input type="text" inputmode="decimal" data-key="index:'+i+':wert" value="'+esc(R.zahl(x.wert,1))+'" aria-label="Indexwert"'+(kannBearbeiten?'':' readonly')+'></td>'+
    '<td>'+(kannBearbeiten?'<button type="button" class="btn btn-quiet" data-act="index-weg" data-i="'+i+'" aria-label="Zeile entfernen">Entfernen</button>':'')+'</td></tr>').join('');
  const gruppen=(st.katalog||[]).filter(k=>R.ebene(k.kg)===1).map(k=>{const g=st.gruppen?.[k.kg]||{};return '<tr><td><span class="kg">'+esc(k.kg)+'</span>'+esc(k.titel)+'</td>'+
    '<td>'+haken('entfällt','gruppe:'+k.kg+':status',g.status==='entfaellt')+'</td><td><input type="text" data-key="gruppe:'+k.kg+':notiz" value="'+esc(g.notiz||'')+'" aria-label="Begründung"'+(kannBearbeiten?'':' readonly')+'>'+
    (g.vorbelegt?vorbelegtHinweis(k.kg):'')+'</td></tr>'}).join('');
  const weitere=Object.entries(st.gruppen||{}).filter(([kg,g])=>g?.status==='entfaellt'&&R.ebene(kg)>1).sort(([a],[b])=>a.localeCompare(b)).map(([kg,g])=>
    '<tr><td><span class="kg">'+esc(kg)+'</span>'+esc(titel(kg))+'</td><td><input type="text" data-key="gruppe:'+esc(kg)+':notiz" value="'+esc(g.notiz||'')+'" aria-label="Begründung KG '+esc(kg)+'"'+(kannBearbeiten?'':' readonly')+'>'+
    (g.vorbelegt?vorbelegtHinweis(kg):'')+'</td>'+
    '<td>'+(kannBearbeiten?'<button type="button" class="btn btn-quiet" data-act="kg-wieder" data-kg="'+esc(kg)+'">Wieder aufnehmen</button>':'')+'</td></tr>').join('');
  const typen=bauteiltypen();
  const rezepte=typen.length?typen.map(t=>{
    const rz=st.rezepte?.[t.typ];
    const zeilen=(rz?.zeilen||[]).map((z,i)=>'<tr><td class="schmal"><input type="text" list="kbKgListe" inputmode="numeric" maxlength="3" data-key="rezept:'+t.typ+':'+i+':kg" value="'+esc(z.kg)+'" aria-label="Kostengruppe"'+(kannBearbeiten?'':' readonly')+'></td>'+
      '<td class="meta">'+esc(titel(z.kg))+'</td><td class="schmal"><input type="text" inputmode="decimal" data-key="rezept:'+t.typ+':'+i+':faktor" value="'+esc(R.zahl(z.faktor,3))+'" aria-label="Faktor"'+(kannBearbeiten?'':' readonly')+'></td>'+
      '<td>'+(kannBearbeiten?'<button type="button" class="btn btn-quiet" data-act="rezept-weg" data-typ="'+esc(t.typ)+'" data-i="'+i+'">Entfernen</button>':'')+'</td></tr>').join('');
    return '<div style="padding:14px 0;border-top:1px solid var(--kb-line-soft)"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline">'+
      '<p style="margin:0"><strong>'+esc(t.typ)+'</strong> <span class="meta">· KG '+esc(t.kg)+(t.aufbau?' · '+esc(t.aufbau):'')+(t.menge?' · '+esc(t.menge):'')+'</span></p>'+
      (kannBearbeiten&&!rz?'<button type="button" class="btn" data-act="rezept-vorschlag" data-typ="'+esc(t.typ)+'" data-kg="'+esc(t.kg)+'">Rezept vorschlagen</button>':'')+'</div>'+
      (rz?'<div class="tbl"><table class="kb-table" style="margin-top:8px"><thead><tr><th>KG</th><th>Bezeichnung</th><th>Faktor</th><th></th></tr></thead><tbody>'+zeilen+'</tbody></table></div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:8px">'+auswahl('Einheit der Menge','rezepteinheit:'+t.typ,rz.einheit||'m²',[['m²','m²'],['m','m'],['m³','m³'],['St','St']])+
        (kannBearbeiten?'<button type="button" class="btn" data-act="rezept-zeile" data-typ="'+esc(t.typ)+'">'+ICON_PLUS+'Zeile</button><button type="button" class="btn btn-quiet" data-act="rezept-loesen" data-typ="'+esc(t.typ)+'">Rezept entfernen</button>':'')+'</div>':
        '<p class="meta" style="margin-top:6px">Ohne Rezept zählt die Menge nur in KG '+esc(t.kg)+'.</p>')+'</div>';
  }).join(''):'<p class="meta">Noch keine Bauteiltypen. Sie kommen mit dem ersten Archicad-Import.</p>';
  const quellen=[...new Map((st.positionen||[]).filter(p=>p.kennwert?.art&&p.status!=='entfaellt').map(p=>{const a=p.kennwert.art,f=String(p.kennwert.fundstelle||'').trim();return [a+'|'+f,{a,f}]})).values()]
    .sort((x,y)=>x.a.localeCompare(y.a)||x.f.localeCompare(y.f,'de'));
  return '<div class="grid-sec">'+
    '<section class="card"><h2 class="kb-h2">Kostenstand und Steuer</h2><div class="form" style="margin-top:12px"><div class="two">'+
      auswahl('Kostenstand der Kostenberechnung','st:kostenstand',st.kostenstand,standOpt,
        'Zeitpunkt der Ermittlung (DIN 276), höchstens das laufende Quartal.'+(letzter&&ohneIndex(st.kostenstand)?' Der Baupreisindex dafür erscheint erst nach dem Quartal; bis dahin wird bis '+R.quartalText(letzter)+' fortgeschrieben.':''))+
      feld('Umsatzsteuer (%)','st:ustProzent',R.zahl(st.ustProzent,2),{attr:'inputmode="decimal"'})+'</div>'+
      feld('Kostenvorgabe des Bauherrn, netto (€)','st:kostenvorgabe',R.zahl(st.kostenvorgabe,2),{attr:'inputmode="decimal"',hinweis:'Budget aus Vertrag oder Kostenrahmen'})+'</div></section>'+
    '<section class="card"><h2 class="kb-h2">Bezugsgrößen nach DIN 277</h2><div class="form" style="margin-top:12px"><div class="two">'+
      feld('BGF (m²)','st:bezug.BGF',R.zahl(st.bezug?.BGF,2),{attr:'inputmode="decimal"'})+feld('BRI (m³)','st:bezug.BRI',R.zahl(st.bezug?.BRI,2),{attr:'inputmode="decimal"'})+'</div><div class="two">'+
      feld('NUF (m²)','st:bezug.NUF',R.zahl(st.bezug?.NUF,2),{attr:'inputmode="decimal"'})+feld('Außenanlagenfläche AF (m²)','st:bezug.AF',R.zahl(st.bezug?.AF,2),{attr:'inputmode="decimal"'})+'</div>'+
      feld('Herkunft','st:bezugHerkunft',st.bezugHerkunft,{attr:'placeholder="z. B. Archicad, Auswertung Flächen DIN 277 vom …"'})+'</div></section>'+
    '<section class="card"><h2 class="kb-h2">Regionalfaktor und Zuschlag</h2><div class="form" style="margin-top:12px"><div class="two">'+
      feld('Regionalfaktor','st:regionalfaktor.wert',R.zahl(st.regionalfaktor?.wert,3),{attr:'inputmode="decimal"',hinweis:'Für BKI-Kennwerte (Bundesdurchschnitt)'})+
      feld('Fundstelle','st:regionalfaktor.fundstelle',st.regionalfaktor?.fundstelle,{attr:'placeholder="z. B. BKI 2026, Landkreis …"'})+'</div><div class="two">'+
      feld('Zuschlag (%)','st:zuschlag.wert',R.zahl(st.zuschlag?.wert,2),{attr:'inputmode="decimal"',hinweis:'Für Orientierungspreise ohne Gemeinkosten, Wagnis und Gewinn (Heinze)'})+
      feld('Begründung','st:zuschlag.notiz',st.zuschlag?.notiz)+'</div></div></section>'+
    '<section class="card"><h2 class="kb-h2">Baupreisindex</h2><p class="meta" style="margin:6px 0 10px">'+esc(st.indexReihe||'')+'. Werte vierteljährlich bei '+
      '<a href="https://www.destatis.de/DE/Themen/Wirtschaft/Preise/Baupreise-Immobilienpreisindex/_inhalt.html" target="_blank" rel="noopener noreferrer">Destatis</a> (frei, Datenlizenz Deutschland 2.0).</p>'+
      '<div class="tbl"><table class="kb-table"><thead><tr><th>Quartal</th><th>Index</th><th></th></tr></thead><tbody>'+(indizes||'<tr><td colspan="3" class="meta">Noch keine Werte.</td></tr>')+'</tbody></table></div>'+
      (kannBearbeiten?'<button type="button" class="btn" style="margin-top:10px" data-act="index-neu">'+ICON_PLUS+'Quartal</button>':'')+'</section>'+
    '<section class="card" style="grid-column:1/-1"><h2 class="kb-h2">Bauteiltypen und Rezepte</h2><p class="meta" style="margin:6px 0 4px">Ein Rezept verteilt die Archicad-Menge eines Bauteiltyps auf die Kostengruppen, die sein Aufbau enthält, zum Beispiel Außenwand auf 331, 335 und 336. Faktor 2 heißt: beide Seiten.</p>'+rezepte+'</section>'+
    '<section class="card" style="grid-column:1/-1"><h2 class="kb-h2">Kostengruppen, die entfallen</h2><p class="meta" style="margin:6px 0 8px">Was entfällt, zählt nicht zur Summe und nicht als offen. Ganze Gruppen der 1. Ebene hier; einzelne Kostengruppen in «Positionen» an der Kostengruppe.</p>'+
      '<div class="tbl"><table class="kb-table"><thead><tr><th>Kostengruppe</th><th></th><th>Begründung</th></tr></thead><tbody>'+gruppen+'</tbody></table></div>'+
      (weitere?'<div class="tbl"><table class="kb-table" style="margin-top:14px"><thead><tr><th>Weitere Kostengruppen</th><th>Begründung</th><th></th></tr></thead><tbody>'+weitere+'</tbody></table></div>':'')+'</section>'+
    gewerkeKarte()+
    '<section class="card" style="grid-column:1/-1"><h2 class="kb-h2">Quellenverzeichnis</h2><p class="meta" style="margin:6px 0 8px">Aus den Fundstellen der Positionen zusammengestellt.</p>'+
      (quellen.length?'<div class="tbl"><table class="kb-table"><thead><tr><th>Quelle</th><th>Fundstelle</th></tr></thead><tbody>'+quellen.map(q=>'<tr><td>'+esc(R.ARTEN[q.a]?.label||q.a)+'</td><td>'+esc(q.f||'–')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="meta">Noch keine Quellen.</p>')+'</section>'+
    '</div>';
}
function gewerkeKarte(){
  const codes=[...new Set([...(st.positionen||[]).map(p=>R.gewerkKurz(p.gewerk)).filter(Boolean),...Object.keys(st.gewerke||{})])].sort((a,b)=>a.localeCompare(b,'de'));
  return '<section class="card" style="grid-column:1/-1"><h2 class="kb-h2">Gewerke</h2><p class="meta" style="margin:6px 0 8px">Das Kürzel steht in der Spalte GW der Positionen, wie im Büro-Excel (etwa BM, PU, MA). Hier bekommt es seinen Namen. «Positionen · Gewerke» zeigt dieselben Positionen je Gewerk, etwa für die spätere Vergabe; die Summe bleibt dieselbe.</p>'+
    (codes.length?'<div class="tbl"><table class="kb-table"><thead><tr><th>GW</th><th>Bezeichnung</th><th class="num">Netto</th></tr></thead><tbody>'+codes.map(c=>'<tr><td><strong>'+esc(c)+'</strong></td><td>'+
      (kannBearbeiten?'<input data-key="gewerk:'+esc(c)+'" value="'+esc(st.gewerke?.[c]||'')+'" placeholder="Name des Gewerks" aria-label="Bezeichnung des Gewerks '+esc(c)+'">':esc(st.gewerke?.[c]||''))+
      '</td><td class="num">'+R.euro(calc.gewerke.get(c)?.bekanntCent||0n)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="meta">Noch keine Kürzel vergeben.</p>')+'</section>';
}
function bauteiltypen(){
  const m=new Map();
  for(const g of st.importe?.[0]?.gruppen||[])if(g.bauteiltyp&&!m.has(g.bauteiltyp)){const mass=I.hauptmass(g,st.rezepte?.[g.bauteiltyp]?.einheit);
    m.set(g.bauteiltyp,{typ:g.bauteiltyp,kg:g.kg,aufbau:g.aufbau,menge:g.mengen[mass]?R.zahl(g.mengen[mass],2)+' '+I.MASS_ZU_EINHEIT[mass]:''})}
  for(const typ of Object.keys(st.rezepte||{}))if(!m.has(typ))m.set(typ,{typ,kg:st.rezepte[typ].zeilen?.[0]?.kg||'',aufbau:'',menge:''});
  return [...m.values()].sort((a,b)=>a.kg.localeCompare(b.kg)||a.typ.localeCompare(b.typ,'de'));
}

// Vergleich
function tabVergleich(){
  const zeilen=calc.vergleich.map(v=>{const k=(st.katalog||[]).find(x=>x.kg===v.kg);
    return '<tr'+(v.entfaellt?' class="meta"':'')+'><td><span class="kg">'+esc(v.kg)+'</span>'+esc(k?.titel||'')+'</td>'+
      '<td><input type="text" inputmode="decimal" data-key="ks:'+v.kg+'" value="'+esc(R.zahl(st.kostenschaetzung?.[v.kg],2))+'" aria-label="Kostenschätzung KG '+esc(v.kg)+'"'+(kannBearbeiten?'':' readonly')+'></td>'+
      '<td class="num">'+(v.entfaellt?'entfällt':R.euro(v.kbCent))+'</td>'+
      '<td class="num '+(v.deltaCent>0n?'att':'')+'">'+(v.deltaCent===null?'–':R.euro(v.deltaCent,{vorzeichen:true}))+'</td>'+
      '<td class="num">'+R.prozent(v.deltaProzent,{vorzeichen:true})+'</td>'+
      '<td><input type="text" data-key="ursache:'+v.kg+'" value="'+esc(v.ursache)+'" placeholder="Ursache der Abweichung" aria-label="Ursache KG '+esc(v.kg)+'"'+(kannBearbeiten?'':' readonly')+'></td></tr>'}).join('');
  const ks=calc.ksSummeCent,d=calc.deltaSummeCent;
  return '<section class="card" style="padding:18px 20px"><h2 class="kb-h2">Kostenschätzung und Kostenberechnung</h2>'+
    '<p class="meta" style="margin:6px 0 12px">Werte der Kostenschätzung aus der LPH 2, netto, je Kostengruppe der 1. Ebene. Größere Abweichungen brauchen eine Ursache; sie geht in den Bericht.</p>'+
    '<div class="tbl"><table class="kb-table" style="min-width:760px"><thead><tr><th>Kostengruppe</th><th style="width:150px">Kostenschätzung (€)</th><th class="num">Kostenberechnung</th><th class="num">Abweichung</th><th class="num">%</th><th style="width:30%">Ursache</th></tr></thead>'+
    '<tbody>'+zeilen+'</tbody><tfoot><tr><td>Summe netto</td><td class="num">'+R.euro(ks)+'</td><td class="num">'+R.euro(calc.gesamt.bekanntCent)+'</td>'+
    '<td class="num">'+(d===null?'–':R.euro(d,{vorzeichen:true}))+'</td><td class="num">'+(ks?R.prozent(Number(R.teile(d*10000n,ks))/100,{vorzeichen:true}):'–')+'</td><td></td></tr>'+
    (calc.vorgabe.cent!==null?'<tr><td>Kostenvorgabe</td><td class="num">'+R.euro(calc.vorgabe.cent)+'</td><td></td><td class="num">'+R.euro(calc.vorgabe.differenzCent,{vorzeichen:true})+'</td><td></td><td></td></tr>':'')+
    '</tfoot></table></div></section>';
}

// Bericht
function tabBericht(){
  const st2=ui.staende;
  const steuerung='<div class="cols kb-noprint" style="margin-bottom:20px"><section class="card main" style="padding:18px 20px"><h2 class="kb-h2">Annahmen und Erläuterungen</h2>'+
    '<label class="feld" style="margin-top:10px">Text für den Bericht<textarea data-key="st:annahmen"'+(kannBearbeiten?'':' readonly')+' placeholder="Grundlagen, Annahmen, Ausschlüsse, Risiken">'+esc(st.annahmen||'')+'</textarea></label>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" class="btn btn-primary" data-act="drucken">Drucken oder als PDF sichern</button></div></section>'+
    (istMuster?'':'<aside class="side"><section class="card" style="padding:18px 20px"><h2 class="kb-h2">Stände</h2><p class="meta" style="margin:6px 0 10px">Einen Stand festhalten, etwa für die Kostenbesprechung. Er bleibt unverändert.</p>'+
      (kannBearbeiten?'<form id="kbStand" class="form"><label class="feld">Bezeichnung<input name="label" required maxlength="160" value="Kostenberechnung '+esc(datum(new Date().toISOString()))+'"></label><button class="btn" type="submit">Stand festhalten</button></form>':'')+
      (st2===null?'<p class="meta">Stände werden geladen …</p>':st2.length?st2.map(v=>'<div class="mini"><span>'+esc(v.label)+'<br><span class="meta">'+esc(datum(v.datum))+' · Revision '+esc(v.revision)+'</span></span><span class="num">'+esc(v.summe)+'</span></div>').join(''):'<p class="meta">Noch kein Stand festgehalten.</p>')+
      '</section></aside>')+'</div>';
  return steuerung+'<article class="card report" id="kbBericht">'+bericht()+'</article>';
}
// Betrag oder Stand einer Kostengruppe im Bericht.
function berichtWert(kg){
  const n=calc.knoten.get(kg);if(!n)return '–';
  if(n.status==='entfaellt')return 'entfällt';
  if(n.blatt){
    if(n.status==='enthalten')return 'in KG '+pauschalIn(kg)+' enthalten';
    if(n.status==='leer')return 'ohne Ansatz';
    if(n.status==='frei')return '–';
    return R.euro(n.bekanntCent)+(n.status==='offen'?' (offen)':'');
  }
  return R.euro(n.bekanntCent);
}
function bericht(){
  const g=calc.gesamt;
  const erste=(st.katalog||[]).filter(k=>R.ebene(k.kg)===1);
  const anteil=kg=>{const n=calc.knoten.get(kg);return n&&n.status!=='entfaellt'&&g.bekanntCent>0n&&n.bekanntCent>0n?R.prozent(Number(R.teile(n.bekanntCent*1000n,g.bekanntCent))/10):''};
  const ebene1='<div class="tbl"><table class="kb-table"><thead><tr><th>KG</th><th>Bezeichnung</th><th class="num">Betrag netto</th><th class="num">Anteil</th></tr></thead><tbody>'+
    erste.map(k=>'<tr><td>'+esc(k.kg)+'</td><td>'+esc(k.titel)+'</td><td class="num">'+esc(berichtWert(k.kg))+'</td><td class="num">'+anteil(k.kg)+'</td></tr>').join('')+'</tbody>'+
    '<tfoot><tr><td></td><td>Summe netto'+(g.vollstaendig?'':', vorläufig')+'</td><td class="num">'+R.euro(g.bekanntCent)+'</td><td></td></tr>'+
    '<tr><td></td><td>Umsatzsteuer '+esc(R.zahl(st.ustProzent))+' %</td><td class="num">'+R.euro(calc.ustCent)+'</td><td></td></tr>'+
    '<tr><td></td><td>Summe brutto</td><td class="num">'+R.euro(calc.bruttoCent)+'</td><td></td></tr></tfoot></table></div>';
  // Gliederung bis zur 3. Ebene: jede Kostengruppe mit Betrag oder Stand; entfallende Gruppen ohne ihre Unter-KG.
  let gl='';
  const pauschalZeilen=kg=>positionenIn(kg).filter(p=>{const r=calc.positionen.find(x=>x.id===p.id);return r&&!r.ausgeschlossen}).map(p=>{const r=calc.positionen.find(x=>x.id===p.id);
    return '<tr class="r3"><td></td><td>Pauschal für KG '+esc(kg)+(p.notiz?' · '+esc(p.notiz):'')+'</td><td class="num">'+(r.betragCent===null?'offen':r.status==='entfaellt'?'entfällt':R.euro(r.betragCent))+'</td><td class="num"></td></tr>'}).join('');
  for(const k1 of erste){
    gl+='<tr class="r1"><td>'+esc(k1.kg)+'</td><td>'+esc(k1.titel)+'</td><td class="num">'+esc(berichtWert(k1.kg))+'</td><td class="num">'+anteil(k1.kg)+'</td></tr>';
    if(calc.knoten.get(k1.kg)?.status==='entfaellt')continue;
    gl+=pauschalZeilen(k1.kg);
    for(const k2 of kinderVon(k1.kg)){
      const n2=calc.knoten.get(k2.kg),blatt2=!kinderVon(k2.kg).length;
      gl+='<tr class="'+(blatt2?'r2 blatt':'r2')+'"><td>'+esc(k2.kg)+'</td><td>'+esc(k2.titel)+'</td><td class="num">'+esc(berichtWert(k2.kg))+'</td><td class="num">'+anteil(k2.kg)+'</td></tr>';
      if(blatt2||n2?.status==='entfaellt')continue;
      gl+=pauschalZeilen(k2.kg);
      for(const k3 of kinderVon(k2.kg))gl+='<tr class="r3"><td>'+esc(k3.kg)+'</td><td>'+esc(k3.titel)+'</td><td class="num">'+esc(berichtWert(k3.kg))+'</td><td class="num"></td></tr>';
    }
  }
  const ebene3='<div class="tbl"><table class="kb-table gliederung"><thead><tr><th>KG</th><th>Bezeichnung</th><th class="num">Betrag netto</th><th class="num">Anteil</th></tr></thead><tbody>'+gl+'</tbody></table></div>';
  // Positionen wie im Büro-Excel: je Kostengruppe, darin die Elemente mit Summe und ihre Positionen.
  const ergebnis=new Map(calc.positionen.map(r=>[r.id,r]));
  const posZeileB=(p,imEl)=>{const r=ergebnis.get(p.id),kw=p.kennwert||{},bet=p.modus==='betrag';
    const name=(p.titel&&p.titel!==titel(p.kg)?p.titel:[p.bauteiltyp,aufbauText(p)].filter(Boolean).join(' · '))||'Position';
    return '<tr class="'+(imEl?'p2':'p1')+'"><td></td><td>'+esc(p.gewerk||'')+'</td><td>'+esc(name)+'</td><td>'+esc(p.ort||'')+'</td>'+
      '<td class="num">'+(bet?'1':(R.dezimal(p.menge)?esc(R.zahl(p.menge,2)):''))+'</td><td>'+(bet?'psch':esc(p.einheit||''))+'</td>'+
      '<td class="num">'+(bet?euroGenau(r.betragCent):(r.kennwertCent===null?'':euroGenau(r.kennwertCent)))+'</td>'+
      '<td class="num">'+(r.status==='entfaellt'?'entfällt':r.betragCent===null?'offen':euroGenau(r.betragCent))+'</td>'+
      '<td class="num">'+(r.betragCent===null||r.status==='entfaellt'?'':euroGenau(bruttoVon(r.betragCent)))+'</td>'+
      '<td>'+esc([[R.ARTEN[kw.art]?.kurz,kw.fundstelle].filter(Boolean).join(' · '),p.notiz].filter(Boolean).join(' · '))+'</td></tr>'};
  const proKg=new Map();
  for(const p of st.positionen||[]){const r=ergebnis.get(p.id);if(!r||r.ausgeschlossen||!baum.eintrag.has(String(p.kg||'')))continue;if(!proKg.has(p.kg))proKg.set(p.kg,[]);proKg.get(p.kg).push(p)}
  let pz='';
  for(const kg of [...proKg.keys()].sort()){
    const n=calc.knoten.get(kg),liste=proKg.get(kg),els=elementeIn(kg),ids=new Set(els.map(e=>e.id)),b=n?.bekanntCent||0n;
    pz+='<tr class="kgk"><td>'+esc(kg)+'</td><td></td><td>'+esc(titel(kg))+'</td><td></td><td></td><td></td><td></td><td class="num">'+euroGenau(b)+'</td><td class="num">'+euroGenau(bruttoVon(b))+'</td><td></td></tr>'+
      liste.filter(p=>!ids.has(p.element)).map(p=>posZeileB(p,false)).join('');
    for(const el of els){
      const inEl=liste.filter(p=>p.element===el.id);if(!inEl.length)continue;const s=calc.elemente.get(el.id)?.bekanntCent||0n;
      pz+='<tr class="elk"><td></td><td></td><td>'+esc(el.titel||'Element')+'</td><td></td><td></td><td></td><td></td><td class="num">'+euroGenau(s)+'</td><td class="num">'+euroGenau(bruttoVon(s))+'</td><td>'+esc(el.notiz||'')+'</td></tr>'+
        inEl.map(p=>posZeileB(p,true)).join('');
    }
  }
  const herleitung=pz?'<div class="tbl"><table class="kb-table positionen-b"><thead><tr><th>KG</th><th>GW</th><th>Bezeichnung</th><th>Ort</th><th class="num">Menge</th><th>EH</th><th class="num">EP netto</th><th class="num">Netto</th><th class="num">Brutto</th><th>Quelle · Kommentar</th></tr></thead><tbody>'+pz+'</tbody></table></div>':
    '<p class="meta">Noch keine Positionen.</p>';
  const gwListe=[...calc.gewerke.entries()].filter(([c,s])=>c&&s.anzahl).sort((x,y)=>x[0].localeCompare(y[0],'de'));
  const ohneGw=calc.gewerke.get('');
  const gewerkeTab=gwListe.length?'<h3>Zusammenstellung nach Gewerken</h3><div class="tbl"><table class="kb-table"><thead><tr><th>GW</th><th>Gewerk</th><th class="num">Netto</th><th class="num">Brutto</th></tr></thead><tbody>'+
    gwListe.map(([c,s])=>'<tr><td>'+esc(c)+'</td><td>'+esc(st.gewerke?.[c]||'')+'</td><td class="num">'+euroGenau(s.bekanntCent)+'</td><td class="num">'+euroGenau(bruttoVon(s.bekanntCent))+'</td></tr>').join('')+
    (ohneGw?.anzahl?'<tr><td>–</td><td>ohne Gewerk</td><td class="num">'+euroGenau(ohneGw.bekanntCent)+'</td><td class="num">'+euroGenau(bruttoVon(ohneGw.bekanntCent))+'</td></tr>':'')+
    '</tbody><tfoot><tr><td></td><td>Summe</td><td class="num">'+euroGenau(g.bekanntCent)+'</td><td class="num">'+euroGenau(calc.bruttoCent)+'</td></tr></tfoot></table></div>':'';
  const vgl=calc.ksSummeCent===null?'<p class="meta">Keine Kostenschätzung eingetragen.</p>':'<div class="tbl"><table class="kb-table"><thead><tr><th>KG</th><th class="num">Kostenschätzung</th><th class="num">Kostenberechnung</th><th class="num">Abweichung</th><th>Ursache</th></tr></thead><tbody>'+
    calc.vergleich.filter(v=>!v.entfaellt).map(v=>'<tr><td>'+esc(v.kg)+'</td><td class="num">'+R.euro(v.ksCent)+'</td><td class="num">'+R.euro(v.kbCent)+'</td><td class="num">'+(v.deltaCent===null?'–':R.euro(v.deltaCent,{vorzeichen:true})+' · '+R.prozent(v.deltaProzent,{vorzeichen:true}))+'</td><td>'+esc(v.ursache)+'</td></tr>').join('')+'</tbody></table></div>';
  const offen=sortiereFehlt(calc.fehlt.filter(f=>f.schwere==='hoch'));
  const quellen=[...new Set((st.positionen||[]).filter(p=>p.kennwert?.art&&p.status!=='entfaellt').map(p=>[R.ARTEN[p.kennwert.art]?.label,p.kennwert.fundstelle].filter(Boolean).join(': ')))].sort((a,b)=>a.localeCompare(b,'de'));
  return '<div class="titelblock"><div><p class="kicker">Kostenberechnung nach '+esc(st.norm||'DIN 276')+'</p><h2>'+esc(doc.project_name)+'</h2>'+
    '<p class="meta">'+esc([doc.project_number!=='Muster'?doc.project_number:'','Leistungsphase 3','Kostenstand '+(R.quartalText(st.kostenstand)||'offen'),'Stand '+datum(doc.updated_at||new Date().toISOString())].filter(Boolean).join(' · '))+'</p></div>'+
    '<div style="text-align:right"><p class="meta">Summe netto'+(g.vollstaendig?'':', vorläufig')+'</p><p style="font-size:24px;font-weight:700;margin:2px 0" class="num">'+R.euro(g.bekanntCent)+'</p>'+
    (calc.kennzahlen.jeBGF!==null?'<p class="meta">Bauwerk (KG 300 + 400) '+R.euro(calc.kennzahlen.jeBGF)+'/m² BGF</p>':'')+'</div></div>'+
    (g.vollstaendig?'':'<p class="meta att" style="margin-top:10px">Vorläufig: '+calc.vollstaendigkeit.erledigt+' von '+calc.vollstaendigkeit.gesamt+' Kostengruppen geklärt; '+offen.length+' Punkte sind noch offen (Abschnitt «Offene Punkte»).</p>')+
    '<h3>Zusammenstellung, 1. Ebene</h3>'+ebene1+'<h3>Kostenberechnung bis zur 3. Ebene</h3>'+ebene3+'<h3>Positionen: Mengen, Kennwerte und Quellen</h3>'+herleitung+gewerkeTab+
    '<h3>Vergleich mit der Kostenschätzung</h3>'+vgl+
    (st.annahmen?'<h3>Annahmen und Erläuterungen</h3><p style="white-space:pre-line;font-size:13px">'+esc(st.annahmen)+'</p>':'')+
    (offen.length?'<h3>Offene Punkte</h3><ul style="font-size:13px;margin:0;padding-left:18px">'+offen.map(f=>'<li>'+esc(f.text)+'</li>').join('')+'</ul>':'')+
    '<h3>Quellen</h3>'+(quellen.length?'<ul style="font-size:13px;margin:0;padding-left:18px">'+quellen.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ul>':'<p class="meta">Keine Quellen angegeben.</p>')+
    (st.indizes?.length?'<p class="meta" style="margin-top:8px">Fortschreibung mit '+esc(st.indexReihe||'Baupreisindex')+'.'+
      (calc.fehlt.some(f=>f.code==='index_vorlaeufig')?' Für '+esc(R.quartalText(st.kostenstand))+' ist noch kein Wert veröffentlicht; fortgeschrieben bis '+esc(R.quartalText(letzterIndex()))+'.':'')+'</p>':'');
}

// ---------- Import ----------
function dialogImport(){
  ui.importVorschau=null;
  dialog.innerHTML='<div class="dlg"><h2>Mengen aus Archicad einlesen</h2>'+
    '<p class="meta">Die Interaktive Auswertung «TBA Kosten · Mengen» als Excel (.xlsx) oder CSV speichern und hier wählen. Erkannt werden die Spalten KG (Klassifizierung DIN 276), Bauteiltyp, Aufbau, Anzahl, Fläche, Länge und Volumen. Wie das Modell dafür klassifiziert wird: <a href="./kostenberechnung-hilfe.html#archicad" target="_blank" rel="noopener noreferrer">Anleitung, Teil III</a>.</p>'+
    '<div class="kb-datei-zeile"><label class="btn">'+ICON_IMPORT+'Datei wählen<input type="file" id="kbDatei" class="kb-datei" accept=".xlsx,.csv,.txt"></label>'+
    '<span class="meta" id="kbDateiName">Keine Datei gewählt</span></div><div id="kbVorschau"></div>'+
    '<div class="dlg-actions"><button type="button" class="btn" data-dlg="zu">Abbrechen</button><button type="button" class="btn btn-primary" id="kbUebernehmen" disabled>Übernehmen</button></div></div>';
  dialog.showModal();
  dialog.querySelector('#kbDatei').addEventListener('change',async ev=>{
    const datei=ev.target.files?.[0];const ziel=dialog.querySelector('#kbVorschau');const knopf=dialog.querySelector('#kbUebernehmen');knopf.disabled=true;
    dialog.querySelector('#kbDateiName').textContent=datei?datei.name:'Keine Datei gewählt';
    if(!datei)return;
    ziel.innerHTML='<p class="meta">Wird gelesen …</p>';
    try{
      const zeilen=await I.leseDatei(datei);const spalten=I.erkenneSpalten(zeilen);const erg=I.gruppiere(zeilen,spalten);
      if(!erg.gruppen.length)throw Error('Keine Zeile mit einer Kostengruppe gefunden.');
      ui.importVorschau={datei:datei.name,zeilen:erg.gelesen,gruppen:erg.gruppen};
      const vergleich=new Map(I.vergleiche(st.importe?.[0]?.gruppen||null,erg.gruppen).map(x=>[x.schluessel,x]));
      const unbekannt=erg.gruppen.filter(g=>!baum.eintrag.has(g.kg)).map(g=>g.kg);
      ziel.innerHTML='<p class="meta">'+erg.gelesen+' Zeilen gelesen, '+erg.gruppen.length+' Gruppen'+(erg.ohneKg?', '+erg.ohneKg+' Zeilen ohne Kostengruppe übersprungen':'')+'.</p>'+
        (unbekannt.length?'<p class="meta att">Nicht in der Gliederung: KG '+esc([...new Set(unbekannt)].join(', '))+'. Die Klassifizierung in Archicad prüfen.</p>':'')+
        '<div class="tbl"><table class="kb-table" style="min-width:560px"><thead><tr><th>KG</th><th>Bauteiltyp</th><th class="num">Menge</th><th>Änderung</th><th>Verteilung</th></tr></thead><tbody>'+
        erg.gruppen.map(g=>{const rz=g.bauteiltyp?st.rezepte?.[g.bauteiltyp]:null;const mass=I.hauptmass(g,rz?.einheit);const v=vergleich.get(g.schluessel);
          return '<tr><td>'+esc(g.kg)+'</td><td>'+esc(g.bauteiltyp||'–')+(aufbauText(g)?'<br><span class="meta">'+esc(aufbauText(g))+'</span>':'')+'</td>'+
          '<td class="num">'+esc(R.zahl(g.mengen[mass],2)+' '+I.MASS_ZU_EINHEIT[mass])+'</td><td>'+esc(v?.art==='neu'?'neu':v?.art==='geaendert'?(v.delta.startsWith('-')?'−'+R.zahl(v.delta.slice(1)):'+'+R.zahl(v.delta))+' '+v.einheit:'gleich')+'</td>'+
          '<td class="meta">'+esc(rz?'Rezept: '+rz.zeilen.map(z=>z.kg).join(', '):'nur KG '+g.kg)+'</td></tr>'}).join('')+'</tbody></table></div>'+
        '<p class="meta">Kennwerte bleiben unverändert. Was im Modell nicht mehr vorkommt, wird markiert, nicht gelöscht.</p>';
      knopf.disabled=false;
    }catch(e){ziel.innerHTML='<p class="meta att" role="alert">'+esc(e?.message||'Die Datei konnte nicht gelesen werden.')+'</p>'}
  });
  dialog.querySelector('#kbUebernehmen').addEventListener('click',()=>{
    const v=ui.importVorschau;if(!v)return;
    const {state,bericht}=I.anwenden(st,v.gruppen,{datum:heuteIso(),datei:v.datei,zeilen:v.zeilen});
    st=state;dialog.close();
    ui.meldung='Import übernommen: '+bericht.neu+' neue, '+bericht.aktualisiert+' aktualisierte Positionen'+(bericht.entfernt?', '+bericht.entfernt+' nicht mehr im Modell':'')+'.';
    ui.tab='positionen';ui.filter='300';ui.auswahl=null;ui.kgAuswahl=null;geaendert();render();
  });
}

// ---------- Ändern ----------
function setze(obj,pfad,wert){const teile=pfad.split('.');let o=obj;for(const t of teile.slice(0,-1)){if(typeof o[t]!=='object'||o[t]===null)o[t]={};o=o[t]}o[teile[teile.length-1]]=wert}
const ZAHLFELDER=new Set(['menge','betrag','kennwert.wert','ustProzent','kostenvorgabe','bezug.BGF','bezug.BRI','bezug.NUF','bezug.AF','regionalfaktor.wert','zuschlag.wert']);
// Grenzen, die einen Tippfehler abfangen (etwa «1.045» statt «1,045» beim Regionalfaktor).
const GRENZEN={'regionalfaktor.wert':[0.3,3,'Den Regionalfaktor als Faktor eingeben, zum Beispiel 1,045.'],
  'zuschlag.wert':[-50,100,'Den Zuschlag in Prozent eingeben, zum Beispiel 15.'],
  ustProzent:[0,100,'Die Umsatzsteuer in Prozent eingeben, zum Beispiel 19.'],
  menge:[0,1e9,'Die Menge ist eine positive Zahl.']};
function zahlOderText(pfad,wert){
  if(!ZAHLFELDER.has(pfad))return wert;
  const d=R.eingabe(wert);if(d===undefined){ui.meldung='«'+wert+'» ist keine Zahl.';return undefined}
  const g=GRENZEN[pfad];
  if(d!==null&&g&&(Number(d)<g[0]||Number(d)>g[1])){ui.meldung=g[2];return undefined}
  return d;
}
function aendereFeld(el){
  if(!kannBearbeiten)return;
  const key=el.dataset.key;if(!key)return;
  const wert=el.type==='checkbox'?el.checked:el.value.trim();
  ui.meldung='';
  if(key.startsWith('pos:')){
    // pos:<id>:<feld>; die id enthält selbst Doppelpunkte (m:210, ac:AW-01:331), das Feld nie.
    const ende=key.lastIndexOf(':');const id=key.slice(4,ende),pfad=key.slice(ende+1);
    const p=st.positionen.find(x=>x.id===id);if(!p)return;
    if(pfad==='kg'){if(wert&&!KG_MUSTER.test(wert)){ui.meldung='Die Kostengruppe hat drei Ziffern, zum Beispiel 331.';render();return}
      if(!p.titel||p.titel===titel(p.kg))p.titel=titel(wert)||p.titel;p.kg=wert;if(p.element&&!elementeIn(wert).some(e=>e.id===p.element))p.element=''}
    else if(pfad==='gewerk')p.gewerk=R.gewerkKurz(wert);
    else if(pfad==='element')p.element=elementeIn(p.kg).some(e=>e.id===wert)?wert:'';
    else if(pfad.startsWith('kennwert.')&&['brutto','regional','zuschlag','indexieren'].includes(pfad.slice(9))){p.kennwert=p.kennwert||{};p.kennwert[pfad.slice(9)]=!!wert}
    else{const v=zahlOderText(pfad,wert);if(v===undefined){render();return}setze(p,pfad,v===''?(ZAHLFELDER.has(pfad)?null:''):v)}
  }else if(key.startsWith('st:')){
    const pfad=key.slice(3);const v=zahlOderText(pfad,wert);if(v===undefined){render();return}setze(st,pfad,v===null?'':v);
  }else if(key.startsWith('ks:')){const d=R.eingabe(wert);if(d===undefined){ui.meldung='«'+wert+'» ist keine Zahl.';render();return}st.kostenschaetzung=st.kostenschaetzung||{};st.kostenschaetzung[key.slice(3)]=d??''}
  else if(key.startsWith('ursache:')){st.ursachen=st.ursachen||{};st.ursachen[key.slice(8)]=wert}
  else if(key.startsWith('index:')){const [,i,feld]=key.split(':');const x=st.indizes[Number(i)];if(!x)return;
    if(feld==='wert'){const d=R.eingabe(wert);if(d===undefined||(d!==null&&!(Number(d)>0&&Number(d)<10000))){ui.meldung='Den Indexwert als Zahl eingeben, zum Beispiel 131,4.';render();return}x.wert=d??''}
    else{if(st.indizes.some((y,j)=>j!==Number(i)&&y.quartal===wert)){ui.meldung='Für '+R.quartalText(wert)+' gibt es schon einen Wert.';render();return}x.quartal=wert}}
  else if(key.startsWith('gruppe:')){const [,kg,feld]=key.split(':');st.gruppen=st.gruppen||{};st.gruppen[kg]=st.gruppen[kg]||{};
    if(st.gruppen[kg].vorbelegt)st.gruppen[kg].vorbelegt=false;
    if(feld==='status'){if(wert)st.gruppen[kg].status='entfaellt';else delete st.gruppen[kg]}else st.gruppen[kg].notiz=wert}
  else if(key.startsWith('rezept:')){const teile=key.slice(7).split(':');const feld=teile.pop(),i=teile.pop(),typ=teile.join(':');
    const z=st.rezepte?.[typ]?.zeilen?.[Number(i)];if(!z)return;
    if(feld==='kg'){if(!KG_MUSTER.test(wert)){ui.meldung='Die Kostengruppe hat drei Ziffern.';render();return}z.kg=wert}
    else{const d=R.eingabe(wert);if(!d||!(Number(d)>0&&Number(d)<=20)){ui.meldung='Der Faktor ist eine Zahl, zum Beispiel 1 oder 2.';render();return}z.faktor=d}
    ui.meldung='Rezept geändert. Es wirkt beim nächsten Import.'}
  else if(key.startsWith('el:')){const ende=key.lastIndexOf(':');const id=key.slice(3,ende),feld=key.slice(ende+1);const e=(st.elemente||[]).find(x=>x.id===id);if(!e||!['titel','notiz'].includes(feld))return;e[feld]=wert}
  else if(key.startsWith('gewerk:')){const c=R.gewerkKurz(key.slice(7));if(!c)return;st.gewerke=st.gewerke||{};if(wert)st.gewerke[c]=wert;else delete st.gewerke[c]}
  else if(key.startsWith('rezepteinheit:')){const typ=key.slice(14);if(st.rezepte?.[typ])st.rezepte[typ].einheit=wert}
  geaendert();
  spaeterRendern();
}
// Ein Feld meldet seine Änderung beim Verlassen. Wer dabei schon auf einen Knopf drückt, soll den Klick nicht
// verlieren: solange der Zeiger unten ist, wartet das Neuzeichnen bis nach dem Klick.
let zeigerUnten=false,renderSpaeter=false;
function spaeterRendern(){if(zeigerUnten){renderSpaeter=true;return}setTimeout(render,0)}
document.addEventListener('pointerdown',()=>{zeigerUnten=true},true);
const zeigerLos=()=>{zeigerUnten=false;if(renderSpaeter)setTimeout(()=>{if(renderSpaeter)render()},0)};
document.addEventListener('pointerup',zeigerLos,true);
document.addEventListener('pointercancel',zeigerLos,true);
// Neue Position in einer Kostengruppe (oder einem Element); Rechenweise, Einheit und Quelle nach der Vorgabe des Musters.
// In einer KG mit Unter-KG ist es eine Pauschale für die ganze KG. Aus der Tabelle heraus geht es direkt in der Zeile weiter.
function neueId(prefix){return prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function filterZeigt(kg){return !ui.filter||ui.filter!=='offen'&&(kg===ui.filter||R.liegtUnter(kg,ui.filter)||(R.ebene(ui.filter)>1&&ui.filter.slice(0,2)===kg.slice(0,2)))}
function neuePosition(kg,elementId='',inline=false){
  const id=neueId('p:');
  const gueltig=KG_MUSTER.test(String(kg||''))?kg:'';
  const v=gueltig?vorlage(gueltig):{},gruppe=gueltig&&kinderVon(gueltig).length>0;
  const modus=gruppe?'betrag':(v.modus||'menge');
  const el=gueltig&&elementId&&elementeIn(gueltig).some(e=>e.id===elementId)?elementId:'';
  const p={id,kg:gueltig,titel:'',gewerk:'',ort:'',element:el,bauteiltyp:'',notiz:'',modus,kennwert:v.art?{art:v.art}:{}};
  if(modus==='menge')Object.assign(p,{menge:null,einheit:v.einheit||'m²',mengenquelle:{art:'manuell',text:''}});else p.betrag=null;
  st.positionen=st.positionen||[];
  let nach=-1;st.positionen.forEach((x,i)=>{if(gueltig&&x.kg===gueltig&&(!el||x.element===el))nach=i});
  if(nach>=0)st.positionen.splice(nach+1,0,p);else st.positionen.push(p);
  ui.tab='positionen';ui.loeschen=null;ui.elAuswahl=null;ui.kgAuswahl=null;ui.auswahl=inline?null:id;
  if(gueltig){ui.sicht='kg';if(!filterZeigt(gueltig))ui.filter=gueltig[0]+'00'}
  geaendert();render();
  const fokus='pos:'+id+':'+(inline?'titel':gueltig?(modus==='betrag'?'betrag':'menge'):'kg');
  setTimeout(()=>root.querySelector('[data-key="'+CSS.escape(fokus)+'"]')?.focus(),0);
}
function neuesElement(kg){
  if(!KG_MUSTER.test(String(kg||''))||kinderVon(kg).length)return;
  const id=neueId('e:');
  st.elemente=st.elemente||[];st.elemente.push({id,kg,titel:'',notiz:''});
  ui.tab='positionen';ui.sicht='kg';ui.auswahl=null;ui.elAuswahl=null;ui.loeschen=null;
  if(!filterZeigt(kg))ui.filter=kg[0]+'00';
  geaendert();render();
  setTimeout(()=>root.querySelector('[data-key="'+CSS.escape('el:'+id+':titel')+'"]')?.focus(),0);
}
function zweiteEbene(kg){return KG_MUSTER.test(String(kg||''))?(R.ebene(kg)===3?kg.slice(0,2)+'0':kg):''}
function geheZu(d){
  const {art,kg,id}=d;
  ui.sicht='kg';ui.elAuswahl=null;
  if(art==='position'||art==='hinweis'){ui.tab='positionen';ui.filter=zweiteEbene(kg);ui.auswahl=id||null;ui.kgAuswahl=null}
  else if(art==='leer'||art==='doppelt'||art==='gruppe'){ui.tab='positionen';ui.filter=kg||'';ui.auswahl=null;ui.kgAuswahl=kg||null}
  else if(art==='paar'){ui.tab='positionen';ui.filter=zweiteEbene(kg);ui.auswahl=null;ui.kgAuswahl=kg||null}
  else if(art==='bezug'||art==='grundlage')ui.tab='quellen';
  else ui.tab='vergleich';
  merkeTab();render();window.scrollTo({top:0,behavior:'smooth'});
}
function merkeTab(){if(doc&&!istMuster)history.replaceState(null,'',location.pathname+location.search+'#tab='+ui.tab)}
// Die Details stehen fest rechts (auf dem iPhone unten); nichts zu scrollen.
function zeigePanel(){}

root.addEventListener('click',ev=>{
  if(ui.markiert.size)ui.markiert=new Set();
  const b=ev.target.closest('[data-act]');if(!b)return;
  // In ein Feld der Zeile klicken heißt bearbeiten, nicht die Zeile wählen.
  if(ev.target.closest('.ci')&&b.classList.contains('pos'))return;
  const act=b.dataset.act,d=b.dataset;
  if(act==='neu'){dialogNeu();return}
  if(!st)return;
  if(act==='tab'){ui.tab=d.tab;ui.meldung='';merkeTab();render();return}
  if(act==='aufklappen'){ui.offen.has(d.kg)?ui.offen.delete(d.kg):ui.offen.add(d.kg);render();return}
  if(act==='filter'){ui.tab='positionen';ui.filter=d.kg;ui.auswahl=null;ui.kgAuswahl=null;merkeTab();render();return}
  if(act==='kg-gehe'){ui.sicht='kg';ui.elAuswahl=null;ui.tab='positionen';ui.filter=zweiteEbene(d.kg)||d.kg;ui.auswahl=null;ui.kgAuswahl=d.kg;merkeTab();render();zeigePanel();return}
  if(act==='kg'){ui.kgAuswahl=d.kg;ui.auswahl=null;ui.elAuswahl=null;ui.loeschen=null;if(ui.sicht==='gewerke')ui.sicht='kg';if(ui.tab!=='positionen'){ui.tab='positionen';ui.filter=zweiteEbene(d.kg)||d.kg;merkeTab()}render();zeigePanel();return}
  if(act==='brutto'){ui.brutto=d.wert==='1';render();return}
  if(act==='sicht'){ui.sicht=d.wert==='gewerke'?'gewerke':'kg';merkePrefs();render();return}
  if(act==='zeilen'){ui.zeilen=d.wert==='kompakt'?'kompakt':'voll';merkePrefs();render();return}
  if(act==='schliessen'){ui.pool=null;ui.auswahl=null;ui.kgAuswahl=null;ui.elAuswahl=null;ui.loeschen=null;render();return}
  if(act==='el'){ui.elAuswahl=d.id;ui.auswahl=null;ui.kgAuswahl=null;ui.loeschen=null;render();return}
  if(act==='alle-fehlt'){ui.alleFehlt=!ui.alleFehlt;render();return}
  if(act==='pool'){const p=(st.positionen||[]).find(x=>x.id===d.id);if(!p||!P)return;ui.auswahl=p.id;ui.pool=poolStart(p);ui.tab='positionen';render();
    setTimeout(()=>root.querySelector('[data-pool="suche"]')?.focus({preventScroll:true}),0);return}
  if(act==='pool-zu'){ui.pool=null;render();return}
  if(act==='pool-filter'&&ui.pool){const f={kg:'alleKg',verwandt:'verwandt',angebote:'nurAngebote',neubau:'nurNeubau',einheiten:'andereEinheiten'}[d.f];
    if(f){ui.pool[f]=!ui.pool[f];if(f==='alleKg'&&ui.pool.alleKg)ui.pool.verwandt=false}render();return}
  if(act==='waehle'){ui.pool=null;ui.auswahl=d.id;ui.kgAuswahl=null;ui.elAuswahl=null;ui.loeschen=null;if(ui.tab!=='positionen'){ui.tab='positionen';merkeTab()}render();zeigePanel();return}
  if(act==='goto'){geheZu(d);return}
  if(act==='drucken'){if(ui.tab!=='bericht'){ui.tab='bericht';render()}setTimeout(()=>window.print(),50);return}
  if(act==='import'&&kannBearbeiten){dialogImport();return}
  if(act==='sichern'){sichernAlsDatei();return}
  if(act==='klassifizierung'){klassifizierungLaden();return}
  if(act==='neuladen'){location.reload();return}
  if(!kannBearbeiten)return;
  if(act==='pool-nehmen'&&ui.pool){
    const p=(st.positionen||[]).find(x=>x.id===ui.pool.id),g=ui.poolGruppen?.get(d.gruppe);
    if(!p||!g||g.passt===false)return;
    p.kennwert=P.uebernahme(g,R);if(!p.einheit)p.einheit=g.einheit;
    if(!p.titel||p.titel===titel(p.kg))p.titel=g.ursprung.bez;
    ui.meldung='Kennwert übernommen: '+euroEp(g.epCent,g.einheit)+' aus '+g.ursprung.nr+(g.ursprung.quelle?', '+g.ursprung.quelle:'')+
      (g.ursprung.kostenstand&&g.ursprung.kostenstand!==st.kostenstand?' (Kostenstand '+R.quartalText(g.ursprung.kostenstand)+')':'')+'.';
    ui.pool=null;geaendert();render();return;
  }
  if(act==='pos-neu'){neuePosition(d.kg||'',d.el||'',d.quelle==='tabelle');return}
  if(act==='el-neu'){neuesElement(d.kg);return}
  const e=d.id?(st.elemente||[]).find(x=>x.id===d.id):null;
  if(act==='el-loesen'&&e){for(const x of st.positionen||[])if(x.element===e.id)x.element='';st.elemente=st.elemente.filter(x=>x.id!==e.id);ui.elAuswahl=null;ui.kgAuswahl=e.kg;geaendert();render();return}
  if(act==='el-weg'&&e){
    if(ui.loeschen!==e.id){ui.loeschen=e.id;render();setTimeout(()=>{if(ui.loeschen===e.id){ui.loeschen=null;render()}},4000);return}
    st.positionen=(st.positionen||[]).filter(x=>x.element!==e.id);st.elemente=st.elemente.filter(x=>x.id!==e.id);ui.elAuswahl=null;ui.loeschen=null;ui.kgAuswahl=e.kg;geaendert();render();return}
  if(act==='kg-entfaellt'){st.gruppen=st.gruppen||{};st.gruppen[d.kg]={status:'entfaellt',notiz:''};ui.kgAuswahl=d.kg;geaendert();render();
    setTimeout(()=>root.querySelector('[data-key="gruppe:'+CSS.escape(d.kg)+':notiz"]')?.focus(),0);return}
  if(act==='kg-wieder'){if(st.gruppen)delete st.gruppen[d.kg];geaendert();render();return}
  if(act==='kg-bestaetigen'){const g=st.gruppen?.[d.kg];if(g){g.vorbelegt=false;geaendert();render()}return}
  if(act==='kg-rest'){
    const rest=blaetterUnter(d.kg).filter(x=>calc.blaetter.get(x)==='leer');
    st.gruppen=st.gruppen||{};for(const x of rest)st.gruppen[x]={status:'entfaellt',notiz:'nicht vorhanden'};
    ui.meldung=rest.length+(rest.length===1?' Kostengruppe':' Kostengruppen')+' als «entfällt» markiert: '+rest.join(', ')+'.';geaendert();render();return}
  const p=d.id?st.positionen.find(x=>x.id===d.id):null;
  if(act==='modus'&&p){p.modus=d.wert;geaendert();render();return}
  if(act==='entfaellt'&&p){p.status=p.status==='entfaellt'?'':'entfaellt';geaendert();render();return}
  if(act==='kopie'&&p){const k=JSON.parse(JSON.stringify(p));k.id=neueId('p:');delete k.import;delete k.ausImportEntfernt;delete k.assistent;st.positionen.splice(st.positionen.indexOf(p)+1,0,k);ui.auswahl=k.id;geaendert();render();return}
  if((act==='hoch'||act==='runter')&&p){
    // Nur innerhalb derselben KG und desselben Elements tauschen, wie Zeilen in Excel verschieben.
    const liste=st.positionen,i=liste.indexOf(p),gleich=x=>x.kg===p.kg&&(x.element||'')===(p.element||'');let j=i;
    do{j+=act==='hoch'?-1:1}while(j>=0&&j<liste.length&&!gleich(liste[j]));
    if(j<0||j>=liste.length)return;[liste[i],liste[j]]=[liste[j],liste[i]];geaendert();render();return}
  if(act==='loeschen'&&p){
    if(ui.loeschen!==p.id){ui.loeschen=p.id;render();setTimeout(()=>{if(ui.loeschen===p.id){ui.loeschen=null;render()}},4000);return}
    st.positionen=st.positionen.filter(x=>x.id!==p.id);ui.auswahl=null;ui.loeschen=null;ui.kgAuswahl=KG_MUSTER.test(String(p.kg||''))?p.kg:null;geaendert();render();return}
  if(act==='index-neu'){st.indizes=st.indizes||[];const vorhanden=new Set(st.indizes.map(x=>x.quartal));const q=[st.kostenstand,...quartale()].find(x=>x&&!vorhanden.has(x))||aktuellesQuartal();
    st.indizes.push({quartal:q,wert:''});geaendert();render();return}
  if(act==='index-weg'){st.indizes.splice(Number(d.i),1);geaendert();render();return}
  if(act==='rezept-vorschlag'){st.rezepte=st.rezepte||{};st.rezepte[d.typ]={einheit:'m²',zeilen:R.rezeptVorschlag(d.kg)};
    ui.meldung='Rezept für '+d.typ+' angelegt. Es wirkt beim nächsten Import; Faktoren bei Bedarf anpassen.';geaendert();render();return}
  if(act==='rezept-zeile'){const rz=st.rezepte?.[d.typ];if(rz){rz.zeilen.push({kg:rz.zeilen[0]?.kg||'',faktor:'1'});geaendert();render()}return}
  if(act==='rezept-weg'){const rz=st.rezepte?.[d.typ];if(rz){rz.zeilen.splice(Number(d.i),1);if(!rz.zeilen.length)delete st.rezepte[d.typ];geaendert();render()}return}
  if(act==='rezept-loesen'){delete st.rezepte[d.typ];geaendert();render();return}
});
// Escape schließt die Details, wo der Fokus auch ist (nach dem Neuzeichnen steht er oft auf der Seite); nicht im Dialog
// und nicht im Assistenten, der sein eigenes Escape hat.
document.addEventListener('keydown',ev=>{
  if(ev.key!=='Escape'||ev.isComposing||dialog.open||ev.target?.closest?.('#kbAssistent'))return;
  if(st&&ui.tab==='positionen'&&(ui.auswahl||ui.kgAuswahl||ui.elAuswahl)){ev.preventDefault();ui.pool=null;ui.auswahl=null;ui.kgAuswahl=null;ui.elAuswahl=null;ui.loeschen=null;render()}
});
root.addEventListener('keydown',ev=>{
  const el=ev.target;
  // Enter übernimmt und springt wie in Excel in dieselbe Spalte der nächsten Zeile; Umschalt+Enter macht eine neue Zeile im Text.
  if(el.classList?.contains('ci')&&el.tagName!=='SELECT'&&ev.key==='Enter'&&!ev.shiftKey&&!ev.altKey&&!ev.isComposing){
    ev.preventDefault();
    const key=el.dataset.key||'',feld=key.slice(key.lastIndexOf(':')+1);
    const alle=[...root.querySelectorAll('.ktab .ci')].filter(x=>(x.dataset.key||'').endsWith(':'+feld));
    const ziel=alle[alle.indexOf(el)+1]?.dataset.key;
    el.blur();
    if(ziel)setTimeout(()=>root.querySelector('[data-key="'+CSS.escape(ziel)+'"]')?.focus(),0);
    return;
  }
  if((ev.key==='Enter'||ev.key===' ')&&el.matches('[role="button"][data-act]')){ev.preventDefault();el.click()}
});
// Ganzer Text: Felder wachsen mit dem Inhalt; einzeilig klappt das Feld beim Bearbeiten auf.
function hoehe(t){t.style.height='auto';t.style.height=Math.max(31,t.scrollHeight)+'px'}
function hoehenAnpassen(){
  const ts=[...root.querySelectorAll('.ktab.voll textarea.ci')];
  ts.forEach(t=>{t.style.height='auto'});const hs=ts.map(t=>t.scrollHeight);ts.forEach((t,i)=>{t.style.height=Math.max(31,hs[i])+'px'});
}
root.addEventListener('input',ev=>{if(ev.target.matches?.('textarea.ci'))hoehe(ev.target);
  if(ev.target.matches?.('[data-pool="suche"]')&&ui.pool){ui.pool.text=ev.target.value;clearTimeout(poolTimer);poolTimer=setTimeout(zeigePoolErgebnis,140)}});
root.addEventListener('focusin',ev=>{if(ev.target.matches?.('.einzeilig textarea.ci'))hoehe(ev.target)});
root.addEventListener('focusout',ev=>{if(ev.target.matches?.('.einzeilig textarea.ci'))ev.target.style.height=''});
// Spaltenbreite ziehen wie in Excel (Bezeichnung und Kommentar); gemerkt je Browser.
root.addEventListener('pointerdown',ev=>{
  const griff=ev.target.closest?.('.zieh');if(!griff)return;
  ev.preventDefault();
  const tab=griff.closest('.ktab'),spalte=griff.dataset.zieh,start=ev.clientX,breite=griff.parentElement.getBoundingClientRect().width;
  const ziehen=e=>{const w=Math.round(Math.min(900,Math.max(120,breite+e.clientX-start)));tab.style.setProperty(spalte==='bez'?'--kb-bez':'--kb-kom',w+'px');if(spalte==='bez')ui.breiteBez=w;else ui.breiteKom=w};
  const los=()=>{window.removeEventListener('pointermove',ziehen);window.removeEventListener('pointerup',los);merkePrefs()};
  window.addEventListener('pointermove',ziehen);window.addEventListener('pointerup',los);
});
root.addEventListener('change',ev=>{const el=ev.target;if(el.matches('[data-key]'))aendereFeld(el)});
root.addEventListener('submit',ev=>{
  if(ev.target.id!=='kbStand')return;ev.preventDefault();
  const label=ev.target.elements.label.value.trim();if(label)void standFesthalten(label);
});
dialog.addEventListener('click',ev=>{if(ev.target.closest('[data-dlg="zu"]')||ev.target===dialog)dialog.close()});
function tabAusHash(){const t=new URLSearchParams(location.hash.slice(1)).get('tab');return TABS.some(([k])=>k===t)?t:null}
window.addEventListener('hashchange',()=>{const t=tabAusHash();if(t&&t!==ui.tab&&st){ui.tab=t;render()}});

// KI-Assistent (kosten-assistent.js): im gemeinsamen Fenster der Assistenten (wie beim Terminplan), unten rechts als
// Reiter, verschiebbar. Er liest den Stand, schlägt vor und übernimmt erst nach «Prüfen und übernehmen»; gespeichert
// wird wie jede Änderung (geaendert()). Nicht im Muster und nicht im Archiv.
const assistent=A?.init({sb,R,I,esc,root,
  stand:()=>st,setzeStand:neu=>{st=neu},doc:()=>doc,revision:()=>serverRevision,nutzerId:()=>nutzer?.id||'',
  darfBearbeiten:()=>kannBearbeiten&&!istMuster,konflikt:()=>konflikt,tabPositionen:()=>ui.tab==='positionen',
  verfuegbar:()=>!!doc&&!istMuster&&!istArchiv,
  auswahl:()=>{
    const p=(st?.positionen||[]).find(x=>x.id===ui.auswahl);if(p)return {kg:p.kg,position:p.id,titel:p.titel};
    const e=ui.elAuswahl?(st?.elemente||[]).find(x=>x.id===ui.elAuswahl):null;if(e)return {kg:e.kg};
    return ui.kgAuswahl?{kg:ui.kgAuswahl}:null;
  },
  schliesseDetails:()=>{ui.auswahl=null;ui.kgAuswahl=null;ui.elAuswahl=null;ui.loeschen=null},
  speichernJetzt,geaendert,render,neueId,heute:heuteIso,kgName,
  zeige:(ids,kg)=>{ui.markiert=new Set(ids);ui.auswahl=null;ui.kgAuswahl=null;ui.elAuswahl=null;
    if(kg){ui.tab='positionen';ui.sicht='kg';ui.filter=kg[0]+'00';merkeTab()}render();
    if(ids.length)setTimeout(()=>root.querySelector('.ktab .pos.zeile.neu')?.scrollIntoView({block:'center'}),0)}
})||null;

void start();
})();
