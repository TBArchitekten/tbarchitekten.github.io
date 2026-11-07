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

Fuera por diseño: los chats con Romy y sus memorias. Las Akten y los Threads llegan después.

## Configuración (una sola vez)

1. **Deploy:** GitHub → Actions → **Deploy Supabase Edge Functions** → Run workflow con `office-mcp`. `config.toml` pone `verify_jwt = false`, porque la función tiene que responder ella misma el `401`; el workflow comprueba ese `401` después del deploy.
2. **Panel de Supabase (TBA Office) → Authentication → URL Configuration:** Site URL `https://tbarchitekten.github.io`.
3. **Authentication → OAuth Server:** activarlo.
   - Authorization Path: `/oauth-consent.html`. Site URL más esta ruta tiene que dar la página de consentimiento.
   - Permitir el registro dinámico de clientes. Si no se permite, hay que crear un cliente a mano con redirect URI `https://claude.ai/api/mcp/auth_callback` y poner su Client ID en las opciones avanzadas de Claude.
4. **Claude → Settings → Connectors → Add custom connector:** nombre `TBA Office` y la URL de arriba → Connect → iniciar sesión → **Erlauben**.

## Revocar

Se desconecta en Claude, o se cierran las sesiones del conector en Supabase (Authentication → Users → sessions). Los tokens tienen todos los permisos de RLS de esa persona, porque el OAuth de Supabase todavía no tiene scopes. Lo que Claude puede ver y hacer lo limita el código del conector.
