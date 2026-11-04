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

### 2026-11-05 · Romy: documentos reales reutilizando Window · ChatGPT
- Qué cambió y por qué: se porta el generador de Word y PDF de isabella-artifact de Window para crear entregables desde Romy, sin otra interfaz. Los documentos quedan privados por empleado y vinculados a la conversación/solicitud.
- Archivos: romy-documents.ts, romy-tools.mjs, office-assistant/index.ts, app/app.js, app/office-assistant.js, app/index.html, test nuevo y migración.
- Base de datos: office_romy_document_artifacts_v1 preparada; simulación SQL con rollback PASS (lectura owner, sin inserción de cliente, sin lectura anónima).
- Deploy de funciones: pendiente hasta CI.
- Cómo se probó: prueba transaccional RLS, tests automáticos en CI pendientes.
- Pendiente: merge, migración definitiva, deploy y aceptación auténtica en Safari. Los formatos XLSX/PPTX y el runtime general de Window aún no están portados.
- Riesgos o decisiones: no se agrega cuota ni modelo; un entregable generado no es verdad confirmada de proyecto y no se comparte automáticamente en el Desktop.
- PR: en preparación.


### 2026-11-05 · Cierre de robustez Romy v5 · ChatGPT
- Qué cambió y por qué: PR #29 integrado en main (squash 6aa9a063). El servidor permite enviar solo archivos sin romper CHECK de contenido, consulta calendarios por límites Europe/Berlin y exige offset explícito para las propuestas de citas.
- Archivos: docs/ESTADO.md, docs/BITACORA.md; código de PR #29 ya integrado.
- Base de datos: sin migración nueva; RLS y cupos inalterados.
- Deploy de funciones: office-assistant ACTIVE v5 con JWT, verificado en Supabase.
- Cómo se probó: CI 112/112 PASS; pruebas de cambio horario verano/invierno, fechas inválidas y adjuntos sin texto; Security Advisors sin advertencias.
- Quedó pendiente o sin probar: aceptación de Safari y pruebas E2E con sesiones reales; artifacts, Skills, memoria avanzada y trabajo persistente todavía no portados de Window.
- Riesgos o decisiones: no declarar paridad total ni afirmar que el proveedor ha procesado PDF/DOCX reales sin la prueba. No introducir cuotas.
- PR: #30 (solo cierre documental).


### 2026-11-05 · Romy: adjuntos sin texto y fechas Europe/Berlin · ChatGPT
- Qué cambió y por qué: revisión de PR #25–#28. Se detectó el fallo potencial de un mensaje compuesto solo por adjuntos debido al CHECK de texto no vacío. El calendario consultaba fechas UTC, no días de la oficina en Europe/Berlin, lo que podía omitir citas cercanas a medianoche. Las propuestas de eventos sin offset podían interpretarse en la zona horaria del servidor.
- Archivos: supabase/functions/office-assistant/index.ts, romy-tools.mjs, nuevo romy-time.mjs, tests/office-romy-time-and-attachment.test.mjs y docs.
- Base de datos: sin migración, conservando RLS y la validación de contenido existente.
- Deploy de funciones: `office-assistant` ACTIVE v5, JWT obligatorio y 7 archivos. No se introducen cuotas ni permisos nuevos.
- Cómo se probó: CI 112/112 PASS (DST, offsets, archivo sin mensaje), Edge v5 ACTIVE y Security Advisors sin advertencias. E2E Safari aún pendiente.
- Quedó pendiente: aceptación de los flujos completos en Safari, consultas reales y formatos PDF/Office; paridad restante en artifacts, Skills, memoria y trabajo persistente.
- Riesgos y decisiones: no se inventan horas ni se confirman horas sin zona; la zona de TBA Office es Europe/Berlin.
- PR: #29.


### 2026-11-04 · Cierre del PR #27: adjuntos privados de Romy · ChatGPT
- **Qué cambió y por qué:** PR #27 integrado en main (squash `ca12d910`). Picker, normalización y subida de archivos en el chat original de Window, adaptados a almacenamiento y sesiones individuales de TBA Office. Romy recibe `input_file`/`input_image` y almacena referencias privadas.
- **Archivos:** docs/ESTADO.md y docs/BITACORA.md; código y migración del PR #27.
- **Base de datos:** `office_romy_uploads_v1` aplicada como versión `20261104230525`; bucket privado, tres políticas de Storage y columna `attachments`.
- **Deploy de funciones:** `office-assistant` ACTIVE v4, `verify_jwt=true`, seis archivos.
- **Cómo se probó:** CI 108/108 PASS; SQL rollback con comprobación de propietario y usuario ajeno; Security Advisors sin avisos; referencia de frontend en `main` verificada.
- **Quedó pendiente o sin probar:** subida y lectura reales en Safari, formatos PDF/DOCX/imagen, prueba con dos empleados, seguimiento de adjuntos entre turnos y paridad funcional completa con Isabella (artifacts, skills, memory, trabajo persistente).
- **Riesgos o decisiones que necesitan a Gari:** no se cambia ninguna cuota ni permiso sin acuerdo; ningún documento confidencial se ha cargado durante las pruebas.
- **PR:** #28 (solo documentación).


### 2026-11-04 · Adjuntos del chat de Romy reutilizados de Window · ChatGPT
- **Qué cambió y por qué:** Gari exige recuperar las capacidades existentes de Isabella sin crear otra aplicación. Se reactiva el picker, preprocesador y uploader del chat original de Window; Romy almacena archivos en bucket privado por empleado y entrega imágenes/documentos al modelo con el mismo contrato de Window.
- **Archivos:** app/app.js, app/office-assistant.js, app/romy-transport.js, app/index.html, supabase/functions/office-assistant/index.ts, supabase/functions/office-assistant/romy-attachments.mjs, supabase/migrations/20261104235500_office_romy_uploads_v1.sql, tests/office-romy-attachments.test.mjs y documentación.
- **Base de datos:** migración `office_romy_uploads_v1` aplicada, versión Supabase `20261104230525`; bucket privado y columna de adjuntos con RLS.
- **Deploy de funciones:** `office-assistant` ACTIVE v4, JWT obligatorio; seis archivos de runtime desplegados.
- **Cómo se probó:** CI 108/108 PASS; SQL rollback PASS (bucket privado, dueño puede subir/leer, acceso ajeno denegado); esquema, políticas y función verificados live; Security Advisors sin avisos.
- **Quedó pendiente o sin probar:** merge y frontend web publicado; prueba E2E autenticada de PDF, imágenes y Office, historial de adjuntos, aceptación Safari y dos empleados.
- **Riesgos o decisiones que necesitan a Gari:** ninguna decisión de interfaz; se mantienen los formatos/tamaños de Window. No compartir adjuntos privados entre empleados.
- **PR:** #27.


### 2026-11-04 · Navegación única en la página raíz · ChatGPT
- **Qué cambió y por qué:** PR #24 ya establecía los cinco accesos (Romy, Heute, Kalender, Work y Tools) también en la página raíz. PR #26 separa el menú de cuenta de la barra inferior y adapta su forma y posición a la barra de Window, sin volver a duplicar Romy.
- **Archivos:** index.html, style.css, tests/office-navigation-parity.test.mjs, docs/ESTADO.md y docs/BITACORA.md.
- **Base de datos:** ninguna migración.
- **Deploy de funciones:** ninguno.
- **Cómo se probó:** test estático de paridad de navegación y CI pendiente.
- **Quedó pendiente o sin probar:** verificación en Safari iPhone y rutas Terminplan/Projekte.
- **Riesgos o decisiones que necesitan a Gari:** ninguna decisión de interfaz adicional; el objetivo es la navegación Window ya acordada.
- **PR:** #26.


### 2026-11-04 · Romy: capacidades supervisadas sobre la infraestructura de Window · ChatGPT
- Qué cambió y por qué: Gari exige Romy con las capacidades de Isabella, no un chat básico nuevo. Se reutilizaron directamente chat-model-routing.mjs y turn-capability-contract.mjs de Window, el parser SSE y la interfaz. Nuevo adaptador Office con herramientas autorizadas por RLS, lectura contextual, streaming y propuestas de tarea/Termin con aprobación.
- Archivos: supabase/functions/office-assistant/{index.ts,chat-model-routing.mjs,turn-capability-contract.mjs,romy-tools.mjs}, app/{romy-transport.js,office-assistant.js,office-assistant.css,app.js,index.html}, nueva migración de propuestas y tests.
- Base de datos: office_romy_proposals_review_v1 aplicada en TBA Office (Supabase `20261104224513`), comprobación RLS de titular y ausencia de permisos directos INSERT/UPDATE superada.
- Deploy de funciones: `office-assistant` ACTIVE v3 con JWT, 5 archivos (index.ts más cuatro módulos), sin tocar Window.
- Cómo se probó: CI 102/102 PASS; migración RLS en transacción revertida PASS; Supabase activo con Security Advisors sin lints; aceptación autenticada con usuario real pendiente.
- Quedó pendiente o sin probar: adjuntos y lectura binaria (PDF/DOCX), ejecución de artefactos, Skills/Missions, memoria proactiva, background, aceptación iPhone con dos empleados. **No declarar paridad completa**.
- Riesgos o decisiones: sin nuevas cuotas diarias ni selector manual de modelos; acciones explícitamente confirmadas por empleado, RLS revalidada en el servidor. No conectar a Supabase de Window.
- PR: #25, pendiente de integración.

### 2026-11-04 · Romy y paridad de navegación/compartidos · ChatGPT
- Qué cambió y por qué: Gari exige un único sistema de navegación coherente con Window, Desktop editable por todos y el nombre Romy. PR #24 hace Tools una sección en la shell Window; unifica la barra de la página raíz, elimina la restricción autor/admin para archivos compartidos, corrige duplicados sin proyecto.
- Archivos: app/shell.js, app/app.js, app/index.html, app/office.css, app/work.js, app/office-desktop-ops.js, index.html, style.css, tests, docs y migración SQL.
- Base de datos: migración office_shared_desktop_edit_for_all.sql aplicada (20261104221830); se detectó y corrigió en migración adicional office_storage_scope_qualified_name.sql el sombreado de `name` por `office_projects.name` en políticas Storage. La segunda migración se aplicó en versión `20261104222033`; las tres políticas verificadas sin sombreado de nombre.
- Deploy de funciones: ninguno en este PR.
- Cómo se probó: CI final PASS (98 pruebas); SQL rollback PASS y Security Advisors sin advertencias. No hay aceptación E2E con varias cuentas.
- Quedó pendiente o sin probar: aceptación Safari en iPhone, dos cuentas activas, operación de archivos reales, paridad funcional completa del runtime Romy con Isabella.
- Riesgos o decisiones: la autorización de editar y eliminar archivos compartidos es expresa de Gari; personales conservan privacidad. Romy/Window es una exigencia de paridad total; no declarar que se ha alcanzado.
- PR: #24 en preparación.

### 2026-11-04 · Cierre de paridad visual del Assistent · ChatGPT
- Qué cambió y por qué: PR #22 integrado en main (squash 68ee48c). Se eliminó la interfaz de chat paralela y se restauró la reutilización del chat original de Window para cada empleado de la oficina.
- Archivos: docs/ESTADO.md y docs/BITACORA.md.
- Base de datos: sin cambios, conversaciones privadas por usuario conservadas.
- Deploy de funciones: ninguno, office-assistant ACTIVE v2 continúa.
- Cómo se probó: CI 95/95 PASS, verificación de referencias en main, CSS anterior ya no oculta el chat de Window.
- Quedó pendiente o sin probar: prueba visual en Safari móvil y primera respuesta autenticada; adjuntos no habilitados en el backend de Office.
- Riesgos o decisiones que necesitan a Gari: ninguna decisión nueva de interfaz; Window sigue siendo el contrato visual.
- PR: #23.


### 2026-11-04 · Restitución de la interfaz Window del Assistent · ChatGPT
- **Qué cambió y por qué:** Gari mostró capturas comparando el chat de Office con Window e identificó una divergencia contra el contrato de reutilización. En PR #18 se había creado y mostrado un chat nuevo en lugar de usar la interfaz existente. La corrección elimina esa pantalla paralela y conecta el compositor, mensajes y navegación originales al backend individual de TBA Office.
- **Archivos:** app/app.js, app/office-assistant.js (adaptador de datos, no UI paralela), app/office-assistant.css (solo ajustes discretos), app/index.html, tests/office-assistant.test.mjs, AGENTS.md, docs/ESTADO.md y docs/BITACORA.md.
- **Base de datos:** sin cambios; las conversaciones permanecen privadas por usuario en Supabase.
- **Deploy de funciones:** ninguno; se conserva office-assistant ACTIVE v2.
- **Cómo se probó:** sintaxis JS verificada; CI y aceptación visual móvil/autenticada pendientes.
- **Quedó pendiente o sin probar:** CI, integración del PR y pruebas en móvil con cuenta real; audio y archivos solo cuando el backend tenga soporte verificado. Menú de conversaciones utiliza modal de Window.
- **Riesgos o decisiones que necesitan a Gari:** ninguna decisión adicional para respetar el diseño ya acordado. No inventar una UI distinta por empleado.
- **PR:** #22, en preparación.


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
