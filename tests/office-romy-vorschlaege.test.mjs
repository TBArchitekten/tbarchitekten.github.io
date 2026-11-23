// Was App und Server-Funktionen in der Datenbank aufrufen, gibt es dort auch (23.11.2026).
//
// Gari: «Wissen» rief eine Funktion auf, die es in der Office-Datenbank nicht gab; er bat, das Office gründlich
// nach Fehlern derselben Art zu durchsuchen. Gefunden: acht Aufrufe für Romys Vorschläge (Erinnerung,
// Erwartung, Ziel, Projektwissen, Fähigkeit) und die Funktionen dazu fehlten; die Bucket-Funktionen fehlten bis
// #134 ebenso. Dieser Test hält fest, dass jede Funktion und jede Tabelle, die der Code anspricht, in einer
// Migration entsteht. Was nur Window hat, steht unten in einer Liste, mit der Stelle, die es im Office verbirgt.
// Und der Heartbeat: Fingerabdrücke über 500 Zeichen ließen ihn seit dem 14.11. abends scheitern.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
const root=new URL('../',import.meta.url).pathname;
const read=p=>readFileSync(join(root,p),'utf8');
const list=(dir,re)=>{
  const out=[];
  const walk=d=>{for(const name of readdirSync(join(root,d))){const p=join(d,name);
    if(statSync(join(root,p)).isDirectory())walk(p);else if(re.test(name))out.push(p)}};
  walk(dir);return out;
};
const ohneKommentar=s=>s.replace(/--.*$/gm,'');
const migrationen=readdirSync(join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()
  .map(f=>read('supabase/migrations/'+f)).join('\n');
const neu=read('supabase/migrations/20261123120000_office_romy_vorschlaege_v1.sql');
const funktionen=new Set([...migrationen.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z0-9_]+)"?\s*\(/gi)].map(m=>m[1].toLowerCase()));
const tabellen=new Set([...migrationen.matchAll(/create\s+(?:table\s+(?:if\s+not\s+exists\s+)?|(?:or\s+replace\s+)?view\s+)(?:public\.)?"?([a-z0-9_]+)"?/gi)].map(m=>m[1].toLowerCase()));

const client=[...readdirSync(join(root,'app')).filter(f=>/\.(js|html)$/.test(f)).map(f=>'app/'+f),
  ...readdirSync(root).filter(f=>/\.(js|html)$/.test(f)),
  ...readdirSync(join(root,'shared')).filter(f=>f.endsWith('.js')).map(f=>'shared/'+f)];
const server=list('supabase/functions',/\.(ts|mjs)$/);
const rpcs=files=>{const m=new Map();for(const f of files)for(const x of read(f).matchAll(/\.rpc\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g))m.set(x[1],[...(m.get(x[1])||[]),f]);return m};
const tables=files=>{const m=new Map();for(const f of files){const s=read(f);for(const x of s.matchAll(/\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)/g)){
  if(/storage\s*$/.test(s.slice(Math.max(0,x.index-12),x.index)))continue;m.set(x[1],[...(m.get(x[1])||[]),f])}}return m};

// Nur in Window; im Office nicht erreichbar. Wird eines davon portiert, gehört es hier hinaus.
const NUR_WINDOW_RPC={
  minds_get_personal_operating_model:'afterSync endet im Office sofort; Gedächtnis-Panel verborgen',
  minds_review_operating_hypothesis:'Gedächtnis-Panel (data-action="memory") verborgen',
  minds_preview_contextual_counterfactual:'Berechtigungen (data-action="permissions") verborgen',
  minds_review_contextual_permission:'Berechtigungen (data-action="permissions") verborgen',
  minds_review_post_action_feedback:'Berechtigungen (data-action="permissions") verborgen',
  minds_review_debt_summary:'Prüfungen (data-action="reviews") verborgen',
  minds_review_artifact_intake:'Artefakte (data-action="artifacts") verborgen',
  minds_register_push_subscription:'Push (data-action="push") verborgen; das Office hat keine Push-Avisos',
  minds_remove_push_subscription:'Push (data-action="push") verborgen',
  minds_retry_window_code_v1:'Selbstprüfung von Window: im Office ohne Einstellungen (project&&!OFFICE)',
  minds_set_window_code_v1:'Selbstprüfung von Window: im Office ohne Einstellungen (project&&!OFFICE)',
  minds_review_improvement_v1:'Selbstprüfung von Window: im Office ohne Einstellungen (project&&!OFFICE)'
};
const NUR_WINDOW_RPC_SERVER={
  minds_store_vapid_pair_if_absent:'Web-Push: isabella-delivery-runner endet im Office-Profil (multi_user) vorher'
};
const NUR_WINDOW_TABELLEN={
  minds_surface_items:'Feed/Ideen und afterSync; im Office ohne Feed',
  minds_surface_feedback:'Feed; im Office ohne Feed',
  isabella_research_queue:'Lecturas; im Office verborgen',
  minds_feed_jobs:'Feed; im Office ohne Feed',
  minds_idea_workspaces:'Ideen; Tab im Eingang verborgen',
  minds_idea_messages:'Ideen; Tab im Eingang verborgen',
  sofia_skills:'Fähigkeiten-Panel (data-action="skills") verborgen; Sofía gibt es im Office nicht',
  minds_window_code_jobs:'Selbstprüfung von Window: im Office ohne Einstellungen (project&&!OFFICE)'
};
const NUR_WINDOW_TABELLEN_SERVER={
  minds_surface_items:'Heartbeat schreibt nur im Profil window hinein',
  minds_window_code_jobs:'Window-Code-Worker; im Office nicht verteilt'
};

test('Jede Funktion, die die App aufruft, entsteht in einer Migration (oder ist nur Window und verborgen)',()=>{
  const fehlt=[...rpcs(client).keys()].filter(n=>!funktionen.has(n.toLowerCase())&&!(n in NUR_WINDOW_RPC)).sort();
  assert.deepEqual(fehlt,[],'ohne Migration: '+fehlt.join(', '));
  for(const n of Object.keys(NUR_WINDOW_RPC))
    assert.ok(!funktionen.has(n),n+' gibt es jetzt im Office; aus der Liste NUR_WINDOW_RPC nehmen');
  const fehltServer=[...rpcs(server).keys()].filter(n=>!funktionen.has(n.toLowerCase())&&!(n in NUR_WINDOW_RPC_SERVER)).sort();
  assert.deepEqual(fehltServer,[],'Server-Funktionen ohne Migration: '+fehltServer.join(', '));
});

test('Jede Tabelle, die App und Server ansprechen, entsteht in einer Migration (oder ist nur Window)',()=>{
  const fehlt=[...tables(client).keys()].filter(n=>!tabellen.has(n.toLowerCase())&&!(n in NUR_WINDOW_TABELLEN)).sort();
  assert.deepEqual(fehlt,[],'Tabellen ohne Migration: '+fehlt.join(', '));
  const fehltServer=[...tables(server).keys()].filter(n=>!tabellen.has(n.toLowerCase())&&!(n in NUR_WINDOW_TABELLEN_SERVER)).sort();
  assert.deepEqual(fehltServer,[],'Server-Tabellen ohne Migration: '+fehltServer.join(', '));
  for(const n of [...Object.keys(NUR_WINDOW_TABELLEN),...Object.keys(NUR_WINDOW_TABELLEN_SERVER)])
    assert.ok(!tabellen.has(n),n+' gibt es jetzt im Office; aus der Liste nehmen');
});

test('Was nur Window hat, bleibt im Office tatsächlich verborgen',()=>{
  const app=read('app/app.js'),shell=read('app/shell.js'),work=read('app/work.js');
  assert.match(app,/async function afterSync\(\)\{\n  if\(OFFICE\)return;/);
  assert.match(work,/const settings=project&&!OFFICE\?await waitForWork\(/);
  const i=shell.indexOf('<div class="office-hidden-actions" hidden>');
  assert.ok(i>0,'die verborgenen Aktionen sind nicht mehr verborgen');
  const verborgen=shell.slice(i,shell.indexOf('</div>',i));
  for(const a of ['memory','push','permissions','reviews','skills','artifacts'])
    assert.match(verborgen,new RegExp('data-action="'+a+'"'),a+' ist nicht mehr verborgen');
  assert.match(read('supabase/functions/isabella-delivery-runner/index.ts'),/if\(resolveAssistantProfile\(Deno\.env\.get\("ASSISTANT_PROFILE"\)\|\|"window"\)\.multi_user\)/);
});

test('Romys Vorschläge: acht Funktionen, jede prüft Anmeldung und Mitgliedschaft selbst',()=>{
  const app=read('app/app.js');
  const acht=['minds_create_prospective_memory','minds_ack_standing_intents','minds_cancel_prospective_memory',
    'minds_create_expectation','minds_review_expectation','minds_create_commitment','minds_save_work_claim','minds_apply_personal_skill'];
  for(const f of acht){
    assert.ok(app.includes("sb.rpc('"+f+"'"),'die App ruft '+f+' nicht mehr auf');
    const start=neu.indexOf('create or replace function public.'+f+'(');
    assert.ok(start>=0,f+' fehlt in der Migration');
    const body=neu.slice(start,neu.indexOf('\n$$;',start));
    assert.match(body,/set search_path = ''/,f+': leerer search_path');
    assert.match(body,/not \(select private\.office_is_member\(\)\)/,f+': prüft die Mitgliedschaft nicht');
    assert.match(neu,new RegExp('revoke all on function public\\.'+f+'\\([^)]*\\) from public, anon;'));
    assert.match(neu,new RegExp('grant execute on function public\\.'+f+'\\([^)]*\\) to authenticated;'));
  }
  // Schreiben im Office nur über diese Funktionen (die Tabellen erlauben nur das Lesen eigener Zeilen).
  for(const f of ['minds_create_prospective_memory','minds_ack_standing_intents','minds_cancel_prospective_memory',
    'minds_create_commitment','minds_save_work_claim','minds_apply_personal_skill'])
    assert.match(neu,new RegExp('create or replace function public\\.'+f+'\\([\\s\\S]*?\\)\\s*returns [a-z]+\\s*language plpgsql\\s*security definer'),f);
  // Projekte: persönliches auf jedes aktive Office-Projekt, Projektwissen nur im Team; nie isabella_projects.user_id.
  assert.doesNotMatch(ohneKommentar(neu),/isabella_projects/);
  assert.equal((neu.match(/select 1 from public\.office_projects p where p\.id = (v_project|project) and p\.status = 'aktiv'/g)||[]).length,3);
  assert.match(neu,/if project is null or not \(select private\.office_project_team_has_access\(project\)\) then/);
  // Belege: Dateien gehören dem Projekt; eine Prüfung behält die vorige Fassung und nennt, wer geprüft hat.
  assert.match(neu,/select 1 from public\.minds_work_files f where f\.id = source_file and f\.project_id = project/);
  assert.match(neu,/'reviewed_by',u,\s*'previous_versions'/);
  // Fähigkeiten im Office nur für Romy (intern isabella).
  assert.match(neu,/a text := 'isabella';/);
  // Nichts löschen, keine Policy ändern.
  assert.doesNotMatch(ohneKommentar(neu),/\bdrop\b|\btruncate\b|\bdelete\s+from\b|\bpolicy\b|\balter table\b/i);
  // Meldungen auf Deutsch, weil die App sie wörtlich zeigt.
  assert.doesNotMatch(neu,/raise exception '(Explicit|Invalid|Project|Authenticated|Authentication|Evidence|Claim|Prior|Replacement|System|Conversation|Checkpoint|Open loop|Watch|Prospective|Trigger|Reminder|Observation|Condition|Expectation|Request|Completion)/);
});

test('Heartbeat: lange Fingerabdrücke werden für Aufmerksamkeit und Kontinuität stabil gekürzt',()=>{
  const start=neu.indexOf('create or replace function public.minds_publish_heartbeat(p_user uuid, p_candidate jsonb)');
  assert.ok(start>0);
  const hb=neu.slice(start);
  assert.match(hb,/v_key:=case when length\(e\.fingerprint\)>400 then left\(e\.fingerprint,80\)\|\|':md5:'\|\|md5\(e\.fingerprint\) else e\.fingerprint end;/);
  assert.match(hb,/'event_key','heartbeat:'\|\|v_key,/);
  assert.match(hb,/'fingerprint','heartbeat:'\|\|v_key,/);
  // Die Heartbeat-Tabelle behält den vollen Wert; resolveAbsent vergleicht weiter damit.
  assert.match(hb,/where user_id=p_user and fingerprint=p_candidate->>'fingerprint'/);
  assert.match(read('supabase/functions/isabella-heartbeat/index.ts'),/fingerprint:`overdue_digest:\$\{overdue\.map\(\(t:any\)=>String\(t\.id\)\)\.sort\(\)\.join\(","\)\}`/);
  // Rechte bleiben wie in Phase 1 (nur service_role): create or replace behält sie, kein neues grant.
  assert.doesNotMatch(neu,/grant [^;]*minds_publish_heartbeat/i);
});

test('Die Abnahme läuft in einer zurückgerollten Transaktion in der CI',()=>{
  const abnahme=read('tests/sql/office-romy-vorschlaege-acceptance.sql');
  assert.match(abnahme,/^begin;$/m);assert.match(abnahme,/^rollback;$/m);assert.match(abnahme,/example\.invalid/);
  for(const teil of ['B_beendet=missing','B_erwartung=created','T_prueft=confirmed','gehoert_A=true','B_wissen=verweigert',
    'fremde_datei=verweigert','faehigkeit=1/isabella','heartbeat_nochmal=false','schluessel=true','rechte=ok'])
    assert.ok(abnahme.includes(teil),'Abnahme ohne '+teil);
  assert.match(read('.github/workflows/verify.yml'),/< tests\/sql\/office-romy-vorschlaege-acceptance\.sql/);
});
