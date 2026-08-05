/**
 * seed-workout-muscles.mjs
 *
 * Popula `workout_muscles` — quais músculos cada exercício do catálogo recruta,
 * com papel (primary/secondary/stabilizer) e ênfase 0–100.
 *
 * Rodar DEPOIS de `docs/migrations/20260805-muscle-anatomy.sql`:
 *   node scripts/seed-workout-muscles.mjs           # aplica
 *   node scripts/seed-workout-muscles.mjs --dry-run # só relatório, não escreve
 *
 * Requer .env na raiz com VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 * (`workout_muscles` só aceita escrita de service role para o catálogo — a RLS
 * libera a anon key apenas nos exercícios que o próprio usuário criou).
 *
 * ── Estratégia em duas camadas ─────────────────────────────────────────────
 *
 *  1. CURADORIA (`CURATED`): mapa exercício → músculos escrito à mão, casado
 *     pelo nome normalizado (sem acento, minúsculo). Cobre os exercícios de
 *     academia mais usados — é onde está o valor real da feature ("quais pegam
 *     a porção superior do peito?").
 *
 *  2. FALLBACK (`GROUP_FALLBACK`): todo exercício não curado recebe as linhas
 *     genéricas do seu `muscle_group`. Assim NENHUM exercício fica sem
 *     anatomia — a tela nunca mostra vazio, ela mostra o grosso e vai ficando
 *     mais fina conforme a curadoria cresce.
 *
 * Reexecutável: faz upsert por (workout_id, muscle_id) e REMOVE as ligações
 * que não pertencem mais ao exercício, então corrigir o mapa aqui e rodar de
 * novo é o fluxo normal de manutenção.
 *
 * Exercícios de ALONGAMENTO e MOBILIDADE são pulados de propósito: recrutar
 * não é alongar, e marcá-los como "treino de X" poluiria o volume por músculo.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const raw = readFileSync(resolve(__dirname, "../.env"), "utf-8");
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const DRY_RUN = process.argv.includes("--dry-run");

/** Normaliza nome para casar com o catálogo: minúsculo, sem acento, sem espaço duplo. */
function norm(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Camada 1 — curadoria
// ---------------------------------------------------------------------------
// Formato: "nome do exercício": [[muscle_id, role, emphasis], ...]
// role: p = primary · s = secondary · e = stabilizer (estabilizador)
//
// Regras que guiaram os números:
//  - Ângulo define a porção do peito: inclinado → clavicular; declinado e
//    crossover de cima para baixo → abdominal; reto/máquina → esternal.
//  - Cabeça longa do tríceps só é bem recrutada com o ombro em flexão (braço
//    acima da cabeça) ou estendido — daí testa/francês/overhead com ênfase alta
//    e pulley/pushdown puxando lateral e medial.
//  - Pegada supinada e barra fixa "chin-up" puxam mais bíceps que pronada.
//  - Remada horizontal → trapézio médio/romboides; puxada vertical → latíssimo.

const CURATED = {
  // ── Peito ────────────────────────────────────────────────────────────────
  "supino reto": [["peitoral_esternal","p",80],["peitoral_clavicular","s",40],["deltoide_anterior","s",35],["triceps_cabeca_lateral","s",30],["triceps_cabeca_medial","s",30]],
  "supino reto com barra": [["peitoral_esternal","p",80],["peitoral_clavicular","s",40],["deltoide_anterior","s",35],["triceps_cabeca_lateral","s",30],["triceps_cabeca_medial","s",30]],
  "supino com halteres": [["peitoral_esternal","p",80],["peitoral_clavicular","s",35],["deltoide_anterior","s",35],["triceps_cabeca_lateral","s",25],["manguito_rotador","e",20]],
  "supino inclinado com halteres": [["peitoral_clavicular","p",85],["deltoide_anterior","s",45],["peitoral_esternal","s",35],["triceps_cabeca_lateral","s",25]],
  "supino inclinado com barra": [["peitoral_clavicular","p",85],["deltoide_anterior","s",45],["peitoral_esternal","s",35],["triceps_cabeca_lateral","s",25]],
  "supino inclinado na maquina": [["peitoral_clavicular","p",80],["deltoide_anterior","s",40],["peitoral_esternal","s",30],["triceps_cabeca_lateral","s",20]],
  "supino declinado com barra": [["peitoral_abdominal","p",85],["peitoral_esternal","s",45],["triceps_cabeca_lateral","s",30],["deltoide_anterior","s",15]],
  "supino declinado com halteres": [["peitoral_abdominal","p",85],["peitoral_esternal","s",45],["triceps_cabeca_lateral","s",30],["deltoide_anterior","s",15]],
  "supino na maquina": [["peitoral_esternal","p",75],["peitoral_clavicular","s",30],["deltoide_anterior","s",30],["triceps_cabeca_lateral","s",25]],
  "crucifixo com halteres": [["peitoral_esternal","p",80],["peitoral_clavicular","s",30],["deltoide_anterior","s",20],["manguito_rotador","e",20]],
  "crucifixo na maquina": [["peitoral_esternal","p",80],["peitoral_clavicular","s",25],["deltoide_anterior","s",15]],
  "crucifixo no cabo": [["peitoral_esternal","p",75],["peitoral_abdominal","s",40],["deltoide_anterior","s",20]],
  "crucifixo no trx": [["peitoral_esternal","p",70],["deltoide_anterior","s",25],["transverso_abdominal","e",30]],
  "crossover no cabo": [["peitoral_abdominal","p",80],["peitoral_esternal","s",55],["deltoide_anterior","s",15]],
  "flexoes de braco": [["peitoral_esternal","p",70],["triceps_cabeca_lateral","s",40],["deltoide_anterior","s",35],["transverso_abdominal","e",30]],
  "flexao de braco": [["peitoral_esternal","p",70],["triceps_cabeca_lateral","s",40],["deltoide_anterior","s",35],["transverso_abdominal","e",30]],
  "flexao pegada fechada": [["triceps_cabeca_lateral","p",70],["triceps_cabeca_medial","p",65],["peitoral_esternal","s",45],["deltoide_anterior","s",25]],
  "flexao com palma": [["peitoral_esternal","p",70],["triceps_cabeca_lateral","s",40],["deltoide_anterior","s",30]],
  "flexao declinada": [["peitoral_clavicular","p",70],["deltoide_anterior","s",40],["triceps_cabeca_lateral","s",35]],
  "flexao inclinada": [["peitoral_abdominal","p",65],["peitoral_esternal","s",45],["triceps_cabeca_lateral","s",30]],
  "flexao hindu": [["peitoral_esternal","p",55],["deltoide_anterior","s",45],["triceps_cabeca_longa","s",30],["eretores_espinha","s",25]],
  "trap press": [["peitoral_esternal","p",70],["triceps_cabeca_lateral","s",45],["deltoide_anterior","s",30]],

  // ── Costas ───────────────────────────────────────────────────────────────
  "puxada na frente": [["latissimo_dorsal","p",85],["redondo_maior","s",50],["biceps_cabeca_curta","s",35],["trapezio_inferior","s",30],["braquial","s",25]],
  "puxada alta no cabo": [["latissimo_dorsal","p",80],["redondo_maior","s",45],["biceps_cabeca_curta","s",30],["trapezio_inferior","s",30]],
  "puxada fechada": [["latissimo_dorsal","p",80],["biceps_cabeca_curta","s",45],["redondo_maior","s",40],["braquial","s",30]],
  "puxada fechada supinada": [["latissimo_dorsal","p",75],["biceps_cabeca_curta","p",60],["biceps_cabeca_longa","s",45],["redondo_maior","s",35]],
  "puxada no pulley pegada fechada": [["latissimo_dorsal","p",80],["biceps_cabeca_curta","s",45],["redondo_maior","s",40]],
  "puxada modificada": [["latissimo_dorsal","p",70],["redondo_maior","s",40],["biceps_cabeca_curta","s",30]],
  "barra fixa": [["latissimo_dorsal","p",90],["redondo_maior","s",55],["biceps_cabeca_curta","s",40],["trapezio_inferior","s",35],["transverso_abdominal","e",25]],
  "barra fixa pegada larga": [["latissimo_dorsal","p",90],["redondo_maior","s",60],["trapezio_inferior","s",35],["biceps_cabeca_curta","s",25]],
  "barra fixa pegada neutra ou remada trx": [["latissimo_dorsal","p",85],["biceps_cabeca_curta","s",45],["braquial","s",35],["redondo_maior","s",40]],
  "barra fixa (chin-up)": [["latissimo_dorsal","p",85],["biceps_cabeca_curta","p",60],["biceps_cabeca_longa","s",45],["redondo_maior","s",40]],
  "remada baixa": [["latissimo_dorsal","p",70],["trapezio_medio","p",65],["romboides","s",55],["deltoide_posterior","s",35],["biceps_cabeca_curta","s",30]],
  "remada curvada": [["latissimo_dorsal","p",75],["trapezio_medio","p",60],["romboides","s",55],["eretores_espinha","e",45],["deltoide_posterior","s",35]],
  "remada curvada com halteres": [["latissimo_dorsal","p",70],["trapezio_medio","p",60],["romboides","s",50],["eretores_espinha","e",40],["deltoide_posterior","s",35]],
  "remada curvada pegada supinada": [["latissimo_dorsal","p",75],["biceps_cabeca_curta","s",50],["trapezio_medio","s",50],["romboides","s",45]],
  "remada unilateral com halter": [["latissimo_dorsal","p",80],["trapezio_medio","s",50],["romboides","s",45],["deltoide_posterior","s",30],["obliquos","e",25]],
  "remada na maquina": [["latissimo_dorsal","p",70],["trapezio_medio","p",60],["romboides","s",50],["deltoide_posterior","s",30]],
  "remada na maquina pegada supinada": [["latissimo_dorsal","p",70],["biceps_cabeca_curta","s",45],["trapezio_medio","s",50],["romboides","s",45]],
  "remada sentada no cabo": [["trapezio_medio","p",65],["latissimo_dorsal","p",65],["romboides","s",55],["deltoide_posterior","s",30]],
  "remada t-bar": [["latissimo_dorsal","p",75],["trapezio_medio","p",65],["romboides","s",55],["eretores_espinha","e",40]],
  "remada no trx": [["trapezio_medio","p",60],["latissimo_dorsal","p",60],["romboides","s",50],["biceps_cabeca_curta","s",35],["transverso_abdominal","e",30]],
  "remada invertida": [["trapezio_medio","p",60],["latissimo_dorsal","p",55],["romboides","s",50],["biceps_cabeca_curta","s",35]],
  "remada alta no multi press": [["deltoide_lateral","p",65],["trapezio_superior","p",60],["deltoide_anterior","s",35]],
  "remada lateral no cabo unilateral": [["latissimo_dorsal","p",65],["trapezio_medio","s",45],["deltoide_posterior","s",35]],
  "remada unilateral alta no cabo": [["deltoide_posterior","p",60],["trapezio_medio","s",50],["latissimo_dorsal","s",40]],
  "pull over com corda no cabo": [["latissimo_dorsal","p",80],["redondo_maior","s",45],["triceps_cabeca_longa","s",35],["serratil_anterior","s",30]],
  "encolhimento com barra": [["trapezio_superior","p",90],["trapezio_medio","s",30]],
  "hiperextensao": [["eretores_espinha","p",80],["gluteo_maximo","s",50],["isquiotibiais","s",45]],
  "superman": [["eretores_espinha","p",70],["gluteo_maximo","s",40],["deltoide_posterior","s",25]],
  "good morning": [["isquiotibiais","p",70],["eretores_espinha","p",65],["gluteo_maximo","s",50]],
  "face pull com elastico": [["deltoide_posterior","p",75],["trapezio_medio","s",50],["manguito_rotador","s",45],["romboides","s",40]],
  "crucifixo invertido no cabo": [["deltoide_posterior","p",80],["trapezio_medio","s",45],["romboides","s",40]],
  "crucifixo invertido inclinado": [["deltoide_posterior","p",80],["trapezio_medio","s",45],["romboides","s",40]],
  "prancha para remada unilateral": [["latissimo_dorsal","p",55],["transverso_abdominal","e",60],["obliquos","e",50],["trapezio_medio","s",40]],

  // ── Ombros ───────────────────────────────────────────────────────────────
  "desenvolvimento militar": [["deltoide_anterior","p",85],["deltoide_lateral","s",50],["triceps_cabeca_lateral","s",40],["trapezio_superior","s",30],["transverso_abdominal","e",25]],
  "desenvolvimento com barra": [["deltoide_anterior","p",85],["deltoide_lateral","s",50],["triceps_cabeca_lateral","s",40],["trapezio_superior","s",30]],
  "desenvolvimento com halteres": [["deltoide_anterior","p",80],["deltoide_lateral","s",55],["triceps_cabeca_lateral","s",35],["manguito_rotador","e",25]],
  "desenvolvimento na maquina": [["deltoide_anterior","p",80],["deltoide_lateral","s",45],["triceps_cabeca_lateral","s",35]],
  "desenvolvimento militar com barra w": [["deltoide_anterior","p",80],["deltoide_lateral","s",45],["triceps_cabeca_lateral","s",40]],
  "push press": [["deltoide_anterior","p",80],["deltoide_lateral","s",45],["triceps_cabeca_lateral","s",40],["quadriceps_vasto_lateral","s",35],["gluteo_maximo","s",30]],
  "elevacao lateral": [["deltoide_lateral","p",90],["trapezio_superior","s",30],["deltoide_anterior","s",20]],
  "elevacao lateral no cabo unilateral": [["deltoide_lateral","p",90],["trapezio_superior","s",25]],
  "elevacao frontal": [["deltoide_anterior","p",85],["peitoral_clavicular","s",30],["deltoide_lateral","s",20]],
  "elevacao posterior com halteres": [["deltoide_posterior","p",85],["trapezio_medio","s",45],["romboides","s",40]],
  "elevacao posterior sentado": [["deltoide_posterior","p",85],["trapezio_medio","s",45],["romboides","s",40]],
  "rotacao interna lateral deitado": [["manguito_rotador","p",80],["deltoide_posterior","s",25]],
  "devils press": [["deltoide_anterior","p",70],["quadriceps_vasto_lateral","s",50],["gluteo_maximo","s",45],["sistema_cardiovascular","s",60]],
  "wall ball": [["quadriceps_vasto_lateral","p",65],["deltoide_anterior","p",60],["gluteo_maximo","s",50],["sistema_cardiovascular","s",55]],

  // ── Bíceps ───────────────────────────────────────────────────────────────
  "rosca direta com barra reta": [["biceps_cabeca_curta","p",80],["biceps_cabeca_longa","p",75],["braquial","s",40],["braquiorradial","s",25]],
  "rosca biceps com halteres": [["biceps_cabeca_longa","p",80],["biceps_cabeca_curta","p",75],["braquial","s",40]],
  "rosca alternada com halteres": [["biceps_cabeca_longa","p",80],["biceps_cabeca_curta","p",75],["braquial","s",40]],
  "rosca martelo": [["braquiorradial","p",80],["braquial","p",75],["biceps_cabeca_longa","s",50]],
  "rosca martelo no cabo": [["braquiorradial","p",80],["braquial","p",75],["biceps_cabeca_longa","s",50]],
  "rosca scott": [["biceps_cabeca_curta","p",85],["braquial","s",45],["biceps_cabeca_longa","s",35]],
  "rosca concentrada no cabo": [["biceps_cabeca_curta","p",85],["biceps_cabeca_longa","s",45],["braquial","s",35]],
  "rosca biceps no cabo": [["biceps_cabeca_curta","p",80],["biceps_cabeca_longa","p",70],["braquial","s",35]],
  "rosca acima da cabeca": [["biceps_cabeca_longa","p",85],["biceps_cabeca_curta","s",50]],
  "rosca w sentado": [["biceps_cabeca_curta","p",80],["biceps_cabeca_longa","s",60],["braquial","s",40]],
  "rosca biceps pronada": [["extensores_antebraco","p",70],["braquiorradial","p",70],["biceps_cabeca_curta","s",35]],
  "rosca biceps no trx": [["biceps_cabeca_curta","p",70],["biceps_cabeca_longa","s",55],["transverso_abdominal","e",30]],
  "rosca biceps com desenvolvimento": [["biceps_cabeca_curta","p",70],["deltoide_anterior","p",65],["triceps_cabeca_lateral","s",35]],

  // ── Tríceps ──────────────────────────────────────────────────────────────
  "triceps testa": [["triceps_cabeca_longa","p",85],["triceps_cabeca_lateral","s",55],["triceps_cabeca_medial","s",50]],
  "triceps testa na polia": [["triceps_cabeca_longa","p",85],["triceps_cabeca_lateral","s",55],["triceps_cabeca_medial","s",50]],
  "triceps frances": [["triceps_cabeca_longa","p",90],["triceps_cabeca_medial","s",45],["triceps_cabeca_lateral","s",40]],
  "extensao de triceps acima da cabeca na polia": [["triceps_cabeca_longa","p",90],["triceps_cabeca_medial","s",45],["triceps_cabeca_lateral","s",40]],
  "extensao de triceps com barra acima da cabeca": [["triceps_cabeca_longa","p",90],["triceps_cabeca_medial","s",45],["triceps_cabeca_lateral","s",40]],
  "skull crusher com barra w": [["triceps_cabeca_longa","p",85],["triceps_cabeca_lateral","s",55],["triceps_cabeca_medial","s",50]],
  "triceps pulley": [["triceps_cabeca_lateral","p",85],["triceps_cabeca_medial","p",75],["triceps_cabeca_longa","s",35]],
  "extensao de triceps no cabo": [["triceps_cabeca_lateral","p",85],["triceps_cabeca_medial","p",75],["triceps_cabeca_longa","s",35]],
  "triceps na polia com corda": [["triceps_cabeca_lateral","p",85],["triceps_cabeca_medial","p",75],["triceps_cabeca_longa","s",40]],
  "triceps pulley de costas na polia": [["triceps_cabeca_medial","p",85],["triceps_cabeca_lateral","s",60],["triceps_cabeca_longa","s",30]],
  "triceps na maquina (sentado)": [["triceps_cabeca_lateral","p",80],["triceps_cabeca_medial","p",70],["triceps_cabeca_longa","s",35]],
  "triceps no banco": [["triceps_cabeca_lateral","p",80],["triceps_cabeca_medial","s",60],["deltoide_anterior","s",30],["peitoral_abdominal","s",25]],
  "fundos para triceps": [["triceps_cabeca_lateral","p",85],["triceps_cabeca_medial","s",65],["peitoral_abdominal","s",45],["deltoide_anterior","s",35]],

  // ── Pernas ───────────────────────────────────────────────────────────────
  "agachamento livre": [["quadriceps_vasto_lateral","p",85],["quadriceps_vasto_medial","p",80],["gluteo_maximo","p",70],["quadriceps_reto_femoral","s",60],["eretores_espinha","e",45],["adutores","s",35]],
  "agachamento frontal": [["quadriceps_vasto_lateral","p",90],["quadriceps_vasto_medial","p",85],["quadriceps_reto_femoral","s",65],["gluteo_maximo","s",55],["eretores_espinha","e",50]],
  "agachamento na maquina smith": [["quadriceps_vasto_lateral","p",85],["quadriceps_vasto_medial","p",80],["gluteo_maximo","s",55]],
  "agachamento pendulo": [["quadriceps_vasto_lateral","p",85],["quadriceps_vasto_medial","p",80],["gluteo_maximo","s",60]],
  "agachamento goblet": [["quadriceps_vasto_lateral","p",80],["quadriceps_vasto_medial","p",75],["gluteo_maximo","s",55],["transverso_abdominal","e",35]],
  "agachamento goblet com halter": [["quadriceps_vasto_lateral","p",80],["quadriceps_vasto_medial","p",75],["gluteo_maximo","s",55],["transverso_abdominal","e",35]],
  "agachamento sumo": [["adutores","p",75],["gluteo_maximo","p",70],["quadriceps_vasto_medial","s",55]],
  "agachamento isometrico": [["quadriceps_vasto_lateral","p",75],["quadriceps_vasto_medial","p",70],["gluteo_maximo","s",45]],
  "agachamento pistol unilateral": [["quadriceps_vasto_lateral","p",85],["gluteo_maximo","p",65],["gluteo_medio","s",50],["quadriceps_vasto_medial","s",60]],
  "leg press": [["quadriceps_vasto_lateral","p",85],["quadriceps_vasto_medial","p",75],["gluteo_maximo","s",55],["adutores","s",30]],
  "leg press na maquina hack": [["quadriceps_vasto_lateral","p",85],["quadriceps_vasto_medial","p",80],["gluteo_maximo","s",45]],
  "leg press pegada estreita": [["quadriceps_vasto_lateral","p",85],["quadriceps_vasto_medial","p",75],["gluteo_maximo","s",40]],
  "cadeira extensora": [["quadriceps_vasto_lateral","p",85],["quadriceps_vasto_medial","p",85],["quadriceps_reto_femoral","p",75]],
  "cadeira extensora unilateral": [["quadriceps_vasto_lateral","p",85],["quadriceps_vasto_medial","p",85],["quadriceps_reto_femoral","p",75]],
  "mesa flexora": [["isquiotibiais","p",90],["gastrocnemio","s",30]],
  "flexao de joelho deitado": [["isquiotibiais","p",90],["gastrocnemio","s",30]],
  "flexao de joelho sentado": [["isquiotibiais","p",90],["gastrocnemio","s",25]],
  "flexao de joelho em pe": [["isquiotibiais","p",85],["gastrocnemio","s",25]],
  "levantamento terra": [["isquiotibiais","p",80],["gluteo_maximo","p",80],["eretores_espinha","p",75],["trapezio_medio","s",40],["quadriceps_vasto_lateral","s",40],["flexores_antebraco","e",35]],
  "levantamento terra em rack": [["isquiotibiais","p",80],["gluteo_maximo","p",75],["eretores_espinha","p",70],["trapezio_medio","s",40]],
  "levantamento terra romeno com halteres": [["isquiotibiais","p",90],["gluteo_maximo","p",70],["eretores_espinha","s",55]],
  "levantamento terra sumo com halter": [["gluteo_maximo","p",80],["adutores","p",70],["isquiotibiais","s",60],["eretores_espinha","s",50]],
  "levantamento terra unilateral": [["isquiotibiais","p",85],["gluteo_maximo","p",70],["gluteo_medio","s",50],["eretores_espinha","s",45]],
  "avanco com halteres": [["quadriceps_vasto_lateral","p",80],["gluteo_maximo","p",70],["isquiotibiais","s",45],["gluteo_medio","s",40]],
  "avanco caminhando com halteres": [["quadriceps_vasto_lateral","p",80],["gluteo_maximo","p",75],["isquiotibiais","s",45],["gluteo_medio","s",40]],
  "avanco reverso": [["gluteo_maximo","p",75],["quadriceps_vasto_lateral","p",70],["isquiotibiais","s",50]],
  "avanco unilateral com kettlebell": [["quadriceps_vasto_lateral","p",75],["gluteo_maximo","p",70],["gluteo_medio","s",45]],
  "avanco lateral deslizante": [["adutores","p",70],["gluteo_medio","p",65],["quadriceps_vasto_lateral","s",50]],
  "avanco com rotacao de tronco": [["quadriceps_vasto_lateral","p",70],["gluteo_maximo","s",60],["obliquos","s",50]],
  "elevacao de gluteo na maquina": [["gluteo_maximo","p",90],["isquiotibiais","s",40]],
  "extensao de gluteo no cabo": [["gluteo_maximo","p",90],["isquiotibiais","s",40]],
  "coice de gluteo com elastico": [["gluteo_maximo","p",85],["isquiotibiais","s",35]],
  "pressao de gluteo lateral unilateral": [["gluteo_medio","p",85],["gluteo_maximo","s",45]],
  "arabesco": [["gluteo_maximo","p",75],["isquiotibiais","s",55],["eretores_espinha","e",40]],
  "chute do isquiotibial": [["isquiotibiais","p",75],["gluteo_maximo","s",45]],
  "calcanhar no gluteo": [["isquiotibiais","p",65],["quadriceps_reto_femoral","s",25]],
  "salto lateral": [["gluteo_medio","p",70],["quadriceps_vasto_lateral","s",55],["gastrocnemio","s",45],["sistema_cardiovascular","s",50]],
  "cruzamento de quadril": [["adutores","p",70],["gluteo_medio","s",45]],

  // ── Panturrilha ──────────────────────────────────────────────────────────
  "elevacao de calcanhares com duas pernas": [["gastrocnemio","p",85],["soleo","p",60]],
  "pressao de panturrilha na leg press": [["gastrocnemio","p",85],["soleo","p",65]],

  // ── Abdômen ──────────────────────────────────────────────────────────────
  "abdominal tradicional": [["reto_abdominal_superior","p",85],["reto_abdominal_inferior","s",40],["obliquos","s",25]],
  "abdominal inclinado": [["reto_abdominal_superior","p",85],["reto_abdominal_inferior","s",45],["obliquos","s",30]],
  "abdominal negativo": [["reto_abdominal_superior","p",80],["reto_abdominal_inferior","s",50],["transverso_abdominal","s",35]],
  "abdominal lateral": [["obliquos","p",90],["reto_abdominal_superior","s",35]],
  "encolhimento abdominal sentado": [["reto_abdominal_superior","p",80],["reto_abdominal_inferior","s",40]],
  "elevacao de perna": [["reto_abdominal_inferior","p",85],["flexores_quadril","s",55],["transverso_abdominal","s",40]],
  "joelho ao peito deitado": [["reto_abdominal_inferior","p",75],["flexores_quadril","s",50]],
  "prancha": [["transverso_abdominal","p",85],["reto_abdominal_superior","s",50],["obliquos","s",40],["deltoide_anterior","e",25]],
  "prancha com toque nos ombros": [["transverso_abdominal","p",85],["obliquos","p",60],["reto_abdominal_superior","s",45],["deltoide_anterior","e",30]],
  "roda abdominal": [["reto_abdominal_superior","p",85],["transverso_abdominal","p",75],["latissimo_dorsal","s",40],["reto_abdominal_inferior","s",50]],
  "rotacao com anilha": [["obliquos","p",85],["transverso_abdominal","s",45]],
  "rotacao com bola medicinal": [["obliquos","p",85],["transverso_abdominal","s",45]],
  "passaro e cachorro": [["transverso_abdominal","p",70],["eretores_espinha","s",50],["gluteo_maximo","s",35]],

  // ── Cardio ───────────────────────────────────────────────────────────────
  "esteira": [["sistema_cardiovascular","p",90],["quadriceps_vasto_lateral","s",40],["isquiotibiais","s",35],["gastrocnemio","s",40],["gluteo_maximo","s",30]],
  "cardio na esteira": [["sistema_cardiovascular","p",90],["quadriceps_vasto_lateral","s",40],["gastrocnemio","s",40]],
  "corrida ao ar livre": [["sistema_cardiovascular","p",90],["quadriceps_vasto_lateral","s",40],["isquiotibiais","s",40],["gastrocnemio","s",45],["gluteo_maximo","s",35]],
  "bicicleta ergometrica": [["sistema_cardiovascular","p",90],["quadriceps_vasto_lateral","s",50],["isquiotibiais","s",30],["gastrocnemio","s",25]],
  "eliptico": [["sistema_cardiovascular","p",90],["quadriceps_vasto_lateral","s",40],["gluteo_maximo","s",35],["isquiotibiais","s",30]],
  "remo ergometrico": [["sistema_cardiovascular","p",85],["latissimo_dorsal","s",50],["quadriceps_vasto_lateral","s",45],["trapezio_medio","s",40],["biceps_cabeca_curta","s",30]],
  "corda": [["sistema_cardiovascular","p",90],["gastrocnemio","p",60],["soleo","s",45],["deltoide_lateral","s",25]],
  "corrida com joelhos altos": [["sistema_cardiovascular","p",85],["flexores_quadril","p",60],["quadriceps_reto_femoral","s",50],["gastrocnemio","s",40]],
  "polichinelo": [["sistema_cardiovascular","p",85],["gastrocnemio","s",40],["deltoide_lateral","s",30]],
  "corrida no lugar": [["sistema_cardiovascular","p",85],["quadriceps_vasto_lateral","s",40],["gastrocnemio","s",40]],
  "remada hang power clean": [["sistema_cardiovascular","s",50],["trapezio_superior","p",70],["quadriceps_vasto_lateral","s",55],["gluteo_maximo","s",50],["eretores_espinha","s",45]],
};

// ---------------------------------------------------------------------------
// Camada 2 — fallback por muscle_group
// ---------------------------------------------------------------------------
// Aplicado a todo exercício que não está em CURATED. Ênfases deliberadamente
// mais baixas que as curadas: é um palpite pelo grupo, não uma análise do
// movimento — e a ordenação do picker deve favorecer o que foi curado.

const GROUP_FALLBACK = {
  "peito": [["peitoral_esternal","p",60],["peitoral_clavicular","s",30],["triceps_cabeca_lateral","s",25]],
  "costas": [["latissimo_dorsal","p",60],["trapezio_medio","s",35],["biceps_cabeca_curta","s",25]],
  "ombros": [["deltoide_anterior","p",55],["deltoide_lateral","p",55],["deltoide_posterior","s",30]],
  "biceps": [["biceps_cabeca_curta","p",60],["biceps_cabeca_longa","p",55],["braquial","s",30]],
  "triceps": [["triceps_cabeca_lateral","p",60],["triceps_cabeca_medial","p",55],["triceps_cabeca_longa","s",40]],
  "bracos": [["biceps_cabeca_curta","p",50],["triceps_cabeca_lateral","p",50],["flexores_antebraco","s",30]],
  // Reportados como "sem fallback" na 1ª execução do seed (05/08/2026).
  "antebraco": [["flexores_antebraco","p",65],["extensores_antebraco","p",60],["braquiorradial","s",45]],
  // "Core" não é um músculo: é o cinturão que estabiliza o tronco. Mapeia para
  // os músculos reais que o compõem (transverso + oblíquos + eretores), em vez
  // de inventar uma linha 'core' no catálogo de anatomia.
  "core": [["transverso_abdominal","p",70],["obliquos","p",55],["reto_abdominal_superior","s",45],["eretores_espinha","s",35]],
  "pernas": [["quadriceps_vasto_lateral","p",60],["gluteo_maximo","s",45],["isquiotibiais","s",40]],
  "gluteos": [["gluteo_maximo","p",65],["gluteo_medio","s",40],["isquiotibiais","s",35]],
  "panturrilha": [["gastrocnemio","p",70],["soleo","s",50]],
  "abdomen": [["reto_abdominal_superior","p",60],["obliquos","s",35],["transverso_abdominal","s",35]],
  "cardio": [["sistema_cardiovascular","p",80]],
  "full body": [["sistema_cardiovascular","p",50],["quadriceps_vasto_lateral","s",35],["peitoral_esternal","s",30],["latissimo_dorsal","s",30]],
};

/** Grupos que NÃO recebem anatomia: alongar/soltar ≠ recrutar. */
const SKIP_GROUPS = new Set(["alongamento", "mobilidade"]);
/** Nomes que denunciam alongamento/liberação mesmo com grupo de treino. */
const SKIP_NAME_PATTERNS = [/^alongamento/, /^rolo de espuma/, /^mobilidade/];

const ROLE = { p: "primary", s: "secondary", e: "stabilizer" };

// ---------------------------------------------------------------------------

async function main() {
  console.log(DRY_RUN ? "— DRY RUN (nada será escrito) —\n" : "");

  const { data: muscles, error: mErr } = await supabase.from("muscles").select("id");
  if (mErr) throw mErr;
  if (!muscles?.length) {
    console.error("Tabela `muscles` vazia. Rode docs/migrations/20260805-muscle-anatomy.sql primeiro.");
    process.exit(1);
  }
  const validMuscles = new Set(muscles.map((m) => m.id));

  // Valida o mapa curado ANTES de tocar no banco: um slug errado viraria um
  // erro de FK no meio do seed, deixando o catálogo pela metade.
  let bad = 0;
  for (const [ex, rows] of Object.entries({ ...CURATED, ...GROUP_FALLBACK })) {
    for (const [mid] of rows) {
      if (!validMuscles.has(mid)) {
        console.error(`  slug inexistente: "${mid}" (em "${ex}")`);
        bad++;
      }
    }
  }
  if (bad > 0) {
    console.error(`\n${bad} referência(s) inválida(s) — nada foi escrito.`);
    process.exit(1);
  }

  const { data: workouts, error: wErr } = await supabase
    .from("workouts")
    .select("id, name, muscle_group")
    .order("name");
  if (wErr) throw wErr;

  const stats = { curated: 0, fallback: 0, skipped: 0, unmapped: 0 };
  const unmappedGroups = new Map();

  for (const w of workouts ?? []) {
    const nName = norm(w.name);
    const nGroup = norm(w.muscle_group);

    if (SKIP_GROUPS.has(nGroup) || SKIP_NAME_PATTERNS.some((re) => re.test(nName))) {
      stats.skipped++;
      continue;
    }

    let rows = CURATED[nName];
    let source = "curated";
    if (!rows) {
      rows = GROUP_FALLBACK[nGroup];
      source = "fallback";
    }
    if (!rows) {
      stats.unmapped++;
      unmappedGroups.set(w.muscle_group, (unmappedGroups.get(w.muscle_group) ?? 0) + 1);
      continue;
    }

    source === "curated" ? stats.curated++ : stats.fallback++;
    if (DRY_RUN) continue;

    const payload = rows.map(([muscle_id, role, emphasis]) => ({
      workout_id: w.id,
      muscle_id,
      role: ROLE[role],
      emphasis,
    }));

    // Remove ligações que saíram do mapa (corrigir a curadoria e rodar de novo
    // é o fluxo normal — sem isto, uma linha errada ficaria para sempre).
    const keep = payload.map((p) => p.muscle_id);
    await supabase
      .from("workout_muscles")
      .delete()
      .eq("workout_id", w.id)
      .not("muscle_id", "in", `(${keep.map((k) => `"${k}"`).join(",")})`);

    const { error } = await supabase
      .from("workout_muscles")
      .upsert(payload, { onConflict: "workout_id,muscle_id" });
    if (error) {
      console.error(`  falha em "${w.name}":`, error.message);
    }
  }

  console.log(`Exercícios no catálogo: ${workouts?.length ?? 0}`);
  console.log(`  curados:              ${stats.curated}`);
  console.log(`  fallback por grupo:   ${stats.fallback}`);
  console.log(`  pulados (alongam.):   ${stats.skipped}`);
  console.log(`  SEM mapeamento:       ${stats.unmapped}`);
  if (unmappedGroups.size > 0) {
    console.log("\nGrupos sem fallback (adicione em GROUP_FALLBACK):");
    for (const [g, n] of [...unmappedGroups].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${JSON.stringify(g)} — ${n} exercício(s)`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
