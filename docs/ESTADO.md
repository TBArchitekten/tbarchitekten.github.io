# TBA Office · Estado actual

**Actualizado:** 07.11.2026, por Claude: revisión de PR #16–#39, decisiones de Gari, correcciones (PR #41) y **un solo modelo de datos** (PR #42), en la sección siguiente. La versión anterior era del 05.11.2026, de ChatGPT, tras el PR #35.
Este archivo describe el estado *de ahora*. La historia de los cambios está en `docs/BITACORA.md`. Las reglas para agentes están en `AGENTS.md`.

---

## Revisión de Claude · 07.11.2026 (leer primero)
Revisión completa de PR #16–#39 (código, migraciones, Supabase en vivo, funciones, pruebas). Esta sección **corrige** datos de más abajo que quedaron viejos.

### Decisiones de Gari (07.11)
- **Window tendrá dos cuentas**, como cambiar de usuario en GitHub: **Persönlich** (Window) y **Office** (TBA Office). Cada cuenta tiene adentro lo suyo, y lo que se escribe va a la cuenta activa.
- **Kalender:** solo dos calendarios, Persönlich y Office. Se ven los dos en cualquiera de las cuentas.
- **Office recibe Threads y el conector de Claude**, como Window.
- **Akten:** se resuelve después. Antes hay que aclarar con la dirección el tema de datos de clientes.
- **Bernried y Schwarz se quedan en Window como están.** Mudarlos se ve en un paso posterior.
- **Desktop de Büro:** se queda como está, solo con los Desktops de proyecto.
- **Fuentes del Terminplan privadas:** es intencional. Como en un chat, los PDF que sube una persona no los ven otras.
- **Misiones de Romy:** ocultas hasta que puedan leer datos reales.
- **Un solo modelo de datos, el de Window** ("Sí, has la unificación con el modelo de Window").
- **Archivos compartidos:** todos los miembros activos pueden renombrar, mover y borrar archivos y carpetas de los Desktops de proyecto.

### Office dentro de la app de Window (desde el 07.11, PR #46 + Window)
- La app del iPhone de Window tiene dos cuentas: **Persönlich** (Window) y **Office** (este proyecto), con sesiones y datos separados.
- En la cuenta Office, la app carga `https://tbarchitekten.github.io/app/` y le presta la sesión de Office por el puente (`windowNative`, contrato v1 de Window).
  - La página no guarda sesión propia.
  - En el navegador todo sigue igual: se entra por la página raíz.
- Pestañas en la app: Romy · Heute · Kalender · Work · Tools. "Zu Persönlich wechseln" está en el menú "•••".
- **Kalender con los dos calendarios (PR #47):** dentro de la app, el Kalender de Office muestra también los eventos de Persönlich, rayados en gris y solo para leer.
  - La app los lee con su sesión de Window y solo pasa título y horas.
  - No entran en el estado: no se guardan, no se sincronizan y Romy no los ve.

### Kalender = calendario de tus proyectos (desde el 07.11, PR #51)
- **Qué muestra el Kalender:** de los proyectos en cuyo equipo estás, todas las tareas con fecha, las Fristen y los Termine con proyecto. Además, tus tareas personales y tus Termine.
  - Lo de colegas lleva sus iniciales. El filtro «Nur meine» deja solo lo tuyo.
  - Los Termine de otros son de solo lectura.
- **Heute** sigue siendo personal.
- **Persönlich** nunca llega a Office: solo existe en la app de Window de Gari.

### Conector de Claude para Office (desde el 07.11, PR #49)
- `office-mcp`: Claude trabaja en Office con el login de cada persona, bajo la RLS de la oficina. Puede leer todo, documentos incluidos (decisión de Gari), y crear y cambiar tareas.
- Configuración y herramientas: `docs/OFFICE-CONNECTOR.md`. **Falta que Gari active el OAuth Server** en el panel de Supabase.
- **Threads en Office (PR #50):** pestaña Threads en Work, privada como en Window.
  - Cada Thread es una conversación con Romy ligada al proyecto, guardada en `minds_work_threads`, y solo la ve su dueño.
  - Romy sabe de qué proyecto se trata.
  - No salen en la lista de chats de Romy.

### Resuelto el 07.11 (PR #42): un solo modelo de datos
- **Work vuelve a ser el `work.js` de Window** (Panorama, Desktop, Planner), sobre las tablas de Window:
  - tareas en `isabella_tasks`;
  - buckets en `minds_work_buckets`;
  - varios responsables en `minds_work_task_assignees`;
  - Desktop en `minds_work_folders` y `minds_work_files`.

  Heute, Kalender, la ficha de tarea, Work y Romy leen y escriben lo mismo, así que una tarea del Planner aparece en Heute y en el Kalender, y Romy ve los documentos del Desktop.
- **El equipo del proyecto es solo `office_project_members`**, el colaborativo que se elige en Projekte:
  - el botón "Team" del Planner abre el mismo diálogo de Projekte;
  - los responsables solo pueden ser del equipo, porque las claves foráneas apuntan a `office_project_members`;
  - si alguien sale del equipo, deja de ser responsable;
  - el equipo puede cambiar y borrar las tareas y los buckets de su proyecto (`private.office_in_project_team`).
- **Permisos probados** el 07.11 con dos miembros simulados, en una transacción revertida:
  - quien está en el equipo puede cambiar tareas y buckets del proyecto y asignarse;
  - quien no está en el equipo no puede cambiar tareas ni buckets, pero sí renombrar carpetas (archivos compartidos para todos);
  - asignar a alguien de fuera del equipo lo rechaza la clave foránea.
- **Archivos:** las políticas de `minds_work_folders`, `minds_work_files` y del Storage ya dejaban a todo miembro activo renombrar, mover y borrar. Era justo la regla que pidió Gari, así que no hizo falta cambiarlas.
- **Datos:** lo que había en las tablas solo de Office se copió con los mismos ids: 2 buckets, 1 tarea y 1 carpeta (migración `20261107064831_office_unify_window_model_v1`). Las tablas `office_tasks`, `office_task_buckets`, `office_task_assignees`, `office_project_folders` y `office_project_files` **siguen ahí, marcadas como obsoletas**, y `minds_work_project_people` queda sin uso. **Borrarlas necesita el OK explícito de Gari.**
- **Por qué ChatGPT había cambiado Work (PR #37):** desde el PR #16, la línea 93 de `work.js` llamaba `$('[data-work-view]').forEach(...)`; `$` devuelve un solo elemento, así que Work fallaba siempre con "Work konnte gerade nicht geöffnet werden". Ahora usa `$$`.
- **El "salto" que vio Gari** venía del PR #13 (de Claude): Tools y "Projekte verwalten" enlazaban a la página raíz, que tiene su propio menú. Desde los PR #24 y #35 todo está dentro de `/app`. Un recorrido simulado Romy → Work → Planner → Desktop → Romy → Work → Tools hace una sola navegación y no da errores.
- **Otros cambios:**
  - "+ Terminplan" en Panorama abre el diálogo de Projekte sin salir de Work;
  - si no hay proyectos, Work muestra "Noch keine Projekte" con un enlace a Projekte;
  - el selector Büro está oculto (`SHOW_BURO=false`), según la decisión de Gari;
  - `app/office-work.js` y `app/office-window-work-surface.js` se borraron.

### Resuelto el 07.11 (PR #41)
- **Costo de Romy:**
  - el modelo ve los **últimos 24 mensajes**, como Isabella en Window; lo anterior lo busca con `search_semantic_history` y `search_conversation_history`;
  - la hora va en el turno y no en las instrucciones, así el proveedor puede reutilizar (cachear) la parte fija del prompt.
- **Misiones:** las herramientas no se ofrecen a Romy (`ROMY_MISSIONS_ENABLED=false`) y el cron está pausado (migración `20261107062251`). Las tablas y el runner siguen ahí.
- **RLS de `office_task_assignees`:** la asignación tiene que ser del mismo proyecto que la tarea (migración `20261107062242`, probada en una transacción revertida antes y después).
- **Romy y archivos de entrada:** `inputRefs` usaba `uuid()` sin definirla, así que cualquier archivo referenciado fallaba. Corregido (lo encontró el comprobador de tipos).
- **Migraciones:**
  - los archivos llevan ahora la versión registrada en Supabase, sin duplicados;
  - las tres `20261028_*` del proyecto antiguo están en `supabase/legacy-migrations/`.
- **Textos:** el chat y la voz de Romy pasaron a alemán (antes decían "Enviando a Isabella…", "Escuchando…", etc.), igual que "eventos" en el panel Heute.
- **Deploy manual desde el repo (funciona desde el 07.11):** `.github/workflows/deploy-functions.yml` y `supabase/config.toml`, igual que en Window. GitHub → Actions → "Deploy Supabase Edge Functions" → Run workflow, con los nombres de las funciones.
  - **El token** `SUPABASE_ACCESS_TOKEN` está en el entorno `supabase` del repo.
  - Lo creó Gari desde su cuenta de Supabase (gari), pero es un token **de proyecto**: solo llega a TBA Office y solo con permiso de escritura en Edge Functions. Todo lo demás está en None, así que **no puede tocar Window** ni la base de datos.
  - Si algún día hace falta otro permiso, se edita el token en Supabase, no se crea uno más amplio.
  - Pendiente opcional: la cuenta TBArchitekten (martinez@bernhardarchitekten.com) está invitada como Developer a la organización y falta aceptar la invitación por correo. Sirve como segundo acceso de la oficina.
- **Romy y "heute" (PR #45):** `list_tasks` con `range:"today"`/`"week"` incluye lo vencido y las tareas de varios días en curso, como Window.
- **`office-assistant` v14** (07.11), publicada con el workflow desde `main`, con los archivos normales del repo. Lleva el límite de 24 mensajes, las misiones ocultas y el arreglo de `uuid()`.
  - La v13 de la mañana era la misma función, cargada con un envoltorio desde GitHub mientras no había token. La v14 la reemplazó.
  - **Cómo se comprobó:** la función arranca y responde `invalid_session` sin usuario, y 401 sin sesión.

### Estado real tras PR #37–#39 (no estaba en la bitácora)
> Los tres primeros puntos quedaron superados por el PR #42 (un solo modelo de datos, arriba). Se dejan como historia.
- ~~**Work ya no usa el `work.js` de Window.** Usa `app/office-work.js` y `app/office-window-work-surface.js` sobre `office_tasks`, `office_task_buckets`, `office_task_assignees`, `office_project_folders`, `office_project_files` y `office_project_members`.~~
- ~~**`office_tasks` y `office_task_buckets` están en uso.**~~ Desde el PR #42 están copiadas y obsoletas; aun así **no se borran sin el OK de Gari**.
- **Desktop de Büro:** la vista Büro está oculta; solo hay Desktops de proyecto, en `minds_work_folders` y `minds_work_files`.
- **Projekte:**
  - cualquier miembro activo crea proyectos, sin Projektleiter;
  - el equipo es `office_project_members`, colaborativo: lo cambian el creador, un admin o cualquier miembro del equipo;
  - los miembros del equipo pueden editar Terminpläne, tareas y buckets del proyecto.
- **Terminplan:**
  - las fuentes PDF e imágenes se guardan en el bucket privado `office-plan-sources`, y **solo las puede leer quien las subió**;
  - "PDF → Plan" reconstruye con propuesta y confirmación;
  - el plan de Bernried se reparó (revisión 7, con snapshot previo).
- **Funciones en vivo (07.11):**
  - `office-admin` v2;
  - `office-terminplan-ai` v8 (Terra, 25 consultas al día por persona);
  - `office-assistant` v12 (Romy, sin límite diario); **v14 desde el 07.11**, ver arriba;
  - `office-romy-mission-runner` v2, con cron cada 5 minutos.
- **Migraciones:**
  - las 27 del repo desde `20261104000000` están aplicadas en Supabase;
  - las tres `20261028_*` **no existen en este proyecto** (vienen del proyecto antiguo y su contenido quedó dentro de `office_base_v1`), así que la lista de §4 que las daba por aplicadas era un error mío del 04.11;
  - en el repo hay **timestamps duplicados** (`20261105144000` ×2 y `20261105152000` ×2): la CLI de Supabase fallaría con ellos.
- **Datos en vivo:** 1 miembro (Gari), 1 proyecto, 1 Terminplan, 1 tarea del Planner, 1 tarea del Kalender, 1 carpeta y 0 archivos de Desktop. Solo lo ha probado Gari.
- **Lo que está bien:**
  - JWT y comprobación de miembro activo en todas las funciones;
  - RLS en todas las tablas;
  - Security Advisor sin hallazgos;
  - claves solo en el servidor;
  - el secreto del cron es ilegible para los clientes;
  - CORS limitado a la página;
  - `store:false` en el chat;
  - 159 pruebas pasan y la CI está verde.

### Hallazgos (por prioridad)
> Estado: 1, 2, 3 y 5 resueltos en el PR #42; 4, 7 (historial), 8, 9 y 10 en el PR #41. 6 es intencional (decisión de Gari). Queda abierto el presupuesto de Romy (7).

1. **Dos sistemas de tareas.**
   - El Planner usa `office_tasks`; Heute, Kalender, la ficha de tarea y Romy usan `isabella_tasks`.
   - Por eso las tareas del Planner **no aparecen** en Heute ni en el Kalender, y Romy no las ve.
   - Al revés, las tareas que crea Romy no aparecen en el Planner.
2. **Dos Desktops.** Work guarda en `office_project_files`, pero `list_files`, `read_text_file` y los archivos de entrada de Romy leen `minds_work_files`, que está vacía. **Romy no ve los documentos del Desktop.**
3. **Dos equipos.** Work, Projekte y el Terminplan usan `office_project_members`; la ficha de tarea (desde Heute) usa `minds_work_project_people`. En la ficha, la lista de responsables de un proyecto sale vacía.
4. **RLS de `office_task_assignees`:** la política compara `t.project_id = t.project_id` (sombra de nombre), así que no comprueba que el proyecto de la asignación sea el de la tarea. El riesgo es bajo: se corrige calificando `office_task_assignees.project_id`.
5. **Permisos de archivos de proyecto inconsistentes:**
   - en Storage cualquier miembro puede borrar el archivo;
   - en la tabla solo el autor o el equipo;
   - las carpetas las puede cambiar o borrar cualquier miembro.
6. **Fuentes del Terminplan:** solo las lee quien las subió, así que un colega del equipo no puede reconstruir el plan con esas fuentes.
7. **Costo de Romy:**
   - no tiene límite (decisión de Gari);
   - en cada turno manda **todo** el historial de la conversación, y hasta 5 rondas por turno;
   - `web_search` está siempre disponible;
   - el Code Interpreter usa `gpt-6-astra`.

   El presupuesto mensual no está acordado y la cuenta de OpenAI sigue siendo la personal de Gari.
8. **Misiones:** el runner no tiene datos ni herramientas; solo razona sobre el objetivo y el resumen anterior. Hoy aporta poco y cada checkpoint cuesta. Sugerencia: ocultarlas hasta que puedan leer datos reales.
9. **Documentación:** los PR #37–#39 no tienen entrada en la bitácora, y partes de este archivo describen un estado viejo (por ejemplo, la §2 y la §4).
10. Quedan restos en español, como "eventos" en el panel Heute de la pantalla de Romy.

### Un solo modelo de datos (decidido: opción A, hecho en el PR #42)
Antes de probar con colegas había que unificar las tareas, el Desktop y el equipo en un solo modelo. Casi no había datos, así que costaba poco.
- **Opción A (recomendada):** usar el modelo de Window (`isabella_tasks`, `minds_work_*`) para todo, con `office_project_members` como único equipo (adaptando la RLS).
  - Heute, Kalender, la ficha y Romy ya lo usan.
  - Los Threads y el conector de Claude que vienen de Window se apoyan en el mismo esquema.
  - Work se apunta de nuevo a esas tablas, conservando lo que pidió Gari: equipo colaborativo, proyectos creados desde la app y acciones de Desktop.
- **Opción B:** dejar las tareas de proyecto en `office_tasks` y adaptar Heute, Kalender, la ficha y Romy para leerlas y crearlas ahí; las tareas personales seguirían en `isabella_tasks`. Es posible, pero se aleja del código de Window y obliga a mantener adaptadores para Threads y el conector.

## Integración Office #35 · frontend y backend publicados (05.11.2026)
PR #35 fusionado a `main` en el commit `369dab63038cb49fabd7523ddc295472492e15e3`. **La suite automatizada de `main` y el workflow de despliegue GitHub Pages finalizaron correctamente.** Sigue pendiente la aceptación funcional de empleados. En Supabase TBA Office sí se han desplegado office-assistant v12 y office-terminplan-ai v5 (JWT obligatorio), office-romy-mission-runner v2 (sin JWT en el gateway pero protegido por un secreto privado validado mediante RPC de servicio), el índice pgvector y las migraciones de misiones y su cron cada cinco minutos. No se declara paridad total con Window ni aceptación E2E.

**Navegación:** Tools ya no debe volver a la página raíz para «Projekte verwalten»; la versión publicada contiene una vista de proyectos dentro de /app/, con listado, creación bajo RLS, apertura de Work y acceso a planes. Los enlaces históricos #work y #project se redirigen tras autenticación. La entrada de Terminplan-Muster también se resuelve ahora en la nueva sección de /app; la raíz se conserva para compatibilidad, administración de miembros y cambio de contraseña. Queda pendiente verificar en navegador la experiencia integral.

**Terminplan:** se elimina el checkbox de activación manual de KI-Modus, se utiliza Terra (constante de core.mjs) cuando la Edge Function está disponible y se permite adjuntar PDF/JPEG/PNG/WebP a una discusión con máximo 3 archivos, 8 MiB por archivo y 12 MiB total. Los bytes se envían en la petición del empleado, no se persisten en mensajes. El servidor valida tipo, tamaño y firma, y no habilita web_search con fuente adjunta. El modelo solo propone y sigue operando con validación determinista y revisión humana. La edición de un plan completo desde PDF requiere contrastar fechas y aceptar las propuestas; no es una importación automática.

**Aceptación:** los tests automatizados y el primer E2E autenticado siguen siendo puertas separadas. La CI del merge, la inspección del diff y la revisión de RLS están superadas; el workflow de Pages completó build y deploy y el cron responde HTTP 200 sin misiones pendientes. Romy general_execution, DOCX/PDF/XLSX/PPTX, memoria, búsquedas y privacidad multiempleado siguen pendientes de E2E real. La memoria semántica está ya migrada y su función v12 desplegada; requiere E2E y backfill del historial más antiguo. El esquema de misiones persistentes y el worker están desplegados con aprobación explícita, leasing, cron, eventos y mensajes de entrega, pero su superficie es deliberadamente de análisis privado de solo lectura. No equivale todavía al ecosistema completo de Commitment/Workspace/Expectation de Isabella, ni autoriza escrituras de proyectos o envío a terceros. La integración funcional multidiaria requiere aceptación desde una cuenta de empleado. No ejecutar pruebas con clientes confidenciales sin la autorización interna correspondiente.

## 1. Qué es
- Es la página interna de Titus Bernhard Architekten: https://tbarchitekten.github.io
- **Repositorio:** `TBArchitekten/tbarchitekten.github.io`. Es público y se publica con GitHub Pages: todo lo que entra a `main` está en línea en ~1 minuto.
- **Backend:** Supabase, proyecto "TBA Office" (ref `ynzsbemisjvfgbqcqliq`, Frankfurt, plan Pro).
- **Idioma de la interfaz:** alemán. Gari escribe en español.
- **Contrato visual:** también el Assistent debe usar la interfaz de Window/Isabella (pantalla de chat, compositor, mensajes, voz, navegación responsive), sin inventar otra vista. La cuenta, el historial y los permisos son individuales en TBA Office, mediante backend independiente. PR #22 retira el chat paralelo creado por error en PR #18.
- **Origen:** la parte de Heute, Kalender y Work es una **copia del web app de Window** (la app personal de Gari, repo `gari01234/minds`, carpetas `apps/isabella` y `shared`, commit `34744c7`). Se copió el código para que se vea y funcione igual; los datos están separados.

**Navegación móvil:** el menú original de Window con cinco accesos (Romy, Heute, Kalender, Work, Tools) es la referencia en `/app/` y también en las páginas raíz de Terminplan/Projekte. El menú de cuenta permanece fuera de la barra inferior, y la administración de Projekte es accesible desde Tools. PR #26 integrado; aceptación visual Safari pendiente.

## 2. Mapa del código

| Parte | Archivos | Qué hace |
|---|---|---|
| Página de inicio | `index.html`, `app.js`, `office-core.js`, `office-config.js`, `style.css` | Inicio de sesión (correo y contraseña), `#password`, Projekte (`#work`, `#project=<id>`), Tools (`#tools`, `#plans` = Terminplan-Muster), Mitglieder (`#members`, solo admin). Sin `#` tras iniciar sesión, redirige a `./app/`. |
| App de la oficina (copia de Window) | `app/` y `shared/` | Heute (`ahora.js`), Kalender (`app.js`), Work con Panorama y Planner (`work.js`, `work-team.js`), ficha de tarea (`task-detail.js`, `task-team.js`), planificar tiempo (`time-plan.js`), marco y menú (`shell.js`), sincronización (`sync.js`). |
| Ajustes de oficina en la copia | `app/office-fristen.js`, `app/office.css`; `const OFFICE=true` en `app.js` y `work.js` | Fristen = hitos de los Terminpläne. Oculta lo que la oficina todavía no tiene. |
| Editor de Terminplan | `terminplan.html`, `terminplan-engine.js`, `terminplan-dialogue.js`, `window-editor.css` | Gantt por proyecto y fase (LPH), a partir de los Muster. Historia en `docs/TERMINPLAN-ASSISTENT-v0.1…v0.6.md`. |
| Funciones de Supabase | `supabase/functions/office-terminplan-ai` | Asistente IA del Terminplan. Modelo `gpt-6.1-terra` fijado en la rama #35; la versión de producción anterior todavía admite el override `TBA_OFFICE_OPENAI_MODEL` hasta desplegar la nueva Edge Function. La clave está en el secreto `TBA_OFFICE_OPENAI_API_KEY`, con cuota por persona. |
| | `supabase/functions/office-admin` | Alta de miembros y contraseña de inicio (solo admin). |
| | `supabase/functions/office-assistant` | Servicio personal Romy; ACTIVE v5 con JWT; historial privado por miembro, sin límite diario numérico impuesto; registro de solicitudes por empleado. |
| Base de datos | `supabase/migrations/` | Ver §4. |
| Pruebas | `tests/`, CI en `.github/workflows/terminplan-audit.yml` | `node --test tests/*.test.cjs tests/*.test.mjs` (87 pasan al 04.11). |

**Archivos de la copia de Window que no se cargan** (eliminados del repo): `ai.js`, `bandeja.js`, `ambient.js`, `akte-skills.js`, `credit*.js`, `situation.js`, `chat-stream-recovery.js`. Si se necesitan para la parte D, se vuelven a copiar de Window.

## 3. Cómo funciona la app (`./app/`)
- **Local primero:** cada persona tiene su estado en `localStorage` (`tba-office-window-v1`) y `sync.js` lo sincroniza con Supabase. Si en el mismo navegador inicia sesión otra persona, el estado local se vacía.
- **Sesión compartida:** la página de inicio y la app usan la misma clave de sesión (`tba-office-auth-v2`). Sin sesión, la app manda a `../`. También manda ahí a quien no es miembro activo o tiene que cambiar su contraseña de inicio.
- **Proyectos:** se leen de `isabella_projects`, una *vista* sobre `office_projects`. En la producción actual se administran desde la página raíz; la rama #35 traslada creación y acceso a la sección Projekte de `/app/`, dejando la raíz para compatibilidad y administración.
- **Kalender de cada persona:** sus tareas propias, las que tiene asignadas (`assignee_person_id` o lista de equipo) y sus propios Termine.
- **Categorías:** `arbeit` y `personal` por persona. Una tarea de proyecto sin categoría propia se muestra como Arbeit.
- **Equipo de proyecto:** se elige entre los miembros de la oficina (`isabella_people` = vista de `office_members`). Solo la dirección del proyecto y los admins lo cambian.
- **Oculto a propósito:** Eingang (Bandeja), Lecturas y Thoughts; el Assistent y Desktop están integrados, aunque siguen pendientes de aceptación con usuarios.

## 4. Base de datos y permisos
**Migraciones.** Desde el 07.11, cada archivo de `supabase/migrations/` lleva la versión que registró Supabase; esa carpeta es la lista completa y vigente. La lista de abajo es histórica: los nombres de archivo cambiaron y las tres `20261028_*` están ahora en `supabase/legacy-migrations/`. Lista histórica:
- `20261028_office_ai_quota_v1`
- `20261028_office_terminplan_dialogue_v1`
- `20261028_office_terminplan_server_revision`
- `20261104000000_office_base_v1`
- `20261104000100_office_password_flag_invoker`
- `20261104000200_office_seed_terminplan_templates`
- `20261104000300_office_planner_v1` (tablas `office_tasks` y `office_task_buckets`: usadas por Work del PR #37 al #41; desde el PR #42 copiadas a las tablas de Window y obsoletas. No borrar sin OK de Gari)
- `20261104000400_office_window_tables_v1`
- `20261104000500_office_window_fixes`
- `20261104210000_office_desktop_v1` (aplicada con Supabase MCP como versión `20261104203250`; incluye bucket privado `minds-work`)
- `20261104220000_office_assistant_personal_v1` (aplicada en Supabase, versión registrada `20261104205847`; 3 tablas, 7 políticas RLS).
- `20261104223000_office_assistant_remove_unapproved_daily_cap` (aplicada como versión Supabase `20261104213325`; sustituye la función de reserva sin cuota numérica diaria).
- `20261104232000_office_shared_desktop_edit_for_all` (PR #24; **aplicada en TBA Office como 20261104221830**): todos los empleados activos pueden renombrar/mover/borrar compartidos; personales aislados.
- `20261104232500_office_storage_scope_qualified_name` (aplicada como versión Supabase `20261104222033`; verificada)
- `20261104234500_office_romy_proposals_review_v1` (**aplicada**, Supabase versión `20261104224513`): propuestas privadas por miembro, acciones solo tras revisión.
- `20261104235500_office_romy_uploads_v1` (**aplicada**, Supabase versión `20261104230525`): bucket privado `office-romy-uploads`, políticas owner-only y adjuntos de conversación.

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

**Navegación (PR #24, integrada):** Tools ya funciona como sección de Window; la administración muestra la misma barra de cinco iconos. Validación visual en iPhone pendiente. Romy es el nombre público del asistente individual; los símbolos técnicos heredados `ISABELLA_*` siguen siendo compatibilidad interna, no otra asistente.

**Paridad de capacidades Romy/Isabella:** objetivo confirmado por Gari. La interfaz ya reutiliza Window y la ampliación del runtime en PR #25 incorpora streaming y una primera selección de herramientas, pero todavía no todas las capacidades de Isabella. No declarar D completa hasta aceptar sus capacidades reales una por una; reutilizar módulos de Window y aislar Supabase y permisos de empleado. No volver a inventar modos o cuotas.

## 5. Dónde estamos (05.11.2026)
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
| 4 | Romy individual para cada miembro activo | PR #25 y #27 integrados (tools, streaming, adjuntos privados); paridad total y aceptación real pendientes |
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
1. **Parte C · Desktop compartido (integrado; falta aceptación en navegador)** (PR #16 integrado en main; migración aplicada): un Desktop general de Büro y un Desktop dentro de cada proyecto, con carpetas, subcarpetas, archivos, renombrar, mover y eliminar con confirmación. **Todos los miembros activos pueden navegar por todos los proyectos**; el equipo de proyecto no limita la lectura. Todos pueden crear/subir. **Todos los miembros activos pueden renombrar, mover y borrar carpetas y archivos compartidos**, independientemente del autor; los archivos personales conservan el acceso individual (PR #24). Archivos en bucket privado `minds-work`, nunca en el repositorio público; metadatos en `minds_work_folders` y `minds_work_files`. Los adjuntos de tareas se vuelven visibles cuando la parte C esté publicada. No hay extracción de texto automática todavía. CI: 91/91 PASS; prueba SQL en transacción revertida PASS; aceptación con usuarios pendiente.
2. **Parte D · Romy individual (PR #18, #22, #25 y #27):** historial privado por empleado, interfaz de chat de Window, respuestas progresivas, selección automática de modelo con el router de Window, lectura por JWT de proyectos/tareas/calendario y archivos de texto, propuestas revisables de creación de tareas/terminos y adjuntos PDF/Office/imágenes con almacenamiento privado. La cuota diaria no autorizada se retiró, así como los modos manuales Schnell y Gründlich. **Todavía no hay paridad total con Isabella:** Word/PDF/TXT están integrados en PR #31 y la primera capa de Skills + recuerdos explícitamente confirmados está integrada en PR #32; todavía faltan XLSX/PPTX, el runtime general de artifacts, memoria semántica avanzada, trabajo persistente y otras herramientas; está pendiente E2E real de la integración y del proveedor con distintos tipos de archivo. PR #29 corrige envíos con solo archivos y calendario Europe/Berlin durante cambios DST; Edge Function `office-assistant` v7 activa con JWT, CI 120/120 PASS; aceptación de usuario pendiente. El presupuesto mensual sigue sin acordarse.

3. **Limpieza sin tocar tablas:** funciones del Planner retirado, enlace «‹ Projekte» en Terminplan y textos de interfaz en alemán. No borrar `office_tasks` ni `office_task_buckets` sin OK explícito.
4. **Opcional:** clima en Heute (Augsburg) y revisión de mensajes MINDS heredados.
5. **Aceptación conjunta con 1–2 colegas:** tras integrar C y D, comprobar Heute, Kalender, Planner, Terminplan, permisos, archivos y Assistent en escritorio y móvil. Gari también tiene pendiente revocar la antigua clave OpenAI del asistente anterior.

**Después:** vínculo Planner↔Terminplan, Planliste, Controlling LPH/horas, Kostenschätzung/Kostenberechnung, Projektakte y Microsoft M365, según la hoja de ruta de arriba.

**Documentos Romy en preparación:** generador DOCX/PDF original de Window integrado (PR #31), almacenamiento propietario en `office-romy-artifacts`, tool `create_document` y entrega mediante las tarjetas del chat. Generar un archivo no lo convierte en conocimiento confirmado de proyecto. Migración aplicada como versión `20261104235735`, Edge Function `office-assistant` ACTIVE v6, CI 116/116 PASS, Security Advisors sin avisos; interfaz integrada en PR #31; aceptación real en Safari aún pendiente.

**Romy ejecución general · PR #33 integrado:** se porta `_shared/capability-runtime.ts` de Window, manteniendo Code Interpreter, modelos de general_execution, archivos de entrada y salida, seguimiento/cancelación y procedencia. Nuevo registro owner-only `office_romy_capability_runs` vinculado a conversación y solicitud. Los resultados son privados hasta que un empleado decida compartirlos; recuperación al reabrir Romy mediante `capability_status` y tarjetas de artefactos de Window. No se introducen cuotas ni acceso a datos personales de Isabella. La ejecución del proveedor usa background=true, store=true; la persistencia del registro y los archivos NO significa todavía que Romy vigile objetivos durante días: esa misión/continuación autónoma requiere infraestructura posterior. Migración aplicada como Supabase `20261105054909`; Edge `office-assistant` ACTIVE v8 con JWT; CI 126/126 PASS; frontend integrado en main; E2E autenticado todavía pendiente.

**Romy recuperación contextual e investigación · PR #34:** se incorpora web_search nativo de Window con fuentes verificables, la Skill original `investigar` y las herramientas `search_conversation_history` (solo conversaciones del empleado, con fecha y procedencia) y `search_generated_artifacts` (solo archivos propios para reutilizar como entrada binaria del Capability Runtime). La consulta de archivos del Desktop admite scope=all para buscar entre proyectos compartidos. **No equivale todavía a memoria semántica avanzada:** la búsqueda conversacional es textual; nunca promueve automáticamente los mensajes a recuerdos aceptados. Tampoco hay un sistema de seguimiento autónomo de varios días; Missions/Commitments y el programador de Window continúan pendientes. CI 130/130 PASS, Edge `office-assistant` ACTIVE v9 con JWT; merge de frontend y E2E autenticado pendientes.

**Romy Skills y memoria privada · PR #32:** se porta sin cambios el normalizador `skill-registry.ts` de Window y cinco procedimientos originales (`organizar-dia`, `preparar-reunion`, `comunicacion-de-es`, `seguimiento`, `recordar-contexto`). Las Skills versionadas enseñan procedimientos, pero nunca dan autoridad adicional: herramientas de escritura siguen requiriendo revisión. La memoria solo acepta registros propuestos y confirmados por el propietario; conserva su conversación y solicitud de origen, permite desactivación no destructiva y aísla cuentas. No equivale todavía al motor semántico/memoria avanzada de Window. Migración aplicada (Supabase versión `20261105001450`), Edge Function v7 ACTIVE con JWT, CI 120/120 PASS; prueba E2E por empleado pendiente.

**Romy y archivos adjuntos:** el código Window para elegir archivos, normalizar imágenes y subir PDF/Office está integrado desde PR #27 (`office-romy-window-attachments-v1`), con bucket privado `office-romy-uploads` y RLS estricta por empleado. El backend pasa las referencias de adjuntos al modelo siguiendo el contrato `input_image`/`input_file` de Window, con carga autorizada por JWT. La aceptación con archivos reales sigue pendiente. Migración aplicada en TBA Office como versión Supabase `20261104230525`, Edge Function `office-assistant` ACTIVE v5 con JWT. CI 108/108 PASS. Aceptación de subida y lectura en Safari autenticado pendiente; no afirmarla antes del E2E. El historial visible conserva las referencias a los adjuntos. Frontend integrado en main con PR #27, CI 108/108 PASS; aceptación autenticada con documentos aún pendiente. La lectura multimodal de documentos en turnos posteriores y el resto de la paridad con Isabella siguen pendientes.

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
3. ¿Borrar las tablas obsoletas `office_tasks`, `office_task_buckets`, `office_task_assignees`, `office_project_folders`, `office_project_files` y `minds_work_project_people` (copiadas o sin uso desde el PR #42)? Requiere aprobación explícita.
4. ¿Clima en Heute?

## 9. Cómo probar
- **Pruebas automáticas:** `node --test tests/*.test.cjs tests/*.test.mjs`
- **Comprobar que los scripts cargan:** `for f in app/*.js shared/*.js app.js office-core.js; do node --check "$f"; done`
- **Manual:** iniciar sesión en https://tbarchitekten.github.io → se abre `/app/`. Probar Heute, Kalender, Work → Planner y el menú "•••" (Projekte verwalten, Terminplan-Muster, Mitglieder, Passwort ändern, Abmelden).
- **RLS:** en el SQL Editor, dentro de un bloque `do $$ … raise exception 'ROLLBACK' $$`, con `set_config('request.jwt.claims', …)` y `set local role authenticated`. Así nada queda guardado.
