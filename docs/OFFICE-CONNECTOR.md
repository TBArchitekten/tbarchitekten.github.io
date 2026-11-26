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
| `open_project` | lectura | Projektakte y **Projektwissen** del proyecto: páginas, decisiones, aportes pendientes y lo nuevo (solo con pertenencia al equipo) |
| `open_topic` | lectura | Un tema de la Projektakte (solo con pertenencia al equipo) |
| `share_knowledge` | escritura | Comparte con el proyecto lo trabajado en el chat, como aporte sin cambios y con su origen |
| `read_page`, `write_page` | lectura / escritura | Lee una página del Projektwissen; la escribe como estado actual (la versión anterior queda en el historial; con `basis` no pisa lo que otro escribió mientras tanto) |
| `record_decision` | escritura | Solo lo que vincula al proyecto (diseño, alcance, costes, fechas, lo que fija el Bauherr); las reglas de trabajo del equipo van a la página. «beschlossen» solo si lo decidió quien tiene que decidirlo (una recomendación al Bauherr queda propuesta hasta que la acepta) y quien lo anota dirige el proyecto |
| `search_knowledge`, `read_contribution` | lectura | Busca en páginas, decisiones y aportes; lee un aporte completo, paginado |
| `search_akte`, `turn_diagnostics` | lectura | Fuentes de la Akte con página; diagnóstico propio sin contenido |

Fuera por diseño: los chats con Romy y sus memorias, y los Threads (son privados).

## Pasar a un proyecto lo de un chat de Claude («pásalo al Office»)

Basta con decirlo cuando haya un resultado, no solo al final: al cerrar una investigación, al decidir algo o antes de dejar el chat unos días, también varias veces en el mismo chat (desde la segunda vez pasa solo lo nuevo o cambiado). Claude abre el proyecto, comparte lo trabajado como aporte (`share_knowledge`), lo integra en las páginas del **Projektwissen** (`read_page`, `write_page`: crea, une, actualiza y enlaza páginas, y marca las contradicciones), anota las decisiones (`record_decision`) y resume en 3–5 líneas qué cambió. El equipo lo lee en Work → **Wissen**, deja notas o correcciones, y la dirección del proyecto confirma las decisiones. Concepto, modelo y reglas: `PROJEKTWISSEN.md`.

Historia: el 26.11.2026 (#180) el conector guardaba lo de un chat como documentos en el Desktop del proyecto. Ese mismo día Gari decidió dejar el Desktop fuera (es el servidor de archivos de la oficina; cada uno deja ahí sus PDFs), y `close_session` y `file_document` se quitaron (#182) antes de que nadie los usara.

## Configuración (una sola vez)

1. **Deploy:** GitHub → Actions → **Deploy Supabase Edge Functions** → Run workflow con `office-mcp`. `config.toml` pone `verify_jwt = false`, porque la función tiene que responder ella misma el `401`; el workflow comprueba ese `401` después del deploy.
2. **Panel de Supabase (TBA Office) → Authentication → URL Configuration:** Site URL `https://tbarchitekten.github.io`.
3. **Authentication → OAuth Server:** activarlo. **Activado el 26.11.2026 (Gari):** Authorization Path `/oauth-consent.html`, «Allow Dynamic OAuth Apps» encendido. La Site URL es `https://tbarchitekten.github.io/` (con barra), así que la página queda en `…github.io//oauth-consent.html`; se abre bien igual, comprobado. El servidor no anuncia «Claude's published identity», así que en Claude se elige «Register automatically» si pregunta.
   - Authorization Path: `/oauth-consent.html`. Site URL más esta ruta tiene que dar la página de consentimiento.
   - Permitir el registro dinámico de clientes. Si no se permite, hay que crear un cliente a mano con redirect URI `https://claude.ai/api/mcp/auth_callback` y poner su Client ID en las opciones avanzadas de Claude.
4. **Claude → Settings → Connectors → Add custom connector:** nombre `TBA Office` y la URL de arriba → Connect → iniciar sesión → **Erlauben**.

## Revocar

Se desconecta en Claude, o se cierran las sesiones del conector en Supabase (Authentication → Users → sessions). Los tokens tienen todos los permisos de RLS de esa persona, porque el OAuth de Supabase todavía no tiene scopes. Lo que Claude puede ver y hacer lo limita el código del conector.
