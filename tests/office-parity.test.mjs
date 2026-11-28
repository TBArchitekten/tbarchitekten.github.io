import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Office and Window Tools use the same five-icon navigation rather than switching UI shells',()=>{
  // Seit dem 27.11.2026 gibt es die Navigation nur in der App; die Startseite ist die Anmeldung.
  const root=file('index.html'),shell=file('app/shell.js'),app=file('app/app.js');
  assert.equal((root.match(/class="lens-nav-item/g)||[]).length,0);
  assert.equal((shell.match(/class="lens-nav-item[^"]*" data-nav="(assistant|feed|calendar|work|tools)"/g)||[]).length,5);
  for(const name of ["${shellKI('{name}')}",'Heute','Kalender','Work','Tools'])
    assert.ok(shell.includes('aria-label="'+name+'"'),'App nav missing '+name);
  assert.ok(file('app/office.css').includes('.office-app #mainNav{grid-template-columns:repeat(5,minmax(0,1fr))}'));
  assert.ok(shell.includes('id="toolsScreen"'));
  assert.ok(shell.includes('data-screen="tools"'));
  assert.ok(shell.includes('data-nav="tools"'));
  assert.ok(!shell.includes('href="../#tools"'));
  assert.ok(app.includes("'calendar','tools','projects','plans','readings'"));
  assert.ok(shell.includes('data-assistant-aria="{name}"'));
});
test('All active office members may rename and remove shared files without ownership restriction',()=>{
  const sql=file('supabase/migrations/20261104221830_office_shared_desktop_edit_for_all.sql');
  const ops=file('app/office-desktop-ops.js');
  const work=file('app/work.js');
  for(const policy of ['office_folders_update','office_folders_delete','office_files_update','office_files_delete','office_work_storage_delete'])
    assert.ok(sql.includes('create policy '+policy));
  assert.ok(sql.includes('private.office_is_member()'));
  assert.ok(!sql.includes('private.office_is_admin()'));
  assert.ok(!sql.includes('new.user_id'));
  assert.ok(sql.includes("[2]='personal'"));
  assert.ok(sql.includes("(select auth.uid())::text"));
  assert.ok(ops.includes('const canManage=()=>true'));
  assert.ok(!ops.includes("item?.user_id===userId"));
  assert.ok(ops.includes('window.confirm('));
  assert.ok(work.includes("(project?.name||'Büro')"));
  new Function(ops);new Function(work);
});

test('Storage policy scopes project files using outer objects.name, never project.name',()=>{
  const sql=file('supabase/migrations/20261104222033_office_storage_scope_qualified_name.sql');
  for(const policy of ['office_work_storage_read','office_work_storage_insert','office_work_storage_delete'])assert.ok(sql.includes('create policy '+policy));
  assert.ok(sql.includes('storage.foldername(objects.name)'));
  assert.ok(!sql.includes('storage.foldername(p.name)'));
  assert.ok(!sql.includes('storage.foldername(name)'));
  assert.ok(sql.includes("and (storage.foldername(objects.name))[1]=(select auth.uid())::text"));
  assert.ok(sql.includes("p.status='aktiv'"));
});
