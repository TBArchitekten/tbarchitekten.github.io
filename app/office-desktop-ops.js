(()=>{
'use strict';
const $=s=>document.querySelector(s);
function setStatus(message){const el=$('#workStatus');if(el)el.textContent=message}
function labelFor(f,folders,root){
  if(!f)return root;
  let current=f;const parts=[],seen=new Set();
  while(current&&!seen.has(current.id)){
    seen.add(current.id);parts.unshift(current.name);
    current=folders.find(p=>p.id===current.parent_id);
  }
  return parts.join(' / ');
}
function chooseTarget(folders,root,excludedId=null){
  const choices=[null,...folders.filter(f=>f.id!==excludedId)];
  const description=choices.map((f,i)=>`${i} · ${labelFor(f,folders,root)}`).join('\n');
  const answer=window.prompt('Zielordner wählen (Nummer):\n'+description);
  if(answer===null)return undefined;
  const n=Number(answer.trim());
  if(!Number.isInteger(n)||n<0||n>=choices.length){
    setStatus('Ungültige Ordnernummer.');return undefined;
  }
  return choices[n]?.id||null;
}
async function enhance({sb,folders,files,refresh,projectName,office=false,projectId=null}){
  const folderTable=office?'office_project_folders':'minds_work_folders';
  const fileTable=office?'office_project_files':'minds_work_files';
  const fileNameField=office?'file_name':'name';
  const label=item=>item?.[fileNameField]||item?.name||'Datei';
  if(!sb)return;
  const {data:sessionData}=await sb.auth.getSession();
  const userId=sessionData?.session?.user?.id;
  if(!userId)return;
  // All active Office employees can manage shared files and folders, as on
  // the existing shared Windows drive. The DB and Storage policies enforce it.
  const canManage=()=>true;
  async function update(table,item,patch,errorMessage,successMessage){
    if(!item)return;
    let query=sb.from(table).update(patch).eq('id',item.id);
    if(office&&projectId)query=query.eq('project_id',projectId);
    const {data,error}=await query.select('id');
    if(error||!data?.length){setStatus(errorMessage);return}
    await refresh();setStatus(successMessage);
  }
  async function rename(table,item){
    const original=table===fileTable?label(item):item.name;
    const name=window.prompt('Neuer Name:',original);
    if(name===null||name.trim()===original)return;
    if(!name.trim()){setStatus('Bitte einen Namen eingeben.');return}
    await update(table,item,{[table===fileTable?fileNameField:'name']:name.trim()},'Umbenennen fehlgeschlagen.','Umbenannt.');
  }
  async function move(table,item){
    const folderMove=table===folderTable;
    const target=chooseTarget(folders,projectName,folderMove?item.id:null);
    if(target===undefined)return;
    if(folderMove){
      const descendants=new Set([item.id]);
      let changed=true;
      while(changed){
        changed=false;
        for(const folder of folders)if(descendants.has(folder.parent_id)&&!descendants.has(folder.id)){
          descendants.add(folder.id);changed=true;
        }
      }
      if(target&&descendants.has(target)){
        setStatus('Ordner können nicht in ihre Unterordner verschoben werden.');return;
      }
    }
    await update(table,item,{[folderMove?'parent_id':'folder_id']:target},
      'Verschieben fehlgeschlagen.','Verschoben.');
  }
  async function removeFolder(item){
    if(!window.confirm('Leeren Ordner „'+item.name+'“ endgültig löschen?'))return;
    let request=sb.from(folderTable).delete().eq('id',item.id);
    if(office&&projectId)request=request.eq('project_id',projectId);
    const {data,error}=await request.select('id');
    if(error||!data?.length){setStatus('Ordner konnte nicht gelöscht werden. Er muss leer sein.');return}
    await refresh();setStatus('Ordner gelöscht.');
  }
  async function removeFile(item){
    if(!window.confirm('Datei „'+label(item)+'“ endgültig löschen?'))return;
    const removed=await sb.storage.from('minds-work').remove([item.storage_path]);
    if(removed.error){setStatus('Datei konnte nicht gelöscht werden.');return}
    let request=sb.from(fileTable).delete().eq('id',item.id);
    if(office&&projectId)request=request.eq('project_id',projectId);
    const {data,error}=await request.select('id');
    if(error||!data?.length){
      setStatus('Datei entfernt; das Register konnte nicht aktualisiert werden. Bitte erneut versuchen.');return;
    }
    await refresh();setStatus('Datei gelöscht.');
  }
  function addActions(tile,item,isFolder){
    if(!tile)return;
    const wrapper=document.createElement('div');
    wrapper.className='office-desktop-item';
    tile.parentNode.insertBefore(wrapper,tile);wrapper.appendChild(tile);
    if(!canManage(item))return;
    const actions=document.createElement('div');
    actions.className='office-desktop-actions';
    const create=(name,callback)=>{
      const button=document.createElement('button');
      button.type='button';button.textContent=name;
      button.setAttribute('aria-label',name+' · '+(isFolder?item.name:label(item)));
      button.addEventListener('click',()=>void callback());
      actions.appendChild(button);
    };
    const table=isFolder?folderTable:fileTable;
    create('Umbenennen',()=>rename(table,item));
    create('Verschieben',()=>move(table,item));
    create('Löschen',()=>isFolder?removeFolder(item):removeFile(item));
    wrapper.appendChild(actions);
  }
  for(const tile of document.querySelectorAll(office?'#workBody [data-office-work^="folder:"]':'#workBody [data-work-folder]')){
    const id=office?tile.dataset.officeWork.slice('folder:'.length):tile.dataset.workFolder;
    const item=folders.find(f=>f.id===id);
    if(item)addActions(tile,item,true);
  }
  for(const tile of document.querySelectorAll(office?'#workBody [data-office-work^="download:"]':'#workBody [data-work-file]')){
    const id=office?tile.dataset.officeWork.slice('download:'.length):tile.dataset.workFile;
    const item=files.find(f=>f.id===id);
    if(item)addActions(tile,item,false);
  }
}
window.TBA_OFFICE_DESKTOP={enhance};
})();
