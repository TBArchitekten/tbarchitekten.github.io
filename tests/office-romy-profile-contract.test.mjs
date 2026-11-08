import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Phase 0: D1 is explicit direct create with server receipt and bounded Undo; D2 still requires review', () => {
  const agents = read('AGENTS.md');
  assert.match(agents, /D1 \(08\.11\.2026\).*creación.*directamente.*autorización.*Deshacer/);
  assert.match(agents, /D2 sigue desactivado.*mover, completar, archivar o borrar.*propuesta \+ confirmación/);
  assert.match(agents, /No escribas aquí datos de clientes/);
  assert.match(agents, /Toda tabla nueva lleva RLS/);
});

test('Phase 0: Office documents incomplete acceptance and no deployment/migration', () => {
  const state = read('docs/ESTADO.md');
  const journal = read('docs/BITACORA.md');
  assert.match(state, /fase 0 permanece en \*\*borrador no aceptado\*\*/i);
  assert.match(state, /no hay cambios en producción/i);
  assert.match(journal, /fase 0 \(borrador, sin activación\)/i);
  assert.match(journal, /aplicada en Supabase: no/i);
  assert.match(journal, /CI Office 200\/200 tests PASS/i);
});

test('Phase 0: no replacement of the Office assistant runtime or credential configuration', () => {
  const state = read('docs/ESTADO.md');
  assert.match(state, /office-assistant.*permanece como respaldo/);
  assert.match(read('app/index.html'), /office-assistant\.js/);
});
