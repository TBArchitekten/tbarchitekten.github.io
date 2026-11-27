// Office · welches OpenAI-Modell einen Zug von Romy in den Threads beantwortet (Aufbau wie in Window).
// Seit 27.11.2026 (Gari: «haz el cambio para todos»): GPT-6.1 Terra beantwortet die alltäglichen Züge,
// GPT-6.2 Sol die Züge, in denen ein falsches oder übersehenes Detail mehr kostet: komplexe Züge, normale
// und komplexe Züge in einem Work-Thread und das Lesen oder Vergleichen von Projektdokumenten.
// Vorher GPT-5.6 Luna und GPT-5.6 Terra. Das Einordnen eines Zugs bleibt beim kleinen Modell (index.ts).
// Secrets ersetzen beides ohne Deploy: TBA_OFFICE_ASSISTANT_MODEL (alltäglich), TBA_OFFICE_ASSISTANT_DEEP_MODEL.
export const FAST_MODEL="gpt-6.1-terra";
export const DEEP_MODEL="gpt-6.2-sol";

const clean=value=>String(value||"").trim();
export function fastModel(env){return clean(env&&env.OPENAI_MODEL)||FAST_MODEL}
export function deepModel(env){return clean(env&&env.OPENAI_DEEP_MODEL)||DEEP_MODEL}

// complexity comes from the router (light | standard | deep); depth from the turn budget.
export function chatTurnModel({complexity,depth,workThread,background,env}={}){
  if(background)return {model:fastModel(env),tier:"fast",reason:"background"};
  if(complexity==="deep"||depth==="deep")return {model:deepModel(env),tier:"deep",reason:"complex_turn"};
  if(workThread&&complexity==="standard")return {model:deepModel(env),tier:"deep",reason:"work_thread"};
  return {model:fastModel(env),tier:"fast",reason:workThread?"work_thread_quick":"everyday_turn"};
}

// Reading, extracting from and comparing project documents in Work.
export function documentModel(env){return deepModel(env)}
