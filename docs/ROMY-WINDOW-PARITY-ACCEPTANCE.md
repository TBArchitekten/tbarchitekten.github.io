# Romy × Window · Matriz de integración y aceptación
Fecha: 05.11.2026. Estado: trabajo de integración, no certificación de paridad.
Referencias: `docs/ESTADO.md`, `docs/BITACORA.md`, `apps/isabella/GENERAL-CAPABILITY-ACCEPTANCE-v0.1.md`, `apps/isabella/PERSISTENT-WORK-PROTOCOL-v0.1.md` y `apps/isabella/BUILD-81.md` del repositorio `gari01234/minds`.

## Contrato

Romy es la superficie conversacional de TBA Office. Reutiliza la interfaz, Skills y mecanismos generales de Window cuando sus fronteras de autorización son compatibles, pero nunca comparte el tenant, claves, memoria o datos personales de Isabella. Supabase TBA Office sigue siendo fuente de verdad. Un proyecto puede ser legible para miembros activos de la oficina según su RLS; una conversación, un recuerdo o un artefacto privado pertenece exclusivamente al empleado. La herramienta de lectura no crea autoridad de escritura. Una fuente externa, un texto conversacional y un archivo generado no se convierten automáticamente en hecho aprobado de proyecto.

La integración puede coordinarse en un único programa, pero cada gate tiene criterios de aceptación específicos. CI verde no significa flujo funcional autenticado. Una herramienta que aparece en el contrato del modelo no se considera operativa hasta comprobar el proveedor, el almacenamiento, el estado y la interfaz.

## Matriz de gates

| Gate | Alcance verificable | Estado 05.11.2026 | Falta |
|---|---|---|---|
| A · Núcleo de archivos | DOCX/PDF/TXT, XLSX/PPTX, editar artefacto existente, transformar archivo compartido, cancelar y reanudar | Integrado PR #31–#34; Romy v9 desplegada | Archivo real, descarga Safari, recarga navegador, pruebas con empleado |
| B · Titularidad | Conversaciones, recuerdos, entradas y archivos privados de Romy; Desktop compartido RLS | Migrations y controles SQL existentes | Ensayo con dos identidades reales, incluidos intentos denegados |
| C · Navegación única | Tools → Projekte sin montar la raíz; crear proyecto y Terminplan desde /app; regreso al proyecto | PR #35, rama draft | CI del último HEAD, visual Safari/desktop, sesión real |
| D · Terminplan documental | Terra disponible sin checkbox; adjuntar PDF/fotos, leer, contrastar con plan estructurado, producir propuestas revisables | PR #35, backend aún no desplegado | Probar PDF Gantt auténtico, legibilidad de fechas, coste/tokens, modelo real, aprobación y conflictos |
| E · Memoria semántica | Recuperación por significado con procedencia y distinción entre conversación y recuerdo aceptado | Migración pgvector aplicada, office-assistant v10 activa, pruebas de contrato en CI | E2E real con cuenta de empleado, indexación histórica mayor que ventana de 240 mensajes |
| F · Continuidad autónoma | Aprobación de objetivo privado, Mission Run, waits, checkpoints, cron y mensajes en conversación | Esquema y worker read-only desplegados, cron cada cinco minutos, CI de contratos aprobada | Aceptación multidiaria con empleado y adaptación posterior de Workspace/Expectation/acciones gobernadas, sin confundirlo con paridad completa |
| G · Composición de capacidades | Skills y herramientas documentales, planificación y fuentes; políticas revisables | Skills versión básica en PR #32 | Auditoría de paridad por herramienta, no por presencia en UI |
| H · Aceptación integral | iPhone Safari + escritorio + dos empleados: Heute, Kalender, Work, Tools, Terminplan y Romy | No completada | Casos funcionales reales + evidencia y registros auditables |

## Flujo de aceptación documental del Terminplan

El empleado abre un proyecto y su Terminplan desde la navegación Window y adjunta un PDF o fotos legibles de su estado actual. El usuario indica qué pretende conservar, comparar o rehacer. El backend del Terminplan valida JWT, membresía, titularidad/acceso al plan, revisión vigente y entrada multimodal; usa Terra y devuelve una discusión o una propuesta sin escribir en el plan.

Primero se comprueba que el modelo distingue cada dato legible en la fuente, aquello que está ausente y lo que sería deducción. La comparación debe referirse a actividades reales, hitos, fechas y dependencias del plan canónico; los dibujos no tienen autoridad directa. Si el PDF contiene más operaciones que el límite actual de propuesta por turno, Romy debe trabajarlas en rondas verificables o requerirá un importador de plan completo versionado, con diff de tareas y revisión humana. El límite actual del diálogo es ocho modificaciones/nuevas tareas por propuesta; no se afirmará reconstrucción total en un clic.

Una propuesta sólo se considera ejecutada si el usuario la revisa y confirma, la actualización conserva revisionado y se lee la versión resultante desde la fuente de verdad. El PDF original y los bytes de imagen no se guardan por defecto en la conversación del Terminplan. La transferencia de archivos al proveedor de IA se informa en la interfaz. No deben utilizarse documentos confidenciales de clientes en aceptación antes de disponer de autorización de la oficina.

## Implementación semántica candidata del PR #35

La rama introdujo y Supabase ya tiene aplicadas `office_romy_embeddings` y la RPC `office_romy_semantic_recall`, reutilizando el patrón de la memoria semántica de Window sin importar su tenant ni sus datos. Solo un servidor que ha leído los originales con el JWT del empleado puede insertar vectores; el empleado únicamente puede consultarlos. Las entradas se eliminan en cascada con las conversaciones/memorias originales y los vectores de recuerdos retractados se eliminan mediante trigger. La RPC vuelve a consultar los originales y exige `status='accepted'` para recuerdos. Los textos de conversaciones siguen siendo historia, no convicción aceptada.

La herramienta `search_semantic_history` calcula embeddings con `text-embedding-3-small`, utiliza RLS para obtener candidatos y trabaja de forma incremental, con hasta 24 entradas nuevas por petición, hasta 240 mensajes recientes y 60 recuerdos aceptados por ventana. No existe todavía un proceso independiente que complete el índice de todo un historial ilimitado. El objetivo es incorporar posteriormente backfill verificable, revisión de precisión y, si procede, recuperación contextual de pasajes circundantes. Nunca confundir código escrito o CI verde con migración aplicada y búsqueda funcional desde una sesión.

## Secuencia para completar la memoria

El módulo de recuerdos aceptados `office_romy_memories` no debe confundirse con `office_assistant_messages`. La evolución hacia memoria episódica mantiene mensajes originales, checkpoints y referencias a fragmentos verificables, sin convertir automáticamente un mensaje anterior en una preferencia confirmada. Recuperación lexical y semántica son estrategias de hallazgo; la procedencia, la identidad del empleado y el estado epistémico siguen siendo explícitos. Una búsqueda sobre conocimiento compartido de proyecto utiliza las RLS existentes del Desktop y no introduce por defecto permisos sobre conversaciones de otros empleados.

El gate incluirá recalls de preguntas indirectas (no sólo coincidencias exactas), hallazgo de la conversación original, contradicciones entre mensajes, aislamiento entre cuentas, citas del fragmento y comportamiento cuando la evidencia no existe. No se creará ningún resumen destructivo que sustituya las conversaciones originales.

## Secuencia para Persistent Work

Seguir la arquitectura original de Window sin trasladar sus datos: Commitment revisado → Workspace operativo → Mission Run con espera por hora, capability o Expectation revisada → reactivación por runner autorizado → entrega o petición de decisión. La ejecución subordinada no publica dos veces en el chat y no tiene autoridad adicional. El estado `waiting` es distinto de `waiting_for_user`; `due_unconfirmed` no prueba que un evento no ocurriera. Todo side effect externo requiere la política normal de propuesta/confirmación. Ningún runner puede acceder a archivos privados de otro empleado, promover artefactos a verdad de proyecto, alterar silenciosamente permisos o ejecutar en otro tenant.

El gate requiere una delegación humana explícita, una ejecución con archivo real, cierre del navegador, espera, reactivación, cancelación, idempotencia, detección de fallo del proveedor y restitución de estado desde Supabase. No alcanza con mantener el ID de una respuesta OpenAI.

## Estado verificable de despliegue del 05.11.2026

Las migraciones `office_romy_semantic_recall_v1`, `office_romy_persistent_work_v1`, `office_romy_mission_schedule_v1`, `office_romy_missions_indexes_v1` y `office_romy_mission_runner_timeout_v1` fueron aceptadas por Supabase TBA Office. Los servicios activos son `office-assistant` v10, `office-terminplan-ai` v5 y `office-romy-mission-runner` v1. Los dos primeros siguen exigiendo JWT. El runner usa un secreto aleatorio generado y retenido en schema privado; solo el rol service_role puede validar el secreto y reclamar o cerrar checkpoints. El cliente no puede insertar ni modificar misiones.

Una misión aprobada funciona sin navegador: el scheduler reclama trabajos cada cinco minutos, conserva el estado y, cuando necesita intervención o termina, produce un mensaje privado en la conversación original. Esta primera versión **no es** la composición completa de Mission Workspace / Expectations / Attention Economy de Isabella: procesa una investigación/planning read-only a partir de los objetivos aceptados y no lee por sí sola los ficheros del Desktop. La capacidad de generar y recuperar XLSX/PPTX sigue a cargo del Capability Runtime ya existente. Integrar ambos en un único mandato de larga duración requiere una aceptación posterior, no afirmada aquí.

Sin acceso a una sesión real de empleado no se puede verificar el resultado desde Safari, la descarga de artefactos, ni una respuesta real de Terra a un PDF auténtico de Bernried. Los tests de CI, la inspección de permisos SQL y el estado ACTIVE de las Edge Functions no prueban estos escenarios.

## Requisitos de salida

Cada gate deja SHA, PR, CI, migración, versión de Edge Function, alcance de RLS probado, versión del frontend y pruebas manuales pendientes en `ESTADO.md` y `BITACORA.md`. El merge en `main` publica GitHub Pages; las funciones Supabase requieren despliegue separado. Nunca anunciar como producción una rama ni como E2E una prueba del código. Un ajuste de modelos, cuotas, autorizaciones, compartición o retención no se añade sin una decisión expresa de Gari.
