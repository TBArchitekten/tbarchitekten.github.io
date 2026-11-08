import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {validateRebuild} from '../supabase/functions/office-terminplan-ai/rebuild-core.mjs';
const require=createRequire(import.meta.url);
const rebuild=require('../terminplan-rebuild.js');
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

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

test('Office file actions are authorized for project teammates, with immutable storage identity',()=>{
 const sql=read('supabase/migrations/20261105155214_office_work_multi_assignees_v1.sql');
 assert.match(sql,/office_project_files_team_update/);
 assert.match(sql,/office_project_files_team_delete/);
 assert.match(sql,/office_file_identity_guard/);
 assert.match(sql,/new\.storage_path/);
 assert.match(sql,/office_project_members/);
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

test('Since 07.11.2026 Work is Window\'s own work.js on Window\'s tables (one data model)',()=>{
 const index=read('app/index.html'),work=read('app/work.js'),ops=read('app/office-desktop-ops.js');
 assert.match(index,/<script src="\.\/work\.js\?v=office42"><\/script>/);
 assert.doesNotMatch(index,/office-work\.js|office-window-work-surface\.js/);
 assert.ok(!fs.existsSync(new URL('../app/office-work.js',import.meta.url)));
 for(const table of ['isabella_projects','isabella_tasks','minds_work_buckets','minds_work_folders','minds_work_files'])
  assert.match(work,new RegExp("from\\('"+table+"'\\)"));
 assert.match(work,/TBA_OFFICE_DESKTOP\?\.enhance\(\{sb,folders,files,refresh:renderDesktop/);
 assert.match(ops,/const folderTable=office\?'office_project_folders':'minds_work_folders'/);
});

