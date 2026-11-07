import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validEmail,validName,validRole,startPassword,lastAdminGuard} from '../supabase/functions/office-admin/rules.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('only office e-mail addresses become accounts',()=>{
  assert.equal(validEmail('martinez@bernhardarchitekten.com','bernhardarchitekten.com'),true);
  assert.equal(validEmail('  Martinez@BernhardArchitekten.com ','bernhardarchitekten.com'),true);
  assert.equal(validEmail('someone@gmail.com','bernhardarchitekten.com'),false);
  assert.equal(validEmail('x@bernhardarchitekten.com.evil.io','bernhardarchitekten.com'),false);
  assert.equal(validEmail('edgar.office@access.invalid','bernhardarchitekten.com'),false);
  assert.equal(validEmail('no-at-sign','bernhardarchitekten.com'),false);
});

test('names and roles are checked',()=>{
  assert.equal(validName('Natalia'),true);
  assert.equal(validName(''),false);
  assert.equal(validName('<script>'),false);
  assert.equal(validName('x'.repeat(81)),false);
  for(const r of ['admin','projektleiter','member'])assert.equal(validRole(r),true);
  assert.equal(validRole('owner'),false);
});

test('start passwords are readable, long enough and never repeat',()=>{
  const seen=new Set();
  for(let i=0;i<200;i++){
    const p=startPassword();
    assert.match(p,/^[a-km-np-zA-HJ-NP-Z2-9]{4}-[a-km-np-zA-HJ-NP-Z2-9]{4}-[a-km-np-zA-HJ-NP-Z2-9]{4}$/);
    assert.ok(!/[0O1lI]/.test(p),'no look-alike characters');
    seen.add(p);
  }
  assert.equal(seen.size,200);
});

test('the office never loses its last admin and nobody locks themselves out',()=>{
  const admin={user_id:'a',role:'admin',is_active:true};
  assert.equal(lastAdminGuard({target:admin,patch:{role:'member'},callerId:'a',activeAdmins:2}),'cannot_demote_self');
  assert.equal(lastAdminGuard({target:admin,patch:{is_active:false},callerId:'b',activeAdmins:1}),'last_admin');
  assert.equal(lastAdminGuard({target:admin,patch:{is_active:false},callerId:'b',activeAdmins:2}),null);
  assert.equal(lastAdminGuard({target:{user_id:'m',role:'member',is_active:true},patch:{role:'admin'},callerId:'a',activeAdmins:1}),null);
  assert.equal(lastAdminGuard({target:admin,patch:{display_name:'Edgar'},callerId:'a',activeAdmins:1}),null);
});

test('the admin function checks the caller before any change and never stores the start password',()=>{
  const fn=read('supabase/functions/office-admin/index.ts');
  const authAt=fn.indexOf('admin.auth.getUser(token)'),roleAt=fn.indexOf('caller.role!=="admin"'),firstWrite=fn.indexOf('createUser(');
  assert.ok(authAt>0&&roleAt>authAt&&firstWrite>roleAt,'session and admin role are verified first');
  assert.match(fn,/email_confirm:true/);
  assert.doesNotMatch(fn,/insert\(\{[^}]*\bpassword\b/,'the start password is never written to a table');
  assert.match(fn,/const ORIGIN="https:\/\/tbarchitekten\.github\.io"/);
  assert.match(fn,/ban_duration:patch\.is_active\?"none":BLOCKED/);
});

test('the base schema keeps every Office table behind membership and roles',()=>{
  const sql=read('supabase/migrations/20261103222203_office_base_v1.sql');
  for(const t of ['office_members','office_projects','office_terminplan_templates','office_terminplan_instances','office_terminplan_versions','office_terminplan_dialogue_messages','office_terminplan_ai_requests'])
    assert.match(sql,new RegExp('alter table public\\.'+t+' enable row level security'),t+' has RLS');
  assert.match(sql,/revoke all on public\.office_members from public, anon, authenticated/);
  assert.doesNotMatch(sql,/grant [^;]* to anon/);
  assert.match(sql,/project_id uuid not null references public\.office_projects\(id\)/,'every Terminplan belongs to a project');
  assert.match(sql,/role in \('admin','projektleiter','member'\)/);
  // Policies on office_members cannot recurse: membership checks are definer functions.
  assert.match(sql,/create function private\.office_is_member\(\) returns boolean\s+language sql stable security definer set search_path = ''/);
  // Only Office tables: nothing from Bernried, MINDS or Isabella is referenced.
  assert.doesNotMatch(sql,/references public\.(?!office_)/);
  assert.doesNotMatch(sql,/public\.(minds_|isabella_|projects\b|project_members|documents)/);
});
