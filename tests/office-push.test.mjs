// Romys Mitteilungen auf das iPhone (27.11.2026). Gari: «sí para que pueda hacerlo, para cuando tenga algo que
// decirme (Romy)». Apple sieht nur «Romy · Neue Mitteilung»; der Text reist mit dem Schlüssel des iPhones
// verschlüsselt. Geprüft werden die reinen Hilfsfunktionen des Versands (ohne Netz), die Funktion selbst und die
// Migration. Die Rechte prüft tests/sql/office-push-acceptance.sql in CI gegen eine leere Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import * as core from '../supabase/functions/office-push/core.mjs';

const crypto = globalThis.crypto || webcrypto;
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const fn = read('supabase/functions/office-push/index.ts');
const sql = read('supabase/migrations/20261127080000_office_push.sql');
const ohneKommentar = s => s.replace(/--.*$/gm, '');
const b64 = bytes => Buffer.from(bytes).toString('base64');
const fromB64url = s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

async function apnsSchluessel() {
  const paar = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', paar.privateKey));
  const zeilen = b64(der).match(/.{1,64}/g).join('\n');
  return {paar, pem: `-----BEGIN PRIVATE KEY-----\n${zeilen}\n-----END PRIVATE KEY-----\n`};
}

test('die .p8-Datei wird gelesen, wie auch immer sie in den Secrets steht', async () => {
  const {pem} = await apnsSchluessel();
  const roh = core.p8ZuDer(pem);
  assert.deepEqual(core.p8ZuDer(pem.replace(/\n/g, ' ')), roh);
  assert.deepEqual(core.p8ZuDer(pem.replace(/\n/g, '\\n')), roh);
  assert.deepEqual(core.p8ZuDer(pem.replace(/-----[A-Z ]+-----/g, '')), roh);
  assert.throws(() => core.p8ZuDer('kein Schlüssel'), /apns_key_invalid/);
  assert.throws(() => core.p8ZuDer(''), /apns_key_invalid/);
});

test('das Anbieter-Token ist ein gültiges ES256-JWT mit Key ID und Team ID', async () => {
  const {paar, pem} = await apnsSchluessel();
  const jetzt = Date.UTC(2026, 10, 27, 7, 0, 0);
  const {token, iat} = await core.anbieterToken({p8: pem, keyId: 'ABC123DEFG', teamId: 'TEAM123456', jetzt});
  const [kopf, inhalt, sig] = token.split('.');
  assert.deepEqual(JSON.parse(fromB64url(kopf)), {alg: 'ES256', kid: 'ABC123DEFG'});
  assert.deepEqual(JSON.parse(fromB64url(inhalt)), {iss: 'TEAM123456', iat: jetzt / 1000});
  assert.equal(iat, jetzt / 1000);
  const signatur = fromB64url(sig);
  assert.equal(signatur.length, 64, 'roh r ‖ s, wie JWT ES256 es verlangt');
  const ok = await crypto.subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, paar.publicKey, signatur,
    new TextEncoder().encode(kopf + '.' + inhalt));
  assert.ok(ok);
  await assert.rejects(core.anbieterToken({p8: pem, keyId: 'zu-kurz', teamId: 'TEAM123456'}), /apns_ids_invalid/);
  await assert.rejects(core.anbieterToken({p8: pem, keyId: 'ABC123DEFG', teamId: ''}), /apns_ids_invalid/);
});

test('ein gespeichertes Token gilt 40 Minuten und nur für denselben Schlüssel', () => {
  const jetzt = Date.UTC(2026, 10, 27, 7, 0, 0);
  const wert = iat => JSON.stringify({kid: 'ABC123DEFG', iss: 'TEAM123456', iat, token: 'a.b.c'});
  assert.equal(core.jwtAusSpeicher(wert(jetzt / 1000 - 60), 'ABC123DEFG', 'TEAM123456', jetzt), 'a.b.c');
  assert.equal(core.jwtAusSpeicher(wert(jetzt / 1000 - 41 * 60), 'ABC123DEFG', 'TEAM123456', jetzt), null);
  assert.equal(core.jwtAusSpeicher(wert(jetzt / 1000 + 60), 'ABC123DEFG', 'TEAM123456', jetzt), null);
  assert.equal(core.jwtAusSpeicher(wert(jetzt / 1000 - 60), 'ANDERE0001', 'TEAM123456', jetzt), null);
  assert.equal(core.jwtAusSpeicher(wert(jetzt / 1000 - 60), 'ABC123DEFG', 'ANDERESTEAM', jetzt), null);
  assert.equal(core.jwtAusSpeicher('', 'ABC123DEFG', 'TEAM123456', jetzt), null);
  assert.equal(core.jwtAusSpeicher('{kaputt', 'ABC123DEFG', 'TEAM123456', jetzt), null);
});

test('der Text reist verschlüsselt: Nonce ‖ Geheimtext ‖ Tag, wie CryptoKit ihn öffnet', async () => {
  const schluessel = crypto.getRandomValues(new Uint8Array(32));
  const nachricht = core.inhalt({id: '11111111-2222-4333-8444-555555555555', art: 'romy', titel: 'Romy', text: 'Morgen um 9 ist die Bemusterung in Bernried.'});
  const versiegelt = await core.versiegeln(b64(schluessel), nachricht);
  const alles = Buffer.from(versiegelt, 'base64');
  assert.equal(alles.length, 12 + Buffer.byteLength(JSON.stringify(nachricht)) + 16);
  const key = await crypto.subtle.importKey('raw', schluessel, {name: 'AES-GCM'}, false, ['decrypt']);
  const klar = await crypto.subtle.decrypt({name: 'AES-GCM', iv: alles.subarray(0, 12), tagLength: 128}, key, alles.subarray(12));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(klar)), {t: 'Romy', b: 'Morgen um 9 ist die Bemusterung in Bernried.', z: 'romy', k: 'romy', i: '11111111-2222-4333-8444-555555555555'});
  assert.notEqual(await core.versiegeln(b64(schluessel), nachricht), versiegelt, 'jede Mitteilung mit eigener Nonce');
  const fremd = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), {name: 'AES-GCM'}, false, ['decrypt']);
  await assert.rejects(crypto.subtle.decrypt({name: 'AES-GCM', iv: alles.subarray(0, 12), tagLength: 128}, fremd, alles.subarray(12)));
  await assert.rejects(core.versiegeln(b64(new Uint8Array(16)), nachricht), /device_key_invalid/);
  await assert.rejects(core.versiegeln('kein base64 !!', nachricht), /device_key_invalid/);
});

test('die Anfrage an APNs: Apple sieht nur «Romy · Neue Mitteilung»', async () => {
  const text = 'Der Jour fixe Bernried beginnt in 30 Minuten.';
  const geraet = {apns_token: 'ab'.repeat(32), umgebung: 'production', bundle_id: 'com.example.window'};
  const nachricht = {id: '11111111-2222-4333-8444-555555555555', art: 'hinweis', titel: 'Romy', text, gueltig_bis: '2026-11-27T10:00:00Z'};
  const versiegelt = await core.versiegeln(b64(crypto.getRandomValues(new Uint8Array(32))), core.inhalt(nachricht));
  const r = core.anfrage({geraet, jwt: 'x.y.z', nachricht, versiegelt});
  assert.equal(r.url, 'https://api.push.apple.com/3/device/' + 'ab'.repeat(32));
  assert.equal(r.headers.authorization, 'bearer x.y.z');
  assert.equal(r.headers['apns-topic'], 'com.example.window');
  assert.equal(r.headers['apns-push-type'], 'alert');
  assert.equal(r.headers['apns-priority'], '10');
  assert.equal(r.headers['apns-expiration'], String(Date.UTC(2026, 10, 27, 10, 0, 0) / 1000));
  assert.equal(r.headers['apns-collapse-id'], nachricht.id);
  const body = JSON.parse(r.body);
  assert.deepEqual(body.aps.alert, {title: 'Romy', body: 'Neue Mitteilung'});
  assert.equal(body.aps['mutable-content'], 1, 'sonst entschlüsselt die Erweiterung nicht');
  assert.equal(body.aps['thread-id'], 'romy');
  assert.equal(body.o, 1, 'ein Tippen öffnet das Office');
  assert.equal(body.e, versiegelt);
  assert.ok(!r.body.includes('Jour fixe') && !r.body.includes('Bernried'), 'kein Klartext an Apple');
  assert.ok(Buffer.byteLength(r.body) < 4096, 'APNs nimmt höchstens 4 KB');
  assert.equal(core.anfrage({geraet: {...geraet, umgebung: 'development'}, jwt: 'j', nachricht, versiegelt}).url.split('/3/')[0],
    'https://api.sandbox.push.apple.com');
  assert.throws(() => core.anfrage({geraet: {...geraet, umgebung: 'test'}, jwt: 'j', nachricht, versiegelt}), /unknown_environment/);
  assert.throws(() => core.anfrage({geraet: {...geraet, apns_token: '../x'}, jwt: 'j', nachricht, versiegelt}), /device_token_invalid/);
  // Auch der längste erlaubte Text bleibt unter 4 KB.
  const lang = await core.versiegeln(b64(crypto.getRandomValues(new Uint8Array(32))), core.inhalt({...nachricht, text: 'ä'.repeat(600)}));
  assert.ok(Buffer.byteLength(core.anfrage({geraet, jwt: 'x'.repeat(400), nachricht, versiegelt: lang}).body) < 4096);
});

test('was eine Antwort von APNs bedeutet', () => {
  assert.equal(core.einordnen(200), 'zugestellt');
  assert.equal(core.einordnen(410, 'Unregistered'), 'geraet_weg');
  assert.equal(core.einordnen(400, 'BadDeviceToken'), 'geraet_weg');
  assert.equal(core.einordnen(400, 'DeviceTokenNotForTopic'), 'geraet_weg');
  assert.equal(core.einordnen(403, 'ExpiredProviderToken'), 'token_neu');
  assert.equal(core.einordnen(403, 'InvalidProviderToken'), 'token_neu');
  assert.equal(core.einordnen(429, 'TooManyProviderTokenUpdates'), 'spaeter');
  assert.equal(core.einordnen(503, 'ServiceUnavailable'), 'spaeter');
  assert.equal(core.einordnen(0), 'spaeter');
  assert.equal(core.einordnen(400, 'PayloadTooLarge'), 'fehler');
  assert.equal(core.einordnen(403, 'BadCertificate'), 'fehler');
});

test('der Ausgang einer Mitteilung: gesendet, später, abgelaufen, ohne Gerät', () => {
  const jetzt = Date.UTC(2026, 10, 27, 7, 0, 0), bald = '2026-11-27T10:00:00Z', gleich = '2026-11-27T07:00:30Z';
  const e = (...was) => was.map(w => ({was: w}));
  assert.deepEqual(core.ausgang({ergebnisse: [], versuche: 1, gueltigBis: bald, jetzt}), {status: 'ohne_geraet'});
  assert.deepEqual(core.ausgang({ergebnisse: e('geraet_weg', 'zugestellt'), versuche: 1, gueltigBis: bald, jetzt}), {status: 'gesendet'});
  assert.deepEqual(core.ausgang({ergebnisse: e('spaeter'), versuche: 1, gueltigBis: bald, jetzt}),
    {status: 'wartet', naechster_versuch: new Date(jetzt + 60000).toISOString()});
  assert.equal(core.ausgang({ergebnisse: e('token_neu'), versuche: 3, gueltigBis: bald, jetzt}).naechster_versuch,
    new Date(jetzt + 15 * 60000).toISOString());
  assert.deepEqual(core.ausgang({ergebnisse: e('spaeter'), versuche: 1, gueltigBis: gleich, jetzt}), {status: 'abgelaufen'});
  assert.deepEqual(core.ausgang({ergebnisse: e('spaeter'), versuche: core.MAX_VERSUCHE, gueltigBis: bald, jetzt}), {status: 'fehlgeschlagen'});
  assert.deepEqual(core.ausgang({ergebnisse: e('geraet_weg', 'geraet_weg'), versuche: 1, gueltigBis: bald, jetzt}), {status: 'ohne_geraet'});
  assert.deepEqual(core.ausgang({ergebnisse: e('fehler', 'geraet_weg'), versuche: 1, gueltigBis: bald, jetzt}), {status: 'fehlgeschlagen'});
});

test('das Geheimnis des Versands wird ohne Abkürzung verglichen', () => {
  assert.equal(core.geheimnisPasst('abc123', 'abc123'), true);
  assert.equal(core.geheimnisPasst('abc124', 'abc123'), false);
  assert.equal(core.geheimnisPasst('abc', 'abc123'), false);
  assert.equal(core.geheimnisPasst('', ''), false, 'ein leeres Geheimnis öffnet nie');
});

test('die Funktion prüft zuerst ihr Geheimnis, schickt nur an die eigene App und protokolliert nichts Persönliches', () => {
  const pruefung = fn.indexOf('geheimnisPasst(String(body?.secret');
  assert.ok(pruefung > 0);
  for (const danach of ['sb.rpc("office_push_holen"', 'Deno.env.get("APNS_KEY_P8")', 'from("office_push_geraete")'])
    assert.ok(fn.indexOf(danach) > pruefung, danach + ' erst nach dem Geheimnis');
  assert.match(fn, /return antwort\(401,\{error:"unauthorized"\}\)/);
  assert.match(fn, /if\(!p8\|\|!keyId\|\|!teamId\|\|!bundle\)return antwort\(503,\{error:"apns_not_configured"\}\)/);
  assert.match(fn, /if\(g\.bundle_id!==bundle\)\{/);
  assert.match(fn, /signal:AbortSignal\.timeout\(15000\)/);
  assert.match(fn, /if\(was==="geraet_weg"\)\n\s*await sb\.from\("office_push_geraete"\)\.update\(\{aktiv:false/);
  assert.match(fn, /\.eq\("id",n\.id\)\.eq\("status","wird_gesendet"\)/);
  assert.doesNotMatch(fn, /console\.(log|info|debug)/);
  for (const m of fn.matchAll(/console\.error\(([^)]*)\)/g))
    assert.doesNotMatch(m[1].replace(/"[^"]*"/g, ''), /\b(jwt|p8|keyId|schluessel|apns_token|versiegelt|body)\b|\.text\b/,
      'nichts Geheimes oder Persönliches ins Protokoll');
  const config = read('supabase/config.toml');
  assert.match(config, /\[functions\.office-push\]\nverify_jwt = false\nentrypoint = "\.\/functions\/office-push\/index\.ts"/);
});

test('Migration: eigene Zeilen lesen, ohne Token und Schlüssel; schreiben nur über die Funktionen', () => {
  const s = ohneKommentar(sql);
  assert.doesNotMatch(s, /\b(drop|truncate|delete\s+from|alter\s+table\s+[^;]*\bdrop\b)/i, 'nichts wird gelöscht');
  for (const t of ['office_push_geraete', 'office_push_nachrichten'])
    assert.match(s, new RegExp(`alter table public\\.${t} enable row level security`));
  assert.match(s, /revoke all on public\.office_push_geraete, public\.office_push_nachrichten from public, anon, authenticated/);
  const geraeteSpalten = s.match(/grant select \(([^)]*)\)\s*on public\.office_push_geraete to authenticated/)[1];
  assert.doesNotMatch(geraeteSpalten, /apns_token|schluessel|bundle_id/);
  const nachrichtenSpalten = s.match(/grant select \(([^)]*)\)\s*on public\.office_push_nachrichten to authenticated/)[1];
  assert.doesNotMatch(nachrichtenSpalten, /ergebnis|dedupe|quelle_id/);
  assert.equal((s.match(/using \(user_id = \(select auth\.uid\(\)\) and \(select private\.office_is_member\(\)\)\)/g) || []).length, 2);
  assert.doesNotMatch(s, /grant (insert|update|delete|all)[^;]*office_push_(geraete|nachrichten)[^;]*to (authenticated|anon)/i);
  // Jede Funktion mit festem Suchpfad; nur Anmelden, Abmelden und Test sind für Angemeldete.
  const funktionen = [...s.matchAll(/create or replace function public\.([a-z_]+)\(/g)].map(m => m[1]);
  assert.deepEqual(funktionen, ['office_push_geraet_anmelden', 'office_push_geraet_abmelden', 'office_push_test', 'office_push_nach_romy', 'office_push_holen']);
  assert.equal((s.match(/security definer\s+set search_path = ''/g) || []).length, 5);
  assert.match(s, /revoke all on function public\.office_push_holen\(integer\) from public, anon, authenticated;\ngrant execute on function public\.office_push_holen\(integer\) to service_role;/);
  assert.match(s, /revoke all on function public\.office_push_nach_romy\(\) from public, anon, authenticated;/);
  for (const f of ['office_push_geraet_anmelden(text, text, text, text, text, text)', 'office_push_geraet_abmelden(text)', 'office_push_test()'])
    assert.ok(s.includes(`grant execute on function public.${f} to authenticated;`), f);
  // Anmelden prüft Sitzung, Mitgliedschaft und die Form von Token und Schlüssel (32 Byte).
  assert.match(s, /if not private\.office_is_member\(\) then raise exception 'Kein aktiver Office-Zugang\.' using errcode = '42501'/);
  assert.match(s, /if v_key is null or length\(v_key\) <> 32 then raise exception/);
  assert.match(s, /on conflict \(apns_token\) do update/);
});

test('Migration: der Auslöser nimmt nur Romys eigene Nachrichten und dringende Hinweise, nie beim Öffnen der App', () => {
  const s = ohneKommentar(sql);
  assert.match(s, /create trigger office_push_nach_romy\s+after insert on public\.conversation_messages\s+for each row\s+when \(new\.role = 'assistant' and new\.metadata->>'source' in \('isabella_presence', 'attention_runtime'\)\)/);
  assert.match(s, /if coalesce\(new\.metadata->>'moment', ''\) = 'app_abierta' then return new; end if;/);
  assert.match(s, /coalesce\(new\.metadata->>'attention_route', 'interrupt'\) = 'interrupt'/);
  assert.match(s, /if not exists \(select 1 from public\.office_push_geraete g where g\.user_id = new\.user_id and g\.aktiv\) then\s+return new;/);
  assert.match(s, /exception when others then\s+raise warning 'office_push_nach_romy: %', sqlerrm;/, 'ein Fehler hält Romys Nachricht nie auf');
  assert.match(s, /'nachricht:' \|\| new\.id::text/);
  assert.match(s, /on conflict \(dedupe\) do nothing/);
  // Der Versand läuft nur, wenn etwas fällig ist, mit seinem eigenen Geheimnis aus der Datenbank.
  assert.match(s, /perform cron\.schedule\('office_push_v1', '\* \* \* \* \*'/);
  assert.match(s, /where s\.key='office_push' and length\(s\.value\)>0\s+and exists \(select 1 from public\.office_push_nachrichten n/);
  assert.match(s, /set value = replace\(gen_random_uuid\(\)::text \|\| gen_random_uuid\(\)::text, '-', ''\)\s+where key = 'office_push' and length\(value\) = 0/);
  assert.match(s, /to_regprocedure\('net\.http_post\(text,jsonb,jsonb,jsonb,integer\)'\) is null then\s+return;/);
});
