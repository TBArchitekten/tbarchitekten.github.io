// Romy liest das Projektwissen (Gari, 26.11.2026). In den Threads (office-assistant) zwei Werkzeuge, nur lesend und mit dem
// JWT der Person (RLS: nur das Projektteam); im Hauptchat (isabella-chat, search_work) sagen Seiten und Entscheidungen, was
// sie sind. Supabase ist eine Attrappe – kein Netz.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROMY_TOOLS,executeRomyTool,knowledgeExcerpt} from '../supabase/functions/office-assistant/romy-tools.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const P='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',U='11111111-1111-4111-8111-111111111111';
const seite=(id,title,body,extra={},status='confirmed')=>({id,project_id:P,memory_type:'document_state',status,title,body,
  updated_at:'2026-11-26T20:59:38+00:00',metadata:{kind:'wissensseite',...extra}});
function fakeDb(){
  const log=[];
  const rows=[
    seite('s1','Bodenbelag','Zwei Strategien: A Terrazzo EG und Eiche OG, B Kunstharz-Terrazzo. Siehe [[Kostenvergleich Bodenbelag]] und [[Lichtkonzept]].',{kurz:'Zwei Strategien, Entscheidung bei der Bemusterung'}),
    seite('s2','Kostenvergleich Bodenbelag','Strategie A 110–230 T€, Strategie B 475–570 T€.',{kurz:'A gegenüber B'}),
    seite('s3','Bodenbeläge alt','Alt.',{zusammengefuehrt_in:'Bodenbelag'},'superseded'),
    {id:'k1',project_id:P,memory_type:'document_state',status:'confirmed',title:'Projektsteckbrief',body:'Terrazzo',updated_at:'2026-11-01',metadata:{kind:'projektsteckbrief'}},
    {id:'d1',project_id:P,memory_type:'decision',status:'proposed',title:'Bodenbelag Strategie A als Vorzugsvariante',body:'Tendenz der Bauherren.',occurred_at:'2026-11-10T12:00:00Z',metadata:{kind:'entscheidung',seite:'Bodenbelag'}},
    {id:'d2',project_id:P,memory_type:'decision',status:'confirmed',title:'Kautschuk entfällt',body:'Festlegung der Objektplanung.',occurred_at:'2026-11-05T12:00:00Z',metadata:{kind:'entscheidung',seite:'Bodenbelag'}},
    {id:'d3',project_id:P,memory_type:'decision',status:'superseded',title:'Arbeitsregel',body:'',occurred_at:null,metadata:{kind:'entscheidung',seite:'Bodenbelag',auf_seite:'Bodenbelag'}}
  ];
  const wert=(r,c)=>c.includes('->>')?r[c.split('->>')[0]]?.[c.split('->>')[1]]:r[c];
  const like=(v,m)=>{const n=String(m).replace(/^%|%$/g,'');const ex=!String(m).startsWith('%');
    const plain=n.replace(/\\(.)/g,'$1').toLowerCase();return ex?String(v??'').toLowerCase()===plain:String(v??'').toLowerCase().includes(plain)};
  const from=table=>{
    const st={table,ops:[],writes:false};
    const b={select:()=>b,eq:(c,v)=>(st.ops.push(['eq',c,v]),b),in:(c,v)=>(st.ops.push(['in',c,v]),b),ilike:(c,v)=>(st.ops.push(['ilike',c,v]),b),
      or:s=>(st.ops.push(['or',s]),b),order:()=>b,limit:n=>(st.limit=n,b),
      insert:()=>{st.writes=true;return b},update:()=>{st.writes=true;return b},delete:()=>{st.writes=true;return b},
      then:(res,rej)=>Promise.resolve().then(()=>{
        let r=table==='minds_work_memory'?rows.slice():[];
        for(const [k,c,v] of st.ops){
          if(k==='eq')r=r.filter(x=>wert(x,c)===v);
          else if(k==='in')r=r.filter(x=>v.includes(wert(x,c)));
          else if(k==='ilike')r=r.filter(x=>like(wert(x,c),v));
          else if(k==='or'){const t=c.split(',').map(s=>{const [col,,...m]=s.split('.');return [col,m.join('.')]});r=r.filter(x=>t.some(([col,m])=>like(wert(x,col),m)))}
        }
        if(st.limit)r=r.slice(0,st.limit);
        return {data:r,error:null};
      }).then(res,rej)};
    log.push(st);return b;
  };
  return {db:{from},log};
}
const ctx=db=>({userDb:db,admin:null,userId:U,conversationId:U,requestId:U,apiKey:null});

test('Romy bekommt zwei lesende Werkzeuge für das Projektwissen',()=>{
  const by=Object.fromEntries(ROMY_TOOLS.map(t=>[t.name,t]));
  assert.deepEqual(by.search_project_knowledge.parameters.required,['project_id']);
  assert.deepEqual(by.read_project_knowledge_page.parameters.required,['project_id','title']);
  assert.match(by.search_project_knowledge.description,/Only the project team sees it\./);
  // Lesend: kein Vorschlag, kein Schreiben.
  const code=read('supabase/functions/office-assistant/romy-tools.mjs');
  const teil=code.slice(code.indexOf('if(name==="search_project_knowledge")'),code.indexOf('if(name==="read_text_file")'));
  assert.doesNotMatch(teil,/\.(insert|update|upsert|delete|rpc)\(|admin\./);
  assert.match(teil,/userDb\.from\("minds_work_memory"\)/);
});

test('search_project_knowledge: nur Seiten des Projektwissens, Entscheidungen mit Status in Worten, Filterzeichen neutralisiert',async()=>{
  const {db,log}=fakeDb();
  assert.deepEqual(await executeRomyTool('search_project_knowledge',{project_id:'x'},ctx(db)),{error:'invalid_project_id'});
  const alle=await executeRomyTool('search_project_knowledge',{project_id:P},ctx(db));
  assert.deepEqual(alle.pages.map(p=>[p.title,p.kurz,'auszug' in p]),[['Bodenbelag','Zwei Strategien, Entscheidung bei der Bemusterung',false],['Kostenvergleich Bodenbelag','A gegenüber B',false]]);
  assert.deepEqual(alle.decisions.map(d=>[d.title,d.status,d.datum,d.seite]),[['Bodenbelag Strategie A als Vorzugsvariante','vorgeschlagen','2026-11-10','Bodenbelag'],['Kautschuk entfällt','beschlossen','2026-11-05','Bodenbelag']]);
  assert.match(alle.note,/vorgeschlagen is not decided yet/);
  const q=await executeRomyTool('search_project_knowledge',{project_id:P,query:'terrazzo, (eg)'},ctx(db));
  assert.deepEqual(q.pages.map(p=>p.title),[],'«terrazzo   eg» steht so nirgends');
  const t=await executeRomyTool('search_project_knowledge',{project_id:P,query:'Terrazzo'},ctx(db));
  assert.deepEqual(t.pages.map(p=>p.title),['Bodenbelag']);
  assert.match(t.pages[0].auszug,/Terrazzo EG/);
  const orFilter=log.filter(st=>st.ops.some(([k])=>k==='or')).map(st=>st.ops.find(([k])=>k==='or')[1]);
  assert.ok(orFilter.includes('title.ilike.%terrazzo   eg%,body.ilike.%terrazzo   eg%'),orFilter.join(' | '));
  assert.ok(log.every(st=>st.ops.some(([k,c,v])=>k==='eq'&&c==='project_id'&&v===P)),'jede Abfrage im Projekt');
  assert.ok(log.every(st=>!st.writes));
  const leer=await executeRomyTool('search_project_knowledge',{project_id:P,query:'Brandschutz'},ctx(db));
  assert.match(leer.note,/not in the project team/);
});

test('read_project_knowledge_page: genauer Titel, Weiterleitung, Verweise und Entscheidungen der Seite; unbekannt mit Liste',async()=>{
  const {db,log}=fakeDb();
  const s=await executeRomyTool('read_project_knowledge_page',{project_id:P,title:'bodenbelag'},ctx(db));
  assert.deepEqual([s.found,s.title,s.redirected_from,s.truncated],[true,'Bodenbelag',null,false]);
  assert.deepEqual(s.links,['Kostenvergleich Bodenbelag','Lichtkonzept']);
  assert.deepEqual(s.decisions.map(d=>[d.title,d.status]),[['Bodenbelag Strategie A als Vorzugsvariante','vorgeschlagen'],['Kautschuk entfällt','beschlossen']],'keine ersetzte');
  // Der Titel gilt genau (Platzhalter wörtlich), nicht als Teilstück.
  const titel=log.filter(st=>st.ops.some(([k])=>k==='ilike')).map(st=>st.ops.find(([k])=>k==='ilike')[2]);
  assert.equal(titel[0],'bodenbelag');
  const teil=await executeRomyTool('read_project_knowledge_page',{project_id:P,title:'Boden'},ctx(db));
  assert.deepEqual([teil.found,teil.pages],[false,['Bodenbelag','Kostenvergleich Bodenbelag']]);
  const weiter=await executeRomyTool('read_project_knowledge_page',{project_id:P,title:'Bodenbeläge alt'},ctx(db));
  assert.deepEqual([weiter.found,weiter.title,weiter.redirected_from],[true,'Bodenbelag','Bodenbeläge alt']);
  assert.deepEqual(await executeRomyTool('read_project_knowledge_page',{project_id:P,title:' '},ctx(db)),{error:'missing_title'});
  assert.equal(knowledgeExcerpt('x'.repeat(400)+' Treffer '+'y'.repeat(800),'treffer').startsWith('…'),true);
});

test('Anweisungen: in den Threads zuerst das Projektwissen; der Hauptchat findet es schon über search_work',()=>{
  const oa=read('supabase/functions/office-assistant/index.ts');
  assert.match(oa,/"Projektwissen: Fragen zum Stand eines Projekts, zu Entscheidungen, Produkten, Kosten oder offenen Punkten zuerst mit search_project_knowledge beantworten/);
  assert.match(oa,/«vorgeschlagen» ist noch nicht entschieden\. Du schreibst nicht ins Projektwissen/);
  assert.match(oa,/nutze sein Projektwissen, seine Aufgaben, Dateien und Terminpläne/);
  // Der Hauptchat ist Windows Motor (byte-gleich, siehe romy-engine-parity): seine Projektsuche liest die Projektakte
  // mit Titel, Text und Status, also auch die Seiten und Entscheidungen des Projektwissens. Ändert Window das, fällt es hier auf.
  const chat=read('supabase/functions/isabella-chat/index.ts');
  assert.match(chat,/sb\.from\("minds_work_memory"\)\.select\("id,memory_type,title,body,status,[^"]*"\)\.eq\("project_id",project\.id\)\.in\("status",\["proposed","confirmed","resolved"\]\)/);
  assert.match(chat,/query,files,tasks,memory,claims/);
});
