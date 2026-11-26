// TBA Office connector · Projektwissen (Gari, 26.11.2026): der gemeinsame Wissenspool eines Projekts. Mit «Ins Office
// übernehmen» («pásalo al Office») teilt Claude, was in einem Chat erarbeitet wurde, und arbeitet es in die Seiten ein,
// die das ganze Projektteam im Office liest (Work → Wissen). Niemand im Team muss etwas ordnen:
// Claude legt Seiten an, führt sie zusammen, schreibt sie fort, verweist und benennt Widersprüche.
// Geschrieben wird nur über die Funktionen der Datenbank (office_wissen_*): sie prüfen die Mitgliedschaft, halten jede
// frühere Fassung fest und lassen Entscheidungen Vorschlag, bis die Projektleitung sie bestätigt. Vorher prüft der
// Connector die ausdrückliche Mitgliedschaft im Projektteam (wie bei der Projektakte).
import {ToolError,must,norm,clip,isDay} from './office-tools.mjs';
import {matchTopic} from '../_shared/window-akte.mjs';

const isId=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s||''));
const ARTEN=['chat','thread','korrektur','notiz'];
const ART_NAME={chat:'aus einem Chat',thread:'aus einem Thread',korrektur:'Hinweis',notiz:'Notiz'};
const PROTOKOLL={beitrag:'Beitrag geteilt',seite_neu:'Seite angelegt',seite_geaendert:'Seite fortgeschrieben',seite_zusammengefuehrt:'Seiten zusammengeführt',
  entscheidung_vorgeschlagen:'Entscheidung vorgeschlagen',entscheidung_beschlossen:'Entscheidung beschlossen',
  entscheidung_verworfen:'Entscheidung verworfen',entscheidung_ersetzt:'Entscheidung ersetzt'};
const STATUS={proposed:'vorgeschlagen',confirmed:'beschlossen',superseded:'ersetzt',rejected:'verworfen',resolved:'erledigt'};
const tag=iso=>String(iso||'').slice(0,10)||null;
// Für ilike: Platzhalter und die Trenner von or() neutralisieren.
const muster=q=>'%'+String(q||'').replace(/[%_,()"\\]/g,' ').trim()+'%';
// [[Titel]] als ilike-Muster: Platzhalter im Titel gelten wörtlich.
const verweisMuster=titel=>'%[['+String(titel||'').replace(/[\\%_]/g,'\\$&')+']]%';
export {verweisMuster,muster as suchMuster};
export const verweise=text=>[...new Set([...String(text||'').matchAll(/\[\[([^\]\n]{1,200})\]\]/g)].map(m=>m[1].trim()).filter(Boolean))];

// Fehler der Funktionen als Satz, den Claude so weitergeben kann.
function antwort(res,label){
  if(!res?.error)return res?.data;
  const code=String(res.error.code||''),text=String(res.error.message||'').trim();
  if(code==='42501')throw new ToolError(text||'Kein Zugang zu diesem Projekt.');
  if(code==='22023')throw new ToolError(text||'Die Angaben sind unvollständig.');
  if(code==='40001')throw new ToolError((text||'Die Seite wurde inzwischen geändert.')+' Lies sie mit read_page neu und schreibe dann mit dem neuen Stand (basis).');
  if(code==='23505')throw new ToolError('Eine Seite mit diesem Titel ist gerade entstanden. Lies sie mit read_page und schreibe sie fort.');
  throw new Error(label+': '+(text||code||'failed'));
}

/** @param {{sb:any,userId:string,scope:(ref:string)=>Promise<any>}} o */
export function createOfficeWissenTools({sb,userId,scope}){
  if(!sb||!userId||typeof scope!=='function')throw new TypeError('office_wissen_context_required');

  const seitenQuery=(p,cols)=>sb.from('minds_work_memory').select(cols).eq('project_id',p.id).eq('memory_type','document_state')
    .eq('metadata->>kind','wissensseite');
  async function seiten(p){
    return must(await seitenQuery(p,'id,title,metadata,updated_at').eq('status','confirmed').order('updated_at',{ascending:false}).limit(400),'seiten')||[];
  }
  async function namen(){
    const rows=must(await sb.from('office_members').select('user_id,display_name').limit(500),'namen')||[];
    return new Map(rows.map(r=>[r.user_id,r.display_name||'']));
  }
  async function regeln(){
    const r=await sb.from('office_wissen_regeln').select('text').limit(1).maybeSingle();
    return r?.data?.text||'';
  }
  const liste=s=>({titel:s.title,kurz:s.metadata?.kurz||undefined,stand:s.updated_at});

  async function uebersicht({project}={}){
    const p=await scope(project);
    const [s,ents,offen,neu,leute]=await Promise.all([
      seiten(p),
      sb.from('minds_work_memory').select('id,title,status,occurred_at,created_at').eq('project_id',p.id).eq('memory_type','decision')
        .in('status',['proposed','confirmed']).order('created_at',{ascending:false}).limit(60),
      sb.from('office_wissen_beitraege').select('id,titel,art,seite,created_at,user_id').eq('project_id',p.id).is('eingearbeitet_am',null)
        .order('created_at',{ascending:true}).limit(30),
      sb.from('office_wissen_protokoll').select('art,titel,created_at,user_id').eq('project_id',p.id).order('created_at',{ascending:false}).limit(12),
      namen()
    ]);
    const e=must(ents,'entscheidungen')||[];
    return {seiten:s.map(liste),
      entscheidungen:{beschlossen:e.filter(x=>x.status==='confirmed').slice(0,20).map(x=>({id:x.id,titel:x.title,datum:tag(x.occurred_at)||tag(x.created_at)})),
        vorgeschlagen:e.filter(x=>x.status==='proposed').map(x=>({id:x.id,titel:x.title,datum:tag(x.occurred_at)||tag(x.created_at)}))},
      offene_beitraege:(must(offen,'offene')||[]).map(b=>({id:b.id,titel:b.titel,art:ART_NAME[b.art]||b.art,seite:b.seite||undefined,am:tag(b.created_at),von:leute.get(b.user_id)||undefined})),
      neu:(must(neu,'protokoll')||[]).map(x=>({was:PROTOKOLL[x.art]||x.art,titel:x.titel,am:String(x.created_at||'').slice(0,16).replace('T',' '),von:leute.get(x.user_id)||undefined})),
      hinweis:s.length?undefined:'Noch kein Projektwissen. Mit share_knowledge und write_page entstehen die ersten Seiten.'};
  }

  async function teilen({project,titel,inhalt,quelle,art='chat',seite}={}){
    const p=await scope(project);
    const text=String(inhalt||'').trim();
    if(text.length<20)throw new ToolError('Der Beitrag ist leer oder zu kurz. Teile das Wissen aus dem Chat vollständig, auf Deutsch.');
    if(text.length>200000)throw new ToolError('Der Beitrag ist zu lang (höchstens 200.000 Zeichen). Teile ihn in mehrere Beiträge.');
    if(!ARTEN.includes(art))throw new ToolError('art: chat, thread, korrektur oder notiz.');
    const id=antwort(await sb.rpc('office_wissen_beitrag_teilen',{p_project:p.id,p_titel:String(titel||'').trim().slice(0,200)||'Beitrag',
      p_inhalt:text,p_art:art,p_quelle:quelle?String(quelle).slice(0,500):null,p_seite:seite?String(seite).slice(0,200):null}),'teilen');
    const [s,r]=await Promise.all([seiten(p),regeln()]);
    return {beitrag_id:id,projekt:p.name,seiten:s.map(liste),regeln:r||undefined,
      naechster_schritt:'Jetzt einarbeiten: jede betroffene Seite mit read_page lesen und mit write_page als aktuellen Stand neu schreiben '+
        '(quellen:[beitrag_id], basis:stand). Eine neue Seite nur, wenn das Neue zu keiner passt; Zusammengehöriges zusammenführen. '+
        'Entscheidungen mit record_decision. Danach der Person in 3–5 Zeilen sagen, was sich geändert hat.'};
  }

  async function seiteLesen({project,titel}={}){
    const p=await scope(project);
    const gesucht=String(titel||'').trim();
    if(!gesucht)throw new ToolError('Gib den Titel der Seite an.');
    const alle=await seiten(p);
    let treffer=alle.find(s=>norm(s.title)===norm(gesucht))||null,weiter=null;
    if(!treffer){
      // Eine zusammengeführte Seite leitet auf die Seite weiter, in der sie aufgegangen ist.
      const alt=must(await seitenQuery(p,'title,metadata').eq('status','superseded').limit(200),'zusammengefuehrt')||[];
      const ziel=alt.find(s=>norm(s.title)===norm(gesucht))?.metadata?.zusammengefuehrt_in;
      if(ziel){treffer=alle.find(s=>norm(s.title)===norm(ziel))||null;weiter=ziel}
    }
    if(!treffer){
      const {match,candidates}=matchTopic(alle,gesucht);
      if(!match)return {gefunden:false,gesucht,vorschlaege:candidates.map(s=>s.title),alle_seiten:alle.map(s=>s.title),
        hinweis:'Keine Seite mit diesem Titel. Passt das Neue zu einer bestehenden Seite, schreibe dort; sonst lege mit write_page eine neue an.'};
      treffer=match;
    }
    const [voll,quellenQ,hinweiseQ,versionenQ,leute]=await Promise.all([
      sb.from('minds_work_memory').select('id,title,body,metadata,updated_at').eq('id',treffer.id).maybeSingle(),
      (treffer.metadata?.quellen||[]).filter(isId).length
        ?sb.from('office_wissen_beitraege').select('id,titel,art,quelle,created_at,user_id').in('id',(treffer.metadata.quellen||[]).filter(isId).slice(0,100))
        :Promise.resolve({data:[]}),
      sb.from('office_wissen_beitraege').select('id,titel,art,created_at,user_id,seite').eq('project_id',p.id).is('eingearbeitet_am',null).limit(60),
      sb.from('office_wissen_versionen').select('id',{count:'exact',head:true}).eq('seite_id',treffer.id),
      namen()
    ]);
    const s=must(voll,'seite');
    if(!s)throw new ToolError('Die Seite ist nicht mehr da. Lies die Übersicht mit open_project neu.');
    // Verweise hierher: andere Seiten, die sie mit [[Titel]] nennen (gezielt gesucht, nicht alle Seiten geladen).
    const texte=(must(await seitenQuery(p,'id,title,body').eq('status','confirmed').ilike('body',verweisMuster(s.title)).limit(40),'verweise')||[])
      .filter(t=>t.id!==s.id);
    return {titel:s.title,weitergeleitet_von:weiter||undefined,kurz:s.metadata?.kurz||undefined,stand:s.updated_at,inhalt:s.body,
      zuletzt_von:leute.get(s.metadata?.aktualisiert_von)||undefined,
      quellen:(must(quellenQ,'quellen')||[]).map(b=>({id:b.id,titel:b.titel,art:ART_NAME[b.art]||b.art,quelle:b.quelle||undefined,am:tag(b.created_at),von:leute.get(b.user_id)||undefined})),
      offene_hinweise:(must(hinweiseQ,'hinweise')||[]).filter(b=>b.seite&&norm(b.seite)===norm(s.title)).map(b=>({id:b.id,titel:b.titel,art:ART_NAME[b.art]||b.art,am:tag(b.created_at),von:leute.get(b.user_id)||undefined})),
      fruehere_fassungen:versionenQ?.count||0,
      verweist_auf:verweise(s.body),
      verweise_hierher:texte.filter(t=>verweise(t.body).some(v=>norm(v)===norm(s.title))).map(t=>t.title)};
  }

  async function seiteSchreiben({project,titel,inhalt,kurz,quellen=[],basis,grund,zusammenfuehren=[]}={}){
    const p=await scope(project);
    const t=String(titel||'').trim(),text=String(inhalt||'');
    if(!t||t.length>200)throw new ToolError('Der Titel fehlt oder ist zu lang (höchstens 200 Zeichen).');
    if(!text.trim())throw new ToolError('Der Inhalt der Seite fehlt.');
    if(text.length>100000)throw new ToolError('Die Seite ist zu lang (höchstens 100.000 Zeichen). Teile sie in zwei Seiten und verweise mit [[Titel]].');
    if(basis!=null&&basis!==''&&isNaN(Date.parse(String(basis))))throw new ToolError('basis: der Stand aus read_page, unverändert.');
    const zusammen=(Array.isArray(zusammenfuehren)?zusammenfuehren:[]).map(x=>String(x).trim()).filter(Boolean).slice(0,20);
    const rows=antwort(await sb.rpc('office_wissen_seite_schreiben',{p_project:p.id,p_titel:t,p_inhalt:text,p_kurz:kurz?String(kurz).slice(0,300):null,
      p_quellen:(Array.isArray(quellen)?quellen:[]).filter(isId),p_basis:basis||null,p_grund:grund?String(grund).slice(0,300):null,
      p_zusammenfuehren:zusammen}),'seite');
    const r=Array.isArray(rows)?rows[0]:rows;
    if(!r)throw new Error('seite: keine Antwort');
    return {titel:r.seite_titel,neu:!!r.ist_neu,stand:r.seite_stand,weitergeleitet:norm(r.seite_titel)!==norm(t)?t:undefined,
      zusammengefuehrt:zusammen.length?zusammen:undefined};
  }

  async function entscheidung({project,titel,details,datum,quelle,beitrag_id,seite,beschlossen=false,ersetzt}={}){
    const p=await scope(project);
    if(datum&&!isDay(datum))throw new ToolError('datum im Format JJJJ-MM-TT.');
    if(ersetzt&&!isId(ersetzt))throw new ToolError('ersetzt: die id einer Entscheidung aus open_project.');
    const rows=antwort(await sb.rpc('office_wissen_entscheidung',{p_project:p.id,p_titel:String(titel||'').trim(),p_details:details?String(details).slice(0,4000):null,
      p_datum:datum||null,p_quelle:quelle?String(quelle).slice(0,300):null,p_beitrag:isId(beitrag_id)?beitrag_id:null,p_seite:seite?String(seite).slice(0,200):null,
      p_beschlossen:!!beschlossen,p_ersetzt:ersetzt||null}),'entscheidung');
    const r=Array.isArray(rows)?rows[0]:rows;
    const status=STATUS[r?.entscheidung_status]||r?.entscheidung_status;
    return {id:r?.entscheidung_id,status,
      hinweis:status==='vorgeschlagen'?'Vorgeschlagen: die Projektleitung bestätigt es im Office (Work → Wissen → Entscheidungen).':undefined};
  }

  async function suchen({project,query,limit=12}={}){
    const p=await scope(project);
    const q=String(query||'').trim();
    if(q.length<2)throw new ToolError('Mindestens zwei Zeichen für die Suche.');
    const cap=Math.min(Math.max(Number(limit)||12,1),30),like=muster(q);
    const [s,e,b]=await Promise.all([
      seitenQuery(p,'title,body,metadata,updated_at').eq('status','confirmed').or('title.ilike.'+like+',body.ilike.'+like).limit(cap),
      sb.from('minds_work_memory').select('id,title,body,status,occurred_at').eq('project_id',p.id).eq('memory_type','decision').or('title.ilike.'+like+',body.ilike.'+like).limit(cap),
      sb.from('office_wissen_beitraege').select('id,titel,inhalt,art,created_at').eq('project_id',p.id).or('titel.ilike.'+like+',inhalt.ilike.'+like).limit(cap)
    ]);
    const n=norm(q);
    const stelle=t=>{const s=String(t||''),i=norm(s).indexOf(n),a=Math.max(0,(i<0?0:i)-160);return (a>0?'…':'')+s.slice(a,a+420).replace(/\s+/g,' ')+(a+420<s.length?'…':'')};
    return {query:q,projekt:p.name,
      seiten:(must(s,'suche_seiten')||[]).map(x=>({titel:x.title,kurz:x.metadata?.kurz||undefined,stelle:stelle(x.body),stand:x.updated_at})),
      entscheidungen:(must(e,'suche_entscheidungen')||[]).map(x=>({id:x.id,titel:x.title,status:STATUS[x.status]||x.status,datum:tag(x.occurred_at)||undefined})),
      beitraege:(must(b,'suche_beitraege')||[]).map(x=>({id:x.id,titel:x.titel,art:ART_NAME[x.art]||x.art,am:tag(x.created_at),stelle:stelle(x.inhalt)}))};
  }

  async function beitragLesen({project,beitrag_id,offset=0,max_chars=30000}={}){
    const p=await scope(project);
    if(!isId(beitrag_id))throw new ToolError('beitrag_id aus open_project, read_page oder search_knowledge.');
    const b=must(await sb.from('office_wissen_beitraege').select('id,titel,inhalt,art,quelle,seite,eingearbeitet_in,created_at,user_id')
      .eq('id',beitrag_id).eq('project_id',p.id).maybeSingle(),'beitrag');
    if(!b)throw new ToolError('Diesen Beitrag gibt es in diesem Projekt nicht.');
    const start=Math.max(0,Number(offset)||0),cap=Math.min(Math.max(Number(max_chars)||30000,1000),60000);
    const teil=b.inhalt.slice(start,start+cap),leute=await namen();
    return {id:b.id,titel:b.titel,art:ART_NAME[b.art]||b.art,quelle:b.quelle||undefined,seite:b.seite||undefined,am:tag(b.created_at),
      von:leute.get(b.user_id)||undefined,eingearbeitet_in:b.eingearbeitet_in?.length?b.eingearbeitet_in:undefined,
      offset:start,next_offset:start+teil.length<b.inhalt.length?start+teil.length:null,total_chars:b.inhalt.length,inhalt:teil};
  }

  return {uebersicht,teilen,seiteLesen,seiteSchreiben,entscheidung,suchen,beitragLesen};
}
