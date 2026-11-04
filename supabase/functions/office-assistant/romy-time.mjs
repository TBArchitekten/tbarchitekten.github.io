// Pure timezone utilities for Romy's Office calendar.
// All calendar dates are Europe/Berlin, including DST transition days.
const ZONE="Europe/Berlin";
const offsetFormatter=new Intl.DateTimeFormat("en-US",{timeZone:ZONE,timeZoneName:"longOffset"});
export function validOfficeDate(s){
 if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const [y,m,d]=s.split("-").map(Number);
 if(y<1900||y>9999)return false;
 return new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)===s;
}
function offsetMinutesAt(instant){
 const raw=offsetFormatter.formatToParts(instant).find(p=>p.type==="timeZoneName")?.value||"";
 const match=/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(raw);
 if(!match)throw new Error("office_timezone_offset_unavailable");
 return (match[1]==="+"?1:-1)*(Number(match[2])*60+Number(match[3]||0));
}
export function berlinMidnightUtc(day){
 if(!validOfficeDate(day))throw new Error("invalid_office_date");
 const [y,m,d]=day.split("-").map(Number);
 const approx=Date.UTC(y,m-1,d);
 return new Date(approx-offsetMinutesAt(new Date(approx))*60000).toISOString();
}
export function berlinDateRangeUtc(from,to){
 if(!validOfficeDate(from)||!validOfficeDate(to)||from>to)throw new Error("invalid_office_date_range");
 const next=new Date(Date.parse(to+"T00:00:00Z")+24*60*60*1000).toISOString().slice(0,10);
 return {start:berlinMidnightUtc(from),endExclusive:berlinMidnightUtc(next),timezone:ZONE};
}
export function officeLocalNow(){
 return new Intl.DateTimeFormat("sv-SE",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date());
}
export function parseExplicitZonedInstant(value){
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
 if(!validOfficeDate(value.slice(0,10)))return null;
 const instant=Date.parse(value);
 return Number.isFinite(instant)?new Date(instant).toISOString():null;
}
