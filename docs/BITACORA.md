# TBA Office · Bitácora de cambios

Una entrada por cambio, **la más nueva arriba**. Cada agente (ChatGPT, Claude u otro) o Gari añade la suya en el mismo PR del cambio. Lo que *es* el sistema ahora se describe en `docs/ESTADO.md`; aquí queda *qué pasó y qué quedó pendiente*.

## Plantilla (copiar y llenar)
```
### AAAA-MM-DD · Título corto · Autor (ChatGPT / Claude / Gari)
- Qué cambió y por qué:
- Archivos:
- Base de datos: migración `…` — aplicada en Supabase: sí / no (cómo)
- Deploy de funciones: ninguno / `nombre` (cómo)
- Cómo se probó:
- Quedó pendiente o sin probar:
- Riesgos o decisiones que necesitan a Gari:
- PR:
```

---

### 2026-11-04 · Hoja de ruta completa en ESTADO · Claude
- **Qué cambió y por qué:** `ESTADO.md` §6 solo listaba C y D. Ahora tiene las cinco etapas acordadas, lo que va después (vínculo Planner↔Terminplan, Planliste, Controlling, herramientas de costos, Projektakte, login con Microsoft) y las reglas de base de Gari. Se precisó la pregunta sobre el Desktop: fundamentos y guías de la oficina, sin datos de clientes.
- **Archivos:** `docs/ESTADO.md`, `docs/BITACORA.md`.
- **Base de datos / deploy:** ninguno.
- **PR:** #15

### 2026-11-04 · Traspaso y reglas de documentación · Claude
- **Qué cambió y por qué:** Gari trabajará con ChatGPT hasta el 06.11. Se añadieron `AGENTS.md` (reglas para cualquier agente), `CLAUDE.md`, `docs/ESTADO.md` (estado actual), esta bitácora y la plantilla de PR.
- **Archivos:** solo documentación.
- **Base de datos:** ninguna. **Deploy:** ninguno.
- **Quedó pendiente:** lo que lista `docs/ESTADO.md` §6.
- **PR:** #14

### 2026-11-04 · Copia de Window en la oficina, partes A y B · Claude
- **Qué cambió y por qué:** Gari vio que el Kalender y el Work propios se veían muy distintos de Window, así que se copió el código de Window.
  - La app `./app/` trae Heute, Kalender y Work (Panorama y Planner) en alemán, conectada a TBA Office.
  - La página de inicio manda a la app tras iniciar sesión y conserva Projekte, Tools, Mitglieder y `#password`.
  - Se retiró el Planner/Kalender propio (`planner.js`).
- **Base de datos:** `20261104000400_office_window_tables_v1` y `20261104000500_office_window_fixes`, ambas aplicadas en Supabase con el MCP de Supabase.
- **Cómo se probó:** 87 pruebas; simulaciones con Playwright de todas las pantallas (escritorio y teléfono); RLS en transacciones revertidas (23 casos); página publicada sin sesión.
- **Quedó pendiente o sin probar:** uso real con varias personas; Desktop y adjuntos (parte C); Assistent (parte D).
- **PR:** #13

### 2026-11-04 · Planner y Kalender propios (v1) · Claude
- **Qué cambió y por qué:** primer Planner/Kalender sobre `office_tasks` y `office_task_buckets`. Lo reemplazó la copia de Window el mismo día.
- **Base de datos:** `20261104000300_office_planner_v1`, aplicada. Las tablas siguen ahí, vacías; borrarlas requiere el OK de Gari.
- **PR:** #12

### 2026-11-04 · Diseño tipo Window para la página de inicio · Claude
- **Qué cambió:** barra lateral de vistas, páginas de proyecto y estilo del editor de Terminplan.
- **PR:** #11

### 2026-11-04 · Base de TBA Office · Claude
- **Qué cambió:** cuentas por persona (correo y contraseña de inicio), roles, proyectos, Terminplan ligado a proyecto y nuevo proyecto de Supabase "TBA Office".
- **Base de datos:** `20261104000000`…`000200`, aplicadas.
- **Funciones:** `office-admin` y `office-terminplan-ai` (modelo `gpt-6.1-terra`), desplegadas.
- **PR:** #10

### 2026-10-28 · Asistente del Terminplan v0.1–v0.6 · (ver docs)
- Historia detallada en `docs/TERMINPLAN-ASSISTENT-v0.1.md` … `v0.6.md`.
- Migraciones `20261028_*` aplicadas.
