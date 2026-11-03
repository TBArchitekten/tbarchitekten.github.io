// Pure rules for member administration (tested in tests/office-admin.test.mjs).
export const ROLES=Object.freeze(['admin','projektleiter','member']);

export function validEmail(email,domain){
  const value=String(email||'').trim().toLowerCase();
  if(value.length>120)return false;
  const match=/^[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})$/.exec(value);
  return !!match&&match[1]===String(domain||'').toLowerCase();
}
export function validName(name){
  const value=String(name||'').trim();
  return value.length>=1&&value.length<=80&&!/[<>]/.test(value);
}
export function validRole(role){return ROLES.includes(String(role))}

// Readable start password: three groups without look-alike characters (no 0/O, 1/l/I).
const ALPHABET='abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function startPassword(random=n=>crypto.getRandomValues(new Uint8Array(n))){
  const groups=[];
  for(let g=0;g<3;g++){
    let part='';
    // Rejection sampling keeps every character equally likely.
    while(part.length<4){for(const b of random(8)){if(b<ALPHABET.length*4&&part.length<4)part+=ALPHABET[b%ALPHABET.length]}}
    groups.push(part);
  }
  return groups.join('-');
}

// Returns an error code when a change would leave the office without an active admin
// or let an admin lock themselves out; null when the change is allowed.
export function lastAdminGuard({target,patch,callerId,activeAdmins}){
  const losesAdmin=target.role==='admin'&&target.is_active&&((patch.role!==undefined&&patch.role!=='admin')||patch.is_active===false);
  if(losesAdmin&&target.user_id===callerId)return 'cannot_demote_self';
  if(losesAdmin&&activeAdmins<=1)return 'last_admin';
  return null;
}
