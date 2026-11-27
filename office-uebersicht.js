// TBA Office · Übersicht für Administratoren (27.11.2026, auf Wunsch von Gari): «KI-Nutzung» und «Systemstatus».
// Beides liest nur Summen über eigene Funktionen der Datenbank, die nur Administratoren aufrufen dürfen
// (office_ki_nutzung, office_ki_guthaben_eintragen, office_systemstatus). Nie je Person.
// Die Kosten sind eine Schätzung aus den Tokens nach den Listenpreisen von OpenAI; das tatsächliche Guthaben steht bei
// OpenAI unter Settings → Billing und wird hier eingetragen.
(function(root){
'use strict';

// ── Preise · USD je 1 Mio. Tokens, Standard. Modelle, die auch Romys Motor kennt (credit-model.mjs), hält ein Test gleich.
const PREISE_STAND='2026-11-27';
// Seit 27.11.2026 arbeitet das Office mit GPT-6.1 Terra (Chat, Werkzeuge), GPT-6.2 Sol (gründliche Züge, Fähigkeiten)
// und GPT-6 Luna (Hintergrund, Einordnen). Die älteren Modelle bleiben für die Summen der letzten Wochen.
const PREISE=[
  {id:'gpt-6.1-terra',input:1,cached:0.05,output:5},
  {id:'gpt-6.2-sol',input:2,cached:0.10,output:10},
  {id:'gpt-6.2-astra',input:8,cached:0.40,output:40},
  {id:'gpt-6-luna',input:0.10,cached:0.01,output:0.50},
  {id:'gpt-6-astra',input:10,cached:1,output:50},
  {id:'gpt-5.6-luna',input:0.20,cached:0.02,output:1.20},
  {id:'gpt-5.6-terra',input:2,cached:0.20,output:12},
  {id:'gpt-5.6-sol',input:4,cached:0.40,output:20},
  {id:'text-embedding-3-small',input:0.02,cached:0.02,output:0}
];
// Werkzeuge kosten je Aufruf: Websuche 10 $ je 1000, ein Container (Romys Dateien) 0,03 $ je Sitzung.
const WEBSUCHE_USD=0.01,CONTAINER_USD=0.03;
// Über 272 000 Eingabe-Tokens berechnet OpenAI die ganze Anfrage mit doppelter Eingabe und 1,5-facher Ausgabe.
const LANG_INPUT=272000;
const NACH_LAENGE=PREISE.slice().sort((a,b)=>b.id.length-a.id.length);

function preisFuer(modell){
  const m=String(modell||'').trim().toLowerCase();
  if(!m)return null;
  // Das bloße gpt-5.6 und seine datierten Fassungen sind Sol.
  if(m==='gpt-5.6'||/^gpt-5\.6-\d{4}/.test(m))return PREISE.find(p=>p.id==='gpt-5.6-sol');
  return NACH_LAENGE.find(p=>m===p.id||m.startsWith(p.id+'-'))||null;
}
function zahl(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:0}
// Kosten einer Summenzeile aus office_ki_nutzung. Lange Anfragen sind eigene Zeilen, der Aufschlag gilt also genau.
function kosten(z){
  const extra=zahl(z&&z.websuchen)*WEBSUCHE_USD+zahl(z&&z.container)*CONTAINER_USD;
  const p=preisFuer(z&&z.modell);
  if(!p)return {usd:extra,bepreist:false};
  let input=zahl(z.input);
  const output=zahl(z.output);
  if(!input&&!output)input=zahl(z.total);
  const cached=Math.min(input,zahl(z.cached));
  const lang=!!z.lang&&p.output>0,ein=lang?2:1,aus=lang?1.5:1;
  return {usd:((input-cached)*p.input*ein+cached*p.cached*ein+output*p.output*aus)/1e6+extra,bepreist:true};
}
function tagPlus(tag,n){const d=new Date(tag+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}

// Alles, was die Seite zeigt, aus der Antwort von office_ki_nutzung.
function zusammenfassen(daten){
  const heute=String(daten&&daten.heute||new Date().toISOString().slice(0,10));
  const zeilen=Array.isArray(daten&&daten.zeilen)?daten.zeilen:[];
  const tage30=Array.from({length:30},(_,i)=>tagPlus(heute,i-29)),imFenster=new Set(tage30);
  const proTag=Object.fromEntries(tage30.map(t=>[t,0])),funktionen={},projekte={},ohnePreisModelle=new Set();
  let ohnePreis=0,seitStand=0;
  for(const z of zeilen){
    const k=kosten(z),aufrufe=zahl(z.aufrufe);
    if(!k.bepreist){ohnePreis+=aufrufe;ohnePreisModelle.add(String(z.modell||'?'))}
    if(z.nach_stand)seitStand+=k.usd;
    if(!imFenster.has(String(z.tag)))continue;
    proTag[z.tag]+=k.usd;
    const fk=String(z.quelle)+':'+String(z.funktion);
    const f=funktionen[fk]||(funktionen[fk]={schluessel:fk,usd:0,aufrufe:0,tokens:0});
    f.usd+=k.usd;f.aufrufe+=aufrufe;f.tokens+=zahl(z.total);
    if(z.quelle==='office'){
      const pk=z.projekt_id||'';
      const p=projekte[pk]||(projekte[pk]={projekt_id:z.projekt_id||null,usd:0,aufrufe:0});
      p.usd+=k.usd;p.aufrufe+=aufrufe;
    }
  }
  // Durchschnitt der sieben vollen Tage vor heute.
  const durchschnitt=tage30.slice(-8,-1).reduce((s,t)=>s+proTag[t],0)/7;
  const g=daten&&daten.guthaben;
  let guthaben=null;
  if(g&&g.betrag_usd!=null&&Number.isFinite(Number(g.betrag_usd))){
    const betrag=Number(g.betrag_usd),rest=betrag-seitStand,warnen=Number(g.warnen_ab_tage)||7;
    const tageRest=durchschnitt>0?Math.max(0,rest)/durchschnitt:Infinity;
    const stufe=rest<=0?'leer':(rest<1||tageRest<2)?'kritisch':(rest<3||tageRest<warnen)?'knapp':'ok';
    guthaben={betrag,standAm:g.stand_am,seitStand,rest,tageRest,warnen,stufe};
  }
  return {heute,tage30,proTag:tage30.map(t=>({tag:t,usd:proTag[t]})),heuteUsd:proTag[heute]||0,durchschnitt,
    summe30:tage30.reduce((s,t)=>s+proTag[t],0),
    nachFunktion:Object.values(funktionen).sort((a,b)=>b.usd-a.usd||b.aufrufe-a.aufrufe),
    nachProjekt:Object.values(projekte).sort((a,b)=>b.usd-a.usd||b.aufrufe-a.aufrufe),
    guthaben,ohnePreis:{aufrufe:ohnePreis,modelle:[...ohnePreisModelle].sort()},preiseStand:PREISE_STAND};
}

// ── Texte ──
const FUNKTIONEN={
  'office:kosten':'Kostenberechnung','office:dokumente':'Projektdokumente','office:produkte':'Produktbibliothek',
  'office:terminplan':'Terminplan','office:romy_chat':'Romy in Threads','office:romy_faehigkeit':'Romy · Dateien erzeugen',
  'office:romy_gedaechtnis':'Romy · Suche im Gedächtnis','office:romy_auftrag':'Romy · Aufträge',
  'romy:isabella_chat':'Romy · Chat','romy:isabella_presence':'Romy · meldet sich von selbst',
  'romy:isabella_dream':'Romy · nächtliche Pflege','romy:decision_router':'Romy · Einordnen',
  'romy:memory_flush':'Romy · Gedächtnis sichern','romy:routine':'Romy · Routinen','romy:akte_pflege':'Romy · Akte-Pflege',
  'romy:isabella_embedding':'Romy · Gedächtnis','romy:isabella_background':'Romy · im Hintergrund',
  'romy:work_file_read':'Romy · Dateien lesen'
};
function funktionName(schluessel){
  if(FUNKTIONEN[schluessel])return FUNKTIONEN[schluessel];
  const [quelle,name]=String(schluessel).split(':');
  return (quelle==='romy'?'Romy · ':'')+String(name||schluessel).replace(/_/g,' ');
}
const ZEITPLAENE={
  office_push_v1:'Mitteilungen aufs iPhone',office_romy_capability_runner_v1:'Romy · Dateien erzeugen',
  office_romy_chat_runner_v1:'Romy · Chat im Hintergrund',office_romy_heartbeat_15m_v1:'Romys Heartbeat',
  office_romy_mission_runner_v1:'Romy · Aufträge',office_romy_routine_runner_v1:'Romy · Routinen',
  office_romy_work_ingest_runner_v1:'Work · Dateien einlesen',office_client_fehler_aufraeumen_v1:'Fehler aus dem Browser aufräumen'
};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const geld=new Intl.NumberFormat('de-DE',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
function usd(n){const v=Number(n)||0;return v>0&&v<0.005?'< '+geld.format(0.01):geld.format(v)}
const ganz=new Intl.NumberFormat('de-DE');
function zeit(iso){const d=new Date(iso);return isNaN(d)?'':d.toLocaleTimeString('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'})}
function datum(iso){const d=new Date(iso);return isNaN(d)?'':d.toLocaleDateString('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit'})}
function datumLang(tag){const [j,m,d]=String(tag).split('-');return d+'.'+m+'.'+j}
function tagKurz(tag){const [,m,d]=String(tag).split('-');return d+'.'+m+'.'}
function tageText(n){
  if(n===Infinity||n>90)return 'mehr als 90 Tage';
  const t=Math.max(0,Math.floor(n));
  return t===1?'etwa 1 Tag':t===0?'weniger als 1 Tag':'etwa '+t+' Tage';
}
const STUFE={ok:'Reicht',knapp:'Wird knapp',kritisch:'Fast aufgebraucht',leer:'Aufgebraucht'};
function fehlerText(e){
  const code=String(e&&e.code||'');
  if(code==='42501')return 'Nur für Administratoren.';
  return String(e&&e.message||'')||'Das hat nicht geklappt. Bitte später noch einmal versuchen.';
}

// ── Balken pro Tag (eine Reihe, daher ohne Legende; Werte im Tooltip und in der Tabelle) ──
function obereGrenze(max){
  if(!(max>0))return 1;
  const stufe=Math.pow(10,Math.floor(Math.log10(max)));
  for(const f of [1,2,2.5,5,10])if(f*stufe>=max)return f*stufe;
  return 10*stufe;
}
function balkenSvg(proTag,breite=720){
  const W=Math.max(320,Math.round(breite)),H=210,PL=56,PR=8,PT=12,PB=28,n=proTag.length||1,slot=(W-PL-PR)/n,bw=Math.min(24,Math.max(4,slot-6));
  const max=obereGrenze(Math.max(0,...proTag.map(d=>d.usd))),hoehe=H-PT-PB,y=v=>PT+hoehe*(1-v/max),basis=PT+hoehe;
  const ticks=[0,max/2,max].map(v=>`<line class="ki-gitter" x1="${PL}" x2="${W-PR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="ki-achse" x="${PL-8}" y="${(y(v)+4).toFixed(1)}" text-anchor="end">${esc(max>=10?ganz.format(Math.round(v))+' $':usd(v))}</text>`).join('');
  const balken=proTag.map((d,i)=>{
    const x=PL+i*slot+(slot-bw)/2,top=y(d.usd),h=basis-top,r=Math.min(4,bw/2,h);
    const pfad=h<=0?'':`<path class="ki-balken" d="M${x.toFixed(1)},${basis} L${x.toFixed(1)},${(top+r).toFixed(1)} Q${x.toFixed(1)},${top.toFixed(1)} ${(x+r).toFixed(1)},${top.toFixed(1)} L${(x+bw-r).toFixed(1)},${top.toFixed(1)} Q${(x+bw).toFixed(1)},${top.toFixed(1)} ${(x+bw).toFixed(1)},${(top+r).toFixed(1)} L${(x+bw).toFixed(1)},${basis} Z"/>`;
    const beschriftung=(n-1-i)%7===0?`<text class="ki-achse" x="${(x+bw/2).toFixed(1)}" y="${H-8}" text-anchor="middle">${esc(tagKurz(d.tag))}</text>`:'';
    return `<g class="ki-tag" data-ki-tag="${i}" tabindex="0" role="img" aria-label="${esc(tagKurz(d.tag)+': '+usd(d.usd))}"><rect class="ki-treffer" x="${(PL+i*slot).toFixed(1)}" y="${PT}" width="${slot.toFixed(1)}" height="${hoehe}"/>${pfad}</g>${beschriftung}`;
  }).join('');
  return `<svg class="ki-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-label="Geschätzte Kosten pro Tag, 30 Tage">${ticks}<line class="ki-basis" x1="${PL}" x2="${W-PR}" y1="${basis}" y2="${basis}"/>${balken}</svg>`;
}
function tooltipVerbinden(figur,proTag){
  const tip=figur.querySelector('.ki-tooltip');
  const zeigen=g=>{
    const d=proTag[Number(g.dataset.kiTag)];if(!d)return;
    tip.querySelector('strong').textContent=usd(d.usd);
    tip.querySelector('span').textContent=tagKurz(d.tag);
    const box=figur.getBoundingClientRect(),r=g.getBoundingClientRect();
    tip.hidden=false;
    const links=Math.min(Math.max(8,r.left-box.left+r.width/2-tip.offsetWidth/2),box.width-tip.offsetWidth-8);
    tip.style.left=links+'px';
  };
  figur.querySelectorAll('[data-ki-tag]').forEach(g=>{
    g.addEventListener('pointerenter',()=>zeigen(g));g.addEventListener('focus',()=>zeigen(g));
    g.addEventListener('pointerleave',()=>{tip.hidden=true});g.addEventListener('blur',()=>{tip.hidden=true});
  });
}

// ── KI-Nutzung ──
function kiNutzungHtml(daten){
  const s=zusammenfassen(daten),g=s.guthaben;
  const projekte=Object.fromEntries((daten.projekte||[]).map(p=>[p.id,(p.nummer?p.nummer+' · ':'')+(p.name||'')]));
  const guthabenKarte=g
    ?`<p class="ki-zahl">${esc(usd(Math.max(0,g.rest)))}</p>
      <p class="ki-sub">Bei OpenAI abgelesen: ${esc(usd(g.betrag))} am ${esc(datum(g.standAm))} um ${esc(zeit(g.standAm))} · seitdem verbraucht ≈ ${esc(usd(g.seitStand))}</p>
      <p class="ki-reicht"><span class="pill ki-stufe-${esc(g.stufe)}">${esc(STUFE[g.stufe])}</span> ${g.stufe==='leer'?'Bitte bei OpenAI aufladen.':esc(tageText(g.tageRest))+(s.durchschnitt>0?' bei Ø '+esc(usd(s.durchschnitt))+' pro Tag':'')}</p>`
    :`<p class="ki-zahl ki-leer">–</p><p class="ki-sub">Noch kein Guthaben eingetragen. Tragen Sie ein, was bei OpenAI steht; ab dann rechnet die Seite mit.</p>`;
  const funktionZeilen=s.nachFunktion.map(f=>`<tr><td>${esc(funktionName(f.schluessel))}</td><td class="zahl">${esc(ganz.format(f.aufrufe))}</td><td class="zahl">${esc(usd(f.usd))}</td><td class="zahl">${s.summe30>0?esc(Math.round(f.usd/s.summe30*100)+' %'):'–'}</td></tr>`).join('');
  const projektZeilen=s.nachProjekt.map(p=>`<tr><td>${p.projekt_id?esc(projekte[p.projekt_id]||'Projekt'):'Ohne Projekt'}</td><td class="zahl">${esc(ganz.format(p.aufrufe))}</td><td class="zahl">${esc(usd(p.usd))}</td></tr>`).join('');
  const tabelle=s.proTag.slice().reverse().map(d=>`<tr><td>${esc(tagKurz(d.tag))}</td><td class="zahl">${esc(usd(d.usd))}</td></tr>`).join('');
  return `
    <div class="page-head">
      <div>
        <p class="eyebrow">Administration</p>
        <h1>KI-Nutzung</h1>
        <p class="lead">Was das Office bei OpenAI verbraucht, geschätzt aus den Tokens jedes Aufrufs. Summen je Funktion und Projekt, nie je Person.</p>
      </div>
      <div class="page-actions"><button type="button" data-ki-neu>Aktualisieren</button></div>
    </div>
    <div class="ki-oben">
      <section class="card ki-guthaben">
        <p class="eyebrow">Geschätztes Guthaben</p>
        ${guthabenKarte}
        <form class="ki-form" data-ki-form>
          <label>Guthaben laut OpenAI (USD)<input name="betrag" type="number" min="0" step="0.01" inputmode="decimal" required></label>
          <label>Warnen ab (Tage)<input name="warnen" type="number" min="1" max="60" step="1" value="${esc(g?g.warnen:7)}"></label>
          <button class="primary" type="submit">Eintragen</button>
        </form>
        <p class="message" data-ki-meldung aria-live="polite"></p>
        <p class="muted ki-hinweis">Das Guthaben steht bei OpenAI unter Settings → Billing. Am besten tragen Sie es ein, wenn Sie dort nachsehen.</p>
      </section>
      <section class="card ki-kennzahlen">
        <div><p class="eyebrow">Heute</p><p class="ki-wert">${esc(usd(s.heuteUsd))}</p></div>
        <div><p class="eyebrow">Ø pro Tag · 7 Tage</p><p class="ki-wert">${esc(usd(s.durchschnitt))}</p></div>
        <div><p class="eyebrow">30 Tage</p><p class="ki-wert">${esc(usd(s.summe30))}</p></div>
      </section>
    </div>
    <section class="section">
      <div class="section-title"><h2>Geschätzte Kosten pro Tag</h2><span class="count">30 Tage</span></div>
      <figure class="card ki-chart">
        ${balkenSvg(s.proTag)}
        <div class="ki-tooltip" role="status" hidden><strong></strong><span></span></div>
        <details class="ki-tabelle"><summary>Als Tabelle</summary><table><thead><tr><th>Tag</th><th class="zahl">Kosten</th></tr></thead><tbody>${tabelle}</tbody></table></details>
      </figure>
    </section>
    <div class="ki-tabellen">
      <section class="section">
        <div class="section-title"><h2>Nach Funktion</h2><span class="count">30 Tage</span></div>
        <div class="card">${funktionZeilen?`<table class="ki-liste"><thead><tr><th>Funktion</th><th class="zahl">Aufrufe</th><th class="zahl">Kosten</th><th class="zahl">Anteil</th></tr></thead><tbody>${funktionZeilen}</tbody></table>`:'<p class="muted ki-leer-text">Noch kein Verbrauch.</p>'}</div>
      </section>
      <section class="section">
        <div class="section-title"><h2>Nach Projekt</h2><span class="count">30 Tage</span></div>
        <div class="card">${projektZeilen?`<table class="ki-liste"><thead><tr><th>Projekt</th><th class="zahl">Aufrufe</th><th class="zahl">Kosten</th></tr></thead><tbody>${projektZeilen}</tbody></table>`:'<p class="muted ki-leer-text">Noch kein Verbrauch der Werkzeuge.</p>'}</div>
      </section>
    </div>
    <p class="muted ki-fuss">Schätzung nach den Listenpreisen von OpenAI (Stand ${esc(datumLang(s.preiseStand))}), mit Websuchen (0,01 $ je Suche) und Containern für Romys Dateien (0,03 $). Romys Chat, Präsenz und nächtliche Pflege gehören zu keinem Projekt. Was außerhalb des Office über dasselbe OpenAI-Konto läuft, sieht diese Seite nicht; tragen Sie das Guthaben deshalb regelmäßig neu ein, am besten täglich.${s.ohnePreis.aufrufe?' '+esc(ganz.format(s.ohnePreis.aufrufe))+' Aufrufe ohne bekannten Preis ('+esc(s.ohnePreis.modelle.join(', '))+') sind nur mit ihren Werkzeugen gezählt.':''}</p>`;
}
async function kiNutzung(host,sb){
  if(!host||!sb)return;
  host.innerHTML='<div class="empty">Lade die KI-Nutzung …</div>';
  let daten;
  try{
    const {data,error}=await sb.rpc('office_ki_nutzung',{p_tage:35});
    if(error)throw error;
    daten=data;
  }catch(e){host.innerHTML=`<div class="empty">${esc(fehlerText(e))}</div>`;return}
  host.innerHTML=kiNutzungHtml(daten);
  const figur=host.querySelector('.ki-chart'),proTag=zusammenfassen(daten).proTag;
  // Das Diagramm in seiner echten Breite zeichnen: so bleibt die Schrift der Achsen so groß wie der Text daneben.
  const svg=figur.querySelector('.ki-svg');
  if(svg&&figur.clientWidth>0)svg.outerHTML=balkenSvg(proTag,figur.clientWidth-32);
  tooltipVerbinden(figur,proTag);
  host.querySelector('[data-ki-neu]').onclick=()=>void kiNutzung(host,sb);
  const form=host.querySelector('[data-ki-form]');
  form.onsubmit=async e=>{
    e.preventDefault();
    const knopf=form.querySelector('button'),meldung=host.querySelector('[data-ki-meldung]');
    const roh=String(form.betrag.value).trim().replace(',','.'),betrag=Number(roh),warnen=Number(form.warnen.value)||null;
    if(!roh||!(betrag>=0)){meldung.textContent='Bitte einen Betrag in US-Dollar eingeben.';return}
    knopf.disabled=true;meldung.textContent='';
    try{
      const {error}=await sb.rpc('office_ki_guthaben_eintragen',{p_betrag:betrag,p_warnen_ab_tage:warnen});
      if(error)throw error;
      await kiNutzung(host,sb);
    }catch(err){meldung.textContent=fehlerText(err);knopf.disabled=false}
  };
}

// ── Systemstatus ──
const STATUS={ok:'In Ordnung',warnung:'Ansehen',fehler:'Gestört',unbekannt:'Unbekannt',ausstehend:'Noch nicht gelaufen'};
function pruefungText(p){
  const s=p.status;
  switch(p.bereich){
    case 'heartbeat':return {titel:'Romys Heartbeat',text:s==='fehler'
      ?(p.zuletzt_ok?'Kein erfolgreicher Lauf seit '+datum(p.zuletzt_ok)+', '+zeit(p.zuletzt_ok)+' Uhr.':'Kein erfolgreicher Lauf in 48 Stunden.')
      :s==='warnung'?ganz.format(p.fehler_24h||0)+' Fehler und '+ganz.format(p.ok_24h||0)+' erfolgreiche Läufe in 24 Stunden (normal sind 96).'
      :s==='ok'?'Zuletzt um '+zeit(p.zuletzt_ok)+' Uhr; '+ganz.format(p.ok_24h||0)+' erfolgreiche Läufe in 24 Stunden.':''};
    case 'pflege':return {titel:'Romys nächtliche Pflege',text:p.zuletzt_ok
      ?(s==='ok'?'Zuletzt am ':'Seit mehr als 30 Stunden nicht gelaufen; zuletzt am ')+datum(p.zuletzt_ok)+' um '+zeit(p.zuletzt_ok)+' Uhr.'
      :'Seit mehr als 30 Stunden nicht gelaufen.'};
    case 'zeitplaene':{
      const jobs=Array.isArray(p.jobs)?p.jobs:[],schlecht=jobs.filter(j=>j.status==='fehler'||j.status==='warnung').length,
        neu=jobs.filter(j=>j.status==='ausstehend').length;
      return {titel:'Zeitpläne der Datenbank',text:jobs.length+' aktiv'+(schlecht?', '+schlecht+' davon ansehen.'
        :neu?', '+neu+' noch nicht gelaufen, die übrigen in Ordnung.':', alle in Ordnung.'),jobs};
    }
    case 'netz':return {titel:'Aufrufe der Datenbank an die Funktionen',
      text:ganz.format(p.gesamt_6h||0)+' in 6 Stunden, davon '+ganz.format(p.fehlgeschlagen_6h||0)+' fehlgeschlagen.'};
    case 'push':return {titel:'Mitteilungen aufs iPhone',text:[
      ganz.format(p.gesendet_24h||0)+' in 24 Stunden zugestellt',
      p.wartet?ganz.format(p.wartet)+' warten länger als 10 Minuten':'',
      p.fehlgeschlagen_24h?ganz.format(p.fehlgeschlagen_24h)+' fehlgeschlagen':'',
      ganz.format(p.geraete||0)+(Number(p.geraete)===1?' iPhone':' iPhones')+' angemeldet'].filter(Boolean).join(' · ')+'.'};
    case 'browserfehler':return {titel:'Fehler im Browser',text:p.meldungen_24h
      ?ganz.format(p.meldungen_24h)+' Meldungen, '+ganz.format(p.verschiedene_24h||0)+' verschiedene Fehler in 24 Stunden.'
      :'Keine Fehler in 24 Stunden.',fehler:Array.isArray(p.haeufigste)?p.haeufigste:[]};
    case 'ki':return {titel:'KI-Verbrauch',text:ganz.format(p.tokens_24h||0)+' Tokens in 24 Stunden (an einem üblichen Tag '+ganz.format(p.median_tag||0)+').',link:true};
    case 'guthaben':return {titel:'Guthaben bei OpenAI',text:p.text};
    default:return {titel:String(p.bereich||''),text:''};
  }
}
function pruefungHtml(p){
  const t=pruefungText(p),status=STATUS[p.status]?p.status:'unbekannt';
  const jobs=t.jobs?`<ul class="status-details">${t.jobs.map(j=>`<li><span class="pill status-${esc(STATUS[j.status]?j.status:'unbekannt')}">${esc(STATUS[j.status]||STATUS.unbekannt)}</span> ${esc(ZEITPLAENE[j.name]||j.name)}${j.zuletzt?' · zuletzt '+esc(datum(j.zuletzt))+', '+esc(zeit(j.zuletzt))+' Uhr':''}${j.fehler_24h?' · '+esc(ganz.format(j.fehler_24h))+' Fehler in 24 Stunden':''}</li>`).join('')}</ul>`:'';
  const fehler=t.fehler&&t.fehler.length?`<ul class="status-details">${t.fehler.map(f=>`<li><code>${esc(f.nachricht)}</code> <span class="muted">${esc(f.seite||'')}${f.ort?' · '+esc(f.ort):''} · ${esc(ganz.format(f.anzahl||0))}-mal${Number(f.personen)>1?' · '+esc(ganz.format(f.personen))+' Personen':''}</span></li>`).join('')}</ul>`:'';
  const link=t.link?' <a href="#kinutzung">KI-Nutzung öffnen</a>':'';
  return `<div class="row status-row"><span class="pill status-${esc(status)}">${esc(STATUS[status])}</span><span class="status-inhalt"><span class="row-title">${esc(t.titel)}</span><span class="row-sub">${esc(t.text)}${link}</span>${jobs}${fehler}</span></div>`;
}
function systemstatusHtml(daten,nutzung){
  const pruefungen=Array.isArray(daten&&daten.pruefungen)?daten.pruefungen.slice():[];
  if(nutzung){
    const g=zusammenfassen(nutzung).guthaben;
    pruefungen.push(g
      ?{bereich:'guthaben',status:g.stufe==='ok'?'ok':g.stufe==='knapp'?'warnung':'fehler',
        text:'Geschätzt '+usd(Math.max(0,g.rest))+'; '+(g.stufe==='leer'?'aufgebraucht.':'reicht '+tageText(g.tageRest)+'.')}
      :{bereich:'guthaben',status:'unbekannt',text:'Noch kein Guthaben eingetragen (KI-Nutzung).'});
  }
  const ansehen=pruefungen.filter(p=>p.status==='warnung'||p.status==='fehler').length;
  return `
    <div class="page-head">
      <div>
        <p class="eyebrow">Administration</p>
        <h1>Systemstatus</h1>
        <p class="lead">Was im Hintergrund des Office läuft, auf einen Blick. Edge Functions, Sicherheitshinweise und die Workflows sieht zusätzlich die tägliche Office-Prüfung an.</p>
      </div>
      <div class="page-actions"><button type="button" data-status-neu>Aktualisieren</button></div>
    </div>
    <p class="status-gesamt"><span class="pill status-${ansehen?'warnung':'ok'}">${ansehen?esc(ansehen+(ansehen===1?' Bereich ansehen':' Bereiche ansehen')):'Alles in Ordnung'}</span> <span class="muted">Stand ${esc(zeit(daten.stand))} Uhr</span></p>
    <div class="card row-list">${pruefungen.map(pruefungHtml).join('')}</div>`;
}
async function systemstatus(host,sb){
  if(!host||!sb)return;
  host.innerHTML='<div class="empty">Lade den Systemstatus …</div>';
  let daten,nutzung=null;
  try{
    const [status,ki]=await Promise.all([sb.rpc('office_systemstatus'),sb.rpc('office_ki_nutzung',{p_tage:35})]);
    if(status.error)throw status.error;
    daten=status.data;nutzung=ki.error?null:ki.data;
  }catch(e){host.innerHTML=`<div class="empty">${esc(fehlerText(e))}</div>`;return}
  host.innerHTML=systemstatusHtml(daten,nutzung);
  host.querySelector('[data-status-neu]').onclick=()=>void systemstatus(host,sb);
}

const API={kiNutzung,systemstatus,kiNutzungHtml,systemstatusHtml,modell:{PREISE,PREISE_STAND,WEBSUCHE_USD,CONTAINER_USD,LANG_INPUT,preisFuer,kosten,zusammenfassen,obereGrenze,funktionName,tageText,pruefungText}};
if(typeof module==='object'&&module.exports)module.exports=API;
root.TBA_OFFICE_UEBERSICHT=API;
})(typeof self!=='undefined'?self:globalThis);
