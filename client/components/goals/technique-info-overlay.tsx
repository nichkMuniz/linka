import * as React from "react";
import { useLanguage } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/i18n";
import type { WorkoutTechnique } from "@/lib/ritmofit-db";

/**
 * Explicação de uma técnica de treino — abre ao tocar no selo (Bi-set, A1/A2,
 * Drop-set…) dentro da sessão de treino.
 *
 * Sugerir uma técnica sem explicá-la só transfere a dúvida: quem não sabe o que
 * é rest-pause vê um selo roxo e ignora. O modal responde as três perguntas que
 * importam na hora — **o que é**, **como faço** e **quando usar**.
 *
 * **Por que não é um `Drawer` do projeto:** a sessão de treino é um portal
 * `position: fixed` com `z-index: 9999`; um drawer da lib (z-50) renderizaria
 * atrás dela. Este overlay é `position: absolute` DENTRO da árvore da sessão,
 * com `zIndex` recebido por prop — mesmo padrão do `ExerciseDetailOverlay`.
 */

type InfoKeys = {
  title: TranslationKey;
  what: TranslationKey;
  /** passos separados por "\n" numa única chave — evita 4 chaves por técnica */
  steps: TranslationKey;
  when: TranslationKey;
};

const TECHNIQUE_INFO: Partial<Record<WorkoutTechnique, InfoKeys>> = {
  biset: {
    title: "goals_technique_biset",
    what: "goals_tech_biset_what",
    steps: "goals_tech_biset_steps",
    when: "goals_tech_biset_when",
  },
  triset: {
    title: "goals_technique_triset",
    what: "goals_tech_triset_what",
    steps: "goals_tech_triset_steps",
    when: "goals_tech_triset_when",
  },
  drop: {
    title: "goals_technique_drop",
    what: "goals_tech_drop_what",
    steps: "goals_tech_drop_steps",
    when: "goals_tech_drop_when",
  },
  rest_pause: {
    title: "goals_technique_rest_pause",
    what: "goals_tech_rest_pause_what",
    steps: "goals_tech_rest_pause_steps",
    when: "goals_tech_rest_pause_when",
  },
};

/** true = a técnica tem verbete. Gateia o selo virar botão. */
export function hasTechniqueInfo(t: WorkoutTechnique | null | undefined): boolean {
  return !!t && !!TECHNIQUE_INFO[t];
}

const ACCENT = "#c084fc";

interface TechniqueInfoOverlayProps {
  technique: WorkoutTechnique;
  /** nomes dos exercícios do bloco — só para bi-set/tri-set */
  blockMembers?: string[];
  zIndex: number;
  onClose: () => void;
}

export function TechniqueInfoOverlay({
  technique, blockMembers, zIndex, onClose,
}: TechniqueInfoOverlayProps) {
  const { t } = useLanguage();
  const info = TECHNIQUE_INFO[technique];
  if (!info) return null;

  const steps = t(info.steps).split("\n").filter(Boolean);

  const section = (label: string, body: React.ReactNode) => (
    <div style={{ width: "100%", marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 0.7,
        textTransform: "uppercase", color: "rgba(255,255,255,0.5)",
        marginBottom: 8,
      }}>
        {label}
      </div>
      {body}
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", flexDirection: "column",
        paddingTop: "max(64px, calc(env(safe-area-inset-top) + 44px))",
        paddingBottom: "max(20px, env(safe-area-inset-bottom))",
      }}
    >
      <button
        onClick={onClose}
        aria-label={t("goals_cancel")}
        style={{
          position: "absolute", top: "max(12px, env(safe-area-inset-top))", right: 16,
          width: 40, height: 40, borderRadius: "50%",
          background: "rgba(18,17,26,0.78)",
          border: "1px solid rgba(255,255,255,0.22)",
          backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 2,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1, overflowY: "auto", overflowX: "hidden",
          overscrollBehavior: "contain", WebkitOverflowScrolling: "touch",
          padding: "0 20px",
        }}
      >
        <div style={{
          fontSize: 24, fontWeight: 800, color: "#fff",
          marginBottom: 6, fontFamily: "'Inter', system-ui",
        }}>
          {t(info.title)}
        </div>

        {/* Quais exercícios formam ESTE bloco — a explicação genérica vira
            concreta quando o usuário vê os próprios exercícios. */}
        {blockMembers && blockMembers.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18,
          }}>
            {blockMembers.map((name, i) => (
              <React.Fragment key={name}>
                {i > 0 && (
                  <span style={{ color: ACCENT, fontWeight: 800, alignSelf: "center" }}>+</span>
                )}
                <span style={{
                  fontSize: 12, fontWeight: 700, color: ACCENT,
                  background: "rgba(192,132,252,0.14)",
                  border: "1px solid rgba(192,132,252,0.4)",
                  borderRadius: 20, padding: "4px 12px",
                }}>
                  {name}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
        {(!blockMembers || blockMembers.length === 0) && <div style={{ height: 12 }} />}

        {section(
          t("goals_tech_info_what"),
          <p style={{
            fontSize: 15, lineHeight: 1.6, margin: 0,
            color: "rgba(255,255,255,0.85)",
          }}>
            {t(info.what)}
          </p>,
        )}

        {section(
          t("goals_tech_info_how"),
          <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {steps.map((step, i) => (
              <li key={i} style={{
                display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start",
              }}>
                <span style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                  background: "rgba(192,132,252,0.16)",
                  border: `1px solid rgba(192,132,252,0.4)`,
                  color: ACCENT, fontSize: 11, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: 1,
                }}>
                  {i + 1}
                </span>
                <span style={{
                  fontSize: 14.5, lineHeight: 1.55,
                  color: "rgba(255,255,255,0.82)",
                }}>
                  {step}
                </span>
              </li>
            ))}
          </ol>,
        )}

        {section(
          t("goals_tech_info_when"),
          <div style={{
            borderRadius: 14, padding: "12px 14px",
            background: "rgba(192,132,252,0.08)",
            border: "1px solid rgba(192,132,252,0.28)",
          }}>
            <p style={{
              fontSize: 14, lineHeight: 1.55, margin: 0,
              color: "rgba(255,255,255,0.82)",
            }}>
              {t(info.when)}
            </p>
          </div>,
        )}
      </div>
    </div>
  );
}
