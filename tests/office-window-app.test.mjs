// The Window iPhone app opens TBA Office as its second account (decision of Gari, 07.11.2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('In the app the office session comes from the app, never from the page', ()=>{
  const client=read('shared/supabase-client.js');
  // Outside the app (browser) nothing changes: own session with the office storage key.
  assert.match(client,/if \(!bridge\) \{\n    window\.MINDS_SUPABASE = window\.supabase\.createClient\(config\.url, config\.publishableKey, \{\n      auth: \{\n        storageKey: office\.storageKey,/);
  // Inside the app: access token borrowed through the bridge, no stored session, sign-in in the app.
  assert.match(client,/accessToken: async \(\) => \(await current\(\)\)\?\.access_token \?\? null/);
  assert.match(client,/localStorage\.removeItem\(office\.storageKey\)/);
  assert.match(client,/signOut: async \(\) => \{ cached = null; await call\('session\.signOut'\); return \{ error: null \}; \}/);
  assert.match(client,/signInWithPassword: signInInApp/);
  assert.doesNotMatch(client,/refresh_token|refreshToken/,'the page never sees the refresh token');
});

test('Sign-in and sign-out go through the app; the browser keeps the start page', ()=>{
  const sync=read('app/sync.js'),shell=read('app/shell.js');
  assert.match(sync,/if\(window\.WINDOW_NATIVE\?\.available\)\{void window\.WINDOW_NATIVE\.call\('session\.signIn'\);return\}\n  location\.replace\('\.\.\/'\);/);
  assert.match(sync,/onAuthStateChange\(\(event,session\)=>\{if\(event==='SIGNED_OUT'\|\|!session\)openLogin\(\)\}\)/);
  assert.match(shell,/if\(window\.WINDOW_NATIVE\?\.available\)return;\n  location\.replace\('\.\.\/'\);/);
});

test('Office tabs in the app: Romy, Heute, Kalender, Work, Tools; switch to Persönlich in the menu', ()=>{
  const app=read('app/app.js'),shell=read('app/shell.js');
  assert.match(app,/const WINDOW_TAB_FOR=OFFICE\?\{assistant:'chat',feed:'ahora',calendar:'tiempo',work:'work',tools:'tools',projects:'tools',plans:'tools'\}/);
  assert.match(shell,/<button id="officeSwitchAccount" type="button" hidden>Zu Persönlich wechseln<\/button>/);
  assert.match(shell,/includes\('account\.switch'\)/);
  assert.match(shell,/native\.call\('account\.switch',\{to:'personal'\}\)/);
  const index=read('app/index.html');
  for(const s of ['../shared/supabase-client.js?v=office2','./shell.js?v=office41','./app.js?v=office41','./sync.js?v=office3'])
    assert.ok(index.includes(s),s);
});
