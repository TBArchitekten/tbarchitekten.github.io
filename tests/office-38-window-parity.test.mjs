import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {validateRebuild} from '../supabase/functions/office-terminplan-ai/rebuild-core.mjs';
const require=createRequire(import.meta.url);
const surface=require('../app/office-window-work-surface.js');
const rebuild=require('../terminplan-rebuild.js');
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Office Desktop uses Window file tile contract including icon and drop hint',()=>{
 const html=surface.desktop({
  project:{name:'Bernried'},folderId:null,
  folders:[{id:'f1',name:'Dokumente',parent_id:null}],
  files:[{id:'a',file_name:'Plan.pdf',folder_id:null,bytes:2000,media_type:'application/pdf'}],
  plans:[{id:'p1',phase:'LPH3'}]
 });
 for(const klass of ['work-desktop-toolbar','work-breadcrumb','work-file','work-folder','work-file-icon','work-files','work-drop-hint'])
  assert.match(html,new RegExp(klass));
 assert.match(html,/Dokumente/);
 assert.match(html,/Plan\.pdf/);
 assert.match(html,/work-tile-svg/);
 assert.match(html,/terminplan\.html\?id=p1/);
 assert.doesNotMatch(html,/office-work-wrap/);
});
test('Office Planner uses Window Board/card/checklist/actions with meaningful task metadata',()=>{
 const board=surface.planner({
  project:{name:'Bernried'},buckets:[{id:'bucket-1',name:'Grundrisse',position:0}],
  members:[{user_id:'m1',display_name:'Edgar Martínez'},{user_id:'m2',display_name:'Yvonne Schwarz'}],
  tasks:[{
   id:'task-1',title:'Lichtplanung freigeben',bucket_id:'bucket-1',
   start_date:'2026-11-01',due_date:'2026-11-12',completed_at:null,
   priority:'hoch',assignee_ids:['m1','m2'],
   checklist:[{id:'c1',text:'Pläne geprüft',done:true},{id:'c2',text:'AG Freigabe',done:false}]
  }],
  now:'2026-11-05'
 });
 for(const klass of ['work-planner-toolbar','work-board','work-bucket','work-bucket-grab',
  'work-task-card','work-task-title-row','work-task-toggle','work-card-checks',
  'work-completed','work-meta-priority','work-card-assignee']){
  if(klass==='work-completed')continue; // only rendered when completed tasks exist
  assert.match(board,new RegExp(klass));
 }
 assert.match(board,/Edgar Martínez, Yvonne Schwarz/);
 assert.match(board,/1\/2/);
 assert.match(board,/Wichtig/);
 assert.match(board,/data-office-work="toggle-task:task-1"/);
 assert.match(board,/data-office-work="new-task:bucket-1"/);
 assert.match(board,/data-office-work="bucket-menu:bucket-1"/);
});
test('Office reads only Office tables but reuses Window visual view files',()=>{
 const index=read('app/index.html'),app=read('app/office-work.js');
 assert.match(index,/office-window-work-surface\.js\?v=office38/);
 assert.match(index,/office-work\.js\?v=office38/);
 assert.match(app,/TBA_WINDOW_WORK_SURFACE/);
 for(const table of ['office_projects','office_tasks','office_task_buckets','office_project_folders','office_project_files','office_task_assignees'])
  assert.match(app,new RegExp(table));
 assert.doesNotMatch(app,/from\('isabella_projects'\)/);
 const sql=read('supabase/migrations/20261105152000_office_work_multi_assignees_v1.sql');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/office_task_assignees_insert/);
 assert.match(sql,/office_tasks_team_delete/);
 new Function(app);
});
test('Muster library is separate from Projekte and preserves read-only template path',()=>{
 const shell=read('app/shell.js'),projects=read('app/office-projects.js'),
  app=read('app/app.js'),plan=read('terminplan.html');
 assert.match(shell,/id="plansScreen"/);
 assert.match(shell,/id="officePlansTemplates"/);
 assert.match(shell,/id="officePlansInstances"/);
 assert.match(projects,/function openPlans/);
 assert.match(projects,/terminplan\.html\?template=/);
 assert.match(projects,/terminplan\.html\?id=/);
 assert.match(projects,/officeToolsPlans'\)\?\.addEventListener\('click',openPlans\)/);
 assert.match(app,/'calendar','tools','projects','plans'/);
 assert.match(plan,/if\(TEMPLATE_ID\)\{back\.href='\.\/app\/#section=plans'/);
 assert.match(plan,/office_terminplan_templates/);
 new Function(projects);
});
test('Terminplan is a conversation, no mode-specific editing button is required',()=>{
 const html=read('terminplan.html'),edge=read('supabase/functions/office-terminplan-ai/index.ts');
 assert.match(html,/id="dialogueAttach"/);
 assert.match(html,/id="dialogueSend"/);
 assert.doesNotMatch(html,/id="dialogueTransform"/);
 assert.doesNotMatch(html,/id="dialogueRebuild"/);
 assert.match(html,/body:\{action:'auto'/);
 assert.match(edge,/office_terminplan_route_v1/);
 assert.match(edge,/mode:\{type:"string",enum:\["discuss","transform","rebuild"\]\}/);
 assert.match(edge,/mode:effectiveAction/);
 const scripts=html.split('<script>').slice(1).map(x=>x.split('</script>')[0]).filter(Boolean);
 for(const code of scripts)new Function(code);
});
test('Complete PDF rows can be proposed with unresolved arrows but never called identical',()=>{
 const source={
  source_version:'Vorabzug 02',complete:true,summary:'Rows and dates transcribed',
  uncertainties:['Ein Pfeil am Rand ist nicht eindeutig zuzuordnen.'],
  expected_counts:{groups:1,activities:1,milestones:0},
  groups:[{code:'g1',wbs:'01',name:'LPH3',category:'arch'}],
  tasks:[{row_id:'t1',group_code:'g1',name:'Vorplanung',type:'task',
    start:'2026-07-27',end:'2026-09-01',owner:'ARC',category:'arch',note:'',predecessors:[]}]
 };
 const original={project:{name:'Bernried',start:'2026-11-05',end:'2027-03-09'},
  groups:[{id:'existing',name:'Vorher',wbs:'A',category:'arch'}],
  tasks:[{id:'old',group:'existing',name:'Alt',type:'task',start:'2026-11-05',end:'2027-03-09'}]};
 assert.equal(validateRebuild(source).ok,true);
 const result=rebuild.preview({state:original,result:source,revision:2,requestId:'test',
  sourceName:'Bernried.pdf',standDate:'2026-11-05',mode:'rebuild'});
 assert.equal(result.proposal.unresolved_dependencies.length,1);
 assert.equal(result.proposal.graph_not_transcribed,true);
 assert.equal(result.proposal.counts.links,0);
 assert.match(result.text,/WARNUNG: Der PDF-Plan enthält gezeichnete Beziehungen/);
 assert.match(result.text,/NICHT identisch/);
 assert.equal(rebuild.review(result.proposal,original,2).ok,true);
 assert.equal(original.groups[0].id,'existing');
 assert.throws(()=>rebuild.convert(original,source,'Instruction','2026-11-05','transform'),/source_not_completely_verified/);
});

test('Window unbucketed Planner column is always available and accepts dropped tasks',()=>{
 const board=surface.planner({project:{name:'Bernried'},buckets:[{id:'b',name:'Grundrisse',position:1}],tasks:[],members:[]});
 assert.match(board,/Ohne Bucket/);
 assert.match(board,/data-drop-bucket=""/);
 const adapter=read('app/office-work.js');
 assert.match(adapter,/const target=e\.target\.closest\('\[data-drop-bucket\]'\)/);
 assert.match(adapter,/moveTask\(dragged,target\.dataset\.dropBucket\|\|null\)/);
});
test('Office file actions are authorized for project teammates, with immutable storage identity',()=>{
 const sql=read('supabase/migrations/20261105152000_office_work_multi_assignees_v1.sql');
 assert.match(sql,/office_project_files_team_update/);
 assert.match(sql,/office_project_files_team_delete/);
 assert.match(sql,/office_file_identity_guard/);
 assert.match(sql,/new\.storage_path/);
 assert.match(sql,/office_project_members/);
});
test('Office Desktop exposes Window rename, move and delete on Office tables, without breaking Window',()=>{
 const html=read('app/index.html'),adapter=read('app/office-work.js'),
  operations=read('app/office-desktop-ops.js');
 assert.match(html,/office-desktop-ops\.js\?v=office38/);
 assert.match(adapter,/TBA_OFFICE_DESKTOP\?\.enhance/);
 assert.match(adapter,/office:true,projectId:project\.id/);
 assert.match(operations,/office_project_folders/);
 assert.match(operations,/office_project_files/);
 assert.match(operations,/const folderTable=office\?/);
 assert.match(operations,/const fileNameField=office\?/);
 assert.match(operations,/data-office-work\^="folder:/);
 assert.match(operations,/data-office-work\^="download:/);
 assert.match(operations,/create\('Umbenennen'/);
 assert.match(operations,/create\('Verschieben'/);
 assert.match(operations,/create\('Löschen'/);
 new Function(operations);new Function(adapter);
});

test('Full-plan replacement cannot silently discard known links or unidentified source arrows',()=>{
 const html=read('terminplan.html'),source=read('terminplan-rebuild.js');
 assert.match(source,/ambiguousArrowEvidence/);
 assert.match(source,/lost_existing_links/);
 assert.match(source,/graph_not_transcribed/);
 assert.match(html,/id="linkCount"/);
 assert.match(html,/pdfLinkRecovery/);
 assert.match(html,/const missingGraph=dialogueProposal/);
 assert.match(html,/if\(proposal\.graph_not_transcribed\)/);
 assert.match(html,/providerBody=await response\.json\(\)/);
 assert.match(html,/terminplan-rebuild\.js\?v=office39/);
 for(const match of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Function(match[1]);
});
test('Completed reconstruction discloses previous links even if the new source has none',()=>{
 const state={project:{name:'x',start:'2026-01-01',end:'2026-01-31'},
   groups:[{id:'g',name:'A',wbs:'01',category:'arch'}],
   tasks:[{id:'a',name:'One',group:'g',start:'2026-01-01',end:'2026-01-03',type:'task',dependencies:[]},
          {id:'b',name:'Two',group:'g',start:'2026-01-05',end:'2026-01-06',type:'task',dependencies:[{pred:'a',rel:'EA',lagDays:1}]}]};
 const result={source_version:'v1',complete:true,summary:'fully verified text only',uncertainties:[],
   expected_counts:{groups:1,activities:1,milestones:0},
   groups:[{code:'new01',wbs:'01',name:'A',category:'arch'}],
   tasks:[{row_id:'r1',group_code:'new01',name:'New row',type:'task',start:'2026-01-10',end:'2026-01-16',
    owner:'ARC',category:'arch',note:'',predecessors:[]}]};
 const preview=rebuild.preview({state,result,revision:1,requestId:'qa',sourceName:'different.pdf',standDate:'2026-01-01'});
 assert.equal(preview.proposal.counts.previous_links,1);
 assert.equal(preview.proposal.counts.links,0);
 assert.equal(preview.proposal.lost_existing_links,1);
 assert.equal(preview.proposal.graph_not_transcribed,false);
 assert.match(preview.text,/1 bereits gespeicherte Verknüpfungen/);
});
