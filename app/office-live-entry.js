// Office-only entry point for the shared Window Live WebRTC client.
// The existing microphone transcription button remains unchanged.
(()=>{
  'use strict';
  if(window.APP_PROFILE!=='office')return;
  function attach(){
    const mic=document.getElementById('micButton');
    if(!mic||document.getElementById('officeLiveOpen'))return;
    const open=document.createElement('a');
    open.id='officeLiveOpen';
    open.className='office-live-entry';
    open.href='./live/';
    open.textContent='Live';
    open.setAttribute('aria-label','Romy Live · Sprachgespräch starten');
    open.title='Romy Live – Sprachgespräch';
    mic.parentElement?.insertBefore(open,mic);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});
  else attach();
  const observer=new MutationObserver(attach);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
