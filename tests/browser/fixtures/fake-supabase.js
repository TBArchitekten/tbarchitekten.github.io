// Synthetic Supabase stand-in for booting the whole Office app in Chromium. No network, no real data.
(function(){
  const UID='11111111-1111-4111-8111-111111111111';
  const session={access_token:'fake',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,user:{id:UID,email:'gari@fixture.invalid',aud:'authenticated',role:'authenticated'}};
  const rows={
    office_members:[{user_id:UID,email:'gari@fixture.invalid',display_name:'Gari Beispiel',role:'admin',is_active:true,must_change_password:false}],
    isabella_projects:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',client_key:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Beispielhaus',number:'101',archived:false}],
    isabella_categories:[{id:'c1',client_key:'arbeit',name:'Arbeit',color:'#6D7278'}],
    isabella_tasks:[{id:'t1',user_id:UID,title:'Test',due_date:'2026-11-04',completed_at:null,archived_at:null,project_id:null,updated_at:new Date().toISOString(),created_at:new Date().toISOString()}],
  };
  window.__calls=[];
  function builder(table){
    let single=false,head=false;
    const q={};
    const pass=()=>q;
    ['select','eq','neq','in','is','lt','lte','gt','gte','order','limit','range','match','not','or','filter','contains','ilike','like','textSearch','overlaps'].forEach(k=>q[k]=(...a)=>{if(k==='select'&&a[1]&&a[1].head)head=true;return q});
    ['insert','update','upsert','delete'].forEach(k=>q[k]=()=>q);
    q.single=()=>{single=true;return q};q.maybeSingle=()=>{single=true;return q};
    q.then=(ok,bad)=>{window.__calls.push(table);const r=rows[table]||[];const v=head?{count:r.length,data:null,error:null}:{data:single?(r[0]||null):r,error:null,count:r.length};return Promise.resolve(v).then(ok,bad)};
    return q;
  }
  const client={
    auth:{getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session.user},error:null}),
      onAuthStateChange:(cb)=>{setTimeout(()=>cb('INITIAL_SESSION',session),0);return {data:{subscription:{unsubscribe(){}}}}},
      signOut:async()=>({error:null}),refreshSession:async()=>({data:{session},error:null})},
    from:(t)=>builder(t),
    rpc:async(name)=>{window.__calls.push('rpc:'+name);return {data:null,error:null}},
    storage:{from:()=>({upload:async()=>({error:null}),createSignedUrl:async()=>({data:{signedUrl:'about:blank'},error:null}),remove:async()=>({error:null}),download:async()=>({data:null,error:null})})},
    functions:{invoke:async()=>({data:null,error:null})},
    channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){}
  };
  window.supabase={createClient:()=>client};
})();
