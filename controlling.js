/* TBA Office · Controlling (25.11.2026, Claude; Wunsch von Gari am 25.11.2026).
   Gari: Der Chef legt im Vertrag das Honorar fest und kalkuliert mit 85 €/h, je Mitarbeiter änderbar; daraus folgen die
   vorgesehenen Stunden. Am Ende soll man sehen, was gegenüber der Kalkulation gewonnen wurde. Auf das Honorar kommen
   Nebenkosten (5 %); die Auftraggeber zahlen in Abschlägen, jede Zahlung mit Netto und MwSt, eingetragen und geändert in
   einem eigenen Reiter.
   Gestalt (Gari, Vorschläge B und C): die Übersicht als Karten mit zwei Balken (Stunden gegen das Budget, mit der Marke
   des Leistungsstands; Honorar mit bezahlt und erarbeitet), je Projekt ein Projektblatt mit Kennzahlen, Ständen und
   Zahlungen. Begriffe wie in der Projektübersicht von untermStrich: erarbeitetes Honorar = Honorar × Leistungsstand,
   Prognose = bisheriger Wert ÷ Leistungsstand.
   Sichtbarkeit (Gari): Alle im Projekt sehen Honorar, Zahlungen, Stunden und das Ergebnis; Sätze und Gehälter der
   Personen und das Ergebnis zum Gehalt nur Admins. Die Datenbank setzt das durch (Migration 20261125085053): Stunden je
   Person, Sätze, Gehälter und Einstellungen liest nur ein Admin, die Summen je Stand kommen aus office_controlling_summen.
   Eintragen und ändern: nur Admins.
   Ansichten: Übersicht (ohne Parameter), Projektblatt (?projekt=<id>, auch als Reiter «Controlling» eines Projekts in
   Work; ?paket= und ?reiter=zahlungen wählen vor), Sätze und Gehälter (?ansicht=saetze, nur Admins).
   Rechnen: controlling-kern.js (window.TBA_CONTROLLING). */
(()=>{
'use strict';
const OFFICE=window.TBA_OFFICE_CONFIG;
const sb=window.MINDS_SUPABASE||(window.supabase&&OFFICE?window.supabase.createClient(OFFICE.url,OFFICE.key,
  {auth:{storageKey:OFFICE.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null);
const K=window.TBA_CONTROLLING;
const inApp=!!window.WINDOW_NATIVE?.available;
const params=new URLSearchParams(location.search);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROJEKT=UUID.test(params.get('projekt')||'')?params.get('projekt'):null;
const ANSICHT=params.get('ansicht')==='saetze'?'saetze':PROJEKT?'projekt':'uebersicht';
const IM_REITER=window.self!==window.top;
const root=document.getElementById('ct'),dialog=document.getElementById('ctDialog');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const zahl=(x,d=0)=>Number(x||0).toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
const euro=(x,d=0)=>x==null?'—':zahl(x,d)+' €';
const std=x=>x==null?'—':zahl(x,Math.abs(x)<100&&Number(x)%1?1:0)+' h';
const proz=x=>x==null?'—':zahl(x,Number(x)%1?1:0)+' %';
const plus=x=>x==null?'—':(x>0.004?'+ ':x<-0.004?'− ':'')+zahl(Math.abs(x))+' €';
const plusKlasse=x=>x==null?'':x>0.004?' ct-plus':x<-0.004?' ct-minus':'';
const eingabe=x=>x==null||x===''?'':Number(x).toLocaleString('de-DE',{maximumFractionDigits:2});
const datum=iso=>{if(!iso)return '';const d=new Date(String(iso).length===10?iso+'T12:00:00':iso);return Number.isFinite(d.getTime())?d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}):''};
const heute=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const STATUS=[['angeboten','angeboten'],['beauftragt','beauftragt'],['abgeschlossen','abgeschlossen']];
const ZAHLUNG=[['bezahlt','bezahlt'],['gestellt','gestellt, noch offen']];

let nutzer=null,admin=false;
const daten={projekte:[],pakete:[],staende:[],summen:[],zahlungen:[],stunden:[],saetze:[],einstellungen:null,personen:[],team:[]};
const ui={paket:UUID.test(params.get('paket')||'')?params.get('paket'):null,reiter:params.get('reiter')==='zahlungen'?'zahlungen':'staende'};

// Work fragt vor dem Schließen des Rahmens, ob etwas aussteht: hier wird jede Eingabe im Dialog sofort gespeichert.
window.TBA_OFFICE_TOOL=Object.freeze({kind:'controlling',revision:()=>0,pending:()=>false,flush:()=>Promise.resolve()});

function fehler(text){
  root.innerHTML='<div class="pb-wrap"><a class="pb-back" href="./app/#section=tools">‹ Werkzeuge</a><div class="pb-banner warn">'+esc(text)+'</div></div>';
}
function meldung(text,art='info'){const el=root.querySelector('[data-meldung]');if(el){el.className='pb-banner '+art;el.textContent=text;el.hidden=!text}}

// ---------- Start ----------
async function start(){
  if(!sb||!K){fehler('Office-Verbindung nicht verfügbar.');return}
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
  admin=m.role==='admin';
  try{await ladeAlles();zeichne()}catch(e){console.error('Controlling',e);fehler(e?.message||'Controlling nicht erreichbar.')}
}
const leer=()=>Promise.resolve({data:[],error:null});
async function ladeAlles(){
  const projekte=sb.from('office_projects').select('id,number,name,status,projektleiter_id');
  const pakete=sb.from('office_controlling_pakete').select('*');
  const [proj,pak,mi,te]=await Promise.all([
    (PROJEKT?projekte.eq('id',PROJEKT):projekte.order('number')).limit(500),
    (PROJEKT?pakete.eq('project_id',PROJEKT):pakete).order('created_at').limit(500),
    sb.from('office_members').select('user_id,display_name,role,is_active').limit(500),
    PROJEKT&&admin?sb.from('office_project_members').select('project_id,user_id').eq('project_id',PROJEKT).limit(500):leer()
  ]);
  const err=proj.error||pak.error||mi.error||te.error;if(err)throw err;
  daten.projekte=proj.data||[];daten.pakete=pak.data||[];daten.personen=mi.data||[];daten.team=(te.data||[]).map(t=>t.user_id);
  const paketIds=daten.pakete.map(p=>p.id),projektIds=[...new Set(daten.pakete.map(p=>p.project_id))];
  const [st,za,...su]=await Promise.all([
    paketIds.length?sb.from('office_controlling_staende').select('*').in('paket_id',paketIds).limit(5000):leer(),
    paketIds.length?sb.from('office_controlling_zahlungen').select('*').in('paket_id',paketIds).limit(5000):leer(),
    ...projektIds.map(id=>sb.rpc('office_controlling_summen',{p_project:id}))
  ]);
  const err2=st.error||za.error||su.find(x=>x.error)?.error;if(err2)throw err2;
  daten.staende=st.data||[];daten.zahlungen=za.data||[];daten.summen=su.flatMap(x=>x.data||[]);
  daten.stunden=[];daten.saetze=[];daten.einstellungen=null;
  if(admin){
    const standIds=daten.staende.map(s=>s.id);
    const [h,sa,ei]=await Promise.all([
      standIds.length?sb.from('office_controlling_stunden').select('*').in('stand_id',standIds).limit(10000):leer(),
      sb.from('office_controlling_saetze').select('*').order('gueltig_ab').limit(5000),
      sb.from('office_controlling_einstellungen').select('*').limit(1)
    ]);
    const err3=h.error||sa.error||ei.error;if(err3)throw err3;
    daten.stunden=h.data||[];daten.saetze=sa.data||[];daten.einstellungen=(ei.data||[])[0]||null;
  }
}
function zeichne(){
  if(ANSICHT==='saetze'){if(admin)renderSaetze();else fehler('Sätze und Gehälter sehen nur Admins.');return}
  if(ANSICHT==='projekt'){const p=projekt(PROJEKT);if(p)renderProjekt(p);else fehler('Dieses Projekt ist nicht erreichbar oder gehört nicht zum eigenen Team.');return}
  renderUebersicht();
}
async function neuLaden(text){
  try{await ladeAlles();zeichne();if(text)meldung(text)}catch(e){meldung('Nicht geladen: '+(e?.message||e),'warn')}
}

// ---------- Daten ----------
const projekt=id=>daten.projekte.find(p=>p.id===id)||null;
const projektName=p=>p?[p.number,p.name].filter(Boolean).join(' · '):'';
const person=id=>daten.personen.find(x=>x.user_id===id)?.display_name||'';
const paketeVon=pid=>daten.pakete.filter(p=>p.project_id===pid);
const standZeile=id=>daten.staende.find(s=>s.id===id)||null;
const summenVon=p=>daten.summen.filter(s=>s.paket_id===p.id).sort((a,b)=>String(a.stichtag).localeCompare(String(b.stichtag)));
const zahlungenVon=p=>daten.zahlungen.filter(z=>z.paket_id===p.id)
  .sort((a,b)=>String(a.datum||'9999').localeCompare(String(b.datum||'9999'))||String(a.created_at).localeCompare(String(b.created_at)));
const kz=p=>K.kennzahlen(p,summenVon(p),zahlungenVon(p));
const stundenVon=standId=>daten.stunden.filter(h=>h.stand_id===standId);
const wer=h=>h.person_id?person(h.person_id)||'Person':h.person_name||'Team';
const urlProjekt=(pid,mehr={})=>'./controlling.html?'+new URLSearchParams({projekt:pid,...mehr});

// ---------- Balken und Zahlen ----------
function balkenStunden(k){
  if(!(k.budget>0))return '<div class="ct-balken-block"><div class="ct-balken-kopf"><span>Stunden</span><strong>'+std(k.stunden)+'</strong></div>'+
    '<p class="meta">Ohne Honorar gibt es kein Stundenbudget.</p></div>';
  const soll=k.leistungsstand!=null?k.budget*k.leistungsstand/100:null;
  const ueber=soll!=null?k.stunden>soll+0.005:k.stunden>k.budget+0.005;
  const breite=Math.min(k.stunden/k.budget,1)*100;
  const marke=k.leistungsstand!=null?'<span class="ct-marke" style="left:'+Math.min(k.leistungsstand,100).toFixed(2)+'%"></span>':'';
  const text=soll!=null?'Soll beim Leistungsstand '+proz(k.leistungsstand)+': '+std(soll)+(ueber?' · darüber':' · im Rahmen')
    :'Leistungsstand noch nicht geschätzt';
  return '<div class="ct-balken-block"><div class="ct-balken-kopf"><span>Stunden</span><span><strong>'+std(k.stunden)+'</strong> von '+std(k.budget)+'</span></div>'+
    '<div class="ct-balken'+(ueber?' ueber':'')+'" role="img" aria-label="'+esc(std(k.stunden)+' von '+std(k.budget)+'. '+text)+'">'+
    '<span class="ct-fuellung" style="width:'+breite.toFixed(2)+'%"></span>'+marke+'</div><p class="meta">'+esc(text)+'</p></div>';
}
function balkenHonorar(k){
  if(!(k.honorar>0))return '';
  const b=Math.min(Math.max(k.bezahlt,0)/k.honorar,1)*100,e=k.erarbeitet!=null?Math.min(k.erarbeitet/k.honorar,1)*100:0;
  const teile=[(k.zahlungen?'bezahlt '+euro(k.bezahlt):'Zahlungen noch nicht erfasst'),k.erarbeitet!=null?'erarbeitet '+euro(k.erarbeitet):''].filter(Boolean);
  return '<div class="ct-balken-block"><div class="ct-balken-kopf"><span>Honorar</span><strong>'+euro(k.honorar)+'</strong></div>'+
    '<div class="ct-balken" role="img" aria-label="'+esc(teile.join(', ')+' von '+euro(k.honorar))+'">'+
    '<span class="ct-erarbeitet" style="width:'+e.toFixed(2)+'%"></span><span class="ct-bezahlt" style="width:'+b.toFixed(2)+'%"></span></div>'+
    '<p class="meta"><span class="ct-legende"><i></i>'+esc(teile[0])+'</span>'+(teile[1]?' · <span class="ct-legende"><i class="hell"></i>'+esc(teile[1])+'</span>':'')+'</p></div>';
}
function chips(p,k){
  const c=['<span class="chip'+(p.status==='abgeschlossen'?' chip-ok':p.status==='angeboten'?' chip-src':'')+'">'+esc(p.status)+'</span>'];
  if(k.vorlaeufig)c.push('<span class="chip chip-att" title="Zahlen noch nicht bestätigt">vorläufig</span>');
  if(k.stand)c.push('<span class="chip chip-mute">Stand '+esc(datum(k.stand))+'</span>');
  return c.join('');
}
// Offen: erarbeitet, aber noch nicht bezahlt; ohne erfasste Zahlungen sagt die Zahl nichts.
function offenText(k){
  if(k.erarbeitet==null)return '—';
  if(!k.zahlungen)return 'keine Zahlungen erfasst';
  return k.offen<-0.004?'Vorauszahlung '+euro(-k.offen):euro(k.offen);
}

// ---------- Übersicht ----------
function renderUebersicht(){
  const eintraege=daten.pakete.map(p=>({paket:p,k:kz(p)})).sort(K.ordnung);
  const mitPaket=new Set(daten.pakete.map(p=>p.project_id));
  const ohne=admin?daten.projekte.filter(p=>p.status==='aktiv'&&!mitPaket.has(p.id)):[];
  root.innerHTML='<div class="pb-wrap">'+
    '<a class="pb-back" href="./app/#section=tools">‹ Werkzeuge</a>'+
    '<header class="pb-head"><div class="pb-head-text"><p class="kicker">Controlling</p><h1>Controlling</h1>'+
    '<p class="pb-intro">Honorar laut Vertrag gegen die Stunden im Projekt. Die Kalkulation rechnet mit dem Kalkulationssatz (85 €/h, je Person änderbar); '+
    'erarbeitet ist das Honorar mal Leistungsstand, die Prognose rechnet die bisherigen Stunden auf 100 % hoch.</p></div>'+
    (admin?'<div class="pb-actions"><a class="btn" href="./controlling.html?ansicht=saetze">Sätze und Gehälter</a><button type="button" class="btn btn-primary" data-paket-neu>Neues Honorarpaket</button></div>':'')+
    '</header><p class="pb-banner info" data-meldung hidden></p>'+
    (eintraege.length?'<div class="ct-grid">'+eintraege.map(karte).join('')+'</div>'
      :'<div class="card ct-leer"><p><strong>Noch kein Honorar erfasst.</strong></p><p class="meta">'+
        (admin?'Ein Honorarpaket je Auftrag: Honorar laut Vertrag, Nebenkosten und Kalkulationssatz.':'Das Controlling zeigt die Projekte des eigenen Teams, sobald ein Admin das Honorar eingetragen hat.')+'</p></div>')+
    (ohne.length?'<p class="ct-ohne">Noch ohne Honorar: '+ohne.map(p=>'<a href="'+esc(urlProjekt(p.id))+'">'+esc(projektName(p))+'</a>').join(', ')+'</p>':'')+
    '</div>';
  root.querySelector('[data-paket-neu]')?.addEventListener('click',()=>paketFormular(null,null));
}
function karte({paket:p,k}){
  const pr=projekt(p.project_id);
  const ergebnis=k.abgeschlossen?k.ergebnisBisher:k.prognoseErgebnis;
  return '<article class="card ct-karte" data-paket="'+esc(p.id)+'"><p class="meta">'+esc(projektName(pr)||'Projekt')+'</p>'+
    '<h2><a href="'+esc(urlProjekt(p.project_id,{paket:p.id}))+'">'+esc(p.bezeichnung)+'</a></h2>'+
    '<div class="pb-chips">'+chips(p,k)+'</div>'+balkenStunden(k)+balkenHonorar(k)+
    '<dl class="ct-zahlen">'+
    '<div><dt>'+(k.abgeschlossen?'Ergebnis':'Prognose am Ende')+'</dt><dd class="'+plusKlasse(ergebnis).trim()+'" data-ergebnis>'+esc(plus(ergebnis))+'</dd></div>'+
    '<div><dt>Honorar je Stunde</dt><dd>'+(k.jeStunde==null?'—':esc(euro(k.jeStunde))+'/h')+'</dd></div>'+
    '<div><dt>Offen</dt><dd'+(k.zahlungen||k.erarbeitet==null?'':' class="ct-klein"')+'>'+esc(offenText(k))+'</dd></div></dl></article>';
}

// ---------- Projektblatt ----------
function renderProjekt(pr){
  const pakete=paketeVon(pr.id);
  const p=pakete.find(x=>x.id===ui.paket)||pakete[0]||null;
  ui.paket=p?.id||null;
  root.innerHTML='<div class="pb-wrap">'+
    '<a class="pb-back ct-zur-uebersicht" href="./controlling.html">‹ Controlling</a>'+
    '<header class="pb-head"><div class="pb-head-text"><p class="kicker">Controlling</p><h1>'+esc(projektName(pr))+'</h1>'+
    '<p class="pb-intro">Honorar laut Vertrag, Stunden und Zahlungen. Ergebnis gegenüber der Kalkulation: erarbeitetes Honorar minus Wert der Stunden zum Kalkulationssatz.</p></div>'+
    (admin?'<div class="pb-actions"><button type="button" class="btn'+(p?'':' btn-primary')+'" data-paket-neu>Neues Honorarpaket</button></div>':'')+
    '</header><p class="pb-banner info" data-meldung hidden></p>'+
    (pakete.length>1?'<div class="pb-pills" role="group" aria-label="Honorarpakete">'+pakete.map(x=>
      '<button type="button" class="pill" data-paket-wahl="'+esc(x.id)+'" aria-pressed="'+(x.id===ui.paket)+'">'+esc(x.bezeichnung)+'</button>').join('')+'</div>':'')+
    (p?paketBlatt(p):'<div class="card ct-leer"><p><strong>Für dieses Projekt ist noch kein Honorar erfasst.</strong></p><p class="meta">'+
      (admin?'Ein Honorarpaket je Auftrag, etwa «LPH 3» oder «Machbarkeitsstudie».':'Eintragen können nur Admins.')+'</p>'+
      (admin?'<button type="button" class="btn btn-primary" data-paket-neu>Honorarpaket anlegen</button>':'')+'</div>')+
    '</div>';
  root.querySelectorAll('[data-paket-neu]').forEach(b=>b.addEventListener('click',()=>paketFormular(null,pr.id)));
  root.querySelectorAll('[data-paket-wahl]').forEach(b=>b.addEventListener('click',()=>{ui.paket=b.dataset.paketWahl;adresse();renderProjekt(pr)}));
  root.querySelectorAll('[data-reiter]').forEach(b=>b.addEventListener('click',()=>{ui.reiter=b.dataset.reiter;adresse();renderProjekt(pr)}));
  if(!p)return;
  root.querySelector('[data-paket-bearbeiten]')?.addEventListener('click',()=>paketFormular(p,pr.id));
  root.querySelector('[data-stand-neu]')?.addEventListener('click',()=>standFormular(p,null));
  root.querySelectorAll('[data-stand]').forEach(b=>b.addEventListener('click',()=>standFormular(p,standZeile(b.dataset.stand))));
  root.querySelector('[data-zahlung-neu]')?.addEventListener('click',()=>zahlungFormular(p,null));
  root.querySelectorAll('[data-zahlung]').forEach(b=>b.addEventListener('click',()=>zahlungFormular(p,daten.zahlungen.find(z=>z.id===b.dataset.zahlung))));
}
// Paket und Reiter stehen in der Adresse, damit Neuladen dorthin zurückführt (auch im Rahmen von Work).
function adresse(){
  const u=new URL(location.href);
  if(ui.paket)u.searchParams.set('paket',ui.paket);else u.searchParams.delete('paket');
  if(ui.reiter==='zahlungen')u.searchParams.set('reiter','zahlungen');else u.searchParams.delete('reiter');
  history.replaceState(null,'',u.pathname+u.search);
}
function zeile(dt,dd,klasse=''){return '<div><dt>'+esc(dt)+'</dt><dd'+(klasse?' class="'+klasse.trim()+'"':'')+'>'+dd+'</dd></div>'}
function paketBlatt(p){
  const k=kz(p);
  const satz=euro(k.satz,k.satz%1?2:0)+'/h';
  const gruppen=[
    ['Vertrag',[zeile('Honorar netto',esc(euro(k.honorar))),zeile('Nebenkosten '+proz(k.nebenkostenProzent),esc(euro(k.nebenkosten))),
      zeile('Kalkulationssatz',esc(satz)),zeile('Stundenbudget',esc(std(k.budget)))]],
    [k.stand?'Stand '+datum(k.stand):'Stand',[zeile('Stunden',esc(std(k.stunden))),
      zeile('Leistungsstand',k.leistungsstand==null?'noch nicht geschätzt':esc(proz(k.leistungsstand))+(k.abgeschlossen&&k.geschaetzt!==100?' <span class="meta">(abgeschlossen)</span>':'')),
      zeile('Wert der Stunden',esc(euro(k.wert))),zeile('Erarbeitet',esc(euro(k.erarbeitet))),
      zeile('Ergebnis bisher',esc(plus(k.ergebnisBisher)),plusKlasse(k.ergebnisBisher)),
      zeile('Honorar je Stunde',k.jeStunde==null?'—':esc(euro(k.jeStunde,2))+'/h')]],
    [k.abgeschlossen?'Am Ende':'Prognose am Ende',[zeile('Stunden',esc(std(k.prognoseStunden))),
      zeile('Ergebnis',esc(plus(k.prognoseErgebnis)),plusKlasse(k.prognoseErgebnis))]],
    ['Zahlungen',[zeile('Bezahlt (Honorar)',k.zahlungen?esc(euro(k.bezahlt)):'noch nicht erfasst'),
      ...(k.gestellt?[zeile('Gestellt, noch offen',esc(euro(k.gestellt)))]:[]),zeile('Erarbeitet, nicht bezahlt',esc(offenText(k)))]]
  ];
  if(admin)gruppen.push(['Zum Gehalt',[zeile('Wert der Stunden',k.gehalt==null?'Gehälter unvollständig':esc(euro(k.gehalt))),
    zeile('Ergebnis bisher',esc(plus(k.ergebnisGehalt)),plusKlasse(k.ergebnisGehalt)),
    zeile('Prognose am Ende',esc(plus(k.prognoseGehalt)),plusKlasse(k.prognoseGehalt))],true]);
  return '<section class="card pb-box" aria-label="Kennzahlen"><div class="ct-kopf-zeile"><div><h2 class="pb-h2">'+esc(p.bezeichnung)+'</h2>'+
    (p.leistung?'<p class="meta">'+esc(p.leistung)+'</p>':'')+'</div><div class="pb-chips">'+chips(p,k)+'</div></div>'+
    '<div class="ct-balken-paar">'+balkenStunden(k)+balkenHonorar(k)+'</div>'+
    '<div class="ct-gruppen">'+gruppen.map(([titel,zeilen,nurAdmin])=>'<div class="ct-gruppe"><h3 class="pb-h3">'+esc(titel)+
      (nurAdmin?' <span class="ct-nur-admin">nur Admins</span>':'')+'</h3><dl class="pb-merkmale">'+zeilen.join('')+'</dl></div>').join('')+'</div>'+
    (p.notiz?'<p class="meta">'+esc(p.notiz)+'</p>':'')+
    (admin?'<button type="button" class="btn" data-paket-bearbeiten>Paket bearbeiten</button>':'')+'</section>'+
    '<div class="ct-reiter" role="tablist" aria-label="Paket">'+
    '<button type="button" role="tab" data-reiter="staende" aria-selected="'+(ui.reiter==='staende')+'">Stände und Stunden</button>'+
    '<button type="button" role="tab" data-reiter="zahlungen" aria-selected="'+(ui.reiter==='zahlungen')+'">Zahlungen</button></div>'+
    (ui.reiter==='zahlungen'?zahlungenTabelle(p,k):staendeTabelle(p));
}
function staendeTabelle(p){
  const reihen=summenVon(p).reverse();
  const honorar=Number(p.honorar_netto)||0,abgeschlossen=p.status==='abgeschlossen';
  const kopf='<tr><th>Stichtag</th><th class="num">Leistungsstand</th><th class="num">Stunden</th><th class="num">Wert (Kalkulation)</th>'+
    '<th class="num">Erarbeitet</th><th class="num">Ergebnis</th>'+(admin?'<th class="num">Wert (Gehalt)</th><th></th>':'')+'</tr>';
  const body=reihen.map((s,i)=>{
    const ls=abgeschlossen&&i===0?100:s.leistungsstand;
    const erarbeitet=ls!=null?honorar*Number(ls)/100:null,ergebnis=erarbeitet!=null?erarbeitet-Number(s.wert_kalkulation||0):null;
    const notiz=standZeile(s.stand_id)?.notiz;
    const je=admin?stundenVon(s.stand_id).map(h=>wer(h)+' '+std(Number(h.stunden))).join(' · '):'';
    return '<tr><td>'+esc(datum(s.stichtag))+(notiz?'<span class="ct-personen">'+esc(notiz)+'</span>':'')+(je?'<span class="ct-personen" data-je-person>'+esc(je)+'</span>':'')+'</td>'+
      '<td class="num">'+esc(proz(ls))+'</td><td class="num">'+esc(std(Number(s.stunden)))+'</td><td class="num">'+esc(euro(s.wert_kalkulation))+'</td>'+
      '<td class="num">'+esc(euro(erarbeitet))+'</td><td class="num'+plusKlasse(ergebnis)+'">'+esc(plus(ergebnis))+'</td>'+
      (admin?'<td class="num">'+esc(s.wert_gehalt==null?'—':euro(s.wert_gehalt))+'</td><td><button type="button" class="btn btn-quiet" data-stand="'+esc(s.stand_id)+'">Bearbeiten</button></td>':'')+'</tr>';
  }).join('');
  return '<section class="card pb-box" role="tabpanel" aria-label="Stände und Stunden"><div class="pb-box-kopf"><h2 class="pb-h2">Stände und Stunden</h2>'+
    (admin?'<button type="button" class="btn btn-primary" data-stand-neu>Neuer Stand</button>':'')+'</div>'+
    '<p class="meta">Je Stand die Stunden seit Beginn des Pakets bis zum Stichtag und der geschätzte Leistungsstand. '+
    (admin?'Stunden je Person und der Wert zum Gehalt sind nur für Admins sichtbar.':'Die Aufteilung auf Personen sehen nur Admins.')+'</p>'+
    (reihen.length?'<div class="pb-tabelle ct-tabelle"><table><thead>'+kopf+'</thead><tbody>'+body+'</tbody></table></div>'
      :'<p class="meta">Noch kein Stand erfasst.</p>')+'</section>';
}
function zahlungenTabelle(p,k){
  const liste=zahlungenVon(p),nk=Number(p.nebenkosten_prozent)||0;
  const summe=f=>liste.reduce((s,z)=>s+f(z),0);
  const kopf='<tr><th>Datum</th><th>Bezeichnung</th><th class="num">Netto</th><th class="num">davon Honorar</th><th class="num">davon Nebenkosten</th>'+
    '<th class="num">MwSt</th><th class="num">Brutto</th><th>Status</th>'+(admin?'<th></th>':'')+'</tr>';
  const body=liste.map(z=>{
    const netto=Number(z.netto)||0,mwst=Number(z.mwst)||0,h=K.honorarAnteil(netto,nk);
    return '<tr><td>'+esc(datum(z.datum)||'offen')+'</td><td>'+esc(z.bezeichnung||'')+(z.notiz?'<span class="ct-personen">'+esc(z.notiz)+'</span>':'')+'</td>'+
      '<td class="num">'+esc(euro(netto,2))+'</td><td class="num">'+esc(euro(h,2))+'</td><td class="num">'+esc(euro(K.r2(netto-h),2))+'</td>'+
      '<td class="num">'+esc(euro(mwst,2))+'</td><td class="num">'+esc(euro(K.r2(netto+mwst),2))+'</td>'+
      '<td><span class="chip'+(z.status==='bezahlt'?' chip-ok':' chip-att')+'">'+esc(z.status)+'</span>'+(z.vorlaeufig?' <span class="chip chip-att">vorläufig</span>':'')+'</td>'+
      (admin?'<td><button type="button" class="btn btn-quiet" data-zahlung="'+esc(z.id)+'">Bearbeiten</button></td>':'')+'</tr>';
  }).join('');
  const fuss=liste.length?'<tfoot><tr><td colspan="2">Summe</td><td class="num">'+esc(euro(summe(z=>Number(z.netto)||0),2))+'</td>'+
    '<td class="num">'+esc(euro(summe(z=>K.honorarAnteil(z.netto,nk)),2))+'</td><td class="num">'+esc(euro(summe(z=>(Number(z.netto)||0)-K.honorarAnteil(z.netto,nk)),2))+'</td>'+
    '<td class="num">'+esc(euro(summe(z=>Number(z.mwst)||0),2))+'</td><td class="num">'+esc(euro(summe(z=>(Number(z.netto)||0)+(Number(z.mwst)||0)),2))+'</td><td></td>'+(admin?'<td></td>':'')+'</tr></tfoot>':'';
  return '<section class="card pb-box" role="tabpanel" aria-label="Zahlungen"><div class="pb-box-kopf"><h2 class="pb-h2">Zahlungen</h2>'+
    (admin?'<button type="button" class="btn btn-primary" data-zahlung-neu>Zahlung erfassen</button>':'')+'</div>'+
    '<p class="meta">Abschläge und Schlussrechnung: netto mit Nebenkosten, dazu die MwSt. Das Controlling zählt den Honoraranteil (netto ÷ '+
    esc(zahl(1+nk/100,2))+'); bezahlt '+esc(euro(k.bezahlt))+(k.gestellt?', gestellt '+esc(euro(k.gestellt)):'')+'.</p>'+
    (liste.length?'<div class="pb-tabelle ct-tabelle"><table><thead>'+kopf+'</thead><tbody>'+body+'</tbody>'+fuss+'</table></div>'
      :'<p class="meta">Noch keine Zahlung erfasst.</p>')+'</section>';
}

// ---------- Sätze und Gehälter (nur Admins) ----------
function renderSaetze(){
  const e=daten.einstellungen||{arbeitgeberanteil_prozent:21,jahresstunden:1600};
  const aktive=daten.personen.filter(x=>x.is_active!==false).sort((a,b)=>String(a.display_name||'').localeCompare(String(b.display_name||''),'de'));
  const reihen=aktive.map(x=>{
    const eigene=daten.saetze.filter(s=>s.person_id===x.user_id).sort((a,b)=>String(b.gueltig_ab).localeCompare(String(a.gueltig_ab)));
    const k=K.satzAm(daten.saetze,x.user_id,heute(),'kalkulationssatz'),g=K.satzAm(daten.saetze,x.user_id,heute(),'monatsgehalt');
    const ab=eigene.find(s=>s.gueltig_ab<=heute())?.gueltig_ab;
    return '<tr><td>'+esc(x.display_name||'—')+(eigene.length>1?'<span class="ct-personen">'+eigene.length+' Einträge</span>':'')+'</td>'+
      '<td class="num">'+(k==null?'<span class="meta">Satz des Pakets</span>':esc(euro(k,k%1?2:0))+'/h')+'</td>'+
      '<td class="num">'+(g==null?'—':esc(euro(g)))+'</td><td class="num">'+(g==null?'—':esc(euro(K.gehaltSatz(g,e),2))+'/h')+'</td>'+
      '<td>'+esc(ab?datum(ab):'—')+'</td><td><button type="button" class="btn btn-quiet" data-person="'+esc(x.user_id)+'">Sätze</button></td></tr>';
  }).join('');
  root.innerHTML='<div class="pb-wrap"><a class="pb-back" href="./controlling.html">‹ Controlling</a>'+
    '<header class="pb-head"><div class="pb-head-text"><p class="kicker">Controlling · nur Admins</p><h1>Sätze und Gehälter</h1>'+
    '<p class="pb-intro">Der Kalkulationssatz bewertet die Stunden einer Person; ohne eigenen Satz gilt der des Pakets. Aus dem Monatsgehalt rechnet das Controlling '+
    'einen Stundensatz: Gehalt × 12 × (1 + Arbeitgeberanteil) ÷ Jahresstunden. Ein neuer Satz gilt ab seinem Datum und bewertet frühere Stunden nicht neu.</p></div></header>'+
    '<p class="pb-banner info" data-meldung hidden></p>'+
    '<section class="card pb-box"><h2 class="pb-h2">Personen</h2><div class="pb-tabelle ct-tabelle"><table><thead><tr><th>Person</th><th class="num">Kalkulationssatz</th>'+
    '<th class="num">Monatsgehalt</th><th class="num">Stundensatz aus Gehalt</th><th>gültig ab</th><th></th></tr></thead><tbody>'+reihen+'</tbody></table></div></section>'+
    '<section class="card pb-box"><h2 class="pb-h2">Annahmen für den Stundensatz aus dem Gehalt</h2><form class="pb-felder" data-einstellungen>'+
    '<label>Arbeitgeberanteil (%)<input name="ag" class="pb-input" inputmode="decimal" required value="'+esc(eingabe(e.arbeitgeberanteil_prozent))+'"></label>'+
    '<label>Jahresstunden (produktiv)<input name="h" class="pb-input" inputmode="decimal" required value="'+esc(eingabe(e.jahresstunden))+'"></label>'+
    '<label class="breit"><span class="meta">Arbeitgeberanteil: Sozialversicherung und Umlagen auf das Bruttogehalt. Jahresstunden: bezahlte Stunden abzüglich Urlaub, Feiertage und Krankheit.</span></label>'+
    '<div class="pb-actions"><button class="btn btn-primary">Speichern</button></div></form></section></div>';
  root.querySelectorAll('[data-person]').forEach(b=>b.addEventListener('click',()=>satzFormular(b.dataset.person)));
  root.querySelector('[data-einstellungen]').addEventListener('submit',async ev=>{
    ev.preventDefault();
    const f=ev.currentTarget,ag=K.leseZahl(f.ag.value),h=K.leseZahl(f.h.value);
    if(ag==null||ag<0||ag>100||h==null||h<100||h>4000){meldung('Arbeitgeberanteil 0–100 %, Jahresstunden 100–4.000.','warn');return}
    const {error}=await sb.from('office_controlling_einstellungen').update({arbeitgeberanteil_prozent:ag,jahresstunden:h}).eq('id',true);
    if(error){meldung('Nicht gespeichert: '+error.message,'warn');return}
    await neuLaden('Gespeichert.');
  });
}

// ---------- Formulare ----------
function oeffneDialog(html){dialog.innerHTML=html;dialog.showModal();return dialog.querySelector('form')}
const knoepfe=(text,weg)=>'<p class="pb-banner warn" data-dialog-fehler hidden></p><div class="pb-actions"><button value="speichern" class="btn btn-primary">'+esc(text)+'</button>'+
  '<button value="abbrechen" class="btn" formnovalidate>Abbrechen</button>'+(weg?'<button type="button" class="btn btn-quiet btn-danger" data-weg>'+esc(weg)+'</button>':'')+'</div>';
function zeigeFehler(text){const el=dialog.querySelector('[data-dialog-fehler]');if(el){el.textContent=text;el.hidden=!text}}
// Entfernen fragt im selben Dialog nach; erst das zweite Klicken löscht.
function entfernenFrage(text,aktion){
  dialog.querySelector('[data-weg]')?.addEventListener('click',ev=>{
    const b=ev.currentTarget;
    if(b.dataset.sicher!=='1'){b.dataset.sicher='1';b.textContent=text;return}
    void aktion();
  });
}
const optionen=(liste,wert)=>liste.map(([k,t])=>'<option value="'+esc(k)+'"'+(k===wert?' selected':'')+'>'+esc(t)+'</option>').join('');

function paketFormular(p,projektId){
  const projekte=daten.projekte.filter(x=>x.status!=='archiviert'||x.id===projektId);
  const form=oeffneDialog('<form method="dialog" class="pb-form"><h2>'+(p?'Honorarpaket bearbeiten':'Neues Honorarpaket')+'</h2>'+
    (p||projektId?'<p class="meta">'+esc(projektName(projekt(p?.project_id||projektId)))+'</p>':'')+
    '<div class="pb-felder">'+
    (p||projektId?'':'<label class="breit">Projekt<select name="projekt" class="pb-input" required>'+projekte.map(x=>'<option value="'+esc(x.id)+'">'+esc(projektName(x))+'</option>').join('')+'</select></label>')+
    '<label>Bezeichnung<input name="bezeichnung" class="pb-input" required maxlength="160" value="'+esc(p?.bezeichnung||'')+'" placeholder="z. B. LPH 3"></label>'+
    '<label>Stand des Auftrags<select name="status" class="pb-input">'+optionen(STATUS,p?.status||'beauftragt')+'</select></label>'+
    '<label class="breit">Leistung<input name="leistung" class="pb-input" maxlength="300" value="'+esc(p?.leistung||'')+'" placeholder="z. B. Entwurfsplanung"></label>'+
    '<label>Honorar netto (€)<input name="honorar" class="pb-input" inputmode="decimal" required value="'+esc(eingabe(p?.honorar_netto))+'" placeholder="ohne Nebenkosten und MwSt"></label>'+
    '<label>Nebenkosten (%)<input name="nk" class="pb-input" inputmode="decimal" required value="'+esc(eingabe(p?.nebenkosten_prozent??5))+'"></label>'+
    '<label>Kalkulationssatz (€/h)<input name="satz" class="pb-input" inputmode="decimal" required value="'+esc(eingabe(p?.kalkulationssatz??85))+'"></label>'+
    '<label class="pb-check"><input type="checkbox" name="vorlaeufig"'+(p?.vorlaeufig?' checked':'')+'>vorläufig (noch nicht bestätigt)</label>'+
    '<label class="breit">Notiz<textarea name="notiz" class="pb-input" maxlength="2000" rows="2">'+esc(p?.notiz||'')+'</textarea></label>'+
    '</div><p class="ct-vorschau" data-vorschau></p>'+knoepfe('Speichern',p?'Paket entfernen':'')+'</form>');
  const vorschau=()=>{
    const h=K.leseZahl(form.honorar.value),nk=K.leseZahl(form.nk.value),s=K.leseZahl(form.satz.value);
    dialog.querySelector('[data-vorschau]').textContent=h!=null&&s>0?'Stundenbudget '+std(h/s)+(nk!=null?' · Nebenkosten '+euro(h*nk/100):''):'';
  };
  form.addEventListener('input',vorschau);vorschau();
  if(p)entfernenFrage('Wirklich entfernen? Mit allen Ständen und Zahlungen',async()=>{
    const {error}=await sb.from('office_controlling_pakete').delete().eq('id',p.id);
    if(error){zeigeFehler('Nicht entfernt: '+error.message);return}
    dialog.close();ui.paket=null;adresse();await neuLaden('Honorarpaket entfernt.');
  });
  form.addEventListener('submit',async ev=>{
    if(ev.submitter?.value!=='speichern')return;
    ev.preventDefault();
    const honorar=K.leseZahl(form.honorar.value),nk=K.leseZahl(form.nk.value),satz=K.leseZahl(form.satz.value);
    const bezeichnung=form.bezeichnung.value.trim();
    if(!bezeichnung){zeigeFehler('Bitte eine Bezeichnung eintragen.');return}
    if(honorar==null||honorar<0){zeigeFehler('Honorar als Betrag in Euro, etwa 112.000.');return}
    if(nk==null||nk<0||nk>100){zeigeFehler('Nebenkosten in Prozent, 0 bis 100.');return}
    if(satz==null||satz<=0){zeigeFehler('Kalkulationssatz in Euro je Stunde, etwa 85.');return}
    const zeile={bezeichnung,leistung:form.leistung.value.trim()||null,honorar_netto:honorar,nebenkosten_prozent:nk,kalkulationssatz:satz,
      status:form.status.value,vorlaeufig:form.vorlaeufig.checked,notiz:form.notiz.value.trim()||null};
    const anfrage=p?sb.from('office_controlling_pakete').update(zeile).eq('id',p.id).select('*').single()
      :sb.from('office_controlling_pakete').insert({...zeile,project_id:projektId||form.projekt.value,created_by:nutzer.id}).select('*').single();
    const {data,error}=await anfrage;
    if(error){zeigeFehler('Nicht gespeichert: '+error.message);return}
    dialog.close();
    if(!p&&ANSICHT!=='projekt'){location.href=urlProjekt(data.project_id,{paket:data.id});return}
    ui.paket=data.id;adresse();await neuLaden(p?'Gespeichert.':'Honorarpaket angelegt.');
  });
}

// Ein Stand: Stichtag, Leistungsstand und die Stunden je Person bis dahin. Neu: die Personen des letzten Stands mit
// ihren Stunden als Ausgangspunkt (fehlt jemand, zählt sein letzter Wert weiter; Entfernen heißt hier: nicht mehr erfassen).
function standFormular(p,stand){
  const alle=summenVon(p);
  const vorher=stand?alle.filter(s=>s.stichtag<stand.stichtag).pop():alle[alle.length-1];
  const lsVorher=stand?stand.leistungsstand:vorher?.leistungsstand;
  let zeilen=stand?stundenVon(stand.id).map(h=>({id:h.id,wer:h.person_id||(h.person_name?'name':'team'),name:h.person_name||'',stunden:h.stunden}))
    :vorher?stundenVon(vorher.stand_id).map(h=>({id:null,wer:h.person_id||(h.person_name?'name':'team'),name:h.person_name||'',stunden:h.stunden})):[];
  if(!zeilen.length)zeilen=(daten.team.length?daten.team:[nutzer.id]).map(id=>({id:null,wer:id,name:'',stunden:''}));
  const imTeam=daten.personen.filter(x=>daten.team.includes(x.user_id)),andere=daten.personen.filter(x=>!daten.team.includes(x.user_id)&&x.is_active!==false);
  const auswahl=w=>'<option value="team"'+(w==='team'?' selected':'')+'>Team (ohne Aufteilung)</option>'+
    (imTeam.length?'<optgroup label="Im Projekt">'+imTeam.map(x=>'<option value="'+esc(x.user_id)+'"'+(w===x.user_id?' selected':'')+'>'+esc(x.display_name||'—')+'</option>').join('')+'</optgroup>':'')+
    (andere.length?'<optgroup label="Büro">'+andere.map(x=>'<option value="'+esc(x.user_id)+'"'+(w===x.user_id?' selected':'')+'>'+esc(x.display_name||'—')+'</option>').join('')+'</optgroup>':'')+
    '<option value="name"'+(w==='name'?' selected':'')+'>Andere Person (Name) …</option>';
  const zeileHtml=z=>'<div class="ct-person" data-zeile'+(z.id?' data-id="'+esc(z.id)+'"':'')+'><select name="wer" class="pb-input" aria-label="Person">'+auswahl(z.wer)+'</select>'+
    '<input name="name" class="pb-input" maxlength="120" placeholder="Name" aria-label="Name" value="'+esc(z.name)+'"'+(z.wer==='name'?'':' hidden')+'>'+
    '<input name="stunden" class="pb-input" inputmode="decimal" placeholder="Stunden" aria-label="Stunden bis zum Stichtag" value="'+esc(eingabe(z.stunden))+'">'+
    '<button type="button" class="btn btn-quiet" data-zeile-weg aria-label="Zeile entfernen">Entfernen</button></div>';
  const form=oeffneDialog('<form method="dialog" class="pb-form"><h2>'+(stand?'Stand bearbeiten':'Neuer Stand')+'</h2><p class="meta">'+esc(p.bezeichnung)+'</p>'+
    '<div class="pb-felder"><label>Stichtag<input type="date" name="stichtag" class="pb-input" required value="'+esc(stand?.stichtag||heute())+'"></label>'+
    '<label>Leistungsstand (%)<input name="ls" class="pb-input" inputmode="decimal" value="'+esc(eingabe(lsVorher))+'" placeholder="geschätzt, 0–100"></label>'+
    '<label class="breit">Notiz<input name="notiz" class="pb-input" maxlength="1000" value="'+esc(stand?.notiz||'')+'"></label></div>'+
    '<div class="pb-box-kopf"><h3 class="pb-h3">Stunden bis zum Stichtag</h3><span class="ct-vorschau" data-summe></span></div>'+
    '<p class="meta">Seit Beginn des Pakets zusammengezählt, wie in der Zeiterfassung. Stunden je Person sehen nur Admins; alle anderen sehen die Summe.</p>'+
    '<div class="ct-person-liste" data-zeilen>'+zeilen.map(zeileHtml).join('')+'</div>'+
    '<button type="button" class="btn" data-zeile-neu>Person hinzufügen</button>'+knoepfe('Speichern',stand?'Stand entfernen':'')+'</form>');
  const liste=dialog.querySelector('[data-zeilen]');
  const summe=()=>{const s=[...liste.querySelectorAll('[name="stunden"]')].reduce((a,i)=>a+(K.leseZahl(i.value)||0),0);
    dialog.querySelector('[data-summe]').textContent='zusammen '+std(s)};
  const erfasst=()=>[...liste.querySelectorAll('[name="wer"]')].map(s=>s.value);
  const binde=z=>{
    z.querySelector('[name="wer"]').addEventListener('change',e=>{const n=z.querySelector('[name="name"]');n.hidden=e.target.value!=='name';if(!n.hidden)n.focus()});
    z.querySelector('[data-zeile-weg]').addEventListener('click',()=>{z.remove();summe()});
  };
  liste.querySelectorAll('[data-zeile]').forEach(binde);
  dialog.querySelector('[data-zeile-neu]').addEventListener('click',()=>{
    liste.insertAdjacentHTML('beforeend',zeileHtml({id:null,wer:'name',name:'',stunden:''}));
    const z=liste.lastElementChild;binde(z);z.querySelector('[name="wer"]').value=imTeam.find(x=>!erfasst().includes(x.user_id))?.user_id||'name';
    z.querySelector('[name="name"]').hidden=z.querySelector('[name="wer"]').value!=='name';z.querySelector('[name="wer"]').focus();
  });
  form.addEventListener('input',summe);summe();
  if(stand)entfernenFrage('Wirklich entfernen? Mit den Stunden dieses Stands',async()=>{
    const {error}=await sb.from('office_controlling_staende').delete().eq('id',stand.id);
    if(error){zeigeFehler('Nicht entfernt: '+error.message);return}
    dialog.close();await neuLaden('Stand entfernt.');
  });
  form.addEventListener('submit',async ev=>{
    if(ev.submitter?.value!=='speichern')return;
    ev.preventDefault();
    const stichtag=form.stichtag.value,lsText=form.ls.value.trim(),ls=lsText?K.leseZahl(lsText):null;
    if(!stichtag){zeigeFehler('Bitte einen Stichtag wählen.');return}
    if(lsText&&(ls==null||ls<0||ls>100)){zeigeFehler('Leistungsstand in Prozent, 0 bis 100.');return}
    const neu=[...liste.querySelectorAll('[data-zeile]')].map(z=>{
      const w=z.querySelector('[name="wer"]').value,name=z.querySelector('[name="name"]').value.trim();
      return {id:z.dataset.id||null,person_id:UUID.test(w)?w:null,person_name:w==='name'?name:null,stunden:K.leseZahl(z.querySelector('[name="stunden"]').value),w,name};
    });
    if(neu.some(z=>z.w==='name'&&!z.name)){zeigeFehler('Bitte den Namen eintragen oder eine Person wählen.');return}
    if(neu.some(z=>z.stunden==null||z.stunden<0)){zeigeFehler('Bitte die Stunden je Zeile als Zahl eintragen, etwa 732 oder 12,5.');return}
    const schluessel=neu.map(z=>z.person_id||(z.person_name?'name:'+z.person_name.toLowerCase():'team'));
    if(new Set(schluessel).size!==schluessel.length){zeigeFehler('Jede Person nur einmal je Stand.');return}
    const kopf={stichtag,leistungsstand:ls,notiz:form.notiz.value.trim()||null};
    let standId=stand?.id;
    if(stand){
      const {error}=await sb.from('office_controlling_staende').update(kopf).eq('id',standId);
      if(error){zeigeFehler(error.code==='23505'?'Für diesen Tag gibt es schon einen Stand.':'Nicht gespeichert: '+error.message);return}
    }else{
      const {data,error}=await sb.from('office_controlling_staende').insert({...kopf,paket_id:p.id,created_by:nutzer.id}).select('id').single();
      if(error){zeigeFehler(error.code==='23505'?'Für diesen Tag gibt es schon einen Stand.':'Nicht gespeichert: '+error.message);return}
      standId=data.id;
    }
    // Erst entfernen, dann ändern, dann neu: so stößt keine Person an ihre eigene alte Zeile.
    const alt=stand?stundenVon(standId):[],bleibt=new Set(neu.map(z=>z.id).filter(Boolean));
    const schritte=[...alt.filter(h=>!bleibt.has(h.id)).map(h=>()=>sb.from('office_controlling_stunden').delete().eq('id',h.id)),
      ...neu.filter(z=>z.id).map(z=>()=>sb.from('office_controlling_stunden').update({person_id:z.person_id,person_name:z.person_name,stunden:z.stunden}).eq('id',z.id)),
      ...(neu.some(z=>!z.id)?[()=>sb.from('office_controlling_stunden').insert(neu.filter(z=>!z.id).map(z=>({stand_id:standId,person_id:z.person_id,
        person_name:z.person_name,stunden:z.stunden,created_by:nutzer.id})))]:[])];
    for(const schritt of schritte){
      const {error}=await schritt();
      if(error){zeigeFehler((error.code==='23505'?'Jede Person nur einmal je Stand.':'Stunden nicht vollständig gespeichert: '+error.message)+' Der Stand ist angelegt; bitte prüfen.');await ladeAlles().catch(()=>{});return}
    }
    dialog.close();await neuLaden(stand?'Stand gespeichert.':'Stand angelegt.');
  });
}

// Eine Zahlung: netto (mit Nebenkosten) und MwSt; wer nur den Bruttobetrag kennt, trägt ihn ein und das Formular teilt ihn.
function zahlungFormular(p,z){
  const nk=Number(p.nebenkosten_prozent)||0;
  const form=oeffneDialog('<form method="dialog" class="pb-form"><h2>'+(z?'Zahlung bearbeiten':'Zahlung erfassen')+'</h2><p class="meta">'+esc(p.bezeichnung)+'</p>'+
    '<div class="pb-felder">'+
    '<label>Datum<input type="date" name="datum" class="pb-input" value="'+esc(z?.datum||'')+'"></label>'+
    '<label>Bezeichnung<input name="bezeichnung" class="pb-input" maxlength="160" value="'+esc(z?.bezeichnung||'')+'" placeholder="z. B. 1. Abschlag"></label>'+
    '<label class="breit">Brutto (€), wird aufgeteilt<input name="brutto" class="pb-input" inputmode="decimal" placeholder="z. B. 25.000 – füllt Netto und MwSt zu '+K.MWST_PROZENT+' %"></label>'+
    '<label>Netto mit Nebenkosten (€)<input name="netto" class="pb-input" inputmode="decimal" required value="'+esc(eingabe(z?.netto))+'"></label>'+
    '<label>MwSt (€)<input name="mwst" class="pb-input" inputmode="decimal" value="'+esc(eingabe(z?.mwst??''))+'"></label>'+
    '<label>Status<select name="status" class="pb-input">'+optionen(ZAHLUNG,z?.status||'bezahlt')+'</select></label>'+
    '<label class="pb-check"><input type="checkbox" name="vorlaeufig"'+(z?.vorlaeufig?' checked':'')+'>vorläufig (noch nicht bestätigt)</label>'+
    '<label class="breit">Notiz<input name="notiz" class="pb-input" maxlength="1000" value="'+esc(z?.notiz||'')+'"></label></div>'+
    '<p class="ct-vorschau" data-vorschau></p>'+knoepfe('Speichern',z?'Zahlung entfernen':'')+'</form>');
  const vorschau=()=>{
    const n=K.leseZahl(form.netto.value),m=K.leseZahl(form.mwst.value)||0;
    dialog.querySelector('[data-vorschau]').textContent=n==null?'':'davon Honorar '+euro(K.honorarAnteil(n,nk),2)+' · Nebenkosten '+euro(K.r2(n-K.honorarAnteil(n,nk)),2)+' · brutto '+euro(K.r2(n+m),2);
  };
  form.brutto.addEventListener('input',()=>{
    const b=K.leseZahl(form.brutto.value);if(b==null)return;
    const t=K.ausBrutto(b);form.netto.value=eingabe(t.netto);form.mwst.value=eingabe(t.mwst);vorschau();
  });
  form.addEventListener('input',vorschau);vorschau();
  if(z)entfernenFrage('Wirklich entfernen?',async()=>{
    const {error}=await sb.from('office_controlling_zahlungen').delete().eq('id',z.id);
    if(error){zeigeFehler('Nicht entfernt: '+error.message);return}
    dialog.close();await neuLaden('Zahlung entfernt.');
  });
  form.addEventListener('submit',async ev=>{
    if(ev.submitter?.value!=='speichern')return;
    ev.preventDefault();
    const netto=K.leseZahl(form.netto.value),mwst=form.mwst.value.trim()?K.leseZahl(form.mwst.value):0;
    if(netto==null||netto<0){zeigeFehler('Netto als Betrag in Euro, etwa 21.008,40.');return}
    if(mwst==null||mwst<0){zeigeFehler('MwSt als Betrag in Euro.');return}
    const zeile={datum:form.datum.value||null,bezeichnung:form.bezeichnung.value.trim()||null,netto,mwst,status:form.status.value,
      vorlaeufig:form.vorlaeufig.checked,notiz:form.notiz.value.trim()||null};
    const {error}=z?await sb.from('office_controlling_zahlungen').update(zeile).eq('id',z.id)
      :await sb.from('office_controlling_zahlungen').insert({...zeile,paket_id:p.id,created_by:nutzer.id});
    if(error){zeigeFehler('Nicht gespeichert: '+error.message);return}
    dialog.close();ui.reiter='zahlungen';adresse();await neuLaden(z?'Zahlung gespeichert.':'Zahlung erfasst.');
  });
}

// Sätze einer Person: ein neuer Eintrag gilt ab seinem Datum; ältere bleiben für frühere Stände.
function satzFormular(personId){
  const e=daten.einstellungen||{arbeitgeberanteil_prozent:21,jahresstunden:1600};
  const eigene=daten.saetze.filter(s=>s.person_id===personId).sort((a,b)=>String(b.gueltig_ab).localeCompare(String(a.gueltig_ab)));
  const form=oeffneDialog('<form method="dialog" class="pb-form"><h2>Sätze</h2><p class="meta">'+esc(person(personId)||'Person')+'</p>'+
    (eigene.length?'<div class="pb-tabelle ct-tabelle"><table><thead><tr><th>gültig ab</th><th class="num">Kalkulationssatz</th><th class="num">Monatsgehalt</th><th></th></tr></thead><tbody>'+
      eigene.map(s=>'<tr><td>'+esc(datum(s.gueltig_ab))+'</td><td class="num">'+esc(s.kalkulationssatz==null?'—':euro(s.kalkulationssatz,2)+'/h')+'</td>'+
        '<td class="num">'+esc(s.monatsgehalt==null?'—':euro(s.monatsgehalt))+'</td><td><button type="button" class="btn btn-quiet btn-danger" data-satz-weg="'+esc(s.id)+'">Entfernen</button></td></tr>').join('')+
      '</tbody></table></div>':'<p class="meta">Noch kein eigener Satz: es gilt der Kalkulationssatz des Pakets.</p>')+
    '<h3 class="pb-h3">Neuer Eintrag</h3><div class="pb-felder">'+
    '<label>gültig ab<input type="date" name="ab" class="pb-input" required value="'+esc(heute())+'"></label>'+
    '<label>Kalkulationssatz (€/h)<input name="satz" class="pb-input" inputmode="decimal" placeholder="leer: Satz des Pakets"></label>'+
    '<label>Monatsgehalt brutto (€)<input name="gehalt" class="pb-input" inputmode="decimal" placeholder="leer: unbekannt"></label>'+
    '<label class="breit">Notiz<input name="notiz" class="pb-input" maxlength="500"></label></div>'+
    '<p class="ct-vorschau" data-vorschau></p>'+knoepfe('Eintragen','')+'</form>');
  const vorschau=()=>{const g=K.leseZahl(form.gehalt.value);dialog.querySelector('[data-vorschau]').textContent=g?'Stundensatz aus Gehalt '+euro(K.gehaltSatz(g,e),2)+
    '/h (mit '+proz(Number(e.arbeitgeberanteil_prozent))+' Arbeitgeberanteil und '+zahl(e.jahresstunden)+' Jahresstunden)':''};
  form.addEventListener('input',vorschau);
  dialog.querySelectorAll('[data-satz-weg]').forEach(b=>b.addEventListener('click',async()=>{
    if(b.dataset.sicher!=='1'){b.dataset.sicher='1';b.textContent='Wirklich?';return}
    const {error}=await sb.from('office_controlling_saetze').delete().eq('id',b.dataset.satzWeg);
    if(error){zeigeFehler('Nicht entfernt: '+error.message);return}
    dialog.close();await neuLaden('Eintrag entfernt.');
  }));
  form.addEventListener('submit',async ev=>{
    if(ev.submitter?.value!=='speichern')return;
    ev.preventDefault();
    const satzText=form.satz.value.trim(),gehaltText=form.gehalt.value.trim();
    const satz=satzText?K.leseZahl(satzText):null,gehalt=gehaltText?K.leseZahl(gehaltText):null;
    if(!satzText&&!gehaltText){zeigeFehler('Bitte einen Kalkulationssatz oder ein Monatsgehalt eintragen.');return}
    if(satzText&&!(satz>0)){zeigeFehler('Kalkulationssatz in Euro je Stunde, etwa 85.');return}
    if(gehaltText&&(gehalt==null||gehalt<0)){zeigeFehler('Monatsgehalt als Betrag in Euro.');return}
    const {error}=await sb.from('office_controlling_saetze').insert({person_id:personId,gueltig_ab:form.ab.value,kalkulationssatz:satz,monatsgehalt:gehalt,
      notiz:form.notiz.value.trim()||null,created_by:nutzer.id});
    if(error){zeigeFehler(error.code==='23505'?'Für diesen Tag gibt es schon einen Eintrag; bitte ihn entfernen oder ein anderes Datum wählen.':'Nicht gespeichert: '+error.message);return}
    dialog.close();await neuLaden('Eingetragen.');
  });
}

void start();
})();
