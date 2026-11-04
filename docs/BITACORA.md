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

### 2026-11-04 · Cierre documental: límite del Assistent retirado · ChatGPT
- Qué cambió y por qué: PR #20 integrado en main (squash 508252b); retirado el límite diario que no había sido acordado con Gari.
- Archivos: docs/ESTADO.md y docs/BITACORA.md.
- Base de datos: sin migración adicional; cambio aplicado anteriormente como versión 20261104213325.
- Deploy de funciones: office-assistant ACTIVE v2, JWT obligatorio.
- Cómo se probó: 95/95 pruebas CI; función viva sin rama daily_limit; nueva interfaz en main; 32 reservas válidas con rollback.
- Quedó pendiente o sin probar: aceptación autenticada con usuarios y decisión explícita de presupuesto.
- Riesgos o decisiones que necesitan a Gari: las llamadas al modelo siguen teniendo coste real, aunque no hay máximo diario de la aplicación.
- PR: #21.

### 2026-11-04 · Retirada de cuota no acordada del Assistent · ChatGPT
- Qué cambió y por qué: el límite diario de 15 consultas por miembro fue una decisión unilateral de ChatGPT, no aceptada por Gari. Se retira sin crear otra cuota arbitraria.
- Archivos: migración office_assistant_remove_unapproved_daily_cap.sql, función office-assistant, interfaz, pruebas y documentación.
- Base de datos: migración aplicada en TBA Office con Supabase MCP, versión `20261104213325`.
- Deploy de funciones: `office-assistant` ACTIVE v2 con JWT; retirada la respuesta de error por cuota.
- Cómo se probó: simulación SQL con 32 solicitudes válidas en transacción revertida; duplicados, aislamiento por usuario y no miembros siguen bloqueados. CI 95/95 PASS; función publicada verificada sin límite y Security Advisors sin advertencias.
- Quedó pendiente o sin probar: merge y publicación del frontend; primera conversación real y aceptación con usuarios.
- Riesgos o decisiones que necesitan a Gari: el coste del proveedor sigue existiendo; presupuesto y eventuales cuotas solo mediante decisión explícita. La cuota del Terminplan no cambia.
- PR: #20.

### 2026-11-04 · Assistent: cierre de integración · ChatGPT
- Qué cambió: PR #18 integrado en main.
- Archivos: ESTADO.md y BITACORA.md.
- Migración: aplicada anteriormente.
- Deploy: función activa.
- Pruebas: 95/95 correctas.
- Pendiente: aceptación real con empleados, primera conversación y presupuesto definitivo.
- PR: #19.

### 2026-11-04 · Assistent individual por miembro · ChatGPT
- Qué cambió y por qué: se preparó un chat privado para cada cuenta activa de TBA Office, con conversaciones persistentes y modos Schnell y Gründlich. No se copia la memoria de Window ni se consultan automáticamente archivos o calendarios.
- Archivos: app/office-assistant.js, app/office-assistant.css, app/shell.js, app/app.js, app/index.html, supabase/functions/office-assistant/index.ts, supabase/migrations/20261104220000_office_assistant_personal_v1.sql y tests.
- Base de datos: migración aplicada en Supabase.
- Deploy de funciones: office-assistant ACTIVE v1.
- Cómo se probó: esquema y cuota comprobados en transacción revertida; CI 95/95 PASS.
- Quedó pendiente: aceptación en navegadores con dos empleados y decisión del presupuesto mensual.
- Riesgos o decisiones: límite provisional de 15 solicitudes diarias por miembro; sin acciones automáticas.
- PR: #18.

### 2026-11-04 · Desktop integrado, documentación de cierre · ChatGPT
- **Qué cambió y por qué:** PR #16 ya integrado en `main` (squash `c6afe968`); se aclara que la aceptación autenticada de Desktop aún no está hecha y que la respuesta pública de GitHub Pages no pudo comprobarse desde el entorno.
- **Archivos:** `docs/ESTADO.md` y `docs/BITACORA.md`.
- **Base de datos:** ninguna migración nueva; `office_desktop_v1` ya aplicada en TBA Office, versión Supabase `20261104203250`.
- **Deploy de funciones:** ninguno.
- **Cómo se probó:** GitHub confirmó PR #16 merged; `app/office-desktop-ops.js` está en `main`. CI de PR #16: 91 pruebas PASS, SQL rollback PASS, RLS y Security Advisors sin avisos.
- **Quedó pendiente o sin probar:** confirmar la publicación estática con sesión real, subir/abrir y organizar documentos en navegador, pruebas con varios usuarios. No hay documentos reales cargados.
- **Riesgos o decisiones que necesitan a Gari:** política de uso interno y datos de clientes a decidir con dirección; no requiere más cambios de código por esa decisión.
- **PR:** #17.

### 2026-11-04 · Desktop compartido con carpetas y archivos · ChatGPT
- **Qué cambió y por qué:** Gari confirmó la navegación por todas las carpetas de proyecto para todos los miembros activos, un Desktop común de oficina y la posibilidad técnica de subir todo tipo de archivos. Se prepara la integración de carpetas y subcarpetas, subida y lectura, cambio de nombre, movimiento y borrado con confirmación. Solo el autor o un admin puede modificar o borrar elementos existentes.
- **Archivos:** `app/work.js`, `app/office-desktop-ops.js`, `app/shell.js`, `app/index.html`, `app/office.css`, `supabase/migrations/20261104210000_office_desktop_v1.sql`, `tests/office-desktop.test.mjs`, `docs/ESTADO.md`, `docs/BITACORA.md`.
- **Base de datos:** migración `20261104210000_office_desktop_v1.sql` — aplicada en Supabase: **SÍ** mediante Supabase MCP (`office_desktop_v1`, versión registrada `20261104203250`).
- **Deploy de funciones:** ninguno.
- **Cómo se probó:** CI GitHub Actions 91/91 PASS; JS sintaxis verificada; migración validada y RLS probadas con altas, movimientos, ciclos y acceso de no miembros dentro de una transacción revertida; tablas, bucket privado y políticas comprobados tras aplicación; Security Advisors sin avisos.
- **Quedó pendiente o sin probar:** merge y publicación del frontend, E2E autenticada con varios usuarios reales, subida y apertura desde navegador, pruebas de archivos grandes y validación legal/política de uso por la dirección. La extracción de texto/indexación no forma parte de esta primera integración.
- **Riesgos o decisiones que necesitan a Gari:** hablar con la dirección del uso real de documentos confidenciales; aún sin política interna decidida. Revocar clave OpenAI antigua. SQL destructivo no ejecutado.
- **PR:** #16 (integrado en main).

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
