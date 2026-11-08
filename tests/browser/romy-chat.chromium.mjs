// Real Chromium checks of the shared Window client and Office's canonical chat adapter.
// All data are synthetic. No live services, tokens, personal data or network calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';

const source=name=>fileURLToPath(new URL('../../app/'+name,import.meta.url));
const browser=await chromium.launch({headless:true});
test.after(async()=>{await browser.close()});
const createPage=async()=>{
  const page=await browser.newPage();
  await page.setContent('<main id="assistantScreen"><div class="composer-wrap"></div></main><nav><button id="officeSignOut"></button></nav><input id="chatInput"><section id="messages"></section>');
  return page;
};

test('Chromium: genuine SSE frames stream, finish once, and never replay an action',async()=>{
  const page=await createPage();
  try{
    await page.addScriptTag({path:source('final-round.js')});
    const out=await page.evaluate(async()=>{
      let recoveryCalls=0;
      const chunks=[
        'event: delta\ndata: {"text":"Gu"}\n\n',
        'event: delta\ndata: {"text":"ten Tag"}\n\n',
        'event: final\ndata: {"reply":"Guten Tag","outcome":{"outcome":"answered","proposal_count":0,"applied_count":0}}\n\n'
      ];
      const delta=[];
      const response=new Response(new ReadableStream({start(controller){
        for(const chunk of chunks)controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      }}),{headers:{'content-type':'text/event-stream'}});
      const data=await window.ISABELLA_FINAL_ROUND.ask({
        send:async()=>response,recover:async()=>{recoveryCalls++;return null},
        onDelta:(part,full)=>delta.push([part,full])
      });
      return {data,delta,recoveryCalls};
    });
    assert.equal(out.data.reply,'Guten Tag');
    assert.deepEqual(out.delta,[['Gu','Gu'],['ten Tag','Guten Tag']]);
    assert.equal(out.recoveryCalls,0);
  }finally{await page.close()}
});

test('Chromium: proposal, confirmed receipt, Undo provenance and system notice stay distinct',async()=>{
  const page=await createPage();
  try{
    await page.evaluate(()=>{window.APP_PROFILE='office'});
    await page.addScriptTag({path:source('turn-integrity.js')});
    const out=await page.evaluate(()=>{
      const integrity=window.MINDS_TURN_INTEGRITY;
      const pending=integrity.validate({reply:'',proposal:{kind:'task',title:'Beispielaufgabe',request_id:'fixture-request'},
        outcome:{outcome:'proposal_created',proposal_count:1,applied_count:0}});
      const confirmed=integrity.validate({reply:'Gespeichert.',action_receipts:[{request_id:'fixture-request',receipt_id:'fixture-receipt'}],
        outcome:{outcome:'action_applied',proposal_count:0,applied_count:1}});
      const forged=integrity.validate({reply:'Gespeichert.',outcome:{outcome:'action_applied',proposal_count:0,applied_count:1}});
      const notice=integrity.isSystemNotice('Bestätigt: Beispielaufgabe');
      const prose=integrity.isSystemNotice('Romy hat eine Frage zur Aufgabe.');
      return {pending,summary:integrity.summary(pending),confirmed,forged,notice,prose};
    });
    assert.equal(out.pending.ok,true);
    assert.match(out.summary,/Vorschlag:.*Bestätigung ausstehend/);
    assert.equal(out.confirmed.ok,true);
    assert.equal(out.forged.ok,false);
    assert.equal(out.forged.reason,'missing_execution_receipt');
    assert.equal(out.notice,true);
    assert.equal(out.prose,false);
  }finally{await page.close()}
});

test('Chromium: Office conversation history is owner-scoped and switches identities without leaking rows',async()=>{
  const page=await createPage();
  try{
    await page.evaluate(()=>{
      const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
      let owner=a;
      const conversations=[
        {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:a,app_scope:'isabella',origin_kind:'global',title:'Romy A',updated_at:'2026-11-08T11:00:00Z'},
        {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user_id:b,app_scope:'isabella',origin_kind:'global',title:'Romy B',updated_at:'2026-11-08T12:00:00Z'}
      ];
      const messages=[
        {id:'1',conversation_id:conversations[0].id,user_id:a,role:'assistant',content:'Private fixture A',created_at:'2026-11-08T11:01:00Z',provisional:false},
        {id:'2',conversation_id:conversations[1].id,user_id:b,role:'assistant',content:'Private fixture B',created_at:'2026-11-08T12:01:00Z',provisional:false}
      ];
      const records={conversations,conversation_messages:messages,office_members:[
        {user_id:a,is_active:true,must_change_password:false},{user_id:b,is_active:true,must_change_password:false}]};
      class Query{
        constructor(table){this.table=table;this.filters=[];this.mode='read';this.data=null;this.limitValue=1000;}
        select(){return this}
        eq(key,value){this.filters.push([key,value]);return this}
        order(){return this}
        limit(n){this.limitValue=n;return this}
        insert(row){this.mode='insert';this.data=row;return this}
        update(row){this.mode='update';this.data=row;return this}
        async run(){
          const entries=records[this.table]||[];
          if(this.mode==='insert'){
            const row={...this.data,id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',updated_at:new Date().toISOString()};
            entries.unshift(row);return {data:row,error:null};
          }
          const rows=entries.filter(x=>this.filters.every(([k,v])=>x[k]===v));
          if(this.mode==='update'){for(const row of rows)Object.assign(row,this.data)}
          return {data:rows.slice(0,this.limitValue),error:null};
        }
        async maybeSingle(){const v=await this.run();return {data:Array.isArray(v.data)?v.data[0]||null:v.data,error:v.error}}
        async single(){return this.maybeSingle()}
        then(resolve,reject){return this.run().then(resolve,reject)}
      }
      window.APP_PROFILE='office';window.APP_CHAT_RUNTIME='window';
      window.MINDS_SUPABASE={auth:{
        getSession:async()=>({data:{session:{user:{id:owner}}},error:null}),
        onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
      },from:table=>new Query(table)};
      window.ISABELLA_APP={
        _messages:[],setOfficeMessages(rows){
          this._messages=rows;
          document.getElementById('messages').textContent=rows.map(r=>r.content).join(' | ');
        },
        getState(){return {messages:this._messages}},
        openModal(){},closeModal(){}
      };
      window.__fixture={switchTo:id=>{owner=id},ownerA:a,ownerB:b};
    });
    await page.addScriptTag({path:source('office-engine-chat.js')});
    await page.waitForFunction(()=>document.getElementById('messages').textContent.includes('Private fixture A'));
    assert.equal(await page.locator('#messages').textContent(),'Private fixture A');
    await page.evaluate(async()=>{
      window.__fixture.switchTo(window.__fixture.ownerB);
      await window.TBA_OFFICE_ENGINE_CHAT.reconcile();
    });
    assert.equal(await page.locator('#messages').textContent(),'Private fixture B');
    await page.evaluate(async()=>{await window.TBA_OFFICE_ENGINE_CHAT.startNew()});
    assert.equal(await page.locator('#messages').textContent(),'');
    assert.ok(await page.evaluate(()=>!!window.TBA_OFFICE_ENGINE_CHAT.currentConversationId()));
  }finally{await page.close()}
});

test('Chromium: Office chat sends to isabella-chat in Office only, with Romy and current owner in quoted context',async()=>{
  const page=await createPage();
  try{
    await page.evaluate(()=>{
      window.APP_PROFILE='office';
      window.TBA_OFFICE_MEMBER={display_name:'Alex Beispiel'};
      window.MINDS_SUPABASE_CONFIG={url:'https://office.fixture.invalid',publishableKey:'fixture-public'};
      window.MINDS_SUPABASE={auth:{getSession:async()=>({data:{session:{user:{id:'owner-fixture'},access_token:'fixture-session'}}})},
        from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:null})}),
        functions:{invoke:async()=>{throw Error('Unexpected fallback execution')}}};
      window.__requests=[];
      window.fetch=async(url,options)=>{
        window.__requests.push({url,body:JSON.parse(options.body)});
        const parts=[
          'event: delta\ndata: {"text":"Guten"}\n\n',
          'event: final\ndata: {"reply":"Guten Tag","outcome":{"outcome":"answered","proposal_count":0,"applied_count":0}}\n\n'
        ];
        return new Response(new ReadableStream({start(ctrl){
          for(const p of parts)ctrl.enqueue(new TextEncoder().encode(p));ctrl.close()
        }}),{headers:{'content-type':'text/event-stream'}});
      };
    });
    await page.addScriptTag({path:source('final-round.js')});
    await page.addScriptTag({path:source('ai.js')});
    const result=await page.evaluate(async()=>{
      const state={tasks:[],events:[],categories:[],projects:[],messages:[],memory:[],assistantPreferences:{},feedPreferences:{}};
      const chunks=[];
      const response=await window.ISABELLA_AI.ask('Hallo',state,{
        durableRequestId:'12345678-1234-4234-8234-123456789012',
        replyTo:{role:'assistant',text:'Eine Rückfrage'},
        onTextDelta:(text,full)=>chunks.push([text,full])
      });
      return {response,chunks,requests:window.__requests};
    });
    assert.equal(result.response.reply,'Guten Tag');
    assert.deepEqual(result.chunks,[['Guten','Guten']]);
    assert.equal(result.requests.length,1);
    assert.equal(result.requests[0].url,'https://office.fixture.invalid/functions/v1/isabella-chat');
    const context=result.requests[0].body.context.reply_context;
    assert.match(context,/Alex/);assert.match(context,/Romy/);
    assert.doesNotMatch(context,/\bGari\b|\bIsabella\b/);
  }finally{await page.close()}
});
