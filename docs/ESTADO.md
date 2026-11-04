# TBA Office · Estado actual

**Actualizado:** 04.11.2026, por ChatGPT (PR #22 integrado: Assistent de TBA Office reutiliza el chat original de Window; prueba móvil real pendiente).
Este archivo describe el estado *de ahora*. La historia de los cambios está en `docs/BITACORA.md`. Las reglas para agentes están en `AGENTS.md`.

---

## 1. Qué es
- Es la página interna de Titus Bernhard Architekten: https://tbarchitekten.github.io
- **Repositorio:** `TBArchitekten/tbarchitekten.github.io`. Es público y se publica con GitHub Pages: todo lo que entra a `main` está en línea en ~1 minuto.
- **Backend:** Supabase, proyecto "TBA Office" (ref `ynzsbemisjvfgbqcqliq`, Frankfurt, plan Pro).
- **Idioma de la interfaz:** alemán. Gari escribe en español.
- **Contrato visual:** también el Assistent debe usar la interfaz de Window/Isabella (pantalla de chat, compositor, mensajes, voz, navegación responsive), sin inventar otra vista. La cuenta, el historial y los permisos son individuales en TBA Office, mediante backend independiente. PR #22 retira el chat paralelo creado por error en PR #18.
- **Origen:** la parte de Heute, Kalender y Work es una **copia del web app de Window** (la app personal de Gari, repo `gari01234/minds`, carpetas `apps/isabella` y `shared`, commit `34744c7`). Se copió el código para que se vea y funcione igual; los datos están separados.

## 2. Mapa del código

| Parte | Archivos | Qué hace |
|---|---|---|
| Página de inicio | `index.html`, `app.js`, `office-core.js`, `office-config.js`, `style.css` | Inicio de sesión (correo y contraseña), `#password`, Projekte (`#work`, `#project=<id>`), Tools (`#tools`, `#plans` = Terminplan-Muster), Mitglieder (`#members`, solo admin). Sin `#` tras iniciar sesión, redirige a `./app/`. |
| App de la oficina (copia de Window) | `app/` y `shared/` | Heute (`ahora.js`), Kalender (`app.js`), Work con Panorama y Planner (`work.js`, `work-team.js`), ficha de tarea (`task-detail.js`, `task-team.js`), planificar tiempo (`time-plan.js`), marco y menú (`shell.js`), sincronización (`sync.js`). |
| Ajustes de oficina en la copia | `app/office-fristen.js`, `app/office.css`; `const OFFICE=true` en `app.js` y `work.js` | Fristen = hitos de los Terminpläne. Oculta lo que la oficina todavía no tiene. |
| Editor de Terminplan | `terminplan.html`, `terminplan-engine.js`, `terminplan-dialogue.js`, `window-editor.css` | Gantt por proyecto y fase (LPH), a partir de los Muster. Historia en `docs/TERMINPLAN-ASSISTENT-v0.1…v0.6.md`. |
| Funciones de Supabase | `supabase/functions/office-terminplan-ai` | Asistente IA del Terminplan. Modelo `gpt-6.1-terra`; el secreto `TBA_OFFICE_OPENAI_MODEL` lo cambia sin deploy. La clave está en el secreto `TBA_OFFICE_OPENAI_API_KEY`, con cuota por persona. |
| | `supabase/functions/office-admin` | Alta de miembros y contraseña de inicio (solo admin). |
| | `supabase/functions/office-assistant` | Servicio de chat individual; ACTIVE v2 con JWT; historial privado por miembro, sin límite diario numérico impuesto; registro de solicitudes por empleado. |
| Base de datos | `supabase/migrations/` | Ver §4. |
| Pruebas | `tests/`, CI en `.github/workflows/terminplan-audit.yml` | `node --test tests/*.test.cjs tests/*.test.mjs` (87 pasan al 04.11). |

**Archivos de la copia de Window que no se cargan** (eliminados del repo): `ai.js`, `bandeja.js`, `ambient.js`, `akte-skills.js`, `credit*.js`, `situation.js`, `chat-stream-recovery.js`. Si se necesitan para la parte D, se vuelven a copiar de Window.

## 3. Cómo funciona la app (`./app/`)
- **Local primero:** cada persona tiene su estado en `localStorage` (`tba-office-window-v1`) y `sync.js` lo sincroniza con Supabase. Si en el mismo navegador inicia sesión otra persona, el estado local se vacía.
- **Sesión compartida:** la página de inicio y la app usan la misma clave de sesión (`tba-office-auth-v2`). Sin sesión, la app manda a `../`. También manda ahí a quien no es miembro activo o tiene que cambiar su contraseña de inicio.
- **Proyectos:** se leen de `isabella_projects`, una *vista* sobre `office_projects`. Se crean y editan solo en la página de inicio (Projekte).
- **Kalender de cada persona:** sus tareas propias, las que tiene asignadas (`assignee_person_id` o lista de equipo) y sus propios Termine.
- **Categorías:** `arbeit` y `personal` por persona. Una tarea de proyecto sin categoría propia se muestra como Arbeit.
- **Equipo de proyecto:** se elige entre los miembros de la oficina (`isabella_people` = vista de `office_members`). Solo la dirección del proyecto y los admins lo cambian.
- **Oculto a propósito:** Eingang (Bandeja), Lecturas y Thoughts; el Assistent y Desktop están integrados, aunque siguen pendientes de aceptación con usuarios.

## 4. Base de datos y permisos
**Migraciones**, todas aplicadas a Supabase al 04.11.2026:
- `20261028_office_ai_quota_v1`
- `20261028_office_terminplan_dialogue_v1`
- `20261028_office_terminplan_server_revision`
- `20261104000000_office_base_v1`
- `20261104000100_office_password_flag_invoker`
- `20261104000200_office_seed_terminplan_templates`
- `20261104000300_office_planner_v1` (tablas `office_tasks` y `office_task_buckets`, **sin uso**, ver §6)
- `20261104000400_office_window_tables_v1`
- `20261104000500_office_window_fixes`
- `20261104210000_office_desktop_v1` (aplicada con Supabase MCP como versión `20261104203250`; incluye bucket privado `minds-work`)
- `20261104220000_office_assistant_personal_v1` (aplicada en Supabase, versión registrada `20261104205847`; 3 tablas, 7 políticas RLS).
- `20261104223000_office_assistant_remove_unapproved_daily_cap` (aplicada como versión Supabase `20261104213325`; sustituye la función de reserva sin cuota numérica diaria).

**Tablas principales:**
- `office_members`: `role` = `admin` | `projektleiter` | `member`; además `is_active` y `must_change_password`.
- `office_projects`: número, nombre, `status` `aktiv`/`archiviert`, `projektleiter_id`.
- `office_terminplan_templates` / `office_terminplan_instances`: el Terminplan es `state` jsonb, con `server_revision` para no pisar cambios.
- Desktop: `minds_work_folders` y `minds_work_files` (Büro con `project_id` nulo, proyectos con su UUID; RLS de lectura compartida para miembros activos; las carpetas de tareas personales siguen privadas en Storage).
- Tablas de Window: `isabella_tasks`, `isabella_events`, `isabella_categories`, `isabella_preferences`, `isabella_deleted_items`, `minds_work_buckets`, `minds_work_project_people`, `minds_work_task_assignees`, `minds_work_task_allocations`. Las vistas `isabella_projects` e `isabella_people` son de solo lectura.

**Reglas (RLS).** Los helpers `SECURITY DEFINER` están en el esquema `private`: `office_is_member`, `office_is_admin`, `office_can_lead`, `office_leads_project(uuid)`, `office_can_edit_plan`, `office_can_edit_window_task`, `office_can_edit_window_task_id`.
- Tareas y Termine **personales** (sin proyecto): solo los ve su autor.
- **Tareas de proyecto:** las leen todos los miembros. Las cambian el autor, quien está asignado (persona o equipo), la dirección del proyecto y los admins. Las borran el autor, la dirección y los admins.
- **Buckets:** los leen todos los miembros. Se crean solo en proyectos `aktiv`. Los cambian el autor, la dirección y los admins.
- **Equipo de proyecto:** solo la dirección y los admins.

## 5. Dónde estamos (04.11.2026)
- **Integrado en main** (PR #10–#18): inicio de sesión, contraseñas, Projekte, Mitglieder, Terminplan con asistente, y la app (Heute, Kalender, Work → Panorama, Planner y Desktop). Desktop aún no tiene aceptación autenticada con personas reales.
- **Probado:** con datos simulados en escritorio y teléfono (sin errores ni textos en español), consultas RLS en transacciones revertidas, y la página publicada sin sesión (manda al inicio de sesión).
- **Desktop no probado todavía con personas reales.** Al 04.11 solo existe la cuenta de Gari (admin) y **no hay proyectos** en la base de datos.

## 6. Lo que falta

### Hoja de ruta completa (acordada con Gari)
Las etapas para traer Window a la oficina:

| # | Etapa | Estado |
|---|---|---|
| 1 | Diseño y estructura como Window | ✔ hecho (PR #11) |
| 2 | Planner y Kalender | ✔ hecho (primero propio en PR #12; sustituido por la copia de Window en PR #13) |
| 3 | Heute (como "Ahora" de Window) | ✔ hecho (PR #13) |
| 4 | Assistent individual para cada miembro activo | PR #18 integrado; backend activo; aceptación real pendiente |
| 5 | Desktop compartido de Büro y de cada proyecto, con carpetas y archivos | integrado en main (PR #16); aceptación con usuarios pendiente |

La copia de Window se dividió en las partes A (tablas), B (marco, Kalender, Heute), C (Desktop) y D (Assistent). **A y B están hechas.** Gari decidió integrar Desktop (C) antes del Assistent (D) y probar el conjunto con compañeros después.

**Después de las cinco etapas** (orden por decidir con Gari):
- Vincular las tareas del Planner con las actividades del Terminplan.
- Documentos estándar (plantillas de Planliste).
- Controlling por proyecto: honorario por LPH → presupuesto de horas frente a horas reales. Los Projektleiter cargan horas cada semana o cada dos (las horas ya viven en otra herramienta).
- Herramientas de costos: Kostenschätzung y Kostenberechnung.
- Projektakte (Steckbrief, Themenblätter, decisiones y Fristen), solo cuando esté aclarado legalmente.
- Inicio de sesión con Microsoft (M365) cuando haya acceso de admin.

**Reglas de base de Gari para todo lo anterior:**
- **Decisión técnica nueva (04.11):** Desktop permite subir cualquier tipo de archivo de trabajo, incluidos documentos de proyecto y de clientes. La autorización interna para su uso real se hablará con la dirección; esta decisión no equivale a aprobación de la oficina. El repositorio GitHub sigue sin datos confidenciales.
- La IA propone → vista previa → la persona confirma → el servidor comprueba.
- Las claves solo en el servidor, con límites de IA (hoy 25 consultas al día por persona en el Terminplan) y registro.
- Pruebas y deploys manuales.
- Vigilar el gasto de tokens.

### Próximos pasos concretos (orden revisado por Gari; Desktop integrado)
1. **Parte C · Desktop compartido (integrado; falta aceptación en navegador)** (PR #16 integrado en main; migración aplicada): un Desktop general de Büro y un Desktop dentro de cada proyecto, con carpetas, subcarpetas, archivos, renombrar, mover y eliminar con confirmación. **Todos los miembros activos pueden navegar por todos los proyectos**; el equipo de proyecto no limita la lectura. Todos pueden crear/subir. El autor y los admins pueden renombrar, mover y borrar. Archivos en bucket privado `minds-work`, nunca en el repositorio público; metadatos en `minds_work_folders` y `minds_work_files`. Los adjuntos de tareas se vuelven visibles cuando la parte C esté publicada. No hay extracción de texto automática todavía. CI: 91/91 PASS; prueba SQL en transacción revertida PASS; aceptación con usuarios pendiente.
2. **Parte D · Assistent individual (PR #18 y corrección visual PR #22):** un historial privado por empleado activo, con conversaciones persistentes. Modos Schnell y Gründlich. La cuota de 15 solicitudes diarias que ChatGPT impuso sin acuerdo ha sido retirada en Supabase; no se establece ningún nuevo máximo diario sin decisión de Gari. El registro de consumo y la deduplicación permanecen. Sin lectura automática de documentos, tareas ni calendarios, ni acciones sobre el sistema. Presupuesto mensual por decidir. Migración aplicada, Edge Function v2 activa y frontend integrado en PR #20. PR #22 sustituye la interfaz paralela por un adaptador de conversaciones sobre el chat original de Window: el chat se sigue representando mediante app.js y shell.js, sin almacenar mensajes en localStorage; historial privado accesible desde el menú. Esta corrección está integrada en main (PR #22, squash 68ee48c), con CI 95/95 PASS. Falta aceptación visual y funcional en Safari con cuentas autenticadas.
3. **Limpieza sin tocar tablas:** funciones del Planner retirado, enlace «‹ Projekte» en Terminplan y textos de interfaz en alemán. No borrar `office_tasks` ni `office_task_buckets` sin OK explícito.
4. **Opcional:** clima en Heute (Augsburg) y revisión de mensajes MINDS heredados.
5. **Aceptación conjunta con 1–2 colegas:** tras integrar C y D, comprobar Heute, Kalender, Planner, Terminplan, permisos, archivos y Assistent en escritorio y móvil. Gari también tiene pendiente revocar la antigua clave OpenAI del asistente anterior.

**Después:** vínculo Planner↔Terminplan, Planliste, Controlling LPH/horas, Kostenschätzung/Kostenberechnung, Projektakte y Microsoft M365, según la hoja de ruta de arriba.

## 7. Cuidado con
- **La copia de Window es un fork.** Si se trae código nuevo de Window, hay que volver a aplicar los cambios de oficina:
  - los flags `OFFICE`;
  - `sync.js` (puerta de miembros, proyectos de solo lectura, sin chat ni realtime, categorías con `onConflict:'user_id,client_key'`);
  - los textos en alemán y `de-DE`;
  - `office-fristen.js`;
  - el equipo hecho de miembros (`work-team.js`);
  - el menú de `shell.js`.

  Busca `OFFICE` y `TBA Office` en `app/`.
- **Las pruebas buscan patrones exactos en el código** (expresiones regulares). Si cambias una línea que prueban, el test falla: actualízalo a propósito.
- **Caché:** sube `?v=office…` en `app/index.html` cuando cambies archivos de `app/`.
- **Migraciones:** escribe el archivo en el repo **y** aplícalo en Supabase (SQL Editor o CLI), en orden. Una migración solo en el repo no hace nada; una solo en Supabase se pierde. Anota siempre cuál de las dos cosas hiciste.
- **Supabase pide confirmación a Gari** para SQL destructivo; sin su OK no se ejecuta.
- **Aún no hay datos de clientes en el sistema.** Al habilitar Desktop, técnicamente se admiten, pero el uso interno debe acordarse con la dirección. Toda la información binaria permanece en Supabase Storage privado.
- **Window es otra cosa** (otro repo y otro Supabase). En Window ya está hecho: Isabella usa gpt-5.6-luna para el día a día y gpt-5.6-terra para turnos complejos y análisis de documentos (PR #282, desplegado). El workflow de deploy usa `--yes` (PR #283).

## 8. Preguntas abiertas y decisiones
1. **Desktop (decidido 04.11):** carpeta común Büro + carpetas por proyecto; lectura para todos los miembros activos, sin limitarla al equipo. Todo tipo de documento técnicamente permitido. Pendiente decidir con dirección qué se sube realmente, y validar el límite de tamaño práctico en pruebas.
2. **Assistent en la oficina:** ¿para quién (todos o algunos), presupuesto mensual y qué puede leer (tareas, Terminpläne, archivos)?
3. ¿Borrar las tablas antiguas vacías `office_tasks` y `office_task_buckets`? Requiere aprobación explícita.
4. ¿Clima en Heute?

## 9. Cómo probar
- **Pruebas automáticas:** `node --test tests/*.test.cjs tests/*.test.mjs`
- **Comprobar que los scripts cargan:** `for f in app/*.js shared/*.js app.js office-core.js; do node --check "$f"; done`
- **Manual:** iniciar sesión en https://tbarchitekten.github.io → se abre `/app/`. Probar Heute, Kalender, Work → Planner y el menú "•••" (Projekte verwalten, Terminplan-Muster, Mitglieder, Passwort ändern, Abmelden).
- **RLS:** en el SQL Editor, dentro de un bloque `do $$ … raise exception 'ROLLBACK' $$`, con `set_config('request.jwt.claims', …)` y `set local role authenticated`. Así nada queda guardado.
