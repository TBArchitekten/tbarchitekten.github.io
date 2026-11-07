// TBA Office connector: a remote MCP server that lets Claude work inside TBA Office with the
// employee's own login (decision of Gari, 07.11.2026: Office gets the Claude connector, like Window,
// and it may read everything the employee can read, documents included).
// Auth: OAuth 2.1 through Supabase Auth's OAuth server of the TBA Office project. The access token
// is a Supabase JWT of the employee, so every query runs under the office's Row Level Security.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {createMcpHandler,McpServer} from "npm:@modelcontextprotocol/server@2.2.0";
import * as z from "npm:zod@4.6.5";
import {extractText as pdfText,getDocumentProxy} from "npm:unpdf@1.8.1";
import mammoth from "npm:mammoth@1.12.3";
import * as XLSX from "npm:xlsx@0.18.5";
import {Buffer} from "node:buffer";
import {createOfficeTools,ToolError} from "./office-tools.mjs";

const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"");
// The public URL pasted into Claude; the protected-resource metadata must repeat it exactly.
const RESOURCE=SUPABASE_URL+"/functions/v1/office-mcp";
const METADATA_URL=RESOURCE+"/.well-known/oauth-protected-resource";
const CORS:Record<string,string>={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, content-type, accept, mcp-session-id, mcp-protocol-version, last-event-id",
  "Access-Control-Allow-Methods":"GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers":"WWW-Authenticate, mcp-session-id, mcp-protocol-version"
};
function json(data:unknown,status=200,headers:Record<string,string>={}){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...CORS,...headers}});
}
function publishableKey(){
  let key=Deno.env.get("SUPABASE_ANON_KEY")||"";
  try{const keys=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");key=keys?.default||key}catch{}
  return key;
}
// A 401 with a resource_metadata pointer is what starts Claude's sign-in flow.
function unauthorized(error="invalid_token",description="Bitte im TBA Office anmelden."){
  return json({error,error_description:description},401,{"WWW-Authenticate":`Bearer resource_metadata="${METADATA_URL}", error="${error}"`});
}
export function protectedResourceMetadata(){
  return {resource:RESOURCE,authorization_servers:[SUPABASE_URL+"/auth/v1"],bearer_methods_supported:["header"],
    resource_name:"TBA Office",resource_documentation:"https://tbarchitekten.github.io/"};
}

// Text from PDF, Word and Excel files on the project desktops (read on demand, nothing is stored).
async function extractText(bytes:Uint8Array,mime:string,name:string):Promise<{text:string,note?:string}>{
  const lower=name.toLowerCase();
  try{
    if(mime==="application/pdf"||lower.endsWith(".pdf")){
      const pdf=await getDocumentProxy(bytes);
      const {totalPages,text}=await pdfText(pdf,{mergePages:true});
      const t=String(text||"").trim();
      return t?{text:t}:{text:"",note:"Das PDF ("+totalPages+" Seiten) enthält keinen lesbaren Text, vermutlich ein Scan."};
    }
    if(mime.includes("wordprocessingml")||lower.endsWith(".docx")){
      const r=await mammoth.extractRawText({buffer:Buffer.from(bytes)});
      return {text:String(r.value||"").trim()};
    }
    if(mime.includes("spreadsheetml")||mime.includes("ms-excel")||/\.(xlsx|xlsm|xls)$/.test(lower)){
      const wb=XLSX.read(bytes,{type:"array"});
      const parts=wb.SheetNames.slice(0,20).map((sheet:string)=>"## "+sheet+"\n"+XLSX.utils.sheet_to_csv(wb.Sheets[sheet]));
      return {text:parts.join("\n\n").trim()};
    }
  }catch(e){
    console.error("office_extract_failed",e instanceof Error?e.message:String(e));
    return {text:"",note:"Der Text dieser Datei konnte nicht gelesen werden."};
  }
  return {text:"",note:"Aus diesem Dateityp liest der Connector keinen Text ("+(mime||lower.split(".").pop()||"unbekannt")+")."};
}

const INSTRUCTIONS=`TBA Office is the shared workspace of Titus Bernhard Architekten: projects with their team, Planner tasks, Terminpläne (their milestones are the Fristen), project desktops with documents, and each employee's personal tasks and calendar.
Language: answer in the language the person writes in (Gari writes Spanish). Everything you WRITE into the Office (task titles, notes) is German.
Visibility: project tasks, Terminpläne and project documents are shared among active members; personal tasks and the calendar are private to the signed-in person.
How to work:
- Start: overview (today, overdue, Fristen) or project_context for one project.
- Before stating anything about documents: search_files, then read_file. Cite file names. Never invent files, dates or decisions.
- create_task / update_task change real tasks: do it when asked; otherwise propose. A task with a project is visible to the project team.
- Keep tool calls lean: read_file is paged (next_offset).`;

const text=(value:unknown)=>({content:[{type:"text" as const,text:typeof value==="string"?value:JSON.stringify(value)}]});
const READ={readOnlyHint:true,destructiveHint:false,openWorldHint:false};
const WRITE={readOnlyHint:false,destructiveHint:false,openWorldHint:false};

function buildServer(tools:ReturnType<typeof createOfficeTools>){
  const server=new McpServer({name:"TBA Office",version:"1.0.0"},{instructions:INSTRUCTIONS});
  const run=(fn:(args:any)=>Promise<unknown>)=>async(args:any)=>{
    try{return text(await fn(args||{}))}
    catch(e){
      if(e instanceof ToolError)return {...text(e.message),isError:true};
      console.error("office_tool_failed",e instanceof Error?e.message:String(e));
      return {...text("Das Office konnte das gerade nicht erledigen. Bitte gleich noch einmal versuchen."),isError:true};
    }
  };
  server.registerTool("overview",{title:"Heute",description:"Today in TBA Office for the signed-in employee: tasks due today or overdue (incl. multi-day tasks in progress; mine:true marks own or assigned ones), own events today and tomorrow, Fristen of the next 3 weeks from the Terminpläne, active projects.",
    inputSchema:z.object({}),annotations:READ},run(()=>tools.overview()));
  server.registerTool("list_projects",{title:"Projekte",description:"Active office projects (number, name, id).",inputSchema:z.object({}),annotations:READ},run(()=>tools.listProjects()));
  server.registerTool("project_context",{title:"Projekt öffnen",description:"One project: team, Planner buckets, open tasks, Fristen (Terminplan milestones, next 120 days), desktop folders and files with ids for read_file. Call this first in a project conversation.",
    inputSchema:z.object({project:z.string().describe("Project name, number or id, e.g. 'Bernried'")}),annotations:READ},run(a=>tools.projectContext(a)));
  server.registerTool("list_deadlines",{title:"Fristen",description:"Upcoming Fristen: milestones of the active Terminpläne, optionally for one project, for the next N days (default 60).",
    inputSchema:z.object({project:z.string().optional(),days:z.number().int().min(1).max(366).optional()}),annotations:READ},run(a=>tools.deadlines(a)));
  server.registerTool("search_files",{title:"Dokumente suchen",description:"Search the project desktops by file and folder name (German names are common, e.g. 'Statik', 'Protokoll', 'Bauantrag'). Returns file ids for read_file.",
    inputSchema:z.object({query:z.string(),project:z.string().optional(),limit:z.number().int().min(1).max(50).optional()}),annotations:READ},run(a=>tools.searchFiles(a)));
  server.registerTool("read_file",{title:"Dokument lesen",description:"Read the text of one desktop file (PDF, Word, Excel, e-mail, text). Paged: pass next_offset as offset to continue.",
    inputSchema:z.object({file_id:z.string(),offset:z.number().int().min(0).optional(),max_chars:z.number().int().min(1000).max(60000).optional()}),annotations:READ},run(a=>tools.readFile(a)));
  server.registerTool("list_tasks",{title:"Aufgaben",description:"Office tasks visible to the employee (shared project tasks and own personal tasks). range: 'today' (incl. overdue and multi-day tasks in progress), 'week', 'open', 'done_recent'. mine:true keeps only own or assigned tasks. Optional project and title filter.",
    inputSchema:z.object({range:z.enum(["today","week","open","done_recent"]).optional(),project:z.string().optional(),query:z.string().optional(),mine:z.boolean().optional(),limit:z.number().int().min(1).max(200).optional()}),annotations:READ},run(a=>tools.listTasks(a)));
  server.registerTool("list_events",{title:"Kalender",description:"The employee's own calendar between from and to (YYYY-MM-DD, Europe/Berlin), at most 120 days. Defaults to the next 7 days.",
    inputSchema:z.object({from:z.string().optional(),to:z.string().optional()}),annotations:READ},run(a=>tools.listEvents(a)));
  server.registerTool("create_task",{title:"Aufgabe anlegen",description:"Create a task (title in German). With a project it lands in that project's Planner for the team; without one it is a personal task. Dates YYYY-MM-DD; start_date makes it a multi-day task.",
    inputSchema:z.object({title:z.string(),project:z.string().optional(),due_date:z.string().optional(),start_date:z.string().optional(),notes:z.string().optional()}),annotations:WRITE},run(a=>tools.createTask(a)));
  server.registerTool("update_task",{title:"Aufgabe ändern",description:"Change a task's title, dates or notes, or mark it done/undone. Pass only fields to change; null clears a date. Allowed for the creator, assignees and the project team.",
    inputSchema:z.object({task_id:z.string(),title:z.string().optional(),due_date:z.string().nullable().optional(),start_date:z.string().nullable().optional(),notes:z.string().optional(),done:z.boolean().optional()}),annotations:WRITE},run(a=>tools.updateTask(a)));
  return server;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  const path=new URL(req.url).pathname;
  if(path.endsWith("/.well-known/oauth-protected-resource"))return json(protectedResourceMetadata());
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return unauthorized("invalid_request","Das TBA Office braucht eine Anmeldung.");
  const key=publishableKey();
  if(!SUPABASE_URL||!key)return json({error:"server_not_configured"},503);
  const sb=createClient(SUPABASE_URL,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await sb.auth.getUser(token);
  if(error||!data?.user)return unauthorized();
  // Only active office members with their own password, like the office pages.
  const {data:member,error:memberError}=await sb.from("office_members").select("is_active,must_change_password").eq("user_id",data.user.id).maybeSingle();
  if(memberError||!member?.is_active)return json({error:"not_an_active_member",error_description:"Kein aktiver Office-Zugang."},403);
  if(member.must_change_password)return json({error:"password_change_required",error_description:"Bitte zuerst im Office das Startpasswort ändern."},403);
  const tools=createOfficeTools({sb,userId:data.user.id,extractText});
  const handler=createMcpHandler(()=>buildServer(tools));
  const res=await handler.fetch(req);
  const headers=new Headers(res.headers);for(const [k,v] of Object.entries(CORS))headers.set(k,v);
  return new Response(res.body,{status:res.status,statusText:res.statusText,headers});
});
