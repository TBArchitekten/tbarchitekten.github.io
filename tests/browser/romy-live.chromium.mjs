// Offline Chromium acceptance of the source-identical GPT-Live client under Office.
// WebRTC, Supabase, OpenAI and audio devices are synthetic: no real network or data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const source=path=>fileURLToPath(new URL('../../app/'+path,import.meta.url));
const browser=await chromium.launch({headless:true});
test.after(async()=>{await browser.close()});
const makePage=async()=>{
  const page=await browser.newPage();
  await page.route('**/*',route=>route.abort());
  const html=readFileSync(source('live/index.html'),'utf8')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<link[^>]*>/gi,'');
  await page.setContent(html);
  await page.evaluate(()=>{
    window.APP_PROFILE='office';
    window.MINDS_SUPABASE_CONFIG={url:'https://office.fixture.invalid',publishableKey:'fixture-publishable'};
    window.MINDS_SUPABASE={auth:{getSession:async()=>({
      data:{session:{access_token:'fixture-session',user:{id:'11111111-1111-4111-8111-111111111111'}}},error:null
    })}};
    const requests=[];
    window.__fixture={requests,channels:[]};
    const audioTrack={kind:'audio',stop(){}};
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{
      getUserMedia:async()=>({getTracks:()=>[audioTrack],getAudioTracks:()=>[audioTrack]})
    }});
    window.RTCPeerConnection=class{
      constructor(){this.iceGatheringState='complete';this.localDescription=null;}
      addTrack(){}
      addEventListener(){}
      createDataChannel(){
        const listeners={};
        const channel={listeners,addEventListener(type,fn){listeners[type]=fn},send(){},close(){}};
        window.__fixture.channels.push(channel);
        return channel;
      }
      async createOffer(){return {type:'offer',sdp:'v=0'+'o'.repeat(100)}}
      async setLocalDescription(v){this.localDescription=v}
      async setRemoteDescription(){}
      close(){}
    };
    window.fetch=async(url,options={})=>{
      const body=JSON.parse(options.body||'{}');
      requests.push({url,body,headers:options.headers||{}});
      if(url.endsWith('/functions/v1/isabella-live-session')){
        if(body.action==='save_transcript')
          return new Response(JSON.stringify({saved:true,turn_id:body.turn_id}),{status:200,headers:{'content-type':'application/json'}});
        return new Response(JSON.stringify({session:{id:'fixture-live',conversation_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},
          transport:{type:'webrtc',sdp:'v=0'+'a'.repeat(80)}}),{status:201,headers:{'content-type':'application/json'}});
      }
      if(url.endsWith('/functions/v1/isabella-chat')){
        return new Response(JSON.stringify({reply:'Geprüfte Antwort',outcome:{outcome:'answered',proposal_count:0,applied_count:0}}),
          {status:200,headers:{'content-type':'application/json'}});
      }
      throw Error('unexpected network destination');
    };
  });
  for(const path of ['turn-integrity.js','live/canonical.js','live/transcript.js','live/live.js'])
    await page.addScriptTag({path:source(path)});
  return page;
};

test('Chromium Live: Office WebRTC broker is authenticated and no model voice text can forge a transcript',async()=>{
  const page=await makePage();
  try{
    await page.locator('#liveStart').click();
    await page.waitForFunction(()=>window.ISABELLA_LIVE_DIAGNOSTIC?.getState().active===true&&
      window.__fixture.requests.some(r=>r.body.sdp));
    const initial=await page.evaluate(()=>window.__fixture.requests);
    assert.equal(initial.length,1);
    assert.equal(initial[0].url,'https://office.fixture.invalid/functions/v1/isabella-live-session');
    assert.equal(initial[0].headers.Authorization,'Bearer fixture-session');
    assert.equal(initial[0].body.voice,'nuri');
    assert.ok(!('user_id' in initial[0].body));
    await page.evaluate(()=>{
      const listener=window.__fixture.channels[0]?.listeners?.message;
      listener({data:JSON.stringify({type:'session.input_transcript.delta',delta:'Hallo aus dem Test',event_id:'owner-1',start_ms:0,end_ms:400})});
      listener({data:JSON.stringify({type:'session.output_transcript.delta',delta:'Ungeprüfte Agentenstimme',event_id:'agent-1',start_ms:500,end_ms:900})});
    });
    await page.locator('#liveStop').click();
    await page.waitForFunction(()=>window.__fixture.requests.some(x=>x.body.action==='save_transcript'));
    const all=await page.evaluate(()=>window.__fixture.requests);
    assert.equal(all.filter(x=>x.body.action==='save_transcript').length,1);
    assert.deepEqual(all.filter(x=>x.body.action==='save_transcript').map(x=>x.body.author),['gari']);
    assert.match(await page.locator('#liveStatus').textContent(),/Gespräch beendet/);
  }finally{await page.close()}
});

test('Chromium Live: only reviewed owner speech may invoke canonical Office chat',async()=>{
  const page=await makePage();
  try{
    await page.locator('#liveStart').click();
    await page.waitForFunction(()=>window.__fixture.channels.length===1);
    await page.evaluate(()=>window.__fixture.channels[0].listeners.message({
      data:JSON.stringify({type:'session.input_transcript.delta',delta:'Bitte Quelle prüfen',event_id:'owner-2',start_ms:0,end_ms:400})
    }));
    assert.equal(await page.evaluate(()=>window.__fixture.requests.filter(x=>x.url.endsWith('/isabella-chat')).length),0);
    await page.locator('#liveConsult').click();
    assert.equal(await page.evaluate(()=>window.__fixture.requests.filter(x=>x.url.endsWith('/isabella-chat')).length),0);
    await page.locator('#liveMindsSend').click();
    await page.waitForFunction(()=>window.__fixture.requests.some(x=>x.url.endsWith('/isabella-chat')));
    const call=await page.evaluate(()=>window.__fixture.requests.find(x=>x.url.endsWith('/isabella-chat')));
    assert.equal(call.url,'https://office.fixture.invalid/functions/v1/isabella-chat');
    assert.equal(call.body.message,'Bitte Quelle prüfen');
    assert.equal(call.body.voice_delegation,true);
    assert.equal(call.body.background,false);
    assert.equal(call.headers.Authorization,'Bearer fixture-session');
  }finally{await page.close()}
});

test('Chromium Live: German Office UI excludes personal Original voice and routes back to Office chat',async()=>{
  const page=await makePage();
  try{
    assert.equal(await page.locator('html').getAttribute('lang'),'de');
    assert.equal(await page.locator('#live-title').textContent(),'Romy');
    assert.equal(await page.locator('#liveVoice option[value="isabella-original-v1"]').count(),0);
    assert.match(await page.locator('.live-header a').getAttribute('href'),/^\.\.\/$/);
    const out=await page.evaluate(()=>{
      const result={reply:'',proposal:{request_id:'11111111-1111-4111-8111-111111111111'},
        outcome:{outcome:'proposal_created',proposal_count:1,applied_count:0}};
      return window.ISABELLA_LIVE_CANONICAL.admission(result,window.MINDS_TURN_INTEGRITY.validate,
        window.MINDS_TURN_INTEGRITY.summary);
    });
    assert.equal(out.ok,false);
    // The canonical broker cannot narrate an unverified empty reply as an executed action.
  }finally{await page.close()}
});
