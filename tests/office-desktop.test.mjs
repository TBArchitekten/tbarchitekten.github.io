import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Office Desktop has shared office root and per-project tree without activating chat',()=>{
  const work=read('app/work.js'),shell=read('app/shell.js'),html=read('app/index.html');
  assert.match(work,/const OFFICE_ROOT='__office__'/);
  assert.match(work,/projectKey===OFFICE_ROOT\?renderDesktop\(\)/);
  assert.match(work,/function documentScope\(q\)/);
  assert.match(work,/documentScope\(sb\.from\('minds_work_folders'\)/);
  assert.match(work,/documentScope\(sb\.from\('minds_work_files'\)/);
  assert.match(work,/project\?\.id\|\|null/);
  assert.match(shell,/data-work-view="desktop">Desktop/);
  assert.match(html,/office-desktop-ops\.js\?v=office3/);
  assert.match(html,/work\.js\?v=office70/);
  assert.match(work,/const SHOW_BURO=false;/,'Büro Desktop hidden for now (Gari, 07.11.2026)');
});
test('Nested folder operations are real and deletion requires explicit confirmation',()=>{
  const ops=read('app/office-desktop-ops.js');
  assert.match(ops,/minds_work_folders/);
  assert.match(ops,/minds_work_files/);
  for(const op of ['Umbenennen','Verschieben','Löschen'])assert.ok(ops.includes(op));
  assert.match(ops,/window\.confirm/);
  assert.match(ops,/canManage/);
  assert.match(ops,/descendants\.has\(target\)/);
});
test('Files and metadata are private to active Office members, but visible across project teams',()=>{
  const sql=read('supabase/migrations/20261104203250_office_desktop_v1.sql');
  for(const t of ['minds_work_folders','minds_work_files'])assert.ok(sql.includes('alter table public.'+t+' enable row level security;'));
  for(const name of ['office_folders_read','office_files_read','office_work_storage_read','office_work_storage_insert'])
    assert.match(sql,new RegExp('create policy '+name));
  assert.match(sql,/private\.office_is_member\(\)/);
  assert.match(sql,/private\.office_is_admin\(\)/);
  assert.match(sql,/values \('minds-work', 'minds-work', false\)/);
  assert.match(sql,/storage\.foldername\(name\)/);
  assert.match(sql,/office_folder_cycle/);
  assert.match(sql,/office_file_folder_scope/);
  assert.match(sql,/storage\.foldername\(name\)\)\[2\] = 'personal'/);
  assert.doesNotMatch(sql,/to anon/);
  assert.doesNotMatch(sql,/service_role/);
});
test('Desktop exposes task attachments without loading personal Window data',()=>{
  const css=read('app/office.css'),work=read('app/work.js');
  assert.doesNotMatch(css,/:has\(#taskDetailAddFile\).*display:none/);
  assert.match(work,/project\?\.client_key\|\|'office'/);
  assert.match(work,/storage\.from\('minds-work'\)\.upload/);
  assert.match(work,/createSignedUrl/);
});

test('Desktop des Projektteams (Gari, 25.11.2026): Leiste nennt das Team, Dateien nennen, wer sie abgelegt hat; löschen nur eigene',()=>{
  const work=read('app/work.js'),ops=read('app/office-desktop-ops.js'),css=read('app/office.css');
  assert.match(work,/sb\.from\('office_project_members'\)\.select\('user_id'\)\.eq\('project_id',id\)/);
  assert.match(work,/Gemeinsamer Desktop des Projektteams: \$\{esc\(team\.namen\.join\(', '\)\)\}/);
  assert.match(work,/team\.namen\.length>1&&team\.person\.get\(f\.user_id\)\?`<small class="work-file-von">von \$\{esc\(team\.person\.get\(f\.user_id\)\)\}<\/small>`/);
  assert.match(ops,/create\('Löschen',\(\)=>isFolder\?removeFolder\(item\):removeFile\(item\),true\)/);
  assert.match(css,/\.office-desktop-actions button\.is-danger\{color:#aa3434\}/);
  assert.doesNotMatch(css,/\.office-desktop-actions button:last-child/,'Rot nur für Löschen, nicht für den letzten Knopf');
  // Storage lässt nur die Person löschen, die hochgeladen hat (erstes Pfadstück); vorher blieb die Datei liegen.
  assert.match(ops,/const ownUpload=item=>String\(item\?\.storage_path\|\|''\)\.split\('\/'\)\[0\]===userId;/);
  assert.match(ops,/if\(!office&&!ownUpload\(item\)\)\{setStatus\('Löschen kann diese Datei nur, wer sie hochgeladen hat\.'\);return\}/);
  assert.match(ops,/if\(isFolder\|\|office\|\|ownUpload\(item\)\)create\('Löschen'/);
  assert.match(work,/rows=gewaehlt\.filter\(f=>String\(f\.storage_path\|\|''\)\.split\('\/'\)\[0\]===uid\)/);
  assert.match(read('app/index.html'),/office-desktop-ops\.js\?v=office39/);
});
