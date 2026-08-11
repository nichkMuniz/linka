import * as React from "react";

/**
 * Mantém no DOM apenas o que está perto da viewport.
 *
 * **Por que existe:** o feed é scroll infinito — depois de alguns minutos há 40,
 * 60, 100 posts montados ao mesmo tempo. Cada um traz imagem, carrossel e uma
 * superfície com `backdrop-filter`, que o WKWebView reavalia a cada frame de
 * scroll (ver docs/15-design-system.md §0.3). O custo não é re-render de React:
 * o `memo` do PostCard já cobre isso. É contagem de nós, decodificação de
 * imagem, layout, pintura e composição — trabalho que o navegador faz mesmo
 * para o que está a dez telas de distância.
 *
 * **Como funciona:** um `IntersectionObserver` com margem generosa. Enquanto o
 * item está a menos de ~1,5 tela de distância, ele fica montado normalmente.
 * Quando se afasta, medimos sua altura, desmontamos o conteúdo e deixamos no
 * lugar um espaçador com exatamente aquela altura — o scroll não se mexe um
 * pixel, e a barra de rolagem continua honesta.
 *
 * **Por que sem biblioteca:** virtualizadores de lista (react-window e afins)
 * assumem altura fixa ou exigem medição prévia, e nenhum dos dois vale para
 * cards de altura variável. Além disso, dependência nova neste projeto custa
 * caro: são dois lockfiles (npm para o Appflow, pnpm para a Vercel) que
 * precisam ser regenerados juntos, sob pena de uma das plataformas quebrar
 * sozinha.
 *
 * **O que NÃO usamos:** `content-visibility: auto` resolveria isto com uma linha
 * de CSS e sem desmontar nada — mas só existe a partir do Safari 18, e o app
 * ainda tem `IPHONEOS_DEPLOYMENT_TARGET = 15.0`.
 */
export function LazyMount({
  children,
  estimatedHeight = 480,
  rootMargin = "150%",
}: {
  children: React.ReactNode;
  /** Altura do espaçador antes de o item ter sido medido ao menos uma vez. */
  estimatedHeight?: number;
  /** Folga ao redor da viewport que ainda conta como "perto". */
  rootMargin?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Começa MONTADO de propósito. Colapsar de saída exigiria adivinhar a altura
  // de cada card, e o feed restaura a posição de scroll ao voltar de outra tela
  // — com alturas estimadas, essa restauração cairia no lugar errado. Montando
  // tudo e deixando o observer recolher no frame seguinte, as alturas medidas
  // são sempre as reais.
  const [mounted, setMounted] = React.useState(true);
  const heightRef = React.useRef(estimatedHeight);

  React.useEffect(() => {
    const el = ref.current;
    // Sem IntersectionObserver (ambiente de teste, WebView antigo) o componente
    // vira um passthrough: tudo fica montado, exatamente como antes.
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;

        if (entry.isIntersecting) {
          setMounted(true);
          return;
        }

        // Mede ANTES de desmontar — depois o elemento já está com a altura do
        // espaçador e a medida viria errada.
        const height = el.getBoundingClientRect().height;
        if (height > 0) heightRef.current = height;
        setMounted(false);
      },
      { rootMargin },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} style={mounted ? undefined : { height: heightRef.current }}>
      {mounted ? children : null}
    </div>
  );
}
