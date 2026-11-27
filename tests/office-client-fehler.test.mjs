// Fehler aus dem Browser (Gari, 27.11.2026): die Seiten melden Skriptfehler an office_client_fehler_melden, damit die
// tägliche Codeprüfung mit echten Fehlern arbeitet. Geprüft: was gemeldet wird (nur Technisches, bereinigt), was nicht
// (Rauschen, Erweiterungen, Wiederholungen, mehr als acht), dass jede Seite das Skript lädt, und die Migration.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const SKRIPT=read('shared/fehler-melden.js');

function seite(){
  const handlers={},calls=[];
  const ctx={
    location:{origin:'https://office.example',pathname:'/app/'},
    navigator:{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15'},
    document:{scripts:[{getAttribute:()=>'../shared/supabase-client.js?v=office4'},{getAttribute:()=>'./app.js?v=office60'}]},
    MINDS_SUPABASE:{rpc:async(name,args)=>{calls.push({name,args});return {error:null}}},
    console
  };
  ctx.window=ctx;
  ctx.addEventListener=(type,fn)=>{handlers[type]=fn};
  vm.runInNewContext(SKRIPT,ctx);
  return {ctx,handlers,calls};
}
const warten=()=>new Promise(r=>setTimeout(r,0));

test('bereinigt: Parameter fremder Adressen, E-Mail-Adressen und Tokens verschwinden, die Länge ist begrenzt',()=>{
  const {ctx}=seite(),s=ctx.TBA_OFFICE_FEHLER.saeubern;
  assert.equal(s('Failed to fetch https://abc.supabase.co/rest/v1/x?select=*&apikey=geheim',300),'Failed to fetch https://abc.supabase.co/rest/v1/x');
  assert.equal(s('Kein Zugang für anna.muster@example.com',300),'Kein Zugang für [E-Mail]');
  assert.equal(s('Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEF_123',300),'Bearer [Token]');
  assert.equal(s('x'.repeat(500),300).length,300);
});

test('meldet einen Skriptfehler mit Ort im Code (Version bleibt) und Seite ohne Parameter',async()=>{
  const {handlers,calls}=seite();
  handlers.error({message:'Cannot read properties of undefined (reading \'name\')',filename:'https://office.example/app/app.js?v=office60',lineno:120,colno:7,
    error:{stack:'TypeError: x\n    at render (https://office.example/app/work.js?v=office61:44:9)'}});
  await warten();
  assert.equal(calls.length,1);
  const a=calls[0];
  assert.equal(a.name,'office_client_fehler_melden');
  assert.equal(a.args.p_seite,'/app/');
  assert.equal(a.args.p_art,'fehler');
  assert.equal(a.args.p_ort,'/app/app.js?v=office60:120:7');
  assert.match(a.args.p_stapel,/at render \(\/app\/work\.js\?v=office61:44:9\)/);
  assert.equal(a.args.p_browser,'Safari 18 · macOS');
  assert.equal(a.args.p_version,'app.js?v=office60');
});

test('Rauschen, Erweiterungen und abgebrochene Anfragen werden nicht gemeldet; jeder Fehler nur einmal, höchstens acht',async()=>{
  const {handlers,calls}=seite();
  handlers.error({message:'Script error.',filename:'',lineno:0,colno:0});
  handlers.error({message:'ResizeObserver loop completed with undelivered notifications.',filename:'https://office.example/app/app.js',lineno:1,colno:1});
  handlers.error({message:'boom',filename:'chrome-extension://abc/inject.js',lineno:1,colno:1});
  handlers.unhandledrejection({reason:{name:'AbortError',message:'The operation was aborted.'}});
  await warten();
  assert.equal(calls.length,0,'nichts davon');
  for(let i=0;i<2;i++)handlers.error({message:'gleich',filename:'https://office.example/app/app.js',lineno:5,colno:5});
  await warten();
  assert.equal(calls.length,1,'gleicher Fehler nur einmal');
  for(let i=0;i<20;i++)handlers.unhandledrejection({reason:{message:'Fehler '+i}});
  await warten();
  assert.equal(calls.length,8,'höchstens acht je Seitenaufruf');
  assert.equal(calls[1].args.p_art,'promise');
});

test('jede Seite des Office lädt das Skript direkt nach dem Supabase-Client',()=>{
  for(const [f,pre] of [['index.html','./'],['controlling.html','./'],['herstellerkatalog.html','./'],['kostenberechnung.html','./'],
    ['projektdokumente.html','./'],['produktbibliothek.html','./'],['terminplan.html','./'],['app/index.html','../']]){
    const html=read(f);
    const a=html.indexOf(pre+'shared/supabase-client.js'),b=html.indexOf(pre+'shared/fehler-melden.js?v=1');
    assert.ok(a>0&&b>a&&html.slice(a,b).split('<script').length===2,f);
  }
});

test('Migration: nur melden (Mitglieder, gedrosselt, bereinigt), lesen nur der Dienst, nichts Destruktives',()=>{
  const datei=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>/^\d{14}_office_client_fehler\.sql$/.test(f));
  assert.equal(datei.length,1);
  const sql=read('supabase/migrations/'+datei[0]);
  assert.match(sql,/alter table public\.office_client_fehler enable row level security;\nrevoke all on public\.office_client_fehler from public, anon, authenticated;/);
  assert.doesNotMatch(sql,/create policy/i,'keine Policy: über die App liest und schreibt niemand direkt');
  assert.match(sql,/unique \(user_id, tag, fingerabdruck\)/);
  assert.match(sql,/if v_uid is null or not \(select private\.office_is_member\(\)\) then\n    return;/);
  assert.match(sql,/if v_heute >= 50 and not exists/);
  assert.match(sql,/security definer\nset search_path = ''/);
  assert.match(sql,/revoke all on function public\.office_client_fehler_melden\(text, text, text, text, text, text, text\) from public, anon;\ngrant execute on function public\.office_client_fehler_melden\(text, text, text, text, text, text, text\) to authenticated;/);
  assert.match(sql,/'\[E-Mail\]'/);assert.match(sql,/'\[Token\]'/);
  assert.doesNotMatch(sql.replace(/--.*$/gm,''),/\b(drop|truncate|delete\s+from)\b/i);
});
