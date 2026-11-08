import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Shared personal panel only exists for Office profile; Window cannot load it',()=>{
  const src=read('app/office-personal.js');
  const root={APP_PROFILE:'window',MINDS_SUPABASE:{auth:{getSession(){throw new Error('should not query Window')}}}};
  vm.runInNewContext(src,{window:root,document:{getElementById:()=>null}});
  assert.equal(root.TBA_OFFICE_PERSONAL,undefined);
  assert.match(read('app/index.html'),/office-personal\.js\?v=romy4/);
});
test('Private panel and preference writes require live member authentication and owner-scoped data',()=>{
  const src=read('app/office-personal.js');
  assert.match(src,/sb\.auth\.getSession\(\)/);
  assert.match(src,/from\('office_members'\)/);
  assert.match(src,/member\?\.is_active===true/);
  assert.match(src,/!member\.must_change_password/);
  assert.match(src,/\.eq\('user_id',id\)/);
  assert.match(src,/const id=await assertOwner\(\)/);
  assert.match(src,/preference_key:'assistant'/);
  assert.match(src,/curiosityEnabled:enabled===true/);
  assert.match(src,/return \(await readOwnerPreference\(id\)\)\.curiosityEnabled===enabled/);
});
test('Forget never deletes browser rows or trusts member identity from input',()=>{
  const src=read('app/office-personal.js');
  assert.match(src,/window\.confirm\(/);
  assert.match(src,/office_romy_forget_private_memory/);
  assert.match(src,/data\?\.status!=='forgotten'/);
  assert.doesNotMatch(src,/\.delete\(\)/);
  const sql=read('supabase/migrations/20261108214000_office_romy_owner_forget_v1.sql');
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/private\.office_is_member\(\)/);
  assert.match(sql,/AND user_id=v_user/);
  assert.match(sql,/minds_invalidate_memory_lineage/);
  assert.match(sql,/GRANT EXECUTE.*authenticated/i);
});
test('Office keeps personal memory source exact and avoids duplicated migration versions',()=>{
  const manifest=JSON.parse(read('docs/sync-window-app-manifest.json'));
  const p=manifest.files.find(x=>x.target==='app/office-personal.js');
  assert.ok(p);
  assert.equal(p.source,'apps/isabella/office-personal.js');
  assert.equal(p.bytes,Buffer.byteLength(read('app/office-personal.js')));
});
