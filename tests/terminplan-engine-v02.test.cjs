"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const E=require("../terminplan-engine.js");
const task=(id,start,end,extra={})=>({id,start,end,type:"task",...extra});
const plan=(tasks,calendar={})=>({project:{start:"2026-10-01",end:"2026-12-31",calendar},tasks});
const codes=s=>E.analyze(s).issues.map(x=>x.code);
test("legacy predecessor still works; explicit empty array overrides legacy mirror",()=>{
  assert.deepEqual(E.dependencies({pred:"t1",rel:"EA"}),[{pred:"t1",rel:"EA",lagDays:0}]);
  assert.deepEqual(E.dependencies({pred:"t1",dependencies:[]}),[]);
});
test("multiple links validated individually, same-day handover accepted",()=>{
  const s=plan([
    task("a","2026-10-01","2026-10-02"),
    task("b","2026-10-02","2026-10-06"),
    task("c","2026-10-05","2026-10-06",{dependencies:[{pred:"a",rel:"EA",lagDays:0},{pred:"b",rel:"EE",lagDays:0}]})
  ]);
  assert.equal(E.analyze(s).errors,0);
  s.tasks[2].end="2026-10-05";
  assert.equal(codes(s).filter(x=>x==="dependency_violation").length,1);
});
test("lag working days observes explicit non-working dates, never infers holidays",()=>{
 const base=plan([task("p","2026-10-01","2026-10-02"),task("s","2026-10-06","2026-10-06",{dependencies:[{pred:"p",rel:"EA",lagDays:1}]})]);
 assert.equal(E.analyze(base).errors,0);
 base.project.calendar.nonWorkingDates=["2026-10-05"];
 assert.equal(codes(base).includes("dependency_violation"),false);
 base.tasks[1].start="2026-10-05";
 base.tasks[1].end="2026-10-05";
 assert.equal(codes(base).includes("dependency_violation"),true);
 assert.equal(E.shiftWorkdays("2026-10-02",1,base.project.calendar),"2026-10-06");
});
test("negative lag is explicit and deterministic",()=>{
 const s=plan([task("a","2026-10-08","2026-10-09"),task("b","2026-10-07","2026-10-07",{dependencies:[{pred:"a",rel:"AA",lagDays:-1}]})]);
 assert.equal(E.analyze(s).errors,0);
 s.tasks[1].start="2026-10-06";s.tasks[1].end="2026-10-06";
 assert.equal(codes(s).includes("dependency_violation"),true);
});
test("rejects invalid calendar and malformed lag",()=>{
 const s=plan([task("a","2026-10-01","2026-10-02"),task("b","2026-10-04","2026-10-05",{dependencies:[{pred:"a",rel:"EA",lagDays:1.5}]})],{nonWorkingDates:["nonsense"]});
 assert.ok(codes(s).includes("invalid_calendar"));
 assert.ok(codes(s).includes("invalid_lag"));
});
test("protected deadline warns on unauthorized drift, not invented on old tasks",()=>{
 const s=plan([task("a","2026-10-01","2026-10-05",{protectedDate:"2026-10-02"})]);
 assert.ok(codes(s).includes("protected_deadline"));
 delete s.tasks[0].protectedDate;
 assert.ok(!codes(s).includes("protected_deadline"));
});
test("multi-branch transitive impact and cycles",()=>{
 const s=plan([task("a","2026-10-01","2026-10-01",{dependencies:[{pred:"c",rel:"AA"}]}),
 task("b","2026-10-01","2026-10-01",{dependencies:[{pred:"a",rel:"AA"}]}),
 task("c","2026-10-01","2026-10-01",{dependencies:[{pred:"b",rel:"AA"}]}),
 task("d","2026-10-01","2026-10-01",{dependencies:[{pred:"b",rel:"AA"},{pred:"a",rel:"AA"}]})]);
 assert.deepEqual(E.downstream(s,["a"]),["b","d","c"]);
 assert.equal(codes(s).filter(x=>x==="cycle").length,1);
});
test("preview never mutates source and respects explicit holidays",()=>{
 const s=plan([task("a","2026-10-02","2026-10-02")],{nonWorkingDates:["2026-10-05"]});
 const snapshot=JSON.stringify(s);
 const preview=E.previewShift(s,"a",1);
 assert.equal(preview.after.start,"2026-10-06");
 assert.equal(JSON.stringify(s),snapshot);
});
test("comparison detects added relation and protected date",()=>{
 const prior=plan([task("a","2026-10-01","2026-10-01"),task("b","2026-10-01","2026-10-01")]);
 const after=JSON.parse(JSON.stringify(prior));
 after.tasks[1].dependencies=[{pred:"a",rel:"EA",lagDays:0}];
 after.tasks[1].protectedDate="2026-10-01";
 assert.deepEqual(E.compare(prior,after).changedIds,["b"]);
 assert.deepEqual(E.compare(prior,after).downstreamIds,[]);
});
