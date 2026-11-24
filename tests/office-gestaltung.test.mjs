// Gemeinsame Gestaltung, 24.11.2026 (Gari, Option B): eine einzige Datei für Farben, Schrift und Formen, die jede
// Seite zuerst lädt, damit die Seiten nicht wieder auseinanderlaufen. Blau heißt: hier kann man klicken. Kein Schwarz
// mehr für Hauptaktionen, kein zweites oder drittes Blau, kein eigenes Grün. Statische Prüfungen; das Aussehen prüfen
// die Chromium-Tests (Senden-Knopf, Etikett «In Bearbeitung»).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const tokens=read('shared/minds-design-tokens.css');
const SEITEN=['index.html','app/index.html','app/live/index.html','terminplan.html','terminplan-hilfe.html','kostenberechnung.html',
  'kostenberechnung-hilfe.html','projektdokumente.html','produktbibliothek.html','herstellerkatalog.html','projektstart.html','oauth-consent.html'];
// live.css ist die gepinnte Kopie aus Window (docs/sync-window-app-manifest.json) und bleibt unverändert.
const GEPINNT=new Set(JSON.parse(read('docs/sync-window-app-manifest.json')).files.map(f=>f.target));
const css=[...readdirSync(new URL('../',import.meta.url)).filter(f=>f.endsWith('.css')),
  ...readdirSync(new URL('../app/',import.meta.url)).filter(f=>f.endsWith('.css')).map(f=>'app/'+f),'app/live/live-office.css']
  .filter(f=>!GEPINNT.has(f));
const ohneKommentare=s=>s.replace(/\/\*[\s\S]*?\*\//g,'');
const stile=p=>{const s=read(p);return p.endsWith('.html')?[...s.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n'):s};

test('Eine Datei: jede Seite lädt die Tokens vor allen anderen Stilen',()=>{
  for(const p of SEITEN){
    const s=read(p);
    const i=s.search(/<link rel="stylesheet" href="(\.\/|\.\.\/|\.\.\/\.\.\/)shared\/minds-design-tokens\.css\?v=\d+">/);
    assert.ok(i>0,'lädt die Tokens nicht: '+p);
    const erstes=s.search(/<link rel="stylesheet"|<style>/);
    assert.equal(erstes,i,'Tokens nicht zuerst: '+p);
  }
  assert.match(tokens,/--m-blue:#0062cc;/);
  assert.match(tokens,/accent-color:var\(--m-blue\);/,'Häkchen und Optionsfelder überall im selben Blau');
  assert.match(tokens,/--m-type-system:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Inter,Arial,sans-serif;/);
});

test('Nur die Token-Datei legt das Blau fest; die Seiten verweisen darauf',()=>{
  for(const f of css){
    const s=ohneKommentare(read(f));
    assert.doesNotMatch(s,/--m-(blue|ink|paper|link)[a-z-]*\s*:/,'eigene Grundfarbe in '+f);
  }
  for(const [f,p] of [['kostenberechnung.css','kb'],['projektdokumente.css','pd'],['produktbibliothek.css','pb'],['anleitung.css','a']]){
    const root=read(f).match(/:root\{([\s\S]*?)\}/)[1];
    assert.match(root,new RegExp('--'+p+'-link:var\\(--m-link\\)'),f);
    assert.match(root,new RegExp('--'+p+'-ink:var\\(--m-ink\\)'),f);
    assert.doesNotMatch(ohneKommentare(root),/#[0-9a-f]{3,6}\b/i,'Farbwert statt Token in :root von '+f);
  }
});

test('Blau = klickbar: keine schwarzen Hauptaktionen, kein zweites Blau, kein Grün als Dekor',()=>{
  const alteBlaus=/#(007aff|1769d4|0067d8|355d99|0759ba|0056b9|0069d[ab]|2d67c3|1459a4)\b|rgba\(0,\s*(122,\s*255|103,\s*216),/i;
  const alle=[...css.map(f=>[f,ohneKommentare(read(f))]),...['terminplan.html','projektstart.html','oauth-consent.html'].map(p=>[p,ohneKommentare(stile(p))])];
  for(const [f,s] of alle){
    assert.doesNotMatch(s,alteBlaus,'altes Blau in '+f);
    for(const m of s.matchAll(/([^{}]*)\{([^{}]*)\}/g)){
      const sel=m[1],decl=m[2];
      if(/\.(btn-primary|primary|office-projects-new)\b|aria-pressed="true"|:checked|\.active\b|\.selected\b|\.checked\b/.test(sel)&&
        /background(-color)?:\s*(#111|#111111|#191919|#000|#171717|#1b1b1d|var\(--m-ink\))\b/.test(decl))
        assert.fail('schwarze Aktion oder Auswahl in '+f+': '+sel.trim().slice(-90));
      if(/accent-color/.test(decl))assert.match(decl,/accent-color:var\(--(m-blue|assistant-blue)\)/,'Häkchen nicht blau in '+f+': '+sel.trim().slice(-60));
    }
  }
  // Projektstart: das eigene Grün ist weg, Links und Herunterladen sind blau.
  const ps=stile('projektstart.html');
  assert.doesNotMatch(ps,/#(355b49|60746a|60756a|edf1ed|eef3ef|9fb8aa|93afa0|202823|f9faf8)\b/i);
  assert.match(ps,/a\{color:var\(--m-link\)/);
  assert.match(ps,/\.download\{[^}]*color:var\(--m-blue\)/);
  // Romy schlägt in Projektdokumente blau getönt vor, wie die Assistenten in Terminplan und Kostenberechnung.
  const pd=read('projektdokumente.css');
  assert.match(pd,/--pd-romy:var\(--m-blue\);--pd-romy-bg:var\(--m-blue-soft\);--pd-romy-line:var\(--m-blue-line\)/);
  assert.match(read('projektdokumente.js'),/Sie stehen blau markiert in der Liste/);
  // Zurück-Links sind Links: blau.
  for(const [f,sel] of [['kostenberechnung.css','.kb-back'],['projektdokumente.css','.pd-back'],['produktbibliothek.css','.pb-back'],['anleitung.css','.a-back'],['app/office.css','.office-app .office-projects-back']])
    assert.match(read(f),new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{[^}]*color:var\\(--m-link\\)'),f);
});

test('Romy Live: die gepinnte Window-Datei bleibt, das Office färbt nur darüber',()=>{
  const live=read('app/live/index.html');
  assert.ok(live.indexOf('live.css?v=')<live.indexOf('live-office.css?v='),'live-office.css nach live.css');
  assert.match(read('app/live/live-office.css'),/\.live-actions \.primary,\.live-minds-actions button:first-child\{background:var\(--m-blue\)/);
});
