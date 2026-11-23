// Planner-Buckets im Office (23.11.2026): «Entfernen» rief Funktionen auf, die es nur in Window gab.
// Und: Kostenberechnungen liest das ganze Office (Entscheidung Gari, 23.11.2026), schreiben bleibt beim Team.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const buckets=read('supabase/migrations/20261123100000_office_work_buckets_v1.sql');
const lesen=read('supabase/migrations/20261123100100_office_kosten_lesen_office.sql');
const ohneKommentar=s=>s.replace(/--.*$/gm,'');

test('Jede Bucket-Funktion, die der Planner aufruft, gibt es als Migration',()=>{
  const work=read('app/work.js');
  const aufrufe=[...new Set([...work.matchAll(/sb\.rpc\('(minds_work_bucket_[a-z]+)'/g)].map(m=>m[1]))].sort();
  assert.deepEqual(aufrufe,['minds_work_bucket_archive','minds_work_bucket_reorder','minds_work_bucket_restore']);
  for(const f of aufrufe){
    assert.match(buckets,new RegExp('create or replace function public\\.'+f+'\\(p_project_id uuid, p_bucket_ids? uuid(\\[\\])?\\)'),f);
    assert.match(buckets,new RegExp('revoke all on function public\\.'+f+'\\([^)]*\\) from public, anon;'));
    assert.match(buckets,new RegExp('grant execute on function public\\.'+f+'\\([^)]*\\) to authenticated;'));
  }
  // Als aufrufende Person unter RLS, nur für Office-Mitglieder, je Projekt gesperrt, nichts gelöscht.
  assert.equal((buckets.match(/language plpgsql security invoker set search_path = ''/g)||[]).length,3);
  assert.doesNotMatch(buckets,/security definer/);
  assert.equal((buckets.match(/if v_uid is null or not \(select private\.office_is_member\(\)\) then/g)||[]).length,3);
  assert.equal((buckets.match(/pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(p_project_id::text \|\| ':work-buckets', 0\)\)/g)||[]).length,3);
  assert.doesNotMatch(ohneKommentar(buckets),/\bdrop\b|\btruncate\b|\bdelete\s+from\b/i);
  // Wer ändern darf, wie die Policy minds_work_buckets_update: Ersteller, Projektleitung, Projektteam.
  assert.match(buckets,/b\.user_id = v_uid or \(select private\.office_leads_project\(b\.project_id\)\)\s*or \(select private\.office_in_project_team\(b\.project_id\)\)/);
  // Offene Aufgaben nach «Ohne Bucket», erledigte bleiben; lässt sich eine nicht verschieben, bricht alles ab.
  assert.match(buckets,/where project_id = p_project_id and work_bucket_id = p_bucket_id and completed_at is null;/);
  assert.match(buckets,/if v_moved <> v_offen then/);
  // Die Abnahme läuft in einer zurückgerollten Transaktion in der CI.
  const abnahme=read('tests/sql/office-work-buckets-acceptance.sql');
  assert.match(abnahme,/^begin;$/m);assert.match(abnahme,/^rollback;$/m);assert.match(abnahme,/example\.invalid/);
  assert.match(abnahme,/C_entfernen=verweigert; C_ordnen=verweigert; B_entfernt=2; offen_ohne_bucket=2; erledigt_am_bucket=1; bucket_archiviert=true; /);
  assert.match(read('.github/workflows/verify.yml'),/< tests\/sql\/office-work-buckets-acceptance\.sql/);
});

test('Kostenberechnung: lesen alle im Office, nur hinzugefügte Policies, Verlauf bleibt privat',()=>{
  const sql=ohneKommentar(lesen);
  assert.doesNotMatch(sql,/\bdrop\b|\balter policy\b|\btruncate\b|\bdelete\s+from\b|create or replace function/i,'nur hinzufügen');
  assert.equal((sql.match(/create policy /g)||[]).length,5);
  assert.match(sql,/create policy office_kosten_instances_office_select on public\.office_kosten_instances\s+for select to authenticated using \(\(select private\.office_is_member\(\)\)\);/);
  assert.match(sql,/create policy office_kosten_versions_office_select on public\.office_kosten_versions\s+for select to authenticated using \(\(select private\.office_is_member\(\)\)\);/);
  assert.match(sql,/office_kosten_dialogue_office_read on public\.office_kosten_dialogue_messages\s+for select to authenticated using \(user_id = \(select auth\.uid\(\)\)/);
  // Kein neuer Schreibweg für die Kostenberechnung selbst.
  assert.doesNotMatch(sql,/on public\.office_kosten_(instances|versions)\s+for (insert|update|delete|all)/);
  assert.match(read('kostenberechnung.js'),/Ansehen kann die Kostenberechnung das ganze Office, wie den Terminplan; fortschreiben das Projektteam/);
  assert.match(read('kostenberechnung-hilfe.html'),/Ansehen kann die Kostenberechnung das ganze Office, wie den Terminplan; fortschreiben können das Projektteam/);
});
