// Live im Chat (V2, 28.11.2026; Gari: «V2: sí»). Das Live-Gespräch mit Romy öffnet in einem Blatt über dem Chat statt
// auf einer eigenen Seite. live.js und live.css sind die gepinnten Dateien aus Window (docs/sync-window-app-manifest.json);
// hier geprüft: das Blatt mit dem Rahmen, das Neuladen des Chats nach jedem gespeicherten Zug und am Ende, die kompakte
// Live-Seite im Rahmen und die Farben aus den Tokens.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('das Blatt im Chat: Rahmen mit Mikrofon, Schließen; Live hat einen eigenen Knopf neben dem Mikrofon',()=>{
  const shell=read('app/shell.js');
  assert.match(shell,/<div id="liveSheet" class="live-sheet hidden" role="dialog" aria-modal="false" aria-label="Live-Gespräch mit Romy">/);
  assert.match(shell,/<iframe id="liveFrame" class="live-frame" title="Live-Gespräch mit Romy" allow="microphone; autoplay"><\/iframe>/);
  assert.match(shell,/id="liveSheetClose"[^>]*aria-label="Live-Gespräch schließen"/);
  // Wie bei Claude (Gari, 28.11.2026): das Mikrofon diktiert, die Schallwelle daneben spricht live; kein Link im Diktat.
  assert.match(shell,/id="micButton" class="mic" aria-label="Diktieren"[^>]*>[\s\S]*?<\/button>\s*<button id="liveButton" class="mic mic-live" type="button" aria-label="Live sprechen"/);
  assert.doesNotMatch(shell,/id="focusLiveLink"/);
  assert.doesNotMatch(shell,/id="liveStart"/,'die Bedienung von Live steht nur im Rahmen');
});

test('öffnen, schließen, neu laden: der Chat zeigt jeden gespeicherten Zug sofort',()=>{
  const app=read('app/app.js');
  assert.match(app,/const liveButton=\$\('#liveButton'\);if\(liveButton\)liveButton\.onclick=\(\)=>\{window\.ISABELLA_VOICE_OUTPUT\?\.stop\(\);if\(!openLiveSheet\(\)\)location\.href='\.\/live\/'\};/);
  assert.match(app,/function openLiveSheet\(\)\{[\s\S]*?frame\.src='\.\/live\/\?embed=1'/);
  assert.match(app,/function liveChatNeuLaden\(\)\{void window\.TBA_OFFICE_ENGINE_CHAT\?\.reconcile\?\.\(\);void window\.ISABELLA_SYNC_PULL_NOW\?\.\(\)\}/);
  assert.match(app,/function closeLiveSheet\(\)\{[\s\S]*?ISABELLA_LIVE_DIAGNOSTIC\?\.stop\(\)[\s\S]*?frame\.src='about:blank'[\s\S]*?liveChatNeuLaden\(\);/);
  assert.match(app,/if\(e\.origin!==location\.origin\|\|e\.data\?\.type!=='isabella-live'\)return;/,'nur Nachrichten der eigenen Seite');
  assert.match(app,/if\(e\.data\.event==='turn'\|\|\(e\.data\.event==='state'&&e\.data\.state==='idle'\)\)liveChatNeuLaden\(\);/);
});

test('Live-Seite im Rahmen kompakt; Farben des Blatts aus den Tokens',()=>{
  const page=read('app/live/index.html'),live=read('app/live/live.js'),css=read('app/voice-output.css');
  assert.match(page,/<script>if\(window\.self!==window\.top\)document\.documentElement\.classList\.add\('live-embedded'\)<\/script>/);
  assert.match(page,/\.\/live\.js\?v=romy8/);assert.match(page,/\.\/live\.css\?v=romy7/);
  assert.match(live,/window\.parent\.postMessage\(\{type:"isabella-live",event,\.\.\.extra\},window\.location\.origin\)/);
  // Im Office speichert Live nur das Gesagte der Person, nie die ungeprüfte Sprachausgabe als Antwort von Romy.
  assert.match(live,/if\(OFFICE_LIVE&&turn\.author==='isabella'\)return;/);
  const blatt=css.slice(css.indexOf('/* Live im Chat'));
  assert.ok(blatt.length>100);
  assert.doesNotMatch(blatt,/#[0-9a-f]{3,8}\b/i,'keine eigenen Farben');
  assert.match(blatt,/background:var\(--m-paper\);border:1px solid var\(--m-border\)/);
  const index=read('app/index.html');
  for(const v of ['./voice-output.css?v=office4','./shell.js?v=office68','./app.js?v=office63'])assert.ok(index.includes(v),v);
});

// Wie bei Claude (Gari, 28.11.2026): keine feste Dauer mehr; nach 2 Minuten ohne Gespräch endet Live von selbst,
// weil jede Sekunde bezahlt wird. Die Seite sagt es in «Sie».
test('Live ohne feste Dauer: endet nach 2 Minuten Stille; die Seite spricht «Sie»',()=>{
  const page=read('app/live/index.html'),live=read('app/live/live.js');
  assert.doesNotMatch(live,/MAX_DURATION_MS|90000/);
  assert.match(live,/IDLE_MS=120000/);
  assert.match(live,/Nach 2 Minuten ohne Gespräch beendet\./);
  assert.match(page,/Das Gespräch läuft, bis Sie «Beenden» wählen, und endet nach 2 Minuten ohne Gespräch von selbst\./);
  assert.doesNotMatch(page,/90 Sekunden/);
  const sichtbar=page.replace(/<script[\s\S]*?<\/script>/g,'');
  assert.doesNotMatch(sichtbar,/\b(du|dein|deine|deinem|deiner|dich|dir)\b|>Du<|Prüfe|Wähle/,'Office spricht «Sie»');
  assert.doesNotMatch(live,/Bitte sprich\b/);
});
