// Terminpläne, Mitglieder and Passwort ändern inside the Window iPhone app (account Office):
// they borrow the app's session through the bridge, never ask for a second sign-in (07.11.2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('terminplan.html uses the bridged client and the app sign-in, and returns to the app', ()=>{
  const html=read('terminplan.html');
  const client=html.indexOf('./shared/supabase-client.js?v=office3'),config=html.indexOf('./office-config.js'),inline=html.indexOf('const sb=window.MINDS_SUPABASE||');
  assert.ok(config>0&&client>config&&inline>client,'config, then the shared client, then the page script');
  assert.match(html,/const inApp=!!window\.WINDOW_NATIVE\?\.available;/);
  assert.match(html,/function needSignIn\(\)\{\n\s*if\(inApp\)\{void window\.WINDOW_NATIVE\.call\('session\.signIn'\);return\}\n\s*location\.href='\.\/';/);
  assert.match(html,/if\(sessionError\|\|!sessionData\.session\)\{\n\s*needSignIn\(\);/);
  assert.match(html,/location\.href=inApp\?'\.\/app\/#section=plans':'\.\/';/);
  // No other way back to the start page's sign-in from the plan.
  assert.equal(html.match(/location\.href='\.\/'/g).length,2);
});

test('The start page (Mitglieder, Passwort ändern) borrows the app session too', ()=>{
  const index=read('index.html'),app=read('app.js');
  assert.ok(index.indexOf('./shared/supabase-client.js?v=office3')>index.indexOf('./office-config.js'));
  assert.ok(index.includes('./app.js?v=6'));
  assert.match(app,/const sb=window\.MINDS_SUPABASE\|\|supabase\.createClient\(/);
  assert.match(app,/if\(!session&&inApp\)\{void window\.WINDOW_NATIVE\.call\('session\.signIn'\);location\.replace\('\.\/app\/'\);return\}/);
  assert.match(app,/await sb\.auth\.signOut\(\);if\(inApp\)return;/);
});

function loadFacade(fetchImpl){
  const posted=[];
  const window={
    TBA_OFFICE_CONFIG:{url:'https://office.example',key:'pk',storageKey:'office.k'},
    supabase:{createClient:(url,key,opts)=>({url,key,opts})},
    webkit:{messageHandlers:{windowNative:{postMessage:async m=>{posted.push(m.type);
      return m.type==='session.get'?{v:1,ok:true,session:{access_token:'tok',expires_at:Date.now()/1000+3600,user:{id:'u'}}}:{v:1,ok:true}}}}}
  };
  const ctx=vm.createContext({window,localStorage:{removeItem(){}},fetch:fetchImpl,console,Date,Math,Promise,JSON,Object,Set,String});
  vm.runInContext(read('shared/supabase-client.js'),ctx);
  return {client:window.MINDS_SUPABASE,posted};
}

test('Bridged client: updateUser changes the password with the borrowed access token only', async()=>{
  let sent=null;
  const {client,posted}=loadFacade(async(url,init)=>{sent={url,init};return {ok:true,status:200,json:async()=>({id:'u'})}});
  const {data,error}=await client.auth.updateUser({password:'neu und lang genug',email:'x@y'});
  assert.equal(error,null);assert.equal(data.user.id,'u');
  assert.equal(sent.url,'https://office.example/auth/v1/user');
  assert.equal(sent.init.method,'PUT');
  assert.equal(sent.init.headers.Authorization,'Bearer tok');
  assert.equal(sent.init.headers.apikey,'pk');
  assert.deepEqual(JSON.parse(sent.init.body),{password:'neu und lang genug'});
  assert.deepEqual(posted,['session.get']);
  const weak=loadFacade(async()=>({ok:false,status:422,json:async()=>({error_code:'weak_password',msg:'Password is known to be weak'})}));
  const r=await weak.client.auth.updateUser({password:'123'});
  assert.equal(r.error.code,'weak_password');
});
