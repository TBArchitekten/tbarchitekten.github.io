/* TBA Office · Kostenberechnung · Datenpool (23.11.2026, Claude, Auftrag Gari).
   Rein und ohne DOM. Die Positionen aller Kostenberechnungen des Büros, laufend und archiviert, sind der Datenpool:
   jeder Einheitspreis mit Herkunft (Projekt, Zeile oder Seite, Quelle im Original, Kostenstand, Reifegrad).
   Gelernt von vergleichbaren Werkzeugen (Recherche vom 23.11.2026):
   - NOVA AVA, werk-material.online: eigene Projekte als Vergleich, Preisstand mit Datum, über den Baupreisindex fortgeschrieben;
   - BauKoDat: viele Werte zu einer Leistung zusammenfassen und Ausreißer erkennen; hier markiert, nie entfernt;
   - BCIS: Spanne und Lage statt eines einzigen Werts; bei wenigen Werten keine Quartile, nur Spanne und Median;
   - BKI: der Reifegrad zählt, eine Kostenberechnung ist keine Abrechnung.
   Darüber hinaus: derselbe Wert in mehreren Kostenberechnungen gilt als übernommen und zählt einmal. Sein Kostenstand ist
   der des ältesten Vorkommens, denn dort wurde er ermittelt; fortgeschrieben wird von dort aus.
   23.11.2026, abends: Bei einem auffälligen Paar wird die Zeile markiert, die im Original nicht in der Summe steht
   (an den vier Archiv-Ständen 8 von 9 Fällen); vorher entschied die Reihenfolge der Liste. Gleiche Zeilen einer
   Kostenberechnung zählen dabei als ein Wert, damit ein Paar nicht zweimal erscheint.
   24.11.2026: normiere sagt, wenn der Index des Ziels noch nicht veröffentlicht ist (vorlaeufig = letztes Quartal der Reihe). */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TBA_KOSTEN_POOL=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';

const REIFEGRAD=Object.freeze({schaetzung:'Kostenschätzung',berechnung:'Kostenberechnung',fortschreibung:'Kostenfortschreibung',
  anschlag:'Kostenanschlag',feststellung:'Kostenfeststellung',laufend:'laufende Kostenberechnung'});
// Herkunft eines Preises im Original; «geschätzt» und «ohne Angabe» unterscheiden sich nur im Archiv (Kommentar ja oder nein).
const HERKUNFT=Object.freeze({angebot:'Angebot',bki:'BKI',fachplanung:'Fachplanung',eigen:'anderes Projekt',abgerechnet:'abgerechnet',
  geschaetzt:'geschätzt',ohne:'ohne Angabe',annahme:'Annahme',heinze:'Heinze',internet:'Internet',ki:'Annahme KI'});
// Dieselbe Leistung steht je nach Bauteil in der einen oder der anderen Kostengruppe.
const VERWANDT=Object.freeze({'324':['353'],'353':['324'],'336':['345'],'345':['336'],'354':['364'],'364':['354'],
  '331':['341'],'341':['331'],'332':['342'],'342':['332'],'351':['361'],'361':['351'],'335':['336'],'363':['353']});
const FUELL=new Set(['und','mit','inkl','ink','der','die','das','den','dem','des','für','von','auf','aus','bis','zur','zum','als',
  'ohne','oder','bei','nach','pos','stk','teilw','ggf','bzw','ca']);

// ---------- Text ----------
function normText(t){return String(t||'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9äöü]+/g,' ').trim()}
function trigramme(t){const s=' '+normText(t)+' ',g=new Set();for(let i=0;i+3<=s.length;i++)g.add(s.slice(i,i+3));return g}
function woerter(t){return normText(t).split(' ').filter(w=>w.length>=3&&!FUELL.has(w)&&!/^\d+$/.test(w))}
function dice(a,b){if(!a.size||!b.size)return 0;let n=0;for(const x of a)if(b.has(x))n++;return 2*n/(a.size+b.size)}
function enthalten(a,b){if(!a.size||!b.size)return 0;let n=0;for(const x of a)if(b.has(x))n++;return n/a.size}
// Frage einmal vorbereiten, dann gegen viele Einträge messen.
function frage(text){const w=woerter(text);return {text:normText(text),tri:trigramme(text),woerter:w,kurz:w.length<=2}}
// 0 … 1. Kurze Suchwörter (die jemand tippt) dürfen in einem langen Text stecken; lange Bezeichnungen müssen ähnlich sein.
// Die Bezeichnung zählt voll; Element und Kommentar (etwa «Abwasserleitungen» unter «Abwasseranlagen») nur zum Teil.
function aehnlich(f,e){
  if(!f.tri.size)return 0;
  const anteil=t=>f.woerter.length?f.woerter.filter(x=>t.includes(x)).length/f.woerter.length:0;
  const d=dice(f.tri,e.triTitel),wt=anteil(e.titelText),wa=anteil(e.text);
  const k=f.kurz?0.9*enthalten(f.tri,e.triTitel):0;
  return Math.max(d,f.kurz?wt:0.9*wt,0.6*wa,k);
}
// Ein gemeinsames Wort (auch als Teil eines zusammengesetzten: «Fliesen» in «Wandfliesen»).
function gemeinsamesWort(a,b){return a.woerterTitel.some(x=>x.length>=4&&b.woerterTitel.some(y=>y.includes(x)||x.includes(y)&&y.length>=4))}
function gleicheLeistung(a,b,schwelle){return dice(a.triTitel,b.triTitel)>=schwelle&&gemeinsamesWort(a,b)}
function kgNah(a,b){const x=a.kg.slice(0,2),y=b.kg.slice(0,2);return x===y||(VERWANDT[a.kg]||[]).some(k=>k.slice(0,2)===y)}

// ---------- Zahlen ----------
const MIKRO=1000000n;
function centText(c){const x=BigInt(c),neg=x<0n,a=neg?-x:x;return (neg?'-':'')+(a/100n)+'.'+String(a%100n).padStart(2,'0')}
function wertText(c,R){return R.dezimal(centText(c))}
function medianCent(werte){
  const s=[...werte].sort((a,b)=>(a<b?-1:a>b?1:0));if(!s.length)return null;
  const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2n;
}
// Einen Wert vom Kostenstand «von» auf den der Ziel-Kostenberechnung bringen, mit deren Baupreisindex (Rechenkern, gleiche Rundung).
function normiere(cent,von,ziel,R){
  if(!ziel||!ziel.kostenstand||!von||von===ziel.kostenstand)return {cent:BigInt(cent),faktor:null,fehlt:false,gleich:true};
  const k=R.kennwertKette({art:'eigen',wert:wertText(cent,R),kostenstand:von},ziel);
  const schritt=(k.schritte||[]).find(s=>s.art==='index');
  if(!schritt||k.nettoCent===null)return {cent:BigInt(cent),faktor:null,fehlt:true,gleich:false};
  return {cent:k.nettoCent,faktor:Number(R.textAusMikro(schritt.faktor,4)),fehlt:false,gleich:false,vorlaeufig:schritt.vorlaeufig||null};
}

// ---------- Einträge ----------
function herkunftVon(p,archiv){
  const art=p?.kennwert?.art||'';
  if(p?.archivAbgerechnet)return 'abgerechnet';
  if(art==='annahme')return archiv?(String(p.archivKommentar??'').trim()?'geschaetzt':'ohne'):'annahme';
  return HERKUNFT[art]?art:'ohne';
}
function quelleKurz(p,archiv){
  if(p?.archivZeile)return 'Zeile '+p.archivZeile;
  if(p?.archivSeite)return 'PDF S. '+p.archivSeite;
  return archiv?'':'laufend';
}
// Alle Einheitspreise (Menge × EP) mit gültiger Einheit; Pauschalen und Beträge ohne Einheit sind keine Kennwerte.
function eintraege(instanzen,R){
  const out=[];
  for(const i of instanzen||[]){
    const st=i?.state;if(!st||st.schema!==R.SCHEMA)continue;
    const archiv=!!i.is_archived,a=st.archiv||{};
    const elemente=new Map((st.elemente||[]).map(e=>[e.id,e]));
    for(const p of st.positionen||[]){
      if(p?.modus==='betrag'||!R.EINHEITEN.includes(p?.einheit))continue;
      const kw=p.kennwert||{};
      let kette;try{kette=R.kennwertKette(kw,st)}catch{continue}
      if(kette.nettoCent===null||kette.nettoCent<=0n)continue;
      const indexiert=(kette.schritte||[]).some(s=>s.art==='index');
      const element=elemente.get(p.element)?.titel||'';
      const kommentar=String(p.archivKommentar??(archiv?'':p.notiz)??'');
      // Steht nur der Titel der Kostengruppe da (Vorlagezeile), beschreibt der Kommentar die Leistung.
      const titel=String(p.titel||'').trim(),kt=R.katalogTitel(st,p.kg);
      const generisch=!titel||(kt&&(normText(titel).startsWith(normText(kt))||dice(trigramme(titel),trigramme(kt))>=0.7));
      const bez=generisch&&kommentar.trim()?kommentar:(titel||element);
      const text=[titel,element,kommentar].filter(Boolean).join(' ');
      out.push({instanz:i.id,position:p.id,nr:String(i.project_number||''),projekt:String(i.project_name||''),archiv,
        kg:String(p.kg||''),titel,element,kommentar,einheit:p.einheit,epCent:kette.nettoCent,menge:R.dezimal(p.menge),
        kostenstand:indexiert?String(st.kostenstand||''):String(kw.kostenstand||st.kostenstand||''),
        herkunft:herkunftVon(p,archiv),quelle:quelleKurz(p,archiv),fundstelle:String(kw.fundstelle||''),
        nichtInSumme:p.status==='entfaellt',abgerechnet:!!p.archivAbgerechnet,
        reifegrad:p.archivAbgerechnet?'feststellung':(a.reifegrad||(archiv?'berechnung':'laufend')),
        dokument:String(a.dokumentKurz||''),stand:String(a.stand||''),massnahme:String(a.massnahme||''),gebaeude:String(a.gebaeude||''),
        bez,text:normText(text),titelText:normText(bez),triTitel:trigramme(bez),woerterTitel:woerter(bez)});
    }
  }
  return out;
}

// ---------- Suche ----------
// opt: {text, kg, verwandt, alleKg, einheit, andereEinheiten, nurAngebote, nurNeubau, ohneInstanz}
function suche(liste,opt={}){
  const f=frage(opt.text||'');
  const kgs=opt.alleKg||!opt.kg?null:new Set([opt.kg,...(opt.verwandt?VERWANDT[opt.kg]||[]:[])]);
  const out=[];
  for(const e of liste){
    if(opt.ohneInstanz&&e.instanz===opt.ohneInstanz)continue;
    if(kgs&&!kgs.has(e.kg))continue;
    if(opt.nurAngebote&&e.herkunft!=='angebot')continue;
    if(opt.nurNeubau&&e.massnahme==='Bestand')continue;
    const passt=!opt.einheit||e.einheit===opt.einheit;
    if(!passt&&!opt.andereEinheiten)continue;
    const s=f.tri.size?aehnlich(f,e):0.5;
    if(f.tri.size&&s<0.34)continue;
    out.push({e,score:s+(opt.kg&&e.kg===opt.kg?0.1:0),passt});
  }
  return out.sort((a,b)=>b.score-a.score||(b.e.kostenstand>a.e.kostenstand?1:-1));
}
// Gleicher Wert in gleicher Einheit ist ein Ansatz; in mehreren Kostenberechnungen gilt er als übernommen.
function gruppiere(treffer){
  const map=new Map();
  for(const t of treffer){
    const key=t.e.einheit+'|'+t.e.epCent;
    if(!map.has(key))map.set(key,{key,epCent:t.e.epCent,einheit:t.e.einheit,vorkommen:[],score:0,passt:t.passt});
    const g=map.get(key);g.vorkommen.push(t.e);g.score=Math.max(g.score,t.score);
  }
  const gruppen=[...map.values()];
  for(const g of gruppen){
    g.vorkommen.sort((a,b)=>(a.kostenstand<b.kostenstand?-1:a.kostenstand>b.kostenstand?1:0)||(a.stand<b.stand?-1:1));
    g.ursprung=g.vorkommen[0];
    g.projekte=[...new Set(g.vorkommen.map(e=>e.instanz))].map(id=>g.vorkommen.find(e=>e.instanz===id));
    g.kopie=g.projekte.length>1;
    g.nichtInSumme=g.vorkommen.every(e=>e.nichtInSumme);
    g.abgerechnet=g.vorkommen.some(e=>e.abgerechnet);
    g.bestand=g.vorkommen.every(e=>e.massnahme==='Bestand');
  }
  return gruppen.sort((a,b)=>b.score-a.score||Number(b.kopie)-Number(a.kopie)||(a.epCent<b.epCent?-1:1));
}
// Spanne und Median über die unabhängigen Werte (je Gruppe einer), fortgeschrieben, wenn der Index für alle da ist.
function statistik(gruppen,ziel,R){
  const nutzbar=gruppen.filter(g=>g.passt!==false);
  const norm=nutzbar.map(g=>({g,n:normiere(g.epCent,g.ursprung.kostenstand,ziel,R)}));
  // stand: «gleich» (alle schon auf dem Kostenstand), «fortgeschrieben» (Index für alle da), sonst «ohneIndex» (Werte wie eingetragen)
  const fehlt=norm.some(x=>x.n.fehlt),stand=fehlt?'ohneIndex':norm.some(x=>!x.n.gleich)?'fortgeschrieben':'gleich';
  const werte=norm.map(x=>fehlt?x.g.epCent:x.n.cent);
  const n=werte.length,median=medianCent(werte);
  const auffaellig=new Set();
  if(n>=3&&median>0n)for(const [i,x] of norm.entries()){const v=werte[i];if(v*10n>=median*25n||v*25n<=median*10n)auffaellig.add(x.g.key)}
  return {n,minCent:n?werte.reduce((a,b)=>a<b?a:b):null,maxCent:n?werte.reduce((a,b)=>a>b?a:b):null,medianCent:median,
    stand,auffaellig,projekte:new Set(nutzbar.flatMap(g=>g.vorkommen.map(e=>e.instanz))).size};
}
// Kennwert «Eigenes Projekt» aus einer Gruppe: Wert, Fundstelle mit Zeile und Stand, Kostenstand des Ursprungs.
function uebernahme(g,R){
  const u=g.ursprung;
  const andere=g.projekte.filter(e=>e.instanz!==u.instanz).map(e=>e.nr);
  const dort=u.herkunft&&!['ohne','geschaetzt','annahme'].includes(u.herkunft)?' · dort: '+HERKUNFT[u.herkunft]:'';
  const fund=('Kostenberechnung '+[u.nr,u.projekt].filter(Boolean).join(' ')+(u.quelle&&u.quelle!=='laufend'?', '+u.quelle:'')+
    (u.dokument?' ('+u.dokument+')':'')+(andere.length?' · gleicher Wert auch in '+andere.join(', '):'')+dort).slice(0,240);
  return {art:'eigen',wert:wertText(g.epCent,R),fundstelle:fund,kostenstand:u.kostenstand,pool:{instanz:u.instanz,position:u.position}};
}

// ---------- Kostenarchiv ----------
function archivZeilen(instanzen,R){
  const out=[];
  for(const i of instanzen||[]){
    const st=i?.state;if(!st||st.schema!==R.SCHEMA)continue;
    let e=null;try{e=R.berechne(st)}catch{}
    const kg300=e?.knoten.get('300')?.bekanntCent??null;
    const bgf=R.dezimal(st.bezug?.BGF);
    const jeBgf=kg300!==null&&bgf&&R.mikro(bgf)>0n?R.teile(kg300*MIKRO,R.mikro(bgf)):null;
    const herkunft={};
    for(const p of st.positionen||[]){const h=herkunftVon(p,true);herkunft[h]=(herkunft[h]||0)+1}
    const a=st.archiv||{};
    out.push({id:i.id,nr:String(i.project_number||''),name:String(i.project_name||''),gebaeude:String(a.gebaeude||''),bauweise:String(a.bauweise||''),
      massnahme:String(a.massnahme||''),ort:String(a.ort||''),stand:String(a.stand||''),dokument:String(a.dokumentKurz||a.dokument||''),
      reifegrad:String(a.reifegrad||'berechnung'),quelle:String(a.quelle||''),kostenstand:String(st.kostenstand||''),
      kg300Cent:kg300,jeBgfCent:jeBgf,gesamtCent:e?.gesamt.bekanntCent??null,positionen:(st.positionen||[]).length,
      inSumme:(st.positionen||[]).filter(p=>p.status!=='entfaellt').length,herkunft});
  }
  return out.sort((a,b)=>(a.stand<b.stand?1:-1));
}
// Ähnliche Einträge aus anderen Kostenberechnungen: gleiche Einheit, gleiche oder verwandte KG der 2. Ebene, ähnliche Bezeichnung.
function eimer(liste){
  const m=new Map();
  for(const e of liste){const k=e.einheit+'|'+e.kg.slice(0,2);if(!m.has(k))m.set(k,[]);m.get(k).push(e)}
  return m;
}
function nachbarn(e,m,schwelle){
  const kgs=new Set([e.kg.slice(0,2),...(VERWANDT[e.kg]||[]).map(k=>k.slice(0,2))]);
  const out=[];
  for(const k of kgs)for(const x of m.get(e.einheit+'|'+k)||[])if(x.instanz!==e.instanz&&gleicheLeistung(e,x,schwelle))out.push(x);
  return out;
}
// Übernommen statt neu ermittelt: gleicher Preis, gleiche Einheit, gleiche Leistung in mindestens zwei Kostenberechnungen.
// Zusammenhängende Gruppen (auch mehrere Zeilen derselben Kostenberechnung) zählen als ein Ansatz.
function uebernommen(liste,{schwelle=0.65}={}){
  const eimerWert=new Map();
  for(const e of liste){if(e.einheit==='psch')continue;const k=e.einheit+'|'+e.epCent;if(!eimerWert.has(k))eimerWert.set(k,[]);eimerWert.get(k).push(e)}
  const out=[];
  for(const zeilen of eimerWert.values()){
    if(new Set(zeilen.map(e=>e.instanz)).size<2)continue;
    const chef=zeilen.map((_,i)=>i),finde=i=>chef[i]===i?i:(chef[i]=finde(chef[i]));
    for(let i=0;i<zeilen.length;i++)for(let j=i+1;j<zeilen.length;j++)
      if(kgNah(zeilen[i],zeilen[j])&&gleicheLeistung(zeilen[i],zeilen[j],schwelle))chef[finde(i)]=finde(j);
    const teile=new Map();zeilen.forEach((e,i)=>{const r=finde(i);if(!teile.has(r))teile.set(r,[]);teile.get(r).push(e)});
    for(const alle of teile.values()){
      const projekte=[...new Set(alle.map(x=>x.nr))];if(projekte.length<2)continue;
      const jahre=alle.map(x=>Number(String(x.kostenstand).slice(0,4))).filter(Boolean);
      const kurz=[...alle].sort((a,b)=>a.bez.length-b.bez.length)[0];
      out.push({titel:kurz.bez,epCent:alle[0].epCent,einheit:alle[0].einheit,projekte,vorkommen:alle,
        von:jahre.length?Math.min(...jahre):null,bis:jahre.length?Math.max(...jahre):null});
    }
  }
  return out.sort((a,b)=>b.projekte.length-a.projekte.length||b.vorkommen.length-a.vorkommen.length||(b.epCent>a.epCent?1:-1));
}
// Auffällig: mindestens dreimal so hoch oder ein Drittel so hoch wie dieselbe Leistung in anderen Kostenberechnungen.
function auffaellig(liste,{schwelle=0.6,faktor=3}={}){
  const m=eimer(liste.filter(e=>e.einheit!=='psch')),out=[],gesehen=new Set();
  // Gleiche Zeilen einer Kostenberechnung (Titel und Preis) sind ein Wert.
  const schluessel=e=>e.instanz+'|'+e.titelText+'|'+e.epCent;
  for(const e of liste){
    if(e.einheit==='psch')continue;
    const n=nachbarn(e,m,schwelle).filter(x=>x.epCent!==e.epCent);
    if(!n.length)continue;
    const med=medianCent(n.map(x=>x.epCent));if(!med||med<=0n)continue;
    const f=Number(e.epCent)/Number(med);
    if(f<faktor&&f>1/faktor)continue;
    const key=schluessel(e);if(gesehen.has(key))continue;gesehen.add(key);
    const vergleich=[...new Set(n.map(x=>x.nr))];
    out.push({e,n,medianCent:med,faktor:f,vergleich,minCent:n.reduce((a,x)=>x.epCent<a?x.epCent:a,n[0].epCent),
      maxCent:n.reduce((a,x)=>x.epCent>a?x.epCent:a,n[0].epCent)});
  }
  // Wer mehr Vergleichswerte hat, ist eher der Ausreißer; bei Gleichstand die Zeile außerhalb der Summe des Originals.
  // Ein Paar (A gegen B, B gegen A) erscheint nur einmal.
  out.sort((a,b)=>b.vergleich.length-a.vergleich.length||new Set(b.n.map(y=>y.epCent)).size-new Set(a.n.map(y=>y.epCent)).size||
    (b.e.nichtInSumme?1:0)-(a.e.nichtInSumme?1:0)||Math.abs(Math.log(b.faktor))-Math.abs(Math.log(a.faktor)));
  const belegt=new Set(),fall=[];
  for(const x of out){
    if(belegt.has(schluessel(x.e))&&x.n.every(y=>belegt.has(schluessel(y))))continue;
    belegt.add(schluessel(x.e));for(const y of x.n)belegt.add(schluessel(y));
    fall.push(x);
  }
  return fall;
}

return Object.freeze({REIFEGRAD,HERKUNFT,VERWANDT,normText,trigramme,frage,aehnlich,dice,gleicheLeistung,centText,medianCent,normiere,
  herkunftVon,eintraege,suche,gruppiere,statistik,uebernahme,archivZeilen,uebernommen,auffaellig});
});
