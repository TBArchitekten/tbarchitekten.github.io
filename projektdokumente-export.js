/* TBA Office · Projektdokumente · Ausgabe als Excel und Word (24.11.2026, Claude, Auftrag Gari).
   Ohne Bibliothek: .xlsx und .docx sind ZIP-Archive mit XML. Gespeichert wird unkomprimiert (Methode 0), das lesen
   Excel, Word, LibreOffice und kosten-import.js. Rein und ohne DOM, im Browser und in Node prüfbar.
   Excel im Aufbau der Bürovorlage (Titel, Projektzeile, Kopf in Zeile 6, Daten ab Zeile 7, «überfällig» als Formel mit
   dem Wert von heute, Auswahllisten, Filter, fixierte Spalten). Word im Aufbau der Entscheidungsvorlage, A4, Arial 11 pt.
   Weitere Listen (28.11.2026): ein Termin steht wie in der Vorlage als Meilenstein mit der Spalte «Datum» daneben, das
   Datum aus dem Terminplan des Projekts; die Schnittstellenmatrix mit den Gruppenzeilen und der Legende. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.TBA_PROJEKTDOKUMENTE_EXPORT=api;
})(typeof self!=='undefined'?self:this,function(){
'use strict';

const enc=new TextEncoder();
const esc=t=>String(t??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g,'')
  .replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const XML='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// ---------- ZIP ----------
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function dosZeit(d){
  return {zeit:(d.getHours()<<11)|(d.getMinutes()<<5)|Math.floor(d.getSeconds()/2),
    datum:((Math.max(1980,d.getFullYear())-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()};
}
function zip(dateien,jetzt=new Date()){
  const {zeit,datum}=dosZeit(jetzt);
  const teile=[],zentral=[];let pos=0;
  for(const f of dateien){
    const name=enc.encode(f.name),daten=typeof f.daten==='string'?enc.encode(f.daten):f.daten,crc=crc32(daten);
    const kopf=new DataView(new ArrayBuffer(30));
    kopf.setUint32(0,0x04034b50,true);kopf.setUint16(4,20,true);kopf.setUint16(6,0x0800,true);kopf.setUint16(8,0,true);
    kopf.setUint16(10,zeit,true);kopf.setUint16(12,datum,true);kopf.setUint32(14,crc,true);
    kopf.setUint32(18,daten.length,true);kopf.setUint32(22,daten.length,true);kopf.setUint16(26,name.length,true);kopf.setUint16(28,0,true);
    teile.push(new Uint8Array(kopf.buffer),name,daten);
    const z=new DataView(new ArrayBuffer(46));
    z.setUint32(0,0x02014b50,true);z.setUint16(4,20,true);z.setUint16(6,20,true);z.setUint16(8,0x0800,true);z.setUint16(10,0,true);
    z.setUint16(12,zeit,true);z.setUint16(14,datum,true);z.setUint32(16,crc,true);z.setUint32(20,daten.length,true);
    z.setUint32(24,daten.length,true);z.setUint16(28,name.length,true);z.setUint32(42,pos,true);
    zentral.push(new Uint8Array(z.buffer),name);
    pos+=30+name.length+daten.length;
  }
  const groesse=zentral.reduce((n,x)=>n+x.length,0);
  const ende=new DataView(new ArrayBuffer(22));
  ende.setUint32(0,0x06054b50,true);ende.setUint16(8,dateien.length,true);ende.setUint16(10,dateien.length,true);
  ende.setUint32(12,groesse,true);ende.setUint32(16,pos,true);
  const alle=[...teile,...zentral,new Uint8Array(ende.buffer)];
  const out=new Uint8Array(alle.reduce((n,x)=>n+x.length,0));let o=0;
  for(const x of alle){out.set(x,o);o+=x.length}
  return out;
}
function kern(titel,jetzt){
  return XML+'<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" '+
    'xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>'+esc(titel)+'</dc:title>'+
    '<dc:creator>TBA Office</dc:creator><dc:language>de-DE</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">'+jetzt.toISOString().replace(/\.\d+Z$/,'Z')+
    '</dcterms:created></cp:coreProperties>';
}

// ---------- Excel ----------
function spalte(i){let t='';for(let n=i+1;n>0;n=Math.floor((n-1)/26))t=String.fromCharCode(65+(n-1)%26)+t;return t}
const S={standard:0,kopf:1,text:2,datum:3,titel:4,unter:5,formel:6,projekt:7,zahl:8};
const STYLES=XML+'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="DD.MM.YYYY"/></numFmts>'+
  '<fonts count="4"><font><sz val="9"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="9"/><name val="Arial"/><family val="2"/></font>'+
  '<font><b/><sz val="14"/><name val="Arial"/><family val="2"/></font><font><sz val="9"/><color rgb="FF595959"/><name val="Arial"/><family val="2"/></font></fonts>'+
  '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE7E6E6"/><bgColor indexed="64"/></patternFill></fill>'+
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill></fills>'+
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBFBFBF"/></left>'+
  '<right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>'+
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
  '<cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'+
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'+
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>'+
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'+
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>'+
  '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'+
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'+
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf></cellXfs>'+
  '<cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles>'+
  '<dxfs count="3"><dxf><fill><patternFill patternType="solid"><bgColor rgb="FFF8CBAD"/></patternFill></fill></dxf>'+
  '<dxf><font><color rgb="FFA6A6A6"/></font></dxf><dxf><fill><patternFill patternType="solid"><bgColor rgb="FFE4D7F5"/></patternFill></fill></dxf></dxfs>'+
  '</styleSheet>';
function zelle(ref,w,stil){
  if(w===null||w===undefined||w==='')return stil===undefined?'':'<c r="'+ref+'" s="'+stil+'"/>';
  if(typeof w==='object'&&'datum' in w){
    if(w.datum===null)return '<c r="'+ref+'" s="'+S.datum+'"/>';
    return '<c r="'+ref+'" s="'+S.datum+'"><v>'+w.datum+'</v></c>';
  }
  if(typeof w==='object'&&'formel' in w)
    return '<c r="'+ref+'" s="'+(stil??S.formel)+'" t="str"><f>'+esc(w.formel)+'</f><v>'+esc(w.wert??'')+'</v></c>';
  if(typeof w==='number')return '<c r="'+ref+'" s="'+(stil??S.zahl)+'"><v>'+w+'</v></c>';
  return '<c r="'+ref+'" s="'+(stil??S.text)+'" t="inlineStr"><is><t xml:space="preserve">'+esc(w)+'</t></is></c>';
}
// blatt: {name, titel, untertitel, projekt, hinweis, koepfe[], breiten[], zeilen[[wert]], fixiert:{spalten,zeilen},
//         auswahl:[{spalte, werte[]}], bedingt:[{bereich, formel, stil}]}
// Ein Wert ist Text, Zahl, {datum: Excel-Tag oder null} oder {formel, wert}.
function xlsx(blatt,jetzt=new Date()){
  const n=blatt.koepfe.length,kopfZeile=6,erste=7,letzte=Math.max(erste,erste+blatt.zeilen.length-1);
  const name=String(blatt.name||'Liste').replace(/[[\]:*?/\\]/g,' ').slice(0,31);
  const ende=spalte(n-1);
  const reihen=[];
  reihen.push('<row r="1" ht="20" customHeight="1">'+zelle('A1',blatt.titel,S.titel)+'</row>');
  if(blatt.untertitel)reihen.push('<row r="2">'+zelle('A2',blatt.untertitel,S.unter)+'</row>');
  reihen.push('<row r="3">'+zelle('A3',blatt.projekt||'',S.projekt)+(blatt.hinweis?zelle('G3',blatt.hinweis,S.projekt):'')+'</row>');
  reihen.push('<row r="'+kopfZeile+'" ht="40" customHeight="1">'+blatt.koepfe.map((k,i)=>zelle(spalte(i)+kopfZeile,k,S.kopf)).join('')+'</row>');
  blatt.zeilen.forEach((z,j)=>{
    const r=erste+j;
    reihen.push('<row r="'+r+'">'+z.map((w,i)=>zelle(spalte(i)+r,w,w===''||w===null||w===undefined?S.text:undefined)).join('')+'</row>');
  });
  const fix=blatt.fixiert||{spalten:0,zeilen:kopfZeile};
  const links=spalte(fix.spalten||0)+(fix.zeilen+1);
  const pane='<pane '+(fix.spalten?'xSplit="'+fix.spalten+'" ':'')+'ySplit="'+fix.zeilen+'" topLeftCell="'+links+'" activePane="'+(fix.spalten?'bottomRight':'bottomLeft')+'" state="frozen"/>';
  const cols='<cols>'+blatt.breiten.map((b,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+b+'" customWidth="1"/>').join('')+'</cols>';
  const bedingt=(blatt.bedingt||[]).map((b,i)=>'<conditionalFormatting sqref="'+b.bereich.replace('{letzte}',letzte)+'"><cfRule type="expression" dxfId="'+b.stil+'" priority="'+(i+1)+'"><formula>'+esc(b.formel)+'</formula></cfRule></conditionalFormatting>').join('');
  const auswahl=(blatt.auswahl||[]).filter(a=>a.werte.join(',').length<250);
  const pruefung=auswahl.length?'<dataValidations count="'+auswahl.length+'">'+auswahl.map(a=>'<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="'+
    a.spalte+erste+':'+a.spalte+letzte+'"><formula1>"'+esc(a.werte.join(','))+'"</formula1></dataValidation>').join('')+'</dataValidations>':'';
  const sheet=XML+'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:'+ende+letzte+'"/>'+
    '<sheetViews><sheetView workbookViewId="0">'+pane+'</sheetView></sheetViews><sheetFormatPr defaultRowHeight="12.75"/>'+cols+
    '<sheetData>'+reihen.join('')+'</sheetData><autoFilter ref="A'+kopfZeile+':'+ende+letzte+'"/>'+bedingt+pruefung+
    '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>'+
    '<pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
  const quote="'"+name.replace(/'/g,"''")+"'";
  const workbook=XML+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
    '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16000"/></bookViews>'+
    '<sheets><sheet name="'+esc(name)+'" sheetId="1" r:id="rId1"/></sheets><definedNames>'+
    '<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'+esc(quote)+'!$A$'+kopfZeile+':$'+ende+'$'+letzte+'</definedName>'+
    '<definedName name="_xlnm.Print_Titles" localSheetId="0">'+esc(quote)+'!$'+kopfZeile+':$'+kopfZeile+'</definedName></definedNames>'+
    '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>';
  return zip([
    {name:'[Content_Types].xml',daten:XML+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'},
    {name:'_rels/.rels',daten:XML+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'+
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'},
    {name:'docProps/core.xml',daten:kern(blatt.titel,jetzt)},
    {name:'xl/workbook.xml',daten:workbook},
    {name:'xl/_rels/workbook.xml.rels',daten:XML+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'xl/styles.xml',daten:STYLES},
    {name:'xl/worksheets/sheet1.xml',daten:sheet}
  ],jetzt);
}

// ---------- Word ----------
const BREITE=9354; // A4 21 cm minus 2,5 cm links und 2 cm rechts, in Twips
const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const WSTYLES=XML+'<w:styles '+W+'><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>'+
  '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="de-DE"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'+
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'+
  '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="80"/></w:pPr>'+
  '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>'+
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>'+
  '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>'+
  '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr>'+
  '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>'+
  '<w:style w:type="paragraph" w:styleId="Untertitel"><w:name w:val="Untertitel"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="240"/></w:pPr><w:rPr><w:color w:val="595959"/></w:rPr></w:style>'+
  '<w:style w:type="paragraph" w:styleId="Klein"><w:name w:val="Klein"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>'+
  '</w:styles>';
function lauf(text,{fett=false}={}){
  const teile=String(text??'').split('\n');
  const rpr=fett?'<w:rPr><w:b/></w:rPr>':'';
  return teile.map((t,i)=>(i?'<w:r>'+rpr+'<w:br/></w:r>':'')+'<w:r>'+rpr+'<w:t xml:space="preserve">'+esc(t)+'</w:t></w:r>').join('');
}
function absatz(text,{stil='',fett=false,rechts=false,umbruch=false,abstand=null}={}){
  const ppr=(stil?'<w:pStyle w:val="'+stil+'"/>':'')+(umbruch?'<w:pageBreakBefore/>':'')+(abstand!==null?'<w:spacing w:before="0" w:after="'+abstand+'"/>':'')+(rechts?'<w:jc w:val="right"/>':'');
  return '<w:p>'+(ppr?'<w:pPr>'+ppr+'</w:pPr>':'')+lauf(text,{fett})+'</w:p>';
}
const RAND=(seiten,farbe='BFBFBF')=>seiten.map(s=>'<w:'+s+' w:val="single" w:sz="4" w:space="0" w:color="'+farbe+'"/>').join('');
function tabelle({kopf=null,zeilen,breiten,rechts=[],ohneRand=false,fettErste=false}){
  const summe=breiten.reduce((a,b)=>a+b,0);
  const tw=breiten.map(b=>Math.round(b/summe*BREITE));tw[tw.length-1]+=BREITE-tw.reduce((a,b)=>a+b,0);
  const rand=ohneRand?'':'<w:tblBorders>'+RAND(['top','left','bottom','right','insideH','insideV'])+'</w:tblBorders>';
  const zelleW=(t,i,{kopfZeile=false}={})=>'<w:tc><w:tcPr><w:tcW w:w="'+tw[i]+'" w:type="dxa"/>'+(kopfZeile?'<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>':'')+'</w:tcPr>'+
    absatz(t,{fett:kopfZeile||(fettErste&&i===0),rechts:rechts.includes(i)&&!kopfZeile,abstand:0})+'</w:tc>';
  const reihen=(kopf?['<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>'+kopf.map((t,i)=>zelleW(t,i,{kopfZeile:true})).join('')+'</w:tr>']:[])
    .concat(zeilen.map(z=>'<w:tr><w:trPr><w:cantSplit/></w:trPr>'+z.map((t,i)=>zelleW(t,i)).join('')+'</w:tr>'));
  return '<w:tbl><w:tblPr><w:tblW w:w="'+BREITE+'" w:type="dxa"/>'+rand+'<w:tblLayout w:type="fixed"/>'+
    '<w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>'+
    '<w:tblGrid>'+tw.map(w=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>'+reihen.join('')+'</w:tbl>'+absatz('',{abstand:60});
}
function unterschrift(links,rechts){
  const zelle=(t,w,mitLinie)=>'<w:tc><w:tcPr><w:tcW w:w="'+w+'" w:type="dxa"/>'+(mitLinie?'<w:tcBorders>'+RAND(['bottom'],'7F7F7F')+'</w:tcBorders>':'')+'</w:tcPr>'+
    (mitLinie?'<w:p><w:pPr><w:spacing w:before="560" w:after="0"/></w:pPr></w:p>':absatz(t,{stil:'Klein',abstand:0}))+'</w:tc>';
  const a=Math.round(BREITE*0.35),l=Math.round(BREITE*0.08),b=BREITE-a-l;
  return '<w:tbl><w:tblPr><w:tblW w:w="'+BREITE+'" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="'+a+'"/><w:gridCol w:w="'+l+'"/><w:gridCol w:w="'+b+'"/></w:tblGrid>'+
    '<w:tr><w:trPr><w:cantSplit/></w:trPr>'+zelle('',a,true)+zelle('',l,false)+zelle('',b,true)+'</w:tr>'+
    '<w:tr><w:trPr><w:cantSplit/></w:trPr>'+zelle(links,a,false)+zelle('',l,false)+zelle(rechts,b,false)+'</w:tr></w:tbl>'+absatz('',{abstand:60});
}
// bloecke wie TBA_PROJEKTDOKUMENTE.vorlageBloecke; fusszeile steht links unten, rechts die Seitenzahl.
function docx({titel,bloecke,fusszeile=''},jetzt=new Date()){
  const body=bloecke.map(b=>{
    if(b.typ==='titel')return absatz(b.text,{stil:'Title'});
    if(b.typ==='unter')return absatz(b.text,{stil:'Untertitel'});
    if(b.typ==='h1')return absatz(b.text,{stil:'Heading1',umbruch:!!b.seitenumbruch});
    if(b.typ==='h2')return absatz(b.text,{stil:'Heading2'});
    if(b.typ==='klein')return absatz(b.text,{stil:'Klein'});
    if(b.typ==='felder')return tabelle({zeilen:b.zeilen,breiten:[30,70],fettErste:true});
    if(b.typ==='tabelle')return tabelle({kopf:b.kopf,zeilen:b.zeilen,breiten:b.breiten,rechts:b.rechts||[]});
    if(b.typ==='auswahl')return b.zeilen.map(t=>absatz('☐  '+t)).join('');
    if(b.typ==='unterschrift')return unterschrift(b.links,b.rechts);
    return absatz(b.text);
  }).join('');
  const feld=c=>'<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> '+c+' </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
  const footer=XML+'<w:ftr '+W+'><w:p><w:pPr><w:pStyle w:val="Klein"/></w:pPr><w:r><w:t xml:space="preserve">'+esc(fusszeile)+'</w:t></w:r>'+
    '<w:r><w:ptab w:relativeTo="margin" w:alignment="right" w:leader="none"/></w:r><w:r><w:t xml:space="preserve">Seite </w:t></w:r>'+feld('PAGE')+
    '<w:r><w:t xml:space="preserve"> von </w:t></w:r>'+feld('NUMPAGES')+'</w:p></w:ftr>';
  const document=XML+'<w:document '+W+'><w:body>'+body+'<w:sectPr><w:footerReference w:type="default" r:id="rId2"/>'+
    '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1418" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>';
  return zip([
    {name:'[Content_Types].xml',daten:XML+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'+
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'+
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'},
    {name:'_rels/.rels',daten:XML+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'+
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'},
    {name:'docProps/core.xml',daten:kern(titel,jetzt)},
    {name:'word/document.xml',daten:document},
    {name:'word/_rels/document.xml.rels',daten:XML+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>'},
    {name:'word/styles.xml',daten:WSTYLES},
    {name:'word/footer1.xml',daten:footer}
  ],jetzt);
}

// ---------- Listen der Bürovorlage ----------
// Aus Spalten und Zeilen eines Projektdokuments (TBA_PROJEKTDOKUMENTE) das Blatt wie in LPH3_3_Koordination.xlsx.
const FIXIERT={klaerungsliste:6,entscheidungsliste:3,fachplanerbedarf:2,schnittstellen:2,fragenliste:4,eingang:1};
function listenBlatt(K,art,zeilen,{projekt='',heute=K.heuteIso()}={}){
  if(K.WEITERE&&K.WEITERE.includes(art))return weitereListe(K,art,zeilen,{projekt,heute});
  const spalten=K.SPALTEN[art],doc=K.DOKUMENTE[art];
  const ref=key=>K.SPALTEN[art].findIndex(x=>x.key===key);
  const sortiert=[...zeilen].sort((a,b)=>a.nr-b.nr);
  const werte=sortiert.map((z,j)=>{
    const d=z.daten||{},r=7+j;
    return spalten.map(sp=>{
      if(sp.key==='nr')return art==='klaerungsliste'?z.nr:K.nummer(art,z.nr);
      if(sp.typ==='datum')return {datum:K.excelTag(d[sp.key])};
      if(sp.key==='ueberfaellig'){
        const f=spalte(ref(art==='klaerungsliste'?'frist':'bis'))+r,st=spalte(ref('status'))+r;
        const fertig=art==='klaerungsliste'?['gelöst','entfällt']:['entschieden','entfällt'];
        return {formel:'IF(OR('+f+'="",'+st+'="'+fertig[0]+'",'+st+'="'+fertig[1]+'"),"",IF('+f+'<TODAY(),"überfällig",""))',wert:K.ueberfaellig(art,d,heute)?'überfällig':''};
      }
      return K.zellText(art,sp.key,d,{nr:z.nr,heute});
    });
  });
  const z=K.zaehle(art,zeilen,heute);
  const st=spalte(ref('status')),ue=spalte(ref('ueberfaellig'));
  const auswahl=[{spalte:st,werte:art==='klaerungsliste'?K.STATUS_KLAERUNG:K.STATUS_ENTSCHEIDUNG}];
  if(art==='klaerungsliste')auswahl.push({spalte:spalte(ref('runde')),werte:K.RUNDEN},{spalte:spalte(ref('ag')),werte:K.JA_NEIN});
  const bedingt=[{bereich:ue+'7:'+ue+'{letzte}',formel:ue+'7="überfällig"',stil:0},
    {bereich:'A7:'+spalte(spalten.length-2)+'{letzte}',formel:'OR($'+st+'7="'+(art==='klaerungsliste'?'gelöst':'entschieden')+'",$'+st+'7="entfällt")',stil:1}];
  if(art==='klaerungsliste'){const ag=spalte(ref('ag'));bedingt.push({bereich:ag+'7:'+ag+'{letzte}',formel:ag+'7="ja"',stil:2})}
  return {name:doc.kurz,titel:doc.titel,untertitel:doc.untertitel,projekt,
    hinweis:'Stand '+K.datumLang(heute)+': '+K.zusammenfassung(art,z),
    koepfe:spalten.map(sp=>sp.kopf),breiten:spalten.map(sp=>sp.breite),zeilen:werte,
    fixiert:{spalten:FIXIERT[art]||0,zeilen:6},auswahl,bedingt};
}
// Fachplanerbedarf, Schnittstellen, Fragenliste und Eingang: Spalten der Vorlage; ein Termin mit «datumSpalte» wird zu
// zwei Spalten (Meilenstein und Datum), sonst steht das Datum selbst. Berechnete Spalten mit ihrem Wert von heute.
function weitereListe(K,art,zeilen,{projekt,heute}){
  const doc=K.DOKUMENTE[art],spalten=[];
  for(const sp of K.SPALTEN[art]){
    spalten.push({sp,teil:'wert',kopf:sp.kopf,breite:sp.breite});
    if(sp.typ==='meilenstein'&&sp.datumSpalte)spalten.push({sp,teil:'datum',kopf:'Datum',breite:11});
  }
  const zahlNr=['fachplanerbedarf','schnittstellen'].includes(art);
  const wert=(c,z)=>{
    const sp=c.sp,d=z.daten||{},v=String(d[sp.key]??'').trim();
    if(sp.key==='nr')return zahlNr?z.nr:K.nummer(art,z.nr,d);
    if(sp.typ==='datum')return {datum:K.excelTag(d[sp.key])};
    if(sp.typ==='meilenstein'){
      const code=K.istMeilenstein(v)?v:'',iso=K.terminVon(v);
      if(c.teil==='wert'&&sp.datumSpalte)return code;
      if(!v)return '';
      if(iso)return {datum:K.excelTag(iso)};
      return sp.datumSpalte?K.terminFehlt(v):code+' (Datum fehlt)';
    }
    return K.zellText(art,sp.key,d,{nr:z.nr,heute});
  };
  let sortiert=[...zeilen].sort((a,b)=>a.nr-b.nr);
  const werte=[];
  if(art==='schnittstellen'){
    // Gruppen in der Reihenfolge ihres ersten Auftretens, Zeilen ohne Gruppe am Ende, wie im Blatt der Vorlage.
    const reihe=[];for(const z of sortiert){const g=String(z.daten?.gruppe||'');if(!reihe.includes(g))reihe.push(g)}
    reihe.sort((a,b)=>(a===''?1:0)-(b===''?1:0));
    for(const g of reihe){
      werte.push([g||'Weitere']);
      for(const z of sortiert.filter(x=>String(x.daten?.gruppe||'')===g))werte.push(spalten.map(c=>wert(c,z)));
    }
  }else for(const z of sortiert)werte.push(spalten.map(c=>wert(c,z)));
  const auswahl=[];
  spalten.forEach((c,i)=>{
    if(c.teil!=='wert')return;
    if(['auswahl','zustaendigkeit'].includes(c.sp.typ)&&Array.isArray(c.sp.werte))auswahl.push({spalte:spalte(i),werte:c.sp.werte});
    // Meilenstein mit eigener Datumsspalte: Auswahl der Codes wie in der Vorlage.
    if(c.sp.typ==='meilenstein'&&c.sp.datumSpalte)auswahl.push({spalte:spalte(i),werte:K.MEILENSTEINE.map(m=>m[0])});
  });
  const z=K.zaehle(art,zeilen,heute);
  const legende=art==='schnittstellen'?' · '+K.LEGENDE.map(([k,t])=>k+' '+t).join(' · '):'';
  return {name:doc.kurz,titel:doc.titel,untertitel:doc.untertitel,projekt,
    hinweis:'Stand '+K.datumLang(heute)+': '+K.zusammenfassung(art,z)+legende,
    koepfe:spalten.map(c=>c.kopf),breiten:spalten.map(c=>c.breite),zeilen:werte,
    fixiert:{spalten:FIXIERT[art]||0,zeilen:6},auswahl,bedingt:[]};
}

return Object.freeze({crc32,zip,xlsx,docx,listenBlatt,spalte});
});
