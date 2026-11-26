// TBA Office connector · Ablage (Gari, 26.11.2026: was in Claude-Chats zu einem Projekt erarbeitet wurde, soll ins
// Office, sichtbar für das Projektteam, wie mit dem Window-Connector). Das Panorama des Office zeigt die Projektakte
// (Steckbrief, Register) noch nicht; der Connector legt deshalb dort ab, wo das Team heute nachsieht: im gemeinsamen
// Desktop des Projekts.
//   close_session → je Thema ein Ordner mit datierten Ständen («261126 Stand Lichtplanung.md»). Jeder Stand ist
//     vollständig: Entscheidungen werden fortgeschrieben, offene Fragen, nächste Schritte, Fristen und Quellen ersetzt,
//     wenn angegeben. Die Felder stehen zusätzlich als JSON in metadata.themenblatt, damit der nächste Stand darauf
//     aufbaut und open_topic ihn ohne Download liest.
//   file_document → ein Dokument (Zusammenfassung, Recherche, Notiz, Protokoll, Brief, E-Mail) als Markdown.
// Nichts wird überschrieben oder gelöscht. Schreiben nur mit ausdrücklicher Mitgliedschaft im Projektteam (dieselbe
// Prüfung wie die Projektakte; Storage verlangt sie ebenfalls); alles läuft mit dem Login der Person unter der RLS.
import {ToolError,must,norm,clip,isDay,localDay,TZ,BUCKET} from './office-tools.mjs';
import {matchTopic} from '../_shared/window-akte.mjs';

const ARTEN={dokument:'Dokument',recherche:'Recherche',notiz:'Notiz',protokoll:'Protokoll',brief:'Brief',email:'E-Mail'};
const ORDNER={dokument:'Dokumente',recherche:'Recherchen',notiz:'Notizen',protokoll:'Protokolle',brief:'Briefe',email:'E-Mails'};
const MAX_INHALT=400000;
const liste=(v,n=25,len=600)=>(Array.isArray(v)?v:[]).map(x=>typeof x==='string'?x.trim():x).filter(x=>x&&(typeof x!=='string'||x.length))
  .slice(0,n).map(x=>typeof x==='string'?x.slice(0,len):x);
const deDatum=iso=>{const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'.'+m[2]+'.'+m[1]:String(iso||'')};
const kurz=iso=>String(iso||'').replace(/-/g,'').slice(2,8);
// Wie der Desktop (app/work.js safeName): im Speicherpfad nur ASCII.
const pfadName=s=>String(s||'datei').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,150)||'datei';
const dateiName=s=>String(s||'').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim();
export async function sha256Hex(text){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
const pruefsumme=text=>sha256Hex(norm(text).replace(/\s+/g,' '));

function eintrag(e,heute){
  if(typeof e==='string')return {text:e.trim().slice(0,600),datum:heute,bestaetigt:false};
  return {text:String(e?.text||e?.titel||'').trim().slice(0,600),datum:isDay(e?.datum)?e.datum:heute,
    quelle:e?.quelle?String(e.quelle).slice(0,300):undefined,bestaetigt:!!e?.bestaetigt};
}
function frist(f){
  if(typeof f==='string')return {titel:f.trim().slice(0,400),bestaetigt:false};
  return {titel:String(f?.titel||f?.text||'').trim().slice(0,400),datum:isDay(f?.datum)?f.datum:undefined,
    quelle:f?.quelle?String(f.quelle).slice(0,300):undefined,bestaetigt:!!f?.bestaetigt};
}
const offen=x=>x.bestaetigt?'':' · vorgeschlagen';

export function renderStand(projekt,thema,t,tag){
  const teile=['# '+thema+' · Stand '+deDatum(tag),
    'Projekt: '+projekt.name+(projekt.number?' ('+projekt.number+')':'')+'\nAus einer Sitzung mit Claude abgelegt. «vorgeschlagen» heißt: noch nicht entschieden.',
    '## Stand\n'+t.stand];
  if(t.entscheidungen.length)teile.push('## Entscheidungen\n'+t.entscheidungen.map(e=>'- '+deDatum(e.datum)+': '+e.text+(e.quelle?' (Quelle: '+e.quelle+')':'')+offen(e)).join('\n'));
  if(t.offene_fragen.length)teile.push('## Offene Fragen\n'+t.offene_fragen.map(x=>'- '+x).join('\n'));
  if(t.naechste_schritte.length)teile.push('## Nächste Schritte\n'+t.naechste_schritte.map(x=>'- '+x).join('\n'));
  if(t.fristen.length)teile.push('## Fristen\n'+t.fristen.map(f=>'- '+(f.datum?deDatum(f.datum)+': ':'')+f.titel+(f.quelle?' (Quelle: '+f.quelle+')':'')+offen(f)).join('\n'));
  if(t.quellen.length)teile.push('## Quellen\n'+t.quellen.map(x=>'- '+x).join('\n'));
  return teile.join('\n\n')+'\n';
}

/** @param {{sb:any,userId:string,scope:(ref:string)=>Promise<any>,now?:()=>Date,uuid?:()=>string,tz?:string}} o */
export function createOfficeAblageTools({sb,userId,scope,now=()=>new Date(),uuid=()=>crypto.randomUUID(),tz=TZ}){
  if(!sb||!userId||typeof scope!=='function')throw new TypeError('office_ablage_context_required');
  const heute=()=>localDay(now(),tz);

  // Die Ordner des Projekts sind die des ganzen Teams: ein vorhandener Ordner gleichen Namens wird genutzt, gleich wer
  // ihn angelegt hat; nur was fehlt, wird angelegt (höchstens drei Ebenen).
  async function ordnerFuer(p,pfad){
    const teile=String(pfad||'').split('/').map(s=>s.trim().slice(0,120)).filter(Boolean).slice(0,3);
    if(!teile.length)return {id:null,pfad:''};
    const vorhanden=must(await sb.from('minds_work_folders').select('id,parent_id,name').eq('project_id',p.id).limit(500),'ordner')||[];
    let parent=null;
    for(const name of teile){
      let f=vorhanden.find(x=>(x.parent_id||null)===parent&&norm(x.name)===norm(name));
      if(!f){f=must(await sb.from('minds_work_folders').insert({user_id:userId,project_id:p.id,parent_id:parent,name}).select('id,parent_id,name').single(),'ordner_anlegen');vorhanden.push(f)}
      parent=f.id;
    }
    return {id:parent,pfad:teile.join(' / ')};
  }
  async function ordnerPfad(p,id){
    const alle=must(await sb.from('minds_work_folders').select('id,parent_id,name').eq('project_id',p.id).limit(500),'ordner')||[];
    const byId=new Map(alle.map(f=>[f.id,f])),teile=[];let cur=byId.get(id),g=0;
    while(cur&&g++<12){teile.unshift(cur.name);cur=byId.get(cur.parent_id)}
    return teile.join(' / ');
  }
  async function staendeVon(p){
    const rows=must(await sb.from('minds_work_files').select('id,name,folder_id,metadata,created_at').eq('project_id',p.id)
      .eq('metadata->>kind','themenblatt').order('created_at',{ascending:false}).limit(300),'staende')||[];
    // Je Thema der jüngste Stand (die Liste kommt neueste zuerst).
    const je=new Map();
    for(const r of rows){const t=String(r.metadata?.thema||'').trim();if(t&&!je.has(norm(t)))je.set(norm(t),{title:t,datei:r})}
    return [...je.values()];
  }
  async function schreiben(p,ordnerId,name,text,metadata,sourceKind='document'){
    const bytes=new TextEncoder().encode(text);
    const path=userId+'/'+p.id+'/'+(ordnerId||'root')+'/'+now().getTime()+'-'+String(uuid()).replace(/-/g,'').slice(0,6)+'-'+pfadName(name);
    const up=await sb.storage.from(BUCKET).upload(path,new Blob([bytes],{type:'text/markdown'}),{contentType:'text/markdown; charset=utf-8',upsert:false});
    if(up?.error)throw new Error('upload: '+(up.error.message||'failed'));
    const ins=await sb.from('minds_work_files').insert({user_id:userId,project_id:p.id,folder_id:ordnerId,name,mime_type:'text/markdown',
      size_bytes:bytes.length,storage_path:path,source_kind:sourceKind,metadata}).select('id,name').single();
    if(ins?.error){try{await sb.storage.from(BUCKET).remove([path])}catch{}throw new Error('datei: '+(ins.error.message||'failed'))}
    return ins.data;
  }
  async function freierName(p,ordnerId,name){
    let q=sb.from('minds_work_files').select('id').eq('project_id',p.id).eq('name',name);
    q=ordnerId?q.eq('folder_id',ordnerId):q.is('folder_id',null);
    const gleich=must(await q.limit(1),'name')||[];
    if(!gleich.length)return name;
    const uhr=new Intl.DateTimeFormat('de-DE',{timeZone:tz,hour:'2-digit',minute:'2-digit'}).format(now()).replace(':','.');
    return name.replace(/\.md$/,'')+' '+uhr+'.md';
  }
  async function doppelt(p,hash){
    const rows=must(await sb.from('minds_work_files').select('id,name').eq('project_id',p.id).eq('metadata->>content_sha256',hash).limit(1),'doppelt')||[];
    return rows[0]||null;
  }

  async function closeSession(args={}){
    const p=await scope(args.project);
    const staende=await staendeVon(p);
    const gesucht=String(args.topic||'').trim().slice(0,120);
    if(!gesucht)throw new ToolError('Gib das Thema an (topic), z. B. «Lichtplanung».');
    let thema=null;
    const {match,candidates}=matchTopic(staende,gesucht);
    if(match)thema=match;
    else if(!args.neues_thema)return {gespeichert:false,projekt:p.name,grund:'Kein eindeutiges Thema für «'+gesucht+'».',
      vorschlaege:candidates.map(t=>t.title),themen:staende.map(t=>t.title),
      hinweis:'Mit der Person den Titel klären; für ein neues Thema neues_thema=true setzen.'};
    const titel=thema?thema.title:gesucht,vorher=thema?.datei?.metadata?.themenblatt||{},tag=heute();
    const neue=liste(args.entscheidungen,30).map(e=>eintrag(e,tag)).filter(e=>e.text);
    const entscheidungen=[...liste(vorher.entscheidungen,40)];
    for(const e of neue)if(!entscheidungen.some(x=>norm(x.text)===norm(e.text)))entscheidungen.push(e);
    const t={stand:String(args.stand||'').trim().slice(0,4000)||String(vorher.stand||''),
      entscheidungen:entscheidungen.slice(-40),
      offene_fragen:args.offene_fragen!==undefined?liste(args.offene_fragen):liste(vorher.offene_fragen),
      naechste_schritte:args.naechste_schritte!==undefined?liste(args.naechste_schritte):liste(vorher.naechste_schritte),
      fristen:args.fristen!==undefined?liste(args.fristen).map(frist).filter(f=>f.titel):liste(vorher.fristen),
      quellen:args.quellen!==undefined?liste(args.quellen,30,300):liste(vorher.quellen,30,300)};
    if(!t.stand)throw new ToolError('Es fehlt «stand»: in ein bis drei Sätzen, wo das Thema steht.');
    const text=renderStand(p,titel,t,tag);
    const hash=await pruefsumme(text.replace(/^# .*\n/,''));
    const gleich=await doppelt(p,hash);
    if(gleich)return {gespeichert:false,unveraendert:true,projekt:p.name,thema:titel,datei:{id:gleich.id,name:gleich.name},
      hinweis:'Dieser Stand liegt schon so im Desktop; nichts Neues abgelegt.'};
    // Ein bekanntes Thema bleibt in seinem Ordner (auch wenn ihn jemand umbenannt oder verschoben hat); ein neues bekommt
    // einen Ordner mit seinem Namen, außer es ist ausdrücklich ein anderer genannt.
    const ordner=args.ordner||!thema?.datei?.folder_id?await ordnerFuer(p,args.ordner||titel)
      :{id:thema.datei.folder_id,pfad:await ordnerPfad(p,thema.datei.folder_id)};
    const name=await freierName(p,ordner.id,dateiName(kurz(tag)+' Stand '+titel).slice(0,200)+'.md');
    const datei=await schreiben(p,ordner.id,name,text,{kind:'themenblatt',thema:titel,themenblatt:{...t,aktualisiert_am:now().toISOString()},
      content_sha256:hash,datum:tag,source:'claude_connector'});
    return {gespeichert:true,projekt:p.name,thema:titel,neues_thema:!thema||undefined,ordner:ordner.pfad||undefined,
      datei:{id:datei.id,name:datei.name},stand:text,
      hinweis:'Im Desktop des Projekts für das ganze Team sichtbar; die KI des Office liest es in den nächsten Minuten.'};
  }

  async function fileDocument(args={}){
    const p=await scope(args.project);
    const inhalt=String(args.inhalt||'').trim(),art=ARTEN[args.art]?args.art:'dokument';
    if(inhalt.length<20)throw new ToolError('Das Dokument ist leer oder zu kurz.');
    if(inhalt.length>MAX_INHALT)throw new ToolError('Das Dokument ist zu lang, um es auf einmal abzulegen (höchstens 400.000 Zeichen).');
    if(args.datum&&!isDay(args.datum))throw new ToolError('datum im Format JJJJ-MM-TT.');
    const titel=dateiName(args.titel||args.betreff||ARTEN[art]).slice(0,140);
    const hash=await pruefsumme(inhalt);
    const gleich=await doppelt(p,hash);
    if(gleich)return {abgelegt:false,bereits_vorhanden:{id:gleich.id,name:gleich.name},hinweis:'Dieser Inhalt liegt schon im Desktop des Projekts; kein Duplikat angelegt.'};
    let themaTitel=null;
    if(args.thema){const {match}=matchTopic(await staendeVon(p),args.thema);themaTitel=match?match.title:String(args.thema).trim().slice(0,120)}
    const tag=isDay(args.datum)?args.datum:heute();
    const kopf=[['Art',ARTEN[art]],['Datum',deDatum(tag)],['Von',args.von],['An',args.an],['Betreff',args.betreff],['Thema',themaTitel]]
      .filter(([,v])=>v).map(([k,v])=>k+': '+String(v).slice(0,300)).join('\n');
    const text='# '+titel+'\n\n'+kopf+'\nAus einer Sitzung mit Claude abgelegt.\n\n---\n\n'+inhalt+'\n';
    const ordner=await ordnerFuer(p,args.ordner||themaTitel||ORDNER[art]);
    const name=await freierName(p,ordner.id,(kurz(tag)+' '+(art==='email'?'E-Mail ':'')+titel).slice(0,200)+'.md');
    const datei=await schreiben(p,ordner.id,name,text,{kind:'dokument',art,thema:themaTitel||undefined,datum:tag,von:args.von||undefined,
      an:args.an||undefined,betreff:args.betreff||undefined,content_sha256:hash,source:'claude_connector'},art==='email'?'email':'document');
    return {abgelegt:true,projekt:p.name,ordner:ordner.pfad,datei:{id:datei.id,name:datei.name},
      hinweis:'Im Desktop des Projekts für das ganze Team sichtbar; die KI des Office liest es in den nächsten Minuten.'};
  }

  // Zum Weiterarbeiten: die Themen mit ihrem jüngsten Stand (open_project) und der letzte Stand eines Themas (open_topic).
  async function themen({project}={}){
    const p=await scope(project);
    return (await staendeVon(p)).map(t=>({thema:t.title,stand_vom:String(t.datei.metadata?.datum||t.datei.created_at||'').slice(0,10),
      datei:{id:t.datei.id,name:t.datei.name},kurz:clip(t.datei.metadata?.themenblatt?.stand||'',240)}));
  }
  async function letzterStand({project,topic}={}){
    const p=await scope(project);
    const {match,candidates}=matchTopic(await staendeVon(p),topic);
    if(!match)return candidates.length?{gefunden:false,vorschlaege:candidates.map(t=>t.title)}:null;
    const t=match.datei.metadata?.themenblatt||{};
    return {thema:match.title,stand_vom:String(match.datei.metadata?.datum||match.datei.created_at||'').slice(0,10),
      datei:{id:match.datei.id,name:match.datei.name},
      text:renderStand(p,match.title,{stand:String(t.stand||''),entscheidungen:liste(t.entscheidungen,40),offene_fragen:liste(t.offene_fragen),
        naechste_schritte:liste(t.naechste_schritte),fristen:liste(t.fristen),quellen:liste(t.quellen,30,300)},match.datei.metadata?.datum||heute())};
  }
  return {closeSession,fileDocument,themen,letzterStand};
}
