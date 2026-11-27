// TBA Office · Projektwissen (Gari, 26.11.2026): der gemeinsame Wissenspool eines Projekts, im Reiter «Wissen» von Work.
// Die Seiten schreibt und pflegt die KI (mit Claude: «Ins Office übernehmen»); das Team liest und sucht, sieht die
// Herkunft jeder Seite und ihre früheren Fassungen, gibt Hinweise oder Notizen (die KI arbeitet sie beim nächsten Mal
// ein), und die Projektleitung bestätigt Entscheidungen. Geschrieben wird nur über die Funktionen der Datenbank
// (office_wissen_*); dieses Modul ändert keine Zeile direkt.
(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const TZ='Europe/Berlin';
function datum(iso){if(!iso)return '';const d=new Date(iso);return isNaN(d)?'':new Intl.DateTimeFormat('de-DE',{timeZone:TZ,day:'2-digit',month:'2-digit',year:'numeric'}).format(d)}
function zeit(iso){if(!iso)return '';const d=new Date(iso);return isNaN(d)?'':new Intl.DateTimeFormat('de-DE',{timeZone:TZ,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d)}

// ---------- Markdown: erst escapen, dann wenige sichere Formen (Überschriften, Listen, Tabellen, Zitate, Code) ----------
function inline(t){
  const codes=[];
  t=t.replace(/`([^`\n]+)`/g,(_,c)=>{codes.push(c);return '\u0000'+(codes.length-1)+'\u0000'});
  t=t.replace(/\[\[([^\]\n]{1,200})\]\]/g,(_,titel)=>'<button type="button" class="wissen-verweis" data-wissen-seite="'+titel.trim()+'">'+titel.trim()+'</button>');
  t=t.replace(/\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g,(_,text,url)=>'<a href="'+url+'" target="_blank" rel="noopener noreferrer">'+text+'</a>');
  t=t.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
  t=t.replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?![*\w])/g,'$1<em>$2</em>');
  return t.replace(/\u0000(\d+)\u0000/g,(_,i)=>'<code>'+codes[+i]+'</code>');
}
const LISTE=/^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TRENNER=/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
function liste(items){
  let html='';const stapel=[];
  for(const it of items){
    const tag=it.nr?'ol':'ul';
    while(stapel.length&&it.ein<stapel[stapel.length-1].ein)html+='</li></'+stapel.pop().tag+'>';
    let oben=stapel[stapel.length-1];
    // Auf derselben Ebene wechselt die Art (Punkte ↔ Nummern): die eine Liste endet, die andere beginnt.
    if(oben&&it.ein===oben.ein&&oben.tag!==tag){html+='</li></'+stapel.pop().tag+'>';oben=stapel[stapel.length-1]}
    if(!oben||it.ein>oben.ein){stapel.push({ein:it.ein,tag});html+='<'+tag+'><li>'+inline(esc(it.text))}
    else html+='</li><li>'+inline(esc(it.text));
  }
  while(stapel.length)html+='</li></'+stapel.pop().tag+'>';
  return html;
}
function renderMarkdown(src){
  const zeilen=String(src||'').replace(/\r\n?/g,'\n').split('\n'),out=[];let i=0;
  const zellen=l=>l.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>inline(esc(c.trim())));
  const tabelle=k=>/\|/.test(zeilen[k]||'')&&k+1<zeilen.length&&TRENNER.test(zeilen[k+1]);
  while(i<zeilen.length){
    const z=zeilen[i];
    if(!z.trim()){i++;continue}
    if(/^\s*```/.test(z)){const buf=[];i++;while(i<zeilen.length&&!/^\s*```/.test(zeilen[i]))buf.push(zeilen[i++]);i++;out.push('<pre><code>'+esc(buf.join('\n'))+'</code></pre>');continue}
    const h=z.match(/^(#{1,6})\s+(.*)$/);
    if(h){const n=Math.min(6,h[1].length+2);out.push('<h'+n+'>'+inline(esc(h[2].replace(/\s+#+\s*$/,'').trim()))+'</h'+n+'>');i++;continue}
    if(/^\s*([-*_])(\s*\1){2,}\s*$/.test(z)){out.push('<hr>');i++;continue}
    if(/^\s*>/.test(z)){const buf=[];while(i<zeilen.length&&/^\s*>/.test(zeilen[i]))buf.push(zeilen[i++].replace(/^\s*>\s?/,''));out.push('<blockquote>'+renderMarkdown(buf.join('\n'))+'</blockquote>');continue}
    if(tabelle(i)){
      const kopf=zellen(z);i+=2;const reihen=[];
      while(i<zeilen.length&&zeilen[i].trim()&&/\|/.test(zeilen[i]))reihen.push(zellen(zeilen[i++]));
      out.push('<div class="wissen-tabelle"><table><thead><tr>'+kopf.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+
        reihen.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');
      continue;
    }
    if(LISTE.test(z)){
      const items=[];
      while(i<zeilen.length){
        const m=zeilen[i].match(LISTE);
        if(m){items.push({ein:m[1].replace(/\t/g,'  ').length,nr:/\d/.test(m[2]),text:m[3]});i++;continue}
        if(zeilen[i].trim()&&/^\s{2,}\S/.test(zeilen[i])&&items.length){items[items.length-1].text+=' '+zeilen[i].trim();i++;continue}
        break;
      }
      out.push(liste(items));continue;
    }
    const buf=[z.trim()];i++;
    while(i<zeilen.length&&zeilen[i].trim()&&!/^(#{1,6}\s|\s*```|\s*>)/.test(zeilen[i])&&!LISTE.test(zeilen[i])&&!tabelle(i))buf.push(zeilen[i++].trim());
    out.push('<p>'+inline(esc(buf.join(' ')))+'</p>');
  }
  return out.join('');
}
const verweise=text=>[...new Set([...String(text||'').matchAll(/\[\[([^\]\n]{1,200})\]\]/g)].map(m=>m[1].trim()).filter(Boolean))];

// ---------- Reiter «Wissen» ----------
const ART={chat:'Aus einem Chat',thread:'Aus einem Thread',korrektur:'Hinweis',notiz:'Notiz'};
const PROTOKOLL={beitrag:'Geteilt',seite_neu:'Seite angelegt',seite_geaendert:'Seite fortgeschrieben',seite_zusammengefuehrt:'Seiten zusammengeführt',
  entscheidung_vorgeschlagen:'Entscheidung vorgeschlagen',entscheidung_beschlossen:'Entscheidung beschlossen',
  entscheidung_verworfen:'Entscheidung verworfen',entscheidung_ersetzt:'Entscheidung ersetzt'};
let zustand={projekt:null,ansicht:null,seite:null,suche:''};
let daten=null,suchTimer=null;

async function laden(ctx){
  const {sb,project}=ctx;
  const session=(await sb.auth.getSession())?.data?.session||null,uid=session?.user?.id||null;
  const keins=Promise.resolve({data:null,error:null});
  const [seiten,ents,beitr,prot,leute,proj,ich,team]=await Promise.all([
    sb.from('minds_work_memory').select('id,title,metadata,updated_at,user_id').eq('project_id',project.id).eq('memory_type','document_state')
      .eq('metadata->>kind','wissensseite').eq('status','confirmed').order('updated_at',{ascending:false}).limit(400),
    sb.from('minds_work_memory').select('id,title,body,status,occurred_at,confirmed_at,metadata,created_at,user_id').eq('project_id',project.id)
      .eq('memory_type','decision').order('created_at',{ascending:false}).limit(300),
    sb.from('office_wissen_beitraege').select('id,titel,art,quelle,seite,eingearbeitet_am,eingearbeitet_in,created_at,user_id').eq('project_id',project.id)
      .order('created_at',{ascending:false}).limit(300),
    sb.from('office_wissen_protokoll').select('id,art,titel,ref_id,created_at,user_id').eq('project_id',project.id).order('created_at',{ascending:false}).limit(60),
    sb.from('office_members').select('user_id,display_name').limit(500),
    sb.from('office_projects').select('id,projektleiter_id').eq('id',project.id).maybeSingle(),
    uid?sb.from('office_members').select('role').eq('user_id',uid).maybeSingle():keins,
    uid?sb.from('office_project_members').select('user_id').eq('project_id',project.id).eq('user_id',uid).maybeSingle():keins
  ]);
  const fehler=[seiten,ents,beitr,prot].find(q=>q?.error);
  if(fehler)throw fehler.error;
  return {uid,seiten:seiten.data||[],entscheidungen:ents.data||[],beitraege:beitr.data||[],protokoll:prot.data||[],
    namen:new Map((leute.data||[]).map(m=>[m.user_id,m.display_name||''])),
    leitung:!!uid&&(proj.data?.projektleiter_id===uid||ich.data?.role==='admin'),
    // Lesen darf nur das Projektteam (wie die Projektakte). Unbekannt (Fehler) heißt nicht «nicht im Team».
    imTeam:team?.error?null:!!team?.data};
}
const name=id=>daten?.namen.get(id)||'';

function navigation(){
  const offen=daten.entscheidungen.filter(e=>e.status==='proposed').length,wartend=daten.beitraege.filter(b=>!b.eingearbeitet_am).length;
  const eintrag=s=>'<button type="button" class="wissen-eintrag'+(zustand.ansicht==='seite'&&zustand.seite===s.id?' is-aktiv':'')+'" data-wissen-id="'+esc(s.id)+'"'+
    (zustand.ansicht==='seite'&&zustand.seite===s.id?' aria-current="page"':'')+'><strong>'+esc(s.title)+'</strong>'+
    (s.metadata?.kurz?'<small>'+esc(s.metadata.kurz)+'</small>':'')+'<span>'+esc(datum(s.updated_at))+'</span></button>';
  return '<nav class="wissen-liste" aria-label="Projektwissen">'+
    '<button type="button" class="wissen-sonder'+(zustand.ansicht==='neu'?' is-aktiv':'')+'" data-wissen-ansicht="neu">Neu'+(wartend?'<span class="wissen-zahl">'+wartend+'</span>':'')+'</button>'+
    '<button type="button" class="wissen-sonder'+(zustand.ansicht==='entscheidungen'?' is-aktiv':'')+'" data-wissen-ansicht="entscheidungen">Entscheidungen'+
      (offen?'<span class="wissen-zahl">'+offen+' offen</span>':'')+'</button>'+
    '<p class="wissen-liste-kopf">Seiten <span>'+daten.seiten.length+'</span></p>'+
    (daten.seiten.length?'<div class="wissen-seiten">'+daten.seiten.map(eintrag).join('')+'</div>':'<p class="wissen-leer-klein">Noch keine Seiten.</p>')+
    '</nav>';
}

// Wann die KI zuletzt eine Seite geschrieben hat (aus dem Verlauf): «heute, 07:12», «gestern, 18:40» oder das Datum.
function zuletzt(heute=new Date()){
  const x=(daten?.protokoll||[]).find(p=>/^seite_/.test(p.art));if(!x)return '';
  const d=new Date(x.created_at);if(isNaN(d))return '';
  const tag=v=>new Intl.DateTimeFormat('de-DE',{timeZone:TZ,day:'2-digit',month:'2-digit',year:'numeric'}).format(v);
  const uhr=new Intl.DateTimeFormat('de-DE',{timeZone:TZ,hour:'2-digit',minute:'2-digit'}).format(d);
  const wann=tag(d)===tag(heute)?'heute':tag(d)===tag(new Date(heute.getTime()-864e5))?'gestern':tag(d);
  return '<span class="wissen-zuletzt">zuletzt eingearbeitet '+wann+', '+uhr+'</span>';
}
function leer(){
  return '<div class="wissen-leer"><h3>Noch kein Projektwissen</h3>'+
    '<p>So entsteht es: In einem Chat mit Claude sagen Sie «Ins Office übernehmen». Claude teilt, was im Chat erarbeitet wurde, '+
    'und schreibt daraus Seiten, die hier für das ganze Projektteam stehen. Niemand muss etwas ordnen.</p>'+
    '<p>Notizen und Hinweise aus dem Team arbeitet die KI beim nächsten Mal ein.</p></div>';
}

function neu(){
  const wartend=daten.beitraege.filter(b=>!b.eingearbeitet_am);
  const zeile=x=>'<li><span class="wissen-zeit">'+esc(zeit(x.created_at))+'</span><span>'+esc(PROTOKOLL[x.art]||x.art)+': '+
    (/^seite_(neu|geaendert)$/.test(x.art)&&x.ref_id?'<button type="button" class="wissen-verweis" data-wissen-id="'+esc(x.ref_id)+'">'+esc(x.titel)+'</button>':'<strong>'+esc(x.titel)+'</strong>')+
    (name(x.user_id)?' <small>· '+esc(name(x.user_id))+'</small>':'')+'</span></li>';
  return '<h3>Neu im Projektwissen</h3>'+
    (wartend.length?'<section class="wissen-teil wissen-wartet"><h4>Wartet auf Einarbeitung <span>'+wartend.length+'</span></h4><ul class="wissen-zeilen">'+
      wartend.map(b=>'<li><span class="wissen-zeit">'+esc(zeit(b.created_at))+'</span><span><button type="button" class="wissen-verweis" data-wissen-beitrag="'+esc(b.id)+'">'+esc(b.titel)+'</button> <small>· '+
        esc(ART[b.art]||b.art)+(name(b.user_id)?' · '+esc(name(b.user_id)):'')+'</small></span></li>').join('')+
      '</ul><p class="wissen-fuss">Die KI arbeitet sie ein, wenn das nächste Mal mit Claude am Projekt gearbeitet wird.</p></section>':'')+
    '<section class="wissen-teil"><h4>Verlauf</h4>'+
    (daten.protokoll.length?'<ul class="wissen-zeilen">'+daten.protokoll.map(zeile).join('')+'</ul>':'<p class="wissen-leer-klein">Noch keine Änderungen.</p>')+'</section>';
}

function entscheidungen(){
  const e=daten.entscheidungen;
  const karte=(x,knoepfe)=>'<article class="wissen-entscheidung" data-status="'+esc(x.status)+'"><h4>'+esc(x.title)+'</h4>'+
    (x.body?'<p>'+esc(x.body)+'</p>':'')+
    '<p class="wissen-meta">'+[x.occurred_at?'am '+datum(x.occurred_at):'',
      x.status==='confirmed'&&x.metadata?.entschieden_von?'beschlossen von '+name(x.metadata.entschieden_von):'',
      x.status==='proposed'&&x.metadata?.vorgeschlagen_von?'vorgeschlagen von '+name(x.metadata.vorgeschlagen_von):'',
      x.metadata?.quelle?'Herkunft: '+x.metadata.quelle:'',
      x.metadata?.seite?'Seite: '+x.metadata.seite:''].filter(Boolean).map(esc).join(' · ')+'</p>'+
    (x.metadata?.ersetzt?'<p class="wissen-meta">Ersetzt: «'+esc(e.find(y=>y.id===x.metadata.ersetzt)?.title||'eine frühere Entscheidung')+'»</p>':'')+
    // Was aus einer Entscheidung wurde: durch eine neuere ersetzt, oder als Arbeitsweise des Teams auf eine Seite gestellt.
    (x.status==='superseded'&&x.metadata?.ersetzt_durch?'<p class="wissen-meta">Ersetzt durch «'+esc(e.find(y=>y.id===x.metadata.ersetzt_durch)?.title||'eine neuere Entscheidung')+'»</p>':'')+
    (x.metadata?.auf_seite?'<p class="wissen-meta">Keine Projektentscheidung, sondern Arbeitsweise des Teams: steht auf der Seite '+
      '<button type="button" class="wissen-verweis" data-wissen-seite="'+esc(x.metadata.auf_seite)+'">'+esc(x.metadata.auf_seite)+'</button>.</p>':'')+
    (x.metadata?.korrektur?'<p class="wissen-meta">'+esc(x.metadata.korrektur)+'</p>':'')+
    (knoepfe||'')+'</article>';
  const offen=e.filter(x=>x.status==='proposed'),fest=e.filter(x=>x.status==='confirmed'),alt=e.filter(x=>['superseded','rejected'].includes(x.status));
  const pruefen=x=>daten.leitung?'<div class="wissen-knoepfe"><button type="button" class="wissen-primaer" data-wissen-beschliessen="'+esc(x.id)+'">Bestätigen</button>'+
    '<button type="button" data-wissen-verwerfen="'+esc(x.id)+'">Verwerfen</button></div>':'<p class="wissen-fuss">Wartet auf die Projektleitung.</p>';
  return '<h3>Entscheidungen</h3>'+
    (offen.length?'<section class="wissen-teil"><h4>Zur Bestätigung <span>'+offen.length+'</span></h4>'+offen.map(x=>karte(x,pruefen(x))).join('')+'</section>':'')+
    '<section class="wissen-teil"><h4>Beschlossen <span>'+fest.length+'</span></h4>'+(fest.length?fest.map(x=>karte(x)).join(''):'<p class="wissen-leer-klein">Noch keine beschlossenen Entscheidungen.</p>')+'</section>'+
    (alt.length?'<details class="wissen-teil wissen-alt"><summary>Ersetzt oder verworfen ('+alt.length+')</summary>'+alt.map(x=>karte(x)).join('')+'</details>':'');
}

// Die Seite selbst: Kopf und Text. Was zu ihr gehört (Inhalt, Entscheidungen, Herkunft, Verweise, Fassungen, Hinweise)
// steht daneben (B2, 27.11.2026, wie im Entwurf: «Herkunft, Entscheidungen und Verweise neben dem Text»).
function seiteHtml(s,versionen){
  const ziel=s.status==='superseded'&&s.metadata?.zusammengefuehrt_in?daten.seiten.find(x=>norm(x.title)===norm(s.metadata.zusammengefuehrt_in)):null;
  return (ziel?'<p class="wissen-hinweis-zeile">Diese Seite ist in <button type="button" class="wissen-verweis" data-wissen-id="'+esc(ziel.id)+'">'+esc(ziel.title)+'</button> aufgegangen.</p>':'')+
    '<header class="wissen-blatt-kopf"><h3>'+esc(s.title)+'</h3><p class="wissen-meta">Stand '+esc(zeit(s.updated_at))+
      (name(s.metadata?.aktualisiert_von)?' · '+esc(name(s.metadata.aktualisiert_von)):'')+
      (versionen.length?' · '+versionen.length+(versionen.length===1?' frühere Fassung':' frühere Fassungen'):'')+'</p></header>'+
    '<div class="wissen-text">'+renderMarkdown(s.body)+'</div>';
}
const STATUS={confirmed:'Beschlossen',proposed:'Wartet auf Bestätigung'};
function kontextHtml(s,versionen,hierher){
  const quellen=(s.metadata?.quellen||[]).map(id=>daten.beitraege.find(b=>b.id===id)).filter(Boolean);
  const hinweise=daten.beitraege.filter(b=>!b.eingearbeitet_am&&b.seite&&norm(b.seite)===norm(s.title));
  const ents=daten.entscheidungen.filter(e=>STATUS[e.status]&&norm(e.metadata?.seite)===norm(s.title));
  return '<div class="wissen-inhalt-ort"></div>'+
    (ents.length?'<section class="wissen-teil"><h4>Entscheidungen</h4><ul class="wissen-ent-liste">'+ents.map(e=>'<li><button type="button" class="wissen-verweis" data-wissen-ansicht="entscheidungen">'+esc(e.title)+'</button>'+
      '<span class="wissen-status" data-status="'+esc(e.status)+'">'+STATUS[e.status]+'</span>'+
      (e.status==='confirmed'?'<small>'+esc([datum(e.occurred_at||e.confirmed_at),name(e.metadata?.entschieden_von)].filter(Boolean).join(' · '))+'</small>':'')+'</li>').join('')+'</ul></section>':'')+
    (hinweise.length?'<section class="wissen-teil wissen-wartet"><h4>Offene Hinweise <span>'+hinweise.length+'</span></h4><ul class="wissen-zeilen">'+
      hinweise.map(b=>'<li><span class="wissen-zeit">'+esc(datum(b.created_at))+'</span><span><button type="button" class="wissen-verweis" data-wissen-beitrag="'+esc(b.id)+'">'+esc(b.titel)+'</button>'+
        (name(b.user_id)?' <small>· '+esc(name(b.user_id))+'</small>':'')+'</span></li>').join('')+
      '</ul><p class="wissen-fuss">Werden beim nächsten Einarbeiten übernommen.</p></section>':'')+
    (quellen.length?'<section class="wissen-teil"><h4>Herkunft</h4><ul class="wissen-zeilen">'+quellen.map(b=>'<li><span class="wissen-zeit">'+esc(datum(b.created_at))+'</span><span>'+
      '<button type="button" class="wissen-verweis" data-wissen-beitrag="'+esc(b.id)+'">'+esc(b.titel)+'</button> <small>· '+esc(ART[b.art]||b.art)+
      (name(b.user_id)?' · '+esc(name(b.user_id)):'')+'</small></span></li>').join('')+'</ul></section>':'')+
    (hierher.length?'<section class="wissen-teil"><h4>Verweise hierher</h4><p>'+hierher.map(x=>'<button type="button" class="wissen-verweis" data-wissen-id="'+esc(x.id)+'">'+esc(x.title)+'</button>').join(' ')+'</p></section>':'')+
    (versionen.length?'<details class="wissen-teil wissen-verlauf"><summary>Frühere Fassungen ('+versionen.length+')</summary><ul class="wissen-zeilen">'+
      versionen.map(v=>'<li><span class="wissen-zeit">'+esc(zeit(v.stand))+'</span><span>'+(v.grund?esc(v.grund):'Fassung')+(name(v.von)?' <small>· '+esc(name(v.von))+'</small>':'')+
        ' <button type="button" class="wissen-verweis" data-wissen-fassung="'+esc(v.id)+'">Ansehen</button></span></li>').join('')+'</ul></details>':'')+
    '<div class="wissen-aktion"><button type="button" data-wissen-hinweis="'+esc(s.title)+'">Hinweis geben</button></div>';
}
// «Auf dieser Seite»: die Überschriften des Textes, ab zwei. Knöpfe statt Anker (die Adresse gehört der App).
function inhaltZeigen(blatt,kontext){
  const ort=kontext.querySelector('.wissen-inhalt-ort'),h=[...blatt.querySelectorAll('.wissen-text :is(h3,h4)')];
  if(!ort)return;
  if(h.length<2){ort.remove();return}
  h.forEach((x,i)=>{x.id='wissen-abschnitt-'+i});
  ort.outerHTML='<section class="wissen-teil wissen-inhalt"><h4>Auf dieser Seite</h4><nav aria-label="Auf dieser Seite">'+
    h.map((x,i)=>'<button type="button" class="wissen-abschnitt'+(x.tagName==='H4'?' tiefer':'')+'" data-wissen-abschnitt="'+i+'">'+esc(x.textContent)+'</button>').join('')+'</nav></section>';
}

function formular(art,seite){
  const titel=art==='korrektur'?'Hinweis zu «'+seite+'»':'Notiz teilen';
  return '<form class="wissen-formular" data-wissen-formular="'+art+'"'+(seite?' data-wissen-zu="'+esc(seite)+'"':'')+'><h4>'+esc(titel)+'</h4>'+
    (art==='notiz'?'<label>Titel<input name="titel" maxlength="200" required placeholder="Worum geht es?"></label>':'')+
    '<label>'+(art==='korrektur'?'Was fehlt oder stimmt nicht?':'Was soll das Team wissen?')+'<textarea name="inhalt" rows="6" required maxlength="20000"></textarea></label>'+
    '<p class="wissen-fuss">Wird mit Ihrem Namen gespeichert und beim nächsten Einarbeiten in die Seiten übernommen. Keine Gehälter, Personal-, Bank- oder Gesundheitsdaten.</p>'+
    '<div class="wissen-knoepfe"><button type="submit" class="wissen-primaer">Teilen</button><button type="button" data-wissen-abbrechen>Abbrechen</button></div></form>';
}

async function zeichne(ctx){
  const {body}=ctx,blatt=body.querySelector('.wissen-blatt'),kontext=body.querySelector('.wissen-kontext');
  if(!blatt)return;
  if(kontext)kontext.innerHTML='';
  const oben=body.querySelector('[data-wissen-hinweis-oben]');if(oben)oben.hidden=true;
  if(zustand.ansicht==='suche'){blatt.innerHTML='<p class="wissen-leer-klein">Suche …</p>';await suche(ctx);return}
  if(zustand.ansicht==='entscheidungen'){blatt.innerHTML=entscheidungen();return}
  if(zustand.ansicht==='neu'){blatt.innerHTML=neu();return}
  if(zustand.ansicht==='seite'&&zustand.seite){
    blatt.innerHTML='<p class="wissen-leer-klein">Lade die Seite …</p>';
    const id=zustand.seite;
    const [s,v]=await Promise.all([
      ctx.sb.from('minds_work_memory').select('id,title,body,status,metadata,updated_at').eq('id',id).maybeSingle(),
      ctx.sb.from('office_wissen_versionen').select('id,stand,von,grund').eq('seite_id',id).order('stand',{ascending:false}).limit(50)
    ]);
    if(zustand.seite!==id||!blatt.isConnected)return;
    if(s.error||!s.data){blatt.innerHTML='<p class="wissen-leer-klein">Diese Seite konnte nicht geladen werden.</p>';return}
    // Verweise hierher: Seiten, die diese mit [[Titel]] nennen.
    const muster='%[['+String(s.data.title).replace(/[\\%_]/g,'\\$&')+']]%';
    const r=await ctx.sb.from('minds_work_memory').select('id,title,body').eq('project_id',ctx.project.id).eq('memory_type','document_state')
      .eq('metadata->>kind','wissensseite').eq('status','confirmed').ilike('body',muster).limit(40);
    const hierher=(r.data||[]).filter(x=>x.id!==id&&verweise(x.body).some(v=>norm(v)===norm(s.data.title)));
    if(zustand.seite!==id||!blatt.isConnected)return;
    blatt.innerHTML=seiteHtml(s.data,v.data||[]);
    if(kontext){kontext.innerHTML=kontextHtml(s.data,v.data||[],hierher);inhaltZeigen(blatt,kontext)}
    if(oben){oben.hidden=false;oben.dataset.wissenHinweisOben=s.data.title}
    return;
  }
  blatt.innerHTML=leer();
}

async function suche(ctx){
  const {sb,project,body}=ctx,blatt=body.querySelector('.wissen-blatt'),q=zustand.suche;
  // Zeichen, die in PostgREST-Filtern eine Bedeutung haben, werden zu Leerzeichen.
  const like='%'+q.replace(/[%_,()"\\]/g,' ').trim()+'%';
  const [s,b]=await Promise.all([
    sb.from('minds_work_memory').select('id,title,body,metadata').eq('project_id',project.id).eq('memory_type','document_state').eq('metadata->>kind','wissensseite')
      .eq('status','confirmed').or('title.ilike.'+like+',body.ilike.'+like).limit(20),
    sb.from('office_wissen_beitraege').select('id,titel,inhalt,art,created_at').eq('project_id',project.id).or('titel.ilike.'+like+',inhalt.ilike.'+like).limit(20)
  ]);
  if(zustand.ansicht!=='suche'||zustand.suche!==q||!blatt.isConnected)return;
  const n=norm(q),stelle=t=>{const x=String(t||''),i=norm(x).indexOf(n),a=Math.max(0,(i<0?0:i)-90);return (a>0?'…':'')+x.slice(a,a+260).replace(/\s+/g,' ')+(a+260<x.length?'…':'')};
  const seiten=s.data||[],beitraege=b.data||[];
  blatt.innerHTML='<h3>Suche: «'+esc(q)+'»</h3>'+
    (seiten.length?'<section class="wissen-teil"><h4>Seiten</h4><ul class="wissen-treffer">'+seiten.map(x=>'<li><button type="button" class="wissen-verweis" data-wissen-id="'+esc(x.id)+'">'+esc(x.title)+'</button><p>'+esc(stelle(x.body))+'</p></li>').join('')+'</ul></section>':'')+
    (beitraege.length?'<section class="wissen-teil"><h4>Beiträge</h4><ul class="wissen-treffer">'+beitraege.map(x=>'<li><button type="button" class="wissen-verweis" data-wissen-beitrag="'+esc(x.id)+'">'+esc(x.titel)+'</button> <small>· '+esc(ART[x.art]||x.art)+' · '+esc(datum(x.created_at))+'</small><p>'+esc(stelle(x.inhalt))+'</p></li>').join('')+'</ul></section>':'')+
    (!seiten.length&&!beitraege.length?'<p class="wissen-leer-klein">Nichts gefunden.</p>':'');
}

function modal(ctx,titel,html){
  const open=ctx.openModal||root.ISABELLA_APP?.openModal;
  if(open)open(titel,'<div class="wissen-modal">'+html+'</div>');
}

async function beitragZeigen(ctx,id){
  const r=await ctx.sb.from('office_wissen_beitraege').select('id,titel,inhalt,art,quelle,seite,eingearbeitet_in,created_at,user_id').eq('id',id).maybeSingle();
  if(r.error||!r.data){ctx.setStatus?.('Der Beitrag konnte nicht geladen werden.');return}
  const b=r.data;
  modal(ctx,b.titel,'<p class="wissen-meta">'+[ART[b.art]||b.art,zeit(b.created_at),name(b.user_id),b.quelle?'Herkunft: '+b.quelle:''].filter(Boolean).map(esc).join(' · ')+'</p>'+
    '<p class="wissen-meta">'+(b.eingearbeitet_in?.length?'Eingearbeitet in: '+b.eingearbeitet_in.map(esc).join(', '):'Noch nicht eingearbeitet.')+'</p>'+
    '<div class="wissen-text">'+renderMarkdown(b.inhalt)+'</div>');
}
async function fassungZeigen(ctx,id){
  const r=await ctx.sb.from('office_wissen_versionen').select('id,titel,inhalt,stand,von,grund').eq('id',id).maybeSingle();
  if(r.error||!r.data){ctx.setStatus?.('Die Fassung konnte nicht geladen werden.');return}
  const v=r.data;
  modal(ctx,v.titel+' · Fassung vom '+datum(v.stand),'<p class="wissen-meta">'+[zeit(v.stand),name(v.von),v.grund].filter(Boolean).map(esc).join(' · ')+'</p><div class="wissen-text">'+renderMarkdown(v.inhalt)+'</div>');
}

async function teilen(ctx,form){
  const art=form.dataset.wissenFormular,seite=form.dataset.wissenZu||null;
  const inhalt=String(form.inhalt?.value||'').trim();
  const titel=art==='korrektur'?'Hinweis zu «'+seite+'»':String(form.titel?.value||'').trim();
  if(!inhalt||!titel){ctx.setStatus?.('Bitte Titel und Text ausfüllen.');return}
  const knopf=form.querySelector('[type="submit"]');if(knopf)knopf.disabled=true;
  const {error}=await ctx.sb.rpc('office_wissen_beitrag_teilen',{p_project:ctx.project.id,p_titel:titel.slice(0,200),p_inhalt:inhalt,p_art:art,p_quelle:null,p_seite:seite});
  if(error){if(knopf)knopf.disabled=false;ctx.setStatus?.('Das konnte nicht gespeichert werden.');return}
  ctx.setStatus?.(art==='korrektur'?'Danke, Ihr Hinweis ist gespeichert. Die KI arbeitet ihn beim nächsten Mal ein.':'Danke, Ihre Notiz ist gespeichert. Die KI arbeitet sie beim nächsten Mal ein.');
  await render(ctx,{behalten:true});
}

async function pruefen(ctx,id,ja){
  const {data,error}=await ctx.sb.rpc('office_wissen_entscheidung_pruefen',{p_id:id,p_beschliessen:ja});
  if(error){ctx.setStatus?.(error.message||'Das ging nicht.');return}
  ctx.setStatus?.(data==='confirmed'?'Entscheidung bestätigt.':data==='rejected'?'Entscheidung verworfen.':'');
  await render(ctx,{behalten:true});
}

function binden(ctx,wurzel){
  wurzel.addEventListener('click',e=>{
    const t=e.target.closest('button');if(!t||!wurzel.contains(t))return;
    if(t.dataset.wissenAnsicht){zustand.ansicht=t.dataset.wissenAnsicht;zustand.suche='';const f=wurzel.querySelector('.wissen-suche');if(f)f.value='';markieren(wurzel);void zeichne(ctx);return}
    if(t.dataset.wissenId){zustand.ansicht='seite';zustand.seite=t.dataset.wissenId;markieren(wurzel);void zeichne(ctx);wurzel.querySelector('.wissen-blatt')?.scrollIntoView?.({block:'start',behavior:'smooth'});return}
    if(t.dataset.wissenSeite){
      const ziel=daten.seiten.find(s=>norm(s.title)===norm(t.dataset.wissenSeite));
      if(ziel){zustand.ansicht='seite';zustand.seite=ziel.id;markieren(wurzel);void zeichne(ctx);wurzel.querySelector('.wissen-blatt')?.scrollIntoView?.({block:'start',behavior:'smooth'})}
      else ctx.setStatus?.('Die Seite «'+t.dataset.wissenSeite+'» gibt es noch nicht.');
      return;
    }
    if(t.dataset.wissenBeitrag){void beitragZeigen(ctx,t.dataset.wissenBeitrag);return}
    if(t.dataset.wissenFassung){void fassungZeigen(ctx,t.dataset.wissenFassung);return}
    if(t.dataset.wissenAbschnitt){wurzel.querySelector('#wissen-abschnitt-'+t.dataset.wissenAbschnitt)?.scrollIntoView?.({block:'start',behavior:'smooth'});return}
    if(t.hasAttribute('data-wissen-hinweis')||t.hasAttribute('data-wissen-hinweis-oben')){
      const ort=wurzel.querySelector('.wissen-aktion');if(!ort)return;
      ort.innerHTML=formular('korrektur',t.dataset.wissenHinweis||t.dataset.wissenHinweisOben);ort.scrollIntoView?.({block:'nearest'});ort.querySelector('textarea')?.focus();return}
    if(t.hasAttribute('data-wissen-notiz')){const ort=wurzel.querySelector('.wissen-notiz-ort');if(ort){ort.innerHTML=formular('notiz');ort.querySelector('input')?.focus()}return}
    if(t.hasAttribute('data-wissen-abbrechen')){const f=t.closest('form');if(f?.dataset.wissenFormular==='korrektur')f.parentElement.innerHTML='<button type="button" data-wissen-hinweis="'+esc(f.dataset.wissenZu||'')+'">Hinweis geben</button>';else if(f)f.remove();return}
    if(t.dataset.wissenBeschliessen){t.disabled=true;void pruefen(ctx,t.dataset.wissenBeschliessen,true);return}
    if(t.dataset.wissenVerwerfen){t.disabled=true;void pruefen(ctx,t.dataset.wissenVerwerfen,false);return}
  });
  wurzel.addEventListener('submit',e=>{const f=e.target.closest('form[data-wissen-formular]');if(!f)return;e.preventDefault();void teilen(ctx,f)});
  wurzel.addEventListener('input',e=>{
    if(!e.target.classList?.contains('wissen-suche'))return;
    const q=e.target.value.trim();clearTimeout(suchTimer);
    suchTimer=setTimeout(()=>{
      if(q.length>=2){zustand.ansicht='suche';zustand.suche=q}
      else if(zustand.ansicht==='suche'){zustand.ansicht=daten.seiten[0]?'seite':'neu';zustand.seite=daten.seiten[0]?.id||null;zustand.suche=''}
      markieren(wurzel);void zeichne(ctx);
    },250);
  });
}
function markieren(wurzel){
  wurzel.querySelectorAll('.wissen-eintrag').forEach(b=>{const an=zustand.ansicht==='seite'&&b.dataset.wissenId===zustand.seite;b.classList.toggle('is-aktiv',an);if(an)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  wurzel.querySelectorAll('.wissen-sonder').forEach(b=>b.classList.toggle('is-aktiv',b.dataset.wissenAnsicht===zustand.ansicht));
}

async function render(ctx,{behalten=false}={}){
  const {body,project}=ctx;
  if(!body)return;
  if(!ctx.sb||!project?.id){body.innerHTML='<div class="work-empty">Kein Projekt gewählt.</div>';return}
  if(zustand.projekt!==project.id){zustand={projekt:project.id,ansicht:null,seite:null,suche:''}}
  const vorgemerkt=zustand.seiteTitel;zustand.seiteTitel=null;
  if(!behalten)body.innerHTML='<div class="work-empty">Lade das Projektwissen …</div>';
  try{daten=await laden(ctx)}
  catch(e){
    console.error('Projektwissen:',e);
    body.innerHTML='<div class="work-empty" role="status"><p>Das Projektwissen konnte nicht geladen werden.</p><button type="button" data-work-retry class="secondary">Erneut versuchen</button></div>';
    return;
  }
  if(ctx.isCurrent&&!ctx.isCurrent())return;
  if(daten.imTeam===false){
    body.innerHTML='<div class="wissen"><div class="wissen-leer"><h3>Das Projektwissen sieht das Projektteam</h3>'+
      '<p>Sie gehören nicht zum Team von «'+esc(project.name)+'». Die Projektleitung kann Sie unter Projekte ins Team aufnehmen.</p></div></div>';
    return;
  }
  if(vorgemerkt){const s=daten.seiten.find(x=>norm(x.title)===norm(vorgemerkt));if(s){zustand.ansicht='seite';zustand.seite=s.id}}
  if(!zustand.ansicht||(zustand.ansicht==='seite'&&!daten.seiten.some(s=>s.id===zustand.seite))){
    zustand.ansicht=daten.seiten.length?'seite':(daten.protokoll.length||daten.beitraege.length?'neu':'leer');
    zustand.seite=daten.seiten[0]?.id||null;
  }
  // Eine Werkzeugzeile (B2, 27.11.2026, wie im Entwurf): Suche, wann zuletzt eingearbeitet wurde, «Hinweis zu dieser
  // Seite», «Notiz teilen» und «?» mit der Erklärung, die vorher über dem Wissen stand.
  body.innerHTML='<div class="wissen">'+
    '<div class="wissen-zeile" role="toolbar" aria-label="Projektwissen"><input type="search" class="wissen-suche" placeholder="Im Projektwissen suchen" aria-label="Im Projektwissen suchen" value="'+esc(zustand.suche)+'">'+
      zuletzt()+'<span class="wissen-luecke"></span>'+
      '<button type="button" class="wissen-leise" data-wissen-hinweis-oben hidden>Hinweis zu dieser Seite</button>'+
      '<button type="button" data-wissen-notiz>Notiz teilen</button>'+
      '<details class="wissen-hilfe"><summary aria-label="So entsteht das Projektwissen" title="So entsteht das Projektwissen">?</summary><div class="wissen-hilfe-text">'+
        '<p>Was im Projekt erarbeitet wird, für das ganze Team. Die Seiten schreibt die KI aus dem, was geteilt wird; Sie lesen, suchen und geben Hinweise.</p>'+
        '<p>So entsteht es: In einem Chat mit Claude sagen Sie «Ins Office übernehmen». Claude teilt, was im Chat erarbeitet wurde, und schreibt daraus Seiten, '+
        'die hier für das ganze Projektteam stehen. Niemand muss etwas ordnen.</p><p>Notizen und Hinweise aus dem Team arbeitet die KI beim nächsten Mal ein.</p></div></details></div>'+
    '<div class="wissen-notiz-ort"></div>'+
    '<div class="wissen-raster">'+navigation()+'<article class="wissen-blatt" aria-live="polite"></article><aside class="wissen-kontext" aria-label="Zu dieser Seite"></aside></div></div>';
  binden(ctx,body.querySelector('.wissen'));
  await zeichne(ctx);
}

// Panorama: die Karte «Neu im Projektwissen» (Gari, 26.11.2026). Nur für das Projektteam; zählt, was auf die Projektleitung
// oder die KI wartet, und zeigt die letzten Änderungen. Liest nur.
async function panorama({sb,project}){
  if(!sb||!project?.id)return {data:null,error:null};
  const uid=(await sb.auth.getSession())?.data?.session?.user?.id||null;
  const keins=Promise.resolve({data:null,error:null,count:0});
  const zahl=q=>q.select('id',{count:'exact',head:true}).eq('project_id',project.id);
  const [team,seiten,offen,beitr,prot]=await Promise.all([
    uid?sb.from('office_project_members').select('user_id').eq('project_id',project.id).eq('user_id',uid).maybeSingle():keins,
    zahl(sb.from('minds_work_memory')).eq('memory_type','document_state').eq('metadata->>kind','wissensseite').eq('status','confirmed'),
    zahl(sb.from('minds_work_memory')).eq('memory_type','decision').eq('status','proposed'),
    zahl(sb.from('office_wissen_beitraege')).is('eingearbeitet_am',null),
    sb.from('office_wissen_protokoll').select('art,titel,created_at').eq('project_id',project.id).order('created_at',{ascending:false}).limit(3)
  ]);
  const fehler=[team,seiten,offen,beitr,prot].find(r=>r?.error);
  if(fehler)return {data:null,error:fehler.error};
  return {data:{imTeam:!!team.data,seiten:seiten.count||0,offen:offen.count||0,beitraege:beitr.count||0,neu:prot.data||[]},error:null};
}
function panoramaHtml(w,heute=new Date()){
  if(!w||!w.imTeam)return '';
  const tag=iso=>{const d=new Date(iso);if(isNaN(d))return '';
    const t=x=>x.toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'});
    const gestern=new Date(heute.getTime()-864e5);
    return t(d)===t(heute)?'heute':t(d)===t(gestern)?'gestern':d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',timeZone:'Europe/Berlin'})};
  const KURZ={beitrag:'geteilt',seite_neu:'Seite neu',seite_geaendert:'fortgeschrieben',seite_zusammengefuehrt:'zusammengeführt',
    entscheidung_vorgeschlagen:'vorgeschlagen',entscheidung_beschlossen:'beschlossen',entscheidung_verworfen:'verworfen',entscheidung_ersetzt:'ersetzt'};
  const zeile=(ziel,titel,text,klein)=>'<button type="button" class="cockpit-file" data-work-wissen="'+esc(ziel)+'"'+(titel?' data-wissen-titel="'+esc(titel)+'"':'')+
    '><span>'+esc(text)+'</span>'+(klein?'<small>'+esc(klein)+'</small>':'')+'</button>';
  const zeilen=[];
  if(w.offen)zeilen.push(zeile('entscheidungen','',w.offen+(w.offen===1?' Entscheidung':' Entscheidungen')+' zur Bestätigung',''));
  if(w.beitraege)zeilen.push(zeile('neu','',w.beitraege+(w.beitraege===1?' Beitrag wartet':' Beiträge warten')+' auf die KI',''));
  for(const x of w.neu){
    const seite=x.art==='seite_neu'||x.art==='seite_geaendert';
    zeilen.push(zeile(seite?'seite':'neu',seite?x.titel:'',x.titel,[KURZ[x.art]||'',tag(x.created_at)].filter(Boolean).join(' · ')));
  }
  return '<section class="cockpit-panel" aria-labelledby="cockpitWissen"><div class="cockpit-head"><h2 id="cockpitWissen">Neu im Projektwissen</h2>'+
    '<button type="button" class="cockpit-link" data-work-wissen="">Öffnen</button></div>'+
    (w.seiten||zeilen.length?'<p class="cockpit-empty">'+w.seiten+(w.seiten===1?' Seite':' Seiten')+'</p>'+zeilen.join(''):
      '<p class="cockpit-empty">Noch kein Projektwissen. In einem Chat mit Claude «Ins Office übernehmen» sagen.</p>')+'</section>';
}
function vormerken(projektId,ziel){
  const ansicht=['seite','neu','entscheidungen'].includes(ziel?.ansicht)?ziel.ansicht:null;
  zustand={projekt:projektId,ansicht:ansicht==='seite'?null:ansicht,seite:null,suche:'',seiteTitel:ansicht==='seite'&&ziel?.seite?String(ziel.seite):null};
}
const api={render,renderMarkdown,verweise,datum,zeit,panorama,panoramaHtml,vormerken};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.TBA_OFFICE_WISSEN=api;
})(typeof window!=='undefined'?window:globalThis);
