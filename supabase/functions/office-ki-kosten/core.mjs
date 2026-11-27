// TBA Office · tatsächliche Kosten des laufenden Monats bei OpenAI (Costs-API). Reine Hilfen ohne Netz, getestet in
// tests/office-ki-kosten.test.mjs. OpenAI rechnet Tage und Monate in UTC; die Costs-API liefert je Tag einen Eimer und
// darin je OpenAI-Projekt ein Ergebnis mit dem Betrag.
export const VERSION="office-ki-kosten-v1";

export function monatsBeginnUtc(jetzt=new Date()){
  return Math.floor(Date.UTC(jetzt.getUTCFullYear(),jetzt.getUTCMonth(),1)/1000);
}
export function kostenUrl(start,seite=null){
  const q=new URLSearchParams({start_time:String(start),bucket_width:"1d",limit:"31",group_by:"project_id"});
  if(seite)q.set("page",String(seite));
  return "https://api.openai.com/v1/organization/costs?"+q.toString();
}
const zahl=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const runden=n=>Math.round(n*10000)/10000;

// Seiten der Costs-API → Summe des Monats, je Tag (UTC) und je OpenAI-Projekt (mit Namen, wenn bekannt).
export function zusammenfassen(seiten,namen={},jetzt=new Date()){
  const tage={},projekte={};
  let summe=0;
  for(const seite of seiten||[])for(const eimer of (seite&&seite.data)||[]){
    const tag=new Date(zahl(eimer&&eimer.start_time)*1000).toISOString().slice(0,10);
    for(const r of (eimer&&eimer.results)||[]){
      const betrag=zahl(r&&r.amount&&r.amount.value);
      summe+=betrag;
      tage[tag]=(tage[tag]||0)+betrag;
      const id=String((r&&r.project_id)||"");
      const p=projekte[id]||(projekte[id]={id:id||null,name:id?(namen[id]||null):null,usd:0});
      p.usd+=betrag;
    }
  }
  return {verfuegbar:true,monat:jetzt.toISOString().slice(0,7),usd:runden(summe),
    tage:Object.keys(tage).sort().map(t=>({tag:t,usd:runden(tage[t])})),
    projekte:Object.values(projekte).map(p=>({...p,usd:runden(p.usd)})).sort((a,b)=>b.usd-a.usd),
    stand:jetzt.toISOString()};
}
