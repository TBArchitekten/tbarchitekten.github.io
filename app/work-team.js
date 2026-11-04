/* Project team (from Window's Build 96C). In the office the team members are office members. */
(()=>{
'use strict';
const sb=window.MINDS_SUPABASE;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function members(projectId){
  if(!projectId)return [];
  const {data:links,error}=await sb.from('minds_work_project_people')
    .select('person_id').eq('project_id',projectId);
  if(error)throw error;
  const ids=[...new Set((links||[]).map(x=>x.person_id).filter(Boolean))];
  if(!ids.length)return [];
  const {data,error:pe}=await sb.from('isabella_people')
    .select('id,name').in('id',ids);
  if(pe)throw pe;
  return (data||[]).sort((a,b)=>a.name.localeCompare(b.name,'de'));
}

// TBA Office: the team of a project is chosen from the office members (isabella_people lists them).
// Only the project lead and admins may change it; the database enforces that.
const denied=e=>e?.code==='42501'||/row-level security|permission/i.test(String(e?.message||''));
async function open(project,onChanged=()=>{}){
  const [team,allResult]=await Promise.all([
    members(project.id),
    sb.from('isabella_people').select('id,name').order('name')
  ]);
  if(allResult.error)throw allResult.error;
  const all=allResult.data||[],linked=new Set(team.map(p=>p.id));
  const available=all.filter(p=>!linked.has(p.id));
  const peopleHtml=team.map(p=>
    '<div class="work-team-member"><strong>'+esc(p.name)+'</strong><span>'+
    '<button type="button" data-work-team-remove="'+esc(p.id)+'">Entfernen</button>'+
    '</span></div>'
  ).join('')||'<p class="small">Noch niemand zugeordnet.</p>';
  const addHtml=available.length
    ?'<label>Mitglied hinzufügen<select id="workTeamExisting"><option value="">Mitglied wählen …</option>'+
      available.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')+'</select></label>'+
      '<button id="workTeamAdd" class="primary" type="button">Zum Projekt hinzufügen</button>'
    :'<p class="small">Alle Office-Mitglieder sind bereits im Team. Neue Mitglieder legt ein Admin unter <a href="../#members">Mitglieder</a> an.</p>';
  window.ISABELLA_APP?.openModal?.('Team · '+project.name,
    '<div class="form work-team-editor">'+
    '<p class="small">Das Projektteam aus den Office-Mitgliedern. Es dient der Zuweisung und Planung im Planner; niemand wird benachrichtigt. Ändern können es die Projektleitung und Admins.</p>'+
    '<div class="work-team-list">'+peopleHtml+'</div>'+
    addHtml+
    '<p id="workTeamError" class="small" role="status"></p>'+
    '</div>'
  );
  const error=msg=>{const el=$('#workTeamError');if(el)el.textContent=msg};
  const refresh=async()=>{await onChanged();await open(project,onChanged)};
  const addButton=$('#workTeamAdd');
  if(addButton)addButton.onclick=async()=>{
    const personId=$('#workTeamExisting')?.value||'';
    if(!personId){error('Bitte ein Mitglied wählen.');return}
    addButton.disabled=true;
    const {error:me}=await sb.from('minds_work_project_people').insert({project_id:project.id,person_id:personId});
    if(me){error(denied(me)?'Nur die Projektleitung oder ein Admin kann das Team ändern.':'Nicht gespeichert: '+(me.message||me));addButton.disabled=false;return}
    await refresh();
  };
  $$('[data-work-team-remove]').forEach(b=>b.onclick=async()=>{
    const id=b.dataset.workTeamRemove,person=team.find(p=>p.id===id);
    if(!person||!window.confirm('„'+person.name+'“ aus diesem Projekt entfernen?'))return;
    b.disabled=true;
    const {data,error:re}=await sb.from('minds_work_project_people')
      .delete().eq('project_id',project.id).eq('person_id',id).select('person_id');
    if(re){error(re.code==='23503'
      ? 'Nicht entfernt: Erst Aufgaben-Zuordnungen und geplante Teamtage dieser Person entfernen.'
      : denied(re)?'Nur die Projektleitung oder ein Admin kann das Team ändern.':'Nicht entfernt: '+(re.message||'Bitte Zuordnungen prüfen.'));b.disabled=false;return}
    if(!data?.length){error('Nur die Projektleitung oder ein Admin kann das Team ändern.');b.disabled=false;return}
    await refresh();
  });
}
window.MINDS_WORK_TEAM={members,open};
})();