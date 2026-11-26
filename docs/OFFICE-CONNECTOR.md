# Conector de TBA Office para Claude (MCP remoto)

Permite que Claude (claude.ai en web, escritorio y móvil) trabaje dentro de TBA Office con el login de cada persona. Es el mismo diseño que el conector de Window. Decisión de Gari del 07.11.2026: Claude puede leer todo lo que la persona puede ver, documentos incluidos.

- **Servidor:** `supabase/functions/office-mcp`, con Streamable HTTP y sin estado. Las herramientas están en `office-tools.mjs`.
- **URL para pegar en Claude:** `https://ynzsbemisjvfgbqcqliq.supabase.co/functions/v1/office-mcp`
- **Autenticación:** OAuth 2.1 con el servidor OAuth de Supabase Auth del proyecto TBA Office.
  - Sin token, la función responde `401` con `WWW-Authenticate: Bearer resource_metadata=".../office-mcp/.well-known/oauth-protected-resource"`.
  - El token es un JWT de Supabase de esa persona, así que todo corre bajo la RLS de la oficina.
  - Solo entran miembros activos que ya cambiaron el Startpasswort.
- **Página de consentimiento:** `oauth-consent.html` → `https://tbarchitekten.github.io/oauth-consent.html`. En alemán, con correo y contraseña de la oficina; usa la misma sesión que la página de inicio.

## Herramientas

| Herramienta | Tipo | Qué hace |
| - | - | - |
| `overview` | lectura | Hoy: tareas que vencen o están vencidas (también las de varios días en curso), eventos propios de hoy y mañana, Fristen de las próximas 3 semanas, proyectos |
| `list_projects` | lectura | Proyectos activos |
| `project_context` | lectura | Equipo, buckets, tareas abiertas, Fristen, carpetas y archivos del Desktop (con ids) |
| `list_deadlines` | lectura | Fristen = hitos de los Terminpläne activos |
| `search_files` | lectura | Busca por nombre de archivo y de carpeta en los Desktops de proyecto |
| `read_file` | lectura | Texto de un archivo, paginado: PDF (unpdf), Word (mammoth), Excel (SheetJS), correos y texto. Se lee al momento; no se guarda nada |
| `list_tasks` | lectura | `today` / `week` / `open` / `done_recent`; `mine` deja solo las propias o asignadas |
| `list_events` | lectura | Calendario propio entre dos fechas, como máximo 120 días |
| `create_task`, `update_task` | escritura | Tareas reales. Con proyecto van al Planner del equipo; sin proyecto son personales |
| `open_project`, `open_topic` | lectura | Projektakte del proyecto (solo con pertenencia al equipo) y, desde el 26.11, los temas guardados en el Desktop con su último Stand (`themen_im_desktop`, `letzter_stand`) |
| `search_akte`, `turn_diagnostics` | lectura | Fuentes de la Akte con página; diagnóstico propio sin contenido |
| `close_session` | escritura | **Thema festhalten:** el estado de un tema del proyecto («Lichtplanung», «Bodenbelag») como documento con fecha en la carpeta del tema, en el Desktop del proyecto |
| `file_document` | escritura | **Dokument ablegen:** un texto (resumen, Recherche, nota, protocolo, carta, correo) como documento Markdown en el Desktop del proyecto |

Fuera por diseño: los chats con Romy y sus memorias, y los Threads (son privados).

## Pasar a un proyecto lo de un chat de Claude (26.11.2026)

Decisión de Gari: lo que se ha trabajado con Claude en un chat (Lichtplanung, Bodenbelag …) se pasa al proyecto con una frase («pásalo al Office», «leg das ab») y **lo ve todo el equipo del proyecto**. Como el Panorama del Office todavía no muestra la Projektakte (Steckbrief, registro de decisiones), todo va al **Desktop del proyecto**, que el equipo ya usa; la KI del Office lo lee como cualquier archivo del Desktop.

- **Por tema, una carpeta con estados fechados:** `close_session` guarda «261126 Stand Lichtplanung.md» con Stand, Entscheidungen, Offene Fragen, Nächste Schritte, Fristen y Quellen. Cada estado es completo: las decisiones se acumulan; las demás listas se sustituyen cuando se dan. Lo no decidido de forma explícita sale como «vorgeschlagen». Los campos van también en `metadata.themenblatt` del archivo: así el siguiente estado parte del anterior y `open_topic` lo devuelve sin descargarlo.
- **Un tema nuevo** solo con `neues_thema: true`, después de acordar el título; si el nombre se parece a uno existente («Lichtplanung 3. BA»), se usa ese.
- **Documentos:** `file_document` en la carpeta indicada, en la del tema o según el tipo (Dokumente, Recherchen, Notizen, Protokolle, Briefe, E-Mails). Las carpetas son las del equipo: si ya hay una con ese nombre, se usa.
- **Nada se sobrescribe ni se borra:** cada guardado es un archivo nuevo (`upsert: false`); el mismo contenido no se guarda dos veces en el proyecto, lo haya guardado quien lo haya guardado.
- **Solo el equipo del proyecto:** la misma comprobación que la Akte (`office_project_members`); Storage y RLS lo exigen además.
- **Leitfaden «Was darf ins TBA Office?»:** las instrucciones del conector piden alemán y prohíben sueldos y datos de personal, documentos de identidad, datos bancarios, salud, contraseñas, textos de normas (DIN) y lo que el cliente quiera solo en papel; datos privados de clientes o vecinos, solo si el proyecto los necesita.
- Las Fristen pasan al Planner como tareas solo si la persona lo pide (`create_task`).

## Configuración (una sola vez)

1. **Deploy:** GitHub → Actions → **Deploy Supabase Edge Functions** → Run workflow con `office-mcp`. `config.toml` pone `verify_jwt = false`, porque la función tiene que responder ella misma el `401`; el workflow comprueba ese `401` después del deploy.
2. **Panel de Supabase (TBA Office) → Authentication → URL Configuration:** Site URL `https://tbarchitekten.github.io`.
3. **Authentication → OAuth Server:** activarlo. **Estado 26.11.2026: todavía apagado** (`/auth/v1/.well-known/oauth-authorization-server` responde «OAuth server is disabled»); sin este paso Claude no puede conectar.
   - Authorization Path: `/oauth-consent.html`. Site URL más esta ruta tiene que dar la página de consentimiento.
   - Permitir el registro dinámico de clientes. Si no se permite, hay que crear un cliente a mano con redirect URI `https://claude.ai/api/mcp/auth_callback` y poner su Client ID en las opciones avanzadas de Claude.
4. **Claude → Settings → Connectors → Add custom connector:** nombre `TBA Office` y la URL de arriba → Connect → iniciar sesión → **Erlauben**.

## Revocar

Se desconecta en Claude, o se cierran las sesiones del conector en Supabase (Authentication → Users → sessions). Los tokens tienen todos los permisos de RLS de esa persona, porque el OAuth de Supabase todavía no tiene scopes. Lo que Claude puede ver y hacer lo limita el código del conector.
