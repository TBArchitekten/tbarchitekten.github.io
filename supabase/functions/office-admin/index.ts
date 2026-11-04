// TBA Office · member administration (admins only).
// Accounts are created here with the person's office e-mail and a one-time start password,
// already confirmed, so no e-mail has to be sent. The start password is returned once to the
// admin and never stored; the person sets their own at first sign-in (must_change_password).
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {validEmail,validName,validRole,startPassword,lastAdminGuard} from "./rules.mjs";

const ORIGIN="https://tbarchitekten.github.io";
const DOMAIN=(Deno.env.get("OFFICE_EMAIL_DOMAIN")||"bernhardarchitekten.com").toLowerCase();
const headers={
  "Access-Control-Allow-Origin":ORIGIN,
  "Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Vary":"Origin",
  "Cache-Control":"no-store",
  "Content-Type":"application/json; charset=utf-8"
};
const respond=(status:number,payload:unknown)=>new Response(JSON.stringify(payload),{status,headers});
const BLOCKED="876000h"; // a deactivated member cannot sign in

Deno.serve(async req=>{
  const origin=req.headers.get("origin");
  if(origin&&origin!==ORIGIN)return respond(403,{error:"origin_forbidden"});
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="POST")return respond(405,{error:"method_not_allowed"});
  if(Number(req.headers.get("content-length")||"0")>4000)return respond(413,{error:"request_too_large"});
  const token=/^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization")||"")?.[1];
  if(!token)return respond(401,{error:"authentication_required"});
  const url=Deno.env.get("SUPABASE_URL")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!service)return respond(503,{error:"admin_unavailable"});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});

  const {data:auth,error:authError}=await admin.auth.getUser(token);
  if(authError||!auth.user)return respond(401,{error:"invalid_session"});
  const {data:caller}=await admin.from("office_members").select("role,is_active").eq("user_id",auth.user.id).maybeSingle();
  if(!caller?.is_active||caller.role!=="admin")return respond(403,{error:"admin_required"});

  let body:Record<string,unknown>;
  try{body=await req.json()}catch{return respond(400,{error:"invalid_json"})}
  const action=String(body.action||"");

  if(action==="list"){
    const {data:members,error}=await admin.from("office_members")
      .select("user_id,email,display_name,role,is_active,must_change_password,created_at").order("display_name");
    if(error)return respond(500,{error:"read_failed"});
    const {data:users}=await admin.auth.admin.listUsers({perPage:200});
    const lastSeen=new Map((users?.users||[]).map(u=>[u.id,u.last_sign_in_at||null]));
    return respond(200,{members:(members||[]).map(m=>({...m,last_sign_in_at:lastSeen.get(m.user_id)||null}))});
  }

  if(action==="create"){
    const email=String(body.email||"").trim().toLowerCase();
    const name=String(body.display_name||"").trim();
    const role=String(body.role||"member");
    if(!validEmail(email,DOMAIN))return respond(400,{error:"invalid_email",domain:DOMAIN});
    if(!validName(name))return respond(400,{error:"invalid_name"});
    if(!validRole(role))return respond(400,{error:"invalid_role"});
    const password=startPassword();
    const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:name}});
    if(createError||!created.user)return respond(409,{error:"account_exists_or_failed"});
    const {error:memberError}=await admin.from("office_members")
      .insert({user_id:created.user.id,email,display_name:name,role,is_active:true,must_change_password:true});
    if(memberError){
      await admin.auth.admin.deleteUser(created.user.id);
      return respond(500,{error:"member_failed"});
    }
    return respond(200,{user_id:created.user.id,email,start_password:password});
  }

  const userId=String(body.user_id||"");
  if(!/^[0-9a-f-]{36}$/i.test(userId))return respond(400,{error:"invalid_user"});
  const {data:target}=await admin.from("office_members").select("user_id,role,is_active").eq("user_id",userId).maybeSingle();
  if(!target)return respond(404,{error:"member_not_found"});

  if(action==="reset_password"){
    const password=startPassword();
    const {error}=await admin.auth.admin.updateUserById(userId,{password});
    if(error)return respond(500,{error:"reset_failed"});
    await admin.from("office_members").update({must_change_password:true}).eq("user_id",userId);
    return respond(200,{user_id:userId,start_password:password});
  }

  if(action==="update"){
    const patch:Record<string,unknown>={};
    if(body.display_name!==undefined){const n=String(body.display_name).trim();if(!validName(n))return respond(400,{error:"invalid_name"});patch.display_name=n}
    if(body.role!==undefined){const r=String(body.role);if(!validRole(r))return respond(400,{error:"invalid_role"});patch.role=r}
    if(body.is_active!==undefined)patch.is_active=body.is_active===true;
    if(!Object.keys(patch).length)return respond(400,{error:"nothing_to_change"});
    // The office never ends up without an active admin, and nobody locks themselves out.
    const {count}=await admin.from("office_members").select("user_id",{count:"exact",head:true}).eq("role","admin").eq("is_active",true);
    const guard=lastAdminGuard({target,patch,callerId:auth.user.id,activeAdmins:count||0});
    if(guard)return respond(409,{error:guard});
    const {error}=await admin.from("office_members").update(patch).eq("user_id",userId);
    if(error)return respond(500,{error:"update_failed"});
    if(patch.is_active!==undefined)await admin.auth.admin.updateUserById(userId,{ban_duration:patch.is_active?"none":BLOCKED});
    return respond(200,{user_id:userId,...patch});
  }

  return respond(400,{error:"unknown_action"});
});
