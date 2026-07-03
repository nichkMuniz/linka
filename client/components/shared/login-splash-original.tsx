// Animação de apresentação original da tela de login (pré-Copa do Mundo).
// Preservada aqui para reutilização futura — ver client/pages/Login.tsx para o uso atual.
export function LoginSplashOriginal() {
  return (
    <div
      className="linka-reveal-stage fixed inset-0 grid place-items-center overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at center, #0b0b0e 0%, #000 70%)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
      aria-label="LinKa"
    >
      <style>{`
        @keyframes linka-aura-in {
          0%   { opacity: 0;   transform: scale(0.6); }
          100% { opacity: 0.9; transform: scale(1);   }
        }
        @keyframes linka-aura-pulse {
          0%   { transform: scale(1);    opacity: 0.9; }
          50%  { transform: scale(1.18); opacity: 1;   }
          100% { transform: scale(1.05); opacity: 0.75;}
        }
        @keyframes linka-aura-breathe {
          0%, 100% { transform: scale(1.02); opacity: 0.65; }
          50%      { transform: scale(1.10); opacity: 0.85; }
        }
        @keyframes linka-symbol-in {
          0%   { opacity: 0; transform: translateY(10px) scale(0.9); }
          55%  { opacity: 1; }
          72%  { opacity: 1; transform: translateY(0) scale(1.012); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes linka-symbol-breathe {
          0%, 100% { filter: drop-shadow(0 8px 28px rgba(255, 110, 60, 0.14))
                             drop-shadow(0 4px 14px rgba(120, 80, 220, 0.10)); }
          50%      { filter: drop-shadow(0 14px 44px rgba(255, 130, 70, 0.26))
                             drop-shadow(0 6px 20px rgba(150, 100, 240, 0.20)); }
        }
        @keyframes linka-lockup-shift {
          0%   { transform: translateX(calc((var(--linka-word-w) + var(--linka-gap)) / 2)); }
          100% { transform: translateX(0); }
        }
        @keyframes linka-word-emerge {
          0%   { opacity: 0; transform: translateX(calc(-1 * (var(--linka-word-w) + var(--linka-gap)))) scale(0.985); }
          25%  { opacity: 0; }
          55%  { opacity: 1; }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes linka-shine-in {
          0%   { transform: translateX(-220%) skewX(-14deg); }
          100% { transform: translateX(320%)  skewX(-14deg); }
        }
        @keyframes linka-shine-loop {
          0%, 18% { transform: translateX(-220%) skewX(-14deg); }
          38%     { transform: translateX(320%)  skewX(-14deg); }
          100%    { transform: translateX(320%)  skewX(-14deg); }
        }
        .linka-reveal-stage {
          --linka-sym: 26vmin;
          --linka-word-w: 35.2vmin;
          --linka-gap: 2.5vmin;
          animation: linka-stage-fade 380ms ease-out 2820ms forwards;
        }
        @keyframes linka-stage-fade {
          to { opacity: 0; }
        }
        .linka-aura {
          position: absolute;
          width: 60vmin; height: 60vmin;
          border-radius: 50%;
          background: radial-gradient(circle,
            rgba(255, 130, 70, 0.18) 0%,
            rgba(180, 90, 220, 0.12) 28%,
            rgba(80, 140, 230, 0.08) 50%,
            transparent 70%);
          filter: blur(12px);
          opacity: 0;
          transform: scale(0.6);
          pointer-events: none;
          animation:
            linka-aura-in 1400ms cubic-bezier(0.16, 1, 0.3, 1) 100ms forwards,
            linka-aura-pulse 1100ms cubic-bezier(0.22, 1, 0.36, 1) 1500ms 1,
            linka-aura-breathe 6s ease-in-out 3000ms infinite;
        }
        .linka-lockup {
          position: relative;
          display: flex;
          align-items: center;
          gap: var(--linka-gap);
          transform: translateX(calc((var(--linka-word-w) + var(--linka-gap)) / 2));
          animation: linka-lockup-shift 1400ms cubic-bezier(0.16, 1, 0.3, 1) 1500ms forwards;
          will-change: transform;
        }
        .linka-symbol {
          position: relative;
          z-index: 2;
          width: var(--linka-sym);
          height: var(--linka-sym);
          opacity: 0;
          transform: translateY(10px) scale(0.9);
          will-change: opacity, transform;
          animation: linka-symbol-in 1400ms cubic-bezier(0.16, 1, 0.3, 1) 100ms forwards;
        }
        .linka-symbol-fx {
          position: absolute;
          inset: 0;
          filter: drop-shadow(0 8px 28px rgba(255, 110, 60, 0.14))
                  drop-shadow(0 4px 14px rgba(120, 80, 220, 0.10));
          animation: linka-symbol-breathe 4.6s ease-in-out 1700ms infinite;
        }
        .linka-symbol img {
          width: 100%; height: 100%;
          display: block;
          user-select: none;
          -webkit-user-drag: none;
        }
        .linka-shimmer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          -webkit-mask: url('/linka-reveal-symbol.png') center/contain no-repeat;
                  mask: url('/linka-reveal-symbol.png') center/contain no-repeat;
        }
        .linka-shimmer::before {
          content: '';
          position: absolute;
          top: -20%; bottom: -20%;
          left: 0;
          width: 55%;
          background: linear-gradient(115deg,
            transparent 0%,
            rgba(255, 255, 255, 0.0) 30%,
            rgba(255, 255, 255, 0.55) 50%,
            rgba(255, 255, 255, 0.0) 70%,
            transparent 100%);
          filter: blur(3px);
          transform: translateX(-220%) skewX(-14deg);
          animation:
            linka-shine-in   1700ms cubic-bezier(0.65, 0, 0.35, 1) 1300ms 1 forwards,
            linka-shine-loop 6500ms cubic-bezier(0.65, 0, 0.35, 1) 5400ms infinite;
        }
        .linka-wordmark {
          position: relative;
          z-index: 1;
          width: var(--linka-word-w);
          height: calc(var(--linka-sym) / 1.18);
          display: block;
          opacity: 0;
          transform: translateX(calc(-1 * (var(--linka-word-w) + var(--linka-gap)))) scale(0.985);
          user-select: none;
          -webkit-user-drag: none;
          animation: linka-word-emerge 1400ms cubic-bezier(0.16, 1, 0.3, 1) 1500ms forwards;
          will-change: transform, opacity;
          filter: drop-shadow(0 4px 14px rgba(255, 255, 255, 0.06));
        }
        @media (prefers-reduced-motion: reduce) {
          .linka-aura, .linka-lockup, .linka-symbol, .linka-symbol-fx, .linka-wordmark, .linka-shimmer::before, .linka-reveal-stage {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <div className="linka-aura" aria-hidden="true" />

      <div className="linka-lockup">
        <div className="linka-symbol">
          <div className="linka-symbol-fx">
            <img src="/linka-reveal-symbol.png" alt="LinKa" />
            <div className="linka-shimmer" aria-hidden="true" />
          </div>
        </div>
        <img className="linka-wordmark" src="/linka-reveal-wordmark.png" alt="" />
      </div>
    </div>
  );
}
