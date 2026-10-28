"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../terminplan-engine.js");

function plan(tasks, end="2026-12-31") {
  return {project:{start:"2026-10-01",end},tasks};
}
function task(id,start,end,other={}) {
  return {id,start,end,type:"task",...other};
}
const pred=task("P","2026-10-01","2026-10-02");
const child=(date,relation="EA")=>task("S",date,date,{pred:"P",rel:relation,type:"milestone"});
const has=(state,code)=>E.analyze(state).issues.some(i=>i.code===code);

test("validates UTC calendar dates strictly",()=>{
  assert.equal(E.validDate("2026-02-29"),false);
  assert.equal(E.validDate("2028-02-29"),true);
  assert.equal(E.validDate("2026-13-01"),false);
  assert.equal(E.validDate("2026-10-01"),true);
});
test("moves working days across a weekend in both directions",()=>{
  assert.equal(E.shiftWorkdays("2026-10-02",1),"2026-10-05");
  assert.equal(E.shiftWorkdays("2026-10-05",-1),"2026-10-02");
  assert.equal(E.shiftWorkdays("2026-10-02",0),"2026-10-02");
});
test("EA requires first workday after predecessor end",()=>{
  assert.equal(has(plan([pred,child("2026-10-02")]),"dependency_violation"),true);
  assert.equal(has(plan([pred,child("2026-10-05")]),"dependency_violation"),false);
});
test("AA and EE allow equal boundaries",()=>{
  assert.equal(has(plan([pred,child("2026-10-01","AA")]),"dependency_violation"),false);
  assert.equal(has(plan([pred,child("2026-10-02","EE")]),"dependency_violation"),false);
  assert.equal(has(plan([pred,child("2026-09-30","AA")]),"dependency_violation"),true);
  assert.equal(has(plan([pred,child("2026-10-01","EE")]),"dependency_violation"),true);
});
test("AE requires successor end after predecessor starts",()=>{
  assert.equal(has(plan([pred,child("2026-10-01","AE")]),"dependency_violation"),true);
  assert.equal(has(plan([pred,child("2026-10-02","AE")]),"dependency_violation"),false);
});
test("reports orphans, unsupported relation, cycles and bad date",()=>{
  const s=plan([task("a","2026-10-01","2026-10-02",{pred:"b"}),task("b","2026-10-01","2026-10-02",{pred:"a"}),task("c","2026-10-01","2026-10-01",{pred:"missing"}),task("d","2026-10-01","2026-10-02",{pred:"b",rel:"XX"}),task("e","2026-02-30","2026-03-01")]);
  const issues=E.analyze(s).issues;
  for(const code of ["cycle","missing_predecessor","unsupported_relation","invalid_date"])assert.ok(issues.some(x=>x.code===code),code);
  assert.equal(issues.filter(x=>x.code==="cycle").length,1);
});
test("reports milestone durations and project horizon",()=>{
  const s=plan([task("m","2026-11-04","2026-11-05",{type:"milestone"})],"2026-11-04");
  assert.equal(has(s,"milestone_span"),true);
  assert.equal(has(s,"project_horizon"),true);
});
test("calculates transitive downstream without infinite loops",()=>{
  const s=plan([{id:"a",pred:"c"},{id:"b",pred:"a"},{id:"c",pred:"b"},{id:"d",pred:"b"}]);
  assert.deepEqual(E.downstream(s,["a"]),["b","c","d"]);
});
test("compares only scheduling fields and isolates newly introduced conflicts",()=>{
  const before=plan([pred,child("2026-10-05")]);
  const after=JSON.parse(JSON.stringify(before));
  after.tasks[0].name="text-only edit";
  assert.deepEqual(E.compare(before,after).changedIds,[]);
  after.tasks[0].end="2026-10-05";
  const diff=E.compare(before,after);
  assert.deepEqual(diff.changedIds,["P"]);
  assert.deepEqual(diff.downstreamIds,["S"]);
  assert.equal(diff.newIssues.length,1);
});
test("previews never mutate source state and never cascade silently",()=>{
  const original=plan([pred,child("2026-10-05")]);
  const frozen=JSON.stringify(original);
  const preview=E.previewShift(original,"P",1);
  assert.equal(JSON.stringify(original),frozen);
  assert.equal(preview.after.start,"2026-10-02");
  assert.equal(preview.after.end,"2026-10-05");
  assert.deepEqual(preview.affectedIds,["S"]);
  assert.equal(preview.state.tasks[1].start,"2026-10-05");
  assert.ok(preview.newIssues.some(x=>x.code==="dependency_violation"));
  assert.throws(()=>E.previewShift(original,"P",0));
});
