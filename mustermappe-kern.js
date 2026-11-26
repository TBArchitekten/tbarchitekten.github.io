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
   (aus der Bibliothek oder ein eigenes Bild, das in der Mappe bleibt) und zuschneiden. Die Seitenraster bleiben fest. */
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
  else if(feld==='kennwerte'){const l=merkmaleAusText(wert);if(gleicheMerkmale(l,a.merkmale))delete n.muster_merkmale;else n.muster_merkmale=l}
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
  for(const x of inhalt.seiten||[])if(x.typ==='frei'&&s(x.bild?.pfad))mappe.add(x.bild.pfad);
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
// modus «bearbeiten»: die Texte der Mappe als Eingabefelder auf der Seite; «druck»: Lesefassung für PDF und Stand.
// bild(pfad,bucket) liefert die Adresse eines Fotos oder ''. Alles Eingegebene wird maskiert.
function feld(modus,attr,wert,{zeilen=2,platz='',klasse='',titel=false,id=''}={}){
  if(modus!=='bearbeiten'){
    if(!s(wert).trim())return '';
    return titel?'<h2 class="mm-titel">'+esc(wert)+'</h2>':'<p class="mm-p '+klasse+'">'+esc(wert).replace(/\n/g,'<br>')+'</p>';
  }
  return '<textarea'+(id?' id="'+esc(id)+'"':'')+' class="mm-text '+klasse+'" '+attr+' rows="'+zeilen+'" placeholder="'+esc(platz)+'" aria-label="'+esc(platz)+'">'+esc(wert)+'</textarea>';
}
// Fotos der Varianten stehen in einem Rahmen fester Größe; der Ausschnitt verschiebt und vergrößert das Bild darin.
// platz (nur beim Bearbeiten): Position, Variante und Stelle des Fotos, dazu «Bild ändern» und, wenn noch Platz ist,
// «+ Bild». Die freie Seite zeigt ihr Bild ganz (ein Plan wird nicht beschnitten).
function bildStil(a){
  const x=ausschnittVon(a);if(!x)return '';
  return ' style="object-position:'+x.x+'% '+x.y+'%'+(x.z>1?';transform:scale('+x.z+');transform-origin:'+x.x+'% '+x.y+'%':'')+'"';
}
function foto(f,bild,alt,klasse,bucket=BUCKET_PRODUKTE,platz=null){
  const b=f?.quelle==='mappe'?BUCKET:bucket;
  const url=f?.pfad?bild(f.pfad,b):'';
  const knopf=(i,t)=>'<button type="button" class="mm-bild-knopf" data-act="mm-bild" data-z="'+esc(platz.z)+'" data-o="'+esc(platz.o)+'" data-i="'+i+'">'+t+'</button>';
  const knoepfe=platz?'<span class="mm-bild-knoepfe">'+knopf(platz.i,url?'Bild ändern':'Bild wählen')+
    (url&&Number.isInteger(platz.plus)?knopf(platz.plus,'+ Bild'):'')+'</span>':'';
  const ort=platz?' data-bildplatz="'+esc(platz.z+'|'+platz.o+'|'+platz.i)+'"':'';
  if(!url)return '<div class="mm-foto mm-foto-leer '+klasse+'" role="img" aria-label="'+esc(alt+': kein Foto')+'"'+ort+'><span>kein Foto</span>'+knoepfe+'</div>';
  if(bucket===BUCKET)return '<img class="mm-foto '+klasse+'" src="'+esc(url)+'" data-pfad="'+esc(f.pfad)+'" alt="'+esc(alt)+'">';
  return '<span class="mm-foto mm-rahmen '+klasse+'"'+ort+'><img class="mm-foto-bild" src="'+esc(url)+'" data-pfad="'+esc(f.pfad)+'" alt="'+esc(alt)+'"'+
    bildStil(f.ausschnitt)+'>'+knoepfe+'</span>';
}
// Texte der Variante aus der Bibliothek: im Druck wie bisher, beim Bearbeiten als Feld; geändert = durchgezogen umrandet.
function anpassFeld(modus,p,o,feld,{wert,druck,klasse='',platz='',zeilen=1}){
  if(modus!=='bearbeiten')return druck;
  const g=!!o.geaendert?.[feld];
  return '<textarea id="'+esc('mm-'+p.id+'-'+o.id+'-'+feld)+'" class="mm-text '+klasse+(g?' mm-geaendert':'')+'" data-mmanp="'+esc(p.id+'|'+o.id+'|'+feld)+
    '" rows="'+zeilen+'" placeholder="'+esc(platz)+'" aria-label="'+esc(platz)+'"'+(g?' title="In dieser Mappe geändert"':'')+'>'+esc(wert)+'</textarea>';
}
function herkunftText(o){return typeof o.herkunft==='string'?o.herkunft:[o.hersteller,o.serie].filter(Boolean).join(' · ')}
function herkunftZeile(modus,p,o){
  const t=herkunftText(o);
  return anpassFeld(modus,p,o,'herkunft',{wert:t,druck:t?'<p class="mm-klein">'+esc(t)+'</p>':'',klasse:'mm-text-klein',platz:'Hersteller · Serie'});
}
function kennwerteFeld(modus,p,o,n){
  if(modus!=='bearbeiten')return kennwerte(o,n);
  const t=merkmaleText(o.merkmale),zeilen=t?t.split('\n').length:0;
  return anpassFeld(modus,p,o,'kennwerte',{wert:t,druck:'',klasse:'mm-text-kennwerte',platz:'Kennwerte, je Zeile «Feld: Wert»',zeilen:Math.max(2,Math.min(zeilen,MAX_MERKMALE))})+
    (zeilen>n?'<p class="mm-feldhinweis">Auf dieser Seite stehen die ersten '+n+' Zeilen.</p>':'');
}
function fuss(inh,nr,gesamt){
  const projekt=[inh.projekt.nummer,inh.projekt.name].filter(Boolean).join(' ');
  return '<footer class="mm-fuss"><span>'+esc([inh.titel,projekt,'Vorlage zur Bemusterung'+(datum(inh.termin)?' am '+datum(inh.termin):'')].filter(Boolean).join(' · '))+
    '</span><span>Seite '+nr+' von '+gesamt+'</span></footer>';
}
function kopfPosition(p,zusatz=''){
  const rechts=[p.zonen,p.flaeche].filter(x=>s(x).trim()).map(esc).join('<br>');
  return '<header class="mm-kopf"><div class="mm-kopf-titel"><span class="mm-code">'+esc(p.code||p.nr)+'</span><span class="mm-bez">'+esc(p.bezeichnung)+
    '</span>'+(zusatz?'<span class="mm-zusatz">'+esc(zusatz)+'</span>':'')+'</div>'+(rechts?'<p class="mm-kopf-zonen">'+rechts+'</p>':'')+'</header>';
}
function kennwerte(o,n){
  const m=(o.merkmale||[]).slice(0,n);
  if(!m.length)return '';
  return '<table class="mm-kennwerte"><tbody>'+m.map(x=>'<tr><th scope="row">'+esc(x.feld)+'</th><td>'+esc(x.wert)+'</td></tr>').join('')+'</tbody></table>';
}
function kostenKasten(p,o){
  if(o&&s(o.kennwert).trim())return '<div class="mm-kosten"><span class="mm-klein">Kennwert netto</span><strong>'+esc(o.kennwert)+'</strong>'+(o.beleg?'<span class="mm-klein">'+esc(o.beleg)+'</span>':'')+'</div>';
  if(s(p.kosten).trim())return '<div class="mm-kosten"><span class="mm-klein">Kostenrahmen netto</span><strong>'+esc(p.kosten)+'</strong>'+(s(p.kostenBeleg).trim()?'<span class="mm-klein">'+esc(p.kostenBeleg)+'</span>':'')+'</div>';
  return '';
}
function entschiedenZeile(p){
  if(p.status!=='entschieden')return '';
  return '<p class="mm-entschieden">Entschieden am '+esc(datum(p.entschiedenAm))+(p.entscheider?' von '+esc(p.entscheider):'')+': '+esc(gewaehlt(p))+'</p>';
}
function zuBeachten(p){
  const t=[s(p.anforderungen).trim()&&'Anforderungen: '+s(p.anforderungen).trim(),s(p.hinweise).trim()&&'Zu beachten: '+s(p.hinweise).trim()].filter(Boolean);
  return t.length?'<div class="mm-beachten">'+t.map(x=>'<p>'+esc(x)+'</p>').join('')+'</div>':'';
}
function seiteDeckblatt(inh,modus){
  const projekt=[inh.projekt.nummer,inh.projekt.name].filter(Boolean).join(' · ');
  const titel=inh.themenpaket||inh.titel.replace(/^Mustermappe\s*/,'')||inh.titel;
  const stand=inh.status==='vorgelegt'&&inh.vorgelegtAm?'vorgelegt am '+datum(inh.vorgelegtAm):'Stand '+(datum(inh.stand)||'')+' · Entwurf';
  return '<div class="mm-deck"><div class="mm-deck-oben"><p class="mm-deck-kicker">Mustermappe</p><h2 class="mm-deck-titel">'+esc(titel)+'</h2>'+
    (projekt?'<p class="mm-deck-projekt">'+esc(projekt)+'</p>':'')+'</div><div class="mm-deck-unten">'+
    '<p class="mm-deck-termin">Vorlage zur Bemusterung'+(datum(inh.termin)?' am '+esc(datum(inh.termin)):'')+'</p>'+
    feld(modus,'data-mmvorlage="deckblatt_text"',inh.deckblatt,{zeilen:3,platz:'Text für das Deckblatt (optional)',klasse:'mm-deck-text',id:'mm-deckblatt'})+
    '<p class="mm-klein">'+esc(stand)+(inh.verfasser?' · '+esc(inh.verfasser):'')+'</p></div></div>';
}
function seiteUebersicht(inh){
  const gruppen=uebersichtGruppen(inh);
  if(!inh.punkte.length)return '<h2 class="mm-titel">Übersicht</h2><p class="mm-p mm-leer">Noch keine Position.</p>';
  return '<h2 class="mm-titel">Übersicht</h2><table class="mm-tabelle"><thead><tr><th>Code</th><th>Position</th><th>Zonen und Fläche</th><th>Kandidaten</th><th>Empfehlung</th><th>Stand</th></tr></thead><tbody>'+
    gruppen.map(g=>(g.titel?'<tr class="mm-gruppe"><th colspan="6">'+esc(g.titel)+'</th></tr>':'')+g.punkte.map(p=>'<tr><td class="mm-code-klein">'+esc(p.code||p.nr)+'</td><td>'+esc(p.bezeichnung)+'</td><td>'+
      esc([p.zonen,p.flaeche].filter(x=>s(x).trim()).join(' · '))+'</td><td>'+esc(p.optionen.map(o=>o.id+' · '+o.name).join('; ')||'noch offen')+'</td><td>'+
      esc(p.empfehlung?'Variante '+p.empfehlung:'–')+'</td><td>'+esc(p.status==='entschieden'?'entschieden: '+gewaehlt(p):'offen')+'</td></tr>').join('')).join('')+'</tbody></table>';
}
function seiteVergleich(seite,inh,p,{modus,bild}){
  const kand=kandidatenDerSeite(seite,p);
  // Foto und Text je Kandidat in zwei Zeilen eines Rasters: die Fotos stehen gleich hoch, auch bei ungleich langen Texten.
  const ed=modus==='bearbeiten';
  const name=o=>ed?'<h3 class="mm-kand-name"><span>'+esc(o.id+' · ')+'</span>'+anpassFeld(modus,p,o,'name',{wert:o.name,klasse:'mm-text-name',platz:'Name der Variante'})+'</h3>'
    :'<h3>'+esc(o.id+' · '+o.name)+'</h3>';
  const spalten=kand.length?kand.map(o=>'<div class="mm-kand">'+foto(o.fotos[0],bild,o.name,'mm-foto-kand',BUCKET_PRODUKTE,ed?{z:p.id,o:o.id,i:0}:null)+
    '<div class="mm-kand-text"><div class="mm-kand-kopf">'+name(o)+(p.empfehlung===o.id&&zeigt(seite,'empfehlung')?'<span class="mm-empf">Empfehlung</span>':'')+'</div>'+
    herkunftZeile(modus,p,o)+
    (zeigt(seite,'kennwerte')?kennwerteFeld(modus,p,o,5):'')+(zeigt(seite,'kosten')?kostenKasten({},o):'')+'</div></div>').join('')
    :modus==='bearbeiten'?'<p class="mm-p mm-leer">Noch kein Kandidat. Rechts einen aus der Bibliothek wählen.</p>':'';
  const empf=zeigt(seite,'empfehlung')?(modus==='bearbeiten'
    ?'<div class="mm-empfehlung"><strong>'+esc(p.empfehlung?'Empfehlung: Variante '+p.empfehlung+'.':'Empfehlung offen.')+'</strong>'+feld(modus,'data-mmtext="begruendung" data-z="'+esc(p.id)+'"',p.begruendung,{zeilen:2,platz:'Begründung der Empfehlung',id:'mm-'+p.id+'-begruendung'})+'</div>'
    :(p.empfehlung||s(p.begruendung).trim()?'<div class="mm-empfehlung"><strong>'+esc(p.empfehlung?'Empfehlung: Variante '+p.empfehlung+'.':'')+'</strong> '+esc(p.begruendung)+'</div>':'')):'';
  const kostenPos=zeigt(seite,'kosten')&&!kand.some(o=>s(o.kennwert).trim())?kostenKasten(p,null):'';
  return kopfPosition(p)+feld(modus,'data-mmtext="frage" data-z="'+esc(p.id)+'"',p.frage,{zeilen:1,platz:'Frage an den Bauherrn, z. B. Welcher Belag für diese Zonen?',klasse:'mm-frage',id:'mm-'+p.id+'-frage'})+
    // Eine Position ohne Produkt (etwa eine Leistung wie geschliffener Estrich) zeigt im PDF nur Kopf, Frage, Kosten und Hinweise.
    (spalten?'<div class="mm-kandidaten mm-n'+Math.max(1,kand.length)+'">'+spalten+'</div>':'<div class="mm-kandidaten mm-n1"></div>')+
    '<div class="mm-unten">'+empf+'<div class="mm-unten-rechts">'+kostenPos+zuBeachten(p)+'</div></div>'+entschiedenZeile(p);
}
function seiteMaterial(seite,inh,p,{modus,bild}){
  const o=p.optionen.find(x=>x.id===seite.option)||p.optionen[0];
  if(!o)return kopfPosition(p)+'<p class="mm-p mm-leer">Diese Variante gibt es nicht mehr.</p>';
  const klein=o.fotos.slice(1,3),ed=modus==='bearbeiten';
  // Beim Bearbeiten: «+ Bild» auf dem großen Foto, solange die Variante weniger als drei hat; das Raster bleibt gleich.
  const platz=i=>ed?{z:p.id,o:o.id,i,...(i===0&&o.fotos.length<MAX_FOTOS?{plus:o.fotos.length}:{})}:null;
  const g=!!o.geaendert?.beschreibung;
  return '<div class="mm-material"><div class="mm-material-bilder">'+foto(o.fotos[0],bild,o.name,'mm-foto-gross',BUCKET_PRODUKTE,platz(0))+
    (klein.length?'<div class="mm-foto-reihe">'+klein.map((f,j)=>foto(f,bild,o.name,'mm-foto-klein',BUCKET_PRODUKTE,platz(j+1))).join('')+'</div>':'')+'</div>'+
    '<div class="mm-material-text">'+kopfPosition(p,'Variante '+o.id)+
    (ed?'<h3 class="mm-material-name">'+anpassFeld(modus,p,o,'name',{wert:o.name,klasse:'mm-text-name',platz:'Name der Variante'})+'</h3>'
      :'<h3 class="mm-material-name">'+esc(o.name)+'</h3>')+
    herkunftZeile(modus,p,o)+
    feld(modus,'data-mmopt="'+esc(p.id+'|'+o.id)+'"',o.beschreibung,{zeilen:3,platz:'Beschreibung für den Bauherrn',klasse:g?'mm-geaendert':'',id:'mm-'+p.id+'-'+o.id+'-text'})+
    (zeigt(seite,'kennwerte')?kennwerteFeld(modus,p,o,10):'')+(zeigt(seite,'kosten')?kostenKasten(p,o):'')+zuBeachten(p)+
    (p.empfehlung===o.id&&zeigt(seite,'empfehlung')?'<p class="mm-empf mm-empf-zeile">Empfehlung des Büros</p>':'')+entschiedenZeile(p)+'</div></div>';
}
function seiteFrei(seite,{modus,bild}){
  const b=seite.bild&&s(seite.bild.pfad)?seite.bild:null;
  return feld(modus,'data-mmseite="'+esc(seite.id)+'|titel"',seite.titel,{zeilen:1,platz:'Titel der Seite, z. B. Bodenbelagsplan EG',klasse:'mm-titel-feld',titel:true,id:'mm-'+seite.id+'-titel'})+
    '<div class="mm-frei-bild">'+(b?foto(b,bild,s(seite.titel)||s(b.name)||'Bild','mm-foto-frei',BUCKET)
      :'<div class="mm-foto mm-foto-leer mm-foto-frei"><span>'+(modus==='bearbeiten'?'Rechts ein Bild oder ein PDF hochladen.':'')+'</span></div>')+'</div>'+
    feld(modus,'data-mmseite="'+esc(seite.id)+'|text"',seite.text,{zeilen:2,platz:'Text zur Seite (optional)',id:'mm-'+seite.id+'-text'});
}
function seiteHtml(seite,inh,{nr=1,gesamt=1,modus='druck',bild=()=>''}={}){
  if(!seite)return '';
  let innen='';
  const p=['vergleich','material'].includes(seite.typ)?inh.punkte.find(x=>x.id===seite.punkt):null;
  if(seite.typ==='deckblatt')innen=seiteDeckblatt(inh,modus);
  else if(seite.typ==='uebersicht')innen=seiteUebersicht(inh);
  else if(seite.typ==='vergleich')innen=p?seiteVergleich(seite,inh,p,{modus,bild}):'';
  else if(seite.typ==='material')innen=p?seiteMaterial(seite,inh,p,{modus,bild}):'';
  else if(seite.typ==='frei')innen=seiteFrei(seite,{modus,bild});
  return '<div class="mm-blatt" data-seite="'+esc(seite.id)+'"><article class="mm-seite mm-typ-'+esc(seite.typ)+'" aria-label="'+esc('Seite '+nr+' von '+gesamt)+'"><div class="mm-innen">'+innen+'</div>'+
    (seite.typ==='deckblatt'?'':fuss(inh,nr,gesamt))+'</article></div>';
}
function mappeHtml(inh,{modus='druck',bild=()=>''}={}){
  const l=inh.seiten||[];
  return l.map((x,i)=>seiteHtml(x,inh,{nr:i+1,gesamt:l.length,modus,bild})).join('');
}

return Object.freeze({FORM,SCHEMA,BUCKET,BUCKET_PRODUKTE,THEMEN,KATEGORIEN,SEITEN,STRATEGIEN,MUSTER_FELDER,MAX_KANDIDATEN,MAX_FOTOS,BILDTYPEN,BILD_MAX,ZOOM_MAX,
  esc,datum,neueId,naechsteOptionId,istMappe,neueMappe,thema,neuePosition,produktAuszug,veraltet,kandidat,fotosUmschalten,dateiPfad,bildPruefen,
  ausschnittVon,fotoSauber,fotoListe,fotoSetzen,fotoEntfernen,fotoNachVorn,fotoAusschnitt,
  ANPASSUNG_NAME,merkmaleText,merkmaleAusText,anpassen,zuruecksetzen,geaendert,geaenderteTexte,anpassbarAuf,
  seitenVon,seiteVerschieben,seiteName,belegVon,mappeInhalt,mitStandardFotos,allePfade,kandidatenDerSeite,uebersichtGruppen,gewaehlt,seiteHtml,mappeHtml});
});
