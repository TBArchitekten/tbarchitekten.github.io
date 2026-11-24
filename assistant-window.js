/* TBA Office · Fenster der Assistenten (24.11.2026; Gari: «sí a una sola apariencia para los dos y los que vengan …
   debería de poder moverse también y no estar siempre estable en la esquina»).
   Ein Fenster für jeden Assistenten des Office, im Stil des Terminplans (assistant-surface.css): zu ein kleiner Reiter,
   offen ein schwebendes Fenster, das sich vergrößern lässt. In beiden Zuständen lässt es sich am Kopf verschieben, offen
   an der freien Ecke in der Größe ändern. Gemerkt wird je Werkzeug und Gerät die nächste Bildschirmecke mit Abstand:
   so öffnet das Fenster von seinem Reiter aus zur Bildschirmmitte hin und schließt wieder in den Reiter. Am Telefon
   (bis 600 px) bleibt es unten über die ganze Breite und wird nicht verschoben. Inhalt und Gespräch gehören der Seite
   (terminplan.html, kosten-assistent.js); dieses Modul kümmert sich nur um das Fenster. */
(function(root){
'use strict';
const RAND=8,SCHWELLE=4,MIN={w:340,h:360},STANDARD={w:470,h:680},WEIT=790;
const SPEICHER='office-assistant-window-v2:';
const grenze=(wert,min,max)=>Math.max(min,Math.min(max,wert));
const schmal=()=>!!root.matchMedia?.('(max-width:600px)').matches;

function liesLage(key){
  try{
    const l=JSON.parse(root.localStorage.getItem(SPEICHER+key)||'null');
    if(l&&/^[lr][ou]$/.test(l.ecke)&&Number.isFinite(l.x)&&Number.isFinite(l.y))
      return {ecke:l.ecke,x:l.x,y:l.y,w:Number(l.w)||null,h:Number(l.h)||null};
  }catch{}
  return null;
}
// Lage aus einem Rechteck: die nächste Ecke des Bildschirms und der Abstand zu ihr.
function ausRechteck(left,top,w,h){
  const rechts=left+w/2>root.innerWidth/2,unten=top+h/2>root.innerHeight/2;
  return {ecke:(rechts?'r':'l')+(unten?'u':'o'),x:Math.round(rechts?root.innerWidth-left-w:left),y:Math.round(unten?root.innerHeight-top-h:top)};
}

function mount(panel,{key,toggle,close=null,wide=null,body=null,titel='',isPopout=false,onToggle=()=>{},onClose=()=>{}}={}){
  if(!panel||!key)return null;
  const head=panel.querySelector('.assistant-head');
  const griff=root.document.createElement('span');
  griff.className='assistant-resize';griff.setAttribute('aria-hidden','true');
  panel.append(griff);
  let offen=false,weit=false,lage=liesLage(key),zug=null,geschoben=false;
  const speichern=()=>{try{if(lage)root.localStorage.setItem(SPEICHER+key,JSON.stringify(lage))}catch{}};

  // Größe im jeweiligen Zustand: zu der Reiter (aus dem CSS), offen die gemerkte oder die Standardgröße.
  function groesse(){
    if(!offen){const r=panel.getBoundingClientRect();return {w:r.width,h:r.height}}
    const maxW=root.innerWidth-2*RAND,maxH=root.innerHeight-2*RAND;
    const breite=weit?Math.max(WEIT,lage?.w||STANDARD.w):(lage?.w||STANDARD.w);
    return {w:grenze(breite,Math.min(MIN.w,maxW),maxW),h:grenze(lage?.h||STANDARD.h,Math.min(MIN.h,maxH),maxH)};
  }
  function anwenden(){
    panel.dataset.ecke=lage?.ecke||'ru';
    const frei=!isPopout&&!schmal()&&!!lage;
    panel.classList.toggle('is-placed',frei);
    if(!frei){for(const p of ['--assistant-x','--assistant-y','--assistant-w','--assistant-h'])panel.style.removeProperty(p);return}
    if(!offen){panel.style.removeProperty('--assistant-w');panel.style.removeProperty('--assistant-h')}
    const {w,h}=groesse();
    if(offen){panel.style.setProperty('--assistant-w',w+'px');panel.style.setProperty('--assistant-h',h+'px')}
    // Der Abstand zur Ecke bleibt so, dass das ganze Fenster sichtbar ist.
    panel.style.setProperty('--assistant-x',grenze(lage.x,RAND,Math.max(RAND,root.innerWidth-w-RAND))+'px');
    panel.style.setProperty('--assistant-y',grenze(lage.y,RAND,Math.max(RAND,root.innerHeight-h-RAND))+'px');
  }
  function zeige(neu){
    offen=!!neu;
    panel.classList.toggle('is-open',offen);
    panel.classList.toggle('is-wide',offen&&weit);
    if(body)body.hidden=!offen;
    if(toggle){
      toggle.setAttribute('aria-expanded',String(offen));
      if(titel){const t=toggle.firstChild;const text=(offen?'▾ ':'▸ ')+titel+' ';if(t?.nodeType===3)t.textContent=text;else toggle.prepend(text)}
    }
    if(wide){
      wide.textContent=weit?'⤡':'⤢';
      wide.setAttribute('aria-label',weit?'Fenster verkleinern':'Fenster vergrößern');wide.title=weit?'Fenster verkleinern':'Fenster vergrößern';
    }
    anwenden();
  }

  // Verschieben am Kopf, offen wie zu. Erst ab einigen Pixeln: ein Klick auf den Reiter öffnet weiterhin.
  head?.addEventListener('pointerdown',e=>{
    geschoben=false;
    if(isPopout||schmal()||e.button!==0||e.target.closest('.assistant-window-action'))return;
    const r=panel.getBoundingClientRect();
    zug={art:'ziehen',id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,w:r.width,h:r.height,aktiv:false};
  });
  // Größe an der freien Ecke (gegenüber der gemerkten Ecke): die gemerkte Ecke bleibt stehen.
  griff.addEventListener('pointerdown',e=>{
    if(isPopout||schmal()||!offen||e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    // Die Lage von dort, wo das Fenster gerade steht (auch wenn es zum Öffnen etwas einrücken musste), zur selben Ecke.
    const r=panel.getBoundingClientRect(),ecke=lage?.ecke||'ru';
    lage={ecke,x:Math.round(ecke[0]==='r'?root.innerWidth-r.right:r.left),y:Math.round(ecke[1]==='u'?root.innerHeight-r.bottom:r.top),
      w:Math.round(r.width),h:Math.round(r.height)};
    zug={art:'groesse',id:e.pointerId,x:e.clientX,y:e.clientY,w:r.width,h:r.height,aktiv:true};
    panel.classList.add('is-dragging');
  });
  root.document.addEventListener('pointermove',e=>{
    if(!zug||e.pointerId!==zug.id)return;
    const dx=e.clientX-zug.x,dy=e.clientY-zug.y;
    if(!zug.aktiv){if(Math.hypot(dx,dy)<SCHWELLE)return;zug.aktiv=true;panel.classList.add('is-dragging')}
    e.preventDefault();
    if(zug.art==='ziehen'){
      const left=grenze(zug.left+dx,RAND,Math.max(RAND,root.innerWidth-zug.w-RAND));
      const top=grenze(zug.top+dy,RAND,Math.max(RAND,root.innerHeight-zug.h-RAND));
      lage={...ausRechteck(left,top,zug.w,zug.h),w:lage?.w||null,h:lage?.h||null};
    }else{
      const rechts=lage.ecke[0]==='r',unten=lage.ecke[1]==='u';
      weit=false;
      lage={...lage,w:Math.round(Math.max(MIN.w,zug.w+(rechts?-dx:dx))),h:Math.round(Math.max(MIN.h,zug.h+(unten?-dy:dy)))};
      panel.classList.remove('is-wide');
    }
    anwenden();
  },{passive:false});
  const ende=e=>{
    if(!zug||e.pointerId!==zug.id)return;
    if(zug.aktiv){geschoben=zug.art==='ziehen';panel.classList.remove('is-dragging');speichern();if(wide)zeige(offen)}
    zug=null;
  };
  root.document.addEventListener('pointerup',ende);
  root.document.addEventListener('pointercancel',ende);
  // Nach dem Verschieben öffnet der Reiter nicht.
  panel.addEventListener('click',e=>{if(geschoben){geschoben=false;e.preventDefault();e.stopPropagation()}},true);
  toggle?.addEventListener('click',()=>onToggle());
  close?.addEventListener('click',()=>onClose());
  wide?.addEventListener('click',()=>{weit=!weit;zeige(offen)});
  root.addEventListener('resize',anwenden);
  zeige(false);
  return Object.freeze({zeige,offen:()=>offen,weit:()=>weit,lage:()=>lage&&{...lage}});
}

root.TBA_ASSISTANT_WINDOW=Object.freeze({mount,ausRechteck});
})(window);
