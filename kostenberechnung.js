/* TBA Office · Kostenberechnung (21.11.2026, Claude, Auftrag Gari: den Entwurf als Werkzeug im Office umsetzen).
   Oberfläche nach dem Entwurf vom 21.11.: oben die Antwort (Summe, Abweichung, was fehlt), darunter die
   Gliederung nach DIN 276 zum Aufklappen; jede Zahl zeigt ihre Herkunft. Daten wie beim Terminplan:
   Muster → Projekt-Kostenberechnung (JSON-Stand, bedingtes Speichern über server_revision) → Stände.
   Rechnen: kosten-rechnen.js. Archicad-Import: kosten-import.js. */
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
const TABS=[['uebersicht','Übersicht'],['positionen','Positionen'],['quellen','Quellen'],['vergleich','Vergleich'],['bericht','Bericht']];

let nutzer=null,mitglied=null,doc=null,st=null,calc=null,istMuster=false,kannBearbeiten=false;
const ui={tab:'uebersicht',offen:new Set(['300']),filter:'',auswahl:null,brutto:false,loeschen:null,staende:null,importVorschau:null,meldung:''};
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
    try{const e=R.berechne(i.state);summe=R.euro(e.gesamt.bekanntCent)+' netto';stand=e.gesamt.vollstaendig?'vollständig':e.gesamt.offen+' offen'}catch{summe='Stand nicht lesbar'}
    return '<article class="card"><span class="nr">'+esc(i.project_number)+' · '+esc(i.phase)+'</span><h2>'+esc(i.project_name)+'</h2>'+
      '<p class="meta">'+esc(summe)+(stand?' · '+esc(stand):'')+'</p><p class="meta">Zuletzt geändert: '+esc(datum(i.updated_at))+'</p>'+
      '<div class="acts"><a class="btn btn-primary" href="./kostenberechnung.html?id='+encodeURIComponent(i.id)+'">Öffnen</a></div></article>';
  }).join('')||'<p class="meta">Noch keine Kostenberechnung angelegt.</p>';
  root.innerHTML='<div class="kb-wrap"><a class="kb-back" href="./app/#section=tools">‹ Werkzeuge</a>'+
    '<header class="kb-head"><div class="kb-head-text"><p class="kicker">Office · Kostenberechnung</p><h1>Kostenberechnungen</h1>'+
    '<p class="kb-intro">Muster nach DIN 276:2018-12 bis zur 3. Ebene übernehmen, Mengen aus Archicad und Beiträge der Fachplanung zusammenführen und mit der Kostenschätzung vergleichen.</p></div>'+
    (listeDaten.projekte.length&&listeDaten.muster.length?'<div class="kb-actions"><button type="button" class="btn btn-primary" data-act="neu">'+ICON_PLUS+'Kostenberechnung anlegen</button></div>':'')+
    '</header><h2 class="lib">Muster · nur Ansicht</h2><div class="liste">'+karten+'</div>'+
    '<h2 class="lib">Projekt-Kostenberechnungen</h2><div class="liste">'+instanzen+'</div></div>';
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

// ---------- Rendern ----------
function render(){
  if(!st)return;
  renderSpaeter=false;
  calc=R.berechne(st);
  const aktiv=document.activeElement?.dataset?.key||null;
  const kopf='<a class="kb-back" href="./kostenberechnung.html">‹ Kostenberechnungen</a>'+
    '<header class="kb-head"><div class="kb-head-text"><p class="kicker">Office · Kostenberechnung'+(istMuster?' · Muster':'')+'</p>'+
    '<h1>'+esc(doc.project_name)+'</h1><p class="kb-intro">'+esc([doc.project_number!=='Muster'?doc.project_number:'',doc.phase==='LPH3'?'LPH 3':doc.phase,
      (st.norm||'DIN 276')+' bis zur 3. Ebene','Kostenstand '+(R.quartalText(st.kostenstand)||'offen'),istMuster?'Version '+doc.version:'Stand '+datum(doc.updated_at)].filter(Boolean).join(' · '))+'</p></div>'+
    '<div class="kb-actions">'+(kannBearbeiten?'<button type="button" class="btn" data-act="import">'+ICON_IMPORT+'Mengen aus Archicad</button>':'')+
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
function chipStatus(k){
  if(!k)return '<span class="chip chip-att">ohne Ansatz</span>';
  if(k.status==='entfaellt')return '<span class="chip">entfällt</span>';
  if(k.status==='leer')return '<span class="chip chip-att">ohne Ansatz</span>';
  if(k.offen)return '<span class="chip chip-att">'+k.offen+' offen</span>';
  return '<span class="chip chip-ok">vollständig</span>';
}

// Übersicht
function tabUebersicht(){
  const g=calc.gesamt,vgl=calc.ksSummeCent,vorgabe=calc.vorgabe;
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
    '<div class="card"><p class="sum-label">Vollständigkeit</p><p class="big">'+calc.vollstaendigkeit.prozent+' %</p><span class="bar" style="margin:4px 0 10px"><span style="width:'+calc.vollstaendigkeit.prozent+'%"></span></span>'+
      '<p class="meta">'+calc.vollstaendigkeit.erledigt+' von '+calc.vollstaendigkeit.gesamt+' Positionen vollständig belegt</p></div></section>';
  const erste=(st.katalog||[]).filter(k=>R.ebene(k.kg)===1);
  const max=erste.reduce((m,k)=>{const b=calc.knoten.get(k.kg)?.bekanntCent||0n;return b>m?b:m},0n);
  let zeilen='';
  for(const k of erste){
    const kn=calc.knoten.get(k.kg),auf=ui.offen.has(k.kg),aus=kn?.status==='entfaellt';
    const b=kn?.bekanntCent||0n,anteil=g.bekanntCent>0n&&!aus?Number(R.teile(b*1000n,g.bekanntCent))/10:null;
    zeilen+='<div class="row'+(aus?' aus':'')+'"><span class="name"><span class="kg">'+esc(k.kg)+'</span>'+esc(k.titel)+'</span>'+
      '<span class="num"'+(k.kg==='300'?' style="font-weight:650"':'')+'>'+(aus?'entfällt':betrag(b))+'</span><span class="num hide-s meta">'+(anteil===null?'':R.prozent(anteil))+'</span>'+
      '<span class="hide-s">'+(aus?'':'<span class="bar"><span style="width:'+(max>0n?Number(R.teile(b*100n,max)):0)+'%"></span></span>')+'</span>'+
      '<span class="hide-s">'+chipStatus(kn)+'</span>'+
      '<button type="button" class="chev" data-act="aufklappen" data-kg="'+esc(k.kg)+'" aria-expanded="'+auf+'" aria-label="'+esc(k.kg)+(auf?' zuklappen':' aufklappen')+'">›</button></div>';
    if(auf){
      const kinder=(st.katalog||[]).filter(x=>R.ebene(x.kg)===2&&x.kg[0]===k.kg[0]&&calc.knoten.get(x.kg)?.anzahl);
      const direkt=(st.positionen||[]).some(p=>p.kg===k.kg);
      for(const x of kinder){const kx=calc.knoten.get(x.kg);
        zeilen+='<div class="row sub klick" data-act="filter" data-kg="'+esc(x.kg)+'" role="button" tabindex="0"><span class="name"><span class="kg">'+esc(x.kg)+'</span>'+esc(x.titel)+'</span>'+
          '<span class="num">'+betrag(kx.bekanntCent)+'</span><span class="num hide-s meta">'+(g.bekanntCent>0n?R.prozent(Number(R.teile(kx.bekanntCent*1000n,g.bekanntCent))/10):'')+'</span><span class="hide-s"></span>'+
          '<span class="hide-s">'+chipStatus(kx)+'</span><span class="chev" aria-hidden="true">›</span></div>'}
      if(direkt)zeilen+='<div class="row sub klick" data-act="filter" data-kg="'+esc(k.kg)+'" role="button" tabindex="0"><span class="name meta">Positionen direkt in KG '+esc(k.kg)+'</span><span></span><span class="hide-s"></span><span class="hide-s"></span><span class="hide-s"></span><span class="chev" aria-hidden="true">›</span></div>';
      if(!kinder.length&&!direkt)zeilen+='<div class="row sub"><span class="name meta">'+(aus?'Entfällt: '+esc(st.gruppen?.[k.kg]?.notiz||'nicht Teil dieser Kostenberechnung'):'Noch keine Positionen.')+'</span><span></span><span class="hide-s"></span><span class="hide-s"></span><span class="hide-s"></span>'+
        (aus||!kannBearbeiten?'<span></span>':'<button type="button" class="chev" data-act="pos-neu" data-kg="'+esc(k.kg)+'" aria-label="Position in KG '+esc(k.kg)+' hinzufügen">+</button>')+'</div>';
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
// Zuerst, was die ganze Kostenberechnung betrifft, dann die einzelnen Positionen, zuletzt Hinweise.
const RANG_FEHLT={gruppe:0,grundlage:1,ursache:2,position:3,paar:4,bezug:5,vergleich:6,hinweis:7};
function sortiereFehlt(f){return [...f].sort((a,b)=>(a.schwere==='hoch'?0:1)-(b.schwere==='hoch'?0:1)||(RANG_FEHLT[a.art]??9)-(RANG_FEHLT[b.art]??9))}
// Archicad nennt den Bauteiltyp oft im Namen des Aufbaus («AW-01 KS 17,5 + WDVS 16»): nicht doppelt zeigen.
function aufbauText(p){
  const a=String(p.aufbau||'').trim(),t=String(p.bauteiltyp||'').trim();
  if(!a||a===t)return '';
  return t&&a.startsWith(t)?a.slice(t.length).replace(/^[\s·:–-]+/,''):a;
}
function karteFehlt(){
  const f=calc.fehlt;
  if(!f.length)return '<section class="card" style="padding:18px 20px"><h2 class="kb-h2">Was noch fehlt</h2><p class="meta" style="margin-top:8px">Nichts. Jede Position hat Menge, Kennwert und Quelle.</p></section>';
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

// Positionen
function passtFilter(p,r){
  const f=ui.filter;
  if(!f)return true;
  if(f==='offen')return r.status==='offen'||r.hinweise.length>0;
  const e=R.ebene(f);if(e===1)return p.kg?.[0]===f[0];if(e===2)return String(p.kg||'').slice(0,2)===f.slice(0,2);return p.kg===f;
}
function tabPositionen(){
  const ergebnis=new Map(calc.positionen.map(r=>[r.id,r]));
  const ersteMitPos=[...new Set((st.positionen||[]).map(p=>String(p.kg||'')[0]).filter(Boolean))].sort().map(c=>c+'00');
  const offenZahl=calc.positionen.filter(r=>r.status==='offen'||r.hinweise.length).length;
  let chips='<div class="filter" role="group" aria-label="Filter"><button type="button" class="chip" data-act="filter" data-kg="" aria-pressed="'+(!ui.filter)+'">Alle</button>'+
    '<button type="button" class="chip" data-act="filter" data-kg="offen" aria-pressed="'+(ui.filter==='offen')+'">Offen · '+offenZahl+'</button>'+
    ersteMitPos.map(k=>'<button type="button" class="chip" data-act="filter" data-kg="'+k+'" aria-pressed="'+(ui.filter&&ui.filter!=='offen'&&ui.filter[0]===k[0])+'">'+k+'</button>').join('')+'</div>';
  if(ui.filter&&ui.filter!=='offen'){
    const zweite=[...new Set((st.positionen||[]).filter(p=>p.kg?.[0]===ui.filter[0]).map(p=>String(p.kg).slice(0,2)+'0'))].sort();
    if(zweite.length>1||R.ebene(ui.filter)>1)chips+='<div class="filter" role="group" aria-label="Kostengruppe 2. Ebene">'+zweite.map(k=>'<button type="button" class="chip" data-act="filter" data-kg="'+k+'" aria-pressed="'+(ui.filter===k)+'">'+esc(k+' '+titel(k))+'</button>').join('')+'</div>';
  }
  const liste=(st.positionen||[]).filter(p=>passtFilter(p,ergebnis.get(p.id))).sort((a,b)=>String(a.kg).localeCompare(String(b.kg))||String(a.titel||'').localeCompare(String(b.titel||''),'de'));
  const kopfZeile='<div class="pos head"><span>KG</span><span>Position</span><span class="num">Menge</span><span class="num">Kennwert</span><span class="num">Betrag</span><span>Herkunft</span></div>';
  const zeilen=liste.map(p=>{
    const r=ergebnis.get(p.id),aus=r.status==='entfaellt'||r.ausgeschlossen;
    const art=R.ARTEN[p.kennwert?.art];
    const herkunft=r.status==='entfaellt'?'<span class="chip chip-ok">entfällt</span>':(art?'<span class="chip'+(p.kennwert.art==='annahme'?'':' chip-src')+'">'+esc(art.kurz)+'</span>':'<span class="chip chip-att">Quelle fehlt</span>');
    const unter=[p.bauteiltyp,aufbauText(p),p.notiz,p.ausImportEntfernt?'nicht mehr im Modell':''].filter(Boolean).join(' · ');
    return '<button type="button" class="pos'+(ui.auswahl===p.id?' sel':'')+(aus?' aus':'')+'" data-act="waehle" data-id="'+esc(p.id)+'">'+
      '<span class="kg">'+esc(p.kg||'–')+'</span><span class="pname"><strong>'+esc(p.titel||titel(p.kg)||'Ohne Bezeichnung')+'</strong>'+(unter?'<small>'+esc(unter)+'</small>':'')+'</span>'+
      '<span class="num">'+(p.modus==='betrag'?'<span class="meta">Betrag</span>':(R.dezimal(p.menge)?esc(R.zahl(p.menge,2)+' '+(p.einheit||'')):'–'))+'</span>'+
      '<span class="num">'+(p.modus==='betrag'?'':(r.kennwertCent!==null?R.euro(r.kennwertCent,{nachkomma:true}):'–'))+'</span>'+
      '<span class="num" style="font-weight:600">'+(r.status==='entfaellt'?'entfällt':(r.betragCent!==null?R.euro(r.betragCent):'<span class="offen">offen</span>'))+'</span>'+
      '<span>'+herkunft+'</span></button>';
  }).join('');
  const summe=liste.reduce((s,p)=>{const r=ergebnis.get(p.id);return s+(r.betragCent&&!r.ausgeschlossen?r.betragCent:0n)},0n);
  const tabelle='<section class="card main" style="overflow:hidden" aria-label="Positionen"><div class="card-head"><h2 class="kb-h2">'+
    esc(!ui.filter?'Alle Positionen':ui.filter==='offen'?'Offene Positionen':kgName(ui.filter))+'</h2>'+
    (kannBearbeiten?'<button type="button" class="btn" data-act="pos-neu" data-kg="'+esc(R.ebene(ui.filter)===3?ui.filter:'')+'">'+ICON_PLUS+'Position</button>':'')+'</div>'+
    '<div class="tbl">'+kopfZeile+(zeilen||'<p class="leer">Keine Positionen'+(ui.filter?' in dieser Auswahl':'')+'. '+(kannBearbeiten?'Mengen aus Archicad einlesen oder eine Position hinzufügen.':'')+'</p>')+
    (liste.length?'<div class="pos head" style="border-top:1px solid var(--kb-line)"><span></span><span style="font-size:15px;color:var(--kb-ink);font-weight:700">Summe der Auswahl</span><span></span><span></span><span class="num" style="font-size:15px;color:var(--kb-ink);font-weight:700">'+R.euro(summe)+'</span><span>'+liste.length+' Positionen</span></div>':'')+
    '</div></section>';
  const pos=(st.positionen||[]).find(p=>p.id===ui.auswahl);
  return chips+'<div class="cols">'+tabelle+'<aside class="side">'+(pos?panelPosition(pos,ergebnis.get(pos.id)):'<section class="card panel"><p class="meta">Eine Position wählen, um Menge, Kennwert und Herkunft zu sehen'+(kannBearbeiten?' und zu ändern':'')+'.</p></section>')+'</aside></div>';
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
  let html='<section class="card panel"><p class="kicker">Position</p><h2>'+esc(kgName(p.kg)||'Neue Position')+'</h2>'+
    '<p class="meta">'+(r.status==='entfaellt'?'entfällt':r.betragCent!==null?(p.modus==='betrag'?'Betrag ':esc(R.zahl(p.menge,2))+' '+esc(p.einheit||'')+' × '+R.euro(r.kennwertCent,{nachkomma:true})+' = ')+'<strong style="color:var(--kb-ink)">'+R.euro(r.betragCent,{nachkomma:true})+'</strong> netto':
      'Offen: '+esc(r.fehlt.map(f=>({kg:'Kostengruppe',menge:'Menge',betrag:'Betrag',kennwert:'Kennwert',mengenquelle:'Herkunft der Menge',quelle:'Quelle',fundstelle:'Fundstelle'}[f]||f)).join(', ')))+'</p>'+
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
  const typen=bauteiltypen();
  const rezepte=typen.length?typen.map(t=>{
    const rz=st.rezepte?.[t.typ];
    const zeilen=(rz?.zeilen||[]).map((z,i)=>'<tr><td class="schmal"><input type="text" list="kbKgListe" inputmode="numeric" maxlength="3" data-key="rezept:'+t.typ+':'+i+':kg" value="'+esc(z.kg)+'" aria-label="Kostengruppe"'+(kannBearbeiten?'':' readonly')+'></td>'+
      '<td class="meta">'+esc(titel(z.kg))+'</td><td class="schmal"><input type="text" inputmode="decimal" data-key="rezept:'+t.typ+':'+i+':faktor" value="'+esc(R.zahl(z.faktor,3))+'" aria-label="Faktor"'+(kannBearbeiten?'':' readonly')+'></td>'+
      '<td>'+(kannBearbeiten?'<button type="button" class="btn btn-quiet" data-act="rezept-weg" data-typ="'+esc(t.typ)+'" data-i="'+i+'">Entfernen</button>':'')+'</td></tr>').join('');
    return '<div style="padding:14px 0;border-top:1px solid var(--kb-line-soft)"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline">'+
      '<p style="margin:0"><strong>'+esc(t.typ)+'</strong> <span class="meta">· KG '+esc(t.kg)+(t.aufbau?' · '+esc(t.aufbau):'')+(t.menge?' · '+esc(t.menge):'')+'</span></p>'+
      (kannBearbeiten&&!rz?'<button type="button" class="btn" data-act="rezept-vorschlag" data-typ="'+esc(t.typ)+'" data-kg="'+esc(t.kg)+'">Rezept vorschlagen</button>':'')+'</div>'+
      (rz?'<table class="kb-table" style="margin-top:8px"><thead><tr><th>KG</th><th>Bezeichnung</th><th>Faktor</th><th></th></tr></thead><tbody>'+zeilen+'</tbody></table>'+
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
      '<table class="kb-table"><thead><tr><th>Quartal</th><th>Index</th><th></th></tr></thead><tbody>'+(indizes||'<tr><td colspan="3" class="meta">Noch keine Werte.</td></tr>')+'</tbody></table>'+
      (kannBearbeiten?'<button type="button" class="btn" style="margin-top:10px" data-act="index-neu">'+ICON_PLUS+'Quartal</button>':'')+'</section>'+
    '<section class="card" style="grid-column:1/-1"><h2 class="kb-h2">Bauteiltypen und Rezepte</h2><p class="meta" style="margin:6px 0 4px">Ein Rezept verteilt die Archicad-Menge eines Bauteiltyps auf die Kostengruppen, die sein Aufbau enthält, zum Beispiel Außenwand auf 331, 335 und 336. Faktor 2 heißt: beide Seiten.</p>'+rezepte+'</section>'+
    '<section class="card" style="grid-column:1/-1"><h2 class="kb-h2">Kostengruppen, die entfallen</h2><p class="meta" style="margin:6px 0 8px">Was entfällt, zählt nicht zur Summe und nicht als offen.</p>'+
      '<table class="kb-table"><thead><tr><th>Kostengruppe</th><th></th><th>Begründung</th></tr></thead><tbody>'+gruppen+'</tbody></table></section>'+
    '<section class="card" style="grid-column:1/-1"><h2 class="kb-h2">Quellenverzeichnis</h2><p class="meta" style="margin:6px 0 8px">Aus den Fundstellen der Positionen zusammengestellt.</p>'+
      (quellen.length?'<table class="kb-table"><thead><tr><th>Quelle</th><th>Fundstelle</th></tr></thead><tbody>'+quellen.map(q=>'<tr><td>'+esc(R.ARTEN[q.a]?.label||q.a)+'</td><td>'+esc(q.f||'–')+'</td></tr>').join('')+'</tbody></table>':'<p class="meta">Noch keine Quellen.</p>')+'</section>'+
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
function bericht(){
  const g=calc.gesamt;
  const erste=(st.katalog||[]).filter(k=>R.ebene(k.kg)===1);
  const zeileKnoten=(k,fett)=>{const kn=calc.knoten.get(k.kg);const aus=st.gruppen?.[k.kg]?.status==='entfaellt';
    return '<tr'+(fett?' style="font-weight:700"':'')+'><td>'+esc(k.kg)+'</td><td>'+esc(k.titel)+'</td><td class="num">'+(aus?'entfällt':R.euro(kn?.bekanntCent||0n))+'</td><td class="num">'+
      (aus||!g.bekanntCent?'':R.prozent(Number(R.teile((kn?.bekanntCent||0n)*1000n,g.bekanntCent))/10))+'</td></tr>'};
  const ebene1='<div class="tbl"><table class="kb-table"><thead><tr><th>KG</th><th>Bezeichnung</th><th class="num">Betrag netto</th><th class="num">Anteil</th></tr></thead><tbody>'+erste.map(k=>zeileKnoten(k,false)).join('')+'</tbody>'+
    '<tfoot><tr><td></td><td>Summe netto'+(g.vollstaendig?'':', vorläufig')+'</td><td class="num">'+R.euro(g.bekanntCent)+'</td><td></td></tr>'+
    '<tr><td></td><td>Umsatzsteuer '+esc(R.zahl(st.ustProzent))+' %</td><td class="num">'+R.euro(calc.ustCent)+'</td><td></td></tr>'+
    '<tr><td></td><td>Summe brutto</td><td class="num">'+R.euro(calc.bruttoCent)+'</td><td></td></tr></tfoot></table></div>';
  const zweite=(st.katalog||[]).filter(k=>R.ebene(k.kg)===2&&calc.knoten.get(k.kg)?.anzahl);
  const ebene2='<div class="tbl"><table class="kb-table"><thead><tr><th>KG</th><th>Bezeichnung</th><th class="num">Betrag netto</th><th class="num">Anteil</th></tr></thead><tbody>'+zweite.map(k=>zeileKnoten(k,false)).join('')+'</tbody></table></div>';
  const posListe=(st.positionen||[]).filter(p=>!calc.positionen.find(r=>r.id===p.id)?.ausgeschlossen).sort((a,b)=>String(a.kg).localeCompare(String(b.kg)));
  const ergebnis=new Map(calc.positionen.map(r=>[r.id,r]));
  const ebene3='<div class="tbl"><table class="kb-table"><thead><tr><th>KG</th><th>Position</th><th class="num">Menge</th><th class="num">Kennwert</th><th class="num">Betrag</th><th>Quelle</th></tr></thead><tbody>'+
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
    (g.vollstaendig?'':'<p class="meta att" style="margin-top:10px">Vorläufig: '+offen.length+' Punkte sind noch offen (Abschnitt «Offene Punkte»).</p>')+
    '<h3>Zusammenstellung, 1. Ebene</h3>'+ebene1+'<h3>Gliederung, 2. Ebene</h3>'+ebene2+'<h3>Positionen</h3>'+ebene3+
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
      ziel.innerHTML='<p class="meta">'+erg.gelesen+' Zeilen gelesen, '+erg.gruppen.length+' Gruppen'+(erg.ohneKg?', '+erg.ohneKg+' Zeilen ohne Kostengruppe übersprungen':'')+'.</p>'+
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
    ui.tab='positionen';ui.filter='300';geaendert();render();
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
    if(pfad==='kg'){if(wert&&!/^[1-8]\d\d$/.test(wert)){ui.meldung='Die Kostengruppe hat drei Ziffern, zum Beispiel 331.';render();return}
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
    if(feld==='status')st.gruppen[kg].status=wert?'entfaellt':'';else st.gruppen[kg].notiz=wert}
  else if(key.startsWith('rezept:')){const teile=key.slice(7).split(':');const feld=teile.pop(),i=teile.pop(),typ=teile.join(':');
    const z=st.rezepte?.[typ]?.zeilen?.[Number(i)];if(!z)return;
    if(feld==='kg'){if(!/^[1-8]\d\d$/.test(wert)){ui.meldung='Die Kostengruppe hat drei Ziffern.';render();return}z.kg=wert}
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
function neuePosition(kg){
  const id='p:'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const e=R.ebene(kg)===3?kg:'';
  st.positionen=st.positionen||[];
  st.positionen.push({id,kg:e,titel:e?titel(e):'',bauteiltyp:'',notiz:'',modus:'menge',menge:null,einheit:'m²',mengenquelle:{art:'manuell',text:''},kennwert:{}});
  ui.auswahl=id;ui.tab='positionen';if(!ui.filter||ui.filter==='offen')ui.filter='';geaendert();render();
  setTimeout(()=>root.querySelector('[data-key="pos:'+CSS.escape(id)+':kg"]')?.focus(),0);
}
function geheZu(d){
  const {art,kg,id}=d;
  if(art==='position'||art==='hinweis'){ui.tab='positionen';ui.filter=kg?kg[0]+'00':'';ui.auswahl=id||null}
  else if(art==='gruppe'||art==='paar'){ui.tab='positionen';ui.filter=kg?kg[0]+'00':'';ui.auswahl=null}
  else if(art==='bezug'||art==='grundlage')ui.tab='quellen';
  else ui.tab='vergleich';
  merkeTab();render();window.scrollTo({top:0,behavior:'smooth'});
}
function merkeTab(){if(doc&&!istMuster)history.replaceState(null,'',location.pathname+location.search+'#tab='+ui.tab)}

root.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-act]');if(!b)return;
  const act=b.dataset.act,d=b.dataset;
  if(act==='neu'){dialogNeu();return}
  if(!st)return;
  if(act==='tab'){ui.tab=d.tab;ui.meldung='';merkeTab();render();return}
  if(act==='aufklappen'){ui.offen.has(d.kg)?ui.offen.delete(d.kg):ui.offen.add(d.kg);render();return}
  if(act==='filter'){ui.tab='positionen';ui.filter=d.kg;ui.auswahl=null;merkeTab();render();return}
  if(act==='brutto'){ui.brutto=d.wert==='1';render();return}
  if(act==='alle-fehlt'){ui.alleFehlt=!ui.alleFehlt;render();return}
  if(act==='waehle'){ui.auswahl=d.id;ui.loeschen=null;render();if(window.innerWidth<1000)setTimeout(()=>root.querySelector('.panel')?.scrollIntoView({behavior:'smooth',block:'start'}),0);return}
  if(act==='goto'){geheZu(d);return}
  if(act==='drucken'){if(ui.tab!=='bericht'){ui.tab='bericht';render()}setTimeout(()=>window.print(),50);return}
  if(act==='import'&&kannBearbeiten){dialogImport();return}
  if(act==='sichern'){sichernAlsDatei();return}
  if(act==='neuladen'){location.reload();return}
  if(!kannBearbeiten)return;
  if(act==='pos-neu'){neuePosition(d.kg||'');return}
  const p=d.id?st.positionen.find(x=>x.id===d.id):null;
  if(act==='modus'&&p){p.modus=d.wert;geaendert();render();return}
  if(act==='entfaellt'&&p){p.status=p.status==='entfaellt'?'':'entfaellt';geaendert();render();return}
  if(act==='loeschen'&&p){
    if(ui.loeschen!==p.id){ui.loeschen=p.id;render();setTimeout(()=>{if(ui.loeschen===p.id){ui.loeschen=null;render()}},4000);return}
    st.positionen=st.positionen.filter(x=>x.id!==p.id);ui.auswahl=null;ui.loeschen=null;geaendert();render();return}
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
