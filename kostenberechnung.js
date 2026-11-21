/* TBA Office · Kostenberechnung (21.11.2026, Claude, Auftrag Gari: den Entwurf als Werkzeug im Office umsetzen).
   Oberfläche nach dem Entwurf vom 21.11.: oben die Antwort (Summe, Abweichung, was fehlt), darunter die
   Gliederung nach DIN 276 bis zur 3. Ebene; jede Kostengruppe ist sichtbar und hat einen Stand, jede Zahl
   zeigt ihre Herkunft. Daten wie beim Terminplan: Muster → Projekt-Kostenberechnung (JSON-Stand, bedingtes
   Speichern über server_revision) → Stände. Rechnen: kosten-rechnen.js. Archicad-Import: kosten-import.js. */
(()=>{
'use strict';
const R=window.TBA_KOSTEN_RECHNEN,I=window.TBA_KOSTEN_IMPORT,OFFICE=window.TBA_OFFICE_CONFIG;
const sb=window.MINDS_SUPABASE||(window.supabase&&OFFICE?window.supabase.createClient(OFFICE.url,OFFICE.key,
  {auth:{storageKey:OFFICE.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null);
const inApp=!!window.WINDOW_NATIVE?.available;
const params=new URLSearchParams(location.search);
const ID=params.get('id'),MUSTER_ID=params.get('muster');
const root=document.getElementById('kb'),dialog=document.getElementById('kbDialog');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const datum=iso=>{const d=new Date(iso);return Number.isFinite(d.getTime())?d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}):''};
const heuteIso=()=>new Date().toISOString().slice(0,10);
const ICON_IMPORT='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';
const ICON_PLUS='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
const ANLEITUNG='<a class="btn btn-quiet" href="./kostenberechnung-hilfe.html" target="_blank" rel="noopener noreferrer">Anleitung</a>';
const TABS=[['uebersicht','Übersicht'],['positionen','Positionen'],['quellen','Quellen'],['vergleich','Vergleich'],['bericht','Bericht']];
const KG_MUSTER=/^[1-8]\d\d$/;

let nutzer=null,mitglied=null,doc=null,st=null,calc=null,baum=null,istMuster=false,kannBearbeiten=false;
const ui={tab:'uebersicht',offen:new Set(['300']),filter:'300',auswahl:null,kgAuswahl:null,brutto:false,loeschen:null,staende:null,importVorschau:null,meldung:''};
let serverRevision=0,speichernTimer=null,laeuft=false,ausstehend=false,konflikt=false,speicherText='';

function quartale(){
  const jetzt=new Date(),bis=jetzt.getFullYear()+1,aus=[];
  for(let j=bis;j>=2018;j--)for(let q=4;q>=1;q--)aus.push(j+'-Q'+q);
  return aus;
}
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
  if(error||!session){if(inApp){void window.WINDOW_NATIVE.call('session.signIn');fehler('Bitte in der App anmelden.');return}location.href='./';return}
  nutzer=session.user;
  const {data:m,error:me}=await sb.from('office_members').select('role,display_name,is_active,must_change_password')
    .eq('user_id',nutzer.id).eq('is_active',true).maybeSingle();
  if(me||!m){fehler('Kein Zugriff auf TBA Office.');return}
  if(m.must_change_password){if(inApp){fehler('Bitte zuerst im Browser auf tbarchitekten.github.io das Startpasswort ändern.');return}location.href='./';return}
  mitglied=m;
  try{
    if(ID)await ladeKostenberechnung(ID);
    else if(MUSTER_ID)await ladeMuster(MUSTER_ID);
    else await zeigeListe();
  }catch(e){console.error('Kostenberechnung',e);fehler(e?.message||'Kostenberechnung nicht erreichbar.')}
}

// ---------- Liste ----------
let listeDaten=null;
async function zeigeListe(){
  const [tp,ins,pr,pm]=await Promise.all([
    sb.from('office_kosten_templates').select('id,title,version,norm,status,description,updated_at,state').eq('is_active',true).order('title'),
    sb.from('office_kosten_instances').select('id,project_id,project_number,project_name,phase,updated_at,state').eq('is_archived',false).order('updated_at',{ascending:false}).limit(200),
    sb.from('office_projects').select('id,number,name,status,projektleiter_id').order('number').limit(250),
    sb.from('office_project_members').select('project_id').eq('user_id',nutzer.id).limit(500)
  ]);
  const err=tp.error||ins.error||pr.error||pm.error;if(err)throw err;
  const team=new Set((pm.data||[]).map(x=>x.project_id));
  const projekte=(pr.data||[]).filter(p=>p.status==='aktiv'&&(mitglied.role==='admin'||p.projektleiter_id===nutzer.id||team.has(p.id)));
  listeDaten={muster:tp.data||[],instanzen:ins.data||[],projekte};
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
    '<h2 class="lib">Projekt-Kostenberechnungen</h2><div class="liste">'+instanzen+'</div>'+
    '<p class="meta" style="margin-top:22px"><a href="./kostenberechnung-hilfe.html" target="_blank" rel="noopener noreferrer">Anleitung zur Kostenberechnung · Ablauf, Archicad, Kennwerte und Bericht</a></p></div>';
}
function dialogNeu(){
  const d=listeDaten;if(!d)return;
  const q=aktuellesQuartal();
  dialog.innerHTML='<form class="dlg" id="kbNeu" method="dialog"><h2>Kostenberechnung anlegen</h2>'+
    '<label class="feld">Projekt<select name="projekt" required>'+d.projekte.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.number+' · '+p.name)+'</option>').join('')+'</select></label>'+
    '<label class="feld">Muster<select name="muster" required>'+d.muster.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.title+' · '+t.version)+'</option>').join('')+'</select></label>'+
    '<label class="feld">Kostenstand<select name="kostenstand">'+quartale().map(x=>'<option value="'+x+'"'+(x===q?' selected':'')+'>'+esc(R.quartalText(x))+'</option>').join('')+'</select></label>'+
    '<p class="meta">Das Muster bleibt unverändert. Sehen und fortschreiben können die Kostenberechnung das Projektteam, die Projektleitung und wer sie anlegt.</p>'+
    '<p class="meta att" id="kbNeuFehler" role="alert"></p>'+
    '<div class="dlg-actions"><button type="button" class="btn" data-dlg="zu">Abbrechen</button><button class="btn btn-primary" type="submit">Anlegen</button></div></form>';
  dialog.showModal();
  dialog.querySelector('#kbNeu').addEventListener('submit',async ev=>{
    ev.preventDefault();
    const f=ev.target,knopf=f.querySelector('[type="submit"]');knopf.disabled=true;
    const projekt=d.projekte.find(p=>p.id===f.elements.projekt.value),muster=d.muster.find(t=>t.id===f.elements.muster.value);
    try{
      if(!projekt||!muster)throw Error('Bitte Projekt und Muster wählen.');
      const state=JSON.parse(JSON.stringify(muster.state));state.kostenstand=f.elements.kostenstand.value;
      const {data,error}=await sb.from('office_kosten_instances').insert({project_id:projekt.id,template_id:muster.id,template_version:muster.version,
        project_number:projekt.number,project_name:projekt.name,phase:'LPH3',owner_id:nutzer.id,state}).select('id').single();
      if(error||!data?.id)throw Error('Die Kostenberechnung konnte nicht angelegt werden.');
      location.assign('./kostenberechnung.html?id='+encodeURIComponent(data.id));
    }catch(e){f.querySelector('#kbNeuFehler').textContent=e?.message||'Fehler beim Anlegen.';knopf.disabled=false}
  });
}

// ---------- Laden ----------
async function ladeKostenberechnung(id){
  const {data:row,error}=await sb.from('office_kosten_instances')
    .select('id,project_id,project_number,project_name,phase,owner_id,template_version,state,server_revision,updated_at').eq('id',id).maybeSingle();
  if(error)throw error;
  if(!row)throw Error('Kostenberechnung nicht gefunden, oder du gehörst nicht zum Projektteam.');
  if(row.state?.schema!==R.SCHEMA)throw Error('Unbekannter Stand der Kostenberechnung.');
  doc=row;st=row.state;serverRevision=Number(row.server_revision);
  if(!Number.isSafeInteger(serverRevision)||serverRevision<1)throw Error('Keine gültige Serverrevision.');
  let leitet=false,team=false;
  if(mitglied.role!=='admin'&&row.owner_id!==nutzer.id){
    const [p,t]=await Promise.all([sb.from('office_projects').select('projektleiter_id').eq('id',row.project_id).maybeSingle(),
      sb.from('office_project_members').select('user_id').eq('project_id',row.project_id).eq('user_id',nutzer.id).maybeSingle()]);
    leitet=p.data?.projektleiter_id===nutzer.id;team=!!t.data;
  }
  kannBearbeiten=mitglied.role==='admin'||row.owner_id===nutzer.id||leitet||team;
  speicherText='gespeichert · Revision '+serverRevision;
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
function sichernAlsDatei(){
  const blob=new Blob([JSON.stringify({kostenberechnung:doc?.id,revision:serverRevision,state:st},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Kostenberechnung-'+(doc?.project_number||'')+'-'+heuteIso()+'.json';
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
  if(n.status==='entfaellt')return '<span class="chip">entfällt</span>';
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
  const aktiv=document.activeElement?.dataset?.key||null;
  const kopf='<a class="kb-back" href="./kostenberechnung.html">‹ Kostenberechnungen</a>'+
    '<header class="kb-head"><div class="kb-head-text"><p class="kicker">Office · Kostenberechnung'+(istMuster?' · Muster':'')+'</p>'+
    '<h1>'+esc(doc.project_name)+'</h1><p class="kb-intro">'+esc([doc.project_number!=='Muster'?doc.project_number:'',doc.phase==='LPH3'?'LPH 3':doc.phase,
      (st.norm||'DIN 276')+' bis zur 3. Ebene','Kostenstand '+(R.quartalText(st.kostenstand)||'offen'),istMuster?'Version '+doc.version:'Stand '+datum(doc.updated_at)].filter(Boolean).join(' · '))+'</p></div>'+
    '<div class="kb-actions">'+ANLEITUNG+(kannBearbeiten?'<button type="button" class="btn" data-act="import">'+ICON_IMPORT+'Mengen aus Archicad</button>':'')+
    '<button type="button" class="btn btn-primary" data-act="tab" data-tab="bericht">Bericht für die Kostenbesprechung</button></div></header>'+
    '<p class="kb-save meta" id="kbSave"></p>';
  let banner='';
  if(istMuster)banner='<div class="kb-banner info">Muster · nur Ansicht. Eine Kostenberechnung für ein Projekt legst du in der <a href="./kostenberechnung.html">Übersicht</a> an; das Muster bleibt dabei unverändert.</div>';
  else if(!kannBearbeiten)banner='<div class="kb-banner info">Nur Ansicht: Fortschreiben können das Projektteam, die Projektleitung und wer die Kostenberechnung angelegt hat.</div>';
  if(konflikt)banner+='<div class="kb-banner warn"><strong>Nicht gespeichert.</strong> Auf dem Server liegt ein neuerer Stand, oder die Verbindung ist unterbrochen. Deine Änderungen sind noch in diesem Fenster.'+
    '<div class="kb-banner-actions"><button type="button" class="btn" data-act="sichern">Meine Fassung als Datei sichern</button><button type="button" class="btn" data-act="neuladen">Neu laden</button></div></div>';
  if(ui.meldung)banner+='<div class="kb-banner info" role="status">'+esc(ui.meldung)+'</div>';
  const tabs='<nav class="tabs" role="tablist" aria-label="Ansichten">'+TABS.map(([k,t])=>'<button type="button" class="tab" role="tab" data-act="tab" data-tab="'+k+'" aria-selected="'+(ui.tab===k)+'">'+t+'</button>').join('')+'</nav>';
  const inhalt={uebersicht:tabUebersicht,positionen:tabPositionen,quellen:tabQuellen,vergleich:tabVergleich,bericht:tabBericht}[ui.tab]||tabUebersicht;
  root.innerHTML='<div class="kb-wrap">'+kopf+banner+tabs+'<section id="kbBody">'+inhalt()+'</section></div>'+datalistKg();
  zeigeSpeicherstatus();
  if(aktiv){const el=root.querySelector('[data-key="'+CSS.escape(aktiv)+'"]');if(el){el.focus({preventScroll:true});if(el.select&&el.type==='text')try{el.setSelectionRange(el.value.length,el.value.length)}catch{}}}
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
      '<p class="meta">'+v.erledigt+' von '+v.gesamt+(v.nachKg?' Kostengruppen geklärt':' Positionen vollständig belegt')+'</p></div></section>';
  const erste=(st.katalog||[]).filter(k=>R.ebene(k.kg)===1);
  const max=erste.reduce((m,k)=>{const b=calc.knoten.get(k.kg)?.bekanntCent||0n;return b>m?b:m},0n);
  const anteil=b=>g.bekanntCent>0n&&b>0n?R.prozent(Number(R.teile(b*1000n,g.bekanntCent))/10):'';
  const chev=(kg,hat)=>hat?'<button type="button" class="chev" data-act="aufklappen" data-kg="'+esc(kg)+'" aria-expanded="'+ui.offen.has(kg)+'" aria-label="KG '+esc(kg)+(ui.offen.has(kg)?' zuklappen':' aufklappen')+'">›</button>':'<span class="chev" aria-hidden="true"></span>';
  let zeilen='';
  for(const k of erste){
    const kn=calc.knoten.get(k.kg),aus=kn?.status==='entfaellt',b=kn?.bekanntCent||0n;
    zeilen+='<div class="row'+(aus?' aus':'')+'"><span class="name"><span class="kg">'+esc(k.kg)+'</span>'+esc(k.titel)+'</span>'+
      '<span class="num"'+(k.kg==='300'?' style="font-weight:650"':'')+'>'+(aus?'entfällt':betrag(b))+'</span><span class="num hide-s meta">'+(aus?'':anteil(b))+'</span>'+
      '<span class="hide-s">'+(aus?'':'<span class="bar"><span style="width:'+(max>0n?Number(R.teile(b*100n,max)):0)+'%"></span></span>')+'</span>'+
      '<span class="hide-s">'+chipKg(kn)+'</span>'+chev(k.kg,kinderVon(k.kg).length>0)+'</div>';
    if(!ui.offen.has(k.kg))continue;
    if(positionenIn(k.kg).length)zeilen+=zeileUebersicht({kg:k.kg,titel:'Pauschal für die ganze KG '+k.kg},'sub',null,anteil,chev);
    for(const x of kinderVon(k.kg)){
      zeilen+=zeileUebersicht(x,'sub',calc.knoten.get(x.kg),anteil,chev);
      if(!ui.offen.has(x.kg))continue;
      for(const y of kinderVon(x.kg))zeilen+=zeileUebersicht(y,'sub2',calc.knoten.get(y.kg),anteil,chev);
    }
  }
  const liste='<section class="card main" aria-label="Kosten nach Kostengruppen" style="overflow:hidden"><div class="card-head"><h2 class="kb-h2">Kosten nach Kostengruppen</h2>'+
    '<div class="seg" role="group" aria-label="Beträge"><button type="button" data-act="brutto" data-wert="0" aria-pressed="'+!ui.brutto+'">netto</button><button type="button" data-act="brutto" data-wert="1" aria-pressed="'+ui.brutto+'">brutto</button></div></div>'+
    '<div class="row head"><span>Kostengruppe</span><span class="num">Betrag</span><span class="num hide-s">Anteil</span><span class="hide-s"></span><span class="hide-s">Stand</span><span></span></div>'+zeilen+
    '<div class="sumrow"><div><p style="margin:0;font-weight:700">Summe '+(ui.brutto?'brutto':'netto')+(g.vollstaendig?'':', vorläufig')+'</p>'+
    '<p class="meta">'+(ui.brutto?'darin '+esc(R.zahl(st.ustProzent))+' % USt. '+R.euro(calc.ustCent):'zzgl. '+esc(R.zahl(st.ustProzent))+' % USt. '+R.euro(calc.ustCent)+' · brutto '+R.euro(calc.bruttoCent))+'</p></div>'+
    '<p class="num" style="margin:0;font-size:22px;font-weight:700;letter-spacing:-.02em">'+betrag(g.bekanntCent)+'</p></div></section>';
  return karten+'<div class="cols">'+liste+'<aside class="side" aria-label="Was noch fehlt">'+karteFehlt()+karteArchicad()+karteHerkunft()+'</aside></div>';
}
function zeileUebersicht(k,klasse,kn,anteil,chev){
  const pauschal=!kn,aus=kn?.status==='entfaellt';
  const b=pauschal?positionenIn(k.kg).reduce((s,p)=>{const r=calc.positionen.find(x=>x.id===p.id);return s+(r?.betragCent&&!r.ausgeschlossen?r.betragCent:0n)},0n):(kn.bekanntCent||0n);
  const zu=pauschal?k.kg:k.kg;
  return '<div class="row '+klasse+' klick'+(aus?' aus':'')+'" data-act="kg-gehe" data-kg="'+esc(zu)+'" role="button" tabindex="0">'+
    '<span class="name">'+(pauschal?'<span class="meta">'+esc(k.titel)+'</span>':'<span class="kg">'+esc(k.kg)+'</span>'+esc(k.titel))+'</span>'+
    '<span class="num">'+(aus?'entfällt':(kn?.status==='enthalten'?'<span class="meta">in Pauschale</span>':betrag(b)))+'</span><span class="num hide-s meta">'+(aus?'':anteil(b))+'</span><span class="hide-s"></span>'+
    '<span class="hide-s">'+(pauschal?'':chipKg(kn))+'</span>'+(pauschal?'<span class="chev" aria-hidden="true"></span>':chev(k.kg,kinderVon(k.kg).length>0))+'</div>';
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
  if(!imp.length)return '<section class="card" style="padding:18px 20px"><h2 class="kb-h2">Mengen aus Archicad</h2><p class="meta" style="margin:6px 0 12px">Noch kein Import. Die Interaktive Auswertung «TBA Kosten · Mengen» als Excel speichern und hier einlesen.</p>'+
    (kannBearbeiten?'<button type="button" class="btn" data-act="import">'+ICON_IMPORT+'Mengen einlesen</button>':'')+'</section>';
  const letzter=imp[0],aend=I.vergleiche(imp[1]?.gruppen||null,letzter.gruppen).filter(x=>x.art!=='gleich');
  const typen=new Set(letzter.gruppen.map(g=>g.bauteiltyp).filter(Boolean)).size;
  return '<section class="card" style="padding:18px 20px"><h2 class="kb-h2">Mengen aus Archicad</h2><p class="meta" style="margin:4px 0 10px">Letzter Import '+esc(datum(letzter.datum))+(letzter.datei?' · '+esc(letzter.datei):'')+' · '+typen+' Bauteiltypen · '+letzter.gruppen.length+' Gruppen</p>'+
    (imp.length>1?'<p style="margin:10px 0 4px;font-size:13px;font-weight:600">Seit dem Import vom '+esc(datum(imp[1].datum))+'</p>'+
      (aend.length?aend.slice(0,6).map(x=>'<div class="mini"><span>'+esc((x.bauteiltyp||'ohne Typ')+' · KG '+x.kg)+'</span><span class="num">'+
        (x.art==='neu'?'neu':x.art==='entfernt'?'entfernt':esc((x.delta.startsWith('-')?'−'+R.zahl(x.delta.slice(1)):'+'+R.zahl(x.delta))+' '+x.einheit))+'</span></div>').join(''):'<p class="meta">keine Änderungen</p>'):'')+'</section>';
}
function karteHerkunft(){
  const h=Object.entries(calc.herkunft).filter(([,c])=>c>0n).sort((a,b)=>(b[1]>a[1]?1:-1));
  if(!h.length)return '';
  const summe=h.reduce((s,[,c])=>s+c,0n);
  return '<section class="card" style="padding:18px 20px"><h2 class="kb-h2">Herkunft der Beträge</h2><div style="margin-top:8px">'+h.map(([art,c])=>
    '<div class="mini"><span>'+esc(R.ARTEN[art]?.label||'ohne Quelle')+'</span><span class="num">'+R.prozent(Number(R.teile(c*1000n,summe))/10)+'</span></div>').join('')+'</div></section>';
}

// Positionen: die Gliederung bis zur 3. Ebene, jede Kostengruppe als Zeile, ihre Positionen darunter.
function chipFilter(kg,text,an,aus){return '<button type="button" class="chip'+(aus?' chip-aus':'')+'" data-act="filter" data-kg="'+esc(kg)+'" aria-pressed="'+an+'">'+esc(text)+'</button>'}
function tabPositionen(){
  const ergebnis=new Map(calc.positionen.map(r=>[r.id,r]));
  const f=ui.filter,erste=(st.katalog||[]).filter(k=>R.ebene(k.kg)===1);
  const zuKlaeren=[...calc.blaetter.values()].filter(s=>s==='leer'||s==='offen').length;
  let chips='<div class="filter" role="group" aria-label="Kostengruppen 1. Ebene">'+chipFilter('','Alle',!f)+chipFilter('offen','Zu klären · '+zuKlaeren,f==='offen')+
    erste.map(k=>chipFilter(k.kg,k.kg,!!f&&f!=='offen'&&f[0]===k.kg[0],calc.knoten.get(k.kg)?.status==='entfaellt')).join('')+'</div>';
  if(f&&f!=='offen'){
    const e1=f[0]+'00',zweite=kinderVon(e1);
    if(zweite.length)chips+='<div class="filter" role="group" aria-label="Kostengruppen 2. Ebene">'+chipFilter(e1,'Alle in '+e1,f===e1)+
      zweite.map(k=>chipFilter(k.kg,k.kg+' '+k.titel,f===k.kg||(R.ebene(f)===3&&f.slice(0,2)===k.kg.slice(0,2)),calc.knoten.get(k.kg)?.status==='entfaellt')).join('')+'</div>';
  }
  const nurOffen=f==='offen';
  let zeilen='';
  if(!f||nurOffen)for(const k of erste)zeilen+=zeilenKnoten(k,ergebnis,nurOffen,true);
  else{
    const e=R.ebene(f),k=baum.eintrag.get(f);
    if(k){
      if(e===3||!kinderVon(f).length)zeilen=zeilenBlatt(k,ergebnis,false);
      else{
        zeilen=zeilenPauschal(f,ergebnis,false);
        for(const c of kinderVon(f))zeilen+=zeilenKnoten(c,ergebnis,false,e===1);
      }
    }
  }
  const ohneKg=(st.positionen||[]).filter(p=>!baum.eintrag.has(String(p.kg||'')));
  if((!f||nurOffen)&&ohneKg.length)zeilen+='<div class="pos grp"><span class="kg">–</span><span class="pname"><strong>Ohne gültige Kostengruppe</strong><small>Kostengruppe in der Position eintragen</small></span><span></span><span></span><span></span><span></span></div>'+
    ohneKg.map(p=>zeilePosition(p,ergebnis.get(p.id),{kind:true})).join('');
  const kopfZeile='<div class="pos head"><span>KG</span><span>Kostengruppe · Position</span><span class="num">Menge</span><span class="num">Kennwert</span><span class="num">Betrag</span><span>Stand · Herkunft</span></div>';
  const summe=!f?calc.gesamt.bekanntCent:(nurOffen?null:(calc.knoten.get(f)?.bekanntCent??0n));
  const kopfText=!f?'Alle Kostengruppen':nurOffen?'Zu klären':kgName(f);
  const neuKg=ui.kgAuswahl&&calc.knoten.get(ui.kgAuswahl)?.blatt?ui.kgAuswahl:(R.ebene(f)===3?f:'');
  const tabelle='<section class="card main" style="overflow:hidden" aria-label="Positionen"><div class="card-head"><h2 class="kb-h2">'+esc(kopfText)+'</h2>'+
    (kannBearbeiten?'<button type="button" class="btn" data-act="pos-neu" data-kg="'+esc(neuKg)+'">'+ICON_PLUS+'Position</button>':'')+'</div>'+
    '<div class="tbl">'+kopfZeile+(zeilen||'<p class="leer">'+(nurOffen?'Nichts zu klären. Jede Kostengruppe hat einen Ansatz, entfällt oder ist in einer Pauschale enthalten.':'Keine Kostengruppen in dieser Auswahl.')+'</p>')+
    (summe!==null&&zeilen?'<div class="pos head summe"><span></span><span>Summe der Auswahl</span><span></span><span></span><span class="num">'+R.euro(summe)+'</span><span></span></div>':'')+
    '</div></section>';
  const pos=(st.positionen||[]).find(p=>p.id===ui.auswahl);
  const panel=pos?panelPosition(pos,ergebnis.get(pos.id)):(ui.kgAuswahl?panelKg(ui.kgAuswahl):
    '<section class="card panel"><p class="meta">Eine Kostengruppe oder Position wählen. Jede Kostengruppe bis zur 3. Ebene steht in der Liste: mit Ansatz, offen, in einer Pauschale enthalten oder entfällt.</p></section>');
  return chips+'<div class="cols">'+tabelle+'<aside class="side">'+panel+'</aside></div>';
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
  const n=calc.knoten.get(k.kg),e=R.ebene(k.kg),aus=n?.status==='entfaellt';
  return '<button type="button" class="pos '+(e===1?'grp1':'grp')+(ui.kgAuswahl===k.kg?' sel':'')+(aus?' aus':'')+'" data-act="kg" data-kg="'+esc(k.kg)+'">'+
    '<span class="kg">'+esc(k.kg)+'</span><span class="pname"><strong>'+esc(k.titel)+'</strong>'+(n?.kgGesamt?'<small>'+n.geklaert+' von '+n.kgGesamt+' geklärt</small>':'')+'</span>'+
    '<span></span><span></span><span class="num">'+(aus?'entfällt':R.euro(n?.bekanntCent||0n))+'</span><span>'+chipKg(n)+'</span></button>';
}
function zeilenPauschal(kg,ergebnis,nurOffen){
  const liste=positionenIn(kg).filter(p=>!nurOffen||istProblem(p,ergebnis));
  return liste.map(p=>zeilePosition(p,ergebnis.get(p.id),{kind:true,pauschal:kg})).join('');
}
function zeilenBlatt(k,ergebnis,nurOffen){
  const n=calc.knoten.get(k.kg),liste=positionenIn(k.kg);
  if(nurOffen&&!(n?.status==='leer'||n?.status==='offen'||liste.some(p=>istProblem(p,ergebnis))))return '';
  if(liste.length===1&&n?.status!=='entfaellt')return zeilePosition(liste[0],ergebnis.get(liste[0].id),{blatt:k});
  const aus=n?.status==='entfaellt',eigenerHinweis=(st.vorlagen||{})[k.kg]?.hinweis||'';
  const mit=entfaelltMit(k.kg),pau=n?.status==='enthalten'?pauschalIn(k.kg):'';
  // Unter einer entfallenden Gruppe genügt der Verweis; die Begründung steht an der Gruppe.
  const klein=aus?(mit?'Entfällt mit KG '+mit:'Entfällt'+(st.gruppen?.[k.kg]?.notiz?': '+st.gruppen[k.kg].notiz:'')):
    pau?'in der Pauschale von KG '+pau:liste.length>1?liste.length+' Positionen':eigenerHinweis;
  let html='<button type="button" class="pos kgz'+(ui.kgAuswahl===k.kg?' sel':'')+(aus?' aus':'')+(n?.status==='leer'?' leer-kg':'')+'" data-act="kg" data-kg="'+esc(k.kg)+'">'+
    '<span class="kg">'+esc(k.kg)+'</span><span class="pname"><strong>'+esc(k.titel)+'</strong>'+(klein?'<small>'+esc(klein)+'</small>':'')+'</span>'+
    '<span class="num">'+(liste.length>1?'':'–')+'</span><span class="num">'+(liste.length>1?'':'–')+'</span>'+
    '<span class="num" style="font-weight:600">'+(aus?'entfällt':liste.length?R.euro(n?.bekanntCent||0n):'–')+'</span><span>'+chipKg(n)+'</span></button>';
  if(liste.length>1||(aus&&liste.length))html+=liste.filter(p=>!nurOffen||istProblem(p,ergebnis)).map(p=>zeilePosition(p,ergebnis.get(p.id),{kind:true})).join('');
  return html;
}
function zeilePosition(p,r,{blatt=null,kind=false,pauschal=''}={}){
  const aus=r.status==='entfaellt'||r.ausgeschlossen;
  const art=R.ARTEN[p.kennwert?.art];
  const herkunft=r.status==='entfaellt'?'<span class="chip">entfällt</span>':(art?'<span class="chip'+(p.kennwert.art==='annahme'?'':' chip-src')+'">'+esc(art.kurz)+'</span>':'<span class="chip chip-att">Quelle fehlt</span>');
  const katTitel=titel(p.kg);
  const eigen=p.titel&&p.titel!==katTitel?p.titel:'';
  let gross,unter;
  if(blatt){gross=blatt.titel;unter=[eigen,p.bauteiltyp,aufbauText(p),p.notiz]}
  else if(pauschal){gross='Pauschal für KG '+pauschal+(eigen?' · '+eigen:'');unter=[p.notiz]}
  else{gross=eigen||p.bauteiltyp||katTitel||'Ohne Bezeichnung';unter=[eigen?p.bauteiltyp:'',aufbauText(p),p.notiz]}
  if(p.ausImportEntfernt)unter.push('nicht mehr im Modell');
  if(r.status==='offen'&&!blatt)unter.push('offen');
  const klein=unter.filter(Boolean).join(' · ');
  return '<button type="button" class="pos'+(kind?' kind':'')+(ui.auswahl===p.id?' sel':'')+(aus?' aus':'')+'" data-act="waehle" data-id="'+esc(p.id)+'">'+
    '<span class="kg">'+(kind?'':esc(p.kg||'–'))+'</span><span class="pname"><strong>'+esc(gross)+'</strong>'+(klein?'<small>'+esc(klein)+'</small>':'')+'</span>'+
    '<span class="num">'+(p.modus==='betrag'?'<span class="meta">Betrag</span>':(R.dezimal(p.menge)?esc(R.zahl(p.menge,2)+' '+(p.einheit||'')):'–'))+'</span>'+
    '<span class="num">'+(p.modus==='betrag'?'':(r.kennwertCent!==null?R.euro(r.kennwertCent,{nachkomma:true}):'–'))+'</span>'+
    '<span class="num" style="font-weight:600">'+(r.status==='entfaellt'?'entfällt':(r.betragCent!==null?R.euro(r.betragCent):'<span class="offen">offen</span>'))+'</span>'+
    '<span>'+herkunft+'</span></button>';
}
function panelKg(kg){
  const n=calc.knoten.get(kg);if(!n)return '';
  const kinder=kinderVon(kg),poss=positionenIn(kg),markiert=st.gruppen?.[kg]?.status==='entfaellt',mit=entfaelltMit(kg),v=vorlage(kg);
  const pau=n.status==='enthalten'?pauschalIn(kg):'';
  let stand;
  if(mit)stand='Entfällt mit KG '+mit+(st.gruppen[mit].notiz?': '+st.gruppen[mit].notiz:'')+'.';
  else if(markiert)stand='Entfällt. Was hier steht, zählt nicht zur Summe und nicht als offen.';
  else if(n.blatt)stand={leer:'Ohne Ansatz: noch nicht entschieden. Eine Position anlegen oder «entfällt» setzen.',frei:'Optional. Bleibt sie leer, zählt sie nicht als offen.',
    enthalten:'In der Pauschale von KG '+pau+' enthalten.',offen:n.offen+(n.offen===1?' Position ist':' Positionen sind')+' noch nicht vollständig belegt.',
    vollstaendig:'Vollständig belegt.',entfaellt:'Alle Positionen entfallen.'}[n.status]||'';
  else stand=n.geklaert+' von '+n.kgGesamt+' Kostengruppen geklärt'+(n.zuKlaeren?', '+n.zuKlaeren+' zu klären':'')+'.';
  let html='<section class="card panel"><p class="kicker">Kostengruppe · '+['','1. Ebene','2. Ebene','3. Ebene'][R.ebene(kg)]+'</p><h2>'+esc(kgName(kg))+'</h2>'+
    '<p class="meta">'+esc(stand)+(n.bekanntCent>0n?' <strong style="color:var(--kb-ink)">'+R.euro(n.bekanntCent)+'</strong> netto':'')+'</p>'+
    (v.hinweis?'<p class="meta hinweis">'+esc(v.hinweis)+'</p>':'');
  if(kannBearbeiten&&!mit){
    html+='<div class="kg-akt">';
    if(markiert){
      html+='<div class="form" style="width:100%">'+feld('Begründung','gruppe:'+kg+':notiz',st.gruppen[kg].notiz||'',{attr:'placeholder="z. B. nicht vorhanden"'})+'</div>'+
        '<button type="button" class="btn" data-act="kg-wieder" data-kg="'+esc(kg)+'">Wieder aufnehmen</button>';
    }else{
      html+=(kinder.length?'':'<button type="button" class="btn btn-primary" data-act="pos-neu" data-kg="'+esc(kg)+'">'+ICON_PLUS+'Position anlegen</button>')+
        '<button type="button" class="btn" data-act="kg-entfaellt" data-kg="'+esc(kg)+'">Entfällt</button>';
      if(kinder.length){
        const rest=blaetterUnter(kg).filter(b=>calc.blaetter.get(b)==='leer');
        html+='<button type="button" class="btn" data-act="pos-neu" data-kg="'+esc(kg)+'">'+ICON_PLUS+'Pauschale für die ganze KG</button>'+
          (rest.length?'<button type="button" class="btn" data-act="kg-rest" data-kg="'+esc(kg)+'">Übrige '+rest.length+' ohne Ansatz: entfällt</button>':'');
      }
    }
    html+='</div>';
  }
  if(poss.length)html+='<p class="sec">'+(kinder.length?'Pauschale':'Positionen')+'</p>'+poss.map(p=>{const r=calc.positionen.find(x=>x.id===p.id);
    return '<button type="button" class="kg-kind" data-act="waehle" data-id="'+esc(p.id)+'"><span>'+esc(p.bauteiltyp||(p.titel&&p.titel!==titel(p.kg)?p.titel:'Position'))+'</span><span class="num">'+(r?.betragCent!=null?R.euro(r.betragCent):'offen')+'</span></button>'}).join('');
  if(kinder.length)html+='<p class="sec">Kostengruppen</p>'+kinder.map(c=>'<button type="button" class="kg-kind" data-act="kg" data-kg="'+esc(c.kg)+'"><span><span class="kg">'+esc(c.kg)+'</span>'+esc(c.titel)+'</span>'+chipKg(calc.knoten.get(c.kg))+'</button>').join('');
  return html+'</section>';
}
function feld(label,key,wert,{attr='',typ='text',hinweis=''}={}){
  return '<label class="feld">'+esc(label)+'<input type="'+typ+'" data-key="'+esc(key)+'" value="'+esc(wert??'')+'"'+(kannBearbeiten?'':' readonly')+' '+attr+'>'+(hinweis?'<span class="meta" style="font-weight:400">'+esc(hinweis)+'</span>':'')+'</label>';
}
function auswahl(label,key,wert,optionen){
  return '<label class="feld">'+esc(label)+'<select data-key="'+esc(key)+'"'+(kannBearbeiten?'':' disabled')+'>'+optionen.map(([v,t])=>'<option value="'+esc(v)+'"'+(String(v)===String(wert??'')?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>';
}
function haken(label,key,an){return '<label class="check"><input type="checkbox" data-key="'+esc(key)+'"'+(an?' checked':'')+(kannBearbeiten?'':' disabled')+'>'+esc(label)+'</label>'}
function schalterAn(kw,name){if(typeof kw?.[name]==='boolean')return kw[name];return !!R.ARTEN[kw?.art]?.[name]}
function panelPosition(p,r){
  const k='pos:'+p.id+':';const kw=p.kennwert||{};
  const artOpt=[['','Bitte wählen'],...Object.entries(R.ARTEN).map(([a,x])=>[a,x.label])];
  const qOpt=[['','wie die Kostenberechnung'],...quartale().map(q=>[q,R.quartalText(q)])];
  const gruppe=KG_MUSTER.test(String(p.kg||''))&&kinderVon(p.kg).length>0;
  let html='<section class="card panel"><p class="kicker">'+(gruppe?'Pauschale':'Position')+'</p><h2>'+esc(kgName(p.kg)||'Neue Position')+'</h2>'+
    '<p class="meta">'+(r.status==='entfaellt'?'entfällt':r.betragCent!==null?(p.modus==='betrag'?'Betrag ':esc(R.zahl(p.menge,2))+' '+esc(p.einheit||'')+' × '+R.euro(r.kennwertCent,{nachkomma:true})+' = ')+'<strong style="color:var(--kb-ink)">'+R.euro(r.betragCent,{nachkomma:true})+'</strong> netto':
      'Offen: '+esc(r.fehlt.map(f=>({kg:'Kostengruppe',menge:'Menge',betrag:'Betrag',kennwert:'Kennwert',mengenquelle:'Herkunft der Menge',quelle:'Quelle',fundstelle:'Fundstelle'}[f]||f)).join(', ')))+'</p>'+
    (gruppe?'<p class="meta hinweis">Gilt für die ganze KG '+esc(p.kg)+'. Ihre Unter-Kostengruppen ohne eigene Position gelten als enthalten.</p>':'')+
    (KG_MUSTER.test(String(p.kg||''))?'<p style="margin:8px 0 0"><button type="button" class="btn btn-quiet" style="padding:0;min-height:0" data-act="kg" data-kg="'+esc(p.kg)+'">Zur KG '+esc(p.kg)+'</button></p>':'')+
    '<div class="form" style="margin-top:14px"><div class="two">'+feld('Kostengruppe',k+'kg',p.kg,{attr:'list="kbKgListe" inputmode="numeric" maxlength="3"'})+feld('Bezeichnung',k+'titel',p.titel)+'</div>'+
    '<div class="two">'+feld('Bauteiltyp',k+'bauteiltyp',p.bauteiltyp,{attr:'placeholder="z. B. AW-01"'})+feld('Notiz',k+'notiz',p.notiz)+'</div>'+
    '<div class="seg" role="group" aria-label="Berechnung"><button type="button" data-act="modus" data-id="'+esc(p.id)+'" data-wert="menge" aria-pressed="'+(p.modus!=='betrag')+'"'+(kannBearbeiten?'':' disabled')+'>Menge × Kennwert</button>'+
    '<button type="button" data-act="modus" data-id="'+esc(p.id)+'" data-wert="betrag" aria-pressed="'+(p.modus==='betrag')+'"'+(kannBearbeiten?'':' disabled')+'>Betrag</button></div>';
  if(p.modus==='betrag'){
    html+='<div class="two">'+feld('Betrag netto (€)',k+'betrag',R.zahl(p.betrag,2),{attr:'inputmode="decimal"'})+auswahl('Quelle',k+'kennwert.art',kw.art,artOpt)+'</div>'+
      feld('Fundstelle',k+'kennwert.fundstelle',kw.fundstelle,{attr:'placeholder="z. B. Kostenbeitrag HLS vom …"'});
  }else{
    html+='<div class="two">'+feld('Menge',k+'menge',R.zahl(p.menge,3),{attr:'inputmode="decimal"'})+
      auswahl('Einheit',k+'einheit',p.einheit||'m²',R.EINHEITEN.map(e=>[e,e]))+'</div>'+
      auswahl('Herkunft der Menge',k+'mengenquelle.art',p.mengenquelle?.art||'',[['','Bitte wählen'],...Object.entries(R.MENGENQUELLEN)])+
      feld('Mengennachweis',k+'mengenquelle.text',p.mengenquelle?.text,{attr:'placeholder="z. B. Auswertung Archicad vom …"'})+
      '<p class="sec">Kennwert</p><div class="two">'+feld('Kennwert (€ je '+(p.einheit||'Einheit')+')',k+'kennwert.wert',R.zahl(kw.wert,4),{attr:'inputmode="decimal"'})+auswahl('Quelle',k+'kennwert.art',kw.art,artOpt)+'</div>'+
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
      }).join('')+r.hinweise.map(h=>'<p class="meta att" style="margin-top:6px">'+esc({index_fehlt:'Baupreisindex für '+(R.quartalText(kw.kostenstand)||'den Kostenstand')+' oder '+R.quartalText(st.kostenstand)+' fehlt (Quellen).',
        regionalfaktor_fehlt:'Regionalfaktor fehlt (Quellen).',zuschlag_fehlt:'Zuschlag fehlt (Quellen).',nicht_mehr_im_modell:'Diese Menge kam aus Archicad und fehlt im letzten Import.'}[h]||h)+'</p>').join('');
    }
  }
  if(kannBearbeiten)html+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">'+
    '<button type="button" class="btn" data-act="entfaellt" data-id="'+esc(p.id)+'">'+(p.status==='entfaellt'?'Wieder aufnehmen':'Entfällt')+'</button>'+
    '<button type="button" class="btn btn-danger" data-act="loeschen" data-id="'+esc(p.id)+'">'+(ui.loeschen===p.id?'Wirklich löschen?':'Löschen')+'</button></div>';
  return html+'</div></section>';
}

// Quellen und Grundlagen
function tabQuellen(){
  const qOpt=quartale().map(q=>[q,R.quartalText(q)]);
  const indizes=(st.indizes||[]).map((x,i)=>'<tr><td>'+'<select data-key="index:'+i+':quartal" aria-label="Quartal"'+(kannBearbeiten?'':' disabled')+'>'+qOpt.map(([v,t])=>'<option value="'+v+'"'+(v===x.quartal?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></td>'+
    '<td><input type="text" inputmode="decimal" data-key="index:'+i+':wert" value="'+esc(R.zahl(x.wert,1))+'" aria-label="Indexwert"'+(kannBearbeiten?'':' readonly')+'></td>'+
    '<td>'+(kannBearbeiten?'<button type="button" class="btn btn-quiet" data-act="index-weg" data-i="'+i+'" aria-label="Zeile entfernen">Entfernen</button>':'')+'</td></tr>').join('');
  const gruppen=(st.katalog||[]).filter(k=>R.ebene(k.kg)===1).map(k=>{const g=st.gruppen?.[k.kg]||{};return '<tr><td><span class="kg">'+esc(k.kg)+'</span>'+esc(k.titel)+'</td>'+
    '<td>'+haken('entfällt','gruppe:'+k.kg+':status',g.status==='entfaellt')+'</td><td><input type="text" data-key="gruppe:'+k.kg+':notiz" value="'+esc(g.notiz||'')+'" aria-label="Begründung"'+(kannBearbeiten?'':' readonly')+'></td></tr>'}).join('');
  const weitere=Object.entries(st.gruppen||{}).filter(([kg,g])=>g?.status==='entfaellt'&&R.ebene(kg)>1).sort(([a],[b])=>a.localeCompare(b)).map(([kg,g])=>
    '<tr><td><span class="kg">'+esc(kg)+'</span>'+esc(titel(kg))+'</td><td><input type="text" data-key="gruppe:'+esc(kg)+':notiz" value="'+esc(g.notiz||'')+'" aria-label="Begründung KG '+esc(kg)+'"'+(kannBearbeiten?'':' readonly')+'></td>'+
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
      auswahl('Kostenstand der Kostenberechnung','st:kostenstand',st.kostenstand,qOpt)+feld('Umsatzsteuer (%)','st:ustProzent',R.zahl(st.ustProzent,2),{attr:'inputmode="decimal"'})+'</div>'+
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
    '<section class="card" style="grid-column:1/-1"><h2 class="kb-h2">Quellenverzeichnis</h2><p class="meta" style="margin:6px 0 8px">Aus den Fundstellen der Positionen zusammengestellt.</p>'+
      (quellen.length?'<div class="tbl"><table class="kb-table"><thead><tr><th>Quelle</th><th>Fundstelle</th></tr></thead><tbody>'+quellen.map(q=>'<tr><td>'+esc(R.ARTEN[q.a]?.label||q.a)+'</td><td>'+esc(q.f||'–')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="meta">Noch keine Quellen.</p>')+'</section>'+
    '</div>';
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
  const posListe=(st.positionen||[]).filter(p=>!calc.positionen.find(r=>r.id===p.id)?.ausgeschlossen).sort((a,b)=>String(a.kg).localeCompare(String(b.kg)));
  const ergebnis=new Map(calc.positionen.map(r=>[r.id,r]));
  const herleitung='<div class="tbl"><table class="kb-table"><thead><tr><th>KG</th><th>Position</th><th class="num">Menge</th><th class="num">Kennwert</th><th class="num">Betrag</th><th>Quelle</th></tr></thead><tbody>'+
    posListe.map(p=>{const r=ergebnis.get(p.id);return '<tr><td>'+esc(p.kg)+'</td><td>'+esc(p.titel||titel(p.kg))+(p.bauteiltyp?' · '+esc(p.bauteiltyp):'')+'</td>'+
      '<td class="num">'+(p.modus==='betrag'||!R.dezimal(p.menge)?'':esc(R.zahl(p.menge,2)+' '+(p.einheit||'')))+'</td><td class="num">'+(p.modus==='betrag'||r.kennwertCent===null?'':R.euro(r.kennwertCent,{nachkomma:true}))+'</td>'+
      '<td class="num">'+(r.status==='entfaellt'?'entfällt':r.betragCent===null?'offen':R.euro(r.betragCent))+'</td><td>'+esc([R.ARTEN[p.kennwert?.art]?.kurz,p.kennwert?.fundstelle].filter(Boolean).join(' · '))+'</td></tr>'}).join('')+'</tbody></table></div>';
  const vgl=calc.ksSummeCent===null?'<p class="meta">Keine Kostenschätzung eingetragen.</p>':'<div class="tbl"><table class="kb-table"><thead><tr><th>KG</th><th class="num">Kostenschätzung</th><th class="num">Kostenberechnung</th><th class="num">Abweichung</th><th>Ursache</th></tr></thead><tbody>'+
    calc.vergleich.filter(v=>!v.entfaellt).map(v=>'<tr><td>'+esc(v.kg)+'</td><td class="num">'+R.euro(v.ksCent)+'</td><td class="num">'+R.euro(v.kbCent)+'</td><td class="num">'+(v.deltaCent===null?'–':R.euro(v.deltaCent,{vorzeichen:true})+' · '+R.prozent(v.deltaProzent,{vorzeichen:true}))+'</td><td>'+esc(v.ursache)+'</td></tr>').join('')+'</tbody></table></div>';
  const offen=sortiereFehlt(calc.fehlt.filter(f=>f.schwere==='hoch'));
  const quellen=[...new Set((st.positionen||[]).filter(p=>p.kennwert?.art&&p.status!=='entfaellt').map(p=>[R.ARTEN[p.kennwert.art]?.label,p.kennwert.fundstelle].filter(Boolean).join(': ')))].sort((a,b)=>a.localeCompare(b,'de'));
  return '<div class="titelblock"><div><p class="kicker">Kostenberechnung nach '+esc(st.norm||'DIN 276')+'</p><h2>'+esc(doc.project_name)+'</h2>'+
    '<p class="meta">'+esc([doc.project_number!=='Muster'?doc.project_number:'','Leistungsphase 3','Kostenstand '+(R.quartalText(st.kostenstand)||'offen'),'Stand '+datum(doc.updated_at||new Date().toISOString())].filter(Boolean).join(' · '))+'</p></div>'+
    '<div style="text-align:right"><p class="meta">Summe netto'+(g.vollstaendig?'':', vorläufig')+'</p><p style="font-size:24px;font-weight:700;margin:2px 0" class="num">'+R.euro(g.bekanntCent)+'</p>'+
    (calc.kennzahlen.jeBGF!==null?'<p class="meta">Bauwerk (KG 300 + 400) '+R.euro(calc.kennzahlen.jeBGF)+'/m² BGF</p>':'')+'</div></div>'+
    (g.vollstaendig?'':'<p class="meta att" style="margin-top:10px">Vorläufig: '+calc.vollstaendigkeit.erledigt+' von '+calc.vollstaendigkeit.gesamt+' Kostengruppen geklärt; '+offen.length+' Punkte sind noch offen (Abschnitt «Offene Punkte»).</p>')+
    '<h3>Zusammenstellung, 1. Ebene</h3>'+ebene1+'<h3>Kostenberechnung bis zur 3. Ebene</h3>'+ebene3+'<h3>Positionen: Mengen, Kennwerte und Quellen</h3>'+herleitung+
    '<h3>Vergleich mit der Kostenschätzung</h3>'+vgl+
    (st.annahmen?'<h3>Annahmen und Erläuterungen</h3><p style="white-space:pre-line;font-size:13px">'+esc(st.annahmen)+'</p>':'')+
    (offen.length?'<h3>Offene Punkte</h3><ul style="font-size:13px;margin:0;padding-left:18px">'+offen.map(f=>'<li>'+esc(f.text)+'</li>').join('')+'</ul>':'')+
    '<h3>Quellen</h3>'+(quellen.length?'<ul style="font-size:13px;margin:0;padding-left:18px">'+quellen.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ul>':'<p class="meta">Keine Quellen angegeben.</p>')+
    (st.indizes?.length?'<p class="meta" style="margin-top:8px">Fortschreibung mit '+esc(st.indexReihe||'Baupreisindex')+'.</p>':'');
}

// ---------- Import ----------
function dialogImport(){
  ui.importVorschau=null;
  dialog.innerHTML='<div class="dlg"><h2>Mengen aus Archicad einlesen</h2>'+
    '<p class="meta">Die Interaktive Auswertung «TBA Kosten · Mengen» als Excel (.xlsx) oder CSV speichern und hier wählen. Erkannt werden die Spalten KG (Klassifizierung DIN 276), Bauteiltyp, Aufbau, Anzahl, Fläche, Länge und Volumen.</p>'+
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
      if(!p.titel||p.titel===titel(p.kg))p.titel=titel(wert)||p.titel;p.kg=wert}
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
    if(feld==='status'){if(wert)st.gruppen[kg].status='entfaellt';else delete st.gruppen[kg]}else st.gruppen[kg].notiz=wert}
  else if(key.startsWith('rezept:')){const teile=key.slice(7).split(':');const feld=teile.pop(),i=teile.pop(),typ=teile.join(':');
    const z=st.rezepte?.[typ]?.zeilen?.[Number(i)];if(!z)return;
    if(feld==='kg'){if(!KG_MUSTER.test(wert)){ui.meldung='Die Kostengruppe hat drei Ziffern.';render();return}z.kg=wert}
    else{const d=R.eingabe(wert);if(!d||!(Number(d)>0&&Number(d)<=20)){ui.meldung='Der Faktor ist eine Zahl, zum Beispiel 1 oder 2.';render();return}z.faktor=d}
    ui.meldung='Rezept geändert. Es wirkt beim nächsten Import.'}
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
// Neue Position in einer Kostengruppe; Rechenweise, Einheit und Quelle nach der Vorgabe des Musters.
// In einer KG mit Unter-KG ist es eine Pauschale für die ganze KG.
function neuePosition(kg){
  const id='p:'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const gueltig=KG_MUSTER.test(String(kg||''))?kg:'';
  const v=gueltig?vorlage(gueltig):{},gruppe=gueltig&&kinderVon(gueltig).length>0;
  const modus=gruppe?'betrag':(v.modus||'menge');
  const p={id,kg:gueltig,titel:gueltig?titel(gueltig):'',bauteiltyp:'',notiz:'',modus,kennwert:v.art?{art:v.art}:{}};
  if(modus==='menge')Object.assign(p,{menge:null,einheit:v.einheit||'m²',mengenquelle:{art:'manuell',text:''}});else p.betrag=null;
  st.positionen=st.positionen||[];st.positionen.push(p);
  ui.auswahl=id;ui.kgAuswahl=null;ui.tab='positionen';ui.loeschen=null;
  if(gueltig&&(ui.filter==='offen'||(ui.filter&&!(gueltig===ui.filter||R.liegtUnter(gueltig,ui.filter)||(R.ebene(ui.filter)>1&&ui.filter.slice(0,2)===gueltig.slice(0,2))))))ui.filter=gueltig[0]+'00';
  geaendert();render();
  setTimeout(()=>root.querySelector('[data-key="pos:'+CSS.escape(id)+':'+(gueltig?(modus==='betrag'?'betrag':'menge'):'kg')+'"]')?.focus(),0);
}
function zweiteEbene(kg){return KG_MUSTER.test(String(kg||''))?(R.ebene(kg)===3?kg.slice(0,2)+'0':kg):''}
function geheZu(d){
  const {art,kg,id}=d;
  if(art==='position'||art==='hinweis'){ui.tab='positionen';ui.filter=zweiteEbene(kg);ui.auswahl=id||null;ui.kgAuswahl=null}
  else if(art==='leer'||art==='doppelt'||art==='gruppe'){ui.tab='positionen';ui.filter=kg||'';ui.auswahl=null;ui.kgAuswahl=kg||null}
  else if(art==='paar'){ui.tab='positionen';ui.filter=zweiteEbene(kg);ui.auswahl=null;ui.kgAuswahl=kg||null}
  else if(art==='bezug'||art==='grundlage')ui.tab='quellen';
  else ui.tab='vergleich';
  merkeTab();render();window.scrollTo({top:0,behavior:'smooth'});
}
function merkeTab(){if(doc&&!istMuster)history.replaceState(null,'',location.pathname+location.search+'#tab='+ui.tab)}
function zeigePanel(){if(window.innerWidth<1000)setTimeout(()=>root.querySelector('.panel')?.scrollIntoView({behavior:'smooth',block:'start'}),0)}

root.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-act]');if(!b)return;
  const act=b.dataset.act,d=b.dataset;
  if(act==='neu'){dialogNeu();return}
  if(!st)return;
  if(act==='tab'){ui.tab=d.tab;ui.meldung='';merkeTab();render();return}
  if(act==='aufklappen'){ui.offen.has(d.kg)?ui.offen.delete(d.kg):ui.offen.add(d.kg);render();return}
  if(act==='filter'){ui.tab='positionen';ui.filter=d.kg;ui.auswahl=null;ui.kgAuswahl=null;merkeTab();render();return}
  if(act==='kg-gehe'){ui.tab='positionen';ui.filter=zweiteEbene(d.kg)||d.kg;ui.auswahl=null;ui.kgAuswahl=d.kg;merkeTab();render();zeigePanel();return}
  if(act==='kg'){ui.kgAuswahl=d.kg;ui.auswahl=null;ui.loeschen=null;if(ui.tab!=='positionen'){ui.tab='positionen';ui.filter=zweiteEbene(d.kg)||d.kg;merkeTab()}render();zeigePanel();return}
  if(act==='brutto'){ui.brutto=d.wert==='1';render();return}
  if(act==='alle-fehlt'){ui.alleFehlt=!ui.alleFehlt;render();return}
  if(act==='waehle'){ui.auswahl=d.id;ui.kgAuswahl=null;ui.loeschen=null;if(ui.tab!=='positionen'){ui.tab='positionen';merkeTab()}render();zeigePanel();return}
  if(act==='goto'){geheZu(d);return}
  if(act==='drucken'){if(ui.tab!=='bericht'){ui.tab='bericht';render()}setTimeout(()=>window.print(),50);return}
  if(act==='import'&&kannBearbeiten){dialogImport();return}
  if(act==='sichern'){sichernAlsDatei();return}
  if(act==='neuladen'){location.reload();return}
  if(!kannBearbeiten)return;
  if(act==='pos-neu'){neuePosition(d.kg||'');return}
  if(act==='kg-entfaellt'){st.gruppen=st.gruppen||{};st.gruppen[d.kg]={status:'entfaellt',notiz:''};ui.kgAuswahl=d.kg;geaendert();render();
    setTimeout(()=>root.querySelector('[data-key="gruppe:'+CSS.escape(d.kg)+':notiz"]')?.focus(),0);return}
  if(act==='kg-wieder'){if(st.gruppen)delete st.gruppen[d.kg];geaendert();render();return}
  if(act==='kg-rest'){
    const rest=blaetterUnter(d.kg).filter(x=>calc.blaetter.get(x)==='leer');
    st.gruppen=st.gruppen||{};for(const x of rest)st.gruppen[x]={status:'entfaellt',notiz:'nicht vorhanden'};
    ui.meldung=rest.length+(rest.length===1?' Kostengruppe':' Kostengruppen')+' als «entfällt» markiert: '+rest.join(', ')+'.';geaendert();render();return}
  const p=d.id?st.positionen.find(x=>x.id===d.id):null;
  if(act==='modus'&&p){p.modus=d.wert;geaendert();render();return}
  if(act==='entfaellt'&&p){p.status=p.status==='entfaellt'?'':'entfaellt';geaendert();render();return}
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
root.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('[role="button"][data-act]')){ev.preventDefault();ev.target.click()}});
root.addEventListener('change',ev=>{const el=ev.target;if(el.matches('[data-key]'))aendereFeld(el)});
root.addEventListener('submit',ev=>{
  if(ev.target.id!=='kbStand')return;ev.preventDefault();
  const label=ev.target.elements.label.value.trim();if(label)void standFesthalten(label);
});
dialog.addEventListener('click',ev=>{if(ev.target.closest('[data-dlg="zu"]')||ev.target===dialog)dialog.close()});
function tabAusHash(){const t=new URLSearchParams(location.hash.slice(1)).get('tab');return TABS.some(([k])=>k===t)?t:null}
window.addEventListener('hashchange',()=>{const t=tabAusHash();if(t&&t!==ui.tab&&st){ui.tab=t;render()}});

void start();
})();
