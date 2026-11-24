/* TBA Office · Kostenberechnung · Rechenkern (21.11.2026, Claude).
   Rein und ohne DOM: rechnet einen Stand `tba.office.kostenberechnung.v1` und sagt, was fehlt.
   Gleiche Regeln wie der Rechenkern aus PR #107 (ChatGPT), damit beide austauschbar bleiben:
   Beträge in Cent als BigInt, kaufmännisch gerundet; eine fehlende Angabe ist nicht 0;
   eine Summe mit offenen Positionen ist «vorläufig», nie vollständig.
   Neu gegenüber #107: die Herkunftskette eines Kennwerts (Umsatzsteuer, Baupreisindex,
   Regionalfaktor, Zuschlag) als sichtbare Schritte.
   Die DIN-276-Gliederung kommt aus dem Stand (Muster in der Datenbank), nie aus diesem Code.
   24.11.2026: Liegt ein Kostenstand nach dem letzten eingetragenen Baupreisindex, ist sein Wert
   noch nicht veröffentlicht (Destatis veröffentlicht etwa sechs Wochen nach dem Berichtsmonat).
   Dann gilt der letzte Wert, wie in der Praxis üblich, und die Kette sagt es («index_vorlaeufig»).
   Eine Lücke in der Reihe oder ein Quartal vor ihrem Anfang bleibt «index_fehlt». */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TBA_KOSTEN_RECHNEN=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';

const SCHEMA='tba.office.kostenberechnung.v1';
const MIKRO=1000000n;          // Faktoren, Mengen und Kennwerte in Millionsteln
const MIKRO_JE_CENT=10000n;

// Herkunftsarten eines Kennwerts und was ihre Werte üblicherweise enthalten.
const ARTEN=Object.freeze({
  bki:{label:'BKI-Buch',kurz:'BKI',brutto:true,regional:true,zuschlag:false,fundstelle:true},
  heinze:{label:'Heinze Baupreisinfo',kurz:'Heinze',brutto:false,regional:false,zuschlag:true,fundstelle:true},
  eigen:{label:'Eigenes Projekt',kurz:'Eigenes Projekt',brutto:false,regional:false,zuschlag:false,fundstelle:true},
  angebot:{label:'Angebot oder Richtpreis',kurz:'Angebot',brutto:false,regional:false,zuschlag:false,fundstelle:true},
  fachplanung:{label:'Fachplanung',kurz:'Fachplanung',brutto:false,regional:false,zuschlag:false,fundstelle:true},
  // 22.11.2026: Preise aus dem Internet (Hersteller, Händler, Index; Fundstelle = Adresse) und Schätzungen des
  // Assistenten («Annahme KI»), damit jeder Preis seine Herkunft zeigt, auch wenn er nicht aus einem Buch kommt.
  internet:{label:'Internet (Hersteller, Händler, Index)',kurz:'Internet',brutto:false,regional:false,zuschlag:false,fundstelle:true},
  annahme:{label:'Annahme TBA',kurz:'Annahme',brutto:false,regional:false,zuschlag:false,fundstelle:false},
  ki:{label:'Annahme KI (Assistent)',kurz:'Annahme KI',brutto:false,regional:false,zuschlag:false,fundstelle:false}
});
const MENGENQUELLEN=Object.freeze({archicad:'Archicad',fachplanung:'Fachplanung',manuell:'Handermittlung'});
const EINHEITEN=Object.freeze(['m²','m','m³','St','psch','kg','t']);

// ---------- Dezimalzahlen ----------
// Ergebnis immer kanonischer Text mit Punkt («1234.56»), null für leer, undefined für ungültig.
// dezimal(): gespeicherte Werte und Excel-Zahlen. Ein einzelner Punkt ist das Dezimalzeichen («1.045» = 1,045);
//   ein Komma heißt deutsche Schreibweise («1.234,56»).
// eingabe(): was jemand ins Feld tippt, deutsch gelesen: «1.250» ist 1250, «1,045» ist 1,045.
function dezimal(wert){return lese(wert,false)}
function eingabe(wert){return lese(wert,true)}
function lese(wert,deutsch){
  if(wert===null||wert===undefined)return null;
  if(typeof wert==='number'){
    if(!Number.isFinite(wert))return undefined;
    return kanonisch(String(wert).includes('e')?wert.toFixed(6):String(wert));
  }
  let s=String(wert).replace(/[\s\u00a0\u202f€%]/g,'').replace(/m²|m³|m2|m3|stk|st|psch/gi,'');
  if(s==='')return null;
  if(s.includes(',')){s=s.replace(/\./g,'').replace(',','.');}
  else{
    const punkte=(s.match(/\./g)||[]).length;
    if(punkte>1)s=s.replace(/\./g,'');
    else if(deutsch&&punkte===1&&/^-?\d{1,3}\.\d{3}$/.test(s))s=s.replace('.','');
  }
  if(/^-?\./.test(s))s=s.replace('.','0.');
  if(!/^-?\d+(\.\d+)?$/.test(s))return undefined;
  return kanonisch(s);
}
function kanonisch(s){
  let neg=s.startsWith('-');if(neg)s=s.slice(1);
  let [ganz,teil='']=s.split('.');
  ganz=ganz.replace(/^0+(?=\d)/,'');teil=teil.replace(/0+$/,'');
  const out=teil?ganz+'.'+teil:ganz;
  return (neg&&out!=='0')?'-'+out:out;
}
function mikro(text){ // kanonischer Text → BigInt in Millionsteln, kaufmännisch gerundet
  if(text===null||text===undefined)return null;
  const s=String(text);const neg=s.startsWith('-');const t=neg?s.slice(1):s;
  const [ganz,teil='']=t.split('.');
  const sechs=(teil+'0000000').slice(0,7);
  let v=BigInt(ganz||'0')*MIKRO+BigInt(sechs.slice(0,6));
  if(Number(sechs[6])>=5)v+=1n;
  return neg?-v:v;
}
function teile(a,b){ // a/b, kaufmännisch gerundet, b>0
  if(b===0n)throw new RangeError('Division durch null');
  const neg=(a<0n)!==(b<0n);const x=a<0n?-a:a,y=b<0n?-b:b;
  const q=(x*2n+y)/(2n*y);
  return neg?-q:q;
}
const mal=(a,b)=>teile(a*b,MIKRO);           // Mikro × Mikro → Mikro
const durch=(a,b)=>teile(a*MIKRO,b);         // Mikro ÷ Mikro → Mikro
const centAusMikro=m=>teile(m,MIKRO_JE_CENT);
const mikroAusCent=c=>c*MIKRO_JE_CENT;
const textAusMikro=(m,stellen=6)=>{ // kaufmännisch auf `stellen` Nachkommastellen gerundet
  const schritt=10n**BigInt(6-stellen);const r=teile(m,schritt);
  const neg=r<0n;const x=neg?-r:r;const basis=10n**BigInt(stellen);
  const ganz=x/basis;const rest=stellen?String(x%basis).padStart(stellen,'0').replace(/0+$/,''):'';
  return (neg?'-':'')+ganz+(rest?'.'+rest:'');
};

// ---------- Kostengruppen ----------
const KG=/^[1-8]\d\d$/;
function ebene(kg){if(!KG.test(String(kg)))return 0;return kg.endsWith('00')?1:kg.endsWith('0')?2:3}
function eltern(kg){const s=String(kg);return {e1:s[0]+'00',e2:s.slice(0,2)+'0',e3:ebene(s)===3?s:null}}
function katalogTitel(state,kg){
  const k=(state?.katalog||[]).find(x=>x.kg===String(kg));
  return k?.titel||'';
}

// ---------- Quartale (Kostenstand) ----------
const QUARTAL=/^(\d{4})-Q([1-4])$/;
function quartalIndex(q){const m=QUARTAL.exec(String(q||''));return m?Number(m[1])*4+Number(m[2])-1:null}
function quartalText(q){const m=QUARTAL.exec(String(q||''));return m?m[2]+'. Quartal '+m[1]:''}

// ---------- Kennwert und Herkunftskette ----------
function schalter(kw,name){const art=ARTEN[kw?.art];if(typeof kw?.[name]==='boolean')return kw[name];return !!art?.[name]}
function kennwertKette(kw,state){
  const schritte=[],hinweise=[];
  const wert=dezimal(kw?.wert);
  if(wert===undefined){hinweise.push('kennwert_ungueltig');return {nettoCent:null,schritte,hinweise}}
  if(wert===null){hinweise.push('kennwert_fehlt');return {nettoCent:null,schritte,hinweise}}
  let m=mikro(wert);
  const art=ARTEN[kw.art];
  schritte.push({art:'start',text:(art?.label||'Kennwert'),detail:kw.fundstelle||'',ergebnis:m});
  if(schalter(kw,'brutto')){
    const ust=mikro(dezimal(state?.ustProzent)??'19');
    const f=MIKRO+teile(ust,100n);
    m=durch(m,f);
    schritte.push({art:'ust',text:'ohne Umsatzsteuer',op:'÷',faktor:f,ergebnis:m});
  }
  const ziel=state?.kostenstand||'',von=kw.kostenstand||'';
  if(von&&ziel&&von!==ziel&&kw.indexieren!==false){
    const reihe=new Map();
    for(const x of state?.indizes||[]){const w=dezimal(x?.wert);if(quartalIndex(x?.quartal)!==null&&w&&mikro(w)>0n)reihe.set(x.quartal,w)}
    // Der letzte eingetragene Wert gilt für spätere, noch nicht veröffentlichte Quartale.
    const letzter=[...reihe.keys()].sort((a,b)=>quartalIndex(a)-quartalIndex(b)).pop()||null;
    const nimm=q=>reihe.has(q)?q:(letzter&&quartalIndex(q)!==null&&quartalIndex(q)>quartalIndex(letzter)?letzter:null);
    const qa=nimm(von),qn=nimm(ziel);
    if(qa&&qn){
      const f=durch(mikro(reihe.get(qn)),mikro(reihe.get(qa)));
      m=mal(m,f);
      const offen=[von,ziel].filter((q,i)=>(i?qn:qa)!==q);
      const schritt={art:'index',text:'Baupreisindex '+quartalText(von)+' → '+quartalText(ziel),op:'×',faktor:f,ergebnis:m};
      if(offen.length){
        schritt.vorlaeufig=letzter;
        schritt.detail=offen.map(quartalText).join(' und ')+' noch nicht veröffentlicht: gerechnet mit dem letzten Wert, '+quartalText(letzter)+' ('+zahl(reihe.get(letzter),1)+')';
        hinweise.push('index_vorlaeufig');
      }
      schritte.push(schritt);
    }else hinweise.push('index_fehlt');
  }
  if(schalter(kw,'regional')){
    const rf=dezimal(state?.regionalfaktor?.wert);
    if(rf&&mikro(rf)>0n){
      const f=mikro(rf);m=mal(m,f);
      schritte.push({art:'region',text:'Regionalfaktor',detail:state.regionalfaktor.fundstelle||'',op:'×',faktor:f,ergebnis:m});
    }else hinweise.push('regionalfaktor_fehlt');
  }
  if(schalter(kw,'zuschlag')){
    const z=dezimal(state?.zuschlag?.wert);
    if(z!==null&&z!==undefined){
      const f=MIKRO+teile(mikro(z),100n);m=mal(m,f);
      schritte.push({art:'zuschlag',text:'Zuschlag Gemeinkosten, Wagnis und Gewinn',detail:state.zuschlag.notiz||'',op:'×',faktor:f,ergebnis:m});
    }else hinweise.push('zuschlag_fehlt');
  }
  const nettoCent=centAusMikro(m);
  schritte.push({art:'ende',text:'In der Kostenberechnung',ergebnis:mikroAusCent(nettoCent)});
  return {nettoCent,schritte,hinweise};
}

// ---------- Position ----------
function position(pos,state){
  const kg=String(pos?.kg||'');
  const r={id:pos?.id,kg,ebene:ebene(kg),status:'offen',betragCent:null,kennwertCent:null,kette:null,fehlt:[],hinweise:[]};
  if(!KG.test(kg))r.fehlt.push('kg');
  if(pos?.status==='entfaellt'){r.status='entfaellt';r.betragCent=0n;return r}
  const kw=pos?.kennwert||{};
  const art=ARTEN[kw.art];
  if(!art)r.fehlt.push('quelle');
  else if(art.fundstelle&&!String(kw.fundstelle||'').trim())r.fehlt.push('fundstelle');
  if(pos?.modus==='betrag'){
    const b=dezimal(pos.betrag);
    if(b===null||b===undefined)r.fehlt.push('betrag');
    else r.betragCent=centAusMikro(mikro(b));
  }else{
    const menge=dezimal(pos?.menge);
    if(menge===null||menge===undefined)r.fehlt.push('menge');
    if(!MENGENQUELLEN[pos?.mengenquelle?.art])r.fehlt.push('mengenquelle');
    const kette=kennwertKette(kw,state);r.kette=kette;r.kennwertCent=kette.nettoCent;
    r.hinweise.push(...kette.hinweise.filter(h=>Object.prototype.hasOwnProperty.call(HINWEIS_TEXT,h)));
    if(kette.nettoCent===null)r.fehlt.push('kennwert');
    if(menge!==null&&menge!==undefined&&kette.nettoCent!==null)r.betragCent=teile(mikro(menge)*kette.nettoCent,MIKRO);
  }
  if(pos?.ausImportEntfernt)r.hinweise.push('nicht_mehr_im_modell');
  r.status=r.fehlt.length?'offen':'vollstaendig';
  return r;
}

// ---------- Ganze Kostenberechnung ----------
// Die Gliederung kommt aus dem Stand (Katalog). Jede KG ohne Unter-KG im Katalog ist ein Blatt und hat einen Stand:
//   vollstaendig  Positionen vollständig belegt      offen      Positionen mit Lücken
//   entfaellt     als «entfällt» markiert (auch über eine Eltern-KG) oder alle Positionen entfallen
//   enthalten     in einer Pauschale der Eltern-KG enthalten (z. B. Kostenbeitrag für KG 410 im Ganzen)
//   leer          noch nicht entschieden            frei       optional (im Katalog so markiert) und leer
// Vollständig ist die Kostenberechnung erst, wenn kein Blatt mehr leer oder offen ist.
// Kürzel eines Gewerks (GW) wie im Büro-Excel: BM, PU, MA …; leer heißt «ohne Gewerk».
function gewerkKurz(x){return String(x??'').trim().toUpperCase().replace(/\s+/g,'').slice(0,8)}
function kette(kg){const {e1,e2,e3}=eltern(kg);return [e1,e2,e3].filter((x,i,a)=>x&&a.indexOf(x)===i&&ebene(x)<=ebene(kg))}
function liegtUnter(blatt,knoten){
  if(blatt===knoten)return false;
  const e=ebene(knoten);
  return e===1?blatt[0]===knoten[0]:e===2?ebene(blatt)===3&&blatt.slice(0,2)===knoten.slice(0,2):false;
}
function berechne(state){
  if(!state||state.schema!==SCHEMA)throw new TypeError('Unbekannter Stand der Kostenberechnung');
  const markiert=state.gruppen||{};
  const katalog=(state.katalog||[]).filter(k=>KG.test(String(k.kg)));
  const ersteEbene=katalog.filter(k=>ebene(k.kg)===1).map(k=>k.kg);
  const knoten=new Map();
  const knotenFuer=kg=>{if(!knoten.has(kg))knoten.set(kg,{kg,ebene:ebene(kg),bekanntCent:0n,offen:0,anzahl:0,entfaellt:0,direkt:0,herkunft:{}});return knoten.get(kg)};
  for(const k of katalog)knotenFuer(k.kg);
  const entfaelltMarkiert=kg=>kette(kg).some(x=>markiert[x]?.status==='entfaellt');
  const positionen=[];
  let bekannt=0n,offenPos=0,anzahl=0;
  const herkunft={};
  for(const pos of state.positionen||[]){
    const r=position(pos,state);positionen.push(r);
    if(!KG.test(r.kg))continue;
    r.ausgeschlossen=entfaelltMarkiert(r.kg);
    if(r.ausgeschlossen)continue;
    const art=pos.kennwert?.art||'ohne';
    for(const kg of kette(r.kg)){
      const k=knotenFuer(kg);k.anzahl++;
      if(r.status==='offen')k.offen++;
      if(r.status==='entfaellt')k.entfaellt++;
      else if(kg===r.kg)k.direkt++;
      if(r.betragCent!==null){k.bekanntCent+=r.betragCent;k.herkunft[art]=(k.herkunft[art]||0n)+r.betragCent}
    }
    anzahl++;if(r.status==='offen')offenPos++;
    if(r.betragCent!==null){bekannt+=r.betragCent;herkunft[art]=(herkunft[art]||0n)+r.betragCent}
  }
  // Elemente (Gruppen von Positionen in einer KG, etwa «WDVS + Putz») und Gewerke (Kürzel der Vergabeeinheit, GW):
  // nur Summen über dieselben Positionen. Die Gliederung nach DIN 276 bleibt die Rechengrundlage, beide Sichten ergeben dieselbe Summe.
  const elementIds=new Set((state.elemente||[]).map(e=>e&&e.id).filter(Boolean));
  const elemente=new Map(),gewerke=new Map();
  const summeIn=(map,key)=>{if(!map.has(key))map.set(key,{bekanntCent:0n,anzahl:0,offen:0});return map.get(key)};
  (state.positionen||[]).forEach((pos,i)=>{
    const r=positionen[i];if(!r||!KG.test(r.kg)||r.ausgeschlossen)return;
    r.element=elementIds.has(pos?.element)?pos.element:null;r.gewerk=gewerkKurz(pos?.gewerk);
    const ziele=[summeIn(gewerke,r.gewerk)];if(r.element)ziele.push(summeIn(elemente,r.element));
    for(const z of ziele){z.anzahl++;if(r.status==='offen')z.offen++;if(r.betragCent!==null)z.bekanntCent+=r.betragCent}
  });
  // Blätter und ihr Stand.
  const hatKinder=new Set();
  for(const k of katalog){const e=ebene(k.kg);if(e>=2)hatKinder.add(k.kg[0]+'00');if(e===3)hatKinder.add(k.kg.slice(0,2)+'0')}
  const optional=new Set(katalog.filter(k=>k.optional).map(k=>k.kg));
  const pauschalDarueber=kg=>kette(kg).some(x=>x!==kg&&(knoten.get(x)?.direkt||0)>0);
  const blaetter=new Map();
  for(const k of katalog){
    if(hatKinder.has(k.kg))continue;
    const n=knoten.get(k.kg);let s;
    if(entfaelltMarkiert(k.kg))s='entfaellt';
    else if(n.anzahl>0)s=n.offen?'offen':(n.entfaellt===n.anzahl?'entfaellt':'vollstaendig');
    else if(pauschalDarueber(k.kg))s='enthalten';
    else s=optional.has(k.kg)?'frei':'leer';
    blaetter.set(k.kg,s);
  }
  const zaehle=s=>s==='frei'?[0,0,0]:(s==='leer'||s==='offen')?[1,0,1]:[1,1,0]; // [zählt, geklärt, zu klären]
  for(const n of knoten.values()){
    if(blaetter.has(n.kg)){
      const [g,k,z]=zaehle(blaetter.get(n.kg));n.blatt=true;n.status=blaetter.get(n.kg);n.kgGesamt=g;n.geklaert=k;n.zuKlaeren=z;continue;
    }
    let g=0,k=0,z=0,entf=0;
    for(const [b,s] of blaetter){if(!liegtUnter(b,n.kg))continue;const [a,c,d]=zaehle(s);g+=a;k+=c;z+=d;if(s==='entfaellt')entf++}
    n.blatt=false;n.kgGesamt=g;n.geklaert=k;n.zuKlaeren=z;
    n.status=markiert[n.kg]?.status==='entfaellt'||(g>0&&entf===g)?'entfaellt':(z||n.offen?'offen':(g||n.anzahl?'vollstaendig':'leer'));
  }
  const leer=[...blaetter].filter(([,s])=>s==='leer').map(([kg])=>kg);
  let geklaert=0,zuKlaeren=0;
  for(const s of blaetter.values()){const [,k,z]=zaehle(s);geklaert+=k;zuKlaeren+=z}
  const vollstaendig=offenPos===0&&zuKlaeren===0&&(anzahl>0||geklaert>0);
  const ust=mikro(dezimal(state.ustProzent)??'19');
  const ustCent=teile(bekannt*ust,100n*MIKRO);
  // Kennzahlen: Bauwerk = KG 300 + KG 400.
  const bauwerk=(knoten.get('300')?.bekanntCent||0n)+(knoten.get('400')?.bekanntCent||0n);
  const bezug=name=>{const d=dezimal(state.bezug?.[name]);return d&&mikro(d)>0n?mikro(d):null};
  const je=(cent,m)=>m?teile(cent*MIKRO,m):null;
  // Vergleich mit der Kostenschätzung, je KG der 1. Ebene.
  const vergleich=ersteEbene.map(kg=>{
    const ksText=dezimal(state.kostenschaetzung?.[kg]);
    const ks=ksText===null||ksText===undefined?null:centAusMikro(mikro(ksText));
    const kb=knoten.get(kg)?.bekanntCent||0n;
    const delta=ks===null?null:kb-ks;
    return {kg,ksCent:ks,kbCent:kb,deltaCent:delta,deltaProzent:(ks&&ks!==0n)?Number(teile(delta*10000n,ks))/100:null,
      ursache:String(state.ursachen?.[kg]||''),entfaellt:knoten.get(kg)?.status==='entfaellt'};
  });
  const ksSumme=vergleich.some(v=>v.ksCent!==null)?vergleich.reduce((s,v)=>s+(v.ksCent||0n),0n):null;
  const vorgabeText=dezimal(state.kostenvorgabe);
  const vorgabe=vorgabeText===null||vorgabeText===undefined?null:centAusMikro(mikro(vorgabeText));
  // Fortschritt: geklärte Kostengruppen; ohne Katalog ersatzweise die Positionen.
  let erledigt=geklaert,gesamtZahl=geklaert+zuKlaeren;
  if(!blaetter.size){erledigt=positionen.filter(p=>!p.ausgeschlossen&&p.status!=='offen').length;gesamtZahl=positionen.filter(p=>!p.ausgeschlossen).length}
  const ergebnis={
    schema:'tba.office.kostenberechnung.ergebnis.v1',
    positionen,knoten,blaetter,elemente,gewerke,
    gesamt:{bekanntCent:bekannt,gesamtCent:vollstaendig?bekannt:null,offen:offenPos+leer.length,offenePositionen:offenPos,ohneAnsatz:leer.length,anzahl,vollstaendig},
    ustCent,bruttoCent:bekannt+ustCent,
    vollstaendigkeit:{erledigt,gesamt:gesamtZahl,prozent:gesamtZahl?Math.floor(erledigt*100/gesamtZahl):0,nachKg:blaetter.size>0},
    kennzahlen:{bauwerkCent:bauwerk,jeBGF:je(bauwerk,bezug('BGF')),jeBRI:je(bauwerk,bezug('BRI'))},
    herkunft,
    vergleich,ksSummeCent:ksSumme,deltaSummeCent:ksSumme===null?null:bekannt-ksSumme,
    vorgabe:{cent:vorgabe,differenzCent:vorgabe===null?null:bekannt-vorgabe}
  };
  ergebnis.fehlt=wasFehlt(state,ergebnis,leer);
  return ergebnis;
}

// Paare, bei denen die Bekleidung meist im Aufbau steckt und leicht vergessen wird.
const PAARE=Object.freeze([
  {wenn:['331','332'],dann:['335','336']},
  {wenn:['341','342'],dann:['345']},
  {wenn:['361'],dann:['363','364']}
]);
const HINWEIS_TEXT=Object.freeze({
  index_fehlt:'Baupreisindex für einen Kostenstand fehlt',
  index_vorlaeufig:'Baupreisindex für den Kostenstand noch nicht veröffentlicht, gerechnet mit dem letzten Wert',
  regionalfaktor_fehlt:'Regionalfaktor fehlt (BKI-Werte sind Bundesdurchschnitt)',
  zuschlag_fehlt:'Zuschlag für Gemeinkosten, Wagnis und Gewinn fehlt',
  nicht_mehr_im_modell:'nicht mehr im Archicad-Modell'
});
const FEHLT_TEXT=Object.freeze({kg:'Kostengruppe',quelle:'Quelle',fundstelle:'Fundstelle',betrag:'Betrag',menge:'Menge',
  mengenquelle:'Herkunft der Menge',kennwert:'Kennwert'});

const FEHLT_REIHE=['kg','menge','betrag','kennwert','mengenquelle','quelle','fundstelle'];
function fehltText(fehlt){
  const t=[...fehlt].sort((a,b)=>FEHLT_REIHE.indexOf(a)-FEHLT_REIHE.indexOf(b)).map(f=>FEHLT_TEXT[f]||f);
  if(t.length===1)return t[0]+' fehlt';
  return t.slice(0,-1).join(', ')+' und '+t[t.length-1]+' fehlen';
}
const GRUNDLAGE=new Set(['index_fehlt','index_vorlaeufig','regionalfaktor_fehlt','zuschlag_fehlt']);
function wasFehlt(state,e,leer){
  const liste=[],grundlagen=new Map();
  const name=kg=>'KG '+kg+(katalogTitel(state,kg)?' '+katalogTitel(state,kg):'');
  // Kostengruppen ohne Ansatz, je Eltern-KG zusammengefasst.
  const jeEltern=new Map();
  for(const kg of leer){const p=ebene(kg)===3?kg.slice(0,2)+'0':kg[0]+'00';if(!jeEltern.has(p))jeEltern.set(p,[]);jeEltern.get(p).push(kg)}
  for(const [p,kgs] of jeEltern)liste.push({art:'leer',schwere:'hoch',kg:p,kgs,
    text:name(p)+': '+(kgs.length===1?'KG '+kgs[0]:kgs.join(', '))+' ohne Ansatz'});
  // Pauschale und Einzelpositionen in derselben KG zugleich.
  for(const k of e.knoten.values()){
    if(k.ebene===3||!k.direkt)continue;
    if(k.anzahl-k.entfaellt-k.direkt>0)liste.push({art:'doppelt',schwere:'hoch',kg:k.kg,
      text:name(k.kg)+': Pauschale und Positionen in den Unter-Kostengruppen zugleich – doppelt gezählt?'});
  }
  for(const p of e.positionen){
    if(p.ausgeschlossen)continue;
    const pos=(state.positionen||[]).find(x=>x.id===p.id)||{};
    const titel=pos.titel||katalogTitel(state,p.kg)||'';
    if(p.status==='offen'){
      liste.push({art:'position',schwere:'hoch',kg:p.kg,positionId:p.id,
        text:'KG '+p.kg+(titel?' '+titel:'')+(pos.bauteiltyp?' · '+pos.bauteiltyp:'')+': '+fehltText(p.fehlt)});
    }
    for(const h of [...new Set(p.hinweise)]){
      if(GRUNDLAGE.has(h)){grundlagen.set(h,(grundlagen.get(h)||0)+1);continue}
      liste.push({art:'hinweis',schwere:'info',kg:p.kg,positionId:p.id,code:h,
        text:'KG '+p.kg+(pos.bauteiltyp?' · '+pos.bauteiltyp:'')+': '+(HINWEIS_TEXT[h]||h)});
    }
  }
  // Fehlende Grundlagen (Index, Regionalfaktor, Zuschlag) einmal nennen, mit der Zahl der betroffenen Positionen.
  for(const [h,n] of grundlagen)liste.push({art:'grundlage',schwere:h==='index_vorlaeufig'?'info':'hoch',code:h,anzahl:n,
    text:HINWEIS_TEXT[h]+': betrifft '+n+(n===1?' Position':' Positionen')});
  const mitWert=new Set(e.positionen.filter(p=>!p.ausgeschlossen&&p.betragCent!==null&&p.status!=='entfaellt').map(p=>p.kg));
  const vorhanden=new Set(e.positionen.filter(p=>!p.ausgeschlossen).map(p=>p.kg));
  const entschieden=kg=>{const s=e.knoten.get(kg)?.status;return s==='entfaellt'||s==='enthalten'};
  for(const paar of PAARE){
    if(paar.wenn.some(k=>mitWert.has(k))&&!paar.dann.some(k=>vorhanden.has(k)||entschieden(k)))
      liste.push({art:'paar',schwere:'info',kg:paar.dann[0],
        text:paar.wenn.filter(k=>mitWert.has(k)).map(k=>'KG '+k).join(' und ')+' ohne '+paar.dann.map(k=>'KG '+k).join(' oder ')+': Bekleidung vergessen?'});
  }
  if(!dezimal(state.bezug?.BGF))liste.push({art:'bezug',schwere:'info',text:'BGF fehlt: ohne sie keine Kennzahl €/m² BGF'});
  if(e.ksSummeCent===null)liste.push({art:'vergleich',schwere:'info',text:'Kostenschätzung zum Vergleich fehlt'});
  for(const v of e.vergleich){
    if(v.entfaellt||v.deltaCent===null)continue;
    const abs=v.deltaCent<0n?-v.deltaCent:v.deltaCent;
    if((Math.abs(v.deltaProzent??0)>=5||abs>=1000000n)&&!v.ursache.trim())
      liste.push({art:'ursache',schwere:'hoch',kg:v.kg,text:name(v.kg)+': Abweichung zur Kostenschätzung ohne Ursache'});
  }
  return liste;
}

// Vorschlag für ein Aufbau-Rezept: welche KG der 3. Ebene eine Archicad-Menge meist mitträgt.
function rezeptVorschlag(kg){
  const s=String(kg);
  const map={'331':[['331','1'],['335','1'],['336','1']],'332':[['332','1'],['335','1'],['336','1']],
    '341':[['341','1'],['345','2']],'342':[['342','1'],['345','2']],'361':[['361','1'],['363','1'],['364','1']]};
  return (map[s]||[[s,'1']]).map(([k,faktor])=>({kg:k,faktor}));
}

// ---------- Anzeige ----------
const fmt0=new Intl.NumberFormat('de-DE',{maximumFractionDigits:0});
function euro(cent,{nachkomma=false,vorzeichen=false}={}){
  if(cent===null||cent===undefined)return '–';
  const c=BigInt(cent);const neg=c<0n;const x=neg?-c:c;
  let txt;
  if(nachkomma){txt=fmt0.format(Number(x/100n))+','+String(x%100n).padStart(2,'0')}
  else txt=fmt0.format(Number(teile(x,100n)));
  return (neg?'−':(vorzeichen&&c>0n?'+':''))+txt+' €';
}
function zahl(text,stellen=2){
  const d=typeof text==='bigint'?textAusMikro(text):dezimal(text);
  if(d===null||d===undefined)return '';
  return new Intl.NumberFormat('de-DE',{maximumFractionDigits:stellen}).format(Number(d));
}
function prozent(p,{vorzeichen=false}={}){
  if(p===null||p===undefined||!Number.isFinite(p))return '–';
  return (p<0?'−':(vorzeichen&&p>0?'+':''))+new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(Math.abs(p))+' %';
}

return Object.freeze({SCHEMA,ARTEN,MENGENQUELLEN,EINHEITEN,PAARE,dezimal,eingabe,mikro,textAusMikro,centAusMikro,teile,
  ebene,eltern,kette,liegtUnter,gewerkKurz,katalogTitel,quartalIndex,quartalText,kennwertKette,position,berechne,rezeptVorschlag,euro,zahl,prozent});
});
