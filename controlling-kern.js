/* TBA Office · Controlling · Kern (25.11.2026, Claude; Wunsch von Gari am 25.11.2026).
   Rechnet aus einem Honorarpaket, den Summen seiner Stände (vom Server: Stunden und ihr Wert zum Kalkulationssatz,
   für Admins auch zum Gehalt) und seinen Zahlungen die Kennzahlen: Stundenbudget, Leistungsstand, erarbeitetes
   Honorar, bezahlt, offen, Wert der Stunden, Ergebnis bisher, Prognose und Honorar je Stunde.
   Begriffe wie in der Projektübersicht von untermStrich: erarbeitetes Honorar = Honorar × Leistungsstand;
   Prognose = Stunden (oder ihr Wert) ÷ Leistungsstand. Das Ergebnis steht gegenüber der Kalkulation (85 €/h ist ein
   Kalkulationssatz, kein Gehalt); das Ergebnis zum Gehalt rechnet nur mit vollem Zugang.
   Seit 25.11.2026 (Gari, nachmittags): Wochenstunden je Person (Teilzeit hat ihren Anteil an den Jahresstunden), die
   Selbstkosten einer Stunde mit dem Gemeinkostenfaktor des Büros auf das Bruttogehalt allein, die Bewertung der Stunden
   je Person wie in office_controlling_summen (bewertung) und die Lage auf einen Blick (lage). Dazu die Jahresstunden aus
   dem Kalender (Werktage, Feiertage am Sitz des Büros in Augsburg, Urlaub, Krankheit, weitere Tage, Projektanteil) und,
   seit 25.11.2026 abends, Urlaub je Person (eigene Jahresstunden, wenn jemand mehr oder weniger Urlaub hat als das Büro).
   Die Übersicht ordnet nach Projektnummer (Gari).
   Ohne DOM: im Browser window.TBA_CONTROLLING, in Node module.exports (Tests). */
(function(root){
'use strict';
const zahl=x=>{const n=Number(x);return Number.isFinite(n)?n:0};
// Auf Cent wie auf der Rechnung (kaufmännisch; 1,005 → 1,01, was x*100 bei Gleitkommazahlen verfehlt).
const r2=x=>{const n=zahl(x),v=Number(Math.round(Number(n+'e2'))+'e-2');return Number.isFinite(v)?v:Math.round(n*100)/100};
const MWST_PROZENT=19;
const STATUS={angeboten:'angeboten',beauftragt:'beauftragt',abgeschlossen:'abgeschlossen'};

// Eingabe wie im Büro: «112.000», «21.008,40», «85», «85,5 €».
function leseZahl(text){
  let t=String(text??'').replace(/[€\s ]/g,'').replace(/h$/i,'');
  if(!t)return null;
  if(t.includes(','))t=t.replace(/\./g,'').replace(',','.');
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,'');
  if(!/^-?\d+(\.\d+)?$/.test(t))return null;
  return Number(t);
}
// Eine Zahlung brutto (alles inklusive) → netto und MwSt.
function ausBrutto(brutto,mwstProzent=MWST_PROZENT){
  const b=zahl(brutto),netto=r2(b/(1+zahl(mwstProzent)/100));
  return {netto,mwst:r2(b-netto)};
}
// Vom Netto einer Zahlung ist der Anteil des Honorars ohne die Nebenkosten (Prozent auf das Honorar).
function honorarAnteil(netto,nkProzent){return r2(zahl(netto)/(1+zahl(nkProzent)/100))}
// Eine Rechnung wie die des Büros (Gari und die Buchhaltung, 25.11.2026): Abschlag (Honorar netto) zzgl. Nebenkosten in
// Prozent = Netto; zzgl. MwSt = Brutto; jeder Schritt auf Cent gerundet. Ausgang ist, was eingetragen wurde: der Abschlag,
// das Netto oder das Brutto; der Rest folgt daraus. Vom Netto zurück zum Abschlag trifft ÷ (1 + Nebenkosten) den Cent,
// solange die Nebenkosten auf den Cent gerundet aus dem Abschlag stammen.
function rechnung(eingabe,nkProzent,mwstProzent=MWST_PROZENT){
  const nk=zahl(nkProzent)/100,m=zahl(mwstProzent)/100,{abschlag,netto,brutto}=eingabe||{};
  let a,n,mw;
  if(abschlag!=null){a=r2(abschlag);n=r2(a+r2(a*nk));mw=r2(n*m)}
  else if(netto!=null){n=r2(netto);a=honorarAnteil(n,nkProzent);mw=r2(n*m)}
  else if(brutto!=null){n=r2(zahl(brutto)/(1+m));a=honorarAnteil(n,nkProzent);mw=r2(zahl(brutto)-n)}
  else return null;
  return {abschlag:a,nebenkosten:r2(n-a),netto:n,mwst:mw,brutto:r2(n+mw)};
}

// bew: Ergebnis von bewertung() (nur mit vollem Zugang); dann kommen Personalkosten und Selbstkosten von dort, sonst die
// Personalkosten aus den Summen der Datenbank (wert_gehalt).
function kennzahlen(paket,staende=[],zahlungen=[],bew=null){
  const honorar=zahl(paket?.honorar_netto),satz=zahl(paket?.kalkulationssatz)||85,nk=zahl(paket?.nebenkosten_prozent);
  const liste=[...(staende||[])].sort((a,b)=>String(a.stichtag).localeCompare(String(b.stichtag)));
  const letzter=liste[liste.length-1]||null;
  const abgeschlossen=paket?.status==='abgeschlossen';
  const stunden=letzter?zahl(letzter.stunden):0,wert=letzter?zahl(letzter.wert_kalkulation):0;
  const geschaetzt=letzter&&letzter.leistungsstand!=null&&letzter.leistungsstand!==''?zahl(letzter.leistungsstand):null;
  const leistungsstand=abgeschlossen?100:geschaetzt;
  const budget=satz>0?honorar/satz:0;
  // Je Zahlung ihr Abschlag (wie in der Tabelle), dann die Summe: so stimmt die Kennzahl auf den Cent mit der Tabelle.
  const mitStatus=status=>(zahlungen||[]).filter(z=>z.status===status);
  const summe=(status,f)=>r2(mitStatus(status).reduce((s,z)=>s+f(z),0));
  const bezahltNetto=summe('bezahlt',z=>zahl(z.netto)),gestelltNetto=summe('gestellt',z=>zahl(z.netto));
  const bezahlt=summe('bezahlt',z=>honorarAnteil(z.netto,nk)),gestellt=summe('gestellt',z=>honorarAnteil(z.netto,nk));
  const erarbeitet=leistungsstand!=null?r2(honorar*leistungsstand/100):null;
  const prozent=leistungsstand!=null&&leistungsstand>0?leistungsstand:null;
  const b=bew&&bew.staende&&bew.staende.length?bew.staende[bew.staende.length-1]:null;
  const gehalt=bew?(b&&b.personalkosten!=null?b.personalkosten:null):letzter&&letzter.wert_gehalt!=null?zahl(letzter.wert_gehalt):null;
  const selbstkosten=b&&b.selbstkosten!=null?b.selbstkosten:null;
  return {
    honorar,nebenkosten:r2(honorar*nk/100),nebenkostenProzent:nk,satz,budget:r2(budget),
    stand:letzter?.stichtag||null,stunden:r2(stunden),wert:r2(wert),leistungsstand,geschaetzt,abgeschlossen,
    anteilStunden:budget>0?stunden/budget:null,
    bezahltNetto,gestelltNetto,bezahlt,gestellt,
    erarbeitet,
    // Erarbeitet, aber noch nicht bezahlt (gestellt oder noch nicht abgerechnet); negativ: im Voraus bezahlt.
    offen:erarbeitet!=null?r2(erarbeitet-bezahlt):null,
    nichtAbgerechnet:erarbeitet!=null?r2(erarbeitet-bezahlt-gestellt):null,
    ergebnisBisher:erarbeitet!=null?r2(erarbeitet-wert):null,
    jeStunde:stunden>0&&erarbeitet!=null?r2(erarbeitet/stunden):null,
    prognoseStunden:prozent?r2(stunden*100/prozent):null,
    prognoseWert:prozent?r2(wert*100/prozent):null,
    prognoseErgebnis:prozent?r2(honorar-wert*100/prozent):null,
    gehalt,
    ergebnisGehalt:gehalt!=null&&erarbeitet!=null?r2(erarbeitet-gehalt):null,
    prognoseGehalt:gehalt!=null&&prozent?r2(honorar-gehalt*100/prozent):null,
    prognosePersonalkosten:gehalt!=null&&prozent?r2(gehalt*100/prozent):null,
    // Selbstkosten: Gehalt mal Gemeinkostenfaktor; was vom erarbeiteten Honorar danach bleibt, ist der Gewinn.
    selbstkosten,
    gewinn:selbstkosten!=null&&erarbeitet!=null?r2(erarbeitet-selbstkosten):null,
    prognoseSelbstkosten:selbstkosten!=null&&prozent?r2(selbstkosten*100/prozent):null,
    prognoseGewinn:selbstkosten!=null&&prozent?r2(honorar-selbstkosten*100/prozent):null,
    zahlungen:(zahlungen||[]).length,
    vorlaeufig:!!paket?.vorlaeufig||(zahlungen||[]).some(z=>z.vorlaeufig)
  };
}
// Reihenfolge in der Übersicht (Gari, 25.11.2026): aufsteigend nach Projektnummer (natürlich: T-9 vor T-10), ohne Nummer ans Ende; im
// selben Projekt die Pakete nach Bezeichnung (LPH 3 vor LPH 4), dann nach Anlage. a und b: {nummer, paket, k}.
const natuerlich=(x,y)=>String(x).localeCompare(String(y),'de',{numeric:true,sensitivity:'base'});
function ordnung(a,b){
  const na=String(a?.nummer??'').trim(),nb=String(b?.nummer??'').trim();
  if(!na!==!nb)return na?-1:1;
  return natuerlich(na,nb)||natuerlich(a?.paket?.bezeichnung||'',b?.paket?.bezeichnung||'')||
    String(a?.paket?.created_at||'').localeCompare(String(b?.paket?.created_at||''));
}
// Annahmen für die Sätze aus dem Gehalt (office_controlling_einstellungen; was fehlt, mit den Standardwerten der
// Datenbank). Der Gemeinkostenfaktor hat keinen Standard: ohne ihn keine Selbstkosten.
function annahmen(e){
  const wert=(x,d)=>{const v=Number(x);return x!=null&&x!==''&&Number.isFinite(v)?v:d};
  const faktor=wert(e?.gemeinkostenfaktor,null);
  const anteil=wert(e?.projektanteil_prozent,null);
  return {ag:wert(e?.arbeitgeberanteil_prozent,21),jahresstunden:wert(e?.jahresstunden,1600),vollzeit:wert(e?.vollzeit_wochenstunden,40),
    faktor:faktor>0?faktor:null,urlaub:wert(e?.urlaubstage,null),projektanteil:anteil>0?Math.min(anteil,100):100};
}
// Jahresstunden einer Person: die der Vollzeit, anteilig nach ihren Wochenstunden (leer: Vollzeit). Hat sie eigenen
// Urlaub (urlaub: Eintrag mit urlaubstage und arbeitstage_woche) und das Büro seine Urlaubstage eingetragen, zählt der
// Unterschied: (Urlaub des Büros × Wochenstunden ÷ 5 − eigener Urlaub × Wochenstunden ÷ Arbeitstage) × Projektanteil.
// Anteiliger Urlaub in Teilzeit (12 Tage bei 2 Arbeitstagen, wenn das Büro 30 gibt) ändert also nichts.
function jahresstundenPerson(wochenstunden,einstellungen,urlaub=null){
  const a=annahmen(einstellungen),w=Number(wochenstunden);
  const woche=wochenstunden!=null&&wochenstunden!==''&&w>0?w:a.vollzeit;
  let h=a.vollzeit>0?a.jahresstunden*woche/a.vollzeit:0;
  const eigen=urlaub?.urlaubstage;
  if(eigen!=null&&eigen!==''&&Number.isFinite(Number(eigen))&&a.urlaub!=null){
    const tage=Number(urlaub.arbeitstage_woche)>0?Number(urlaub.arbeitstage_woche):5;
    h+=(a.urlaub*woche/5-Number(eigen)*woche/tage)*a.projektanteil/100;
  }
  return h;
}
// Personalkosten je Stunde (Stundensatz aus dem Gehalt): Bruttogehalt × 12 × (1 + Arbeitgeberanteil) ÷ Jahresstunden der
// Person, ungerundet wie in der Datenbank.
function gehaltSatzRoh(monatsgehalt,einstellungen,wochenstunden,urlaub=null){
  const g=Number(monatsgehalt),h=jahresstundenPerson(wochenstunden,einstellungen,urlaub);
  if(monatsgehalt==null||!Number.isFinite(g)||g<=0||!(h>0))return null;
  return g*12*(1+annahmen(einstellungen).ag/100)/h;
}
// Selbstkosten je Stunde: Bruttogehalt × 12 × Gemeinkostenfaktor ÷ Jahresstunden der Person. Der Faktor gilt für das
// Bruttogehalt allein (Gari, 25.11.2026; mit der Buchhaltung bestätigt am 26.11.2026).
function selbstkostenSatzRoh(monatsgehalt,einstellungen,wochenstunden,urlaub=null){
  const g=Number(monatsgehalt),h=jahresstundenPerson(wochenstunden,einstellungen,urlaub),f=annahmen(einstellungen).faktor;
  if(monatsgehalt==null||!Number.isFinite(g)||g<=0||!(h>0)||f==null)return null;
  return g*12*f/h;
}
const gerundet=f=>(...a)=>{const v=f(...a);return v==null?null:r2(v)};
const gehaltSatz=gerundet(gehaltSatzRoh),selbstkostenSatz=gerundet(selbstkostenSatzRoh);
// Bis zu welchem Bruttogehalt (Vollzeit) deckt ein Kalkulationssatz die Selbstkosten einer Stunde?
function deckungBisGehalt(kalkulationssatz,einstellungen){
  const a=annahmen(einstellungen),s=zahl(kalkulationssatz);
  return a.faktor&&s>0?r2(s*a.jahresstunden/(12*a.faktor)):null;
}
// Der Satz einer Person an einem Tag: der jüngste ab diesem Tag gültige (wie die Datenbank).
function satzAm(saetze,personId,tag,feld='kalkulationssatz'){
  const l=(saetze||[]).filter(s=>s.person_id===personId&&s[feld]!=null&&String(s.gueltig_ab)<=String(tag))
    .sort((a,b)=>String(b.gueltig_ab).localeCompare(String(a.gueltig_ab)));
  return l.length?zahl(l[0][feld]):null;
}
// Der Eintrag mit Gehalt, der an einem Tag gilt, mit seinen Wochenstunden (wie die Datenbank: Gehalt und Wochenstunden
// aus demselben Eintrag).
function gehaltAm(saetze,personId,tag){
  const l=(saetze||[]).filter(s=>s.person_id===personId&&s.monatsgehalt!=null&&String(s.gueltig_ab)<=String(tag))
    .sort((a,b)=>String(b.gueltig_ab).localeCompare(String(a.gueltig_ab)));
  return l[0]||null;
}
const personSchluessel=h=>h.person_id||(h.person_name?'name:'+String(h.person_name).trim().toLowerCase():'team');

// Die Stunden eines Pakets je Person bewertet, wie office_controlling_summen in der Datenbank (nur mit vollem Zugang,
// denn nur dann gibt es Stunden je Person und Sätze): je Person die Stunden seit Beginn bis zum Stichtag (fehlt sie in
// einem Stand, zählt ihr letzter Wert weiter); der Zuwachs seit dem vorigen Stand zählt zum Satz, der am Stichtag gilt.
// Personalkosten und Selbstkosten sind nur vollständig, wenn jeder Zuwachs ein Gehalt hat (Team- und Namenszeilen haben
// keins); einmal unvollständig, bleibt es für die folgenden Stände. staende: [{id, stichtag}].
function bewertung(staende,stunden,saetze,einstellungen,paketSatz){
  const a=annahmen(einstellungen),satzPaket=zahl(paketSatz)||85;
  const liste=[...(staende||[])].sort((x,y)=>String(x.stichtag).localeCompare(String(y.stichtag)));
  const ids=new Set(liste.map(s=>s.id)),zeilen=(stunden||[]).filter(h=>ids.has(h.stand_id));
  const personen=new Map();
  for(const h of zeilen){const k=personSchluessel(h);if(!personen.has(k))personen.set(k,{schluessel:k,person_id:h.person_id||null,
    name:h.person_name||null,stunden:0,personalkosten:0,selbstkosten:0,ohneGehalt:false,ohneSelbstkosten:false,saetzeG:new Set(),saetzeS:new Set()})}
  const letzte=new Map(),je=[];
  let wertK=0,pk=0,sk=0,pkVoll=true,skVoll=true;
  for(const s of liste){
    let summe=0;
    for(const [k,p] of personen){
      const z=zeilen.find(h=>h.stand_id===s.id&&personSchluessel(h)===k);
      const vor=letzte.get(k)||0,kum=z?zahl(z.stunden):vor,delta=kum-vor;
      letzte.set(k,kum);summe+=kum;p.stunden=kum;
      wertK+=delta*((p.person_id?satzAm(saetze,p.person_id,s.stichtag,'kalkulationssatz'):null)??satzPaket);
      if(delta===0)continue;
      const g=p.person_id?gehaltAm(saetze,p.person_id,s.stichtag):null;
      const sg=g?gehaltSatzRoh(g.monatsgehalt,einstellungen,g.wochenstunden,g):null,ss=g?selbstkostenSatzRoh(g.monatsgehalt,einstellungen,g.wochenstunden,g):null;
      if(sg==null){pkVoll=false;p.ohneGehalt=true}else{pk+=delta*sg;p.personalkosten+=delta*sg;p.saetzeG.add(r2(sg))}
      if(ss==null){skVoll=false;p.ohneSelbstkosten=true}else{sk+=delta*ss;p.selbstkosten+=delta*ss;p.saetzeS.add(r2(ss))}
    }
    je.push({stand_id:s.id,stichtag:s.stichtag,stunden:r2(summe),wertKalkulation:r2(wertK),
      personalkosten:pkVoll?r2(pk):null,selbstkosten:skVoll?r2(sk):null});
  }
  const einer=m=>m.size===1?[...m][0]:null;
  return {staende:je,faktor:a.faktor,annahmen:a,
    personen:[...personen.values()].map(p=>({schluessel:p.schluessel,person_id:p.person_id,name:p.name,stunden:r2(p.stunden),
      personalkosten:p.ohneGehalt?null:r2(p.personalkosten),selbstkosten:p.ohneSelbstkosten?null:r2(p.selbstkosten),
      satzGehalt:p.ohneGehalt?null:einer(p.saetzeG),satzSelbstkosten:p.ohneSelbstkosten?null:einer(p.saetzeS)}))};
}

// ---------- Jahresstunden aus dem Kalender (Gari, 25.11.2026: zählen die 1.600 h die Feiertage des Jahres?) ----------
// Ostersonntag im gregorianischen Kalender (anonymer gregorianischer Algorithmus), als UTC-Datum.
function ostern(jahr){
  const a=jahr%19,b=Math.floor(jahr/100),c=jahr%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const n=h+l-7*m+114;
  return new Date(Date.UTC(jahr,Math.floor(n/31)-1,n%31+1));
}
const isoTag=d=>d.toISOString().slice(0,10);
// Die gesetzlichen Feiertage am Sitz des Büros: Stadt Augsburg, Bayern – 14, mit Mariä Himmelfahrt (überwiegend
// katholische Gemeinde) und dem Augsburger Friedensfest (nur im Stadtgebiet). werktag: fällt auf Montag bis Freitag.
function feiertage(jahr){
  const o=ostern(jahr).getTime(),ab=n=>new Date(o+n*864e5),am=(m,t)=>new Date(Date.UTC(jahr,m-1,t));
  return [['Neujahr',am(1,1)],['Heilige Drei Könige',am(1,6)],['Karfreitag',ab(-2)],['Ostermontag',ab(1)],['Tag der Arbeit',am(5,1)],
    ['Christi Himmelfahrt',ab(39)],['Pfingstmontag',ab(50)],['Fronleichnam',ab(60)],['Augsburger Friedensfest',am(8,8)],
    ['Mariä Himmelfahrt',am(8,15)],['Tag der Deutschen Einheit',am(10,3)],['Allerheiligen',am(11,1)],['1. Weihnachtstag',am(12,25)],
    ['2. Weihnachtstag',am(12,26)]].map(([name,d])=>({name,datum:isoTag(d),werktag:d.getUTCDay()>=1&&d.getUTCDay()<=5}));
}
// Montag bis Freitag im Jahr.
function werktage(jahr){
  let n=0;
  for(let t=Date.UTC(jahr,0,1);t<Date.UTC(jahr+1,0,1);t+=864e5){const w=new Date(t).getUTCDay();if(w>=1&&w<=5)n++}
  return n;
}
// Jahresstunden einer Vollzeitkraft aus dem Kalender: (Werktage − Feiertage an Werktagen − Urlaub − Krankheit − weitere
// Tage ohne Projekt) × Wochenstunden ÷ 5 × Projektanteil. Leere Angaben zählen als 0 Tage und 100 % Projektanteil.
function jahresstundenAusKalender({jahr,urlaubstage,krankheitstage,weitereTage,projektanteil,wochenstunden}={}){
  const j=Number(jahr)||new Date().getFullYear(),w=werktage(j),f=feiertage(j).filter(x=>x.werktag).length;
  const woche=Number(wochenstunden)>0?Number(wochenstunden):40,anteil=Number(projektanteil)>0?Math.min(Number(projektanteil),100):100;
  const tage=w-f-zahl(urlaubstage)-zahl(krankheitstage)-zahl(weitereTage);
  return {jahr:j,werktage:w,feiertage:f,arbeitstage:w-f,tage,stundenJeTag:woche/5,projektanteil:anteil,
    jahresstunden:Math.max(0,Math.round(tage*woche/5*anteil/100))};
}

// Lage auf einen Blick (Gari, 25.11.2026: das Projektblatt öffnen und sofort sehen, wie das Projekt läuft): die
// Hochrechnung gegenüber der Kalkulation, gemessen am Honorar. Im Budget: am Ende bleibt nichts im Minus; leicht über
// Budget: bis 10 % des Honorars im Minus; deutlich darüber: mehr. Abgeschlossen zählt das Ergebnis. Ohne Honorar, Stand
// oder Leistungsstand: offen.
const LAGE_GRENZE=-0.1;
function lage(k){
  const honorar=zahl(k?.honorar);
  if(!k||!(honorar>0))return {stufe:'offen',grund:'honorar'};
  if(!k.stand)return {stufe:'offen',grund:'stand'};
  const ergebnis=k.abgeschlossen?k.ergebnisBisher:k.prognoseErgebnis;
  if(ergebnis==null)return {stufe:'offen',grund:'leistungsstand'};
  const anteil=ergebnis/honorar;
  return {stufe:anteil>=0?'gut':anteil>=LAGE_GRENZE?'achtung':'kritisch',grund:null,ergebnis,anteil,
    restBudget:r2(zahl(k.budget)-zahl(k.stunden)),restNoetig:k.prognoseStunden!=null?r2(k.prognoseStunden-zahl(k.stunden)):null};
}

const api={MWST_PROZENT,STATUS,LAGE_GRENZE,leseZahl,ausBrutto,honorarAnteil,rechnung,kennzahlen,ordnung,annahmen,jahresstundenPerson,
  gehaltSatz,selbstkostenSatz,deckungBisGehalt,satzAm,gehaltAm,bewertung,lage,ostern,feiertage,werktage,jahresstundenAusKalender,r2};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.TBA_CONTROLLING=api;
})(typeof window!=='undefined'?window:globalThis);
