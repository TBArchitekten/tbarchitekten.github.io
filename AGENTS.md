# Instrucciones para agentes (ChatGPT, Codex, Claude u otros)

Este repositorio es la página interna de Titus Bernhard Architekten (TBA Office). Lo trabajan por turnos varias IA y Gari. Para que nadie empiece a ciegas, cada cambio deja constancia escrita.

## Antes de empezar
1. Lee `docs/ESTADO.md` completo: qué existe, dónde estamos, qué falta y con qué hay que tener cuidado.
2. Lee las últimas 5 entradas de `docs/BITACORA.md`.
3. Si algo de lo que vas a hacer contradice ESTADO.md o una decisión de la bitácora, pregunta a Gari antes.

## Al terminar cada cambio (en el mismo PR)
1. **Añade una entrada al principio de `docs/BITACORA.md`** con la plantilla que hay al inicio del archivo. Escríbela aunque el cambio sea pequeño o haya quedado a medias.
2. **Actualiza `docs/ESTADO.md`** si cambió algo de lo que describe: lo hecho, lo pendiente, las migraciones aplicadas o las preguntas abiertas. Pon la fecha y el autor arriba.
3. Si dejas algo sin probar o sin aplicar (una migración, un deploy), escríbelo con claridad en ambos archivos. El siguiente agente no lo sabrá de otra forma.

Si trabajas sin acceso al repositorio (un chat normal), termina dándole a Gari la entrada de bitácora ya escrita, para que la pegue él.

## Reglas que no se negocian
- **Nunca pidas a Gari que pegue contraseñas, tokens ni claves en el chat.** Las claves viven en Supabase (Secrets) o en el panel del proveedor. En el navegador solo existe la clave publicable de `office-config.js`.
- **El repositorio es público** (GitHub Pages). No escribas aquí datos de clientes, correos personales ni nada confidencial, tampoco en los docs.
- **Paridad funcional además de visual.** Reutilizar modelos, transporte SSE, contratos de tools, comprobaciones de permisos y workflows de Isabella por módulo; comprobar dependencias y adaptar a Supabase Office antes de activar. No llamar 'equivalente a Isabella' a un runtime que no lo es. Ninguna cuota, selector de modos o nuevo límite de conversación sin acuerdo explícito. **D1 (08.11.2026):** la creación de una tarea o un Termin explícitamente dictado se permite directamente solo con autorización y recibo verificables en el servidor, y Deshacer limitado a esa creación. **D2 sigue desactivado:** mover, completar, archivar o borrar requiere propuesta + confirmación + autorización server-side. En el runtime heredado, hasta activar el motor nuevo, siguen vigentes sus controles de confirmación.
- **Paridad visual y de interacción con Window.** TBA Office reutiliza la interfaz de chat, compositor, mensajes, navegación y responsive de Window. Para adaptar datos de oficina, crea un adaptador al backend y modifica mínimamente la capa existente; no construyas una segunda interfaz de asistente ni ocultes la original sin decisión expresa de Gari. Separación de datos/personas en backend, no duplicación de UI.
- **Office y Window están separados.** Window (gari01234/minds) es la app personal de Gari. De ahí se puede copiar código, pero nunca datos ni conexiones a su Supabase. Las tablas de Bernried y el proyecto antiguo de Supabase no se tocan.
- **SQL destructivo** (DROP, DELETE, TRUNCATE, quitar columnas o políticas) solo con el OK explícito de Gari para ese cambio concreto.
- **Toda tabla nueva lleva RLS** con los helpers `private.office_*`, probada en una transacción que se revierte.
- Las migraciones van en `supabase/migrations/` con nombre `AAAAMMDDhhmmss_descripcion.sql`. Anota en la bitácora si ya se aplicaron a Supabase y cómo.
- Las pruebas nunca llaman a producción. Corre `node --test tests/*.test.cjs tests/*.test.mjs` antes de cada PR. Si un test deja de cuadrar, actualízalo a conciencia; no lo borres.
- La interfaz de la oficina está en **alemán** y las fechas en formato `de-DE`.
- Si cambias un JS o CSS, sube su `?v=` en el HTML que lo carga. GitHub Pages guarda en caché.
- Cambios en `main` = publicados en ~1 minuto. Trabaja en una rama y abre un PR.

## Phase 6 · Romy Live und Office-MCP (08.11.2026)
Die echte Live-WebRTC-Sitzung verwendet ausschließlich den JWT des angemeldeten Office-Mitglieds, prüft aktive Mitgliedschaft und abgeschlossenes Startpasswort und bleibt an den serverseitigen Office-Profilvertrag gebunden. Browser-Sprachausgaben sind keine bestätigten Assistentenantworten und dürfen keine Aktionen oder Faktenbehauptungen legitimieren. Der offizielle Chat ist der einzige Weg für bestätigte Aufträge und Belege. `office-mcp` führt Projektakte-Lesezugriffe nur für explizite Projektteammitglieder aus, Diagnosen ausschließlich für den angemeldeten Besitzer. Die Originalstimme von Isabella und iPhone-Office-Push bleiben deaktiviert. Diese Regeln dürfen bei späterer Synchronisierung nicht gelockert werden.
