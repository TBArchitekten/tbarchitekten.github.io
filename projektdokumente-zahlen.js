/* TBA Office · Projektstart · Zahlen der Varianten (24.11.2026, Claude, Auftrag Gari; Entwurf vom 24.11. freigegeben).
   Rein und ohne DOM. Eine Variante der Entscheidungsvorlage bekommt ihre Zahlen aus dem Office statt von Hand:
   - das Produkt aus der Produktbibliothek, mit seinem Code im Projekt und dem Stand des Datenblatts;
   - den Kennwert aus einem Preis des Produkts, aus dem Datenpool (alle Kostenberechnungen des Büros) oder aus einer
     Position der Kostenberechnung des Projekts, mit dem Baupreisindex auf den Kostenstand des Projekts fortgeschrieben;
   - die Menge aus einer Position der Kostenberechnung des Projekts.
   Jede Zahl trägt zwei Texte. Die Fundstelle ist für das Büro und nennt Projekt, Zeile und Stand. Der Beleg steht im
   Dokument an den Auftraggeber und nennt keine anderen Projekte des Büros.
   Gerechnet wird mit dem Rechenkern der Kostenberechnung (R) und dem Datenpool (P); beide werden übergeben.
   Romy («Zahlen holen») wählt nur unter den Kandidaten, die kandidaten() baut; die Zahlen kommen immer von hier. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TBA_PROJEKTDOKUMENTE_ZAHLEN=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const s=v=>String(v??'');
const kurz=(t,n)=>{const x=s(t).replace(/\s+/g,' ').trim();return x.length>n?x.slice(0,n-1).trimEnd()+'…':x};
// Wie in der Produktbibliothek.
const PREISART=Object.freeze({listenpreis_material:'Listenpreis Material',angebot_material:'Angebot Material',angebot_eingebaut:'Angebot eingebaut',
  ansatz_kobe:'Ansatz Kostenberechnung',abrechnung:'Abrechnung'});
const EINGEBAUT=new Set(['angebot_eingebaut','abrechnung','ansatz_kobe']);
const DATENBLATT=Object.freeze({geprueft:'Datenblatt geprüft',ungeprueft:'Datenblatt ungeprüft',fehlt:'Datenblatt fehlt'});
const GRENZE=Object.freeze({produkte:8,preise:4,pool:6,kobe:8});

// ---------- Zahlen und Texte ----------
function euro(c){
  const x=BigInt(c),neg=x<0n,a=neg?-x:x;
  return (neg?'−':'')+(a/100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+String(a%100n).padStart(2,'0')+' €';
}
const euroJe=(c,einheit)=>euro(c)+(einheit?'/'+einheit:'');
const centAus=betrag=>{const n=Number(betrag);return Number.isFinite(n)?BigInt(Math.round(n*100)):null};
function mengeText(menge,einheit,R){const z=R.zahl(menge,2);return z?z+(einheit?' '+einheit:''):''}
function quartalVon(iso){
  const m=/^(\d{4})-(\d{2})/.exec(s(iso));if(!m)return '';
  const monat=Number(m[2]);if(monat<1||monat>12)return '';
  return m[1]+'-Q'+(Math.floor((monat-1)/3)+1);
}
function monatText(iso){const m=/^(\d{4})-(\d{2})/.exec(s(iso));return m?m[2]+'/'+m[1]:''}

// ---------- Bezug der Fortschreibung ----------
// Die laufende Kostenberechnung des Projekts mit ihrem Kostenstand und Baupreisindex; ohne sie das Muster der
// Kostenberechnung (dessen Index pflegt die vierteljährliche Aufgabe) mit dem Quartal von heute.
function ziel({kobe=null,muster=null,heute=''}={}){
  const st=kobe?.state||{},m=muster?.state||muster||{};
  const indizes=Array.isArray(st.indizes)&&st.indizes.length?st.indizes:(Array.isArray(m.indizes)?m.indizes:[]);
  const kostenstand=s(st.kostenstand)||quartalVon(heute);
  return {kostenstand,indizes,indexReihe:s(st.indexReihe||m.indexReihe),ustProzent:s(st.ustProzent||m.ustProzent||'19'),
    herkunft:s(st.kostenstand)?'kobe':'heute'};
}
// Indexwert eines Quartals wie im Rechenkern: ein späteres, noch nicht veröffentlichtes Quartal nimmt den letzten Wert.
function indexWert(z,q,R){
  const reihe=new Map((z?.indizes||[]).filter(x=>R.quartalIndex(x?.quartal)!==null&&R.dezimal(x?.wert)).map(x=>[x.quartal,R.dezimal(x.wert)]));
  if(reihe.has(q))return {quartal:q,wert:reihe.get(q)};
  const letzter=[...reihe.keys()].sort((a,b)=>R.quartalIndex(a)-R.quartalIndex(b)).pop();
  if(letzter&&R.quartalIndex(q)!==null&&R.quartalIndex(q)>R.quartalIndex(letzter))return {quartal:letzter,wert:reihe.get(letzter)};
  return null;
}
// Ein Wert vom Stand «von» auf den Kostenstand des Ziels, mit Text («Baupreisindex 3. Quartal 2022 → 4. Quartal 2026 (118,9 → 141,7)»).
function fortschreiben(cent,von,z,R,P){
  if(!von)return {cent:BigInt(cent),text:'Stand ohne Quartal, nicht fortgeschrieben',fortgeschrieben:false,ohneStand:true};
  const n=P.normiere(cent,von,z,R);
  if(n.gleich)return {cent:BigInt(cent),text:'',fortgeschrieben:false};
  if(n.fehlt)return {cent:BigInt(cent),text:'ohne Baupreisindex für '+R.quartalText(von)+' nicht fortgeschrieben',fortgeschrieben:false,fehlt:true};
  const a=indexWert(z,von,R),b=indexWert(z,z.kostenstand,R);
  const werte=a&&b?' ('+R.zahl(a.wert,1)+' → '+R.zahl(b.wert,1)+')':'';
  return {cent:n.cent,fortgeschrieben:true,vorlaeufig:n.vorlaeufig||null,
    text:'Baupreisindex '+R.quartalText(von)+' → '+R.quartalText(z.kostenstand)+werte+(n.vorlaeufig?', Index bis '+R.quartalText(n.vorlaeufig):'')};
}

// ---------- Produktbibliothek ----------
function datenblatt(produkt,dokumente){
  const hat=(dokumente||[]).some(d=>d.produkt_id===produkt?.id&&d.art==='datenblatt');
  return produkt?.status==='geprueft'&&hat?'geprueft':hat?'ungeprueft':'fehlt';
}
// Die Verwendung im Projekt (Code der Musterliste); verworfene zählen nicht.
function verwendungIm(produktId,projektId,verwendungen){
  return (verwendungen||[]).filter(v=>v.produkt_id===produktId&&v.projekt_id===projektId&&v.status!=='verworfen')
    .sort((a,b)=>s(a.code).localeCompare(s(b.code),'de',{numeric:true}))[0]||null;
}
function produktText(produkt,verwendung){
  const name=[s(produkt?.name).trim(),s(produkt?.hersteller).trim()].filter(Boolean).join(' · ');
  return [s(verwendung?.code),name].filter(Boolean).join(' · ').slice(0,200);
}
// Nächster freier Code im Projekt, wie in der Produktbibliothek (Kürzel der Kategorie, zweistellig gezählt).
const KUERZEL=Object.freeze({bodenbelag:'BO',wandbelag:'WA',decke:'DE',fassade:'FA',fenster_tueren:'FE',sanitaer:'SA',licht:'LI',beschlaege:'BE',sonstiges:'SO'});
function naechsterCode(projektId,kategorie,verwendungen){
  const kurzel=KUERZEL[kategorie]||'SO';
  const benutzt=new Set((verwendungen||[]).filter(v=>v.projekt_id===projektId&&v.code).map(v=>v.code));
  for(let i=1;i<1000;i++){const c=kurzel+'-'+String(i).padStart(2,'0');if(!benutzt.has(c))return c}
  return '';
}
function eintrag(label,rest,P){return {text:P.normText([label,rest].join(' ')),titelText:P.normText(label),triTitel:P.trigramme(label)}}
function produktSuche(produkte,text,P,{grenze=30}={}){
  const f=P.frage(text||'');
  const liste=(produkte||[]).filter(p=>p&&!p.archiviert);
  if(!f.tri.size)return liste.slice().sort((a,b)=>s(a.name).localeCompare(s(b.name),'de')).slice(0,grenze).map(p=>({p,score:0}));
  return liste.map(p=>({p,score:P.aehnlich(f,eintrag([p.name,p.serie,p.familie].filter(Boolean).join(' '),[p.hersteller,p.kategorie,p.beschreibung].join(' '),P))}))
    .filter(x=>x.score>=0.3).sort((a,b)=>b.score-a.score||s(a.p.name).localeCompare(s(b.p.name),'de')).slice(0,grenze);
}
// Preise eines Produkts: eingebaute vor Materialpreisen, neuere vor älteren.
function preiseVon(produktId,preise){
  return (preise||[]).filter(x=>x.produkt_id===produktId&&centAus(x.betrag)!==null)
    .sort((a,b)=>Number(EINGEBAUT.has(b.art))-Number(EINGEBAUT.has(a.art))||s(b.stand).localeCompare(s(a.stand)));
}
function kennwertAusPreis(preis,produkt,z,R,P){
  const cent=centAus(preis?.betrag);if(cent===null)return null;
  const art=PREISART[preis.art]||'Preis',stand=monatText(preis.stand),f=fortschreiben(cent,quartalVon(preis.stand),z,R,P);
  const herkunft=[s(preis.quelle).trim(),s(preis.projekt_bezeichnung).trim(),s(preis.kommentar).trim()].filter(Boolean).join(', ');
  const fund='Produktbibliothek: '+kurz(produkt?.name,80)+', '+art+' '+euroJe(cent,preis.einheit)+(stand?', Stand '+stand:'')+
    (herkunft?', '+herkunft:'')+(f.text?'; '+f.text:'');
  const beleg=art+(stand?', Stand '+stand:'')+(f.fortgeschrieben?', fortgeschrieben auf '+R.quartalText(z.kostenstand):'');
  return {kennwert:euroJe(f.cent,preis.einheit),kennwert_quelle:kurz(fund,400),kennwert_beleg:kurz(beleg,160),einheit:s(preis.einheit),
    eingebaut:EINGEBAUT.has(preis.art),hinweis:EINGEBAUT.has(preis.art)?'':'Materialpreis: Verlegen, Kleber und Zubehör fehlen.'};
}

// ---------- Datenpool ----------
function poolGruppen(eintraege,P,{text='',einheit='',ohneInstanz=''}={}){
  if(!s(text).trim())return [];
  return P.gruppiere(P.suche(eintraege,{text,einheit,alleKg:true,ohneInstanz}));
}
function kennwertAusPool(g,z,R,P){
  if(!g?.ursprung)return null;
  const u=g.ursprung,f=fortschreiben(g.epCent,u.kostenstand,z,R,P),ue=P.uebernahme(g,R);
  const fund='Datenpool: '+euroJe(g.epCent,g.einheit)+(g.kopie?' in '+g.projekte.length+' Kostenberechnungen':'')+', '+ue.fundstelle+
    (u.kostenstand?', Kostenstand '+R.quartalText(u.kostenstand):'')+(f.text?'; '+f.text:'');
  const beleg='Kennwert aus Kostenberechnungen des Büros'+(u.kostenstand?' (Kostenstand '+R.quartalText(u.kostenstand)+
    (f.fortgeschrieben?', fortgeschrieben auf '+R.quartalText(z.kostenstand):'')+')':'');
  return {kennwert:euroJe(f.cent,g.einheit),kennwert_quelle:kurz(fund,400),kennwert_beleg:kurz(beleg,160),einheit:s(g.einheit),eingebaut:true,hinweis:''};
}

// ---------- Kostenberechnung des Projekts ----------
// Positionen mit Menge und Einheit (ohne Pauschalen und entfallene), nach Ähnlichkeit zur Suche.
function positionen(instanz,R,P,text='',{grenze=40}={}){
  const st=instanz?.state;if(!st||st.schema!==R.SCHEMA)return [];
  const f=P.frage(text||'');
  const out=[];
  for(const p of st.positionen||[]){
    if(!p||p.status==='entfaellt'||p.modus==='betrag'||p.einheit==='psch'||!R.EINHEITEN.includes(p.einheit))continue;
    const menge=R.dezimal(p.menge);if(menge===null||menge===undefined)continue;
    const titel=s(p.titel).trim()||R.katalogTitel(st,p.kg)||'Position';
    const score=f.tri.size?P.aehnlich(f,eintrag(titel,s(p.notiz),P)):0;
    if(f.tri.size&&score<0.3)continue;
    let r=null;try{r=R.position(p,st)}catch{}
    out.push({position:p,id:s(p.id),score,titel,kg:s(p.kg),menge,einheit:p.einheit,epCent:r?.kennwertCent??null,betragCent:r?.betragCent??null,
      mengenquelle:R.MENGENQUELLEN[p.mengenquelle?.art]||'',kennwertArt:R.ARTEN[p.kennwert?.art]?.kurz||''});
  }
  return out.sort((a,b)=>b.score-a.score||a.kg.localeCompare(b.kg)).slice(0,grenze);
}
function kobeName(instanz){return 'Kostenberechnung'+(s(instanz?.project_number)?' '+s(instanz.project_number):'')}
function mengeAusPosition(x,instanz,R){
  if(!x)return null;
  const fund=[kobeName(instanz),'KG '+x.kg,x.titel,x.mengenquelle].filter(Boolean).join(', ');
  return {menge:mengeText(x.menge,x.einheit,R),menge_quelle:kurz(fund,300),menge_beleg:'Kostenberechnung, KG '+x.kg,
    kobe_ref:s(instanz?.id)+':'+x.id,einheit:x.einheit,kg:x.kg};
}
function kennwertAusPosition(x,instanz,R){
  if(!x||x.epCent===null)return null;
  const fund=[kobeName(instanz),'KG '+x.kg,x.titel,x.kennwertArt?'Ansatz: '+x.kennwertArt:'',s(x.position?.kennwert?.fundstelle).trim()].filter(Boolean).join(', ');
  return {kennwert:euroJe(x.epCent,x.einheit),kennwert_quelle:kurz(fund,400),kennwert_beleg:'Ansatz der Kostenberechnung, KG '+x.kg,
    einheit:x.einheit,eingebaut:true,hinweis:''};
}

// ---------- In die Variante ----------
const ZAHLEN_FELDER=['produkt','produkt_id','kennwert','kennwert_quelle','kennwert_beleg','menge','menge_quelle','menge_beleg','kobe_ref'];
// Nur die Felder der Zahlen; ein neuer Kennwert oder eine neue Menge leert den Betrag von Hand, damit Kennwert × Menge gilt.
function setze(option,teil){
  const o={...option};
  for(const k of ZAHLEN_FELDER)if(teil&&k in teil)o[k]=s(teil[k]);
  if(teil&&('kennwert' in teil||'menge' in teil))o.betrag='';
  return o;
}
// Einheiten von Kennwert und Menge passen nicht zusammen («€/m²» gegen «m»).
function einheitPasst(option){
  const k=/\/\s*(m²|m³|St|kg|m|t)\s*$/.exec(s(option?.kennwert))?.[1]||'',m=/(?:^|[\s\d])(m²|m³|St|kg|m|t)\s*$/.exec(s(option?.menge))?.[1]||'';
  return !k||!m||k===m;
}

// ---------- Kandidaten für Romy ----------
// Kurze Verweise statt Ids (p1, pr1, g1, k1); auflösen() findet zu jedem Verweis die Zahl mit Fundstelle.
function kandidaten(optionen,{produkte=[],preise=[],dokumente=[],verwendungen=[],projektId='',pool=[],kobe=null,z,R,P}){
  const out={produkte:[],pool:[],kobe:[]},karte=new Map();
  let np=0,npr=0,ng=0,nk=0;
  const kobePos=new Map();
  for(const o of optionen||[]){
    const text=[s(o.text),s(o.produkt)].join(' ').trim();if(!text)continue;
    for(const {p} of produktSuche(produkte,text,P,{grenze:GRENZE.produkte})){
      if(out.produkte.some(x=>x.id===p.id))continue;
      const ref='p'+(++np),v=verwendungIm(p.id,projektId,verwendungen);
      karte.set(ref,{art:'produkt',p,v});
      out.produkte.push({id:p.id,ref,name:kurz(p.name,120),hersteller:kurz(p.hersteller,80),kategorie:s(p.kategorie),code:s(v?.code),
        datenblatt:datenblatt(p,dokumente),preise:preiseVon(p.id,preise).slice(0,GRENZE.preise).map(x=>{
          const r='pr'+(++npr),k=kennwertAusPreis(x,p,z,R,P);karte.set(r,{art:'preis',x,p,k});
          return {ref:r,art:PREISART[x.art]||x.art,wert:k?.kennwert||'',stand:monatText(x.stand),eingebaut:EINGEBAUT.has(x.art)};
        })});
    }
    for(const g of poolGruppen(pool,P,{text:s(o.text),ohneInstanz:s(kobe?.id)}).slice(0,GRENZE.pool)){
      if([...karte.values()].some(x=>x.art==='pool'&&x.g.key===g.key))continue;
      const ref='g'+(++ng),k=kennwertAusPool(g,z,R,P);karte.set(ref,{art:'pool',g,k});
      out.pool.push({ref,bezeichnung:kurz(g.ursprung.bez,100),kg:s(g.ursprung.kg),wert:k?.kennwert||'',kostenstand:R.quartalText(g.ursprung.kostenstand),
        kostenberechnungen:g.projekte.length,herkunft:P.HERKUNFT[g.ursprung.herkunft]||''});
    }
    for(const x of positionen(kobe,R,P,s(o.text),{grenze:GRENZE.kobe})){
      if(kobePos.has(x.id))continue;
      const ref='k'+(++nk);kobePos.set(x.id,ref);karte.set(ref,{art:'kobe',x});
      out.kobe.push({ref,kg:x.kg,bezeichnung:kurz(x.titel,100),menge:mengeText(x.menge,x.einheit,R),kennwert:x.epCent===null?'':euroJe(x.epCent,x.einheit)});
    }
  }
  return {liste:out,karte};
}
// Romys Wahl (nur Verweise) in Zahlen mit Fundstelle; unbekannte Verweise fallen weg.
function aufloesen(wahl,{karte,instanz,R}){
  const raus={};
  const p=karte.get(s(wahl?.produkt));
  if(p?.art==='produkt'){raus.produkt=produktText(p.p,p.v);raus.produkt_id=p.p.id}
  const k=karte.get(s(wahl?.kennwert));
  const kw=k?.art==='preis'?k.k:k?.art==='pool'?k.k:k?.art==='kobe'?kennwertAusPosition(k.x,instanz,R):null;
  if(kw){raus.kennwert=kw.kennwert;raus.kennwert_quelle=kw.kennwert_quelle;raus.kennwert_beleg=kw.kennwert_beleg}
  const m=karte.get(s(wahl?.menge));
  if(m?.art==='kobe'){const mg=mengeAusPosition(m.x,instanz,R);Object.assign(raus,{menge:mg.menge,menge_quelle:mg.menge_quelle,menge_beleg:mg.menge_beleg,kobe_ref:mg.kobe_ref})}
  return raus;
}

return Object.freeze({PREISART,EINGEBAUT,DATENBLATT,GRENZE,ZAHLEN_FELDER,KUERZEL,euro,euroJe,mengeText,quartalVon,monatText,ziel,indexWert,
  fortschreiben,datenblatt,verwendungIm,produktText,naechsterCode,produktSuche,preiseVon,kennwertAusPreis,poolGruppen,kennwertAusPool,
  positionen,mengeAusPosition,kennwertAusPosition,setze,einheitPasst,kandidaten,aufloesen});
});
