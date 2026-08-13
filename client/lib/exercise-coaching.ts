/**
 * Técnica de execução dos exercícios — a parte "treinador" da prescrição.
 *
 * Prescrever agachamento sem dizer para onde o joelho aponta é entregar meia
 * informação. Cada verbete responde o que um personal fala ao lado do aluno:
 * **como montar** (setup), **como executar**, **como respirar**, **em que ritmo**
 * e **quais erros** acontecem de verdade naquele movimento.
 *
 * ## Por que a busca é por PADRÃO DE MOVIMENTO, não por nome exato
 *
 * O catálogo tem dezenas de variações do mesmo padrão ("Supino reto", "Supino
 * com Halteres", "Supino inclinado com halteres", "Supino na Máquina") e o
 * usuário ainda pode criar exercícios próprios com o nome que quiser. Indexar
 * por nome exato deixaria metade da lista sem orientação. Aqui cada verbete
 * casa por palavras-chave, do mais específico para o mais genérico — então
 * "Supino Pegada Fechada" cai no verbete de tríceps, e não no de peito.
 *
 * Ver `skills/personal-trainer-agent.md`, seção 5.
 */

import type { CoachProfile } from "@/lib/coach-profile";

export type CoachingCues = {
  /** frase única para listas compactas (preview do programa) */
  short: string;
  setup: string;
  execution: string[];
  breathing: string;
  tempo: string;
  mistakes: string[];
};

type Entry = {
  /** palavras-chave do nome (minúsculas, sem acento) — basta uma casar */
  keys: string[];
  /** palavras que DESQUALIFICAM o verbete (evita "supino pegada fechada" cair em peito) */
  not?: string[];
  pt: CoachingCues;
  en: CoachingCues;
};

/** Remove acentos e normaliza para comparação de nomes vindos do catálogo. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// ── Verbetes ────────────────────────────────────────────────────────────────
// ORDEM IMPORTA: o primeiro que casar vence. Variações específicas vêm antes
// das genéricas (búlgaro antes de agachamento, pegada fechada antes de supino).

const ENTRIES: Entry[] = [
  // ─── Pernas ──────────────────────────────────────────────────────────────
  {
    keys: ["bulgaro", "split"],
    pt: {
      short: "Tronco levemente à frente e joelho da frente apontando para o dedão.",
      setup: "Pé de trás apoiado no banco, pé da frente a um passo largo. Tronco levemente inclinado à frente.",
      execution: [
        "Desça controlando até o joelho de trás quase encostar no chão.",
        "Empurre o chão com o calcanhar da perna da frente.",
        "Suba sem travar o joelho no topo.",
      ],
      breathing: "Inspire ao descer, expire ao subir.",
      tempo: "2s descendo · 1s subindo",
      mistakes: [
        "Passada curta demais — sobrecarrega o joelho da frente.",
        "Deixar o joelho cair para dentro.",
      ],
    },
    en: {
      short: "Lean the torso slightly forward and track the front knee over the big toe.",
      setup: "Rear foot on the bench, front foot one long step ahead. Torso slightly forward.",
      execution: [
        "Lower under control until the back knee almost touches the floor.",
        "Drive the floor away through the front heel.",
        "Stand up without locking the knee at the top.",
      ],
      breathing: "Inhale going down, exhale coming up.",
      tempo: "2s down · 1s up",
      mistakes: ["Too short a stride — overloads the front knee.", "Letting the knee cave inward."],
    },
  },
  {
    keys: ["avanco", "afundo", "passada", "lunge"],
    pt: {
      short: "Passo largo, joelho da frente alinhado ao pé, tronco ereto.",
      setup: "Em pé, pés na largura do quadril, abdômen firme.",
      execution: [
        "Dê um passo largo à frente (ou atrás, no reverso).",
        "Desça até o joelho de trás quase tocar o chão.",
        "Empurre o calcanhar da frente para voltar.",
      ],
      breathing: "Inspire ao descer, expire ao subir.",
      tempo: "2s descendo · 1s subindo",
      mistakes: ["Joelho da frente passando muito do pé.", "Tronco caindo para frente."],
    },
    en: {
      short: "Long step, front knee tracking over the foot, torso tall.",
      setup: "Standing, feet hip-width apart, core braced.",
      execution: [
        "Take a long step forward (or back, in the reverse version).",
        "Lower until the rear knee nearly touches the floor.",
        "Push through the front heel to return.",
      ],
      breathing: "Inhale going down, exhale coming up.",
      tempo: "2s down · 1s up",
      mistakes: ["Front knee travelling far past the foot.", "Torso collapsing forward."],
    },
  },
  {
    keys: ["agachamento", "squat", "goblet"],
    pt: {
      short: "Peito aberto, joelhos acompanhando a direção dos pés.",
      setup: "Pés na largura dos ombros, pontas levemente para fora, peito aberto e abdômen firme.",
      execution: [
        "Empurre o quadril para trás e desça como se fosse sentar.",
        "Desça até onde manter a lombar neutra (idealmente coxa paralela).",
        "Suba empurrando o meio do pé contra o chão.",
      ],
      breathing: "Inspire antes de descer, segure na descida, expire ao subir.",
      tempo: "2–3s descendo · 1s subindo",
      mistakes: [
        "Joelho caindo para dentro.",
        "Calcanhar saindo do chão.",
        "Lombar arredondando no fundo do movimento.",
      ],
    },
    en: {
      short: "Chest proud, knees tracking in line with the toes.",
      setup: "Feet shoulder-width, toes slightly out, chest up, core braced.",
      execution: [
        "Push the hips back and sit down between your feet.",
        "Descend as deep as you keep a neutral lower back (ideally thigh parallel).",
        "Stand up driving the mid-foot into the floor.",
      ],
      breathing: "Inhale before descending, hold on the way down, exhale on the way up.",
      tempo: "2–3s down · 1s up",
      mistakes: ["Knees caving inward.", "Heels lifting off the floor.", "Lower back rounding at the bottom."],
    },
  },
  {
    keys: ["leg press"],
    pt: {
      short: "Não deixe o quadril desencostar do apoio no fundo.",
      setup: "Costas e quadril totalmente apoiados, pés na plataforma na largura dos ombros.",
      execution: [
        "Desça até formar cerca de 90° no joelho.",
        "Pare antes de o quadril desencostar do banco.",
        "Empurre com o meio do pé sem travar os joelhos no topo.",
      ],
      breathing: "Inspire ao descer, expire ao empurrar.",
      tempo: "2s descendo · 1s empurrando",
      mistakes: ["Descer demais e arredondar a lombar.", "Travar o joelho no fim da extensão."],
    },
    en: {
      short: "Never let the hips peel off the pad at the bottom.",
      setup: "Back and hips fully supported, feet shoulder-width on the platform.",
      execution: [
        "Lower until the knees reach roughly 90°.",
        "Stop before the hips lift off the seat.",
        "Press through the mid-foot without locking the knees.",
      ],
      breathing: "Inhale lowering, exhale pressing.",
      tempo: "2s down · 1s press",
      mistakes: ["Going too deep and rounding the lower back.", "Locking the knees at the top."],
    },
  },
  {
    keys: ["extensora", "leg extension"],
    pt: {
      short: "Suba até estender, segure 1s no topo e desça devagar.",
      setup: "Encaixe o rolo logo acima do tornozelo e o joelho alinhado ao eixo da máquina.",
      execution: ["Estenda o joelho de forma controlada.", "Segure 1s no topo.", "Desça em 2–3s sem soltar o peso."],
      breathing: "Expire subindo, inspire descendo.",
      tempo: "1s subindo · 1s topo · 2–3s descendo",
      mistakes: ["Jogar o peso com impulso do quadril.", "Soltar a descida."],
    },
    en: {
      short: "Extend, hold for 1s at the top, then lower slowly.",
      setup: "Pad just above the ankle, knee aligned with the machine's axis.",
      execution: ["Extend the knee under control.", "Hold for 1s at the top.", "Lower over 2–3s without dropping the weight."],
      breathing: "Exhale up, inhale down.",
      tempo: "1s up · 1s hold · 2–3s down",
      mistakes: ["Throwing the weight using hip momentum.", "Letting the negative drop."],
    },
  },
  {
    keys: ["flexora"],
    pt: {
      short: "Quadril colado no apoio — quem flexiona é o joelho, não a lombar.",
      setup: "Quadril firme contra o apoio, rolo logo acima do calcanhar.",
      execution: ["Flexione o joelho puxando o calcanhar em direção ao glúteo.", "Segure meio segundo na contração.", "Volte controlando."],
      breathing: "Expire ao puxar, inspire ao voltar.",
      tempo: "1s puxando · 2s voltando",
      mistakes: ["Levantar o quadril do apoio.", "Usar impulso na volta."],
    },
    en: {
      short: "Hips glued to the pad — the knee bends, not the lower back.",
      setup: "Hips pressed into the pad, roller just above the heels.",
      execution: ["Curl the heels toward the glutes.", "Hold half a second at peak contraction.", "Return under control."],
      breathing: "Exhale curling, inhale returning.",
      tempo: "1s curl · 2s return",
      mistakes: ["Hips lifting off the pad.", "Using momentum on the way back."],
    },
  },
  {
    keys: ["terra romeno", "romeno", "stiff"],
    pt: {
      short: "Quadril para trás, barra rente à perna, lombar sempre neutra.",
      setup: "Pés na largura do quadril, joelhos levemente flexionados, escápulas encaixadas.",
      execution: [
        "Empurre o quadril para trás deslizando o peso rente à coxa.",
        "Desça até sentir o alongamento do posterior — sem arredondar as costas.",
        "Volte estendendo o quadril e apertando o glúteo.",
      ],
      breathing: "Inspire ao descer, expire ao subir.",
      tempo: "3s descendo · 1s subindo",
      mistakes: [
        "Arredondar a lombar para descer mais.",
        "Transformar em agachamento (dobrar demais o joelho).",
        "Afastar o peso do corpo.",
      ],
    },
    en: {
      short: "Hips back, bar close to the legs, lower back always neutral.",
      setup: "Feet hip-width, knees softly bent, shoulder blades set.",
      execution: [
        "Push the hips back, sliding the weight along the thighs.",
        "Lower until you feel the hamstring stretch — never rounding the back.",
        "Return by extending the hips and squeezing the glutes.",
      ],
      breathing: "Inhale down, exhale up.",
      tempo: "3s down · 1s up",
      mistakes: ["Rounding the lower back to go deeper.", "Turning it into a squat.", "Letting the weight drift away from the body."],
    },
  },
  {
    keys: ["quadril", "ponte de gluteo", "gluteo", "hip thrust"],
    pt: {
      short: "Suba até alinhar tronco e coxa, apertando o glúteo no topo.",
      setup: "Escápulas apoiadas (ou costas no chão), pés na largura do quadril, queixo levemente para dentro.",
      execution: ["Empurre pelo calcanhar elevando o quadril.", "Pare quando tronco e coxa estiverem alinhados.", "Aperte o glúteo 1s e desça controlando."],
      breathing: "Expire ao subir, inspire ao descer.",
      tempo: "1s subindo · 1s topo · 2s descendo",
      mistakes: ["Hiperestender a lombar no topo.", "Empurrar pela ponta do pé."],
    },
    en: {
      short: "Rise until torso and thighs line up, squeezing the glutes at the top.",
      setup: "Shoulder blades supported (or back on the floor), feet hip-width, chin slightly tucked.",
      execution: ["Drive through the heels to lift the hips.", "Stop when torso and thighs are aligned.", "Squeeze the glutes for 1s, then lower under control."],
      breathing: "Exhale up, inhale down.",
      tempo: "1s up · 1s hold · 2s down",
      mistakes: ["Hyperextending the lower back at the top.", "Pushing through the toes."],
    },
  },
  {
    keys: ["panturrilha", "calf"],
    pt: {
      short: "Amplitude completa: desça o calcanhar e suba na ponta do pé.",
      setup: "Ponta dos pés apoiada, calcanhares livres, joelho estendido (ou levemente flexionado).",
      execution: ["Desça o calcanhar até alongar bem.", "Suba o mais alto que conseguir.", "Segure 1s no topo."],
      breathing: "Expire subindo, inspire descendo.",
      tempo: "2s descendo · 1s topo",
      mistakes: ["Fazer meia amplitude com impulso.", "Balançar o corpo."],
    },
    en: {
      short: "Full range: drop the heel low, rise all the way onto the toes.",
      setup: "Balls of the feet supported, heels free, knee straight (or softly bent).",
      execution: ["Lower the heels into a full stretch.", "Rise as high as you can.", "Hold 1s at the top."],
      breathing: "Exhale up, inhale down.",
      tempo: "2s down · 1s hold",
      mistakes: ["Bouncing through half the range.", "Swinging the body."],
    },
  },

  // ─── Peito / empurrar ────────────────────────────────────────────────────
  {
    keys: ["pegada fechada", "diamante", "close grip"],
    pt: {
      short: "Cotovelos rentes ao corpo — quem trabalha aqui é o tríceps.",
      setup: "Mãos na largura dos ombros (ou formando um losango, na flexão), cotovelos junto ao tronco.",
      execution: ["Desça mantendo os cotovelos rentes às costelas.", "Encoste (ou quase) e empurre de volta.", "Estenda sem travar bruscamente."],
      breathing: "Inspire ao descer, expire ao empurrar.",
      tempo: "2s descendo · 1s empurrando",
      mistakes: ["Abrir os cotovelos e virar exercício de peito.", "Pegada estreita demais (força o punho)."],
    },
    en: {
      short: "Elbows tucked to the ribs — this one is for the triceps.",
      setup: "Hands shoulder-width (or in a diamond, for the push-up), elbows close to the torso.",
      execution: ["Lower keeping the elbows against the ribs.", "Touch (or nearly) and press back.", "Extend without snapping the lock-out."],
      breathing: "Inhale down, exhale pressing.",
      tempo: "2s down · 1s press",
      mistakes: ["Flaring the elbows and turning it into a chest exercise.", "Grip so narrow it strains the wrist."],
    },
  },
  {
    keys: ["supino", "bench press", "press de peito"],
    pt: {
      short: "Escápulas encaixadas no banco e cotovelos a ~45° do tronco.",
      setup: "Deite com escápulas retraídas, pés firmes no chão, leve arco natural na lombar.",
      execution: [
        "Desça o peso até a linha do mamilo, cotovelos a ~45°.",
        "Toque de leve (ou pare a um punho do peito).",
        "Empurre em linha reta, apertando o peito.",
      ],
      breathing: "Inspire ao descer, expire ao empurrar.",
      tempo: "2s descendo · 1s empurrando",
      mistakes: [
        "Abrir os cotovelos a 90° (agride o ombro).",
        "Quicar a barra no peito.",
        "Perder o encaixe das escápulas.",
      ],
    },
    en: {
      short: "Shoulder blades pinned to the bench, elbows about 45° from the torso.",
      setup: "Lie with shoulder blades retracted, feet planted, natural arch in the lower back.",
      execution: [
        "Lower to nipple line with elbows around 45°.",
        "Touch lightly (or stop a fist away from the chest).",
        "Press in a straight line, squeezing the chest.",
      ],
      breathing: "Inhale down, exhale pressing.",
      tempo: "2s down · 1s press",
      mistakes: ["Flaring elbows to 90° (rough on the shoulder).", "Bouncing the bar off the chest.", "Losing the shoulder-blade set."],
    },
  },
  {
    keys: ["crucifixo", "crossover", "voador", "fly", "peck deck"],
    pt: {
      short: "Cotovelo levemente flexionado e fixo — só o ombro se move.",
      setup: "Cotovelos levemente flexionados, escápulas encaixadas, peito aberto.",
      execution: ["Abra os braços em arco até sentir o peito alongar.", "Não desça além do conforto do ombro.", "Feche apertando o peito, sem bater as mãos."],
      breathing: "Inspire ao abrir, expire ao fechar.",
      tempo: "3s abrindo · 1s fechando",
      mistakes: ["Dobrar e estender o cotovelo (vira supino).", "Amplitude excessiva na abertura."],
    },
    en: {
      short: "Elbows softly bent and fixed — only the shoulder joint moves.",
      setup: "Elbows softly bent, shoulder blades set, chest open.",
      execution: ["Open the arms in an arc until you feel the chest stretch.", "Don't go past what the shoulder tolerates.", "Close by squeezing the chest, without clapping the hands."],
      breathing: "Inhale opening, exhale closing.",
      tempo: "3s open · 1s close",
      mistakes: ["Bending and extending the elbow (that's a press).", "Excessive range on the stretch."],
    },
  },
  {
    keys: ["flexao hindu", "hindu"],
    pt: {
      short: "Mergulhe o peito entre as mãos e volte pelo mesmo caminho.",
      setup: "Quadril alto, mãos e pés afastados, olhar para os pés.",
      execution: ["Desça o peito passando rente ao chão, entre as mãos.", "Estenda os cotovelos elevando o tronco.", "Volte pelo mesmo caminho, elevando o quadril."],
      breathing: "Inspire ao descer, expire ao subir.",
      tempo: "Contínuo e fluido",
      mistakes: ["Forçar a lombar na subida.", "Perder o apoio dos ombros."],
    },
    en: {
      short: "Dive the chest between the hands and return along the same path.",
      setup: "Hips high, hands and feet apart, eyes toward the feet.",
      execution: ["Dive the chest close to the floor, between the hands.", "Extend the elbows lifting the torso.", "Reverse the path, pushing the hips back up."],
      breathing: "Inhale down, exhale up.",
      tempo: "Continuous and fluid",
      mistakes: ["Cranking the lower back on the way up.", "Losing shoulder support."],
    },
  },
  {
    keys: ["flexao", "push up", "push-up"],
    pt: {
      short: "Corpo em prancha do calcanhar à cabeça, cotovelos a ~45°.",
      setup: "Mãos pouco além da largura dos ombros, abdômen e glúteo firmes.",
      execution: ["Desça o peito até quase tocar o chão.", "Mantenha os cotovelos a ~45° do tronco.", "Empurre o chão até estender os cotovelos."],
      breathing: "Inspire ao descer, expire ao empurrar.",
      tempo: "2s descendo · 1s empurrando",
      mistakes: ["Quadril caindo (perde a linha do corpo).", "Cotovelos abertos a 90°.", "Amplitude parcial."],
    },
    en: {
      short: "Body in a straight plank from heels to head, elbows about 45°.",
      setup: "Hands slightly wider than the shoulders, core and glutes braced.",
      execution: ["Lower the chest until it almost touches the floor.", "Keep elbows around 45° from the torso.", "Push the floor away to full extension."],
      breathing: "Inhale down, exhale pressing.",
      tempo: "2s down · 1s press",
      mistakes: ["Hips sagging (losing the body line).", "Elbows flared to 90°.", "Partial range."],
    },
  },

  // ─── Costas / puxar ──────────────────────────────────────────────────────
  {
    keys: ["barra fixa", "chin", "pull up", "pull-up"],
    pt: {
      short: "Comece puxando as escápulas para baixo, antes de dobrar o cotovelo.",
      setup: "Pegada firme, ombros ativos, corpo sem balanço.",
      execution: ["Deprima as escápulas antes de puxar.", "Puxe até o queixo passar da barra.", "Desça controlando até quase estender."],
      breathing: "Expire ao subir, inspire ao descer.",
      tempo: "1s subindo · 2–3s descendo",
      mistakes: ["Balançar o corpo (kipping) sem intenção.", "Meia amplitude na descida."],
    },
    en: {
      short: "Start by pulling the shoulder blades down, before bending the elbows.",
      setup: "Firm grip, active shoulders, no swinging.",
      execution: ["Depress the shoulder blades before pulling.", "Pull until the chin clears the bar.", "Lower under control to near-full extension."],
      breathing: "Exhale up, inhale down.",
      tempo: "1s up · 2–3s down",
      mistakes: ["Unintentional kipping.", "Cutting the range on the way down."],
    },
  },
  {
    keys: ["puxada", "pulley", "pulldown"],
    pt: {
      short: "Puxe com o cotovelo em direção ao bolso, peito aberto.",
      setup: "Coxas travadas no apoio, tronco levemente inclinado para trás, peito aberto.",
      execution: ["Inicie deprimindo as escápulas.", "Puxe a barra até a linha da clavícula.", "Volte controlando até estender os braços."],
      breathing: "Expire ao puxar, inspire ao voltar.",
      tempo: "1–2s puxando · 2s voltando",
      mistakes: ["Puxar atrás da nuca.", "Jogar o tronco para trás para vencer a carga.", "Puxar com a mão em vez do cotovelo."],
    },
    en: {
      short: "Pull with the elbow toward your pocket, chest open.",
      setup: "Thighs locked under the pad, torso slightly leaned back, chest open.",
      execution: ["Start by depressing the shoulder blades.", "Pull the bar to collarbone level.", "Return under control to full arm extension."],
      breathing: "Exhale pulling, inhale returning.",
      tempo: "1–2s pull · 2s return",
      mistakes: ["Pulling behind the neck.", "Throwing the torso back to move the weight.", "Pulling with the hands instead of the elbows."],
    },
  },
  {
    keys: ["remada invertida", "remada baixa", "remada sentada", "remada na maquina", "remada unilateral", "remada curvada", "remada", "row"],
    not: ["alta"],
    pt: {
      short: "Cotovelo para trás rente ao corpo, escápulas se aproximando no fim.",
      setup: "Coluna neutra, peito aberto, ombros longe da orelha.",
      execution: ["Puxe levando o cotovelo para trás, rente ao tronco.", "Aproxime as escápulas no fim do movimento.", "Volte estendendo o braço sem soltar o tronco."],
      breathing: "Expire ao puxar, inspire ao voltar.",
      tempo: "1–2s puxando · 2s voltando",
      mistakes: ["Arredondar a lombar (na versão curvada).", "Usar impulso de tronco a cada repetição.", "Elevar o ombro junto."],
    },
    en: {
      short: "Elbow drives back close to the body, blades coming together at the end.",
      setup: "Neutral spine, chest open, shoulders away from the ears.",
      execution: ["Pull driving the elbow back, close to the torso.", "Bring the shoulder blades together at the end.", "Return extending the arm without losing torso position."],
      breathing: "Exhale pulling, inhale returning.",
      tempo: "1–2s pull · 2s return",
      mistakes: ["Rounding the lower back (bent-over version).", "Using torso momentum every rep.", "Shrugging the shoulder up."],
    },
  },
  {
    keys: ["superman"],
    pt: {
      short: "Eleve braços e pernas poucos centímetros — sem forçar o pescoço.",
      setup: "Deitado de bruços, braços estendidos à frente, olhar para o chão.",
      execution: ["Eleve braços, peito e pernas simultaneamente.", "Segure 2s na contração.", "Desça controlando."],
      breathing: "Expire ao subir, inspire ao descer.",
      tempo: "1s subindo · 2s segurando",
      mistakes: ["Jogar a cabeça para trás.", "Buscar altura em vez de contração."],
    },
    en: {
      short: "Lift arms and legs just a few inches — never crank the neck.",
      setup: "Face down, arms extended overhead, eyes to the floor.",
      execution: ["Lift arms, chest and legs at the same time.", "Hold for 2s at the top.", "Lower under control."],
      breathing: "Exhale lifting, inhale lowering.",
      tempo: "1s up · 2s hold",
      mistakes: ["Throwing the head back.", "Chasing height instead of contraction."],
    },
  },

  // ─── Ombros ──────────────────────────────────────────────────────────────
  {
    keys: ["remada alta", "upright row"],
    pt: {
      short: "Suba só até a altura do peito — acima disso o ombro reclama.",
      setup: "Pegada na largura dos ombros, tronco ereto.",
      execution: ["Puxe o peso rente ao corpo com os cotovelos liderando.", "Pare quando os cotovelos chegarem à altura do peito.", "Desça controlando."],
      breathing: "Expire ao subir, inspire ao descer.",
      tempo: "1s subindo · 2s descendo",
      mistakes: ["Subir acima da linha do ombro.", "Usar impulso de quadril."],
    },
    en: {
      short: "Pull only to chest height — higher than that is where the shoulder complains.",
      setup: "Shoulder-width grip, torso upright.",
      execution: ["Pull the weight close to the body, elbows leading.", "Stop when the elbows reach chest height.", "Lower under control."],
      breathing: "Exhale up, inhale down.",
      tempo: "1s up · 2s down",
      mistakes: ["Pulling above shoulder line.", "Using hip momentum."],
    },
  },
  {
    keys: ["elevacao lateral", "lateral raise"],
    pt: {
      short: "Suba até a linha do ombro liderando com o cotovelo, não com a mão.",
      setup: "Em pé, cotovelos levemente flexionados, ombros para baixo.",
      execution: ["Eleve os braços para o lado até a linha do ombro.", "Lidere com o cotovelo, mão levemente abaixo.", "Desça em 2–3s."],
      breathing: "Expire ao subir, inspire ao descer.",
      tempo: "1s subindo · 2–3s descendo",
      mistakes: ["Subir acima do ombro (entra trapézio).", "Balançar o tronco para dar impulso.", "Carga alta demais."],
    },
    en: {
      short: "Raise to shoulder height leading with the elbow, not the hand.",
      setup: "Standing, elbows softly bent, shoulders pulled down.",
      execution: ["Raise the arms to the side up to shoulder height.", "Lead with the elbow, hand slightly lower.", "Lower over 2–3s."],
      breathing: "Exhale up, inhale down.",
      tempo: "1s up · 2–3s down",
      mistakes: ["Going above shoulder height (traps take over).", "Swinging the torso.", "Using too much weight."],
    },
  },
  {
    keys: ["desenvolvimento", "militar", "overhead press", "shoulder press"],
    pt: {
      short: "Costelas para baixo e abdômen firme — sem arquear a lombar.",
      setup: "Pés firmes, abdômen contraído, halteres na altura do queixo.",
      execution: ["Empurre para cima até quase estender o cotovelo.", "Mantenha as costelas 'para baixo' (sem arquear).", "Desça controlando até a altura do queixo."],
      breathing: "Expire ao empurrar, inspire ao descer.",
      tempo: "1s empurrando · 2s descendo",
      mistakes: ["Arquear a lombar para empurrar.", "Descer atrás da nuca.", "Travar o cotovelo com força no topo."],
    },
    en: {
      short: "Ribs down and core braced — never arch the lower back.",
      setup: "Feet planted, core braced, dumbbells at chin height.",
      execution: ["Press up to just short of full elbow extension.", "Keep the ribs down (no arching).", "Lower under control to chin height."],
      breathing: "Exhale pressing, inhale lowering.",
      tempo: "1s press · 2s down",
      mistakes: ["Arching the lower back to press.", "Lowering behind the neck.", "Snapping the elbows at the top."],
    },
  },
  {
    keys: ["encolhimento com halteres", "encolhimento de ombro", "shrug"],
    not: ["abdominal"],
    pt: {
      short: "Suba os ombros em direção às orelhas — sem girar.",
      setup: "Braços estendidos ao lado do corpo, postura ereta.",
      execution: ["Eleve os ombros em direção às orelhas.", "Segure 1s no topo.", "Desça controlando."],
      breathing: "Expire ao subir, inspire ao descer.",
      tempo: "1s subindo · 1s topo · 2s descendo",
      mistakes: ["Rodar os ombros (desgasta a articulação).", "Usar o bíceps para ajudar."],
    },
    en: {
      short: "Lift the shoulders straight toward the ears — no rolling.",
      setup: "Arms straight at your sides, posture tall.",
      execution: ["Shrug the shoulders toward the ears.", "Hold 1s at the top.", "Lower under control."],
      breathing: "Exhale up, inhale down.",
      tempo: "1s up · 1s hold · 2s down",
      mistakes: ["Rolling the shoulders (wears the joint).", "Bending the elbows to help."],
    },
  },
  {
    keys: ["planche"],
    pt: {
      short: "Escápulas protraídas e quadril encaixado — progressão lenta.",
      setup: "Mãos no chão na largura dos ombros, dedos apontando à frente.",
      execution: ["Empurre o chão protraindo as escápulas.", "Encaixe o quadril e traga os joelhos ao peito.", "Sustente o tempo alvo com o corpo estável."],
      breathing: "Respiração curta e contínua durante a sustentação.",
      tempo: "Isometria — 10 a 20s por série",
      mistakes: ["Deixar a escápula 'afundar'.", "Progredir de amplitude antes de sustentar com estabilidade."],
    },
    en: {
      short: "Shoulder blades protracted, hips tucked — progress slowly.",
      setup: "Hands on the floor shoulder-width, fingers pointing forward.",
      execution: ["Push the floor away, protracting the shoulder blades.", "Tuck the hips and bring the knees to the chest.", "Hold the target time with a stable body."],
      breathing: "Short, continuous breaths during the hold.",
      tempo: "Isometric — 10 to 20s per set",
      mistakes: ["Letting the shoulder blades sink.", "Progressing range before you can hold it stable."],
    },
  },

  // ─── Braços ──────────────────────────────────────────────────────────────
  {
    keys: ["rosca martelo", "hammer"],
    pt: {
      short: "Pegada neutra (polegar para cima) e cotovelo colado ao tronco.",
      setup: "Halteres com pegada neutra, cotovelos junto às costelas.",
      execution: ["Flexione o cotovelo mantendo a pegada neutra.", "Suba até a contração completa.", "Desça em 2–3s."],
      breathing: "Expire ao subir, inspire ao descer.",
      tempo: "1s subindo · 2–3s descendo",
      mistakes: ["Balançar o tronco.", "Deixar o cotovelo migrar para frente."],
    },
    en: {
      short: "Neutral grip (thumbs up) and elbows pinned to the torso.",
      setup: "Dumbbells in a neutral grip, elbows against the ribs.",
      execution: ["Curl keeping the neutral grip.", "Curl to full contraction.", "Lower over 2–3s."],
      breathing: "Exhale up, inhale down.",
      tempo: "1s up · 2–3s down",
      mistakes: ["Swinging the torso.", "Letting the elbow drift forward."],
    },
  },
  {
    keys: ["rosca", "curl", "biceps"],
    pt: {
      short: "Cotovelo fixo ao lado do corpo — só o antebraço se move.",
      setup: "Em pé, ombros para trás, cotovelos junto às costelas.",
      execution: ["Suba o peso flexionando só o cotovelo.", "Aperte o bíceps no topo.", "Desça em 2–3s até quase estender."],
      breathing: "Expire ao subir, inspire ao descer.",
      tempo: "1s subindo · 2–3s descendo",
      mistakes: ["Usar impulso de lombar.", "Cotovelo indo para frente.", "Soltar a descida."],
    },
    en: {
      short: "Elbow fixed at your side — only the forearm moves.",
      setup: "Standing, shoulders back, elbows against the ribs.",
      execution: ["Curl the weight bending only the elbow.", "Squeeze the biceps at the top.", "Lower over 2–3s to near-extension."],
      breathing: "Exhale up, inhale down.",
      tempo: "1s up · 2–3s down",
      mistakes: ["Using lower-back momentum.", "Elbow drifting forward.", "Dropping the negative."],
    },
  },
  {
    keys: ["triceps no banco", "mergulho", "dips"],
    pt: {
      short: "Quadril rente ao banco e descida até 90° no cotovelo.",
      setup: "Mãos na borda do banco na largura do quadril, cotovelos apontando para trás.",
      execution: ["Desça flexionando o cotovelo até ~90°.", "Mantenha o quadril rente ao banco.", "Empurre até estender."],
      breathing: "Inspire ao descer, expire ao empurrar.",
      tempo: "2s descendo · 1s empurrando",
      mistakes: ["Descer demais (estressa o ombro).", "Afastar o quadril do banco."],
    },
    en: {
      short: "Hips close to the bench and elbows bending to about 90°.",
      setup: "Hands on the bench edge hip-width, elbows pointing back.",
      execution: ["Lower bending the elbows to about 90°.", "Keep the hips close to the bench.", "Press back to extension."],
      breathing: "Inhale down, exhale pressing.",
      tempo: "2s down · 1s press",
      mistakes: ["Going too deep (stresses the shoulder).", "Letting the hips drift away from the bench."],
    },
  },
  {
    keys: ["triceps", "frances", "testa", "pushdown"],
    pt: {
      short: "Cotovelo parado — só o antebraço se move.",
      setup: "Cotovelos junto ao corpo (ou apontados ao teto, no francês), abdômen firme.",
      execution: ["Estenda o cotovelo até travar levemente.", "Segure a contração meio segundo.", "Volte controlando sem abrir o cotovelo."],
      breathing: "Expire ao estender, inspire ao voltar.",
      tempo: "1s estendendo · 2s voltando",
      mistakes: ["Cotovelo abrindo para os lados.", "Usar o ombro para empurrar.", "Amplitude curta."],
    },
    en: {
      short: "Elbow stays still — only the forearm moves.",
      setup: "Elbows at your sides (or pointing at the ceiling, for the overhead version), core braced.",
      execution: ["Extend the elbow to a soft lock.", "Hold the contraction for half a second.", "Return under control without flaring the elbow."],
      breathing: "Exhale extending, inhale returning.",
      tempo: "1s extend · 2s return",
      mistakes: ["Elbows flaring out.", "Using the shoulder to push.", "Short range of motion."],
    },
  },

  // ─── Core ────────────────────────────────────────────────────────────────
  {
    keys: ["prancha lateral", "side plank"],
    pt: {
      short: "Quadril alto e alinhado — cotovelo abaixo do ombro.",
      setup: "Apoio no antebraço, cotovelo abaixo do ombro, pés empilhados.",
      execution: ["Eleve o quadril até alinhar corpo e pernas.", "Mantenha o quadril alto durante todo o tempo.", "Respire normalmente."],
      breathing: "Respiração contínua — nunca prenda o ar.",
      tempo: "Isometria pelo tempo alvo",
      mistakes: ["Quadril caindo.", "Rodar o tronco para frente."],
    },
    en: {
      short: "Hips high and aligned — elbow under the shoulder.",
      setup: "Forearm on the floor, elbow under the shoulder, feet stacked.",
      execution: ["Lift the hips until body and legs are in line.", "Keep the hips high the whole time.", "Breathe normally."],
      breathing: "Continuous breathing — never hold your breath.",
      tempo: "Isometric hold for the target time",
      mistakes: ["Hips sagging.", "Torso rotating forward."],
    },
  },
  {
    keys: ["prancha", "plank"],
    pt: {
      short: "Linha reta do calcanhar à cabeça, glúteo e abdômen firmes.",
      setup: "Antebraços no chão, cotovelos abaixo dos ombros, pés na largura do quadril.",
      execution: ["Contraia glúteo e abdômen.", "Mantenha o quadril na linha do corpo.", "Sustente pelo tempo alvo respirando normalmente."],
      breathing: "Respiração contínua — nunca prenda o ar.",
      tempo: "Isometria pelo tempo alvo",
      mistakes: ["Quadril subindo demais.", "Lombar afundando.", "Prender a respiração."],
    },
    en: {
      short: "Straight line from heels to head, glutes and core braced.",
      setup: "Forearms down, elbows under the shoulders, feet hip-width.",
      execution: ["Squeeze glutes and core.", "Keep the hips in line with the body.", "Hold for the target time while breathing normally."],
      breathing: "Continuous breathing — never hold your breath.",
      tempo: "Isometric hold for the target time",
      mistakes: ["Hips riding too high.", "Lower back sagging.", "Holding your breath."],
    },
  },
  {
    keys: ["abdominal", "crunch", "encolhimento abdominal"],
    pt: {
      short: "Enrole a coluna sem puxar o pescoço com as mãos.",
      setup: "Deitado, joelhos flexionados, mãos ao lado da cabeça (sem entrelaçar atrás).",
      execution: ["Enrole a coluna trazendo as costelas ao quadril.", "Segure meio segundo na contração.", "Desça controlando sem relaxar o abdômen."],
      breathing: "Expire ao subir, inspire ao descer.",
      tempo: "1s subindo · 2s descendo",
      mistakes: ["Puxar a nuca com as mãos.", "Fazer por impulso.", "Ficar só na flexão de quadril."],
    },
    en: {
      short: "Roll the spine up without yanking on your neck.",
      setup: "Lying down, knees bent, hands beside the head (not laced behind).",
      execution: ["Curl the spine bringing the ribs toward the hips.", "Hold half a second at the contraction.", "Lower under control without relaxing the abs."],
      breathing: "Exhale up, inhale down.",
      tempo: "1s up · 2s down",
      mistakes: ["Pulling on the neck.", "Using momentum.", "Only flexing at the hip."],
    },
  },

  // ─── Cardio ──────────────────────────────────────────────────────────────
  {
    keys: ["burpee"],
    pt: {
      short: "Desça em duas etapas: agache, apoie e só então estenda as pernas.",
      setup: "Em pé, pés na largura do quadril.",
      execution: ["Agache e apoie as mãos no chão.", "Estenda as pernas até a prancha (com ou sem flexão).", "Volte à posição agachada e suba."],
      breathing: "Ritmo constante — não prenda o ar.",
      tempo: "Ritmo controlado, sem perder a postura",
      mistakes: ["Quadril caindo na prancha.", "Aterrissar com joelho travado."],
    },
    en: {
      short: "Break the descent into two steps: squat, plant the hands, then extend.",
      setup: "Standing, feet hip-width.",
      execution: ["Squat down and plant the hands.", "Extend the legs into a plank (with or without a push-up).", "Return to the squat and stand up."],
      breathing: "Steady rhythm — don't hold your breath.",
      tempo: "Controlled pace, without losing posture",
      mistakes: ["Hips sagging in the plank.", "Landing with locked knees."],
    },
  },
  {
    keys: ["polichinelo", "joelhos altos", "corda", "jumping", "pular"],
    pt: {
      short: "Aterrisse com a ponta do pé e joelho levemente flexionado.",
      setup: "Postura ereta, abdômen firme, ombros relaxados.",
      execution: ["Mantenha o ritmo constante.", "Aterrisse com a ponta do pé, amortecendo com o joelho.", "Mantenha o tronco estável."],
      breathing: "Respiração ritmada com o movimento.",
      tempo: "Contínuo, pelo tempo alvo",
      mistakes: ["Aterrissar com o joelho travado.", "Perder a postura quando cansa."],
    },
    en: {
      short: "Land on the balls of the feet with softly bent knees.",
      setup: "Tall posture, core braced, shoulders relaxed.",
      execution: ["Keep a steady rhythm.", "Land on the balls of the feet, absorbing with the knees.", "Keep the torso stable."],
      breathing: "Breathing timed with the movement.",
      tempo: "Continuous, for the target time",
      mistakes: ["Landing with locked knees.", "Losing posture as fatigue sets in."],
    },
  },
  {
    keys: ["esteira", "corrida", "caminhada", "treadmill", "bicicleta", "ergometrica", "eliptico", "remo ergometrico", "bike"],
    pt: {
      short: "Mantenha um ritmo em que você consegue falar frases curtas.",
      setup: "Ajuste altura/resistência antes de começar; postura ereta, ombros soltos.",
      execution: ["Comece com 2–3 min em ritmo leve para aquecer.", "Mantenha o ritmo alvo pelo tempo prescrito.", "Termine com 2 min desacelerando."],
      breathing: "Nasal quando possível; ritmo constante.",
      tempo: "Contínuo, pelo tempo alvo",
      mistakes: ["Apoiar todo o peso nas alças (esteira).", "Começar rápido demais e não sustentar."],
    },
    en: {
      short: "Hold a pace where you can still speak short sentences.",
      setup: "Set height/resistance before starting; tall posture, relaxed shoulders.",
      execution: ["Start with 2–3 min easy to warm up.", "Hold the target pace for the prescribed time.", "Finish with 2 min cooling down."],
      breathing: "Nasal when possible; steady rhythm.",
      tempo: "Continuous, for the target time",
      mistakes: ["Leaning your weight on the handles (treadmill).", "Starting too fast to sustain it."],
    },
  },
];

/** Verbete de execução do exercício, ou `null` quando não há padrão conhecido. */
export function getExerciseCoaching(
  exerciseName: string,
  language: "pt" | "en",
): CoachingCues | null {
  const name = normalize(exerciseName);
  if (!name) return null;
  for (const entry of ENTRIES) {
    if (entry.not?.some((n) => name.includes(normalize(n)))) continue;
    if (entry.keys.some((k) => name.includes(normalize(k)))) {
      return language === "en" ? entry.en : entry.pt;
    }
  }
  return null;
}

/** Só a frase curta — para listas onde não cabe a ficha inteira. */
export function getExerciseShortCue(
  exerciseName: string,
  language: "pt" | "en",
): string | null {
  return getExerciseCoaching(exerciseName, language)?.short ?? null;
}

// ── Adaptações individuais ──────────────────────────────────────────────────
// O cue genérico serve a todo mundo; estas linhas só aparecem para QUEM PRECISA.
// É o que separa "a técnica do agachamento" de "a técnica do agachamento para
// você, que tem 1,90 m e cuida do joelho".

type Adaptation = {
  /** exercícios (por palavra-chave) em que a adaptação faz sentido */
  keys: string[];
  applies: (coach: CoachProfile) => boolean;
  pt: string;
  en: string;
};

const ADAPTATIONS: Adaptation[] = [
  {
    keys: ["agachamento", "squat", "goblet"],
    applies: (c) => c.longLevers,
    pt: "Pela sua altura, o tronco inclina mais no agachamento — comece com apoio de calcanhar ou versão goblet para manter a lombar neutra.",
    en: "With your height the torso leans more in the squat — start with heel elevation or the goblet version to keep the lower back neutral.",
  },
  {
    keys: ["terra", "romeno", "stiff"],
    applies: (c) => c.longLevers,
    pt: "Alavancas longas aumentam a exigência da lombar aqui: reduza a amplitude até onde a coluna se mantém neutra.",
    en: "Long levers raise the demand on the lower back here: shorten the range to where the spine stays neutral.",
  },
  {
    keys: ["agachamento", "leg press", "avanco", "afundo", "extensora"],
    applies: (c) => c.restrictions.includes("knee"),
    pt: "Como você marcou cuidado com o joelho: trabalhe em amplitude parcial (sem passar de 90°) e mantenha o joelho na direção do dedão.",
    en: "Since you flagged knee care: work in a partial range (not past 90°) and keep the knee tracking over the big toe.",
  },
  {
    keys: ["supino", "desenvolvimento", "elevacao lateral", "crucifixo"],
    applies: (c) => c.restrictions.includes("shoulder"),
    pt: "Cuidado com o ombro: use pegada neutra sempre que possível e não desça além da linha do ombro.",
    en: "Shoulder care: use a neutral grip whenever possible and don't go below shoulder line.",
  },
  {
    keys: ["remada", "terra", "romeno", "agachamento", "abdominal"],
    applies: (c) => c.restrictions.includes("lower_back"),
    pt: "Cuidado com a lombar: prefira as versões apoiadas, mantenha o abdômen firme e pare a série ao primeiro sinal de perda da coluna neutra.",
    en: "Lower-back care: prefer supported versions, keep the core braced, and end the set at the first sign of losing a neutral spine.",
  },
  {
    keys: ["flexao", "supino", "rosca", "triceps"],
    applies: (c) => c.restrictions.includes("wrist"),
    pt: "Cuidado com o punho: use halteres com pegada neutra ou apoio para manter o punho alinhado ao antebraço.",
    en: "Wrist care: use dumbbells with a neutral grip or handles so the wrist stays in line with the forearm.",
  },
  {
    keys: ["burpee", "polichinelo", "joelhos altos", "corda", "pular"],
    applies: (c) => c.impact !== "full",
    pt: "Reduza o impacto: troque o salto por um passo alternado, mantendo o mesmo ritmo.",
    en: "Cut the impact: swap the jump for an alternating step at the same rhythm.",
  },
  {
    keys: [""],
    applies: (c) => c.ageBand === "senior" || c.ageBand === "mature",
    pt: "Faça 1 série leve de aquecimento antes da primeira série valendo — a articulação precisa de mais preparo a partir dos 40.",
    en: "Do 1 light warm-up set before your first working set — joints need more preparation after 40.",
  },
];

/**
 * Ajustes de execução específicos DESTE usuário para DESTE exercício.
 * Retorna lista vazia quando não há nada a adaptar (o caso comum).
 */
export function getCoachingAdaptations(
  exerciseName: string,
  coach: CoachProfile,
  language: "pt" | "en",
): string[] {
  const name = normalize(exerciseName);
  const out: string[] = [];
  for (const a of ADAPTATIONS) {
    const matchesExercise = a.keys.some((k) => k === "" || name.includes(normalize(k)));
    if (!matchesExercise) continue;
    if (!a.applies(coach)) continue;
    out.push(language === "en" ? a.en : a.pt);
  }
  return out;
}
