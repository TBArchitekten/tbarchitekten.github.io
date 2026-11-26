/* TBA Office · Mustermappe · Kern (24.11.2026, Claude, Auftrag Gari: für jedes Muster ein bearbeitbares Blatt in einer
   bearbeitbaren Mustermappe; eine Entscheidung dient mehreren Dokumenten derselben Leistungsphase).
   Rein und ohne DOM, im Browser und in Node prüfbar.
   Die Mappe ist eine Entscheidungsvorlage in Seitenform (form «mustermappe»). Jede Position ist eine Entscheidung der
   Entscheidungsliste mit Code, Zonen und Anforderungen (Feld «muster»); die Kandidaten sind ihre Varianten mit einem
   Produkt der Produktbibliothek. Gelernt von Programa (Präsentationen mit lebenden Produktdaten, Recherche vom
   24.11.2026), aber: eine Seite zeigt einen neuen Stand der Bibliothek erst nach «Übernehmen», und aus dem Projekt heraus
   ändert sich die Bibliothek nie. Seitenvorlagen A3 quer: Deckblatt, Übersicht, Vergleich, Material, freie Seite.
   Im Dokument an den Auftraggeber steht je Zahl nur der Beleg, nie die Fundstelle mit anderen Projekten.
   Entschieden wird im Bemusterungstermin, nicht auf dem Blatt (Gari, 24.11.2026): keine Unterschrift auf den Seiten.
   Anpassen für diese Mappe (Gari, 26.11.2026): Name, Hersteller und Serie, Kennwerte und Beschreibung einer Variante
   lassen sich auf der Seite ändern, nur für die Mappe, markiert und mit «Zurücksetzen»; jedes Foto lässt sich ersetzen
   (aus der Bibliothek oder ein eigenes Bild, das in der Mappe bleibt) und zuschneiden.
   TBA-Raster (Gari, 26.11.2026): alle Seiten stehen auf einem Raster A3 quer aus 12 × 8 quadratischen Feldern mit
   Grundlinie 4 mm, Kopf- und Fußzeile wie im Archicad-Master, Schrift Arial; beim Bearbeiten sieht die Seite aus wie
   im PDF, die Texte werden direkt auf ihr geschrieben.
   Etappe 2 (Gari, 26.11.2026): die Rahmen einer Seite lassen sich verschieben und in der Größe ändern, Feld für Feld
   auf dem Raster; die Vorlagen sind das Layout zum Anfangen (seite.layout, siehe «Layout der Seite»). */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.TBA_MUSTERMAPPE=api;
})(typeof self!=='undefined'?self:this,function(){
'use strict';

const FORM='mustermappe',SCHEMA='tba.office.mustermappe.v1';
const BUCKET='office-projektdokumente',BUCKET_PRODUKTE='office-produkte';
const THEMEN=['Bodenbeläge','Bäder','Treppen','Fassade','Licht','weitere Entscheidungsfelder'];
// Kategorien der Produktbibliothek, die ein Themenpaket zuerst anbietet; alle übrigen bleiben wählbar.
const KATEGORIEN={'Bodenbeläge':['bodenbelag'],'Bäder':['sanitaer','wandbelag','bodenbelag'],'Treppen':['bodenbelag'],
  'Fassade':['fassade'],'Licht':['licht'],'weitere Entscheidungsfelder':[]};
const SEITEN={deckblatt:'Deckblatt',uebersicht:'Übersicht',vergleich:'Vergleich',material:'Material',frei:'Freie Seite'};
const STRATEGIEN=[['','ohne Strategie'],['A','Strategie A'],['B','Strategie B'],['AB','A und B']];
const MUSTER_FELDER=['code','bezeichnung','strategie','zonen','flaeche','anforderungen','hinweise','kosten','kosten_beleg'];
const MAX_KANDIDATEN=3,MAX_FOTOS=3,MAX_MERKMALE=16,ZOOM_MAX=3;
const BILDTYPEN=['image/jpeg','image/png','image/webp'],BILD_MAX=15*1024*1024;

const s=v=>v===null||v===undefined?'':String(v);
const esc=t=>s(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ISO=/^(\d{4})-(\d{2})-(\d{2})$/;
function datum(iso){const m=ISO.exec(s(iso));return m?m[3]+'.'+m[2]+'.'+m[1]:''}
function neueId(){return 's'+Math.random().toString(36).slice(2,10)}
function naechsteOptionId(liste){
  const ids=new Set((liste||[]).map(o=>s(o?.id)));
  for(const c of 'ABCDEFGH')if(!ids.has(c))return c;
  return 'X'+((liste||[]).length+1);
}
function istMappe(v){return s(v?.daten?.form)===FORM}
function optionen(d){return Array.isArray(d?.optionen)?d.optionen.filter(o=>o&&typeof o==='object'):[]}

// ---------- Anlegen ----------
function neueMappe({themenpaket='Bodenbeläge',verfasser='',termin=''}={}){
  const t=THEMEN.includes(themenpaket)?themenpaket:s(themenpaket).trim()||'Bodenbeläge';
  return {titel:'Mustermappe '+t,form:FORM,themenpaket:t,punkte:[],status:'Entwurf',besprechung:'Bemusterung',
    besprechung_am:ISO.test(s(termin))?termin:'',verfasser:s(verfasser),seiten:[{id:neueId(),typ:'deckblatt'},{id:neueId(),typ:'uebersicht'}]};
}
function thema(m){return [s(m?.code).trim(),s(m?.bezeichnung).trim()].filter(Boolean).join(' · ')}
// Eine Position ist eine Entscheidung der Entscheidungsliste; die Kandidaten kommen danach aus der Bibliothek.
function neuePosition({code='',bezeichnung='',strategie='',titel='',vorlageId=''}={}){
  const muster=Object.fromEntries(MUSTER_FELDER.map(k=>[k,'']));
  Object.assign(muster,{code:s(code).trim().slice(0,12),bezeichnung:s(bezeichnung).trim().slice(0,120),
    strategie:STRATEGIEN.some(([k])=>k===strategie)?strategie:''});
  return {herkunft:s(titel).trim()||'Mustermappe',thema:thema(muster),frage:'',optionen:[],empfehlung:'',begruendung:'',
    festliegt:'',bis:'',status:'vorbereitet',vorlage_id:s(vorlageId),muster};
}
// Was die Seite vom Produkt zeigt, festgehalten mit dem Stand der Bibliothek; ein neuer Stand gilt erst nach «Übernehmen».
function produktAuszug(p){
  if(!p)return null;
  const merkmale=(Array.isArray(p.merkmale)?p.merkmale:[]).filter(m=>m&&s(m.feld).trim()&&s(m.wert).trim()).slice(0,MAX_MERKMALE)
    .map(m=>{const x={feld:s(m.feld).trim().slice(0,80),wert:s(m.wert).trim().slice(0,240)};if(Number(m.seite)>0)x.seite=Number(m.seite);return x});
  return {name:s(p.name).slice(0,200),hersteller:s(p.hersteller).slice(0,160),serie:s(p.serie).slice(0,160),
    beschreibung:s(p.beschreibung).slice(0,1200),merkmale,fehlend:(Array.isArray(p.fehlend)?p.fehlend:[]).map(s).filter(Boolean).slice(0,12),
    status:s(p.status),stand:s(p.updated_at)};
}
function veraltet(o,p){
  if(!o?.muster_produkt||!p)return false;
  const neu=Date.parse(s(p.updated_at)),alt=Date.parse(s(o.muster_produkt.stand));
  return Number.isFinite(neu)&&(!Number.isFinite(alt)||neu>alt);
}
function kandidat(liste,p,{produkt=''}={}){
  return {id:naechsteOptionId(liste),text:s(p?.name),produkt:produkt||[s(p?.name).trim(),s(p?.hersteller).trim()].filter(Boolean).join(' · '),
    produkt_id:s(p?.id),muster_produkt:produktAuszug(p),muster_fotos:[]};
}
// Fotos einer Variante: angeklickt in dieser Reihenfolge, höchstens drei; das erste ist das große.
function fotosUmschalten(alt,foto){
  const liste=(Array.isArray(alt)?alt:[]).filter(f=>f&&s(f.pfad));
  if(liste.some(f=>s(f.id)===s(foto.id)))return liste.filter(f=>s(f.id)!==s(foto.id));
  return [...liste,{id:s(foto.id),pfad:s(foto.pfad)}].slice(0,MAX_FOTOS);
}
// Ausschnitt eines Fotos: Punkt x, y in Prozent (der bleibt beim Zuschneiden stehen) und Vergrößerung z bis dreifach.
// Mitte und ohne Vergrößerung = kein Ausschnitt.
function ausschnittVon(a){
  if(!a||typeof a!=='object')return null;
  const zahl=(v,min,max,std)=>{const n=v===null||v===''?NaN:Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):std};
  const x=Math.round(zahl(a.x,0,100,50)*10)/10,y=Math.round(zahl(a.y,0,100,50)*10)/10,z=Math.round(zahl(a.z,1,ZOOM_MAX,1)*100)/100;
  return x===50&&y===50&&z===1?null:{x,y,z};
}
// Ein Foto der Variante: aus der Bibliothek (Bucket der Produkte) oder eigenes Bild der Mappe (quelle «mappe»).
function fotoSauber(f){
  if(!f||typeof f!=='object'||!s(f.pfad))return null;
  const x={id:s(f.id),pfad:s(f.pfad)};
  if(f.quelle==='mappe')x.quelle='mappe';
  if(s(f.name))x.name=s(f.name).slice(0,160);
  const a=ausschnittVon(f.ausschnitt);if(a)x.ausschnitt=a;
  return x;
}
const fotoListe=l=>(Array.isArray(l)?l:[]).map(fotoSauber).filter(Boolean);
// Ein Foto an Stelle i setzen (i = Länge: anhängen); dasselbe Bild steht nur einmal in der Variante.
function fotoSetzen(liste,i,foto){
  const neu=fotoSauber(foto);let l=fotoListe(liste);
  if(!neu)return l.slice(0,MAX_FOTOS);
  const k=Math.min(Math.max(0,Math.floor(Number(i))||0),l.length);
  if(k<l.length)l[k]=neu;else l.push(neu);
  l=l.filter((f,j)=>j===k||f.pfad!==neu.pfad);
  return l.slice(0,MAX_FOTOS);
}
function fotoEntfernen(liste,i){return fotoListe(liste).filter((_,j)=>j!==Number(i))}
function fotoNachVorn(liste,i){
  const l=fotoListe(liste),k=Number(i);
  if(!(k>0&&k<l.length))return l;
  const [f]=l.splice(k,1);l.unshift(f);return l;
}
function fotoAusschnitt(liste,i,a){
  return fotoListe(liste).map((f,j)=>{
    if(j!==Number(i))return f;
    const n={...f},x=ausschnittVon(a);
    if(x)n.ausschnitt=x;else delete n.ausschnitt;
    return n;
  });
}

// ---------- Texte für diese Mappe anpassen (Gari, 26.11.2026) ----------
// Was die Seite aus der Bibliothek zeigt (Name, Hersteller und Serie, Kennwerte) und die Beschreibung lassen sich für
// diese Mappe ändern. Geändertes steht in der Variante (muster_name, muster_herkunft, muster_merkmale, muster_text); die
// Bibliothek bleibt, wie sie ist. Gleich wie in der Bibliothek heißt: nicht geändert. «Übernehmen» lässt Geändertes stehen.
const ANPASSUNG={name:'muster_name',herkunft:'muster_herkunft',kennwerte:'muster_merkmale',beschreibung:'muster_text'};
const ANPASSUNG_NAME={name:'Name',herkunft:'Hersteller und Serie',kennwerte:'Kennwerte',beschreibung:'Beschreibung'};
function herkunftVon(a){return [s(a?.hersteller).trim(),s(a?.serie).trim()].filter(Boolean).join(' · ')}
function merkmaleSauber(liste){
  return (Array.isArray(liste)?liste:[]).filter(m=>m&&(s(m.feld).trim()||s(m.wert).trim())).slice(0,MAX_MERKMALE)
    .map(m=>({feld:s(m.feld).trim().slice(0,80),wert:s(m.wert).trim().slice(0,240)}));
}
// Kennwerte als Text: je Zeile «Feld: Wert» (ohne Doppelpunkt nur der Wert).
function merkmaleText(liste){return merkmaleSauber(liste).map(m=>m.feld?m.feld+': '+m.wert:m.wert).join('\n')}
function merkmaleAusText(text){
  return merkmaleSauber(s(text).split(/\r?\n/).map(z=>z.trim()).filter(Boolean).map(z=>{
    const i=z.indexOf(':');return i>0?{feld:z.slice(0,i),wert:z.slice(i+1)}:{feld:'',wert:z};
  }));
}
function gleicheMerkmale(a,b){
  const x=merkmaleSauber(a),y=merkmaleSauber(b);
  return x.length===y.length&&x.every((m,i)=>m.feld===y[i].feld&&m.wert===y[i].wert);
}
function anpassen(o,feld,wert){
  const a=o?.muster_produkt||{},n={...o};
  if(feld==='name'){const w=s(wert).trim().slice(0,200);if(!w||w===(s(a.name)||s(o?.text)).trim())delete n.muster_name;else n.muster_name=w}
  else if(feld==='herkunft'){const w=s(wert).trim().slice(0,240);if(w===herkunftVon(a))delete n.muster_herkunft;else n.muster_herkunft=w}
  else if(feld==='kennwerte'){const l=Array.isArray(wert)?merkmaleSauber(wert):merkmaleAusText(wert);if(gleicheMerkmale(l,a.merkmale))delete n.muster_merkmale;else n.muster_merkmale=l}
  else if(feld==='beschreibung'){const w=s(wert);if(!w.trim()||w.trim()===s(a.beschreibung).trim())delete n.muster_text;else n.muster_text=w}
  return n;
}
function zuruecksetzen(o,feld){const n={...o};if(ANPASSUNG[feld])delete n[ANPASSUNG[feld]];return n}
function geaendert(o){
  return {name:!!s(o?.muster_name).trim(),herkunft:typeof o?.muster_herkunft==='string',
    kennwerte:Array.isArray(o?.muster_merkmale),beschreibung:!!s(o?.muster_text).trim()};
}
function geaenderteTexte(o,felder=Object.keys(ANPASSUNG)){const g=geaendert(o);return felder.filter(k=>g[k]).map(k=>({feld:k,name:ANPASSUNG_NAME[k]}))}
// Welche anpassbaren Texte eine Seite zeigt, in der Reihenfolge der Seite: nur für die steht unter ihr «zurücksetzen».
function anpassbarAuf(seite){
  const t=seite?.typ;
  if(t!=='vergleich'&&t!=='material')return [];
  return ['name','herkunft',...(t==='material'?['beschreibung']:[]),...(zeigt(seite,'kennwerte')?['kennwerte']:[])];
}
// Pfad einer Datei der Mappe: Dokument, wer hochlädt, Datei. So prüft die Datenbank den Zugang (Migration 20261124).
function dateiPfad(dokumentId,userId,uuid,typ){
  const endung={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[typ];
  if(!endung)return '';
  return s(dokumentId)+'/'+s(userId)+'/'+s(uuid)+'.'+endung;
}
function bildPruefen(typ,groesse){
  if(!BILDTYPEN.includes(typ))return 'Bitte ein Bild (JPG, PNG oder WebP) oder ein PDF wählen.';
  if(!(groesse>0)||groesse>BILD_MAX)return 'Das Bild ist größer als 15 MB.';
  return '';
}

// ---------- Seiten ----------
function seitenVon(daten){
  const punkte=Array.isArray(daten?.punkte)?daten.punkte:[];
  let liste=Array.isArray(daten?.seiten)?daten.seiten.filter(x=>x&&typeof x==='object'&&SEITEN[x.typ]&&s(x.id)):[];
  if(!liste.length)liste=[{id:'deckblatt',typ:'deckblatt'},{id:'uebersicht',typ:'uebersicht'},...punkte.map(p=>({id:'v-'+p,typ:'vergleich',punkt:p}))];
  // Seiten einer Position, die nicht mehr in der Mappe ist, fallen weg.
  return liste.filter(x=>!['vergleich','material'].includes(x.typ)||punkte.includes(x.punkt)).map(x=>({...x}));
}
function seiteVerschieben(liste,id,richtung){
  const l=liste.map(x=>({...x})),i=l.findIndex(x=>x.id===id),j=i+richtung;
  if(i<0||j<0||j>=l.length)return l;
  [l[i],l[j]]=[l[j],l[i]];return l;
}
function seiteName(seite,punkt,option){
  const t=SEITEN[seite?.typ]||'Seite';
  if(seite?.typ==='vergleich')return [punkt?.code,punkt?.bezeichnung].filter(Boolean).join(' ')+' · '+t;
  if(seite?.typ==='material')return [punkt?.code,option?.name].filter(Boolean).join(' · ')+' · '+t;
  if(seite?.typ==='frei')return (s(seite.titel).trim()||'ohne Titel')+' · '+t;
  return t;
}

// ---------- Inhalt ----------
// Inhalt der Mappe aus der Vorlagenzeile und ihren Entscheidungen; daraus entstehen Ansicht, PDF und Stand.
// Je Variante nur der Beleg (für das Dokument), nie die Fundstelle mit Projekt und Zeile.
function belegVon(o){
  return [s(o?.kennwert_beleg).trim()&&'Kennwert: '+s(o.kennwert_beleg).trim(),s(o?.menge_beleg).trim()&&'Menge: '+s(o.menge_beleg).trim(),s(o?.quelle).trim()].filter(Boolean).join('; ');
}
function optionInhalt(o){
  const a=o.muster_produkt||{},g=geaendert(o);
  return {id:s(o.id),name:g.name?s(o.muster_name).trim():(s(a.name)||s(o.text)),hersteller:s(a.hersteller),serie:s(a.serie),
    herkunft:g.herkunft?s(o.muster_herkunft):herkunftVon(a),
    beschreibung:s(o.muster_text)||s(a.beschreibung),eigenerText:!!s(o.muster_text),
    merkmale:g.kennwerte?merkmaleSauber(o.muster_merkmale):(Array.isArray(a.merkmale)?a.merkmale:[]),geaendert:g,
    kennwert:s(o.kennwert),beleg:belegVon(o),produktId:s(o.produkt_id),stand:s(a.stand),
    fotos:fotoListe(o.muster_fotos).slice(0,MAX_FOTOS)};
}
function punktInhalt(z,nummer){
  const d=z.daten||{},m=d.muster||{};
  return {id:s(z.id),nr:nummer?nummer(z.nr):s(z.nr),code:s(m.code),bezeichnung:s(m.bezeichnung)||s(d.thema),strategie:s(m.strategie),
    zonen:s(m.zonen),flaeche:s(m.flaeche),anforderungen:s(m.anforderungen),hinweise:s(m.hinweise),kosten:s(m.kosten),kostenBeleg:s(m.kosten_beleg),
    frage:s(d.frage),empfehlung:s(d.empfehlung),begruendung:s(d.begruendung),status:s(d.status),entscheidung:s(d.entscheidung),
    entschiedenAm:s(d.entschieden_am),entscheider:s(d.entscheider),
    optionen:optionen(d).filter(o=>s(o.text).trim()||s(o.produkt_id)).map(optionInhalt)};
}
function mappeInhalt(vorlage,entscheidungen,{projekt={},stand='',nummer=null}={}){
  const v=vorlage?.daten||{};
  const ids=Array.isArray(v.punkte)?v.punkte:[];
  const punkte=ids.map(id=>(entscheidungen||[]).find(z=>z.id===id)).filter(Boolean).map(z=>punktInhalt(z,nummer));
  return {schema:SCHEMA,titel:s(v.titel).trim()||'Mustermappe',themenpaket:s(v.themenpaket),
    projekt:{nummer:s(projekt.number??projekt.nummer),name:s(projekt.name)},termin:s(v.besprechung_am),auftraggeber:s(v.auftraggeber),
    verfasser:s(v.verfasser),status:s(v.status)||'Entwurf',vorgelegtAm:s(v.vorgelegt_am),stand:s(stand),deckblatt:s(v.deckblatt_text),
    kopf:{projekt:s(v.kopf_projekt).trim()||[s(projekt.number??projekt.nummer),s(projekt.name)].filter(Boolean).join(' '),phase:s(v.kopf_phase).trim(),untertitel:s(v.kopf_untertitel).trim()||s(v.titel).trim()||'Mustermappe'},
    strategien:{A:s(v.strategie_a),B:s(v.strategie_b)},seiten:seitenVon(v),punkte};
}
// Fotos, die niemand gewählt hat: das erste Foto des Produkts in der Bibliothek (wie die Karte der Bibliothek).
function mitStandardFotos(inhalt,fotosVon){
  for(const p of inhalt.punkte)for(const o of p.optionen)if(!o.fotos.length&&o.produktId){
    const f=(fotosVon(o.produktId)||[])[0];if(f)o.fotos=[{id:s(f.id),pfad:s(f.pfad||f.storage_path)}];
  }
  return inhalt;
}
function allePfade(inhalt){
  const produkt=new Set(),mappe=new Set();
  for(const p of inhalt.punkte||[])for(const o of p.optionen||[])for(const f of o.fotos||[])(f.quelle==='mappe'?mappe:produkt).add(f.pfad);
  for(const x of inhalt.seiten||[])if(['frei','deckblatt'].includes(x.typ)&&s(x.bild?.pfad))mappe.add(x.bild.pfad);
  return {produkt:[...produkt],mappe:[...mappe]};
}
function kandidatenDerSeite(seite,punkt){
  const alle=punkt?.optionen||[];
  const wahl=Array.isArray(seite?.optionen)?alle.filter(o=>seite.optionen.includes(o.id)):alle;
  return wahl.slice(0,MAX_KANDIDATEN);
}
function zeigt(seite,teil){return seite?.zeige?.[teil]!==false}
function strategieText(inh,k){
  const n=inh.strategien?.[k];
  return 'Strategie '+k+(s(n).trim()?' · '+s(n).trim():'');
}
function gewaehlt(p){
  if(p.status!=='entschieden')return '';
  const id=/^\s*([A-H])\s*[:·.)]/.exec(p.entscheidung)?.[1]||'';
  const o=p.optionen.find(x=>x.id===id);
  return o?o.id+' · '+o.name:p.entscheidung;
}
// Übersicht: gemeinsame Positionen, dann Strategie A und B, wenn es beide gibt.
function uebersichtGruppen(inh){
  const hatA=inh.punkte.some(p=>p.strategie==='A'),hatB=inh.punkte.some(p=>p.strategie==='B');
  if(!(hatA&&hatB))return [{titel:'',punkte:inh.punkte}];
  return [{titel:'Für beide Strategien',punkte:inh.punkte.filter(p=>!['A','B'].includes(p.strategie))},
    {titel:strategieText(inh,'A'),punkte:inh.punkte.filter(p=>p.strategie==='A')},
    {titel:strategieText(inh,'B'),punkte:inh.punkte.filter(p=>p.strategie==='B')}].filter(g=>g.punkte.length);
}

// ---------- Seiten als HTML ----------
// TBA-Raster A3 quer (Gari, 26.11.2026, nach den Rastersystemen von Müller-Brockmann und Gerstner): 12 Spalten und
// 8 Zeilen quadratischer Felder von 28 mm, Abstand 4 mm = Grundlinie; Ränder 20 mm seitlich, 24 mm oben, 21 mm unten;
// Satzspiegel 380 × 252 mm. Jede Seite setzt ihre Teile in Rahmen auf diese Felder; Kopf- und Fußzeile stehen wie im
// Archicad-Master auf den Grundlinien 16 und 284 mm. Schrift Arial (wie in Archicad, auf Mac und Windows gleich):
// 9 pt auf 4 mm, klein 7,5 pt, Titel 20 pt auf 8 mm; alle Zeilen auf der Grundlinie, so endet ein voller Rahmen an
// einer Zeile. modus «bearbeiten»: dieselbe Seite, die Texte zum Hineinschreiben, dazu das Raster (eingeblendet nach
// Wahl); «druck»: für PDF, Präsentieren und Stand. bild(pfad,bucket) liefert die Adresse eines Fotos oder ''.
// Alles Eingegebene wird maskiert.
const RASTER=Object.freeze({breite:420,hoehe:297,links:20,oben:24,unten:21,spalten:12,zeilen:8,feld:28,abstand:4,grundlinie:4,kopf:16,fuss:284});
const BUERO=Object.freeze(['Titus Bernhard','Architekten','BDA']);
function rasterMass(n){return n*(RASTER.feld+RASTER.abstand)-RASTER.abstand}
const RASTER_HTML='<div class="mm-raster" aria-hidden="true">'+'<i></i>'.repeat(RASTER.spalten*RASTER.zeilen)+'</div>'+
  '<div class="mm-raster-gross" aria-hidden="true">'+'<i></i>'.repeat(RASTER.spalten*RASTER.zeilen/4)+'</div><div class="mm-raster-linien" aria-hidden="true"></div>';

// ---------- Layout der Seite (Etappe 2, Gari, 26.11.2026) ----------
// Jeder Rahmen einer Vorlage hat einen Schlüssel (kopf, foto-1, beschreibung …) und steht zuerst, wo die Vorlage ihn
// setzt. Verschoben oder in der Größe geändert springt er von Feld zu Feld des Rasters; was von der Vorlage abweicht,
// steht in seite.layout, getrennt nach der Form der Seite (layoutBasis: ein Vergleich mit zwei Varianten hat ein
// anderes Layout als einer mit drei). So bleibt die Vorlage für eine andere Zahl Varianten sauber, und das Angepasste
// kommt wieder, wenn die Zahl zurückgeht. {aus:true} blendet einen Rahmen aus. Rahmen dürfen sich überlappen; Texte
// liegen dann über Fotos. Im PDF, beim Präsentieren und in den Ständen gilt dasselbe Layout.
const SCHLUESSEL=/^[a-z]+(-\d)?$/;
function geoSauber(g){
  if(!g||typeof g!=='object')return null;
  if(g.aus===true)return {aus:true};
  const n=k=>{const x=Number(g[k]);return Number.isInteger(x)?x:NaN};
  const c=n('c'),r=n('r'),w=n('w'),h=n('h');
  if(!(c>=1&&r>=1&&w>=1&&h>=1&&c+w-1<=RASTER.spalten&&r+h-1<=RASTER.zeilen))return null;
  return {c,r,w,h};
}
function layoutSauber(l){
  if(!l||typeof l!=='object'||Array.isArray(l))return null;
  const out={};
  for(const [b,teile] of Object.entries(l)){
    if(!SCHLUESSEL.test(b)||!teile||typeof teile!=='object'||Array.isArray(teile))continue;
    const x={};
    for(const [k,g] of Object.entries(teile)){if(!SCHLUESSEL.test(k))continue;const v=geoSauber(g);if(v)x[k]=v}
    if(Object.keys(x).length)out[b]=x;
  }
  return Object.keys(out).length?out:null;
}
function layoutBasis(seite,inh){
  if(seite?.typ!=='vergleich')return s(seite?.typ);
  const p=(inh?.punkte||[]).find(x=>x.id===seite.punkt);
  return 'vergleich-'+(p?kandidatenDerSeite(seite,p).length:0);
}
// Einen Rahmen setzen (geo {c,r,w,h} oder {aus:true}), null = wie die Vorlage. Ohne Abweichung bleibt kein Layout (null).
function layoutSetzen(layout,basis,key,geo){
  if(!SCHLUESSEL.test(s(basis))||!SCHLUESSEL.test(s(key)))return layoutSauber(layout);
  const l=layoutSauber(layout)||{},teile={...(l[basis]||{})},g=geo===null?null:geoSauber(geo);
  if(g)teile[key]=g;else delete teile[key];
  if(Object.keys(teile).length)l[basis]=teile;else delete l[basis];
  return layoutSauber(l);
}
// Die ganze Seite wie die Vorlage (nur die Form, die sie gerade hat; ein Layout für eine andere Zahl Varianten bleibt).
function layoutVorlage(layout,basis){const l=layoutSauber(layout)||{};delete l[basis];return layoutSauber(l)}
// Größe eines Rahmens: Felder, Millimeter und Seitenverhältnis (bekannte Formate auf 2,5 % genau).
const FORMATE=[[1,'1:1','1:1'],[5/4,'5:4','4:5'],[4/3,'4:3','3:4'],[Math.SQRT2,'A-Format','A-Format hoch'],[3/2,'3:2','2:3'],[16/9,'16:9','9:16'],[2,'2:1','1:2'],[3,'3:1','1:3']];
function rahmenMass(g){
  const w=Math.max(1,Math.floor(Number(g?.w))||1),h=Math.max(1,Math.floor(Number(g?.h))||1);
  const breite=rasterMass(w),hoehe=rasterMass(h),q=breite/hoehe,quer=q>=1,x=quer?q:1/q;
  const f=FORMATE.find(([v])=>Math.abs(x/v-1)<=.025);
  const zahl=n=>n.toFixed(2).replace('.',',');
  return {breite,hoehe,felder:w+' × '+h+(w*h===1?' Feld':' Felder'),mm:breite+' × '+hoehe+' mm',
    verhaeltnis:f?(quer?f[1]:f[2]):quer?zahl(x)+':1':'1:'+zahl(x)};
}
// Während seiteHtml: Layout der Seite und die Liste ihrer Rahmen (für die Eigenschaften beim Bearbeiten).
let SATZ=null;
// Ein Rahmen ab Spalte c und Zeile r, w Felder breit und h hoch (so setzt ihn die Vorlage). name nennt ihn beim
// Bearbeiten (Hinweis, wenn der Inhalt nicht hineinpasst; im PDF wird an der letzten ganzen Zeile abgeschnitten).
// key: Schlüssel im Layout der Seite, titel: sein Name in den Eigenschaften. ablage: Platz für ein weiteres Foto, nur
// beim Ziehen eines Fotos sichtbar (steht nicht in der Liste der Rahmen).
function rahmen(c,r,w,h,innen,{klasse='',name='',modus='druck',key='',titel='',ablage=false}={}){
  const std={c,r,w,h},ed=(SATZ?SATZ.modus:modus)==='bearbeiten';
  let g=std,eigen=false;
  if(key&&SATZ){
    const x=SATZ.layout?.[key],t=titel||name||key;
    if(x?.aus){if(!ablage)SATZ.liste.push({key,titel:t,std,aus:true});return ''}
    if(x){g=x;eigen=true}
    if(!ablage)SATZ.liste.push({key,titel:t,std,geo:g,eigen});
  }
  return '<div class="mm-r'+(klasse?' '+klasse:'')+'" style="grid-column:'+g.c+' / span '+g.w+';grid-row:'+g.r+' / span '+g.h+'"'+
    (ed&&name?' data-rahmen="'+esc(name)+'"':'')+
    (ed&&key&&!ablage?' data-mmr="'+esc(key)+'" data-mmr-name="'+esc(titel||name||key)+'" data-mmr-g="'+[g.c,g.r,g.w,g.h].join(',')+'" data-mmr-std="'+[c,r,w,h].join(',')+'"'+(eigen?' data-mmr-eigen':''):'')+
    '>'+innen+'</div>';
}
// Text auf der Seite: im Druck als Text, beim Bearbeiten dasselbe Element zum Hineinschreiben (gleiche Schrift, gleiche
// Stelle; die Seite sieht beim Bearbeiten aus wie im PDF). Leer: im Druck nichts, beim Bearbeiten der Platzhalter.
function text(modus,tag,klasse,wert,{attr='',leer='',id='',einzeilig=false,geaendert=false}={}){
  const t=s(wert);
  if(modus!=='bearbeiten')return t.trim()?'<'+tag+(klasse?' class="'+klasse+'"':'')+'>'+esc(t)+'</'+tag+'>':'';
  return '<'+tag+' class="'+(klasse?klasse+' ':'')+'mm-ed'+(geaendert?' mm-geaendert':'')+'"'+(id?' id="'+esc(id)+'"':'')+(attr?' '+attr:'')+
    ' contenteditable="plaintext-only" role="textbox"'+(einzeilig?' data-einzeilig':' aria-multiline="true"')+' aria-label="'+esc(leer)+'" data-leer="'+esc(leer)+'"'+
    (geaendert?' title="In dieser Mappe geändert"':'')+'>'+esc(t)+'</'+tag+'>';
}
// Fotos der Varianten stehen in einem Rahmen; der Ausschnitt verschiebt und vergrößert das Bild darin. ort: Position,
// Variante und Stelle des Fotos (data-mmfoto, auch im Druck: daran misst der Dialog «Bild ändern» den Rahmen im PDF);
// beim Bearbeiten dazu «Bild ändern» und, solange Platz ist, «+ Bild». Bilder der freien Seite und des Deckblatts liegen
// im Speicher der Mappe; die freie Seite zeigt ihr Bild ganz (ein Plan wird nicht beschnitten).
function bildStil(a){
  const x=ausschnittVon(a);if(!x)return '';
  return ' style="object-position:'+x.x+'% '+x.y+'%'+(x.z>1?';transform:scale('+x.z+');transform-origin:'+x.x+'% '+x.y+'%':'')+'"';
}
function foto(f,bild,alt,klasse,{bucket=BUCKET_PRODUKTE,ort=null,edit=false}={}){
  const b=f?.quelle==='mappe'?BUCKET:bucket;
  const url=f?.pfad?bild(f.pfad,b):'';
  const knopf=(i,t)=>'<button type="button" class="mm-bild-knopf" data-act="mm-bild" data-z="'+esc(ort.z)+'" data-o="'+esc(ort.o)+'" data-i="'+i+'">'+t+'</button>';
  const knoepfe=edit&&ort?'<span class="mm-bild-knoepfe">'+knopf(ort.i,url?'Bild ändern':'Bild wählen')+
    (url&&Number.isInteger(ort.plus)?knopf(ort.plus,'+ Bild'):'')+'</span>':'';
  const stelle=(ort?' data-mmfoto="'+esc(ort.o+'|'+ort.i)+'"':'')+(edit&&ort?' data-bildplatz="'+esc(ort.z+'|'+ort.o+'|'+ort.i)+'"':'');
  if(!url)return '<div class="mm-foto mm-foto-leer '+klasse+'" role="img" aria-label="'+esc(alt+': kein Foto')+'"'+stelle+'><span>kein Foto</span>'+knoepfe+'</div>';
  if(bucket===BUCKET)return '<img class="mm-foto '+klasse+'" src="'+esc(url)+'" data-pfad="'+esc(f.pfad)+'" alt="'+esc(alt)+'">';
  return '<span class="mm-foto mm-rahmen '+klasse+'"'+stelle+'><img class="mm-foto-bild" src="'+esc(url)+'" data-pfad="'+esc(f.pfad)+'" alt="'+esc(alt)+'"'+
    bildStil(f.ausschnitt)+'>'+knoepfe+'</span>';
}
function herkunftText(o){return typeof o.herkunft==='string'?o.herkunft:[o.hersteller,o.serie].filter(Boolean).join(' · ')}
// Kopfzeile wie im Archicad-Master: links «Projekt | Phase | Untertitel», rechts Datum und Büro; Fußzeile «Seite/Seiten»
// und der Name der Seite. Die Texte kommen aus den Angaben der Mappe.
function kopfzeile(inh){
  const k=inh.kopf||{},projekt=s(k.projekt)||[inh.projekt?.nummer,inh.projekt?.name].filter(Boolean).join(' '),untertitel=s(k.untertitel)||s(inh.titel);
  const links=[esc(projekt),s(k.phase).trim()?'<b>'+esc(k.phase)+'</b>':'',esc(untertitel)].filter(Boolean).join(' | ');
  const tag=datum(inh.stand);
  return '<header class="mm-kopfzeile"><span>'+links+'</span><span class="mm-kz-rechts">'+(tag?'<span>'+esc(tag)+'</span>':'')+
    '<span>'+esc(BUERO[0])+' <b>'+esc(BUERO[1])+'</b> '+esc(BUERO[2])+'</span></span></header>';
}
function fusszeile(nr,gesamt,name){return '<footer class="mm-fusszeile"><span>'+nr+'/'+gesamt+'</span><b>'+esc(name)+'</b></footer>'}
function titelKopf(p,zusatz=''){
  return '<h2 class="mm-t-titel"><span class="mm-code">'+esc(p.code||p.nr)+'</span> '+esc(p.bezeichnung)+(zusatz?' <span class="mm-zusatz">'+esc(zusatz)+'</span>':'')+'</h2>';
}
function zonenText(p){const t=[p.zonen,p.flaeche].filter(x=>s(x).trim()).map(esc).join('\n');return t?'<p>'+t+'</p>':''}
// Kennwerte als Tabelle, eine Zeile je Grundlinie; die Seite zeigt so viele, wie in den Rahmen passen. Beim Bearbeiten
// sind Feld und Wert direkt in der Tabelle zu ändern (für diese Mappe), «+ Kennwert» hängt eine Zeile an.
function kennwerteTabelle(modus,p,o){
  const m=o.merkmale||[],ed=modus==='bearbeiten';
  if(!m.length&&!ed)return '';
  const zelle=(tag,i,feld,w)=>{
    const sc=tag==='th'?' scope="row"':'',name=feld?'Kennwert':'Wert';
    if(!ed)return '<'+tag+sc+'>'+esc(w)+'</'+tag+'>';
    return '<'+tag+sc+' class="mm-ed" id="'+esc('mm-'+p.id+'-'+o.id+'-kw'+i+(feld?'f':'w'))+'" data-mmkw="'+esc(p.id+'|'+o.id)+'" contenteditable="plaintext-only" role="textbox" data-einzeilig aria-label="'+name+'" data-leer="'+name+'">'+esc(w)+'</'+tag+'>';
  };
  const g=ed&&!!o.geaendert?.kennwerte;
  return '<table class="mm-kennwerte'+(g?' mm-geaendert':'')+'"'+(ed?' data-mmkwtab="'+esc(p.id+'|'+o.id)+'"'+(g?' title="In dieser Mappe geändert"':''):'')+
    '><colgroup><col class="mm-kw-feld"><col></colgroup><tbody>'+(m.length?m:[{feld:'',wert:''}]).map((x,i)=>'<tr>'+zelle('th',i,true,x.feld)+zelle('td',i,false,x.wert)+'</tr>').join('')+'</tbody></table>'+
    (ed?'<button type="button" class="mm-kw-plus" data-act="mm-kw-neu" data-z="'+esc(p.id)+'" data-o="'+esc(o.id)+'">+ Kennwert</button>':'');
}
function kostenText(label,wert,beleg){
  return '<p class="mm-t-klein mm-leise">'+esc(label)+'</p><p class="mm-t-mittel">'+esc(wert)+'</p>'+(s(beleg).trim()?'<p class="mm-t-klein mm-leise">'+esc(beleg)+'</p>':'');
}
function kostenRahmen(p,o){
  if(o&&s(o.kennwert).trim())return kostenText('Kennwert netto',o.kennwert,o.beleg);
  if(s(p.kosten).trim())return kostenText('Kostenrahmen netto',p.kosten,p.kostenBeleg);
  return '';
}
function entschiedenZeile(p){
  if(p.status!=='entschieden')return '';
  return '<p class="mm-entschieden">Entschieden am '+esc(datum(p.entschiedenAm))+(p.entscheider?' von '+esc(p.entscheider):'')+': '+esc(gewaehlt(p))+'</p>';
}
function zuBeachten(p){
  return [['Anforderungen',p.anforderungen],['Zu beachten',p.hinweise]].filter(([,t])=>s(t).trim()).map(([k,t])=>'<p><b>'+esc(k)+':</b> '+esc(s(t).trim())+'</p>').join('');
}
function empfehlungText(seite,p,modus){
  let h=entschiedenZeile(p);
  if(!zeigt(seite,'empfehlung'))return h;
  const kopf=p.empfehlung?'Empfehlung: Variante '+p.empfehlung+'.':modus==='bearbeiten'?'Empfehlung offen.':'';
  const beg=text(modus,'p','mm-begruendung',p.begruendung,{attr:'data-mmtext="begruendung" data-z="'+esc(p.id)+'"',leer:'Begründung der Empfehlung',id:'mm-'+p.id+'-begruendung'});
  return h+(kopf?'<p><b>'+esc(kopf)+'</b></p>':'')+beg;
}
// Name und Hersteller einer Variante; beim Bearbeiten für diese Mappe zu ändern (geändert = blau umrandet).
function nameZeile(modus,p,o,{mitId=true,empf=''}={}){
  const name=modus==='bearbeiten'?text(modus,'span','mm-fett',o.name,{attr:'data-mmanp="'+esc(p.id+'|'+o.id+'|name')+'"',leer:'Name der Variante',
    id:'mm-'+p.id+'-'+o.id+'-name',einzeilig:true,geaendert:!!o.geaendert?.name}):'<b>'+esc(o.name)+'</b>';
  return '<p class="mm-name">'+(mitId?'<b>'+esc(o.id)+' · </b>':'')+name+(empf?' <span class="mm-empf">'+esc(empf)+'</span>':'')+'</p>';
}
function herkunftZeile(modus,p,o){
  return text(modus,'p','mm-t-klein mm-leise',herkunftText(o),{attr:'data-mmanp="'+esc(p.id+'|'+o.id+'|herkunft')+'"',leer:'Hersteller · Serie',
    id:'mm-'+p.id+'-'+o.id+'-herkunft',einzeilig:true,geaendert:!!o.geaendert?.herkunft});
}
function seiteDeckblatt(seite,inh,{modus,bild}){
  const ed=modus==='bearbeiten',b=seite.bild&&s(seite.bild.pfad)?seite.bild:null;
  const titel=inh.themenpaket||inh.titel.replace(/^Mustermappe\s*/,'')||inh.titel;
  const projekt=[inh.projekt.nummer,inh.projekt.name].filter(Boolean).join(' · ');
  const stand=inh.status==='vorgelegt'&&inh.vorgelegtAm?'vorgelegt am '+datum(inh.vorgelegtAm):'Stand '+(datum(inh.stand)||'')+' · Entwurf';
  // Titelbild (optional) über die ganze Breite; ohne Bild bleibt die Fläche weiß (Titel unten links, wie ein Plakat).
  const titelbild=b?rahmen(1,1,12,5,foto(b,bild,'Titelbild','mm-foto-deck',{bucket:BUCKET}),{klasse:'mm-r-foto',key:'bild',titel:'Titelbild'})
    :ed?rahmen(1,1,12,5,'<div class="mm-foto mm-foto-leer"><span>Titelbild (optional): rechts ein Bild oder ein PDF hochladen.</span></div>',{klasse:'mm-r-foto',key:'bild',titel:'Titelbild'}):'';
  return titelbild+rahmen(1,6,8,2,'<p class="mm-kicker">Mustermappe</p><h2 class="mm-t-gross">'+esc(titel)+'</h2>'+(projekt?'<p class="mm-t-mittel">'+esc(projekt)+'</p>':''),{klasse:'mm-r-kopf',name:'Titel',modus,key:'titel'})+
    rahmen(9,6,4,3,'<p><b>Vorlage zur Bemusterung'+(datum(inh.termin)?' am '+esc(datum(inh.termin)):'')+'</b></p>'+
      text(modus,'p','mm-deck-text',inh.deckblatt,{attr:'data-mmvorlage="deckblatt_text"',leer:'Text für das Deckblatt (optional)',id:'mm-deckblatt'})+
      '<p class="mm-t-klein mm-leise mm-abstand">'+esc(stand)+(inh.verfasser?' · '+esc(inh.verfasser):'')+'</p>',{klasse:'mm-r-kopf',name:'Deckblatt-Text',modus,key:'text'});
}
// Übersicht: Spalten der Tabelle auf dem Raster (1, 2, 3, 3, 1 und 2 Felder, je mit dem Abstand), in Anteilen der
// Breite: in einem schmaleren Rahmen (Etappe 2) bleiben die Verhältnisse.
const UEBERSICHT_SPALTEN=[['Code',32],['Position',64],['Zonen und Fläche',96],['Kandidaten',96],['Empfehlung',32],['Stand',60]];
function seiteUebersicht(inh,{modus}){
  const strat=['A','B'].filter(k=>s(inh.strategien?.[k]).trim()).map(k=>strategieText(inh,k)).join('\n');
  const kopf=rahmen(1,1,12,1,'<h2 class="mm-t-titel">Übersicht</h2>'+(strat?'<p>'+esc(strat)+'</p>':''),{klasse:'mm-r-kopf',name:'Kopf',modus,key:'kopf'});
  if(!inh.punkte.length)return kopf+rahmen(1,2,12,1,'<p class="mm-leise">Noch keine Position.</p>',{key:'tabelle',titel:'Tabelle'});
  const n=UEBERSICHT_SPALTEN.length;
  return kopf+rahmen(1,2,12,7,'<table class="mm-tabelle"><colgroup>'+UEBERSICHT_SPALTEN.map(([,mm])=>'<col style="width:'+Math.round(mm/380*1e6)/1e4+'%">').join('')+'</colgroup>'+
    '<thead><tr>'+UEBERSICHT_SPALTEN.map(([t])=>'<th>'+esc(t)+'</th>').join('')+'</tr></thead><tbody>'+
    uebersichtGruppen(inh).map(g=>(g.titel?'<tr class="mm-gruppe"><th colspan="'+n+'">'+esc(g.titel)+'</th></tr>':'')+g.punkte.map(p=>'<tr><td><b>'+esc(p.code||p.nr)+'</b></td><td>'+esc(p.bezeichnung)+'</td><td>'+
      esc([p.zonen,p.flaeche].filter(x=>s(x).trim()).join(' · '))+'</td><td>'+esc(p.optionen.map(o=>o.id+' · '+o.name).join('\n')||'noch offen')+'</td><td>'+
      esc(p.empfehlung?'Variante '+p.empfehlung:'–')+'</td><td>'+esc(p.status==='entschieden'?'entschieden: '+gewaehlt(p):'offen')+'</td></tr>').join('')).join('')+'</tbody></table>',{name:'Übersicht',modus,key:'tabelle',titel:'Tabelle'});
}
// Vergleich: je Variante Foto und Text in einer Spalte (2 × 6 oder 3 × 4 Felder, eine Variante 8 + 4); der Kopf darüber,
// die Zonen rechts über der Spalte der letzten Variante (bei zwei ab Feld 7, sonst ab Feld 9); unten Empfehlung, Kosten
// und «Zu beachten» (bei drei Varianten in deren Spalten).
function seiteVergleich(seite,inh,p,{modus,bild}){
  const kand=kandidatenDerSeite(seite,p),n=kand.length,ed=modus==='bearbeiten',kw=n===2?6:8;
  const fotoVon=o=>foto(o.fotos[0],bild,o.name,'mm-foto-kand',{ort:{z:p.id,o:o.id,i:0},edit:ed});
  const textVon=o=>nameZeile(modus,p,o,{empf:p.empfehlung===o.id&&zeigt(seite,'empfehlung')?'Empfehlung':''})+herkunftZeile(modus,p,o)+
    (zeigt(seite,'kennwerte')?kennwerteTabelle(modus,p,o):'')+
    (zeigt(seite,'kosten')&&s(o.kennwert).trim()?'<p class="mm-t-klein mm-abstand">Kennwert netto <b>'+esc(o.kennwert)+'</b>'+(o.beleg?' · '+esc(o.beleg):'')+'</p>':'');
  let h=rahmen(1,1,kw,1,titelKopf(p)+text(modus,'p','mm-frage',p.frage,{attr:'data-mmtext="frage" data-z="'+esc(p.id)+'"',leer:'Frage an den Bauherrn, z. B. Welcher Belag für diese Zonen?',id:'mm-'+p.id+'-frage'}),{klasse:'mm-r-kopf',name:'Kopf',modus,key:'kopf'})+
    rahmen(1+kw,1,12-kw,1,zonenText(p),{klasse:'mm-r-kopf mm-t-klein',name:'Zonen',modus,key:'zonen'});
  // Schlüssel je Spalte der Seite (foto-1, text-1 …), nicht je Variante: das Layout gehört zur Seite.
  const spalte=(o,i,[c,r,w,fh,th])=>rahmen(c,r,w,fh,fotoVon(o),{klasse:'mm-r-foto',key:'foto-'+(i+1),titel:'Foto '+o.id})+
    rahmen(c,r+fh,w,th,textVon(o),{name:o.id,modus,key:'text-'+(i+1),titel:'Text '+o.id});
  if(n===1)h+=rahmen(1,2,8,6,fotoVon(kand[0]),{klasse:'mm-r-foto',key:'foto-1',titel:'Foto '+kand[0].id})+rahmen(9,2,4,6,textVon(kand[0]),{name:kand[0].id,modus,key:'text-1',titel:'Text '+kand[0].id});
  else if(n>1){const w=12/n,fh=n===3?3:4;kand.forEach((o,i)=>{h+=spalte(o,i,[1+i*w,2,w,fh,6-fh])})}
  else if(ed)h+=rahmen(1,2,12,1,'<p class="mm-leise">Noch kein Kandidat. Rechts einen aus der Bibliothek wählen.</p>');
  // Eine Position ohne Produkt (etwa geschliffener Estrich) zeigt Kopf, Frage, Kosten und Hinweise gleich unter dem Kopf.
  const r=n?8:2,[we,wk]=n===3?[4,4]:[6,2],wb=12-we-wk;
  const kostenPos=zeigt(seite,'kosten')&&!kand.some(o=>s(o.kennwert).trim())?kostenRahmen(p,null):'';
  return h+rahmen(1,r,we,1,empfehlungText(seite,p,modus),{name:'Empfehlung',modus,key:'empfehlung'})+rahmen(1+we,r,wk,1,kostenPos,{name:'Kosten',modus,key:'kosten'})+
    rahmen(1+we+wk,r,wb,1,zuBeachten(p),{klasse:'mm-t-klein',name:'Zu beachten',modus,key:'beachten'});
}
// Material: großes Foto links (6 × 8 Felder), rechts Kopf, zwei kleine Fotos (3 × 2), Beschreibung, Kennwerte, Kosten.
function seiteMaterial(seite,inh,p,{modus,bild}){
  const o=p.optionen.find(x=>x.id===seite.option)||p.optionen[0],ed=modus==='bearbeiten';
  if(!o)return rahmen(1,1,12,1,titelKopf(p)+'<p class="mm-leise">Diese Variante gibt es nicht mehr.</p>',{klasse:'mm-r-kopf'});
  const klein=o.fotos.slice(1,MAX_FOTOS);
  // Beim Bearbeiten: «+ Bild» auf dem großen Foto, solange die Variante weniger als drei hat; das Raster bleibt gleich.
  const ort=i=>({z:p.id,o:o.id,i,...(i===0&&o.fotos.length<MAX_FOTOS?{plus:o.fotos.length}:{})});
  let h=rahmen(1,1,6,8,foto(o.fotos[0],bild,o.name,'mm-foto-gross',{ort:ort(0),edit:ed}),{klasse:'mm-r-foto',key:'foto',titel:'Foto'})+
    rahmen(7,1,6,1,titelKopf(p,'Variante '+o.id)+nameZeile(modus,p,o,{mitId:false,empf:p.empfehlung===o.id&&zeigt(seite,'empfehlung')?'Empfehlung des Büros':''})+
      herkunftZeile(modus,p,o)+entschiedenZeile(p),{klasse:'mm-r-kopf',name:'Kopf',modus,key:'kopf'});
  klein.forEach((f,j)=>{h+=rahmen(7+3*j,2,3,2,foto(f,bild,o.name,'mm-foto-klein',{ort:ort(j+1),edit:ed}),{klasse:'mm-r-foto',key:'foto-'+(j+2),titel:'Bild '+(j+2)})});
  // Beim Ziehen eines Fotos auf die Seite: der Platz für das nächste (Bild 2 oder 3), dort, wo es stehen wird.
  if(ed&&o.fotos.length&&o.fotos.length<MAX_FOTOS){
    const j=o.fotos.length-1;
    h+=rahmen(7+3*j,2,3,2,'<div class="mm-ablage" data-bildplatz="'+esc(p.id+'|'+o.id+'|'+o.fotos.length)+'"><span>Bild '+(j+2)+'</span></div>',{klasse:'mm-r-foto mm-r-ablage',key:'foto-'+(j+2),ablage:true});
  }
  const tz=klein.length?4:2;
  return h+rahmen(7,tz,6,6-tz,text(modus,'p','mm-beschreibung',o.beschreibung,{attr:'data-mmopt="'+esc(p.id+'|'+o.id)+'"',leer:'Beschreibung für den Bauherrn',
      id:'mm-'+p.id+'-'+o.id+'-text',geaendert:!!o.geaendert?.beschreibung}),{name:'Beschreibung',modus,key:'beschreibung'})+
    rahmen(7,6,6,2,zeigt(seite,'kennwerte')?kennwerteTabelle(modus,p,o):'',{name:'Kennwerte',modus,key:'kennwerte'})+
    rahmen(7,8,2,1,zeigt(seite,'kosten')?kostenRahmen(p,o):'',{name:'Kosten',modus,key:'kosten'})+
    rahmen(9,8,4,1,zuBeachten(p),{klasse:'mm-t-klein',name:'Zu beachten',modus,key:'beachten'});
}
// Freie Seite: Bild oder PDF-Seite über 10 × 8 Felder (ganz gezeigt, oben links), rechts Titel und Text.
function seiteFrei(seite,{modus,bild}){
  const b=seite.bild&&s(seite.bild.pfad)?seite.bild:null,ed=modus==='bearbeiten';
  return rahmen(1,1,10,8,b?foto(b,bild,s(seite.titel)||s(b.name)||'Bild','mm-foto-frei',{bucket:BUCKET})
      :ed?'<div class="mm-foto mm-foto-leer"><span>Rechts ein Bild oder ein PDF hochladen.</span></div>':'',{klasse:'mm-r-foto',key:'bild',titel:'Bild'})+
    rahmen(11,1,2,8,text(modus,'h2','mm-t-mittel',seite.titel,{attr:'data-mmseite="'+esc(seite.id)+'|titel"',leer:'Titel der Seite',id:'mm-'+seite.id+'-titel'})+
      text(modus,'p','mm-frei-text',seite.text,{attr:'data-mmseite="'+esc(seite.id)+'|text"',leer:'Text zur Seite (optional)',id:'mm-'+seite.id+'-text'}),{klasse:'mm-r-kopf',name:'Text',modus,key:'text',titel:'Titel und Text'});
}
// liste: sammelt die Rahmen der Seite ({key,titel,std,geo,eigen} oder {key,titel,std,aus}); siehe rahmenDerSeite.
function seiteHtml(seite,inh,{nr=1,gesamt=1,modus='druck',bild=()=>'',liste=null}={}){
  if(!seite)return '';
  const p=['vergleich','material'].includes(seite.typ)?inh.punkte.find(x=>x.id===seite.punkt):null;
  const o=p&&seite.typ==='material'?p.optionen.find(x=>x.id===seite.option)||p.optionen[0]:null;
  const vorher=SATZ;
  SATZ={modus,layout:layoutSauber(seite.layout)?.[layoutBasis(seite,inh)]||null,liste:liste||[]};
  let innen='';
  try{
    if(seite.typ==='deckblatt')innen=seiteDeckblatt(seite,inh,{modus,bild});
    else if(seite.typ==='uebersicht')innen=seiteUebersicht(inh,{modus});
    else if(seite.typ==='vergleich')innen=p?seiteVergleich(seite,inh,p,{modus,bild}):'';
    else if(seite.typ==='material')innen=p?seiteMaterial(seite,inh,p,{modus,bild}):'';
    else if(seite.typ==='frei')innen=seiteFrei(seite,{modus,bild});
  }finally{SATZ=vorher}
  const name=seite.typ==='frei'?(s(seite.titel).trim()||'Freie Seite'):seiteName(seite,p,o);
  // Beim Bearbeiten über den Rahmen eine Ebene für Auswahl, Griff und Anfasser (füllt der Editor).
  return '<div class="mm-blatt" data-seite="'+esc(seite.id)+'"><article class="mm-seite mm-typ-'+esc(seite.typ)+'" aria-label="'+esc('Seite '+nr+' von '+gesamt)+'">'+
    (modus==='bearbeiten'?RASTER_HTML:'')+kopfzeile(inh)+'<div class="mm-satz">'+innen+'</div>'+(modus==='bearbeiten'?'<div class="mm-ebene"></div>':'')+
    fusszeile(nr,gesamt,name)+'</article></div>';
}
// Die Rahmen einer Seite, wie sie gerade steht: Schlüssel, Name, Stelle in der Vorlage und auf der Seite, ausgeblendet.
function rahmenDerSeite(seite,inh){
  const liste=[];
  if(seite)seiteHtml(seite,inh,{modus:'bearbeiten',liste});
  return {basis:layoutBasis(seite,inh),rahmen:liste};
}
function mappeHtml(inh,{modus='druck',bild=()=>''}={}){
  const l=inh.seiten||[];
  return l.map((x,i)=>seiteHtml(x,inh,{nr:i+1,gesamt:l.length,modus,bild})).join('');
}

return Object.freeze({FORM,SCHEMA,BUCKET,BUCKET_PRODUKTE,THEMEN,KATEGORIEN,SEITEN,STRATEGIEN,MUSTER_FELDER,MAX_KANDIDATEN,MAX_FOTOS,BILDTYPEN,BILD_MAX,ZOOM_MAX,
  esc,datum,neueId,naechsteOptionId,istMappe,neueMappe,thema,neuePosition,produktAuszug,veraltet,kandidat,fotosUmschalten,dateiPfad,bildPruefen,
  ausschnittVon,fotoSauber,fotoListe,fotoSetzen,fotoEntfernen,fotoNachVorn,fotoAusschnitt,
  ANPASSUNG_NAME,merkmaleText,merkmaleAusText,anpassen,zuruecksetzen,geaendert,geaenderteTexte,anpassbarAuf,
  RASTER,BUERO,rasterMass,geoSauber,layoutSauber,layoutBasis,layoutSetzen,layoutVorlage,rahmenMass,rahmenDerSeite,
  seitenVon,seiteVerschieben,seiteName,belegVon,mappeInhalt,mitStandardFotos,allePfade,kandidatenDerSeite,uebersichtGruppen,gewaehlt,seiteHtml,mappeHtml});
});
