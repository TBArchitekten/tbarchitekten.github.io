"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const editor=fs.readFileSync(path.join(__dirname,"../terminplan.html"),"utf8");
const sql=fs.readFileSync(path.join(__dirname,"../supabase/migrations/20261028_office_terminplan_server_revision.sql"),"utf8");
test("browser scripts parse and have no unmatched id selectors",()=>{
  for(const m of editor.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Function(m[1]);
  const ids=new Set([...editor.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  const missing=[...new Set([...editor.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]))].filter(x=>!ids.has(x));
  assert.deepEqual(missing,[]);
});
test("versioned write includes an expected server revision and failure stops autosave",()=>{
  assert.match(editor,/\.eq\('id',PLAN_ID\)\.eq\('server_revision',serverRevision\)/);
  assert.match(editor,/if\(saveConflict\)\{setSaveStatus/);
  assert.match(editor,/if\(inFlightSave\|\|!pendingSave\|\|!canEdit\|\|!PLAN_ID\|\|saveConflict\)return/);
  assert.match(editor,/if\(!updated\|\|updated\.length!==1\)/);
  assert.match(editor,/id,owner_id,project_number,project_name,phase,template_version,state,updated_at,server_revision/);
});
test("failed conditional save cannot silently overwrite and has an export/reload affordance",()=>{
  assert.match(editor,/id="conflictExport"/);
  assert.match(editor,/id="conflictReload"/);
  assert.match(editor,/raiseSaveConflict\(/);
  assert.match(editor,/window\.addEventListener\('beforeunload'/);
});
test("multiple links retained in editor and in both graphical and print flows",()=>{
  assert.match(editor,/id="extraDepRows"/);
  assert.match(editor,/dependencies:links/);
  assert.match(editor,/taskDependencies\(t\)\.forEach\(dep=>/);
  assert.match(editor,/taskDependencies\(task\)\.forEach\(dep=>/);
});
test("server revision is database-controlled, not client-writable",()=>{
  assert.match(sql,/server_revision bigint not null default 1/);
  assert.match(sql,/new\.server_revision := old\.server_revision \+ 1/);
  assert.match(sql,/before update on public\.office_terminplan_instances/);
});
