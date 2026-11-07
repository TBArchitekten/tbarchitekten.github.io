/* Project team (from Window's Build 96C). In the office the team members are office members. */
(()=>{
'use strict';
const sb=window.MINDS_SUPABASE;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// TBA Office (07.11.2026): one team per project, office_project_members, edited in Projekte.
async function members(projectId){
  if(!projectId)return [];
  const {data:links,error}=await sb.from('office_project_members')
    .select('user_id').eq('project_id',projectId);
  if(error)throw error;
  const ids=[...new Set((links||[]).map(x=>x.user_id).filter(Boolean))];
  if(!ids.length)return [];
  const {data,error:pe}=await sb.from('isabella_people')
    .select('id,name').in('id',ids);
  if(pe)throw pe;
  return (data||[]).sort((a,b)=>a.name.localeCompare(b.name,'de'));
}
async function open(project,onChanged=()=>{}){
  const projects=window.TBA_OFFICE_PROJECTS;
  if(!projects?.openTeam)throw new Error('Mitglieder können gerade nicht bearbeitet werden.');
  await projects.openTeam(project.id,()=>void onChanged());
}
window.MINDS_WORK_TEAM={members,open};
})();