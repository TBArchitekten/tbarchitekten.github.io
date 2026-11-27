// Projektwissen (Gari, 26.11.2026): ein gemeinsamer Wissenspool je Projekt. «Pásalo al Office» im Chat mit Claude teilt,
// was erarbeitet wurde; die KI arbeitet es in Seiten ein, die das Projektteam im Reiter «Wissen» liest. Geprüft wird die
// Migration (nur das Team liest, geschrieben wird nur über die Funktionen, nichts Destruktives), der Connector mit einer
// Attrappe von Supabase (kein Netz) und die Oberfläche (sicheres Markdown, Reiter, keine direkten Schreibzugriffe).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createOfficeWissenTools,verweise,verweisMuster,suchMuster} from '../supabase/functions/office-mcp/office-wissen.mjs';
import {ToolError} from '../supabase/functions/office-mcp/office-tools.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migrationName=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>/^\d{14}_office_projektwissen\.sql$/.test(f));
const require=createRequire(import.meta.url);
const ui=require('../app/office-wissen.js');

// ---------- Migration ----------
test('Migration: genau eine Datei, neue Tabellen mit RLS, das Team liest, geschrieben wird nur über die Funktionen',()=>{
  assert.equal(migrationName.length,1,'eine Migration office_projektwissen');
  const sql=read('supabase/migrations/'+migrationName[0]);
  for(const t of ['office_wissen_beitraege','office_wissen_versionen','office_wissen_protokoll','office_wissen_regeln']){
    assert.match(sql,new RegExp('create table public\\.'+t+' \\('),t);
    assert.match(sql,new RegExp('alter table public\\.'+t+' enable row level security;'),t+' RLS');
  }
  for(const t of ['office_wissen_beitraege','office_wissen_versionen','office_wissen_protokoll'])
    assert.match(sql,new RegExp('create policy '+t+'_lesen on public\\.'+t+'\\n  for select to authenticated using \\(\\(select private\\.office_project_team_has_access\\(project_id\\)\\)\\);'),t+' nur das Team');
  assert.match(sql,/create policy office_wissen_regeln_lesen on public\.office_wissen_regeln\n  for select to authenticated using \(\(select private\.office_is_member\(\)\)\);/);
  assert.match(sql,/create policy office_wissen_regeln_aendern on public\.office_wissen_regeln\n  for update to authenticated using \(\(select private\.office_is_admin\(\)\)\) with check \(\(select private\.office_is_admin\(\)\)\);/);
  // Keine Schreibrechte auf den Tabellen; nur lesen (und die Regeln für Admins).
  assert.match(sql,/revoke all on public\.office_wissen_beitraege, public\.office_wissen_versionen, public\.office_wissen_protokoll,\n  public\.office_wissen_regeln from public, anon, authenticated;/);
  assert.match(sql,/grant select on public\.office_wissen_beitraege, public\.office_wissen_versionen, public\.office_wissen_protokoll,\n  public\.office_wissen_regeln to authenticated;/);
  assert.match(sql,/grant update \(text, updated_at, updated_by\) on public\.office_wissen_regeln to authenticated;/);
  assert.doesNotMatch(sql,/grant (insert|delete|all)\b/i);
  // Eine geltende Seite je Titel und Projekt.
  assert.match(sql,/create unique index office_wissen_seite_titel on public\.minds_work_memory \(project_id, lower\(btrim\(title\)\)\)\n  where memory_type = 'document_state' and metadata->>'kind' = 'wissensseite' and status = 'confirmed';/);
});

test('Migration: Funktionen als security definer mit Teamprüfung; bestätigen nur die Projektleitung; nichts Destruktives',()=>{
  const sql=read('supabase/migrations/'+migrationName[0]);
  const fns={office_wissen_beitrag_teilen:'uuid, text, text, text, text, text',
    office_wissen_seite_schreiben:'uuid, text, text, text, uuid\\[\\], timestamptz, text, text\\[\\]',
    office_wissen_entscheidung:'uuid, text, text, date, text, uuid, text, boolean, uuid',office_wissen_entscheidung_pruefen:'uuid, boolean'};
  for(const [f,args] of Object.entries(fns)){
    const body=sql.slice(sql.indexOf('create or replace function public.'+f+'('));
    assert.match(body.slice(0,600),/language plpgsql security definer set search_path = '' as \$\$/,f);
    assert.match(body.slice(0,body.indexOf('end $$;')),/private\.office_project_team_has_access\(/,f+' prüft das Team');
    assert.match(sql,new RegExp('revoke all on function public\\.'+f+'\\('+args+'\\) from public, anon;'),f+' revoke');
    assert.match(sql,new RegExp('grant execute on function public\\.'+f+'\\('+args+'\\) to authenticated;'),f+' grant');
  }
  const pruefen=sql.slice(sql.indexOf('create or replace function public.office_wissen_entscheidung_pruefen('));
  assert.match(pruefen,/if not \(select private\.office_leads_project\(v_row\.project_id\)\) then\n    raise exception 'Bestätigen oder verwerfen kann nur die Projektleitung\.' using errcode = '42501';/);
  assert.match(sql,/v_status := case when coalesce\(p_beschlossen, false\) and \(select private\.office_leads_project\(p_project\)\)\n                   then 'confirmed' else 'proposed' end;/);
  // Frühere Fassung festhalten, Stand prüfen, Uhrzeit des Schreibens als Stand.
  assert.match(sql,/if p_basis is not null and v_alt\.updated_at <> p_basis then[\s\S]{0,200}using errcode = '40001';/);
  assert.match(sql,/insert into public\.office_wissen_versionen \(project_id, seite_id, titel, inhalt, kurz, von, grund, stand\)/);
  assert.equal((sql.match(/updated_at = clock_timestamp\(\)/g)||[]).length,1);
  assert.match(sql,/'confirmed', now\(\), clock_timestamp\(\),/);
  // Nichts Destruktives (Kommentare und der Regeltext ausgenommen).
  const code=sql.replace(/\$regeln\$[\s\S]*?\$regeln\$/,'').replace(/--[^\n]*/g,'');
  for(const re of [/\bdrop\s+(table|policy|function|index|column|schema|view|trigger)\b/i,/\btruncate\b/i,/\bdelete\s+from\b/i,
    /alter\s+table[^;]*\bdrop\b/i,/disable\s+row\s+level\s+security/i,/alter\s+policy/i])
    assert.doesNotMatch(code,re);
  // Die bestehenden Regeln der Projektakte bleiben, wie sie sind.
  assert.doesNotMatch(code,/(policy|grant|revoke)[^;]*minds_work_memory/i);
});

test('Migration: schärfere Regel für Entscheidungen, nur der Abschnitt, nur wenn der Text noch der ursprüngliche ist',()=>{
  const namen=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>/^\d{14}_office_projektwissen_entscheidungen\.sql$/.test(f));
  assert.equal(namen.length,1);
  const sql=read('supabase/migrations/'+namen[0]);
  const erste=read('supabase/migrations/'+migrationName[0]);
  const regeln=t=>t.match(/\$regeln\$([\s\S]*?)\$regeln\$/)[1];
  const alt=regeln(erste),neu=regeln(sql);
  // Nur der Abschnitt «Entscheidungen» ändert sich; alles davor und danach bleibt gleich.
  const teile=t=>[t.slice(0,t.indexOf('Entscheidungen\n')),t.slice(t.indexOf('\n\nWas nicht hineingehört'))];
  assert.deepEqual(teile(neu),teile(alt));
  assert.match(neu,/- Als Entscheidung gilt nur, was das Projekt bindet: was geplant oder gebaut wird, Umfang, Kosten, Termine, Vorgaben der Bauherrschaft\./);
  assert.match(neu,/- Arbeitsregeln des Teams sind keine Entscheidungen, zum Beispiel wie wir mit Herstellern arbeiten oder wie wir E-Mails und Unterlagen formulieren\. Sie stehen auf der passenden Seite\./);
  assert.match(neu,/Eine Empfehlung an die Bauherrschaft bleibt «vorgeschlagen», bis sie zustimmt;/);
  // Schutz: nur der Text aus der ersten Migration wird ersetzt, sonst Abbruch.
  assert.match(sql,/where id = 1 and md5\(text\) = 'efd6bd5454e0bb95408a256803ba2d51';\n  if not found then\n    raise exception/);
  const code=sql.replace(/\$regeln\$[\s\S]*?\$regeln\$/,'').replace(/--[^\n]*/g,'');
  assert.deepEqual([...code.matchAll(/\b(update|insert|delete|drop|truncate|alter|grant|revoke|create)\b/gi)].map(m=>m[1].toLowerCase()),['update']);
  assert.match(code,/update public\.office_wissen_regeln set text = /);
  // Der Connector sagt dasselbe.
  const ts=read('supabase/functions/office-mcp/index.ts');
  assert.match(ts,/\(4\) record_decision only for what binds the project \(what is planned or built, scope, costs, dates, the client's specifications\), never for the team's working rules/);
  assert.match(ts,/a recommendation to the client stays proposed until the client agrees;/);
  assert.match(ts,/Only what binds the project \(design, scope, costs, dates, the client's specifications\); team working rules go on the page instead\./);
  // Die Oberfläche zeigt, was aus einer alten Entscheidung wurde.
  const js=read('app/office-wissen.js');
  assert.match(js,/Keine Projektentscheidung, sondern Arbeitsweise des Teams: steht auf der Seite /);
  assert.match(js,/Ersetzt durch «/);
});

test('Abnahme in der isolierten Datenbank: erwartetes Ergebnis und Schritt in CI',()=>{
  const acc=read('tests/sql/office-projektwissen-acceptance.sql');
  for(const teil of ['B_neu=true','veraltet=40001','direkt=verweigert','A_direkt=0','C_beitraege=0','C_seiten=0','C_teilen=42501',
    'anon=verweigert','B_entscheidung=proposed','B_pruefen=42501','A_pruefen=confirmed','alt=superseded','zusammen=superseded',
    'weiter=Bodenbelag Flure','A_regeln=0'])
    assert.ok(acc.includes(teil),teil);
  assert.match(acc,/^rollback;$/m,'die Abnahme hinterlässt nichts');
  const verify=read('.github/workflows/verify.yml');
  assert.match(verify,/< tests\/sql\/office-projektwissen-acceptance\.sql/);
  assert.match(read('.github/workflows/verify-romy-browser.yml'),/run: node --test tests\/browser\/office-wissen\.chromium\.mjs/);
});

// ---------- Connector ----------
const P='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B1='b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1',B2='b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',D1='d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1';
const UA='11111111-1111-4111-8111-111111111111',UB='22222222-2222-4222-8222-222222222222';
const seite=(id,title,body,extra={},status='confirmed')=>({id,project_id:P,memory_type:'document_state',status,title,body,
  updated_at:'2026-11-25T10:00:00.123456+00:00',metadata:{kind:'wissensseite',...extra}});
function fake({rpc={}}={}){
  const log=[],rpcs=[];
  const tables={
    minds_work_memory:[
      seite('s1','Bodenbelag Flure','Feinsteinzeug 60 × 60. Siehe [[Bäder]].',{kurz:'Was für die Flure gilt',quellen:[B1,'kein-uuid'],aktualisiert_von:UA}),
      seite('s2','Bäder','Boden wie [[Bodenbelag Flure]], R10.'),
      seite('s3','Flurbeläge','Alt.',{zusammengefuehrt_in:'Bodenbelag Flure'},'superseded'),
      {id:'k1',project_id:P,memory_type:'document_state',status:'confirmed',title:'Projektsteckbrief',body:'[[Bodenbelag Flure]]',metadata:{kind:'projektsteckbrief'}},
      {id:D1,project_id:P,memory_type:'decision',status:'proposed',title:'Feinsteinzeug in den Fluren',body:'',occurred_at:'2026-11-25T12:00:00Z',created_at:'2026-11-25T10:00:00Z'}
    ],
    office_wissen_beitraege:[
      {id:B1,project_id:P,titel:'Chat: Bodenbeläge',inhalt:'x'.repeat(50),art:'chat',quelle:'Claude-Chat',seite:null,eingearbeitet_am:'2026-11-25T10:00:00Z',eingearbeitet_in:['Bodenbelag Flure'],created_at:'2026-11-25T09:00:00Z',user_id:UA},
      {id:B2,project_id:P,titel:'Hinweis zu «Bodenbelag Flure»',inhalt:'Im OG Linoleum.',art:'korrektur',quelle:null,seite:'bodenbelag flure',eingearbeitet_am:null,eingearbeitet_in:[],created_at:'2026-11-26T08:00:00Z',user_id:UB}
    ],
    office_wissen_versionen:[{id:'v1',seite_id:'s1'},{id:'v2',seite_id:'s1'}],
    office_wissen_protokoll:[{project_id:P,art:'seite_neu',titel:'Bodenbelag Flure',created_at:'2026-11-25T10:00:00Z',user_id:UA}],
    office_wissen_regeln:[{text:'Regeln für das Projektwissen'}],
    office_members:[{user_id:UA,display_name:'Ana Beispiel'},{user_id:UB,display_name:'Bea Muster'}]
  };
  const wert=(r,c)=>c.includes('->>')?r[c.split('->>')[0]]?.[c.split('->>')[1]]:r[c];
  const passt=(r,c,m)=>String(wert(r,c)??'').toLowerCase().includes(String(m).replace(/^%|%$/g,'').replace(/\\(.)/g,'$1').toLowerCase());
  function from(table){
    const st={table,ops:[],single:false,head:false};
    const b={select:(_c,o)=>{if(o?.head)st.head=true;return b},
      eq:(c,v)=>(st.ops.push(['eq',c,v]),b),in:(c,v)=>(st.ops.push(['in',c,v]),b),is:(c,v)=>(st.ops.push(['is',c,v]),b),
      ilike:(c,v)=>(st.ops.push(['ilike',c,v]),b),or:s=>(st.ops.push(['or',s]),b),order:()=>b,limit:n=>(st.limit=n,b),
      maybeSingle:()=>(st.single=true,b),
      then:(res,rej)=>Promise.resolve().then(()=>{
        let rows=(tables[table]||[]).slice();
        for(const [k,c,v] of st.ops){
          if(k==='eq')rows=rows.filter(r=>wert(r,c)===v);
          else if(k==='in')rows=rows.filter(r=>v.includes(wert(r,c)));
          else if(k==='is')rows=rows.filter(r=>(wert(r,c)??null)===v);
          else if(k==='ilike')rows=rows.filter(r=>passt(r,c,v));
          else if(k==='or'){const teile=c.split(',').map(t=>{const [col,op,...m]=t.split('.');return [col,op,m.join('.')]});rows=rows.filter(r=>teile.some(([col,,m])=>passt(r,col,m)))}
        }
        if(st.limit)rows=rows.slice(0,st.limit);
        if(st.head)return {data:null,error:null,count:rows.length};
        return {data:st.single?(rows[0]||null):rows,error:null};
      }).then(res,rej)};
    log.push(st);
    return b;
  }
  const sb={from,rpc:async(name,args)=>{rpcs.push({name,args});const r=rpc[name];return typeof r==='function'?r(args):r||{data:null,error:null}}};
  const scope=async ref=>{if(ref!=='Testprojekt')throw new ToolError('Dieses Projekt ist für dieses Konto nicht verfügbar.');return {id:P,name:'Testprojekt'}};
  return {sb,log,rpcs,scope,tools:createOfficeWissenTools({sb,userId:UA,scope})};
}

test('Connector: nur mit Kontext; Übersicht mit Seiten, Entscheidungen, offenen Beiträgen und Neuem',async()=>{
  assert.throws(()=>createOfficeWissenTools({sb:{},userId:UA}),/office_wissen_context_required/);
  const {tools}=fake();
  await assert.rejects(()=>tools.uebersicht({project:'Fremd'}),/nicht verfügbar/);
  const u=await tools.uebersicht({project:'Testprojekt'});
  assert.deepEqual(u.seiten.map(s=>s.titel),['Bodenbelag Flure','Bäder'],'keine zusammengeführte Seite, kein Steckbrief');
  assert.equal(u.seiten[0].kurz,'Was für die Flure gilt');
  assert.deepEqual(u.entscheidungen.vorgeschlagen,[{id:D1,titel:'Feinsteinzeug in den Fluren',datum:'2026-11-25'}]);
  assert.deepEqual(u.offene_beitraege,[{id:B2,titel:'Hinweis zu «Bodenbelag Flure»',art:'Hinweis',seite:'bodenbelag flure',am:'2026-11-26',von:'Bea Muster'}]);
  assert.deepEqual(u.neu,[{was:'Seite angelegt',titel:'Bodenbelag Flure',am:'2026-11-25 10:00',von:'Ana Beispiel'}]);
  assert.equal(u.hinweis,undefined);
});

test('Connector: teilen prüft den Inhalt, ruft nur die Funktion und sagt, wie es weitergeht',async()=>{
  const {tools,rpcs,log}=fake({rpc:{office_wissen_beitrag_teilen:{data:'neu-1',error:null}}});
  await assert.rejects(()=>tools.teilen({project:'Testprojekt',titel:'x',inhalt:'zu kurz'}),e=>e instanceof ToolError&&/zu kurz/.test(e.message));
  await assert.rejects(()=>tools.teilen({project:'Testprojekt',titel:'x',inhalt:'y'.repeat(200001)}),/zu lang/);
  await assert.rejects(()=>tools.teilen({project:'Testprojekt',titel:'x',inhalt:'y'.repeat(40),art:'mail'}),/chat, thread, korrektur oder notiz/);
  assert.equal(rpcs.length,0);
  const r=await tools.teilen({project:'Testprojekt',titel:'  '+'T'.repeat(250),inhalt:'Recherche Bodenbeläge: Feinsteinzeug 60 × 60.',quelle:'Q'.repeat(600)});
  assert.deepEqual(rpcs[0],{name:'office_wissen_beitrag_teilen',args:{p_project:P,p_titel:'T'.repeat(200),p_inhalt:'Recherche Bodenbeläge: Feinsteinzeug 60 × 60.',
    p_art:'chat',p_quelle:'Q'.repeat(500),p_seite:null}});
  assert.equal(r.beitrag_id,'neu-1');
  assert.equal(r.regeln,'Regeln für das Projektwissen');
  assert.deepEqual(r.seiten.map(s=>s.titel),['Bodenbelag Flure','Bäder']);
  assert.match(r.naechster_schritt,/read_page[\s\S]*write_page[\s\S]*quellen:\[beitrag_id\], basis:stand[\s\S]*record_decision[\s\S]*3–5 Zeilen/);
  assert.ok(!log.some(st=>st.ops.length===0&&st.table==='office_wissen_beitraege'),'kein direktes Schreiben');
});

test('Connector: Fehler der Funktionen werden verständliche Sätze',async()=>{
  const fehler=(code,message)=>({data:null,error:{code,message}});
  const cases=[['40001','Die Seite «Bodenbelag Flure» wurde inzwischen geändert.',/inzwischen geändert\. Lies sie mit read_page neu und schreibe dann mit dem neuen Stand \(basis\)\./],
    ['42501','Kein Zugang zu diesem Projekt.',/^Kein Zugang zu diesem Projekt\.$/],['22023','Der Titel fehlt.',/^Der Titel fehlt\.$/],
    ['23505','duplicate key',/gerade entstanden\. Lies sie mit read_page/]];
  for(const [code,msg,re] of cases){
    const {tools}=fake({rpc:{office_wissen_seite_schreiben:fehler(code,msg)}});
    await assert.rejects(()=>tools.seiteSchreiben({project:'Testprojekt',titel:'Bodenbelag Flure',inhalt:'Neu.'}),e=>e instanceof ToolError&&re.test(e.message),code);
  }
  const {tools}=fake({rpc:{office_wissen_seite_schreiben:fehler('XX000','boom')}});
  await assert.rejects(()=>tools.seiteSchreiben({project:'Testprojekt',titel:'A',inhalt:'B'}),e=>!(e instanceof ToolError)&&/seite: boom/.test(e.message));
});

test('Connector: read_page – Titel, Weiterleitung nach dem Zusammenführen, Vorschläge, Herkunft, offene Hinweise, Verweise',async()=>{
  const {tools,log}=fake();
  const s=await tools.seiteLesen({project:'Testprojekt',titel:'bodenbelag flure'});
  assert.equal(s.titel,'Bodenbelag Flure');
  assert.equal(s.stand,'2026-11-25T10:00:00.123456+00:00','der Stand unverändert, für basis');
  assert.equal(s.zuletzt_von,'Ana Beispiel');
  assert.deepEqual(s.quellen.map(q=>[q.id,q.art,q.von]),[[B1,'aus einem Chat','Ana Beispiel']],'nur echte IDs als Quellen');
  assert.deepEqual(s.offene_hinweise.map(h=>h.id),[B2]);
  assert.equal(s.fruehere_fassungen,2);
  assert.deepEqual(s.verweist_auf,['Bäder']);
  assert.deepEqual(s.verweise_hierher,['Bäder'],'der Steckbrief zählt nicht');
  // Verweise hierher gezielt gesucht (ilike auf [[Titel]]), nicht alle Seiten geladen.
  const v=log.find(st=>st.ops.some(([k,c])=>k==='ilike'&&c==='body'));
  assert.deepEqual(v.ops.find(([k])=>k==='ilike'),['ilike','body','%[[Bodenbelag Flure]]%']);
  assert.equal(v.limit,40);
  const weiter=await tools.seiteLesen({project:'Testprojekt',titel:'Flurbeläge'});
  assert.deepEqual([weiter.titel,weiter.weitergeleitet_von],['Bodenbelag Flure','Bodenbelag Flure']);
  const unbekannt=await tools.seiteLesen({project:'Testprojekt',titel:'Lichtkonzept'});
  assert.equal(unbekannt.gefunden,false);
  assert.deepEqual(unbekannt.alle_seiten,['Bodenbelag Flure','Bäder']);
  await assert.rejects(()=>tools.seiteLesen({project:'Testprojekt',titel:' '}),/Titel der Seite/);
});

test('Connector: write_page prüft Titel, Länge und Stand; als Quellen nur IDs; meldet neu und Weiterleitung',async()=>{
  const {tools,rpcs}=fake({rpc:{office_wissen_seite_schreiben:a=>({data:[{seite_id:'s1',seite_titel:'Bodenbelag Flure',seite_stand:'2026-11-26T09:00:00Z',ist_neu:false}],error:null})}});
  await assert.rejects(()=>tools.seiteSchreiben({project:'Testprojekt',titel:'',inhalt:'x'}),/Titel fehlt/);
  await assert.rejects(()=>tools.seiteSchreiben({project:'Testprojekt',titel:'T'.repeat(201),inhalt:'x'}),/zu lang/);
  await assert.rejects(()=>tools.seiteSchreiben({project:'Testprojekt',titel:'A',inhalt:'  '}),/Inhalt der Seite fehlt/);
  await assert.rejects(()=>tools.seiteSchreiben({project:'Testprojekt',titel:'A',inhalt:'x'.repeat(100001)}),/höchstens 100\.000 Zeichen/);
  await assert.rejects(()=>tools.seiteSchreiben({project:'Testprojekt',titel:'A',inhalt:'x',basis:'gestern'}),/basis/);
  assert.equal(rpcs.length,0);
  const r=await tools.seiteSchreiben({project:'Testprojekt',titel:'Flurbeläge',inhalt:'# Stand\nKautschuk.',kurz:'K'.repeat(400),
    quellen:[B1,'nicht-uuid',B2],basis:'2026-11-25T10:00:00.123456+00:00',grund:'Recherche eingearbeitet',zusammenfuehren:[' Flure Material ','',3]});
  assert.deepEqual(rpcs[0].args,{p_project:P,p_titel:'Flurbeläge',p_inhalt:'# Stand\nKautschuk.',p_kurz:'K'.repeat(300),p_quellen:[B1,B2],
    p_basis:'2026-11-25T10:00:00.123456+00:00',p_grund:'Recherche eingearbeitet',p_zusammenfuehren:['Flure Material','3']});
  assert.deepEqual(r,{titel:'Bodenbelag Flure',neu:false,stand:'2026-11-26T09:00:00Z',weitergeleitet:'Flurbeläge',zusammengefuehrt:['Flure Material','3']});
});

test('Connector: record_decision prüft Datum und Ersetzte; vorgeschlagen mit Hinweis auf die Projektleitung',async()=>{
  const {tools,rpcs}=fake({rpc:{office_wissen_entscheidung:{data:[{entscheidung_id:'e1',entscheidung_status:'proposed'}],error:null}}});
  await assert.rejects(()=>tools.entscheidung({project:'Testprojekt',titel:'X',datum:'25.11.2026'}),/JJJJ-MM-TT/);
  await assert.rejects(()=>tools.entscheidung({project:'Testprojekt',titel:'X',ersetzt:'alt'}),/ersetzt/);
  const r=await tools.entscheidung({project:'Testprojekt',titel:' Kautschuk in den Fluren ',datum:'2026-11-26',beitrag_id:'kein',beschlossen:true,ersetzt:D1});
  assert.deepEqual(rpcs[0].args,{p_project:P,p_titel:'Kautschuk in den Fluren',p_details:null,p_datum:'2026-11-26',p_quelle:null,p_beitrag:null,
    p_seite:null,p_beschlossen:true,p_ersetzt:D1});
  assert.deepEqual(r,{id:'e1',status:'vorgeschlagen',hinweis:'Vorgeschlagen: die Projektleitung bestätigt es im Office (Work → Wissen → Entscheidungen).'});
});

test('Connector: Suche mit neutralisierten Filterzeichen; mindestens zwei Zeichen; Beitrag lesen bleibt im Projekt',async()=>{
  assert.equal(suchMuster('Fliese, (grau) "matt" 100%_x\\'),'%Fliese   grau   matt  100  x%');
  assert.equal(verweisMuster('A_1% \\ B'),'%[[A\\_1\\% \\\\ B]]%');
  assert.deepEqual(verweise('[[A]] und [[ B ]] und [[A]] und [[]]'),['A','B']);
  const {tools,log}=fake();
  await assert.rejects(()=>tools.suchen({project:'Testprojekt',query:'x'}),/zwei Zeichen/);
  const r=await tools.suchen({project:'Testprojekt',query:'feinsteinzeug'});
  assert.deepEqual(r.seiten.map(s=>s.titel),['Bodenbelag Flure']);
  assert.deepEqual(r.entscheidungen.map(e=>[e.titel,e.status]),[['Feinsteinzeug in den Fluren','vorgeschlagen']]);
  assert.ok(log.filter(st=>st.ops.some(([k])=>k==='or')).every(st=>st.ops.some(([k,c,v])=>k==='eq'&&c==='project_id'&&v===P)),'jede Suche im Projekt');
  await assert.rejects(()=>tools.beitragLesen({project:'Testprojekt',beitrag_id:'kein'}),/beitrag_id/);
  const b=await tools.beitragLesen({project:'Testprojekt',beitrag_id:B1,offset:10,max_chars:5});
  assert.deepEqual([b.offset,b.inhalt.length,b.next_offset,b.total_chars,b.eingearbeitet_in],[10,40,null,50,['Bodenbelag Flure']],'mindestens 1000 Zeichen je Teil');
  assert.ok(log.some(st=>st.table==='office_wissen_beitraege'&&st.ops.some(([k,c,v])=>k==='eq'&&c==='project_id'&&v===P)&&st.ops.some(([k,c])=>k==='eq'&&c==='id')));
});

test('Connector: open_project liefert das Projektwissen; die Werkzeuge und der Ablauf «pásalo al Office» stehen in den Anweisungen',()=>{
  const ts=read('supabase/functions/office-mcp/index.ts');
  assert.match(ts,/import \{createOfficeWissenTools\} from "\.\/office-wissen\.mjs";/);
  assert.match(ts,/const wissen=createOfficeWissenTools\(\{sb,userId:data\.user\.id,scope:akte\.scopedProject\}\);/);
  assert.match(ts,/run\(async a=>\(\{\.\.\.await akte\.openProject\(a\),projektwissen:await wissen\.uebersicht\(a\)\}\)\)/);
  for(const [name,fn,ann] of [['share_knowledge','teilen','WRITE'],['read_page','seiteLesen','READ'],['write_page','seiteSchreiben','WRITE'],
    ['record_decision','entscheidung','WRITE'],['search_knowledge','suchen','READ'],['read_contribution','beitragLesen','READ']]){
    const at=ts.indexOf('server.registerTool("'+name+'"');
    assert.ok(at>0,name);
    const def=ts.slice(at,ts.indexOf('server.registerTool(',at+10));
    assert.match(def,new RegExp('annotations:'+ann+'\\},run\\(a=>wissen\\.'+fn+'\\(a\\)\\)\\);'),name);
  }
  assert.match(ts,/"pásalo al Office", "Ins Office übernehmen"/);
  assert.match(ts,/\(5\) tell the person in 3–5 lines/);
  // Nicht nur am Ende eines Chats (Gari, 26.11.2026): beim zweiten Mal nur das Neue.
  assert.match(ts,/or similar \(any time, also several times in one chat\): \(1\) open_project/);
  assert.match(ts,/if this chat was already shared, share only what is new or changed since then \(title it as a continuation, same quelle\), never the whole chat again;/);
  assert.match(ts,/Can be used several times in one chat: after the first time, share only what is new or changed since the last share\./);
  assert.match(ts,/Nothing is deleted: every earlier version of a page stays in its history/);
  // Der Desktop bleibt draußen: keine Ablage über den Connector.
  assert.doesNotMatch(ts,/close_session|file_document|office-ablage/);
});

// ---------- Oberfläche ----------
test('Oberfläche: Markdown erst escapen, dann wenige sichere Formen',()=>{
  const html=ui.renderMarkdown(['# Titel','Text mit **fett**, *kursiv* und `<code>`.','','- a','  - b','1. eins','',
    '| A | B |','|---|---|','| <img src=x onerror=alert(1)> | [x](javascript:alert(1)) |','','> zitiert','','```','<script>alert(1)</script>','```',
    '[[Seite "mit" <Zeichen>]] [Web](https://example.com/a?b=1&c=2) [Mail](mailto:a@example.com)'].join('\n'));
  assert.match(html,/^<h3>Titel<\/h3><p>Text mit <strong>fett<\/strong>, <em>kursiv<\/em> und <code>&lt;code&gt;<\/code>\.<\/p>/);
  assert.match(html,/<ul><li>a<ul><li>b<\/li><\/ul><\/li><\/ul><ol><li>eins<\/li><\/ol>/);
  assert.match(html,/<div class="wissen-tabelle"><table><thead><tr><th>A<\/th><th>B<\/th><\/tr><\/thead><tbody><tr><td>&lt;img src=x onerror=alert\(1\)&gt;<\/td><td>\[x\]\(javascript:alert\(1\)\)<\/td><\/tr><\/tbody><\/table><\/div>/);
  assert.match(html,/<blockquote><p>zitiert<\/p><\/blockquote><pre><code>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/code><\/pre>/);
  assert.match(html,/<button type="button" class="wissen-verweis" data-wissen-seite="Seite &quot;mit&quot; &lt;Zeichen&gt;">Seite &quot;mit&quot; &lt;Zeichen&gt;<\/button>/);
  assert.match(html,/<a href="https:\/\/example\.com\/a\?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">Web<\/a> <a href="mailto:a@example\.com" target="_blank" rel="noopener noreferrer">Mail<\/a>/);
  assert.doesNotMatch(html,/<(script|img|iframe)|href="javascript|onerror="/i);
  assert.deepEqual(ui.verweise('[[A]] [[B]] [[A]]'),['A','B']);
});

test('Oberfläche: Reiter «Wissen» neben Panorama, geladen vor work.js, liest und schreibt nur über die Funktionen',()=>{
  const shell=read('app/shell.js'),work=read('app/work.js'),index=read('app/index.html'),js=read('app/office-wissen.js');
  assert.match(shell,/<button data-work-view="overview" class="active">Panorama<\/button>\n\s*<button data-work-view="knowledge" hidden>Wissen<\/button>\n\s*<button data-work-view="desktop">Desktop<\/button>/);
  assert.match(work,/\['overview','planner','knowledge'\]\.includes\(b\.dataset\.workView\)/);
  assert.match(work,/:view==='knowledge'\?\(OFFICE\?renderWissen\(\):renderKnowledge\(\)\)/);
  assert.match(work,/isCurrent:\(\)=>current===workRenderVersion&&view==='knowledge'&&project\?\.id===id/);
  assert.ok(index.indexOf('<script src="./office-wissen.js?v=office6"></script>')>0);
  assert.ok(index.indexOf('./office-wissen.js?v=office6')<index.indexOf('./work.js?v=office67'),'vor work.js');
  assert.match(index,/<link rel="stylesheet" href="\.\/office-wissen\.css\?v=office2">/);
  // Keine direkten Schreibzugriffe; nur die zwei Funktionen für das Team.
  assert.doesNotMatch(js,/\.(insert|update|upsert|delete)\(/);
  assert.deepEqual([...js.matchAll(/\.rpc\('([a-z_]+)'/g)].map(m=>m[1]).sort(),['office_wissen_beitrag_teilen','office_wissen_entscheidung_pruefen']);
  // Wer nicht im Team ist, bekommt eine Erklärung; Sie-Form.
  assert.match(js,/Sie gehören nicht zum Team von «/);
  assert.doesNotMatch(js.replace(/\/\/[^\n]*/g,''),/\b(du|dein|deine|dich|dir)\b/i);
});

test('Panorama: Karte «Neu im Projektwissen» nur fürs Team, kurz, liest nur; öffnet das Wissen an der richtigen Stelle',()=>{
  const heute=new Date('2026-11-26T22:30:00Z');
  assert.equal(ui.panoramaHtml(null),'');
  assert.equal(ui.panoramaHtml({imTeam:false,seiten:3,offen:1,beitraege:0,neu:[]}),'','außerhalb des Teams keine Karte');
  const html=ui.panoramaHtml({imTeam:true,seiten:8,offen:5,beitraege:1,neu:[
    {art:'seite_geaendert',titel:'Lichtkonzept',created_at:'2026-11-26T22:08:18Z'},
    {art:'entscheidung_ersetzt',titel:'Regel <b>',created_at:'2026-11-25T20:00:00Z'},
    {art:'seite_neu',titel:'Bäder',created_at:'2026-11-20T10:00:00Z'}]},heute);
  assert.match(html,/<h2 id="cockpitWissen">Neu im Projektwissen<\/h2><button type="button" class="cockpit-link" data-work-wissen="">Öffnen<\/button>/);
  assert.match(html,/<p class="cockpit-empty">8 Seiten<\/p><button type="button" class="cockpit-file" data-work-wissen="entscheidungen"><span>5 Entscheidungen zur Bestätigung<\/span><\/button>/);
  assert.match(html,/data-work-wissen="neu"><span>1 Beitrag wartet auf die KI<\/span>/);
  assert.match(html,/data-work-wissen="seite" data-wissen-titel="Lichtkonzept"><span>Lichtkonzept<\/span><small>fortgeschrieben · heute<\/small>/);
  assert.match(html,/data-work-wissen="neu"><span>Regel &lt;b&gt;<\/span><small>ersetzt · gestern<\/small>/);
  assert.match(html,/data-wissen-titel="Bäder"><span>Bäder<\/span><small>Seite neu · 20\.11\.<\/small>/);
  assert.match(ui.panoramaHtml({imTeam:true,seiten:0,offen:0,beitraege:0,neu:[]}),/Noch kein Projektwissen\. In einem Chat mit Claude «Ins Office übernehmen» sagen\./);
  // Daten: nur lesen, gezählt; Team über office_project_members.
  const js=read('app/office-wissen.js');
  const teil=js.slice(js.indexOf('async function panorama('),js.indexOf('function panoramaHtml('));
  assert.doesNotMatch(teil,/\.(insert|update|upsert|delete|rpc)\(/);
  assert.match(teil,/office_project_members/);
  assert.match(teil,/select\('id',\{count:'exact',head:true\}\)/);
  // work.js: in derselben Spalte wie die Terminpläne; Klick merkt Ansicht oder Seite vor und öffnet den Reiter.
  const work=read('app/work.js');
  assert.match(work,/wissen\?\.panorama\?wissen\.panorama\(\{sb,project:\{id:projectId\}\}\):none/);
  assert.match(work,/\(window\.TBA_OFFICE_WISSEN\?\.panoramaHtml\?\.\(m\.wissen\)\|\|''\)\+/);
  // Darunter die Abläufe (27.11.2026): «Besprechung nachbereiten» öffnet den Projektstart mit dem Ablauf.
  assert.match(work,/<h2 id="cockpitAblaeufe">Abläufe<\/h2>[\s\S]{0,260}new URLSearchParams\(\{projekt:project\.id,ablauf:'besprechung'\}\)/);
  assert.match(work,/window\.TBA_OFFICE_WISSEN\?\.vormerken\?\.\(projectId,\{ansicht:button\.dataset\.workWissen,seite:button\.dataset\.wissenTitel\}\);document\.querySelector\('\[data-work-view="knowledge"\]'\)\?\.click\(\)/);
});

test('Oberfläche: Farben nur aus den Tokens',()=>{
  const css=read('app/office-wissen.css'),tokens=read('shared/minds-design-tokens.css');
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g,''),/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i,'keine Farbe von Hand');
  const definiert=new Set([...tokens.matchAll(/(--m-[a-z0-9-]+)\s*:/g)].map(m=>m[1]));
  const benutzt=[...new Set([...css.matchAll(/var\((--m-[a-z0-9-]+)\)/g)].map(m=>m[1]))];
  assert.ok(benutzt.length>20);
  assert.deepEqual(benutzt.filter(t=>!definiert.has(t)),[]);
});
