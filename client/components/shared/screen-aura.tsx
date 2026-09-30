/**
 * Brilho de fundo das telas (docs/15-design-system.md §12.4.1). Uma camada
 * `fixed inset-0 -z-10` com `radial-gradient` pintado direto — sem
 * `filter: blur`, que o WebKit recompõe a cada frame de scroll.
 *
 * `fixed` de propósito: o container da página começa ABAIXO do header, e um
 * brilho preso a ele saía cortado numa linha reta ali (a "faixa preta"). Assim
 * ele começa no topo da tela, por trás do vidro do header, igual em todas as
 * telas. Só aparece porque o raiz do AppLayout tem `isolate` — sem ele o
 * `-z-10` fica atrás do `bg-background`.
 */
const PRESETS = {
  feed:
    "radial-gradient(340px 340px at 8% 4%, rgba(216,86,122,.34), transparent 70%)," +
    "radial-gradient(300px 300px at 92% 42%, rgba(63,127,230,.30), transparent 70%)," +
    "radial-gradient(280px 280px at 26% 74%, rgba(123,63,242,.26), transparent 70%)",
  goals:
    "radial-gradient(320px 320px at 8% 4%, rgba(255,122,60,.28), transparent 70%)," +
    "radial-gradient(300px 300px at 96% 48%, rgba(63,127,230,.28), transparent 70%)",
  notifications: "radial-gradient(300px 300px at 8% 6%, rgba(216,86,122,.24), transparent 70%)",
  // Busca e Comunidade: mais discreto — são telas de lista/leitura.
  neutral:
    "radial-gradient(320px 320px at 8% 4%, rgba(123,63,242,.20), transparent 70%)," +
    "radial-gradient(300px 300px at 96% 46%, rgba(63,127,230,.16), transparent 70%)",
} as const;

export type ScreenAuraVariant = keyof typeof PRESETS;

export function ScreenAura({ variant }: { variant: ScreenAuraVariant }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ background: PRESETS[variant] }}
    />
  );
}
