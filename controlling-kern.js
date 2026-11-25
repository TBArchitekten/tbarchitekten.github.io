/* TBA Office · Controlling · Kern (25.11.2026, Claude; Wunsch von Gari am 25.11.2026).
   Rechnet aus einem Honorarpaket, den Summen seiner Stände (vom Server: Stunden und ihr Wert zum Kalkulationssatz,
   für Admins auch zum Gehalt) und seinen Zahlungen die Kennzahlen: Stundenbudget, Leistungsstand, erarbeitetes
   Honorar, bezahlt, offen, Wert der Stunden, Ergebnis bisher, Prognose und Honorar je Stunde.
   Begriffe wie in der Projektübersicht von untermStrich: erarbeitetes Honorar = Honorar × Leistungsstand;
   Prognose = Stunden (oder ihr Wert) ÷ Leistungsstand. Das Ergebnis steht gegenüber der Kalkulation (85 €/h ist ein
   Kalkulationssatz, kein Gehalt); das Ergebnis zum Gehalt rechnet nur für Admins.
   Ohne DOM: im Browser window.TBA_CONTROLLING, in Node module.exports (Tests). */
(function(root){
'use strict';
const zahl=x=>{const n=Number(x);return Number.isFinite(n)?n:0};
const r2=x=>Math.round(zahl(x)*100)/100;
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

function kennzahlen(paket,staende=[],zahlungen=[]){
  const honorar=zahl(paket?.honorar_netto),satz=zahl(paket?.kalkulationssatz)||85,nk=zahl(paket?.nebenkosten_prozent);
  const liste=[...(staende||[])].sort((a,b)=>String(a.stichtag).localeCompare(String(b.stichtag)));
  const letzter=liste[liste.length-1]||null;
  const abgeschlossen=paket?.status==='abgeschlossen';
  const stunden=letzter?zahl(letzter.stunden):0,wert=letzter?zahl(letzter.wert_kalkulation):0;
  const geschaetzt=letzter&&letzter.leistungsstand!=null&&letzter.leistungsstand!==''?zahl(letzter.leistungsstand):null;
  const leistungsstand=abgeschlossen?100:geschaetzt;
  const budget=satz>0?honorar/satz:0;
  const summe=status=>r2((zahlungen||[]).filter(z=>z.status===status).reduce((s,z)=>s+zahl(z.netto),0));
  const bezahltNetto=summe('bezahlt'),gestelltNetto=summe('gestellt');
  const bezahlt=honorarAnteil(bezahltNetto,nk),gestellt=honorarAnteil(gestelltNetto,nk);
  const erarbeitet=leistungsstand!=null?r2(honorar*leistungsstand/100):null;
  const prozent=leistungsstand!=null&&leistungsstand>0?leistungsstand:null;
  const gehalt=letzter&&letzter.wert_gehalt!=null?zahl(letzter.wert_gehalt):null;
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
    zahlungen:(zahlungen||[]).length,
    vorlaeufig:!!paket?.vorlaeufig||(zahlungen||[]).some(z=>z.vorlaeufig)
  };
}
// Reihenfolge in der Übersicht: laufende Pakete zuerst, darin die mit der schlechtesten Prognose; ohne Prognose ans Ende.
// a und b: {paket, k} mit k aus kennzahlen().
function ordnung(a,b){
  const status=x=>({beauftragt:0,angeboten:1,abgeschlossen:2}[x?.paket?.status]??3);
  const prognose=x=>x?.k?.prognoseErgebnis??x?.k?.ergebnisBisher??Infinity;
  return status(a)-status(b)||prognose(a)-prognose(b)||String(a?.paket?.bezeichnung||'').localeCompare(String(b?.paket?.bezeichnung||''),'de');
}
// Stundensatz aus dem Monatsgehalt: Gehalt × 12 × (1 + Arbeitgeberanteil) ÷ Jahresstunden (wie die Datenbank).
function gehaltSatz(monatsgehalt,einstellungen){
  const g=Number(monatsgehalt),ag=zahl(einstellungen?.arbeitgeberanteil_prozent??21),h=zahl(einstellungen?.jahresstunden??1600);
  if(!Number.isFinite(g)||g<=0||h<=0)return null;
  return r2(g*12*(1+ag/100)/h);
}
// Der Satz einer Person an einem Tag: der jüngste ab diesem Tag gültige (wie die Datenbank).
function satzAm(saetze,personId,tag,feld='kalkulationssatz'){
  const l=(saetze||[]).filter(s=>s.person_id===personId&&s[feld]!=null&&String(s.gueltig_ab)<=String(tag))
    .sort((a,b)=>String(b.gueltig_ab).localeCompare(String(a.gueltig_ab)));
  return l.length?zahl(l[0][feld]):null;
}

const api={MWST_PROZENT,STATUS,leseZahl,ausBrutto,honorarAnteil,kennzahlen,ordnung,gehaltSatz,satzAm,r2};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.TBA_CONTROLLING=api;
})(typeof window!=='undefined'?window:globalThis);
