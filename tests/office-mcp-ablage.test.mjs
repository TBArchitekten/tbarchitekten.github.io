// Office-Connector · Ablage (Gari, 26.11.2026): was in Claude-Chats zu einem Projekt erarbeitet wurde, legt Claude im
// gemeinsamen Desktop des Projekts ab, sichtbar für das Projektteam. Hier: Thema festhalten (datierte Stände, die
// aufeinander aufbauen), Dokument ablegen, nur für das Projektteam, nichts doppelt, und die Anbindung im Server.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOfficeAblageTools} from '../supabase/functions/office-mcp/office-ablage.mjs';
import {ToolError} from '../supabase/functions/office-mcp/office-tools.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const ME='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222';
const P='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJEKT={id:P,client_key:P,name:'Testprojekt',number:'T-01',archived:false};
const now=()=>new Date('2026-11-26T10:00:00Z');
// Nur wer im Team ist, bekommt das Projekt (wie scopedProject der Projektakte).
const scope=async ref=>{if(ref==='Testprojekt')return PROJEKT;throw new ToolError('Die Projektakte ist für dieses Konto nicht verfügbar.')};

// Eine kleine Datenbank im Speicher, die die Abfragen des Moduls versteht (eq auch auf metadata->>feld, is, order, limit,
// insert … select … single) und den Speicher mitschreibt.
function fakeDb(){
  const tables={minds_work_folders:[],minds_work_files:[]},uploads=[],removed=[];let n=0;
  const get=(row,f)=>{const m=String(f).match(/^(\w+)->>(\w+)$/);if(m){const v=row[m[1]]?.[m[2]];return v==null?null:String(v)}return row[f]??null};
  function from(table){
    const ops=[];let inserted=null;
    const rows=()=>{
      let r=(tables[table]||[]).filter(row=>ops.every(([k,f,v])=>k==='eq'?get(row,f)===v:k==='is'?get(row,f)===v:true));
      const o=ops.find(x=>x[0]==='order');
      if(o)r=[...r].sort((a,b)=>String(get(a,o[1])).localeCompare(String(get(b,o[1])))*(o[2]?.ascending===false?-1:1));
      const l=ops.find(x=>x[0]==='limit');return l?r.slice(0,l[1]):r;
    };
    const api={
      select:()=>api,eq:(f,v)=>(ops.push(['eq',f,v]),api),is:(f,v)=>(ops.push(['is',f,v]),api),
      order:(f,o)=>(ops.push(['order',f,o]),api),limit:x=>(ops.push(['limit',x]),api),
      insert:row=>{n++;inserted={id:table+'-'+n,created_at:new Date(Date.UTC(2026,10,26,9,0,n)).toISOString(),...row};(tables[table]||=[]).push(inserted);return api},
      single:async()=>({data:inserted||rows()[0]||null,error:null}),
      maybeSingle:async()=>({data:rows()[0]||null,error:null}),
      then:(ok,bad)=>Promise.resolve({data:inserted?[inserted]:rows(),error:null}).then(ok,bad)
    };
    return api;
  }
  const storage={from:bucket=>({
    upload:async(path,blob,opts)=>{uploads.push({bucket,path,text:await blob.text(),opts});return {error:null}},
    remove:async paths=>{removed.push(...paths);return {error:null}}})};
  return {sb:{from,storage},tables,uploads,removed};
}
const ablage=(db,userId=ME)=>createOfficeAblageTools({sb:db.sb,userId,scope,now,uuid:()=>'abcdef12-0000-4000-8000-000000000000'});

test('Thema festhalten: neues Thema nur nach Rückfrage; eigener Ordner; datierter Stand im Desktop des Teams',async()=>{
  const db=fakeDb(),t=ablage(db);
  const ohne=await t.closeSession({project:'Testprojekt',topic:'Lichtplanung',stand:'Konzept steht.'});
  assert.equal(ohne.gespeichert,false,'ein neues Thema legt Claude nicht ungefragt an');
  assert.equal(db.uploads.length,0);assert.equal(db.tables.minds_work_files.length,0);
  const r=await t.closeSession({project:'Testprojekt',topic:'Lichtplanung',neues_thema:true,
    stand:'Das Lichtkonzept für die Flure steht, die Leuchten sind noch offen.',
    entscheidungen:[{text:'Downlights in den Fluren',bestaetigt:true},'Lichtplaner beauftragen'],
    offene_fragen:['Leuchten im Treppenhaus?'],fristen:[{titel:'Abgabe Lichtkonzept',datum:'2026-12-15'}],quellen:['Chat «Lichtplanung»']});
  assert.equal(r.gespeichert,true);assert.equal(r.neues_thema,true);assert.equal(r.ordner,'Lichtplanung');
  const ordner=db.tables.minds_work_folders[0];
  assert.deepEqual([ordner.name,ordner.project_id,ordner.user_id,ordner.parent_id],['Lichtplanung',P,ME,null]);
  const up=db.uploads[0],datei=db.tables.minds_work_files[0];
  assert.equal(up.bucket,'minds-work');
  assert.ok(up.path.startsWith(ME+'/'+P+'/'+ordner.id+'/'),'Pfad wie der Desktop: Person / Projekt / Ordner (Storage-Regel)');
  assert.match(up.path,/-261126-Stand-Lichtplanung\.md$/);
  assert.equal(up.opts.contentType,'text/markdown; charset=utf-8');assert.equal(up.opts.upsert,false,'nichts wird überschrieben');
  assert.deepEqual([datei.name,datei.project_id,datei.folder_id,datei.user_id,datei.mime_type,datei.source_kind,datei.storage_path],
    ['261126 Stand Lichtplanung.md',P,ordner.id,ME,'text/markdown','document',up.path]);
  assert.deepEqual([datei.metadata.kind,datei.metadata.thema,datei.metadata.source,datei.metadata.datum],['themenblatt','Lichtplanung','claude_connector','2026-11-26']);
  assert.match(datei.metadata.content_sha256,/^[0-9a-f]{64}$/);
  assert.equal(datei.size_bytes,new TextEncoder().encode(up.text).length);
  for(const zeile of ['# Lichtplanung · Stand 26.11.2026','Projekt: Testprojekt (T-01)','## Stand\nDas Lichtkonzept für die Flure steht',
    '## Entscheidungen\n- 26.11.2026: Downlights in den Fluren\n- 26.11.2026: Lichtplaner beauftragen · vorgeschlagen',
    '## Offene Fragen\n- Leuchten im Treppenhaus?','## Fristen\n- 15.12.2026: Abgabe Lichtkonzept · vorgeschlagen','## Quellen\n- Chat «Lichtplanung»'])
    assert.ok(up.text.includes(zeile),zeile);
  assert.equal(r.stand,up.text);
  await assert.rejects(()=>t.closeSession({project:'Testprojekt',topic:'Neu',neues_thema:true,stand:''}),/stand/);
});

test('Thema festhalten: der nächste Stand baut auf dem letzten auf; gleicher Stand nicht doppelt; Ordner bleibt',async()=>{
  const db=fakeDb(),t=ablage(db);
  await t.closeSession({project:'Testprojekt',topic:'Lichtplanung',neues_thema:true,stand:'Erster Stand.',
    entscheidungen:['Lichtplaner beauftragen'],offene_fragen:['Leuchten im Treppenhaus?'],fristen:[{titel:'Abgabe Lichtkonzept',datum:'2026-12-15'}]});
  const zweiter={project:'Testprojekt',topic:'Lichtplanung 3. BA',stand:'Zweiter Stand: Angebot angefragt.',
    entscheidungen:['Lichtplaner beauftragen','Akzentlicht im Foyer'],naechste_schritte:['Angebot einholen']};
  const r=await t.closeSession(zweiter);
  assert.equal(r.gespeichert,true);assert.equal(r.thema,'Lichtplanung','«Lichtplanung 3. BA» ist das bekannte Thema');
  assert.equal(db.tables.minds_work_folders.length,1,'kein zweiter Ordner');
  const [erste,neue]=db.tables.minds_work_files;
  assert.equal(neue.folder_id,erste.folder_id);
  assert.equal(neue.name,'261126 Stand Lichtplanung 11.00.md','am selben Tag mit der Uhrzeit');
  const tb=neue.metadata.themenblatt;
  assert.deepEqual(tb.entscheidungen.map(e=>e.text),['Lichtplaner beauftragen','Akzentlicht im Foyer'],'Entscheidungen fortgeschrieben, ohne Doppel');
  assert.deepEqual(tb.offene_fragen,['Leuchten im Treppenhaus?'],'ohne Angabe bleibt die Liste');
  assert.deepEqual(tb.naechste_schritte,['Angebot einholen']);
  assert.deepEqual(tb.fristen.map(f=>[f.titel,f.datum]),[['Abgabe Lichtkonzept','2026-12-15']]);
  const gleich=await t.closeSession(zweiter);
  assert.equal(gleich.gespeichert,false);assert.equal(gleich.unveraendert,true);
  assert.equal(db.uploads.length,2,'ein gleicher Stand wird nicht noch einmal abgelegt');
  const unklar=await t.closeSession({project:'Testprojekt',topic:'Bodenbelag',stand:'x'});
  assert.equal(unklar.gespeichert,false);assert.deepEqual(unklar.themen,['Lichtplanung']);
});

test('Dokument ablegen: Ordner nach Thema oder Art, E-Mail mit Kopf, kein Duplikat im ganzen Team',async()=>{
  const db=fakeDb(),t=ablage(db);
  await t.closeSession({project:'Testprojekt',topic:'Lichtplanung',neues_thema:true,stand:'Erster Stand.'});
  const inhalt='Vergleich von drei Bodenbelägen für die Flure: Linoleum, Kautschuk und Terrazzo, mit Vor- und Nachteilen.';
  const r=await t.fileDocument({project:'Testprojekt',titel:'Bodenbelag Recherche',inhalt,art:'recherche'});
  assert.equal(r.abgelegt,true);assert.equal(r.ordner,'Recherchen');
  const d=db.tables.minds_work_files.at(-1);
  assert.deepEqual([d.name,d.mime_type,d.source_kind,d.metadata.kind,d.metadata.art],['261126 Bodenbelag Recherche.md','text/markdown','document','dokument','recherche']);
  assert.ok(db.uploads.at(-1).text.startsWith('# Bodenbelag Recherche\n\nArt: Recherche\nDatum: 26.11.2026\nAus einer Sitzung mit Claude abgelegt.\n\n---\n\n'+inhalt));
  const kollegin=await ablage(db,OTHER).fileDocument({project:'Testprojekt',titel:'Andere Überschrift',inhalt:'  '+inhalt+'  '});
  assert.equal(kollegin.abgelegt,false);assert.equal(kollegin.bereits_vorhanden.name,'261126 Bodenbelag Recherche.md','auch wenn es jemand anderes abgelegt hat');
  const mail=await t.fileDocument({project:'Testprojekt',titel:'Rückfrage Leuchten',art:'email',datum:'2026-11-20',von:'Lichtplanung GmbH',an:'Büro',betreff:'Leuchten Treppenhaus',
    inhalt:'Sehr geehrte Damen und Herren, anbei die Rückfrage zu den Leuchten im Treppenhaus.'});
  const m=db.tables.minds_work_files.at(-1);
  assert.equal(mail.ordner,'E-Mails');assert.equal(m.name,'261120 E-Mail Rückfrage Leuchten.md');assert.equal(m.source_kind,'email');
  assert.ok(db.uploads.at(-1).text.includes('Von: Lichtplanung GmbH\nAn: Büro\nBetreff: Leuchten Treppenhaus'));
  const zumThema=await t.fileDocument({project:'Testprojekt',titel:'Leuchtenliste',thema:'licht',inhalt:'Liste der vorgesehenen Leuchten je Raum mit Hersteller und Serie.'});
  assert.equal(zumThema.ordner,'Lichtplanung','zum bekannten Thema in dessen Ordner');
  assert.equal(db.tables.minds_work_files.at(-1).metadata.thema,'Lichtplanung');
  assert.equal(db.tables.minds_work_folders.filter(f=>f.name==='Lichtplanung').length,1);
  await assert.rejects(()=>t.fileDocument({project:'Testprojekt',titel:'x',inhalt:'zu kurz'}),ToolError);
  await assert.rejects(()=>t.fileDocument({project:'Testprojekt',titel:'x',inhalt:inhalt+' neu',datum:'20.11.2026'}),/JJJJ-MM-TT/);
});

test('Nur das Projektteam legt ab: ohne Mitgliedschaft wird nichts geschrieben',async()=>{
  const db=fakeDb(),t=ablage(db);
  await assert.rejects(()=>t.closeSession({project:'Fremdes Projekt',topic:'Licht',neues_thema:true,stand:'Stand.'}),/nicht verfügbar/);
  await assert.rejects(()=>t.fileDocument({project:'Fremdes Projekt',titel:'x',inhalt:'Ein Text mit genug Zeichen für die Ablage.'}),/nicht verfügbar/);
  assert.equal(db.uploads.length,0);assert.equal(db.tables.minds_work_files.length,0);assert.equal(db.tables.minds_work_folders.length,0);
});

test('Weiterarbeiten: Themen im Desktop mit dem letzten Stand (open_project, open_topic)',async()=>{
  const db=fakeDb(),t=ablage(db);
  assert.deepEqual(await t.themen({project:'Testprojekt'}),[]);
  assert.equal(await t.letzterStand({project:'Testprojekt',topic:'Licht'}),null);
  await t.closeSession({project:'Testprojekt',topic:'Lichtplanung',neues_thema:true,stand:'Erster Stand.'});
  await t.closeSession({project:'Testprojekt',topic:'Lichtplanung',stand:'Zweiter Stand.',naechste_schritte:['Angebot einholen']});
  const themen=await t.themen({project:'Testprojekt'});
  assert.equal(themen.length,1);assert.equal(themen[0].thema,'Lichtplanung');assert.equal(themen[0].kurz,'Zweiter Stand.');
  const s=await t.letzterStand({project:'Testprojekt',topic:'licht'});
  assert.equal(s.thema,'Lichtplanung');assert.match(s.text,/## Stand\nZweiter Stand\.[\s\S]*## Nächste Schritte\n- Angebot einholen/);
  await assert.rejects(()=>t.themen({project:'Fremdes Projekt'}),/nicht verfügbar/);
});

test('Server: Ablegen nach Anmeldung und Mitgliedschaft, als Schreibwerkzeuge, mit den Regeln des Leitfadens',()=>{
  const src=read('supabase/functions/office-mcp/index.ts');
  for(const tool of ['overview','list_projects','project_context','list_deadlines','search_files','read_file','list_tasks','list_events',
    'create_task','update_task','open_project','open_topic','search_akte','turn_diagnostics','close_session','file_document'])
    assert.ok(src.includes('server.registerTool("'+tool+'"'),tool);
  assert.match(src,/server\.registerTool\("close_session",\{[^\n]*\n[\s\S]*?annotations:WRITE\},run\(a=>ablage\.closeSession\(a\)\)\);/);
  assert.match(src,/server\.registerTool\("file_document",\{[^\n]*\n[\s\S]*?annotations:WRITE\},run\(a=>ablage\.fileDocument\(a\)\)\);/);
  assert.match(src,/const ablage=createOfficeAblageTools\(\{sb,userId:data\.user\.id,scope:akte\.scopedProject\}\);/,'dieselbe Mitgliedschaftsprüfung wie die Projektakte');
  assert.ok(src.indexOf('must_change_password')<src.indexOf('createOfficeAblageTools({sb'),'erst Anmeldung und eigenes Passwort');
  assert.match(src,/themen_im_desktop:await ablage\.themen\(a\)/);assert.match(src,/letzter_stand:await ablage\.letzterStand\(a\)/);
  assert.match(src,/Office guideline "Was darf ins TBA Office\?": never salaries or other personnel data, ID or bank data, health data, passwords, full texts of standards \(DIN\)/);
  assert.match(src,/Nothing is overwritten or deleted: each save adds a dated document\./);
  assert.doesNotMatch(src,/SERVICE_ROLE|service_role/);
  const mod=read('supabase/functions/office-mcp/office-ablage.mjs');
  assert.doesNotMatch(mod,/\.(delete|remove)\(\s*\)|\.update\(/,'das Modul ändert und löscht nichts (remove nur nach einem fehlgeschlagenen Eintrag)');
  assert.match(mod,/upsert:false/);
});
