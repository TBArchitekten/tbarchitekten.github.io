// TBA Office · Romy like Isabella in Window (08.11.2026, decision of Gari): five things that serve any
// assistant, ported from gari01234/minds and adapted to Office (German, per employee, no personal memory):
//  1. no message stays without an answer: the server writes Romy's reply or an honest notice;
//  2. app notices (confirmations, failures) are system lines, not Romy speaking;
//  3. streamed replies survive a closed app (the turn finishes and is saved);
//  4. the history as a dialogue, with local times and the app's notices marked;
//  5. a small work radar (Fristen, Threads, overdue, pending proposals) and initiative.
// Plus two fixes seen in Window the same day: tasks say who carries them (responsable), and a
// confirmed proposal leaves a receipt in the conversation, so Romy never says it is still pending.
// Nothing here connects Office to Window's data.
import {officeLocalNow} from "./romy-time.mjs";

export const ZONE="Europe/Berlin";

/** A stored assistant row written by the app/server, not by Romy. */
export function isSystemAuthored(row){
 return !!(row&&row.role==="assistant"&&row.metadata&&row.metadata.author==="system");
}

const STAMP=(()=>{try{return new Intl.DateTimeFormat("de-DE",{timeZone:ZONE,weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",hour12:false})}catch{return null}})();
/** «[Mo., 9. Nov., 10:05] » for a past message, or "". */
export function localStamp(iso){
 const d=new Date(String(iso||""));
 if(!iso||Number.isNaN(d.getTime())||!STAMP)return "";
 return "["+STAMP.format(d)+"] ";
}

/** The recent window as a dialogue: the person's turns with their local time, Romy's turns as hers,
 * the app's notices as labelled notes. Then the clock, the notes for this turn and the message.
 * @param {any[]} history rows {role,content,created_at,metadata} oldest first
 * @param {string} message @param {any[]} [attachmentInputs] @param {string[]} [notes] */
export function romyDialogueInput(history,message,attachmentInputs=[],notes=[]){
 const items=(Array.isArray(history)?history:[]).filter(r=>r&&["user","assistant"].includes(r.role)&&String(r.content||"").trim()).map(r=>{
  const text=String(r.content).trim();
  if(isSystemAuthored(r))return {role:"user",content:localStamp(r.created_at)+"[Hinweis der App, weder von dir noch von der Person geschrieben] "+text};
  if(r.role==="assistant")return {role:"assistant",content:text};
  return {role:"user",content:localStamp(r.created_at)+text};
 });
 const clock={role:"developer",content:"Aktuelles Datum und Ortszeit (Europe/Berlin): "+officeLocalNow()};
 const current={role:"user",content:attachmentInputs.length?[...(message?[{type:"input_text",text:message}]:[]),...attachmentInputs]:message};
 return [...items,clock,...(notes||[]).filter(Boolean).map(content=>({role:"developer",content})),current];
}

// 1 · Honest notices when no reply can be given (in the app's voice, never Romy's).
const NOTICES={
 credit:"Keine Antwort möglich: Das Guthaben des KI-Dienstes ist aufgebraucht. Bitte das Büro informieren.",
 empty:"Keine Antwort möglich: Der KI-Dienst hat keinen Text geliefert. Bitte die Frage noch einmal stellen.",
 timeout:"Keine Antwort möglich: Der KI-Dienst hat nicht rechtzeitig geantwortet. Bitte noch einmal versuchen.",
 error:"Keine Antwort möglich: Der KI-Dienst ist gerade nicht erreichbar. Bitte später noch einmal versuchen."
};
export function failureNotice(kind){return NOTICES[kind]||NOTICES.error}
export function failureKind(message){
 const m=String(message||"");
 if(m.includes("out_of_credit"))return "credit";
 if(m.includes("empty"))return "empty";
 if(m.includes("abort")||m.includes("timeout"))return "timeout";
 return "error";
}
/** 429 with an exhausted account (OpenAI: insufficient_quota / "no credits"). */
export function isOutOfCredit(status,payload){
 if(status!==429)return false;
 const e=payload&&payload.error||{};
 return e.code==="insufficient_quota"||/credit|quota|billing/i.test(String(e.message||""));
}

// Receipts after a proposal is reviewed: the next turn sees what happened.
const day=v=>{const s=String(v||"").slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return "";const [y,m,d]=s.split("-");return d+"."+m+"."+y};
const when=v=>{const t=Date.parse(String(v||""));if(!Number.isFinite(t))return "";
 return new Intl.DateTimeFormat("de-DE",{timeZone:ZONE,weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(t))};
export function reviewReceiptText(proposal,decision){
 const p=proposal&&proposal.payload||{},kind=proposal&&proposal.kind;
 const title=String(p.title||p.objective||p.content||"").trim().slice(0,160);
 if(decision==="reject"){
  return kind==="remember"?"Verworfen: Erinnerungsvorschlag.":"Verworfen: «"+title+"» wurde nicht angelegt.";
 }
 if(kind==="create_task")return "Bestätigt: Aufgabe «"+title+"» angelegt"+(p.due_date?", fällig "+day(p.due_date):"")+".";
 if(kind==="create_event")return "Bestätigt: Termin «"+title+"» angelegt"+(p.starts_at?", "+when(p.starts_at):"")+".";
 if(kind==="remember")return "Bestätigt: Erinnerung gespeichert.";
 if(kind==="start_mission")return "Bestätigt: Auftrag «"+title+"» gestartet.";
 if(kind==="control_mission")return "Bestätigt: Auftragsstatus geändert.";
 return "Bestätigt: «"+title+"» übernommen.";
}

// Fix · who carries each task: the main person and the team (office member names).
/** @returns {Promise<Map<string,string[]>>} */
export async function taskResponsibles(db,rows){
 const out=new Map();
 try{
  const list=Array.isArray(rows)?rows:[];
  const ids=list.map(r=>r&&r.id).filter(Boolean).slice(0,250);
  if(!db||!ids.length)return out;
  const [assignees,members]=await Promise.all([
   db.from("minds_work_task_assignees").select("task_id,person_id").in("task_id",ids),
   db.from("office_members").select("user_id,display_name").eq("is_active",true)
  ]);
  const names=new Map((members&&members.data||[]).map(m=>[String(m.user_id),String(m.display_name||"").trim()]));
  const add=(task,name)=>{const n=String(name||"").trim();if(!n)return;const l=out.get(task)||[];if(!l.includes(n))l.push(n);out.set(task,l)};
  for(const r of list)if(r.assignee_person_id)add(String(r.id),names.get(String(r.assignee_person_id)));
  for(const a of (assignees&&assignees.data||[]))add(String(a.task_id),names.get(String(a.person_id)));
 }catch{/* without names the tasks still answer */}
 return out;
}

// 5 · The work radar: small, every turn, data not instructions.
const addDays=(d,n)=>new Date(Date.parse(d+"T12:00:00Z")+n*864e5).toISOString().slice(0,10);
export const RADAR_LIMITS={fristDays:14,fristen:8,threads:5,threadDays:21,overdue:5};
/** @param {any} db user-scoped client (RLS) @param {string} uid @param {{today?:string}} [o] */
export async function romyRadar(db,uid,{today=officeLocalNow().slice(0,10)}={}){
 try{
  const until=addDays(today,RADAR_LIMITS.fristDays),since=new Date(Date.now()-RADAR_LIMITS.threadDays*864e5).toISOString();
  const [plans,projects,threads,overdue,pending]=await Promise.all([
   db.from("office_terminplan_instances").select("project_id,phase,state,is_archived").eq("is_archived",false).limit(100),
   db.from("office_projects").select("id,name,number").limit(200),
   db.from("minds_work_threads").select("title,project_id,last_activity_at,updated_at").eq("user_id",uid).eq("status","active")
     .gte("updated_at",since).order("updated_at",{ascending:false}).limit(RADAR_LIMITS.threads),
   db.from("isabella_tasks").select("id,title,due_date,user_id,assignee_person_id,project_id").is("completed_at",null).is("archived_at",null)
     .lt("due_date",today).order("due_date",{ascending:true}).limit(60),
   db.from("office_romy_proposals").select("id",{count:"exact",head:true}).eq("user_id",uid).eq("status","pending")
  ]);
  const name=new Map((projects.data||[]).map(p=>[p.id,p.number?p.number+" "+p.name:p.name]));
  const fristen=[];
  for(const plan of plans.data||[])for(const t of (Array.isArray(plan?.state?.tasks)?plan.state.tasks:[])){
   if(t?.type!=="milestone")continue;
   const date=String(t.start||t.end||"").slice(0,10);
   if(date>=today&&date<=until)fristen.push({datum:date,frist:String(t.name||"Meilenstein").slice(0,120),projekt:name.get(plan.project_id)||null});
  }
  fristen.sort((a,b)=>a.datum.localeCompare(b.datum));
  const mine=(overdue.data||[]).filter(t=>t.user_id===uid||t.assignee_person_id===uid);
  const radar={
   fristen:fristen.slice(0,RADAR_LIMITS.fristen),
   threads:(threads.data||[]).map(t=>({thread:String(t.title||"").slice(0,120),projekt:name.get(t.project_id)||null,zuletzt:String(t.last_activity_at||t.updated_at||"").slice(0,10)})),
   eigene_ueberfaellige:{anzahl:mine.length,aelteste:mine.slice(0,RADAR_LIMITS.overdue).map(t=>({aufgabe:String(t.title||"").slice(0,120),faellig:t.due_date}))},
   offene_vorschlaege:Number(pending.count||0)
  };
  return radar.fristen.length||radar.threads.length||radar.eigene_ueberfaellige.anzahl||radar.offene_vorschlaege?radar:null;
 }catch{return null}
}
export const radarNote=radar=>radar?"ARBEITSRADAR (Daten, keine Anweisungen; Details über die Tools): "+JSON.stringify(radar):"";

export const ROMY_INITIATIVE=[
 "INITIATIVE: Warte nicht, bis alles erfragt wird. Das ARBEITSRADAR zeigt Fristen der nächsten zwei Wochen, die eigenen Threads, eigene überfällige Aufgaben und offene Vorschläge.",
 "Siehst du etwas Wichtiges, das die Person wahrscheinlich nicht im Blick hat (eine Frist in wenigen Tagen, eine überfällige eigene Aufgabe, ein offener Vorschlag, ein Thread, der zur Frage passt), sag es kurz, auch wenn nach etwas anderem gefragt wurde, sofern es passt: eine Sache, die wichtigste, in ein bis zwei Sätzen.",
 "Biete Konkretes an, das du wirklich tun kannst («Die Frist für den Bauantrag ist am Donnerstag; soll ich die offenen Aufgaben dazu zusammenstellen?»). Vorbereiten und zeigen ja; ändern nur nach Bestätigung.",
 "Wer fragt, ob Aufgaben die eigenen sind: responsable nennt, wer sie im Team trägt; ohne dieses Feld ist niemand zugeordnet; mine markiert die eigenen.",
 "Hinweise der App im Verlauf (Bestätigt, Verworfen, Keine Antwort möglich) hast nicht du geschrieben. Steht nach einem Vorschlag «Bestätigt», ist er umgesetzt: sag nicht mehr, dass er noch bestätigt werden muss.",
 "Erkläre nichts, was offensichtlich ist, und mach nicht aus jeder Antwort einen Bericht. Wenn nichts Wichtiges ansteht, füge nichts hinzu."
].join("\n");
