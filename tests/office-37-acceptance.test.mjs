import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {REBUILD_SCHEMA,REBUILD_INSTRUCTIONS,validateRebuild} from '../supabase/functions/office-terminplan-ai/rebuild-core.mjs';
const require=createRequire(import.meta.url);
const builder=require('../terminplan-rebuild.js');
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const template={project:{projectNumber:'2401',projectName:'Bernried',phase:'LPH3',
 name:'Bernried LPH3',start:'2026-11-05',end:'2027-04-02',standDate:'2026-11-05'},
 groups:[{id:'g00',wbs:'00',name:'Alt',category:'qa'}],
 tasks:[{id:'m00',group:'g00',name:'Alter Meilenstein',type:'milestone',
 start:'2026-11-05',end:'2026-11-05',owner:'ARC',category:'arch'}]};
const source={
 source_version:'Vorabzug 02',complete:true,summary:'Alle Zeilen gelesen',uncertainties:[],
 expected_counts:{groups:2,activities:2,milestones:1},
 groups:[
  {code:'a',wbs:'01',name:'Konzeption',category:'arch'},
  {code:'b',wbs:'02',name:'Abgabe',category:'qa'}
 ],
 tasks:[
  {row_id:'001',group_code:'a',name:'Pläne vorbereiten',type:'task',start:'2026-07-27',end:'2026-09-18',owner:'ARC',category:'arch',note:'',predecessors:[]},
  {row_id:'002',group_code:'a',name:'Prüfung',type:'task',start:'2026-09-21',end:'2026-10-28',owner:'ARC',category:'arch',note:'',predecessors:[{row_id:'001',relation:'EA',lag_workdays:0}]},
  {row_id:'003',group_code:'b',name:'Externe Abgabe',type:'milestone',start:'2026-12-18',end:'2026-12-18',owner:'AG',category:'ag',note:'',predecessors:[{row_id:'002',relation:'EA',lag_workdays:0}]}
 ]
};
test('Source extraction schema supports entire schedule without 8 task cap',()=>{
 assert.equal(REBUILD_SCHEMA.additionalProperties,false);
 assert.match(REBUILD_INSTRUCTIONS,/ENTIRE|complete replacement/);
 assert.equal(validateRebuild(source).ok,true);
 assert.equal(validateRebuild({...source,expected_counts:{groups:3,activities:2,milestones:1}}).ok,false);
});
test('Complete replacement preserves project identity and replaces all rows/groups',()=>{
 const s=builder.convert(template,source,'Bernried.pdf','2026-11-05');
 assert.equal(s.project.projectNumber,'2401');
 assert.equal(s.project.start,'2026-07-27');
 assert.equal(s.project.end,'2026-12-18');
 assert.deepEqual(s.groups.map(g=>g.name),['Konzeption','Abgabe']);
 assert.deepEqual(s.tasks.map(t=>t.name),['Pläne vorbereiten','Prüfung','Externe Abgabe']);
 assert.equal(s.tasks[1].dependencies[0].pred,s.tasks[0].id);
 assert.equal(s.tasks[2].type,'milestone');
 assert.equal(template.groups.length,1);
 assert.equal(template.tasks[0].name,'Alter Meilenstein');
});
test('Model uncertainties, invalid dependencies and changed revision reject replacement',()=>{
 assert.throws(()=>builder.convert(template,{...source,complete:false,uncertainties:['Fecha ilegible']},'P.pdf','2026-11-05'));
 assert.equal(validateRebuild({...source,tasks:source.tasks.map(t=>({...t,start:'tomorrow'}))}).ok,false);
 const bad={...source,tasks:source.tasks.map((x,i)=>i===1?{...x,predecessors:[{row_id:'missing',relation:'EA',lag_workdays:0}]}:x)};
 assert.equal(validateRebuild(bad).ok,false);
 const original=builder.stable(template);
 const p=builder.preview({state:template,result:source,revision:5,requestId:'r',sourceName:'Bernried.pdf',standDate:'2026-11-05'});
 assert.equal(builder.review(p.proposal,template,5).ok,true);
 assert.equal(builder.review(p.proposal,template,6).ok,false);
 assert.equal(builder.stable(template),original);
});

test('Structural edits preserve old task identity, progress, protected dates and notes',()=>{
 const before={
  project:{projectNumber:'2401',projectName:'Bernried',phase:'LPH3',
   start:'2026-07-01',end:'2027-05-31',standDate:'2026-11-05',sourceFileName:'Source.pdf'},
  groups:[{id:'g-a',wbs:'01',name:'Alte Gruppe',category:'arch',collapsed:true}],
  tasks:[{id:'t-a',group:'g-a',name:'Bestehende Planung',type:'task',
   start:'2026-09-01',end:'2026-09-30',owner:'ARC',category:'arch',
   status:'In Bearbeitung',progress:70,critical:true,
   protectedDate:'2026-09-30',note:'Bestehende freigegebene Notiz',
   pred:'',rel:'EA',dependencies:[]}]
 };
 const edited={
  source_version:'Planänderung',complete:true,summary:'Gruppe umbenannt und Meilenstein angelegt',
  uncertainties:[],expected_counts:{groups:1,activities:1,milestones:1},
  groups:[{code:'g-a',wbs:'01',name:'Neue Gruppenbezeichnung',category:'arch'}],
  tasks:[
   {row_id:'t-a',group_code:'g-a',name:'Bestehende Planung',type:'task',
    start:'2026-09-01',end:'2026-09-30',owner:'ARC',category:'arch',note:'',
    predecessors:[]},
   {row_id:'new-final',group_code:'g-a',name:'Meilenstein Freigabe',type:'milestone',
    start:'2026-12-18',end:'2026-12-18',owner:'AG',category:'ag',note:'',
    predecessors:[{row_id:'t-a',relation:'EA',lag_workdays:0}]}
  ]
 };
 const sourceFingerprint=builder.stable(before);
 const draft=builder.preview({state:before,result:edited,revision:9,
  requestId:'r9',sourceName:'Bestätigte Plananweisung',standDate:'2026-11-05',mode:'transform'});
 assert.equal(draft.kind,'proposal');
 assert.equal(draft.proposal.diff.groups.edited.length,1);
 assert.equal(draft.proposal.diff.groups.created.length,0);
 assert.equal(draft.proposal.diff.tasks.created.length,1);
 assert.equal(draft.proposal.diff.tasks.edited.length,0);
 assert.equal(draft.proposal.mode,'transform');
 assert.equal(draft.preview.state.groups[0].id,'g-a');
 assert.equal(draft.preview.state.groups[0].collapsed,true);
 assert.equal(draft.preview.state.tasks[0].id,'t-a');
 assert.equal(draft.preview.state.tasks[0].progress,70);
 assert.equal(draft.preview.state.tasks[0].critical,true);
 assert.equal(draft.preview.state.tasks[0].status,'In Bearbeitung');
 assert.equal(draft.preview.state.tasks[0].protectedDate,'2026-09-30');
 assert.equal(draft.preview.state.tasks[0].note,'Bestehende freigegebene Notiz');
 assert.equal(draft.preview.state.tasks[1].dependencies[0].pred,'t-a');
 assert.equal(draft.preview.state.project.sourceFileName,'Source.pdf');
 assert.equal(draft.preview.state.project.start,'2026-07-01');
 assert.equal(draft.preview.state.project.end,'2027-05-31');
 assert.equal(builder.review(draft.proposal,before,9).ok,true);
 assert.equal(builder.review(draft.proposal,before,10).ok,false);
 assert.equal(builder.stable(before),sourceFingerprint);
 const misleading={...edited,tasks:[{...edited.tasks[0],row_id:'misidentified-old'},edited.tasks[1]]};
 assert.throws(()=>builder.convert(before,misleading,'Instruction','2026-11-05','transform'),/unrecognized_new_task_row/);
});

test('Office Work connects to Office schema only and can create real buckets and folders',()=>{
 const index=read('app/index.html'),work=read('app/office-work.js'),projects=read('app/office-projects.js');
 assert.match(index,/office-work\.js\?v=office37/);
 assert.doesNotMatch(index,/src="\.\/work\.js/);
 for(const name of ['office_projects','office_tasks','office_task_buckets','office_project_files','office_project_folders'])
  assert.match(work,new RegExp(name));
 assert.doesNotMatch(work,/from\('isabella_projects'\)/);
 assert.match(work,/MINDS_WORK=/);
 assert.match(projects,/Mitglieder/);
 assert.match(projects,/office_project_members/);
 assert.doesNotMatch(projects,/name="lead"/);
 new Function(work);new Function(projects);
});
test('Private uploaded files can be reused in subsequent Terminplan requests',()=>{
 const edge=read('supabase/functions/office-terminplan-ai/index.ts'),html=read('terminplan.html');
 const migration=read('supabase/migrations/20261105142000_office_terminplan_sources_v1.sql');
 assert.match(edge,/office_terminplan_sources/);
 assert.match(edge,/office-plan-sources/);
 assert.match(edge,/REBUILD_SCHEMA/);
 assert.match(edge,/source_ids/);
 assert.match(edge,/saved_source_unavailable/);
 assert.match(html,/loadSavedSources/);
 assert.match(html,/uploadPlanSource/);
 assert.doesNotMatch(html,/id="dialogueRebuild"/);
 assert.doesNotMatch(html,/id="dialogueTransform"/);
 assert.match(html,/action:'auto'/);
 assert.match(html,/office_terminplan_versions/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/user_id=\(select auth\.uid\(\)\)/);
 assert.match(migration,/office-plan-sources/);
 const inline=html.split('<script>').slice(1).map(x=>x.split('</script>')[0]).filter(Boolean);
 for(const s of inline)new Function(s);
});
test('Assistant floats, resizes and can open its own window',()=>{
 const html=read('terminplan.html'),css=read('assistant-surface.css');
 assert.match(html,/id="assistantPopout"/);
 assert.match(html,/setPointerCapture/);
 assert.match(html,/office-plan-assistant-window-v1/);
 assert.match(css,/resize:both/);
 assert.match(css,/assistant-popout/);
 assert.match(css,/dialogue-saved-sources/);
});
