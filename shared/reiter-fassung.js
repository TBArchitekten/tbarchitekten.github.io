// TBA Office · Die Fassung in der Werkzeugzeile (B2, 27.11.2026; Entwurf von Gari freigegeben). Ist in Work die Leiste
// auf Symbole reduziert, steht die Wahl der Fassung (Terminplan LPH 3 / LPH 5, Kostenberechnung, Mappe) wie im Entwurf
// am Anfang der Werkzeugzeile als «Name ▾», statt in einer eigenen Zeile über dem Werkzeug. Liste und Wahl gehören Work
// (window.parent.TBA_WORK_FASSUNG, gleiche Herkunft): die Seite zeigt nur an und meldet, ob sie einen Ort dafür hat
// (ein Element mit data-reiter-fassung in der Werkzeugzeile). Ohne Ort bleibt die Zeile über dem Werkzeug.
(function(){
  'use strict';
  if(window.self===window.top)return;
  let work=null;
  try{work=window.parent.TBA_WORK_FASSUNG||null}catch{}
  if(!work)return;
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PFEIL='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';
  let lage={zeigen:false},menue=null,offenVon=null;

  function schliessen({fokus=false}={}){
    if(!menue)return;
    menue.remove();menue=null;
    if(offenVon){offenVon.setAttribute('aria-expanded','false');if(fokus)offenVon.focus()}
    offenVon=null;
  }
  function oeffnen(knopf){
    if(menue){const war=offenVon;schliessen();if(war===knopf)return}
    menue=document.createElement('div');
    menue.className='wz-fassung-menue';menue.setAttribute('role','group');menue.setAttribute('aria-label',lage.titel||'Fassung wählen');
    menue.innerHTML=lage.liste.map(x=>'<button type="button" data-fassung-id="'+esc(x.id)+'" aria-pressed="'+(x.aktiv?'true':'false')+'">'+esc(x.text)+'</button>').join('')+
      (lage.neu?'<button type="button" class="wz-fassung-neu" data-fassung-neu>+ '+esc(lage.neu)+'</button>':'');
    document.body.append(menue);
    offenVon=knopf;knopf.setAttribute('aria-expanded','true');
    const r=knopf.getBoundingClientRect();
    menue.style.top=Math.round(r.bottom+6)+'px';
    menue.style.left=Math.round(Math.max(8,Math.min(r.left,window.innerWidth-menue.offsetWidth-8)))+'px';
    (menue.querySelector('[aria-pressed="true"]')||menue.querySelector('button'))?.focus();
  }
  // Orte füllen: «Name ▾» mit der gewählten Fassung; nichts, wenn Work die Wahl nicht hier haben will.
  function fuellen(){
    const orte=[...document.querySelectorAll('[data-reiter-fassung]')];
    try{work.ort(window,orte.length>0)}catch{}
    try{lage=orte.length?work.lage(window)||{zeigen:false}:{zeigen:false}}catch{lage={zeigen:false}}
    const aktiv=lage.zeigen?lage.liste.find(x=>x.aktiv)||lage.liste[0]:null;
    const html=lage.zeigen?'<button type="button" class="wz-fassung" aria-haspopup="true" aria-expanded="false" title="'+esc(lage.titel)+'">'+
      '<span>'+esc(aktiv?aktiv.text:lage.titel)+'</span>'+PFEIL+'</button>':'';
    for(const ort of orte){
      ort.hidden=!html;
      if(ort.dataset.fassungHtml===html)continue;
      ort.dataset.fassungHtml=html;ort.innerHTML=html;
    }
    if(!lage.zeigen)schliessen();
  }
  let geplant=false;
  const planen=()=>{if(geplant)return;geplant=true;requestAnimationFrame(()=>{geplant=false;fuellen()})};

  document.addEventListener('click',e=>{
    const knopf=e.target.closest?.('.wz-fassung');
    if(knopf){oeffnen(knopf);return}
    const wahl=e.target.closest?.('.wz-fassung-menue [data-fassung-id]');
    if(wahl){const id=wahl.dataset.fassungId,aktiv=wahl.getAttribute('aria-pressed')==='true';schliessen();if(!aktiv)work.waehlen(window,id);return}
    if(e.target.closest?.('.wz-fassung-menue [data-fassung-neu]')){schliessen();work.anlegen(window)}
  });
  document.addEventListener('pointerdown',e=>{if(menue&&!e.target.closest?.('.wz-fassung-menue,.wz-fassung'))schliessen()},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menue){e.preventDefault();schliessen({fokus:true})}},true);
  window.addEventListener('resize',()=>schliessen());
  // Work meldet, wenn sich die Leiste oder die Fassungen ändern; die Seite, wenn ein Ort neu gezeichnet wird.
  window.addEventListener('tba-work-fassung',planen);
  const start=()=>{new MutationObserver(planen).observe(document.body,{childList:true,subtree:true});planen()};
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
