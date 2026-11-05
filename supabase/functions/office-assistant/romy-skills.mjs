// Window apps/isabella/skills/*/SKILL.md: source procedures preserved.
// Office adapters only state actual tool availability and employee context.
export const ROMY_SYSTEM_SKILLS=Object.freeze([
  {
    "slug": "investigar",
    "name": "investigar",
    "description": "Investiga, verifica o explica temas que requieren información actual, varias fuentes o una síntesis profunda.",
    "version": 1,
    "instructions": "# Investigar un tema\\n\\n1. Decide qué requiere web y qué puede resolverse con conocimiento general.\\n2. Verifica afirmaciones actuales con fuentes fiables.\\n3. Si hay desacuerdo, explica las diferencias.\\n4. Respuesta directa primero; evidencia después.\\n5. Incluye fuentes útiles sin saturar.\\n6. Si se pide profundidad, compara perspectivas.\\n7. Usa memoria personal solo cuando sea pertinente.\\n8. Prioriza estructura clara y legible.\\n\\nOffice adapter: web_search es una herramienta nativa de consulta de OpenAI; no puede escribir Office. Las fuentes externas no son memoria ni acuerdos confirmados.",
    "preferred_tools": ["web_search","search_conversation_history","search_personal_memory"]
  },
  {
    "slug": "organizar-dia",
    "name": "organizar-dia",
    "description": "Organiza, prioriza o reordena el día o la semana, encuentra huecos y resuelve conflictos.",
    "version": 1,
    "instructions": "# Organizar mi día\n\nConvierte agenda y tareas en un plan realista sin sobrecargar el día.\n\n1. Consulta la agenda si el contexto no es suficiente.\n2. Distingue compromisos fijos, tareas movibles y tareas de día completo.\n3. Respeta categorías, proyectos y preferencias conocidas.\n4. Detecta conflictos y huecos útiles.\n5. Pregunta duración solo cuando sea necesaria para colocar una tarea.\n6. No conviertas una tarea de día completo en evento por tener recordatorio con hora.\n7. Cuando la persona empleada narre su día y formule acciones inequívocas con intención temporal —por ejemplo “tengo que”, “debo”, “quiero terminar hoy”, “mañana haré”, o una reunión con fecha/hora— no te limites a devolver un plan en texto: prepara en el mismo turno las propuestas correspondientes de tareas y eventos usando las herramientas canónicas. No esperes a que la persona empleada diga “agrégalo”.\n8. No conviertas deseos vagos, ideas exploratorias o posibilidades en agenda. Si una acción es clara pero falta un dato imprescindible para crearla, pregunta únicamente ese dato; si el dato no es imprescindible para una tarea, déjala sin fecha antes que inventar una.\n9. Agrupa las propuestas de un mismo relato diario para que la revisión sea una sola operación humana siempre que la interfaz lo permita. La confirmación sigue siendo obligatoria: proactividad no equivale a autoridad.\n10. Para una semana, distribuye primero obligaciones fijas y después trabajo profundo, llamadas y tareas pequeñas.",
    "preferred_tools": [
      "list_calendar",
      "list_tasks",
      "propose_create_task",
      "propose_create_event"
    ]
  },
  {
    "slug": "preparar-reunion",
    "name": "preparar-reunion",
    "description": "Prepara un Termin, Besprechung, llamada o reunión combinando agenda, Work, Threads, documentos y deliverables cuando realmente hagan falta.",
    "version": 2,
    "instructions": "# Preparar una reunión\n\nObjetivo: llegar a la reunión con el contexto correcto, las decisiones visibles y el material utilizable ya preparado, sin convertir conversación o documentos en verdad de proyecto por accidente.\n\n1. Identifica reunión, proyecto, fecha/hora y personas solo a partir de evidencia disponible.\n2. Consulta agenda cuando el contexto temporal no esté ya claro.\n3. Si pertenece a Work, recupera primero el estado estructurado del proyecto y después los Threads relevantes; una conversación de Thread sigue siendo conversación, no un claim confirmado.\n4. Lee archivos concretos solo cuando su contenido sea material para preparar la reunión. No hagas lectura masiva de carpetas.\n5. Separa explícitamente hechos confirmados, información de documentos, conversaciones previas, inferencias y preguntas abiertas.\n6. Sintetiza un briefing con: objetivo, estado actual, asuntos abiertos, decisiones necesarias, responsabilidades/follow-ups y preguntas que conviene llevar.\n7. Si la finalidad requiere un objeto utilizable —agenda, Teilnehmerliste, protocolo, tabla de seguimiento o material de apoyo— usa el Capability Runtime general para producirlo; no sustituyas el entregable por instrucciones.\n8. Un artifact generado sigue siendo un deliverable, no conocimiento confirmado del proyecto.\n9. Si surgen tareas derivadas, propónlas por la vía normal y conserva la confirmación existente.\n10. No inventes participantes, acuerdos, plazos ni decisiones. Conserva vocabulario arquitectónico y técnico alemán cuando corresponda.\n11. Compón con otras Skills solo si aportan un procedimiento distinto y necesario; por ejemplo, investigación externa actual o comunicación profesional posterior.\n\nOffice adapter: Work Threads are not available in Office. Use real project/task/calendar evidence and authorized files. For actual Excel, PowerPoint, Word or PDF deliverables, use execute_artifact_task (Window general_execution), with actual files and status evidence; create_document remains available for simple DOCX/PDF/TXT. Do not claim unavailable evidence.",
    "preferred_tools": [
      "list_calendar",
      "list_projects",
      "list_files",
      "read_text_file",
      "create_document",
      "execute_artifact_task",
      "propose_create_task"
    ]
  },
  {
    "slug": "comunicacion-de-es",
    "name": "comunicacion-de-es",
    "description": "Redacta, corrige, traduce o responde comunicación profesional en alemán y español, especialmente para arquitectura.",
    "version": 1,
    "instructions": "# Comunicación profesional DE/ES\n\n1. Detecta el idioma de salida por contexto.\n2. Conserva nombres, proyectos y vocabulario técnico.\n3. En alemán profesional usa formulaciones naturales y concisas.\n4. Mantén un tono directo, cordial y profesional.\n5. Si responde a un mensaje, cubre todos sus puntos.\n6. No inventes compromisos, fechas, adjuntos ni decisiones.\n7. Usa fuentes disponibles y recuerdos personales confirmados cuando sean relevantes.\n8. Entrega texto listo para copiar salvo que se pidan alternativas.",
    "preferred_tools": [
      "list_projects",
      "read_text_file",
      "create_document"
    ]
  },
  {
    "slug": "seguimiento",
    "name": "seguimiento",
    "description": "Detecta pendientes, respuestas esperadas, decisiones abiertas y follow-ups que merecen atención.",
    "version": 1,
    "instructions": "# Seguimiento de pendientes\n\n1. Consulta tareas, calendario y memoria relevante.\n2. Distingue pendiente explícito, respuesta esperada, decisión abierta y recomendación.\n3. Prioriza por dependencia y vencimiento.\n4. Evita duplicados.\n5. Si conviene crear tarea o recordatorio, propón y confirma.\n6. Si no hay nada relevante, dilo sin inventar actividad.\n7. La salida debe ser breve, accionable y contextual.\n\nOffice adapter: future notifications and persistent monitoring are not enabled yet. Propose tasks for confirmation, but do not claim a watch was scheduled.",
    "preferred_tools": [
      "list_calendar",
      "list_tasks",
      "propose_create_task"
    ]
  },
  {
    "slug": "recordar-contexto",
    "name": "recordar-contexto",
    "description": "Recupera decisiones, conversaciones, personas, proyectos, preferencias y relaciones de la historia personal.",
    "version": 1,
    "instructions": "# Recordar contexto personal\n\n1. Busca memoria cuando la conversación actual no baste.\n2. Si hay fechas o acciones, consulta también agenda.\n3. Busca por entidades y relaciones, no solo por palabras idénticas.\n4. Distingue recuerdo explícito, inferencia e incertidumbre.\n5. Ante contradicciones, favorece lo más reciente o explica el conflicto.\n6. No conviertas conocimiento externo en memoria personal.\n7. Guarda relaciones estables útiles cuando emerjan.\n8. No obligues al usuario a repetir información ya disponible.\n\nOffice adapter: search_personal_memory returns only owner-reviewed memories, not semantic search across all prior turns. Cite the actual source and gaps.",
    "preferred_tools": [
      "search_personal_memory",
      "search_conversation_history",
      "list_calendar",
      "list_projects"
    ]
  }
]);
export function listRomySystemSkills(){
 return ROMY_SYSTEM_SKILLS.map(({slug,name,description,version})=>({slug,name,description,version,source:"system"}));
}
export function findRomySystemSkill(slug){
 return ROMY_SYSTEM_SKILLS.find(s=>s.slug===String(slug||"").trim())||null;
}
