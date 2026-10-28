/*
 * TBA Office · Terminplan dependency audit v0.1
 * Pure, deterministic, read-only computation. No network, DOM or mutations.
 * Calendar: Monday–Friday, no holidays. Intervals include their end day.
 * EA / AE require the next working day; AA / EE allow the same date.
 * The existing schema has exactly one optional predecessor (task.pred).
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.TBATerminplanEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : null, function () {
  "use strict";
  const MS = 86400000;
  const RELATIONS = new Set(["EA", "AA", "EE", "AE"]);
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const dt = new Date(value + "T00:00:00Z");
    return Number.isFinite(dt.getTime()) && dt.toISOString().slice(0, 10) === value;
  }
  function workday(date) {
    const w = new Date(date + "T00:00:00Z").getUTCDay();
    return w !== 0 && w !== 6;
  }
  function shiftWorkdays(date, offset) {
    if (!validDate(date) || !Number.isInteger(offset) || Math.abs(offset) > 10000) throw new Error("Invalid workday shift");
    if (!offset) return date;
    const d = new Date(date + "T00:00:00Z");
    const direction = Math.sign(offset);
    let remaining = Math.abs(offset);
    while (remaining) {
      d.setUTCDate(d.getUTCDate() + direction);
      if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) remaining--;
    }
    return d.toISOString().slice(0, 10);
  }
  function nextWorkday(date) { return shiftWorkdays(date, 1); }
  function issue(code, taskId, predecessorId, extra) {
    return Object.assign({ code, taskId: String(taskId || ""), predecessorId: String(predecessorId || ""), severity: "warning", key: code + ":" + String(taskId || "") + ":" + String(predecessorId || "") }, extra || {});
  }
  function dependencyRule(pred, child) {
    const rel = child.rel || "EA";
    if (!RELATIONS.has(rel)) return null;
    const targetSide = rel === "EA" || rel === "AA" ? "start" : "end";
    const predDate = rel === "EA" || rel === "EE" ? pred.end : pred.start;
    const minimum = rel === "EA" || rel === "AE" ? nextWorkday(predDate) : predDate;
    return { relation: rel, targetSide, minimum, actual: child[targetSide] };
  }
  function analyze(state) {
    const tasks = Array.isArray(state && state.tasks) ? state.tasks : [];
    const project = state && state.project || {};
    const map = new Map(), issues = [];
    for (const task of tasks) {
      if (!task || typeof task.id !== "string" || !task.id) {
        issues.push(issue("invalid_id", "", "", { severity: "error" }));
        continue;
      }
      if (map.has(task.id)) issues.push(issue("duplicate_id", task.id, "", { severity: "error" }));
      else map.set(task.id, task);
    }
    for (const task of tasks) {
      if (!task || !task.id) continue;
      if (!validDate(task.start) || !validDate(task.end)) {
        issues.push(issue("invalid_date", task.id, "", { severity: "error" }));
        continue;
      }
      if (task.end < task.start) issues.push(issue("invalid_range", task.id, "", { severity: "error" }));
      if (task.type === "milestone" && task.end !== task.start) issues.push(issue("milestone_span", task.id, "", { severity: "error" }));
      if (validDate(project.end) && task.end > project.end) issues.push(issue("project_horizon", task.id, "", { actual:task.end, minimum:project.end }));
      if (!task.pred) continue;
      if (!map.has(task.pred)) {
        issues.push(issue("missing_predecessor", task.id, task.pred, { severity: "error" }));
        continue;
      }
      if (!RELATIONS.has(task.rel || "EA")) {
        issues.push(issue("unsupported_relation", task.id, task.pred, { severity: "error" }));
        continue;
      }
      const pred=map.get(task.pred);
      if (!validDate(pred.start) || !validDate(pred.end)) continue;
      const rule=dependencyRule(pred,task);
      if (rule && task[rule.targetSide] < rule.minimum) issues.push(issue("dependency_violation", task.id, pred.id, Object.assign({severity:"error"},rule)));
    }
    // Detect predecessor cycles, independent of task order. Report each cycle once.
    const visited = new Set(), cycles = new Set();
    for (const start of [...map.keys()].sort()) {
      if (visited.has(start)) continue;
      const path=[], indexes=new Map();
      let id=start;
      while (id && map.has(id) && !visited.has(id)) {
        if (indexes.has(id)) {
          const nodes=path.slice(indexes.get(id)).sort();
          const key=nodes.join("|");
          if (!cycles.has(key)) {
            cycles.add(key);
            issues.push(issue("cycle", nodes[0], "", {severity:"error", taskIds:nodes, key:"cycle:"+key}));
          }
          break;
        }
        indexes.set(id,path.length);
        path.push(id);
        id=map.get(id).pred;
      }
      path.forEach(x=>visited.add(x));
    }
    issues.sort((a,b)=>a.key.localeCompare(b.key));
    return {issues, count:issues.length, errors:issues.filter(i=>i.severity==="error").length};
  }
  function downstream(state, originIds) {
    const tasks = Array.isArray(state && state.tasks) ? state.tasks : [];
    const byPred = new Map();
    for (const t of tasks) {
      if (!t || !t.pred || !t.id) continue;
      if (!byPred.has(t.pred)) byPred.set(t.pred,[]);
      byPred.get(t.pred).push(t.id);
    }
    byPred.forEach(values=>values.sort());
    const roots = [...new Set(originIds || [])].sort();
    const seen = new Set(roots), result=[], queue = [...roots];
    for(let pos=0;pos<queue.length;pos++){
      for(const child of byPred.get(queue[pos])||[]){
        if (seen.has(child)) continue;
        seen.add(child);
        result.push(child);
        queue.push(child);
      }
    }
    return result;
  }
  function compare(previous, current) {
    const prior=new Map(((previous && previous.tasks)||[]).filter(x=>x&&x.id).map(t=>[t.id,t]));
    const after=new Map(((current && current.tasks)||[]).filter(x=>x&&x.id).map(t=>[t.id,t]));
    const changedIds=[...new Set([...prior.keys(),...after.keys()])].filter(id=>{
      const p=prior.get(id),c=after.get(id);
      if(!p||!c)return true;
      return ["start","end","pred","rel","type"].some(key=>p[key]!==c[key]);
    }).sort();
    const previousIssues=new Set(analyze(previous).issues.map(x=>x.key));
    const currentIssues=analyze(current).issues;
    return {
      changedIds,
      downstreamIds:downstream(current,changedIds),
      newIssues:currentIssues.filter(x=>!previousIssues.has(x.key)),
      issues:currentIssues
    };
  }
  function previewShift(state, taskId, offset) {
    if (!Number.isInteger(offset) || offset===0 || Math.abs(offset)>260) throw new Error("Shift must be 1–260 working days");
    const tasks=state && state.tasks || [];
    const target=tasks.find(t=>t && t.id===taskId);
    if (!target || !validDate(target.start) || !validDate(target.end)) throw new Error("Select a valid task");
    const copy=JSON.parse(JSON.stringify(state));
    const moved=copy.tasks.find(t=>t.id===taskId);
    moved.start=shiftWorkdays(moved.start,offset);
    moved.end=shiftWorkdays(moved.end,offset);
    const report=compare(state,copy);
    return {
      state:copy, taskId, offset, before:{start:target.start,end:target.end},
      after:{start:moved.start,end:moved.end},
      affectedIds:report.downstreamIds,
      newIssues:report.newIssues,
      allIssues:report.issues
    };
  }
  return Object.freeze({validDate,workday,shiftWorkdays,dependencyRule,analyze,downstream,compare,previewShift});
});
