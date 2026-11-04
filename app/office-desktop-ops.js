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
async function enhance({sb,folders,files,refresh,projectName}){
  if(!sb)return;
  const {data:sessionData}=await sb.auth.getSession();
  const userId=sessionData?.session?.user?.id;
  if(!userId)return;
  const {data:member}=await sb.from('office_members').select('role').eq('user_id',userId).maybeSingle();
  const canManage=item=>item?.user_id===userId||member?.role==='admin';
  async function update(table,item,patch,errorMessage,successMessage){
    if(!item)return;
    const {data,error}=await sb.from(table).update(patch).eq('id',item.id).select('id');
    if(error||!data?.length){setStatus(errorMessage);return}
    await refresh();setStatus(successMessage);
  }
  async function rename(table,item){
    const name=window.prompt('Neuer Name:',item.name);
    if(name===null||name.trim()===item.name)return;
    if(!name.trim()){setStatus('Bitte einen Namen eingeben.');return}
    await update(table,item,{name:name.trim()},'Umbenennen fehlgeschlagen.','Umbenannt.');
  }
  async function move(table,item){
    const folderMove=table==='minds_work_folders';
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
    const {data,error}=await sb.from('minds_work_folders').delete().eq('id',item.id).select('id');
    if(error||!data?.length){setStatus('Ordner konnte nicht gelöscht werden. Er muss leer sein.');return}
    await refresh();setStatus('Ordner gelöscht.');
  }
  async function removeFile(item){
    if(!window.confirm('Datei „'+item.name+'“ endgültig löschen?'))return;
    const removed=await sb.storage.from('minds-work').remove([item.storage_path]);
    if(removed.error){setStatus('Datei konnte nicht gelöscht werden.');return}
    const {data,error}=await sb.from('minds_work_files').delete().eq('id',item.id).select('id');
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
      button.setAttribute('aria-label',name+' · '+item.name);
      button.addEventListener('click',()=>void callback());
      actions.appendChild(button);
    };
    const table=isFolder?'minds_work_folders':'minds_work_files';
    create('Umbenennen',()=>rename(table,item));
    create('Verschieben',()=>move(table,item));
    create('Löschen',()=>isFolder?removeFolder(item):removeFile(item));
    wrapper.appendChild(actions);
  }
  for(const tile of document.querySelectorAll('#workBody [data-work-folder]')){
    const item=folders.find(f=>f.id===tile.dataset.workFolder);
    if(item)addActions(tile,item,true);
  }
  for(const tile of document.querySelectorAll('#workBody [data-work-file]')){
    const item=files.find(f=>f.id===tile.dataset.workFile);
    if(item)addActions(tile,item,false);
  }
}
window.TBA_OFFICE_DESKTOP={enhance};
})();
