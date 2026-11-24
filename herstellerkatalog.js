/* TBA Office · Herstellerkatalog (24.11.2026, Claude; Wunsch von Gari am 24.11.2026).
   Gari: Das Büro hat keinen Herstellerkatalog, man fragt sich gegenseitig nach den Kontakten. Eigene Seite wie die
   Produktbibliothek: je Firma Produkt, Typ, Kontakt und die Projekte, in denen jemand aus dem Büro schon Kontakt hatte,
   damit man zuerst mit der Kollegin oder dem Kollegen spricht. Die Produktkarten der Bibliothek zeigen denselben Kontakt.
   Ansichten: Katalog (Karten, Suche, Kategorie, Typ, Projekt), Firmenblatt (Kontakt, Produkte der Bibliothek, Kontakte
   in Projekten) und Formulare zum Anlegen, Bearbeiten und Kontakt eintragen.
   Daten: office_hersteller, office_hersteller_kontakte (Migration 20261124180000); Produkte über hersteller_id. */
(()=>{
'use strict';
const OFFICE=window.TBA_OFFICE_CONFIG;
const sb=window.MINDS_SUPABASE||(window.supabase&&OFFICE?window.supabase.createClient(OFFICE.url,OFFICE.key,
  {auth:{storageKey:OFFICE.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null);
const inApp=!!window.WINDOW_NATIVE?.available;
const params=new URLSearchParams(location.search);
const ID=params.get('id'),NEU=params.get('neu');
const root=document.getElementById('hk'),dialog=document.getElementById('hkDialog');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Dieselben Kategorien wie die Produktbibliothek, dazu Licht.
const KATEGORIEN=[['bodenbelag','Bodenbeläge'],['wandbelag','Wandbeläge'],['decke','Decken'],['fassade','Fassade'],
  ['fenster_tueren','Fenster und Türen'],['sanitaer','Sanitär'],['licht','Licht'],['beschlaege','Beschläge'],['sonstiges','Sonstiges']];
const KAT=new Map(KATEGORIEN);
const TYPEN=[['hersteller','Hersteller'],['systemhersteller','Systemhersteller'],['ausfuehrender','Ausführender'],
  ['vertrieb','Vertrieb'],['verband','Verband']];
const TYP=new Map(TYPEN);
const ARTEN=[['recherche','Recherche'],['anfrage','Anfrage'],['unterlagen','Unterlagen'],['muster','Muster'],['angebot','Angebot'],
  ['beratung','Beratung'],['auftrag','Auftrag']];
const ART=new Map(ARTEN);
const datum=iso=>{if(!iso)return '';const d=new Date(iso.length===10?iso+'T12:00:00':iso);return Number.isFinite(d.getTime())?d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}):''};
const heute=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};

let nutzer=null,mitglied=null;
const daten={firmen:[],kontakte:[],produkte:[],projekte:[],personen:new Map()};
const ui={kategorie:'alle',suche:'',typ:'alle',projekt:'alle',archiv:false};
if(params.get('suche')){ui.suche=params.get('suche').slice(0,80)}

function fehler(text){root.innerHTML='<div class="pb-wrap"><a class="pb-back" href="./app/#section=tools">‹ Werkzeuge</a><div class="pb-banner warn">'+esc(text)+'</div></div>'}
function meldung(text,art='info'){const el=root.querySelector('[data-meldung]');if(el){el.className='pb-banner '+art;el.textContent=text;el.hidden=!text}}

// ---------- Start ----------
async function start(){
  if(!sb){fehler('Office-Verbindung nicht verfügbar.');return}
  const {data,error}=await sb.auth.getSession();
  const session=data?.session;
  if(error||!session){if(inApp){void window.WINDOW_NATIVE.call('session.signIn');fehler('Bitte in der App anmelden.');return}location.href='./';return}
  nutzer=session.user;
  const {data:m,error:me}=await sb.from('office_members').select('role,display_name,is_active,must_change_password')
    .eq('user_id',nutzer.id).eq('is_active',true).maybeSingle();
  if(me||!m){fehler('Kein Zugriff auf TBA Office.');return}
  if(m.must_change_password){if(inApp){fehler('Bitte zuerst im Browser auf tbarchitekten.github.io das Startpasswort ändern.');return}location.href='./';return}
  mitglied=m;
  try{
    await ladeAlles();
    if(ID){const f=UUID.test(ID)&&daten.firmen.find(x=>x.id===ID);if(f)renderFirma(f);else fehler('Diese Firma gibt es nicht (mehr) im Katalog.')}
    else{renderListe();if(NEU==='firma')firmaFormular(null)}
  }catch(e){console.error('Herstellerkatalog',e);fehler(e?.message||'Herstellerkatalog nicht erreichbar.')}
}
async function ladeAlles(){
  const [fi,ko,pr,proj,mi]=await Promise.all([
    sb.from('office_hersteller').select('*').order('firma').limit(3000),
    sb.from('office_hersteller_kontakte').select('*').order('datum',{ascending:false,nullsFirst:false}).limit(10000),
    sb.from('office_produkte').select('id,name,kategorie,typ,hersteller,hersteller_id,archiviert').limit(3000),
    sb.from('office_projects').select('id,number,name,status').order('number').limit(500),
    sb.from('office_members').select('user_id,display_name,is_active').limit(500)
  ]);
  const err=fi.error||ko.error||pr.error||proj.error||mi.error;if(err)throw err;
  daten.firmen=fi.data||[];daten.kontakte=ko.data||[];daten.produkte=pr.data||[];daten.projekte=proj.data||[];
  daten.personen=new Map((mi.data||[]).map(x=>[x.user_id,x.display_name||'']));
}
const projekt=id=>daten.projekte.find(p=>p.id===id)||null;
const projektName=p=>p?[p.number,p.name].filter(Boolean).join(' · '):'';
const kontakteVon=f=>daten.kontakte.filter(k=>k.hersteller_id===f.id);
const produkteVon=f=>daten.produkte.filter(p=>p.hersteller_id===f.id&&!p.archiviert);
const person=id=>daten.personen.get(id)||'';
const kontaktProjekt=k=>k.projekt_id?projektName(projekt(k.projekt_id)):(k.projekt_bezeichnung||'');

// Telefon als Link: nur Ziffern und «+» der ersten Nummer; Text bleibt, wie er im Katalog steht (mit «n. v.» usw.).
function telLink(text){
  const erste=String(text||'').split(/[;\n]|,(?=\s*(?:mobil|Fax|Vertrieb|Tel))/i)[0];
  const nr=(erste.match(/\+?[\d\s/().-]{6,}/)||[''])[0].replace(/[^\d+]/g,'');
  return nr.length>=6?'tel:'+nr:'';
}
function mailLinks(text){
  return esc(text).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,m=>'<a href="mailto:'+m+'">'+m+'</a>');
}
const webText=url=>String(url||'').replace(/^https:\/\/(www\.)?/,'').replace(/\/$/,'');
function kontaktBlock(f,kurz=false){
  const zeilen=[];
  if(f.adresse&&!kurz)zeilen.push('<div><dt>Adresse</dt><dd>'+esc(f.adresse)+'</dd></div>');
  if(f.telefon){const l=telLink(f.telefon);zeilen.push('<div><dt>Telefon</dt><dd>'+(l?'<a href="'+esc(l)+'">'+esc(f.telefon)+'</a>':esc(f.telefon))+'</dd></div>')}
  if(f.email)zeilen.push('<div><dt>E-Mail</dt><dd>'+mailLinks(f.email)+'</dd></div>');
  if(f.website)zeilen.push('<div><dt>Website</dt><dd><a href="'+esc(f.website)+'" target="_blank" rel="noopener noreferrer">'+esc(webText(f.website))+'</a></dd></div>');
  if(f.ansprechpartner)zeilen.push('<div><dt>Ansprechpartner</dt><dd>'+mailLinks(f.ansprechpartner)+'</dd></div>');
  return zeilen.length?'<dl class="hk-kontakt">'+zeilen.join('')+'</dl>':'<p class="meta">Noch keine Kontaktdaten.</p>';
}
function kontaktZeile(k){
  return [kontaktProjekt(k),ART.get(k.art)||k.art,person(k.person_id),datum(k.datum)].filter(Boolean).join(' · ');
}

// ---------- Katalog ----------
function gefiltert(){
  const q=ui.suche.trim().toLowerCase();
  let liste=daten.firmen.filter(f=>ui.archiv?f.archiviert:!f.archiviert);
  if(ui.kategorie!=='alle')liste=liste.filter(f=>(f.kategorien||[]).includes(ui.kategorie));
  if(ui.typ!=='alle')liste=liste.filter(f=>f.typ===ui.typ);
  if(ui.projekt!=='alle')liste=liste.filter(f=>kontakteVon(f).some(k=>k.projekt_id===ui.projekt));
  if(q)liste=liste.filter(f=>[f.firma,f.produkte,f.adresse,f.ansprechpartner,f.notiz,f.email,f.website,
    ...produkteVon(f).map(p=>p.name),...kontakteVon(f).map(kontaktZeile)].filter(Boolean).join(' ').toLowerCase().includes(q));
  return liste.sort((a,b)=>a.firma.localeCompare(b.firma,'de'));
}
function renderListe(){
  const zaehler=new Map();
  for(const f of daten.firmen)if(ui.archiv?f.archiviert:!f.archiviert)for(const k of f.kategorien||[])zaehler.set(k,(zaehler.get(k)||0)+1);
  const pills=[...KATEGORIEN.filter(([k])=>zaehler.get(k)).map(([k,t])=>[k,t+' · '+zaehler.get(k)]),['alle','Alle']]
    .map(([k,t])=>'<button type="button" class="pill" aria-pressed="'+(ui.kategorie===k)+'" data-kat="'+k+'">'+esc(t)+'</button>').join('');
  const mitKontakt=new Set(daten.kontakte.map(k=>k.projekt_id).filter(Boolean));
  root.innerHTML=`<div class="pb-wrap">
    <a class="pb-back" href="./app/#section=tools">‹ Werkzeuge</a>
    <header class="pb-head"><div class="pb-head-text"><p class="kicker">Werkzeuge</p><h1>Herstellerkatalog</h1>
      <p class="pb-intro">Firmen mit Kontakt für das ganze Büro: wer was anbietet, wie man sie erreicht und in welchen Projekten jemand aus dem Büro schon Kontakt hatte. So fragt man zuerst die Kollegin oder den Kollegen.</p></div>
      <div class="pb-actions"><button type="button" class="btn btn-primary" data-neu>Firma anlegen</button>
      <a class="btn" href="./produktbibliothek.html">Produktbibliothek</a></div></header>
    <div class="pb-banner" data-meldung hidden></div>
    <section class="card pb-filter" aria-label="Suchen und filtern">
      <div class="pb-filter-zeile">
        <div class="pb-gruppe pb-gruppe-suche"><label for="hkSuche" class="meta">Suchen</label>
        <input id="hkSuche" class="pb-input pb-suche" type="search" value="${esc(ui.suche)}" placeholder="Firma, Produkt, Ort, Ansprechpartner"></div>
        <div class="pb-gruppe"><label for="hkTyp" class="meta">Typ</label>
        <select id="hkTyp" class="pb-input"><option value="alle">alle Typen</option>${TYPEN.map(([k,t])=>'<option value="'+k+'"'+(ui.typ===k?' selected':'')+'>'+t+'</option>').join('')}</select></div>
        <div class="pb-gruppe"><label for="hkProjekt" class="meta">Kontakt in</label>
        <select id="hkProjekt" class="pb-input"><option value="alle">allen Projekten</option>${daten.projekte.filter(p=>mitKontakt.has(p.id))
          .map(p=>'<option value="'+esc(p.id)+'"'+(ui.projekt===p.id?' selected':'')+'>'+esc(projektName(p))+'</option>').join('')}</select></div>
        <button type="button" class="btn btn-quiet" data-archiv aria-pressed="${ui.archiv}">${ui.archiv?'Zurück zum Katalog':'Archiv'}</button>
      </div>
      <div class="pb-pills" role="group" aria-label="Kategorie">${pills}</div>
    </section>
    <p class="meta pb-zahl" data-zahl aria-live="polite"></p>
    <div data-ergebnis></div>
  </div>`;
  root.querySelector('#hkSuche').addEventListener('input',ev=>{ui.suche=ev.target.value;renderErgebnis()});
  root.querySelector('#hkTyp').addEventListener('change',ev=>{ui.typ=ev.target.value;renderErgebnis()});
  root.querySelector('#hkProjekt').addEventListener('change',ev=>{ui.projekt=ev.target.value;renderErgebnis()});
  root.querySelector('[data-archiv]').addEventListener('click',()=>{ui.archiv=!ui.archiv;renderListe()});
  root.querySelector('[data-neu]').addEventListener('click',()=>firmaFormular(null));
  root.querySelectorAll('[data-kat]').forEach(b=>b.addEventListener('click',()=>{
    ui.kategorie=b.dataset.kat;root.querySelectorAll('[data-kat]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderErgebnis()}));
  renderErgebnis();
}
function renderErgebnis(){
  const el=root.querySelector('[data-ergebnis]');if(!el)return;
  const liste=gefiltert(),anzahl=root.querySelector('[data-zahl]');
  if(anzahl)anzahl.textContent=liste.length+' '+(liste.length===1?'Firma':'Firmen')+(ui.kategorie!=='alle'?' · '+KAT.get(ui.kategorie):'')+
    (ui.projekt!=='alle'?' · mit Kontakt in '+projektName(projekt(ui.projekt)):'');
  el.innerHTML=liste.length?'<div class="pb-grid hk-grid">'+liste.map(karte).join('')+'</div>':
    '<div class="card pb-leer"><p>'+(daten.firmen.length?'Nichts gefunden. Andere Kategorie oder weniger Suchbegriffe?':
      'Der Katalog ist noch leer. «Firma anlegen» trägt die erste ein.')+'</p></div>';
}
function karte(f){
  const kontakte=kontakteVon(f),produkte=produkteVon(f);
  const unter=[TYP.get(f.typ),(f.kategorien||[]).map(k=>KAT.get(k)).filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const projekte=new Map();
  for(const k of kontakte){const n=kontaktProjekt(k);if(n&&!projekte.has(n))projekte.set(n,k)}
  return `<article class="card hk-karte">
    <h2><a href="./herstellerkatalog.html?id=${esc(f.id)}">${esc(f.firma)}</a></h2>
    ${unter?'<p class="meta">'+esc(unter)+'</p>':''}
    ${f.produkte?'<p class="hk-produkte">'+esc(f.produkte)+'</p>':''}
    ${kontaktBlock(f,true)}
    ${projekte.size?'<div class="pb-chips hk-projekte">'+[...projekte.values()].slice(0,4).map(k=>'<span class="chip chip-mute" title="'+esc(kontaktZeile(k))+'">'+
      esc([kontaktProjekt(k),person(k.person_id)].filter(Boolean).join(' · '))+'</span>').join('')+(projekte.size>4?'<span class="chip chip-mute">+'+(projekte.size-4)+'</span>':'')+'</div>':''}
    ${produkte.length?'<p class="meta"><a href="./produktbibliothek.html?hersteller='+esc(f.id)+'">'+(produkte.length===1?'1 Produkt':produkte.length+' Produkte')+' in der Bibliothek</a></p>':''}
  </article>`;
}

// ---------- Firmenblatt ----------
function renderFirma(f){
  const kontakte=kontakteVon(f),produkte=produkteVon(f);
  const unter=[TYP.get(f.typ),(f.kategorien||[]).map(k=>KAT.get(k)).filter(Boolean).join(', '),f.archiviert?'archiviert':''].filter(Boolean).join(' · ');
  root.innerHTML=`<div class="pb-wrap">
    <a class="pb-back" href="./herstellerkatalog.html">‹ Herstellerkatalog</a>
    <header class="pb-head"><div class="pb-head-text"><p class="kicker">Herstellerkatalog</p><h1>${esc(f.firma)}</h1>
      ${unter?'<p class="pb-intro">'+esc(unter)+'</p>':''}</div>
      <div class="pb-actions"><button type="button" class="btn btn-primary" data-kontakt-neu>Kontakt eintragen</button>
        <button type="button" class="btn" data-bearbeiten>Bearbeiten</button>
        <button type="button" class="btn" data-archivieren>${f.archiviert?'Zurückholen':'Archivieren'}</button></div></header>
    <div class="pb-banner" data-meldung hidden></div>
    <div class="pb-cols hk-cols">
      <div class="pb-side">
        <section class="card pb-box"><h2 class="pb-h2">Kontakt</h2>${kontaktBlock(f)}</section>
        ${f.notiz?'<section class="card pb-box"><h2 class="pb-h2">Notiz</h2><p>'+esc(f.notiz)+'</p></section>':''}
      </div>
      <div class="pb-main">
        ${f.produkte?'<section class="card pb-box"><h2 class="pb-h2">Bietet an</h2><p>'+esc(f.produkte)+'</p></section>':''}
        <section class="card pb-box"><h2 class="pb-h2">In der Produktbibliothek</h2>
          ${produkte.length?'<ul class="hk-liste">'+produkte.map(p=>'<li><a href="./produktbibliothek.html?id='+esc(p.id)+'">'+esc(p.name)+'</a></li>').join('')+'</ul>':
            '<p class="meta">Noch kein Produkt dieser Firma in der Bibliothek.</p>'}
        </section>
        <section class="card pb-box"><div class="pb-box-kopf"><h2 class="pb-h2">Kontakt in Projekten</h2><p class="meta">Wer im Büro schon mit der Firma zu tun hatte</p></div>
          ${kontakte.length?`<div class="pb-tabelle"><table><thead><tr><th scope="col">Projekt</th><th scope="col">Wer</th><th scope="col">Art</th><th scope="col">Datum</th><th scope="col">Notiz</th><th scope="col"><span class="sr">Aktion</span></th></tr></thead><tbody>${
            kontakte.map(k=>`<tr><td>${esc(kontaktProjekt(k)||'—')}</td><td>${esc(person(k.person_id)||'—')}</td><td>${esc(ART.get(k.art)||k.art)}</td>
              <td>${esc(datum(k.datum)||'—')}</td><td>${esc(k.notiz||'')}</td>
              <td>${k.created_by===nutzer.id||mitglied?.role==='admin'?'<button type="button" class="btn btn-quiet" data-kontakt-weg="'+esc(k.id)+'">Entfernen</button>':''}</td></tr>`).join('')
          }</tbody></table></div>`:'<p class="meta">Noch kein Kontakt eingetragen.</p>'}
        </section>
      </div>
    </div>
  </div>`;
  root.querySelector('[data-kontakt-neu]').addEventListener('click',()=>kontaktFormular(f));
  root.querySelector('[data-bearbeiten]').addEventListener('click',()=>firmaFormular(f));
  root.querySelector('[data-archivieren]').addEventListener('click',()=>archivieren(f));
  root.querySelectorAll('[data-kontakt-weg]').forEach(b=>b.addEventListener('click',async()=>{
    const {error}=await sb.from('office_hersteller_kontakte').delete().eq('id',b.dataset.kontaktWeg);
    if(error){meldung('Nicht entfernt: '+error.message,'warn');return}
    daten.kontakte=daten.kontakte.filter(k=>k.id!==b.dataset.kontaktWeg);renderFirma(f);meldung('Kontakt entfernt.');
  }));
}
async function archivieren(f){
  const {data,error}=await sb.from('office_hersteller').update({archiviert:!f.archiviert}).eq('id',f.id).select('*').single();
  if(error){meldung('Nicht gespeichert: '+error.message,'warn');return}
  Object.assign(f,data);renderFirma(f);meldung(f.archiviert?'Archiviert. Im Katalog unter «Archiv».':'Zurück im Katalog.');
}

// ---------- Formulare ----------
function oeffneDialog(html){dialog.innerHTML=html;dialog.showModal();return dialog.querySelector('form')}
function firmaFormular(f){
  const form=oeffneDialog(`<form method="dialog" class="pb-form"><h2>${f?'Firma bearbeiten':'Firma anlegen'}</h2>
    <div class="pb-felder">
      <label class="breit">Firma<input name="firma" class="pb-input" required maxlength="200" value="${esc(f?.firma||'')}"></label>
      <label>Typ<select name="typ" class="pb-input"><option value="">—</option>${TYPEN.map(([k,t])=>'<option value="'+k+'"'+(f?.typ===k?' selected':'')+'>'+t+'</option>').join('')}</select></label>
      <label class="breit">Bietet an<input name="produkte" class="pb-input" maxlength="1000" value="${esc(f?.produkte||'')}" placeholder="z. B. Terrazzo, Betonwerkstein-Stufen"></label>
      <fieldset class="breit hk-kategorien"><legend class="meta">Kategorien</legend>${KATEGORIEN.map(([k,t])=>
        '<label class="pb-check"><input type="checkbox" name="kategorien" value="'+k+'"'+((f?.kategorien||[]).includes(k)?' checked':'')+'>'+esc(t)+'</label>').join('')}</fieldset>
      <label class="breit">Adresse<input name="adresse" class="pb-input" maxlength="300" value="${esc(f?.adresse||'')}"></label>
      <label>Telefon<input name="telefon" class="pb-input" maxlength="300" value="${esc(f?.telefon||'')}"></label>
      <label>E-Mail<input name="email" class="pb-input" maxlength="300" value="${esc(f?.email||'')}"></label>
      <label class="breit">Website<input name="website" class="pb-input" maxlength="300" value="${esc(f?.website||'')}" placeholder="https://…"></label>
      <label class="breit">Ansprechpartner<input name="ansprechpartner" class="pb-input" maxlength="600" value="${esc(f?.ansprechpartner||'')}" placeholder="Name, Rolle, Durchwahl"></label>
      <label class="breit">Notiz<textarea name="notiz" class="pb-input" maxlength="2000" rows="3">${esc(f?.notiz||'')}</textarea></label>
    </div>
    <p class="pb-banner warn" data-dialog-fehler hidden></p>
    <div class="pb-actions"><button value="speichern" class="btn btn-primary">Speichern</button><button value="abbrechen" class="btn" formnovalidate>Abbrechen</button></div></form>`);
  form.addEventListener('submit',async ev=>{
    if(ev.submitter?.value!=='speichern')return;
    ev.preventDefault();
    const d=new FormData(form),fehlerEl=dialog.querySelector('[data-dialog-fehler]');
    const text=k=>String(d.get(k)||'').trim()||null;
    let website=text('website');
    if(website&&!/^https:\/\//i.test(website))website='https://'+website.replace(/^http:\/\//i,'');
    const zeile={firma:text('firma'),typ:text('typ'),produkte:text('produkte'),kategorien:d.getAll('kategorien').map(String),adresse:text('adresse'),
      telefon:text('telefon'),email:text('email'),website,ansprechpartner:text('ansprechpartner'),notiz:text('notiz')};
    if(!zeile.firma){fehlerEl.textContent='Bitte den Namen der Firma eintragen.';fehlerEl.hidden=false;return}
    const anfrage=f?sb.from('office_hersteller').update(zeile).eq('id',f.id).select('*').single()
      :sb.from('office_hersteller').insert(zeile).select('*').single();
    const {data,error}=await anfrage;
    if(error){fehlerEl.textContent=error.code==='23505'?'Diese Firma steht schon im Katalog.':'Nicht gespeichert: '+error.message;fehlerEl.hidden=false;return}
    dialog.close();
    if(f){Object.assign(f,data);renderFirma(f);meldung('Gespeichert.')}
    else{daten.firmen.push(data);location.href='./herstellerkatalog.html?id='+encodeURIComponent(data.id)}
  });
}
function kontaktFormular(f){
  const aktive=daten.projekte.filter(p=>p.status==='aktiv');
  const personen=[...daten.personen.entries()].sort((a,b)=>a[1].localeCompare(b[1],'de'));
  const form=oeffneDialog(`<form method="dialog" class="pb-form"><h2>Kontakt eintragen</h2><p class="meta">${esc(f.firma)}</p>
    <div class="pb-felder">
      <label class="breit">Projekt<select name="projekt" class="pb-input">${aktive.map(p=>'<option value="'+esc(p.id)+'">'+esc(projektName(p))+'</option>').join('')}<option value="">anderes Projekt …</option></select></label>
      <label class="breit" data-anderes hidden>Projekt (frei)<input name="bezeichnung" class="pb-input" maxlength="160" placeholder="z. B. Wettbewerb 2025"></label>
      <label>Wer im Büro<select name="person" class="pb-input">${personen.map(([id,n])=>'<option value="'+esc(id)+'"'+(id===nutzer.id?' selected':'')+'>'+esc(n||'—')+'</option>').join('')}</select></label>
      <label>Art<select name="art" class="pb-input">${ARTEN.map(([k,t])=>'<option value="'+k+'"'+(k==='anfrage'?' selected':'')+'>'+t+'</option>').join('')}</select></label>
      <label>Datum<input type="date" name="datum" class="pb-input" value="${heute()}"></label>
      <label class="breit">Notiz<input name="notiz" class="pb-input" maxlength="1000" placeholder="z. B. Muster bestellt, Rückruf vereinbart"></label>
    </div>
    <p class="pb-banner warn" data-dialog-fehler hidden></p>
    <div class="pb-actions"><button value="speichern" class="btn btn-primary">Eintragen</button><button value="abbrechen" class="btn" formnovalidate>Abbrechen</button></div></form>`);
  const anderes=()=>{dialog.querySelector('[data-anderes]').hidden=!!form.projekt.value};
  form.projekt.addEventListener('change',anderes);anderes();
  form.addEventListener('submit',async ev=>{
    if(ev.submitter?.value!=='speichern')return;
    ev.preventDefault();
    const d=new FormData(form),fehlerEl=dialog.querySelector('[data-dialog-fehler]');
    const projektId=String(d.get('projekt')||'')||null,bezeichnung=String(d.get('bezeichnung')||'').trim()||null;
    if(!projektId&&!bezeichnung){fehlerEl.textContent='Bitte ein Projekt wählen oder benennen.';fehlerEl.hidden=false;return}
    const {data,error}=await sb.from('office_hersteller_kontakte').insert({hersteller_id:f.id,projekt_id:projektId,projekt_bezeichnung:projektId?null:bezeichnung,
      person_id:String(d.get('person')||'')||null,art:String(d.get('art')),datum:String(d.get('datum')||'')||null,
      notiz:String(d.get('notiz')||'').trim()||null}).select('*').single();
    if(error){fehlerEl.textContent='Nicht gespeichert: '+error.message;fehlerEl.hidden=false;return}
    daten.kontakte.unshift(data);dialog.close();renderFirma(f);meldung('Kontakt eingetragen.');
  });
}

void start();
})();
