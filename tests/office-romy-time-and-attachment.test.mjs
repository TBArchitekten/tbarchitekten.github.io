import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validOfficeDate,berlinMidnightUtc,berlinDateRangeUtc,parseExplicitZonedInstant,officeLocalNow} from '../supabase/functions/office-assistant/romy-time.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Romy searches office calendar by the exact local Berlin date, not UTC calendar days',()=>{
  assert.deepEqual(berlinDateRangeUtc('2026-11-05','2026-11-05'),{
    start:'2026-11-04T23:00:00.000Z',
    endExclusive:'2026-11-05T23:00:00.000Z',
    timezone:'Europe/Berlin'
  });
  assert.deepEqual(berlinDateRangeUtc('2026-03-29','2026-03-29'),{
    start:'2026-03-28T23:00:00.000Z',
    endExclusive:'2026-03-29T22:00:00.000Z',
    timezone:'Europe/Berlin'
  });
  assert.deepEqual(berlinDateRangeUtc('2026-10-25','2026-10-25'),{
    start:'2026-10-24T22:00:00.000Z',
    endExclusive:'2026-10-25T23:00:00.000Z',
    timezone:'Europe/Berlin'
  });
  assert.equal(berlinMidnightUtc('2026-04-04'),'2026-04-03T22:00:00.000Z');
});
test('Romy rejects impossible dates and ambiguous timezone-free event timestamps',()=>{
  assert.equal(validOfficeDate('2026-02-29'),false);
  assert.equal(validOfficeDate('2024-02-29'),true);
  assert.equal(validOfficeDate('2026-11-31'),false);
  assert.throws(()=>berlinDateRangeUtc('2026-11-06','2026-11-05'),/invalid_office_date_range/);
  assert.equal(parseExplicitZonedInstant('2026-11-05T15:00:00+01:00'),'2026-11-05T14:00:00.000Z');
  assert.equal(parseExplicitZonedInstant('2026-07-05T15:00:00+02:00'),'2026-07-05T13:00:00.000Z');
  assert.equal(parseExplicitZonedInstant('2026-11-05T15:00:00'),null);
  assert.equal(parseExplicitZonedInstant('2026-11-31T15:00:00+01:00'),null);
  assert.match(officeLocalNow(),/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
});
test('Romy tools use timezone-correct overlaps and require explicit timezone on proposals',()=>{
  const source=read('supabase/functions/office-assistant/romy-tools.mjs');
  assert.match(source,/berlinDateRangeUtc\(a\.from,a\.to\)/);
  assert.match(source,/\.lt\("starts_at",bounds\.endExclusive\)\.gt\("ends_at",bounds\.start\)/);
  assert.doesNotMatch(source,/a\.from\+"T00:00:00Z"/);
  assert.match(source,/parseExplicitZonedInstant\(a\.starts_at\)/);
  assert.match(source,/event_time_requires_explicit_timezone/);
});
test('Attachment-only messages survive the database nonempty text constraint without inventing user text for the model',()=>{
  const backend=read('supabase/functions/office-assistant/index.ts');
  assert.ok(backend.includes('content:message||"Datei(en) angehängt"'));
  assert.ok(backend.includes('requestId,history,message,attachmentInputs:attached.inputs'));
  const continuity=read('supabase/functions/office-assistant/romy-continuity.mjs');
  assert.ok(continuity.includes('officeLocalNow()'));
  assert.ok(continuity.includes('Europe/Berlin'));
  assert.ok(backend.includes('loadRomyAttachments(db,uid,attachments)'));
});
