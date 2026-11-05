/* TBA Office presentation adapter.
   Reuses the exact DOM/CSS contract of Window's existing work.js:
   work-planner-toolbar, work-board, work-bucket, work-task-card,
   work-desktop-toolbar, work-files and work-file. Office's data layer remains separate. */
(function(root,factory){
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.TBA_WINDOW_WORK_SURFACE=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const icon=(name)=>{
  const svg={
   calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
   checklist:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 9 2 2 3-3M14 10h3M7 16h10"/>',
   plus:'<path d="M12 5v14M5 12h14"/>',
   pencil:'<path d="m16 5 3 3M4 20l4.3-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"/>',
   trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',
   left:'<path d="M20 12H4m7-7-7 7 7 7"/>',
   right:'<path d="M4 12h16m-7-7 7 7-7 7"/>'
  };
  return '<svg class="work-ui-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(svg[name]||"")+'</svg>';
 };
 const tileIcon=(kind,file)=>{
  const svg=(w,h,s)=>'<svg class="work-tile-svg" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" aria-hidden="true">'+s+'</svg>';
  if(kind==="folder")return svg(48,40,'<path d="M3 8a4 4 0 0 1 4-4h10.2a4 4 0 0 1 3 1.35L23 8h18a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill="#5ea4f0"/><path d="M3 15a4 4 0 0 1 4-4h34a4 4 0 0 1 4 4v19a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill="#8cc3fb"/><path d="M7 11h34a4 4 0 0 1 4 4v1.2H3V15a4 4 0 0 1 4-4z" fill="#b3d8fe"/>');
  if(kind==="back")return svg(48,40,'<rect x="6" y="4" width="36" height="32" rx="10" fill="#f1f3f6"/><path d="M27 14h-9.5l3.5-3.5M17.5 14l3.5 3.5M17.5 14h9a5.5 5.5 0 0 1 0 11H20" fill="none" stroke="#5d626a" stroke-width="2" stroke-linecap="round"/>');
  if(kind==="image")return svg(48,40,'<rect x="7" y="3" width="34" height="34" rx="7" fill="#eaf4ff" stroke="#cfe0f5" stroke-width="1.4"/><circle cx="17" cy="13.5" r="3.4" fill="#ffb020"/><path d="M8.5 31.5l9.5-10.5 6.5 6.5 4.5-4.5 10.5 10.5v.5a2.6 2.6 0 0 1-2.6 2.6H11.1a2.6 2.6 0 0 1-2.6-2.6z" fill="#34c759"/>');
  const name=String(file?.file_name||file?.name||"");const ext=(name.split(".").pop()||"DOC").slice(0,4).toUpperCase();
  const color={PDF:"#d43437",DOCX:"#3478c0",XLSX:"#30965e",PPTX:"#db763f"}[ext]||"#6b849c";
  return svg(48,40,'<path d="M13 2h14.5L36 10.5V35a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z" fill="#fff" stroke="#d3d8df" stroke-width="1.4"/><path d="M27.5 2v6a2.5 2.5 0 0 0 2.5 2.5h6" fill="#eef1f5" stroke="#d3d8df" stroke-width="1.4"/><rect x="5" y="22" width="28" height="11" rx="3" fill="'+color+'"/><text x="19" y="29.9" text-anchor="middle" font-size="6.8" font-weight="700" fill="#fff">'+esc(ext)+'</text>');
 };
 function card(task,members,now){
  const checks=Array.isArray(task.checklist)?task.checklist:[],completed=checks.filter(x=>x?.done).length;
  const ids=task.assignee_ids||[task.assignee_id].filter(Boolean);
  const name=[...new Set(ids)].map(id=>members.find(x=>x.user_id===id)?.display_name||"").filter(Boolean).join(", ");
  const initials=name.split(/[\s,]+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join("");
  const done=!!task.completed_at;
  const due=task.due_date?new Date(task.due_date+"T12:00:00").toLocaleDateString("de-DE",{day:"numeric",month:"short"}):"";
  const priority={hoch:"Wichtig",niedrig:"Niedrig"}[task.priority]||"";
  const id=esc(task.id);
  return '<article class="work-task-card '+(done?"is-done":"")+'" draggable="true" data-drag-task="'+id+'" data-office-work="edit-task:'+id+'" tabindex="0">'+
   '<div class="work-task-title-row"><button type="button" class="work-task-toggle '+(done?"is-checked":"")+'" data-office-work="toggle-task:'+id+'" aria-label="'+(done?"Wieder öffnen":"Erledigen")+': '+esc(task.title)+'" aria-pressed="'+done+'">'+(done?"✓":"")+'</button><strong>'+esc(task.title)+'</strong></div>'+
   (checks.length?'<div class="work-card-checks">'+checks.slice(0,5).map(x=>'<div class="'+(x.done?"done":"")+'"><span class="work-subcheck" aria-hidden="true">'+(x.done?"✓":"")+'</span><span>'+esc(x.text||"")+'</span></div>').join("")+(checks.length>5?'<div class="work-check-more">+'+(checks.length-5)+' weitere</div>':"")+'</div>':"")+
   '<footer><div class="work-task-chips">'+
   (due?'<span class="work-due '+(task.due_date<now&&!done?"is-overdue":"")+'" title="Fällig am '+esc(task.due_date)+'">'+icon("calendar")+'<time datetime="'+esc(task.due_date)+'">'+esc(due)+'</time></span>':"")+
   (checks.length?'<span class="work-meta-chip" title="Checkliste">'+icon("checklist")+completed+'/'+checks.length+'</span>':"")+
   (priority?'<span class="work-meta-priority">'+priority+'</span>':"")+
   '</div>'+(name?'<div class="work-card-assignee" title="Verantwortlich: '+esc(name)+'"><span class="work-assignee-avatar" aria-hidden="true">'+esc(initials)+'</span><span class="work-assignee-name">'+esc(name)+'</span></div>':"")+
   '</footer></article>';
 }
 function planner({project,buckets,tasks,members=[],now=new Date().toISOString().slice(0,10)}){
  const ordered=buckets.filter(b=>!b.is_archived).slice().sort((a,b)=>a.position-b.position);
  const unbucketed=tasks.some(t=>!t.bucket_id),columns=[...(unbucketed?[{id:"__none",name:"Ohne Bucket",virtual:true}]:[]),...ordered];
  const board=columns.map((bucket,i)=>{
   const group=tasks.filter(t=>bucket.virtual?!t.bucket_id:t.bucket_id===bucket.id);
   const open=group.filter(t=>!t.completed_at),done=group.filter(t=>t.completed_at),id=esc(bucket.id);
   return '<section class="work-bucket" data-drop-bucket="'+(bucket.virtual?"":id)+'" data-bucket-id="'+id+'">'+
    '<header class="work-bucket-header">'+
    (bucket.virtual?'<strong>'+esc(bucket.name)+'</strong>':
      '<span class="work-bucket-grab" draggable="true" data-drag-bucket="'+id+'" title="Bucket verschieben"><span class="work-bucket-grip" aria-hidden="true">⠿</span><strong>'+esc(bucket.name)+'</strong><span class="work-bucket-count">'+open.length+'</span></span>'+
      '<div class="work-bucket-actions"><button type="button" class="work-bucket-more" aria-label="Bucket-Aktionen" data-office-work="bucket-menu:'+id+'">•••</button>'+
      '<div class="work-bucket-menu" data-office-menu="'+id+'" role="menu" hidden>'+
      '<button type="button" data-office-work="rename-bucket:'+id+'">'+icon("pencil")+'Umbenennen</button>'+
      '<button type="button" data-office-work="shift-left:'+id+'" '+(i===0?"disabled":"")+'>'+icon("left")+'Nach links</button>'+
      '<button type="button" data-office-work="shift-right:'+id+'" '+(i===columns.length-1?"disabled":"")+'>'+icon("right")+'Nach rechts</button>'+
      '<button type="button" class="work-bucket-danger" data-office-work="archive-bucket:'+id+'">'+icon("trash")+'Archivieren</button></div></div>')+
    '</header>'+
    (bucket.virtual?"":'<button type="button" class="work-add-task" data-office-work="new-task:'+id+'">'+icon("plus")+'Aufgabe hinzufügen</button>')+
    '<div class="work-bucket-scroll"><div class="work-task-list">'+open.map(t=>card(t,members,now)).join("")+'</div>'+
    (done.length?'<details class="work-completed"><summary>Erledigte Aufgaben <span>'+done.length+'</span></summary><div class="work-task-list">'+done.map(t=>card(t,members,now)).join("")+'</div></details>':"")+
    '</div></section>';
  }).join("");
  return '<div class="work-planner-toolbar"><div><strong>Board</strong><span>'+tasks.filter(t=>!t.completed_at).length+
    ' offen · '+ordered.length+' Buckets</span></div><span class="work-planner-actions">'+
    '<button type="button" data-office-work="team">Team · '+members.length+'</button>'+
    '<button type="button" data-office-work="new-bucket">'+icon("plus")+'Bucket</button>'+
    '<button type="button" data-office-work="bucket-archive">Archiv</button></span></div>'+
    '<div class="work-board">'+board+'</div>'+
    (!columns.length?'<p class="work-empty">Noch keine Buckets · einen Bucket hinzufügen.</p>':"");
 }
 function desktop({project,folders=[],files=[],plans=[],folderId=null}){
  const current=folders.find(f=>f.id===folderId),trail=[];let folder=current,guard=0;
  while(folder&&guard++<20){trail.unshift(folder);folder=folders.find(f=>f.id===folder.parent_id)}
  const children=folders.filter(f=>(f.parent_id||null)===(folderId||null));
  const documents=files.filter(f=>(f.folder_id||null)===(folderId||null));
  const name=project?.name||"Büro";
  return '<div class="work-desktop-toolbar"><div class="work-breadcrumb"><button data-office-work="root">'+esc(name)+'</button>'+
    trail.map(f=>'<span>›</span><button data-office-work="folder:'+esc(f.id)+'">'+esc(f.name)+'</button>').join("")+
    '</div><div class="work-toolbar-actions"><button data-office-work="new-folder">＋ Ordner</button><button data-office-work="upload-files">↑ Dateien</button></div></div>'+
    '<div class="work-drop-hint">Dateien, PDFs, Word, Excel, Bilder oder E-Mails hierher ziehen</div>'+
    '<div class="work-files">'+
    (folderId?'<button class="work-file work-folder work-up" data-office-work="folder-up"><span class="work-file-icon">'+tileIcon("back")+'</span><strong>Zurück</strong><small>Ordner</small></button>':"")+
    children.map(f=>'<button class="work-file work-folder" data-office-work="folder:'+esc(f.id)+'"><span class="work-file-icon">'+tileIcon("folder")+'</span><strong>'+esc(f.name)+'</strong><small>Ordner</small></button>').join("")+
    documents.map(f=>'<button class="work-file" data-office-work="download:'+esc(f.id)+'"><span class="work-file-icon">'+tileIcon(String(f.media_type||"").startsWith("image/")?"image":"file",f)+'</span><strong>'+esc(f.file_name)+'</strong><small>'+esc(String(f.file_name||"").split(".").pop().toUpperCase())+' · '+Math.max(1,Math.round(Number(f.bytes||0)/1024))+' KB</small></button>').join("")+
    (!children.length&&!documents.length?'<div class="work-empty work-empty-wide">Dieser Ordner ist leer. Einen Ordner anlegen oder Unterlagen hierher ziehen.</div>':"")+
    '</div>'+
    (!folderId&&plans.length?'<div class="work-plans-inline"><h3>Terminpläne</h3><div class="work-files">'+plans.map(p=>
      '<a class="work-file work-folder" href="../terminplan.html?id='+encodeURIComponent(p.id)+'"><span class="work-file-icon">'+tileIcon("folder")+'</span><strong>'+esc(p.phase)+'</strong><small>Projektterminplan</small></a>').join("")+'</div></div>':"");
 }
 return Object.freeze({planner,desktop,card,tileIcon});
});
