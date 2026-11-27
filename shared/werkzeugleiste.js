// TBA Office · Eine Werkzeugzeile je Reiter (B2, 27.11.2026; Entwurf von Gari freigegeben). Im Reiter von Work
// (html.im-reiter) bleibt die Leiste einer Werkzeugseite eine Zeile: seltene Befehle kommen unter «•••», Stand und
// Speichern rücken an das Ende der Leiste, die Statuszeile wird zur knappen Info in derselben Zeile. Die Elemente
// werden verschoben, nicht kopiert: Ihre Funktion, ihre Kennungen und ihre Ereignisse bleiben dieselben. Was eine
// Seite später einfügt (z. B. die Auswertung des Terminplans), wandert nach, sobald es auftaucht. Die Anleitung
// (Option «hilfe») steht als «?» am Ende der Zeile, wie in den anderen Werkzeugen: Erklärungen hinter «?».
(function(){
  'use strict';
  const IM_REITER=document.documentElement.classList.contains('im-reiter');
  function einreihen(o){
    const leiste=o&&o.leiste;
    if(!IM_REITER||!leiste||leiste.querySelector(':scope > .wz-mehr'))return null;
    const selten=Array.isArray(o.selten)?o.selten:[],titel=o.titel||'Weitere Befehle';
    document.documentElement.classList.add('wz-eine-zeile');
    // Knappe Info (Statuszeile) und Stand/Speichern am Ende der Leiste.
    let info=null;
    if(o.info){info=document.querySelector(o.info);if(info){info.classList.add('wz-info');leiste.append(info)}}
    const status=document.createElement('span');status.className='wz-status';
    for(const sel of o.status||[])document.querySelectorAll(sel).forEach(el=>status.append(el));
    if(status.childNodes.length)leiste.append(status);
    const knopf=document.createElement('button');
    knopf.type='button';knopf.className='wz-mehr';knopf.textContent='•••';knopf.title=titel;
    knopf.setAttribute('aria-label',titel);knopf.setAttribute('aria-haspopup','true');knopf.setAttribute('aria-expanded','false');
    leiste.append(knopf);
    const menue=document.createElement('div');
    menue.className='wz-menue';menue.hidden=true;menue.setAttribute('role','group');menue.setAttribute('aria-label',titel);
    document.body.append(menue);
    // In der Reihenfolge der Liste, damit das Menü geordnet bleibt, auch wenn Teile später kommen.
    const verschiebe=()=>{
      // Zuerst die Anleitung: aus ihrer Gruppe heraus vor «•••», als «?» mit ihrem Namen als Beschriftung.
      const hilfe=o.hilfe?document.querySelector(o.hilfe):null;
      if(hilfe&&!hilfe.classList.contains('wz-hilfe')){
        const name=hilfe.textContent.trim()||'Anleitung';
        hilfe.classList.add('wz-hilfe');hilfe.setAttribute('aria-label',name);hilfe.title=name;hilfe.textContent='?';
      }
      if(hilfe&&hilfe.nextElementSibling!==knopf)leiste.insertBefore(hilfe,knopf);
      selten.forEach((sel,i)=>document.querySelectorAll(sel).forEach(el=>{
        if(menue.contains(el)||el===knopf||el.contains(menue))return;
        el.dataset.wzRang=String(i);
        const nach=[...menue.children].find(c=>Number(c.dataset.wzRang)>i);
        menue.insertBefore(el,nach||null);
      }));
      knopf.hidden=!menue.children.length;
      if(info)info.title=info.textContent.replace(/\s+/g,' ').trim();
    };
    verschiebe();
    const beobachter=new MutationObserver(verschiebe);
    beobachter.observe(leiste,{childList:true,subtree:true,characterData:true});
    for(const sel of o.beobachten||[])document.querySelectorAll(sel).forEach(el=>beobachter.observe(el,{childList:true,subtree:true}));
    const schliessen=()=>{if(menue.hidden)return;menue.hidden=true;knopf.setAttribute('aria-expanded','false')};
    const lage=()=>{
      const r=knopf.getBoundingClientRect();
      menue.style.top=Math.round(r.bottom+6)+'px';
      menue.style.left=Math.round(Math.max(8,Math.min(r.right-menue.offsetWidth,window.innerWidth-menue.offsetWidth-8)))+'px';
    };
    knopf.addEventListener('click',()=>{
      if(!menue.hidden){schliessen();return}
      menue.hidden=false;knopf.setAttribute('aria-expanded','true');lage();
      menue.querySelector('button,select,input,a[href]')?.focus();
    });
    // Ein Klick auf einen Befehl schließt das Menü; Auswahlfelder und Schalter lassen es offen.
    menue.addEventListener('click',e=>{const b=e.target.closest('button,a[href]');if(b&&!b.closest('label'))schliessen()});
    document.addEventListener('pointerdown',e=>{if(!menue.hidden&&!e.target.closest('.wz-menue,.wz-mehr'))schliessen()},true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menue.hidden){schliessen();knopf.focus()}},true);
    window.addEventListener('resize',schliessen);
    return {menue,knopf,verschiebe};
  }
  window.TBA_WERKZEUGLEISTE={einreihen};
})();
