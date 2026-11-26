(()=>{'use strict';
// TBA Office · Leitfaden «Was darf ins TBA Office?» (25.11.2026, Claude; Wunsch von Gari am 25.11.2026; bis 26.11.2026
// «Was darf auf den Desktop?»: die KI liest nicht nur den Desktop, sondern alles, was ins Office kommt, Gari 26.11.2026).
// Wer das Office öffnet, liest den freigeschalteten Leitfaden einmal und bestätigt mit «Gelesen». Die Bestätigung
// (Person, Stand, Zeit) steht in office_leitfaden_bestaetigungen; die Admins sehen sie in «Mitglieder». Danach steht
// der Leitfaden im Desktop jedes Projekts zum Nachlesen. Ob er gezeigt wird und welcher Stand gilt, sagt
// office_leitfaeden; freigeschaltet wird in «Mitglieder». Der Text steht hier, je Stand: kennt das Office einen Stand
// nicht, zeigt es nichts. Fehlt die Tabelle oder geht etwas schief, bleibt das Office benutzbar.
// Im öffentlichen Repository stehen keine Namen: die Fassung für die Büroleitung nennt die Person, die die Konten
// führt; hier steht nur, dass sie auf das Büro laufen.
const sb=window.MINDS_SUPABASE;
const LEITFADEN='desktop';
const TEXTE={
  '2026-11-26':{
    titel:'Was darf ins TBA Office?',
    stand:'26.11.2026',
    bloecke:[
      {h:'Kurz gesagt'},
      {p:'Was wir ins TBA Office hochladen oder dort schreiben, kann eine KI lesen, damit wir ihr Fragen zum Projekt stellen können. So ist es eingerichtet:'},
      {punkte:[
        ['Gemeinsam und geschützt:','Die Daten liegen auf einem Server in Frankfurt. Was zu einem Projekt gehört, sieht nur dessen Team.'],
        ['Die KI:','Was ins Office kommt, kann die KI lesen, Dateien automatisch nach wenigen Minuten. Dafür geht der Text an ein KI-Modell von OpenAI.'],
        ['Kein Training:','OpenAI arbeitet nur im Auftrag des Büros und trainiert mit unseren Daten keine Modelle.'],
        ['Im Namen des Büros:','Die Konten bei OpenAI und Supabase laufen auf das Büro.']]},
      {p:'Für alle gilt eine einfache Regel: Grün hochladen, Gelb nur das Nötige, Rot nie.'},
      {h:'Grün: hochladen',ton:'gruen'},
      {p:'Fast alles, was im Projekt entsteht oder ins Projekt kommt, darf ins Office, auch wenn Namen, Unterschriften oder Preise anderer Büros darin stehen.'},
      {tabelle:{spalten:['Was','Warum es geht','Achten auf'],zeilen:[
        ['Pläne, Modelle, Baubeschreibung, LV, Terminpläne','Projektarbeit, kaum Daten über Personen','–'],
        ['Unterlagen der Fachplaner, auch mit Namen und Unterschrift','Sie wurden uns für dieses Projekt gegeben; das Office nutzt sie für dieses Projekt. Namen sind berufliche Kontaktdaten, die wir ohnehin verarbeiten.','Vermerke wie «vertraulich» oder «nicht zur Weitergabe»: dann Gelb'],
        ['Protokolle mit Teilnehmern und Verteiler','Wie oben: berufliche Kontaktdaten, gebraucht für das Projekt. Dieselben Protokolle liegen schon auf Server und Mail.','Private Bemerkungen über Personen gehören nicht ins Protokoll'],
        ['Kostenberechnungen, Angebote, Honorare und Preise anderer Büros und Firmen','Daten von Firmen schützt die DSGVO nicht. Sie sind vertraulich: im Projekt nutzen ja, nach außen geben nein. Was zum Projekt gehört, bleibt im Projektteam; OpenAI verarbeitet nur in unserem Auftrag.','Angebote aus einer laufenden öffentlichen Vergabe: Gelb'],
        ['Bescheide und Schreiben von Behörden','Gehören zur Akte des Projekts; Name und Adresse des Bauherrn sind für das Projekt nötig','Anlagen mit Nachbardaten: Gelb'],
        ['Produktdatenblätter, Prospekte, Zulassungen','Öffentliche Informationen der Hersteller','–'],
        ['Baustellenfotos ohne erkennbare Personen','Zeigen den Bau, nicht Menschen','Gesichter, Kennzeichen: Gelb'],
        ['Projekt-E-Mails','Geschäftliche Korrespondenz zum Projekt','Privates im Text: Gelb']]}},
      {fett:'Warum Namen kein Hindernis sind.',p:'Drei Regeln tragen das:'},
      {nummern:[
        'Namen und Kontaktdaten von Menschen sind personenbezogen, auch im Beruf. Das Büro darf sie für das Projekt verarbeiten, weil Vertrag und Projektabwicklung es brauchen. Das tut es heute schon in Mail, Server und Verteiler.',
        'OpenAI und der Speicher in Frankfurt arbeiten als Auftragsverarbeiter, im Auftrag und nach Weisung des Büros. Ein Auftragsverarbeiter ist rechtlich kein «Dritter»: Es braucht keine eigene Erlaubnis für die Weitergabe. Es braucht aber einen Vertrag nach Art. 28 DSGVO und einen Hinweis in der Datenschutzinformation. Diesen Vertrag muss niemand aushandeln: OpenAI und Supabase, der Anbieter des Speichers, haben ihn fest in ihren Bedingungen. Er gilt mit dem Konto des Büros.',
        'Daten von Firmen, etwa Preise, Honorare oder Angebote eines Büros, fallen nicht unter die DSGVO. Sie sind Geschäftsinformationen, die wir vertraulich behandeln, aber für das Projekt nutzen dürfen.']},
      {h:'Gelb: nur das Nötige, vorher prüfen',ton:'gelb'},
      {p:'Diese Unterlagen dürfen ins Office, aber nur so weit, wie das Projekt sie braucht. Vorher prüfen, kürzen oder schwärzen.'},
      {tabelle:{spalten:['Was','Warum Vorsicht','So geht es'],zeilen:[
        ['Private Daten von Bauherren: Grundbuchauszug, Finanzierung, private Mails, Familienverhältnisse','Private Personen, nicht nur Kontaktdaten','Nur was das Projekt braucht; den Rest weglassen oder schwärzen'],
        ['Daten von Nachbarn: Nachbarbeteiligung, Einwendungen, Eigentümerlisten','Personen, die nicht unsere Vertragspartner sind','Für die Genehmigung Nötiges ja, Namen schwärzen, wo es geht'],
        ['Fotos mit erkennbaren Personen oder Kennzeichen','Bilder von Menschen sind Daten über Personen','Zuschneiden oder unkenntlich machen'],
        ['Unterlagen mit Vertraulichkeitsvermerk oder unter NDA','Der Vertrag kann die Weitergabe an Dienstleister verbieten','Vertrag lesen; im Zweifel den Auftraggeber fragen'],
        ['Angebote aus einer laufenden öffentlichen Vergabe','Der öffentliche Auftraggeber muss Angebote und als vertraulich gekennzeichnete Angaben vertraulich halten (§ 5 VgV); wir arbeiten dabei in seinem Auftrag','Erst nach Freigabe durch den Auftraggeber'],
        ['Sicherheitsdetails: Alarmanlage, Tresor, Kameras, Zugangskonzept','Missbrauchsgefahr, vor allem bei Privathäusern','Pläne ja, Codes und Zugangsdaten nie'],
        ['Streitfälle: Anwaltsschreiben, Mängel mit Schuldzuweisung','Bewertungen von Personen, laufende Verfahren','Die Büroleitung entscheidet']]}},
      {h:'Rot: nicht hochladen',ton:'rot'},
      {p:'Diese Unterlagen gehören nicht ins Office, auch nicht kurz oder in einer Nachricht: Die KI würde sie lesen, und der Text ginge an OpenAI.'},
      {tabelle:{spalten:['Was','Warum nicht'],zeilen:[
        ['Personalunterlagen, Gehälter, Bewerbungen, Arbeitszeiten einzelner Personen','Daten von Beschäftigten, für die Projektarbeit nicht nötig'],
        ['Ausweise, Bankverbindungen, Steuernummern, Kreditkarten','Hohe Missbrauchsgefahr, für die Projektarbeit nicht nötig'],
        ['Gesundheitsdaten, etwa die Diagnose hinter einem barrierefreien Bad','Besonders geschützt (Art. 9 DSGVO). Für das Projekt reicht die Anforderung, etwa «rollstuhlgerecht»'],
        ['Passwörter, Zugangsdaten, Codes von Schließanlagen','Gehören in keinen Ordner'],
        ['DIN-Normen und andere gekaufte Normen, Richtlinien und Fachbücher','Lizenz: DIN Media erlaubt derzeit nicht, Normen in KI-Systemen zu nutzen; dafür gibt es eine eigene KI-Lizenz. Stattdessen Norm und Abschnitt nennen'],
        ['Unterlagen, die der Auftraggeber nur auf Papier oder nur in eigenen Systemen will','Vertrag geht vor']]}},
      {h:'Gut zu wissen'},
      {punkte:[
        [null,'OpenAI bewahrt Anfragen höchstens 30 Tage zur Missbrauchskontrolle auf und löscht sie dann. Zum Training werden sie nicht verwendet.'],
        [null,'Bis die europäische Option bei OpenAI freigeschaltet ist, kann die Verarbeitung auch in den USA stattfinden. Das deckt der Vertrag mit OpenAI ab.'],
        [null,'Was Rot ist, bleibt Rot, auch ohne Training.']]},
      {h:'Im Zweifel'},
      {p:'Im Zweifel nicht hochladen und die Projektleitung fragen. Ein gekürztes oder geschwärztes Dokument ist besser als keines.'},
      {p:'Diese Seite ist eine Arbeitshilfe, keine Rechtsberatung.',klein:true},
      {quellen:[
        ['OpenAI: Your data (API)','https://developers.openai.com/api/docs/guides/your-data','kein Training seit 1. März 2023, Protokolle bis 30 Tage'],
        ['OpenAI: Data Processing Addendum','https://openai.com/policies/data-processing-addendum/','OpenAI als Auftragsverarbeiter, im EWR OpenAI Ireland'],
        ['Supabase: Data Processing Addendum','https://supabase.com/legal/customer-resources/data-processing-addendum','Teil der Nutzungsbedingungen, gilt mit dem Konto'],
        ['OpenAI: Data residency','https://developers.openai.com/api/docs/guides/data-residency.md','Freischaltung, nur neue Projekte, europäischer Zugang'],
        ['DSK-Kurzpapier Nr. 13: Auftragsverarbeitung','https://lfd.niedersachsen.de/download/126580','Auftragsverarbeiter ist kein Dritter, keine weitere Rechtsgrundlage nötig'],
        ['Art. 28 DSGVO: Vertrag zur Auftragsverarbeitung','https://www.dr-datenschutz.de/auftragsverarbeitung-und-datenschutz-grundverordnung/',''],
        ['Erwägungsgrund 14 DSGVO','https://www.activemind.legal/de/gesetze/dsgvo/erwaegungsgrund-14','Daten juristischer Personen sind nicht erfasst'],
        ['§ 5 VgV: Wahrung der Vertraulichkeit','https://www.gesetze-im-internet.de/vgv_2016/__5.html',''],
        ['DIN Media: Normen in ChatGPT und KI','https://support.dinmedia.de/en/support/solutions/articles/80001170855-import-and-use-of-standards-in-chatgpt-and-ai','']]}
    ]
  }
};
const zustand={userId:null,geprueft:null,aktiv:false,version:null,bestaetigt:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const datum=iso=>{try{return new Date(iso).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}catch{return ''}};

function inhaltHtml(t){
  return t.bloecke.map(b=>{
    if(b.h)return `<h3 class="office-leitfaden-h${b.ton?' is-'+b.ton:''}">${b.ton?'<span class="office-leitfaden-ton" aria-hidden="true"></span>':''}${esc(b.h)}</h3>`;
    if(b.p!==undefined)return `<p${b.klein?' class="office-leitfaden-klein"':''}>${b.fett?`<strong>${esc(b.fett)}</strong> `:''}${esc(b.p)}</p>`;
    if(b.punkte)return `<ul>${b.punkte.map(([f,x])=>`<li>${f?`<strong>${esc(f)}</strong> `:''}${esc(x)}</li>`).join('')}</ul>`;
    if(b.nummern)return `<ol>${b.nummern.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`;
    if(b.tabelle){const sp=b.tabelle.spalten;
      return `<table><thead><tr>${sp.map(s=>`<th scope="col">${esc(s)}</th>`).join('')}</tr></thead><tbody>${b.tabelle.zeilen.map(z=>
        `<tr>${z.map((c,i)=>`<td data-spalte="${esc(sp[i])}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`}
    if(b.quellen)return `<h4>Quellen</h4><ul class="office-leitfaden-quellen">${b.quellen.map(([t,u,x])=>
      `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>${x?': '+esc(x):''}</li>`).join('')}</ul>`;
    return '';
  }).join('');
}

// pflicht: beim ersten Öffnen; schließt erst mit «Gelesen» und «Weiter» (bei einem Fehler auch mit «Später»).
function oeffnen({pflicht=false}={}){
  const t=TEXTE[zustand.version];
  if(!t||typeof document==='undefined')return null;
  document.getElementById('officeLeitfaden')?.remove();
  const d=document.createElement('dialog');
  d.id='officeLeitfaden';d.className='office-leitfaden';d.dataset.pflicht=pflicht?'1':'0';
  d.setAttribute('aria-labelledby','officeLeitfadenTitel');
  d.innerHTML=`<header class="office-leitfaden-kopf"><div><h2 id="officeLeitfadenTitel">${esc(t.titel)}</h2>
      <p>Stand ${esc(t.stand)}${pflicht?' · Bitte einmal lesen und mit «Gelesen» bestätigen. Danach finden Sie den Leitfaden im Desktop jedes Projekts.':''}</p></div>
      ${pflicht?'':'<button type="button" class="office-leitfaden-zu" data-leitfaden-schliessen aria-label="Schließen">×</button>'}</header>
    <div class="office-leitfaden-text" tabindex="-1">${inhaltHtml(t)}</div>
    <footer class="office-leitfaden-fuss">${pflicht
      ?`<label class="office-leitfaden-gelesen"><input type="checkbox" data-leitfaden-gelesen> Gelesen</label>
        <p class="office-leitfaden-meldung" role="status" aria-live="polite"></p>
        <button type="button" class="office-leitfaden-spaeter" data-leitfaden-spaeter hidden>Später</button>
        <button type="button" class="primary" data-leitfaden-weiter disabled>Weiter</button>`
      :`<p class="office-leitfaden-hinweis">${zustand.bestaetigt?'Gelesen am '+esc(datum(zustand.bestaetigt))+'.':''}</p>
        <button type="button" class="primary" data-leitfaden-schliessen>Schließen</button>`}</footer>`;
  document.body.append(d);
  const zu=()=>{try{d.close()}catch{}d.remove()};
  d.addEventListener('cancel',e=>{if(pflicht)e.preventDefault()});
  d.addEventListener('close',()=>d.remove());
  d.querySelectorAll('[data-leitfaden-schliessen]').forEach(b=>b.addEventListener('click',zu));
  if(pflicht){
    const box=d.querySelector('[data-leitfaden-gelesen]'),weiter=d.querySelector('[data-leitfaden-weiter]');
    const meldung=d.querySelector('.office-leitfaden-meldung'),spaeter=d.querySelector('[data-leitfaden-spaeter]');
    box.addEventListener('change',()=>{weiter.disabled=!box.checked});
    spaeter.addEventListener('click',zu);
    weiter.addEventListener('click',async()=>{
      weiter.disabled=true;weiter.textContent='Speichere …';meldung.textContent='';
      let error=null;
      try{({error}=await sb.from('office_leitfaden_bestaetigungen').insert({user_id:zustand.userId,leitfaden:LEITFADEN,version:zustand.version}))}
      catch(e){error=e||{}}
      // Schon bestätigt (etwa auf einem anderen Gerät): gilt.
      if(error&&error.code!=='23505'){
        meldung.textContent='Die Bestätigung wurde nicht gespeichert. Bitte noch einmal versuchen.';
        weiter.textContent='Weiter';weiter.disabled=!box.checked;spaeter.hidden=false;return;
      }
      zustand.bestaetigt=new Date().toISOString();
      zu();
      melden();
    });
  }
  try{d.showModal()}catch{d.setAttribute('open','')}
  const text=d.querySelector('.office-leitfaden-text');
  try{text.scrollTop=0;text.focus({preventScroll:true})}catch{}
  return d;
}
function melden(){try{window.dispatchEvent(new CustomEvent('office:leitfaden',{detail:{aktiv:zustand.aktiv,version:zustand.version,bestaetigt:zustand.bestaetigt}}))}catch{}}

async function pruefen(member){
  const id=member?.user_id;
  if(!sb||!id||zustand.geprueft===id)return;
  zustand.geprueft=id;zustand.userId=id;
  try{
    const {data:l,error}=await sb.from('office_leitfaeden').select('version,aktiv').eq('leitfaden',LEITFADEN).maybeSingle();
    if(error||!l)return;
    zustand.version=l.version;
    zustand.aktiv=l.aktiv===true&&!!TEXTE[l.version];
    if(!zustand.aktiv){melden();return}
    const {data:b,error:be}=await sb.from('office_leitfaden_bestaetigungen').select('bestaetigt_am')
      .eq('leitfaden',LEITFADEN).eq('version',l.version).eq('user_id',id).maybeSingle();
    if(be){melden();return}
    zustand.bestaetigt=b?.bestaetigt_am||null;
    melden();
    if(!zustand.bestaetigt)oeffnen({pflicht:true});
  }catch{}
}

window.TBA_OFFICE_LEITFADEN=Object.freeze({
  verfuegbar:()=>zustand.aktiv,
  oeffnen:()=>zustand.aktiv?oeffnen({pflicht:false}):null,
  stand:()=>zustand.version,
  staende:()=>Object.keys(TEXTE)
});
window.addEventListener('office:member',e=>void pruefen(e.detail));
if(window.TBA_OFFICE_MEMBER)void pruefen(window.TBA_OFFICE_MEMBER);
})();
