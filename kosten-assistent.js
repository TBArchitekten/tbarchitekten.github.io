/* TBA Office · Kostenberechnung · Assistent (21.11.2026, Claude; Auftrag Gari: ein KI-Assistent wie beim
   Terminplan, aber für die Kosten).
   Gespräch rechts neben der Tabelle, an der Stelle der Details: Fragen zur Berechnung, altes Büro-Excel, Angebote
   und Kostenbeiträge auswerten, Elemente vorschlagen. Die KI (Edge Function office-kosten-ai) schlägt nur vor;
   übernommen wird erst mit «Prüfen und übernehmen», gespeichert wie jede andere Änderung (bedingt auf die
   Revision), und rückgängig, solange danach nichts anderes geändert wurde.
   Rein und getestet: tabelleText, bestesBlatt, pruefeVorschlag, wendeAn, vorschau. Die Oberfläche: init(). */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TBA_KOSTEN_ASSISTENT=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(root){
'use strict';
const VERSION='office-kosten-ai-v1';
const FUNKTION='office-kosten-ai';
const MAX_DATEI=8*1024*1024,MAX_GESAMT=12*1024*1024,MAX_TABELLE=200000;
const MIME={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
const KG_TEXT=/^\s*[1-8]\d\d(\s|$)/;

// ---------- Tabellen (altes Büro-Excel, CSV) ----------
// Zeilen als Text: Zeilennummer wie im Blatt, dann die Zellen, getrennt durch Tabulatoren. So kann das Modell
// «Zeile 12» als Fundstelle nennen, und die Person findet sie im Excel wieder.
function tabelleText(zeilen,{max=MAX_TABELLE}={}){
  const out=[];let laenge=0,n=0,gekuerzt=false;
  (zeilen||[]).forEach((zeile,i)=>{
    if(gekuerzt)return;
    const z=Array.from(zeile||[],x=>String(x??'').replace(/[\t\r\n]+/g,' ').trim());
    while(z.length&&!z[z.length-1])z.pop();
    if(!z.length)return;
    const nr=Number.isInteger(zeile?.nr)&&zeile.nr>0?zeile.nr:i+1;
    const text=nr+'\t'+z.join('\t');
    if(laenge+text.length+1>max){gekuerzt=true;return}
    out.push(text);laenge+=text.length+1;n++;
  });
  return {text:out.join('\n'),zeilen:n,gekuerzt};
}
// Hat die Mappe mehrere Blätter, ist das mit den meisten Kostengruppen das der Kostenberechnung.
function bestesBlatt(blaetter){
  let best=null,wert=-1;
  for(const b of blaetter||[]){
    const z=b?.zeilen||[];
    const kg=z.filter(r=>Array.from(r||[]).some(x=>KG_TEXT.test(String(x??'')))).length;
    const w=kg*10+Math.min(z.length,1000)/1000;
    if(w>wert){wert=w;best=b}
  }
  return best;
}

// ---------- Vorschlag prüfen und übernehmen ----------
// Der Stand kann sich seit der Anfrage geändert haben: was nicht mehr passt, fällt heraus und wird gezählt.
function pruefeVorschlag(v,st,R){
  const katalog=new Set((st?.katalog||[]).map(k=>String(k.kg)));
  const hatKinder=kg=>[...katalog].some(x=>x!==kg&&R.liegtUnter(x,kg));
  const elementeBestand=new Map((st?.elemente||[]).map(e=>[e.id,e.kg]));
  const positionen=st?.positionen||[];
  const refs=new Map(),elemente=[];
  for(const e of v?.elemente||[]){
    if(!e||!e.ref||refs.has(e.ref)||!e.titel||!katalog.has(e.kg)||hatKinder(e.kg))continue;
    refs.set(e.ref,e.kg);elemente.push(e);
  }
  const neu=[];
  for(const p of v?.positionen||[]){
    if(!p||!katalog.has(p.kg)||!p.titel)continue;
    const passt=p.element&&(refs.get(p.element)===p.kg||elementeBestand.get(p.element)===p.kg);
    neu.push({...p,element:passt?p.element:'',modus:p.modus==='pauschal'||hatKinder(p.kg)?'pauschal':'menge'});
  }
  // Eine Änderung muss zur Rechenweise der Position passen (Einheitspreis nur bei Menge × EP, Betrag nur bei Pauschalen).
  const aenderungen=(v?.aenderungen||[]).filter(a=>{
    const p=positionen.find(x=>x.id===a?.id);if(!p)return false;
    if(['menge','ep','einheit'].includes(a.feld))return p.modus!=='betrag';
    if(a.feld==='betrag')return p.modus==='betrag';
    return true;
  });
  const belegt=kg=>positionen.some(p=>String(p.kg)===kg||R.liegtUnter(String(p.kg),kg))||neu.some(p=>p.kg===kg||R.liegtUnter(p.kg,kg));
  const entfallen=(v?.entfallen||[]).filter(x=>x&&katalog.has(x.kg)&&st?.gruppen?.[x.kg]?.status!=='entfaellt'&&!belegt(x.kg));
  const zahl=x=>(v?.[x]||[]).length;
  const weg=zahl('elemente')-elemente.length+zahl('positionen')-neu.length+zahl('aenderungen')-aenderungen.length+zahl('entfallen')-entfallen.length;
  return {elemente,positionen:neu,aenderungen,entfallen,weg};
}
// Neue Position im Format des Werkzeugs (wie «+ Position»), mit Quelle, Fundstelle und dem Tag der Übernahme.
function alsPosition(p,R,{id,elementId,heute}){
  const kennwert={};
  if(p.quelle)kennwert.art=p.quelle;
  if(p.modus!=='pauschal'&&p.ep)kennwert.wert=p.ep;
  if(p.fundstelle)kennwert.fundstelle=p.fundstelle;
  if(p.kostenstand)kennwert.kostenstand=p.kostenstand;
  // Umsatzsteuer nur festhalten, wenn sie von der üblichen Annahme der Quelle abweicht (BKI meist brutto).
  if(p.quelle&&R.ARTEN[p.quelle]&&!!p.brutto!==!!R.ARTEN[p.quelle].brutto)kennwert.brutto=!!p.brutto;
  const pos={id,kg:p.kg,titel:p.titel,gewerk:R.gewerkKurz(p.gewerk),ort:p.ort||'',element:elementId||'',bauteiltyp:'',notiz:p.notiz||'',
    modus:p.modus==='pauschal'?'betrag':'menge',kennwert,assistent:heute||''};
  if(pos.modus==='menge')Object.assign(pos,{menge:p.menge||null,einheit:p.einheit||'m²',
    mengenquelle:{art:p.mengenquelle||'manuell',text:p.menge&&p.fundstelle?p.fundstelle:''}});
  else pos.betrag=p.betrag||null;
  return pos;
}
// Übernimmt den geprüften Vorschlag in den Stand (verändert st). Elemente zuerst, dann Positionen hinter die
// letzte Position derselben KG und desselben Elements, dann Änderungen und «entfällt».
function wendeAn(st,v,R,{neueId,heute}={}){
  const g=pruefeVorschlag(v,st,R);
  st.elemente=st.elemente||[];st.positionen=st.positionen||[];
  const refId=new Map();
  for(const e of g.elemente){const id=neueId('e:');refId.set(e.ref,id);st.elemente.push({id,kg:e.kg,titel:e.titel,notiz:e.notiz||''})}
  const neu=[];
  for(const p of g.positionen){
    const elementId=refId.get(p.element)||(p.element&&st.elemente.some(e=>e.id===p.element)?p.element:'');
    const pos=alsPosition(p,R,{id:neueId('p:'),elementId,heute});
    let nach=-1;st.positionen.forEach((x,i)=>{if(x.kg===pos.kg&&(x.element||'')===(elementId||''))nach=i});
    if(nach<0&&elementId)st.positionen.forEach((x,i)=>{if(x.kg===pos.kg)nach=i});
    if(nach>=0)st.positionen.splice(nach+1,0,pos);else st.positionen.push(pos);
    neu.push(pos.id);
  }
  const geaendert=[];
  for(const a of g.aenderungen){
    const p=st.positionen.find(x=>x.id===a.id);if(!p)continue;
    p.kennwert=p.kennwert||{};
    if(a.feld==='ep')p.kennwert.wert=a.wert;
    else if(a.feld==='quelle')p.kennwert.art=a.wert;
    else if(a.feld==='fundstelle')p.kennwert.fundstelle=a.wert;
    else if(a.feld==='gewerk')p.gewerk=R.gewerkKurz(a.wert);
    else if(['titel','ort','menge','einheit','betrag','notiz'].includes(a.feld))p[a.feld]=a.wert;
    if(!geaendert.includes(p.id))geaendert.push(p.id);
  }
  if(g.entfallen.length){st.gruppen=st.gruppen||{};for(const x of g.entfallen)st.gruppen[x.kg]={status:'entfaellt',notiz:x.begruendung||''}}
  return {elemente:g.elemente.length,positionen:neu.length,aenderungen:g.aenderungen.length,entfallen:g.entfallen.length,weg:g.weg,
    neu,geaendert,kgs:[...new Set([...g.positionen.map(p=>p.kg),...g.entfallen.map(x=>x.kg)])]};
}
// Vorschau auf einer Kopie: was der Vorschlag an der Summe ändert und welche neuen Positionen offen blieben.
function vorschau(v,st,R){
  const kopie=JSON.parse(JSON.stringify(st));let n=0;
  const r=wendeAn(kopie,v,R,{neueId:p=>p+'vorschau-'+(n++),heute:''});
  const vorher=R.berechne(st),nachher=R.berechne(kopie);
  const ergebnis=new Map(nachher.positionen.map(x=>[x.id,x]));
  const zeilen=r.neu.map(id=>{const p=kopie.positionen.find(x=>x.id===id);const e=ergebnis.get(id)||{};
    return {id,kg:p.kg,element:(kopie.elemente||[]).find(x=>x.id===p.element)?.titel||'',titel:p.titel,modus:p.modus,menge:p.menge,einheit:p.einheit,
      ep:p.kennwert?.wert||'',quelle:p.kennwert?.art||'',fundstelle:p.kennwert?.fundstelle||'',betragCent:e.betragCent??null,offen:e.status==='offen',fehlt:e.fehlt||[]}});
  return {...r,deltaCent:nachher.gesamt.bekanntCent-vorher.gesamt.bekanntCent,offen:zeilen.filter(z=>z.offen).length,zeilen,
    summeCent:nachher.gesamt.bekanntCent};
}

// ---------- Oberfläche ----------
// b: Brücke zur Seite (Stand, Speichern, Rendern, Auswahl), siehe kostenberechnung.js.
function init(b){
  const d=root?.document;if(!d||!b?.sb)return null;
  const {sb,R,I,esc}=b;
  let offen=false,geprueft=false,bereit=false,modell='',geladen=false,schreibt=false;
  let verlauf=[],vorschlag=null,anhaenge=[],tabelle=null,bezug=null,rueckgaengig=null,startArt='';
  const aside=d.createElement('aside');
  aside.id='kbAssistent';aside.className='inspektor assistent';aside.hidden=true;aside.setAttribute('aria-label','Assistent');
  aside.innerHTML='<div class="inspektor-kopf as-kopf"><div class="as-titel"><strong>Assistent</strong><span class="meta" id="asModell">KI · schlägt vor, du entscheidest</span></div>'+
    '<button type="button" class="inspektor-zu" data-as="zu" aria-label="Assistent schließen">×</button></div>'+
    '<div class="as-body" id="asBody"><div class="as-leer" id="asLeer"><p class="as-lead">Frag nach der Kostenberechnung, oder gib dem Assistenten ein Angebot, einen Kostenbeitrag der Fachplanung oder das alte Büro-Excel. '+
    'Er schlägt Positionen mit Quelle und Fundstelle vor; Preise ohne Fundstelle übernimmt er nicht. In die Kostenberechnung kommt nur, was du prüfst und übernimmst.</p>'+
    '<div class="as-starts">'+[['fehlt','Was fehlt noch?'],['excel','Altes Büro-Excel übernehmen'],['angebot','Angebot oder Kostenbeitrag auswerten'],
      ['vergleich','Abweichung zur Kostenschätzung erklären'],['elemente','Elemente für die Auswahl vorschlagen']]
      .map(([k,t])=>'<button type="button" class="as-start" data-as="start" data-start="'+k+'">'+t+'</button>').join('')+'</div></div>'+
    '<div class="as-stream" id="asStream" role="log" aria-live="polite"></div><div id="asVorschlag"></div></div>'+
    '<form class="as-form" id="asForm"><div class="as-bezug" id="asBezug"></div><div class="as-anhaenge" id="asAnhaenge"></div>'+
    '<div class="as-zeile"><button type="button" class="as-plus" data-as="datei" aria-label="Datei anhängen" title="PDF, Foto, Excel (.xlsx) oder CSV anhängen">+</button>'+
    '<textarea id="asText" rows="1" maxlength="2000" aria-label="Nachricht an den Assistenten" placeholder="Nachricht an den Assistenten"></textarea>'+
    '<button type="submit" class="as-senden" id="asSenden" aria-label="Senden"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg></button></div>'+
    '<p class="meta as-fuss">Mit jeder Anfrage gehen die Kostenberechnung und die angehängten Dateien an den KI-Anbieter des Office. Höchstens 25 Anfragen am Tag.</p>'+
    '<input type="file" id="asDatei" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.csv,.tsv,.txt,application/pdf,image/png,image/jpeg,image/webp"></form>';
  d.body.append(aside);
  const $=s=>aside.querySelector(s);
  const text=$('#asText');

  // Verlauf: je Person und Kostenberechnung (RLS), wie das Terminplan-Gespräch.
  async function ladeVerlauf(){
    if(geladen||!b.doc()?.id||!b.nutzerId())return;
    geladen=true;
    const {data,error}=await sb.from('office_kosten_dialogue_messages').select('role,body,event_kind,event_data,created_at')
      .eq('instance_id',b.doc().id).eq('user_id',b.nutzerId()).order('created_at',{ascending:false}).limit(40);
    if(error){console.warn('Assistent: Verlauf nicht lesbar',error.message);return}
    verlauf=[...(data||[]).reverse().map(x=>({role:x.role,body:x.body,kind:x.event_kind,
      hinweise:Array.isArray(x.event_data?.hinweise)?x.event_data.hinweise:[],fragen:Array.isArray(x.event_data?.fragen)?x.event_data.fragen:[]})),...verlauf];
    zeigeVerlauf();
  }
  function merke(m){
    verlauf.push(m);if(verlauf.length>80)verlauf=verlauf.slice(-80);
    zeigeVerlauf();
    if(!b.doc()?.id||!b.nutzerId())return;
    void sb.from('office_kosten_dialogue_messages').insert({instance_id:b.doc().id,user_id:b.nutzerId(),role:m.role,body:String(m.body||'').slice(0,4000),
      event_kind:m.kind||'answer',event_data:{quelle:VERSION,hinweise:(m.hinweise||[]).slice(0,20),fragen:(m.fragen||[]).slice(0,4)}})
      .then(({error})=>{if(error)console.warn('Assistent: Verlauf nicht gespeichert',error.message)});
  }
  async function pruefeStatus(){
    if(geprueft||!b.doc()?.id)return;
    geprueft=true;$('#asModell').textContent='Prüfe Verfügbarkeit …';
    try{
      const {data,error}=await sb.functions.invoke(FUNKTION,{body:{action:'status',instance_id:b.doc().id}});
      bereit=!error&&data?.version===VERSION&&data.ready===true;modell=bereit?String(data.model||''):'';
    }catch(e){console.warn('Assistent: Status',String(e?.message||e));bereit=false}
    $('#asModell').textContent=bereit?'KI · '+modell+' · schlägt vor, du entscheidest':'KI zurzeit nicht verfügbar';
    zeigeEingabe();
  }

  // ---------- Anzeigen ----------
  const unveraendert=()=>!!rueckgaengig&&JSON.stringify(b.stand())===rueckgaengig.nachher;
  function zeigeVerlauf(){
    const html=verlauf.map(m=>{
      if(m.role==='user')return '<div class="as-msg ich"><p>'+esc(m.body)+'</p></div>';
      let extra='';
      if(m.fragen?.length)extra+='<ul class="as-fragen">'+m.fragen.map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul>';
      if(m.hinweise?.length)extra+='<details class="as-hinweise"><summary>'+m.hinweise.length+(m.hinweise.length===1?' Hinweis der Prüfung':' Hinweise der Prüfung')+'</summary><ul>'+
        m.hinweise.map(h=>'<li>'+esc(h)+'</li>').join('')+'</ul></details>';
      if(m.undo&&rueckgaengig?.id===m.undo&&unveraendert())extra+='<button type="button" class="btn as-undo" data-as="rueckgaengig">Rückgängig</button>';
      return '<div class="as-msg ki'+(m.kind==='warning'?' warn':m.kind==='receipt'?' ok':'')+'"><p>'+esc(m.body)+'</p>'+extra+'</div>';
    }).join('')+(schreibt?'<div class="as-msg ki denkt" aria-label="Assistent denkt nach"><span class="as-punkte"><i></i><i></i><i></i></span></div>':'');
    $('#asStream').innerHTML=html;
    $('#asLeer').hidden=verlauf.length>0||schreibt;
    zeigeVorschlag();
    const body=$('#asBody');body.scrollTop=body.scrollHeight;
  }
  const quelleKurz=q=>R.ARTEN[q]?.kurz||'';
  const preis=x=>{const d=R.dezimal(x);return d===null||d===undefined?'':new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:4}).format(Number(d))};
  function zeigeVorschlag(){
    const host=$('#asVorschlag');
    if(!vorschlag){host.innerHTML='';return}
    const v=vorschlag.vorschau,darf=b.darfBearbeiten()&&!b.konflikt();
    const teile=[];
    if(v.positionen)teile.push(v.positionen+(v.positionen===1?' Position':' Positionen')+(v.offen?' ('+v.offen+' offen)':''));
    if(v.elemente)teile.push(v.elemente+(v.elemente===1?' Element':' Elemente'));
    if(v.aenderungen)teile.push(v.aenderungen+(v.aenderungen===1?' Änderung':' Änderungen'));
    if(v.entfallen)teile.push(v.entfallen+(v.entfallen===1?' Kostengruppe entfällt':' Kostengruppen entfallen'));
    let liste='',kg='',el='';
    for(const z of v.zeilen.slice(0,120)){
      if(z.kg!==kg){kg=z.kg;el='';liste+='<p class="as-kg">'+esc(b.kgName(z.kg))+'</p>'}
      if(z.element&&z.element!==el){el=z.element;liste+='<p class="as-el">'+esc(z.element)+'</p>'}
      const rechnung=z.modus==='betrag'?'pauschal':(z.menge?esc(R.zahl(z.menge,3))+' '+esc(z.einheit||'')+(z.ep?' × '+esc(preis(z.ep))+' €':''):'');
      liste+='<div class="as-pos'+(z.element?' im-el':'')+'"><span class="t">'+esc(z.titel)+(rechnung?'<small>'+rechnung+'</small>':'')+'</span>'+
        '<span class="num">'+(z.betragCent!==null?R.euro(z.betragCent,{nachkomma:true}):'<span class="chip chip-att">offen</span>')+'</span>'+
        (z.quelle?'<span class="chip chip-src" title="'+esc(z.fundstelle)+'">'+esc(quelleKurz(z.quelle))+'</span>':'<span></span>')+'</div>';
    }
    const st=b.stand();
    for(const a of vorschlag.result.vorschlag.aenderungen||[]){
      const p=(st.positionen||[]).find(x=>x.id===a.id);if(!p)continue;
      liste+='<div class="as-pos aend"><span class="t">'+esc(p.titel||b.kgName(p.kg))+'<small>'+esc({ep:'EP',betrag:'Betrag',menge:'Menge',einheit:'Einheit',quelle:'Quelle',fundstelle:'Fundstelle',titel:'Bezeichnung',gewerk:'Gewerk',ort:'Ort',notiz:'Kommentar'}[a.feld]||a.feld)+
        ' → '+esc(a.wert)+(a.grund?' · '+esc(a.grund):'')+'</small></span><span class="num meta">KG '+esc(p.kg)+'</span><span></span></div>';
    }
    for(const x of vorschlag.result.vorschlag.entfallen||[])
      liste+='<div class="as-pos aend"><span class="t">'+esc(b.kgName(x.kg))+'<small>entfällt · '+esc(x.begruendung)+'</small></span><span></span><span></span></div>';
    const dlt=v.deltaCent;
    host.innerHTML='<section class="as-karte" aria-label="Vorschlag"><p class="as-karte-kopf">Vorschlag · noch nicht übernommen</p>'+
      (v.positionen||dlt!==0n?'<p class="as-summe">'+(dlt<0n?'− ':'+ ')+R.euro(dlt<0n?-dlt:dlt,{nachkomma:true})+' <span class="meta">netto</span></p>':'')+
      '<p class="meta">'+esc(teile.join(' · ')||'Keine Änderung')+'</p>'+
      (liste?'<div class="as-liste">'+liste+'</div>':'')+
      (v.zeilen.length>120?'<p class="meta">… und '+(v.zeilen.length-120)+' weitere Positionen.</p>':'')+
      (v.weg?'<p class="meta att">'+v.weg+(v.weg===1?' Teil passt':' Teile passen')+' nicht zum aktuellen Stand und '+(v.weg===1?'wird':'werden')+' weggelassen.</p>':'')+
      '<div class="as-aktionen"><button type="button" class="btn btn-primary" data-as="uebernehmen"'+(darf?'':' disabled')+'>Prüfen und übernehmen</button>'+
      '<button type="button" class="btn" data-as="verwerfen">Verwerfen</button></div>'+
      (darf?'<p class="meta">Übernommene Positionen tragen ihre Quelle und Fundstelle. Rückgängig geht, solange du danach nichts anderes änderst.</p>':
        '<p class="meta">'+(b.konflikt()?'Erst den Speicherkonflikt lösen.':'Nur Ansicht: übernehmen kann das Projektteam.')+'</p>')+'</section>';
  }
  function zeigeAnhaenge(){
    const chips=[];
    if(tabelle)chips.push('<span class="as-chip"><span>'+esc(tabelle.name)+(tabelle.blatt?' · Blatt «'+esc(tabelle.blatt)+'»':'')+' · '+tabelle.zeilen+' Zeilen'+(tabelle.gekuerzt?', gekürzt':'')+'</span>'+
      '<button type="button" data-as="anhang-weg" data-i="t" aria-label="Anhang entfernen: '+esc(tabelle.name)+'">×</button></span>');
    anhaenge.forEach((a,i)=>chips.push('<span class="as-chip"><span>'+esc(a.name)+'</span><button type="button" data-as="anhang-weg" data-i="'+i+'" aria-label="Anhang entfernen: '+esc(a.name)+'">×</button></span>'));
    $('#asAnhaenge').innerHTML=chips.join('')+(chips.length?'<p class="meta">Bleibt angehängt, bis du es entfernst; so geht «weiter» mit derselben Datei.</p>':'');
  }
  function zeigeBezug(){
    $('#asBezug').innerHTML=bezug?'<span class="as-chip bezug"><span>Bezug: '+esc(bezug.text)+'</span><button type="button" data-as="bezug-weg" aria-label="Bezug entfernen">×</button></span>':'';
  }
  function zeigeEingabe(){
    $('#asSenden').disabled=schreibt||!bereit;
    $('[data-as="datei"]').disabled=schreibt||!bereit;
    aside.querySelectorAll('.as-start').forEach(x=>{x.disabled=schreibt||!bereit});
    text.placeholder=bereit?'Nachricht an den Assistenten':geprueft?'Der Assistent ist zurzeit nicht verfügbar':'Nachricht an den Assistenten';
  }
  function hoehe(){text.style.height='auto';text.style.height=Math.min(160,Math.max(40,text.scrollHeight))+'px'}

  // ---------- Dateien ----------
  function mimeVon(f){const m=String(f.type||'').toLowerCase();if(Object.values(MIME).includes(m))return m;return MIME[String(f.name||'').split('.').pop().toLowerCase()]||''}
  const alsDataUrl=f=>new Promise((ok,bad)=>{const r=new FileReader();r.onload=()=>typeof r.result==='string'?ok(r.result):bad(Error('Datei nicht lesbar'));r.onerror=()=>bad(Error('Datei nicht lesbar'));r.readAsDataURL(f)});
  async function nimmDateien(liste){
    for(const f of liste){
      const name=String(f.name||'Datei').slice(0,180).replace(/[\\/]/g,'_');
      try{
        if(/\.(xlsx|csv|tsv|txt)$/i.test(name)){
          let zeilen,blatt='';
          if(/\.xlsx$/i.test(name)){
            const blaetter=I.leseXlsxBlaetter?await I.leseXlsxBlaetter(await f.arrayBuffer()):[{name:'',zeilen:await I.leseDatei(f)}];
            const best=bestesBlatt(blaetter);zeilen=best?.zeilen||[];blatt=blaetter.length>1?best?.name||'':'';
          }else zeilen=I.leseCsv(await f.text());
          const t=tabelleText(zeilen);
          if(!t.zeilen)throw Error('Die Tabelle ist leer.');
          tabelle={name,blatt,text:t.text,zeilen:t.zeilen,gekuerzt:t.gekuerzt};
        }else if(/\.xls$/i.test(name)){throw Error('Bitte die Mappe als .xlsx oder CSV speichern.')}
        else{
          const mime=mimeVon(f);
          if(!mime)throw Error('Nur PDF, Fotos (JPEG, PNG, WebP), Excel (.xlsx) oder CSV.');
          if(anhaenge.length>=3)throw Error('Höchstens drei PDFs oder Fotos auf einmal.');
          if(f.size>MAX_DATEI||anhaenge.reduce((s,a)=>s+a.size,0)+f.size>MAX_GESAMT)throw Error('Zu groß: höchstens 8 MB je Datei und 12 MB zusammen.');
          anhaenge.push({name,mime,size:f.size,data:await alsDataUrl(f)});
        }
      }catch(e){merke({role:'assistant',kind:'warning',body:name+': '+(e?.message||'Datei nicht lesbar.')})}
    }
    zeigeAnhaenge();
    if(startArt&&(tabelle||anhaenge.length)&&!text.value.trim()){
      text.value=startArt==='excel'?'Übernimm die Positionen aus dem Büro-Excel: Kostengruppen, Elemente, Mengen, Einheiten, Einheitspreise und Kommentare, mit der Zeile als Fundstelle.':
        'Werte das Angebot oder den Kostenbeitrag aus und schlage Positionen mit Menge, Einheit, Einheitspreis und Fundstelle vor.';
      hoehe();
    }
    startArt='';text.focus();
  }

  // ---------- Senden ----------
  const FEHLER={daily_ai_limit_reached:'Für heute sind die 25 Anfragen aufgebraucht. Morgen geht es weiter.',
    revision_changed:'Die Kostenberechnung wurde inzwischen geändert. Bitte die Seite neu laden und noch einmal fragen.',
    ai_timeout_or_network:'Die Anfrage hat zu lange gedauert. Mit weniger oder kleineren Anhängen geht es schneller; bei langen Tabellen mit «weiter» fortsetzen.',
    invalid_attachments:'Ein Anhang ist nicht lesbar (PDF, JPEG, PNG oder WebP, höchstens 8 MB).',invalid_table:'Die Tabelle ist nicht lesbar oder zu lang.',
    kostenberechnung_not_accessible:'Diese Kostenberechnung ist für dich nicht freigegeben.',ai_not_configured:'Der Assistent ist im Office noch nicht eingerichtet.',
    kostenberechnung_context_unavailable:'Die Kostenberechnung ist zu groß für eine Anfrage.'};
  async function senden(){
    if(schreibt||!bereit)return;
    const eingabe=text.value.trim();
    const nachricht=eingabe||(tabelle||anhaenge.length?'Bitte werte die Anhänge aus und schlage Positionen mit Fundstelle vor.':'');
    if(nachricht.length<2)return;
    const namen=[...(tabelle?[tabelle.name]:[]),...anhaenge.map(a=>a.name)];
    text.value='';hoehe();vorschlag=null;schreibt=true;zeigeEingabe();
    merke({role:'user',kind:'question',body:nachricht+(namen.length?'\nAnhänge: '+namen.join(' · '):'')});
    try{
      await b.speichernJetzt();
      if(b.konflikt()){merke({role:'assistant',kind:'warning',body:'Erst den Speicherkonflikt lösen (oben), dann noch einmal fragen. Es wurde nichts geändert.'});return}
      const {data,error}=await sb.functions.invoke(FUNKTION,{body:{action:'frage',instance_id:b.doc().id,expected_revision:b.revision(),
        message:nachricht.slice(0,2000),auswahl:bezug?{kg:bezug.kg,position:bezug.position||''}:{},
        tabelle:tabelle?{name:tabelle.name,text:tabelle.text}:null,attachments:anhaenge.map(({name,mime,size,data})=>({name,mime,size,data}))}});
      if(error||!data||data.error){
        let grund=data?.error||'';
        if(!grund&&error?.context){try{const r=error.context.clone?error.context.clone():error.context;const j=await r.json();grund=typeof j?.error==='string'?j.error:''}catch{}}
        merke({role:'assistant',kind:'warning',body:(FEHLER[grund]||'Die Anfrage konnte nicht abgeschlossen werden ('+(grund||'nicht erreichbar')+').')+' Es wurde nichts geändert.'});
        return;
      }
      const r=data.result;
      if(data.version!==VERSION||data.authority!=='none'||!r||typeof r.text!=='string'){merke({role:'assistant',kind:'warning',body:'Die Antwort ist nicht prüfbar. Es wurde nichts geändert.'});return}
      let v=null;
      if(r.vorschlag){try{v=vorschau(r.vorschlag,b.stand(),R)}catch(e){console.warn('Assistent: Vorschau',e)}}
      const brauchbar=v&&(v.positionen||v.elemente||v.aenderungen||v.entfallen);
      merke({role:'assistant',kind:brauchbar?'proposal':'answer',body:r.text,hinweise:r.hinweise||[],fragen:r.fragen||[]});
      if(brauchbar)vorschlag={result:r,vorschau:v};
    }catch(e){
      console.error('Assistent',e);
      merke({role:'assistant',kind:'warning',body:'Die Anfrage konnte nicht abgeschlossen werden. Es wurde nichts geändert.'});
    }finally{schreibt=false;zeigeEingabe();zeigeVerlauf()}
  }
  function uebernehmen(){
    if(!vorschlag||!b.darfBearbeiten()||b.konflikt())return;
    const vorher=JSON.stringify(b.stand());
    let n=0;const r=wendeAn(b.stand(),vorschlag.result.vorschlag,R,{neueId:p=>b.neueId(p)+(n++).toString(36),heute:b.heute()});
    vorschlag=null;
    if(!r.positionen&&!r.elemente&&!r.aenderungen&&!r.entfallen){merke({role:'assistant',kind:'warning',body:'Nichts davon passt noch zum aktuellen Stand. Es wurde nichts geändert.'});return}
    b.geaendert();b.zeige([...r.neu,...r.geaendert],r.kgs[0]||'');
    const summe=R.berechne(b.stand()).gesamt.bekanntCent;
    const teile=[];
    if(r.positionen)teile.push(r.positionen+(r.positionen===1?' Position':' Positionen'));
    if(r.elemente)teile.push(r.elemente+(r.elemente===1?' Element':' Elemente'));
    if(r.aenderungen)teile.push(r.aenderungen+(r.aenderungen===1?' Änderung':' Änderungen'));
    if(r.entfallen)teile.push(r.entfallen+(r.entfallen===1?' Kostengruppe entfällt':' Kostengruppen entfallen'));
    const id='u'+Date.now().toString(36);
    rueckgaengig={id,vorher,nachher:JSON.stringify(b.stand())};
    merke({role:'assistant',kind:'receipt',undo:id,body:'Übernommen: '+teile.join(', ')+'. Summe jetzt '+R.euro(summe,{nachkomma:true})+' netto'+(r.weg?'; '+r.weg+' nicht mehr passende Teile weggelassen':'')+'.'});
  }
  function rueckgaengigMachen(){
    if(!rueckgaengig||!unveraendert()||!b.darfBearbeiten())return;
    b.setzeStand(JSON.parse(rueckgaengig.vorher));rueckgaengig=null;
    b.geaendert();b.zeige([], '');
    merke({role:'assistant',kind:'receipt',body:'Rückgängig gemacht: die Kostenberechnung steht wieder wie vor der Übernahme.'});
  }
  const STARTS={fehlt:'Was fehlt noch, damit die Kostenberechnung vollständig ist? Bitte nach Wichtigkeit.',
    vergleich:'Erkläre die Abweichungen zur Kostenschätzung je Kostengruppe und was sie verursacht.',
    elemente:kg=>'Schlage für KG '+kg+' Elemente mit ihren Positionen vor, wie im Büro-Excel, ohne Preise, wenn keine Quelle vorliegt.'};
  function start(art){
    if(art==='excel'||art==='angebot'){startArt=art;$('#asDatei').click();return}
    if(art==='elemente'){
      const kg=bezug?.kg&&R.ebene(bezug.kg)===3?bezug.kg:'';
      if(!kg){merke({role:'assistant',kind:'warning',body:'Wähle zuerst in der Tabelle eine Kostengruppe der 3. Ebene, etwa 335; dann schlage ich Elemente dafür vor.'});return}
      text.value=STARTS.elemente(kg);
    }else text.value=STARTS[art]||'';
    hoehe();void senden();
  }

  // ---------- Öffnen, Schließen, Abgleich mit der Seite ----------
  function auswahlMerken(){
    const a=b.auswahl();if(!a?.kg)return;
    bezug={kg:a.kg,position:a.position||'',text:a.position?'Position «'+(a.titel||b.kgName(a.kg))+'»':b.kgName(a.kg)};
  }
  function umschalten(){
    offen=!offen;
    if(offen){auswahlMerken();b.schliesseDetails();void pruefeStatus();void ladeVerlauf()}
    b.render();
    if(offen)setTimeout(()=>text.focus(),0);
  }
  function sync(){
    const details=!!b.root.querySelector('.inspektor:not(.assistent)');
    if(details)auswahlMerken();
    const sichtbar=offen&&!details&&!!b.doc()?.id;
    aside.hidden=!sichtbar;
    b.root.classList.toggle('mit-inspektor',details&&b.tabPositionen()||sichtbar);
    if(sichtbar){zeigeBezug();zeigeAnhaenge();zeigeEingabe();zeigeVorschlag();
      const u=$('.as-undo');if(u&&!unveraendert())zeigeVerlauf();}
  }
  aside.addEventListener('click',ev=>{
    const el=ev.target.closest('[data-as]');if(!el)return;
    const a=el.dataset.as;
    if(a==='zu'){offen=false;b.render();return}
    if(a==='datei'){startArt='';$('#asDatei').click();return}
    if(a==='start'){start(el.dataset.start);return}
    if(a==='anhang-weg'){if(el.dataset.i==='t')tabelle=null;else anhaenge.splice(Number(el.dataset.i),1);zeigeAnhaenge();return}
    if(a==='bezug-weg'){bezug=null;zeigeBezug();return}
    if(a==='uebernehmen'){uebernehmen();return}
    if(a==='verwerfen'){vorschlag=null;merke({role:'assistant',kind:'answer',body:'Vorschlag verworfen. Es wurde nichts geändert.'});return}
    if(a==='rueckgaengig'){rueckgaengigMachen();return}
  });
  $('#asForm').addEventListener('submit',ev=>{ev.preventDefault();void senden()});
  $('#asDatei').addEventListener('change',ev=>{const f=[...(ev.target.files||[])];ev.target.value='';if(f.length)void nimmDateien(f);else startArt=''});
  text.addEventListener('input',hoehe);
  text.addEventListener('keydown',ev=>{
    const tippen=root.matchMedia?.('(pointer: coarse)')?.matches;
    if(ev.key==='Enter'&&!ev.shiftKey&&!ev.isComposing&&!tippen){ev.preventDefault();void senden()}
  });
  aside.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!ev.isComposing){ev.preventDefault();offen=false;b.render()}});
  aside.addEventListener('dragover',ev=>{if(bereit&&ev.dataTransfer?.types?.includes('Files')){ev.preventDefault();aside.classList.add('ziel')}});
  aside.addEventListener('dragleave',ev=>{if(ev.target===aside)aside.classList.remove('ziel')});
  aside.addEventListener('drop',ev=>{aside.classList.remove('ziel');if(!bereit||!ev.dataTransfer?.files?.length)return;ev.preventDefault();void nimmDateien([...ev.dataTransfer.files])});
  return {offen:()=>offen,umschalten,sync};
}

return Object.freeze({VERSION,tabelleText,bestesBlatt,pruefeVorschlag,alsPosition,wendeAn,vorschau,init});
});
