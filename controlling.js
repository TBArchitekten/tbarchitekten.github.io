/* TBA Office · Controlling (25.11.2026, Claude; Wunsch von Gari am 25.11.2026).
   Gari: Der Chef legt im Vertrag das Honorar fest und kalkuliert mit 85 €/h, je Mitarbeiter änderbar; daraus folgen die
   vorgesehenen Stunden. Am Ende soll man sehen, was gegenüber der Kalkulation gewonnen wurde. Auf das Honorar kommen
   Nebenkosten (5 %); die Auftraggeber zahlen in Abschlägen, jede Zahlung mit Netto und MwSt, eingetragen und geändert in
   einem eigenen Reiter.
   Gestalt (Gari, Vorschläge B und C): die Übersicht als Karten mit zwei Balken (Stunden gegen das Budget, mit der Marke
   des Leistungsstands; Honorar mit bezahlt und erarbeitet), je Projekt ein Projektblatt mit Kennzahlen, Ständen und
   Zahlungen. Begriffe wie in der Projektübersicht von untermStrich: erarbeitetes Honorar = Honorar × Leistungsstand,
   Prognose = bisheriger Wert ÷ Leistungsstand.
   Sichtbarkeit (Gari): Alle im Projekt sehen Honorar, Zahlungen, Stunden, den Vergleich mit der Kalkulation und, ob
   der Gewinn im Plus, knapp oder im Minus liegt (26.11.2026, office_controlling_gewinn_stufen, ohne Betrag); Sätze und
   Gehälter der Personen, das Ergebnis zum Gehalt und den Betrag des Gewinns nur mit vollem Zugang: Admins und, wer in office_controlling_zugang steht (die
   Buchhaltung, Gari 25.11.2026; sie sieht alle Projekte, wird aber nicht Admin des Office). Die Datenbank setzt das
   durch (Migrationen 20261125085053 und office_controlling_zugang): Stunden je Person, Sätze, Gehälter und
   Einstellungen liest nur voller Zugang, die Summen je Stand kommen aus office_controlling_summen. Eintragen und ändern:
   nur voller Zugang; den Zugang vergeben nur Admins (Ansicht «Sätze und Gehälter»).
   Karten (Gari, 25.11.2026): fett das Projekt, darunter das Paket; die ganze Karte öffnet das Projektblatt.
   Ansichten: Übersicht (ohne Parameter), Projektblatt (?projekt=<id>, auch als Reiter «Controlling» eines Projekts in
   Work; ?paket= und ?reiter=zahlungen wählen vor), Sätze und Gehälter (?ansicht=saetze, nur Admins).
   Nachmittags (Gari, 25.11.2026): oben im Projektblatt die Lage auf einen Blick (Stufe mit Zeichen und Wort, Leistung,
   Stunden und Bezahltes auf einer Skala, vier Zahlen); Wochenstunden je Person; Selbstkosten mit dem Gemeinkostenfaktor
   auf das Bruttogehalt allein und daraus der Gewinn nach Bürokosten, im vertraulichen Teil neben jedem Wert, wie er
   gerechnet ist; unter «Sätze und Gehälter» die Annahmen mit Erklärung und die Fragen, die noch zu klären sind;
   gleiche Begriffe in Übersicht und Projektblatt; Nebenknöpfe blau (klickbar heißt blau).
   Abends (Gari, 25.11.2026): «So gerechnet» erst auf Knopfdruck; die Stunden grün im Budget, orange leicht und rot
   deutlich darüber; die Jahresstunden aus dem Kalender hergeleitet (Feiertage in Augsburg, Urlaub, Krankheit, weitere
   Tage, Projektanteil); PDF über den Druckdialog für die Zahlungen, einen Bericht je Paket und die Übersicht.
   Später (Gari, 25.11.2026): Urlaub je Person (eigene Jahresstunden, Spalten «Urlaub» und «Jahresstunden» unter «Sätze
   und Gehälter»); die Übersicht nach Projektnummer.
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

// voll: voller Zugang zum Controlling = Eintrag in office_controlling_zugang (seit 25.11.2026 nur die Liste, Admin allein
// reicht nicht; Wunsch von Gari: er, die Buchhaltung und später der Chef); istAdmin und voll zusammen: vergibt den Zugang.
let nutzer=null,voll=false,istAdmin=false;
const daten={projekte:[],pakete:[],staende:[],summen:[],zahlungen:[],stunden:[],saetze:[],einstellungen:null,personen:[],team:[],zugang:[]};
const ui={paket:UUID.test(params.get('paket')||'')?params.get('paket'):null,reiter:params.get('reiter')==='zahlungen'?'zahlungen':'staende',soGerechnet:false};

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
  istAdmin=m.role==='admin';
  voll=await hatZugang();
  try{await ladeAlles();zeichne()}catch(e){console.error('Controlling',e);fehler(e?.message||'Controlling nicht erreichbar.')}
}
const leer=()=>Promise.resolve({data:[],error:null});
// Eigener Eintrag in office_controlling_zugang (jede Person sieht nur ihren eigenen); ohne Tabelle: kein Zugang.
async function hatZugang(){
  try{const {data,error}=await sb.from('office_controlling_zugang').select('user_id').eq('user_id',nutzer.id).maybeSingle();return !error&&!!data}
  catch{return false}
}
async function ladeAlles(){
  const projekte=sb.from('office_projects').select('id,number,name,status,projektleiter_id');
  const pakete=sb.from('office_controlling_pakete').select('*');
  const [proj,pak,mi,te]=await Promise.all([
    (PROJEKT?projekte.eq('id',PROJEKT):projekte.order('number')).limit(500),
    (PROJEKT?pakete.eq('project_id',PROJEKT):pakete).order('created_at').limit(500),
    sb.from('office_members').select('user_id,display_name,role,is_active').limit(500),
    PROJEKT&&voll?sb.from('office_project_members').select('project_id,user_id').eq('project_id',PROJEKT).limit(500):leer()
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
  // Ohne vollen Zugang: der Gewinn je Paket als Stufe (plus, knapp, minus), gerechnet in der Datenbank. Fehlt die
  // Funktion noch, bleibt die Stufe leer, statt die Seite anzuhalten.
  daten.stufen=[];
  if(!voll&&projektIds.length){
    const gs=await Promise.all(projektIds.map(id=>sb.rpc('office_controlling_gewinn_stufen',{p_project:id})));
    daten.stufen=gs.flatMap(x=>x.error?[]:x.data||[]);
  }
  daten.stunden=[];daten.saetze=[];daten.einstellungen=null;
  if(voll){
    const standIds=daten.staende.map(s=>s.id);
    const [h,sa,ei]=await Promise.all([
      standIds.length?sb.from('office_controlling_stunden').select('*').in('stand_id',standIds).limit(10000):leer(),
      sb.from('office_controlling_saetze').select('*').order('gueltig_ab').limit(5000),
      sb.from('office_controlling_einstellungen').select('*').limit(1)
    ]);
    const err3=h.error||sa.error||ei.error;if(err3)throw err3;
    daten.stunden=h.data||[];daten.saetze=sa.data||[];daten.einstellungen=(ei.data||[])[0]||null;
  }
  daten.zugang=[];
  if(istAdmin&&voll&&ANSICHT==='saetze'){
    const zu=await sb.from('office_controlling_zugang').select('user_id,created_at').limit(500);
    if(!zu.error)daten.zugang=zu.data||[];
  }
}
function zeichne(){
  if(ANSICHT==='saetze'){if(voll)renderSaetze();else fehler('Sätze und Gehälter sind nur mit vollem Zugang zum Controlling sichtbar.');return}
  if(ANSICHT==='projekt'){const p=projekt(PROJEKT);if(p)renderProjekt(p);else fehler('Dieses Projekt ist nicht erreichbar oder gehört nicht zum eigenen Team.');return}
  renderUebersicht();
}
async function neuLaden(text){
  try{await ladeAlles();zeichne();if(text){meldung(text);kanal?.postMessage('geaendert')}}catch(e){meldung('Nicht geladen: '+(e?.message||e),'warn')}
}
// Andere offene Controlling-Seiten im selben Browser (etwa der Reiter «Controlling» in Work neben «Sätze und Gehälter»)
// laden nach einer Änderung neu und rechnen mit den neuen Sätzen und Annahmen (Gari und die Buchhaltung, 26.11.2026). Ist
// dort gerade ein Formular offen, erst wenn es zu ist. «Sätze und Gehälter» selbst nicht: dort wird eingetragen, und ein
// halb ausgefülltes Formular der Annahmen soll nicht verschwinden.
const kanal=typeof BroadcastChannel==='function'?new BroadcastChannel('tba-office-controlling'):null;
let nachladen=false;
kanal?.addEventListener('message',ev=>{
  if(ev.data!=='geaendert'||!nutzer||ANSICHT==='saetze')return;
  if(dialog?.open){nachladen=true;return}
  void neuLaden();
});
dialog?.addEventListener('close',()=>{if(nachladen){nachladen=false;void neuLaden()}});

// ---------- Daten ----------
const projekt=id=>daten.projekte.find(p=>p.id===id)||null;
const projektName=p=>p?[p.number,p.name].filter(Boolean).join(' · '):'';
const person=id=>daten.personen.find(x=>x.user_id===id)?.display_name||'';
const paketeVon=pid=>daten.pakete.filter(p=>p.project_id===pid);
const standZeile=id=>daten.staende.find(s=>s.id===id)||null;
const summenVon=p=>daten.summen.filter(s=>s.paket_id===p.id).sort((a,b)=>String(a.stichtag).localeCompare(String(b.stichtag)));
const zahlungenVon=p=>daten.zahlungen.filter(z=>z.paket_id===p.id)
  .sort((a,b)=>String(a.datum||'9999').localeCompare(String(b.datum||'9999'))||String(a.created_at).localeCompare(String(b.created_at)));
const stundenVon=standId=>daten.stunden.filter(h=>h.stand_id===standId);
// Mit vollem Zugang bewertet die Seite die Stunden je Person selbst (wie office_controlling_summen), mit Personalkosten
// und Selbstkosten; ohne vollen Zugang gibt es dafür keine Daten.
const bewVon=p=>voll?K.bewertung(summenVon(p).map(s=>({id:s.stand_id,stichtag:s.stichtag})),daten.stunden,daten.saetze,daten.einstellungen,p.kalkulationssatz):null;
// Der Gewinn (Gari, 26.11.2026): mit vollem Zugang der Betrag, dazu die Stufe aus ihm; ohne vollen Zugang nur die Stufe
// aus der Datenbank. «vorläufig», solange die Annahmen nicht bestätigt sind.
function mitStufe(p,k){
  if(voll){k.gewinnStufe=K.gewinnStufe(k.abgeschlossen?k.gewinn:k.prognoseGewinn,k.honorar);k.gewinnVorlaeufig=!daten.einstellungen?.annahmen_bestaetigt}
  else{const x=daten.stufen.find(s=>s.paket_id===p.id);k.gewinnStufe=x?.stufe||null;k.gewinnVorlaeufig=x?x.vorlaeufig!==false:true}
  return k;
}
const kz=p=>mitStufe(p,K.kennzahlen(p,summenVon(p),zahlungenVon(p),bewVon(p)));
// Ein Paket für die Übersicht, mit der Nummer seines Projekts (geordnet nach Nummer, Gari 25.11.2026).
const eintrag=p=>({paket:p,k:kz(p),nummer:projekt(p.project_id)?.number||''});
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
    '<div class="ct-balken'+(ueber?' ueber':'')+' lage-'+K.lage(k).stufe+'" role="img" aria-label="'+esc(std(k.stunden)+' von '+std(k.budget)+'. '+text)+'">'+
    '<span class="ct-fuellung" style="width:'+breite.toFixed(2)+'%"></span>'+marke+'</div><p class="meta">'+esc(text)+'</p></div>';
}
function balkenHonorar(k){
  if(!(k.honorar>0))return '';
  const b=Math.min(Math.max(k.bezahlt,0)/k.honorar,1)*100,e=k.erarbeitet!=null?Math.min(k.erarbeitet/k.honorar,1)*100:0;
  const teile=[(k.zahlungen?'bezahlt '+euro(k.bezahlt)+' netto':'Zahlungen noch nicht erfasst'),k.erarbeitet!=null?'erarbeitet '+euro(k.erarbeitet)+' netto':''].filter(Boolean);
  return '<div class="ct-balken-block"><div class="ct-balken-kopf"><span>Honorar netto</span><strong>'+euro(k.honorar)+'</strong></div>'+
    '<div class="ct-balken" role="img" aria-label="'+esc(teile.join(', ')+' von '+euro(k.honorar))+'">'+
    '<span class="ct-erarbeitet" style="width:'+e.toFixed(2)+'%"></span><span class="ct-bezahlt" style="width:'+b.toFixed(2)+'%"></span></div>'+
    '<p class="meta"><span class="ct-legende"><i></i>'+esc(teile[0])+'</span>'+(teile[1]?' · <span class="ct-legende"><i class="hell"></i>'+esc(teile[1])+'</span>':'')+'</p></div>';
}
// ---------- Lage auf einen Blick ----------
// Gari (25.11.2026): das Projektblatt öffnen und sofort sehen, wie das Projekt läuft. Die Stufe kommt aus der
// Hochrechnung gegenüber der Kalkulation (controlling-kern.js, lage) und erscheint immer mit Zeichen und Wort, nie nur als
// Farbe; dazu Leistung, Stunden und Bezahltes auf derselben Skala und vier Zahlen, die sagen, was zu tun ist.
const LAGE={gut:'im Budget',achtung:'leicht über Budget',kritisch:'deutlich über Budget',offen:'noch offen'};
const LAGE_TITEL={gut:'Im Budget',achtung:'Leicht über Budget',kritisch:'Deutlich über Budget',offen:'Noch keine Einschätzung'};
const LAGE_ZEICHEN={
  gut:'<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.4"/><path d="M5.1 8.3l1.9 1.9 3.9-4.2"/></svg>',
  achtung:'<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 1.9l6.3 11.3H1.7z"/><path d="M8 6.3v3.2M8 11.4v.2"/></svg>',
  kritisch:'<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5.3 1.6h5.4l3.7 3.7v5.4l-3.7 3.7H5.3l-3.7-3.7V5.3z"/><path d="M8 4.8v4M8 11v.2"/></svg>',
  offen:'<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.4"/><path d="M5.2 8h5.6"/></svg>'
};
const prozentHonorar=l=>proz(Math.round(Math.abs(l.anteil)*1000)/10);
function lageSatz(k,l){
  if(l.grund==='honorar')return 'Ohne Honorar gibt es kein Budget, an dem sich die Stunden messen lassen.';
  if(l.grund==='stand')return 'Sobald ein Stand mit Stunden und Leistungsstand erfasst ist, steht hier, wie das Paket läuft.';
  if(l.grund==='leistungsstand')return 'Im letzten Stand fehlt der geschätzte Leistungsstand; ohne ihn lässt sich nicht hochrechnen.';
  if(k.abgeschlossen)return l.ergebnis>=0?'Abgeschlossen mit '+std(k.stunden)+' von '+std(k.budget)+': '+plus(l.ergebnis)+' gegenüber der Kalkulation.'
    :'Abgeschlossen mit '+std(k.stunden)+' statt '+std(k.budget)+': die Stunden kosteten '+euro(-l.ergebnis)+' mehr als kalkuliert ('+prozentHonorar(l)+' des Honorars).';
  if(l.stufe==='gut')return 'Im bisherigen Takt reicht das Budget: '+std(k.prognoseStunden)+' von '+std(k.budget)+', am Ende '+plus(l.ergebnis)+' gegenüber der Kalkulation.';
  return 'Im bisherigen Takt braucht das Paket '+std(k.prognoseStunden)+' statt '+std(k.budget)+'; am Ende fehlen '+euro(-l.ergebnis)+
    ' gegenüber der Kalkulation ('+prozentHonorar(l)+' des Honorars).';
}
const lageChip=k=>{const l=K.lage(k);return '<span class="chip ct-lage-chip ct-lage-'+l.stufe+'" data-lage="'+l.stufe+'">'+LAGE_ZEICHEN[l.stufe]+esc(LAGE[l.stufe])+'</span>'};
// Leistung, Stunden (vom Budget) und Bezahltes (vom Honorar) auf derselben Skala; der Strich ist der Leistungsstand: die
// Stunden sollten links davon bleiben, das Bezahlte ihn erreichen. Die Stunden tragen die Farbe der Lage (Gari,
// 25.11.2026): grün im Budget, orange leicht, rot deutlich darüber; Leistung und Bezahltes bleiben grau.
function meterListe(k,l){
  if(!(k.honorar>0))return '';
  const ls=k.leistungsstand,anteil=(x,y)=>y>0?x/y*100:null;
  const st=anteil(k.stunden,k.budget),bz=k.zahlungen?anteil(Math.max(k.bezahlt,0),k.honorar):null;
  const breite=x=>Math.max(0,Math.min(Number(x)||0,100)).toFixed(2)+'%',rund=x=>proz(Math.round(x));
  const marke=ls!=null?'<span class="ct-meter-marke" style="left:'+breite(ls)+'"></span>':'';
  const zeile=(name,wert,text,klasse,mitMarke)=>'<div class="ct-meter" data-meter="'+name.toLowerCase()+'"><span class="ct-meter-name">'+esc(name)+'</span>'+
    '<span class="ct-meter-spur'+klasse+'" role="img" aria-label="'+esc(name+': '+text)+'">'+(wert!=null?'<span class="ct-meter-fuellung" style="width:'+breite(wert)+'"></span>':'')+
    (mitMarke?marke:'')+'</span><span class="ct-meter-zahl">'+esc(text)+'</span></div>';
  return '<div class="ct-meter-liste">'+
    zeile('Leistung',ls,ls==null?'noch nicht geschätzt':proz(ls)+' erledigt','',false)+
    zeile('Stunden',st,st==null?std(k.stunden):rund(st)+' · '+std(k.stunden)+' von '+std(k.budget),l.stufe!=='offen'?' '+l.stufe:'',true)+
    zeile('Bezahlt',bz,bz==null?'keine Zahlungen erfasst':rund(bz)+' · '+euro(k.bezahlt)+' von '+euro(k.honorar),'',true)+
    (ls!=null?'<p class="meta ct-meter-legende"><i aria-hidden="true"></i>Leistungsstand: die Stunden sollten links davon bleiben, das Bezahlte ihn erreichen.</p>':'')+'</div>';
}
function kachel(schluessel,name,wert,klasse,unter,vertraulich=false){
  return '<div class="ct-kachel" data-kachel="'+schluessel+'"><span class="ct-kachel-name">'+esc(name)+(vertraulich?' <span class="ct-nur-admin">vertraulich</span>':'')+'</span>'+
    '<strong class="ct-kachel-wert'+klasse+'">'+esc(wert)+'</strong>'+(unter?'<span class="ct-kachel-unter">'+esc(unter)+'</span>':'')+'</div>';
}
// Zwei Fragen, zwei Zahlen (Gari, 26.11.2026): verdient das Paket Geld (Gewinn nach Gehältern und Bürokosten), und
// reichen die Stunden, wie kalkuliert («Gegenüber Kalkulation», früher «Ergebnis»: die Stunden zum Kalkulationssatz, also
// nicht der Gewinn). Den Betrag des Gewinns sieht nur der volle Zugang; das Team sieht, ob er im Plus, knapp oder im
// Minus liegt: mit Honorar, Stunden und Betrag ließe sich in kleinen Teams ein Gehalt ausrechnen.
const STUFE={plus:'im Plus',knapp:'knapp',minus:'im Minus'},STUFE_LAGE={plus:'gut',knapp:'achtung',minus:'kritisch'};
const stufeChip=st=>'<span class="chip ct-lage-chip ct-lage-'+STUFE_LAGE[st]+'" data-stufe="'+st+'">'+LAGE_ZEICHEN[STUFE_LAGE[st]]+esc(STUFE[st])+'</span>';
const kalkName=k=>k.abgeschlossen?'Gegenüber Kalkulation netto':'Gegenüber Kalkulation am Ende netto';
const gewinnWert=k=>k.abgeschlossen?k.gewinn:k.prognoseGewinn;
const gewinnGrund=k=>!K.annahmen(daten.einstellungen).faktor?'Gemeinkostenfaktor fehlt':k.erarbeitet==null?'braucht den Leistungsstand':'Gehälter unvollständig';
function stufeKachel(k){
  const st=k.gewinnStufe;
  return '<div class="ct-kachel" data-kachel="gewinn"><span class="ct-kachel-name">'+(k.abgeschlossen?'Gewinn':'Gewinn am Ende')+'</span>'+
    '<strong class="ct-kachel-wert">'+(st?stufeChip(st):'—')+'</strong><span class="ct-kachel-unter">'+
    esc(st?'nach Gehältern und Bürokosten; der Betrag ist vertraulich'+(k.gewinnVorlaeufig?' · vorläufig':''):'noch nicht zu rechnen')+'</span></div>';
}
function kacheln(k,l,mitGewinn=voll){
  const ergebnis=k.abgeschlossen?k.ergebnisBisher:k.prognoseErgebnis,t=[];
  if(mitGewinn){
    const g=gewinnWert(k);
    t.push(kachel('gewinn',k.abgeschlossen?'Gewinn netto':'Gewinn am Ende netto',plus(g),plusKlasse(g),
      g!=null?'nach Gehältern und Bürokosten'+(k.gewinnVorlaeufig?' · Annahmen vorläufig':''):gewinnGrund(k),true));
  }else t.push(stufeKachel(k));
  t.push(kachel('ergebnis',kalkName(k),plus(ergebnis),plusKlasse(ergebnis),
    ergebnis==null?'braucht den Leistungsstand':k.abgeschlossen?'Stunden zum Kalkulationssatz':'hochgerechnet, Stunden zum Kalkulationssatz'));
  if(!k.abgeschlossen&&k.budget>0)t.push(kachel('rest','Stunden für den Rest',std(K.r2(k.budget-k.stunden)),k.stunden>k.budget+0.005?' ct-minus':'',
    l.restNoetig!=null?'im bisherigen Takt nötig: '+std(l.restNoetig):'Budget minus bisherige Stunden'));
  const offen=k.erarbeitet==null||!k.zahlungen?null:k.offen;
  t.push(kachel('offen','Erarbeitet, nicht bezahlt netto',offen==null?'—':offen<-0.004?'− '+euro(-offen):euro(offen),'',
    k.erarbeitet==null?'braucht den Leistungsstand':!k.zahlungen?'keine Zahlungen erfasst':offen<-0.004?'im Voraus bezahlt':k.gestellt?'davon gestellt '+euro(k.gestellt):'kann abgerechnet werden'));
  return '<div class="ct-kacheln">'+t.join('')+'</div>';
}
function lagePanel(k,mitGewinn=voll){
  const l=K.lage(k);
  return '<div class="ct-lage" data-lage="'+l.stufe+'"><div class="ct-lage-kopf"><p class="ct-lage-titel ct-lage-'+l.stufe+'">'+LAGE_ZEICHEN[l.stufe]+
    '<strong>'+esc(LAGE_TITEL[l.stufe])+'</strong></p>'+
    '<p class="ct-lage-satz">'+esc(lageSatz(k,l))+'</p></div>'+meterListe(k,l)+kacheln(k,l,mitGewinn)+'</div>';
}

function chips(p,k,mitLage=true){
  const c=[...(mitLage?[lageChip(k)]:[]),'<span class="chip'+(p.status==='abgeschlossen'?' chip-ok':p.status==='angeboten'?' chip-src':'')+'">'+esc(p.status)+'</span>'];
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
  const eintraege=daten.pakete.map(eintrag).sort(K.ordnung);
  const mitPaket=new Set(daten.pakete.map(p=>p.project_id));
  const ohne=voll?daten.projekte.filter(p=>p.status==='aktiv'&&!mitPaket.has(p.id)):[];
  root.innerHTML='<div class="pb-wrap">'+
    '<a class="pb-back" href="./app/#section=tools">‹ Werkzeuge</a>'+
    '<header class="pb-head"><div class="pb-head-text"><p class="kicker">Controlling</p><h1>Controlling</h1>'+
    '<p class="pb-intro">Honorar laut Vertrag gegen die Stunden im Projekt. Die Kalkulation rechnet mit dem Kalkulationssatz (85 €/h, je Person änderbar); '+
    'erarbeitet ist das Honorar mal Leistungsstand, die Prognose rechnet die bisherigen Stunden auf 100 % hoch. Der Gewinn rechnet mit Gehalt und '+
    'Gemeinkostenfaktor; den Betrag sieht nur, wer vollen Zugang hat. Alle Beträge netto, ohne MwSt.</p></div>'+
    '<div class="pb-actions"><button type="button" class="ct-info" data-rechenweg aria-haspopup="dialog"><span aria-hidden="true">i</span>So wird gerechnet</button>'+
    (eintraege.length?'<button type="button" class="btn" data-pdf-uebersicht>Übersicht als PDF</button>':'')+
    (voll?'<a class="btn" href="./controlling.html?ansicht=saetze">Sätze und Gehälter</a><button type="button" class="btn btn-primary" data-paket-neu>Neues Honorarpaket</button>':'')+'</div>'+
    '</header><p class="pb-banner info" data-meldung hidden></p>'+
    (eintraege.length?'<div class="ct-grid">'+eintraege.map(karte).join('')+'</div>'
      :'<div class="card ct-leer"><p><strong>Noch kein Honorar erfasst.</strong></p><p class="meta">'+
        (voll?'Ein Honorarpaket je Auftrag: Honorar laut Vertrag, Nebenkosten und Kalkulationssatz.':'Das Controlling zeigt die Projekte des eigenen Teams, sobald ein Admin das Honorar eingetragen hat.')+'</p></div>')+
    (ohne.length?'<p class="ct-ohne">Noch ohne Honorar: '+ohne.map(p=>'<a href="'+esc(urlProjekt(p.id))+'">'+esc(projektName(p))+'</a>').join(', ')+'</p>':'')+
    '</div>';
  root.querySelector('[data-paket-neu]')?.addEventListener('click',()=>paketFormular(null,null));
  root.querySelector('[data-rechenweg]')?.addEventListener('click',()=>rechenweg(null));
  root.querySelector('[data-pdf-uebersicht]')?.addEventListener('click',uebersichtPdf);
}
function karte({paket:p,k}){
  const pr=projekt(p.project_id);
  const ergebnis=k.abgeschlossen?k.ergebnisBisher:k.prognoseErgebnis,g=gewinnWert(k);
  // Gari (25.11.2026): fett steht das Projekt, darunter das Paket; die ganze Karte öffnet das Projektblatt (der Link
  // im Titel deckt die Karte ab, siehe .ct-karte h2 a::after). Die Begriffe wie im Projektblatt (Gari, nachmittags).
  // Gari (26.11.2026): unten zuerst der Gewinn (voller Zugang: Betrag, vertraulich; Team: im Plus, knapp, im Minus),
  // dann «Gegenüber Kalkulation» und «Erarbeitet, nicht bezahlt»; «Honorar je Stunde» steht im Projektblatt.
  const vorl=k.gewinnVorlaeufig?'<span class="ct-vorlaeufig">vorläufig</span>':'';
  const gewinn=voll?'<div><dt>'+(k.abgeschlossen?'Gewinn netto':'Gewinn am Ende netto')+' <span class="ct-nur-admin">vertraulich</span></dt>'+
      (g==null?'<dd class="ct-klein" data-gewinn>'+esc(gewinnGrund(k))+'</dd>':'<dd class="'+plusKlasse(g).trim()+'" data-gewinn>'+esc(plus(g))+vorl+'</dd>')+'</div>'
    :'<div><dt>'+(k.abgeschlossen?'Gewinn':'Gewinn am Ende')+'</dt><dd data-gewinn-stufe="'+esc(k.gewinnStufe||'')+'">'+
      (k.gewinnStufe?stufeChip(k.gewinnStufe)+vorl:'<span class="ct-klein">—</span>')+'</dd></div>';
  return '<article class="card ct-karte" data-paket="'+esc(p.id)+'">'+(pr?.number?'<p class="meta ct-nummer">'+esc(pr.number)+'</p>':'')+
    '<h2><a href="'+esc(urlProjekt(p.project_id,{paket:p.id}))+'"><span data-titel>'+esc(pr?.name||'Projekt')+'</span>'+
    '<span class="sr"> · '+esc(p.bezeichnung)+'</span></a></h2>'+
    '<p class="ct-paket">'+esc(p.bezeichnung)+(p.leistung?' <span class="meta">· '+esc(p.leistung)+'</span>':'')+'</p>'+
    '<div class="pb-chips">'+chips(p,k)+'</div>'+balkenStunden(k)+balkenHonorar(k)+
    '<dl class="ct-zahlen">'+
    gewinn+'<div><dt>'+kalkName(k)+'</dt><dd class="'+plusKlasse(ergebnis).trim()+'" data-ergebnis>'+esc(plus(ergebnis))+'</dd></div>'+
    '<div><dt>Erarbeitet, nicht bezahlt netto</dt><dd'+(k.zahlungen||k.erarbeitet==null?'':' class="ct-klein"')+'>'+esc(offenText(k))+'</dd></div></dl></article>';
}

// ---------- Projektblatt ----------
function renderProjekt(pr){
  const pakete=paketeVon(pr.id);
  const p=pakete.find(x=>x.id===ui.paket)||pakete[0]||null;
  ui.paket=p?.id||null;
  const intro='Honorar laut Vertrag, Stunden und Zahlungen. Gewinn: erarbeitetes Honorar minus Selbstkosten (Gehalt mal Gemeinkostenfaktor). '+
    'Gegenüber Kalkulation: erarbeitetes Honorar minus Wert der Stunden zum Kalkulationssatz.';
  const neu=voll?'<button type="button" class="btn'+(p?'':' btn-primary')+'" data-paket-neu>Neues Honorarpaket</button>':'';
  const pillen=pakete.length>1?'<div class="pb-pills" role="group" aria-label="Honorarpakete">'+pakete.map(x=>
      '<button type="button" class="pill" data-paket-wahl="'+esc(x.id)+'" aria-pressed="'+(x.id===ui.paket)+'">'+esc(x.bezeichnung)+'</button>').join('')+'</div>':'';
  // Eine Werkzeugzeile im Reiter von Work (B2, 27.11.2026): Work nennt das Projekt schon; Honorarpakete, «Neues
  // Honorarpaket» und «?» (die Erklärung) stehen in einer Zeile.
  const kopf=IM_REITER
    ?'<div class="ct-zeile">'+pillen+'<span class="ct-zeile-rest">'+neu+
      '<details class="pb-hilfe"><summary title="Erklärung" aria-label="Erklärung">?</summary><div class="pb-hilfe-text"><p>'+esc(intro)+'</p></div></details></span></div>'+
      '<p class="pb-banner info" data-meldung hidden></p>'
    :'<a class="pb-back ct-zur-uebersicht" href="./controlling.html">‹ Controlling</a>'+
    '<header class="pb-head"><div class="pb-head-text"><p class="kicker">Controlling</p><h1>'+esc(projektName(pr))+'</h1>'+
    '<p class="pb-intro">'+esc(intro)+'</p></div>'+
    (neu?'<div class="pb-actions">'+neu+'</div>':'')+
    '</header><p class="pb-banner info" data-meldung hidden></p>'+pillen;
  root.innerHTML='<div class="pb-wrap">'+kopf+
    (p?paketBlatt(p):'<div class="card ct-leer"><p><strong>Für dieses Projekt ist noch kein Honorar erfasst.</strong></p><p class="meta">'+
      (voll?'Ein Honorarpaket je Auftrag, etwa «LPH 3» oder «Machbarkeitsstudie».':'Eintragen kann, wer vollen Zugang zum Controlling hat.')+'</p>'+
      (voll?'<button type="button" class="btn btn-primary" data-paket-neu>Honorarpaket anlegen</button>':'')+'</div>')+
    '</div>';
  root.querySelectorAll('[data-paket-neu]').forEach(b=>b.addEventListener('click',()=>paketFormular(null,pr.id)));
  root.querySelectorAll('[data-paket-wahl]').forEach(b=>b.addEventListener('click',()=>{ui.paket=b.dataset.paketWahl;adresse();renderProjekt(pr)}));
  root.querySelectorAll('[data-reiter]').forEach(b=>b.addEventListener('click',()=>{ui.reiter=b.dataset.reiter;adresse();renderProjekt(pr)}));
  if(!p)return;
  root.querySelector('[data-paket-bearbeiten]')?.addEventListener('click',()=>paketFormular(p,pr.id));
  root.querySelector('[data-rechenweg]')?.addEventListener('click',()=>rechenweg(p));
  root.querySelector('[data-pdf-bericht]')?.addEventListener('click',()=>berichtDialog(pr,p));
  root.querySelector('[data-pdf-zahlungen]')?.addEventListener('click',()=>drucken(dateiname(pr,p,'Zahlungen'),druckKopf('Zahlungsübersicht',pr,p,false)+druckZahlungen(p,kz(p),true)));
  // «So gerechnet» auf Knopfdruck (Gari, 25.11.2026: die Erklärung braucht zu viel Platz); bleibt beim Neuzeichnen offen.
  root.querySelector('[data-so-gerechnet]')?.addEventListener('click',ev=>{
    ui.soGerechnet=!ui.soGerechnet;
    root.querySelector('[data-vertraulich]')?.classList.toggle('offen',ui.soGerechnet);
    ev.currentTarget.setAttribute('aria-expanded',String(ui.soGerechnet));
  });
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
// Beträge und Stunden bleiben auf einer Zeile (die längeren Begriffe brechen um, nicht «20.000 €»).
function zeile(dt,dd,klasse=''){
  const k=(klasse+(/^[+−\d]/.test(String(dd).replace(/<[^>]+>/g,'').trim())?' ct-wert':'')).trim();
  return '<div><dt>'+esc(dt)+'</dt><dd'+(k?' class="'+k+'"':'')+'>'+dd+'</dd></div>';
}
// Die Kennzahlen in vier Gruppen (Projektblatt und Bericht).
function kennzahlGruppen(k){
  const satz=euro(k.satz,k.satz%1?2:0)+'/h';
  // Gari (25.11.2026): bei jedem Betrag sagen, ob netto oder brutto. Alles hier ist netto (ohne MwSt), das Honorar ohne
  // Nebenkosten. Dieselben Begriffe wie auf den Karten der Übersicht.
  const gruppen=[
    ['Vertrag',[zeile('Honorar netto',esc(euro(k.honorar))),zeile('Nebenkosten netto ('+proz(k.nebenkostenProzent)+')',esc(euro(k.nebenkosten))),
      zeile('Kalkulationssatz netto',esc(satz)),zeile('Stundenbudget',esc(std(k.budget)))]],
    [k.stand?'Stand '+datum(k.stand):'Stand',[zeile('Stunden',esc(std(k.stunden))),
      zeile('Leistungsstand',k.leistungsstand==null?'noch nicht geschätzt':esc(proz(k.leistungsstand))+(k.abgeschlossen&&k.geschaetzt!==100?' <span class="meta">(abgeschlossen)</span>':'')),
      zeile('Wert der Stunden netto',esc(euro(k.wert))),zeile('Erarbeitet netto',esc(euro(k.erarbeitet))),
      zeile('Gegenüber Kalkulation bisher netto',esc(plus(k.ergebnisBisher)),plusKlasse(k.ergebnisBisher)),
      zeile('Honorar je Stunde netto',k.jeStunde==null?'—':esc(euro(k.jeStunde,2))+'/h')]],
    [k.abgeschlossen?'Am Ende':'Prognose am Ende',[zeile('Stunden am Ende',esc(std(k.prognoseStunden))),
      zeile('Gegenüber Kalkulation am Ende netto',esc(plus(k.prognoseErgebnis)),plusKlasse(k.prognoseErgebnis))]],
    ['Zahlungen',[zeile('Bezahlt netto (Abschläge)',k.zahlungen?esc(euro(k.bezahlt)):'noch nicht erfasst'),
      ...(k.gestellt?[zeile('Gestellt, noch offen, netto',esc(euro(k.gestellt)))]:[]),zeile('Erarbeitet, nicht bezahlt netto',esc(offenText(k)))]]
  ];
  return '<div class="ct-gruppen">'+gruppen.map(([titel,zeilen])=>'<div class="ct-gruppe"><h3 class="pb-h3">'+esc(titel)+'</h3><dl class="pb-merkmale">'+zeilen.join('')+'</dl></div>').join('')+'</div>';
}
function paketBlatt(p){
  const bew=bewVon(p),k=mitStufe(p,K.kennzahlen(p,summenVon(p),zahlungenVon(p),bew));
  return '<section class="card pb-box" aria-label="Kennzahlen"><div class="ct-kopf-zeile"><div><h2 class="pb-h2">'+esc(p.bezeichnung)+'</h2>'+
    (p.leistung?'<p class="meta">'+esc(p.leistung)+'</p>':'')+'</div><div class="ct-kopf-rechts"><div class="pb-chips">'+chips(p,k,false)+'</div>'+
    '<button type="button" class="ct-info" data-rechenweg aria-haspopup="dialog"><span aria-hidden="true">i</span>So wird gerechnet</button>'+
    '<button type="button" class="btn ct-pdf" data-pdf-bericht aria-haspopup="dialog">Bericht als PDF</button></div></div>'+
    '<p class="meta ct-netto">Alle Beträge in Euro netto, ohne MwSt; das Honorar ohne Nebenkosten.</p>'+
    lagePanel(k)+kennzahlGruppen(k)+
    (voll&&bew?vertraulichBlock(k,bew,ui.soGerechnet):'')+
    (p.notiz?'<p class="meta">'+esc(p.notiz)+'</p>':'')+
    (voll?'<button type="button" class="btn" data-paket-bearbeiten>Paket bearbeiten</button>':'')+'</section>'+
    '<div class="ct-reiter" role="tablist" aria-label="Paket">'+
    '<button type="button" role="tab" data-reiter="staende" aria-selected="'+(ui.reiter==='staende')+'">Stände und Stunden</button>'+
    '<button type="button" role="tab" data-reiter="zahlungen" aria-selected="'+(ui.reiter==='zahlungen')+'">Zahlungen</button></div>'+
    (ui.reiter==='zahlungen'?zahlungenTabelle(p,k):staendeTabelle(p,bew));
}
// Zum Gehalt (vertraulich, nur mit vollem Zugang). Gari (25.11.2026): neben jedem Wert, wie er gerechnet ist. Personalkosten
// = Stunden je Person × Stundensatz aus dem Gehalt; Selbstkosten = Stunden je Person × Bruttogehalt-Stundensatz ×
// Gemeinkostenfaktor; Ergebnis nach Gehältern und Gewinn nach Bürokosten = Erarbeitet minus diese Kosten; am Ende
// hochgerechnet mit dem Leistungsstand wie die Prognose.
function vertraulichBlock(k,bew,offen=false){
  const a=K.annahmen(daten.einstellungen),e=x=>esc(euro(x)),pl=x=>esc(plus(x));
  const name=x=>x.person_id?person(x.person_id)||'Person':x.name||'Team (ohne Aufteilung)';
  const hoch=k.leistungsstand!=null&&!k.abgeschlossen?'<span class="ct-so-teil">am Ende ÷ '+esc(proz(k.leistungsstand))+' Leistungsstand</span>':'';
  const jePerson=(satz,wert)=>bew.personen.filter(x=>x.stunden).map(x=>'<span class="ct-so-teil" data-so-person>'+esc(name(x))+': '+esc(std(x.stunden))+
    (x[satz]!=null?' × '+esc(euro(x[satz],2))+'/h':x[wert]!=null?' = '+e(x[wert])+' (Sätze wechselten)':' – ohne Gehalt')+'</span>').join('');
  const differenz=(kosten,ende,name)=>k.erarbeitet==null||kosten==null?'Erarbeitet − '+name
    :'Erarbeitet '+e(k.erarbeitet)+' − '+e(kosten)+(ende!=null&&!k.abgeschlossen?'<span class="ct-so-teil">am Ende: Honorar '+e(k.honorar)+' − '+e(ende)+'</span>':'');
  const zelle=(spalte,wert,text,klasse='')=>'<td class="num'+klasse+'" data-label="'+spalte+'">'+(wert==null?'<span class="ct-klein">'+esc(text)+'</span>':wert)+'</td>';
  const bis=(...x)=>zelle('bis jetzt',...x),am=(...x)=>zelle('am Ende',...x);
  const fehlt=!a.faktor?'Faktor fehlt':'Gehälter unvollständig';
  const zeile=(schluessel,titel,einheit,bis,ende,so)=>'<tr data-vertraulich-zeile="'+schluessel+'"><th scope="row">'+esc(titel)+
    (einheit?'<span class="ct-einheit">'+esc(einheit)+'</span>':'')+'</th>'+bis+ende+'<td class="ct-so">'+so+'</td></tr>';
  const zeilen=[
    zeile('personalkosten','Personalkosten','Bruttogehalt + '+proz(a.ag)+' Arbeitgeberanteil',bis(k.gehalt==null?null:e(k.gehalt),'Gehälter unvollständig'),
      am(k.prognosePersonalkosten==null?null:e(k.prognosePersonalkosten),'—'),jePerson('satzGehalt','personalkosten')+hoch),
    zeile('ergebnis-gehalt','Ergebnis nach Gehältern netto','',bis(k.ergebnisGehalt==null?null:pl(k.ergebnisGehalt),'—',plusKlasse(k.ergebnisGehalt)),
      am(k.prognoseGehalt==null?null:pl(k.prognoseGehalt),'—',plusKlasse(k.prognoseGehalt)),differenz(k.gehalt,k.prognosePersonalkosten,'Personalkosten')),
    zeile('selbstkosten','Selbstkosten',a.faktor?'Bruttogehalt × '+zahl(a.faktor,2):'Bruttogehalt × Gemeinkostenfaktor',bis(k.selbstkosten==null?null:e(k.selbstkosten),fehlt),
      am(k.prognoseSelbstkosten==null?null:e(k.prognoseSelbstkosten),'—'),
      a.faktor?jePerson('satzSelbstkosten','selbstkosten')+hoch:'Ohne Gemeinkostenfaktor keine Selbstkosten: unter «Sätze und Gehälter» eintragen.'),
    zeile('gewinn','Gewinn nach Bürokosten netto','',bis(k.gewinn==null?null:pl(k.gewinn),'—',plusKlasse(k.gewinn)),
      am(k.prognoseGewinn==null?null:pl(k.prognoseGewinn),'—',plusKlasse(k.prognoseGewinn)),differenz(k.selbstkosten,k.prognoseSelbstkosten,'Selbstkosten'))
  ];
  const bestaetigt=daten.einstellungen?.annahmen_bestaetigt;
  // Ein Satz, der erst nach dem letzten Stand gilt, bewertet die Stunden bis dahin nicht (Gari und die Buchhaltung,
  // 26.11.2026: die Urlaubstage geändert, das Ergebnis zum Gehalt blieb gleich). Hier steht, für wen und ab wann.
  const neuere=k.stand?[...new Set(bew.personen.filter(x=>x.person_id&&x.stunden).map(x=>x.person_id))]
    .map(id=>({id,s:K.gehaltAm(daten.saetze,id,'9999-12-31')})).filter(x=>x.s&&String(x.s.gueltig_ab)>String(k.stand)):[];
  const neuereText=neuere.length?'<p class="meta ct-neuere-saetze" data-neuere-saetze>Erst für Stunden nach dem letzten Stand ('+esc(datum(k.stand))+') gilt der neue Eintrag von '+
    neuere.map(x=>esc(person(x.id)||'Person')+' ab '+esc(datum(x.s.gueltig_ab))).join(', ')+'. Galt die Angabe schon vorher (etwa der Urlaub laut Vertrag), '+
    'unter <a href="./controlling.html?ansicht=saetze">Sätze und Gehälter</a> den bisherigen Eintrag korrigieren.</p>':'';
  return '<div class="ct-vertraulich'+(offen?' offen':'')+'" data-vertraulich><div class="ct-vertraulich-kopf"><h3 class="pb-h3">Zum Gehalt <span class="ct-nur-admin">vertraulich</span></h3>'+
    '<button type="button" class="ct-info" data-so-gerechnet aria-expanded="'+offen+'" aria-controls="ctVertraulichTabelle"><span aria-hidden="true">i</span>So gerechnet</button></div>'+
    '<div class="ct-vertraulich-tabelle" id="ctVertraulichTabelle"><table><thead><tr><th><span class="sr">Kennzahl</span></th><th class="num">bis jetzt</th><th class="num">am Ende</th><th class="ct-so">So gerechnet</th></tr></thead>'+
    '<tbody>'+zeilen.join('')+'</tbody></table></div>'+
    '<p class="meta ct-so-hinweis">Gerechnet beim Öffnen der Seite aus den Stunden, Sätzen und Annahmen von jetzt; nach jeder Änderung neu, auch wenn sie in einem anderen Fenster '+
    'gemacht wurde. Gespeichert wird nur, was eingetragen ist.</p>'+neuereText+
    '<p class="meta ct-annahmen-hinweis" data-annahmen-hinweis>Annahmen: '+esc(proz(a.ag))+' Arbeitgeberanteil, '+esc(zahl(a.jahresstunden))+' Jahresstunden bei '+
    esc(zahl(a.vollzeit,a.vollzeit%1?1:0))+' h in der Woche'+(a.faktor?', Gemeinkostenfaktor '+esc(zahl(a.faktor,2))+' auf das Bruttogehalt':', noch ohne Gemeinkostenfaktor')+'. '+
    (bestaetigt?'Bestätigt am '+esc(datum(bestaetigt))+'. ':'<strong>Noch nicht bestätigt.</strong> ')+
    '<a href="./controlling.html?ansicht=saetze#annahmen">Annahmen und offene Fragen</a></p></div>';
}
function staendeTabelle(p,bew){
  const reihen=summenVon(p).reverse();
  const honorar=Number(p.honorar_netto)||0,abgeschlossen=p.status==='abgeschlossen';
  const personalkosten=s=>bew?bew.staende.find(x=>x.stand_id===s.stand_id)?.personalkosten??null:s.wert_gehalt??null;
  const kopf='<tr><th>Stichtag</th><th class="num">Leistungsstand</th><th class="num">Stunden</th><th class="num">Wert netto<span class="ct-einheit">zum Kalkulationssatz</span></th>'+
    '<th class="num">Erarbeitet netto</th><th class="num">Gegenüber Kalkulation netto</th>'+(voll?'<th class="num">Personalkosten<span class="ct-einheit">zum Gehalt</span></th><th></th>':'')+'</tr>';
  const body=reihen.map((s,i)=>{
    const ls=abgeschlossen&&i===0?100:s.leistungsstand;
    const erarbeitet=ls!=null?honorar*Number(ls)/100:null,ergebnis=erarbeitet!=null?erarbeitet-Number(s.wert_kalkulation||0):null;
    const notiz=standZeile(s.stand_id)?.notiz;
    const je=voll?stundenVon(s.stand_id).map(h=>wer(h)+' '+std(Number(h.stunden))).join(' · '):'';
    return '<tr><td>'+esc(datum(s.stichtag))+(notiz?'<span class="ct-personen">'+esc(notiz)+'</span>':'')+(je?'<span class="ct-personen" data-je-person>'+esc(je)+'</span>':'')+'</td>'+
      '<td class="num">'+esc(proz(ls))+'</td><td class="num">'+esc(std(Number(s.stunden)))+'</td><td class="num">'+esc(euro(s.wert_kalkulation))+'</td>'+
      '<td class="num">'+esc(euro(erarbeitet))+'</td><td class="num'+plusKlasse(ergebnis)+'">'+esc(plus(ergebnis))+'</td>'+
      (voll?'<td class="num">'+esc(personalkosten(s)==null?'—':euro(personalkosten(s)))+'</td><td><button type="button" class="btn btn-quiet" data-stand="'+esc(s.stand_id)+'">Bearbeiten</button></td>':'')+'</tr>';
  }).join('');
  return '<section class="card pb-box" role="tabpanel" aria-label="Stände und Stunden"><div class="pb-box-kopf"><h2 class="pb-h2">Stände und Stunden</h2>'+
    (voll?'<button type="button" class="btn btn-primary" data-stand-neu>Neuer Stand</button>':'')+'</div>'+
    '<p class="meta">Je Stand die Stunden seit Beginn des Pakets bis zum Stichtag und der geschätzte Leistungsstand. '+
    (voll?'Stunden je Person und der Wert zum Gehalt sind vertraulich: sichtbar nur mit vollem Zugang zum Controlling.':'Die Aufteilung auf Personen ist vertraulich.')+'</p>'+
    (reihen.length?'<div class="pb-tabelle ct-tabelle"><table><thead>'+kopf+'</thead><tbody>'+body+'</tbody></table></div>'
      :'<p class="meta">Noch kein Stand erfasst.</p>')+'</section>';
}
// Spalten in der Reihenfolge der Rechnung des Büros (Gari und die Buchhaltung, 25.11.2026): Abschlag (AZ), zzgl.
// Nebenkosten, Netto inkl. Nebenkosten, MwSt, Brutto.
function zahlungsRechnung(p){
  const liste=zahlungenVon(p),nk=Number(p.nebenkosten_prozent)||0;
  const teile=z=>{const r=K.rechnung({netto:Number(z.netto)||0},nk);r.mwst=K.r2(Number(z.mwst)||0);r.brutto=K.r2(r.netto+r.mwst);return r};
  return {liste,nk,teile,summe:f=>K.r2(liste.reduce((s,z)=>s+teile(z)[f],0))};
}
function zahlungenTabelle(p,k){
  const {liste,nk,teile,summe}=zahlungsRechnung(p);
  const kopf='<tr><th>Datum</th><th>Bezeichnung</th><th class="num">Abschlag (AZ)<span class="ct-einheit">Honorar netto</span></th>'+
    '<th class="num">zzgl. '+esc(proz(nk))+' Nebenkosten</th><th class="num">Netto<span class="ct-einheit">inkl. Nebenkosten</span></th>'+
    '<th class="num">MwSt</th><th class="num">Brutto</th><th>Status</th>'+(voll?'<th></th>':'')+'</tr>';
  const body=liste.map(z=>{
    const r=teile(z);
    return '<tr><td>'+esc(datum(z.datum)||'offen')+'</td><td>'+esc(z.bezeichnung||'')+(z.notiz?'<span class="ct-personen">'+esc(z.notiz)+'</span>':'')+'</td>'+
      '<td class="num">'+esc(euro(r.abschlag,2))+'</td><td class="num">'+esc(euro(r.nebenkosten,2))+'</td><td class="num">'+esc(euro(r.netto,2))+'</td>'+
      '<td class="num">'+esc(euro(r.mwst,2))+'</td><td class="num">'+esc(euro(r.brutto,2))+'</td>'+
      '<td><span class="chip'+(z.status==='bezahlt'?' chip-ok':' chip-att')+'">'+esc(z.status)+'</span>'+(z.vorlaeufig?' <span class="chip chip-att">vorläufig</span>':'')+'</td>'+
      (voll?'<td><button type="button" class="btn btn-quiet" data-zahlung="'+esc(z.id)+'">Bearbeiten</button></td>':'')+'</tr>';
  }).join('');
  const fuss=liste.length?'<tfoot><tr><td colspan="2">Summe</td>'+['abschlag','nebenkosten','netto','mwst','brutto'].map(f=>'<td class="num">'+esc(euro(summe(f),2))+'</td>').join('')+
    '<td></td>'+(voll?'<td></td>':'')+'</tr></tfoot>':'';
  return '<section class="card pb-box" role="tabpanel" aria-label="Zahlungen"><div class="pb-box-kopf"><h2 class="pb-h2">Zahlungen</h2>'+
    '<div class="ct-knoepfe">'+(liste.length?'<button type="button" class="btn" data-pdf-zahlungen>Als PDF</button>':'')+
    (voll?'<button type="button" class="btn btn-primary" data-zahlung-neu>Zahlung erfassen</button>':'')+'</div></div>'+
    '<p class="meta">Wie auf der Rechnung: Abschlag (Honorar netto) zzgl. '+esc(proz(nk))+' Nebenkosten = Netto, zzgl. MwSt = Brutto. '+
    'Als bezahlt zählt das Controlling nur den Abschlag, ohne Nebenkosten und MwSt: bisher '+esc(euro(k.bezahlt))+' netto'+
    (k.gestellt?', gestellt und noch offen '+esc(euro(k.gestellt))+' netto':'')+'.</p>'+
    (liste.length?'<div class="pb-tabelle ct-tabelle"><table><thead>'+kopf+'</thead><tbody>'+body+'</tbody>'+fuss+'</table></div>'
      :'<p class="meta">Noch keine Zahlung erfasst.</p>')+'</section>';
}

// ---------- Sätze und Gehälter (vertraulich) ----------
function renderSaetze(){
  const e=daten.einstellungen||{},a=K.annahmen(e);
  const aktive=daten.personen.filter(x=>x.is_active!==false).sort((x,y)=>String(x.display_name||'').localeCompare(String(y.display_name||''),'de'));
  const reihen=aktive.map(x=>{
    const eigene=daten.saetze.filter(s=>s.person_id===x.user_id).sort((u,v)=>String(v.gueltig_ab).localeCompare(String(u.gueltig_ab)));
    const k=K.satzAm(daten.saetze,x.user_id,heute(),'kalkulationssatz'),g=K.gehaltAm(daten.saetze,x.user_id,heute());
    const gs=g?K.gehaltSatz(g.monatsgehalt,e,g.wochenstunden,g):null,ss=g?K.selbstkostenSatz(g.monatsgehalt,e,g.wochenstunden,g):null;
    const jahr=g?K.jahresstundenPerson(g.wochenstunden,e,g):null;
    const ab=eigene.find(s=>s.gueltig_ab<=heute())?.gueltig_ab;
    return '<tr><td>'+esc(x.display_name||'—')+(eigene.length>1?'<span class="ct-personen">'+eigene.length+' Einträge</span>':'')+'</td>'+
      '<td class="num">'+(k==null?'<span class="meta">Satz des Pakets</span>':esc(euro(k,k%1?2:0))+'/h')+'</td>'+
      '<td class="num">'+(g?esc(euro(g.monatsgehalt)):'—')+'</td><td class="num">'+(g?(g.wochenstunden!=null?esc(std(Number(g.wochenstunden))):'Vollzeit'):'—')+'</td>'+
      '<td class="num">'+(g?urlaubText(g):'—')+'</td><td class="num">'+(jahr==null?'—':esc(std(Math.round(jahr))))+'</td>'+
      '<td class="num">'+(gs==null?'—':esc(euro(gs,2))+'/h')+'</td><td class="num">'+(ss==null?'—':esc(euro(ss,2))+'/h')+'</td>'+
      '<td>'+esc(ab?datum(ab):'—')+'</td><td><button type="button" class="btn btn-quiet" data-person="'+esc(x.user_id)+'">Sätze</button></td></tr>';
  }).join('');
  root.innerHTML='<div class="pb-wrap"><a class="pb-back" href="./controlling.html">‹ Controlling</a>'+
    '<header class="pb-head"><div class="pb-head-text"><p class="kicker">Controlling · vertraulich</p><h1>Sätze und Gehälter</h1>'+
    '<p class="pb-intro">Der Kalkulationssatz bewertet die Stunden einer Person; ohne eigenen Satz gilt der des Pakets. Aus dem Monatsgehalt rechnet das '+
    'Controlling zwei Sätze je Stunde: den Stundensatz aus dem Gehalt (Personalkosten) und den Selbstkostensatz (mit den Kosten des Büros); wie, steht unter '+
    '«Annahmen». Ein neuer Eintrag gilt ab seinem Datum und bewertet frühere Stunden nicht neu; eine Korrektur ändert den bestehenden Eintrag '+
    'und damit auch die Stunden, die er bewertet.</p></div></header>'+
    '<p class="pb-banner info" data-meldung hidden></p>'+
    '<section class="card pb-box"><h2 class="pb-h2">Personen</h2><div class="pb-tabelle ct-tabelle"><table><thead><tr><th>Person</th><th class="num">Kalkulationssatz</th>'+
    '<th class="num">Monatsgehalt<span class="ct-einheit">brutto</span></th><th class="num">Wochenstunden</th>'+
    '<th class="num">Urlaub<span class="ct-einheit">Tage im Jahr</span></th><th class="num">Jahresstunden<span class="ct-einheit">der Person</span></th>'+
    '<th class="num">Stundensatz aus Gehalt<span class="ct-einheit">Personalkosten</span></th><th class="num">Selbstkostensatz<span class="ct-einheit">'+
    esc(a.faktor?'Bruttogehalt × '+zahl(a.faktor,2):'ohne Gemeinkostenfaktor')+'</span></th><th>gültig ab</th><th></th></tr></thead><tbody>'+reihen+'</tbody></table></div>'+
    urlaubHinweis(e,a,aktive)+'</section>'+
    annahmenBox(e,a)+fragenBox(a)+
    (istAdmin&&voll?zugangBox(aktive):'')+'</div>';
  root.querySelectorAll('[data-person]').forEach(b=>b.addEventListener('click',()=>satzFormular(b.dataset.person)));
  bindeZugang();
  const form=root.querySelector('[data-einstellungen]');
  const beispiel=()=>{root.querySelector('[data-beispiel]').textContent=beispielText({arbeitgeberanteil_prozent:K.leseZahl(form.ag.value),
    jahresstunden:K.leseZahl(form.h.value),vollzeit_wochenstunden:K.leseZahl(form.vollzeit.value),gemeinkostenfaktor:K.leseZahl(form.faktor.value)})};
  form.addEventListener('input',()=>{beispiel();herleitungZeigen(form)});
  form.jahr.addEventListener('change',()=>herleitungZeigen(form));
  herleitungZeigen(form);
  root.querySelector('[data-herleitung-uebernehmen]').addEventListener('click',ev=>{
    const w=ev.currentTarget.dataset.wert;if(!w)return;
    form.h.value=eingabe(Number(w));beispiel();herleitungZeigen(form);
    meldung('Übernommen: '+zahl(Number(w))+' Jahresstunden. Mit «Speichern» festhalten.');
  });
  form.addEventListener('submit',async ev=>{
    ev.preventDefault();
    const ag=K.leseZahl(form.ag.value),h=K.leseZahl(form.h.value),vz=K.leseZahl(form.vollzeit.value);
    const faktorText=form.faktor.value.trim(),faktor=faktorText?K.leseZahl(faktorText):null;
    const tage=name=>{const t=form[name].value.trim();return t?K.leseZahl(t):null};
    const urlaub=tage('urlaub'),krank=tage('krank'),weitere=tage('weitere'),anteil=tage('anteil');
    if(ag==null||ag<0||ag>100||h==null||h<100||h>4000){meldung('Arbeitgeberanteil 0–100 %, Jahresstunden 100–4.000.','warn');return}
    if(vz==null||vz<=0||vz>80){meldung('Wochenstunden der Vollzeit über 0 und höchstens 80.','warn');return}
    if(faktorText&&(faktor==null||faktor<1||faktor>5)){meldung('Gemeinkostenfaktor zwischen 1 und 5, etwa 2,1; leer: keine Selbstkosten.','warn');return}
    const falsch=[['urlaub',urlaub,60],['krank',krank,100],['weitere',weitere,100]].find(([n,w,max])=>form[n].value.trim()&&(w==null||w<0||w>max));
    if(falsch){meldung('Tage als Zahl: Urlaub 0–60, Krankheit und weitere Tage 0–100.','warn');return}
    if(form.anteil.value.trim()&&(anteil==null||anteil<=0||anteil>100)){meldung('Projektanteil in Prozent, über 0 und höchstens 100.','warn');return}
    const {error}=await sb.from('office_controlling_einstellungen').update({arbeitgeberanteil_prozent:ag,jahresstunden:h,vollzeit_wochenstunden:vz,
      gemeinkostenfaktor:faktor,annahmen_bestaetigt:form.bestaetigt.value||null,annahmen_notiz:form.notiz.value.trim()||null,
      urlaubstage:urlaub,krankheitstage:krank,weitere_tage:weitere,projektanteil_prozent:anteil}).eq('id',true);
    if(error){meldung('Nicht gespeichert: '+error.message,'warn');return}
    await neuLaden('Gespeichert.');
  });
}
// Urlaub je Person (Gari, 25.11.2026: nicht alle haben gleich viele Urlaubstage). Leer heißt: wie das Büro, in Teilzeit
// anteilig. Eigene Tage zählen in den eigenen Arbeitstagen.
function urlaubText(g){
  if(g.urlaubstage==null)return '<span class="meta">wie das Büro</span>';
  const t=Number(g.urlaubstage),d=g.arbeitstage_woche!=null?Number(g.arbeitstage_woche):null;
  return esc(zahl(t,t%1?1:0)+' Tage')+(d&&d!==5?'<span class="ct-personen">bei '+esc(zahl(d,d%1?1:0))+' Tagen je Woche</span>':'');
}
function urlaubHinweis(e,a,aktive){
  const mitEigenem=aktive.some(x=>K.gehaltAm(daten.saetze,x.user_id,heute())?.urlaubstage!=null);
  const text=a.urlaub==null
    ?(mitEigenem?'Eigene Urlaubstage zählen erst, wenn unter «Annahmen» die Urlaubstage des Büros eingetragen sind (Herleitung der Jahresstunden); bis dahin gilt für alle der Urlaub des Büros, in Teilzeit anteilig.':'')
    :'Jahresstunden der Person: '+zahl(a.jahresstunden)+' h × Wochenstunden ÷ '+zahl(a.vollzeit,a.vollzeit%1?1:0)+'; wer mehr oder weniger Urlaub hat als das Büro ('+
      zahl(a.urlaub,a.urlaub%1?1:0)+' Tage bei 5 Tagen, in Teilzeit anteilig), bekommt den Unterschied abgezogen oder dazu.';
  return text?'<p class="meta" data-urlaub-hinweis>'+esc(text)+'</p>':'';
}
// Ein Gehalt zum Anfassen: was die Annahmen aus 4.000 € brutto in Vollzeit machen.
function beispielText(e){
  const a=K.annahmen(e),g=K.gehaltSatz(4000,e),s=K.selbstkostenSatz(4000,e);
  if(g==null)return '';
  return 'Beispiel: 4.000 € brutto bei '+zahl(a.vollzeit,a.vollzeit%1?1:0)+' h in der Woche → '+euro(g,2)+'/h Personalkosten'+
    (s!=null?', '+euro(s,2)+'/h Selbstkosten':'')+'. Halbe Stelle mit halbem Gehalt: dieselben Sätze.';
}
// Gari (25.11.2026): eine Erklärung zu jeder Annahme, damit klar ist, was sie bewirkt und was zu fragen ist.
function annahmenBox(e,a){
  const feld=(name,titel,wert,hilfe,extra='')=>'<div class="ct-feld"><label for="an-'+name+'">'+esc(titel)+'</label>'+
    '<input id="an-'+name+'" name="'+name+'" class="pb-input" '+extra+' value="'+esc(wert)+'" aria-describedby="an-'+name+'-hilfe">'+
    '<p class="ct-feld-hilfe" id="an-'+name+'-hilfe">'+hilfe+'</p></div>';
  return '<section class="card pb-box" id="annahmen" data-annahmen><h2 class="pb-h2">Annahmen für den Stundensatz aus dem Gehalt</h2>'+
    '<p class="ct-erklaerung">Aus dem Monatsgehalt brutto einer Person rechnet das Controlling zwei Sätze je Stunde. Der <strong>Stundensatz aus dem Gehalt</strong> '+
    '(Personalkosten) ist Bruttogehalt × 12 × (1 + Arbeitgeberanteil) ÷ Jahresstunden der Person. Der <strong>Selbstkostensatz</strong> ist Bruttogehalt × 12 × '+
    'Gemeinkostenfaktor ÷ Jahresstunden der Person: was eine Stunde das Büro mit allem kostet. Die Jahresstunden der Person sind die einer Vollzeitkraft, '+
    'anteilig nach ihren Wochenstunden. Daraus folgen im Projektblatt das Ergebnis nach Gehältern und der Gewinn nach Bürokosten.</p>'+
    '<p class="ct-vorschau" data-beispiel>'+esc(beispielText(e))+'</p>'+
    '<form class="ct-annahmen" data-einstellungen>'+
    feld('ag','Arbeitgeberanteil (%)',eingabe(a.ag),'Was das Büro über das Bruttogehalt hinaus zahlt: Renten-, Kranken-, Pflege- und Arbeitslosenversicherung '+
      '(2026 rund 21 %), dazu Umlagen und Berufsgenossenschaft. Zählt nur für die Personalkosten, nicht für die Selbstkosten.','inputmode="decimal" required')+
    feld('h','Jahresstunden Vollzeit (produktiv)',eingabe(a.jahresstunden),'Stunden, die eine Vollzeitkraft im Jahr für Projekte arbeitet: 52 Wochen × '+
      esc(zahl(a.vollzeit,a.vollzeit%1?1:0))+' h = '+esc(zahl(52*a.vollzeit))+' h bezahlt, abzüglich Urlaub, Feiertage, Krankheit, Fortbildung und Büroarbeit ohne Projekt.','inputmode="decimal" required')+
    feld('vollzeit','Wochenstunden Vollzeit',eingabe(a.vollzeit),'Bezug für Teilzeit: wer 20 von 40 Stunden arbeitet, hat die Hälfte der Jahresstunden. '+
      'Die Wochenstunden je Person stehen bei ihren Sätzen; ohne Angabe gilt Vollzeit.','inputmode="decimal" required')+
    feld('faktor','Gemeinkostenfaktor auf das Bruttogehalt',eingabe(a.faktor),'Alle Kosten des Büros im Jahr ÷ Summe der Bruttogehälter. Er deckt neben dem Gehalt, '+
      'was keinem Projekt direkt gehört: Miete, Software, Geräte, Versicherungen, Verwaltung, Akquise, Zeit ohne Projekt und, so gerechnet, den Arbeitgeberanteil. '+
      'Leer: keine Selbstkosten.','inputmode="decimal" placeholder="leer: keine Selbstkosten"')+
    herleitungBox(e,a)+
    feld('bestaetigt','Bestätigt am',e.annahmen_bestaetigt||'','Leer lassen, bis die Fragen unten geklärt sind; bis dahin gilt der Gewinn als vorläufig.','type="date"')+
    '<div class="ct-feld breit"><label for="an-notiz">Notiz zu den Annahmen</label><textarea id="an-notiz" name="notiz" class="pb-input" maxlength="2000" rows="3" '+
    'placeholder="Woher die Werte stammen, wer sie bestätigt hat">'+esc(e.annahmen_notiz||'')+'</textarea></div>'+
    '<div class="pb-actions breit"><button class="btn btn-primary">Speichern</button></div></form></section>';
}
// Jahresstunden aus dem Kalender (Gari, 25.11.2026: zählen die 1.600 h die Feiertage 2026?). Die 1.600 h sind eine
// Annahme; hier lassen sie sich herleiten: Werktage des Jahres minus Feiertage am Sitz des Büros (Augsburg) minus Urlaub,
// Krankheit und weitere Tage, mal Wochenstunden ÷ 5, mal Projektanteil. «Übernehmen» setzt das Ergebnis als Jahresstunden,
// «Speichern» hält alles fest. Urlaub je Person braucht es nicht, solange er in Teilzeit anteilig ist: das decken die
// Wochenstunden ab.
function herleitungJahr(){const j=new Date().getFullYear();return [j-1,j,j+1]}
function herleitungBox(e,a){
  const j=new Date().getFullYear(),wert=x=>x==null?'':eingabe(x);
  const feld=(name,titel,w,platz,hilfe)=>'<label class="ct-herleitung-feld">'+esc(titel)+'<input name="'+name+'" class="pb-input" inputmode="decimal" value="'+esc(w)+'" placeholder="'+esc(platz)+'">'+
    (hilfe?'<span class="ct-feld-hilfe">'+esc(hilfe)+'</span>':'')+'</label>';
  const kal=K.jahresstundenAusKalender({jahr:j});
  return '<details class="ct-herleitung breit" data-herleitung><summary>Jahresstunden aus dem Kalender herleiten · '+esc(String(j))+' in Augsburg: '+
    esc(zahl(kal.werktage))+' Werktage − '+esc(zahl(kal.feiertage))+' Feiertage = '+esc(zahl(kal.arbeitstage))+' Arbeitstage</summary>'+
    '<div class="ct-herleitung-inhalt"><label class="ct-herleitung-feld">Jahr<select name="jahr" class="pb-input">'+herleitungJahr().map(x=>'<option'+(x===j?' selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
    '<p class="ct-feld-hilfe ct-herleitung-kalender" data-kalender></p>'+
    feld('urlaub','Urlaubstage des Büros (Vollzeit)',wert(e.urlaubstage),'z. B. 30','Bezug für alle: in Teilzeit anteilig; wer mehr oder weniger hat, trägt es bei seinen Sätzen ein.')+
    feld('krank','Krankheitstage (Annahme)',wert(e.krankheitstage),'z. B. 15','Im Schnitt 2025: 14,6 Arbeitstage je Beschäftigten (Destatis).')+
    feld('weitere','Weitere Tage ohne Projekt',wert(e.weitere_tage),'z. B. 3','Fortbildung, Betriebsausflug, Heiligabend, Silvester.')+
    feld('anteil','Projektanteil der Arbeitszeit (%)',wert(e.projektanteil_prozent),'leer: 100','Ohne Akquise, Büroorganisation und interne Termine.')+
    '<div class="ct-herleitung-ergebnis"><p data-herleitung-ergebnis></p><button type="button" class="btn" data-herleitung-uebernehmen>In Jahresstunden übernehmen</button></div></div></details>';
}
function herleitungZeigen(form){
  const jahr=Number(form.jahr.value),fehlt=!form.urlaub.value.trim();
  const zahlOder=(x)=>x.trim()?K.leseZahl(x):null;
  const vz=K.leseZahl(form.vollzeit.value)||40;
  const r=K.jahresstundenAusKalender({jahr,urlaubstage:zahlOder(form.urlaub.value),krankheitstage:zahlOder(form.krank.value),
    weitereTage:zahlOder(form.weitere.value),projektanteil:zahlOder(form.anteil.value),wochenstunden:vz});
  const ft=K.feiertage(jahr),kurz=x=>x.datum.slice(8,10)+'.'+x.datum.slice(5,7)+'.';
  root.querySelector('[data-kalender]').textContent=jahr+': '+zahl(r.werktage)+' Werktage (Mo–Fr), davon '+zahl(r.feiertage)+' Feiertage in Augsburg: '+
    ft.filter(x=>x.werktag).map(x=>x.name+' '+kurz(x)).join(', ')+'; am Wochenende: '+(ft.filter(x=>!x.werktag).map(x=>x.name).join(', ')||'keiner')+'.';
  const knopf=root.querySelector('[data-herleitung-uebernehmen]'),aus=root.querySelector('[data-herleitung-ergebnis]');
  knopf.disabled=fehlt;knopf.dataset.wert=fehlt?'':String(r.jahresstunden);
  if(fehlt){aus.textContent='Urlaubstage eintragen, dann steht hier das Ergebnis.';return}
  const tage=x=>zahl(x,x%1?1:0),h=K.leseZahl(form.h.value);
  aus.textContent='('+zahl(r.arbeitstage)+' Arbeitstage − '+tage(K.leseZahl(form.urlaub.value)||0)+' Urlaub − '+tage(zahlOder(form.krank.value)||0)+' Krankheit − '+
    tage(zahlOder(form.weitere.value)||0)+' weitere) = '+tage(r.tage)+' Tage × '+zahl(r.stundenJeTag,r.stundenJeTag%1?1:0)+' h × '+proz(r.projektanteil)+' = '+
    zahl(r.jahresstunden)+' h'+(h&&Math.abs(h-r.jahresstunden)>=1?' (eingetragen: '+zahl(h)+' h)':'');
}

// Was vor dem Gespräch mit der Büroleitung offen ist (Gari, 25.11.2026): je Frage, warum sie zählt und was jetzt gilt.
// Am 26.11.2026 mit der Buchhaltung geklärt und deshalb gestrichen (Gari): der Faktor gilt auf das Bruttogehalt allein;
// 21 % Arbeitgeberanteil vorerst für alle; die Jahresstunden sind hergeleitet; Wochen- und Urlaubstage stehen je Person;
// Sonderzahlungen (13. Gehalt, Urlaubsgeld, Boni, Jobticket) gibt es keine. Offen für die Büroleitung bleiben drei Fragen.
function fragenBox(a){
  const f=a.faktor?zahl(a.faktor,2):null;
  const deckung=K.deckungBisGehalt(85,{arbeitgeberanteil_prozent:a.ag,jahresstunden:a.jahresstunden,vollzeit_wochenstunden:a.vollzeit,gemeinkostenfaktor:a.faktor});
  const fragen=[
    ['faktor-inhalt','Was deckt der Faktor ab: nur die Bürokosten oder auch Unternehmerlohn und Gewinn?',
      'Steckt schon ein Gewinnaufschlag darin, zeigt «Gewinn nach Bürokosten» nur, was über dem geplanten Gewinn bleibt.',
      'nur Bürokosten; Gewinn ist, was danach vom Honorar bleibt.'],
    ['faktor-herkunft','Woher stammt der Faktor und für welches Jahr: aus der Buchhaltung (alle Kosten ÷ Bruttogehälter) oder als Erfahrungswert? Gilt er auch für Teilzeit und Werkstudenten?',
      'Der Faktor ändert sich mit Miete, Software und der Zahl der Köpfe; aus einem abgeschlossenen Jahr gerechnet ist er belastbar.',
      f?f+' für alle Personen.':'noch kein Faktor eingetragen.'],
    ['kalkulationssatz','Was deckt der Kalkulationssatz von 85 €/h: die Selbstkosten und einen Gewinn? Mit welchem Gehalt und welchem Faktor wurde er gerechnet?',
      deckung?'Mit diesen Annahmen deckt 85 €/h die Selbstkosten bis zu einem Bruttogehalt von rund '+euro(deckung)+' im Monat (Vollzeit); wer mehr verdient, kostet je Stunde mehr, als kalkuliert ist.'
        :'Ohne Gemeinkostenfaktor lässt sich das nicht prüfen.','85 €/h je Paket, je Person änderbar.']
  ];
  return '<section class="card pb-box" data-zu-klaeren><h2 class="pb-h2">Zu klären</h2>'+
    '<p class="meta">Fragen für das Gespräch mit der Büroleitung, je Frage, warum sie zählt und was jetzt angenommen ist. Danach die Werte oben anpassen und «Bestätigt am» setzen.</p>'+
    '<ol class="ct-fragen">'+fragen.map(([key,frage,warum,jetzt])=>'<li data-frage="'+key+'"><strong>'+esc(frage)+'</strong>'+
      '<span><em>Warum:</em> '+esc(warum)+'</span><span><em>Jetzt angenommen:</em> '+esc(jetzt)+'</span></li>').join('')+'</ol></section>';
}

// Voller Zugang zum Controlling: nur wer auf der Liste steht (Gari, 25.11.2026: er, die Buchhaltung und später der Chef),
// auch Admins nicht von selbst. Vergeben und entziehen: wer auf der Liste steht und Admin ist; sich selbst nicht.
function zugangBox(aktive){
  const mit=new Set(daten.zugang.map(z=>z.user_id));
  const drauf=aktive.filter(x=>mit.has(x.user_id)),ohne=aktive.filter(x=>!mit.has(x.user_id));
  return '<section class="card pb-box" data-zugang><h2 class="pb-h2">Voller Zugang zum Controlling</h2>'+
    '<p class="meta">Nur wer hier steht, sieht Sätze, Gehälter und die Stunden je Person aller Projekte und trägt im Controlling ein. Admin zu sein reicht dafür nicht.</p>'+
    '<ul class="ct-zugang">'+drauf.map(x=>'<li><span>'+esc(x.display_name||'—')+(x.role==='admin'?' <span class="meta">Admin</span>':'')+'</span>'+
      (x.user_id===nutzer.id?'<span class="meta">du</span>':'<button type="button" class="btn btn-quiet btn-danger" data-zugang-weg="'+esc(x.user_id)+'">Entfernen</button>')+'</li>').join('')+'</ul>'+
    (ohne.length?'<div class="pb-dok-neu"><select class="pb-input" data-zugang-person aria-label="Person">'+ohne.map(x=>'<option value="'+esc(x.user_id)+'">'+esc(x.display_name||'—')+'</option>').join('')+'</select>'+
      '<button type="button" class="btn" data-zugang-geben>Zugang geben</button></div>':'')+'</section>';
}
function bindeZugang(){
  root.querySelector('[data-zugang-geben]')?.addEventListener('click',async()=>{
    const id=root.querySelector('[data-zugang-person]')?.value;if(!id)return;
    const {error}=await sb.from('office_controlling_zugang').insert({user_id:id,created_by:nutzer.id});
    if(error){meldung('Nicht gespeichert: '+error.message,'warn');return}
    await neuLaden(person(id)+' hat jetzt vollen Zugang zum Controlling.');
  });
  root.querySelectorAll('[data-zugang-weg]').forEach(b=>b.addEventListener('click',async()=>{
    if(b.dataset.sicher!=='1'){b.dataset.sicher='1';b.textContent='Wirklich entfernen?';return}
    const {error}=await sb.from('office_controlling_zugang').delete().eq('user_id',b.dataset.zugangWeg);
    if(error){meldung('Nicht entfernt: '+error.message,'warn');return}
    await neuLaden('Zugang entfernt.');
  }));
}

// «So wird gerechnet» (Gari und die Buchhaltung, 25.11.2026: woher kommen die Zahlen?): jeder Wert mit seiner Herkunft,
// im Projektblatt mit den Zahlen des Pakets eingesetzt. Dieselben Formeln wie controlling-kern.js.
function rechenweg(p){
  const k=p?kz(p):null,e=(x,d=0)=>esc(euro(x,d)),h=x=>esc(std(x)),pr=x=>esc(proz(x));
  const satz=k?e(k.satz,k.satz%1?2:0)+'/h':'';
  const einheitlich=k&&k.stunden>0&&Math.abs(k.wert-k.stunden*k.satz)<0.01;
  const z=(titel,text,wert)=>'<li><strong>'+esc(titel)+'</strong><span>'+esc(text)+'</span>'+(wert?'<span class="ct-rw-wert">'+wert+'</span>':'')+'</li>';
  const zeilen=[
    z('Honorar netto','Laut Vertrag, ohne Nebenkosten und MwSt; eingetragen im Paket.',k?e(k.honorar):''),
    z('Stundenbudget','Honorar ÷ Kalkulationssatz. Der Kalkulationssatz ist der Preis, mit dem das Büro eine Stunde plant (85 €/h, je Person änderbar), kein Gehalt.',
      k?e(k.honorar)+' ÷ '+satz+' = '+h(k.budget):''),
    z('Stunden','Aus dem letzten Stand: die Stunden seit Beginn des Pakets bis zum Stichtag, je Person oder als Team (Reiter «Stände und Stunden»).',
      k&&k.stand?h(k.stunden)+' am '+esc(datum(k.stand)):''),
    z('Wert der Stunden netto','Stunden × Kalkulationssatz; wer einen eigenen Satz hat, mit seinem. Neue Stunden zählen zum Satz, der am Stichtag gilt.',
      k&&k.stand?(einheitlich?h(k.stunden)+' × '+satz+' = '+e(k.wert):'Summe je Person = '+e(k.wert)):''),
    z('Leistungsstand','Geschätzt von der Projektleitung im Stand: wie viel der beauftragten Leistung fertig ist. Abgeschlossen zählt als 100 %.',
      k?(k.leistungsstand==null?'noch nicht geschätzt':pr(k.leistungsstand)):''),
    z('Erarbeitet netto','Honorar × Leistungsstand: was die Leistung bis jetzt wert ist, bezahlt oder nicht.',
      k&&k.erarbeitet!=null?e(k.honorar)+' × '+pr(k.leistungsstand)+' = '+e(k.erarbeitet):''),
    z('Gegenüber Kalkulation bisher netto','Erarbeitet − Wert der Stunden. Positiv: die Leistung ist mehr wert, als die Stunden zum Kalkulationssatz kosten.',
      k&&k.ergebnisBisher!=null?e(k.erarbeitet)+' − '+e(k.wert)+' = '+esc(plus(k.ergebnisBisher)):''),
    z('Prognose am Ende','Auf 100 % hochgerechnet, als ginge es im gleichen Takt weiter: Stunden ÷ Leistungsstand; gegenüber der Kalkulation = Honorar − Wert der Stunden ÷ Leistungsstand.',
      k&&k.prognoseErgebnis!=null?h(k.stunden)+' ÷ '+pr(k.leistungsstand)+' = '+h(k.prognoseStunden)+' · '+e(k.honorar)+' − '+e(k.wert)+' ÷ '+pr(k.leistungsstand)+' = '+esc(plus(k.prognoseErgebnis)):''),
    z('Honorar je Stunde netto','Erarbeitet ÷ Stunden: was eine Stunde bisher eingebracht hat, zum Vergleich mit dem Kalkulationssatz.',
      k&&k.jeStunde!=null?e(k.erarbeitet)+' ÷ '+h(k.stunden)+' = '+e(k.jeStunde,2)+'/h':''),
    z('Bezahlt netto','Summe der bezahlten Abschläge (AZ): nur das Honorar, ohne Nebenkosten und MwSt. Je Zahlung: Netto ÷ (1 + Nebenkosten).',
      k?(k.zahlungen?e(k.bezahlt):'keine Zahlungen erfasst'):''),
    z('Erarbeitet, nicht bezahlt netto','Erarbeitet − Bezahlt: was abgerechnet werden kann. Negativ heißt: im Voraus bezahlt.',
      k&&k.offen!=null&&k.zahlungen?e(k.erarbeitet)+' − '+e(k.bezahlt)+' = '+e(k.offen):''),
    z('Gewinn','Erarbeitetes Honorar − Selbstkosten (Bruttogehalt × Gemeinkostenfaktor), am Ende mit den Kosten ÷ Leistungsstand. Er weicht vom Vergleich mit '+
      'der Kalkulation ab, weil eine Stunde des Teams mehr oder weniger kostet als der Kalkulationssatz. Den Betrag sieht nur, wer vollen Zugang zum Controlling '+
      'hat; sonst steht da, ob er im Plus liegt (über 5 % des Honorars), knapp (zwischen −5 und +5 %) oder im Minus.',
      k?(voll?(gewinnWert(k)!=null?esc(plus(gewinnWert(k))):''):(k.gewinnStufe?esc(STUFE[k.gewinnStufe]):'')):''),
    z('Die Lage','Aus «Gegenüber Kalkulation am Ende», gemessen am Honorar: im Budget, solange es nicht ins Minus geht; leicht über Budget bis 10 % des Honorars '+
      'im Minus; deutlich über Budget darüber. Abgeschlossen zählt der Wert zum Abschluss. Ohne Leistungsstand bleibt die Lage offen.',
      k&&lageWert(k)?lageWert(k):''),
    z('Die Balken','Im Projektblatt Leistung, Stunden (vom Budget) und Bezahltes (vom Honorar) auf derselben Skala; der Strich ist der Leistungsstand: '+
      'die Stunden sollten links davon bleiben, das Bezahlte ihn erreichen. Die Stunden sind grün im Budget, orange leicht und rot deutlich darüber, '+
      'grau ohne Einschätzung. Auf den Karten der Übersicht: Stunden in denselben Farben, der Strich ist das Soll beim Leistungsstand; Honorar dunkel '+
      'bezahlt, hell erarbeitet.','')
  ];
  if(voll)zeilen.push(z('Zum Gehalt (vertraulich)','Personalkosten: je Person Stunden × Bruttogehalt × 12 × (1 + Arbeitgeberanteil) ÷ Jahresstunden der Person; '+
    'die Jahresstunden der Person sind die einer Vollzeitkraft × Wochenstunden ÷ Vollzeit-Wochenstunden. Selbstkosten: dasselbe mit dem Gemeinkostenfaktor '+
    'statt des Arbeitgeberanteils, auf das Bruttogehalt allein. Ergebnis nach Gehältern = Erarbeitet − Personalkosten; Gewinn nach Bürokosten = '+
    'Erarbeitet − Selbstkosten; am Ende jeweils mit den Kosten ÷ Leistungsstand. Leer, solange Stunden nur als Team erfasst sind oder ein Gehalt fehlt.',''));
  oeffneDialog('<form method="dialog" class="pb-form ct-rechenweg"><h2>So wird gerechnet</h2>'+
    '<p class="meta">'+(p?esc(p.bezeichnung)+' · ':'')+'alle Beträge netto, ohne MwSt'+(p?'':'; im Projektblatt mit den Zahlen des Pakets')+'.</p>'+
    '<ol class="ct-rw">'+zeilen.join('')+'</ol>'+
    '<div class="pb-actions"><button value="abbrechen" class="btn btn-primary">Schließen</button></div></form>');
}

function lageWert(k){
  const l=K.lage(k);
  if(l.stufe==='offen')return '';
  return esc(plus(l.ergebnis))+' = '+(l.anteil<0?'− ':'')+esc(prozentHonorar(l))+' des Honorars → '+esc(LAGE[l.stufe]);
}

// ---------- PDF ----------
// Wie Projektdokumente und Kostenberechnung (Gari, 25.11.2026: die Zahlungen als PDF; dazu ein Bericht je Paket und die
// Übersicht): eine Druckfassung, die nur im Druck erscheint, im Druckdialog «Als PDF sichern». Der Titel des Dokuments
// wird zum Dateinamen. Vertrauliches kommt nur hinein, wenn es mit vollem Zugang ausdrücklich gewählt ist.
function dateiname(pr,p,art){
  return [pr?.number,pr?.name,p?.bezeichnung,art,heute()].filter(Boolean).join(' – ').replace(/[\\/:*?"<>|]+/g,'-');
}
function drucken(titel,html,quer=false){
  let d=document.getElementById('ctDruck');
  if(!d){d=document.createElement('div');d.id='ctDruck';d.className='ct-druck';document.body.append(d)}
  d.innerHTML=html;
  const alt=document.title,seite=document.createElement('style');
  if(quer){seite.textContent='@page{size:A4 landscape}';document.head.append(seite)}
  document.title=titel;
  document.documentElement.classList.add('ct-drucken');
  window.addEventListener('afterprint',()=>{document.title=alt;seite.remove();document.documentElement.classList.remove('ct-drucken');d.innerHTML=''},{once:true});
  window.print();
}
function druckKopf(art,pr,p,vertraulich){
  return '<header class="ctd-kopf"><p class="ctd-marke">TBA Office · Controlling'+(vertraulich?' · <strong>vertraulich</strong>':'')+'</p>'+
    '<h1>'+esc(art)+'</h1>'+(pr?'<p class="ctd-projekt">'+esc(projektName(pr))+(p?' · '+esc(p.bezeichnung)+(p.leistung?' · '+esc(p.leistung):''):'')+'</p>':'')+
    '<p class="ctd-meta">Erstellt am '+esc(datum(heute()))+'. Beträge in Euro; netto heißt ohne MwSt, das Honorar ohne Nebenkosten.</p></header>';
}
const druckSumme=liste=>'<dl class="ctd-summen">'+liste.map(([a,b,klasse])=>'<div><dt>'+esc(a)+'</dt><dd'+(klasse?' class="'+klasse.trim()+'"':'')+'>'+esc(b)+'</dd></div>').join('')+'</dl>';
function druckZahlungen(p,k,mitSumme){
  const {liste,nk,teile,summe}=zahlungsRechnung(p);
  const tabelle=liste.length?'<table><thead><tr><th>Datum</th><th>Bezeichnung</th><th class="num">Abschlag (AZ)<br>Honorar netto</th><th class="num">zzgl. '+esc(proz(nk))+
    '<br>Nebenkosten</th><th class="num">Netto<br>inkl. Nebenkosten</th><th class="num">MwSt</th><th class="num">Brutto</th><th>Status</th></tr></thead><tbody>'+
    liste.map(z=>{const r=teile(z);return '<tr><td>'+esc(datum(z.datum)||'offen')+'</td><td>'+esc(z.bezeichnung||'')+(z.notiz?'<br><span class="ctd-klein">'+esc(z.notiz)+'</span>':'')+'</td>'+
      ['abschlag','nebenkosten','netto','mwst','brutto'].map(f=>'<td class="num">'+esc(euro(r[f],2))+'</td>').join('')+
      '<td>'+esc(z.status)+(z.vorlaeufig?', vorläufig':'')+'</td></tr>'}).join('')+'</tbody><tfoot><tr><td colspan="2">Summe</td>'+
    ['abschlag','nebenkosten','netto','mwst','brutto'].map(f=>'<td class="num">'+esc(euro(summe(f),2))+'</td>').join('')+'<td></td></tr></tfoot></table>'
    :'<p>Noch keine Zahlung erfasst.</p>';
  const summen=mitSumme?druckSumme([['Honorar netto laut Vertrag',euro(k.honorar,2)],
    ['Erarbeitet netto'+(k.leistungsstand!=null?' ('+proz(k.leistungsstand)+(k.stand?', Stand '+datum(k.stand):'')+')':''),k.erarbeitet==null?'—':euro(k.erarbeitet,2)],
    ['Bezahlt netto (Abschläge)',euro(k.bezahlt,2)],...(k.gestellt?[['Gestellt, noch offen, netto',euro(k.gestellt,2)]]:[]),
    ['Erarbeitet, nicht bezahlt netto',k.offen==null||!k.zahlungen?'—':euro(k.offen,2)]]):'';
  return '<section class="ctd-teil"><h2>Zahlungen</h2>'+tabelle+summen+
    '<p class="ctd-fuss">Wie auf der Rechnung: Abschlag zzgl. '+esc(proz(nk))+' Nebenkosten = Netto, zzgl. MwSt = Brutto. Als bezahlt zählt das Controlling den Abschlag '+
    'ohne Nebenkosten und MwSt.</p></section>';
}
function druckStaende(p,bew,vertraulich){
  const reihen=summenVon(p).reverse(),honorar=Number(p.honorar_netto)||0,abgeschlossen=p.status==='abgeschlossen';
  if(!reihen.length)return '<section class="ctd-teil"><h2>Stände und Stunden</h2><p>Noch kein Stand erfasst.</p></section>';
  return '<section class="ctd-teil"><h2>Stände und Stunden</h2><table><thead><tr><th>Stichtag</th><th class="num">Leistungsstand</th><th class="num">Stunden</th>'+
    '<th class="num">Wert netto<br>zum Kalkulationssatz</th><th class="num">Erarbeitet netto</th><th class="num">Gegenüber<br>Kalkulation netto</th>'+(vertraulich?'<th class="num">Personalkosten</th>':'')+
    '</tr></thead><tbody>'+reihen.map((s,i)=>{
      const ls=abgeschlossen&&i===0?100:s.leistungsstand,erarbeitet=ls!=null?honorar*Number(ls)/100:null,ergebnis=erarbeitet!=null?erarbeitet-Number(s.wert_kalkulation||0):null;
      const je=vertraulich?stundenVon(s.stand_id).map(h=>wer(h)+' '+std(Number(h.stunden))).join(' · '):'',pk=bew?.staende.find(x=>x.stand_id===s.stand_id)?.personalkosten;
      return '<tr><td>'+esc(datum(s.stichtag))+(je?'<br><span class="ctd-klein">'+esc(je)+'</span>':'')+'</td><td class="num">'+esc(proz(ls))+'</td><td class="num">'+esc(std(Number(s.stunden)))+'</td>'+
        '<td class="num">'+esc(euro(s.wert_kalkulation))+'</td><td class="num">'+esc(euro(erarbeitet))+'</td><td class="num'+plusKlasse(ergebnis)+'">'+esc(plus(ergebnis))+'</td>'+
        (vertraulich?'<td class="num">'+esc(pk==null?'—':euro(pk))+'</td>':'')+'</tr>';
    }).join('')+'</tbody></table></section>';
}
function druckBericht(pr,p,teile){
  const vertraulich=voll&&teile.vertraulich,bew=vertraulich?bewVon(p):null,k=mitStufe(p,K.kennzahlen(p,summenVon(p),zahlungenVon(p),bewVon(p)));
  return '<div class="ctd">'+druckKopf('Controlling-Bericht',pr,p,vertraulich)+
    (teile.lage?'<section class="ctd-teil"><h2>Lage und Kennzahlen</h2>'+lagePanel(k,vertraulich)+kennzahlGruppen(k)+(p.notiz?'<p class="ctd-fuss">'+esc(p.notiz)+'</p>':'')+'</section>':'')+
    (vertraulich&&bew?'<section class="ctd-teil">'+vertraulichBlock(k,bew,true)+'</section>':'')+
    (teile.staende?druckStaende(p,bew,vertraulich):'')+
    (teile.zahlungen?druckZahlungen(p,k,!teile.lage):'')+'</div>';
}
function berichtDialog(pr,p){
  const form=oeffneDialog('<form method="dialog" class="pb-form"><h2>Bericht als PDF</h2><p class="meta">'+esc(projektName(pr))+' · '+esc(p.bezeichnung)+'</p>'+
    '<fieldset class="ct-pdf-teile"><legend>Was in den Bericht kommt</legend>'+
    '<label class="pb-check"><input type="checkbox" name="lage" checked>Lage und Kennzahlen</label>'+
    '<label class="pb-check"><input type="checkbox" name="staende" checked>Stände und Stunden</label>'+
    '<label class="pb-check"><input type="checkbox" name="zahlungen" checked>Zahlungen</label>'+
    (voll?'<label class="pb-check"><input type="checkbox" name="vertraulich">Zum Gehalt und Gewinn (vertraulich)</label>':'')+'</fieldset>'+
    '<p class="meta">Im Druckdialog «Als PDF sichern» wählen.</p><p class="pb-banner warn" data-dialog-fehler hidden></p>'+
    '<div class="pb-actions"><button value="drucken" class="btn btn-primary">Drucken oder als PDF sichern</button><button value="abbrechen" class="btn" formnovalidate>Abbrechen</button></div></form>');
  form.addEventListener('submit',ev=>{
    if(ev.submitter?.value!=='drucken')return;
    ev.preventDefault();
    const teile={lage:form.lage.checked,staende:form.staende.checked,zahlungen:form.zahlungen.checked,vertraulich:!!form.vertraulich?.checked};
    if(!Object.values(teile).some(Boolean)){zeigeFehler('Bitte mindestens einen Teil wählen.');return}
    dialog.close();
    drucken(dateiname(pr,p,'Controlling'+(teile.vertraulich?' vertraulich':'')),druckBericht(pr,p,teile));
  });
}
// Übersicht aller Pakete auf einem Blatt (quer), wie die Karten geordnet; mit vollem Zugang auf Wunsch der Gewinn.
function druckUebersicht(mitGewinn){
  const eintraege=daten.pakete.map(eintrag).sort(K.ordnung);
  const reihen=eintraege.map(({paket:p,k})=>{
    const pr=projekt(p.project_id),ergebnis=k.abgeschlossen?k.ergebnisBisher:k.prognoseErgebnis,g=gewinnWert(k);
    return '<tr><td>'+esc(pr?.number||'')+'</td><td>'+esc(pr?.name||'')+'<br><span class="ctd-klein">'+esc(p.bezeichnung)+' · '+esc(p.status)+(k.vorlaeufig?', vorläufig':'')+'</span></td>'+
      '<td>'+lageChip(k)+'</td><td class="num">'+esc(euro(k.honorar))+'</td><td class="num">'+esc(proz(k.leistungsstand))+'</td>'+
      '<td class="num">'+esc(std(k.stunden))+' / '+esc(std(k.budget))+'</td><td class="num'+plusKlasse(ergebnis)+'">'+esc(plus(ergebnis))+'</td>'+
      '<td class="num">'+esc(k.zahlungen?euro(k.bezahlt):'—')+'</td><td class="num">'+esc(k.offen==null||!k.zahlungen?'—':euro(k.offen))+'</td>'+
      (mitGewinn?'<td class="num'+plusKlasse(g)+'">'+esc(plus(g))+'</td>':'<td>'+esc(k.gewinnStufe?STUFE[k.gewinnStufe]:'—')+'</td>')+'</tr>';
  }).join('');
  return '<div class="ctd">'+druckKopf('Controlling · Übersicht',null,null,mitGewinn)+'<section class="ctd-teil"><table><thead><tr><th>Nr.</th><th>Projekt · Paket</th><th>Lage</th>'+
    '<th class="num">Honorar netto</th><th class="num">Leistungsstand</th><th class="num">Stunden / Budget</th><th class="num">Gegenüber Kalkulation am Ende netto</th>'+
    '<th class="num">Bezahlt netto</th><th class="num">Erarbeitet, nicht bezahlt netto</th>'+(mitGewinn?'<th class="num">Gewinn am Ende netto</th>':'<th>Gewinn am Ende</th>')+'</tr></thead><tbody>'+reihen+'</tbody></table>'+
    '<p class="ctd-fuss">Gegenüber Kalkulation: Honorar − Stunden zum Kalkulationssatz, hochgerechnet; abgeschlossene Pakete zum Abschluss. Lage: dieser Wert gemessen am Honorar '+
    '(im Budget; leicht über Budget bis 10 % des Honorars im Minus; deutlich darüber). Gewinn: Honorar − Selbstkosten (Bruttogehalt × Gemeinkostenfaktor)'+
    (mitGewinn?'':'; im Plus über 5 % des Honorars, knapp zwischen −5 und +5 %, im Minus darunter')+(eintraege.some(x=>x.k.gewinnVorlaeufig)?'; Annahmen vorläufig':'')+'.</p></section></div>';
}
function uebersichtPdf(){
  const name='Controlling – Übersicht – '+heute();
  if(!voll){drucken(name,druckUebersicht(false),true);return}
  const form=oeffneDialog('<form method="dialog" class="pb-form"><h2>Übersicht als PDF</h2><p class="meta">Alle Honorarpakete auf einem Blatt, quer.</p>'+
    '<label class="pb-check"><input type="checkbox" name="gewinn">mit Gewinn am Ende (vertraulich)</label><p class="meta">Im Druckdialog «Als PDF sichern» wählen.</p>'+
    '<div class="pb-actions"><button value="drucken" class="btn btn-primary">Drucken oder als PDF sichern</button><button value="abbrechen" class="btn" formnovalidate>Abbrechen</button></div></form>');
  form.addEventListener('submit',ev=>{
    if(ev.submitter?.value!=='drucken')return;
    ev.preventDefault();
    const g=form.gewinn.checked;dialog.close();
    drucken(name+(g?' – vertraulich':''),druckUebersicht(g),true);
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

// Eine Zahlung wie die Rechnung des Büros (Gari und die Buchhaltung, 25.11.2026): Abschlag (Honorar netto) zzgl.
// Nebenkosten = Netto; zzgl. MwSt = Brutto. Eingetragen wird, was zur Hand ist: der Abschlag, das Netto oder das Brutto;
// die übrigen Felder rechnen sich mit (controlling-kern.js, rechnung). Die MwSt folgt jeder Änderung und lässt sich danach
// noch von Hand setzen. Gespeichert werden Netto und MwSt; der Abschlag ist Netto ÷ (1 + Nebenkosten).
function zahlungFormular(p,z){
  const nk=Number(p.nebenkosten_prozent)||0,mw=K.MWST_PROZENT;
  const start=z?K.rechnung({netto:Number(z.netto)},nk):null;
  if(start&&z.mwst!=null){start.mwst=K.r2(z.mwst);start.brutto=K.r2(start.netto+start.mwst)}
  const feld=(name,text,wert,extra='')=>'<label>'+text+'<input name="'+name+'" class="pb-input" inputmode="decimal" value="'+esc(eingabe(wert))+'"'+extra+'></label>';
  const form=oeffneDialog('<form method="dialog" class="pb-form"><h2>'+(z?'Zahlung bearbeiten':'Zahlung erfassen')+'</h2><p class="meta">'+esc(p.bezeichnung)+'</p>'+
    '<div class="pb-felder">'+
    '<label>Datum<input type="date" name="datum" class="pb-input" value="'+esc(z?.datum||'')+'"></label>'+
    '<label>Bezeichnung<input name="bezeichnung" class="pb-input" maxlength="160" value="'+esc(z?.bezeichnung||'')+'" placeholder="z. B. RE 2401/04/2026 – 1. AZ LPH 3"></label>'+
    '</div><p class="meta ct-rechnung-hinweis">Wie auf der Rechnung. Eintragen, was zur Hand ist – Abschlag, Netto oder Brutto –, der Rest rechnet sich mit.</p>'+
    '<div class="ct-rechnung">'+
    feld('abschlag','Abschlag (AZ), Honorar netto (€)',start?.abschlag,' placeholder="z. B. 18.388,36"')+
    '<div class="ct-rechnung-zeile"><span>zzgl. '+esc(proz(nk))+' Nebenkosten</span><strong data-nk>'+esc(start?euro(start.nebenkosten,2):'—')+'</strong></div>'+
    feld('netto','Netto inkl. Nebenkosten (€)',start?.netto,' required')+
    feld('mwst','zzgl. '+mw+' % MwSt (€)',start?.mwst)+
    feld('brutto','Brutto (€)',start?.brutto)+
    '</div><div class="pb-felder">'+
    '<label>Status<select name="status" class="pb-input">'+optionen(ZAHLUNG,z?.status||'bezahlt')+'</select></label>'+
    '<label class="pb-check"><input type="checkbox" name="vorlaeufig"'+(z?.vorlaeufig?' checked':'')+'>vorläufig (noch nicht bestätigt)</label>'+
    '<label class="breit">Notiz<input name="notiz" class="pb-input" maxlength="1000" value="'+esc(z?.notiz||'')+'"></label></div>'+
    knoepfe('Speichern',z?'Zahlung entfernen':'')+'</form>');
  // Was eingetragen wird, bestimmt die übrigen Felder; das Feld selbst bleibt, wie es getippt wurde.
  const setze=(r,ausser)=>{
    for(const f of ['abschlag','netto','mwst','brutto'])if(f!==ausser)form[f].value=r?eingabe(r[f]):'';
    dialog.querySelector('[data-nk]').textContent=r?euro(r.nebenkosten,2):'—';
  };
  for(const f of ['abschlag','netto','brutto'])form[f].addEventListener('input',()=>{
    const w=K.leseZahl(form[f].value);setze(w==null?null:K.rechnung({[f]:w},nk),f);
  });
  // MwSt von Hand: Netto bleibt, Brutto folgt.
  form.mwst.addEventListener('input',()=>{
    const n=K.leseZahl(form.netto.value),m=K.leseZahl(form.mwst.value);
    if(n!=null&&m!=null)form.brutto.value=eingabe(K.r2(n+m));
  });
  if(z)entfernenFrage('Wirklich entfernen?',async()=>{
    const {error}=await sb.from('office_controlling_zahlungen').delete().eq('id',z.id);
    if(error){zeigeFehler('Nicht entfernt: '+error.message);return}
    dialog.close();await neuLaden('Zahlung entfernt.');
  });
  form.addEventListener('submit',async ev=>{
    if(ev.submitter?.value!=='speichern')return;
    ev.preventDefault();
    const netto=K.leseZahl(form.netto.value),mwst=form.mwst.value.trim()?K.leseZahl(form.mwst.value):0;
    if(netto==null||netto<0){zeigeFehler('Bitte den Abschlag, das Netto oder das Brutto als Betrag in Euro eintragen, etwa 18.388,36.');return}
    if(mwst==null||mwst<0){zeigeFehler('MwSt als Betrag in Euro.');return}
    const zeile={datum:form.datum.value||null,bezeichnung:form.bezeichnung.value.trim()||null,netto,mwst,status:form.status.value,
      vorlaeufig:form.vorlaeufig.checked,notiz:form.notiz.value.trim()||null};
    const {error}=z?await sb.from('office_controlling_zahlungen').update(zeile).eq('id',z.id)
      :await sb.from('office_controlling_zahlungen').insert({...zeile,paket_id:p.id,created_by:nutzer.id});
    if(error){zeigeFehler('Nicht gespeichert: '+error.message);return}
    dialog.close();ui.reiter='zahlungen';adresse();await neuLaden(z?'Zahlung gespeichert.':'Zahlung erfasst.');
  });
}

// Sätze einer Person: ein neuer Eintrag gilt ab seinem Datum; ältere bleiben für frühere Stände. Zum Gehalt gehören die
// Wochenstunden laut Vertrag (Gari, 25.11.2026: sonst stimmt der Stundensatz für Teilzeit nicht).
// Korrektur oder neu ab Datum (Gari und die Buchhaltung, 26.11.2026): die Urlaubstage laut Vertrag als neuer Eintrag ab
// heute bewerteten die Stunden davor nicht neu, das Ergebnis zum Gehalt blieb, wie es war. Wer schon Einträge hat, wählt
// deshalb ausdrücklich: Korrektur (ändert den Eintrag, auch rückwirkend für seine Stunden) oder neu ab einem Datum (etwa
// eine Gehaltserhöhung). Vorbelegt mit dem Eintrag, der heute gilt; «Ändern» in der Liste wählt einen anderen.
function satzFormular(personId){
  const e=daten.einstellungen||{},a=K.annahmen(e);
  const eigene=daten.saetze.filter(s=>s.person_id===personId).sort((x,y)=>String(y.gueltig_ab).localeCompare(String(x.gueltig_ab)));
  const aktuell=eigene.find(s=>String(s.gueltig_ab)<=heute())||eigene[0]||null;
  let ziel=aktuell;
  const mitWahl=eigene.length>0;
  const form=oeffneDialog('<form method="dialog" class="pb-form"><h2>Sätze</h2><p class="meta">'+esc(person(personId)||'Person')+'</p>'+
    (mitWahl?'<div class="pb-tabelle ct-tabelle ct-eintraege"><table><thead><tr><th>gültig ab</th><th class="num">Kalkulations&shy;satz</th><th class="num">Monats&shy;gehalt</th>'+
      '<th class="num">Wochen&shy;stunden</th><th class="num">Urlaub</th><th><span class="sr">Aktionen</span></th></tr></thead><tbody>'+
      eigene.map(s=>'<tr data-eintrag="'+esc(s.id)+'"><td>'+esc(datum(s.gueltig_ab))+'</td><td class="num">'+esc(s.kalkulationssatz==null?'—':euro(s.kalkulationssatz,2)+'/h')+'</td>'+
        '<td class="num">'+esc(s.monatsgehalt==null?'—':euro(s.monatsgehalt))+'</td><td class="num">'+esc(s.wochenstunden==null?(s.monatsgehalt==null?'—':'Vollzeit'):std(Number(s.wochenstunden)))+'</td>'+
        '<td class="num">'+(s.monatsgehalt==null?'—':urlaubText(s))+'</td>'+
        '<td class="ct-eintrag-knoepfe"><button type="button" class="btn btn-quiet" data-satz-aendern="'+esc(s.id)+'">Ändern</button>'+
        '<button type="button" class="btn btn-quiet btn-danger" data-satz-weg="'+esc(s.id)+'">Entfernen</button></td></tr>').join('')+
      '</tbody></table></div>':'<p class="meta">Noch kein eigener Satz: es gilt der Kalkulationssatz des Pakets.</p>')+
    '<h3 class="pb-h3">'+(mitWahl?'Eintragen':'Neuer Eintrag')+'</h3>'+
    (mitWahl?'<fieldset class="ct-art" data-art><legend>Wie gilt es?</legend>'+
      '<label class="ct-art-wahl"><input type="radio" name="art" value="korrektur"><span><strong data-korrektur-titel></strong>'+
      '<span class="ct-art-hilfe">Die Angabe galt schon so, etwa der Urlaub laut Vertrag: die Stunden ab diesem Tag werden neu bewertet.</span></span></label>'+
      '<label class="ct-art-wahl"><input type="radio" name="art" value="neu"><span><strong>Neu ab einem Datum</strong>'+
      '<span class="ct-art-hilfe">Eine Änderung ab einem Tag, etwa eine Gehaltserhöhung: Stunden davor behalten den bisherigen Satz.</span></span></label></fieldset>':'')+
    '<div class="pb-felder">'+
    '<label data-ab'+(mitWahl?' hidden':'')+'>gültig ab<input type="date" name="ab" class="pb-input"'+(mitWahl?'':' required')+' value="'+esc(heute())+'"></label>'+
    '<label>Kalkulationssatz (€/h)<input name="satz" class="pb-input" inputmode="decimal" placeholder="leer: Satz des Pakets"></label>'+
    '<label>Monatsgehalt brutto (€)<input name="gehalt" class="pb-input" inputmode="decimal" placeholder="leer: unbekannt"></label>'+
    '<label>Wochenstunden laut Vertrag<input name="woche" class="pb-input" inputmode="decimal" placeholder="leer: Vollzeit ('+esc(zahl(a.vollzeit,a.vollzeit%1?1:0))+' h)"></label>'+
    '<label>Urlaubstage im Jahr laut Vertrag<input name="urlaub" class="pb-input" inputmode="decimal" placeholder="leer: wie das Büro, anteilig"></label>'+
    '<label>Arbeitstage je Woche<input name="tage" class="pb-input" inputmode="decimal" placeholder="leer: 5"></label>'+
    '<label class="breit">Notiz<input name="notiz" class="pb-input" maxlength="500"></label></div>'+
    '<p class="ct-vorschau" data-vorschau></p>'+knoepfe('Speichern','')+'</form>');
  const vorschau=()=>{
    const g=K.leseZahl(form.gehalt.value),w=form.woche.value.trim()?K.leseZahl(form.woche.value):null;
    const u={urlaubstage:form.urlaub.value.trim()?K.leseZahl(form.urlaub.value):null,arbeitstage_woche:form.tage.value.trim()?K.leseZahl(form.tage.value):null};
    const gs=g?K.gehaltSatz(g,e,w,u):null,ss=g?K.selbstkostenSatz(g,e,w,u):null;
    dialog.querySelector('[data-vorschau]').textContent=gs==null?'':'Stundensatz aus Gehalt '+euro(gs,2)+'/h'+(ss!=null?', Selbstkostensatz '+euro(ss,2)+'/h':'')+
      ' ('+zahl(Math.round(K.jahresstundenPerson(w,e,u)))+' Jahresstunden, '+proz(a.ag)+' Arbeitgeberanteil'+(a.faktor?', Faktor '+zahl(a.faktor,2):'')+')';
  };
  // Die Felder mit einem Eintrag füllen (ohne Eintrag: leer, wie bisher).
  const fuellen=s=>{
    form.satz.value=s?eingabe(s.kalkulationssatz):'';form.gehalt.value=s?eingabe(s.monatsgehalt):'';
    form.woche.value=s?eingabe(s.wochenstunden):'';form.urlaub.value=s?eingabe(s.urlaubstage):'';
    form.tage.value=s?eingabe(s.arbeitstage_woche):'';form.notiz.value=s?.notiz||'';
    vorschau();
  };
  const art=()=>form.querySelector('[name="art"]:checked')?.value||'';
  const zeigeArt=()=>{
    const neuAb=art()==='neu',ab=dialog.querySelector('[data-ab]');
    if(mitWahl){ab.hidden=!neuAb;form.ab.required=neuAb}
    const titel=dialog.querySelector('[data-korrektur-titel]');
    if(titel)titel.textContent='Korrektur des Eintrags ab '+datum(ziel?.gueltig_ab);
    dialog.querySelectorAll('[data-eintrag]').forEach(tr=>tr.classList.toggle('ct-gewaehlt',art()==='korrektur'&&tr.dataset.eintrag===ziel?.id));
  };
  fuellen(aktuell);zeigeArt();
  form.addEventListener('input',vorschau);
  form.querySelectorAll('[name="art"]').forEach(r=>r.addEventListener('change',()=>{zeigeFehler('');zeigeArt()}));
  dialog.querySelectorAll('[data-satz-aendern]').forEach(b=>b.addEventListener('click',()=>{
    ziel=eigene.find(s=>s.id===b.dataset.satzAendern)||ziel;
    form.querySelector('[name="art"][value="korrektur"]').checked=true;
    fuellen(ziel);zeigeFehler('');zeigeArt();
    form.gehalt.focus();
  }));
  dialog.querySelectorAll('[data-satz-weg]').forEach(b=>b.addEventListener('click',async()=>{
    if(b.dataset.sicher!=='1'){b.dataset.sicher='1';b.textContent='Wirklich?';return}
    const {error}=await sb.from('office_controlling_saetze').delete().eq('id',b.dataset.satzWeg);
    if(error){zeigeFehler('Nicht entfernt: '+error.message);return}
    dialog.close();await neuLaden('Eintrag entfernt.');
  }));
  form.addEventListener('submit',async ev=>{
    if(ev.submitter?.value!=='speichern')return;
    ev.preventDefault();
    const satzText=form.satz.value.trim(),gehaltText=form.gehalt.value.trim(),wocheText=form.woche.value.trim(),urlaubText_=form.urlaub.value.trim(),tageText=form.tage.value.trim();
    const satz=satzText?K.leseZahl(satzText):null,gehalt=gehaltText?K.leseZahl(gehaltText):null,wochenstunden=wocheText?K.leseZahl(wocheText):null;
    const urlaubstage=urlaubText_?K.leseZahl(urlaubText_):null,arbeitstage_woche=tageText?K.leseZahl(tageText):null;
    if(mitWahl&&!art()){zeigeFehler('Bitte wählen: Korrektur des Eintrags oder neu ab einem Datum.');return}
    if(!satzText&&!gehaltText){zeigeFehler('Bitte einen Kalkulationssatz oder ein Monatsgehalt eintragen.');return}
    if(satzText&&!(satz>0)){zeigeFehler('Kalkulationssatz in Euro je Stunde, etwa 85.');return}
    if(gehaltText&&(gehalt==null||gehalt<0)){zeigeFehler('Monatsgehalt als Betrag in Euro.');return}
    if(wocheText&&(wochenstunden==null||wochenstunden<=0||wochenstunden>80)){zeigeFehler('Wochenstunden über 0 und höchstens 80, etwa 20.');return}
    if(urlaubText_&&(urlaubstage==null||urlaubstage<0||urlaubstage>60)){zeigeFehler('Urlaubstage 0 bis 60, etwa 30 (in den eigenen Arbeitstagen).');return}
    if(tageText&&(arbeitstage_woche==null||arbeitstage_woche<=0||arbeitstage_woche>6)){zeigeFehler('Arbeitstage je Woche über 0 und höchstens 6, etwa 2.');return}
    const werte={kalkulationssatz:satz,monatsgehalt:gehalt,wochenstunden,urlaubstage,arbeitstage_woche,notiz:form.notiz.value.trim()||null};
    if(art()==='korrektur'){
      const {error}=await sb.from('office_controlling_saetze').update(werte).eq('id',ziel.id);
      if(error){zeigeFehler('Nicht gespeichert: '+error.message);return}
      dialog.close();await neuLaden('Eintrag ab '+datum(ziel.gueltig_ab)+' korrigiert; die Stunden ab diesem Tag sind neu bewertet.');return;
    }
    if(!form.ab.value){zeigeFehler('Bitte das Datum eintragen, ab dem es gilt.');return}
    if(eigene.some(s=>s.gueltig_ab===form.ab.value)){zeigeFehler('Für diesen Tag gibt es schon einen Eintrag: dafür «Korrektur» wählen oder ein anderes Datum.');return}
    const {error}=await sb.from('office_controlling_saetze').insert({person_id:personId,gueltig_ab:form.ab.value,...werte,created_by:nutzer.id});
    if(error){zeigeFehler(error.code==='23505'?'Für diesen Tag gibt es schon einen Eintrag: dafür «Korrektur» wählen oder ein anderes Datum.':'Nicht gespeichert: '+error.message);return}
    dialog.close();await neuLaden('Eingetragen.');
  });
}

void start();
})();
