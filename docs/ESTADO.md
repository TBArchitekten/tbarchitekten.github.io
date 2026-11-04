# TBA Office · Estado actual

**Actualizado:** 04.11.2026, por Claude (traspaso a ChatGPT hasta el viernes 06.11, 20:00).
Este archivo describe el estado *de ahora*. La historia de los cambios está en `docs/BITACORA.md`. Las reglas para agentes están en `AGENTS.md`.

---

## 1. Qué es
- Es la página interna de Titus Bernhard Architekten: https://tbarchitekten.github.io
- **Repositorio:** `TBArchitekten/tbarchitekten.github.io`. Es público y se publica con GitHub Pages: todo lo que entra a `main` está en línea en ~1 minuto.
- **Backend:** Supabase, proyecto "TBA Office" (ref `ynzsbemisjvfgbqcqliq`, Frankfurt, plan Pro).
- **Idioma de la interfaz:** alemán. Gari escribe en español.
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
- **Oculto a propósito:** Assistent, Eingang (Bandeja), Lecturas, Thoughts, clima, feed, la pestaña Desktop y los adjuntos de tareas.

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

**Tablas principales:**
- `office_members`: `role` = `admin` | `projektleiter` | `member`; además `is_active` y `must_change_password`.
- `office_projects`: número, nombre, `status` `aktiv`/`archiviert`, `projektleiter_id`.
- `office_terminplan_templates` / `office_terminplan_instances`: el Terminplan es `state` jsonb, con `server_revision` para no pisar cambios.
- Tablas de Window: `isabella_tasks`, `isabella_events`, `isabella_categories`, `isabella_preferences`, `isabella_deleted_items`, `minds_work_buckets`, `minds_work_project_people`, `minds_work_task_assignees`, `minds_work_task_allocations`. Las vistas `isabella_projects` e `isabella_people` son de solo lectura.

**Reglas (RLS).** Los helpers `SECURITY DEFINER` están en el esquema `private`: `office_is_member`, `office_is_admin`, `office_can_lead`, `office_leads_project(uuid)`, `office_can_edit_plan`, `office_can_edit_window_task`, `office_can_edit_window_task_id`.
- Tareas y Termine **personales** (sin proyecto): solo los ve su autor.
- **Tareas de proyecto:** las leen todos los miembros. Las cambian el autor, quien está asignado (persona o equipo), la dirección del proyecto y los admins. Las borran el autor, la dirección y los admins.
- **Buckets:** los leen todos los miembros. Se crean solo en proyectos `aktiv`. Los cambian el autor, la dirección y los admins.
- **Equipo de proyecto:** solo la dirección y los admins.

## 5. Dónde estamos (04.11.2026)
- **Funciona y está publicado** (PR #10–#13): inicio de sesión, contraseñas, Projekte, Mitglieder, Terminplan con asistente, y la app (Heute, Kalender, Work → Panorama y Planner).
- **Probado:** con datos simulados en escritorio y teléfono (sin errores ni textos en español), consultas RLS en transacciones revertidas, y la página publicada sin sesión (manda al inicio de sesión).
- **No probado todavía con personas reales.** Al 04.11 solo existe la cuenta de Gari (admin) y **no hay proyectos** en la base de datos.

## 6. Lo que falta

### Hoja de ruta completa (acordada con Gari)
Las etapas para traer Window a la oficina:

| # | Etapa | Estado |
|---|---|---|
| 1 | Diseño y estructura como Window | ✔ hecho (PR #11) |
| 2 | Planner y Kalender | ✔ hecho (primero propio en PR #12; sustituido por la copia de Window en PR #13) |
| 3 | Heute (como "Ahora" de Window) | ✔ hecho (PR #13) |
| 4 | Assistent personal por persona (parecido a Isabella, con otro nombre) | pendiente = **parte D** |
| 5 | Desktop: fundamentos y guías de la oficina | pendiente = **parte C** |

La copia de Window se dividió en las partes A (tablas), B (marco, Kalender, Heute), C (Desktop) y D (Assistent). **A y B están hechas.** En el orden original el Assistent (4) iba antes que el Desktop (5); Gari decide cuál va primero.

**Después de las cinco etapas** (orden por decidir con Gari):
- Vincular las tareas del Planner con las actividades del Terminplan.
- Documentos estándar (plantillas de Planliste).
- Controlling por proyecto: honorario por LPH → presupuesto de horas frente a horas reales. Los Projektleiter cargan horas cada semana o cada dos (las horas ya viven en otra herramienta).
- Herramientas de costos: Kostenschätzung y Kostenberechnung.
- Projektakte (Steckbrief, Themenblätter, decisiones y Fristen), solo cuando esté aclarado legalmente.
- Inicio de sesión con Microsoft (M365) cuando haya acceso de admin.

**Reglas de base de Gari para todo lo anterior:**
- Nada de datos de clientes ni confidenciales en el sistema.
- La IA propone → vista previa → la persona confirma → el servidor comprueba.
- Las claves solo en el servidor, con límites de IA (hoy 25 consultas al día por persona en el Terminplan) y registro.
- Pruebas y deploys manuales.
- Vigilar el gasto de tokens.

### Próximos pasos concretos (en este orden)
1. **Gari:** crear 1–2 colegas en Mitglieder y un proyecto con un Terminplan. Probar en el navegador y en el iPhone: Heute, Kalender (Tag/Woche/Monat), Planner (bucket, tarea, asignar a un colega) y que el colega vea la tarea en su Heute. Anotar lo que falle en la bitácora. Además, revocar la clave antigua de OpenAI del asistente anterior.
2. **Decisión antes de la parte C** (ver §8, pregunta 1).
3. **Parte C · Desktop y adjuntos.** Según el plan, el Desktop es para los fundamentos y las guías de la oficina, no para documentos de clientes.
   - Copiar de Window (`gari01234/minds`, carpeta `supabase/migrations`) las tablas `minds_work_folders` y `minds_work_files`, adaptadas a `office_projects` y con RLS por pertenencia a la oficina o al proyecto.
   - Crear el bucket privado de Storage `minds-work` con políticas.
   - Las rutas que usa el código son `<user_id>/<project_id>/<folder|root|tasks>/...` (`app/work.js` líneas ~670 y ~1129, `app/task-detail.js` ~344). Leer debería permitirse a los miembros; subir, a cada persona en su carpeta.
   - Mirar si Window extrae texto de los archivos (búsqueda de duplicados, `index_status`) y decidir si la oficina lo necesita.
   - Al final, quitar `hidden` de la pestaña Desktop en `app/shell.js` y la regla de adjuntos en `app/office.css`.
4. **Parte D · Assistent:**
   - Chat y Threads de Window: `conversations`, `conversation_messages`, la función de chat y la cuota por persona.
   - Mismo esquema de modelos que Window: GPT-5.6 Luna para el día a día y GPT-5.6 Terra para turnos complejos.
   - Hay que decidir qué datos ve el asistente.
5. **Limpieza:**
   - Borrar `office_tasks` y `office_task_buckets` (requiere el OK de Gari, ver AGENTS.md).
   - Quitar de `office-core.js` las funciones del Planner antiguo (`mineForCalendar`, `tasksOnDay`, etc.) junto con sus pruebas en `tests/office-planner.test.mjs`.
   - El editor de Terminplan dice "‹ Work" pero vuelve a Projekte: cambiar a "‹ Projekte" (y su test en `tests/office-core.test.mjs`).
6. **Opcional:** clima en Heute (p. ej. open-meteo para Augsburg) y textos de error que todavía mencionan "MINDS" en rincones poco visibles.

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
- **No hay datos de clientes en el sistema.** El Desktop (parte C) cambia eso: ver §8.
- **Window es otra cosa** (otro repo y otro Supabase). En Window ya está hecho: Isabella usa gpt-5.6-luna para el día a día y gpt-5.6-terra para turnos complejos y análisis de documentos (PR #282, desplegado). El workflow de deploy usa `--yes` (PR #283).

## 8. Preguntas abiertas para Gari
1. **Desktop:** el plan dice "fundamentos y guías de la oficina", y la regla es nada de datos de clientes. Entonces:
   - ¿El Desktop se limita a documentos internos (estándares, guías, plantillas), visibles para toda la oficina?
   - ¿Tiene además un Desktop por proyecto, y con qué documentos permitidos?
   - ¿Qué límite de tamaño?
   - ¿Y los adjuntos de las tareas?
2. **Assistent en la oficina:** ¿para quién (todos o solo algunos), con qué presupuesto mensual y qué puede leer (tareas, Terminpläne, archivos)?
3. ¿Se pueden borrar ya las tablas vacías `office_tasks` y `office_task_buckets`?
4. ¿Quieres el clima en Heute?

## 9. Cómo probar
- **Pruebas automáticas:** `node --test tests/*.test.cjs tests/*.test.mjs`
- **Comprobar que los scripts cargan:** `for f in app/*.js shared/*.js app.js office-core.js; do node --check "$f"; done`
- **Manual:** iniciar sesión en https://tbarchitekten.github.io → se abre `/app/`. Probar Heute, Kalender, Work → Planner y el menú "•••" (Projekte verwalten, Terminplan-Muster, Mitglieder, Passwort ändern, Abmelden).
- **RLS:** en el SQL Editor, dentro de un bloque `do $$ … raise exception 'ROLLBACK' $$`, con `set_config('request.jwt.claims', …)` y `set local role authenticated`. Así nada queda guardado.
