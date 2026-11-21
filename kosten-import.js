/* TBA Office · Kostenberechnung · Import der Archicad-Mengen (21.11.2026, Claude).
   Liest die Interaktive Auswertung «TBA Kosten · Mengen» als Excel (.xlsx) oder CSV, erkennt die Spalten
   (KG nach DIN 276, Bauteiltyp, Aufbau, Anzahl, Fläche, Länge, Volumen), fasst je KG und Bauteiltyp
   zusammen, vergleicht mit dem letzten Import und schreibt die Mengen in die Positionen.
   Kennwerte bleiben unberührt; was nicht mehr im Modell ist, wird markiert, nicht gelöscht.
   Ohne Bibliothek: .xlsx ist ein ZIP mit XML; entpackt wird mit DecompressionStream des Browsers. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TBA_KOSTEN_IMPORT=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(root){
'use strict';
const R=(typeof module==='object'&&module.exports&&typeof require==='function')?require('./kosten-rechnen.js'):root.TBA_KOSTEN_RECHNEN;

// ---------- ZIP (nur Lesen) ----------
async function entpacke(bytes,methode){
  if(methode===0)return bytes;
  if(methode!==8)throw new Error('Unbekannte Kompression in der Excel-Datei');
  let ds;
  try{ds=new DecompressionStream('deflate-raw')}
  catch{throw new Error('Dieser Browser kann die Excel-Datei nicht öffnen. Bitte die Auswertung als CSV speichern und diese wählen.')}
  const strom=new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(strom).arrayBuffer());
}
async function zipDateien(buffer){
  const b=new Uint8Array(buffer),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
  let ende=-1;
  for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(v.getUint32(i,true)===0x06054b50){ende=i;break}}
  if(ende<0)throw new Error('Keine Excel-Datei (.xlsx)');
  const anzahl=v.getUint16(ende+10,true);let pos=v.getUint32(ende+16,true);
  const dateien=new Map();const dec=new TextDecoder();
  for(let n=0;n<anzahl;n++){
    if(v.getUint32(pos,true)!==0x02014b50)throw new Error('Beschädigte Excel-Datei');
    const methode=v.getUint16(pos+10,true),groesse=v.getUint32(pos+20,true);
    const nameLen=v.getUint16(pos+28,true),extraLen=v.getUint16(pos+30,true),kommLen=v.getUint16(pos+32,true);
    const lokal=v.getUint32(pos+42,true);
    const name=dec.decode(b.subarray(pos+46,pos+46+nameLen));
    dateien.set(name,{methode,groesse,lokal});
    pos+=46+nameLen+extraLen+kommLen;
  }
  return {
    namen:[...dateien.keys()],
    async text(name){
      const d=dateien.get(name);if(!d)return null;
      const l=d.lokal;
      if(v.getUint32(l,true)!==0x04034b50)throw new Error('Beschädigte Excel-Datei');
      const start=l+30+v.getUint16(l+26,true)+v.getUint16(l+28,true);
      return dec.decode(await entpacke(b.subarray(start,start+d.groesse),d.methode));
    }
  };
}

// ---------- XML der Tabellenblätter ----------
const ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
const xmlText=s=>String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(m,e)=>
  e[0]==='#'?String.fromCodePoint(e[1]==='x'||e[1]==='X'?parseInt(e.slice(2),16):parseInt(e.slice(1),10)):ENT[e.toLowerCase()]);
function geteilteTexte(xml){
  if(!xml)return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t=>xmlText(t[1])).join(''));
}
function spalteIndex(ref){let n=0;for(const c of String(ref).replace(/\d+$/,''))n=n*26+(c.charCodeAt(0)-64);return n-1}
// Jede Zeile trägt ihre Nummer im Blatt (nr), damit eine Fundstelle «Zeile 12» im Excel wiederzufinden ist.
// Leere Zeilen stehen oft als <row …/> im Blatt (nur Höhe oder Format); sie zählen mit, haben aber keine Zellen.
function zeilenAusBlatt(xml,texte){
  const zeilen=[];
  for(const z of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)){
    if(z[2]===undefined)continue;
    const nr=Number(/\br="(\d+)"/.exec(z[1])?.[1])||zeilen.length+1;
    const zeile=[];
    for(const c of z[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      const attr=c[1],inhalt=c[2]||'';
      const ref=/\br="([A-Z]+\d+)"/.exec(attr)?.[1];const typ=/\bt="(\w+)"/.exec(attr)?.[1]||'n';
      let wert='';
      const vv=/<v>([\s\S]*?)<\/v>/.exec(inhalt);
      if(typ==='s')wert=texte[Number(vv?.[1])]??'';
      else if(typ==='inlineStr')wert=[...inhalt.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t=>xmlText(t[1])).join('');
      else wert=vv?xmlText(vv[1]):'';
      const i=ref?spalteIndex(ref):zeile.length;
      zeile[i]=String(wert);
    }
    const fertig=Array.from(zeile,x=>x??'');fertig.nr=nr;
    zeilen.push(fertig);
  }
  return zeilen;
}
async function leseXlsx(buffer){
  const zip=await zipDateien(buffer);
  const texte=geteilteTexte(await zip.text('xl/sharedStrings.xml'));
  let blatt='xl/worksheets/sheet1.xml';
  const wb=await zip.text('xl/workbook.xml'),rels=await zip.text('xl/_rels/workbook.xml.rels');
  const rid=wb&&/<sheet\b[^>]*\br:id="([^"]+)"/.exec(wb)?.[1];
  if(rid&&rels){
    const rel=[...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].map(m=>m[1]).find(a=>a.includes('Id="'+rid+'"'));
    const ziel=rel&&/Target="([^"]+)"/.exec(rel)?.[1];
    if(ziel)blatt=ziel.startsWith('/')?ziel.slice(1):'xl/'+ziel.replace(/^\.\//,'');
  }
  const xml=await zip.text(blatt);
  if(!xml)throw new Error('Das erste Tabellenblatt fehlt');
  return zeilenAusBlatt(xml,texte);
}
// Alle sichtbaren Blätter einer Mappe mit Namen (für den Assistenten: das alte Büro-Excel hat oft mehrere).
async function leseXlsxBlaetter(buffer,{max=12}={}){
  const zip=await zipDateien(buffer);
  const texte=geteilteTexte(await zip.text('xl/sharedStrings.xml'));
  const wb=await zip.text('xl/workbook.xml')||'',rels=await zip.text('xl/_rels/workbook.xml.rels')||'';
  const ziele=new Map([...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].map(m=>[/\bId="([^"]+)"/.exec(m[1])?.[1],/\bTarget="([^"]+)"/.exec(m[1])?.[1]]));
  const blaetter=[];
  for(const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)){
    if(blaetter.length>=max)break;
    if(/\bstate="(hidden|veryHidden)"/.test(m[1]))continue;
    const ziel=ziele.get(/\br:id="([^"]+)"/.exec(m[1])?.[1]);if(!ziel)continue;
    const xml=await zip.text(ziel.startsWith('/')?ziel.slice(1):'xl/'+ziel.replace(/^\.\//,''));if(!xml)continue;
    blaetter.push({name:xmlText(/\bname="([^"]*)"/.exec(m[1])?.[1]||''),zeilen:zeilenAusBlatt(xml,texte)});
  }
  if(!blaetter.length)blaetter.push({name:'',zeilen:await leseXlsx(buffer)});
  return blaetter;
}
function leseCsv(text){
  const t=String(text).replace(/^﻿/,'');
  const erste=t.split(/\r?\n/,1)[0]||'';
  const trenner=[';','\t',','].map(z=>[z,erste.split(z).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const zeilen=[];let zeile=[],feld='',zitat=false;
  const fertig=()=>{zeile.nr=zeilen.length+1;zeilen.push(zeile);zeile=[]};
  for(let i=0;i<t.length;i++){
    const c=t[i];
    if(zitat){if(c==='"'){if(t[i+1]==='"'){feld+='"';i++}else zitat=false}else feld+=c;continue}
    if(c==='"')zitat=true;
    else if(c===trenner){zeile.push(feld);feld=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;zeile.push(feld);fertig();feld=''}
    else feld+=c;
  }
  if(feld!==''||zeile.length){zeile.push(feld);fertig()}
  return zeilen.filter(z=>z.some(x=>String(x).trim()!==''));
}
async function leseDatei(datei){
  const name=String(datei?.name||'').toLowerCase();
  if(name.endsWith('.xlsx'))return leseXlsx(await datei.arrayBuffer());
  if(/\.(csv|txt|tsv)$/.test(name))return leseCsv(await datei.text());
  throw new Error('Bitte die Auswertung als Excel (.xlsx) oder CSV speichern');
}

// ---------- Spalten erkennen ----------
const KG_IN_TEXT=/(?:^|[^\d])([1-8]\d\d)(?![\d.,])/;
const MUSTER={
  kg:/din\s*276|kostengruppe|^\s*kg\b|klassifizierung/i,
  bauteiltyp:/bauteiltyp/i,
  aufbau:/aufbau|baustoff|profil|mehrschicht/i,
  elementtyp:/elementtyp|element-typ|^\s*typ\s*$|werkzeug/i,
  geschoss:/geschoss/i,
  anzahl:/anzahl|stück|stk/i,
  flaeche:/fläche|flaeche|area/i,
  laenge:/länge|laenge|length/i,
  volumen:/volumen|rauminhalt|volume/i
};
function erkenneSpalten(zeilen){
  for(let k=0;k<Math.min(zeilen.length,15);k++){
    const kopf=zeilen[k].map(x=>String(x||'').trim());
    if(!kopf.some(x=>MUSTER.kg.test(x)))continue;
    const s={kopfzeile:k,kg:-1,bauteiltyp:-1,aufbau:-1,elementtyp:-1,geschoss:-1,anzahl:-1,laenge:-1,volumen:-1,flaeche:[]};
    const daten=zeilen.slice(k+1,k+40);
    const kgKandidaten=kopf.map((x,i)=>MUSTER.kg.test(x)?i:-1).filter(i=>i>=0);
    s.kg=kgKandidaten.sort((a,b)=>treffer(daten,b)-treffer(daten,a))[0];
    kopf.forEach((x,i)=>{
      if(i===s.kg)return;
      if(MUSTER.bauteiltyp.test(x)&&s.bauteiltyp<0)s.bauteiltyp=i;
      else if(MUSTER.flaeche.test(x))s.flaeche.push(i);
      else if(MUSTER.laenge.test(x)&&s.laenge<0)s.laenge=i;
      else if(MUSTER.volumen.test(x)&&s.volumen<0)s.volumen=i;
      else if(MUSTER.anzahl.test(x)&&s.anzahl<0)s.anzahl=i;
      else if(MUSTER.geschoss.test(x)&&s.geschoss<0)s.geschoss=i;
      else if(MUSTER.elementtyp.test(x)&&s.elementtyp<0)s.elementtyp=i;
      else if(MUSTER.aufbau.test(x)&&s.aufbau<0)s.aufbau=i;
    });
    s.kopf=kopf;
    return s;
  }
  return null;
}
function treffer(daten,i){return daten.filter(z=>KG_IN_TEXT.test(String(z[i]||''))).length}

// ---------- Zusammenfassen ----------
const MASSE=['flaeche','laenge','volumen','anzahl'];
const EINHEIT_ZU_MASS={'m²':'flaeche','m':'laenge','m³':'volumen','St':'anzahl'};
const MASS_ZU_EINHEIT={flaeche:'m²',laenge:'m',volumen:'m³',anzahl:'St'};
function zahlAus(zelle,deutsch){const d=deutsch?R.eingabe(zelle):R.dezimal(zelle);return d===null||d===undefined?null:R.mikro(d)}
// Schreibweise der Datei: Excel speichert Zahlen mit Punkt; eine CSV aus deutschem Archicad schreibt «238,75».
// Steht in den Mengenspalten irgendwo ein Dezimalkomma, ist ein Punkt dort ein Tausenderpunkt.
function deutscheZahlen(zeilen,spalten){
  const idx=[...spalten.flaeche,spalten.laenge,spalten.volumen,spalten.anzahl].filter(i=>i>=0);
  return zeilen.slice(spalten.kopfzeile+1).some(z=>idx.some(i=>/^\s*-?[\d.\s\u00a0]*\d,\d+\s*$/.test(String(z[i]||''))));
}
function gruppiere(zeilen,spalten){
  if(!spalten)throw new Error('In der Datei steht keine Spalte mit der Kostengruppe (DIN 276)');
  const gruppen=new Map();let ohneKg=0,gelesen=0;
  const deutsch=deutscheZahlen(zeilen,spalten);
  for(const z of zeilen.slice(spalten.kopfzeile+1)){
    if(!z.some(x=>String(x).trim()))continue;
    const kg=KG_IN_TEXT.exec(String(z[spalten.kg]||''))?.[1];
    if(!kg){ohneKg++;continue}
    gelesen++;
    const typ=spalten.bauteiltyp>=0?String(z[spalten.bauteiltyp]||'').trim():'';
    const schluessel=kg+'|'+typ;
    if(!gruppen.has(schluessel))gruppen.set(schluessel,{schluessel,kg,bauteiltyp:typ,aufbau:'',elemente:0,summen:{flaeche:null,laenge:null,volumen:null,anzahl:null}});
    const g=gruppen.get(schluessel);g.elemente++;
    if(!g.aufbau&&spalten.aufbau>=0)g.aufbau=String(z[spalten.aufbau]||'').trim();
    const add=(mass,wert)=>{if(wert!==null)g.summen[mass]=(g.summen[mass]||0n)+wert};
    const flaeche=spalten.flaeche.map(i=>zahlAus(z[i],deutsch)).find(x=>x!==null&&x!==0n)??null;
    add('flaeche',flaeche);
    if(spalten.laenge>=0)add('laenge',zahlAus(z[spalten.laenge],deutsch));
    if(spalten.volumen>=0)add('volumen',zahlAus(z[spalten.volumen],deutsch));
    if(spalten.anzahl>=0){const a=zahlAus(z[spalten.anzahl],deutsch);add('anzahl',a===null?1000000n:a)}
    else add('anzahl',1000000n);
  }
  const liste=[...gruppen.values()].map(g=>({schluessel:g.schluessel,kg:g.kg,bauteiltyp:g.bauteiltyp,aufbau:g.aufbau,elemente:g.elemente,
    mengen:Object.fromEntries(MASSE.map(m=>[m,g.summen[m]===null?null:R.textAusMikro(g.summen[m],3)]))}))
    .sort((a,b)=>a.kg.localeCompare(b.kg)||a.bauteiltyp.localeCompare(b.bauteiltyp,'de'));
  return {gruppen:liste,gelesen,ohneKg,zahlformat:deutsch?'deutsch':'punkt'};
}
function hauptmass(gruppe,einheit){
  const gewuenscht=EINHEIT_ZU_MASS[einheit];
  if(gewuenscht)return gewuenscht;
  for(const m of MASSE)if(gruppe.mengen[m]!==null&&gruppe.mengen[m]!=='0')return m;
  return 'anzahl';
}
function vergleiche(alt,neu){
  const a=new Map((alt||[]).map(g=>[g.schluessel,g])),n=new Map((neu||[]).map(g=>[g.schluessel,g]));
  const aus=[];
  for(const [k,g] of n){
    const m=hauptmass(g);const vorher=a.get(k);
    if(!vorher){aus.push({schluessel:k,kg:g.kg,bauteiltyp:g.bauteiltyp,art:'neu',einheit:MASS_ZU_EINHEIT[m],neu:g.mengen[m],delta:g.mengen[m]});continue}
    const x=R.mikro(vorher.mengen[m]||'0'),y=R.mikro(g.mengen[m]||'0');
    aus.push({schluessel:k,kg:g.kg,bauteiltyp:g.bauteiltyp,art:x===y?'gleich':'geaendert',einheit:MASS_ZU_EINHEIT[m],
      alt:vorher.mengen[m],neu:g.mengen[m],delta:R.textAusMikro(y-x,3)});
  }
  for(const [k,g] of a)if(!n.has(k)){const m=hauptmass(g);aus.push({schluessel:k,kg:g.kg,bauteiltyp:g.bauteiltyp,art:'entfernt',einheit:MASS_ZU_EINHEIT[m],alt:g.mengen[m]})}
  return aus.sort((p,q)=>p.kg.localeCompare(q.kg)||String(p.bauteiltyp).localeCompare(String(q.bauteiltyp),'de'));
}

// ---------- In die Kostenberechnung übernehmen ----------
function klon(x){return typeof structuredClone==='function'?structuredClone(x):JSON.parse(JSON.stringify(x))}
function anwenden(state,gruppen,meta={}){
  const st=klon(state);st.positionen=st.positionen||[];
  const datum=meta.datum||new Date().toISOString().slice(0,10);
  const beruehrt=new Set();let neu=0,aktualisiert=0;
  for(const g of gruppen){
    const rezept=g.bauteiltyp?st.rezepte?.[g.bauteiltyp]:null;
    const zeilen=rezept?.zeilen?.length?rezept.zeilen:[{kg:g.kg,faktor:'1'}];
    const einheit=rezept?.einheit||MASS_ZU_EINHEIT[hauptmass(g)];
    const mass=hauptmass(g,einheit);
    const basis=g.mengen[mass];
    zeilen.forEach((zeile,i)=>{
      const id='ac:'+(g.bauteiltyp||'ohne-'+g.kg)+':'+zeile.kg+(zeilen.filter(z=>z.kg===zeile.kg).length>1?':'+i:'');
      const faktor=R.dezimal(zeile.faktor)||'1';
      const menge=basis===null?null:R.textAusMikro(R.teile(R.mikro(basis)*R.mikro(faktor),1000000n),3);
      const quelle={art:'archicad',text:(g.bauteiltyp||'ohne Bauteiltyp')+' · '+g.elemente+' Elemente · Import '+datum+(meta.datei?' · '+meta.datei:'')};
      beruehrt.add(id);
      const vorhanden=st.positionen.find(p=>p.id===id);
      if(vorhanden){
        Object.assign(vorhanden,{kg:zeile.kg,menge,einheit,mengenquelle:quelle,bauteiltyp:g.bauteiltyp,aufbau:g.aufbau||vorhanden.aufbau||'',ausImportEntfernt:false,import:true});
        aktualisiert++;
      }else{
        st.positionen.push({id,kg:zeile.kg,titel:zeile.titel||R.katalogTitel(st,zeile.kg),bauteiltyp:g.bauteiltyp,aufbau:g.aufbau||'',
          modus:'menge',menge,einheit,mengenquelle:quelle,kennwert:{},import:true});
        neu++;
      }
    });
  }
  let entfernt=0;
  for(const p of st.positionen)if(p.import&&!beruehrt.has(p.id)&&!p.ausImportEntfernt){p.ausImportEntfernt=true;entfernt++}
  st.importe=[{datum,datei:meta.datei||'',zeilen:meta.zeilen||0,gruppen},...(st.importe||[])].slice(0,5);
  return {state:st,bericht:{neu,aktualisiert,entfernt}};
}

return Object.freeze({zipDateien,leseXlsx,leseXlsxBlaetter,leseCsv,leseDatei,zeilenAusBlatt,geteilteTexte,erkenneSpalten,gruppiere,vergleiche,anwenden,hauptmass,EINHEIT_ZU_MASS,MASS_ZU_EINHEIT});
});
