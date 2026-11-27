// TBA Office · Abschnitte des Projekts in der Seitenleiste (B2, 27.11.2026; Entwurf von Gari freigegeben: «con la barra
// reducida a iconos»). Am Desktop stehen Projektwahl und Abschnitte (Panorama, Planner, Terminplan …) unter «Work» in
// den Ansichten; die Reiterzeile und die Projektzeile oben entfallen, das Werkzeug bekommt den Platz. Auf Symbole
// reduziert bleiben Projektkürzel und Symbole der Abschnitte. Die Logik bleibt in work.js: diese Datei spiegelt die
// Reiter und die Projektwahl und klickt sie an; ändert work.js etwas, zeichnet sie neu (MutationObserver).
(()=>{
  'use strict';
  const lenses=document.getElementById('desktopLenses');
  const workItem=lenses&&lenses.querySelector('.lens-nav-item[data-nav="work"]');
  if(!lenses||!workItem)return;
  const svg=p=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+p+'</svg>';
  const NAV=typeof NAV_ICONS!=='undefined'?NAV_ICONS:{};
  const ICONS={
    overview:svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>'),
    knowledge:svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
    desktop:svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'),
    planner:svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v7M12 7v4M16 7v9"/>'),
    terminplan:svg('<path d="M3 3v18h18"/><path d="M7 8h6M10 12h7M8 16h5"/>'),
    kosten:NAV.kosten,controlling:NAV.controlling,mustermappe:NAV.mappe,produkte:NAV.produkte,hersteller:NAV.hersteller,
    threads:svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')
  };
  const PLUS=svg('<path d="M12 5v14M5 12h14"/>'),PFEIL=svg('<path d="m6 9 6 6 6-6"/>');
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Kürzel für die schmale Leiste: Anfangsbuchstaben der ersten zwei großgeschriebenen Wörter («Wohnhaus am Lindenweg»
  // → WL), sonst der ersten zwei Wörter, bei einem Wort dessen erste zwei Buchstaben.
  function kuerzel(name){
    const woerter=String(name||'').split(/[\s·\-–]+/).filter(w=>/\p{L}/u.test(w));
    const gross=woerter.filter(w=>/^\p{Lu}/u.test(w)),wahl=gross.length>1?gross:woerter;
    const k=wahl.length>1?wahl[0].match(/\p{L}/u)[0]+wahl[1].match(/\p{L}/u)[0]:(wahl[0]||'').replace(/[^\p{L}\p{N}]/gu,'').slice(0,2);
    return k.toLocaleUpperCase('de-DE')||'·';
  }
  const box=document.createElement('div');
  box.id='lensWork';box.className='lens-work';box.hidden=true;
  workItem.after(box);

  const tabs=()=>[...document.querySelectorAll('.work-tabs [data-work-view]')];
  const plus=()=>document.querySelector('.work-tabs [data-work-abschnitte]');
  const projekte=()=>[...document.querySelectorAll('.work-project-switch [data-work-project]')];
  function lage(){
    const sichtbar=tabs().filter(b=>!b.hidden);
    const alle=projekte(),aktiv=alle.find(b=>b.classList.contains('active'));
    const name=(aktiv&&aktiv.textContent.trim())||document.getElementById('workProjectTitle')?.textContent.trim()||'Work';
    return {sichtbar,alle,name,titel:aktiv?.getAttribute('title')||name,plus:!!plus()&&!plus().hidden};
  }
  let menue=null;
  function schliesseMenue(){if(!menue)return;menue.remove();menue=null;box.querySelector('.lens-work-projekt')?.setAttribute('aria-expanded','false');
    document.removeEventListener('pointerdown',aussen,true);document.removeEventListener('keydown',taste,true)}
  function aussen(e){if(!e.target.closest?.('.lens-work-menue,.lens-work-projekt'))schliesseMenue()}
  function taste(e){if(e.key==='Escape'){schliesseMenue();box.querySelector('.lens-work-projekt')?.focus()}}
  function oeffneMenue(knopf){
    if(menue){schliesseMenue();return}
    const {alle}=lage();
    menue=document.createElement('div');
    menue.className='lens-work-menue';menue.setAttribute('role','menu');menue.setAttribute('aria-label','Projekt wählen');
    menue.innerHTML=alle.map(b=>`<button type="button" role="menuitemradio" aria-checked="${b.classList.contains('active')}" data-lens-project="${esc(b.dataset.workProject)}"><span class="lens-work-chip" aria-hidden="true">${esc(kuerzel(b.textContent))}</span><span>${esc(b.getAttribute('title')||b.textContent)}</span></button>`).join('')||'<p>Keine Projekte.</p>';
    document.body.append(menue);
    const r=knopf.getBoundingClientRect();
    menue.style.left=Math.min(r.right+8,window.innerWidth-menue.offsetWidth-8)+'px';
    menue.style.top=Math.max(8,Math.min(r.top,window.innerHeight-menue.offsetHeight-8))+'px';
    knopf.setAttribute('aria-expanded','true');
    menue.addEventListener('click',e=>{
      const p=e.target.closest('[data-lens-project]');if(!p)return;
      schliesseMenue();
      document.querySelector('.work-project-switch [data-work-project="'+CSS.escape(p.dataset.lensProject)+'"]')?.click();
    });
    document.addEventListener('pointerdown',aussen,true);document.addEventListener('keydown',taste,true);
    menue.querySelector('[aria-checked="true"]')?.focus()||menue.querySelector('button')?.focus();
  }

  let geplant=false;
  function zeichne(){
    geplant=false;
    const {sichtbar,alle,name,titel,plus:mitPlus}=lage();
    const an=sichtbar.length>0;
    box.hidden=!an;
    document.body.classList.toggle('lens-work-an',an);
    if(!an){schliesseMenue();return}
    box.innerHTML=`<button type="button" class="lens-work-projekt" aria-haspopup="menu" aria-expanded="${menue?'true':'false'}" title="${esc(alle.length>1?'Projekt wechseln · '+titel:titel)}" ${alle.length?'':'disabled'}>
        <span class="lens-work-chip" aria-hidden="true">${esc(kuerzel(name))}</span><span class="lens-work-name">${esc(name)}</span>${alle.length>1?'<span class="lens-work-pfeil">'+PFEIL+'</span>':''}</button>
      <div class="lens-work-liste" role="tablist" aria-label="Abschnitte des Projekts">${sichtbar.map(b=>{
        const v=b.dataset.workView,label=b.textContent.trim(),aktiv=b.classList.contains('active');
        return `<button type="button" role="tab" aria-selected="${aktiv}" class="lens-work-abschnitt${aktiv?' active':''}" data-lens-view="${esc(v)}" title="${esc(label)}"><span class="lens-work-icon">${ICONS[v]||ICONS.overview}</span><span class="lens-work-label">${esc(label)}</span></button>`}).join('')}
        ${mitPlus?`<button type="button" class="lens-work-plus" data-lens-plus aria-haspopup="dialog" title="Abschnitt hinzufügen" aria-label="Abschnitt hinzufügen"><span class="lens-work-icon">${PLUS}</span><span class="lens-work-label">Abschnitt</span></button>`:''}
      </div>`;
  }
  function planen(){if(geplant)return;geplant=true;requestAnimationFrame(zeichne)}
  box.addEventListener('click',e=>{
    const v=e.target.closest('[data-lens-view]');
    if(v){document.querySelector('.work-tabs [data-work-view="'+CSS.escape(v.dataset.lensView)+'"]')?.click();return}
    const p=e.target.closest('[data-lens-plus]');
    if(p){window.TBA_WORK_ABSCHNITTE?.oeffnen?.(p);return}
    const projekt=e.target.closest('.lens-work-projekt');
    if(projekt&&lage().alle.length>1)oeffneMenue(projekt);
  });
  const beobachter=new MutationObserver(planen);
  const beobachte=()=>{
    for(const el of [document.querySelector('.work-tabs'),document.querySelector('.work-project-switch'),document.getElementById('workProjectTitle')])
      if(el)beobachter.observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden','title']});
  };
  beobachte();planen();
  window.TBA_WORK_LENS={zeichne,kuerzel};
})();
