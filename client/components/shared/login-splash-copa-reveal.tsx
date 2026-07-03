// Animação temporária de apresentação da tela de login no clima da Copa do Mundo.
// Baseada no design "Linka Copa Reveal" (claude.ai/design). A animação original
// (pré-Copa) foi preservada em client/components/shared/login-splash-original.tsx.
export function LoginSplashCopaReveal() {
  return (
    <div
      className="linka-copa-stage fixed inset-0 grid place-items-center overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 48% 46%, #0d0f12 0%, #000 70%)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
      aria-label="LinKa"
    >
      <style>{`
        .linka-copa-stage {
          --word: 52vmin;
          --word-h: calc(var(--word) * 0.3038);
          --k-fx: 0.6547;
          --k-fy: 0.5067;
          --k-size: calc(var(--word) * 0.3025);
          --ball-fx: 1.116;
          --ball-fy: 0.679;
          --ball-size: calc(var(--word) * 0.268);
          --ease-expo: cubic-bezier(0.16, 1, 0.3, 1);
          --ease-soft: cubic-bezier(0.65, 0, 0.35, 1);
          --ease-kick: cubic-bezier(0.12, 0.8, 0.24, 1);
          animation: linka-copa-stage-fade 380ms ease-out 2780ms forwards;
        }
        @keyframes linka-copa-stage-fade {
          to { opacity: 0; }
        }

        .linka-copa-aura {
          position: absolute;
          width: 66vmin; height: 66vmin;
          border-radius: 50%;
          background: radial-gradient(circle,
            rgba(255, 214, 0,  0.16) 0%,
            rgba(0, 168, 89,   0.13) 30%,
            rgba(0, 120, 200,  0.07) 52%,
            transparent 70%);
          filter: blur(14px);
          opacity: 0;
          transform: scale(0.6);
          pointer-events: none;
          animation:
            linka-copa-aura-in 980ms var(--ease-expo) 70ms forwards,
            linka-copa-aura-pulse 770ms var(--ease-expo) 1050ms 1,
            linka-copa-aura-breathe 5.1s ease-in-out 2240ms infinite;
        }

        .linka-copa-lockup {
          position: relative;
          width: var(--word);
          height: var(--word-h);
          transform: translateX(calc((0.5 - var(--k-fx)) * var(--word)));
          animation: linka-copa-lockup-shift 1050ms var(--ease-expo) 1015ms forwards;
          will-change: transform;
        }

        .linka-copa-word {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: contain;
          opacity: 0;
          transform: scale(0.99);
          animation: linka-copa-word-in 1050ms var(--ease-expo) 1050ms forwards;
          user-select: none; -webkit-user-drag: none;
        }

        .linka-copa-khero {
          position: absolute;
          width: var(--k-size); height: var(--k-size);
          left: calc(var(--k-fx) * var(--word));
          top:  calc(var(--k-fy) * var(--word-h));
          transform: translate(-50%, -50%) translateY(12px) scale(0.88);
          opacity: 0;
          filter: blur(7px)
                  drop-shadow(0 10px 30px rgba(0, 168, 89, 0.22))
                  drop-shadow(0 4px 16px rgba(255, 214, 0, 0.18));
          will-change: opacity, transform, filter;
          animation:
            linka-copa-k-in 980ms var(--ease-expo) 70ms forwards,
            linka-copa-k-breathe 4.1s ease-in-out 1190ms infinite;
          user-select: none; -webkit-user-drag: none;
        }

        .linka-copa-k-shine {
          position: absolute;
          width: var(--k-size); height: var(--k-size);
          left: calc(var(--k-fx) * var(--word));
          top:  calc(var(--k-fy) * var(--word-h));
          transform: translate(-50%, -50%);
          pointer-events: none;
          overflow: hidden;
          -webkit-mask: url('/linka-copa-reveal-k.png') center/contain no-repeat;
                  mask: url('/linka-copa-reveal-k.png') center/contain no-repeat;
        }
        .linka-copa-k-shine::before {
          content: '';
          position: absolute; top: -25%; bottom: -25%; left: 0;
          width: 55%;
          background: linear-gradient(115deg, transparent 0%,
            rgba(255,255,255,0) 30%, rgba(255,255,255,0.6) 50%,
            rgba(255,255,255,0) 70%, transparent 100%);
          filter: blur(3px);
          transform: translateX(-240%) skewX(-14deg);
          animation:
            linka-copa-shine-in   1190ms var(--ease-soft) 840ms 1 forwards,
            linka-copa-shine-loop 5950ms var(--ease-soft) 3920ms infinite;
        }

        .linka-copa-ball {
          position: absolute;
          width: var(--ball-size); height: var(--ball-size);
          left: calc(var(--ball-fx) * var(--word));
          top:  calc(var(--ball-fy) * var(--word-h));
          transform-origin: center;
          opacity: 0;
          transform:
            translate(-50%, -50%)
            translateX(calc((var(--k-fx) - var(--ball-fx)) * var(--word)))
            translateY(calc((var(--k-fy) - var(--ball-fy)) * var(--word-h)))
            scale(0.35) rotate(-140deg);
          filter: drop-shadow(0 8px 18px rgba(0,0,0,0.5));
          will-change: transform, opacity;
          animation:
            linka-copa-ball-kick 630ms var(--ease-kick) 1085ms forwards,
            linka-copa-ball-settle 2.9s ease-in-out 1750ms infinite;
          user-select: none; -webkit-user-drag: none;
        }

        .linka-copa-streak {
          position: absolute;
          left: calc(var(--k-fx) * var(--word));
          top:  calc(var(--ball-fy) * var(--word-h));
          width: calc((var(--ball-fx) - var(--k-fx)) * var(--word));
          height: calc(var(--ball-size) * 0.18);
          transform: translateY(-50%) scaleX(0);
          transform-origin: left center;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(255, 214, 0, 0.0) 8%,
            rgba(255, 214, 0, 0.55) 60%,
            rgba(255, 255, 255, 0.85) 100%);
          border-radius: 999px;
          filter: blur(2px);
          opacity: 0;
          pointer-events: none;
          animation: linka-copa-streak 630ms var(--ease-kick) 1085ms forwards;
        }

        @keyframes linka-copa-aura-in     { 0%{opacity:0;transform:scale(0.6)} 100%{opacity:0.9;transform:scale(1)} }
        @keyframes linka-copa-aura-pulse  { 0%{transform:scale(1);opacity:0.9} 50%{transform:scale(1.18);opacity:1} 100%{transform:scale(1.05);opacity:0.75} }
        @keyframes linka-copa-aura-breathe{ 0%,100%{transform:scale(1.02);opacity:0.62} 50%{transform:scale(1.10);opacity:0.85} }

        @keyframes linka-copa-k-in {
          0%   { opacity:0; transform: translate(-50%,-50%) translateY(12px) scale(0.88);
                 filter: blur(7px) drop-shadow(0 10px 30px rgba(0,168,89,0.22)) drop-shadow(0 4px 16px rgba(255,214,0,0.18)); }
          55%  { opacity:1; }
          72%  { transform: translate(-50%,-50%) translateY(0) scale(1.015);
                 filter: blur(0) drop-shadow(0 10px 30px rgba(0,168,89,0.22)) drop-shadow(0 4px 16px rgba(255,214,0,0.18)); }
          100% { opacity:1; transform: translate(-50%,-50%) translateY(0) scale(1);
                 filter: blur(0) drop-shadow(0 10px 30px rgba(0,168,89,0.22)) drop-shadow(0 4px 16px rgba(255,214,0,0.18)); }
        }
        @keyframes linka-copa-k-breathe {
          0%,100% { filter: blur(0) drop-shadow(0 10px 30px rgba(0,168,89,0.22)) drop-shadow(0 4px 16px rgba(255,214,0,0.18)); }
          50%     { filter: blur(0) drop-shadow(0 16px 46px rgba(0,190,100,0.34)) drop-shadow(0 6px 22px rgba(255,214,0,0.28)); }
        }

        @keyframes linka-copa-lockup-shift {
          0%   { transform: translateX(calc((0.5 - var(--k-fx)) * var(--word))); }
          100% { transform: translateX(0); }
        }
        @keyframes linka-copa-word-in {
          0%   { opacity:0; transform: scale(0.99); }
          45%  { opacity:1; }
          100% { opacity:1; transform: scale(1); }
        }

        @keyframes linka-copa-shine-in   { 0%{transform:translateX(-240%) skewX(-14deg)} 100%{transform:translateX(340%) skewX(-14deg)} }
        @keyframes linka-copa-shine-loop { 0%,18%{transform:translateX(-240%) skewX(-14deg)} 38%{transform:translateX(340%) skewX(-14deg)} 100%{transform:translateX(340%) skewX(-14deg)} }

        @keyframes linka-copa-ball-kick {
          0% {
            opacity: 0;
            transform: translate(-50%,-50%)
              translateX(calc((var(--k-fx) - var(--ball-fx)) * var(--word)))
              translateY(calc((var(--k-fy) - var(--ball-fy)) * var(--word-h)))
              scale(0.35) rotate(-140deg);
          }
          12% { opacity: 1; }
          78% {
            transform: translate(-50%,-50%) translateX(4%) translateY(-3%) scale(1.05) rotate(560deg);
          }
          100% {
            opacity: 1;
            transform: translate(-50%,-50%) translateX(0) translateY(0) scale(1) rotate(620deg);
          }
        }
        @keyframes linka-copa-ball-settle {
          0%,100% { margin-top: 0; }
          50%     { margin-top: -1.1%; }
        }

        @keyframes linka-copa-streak {
          0%   { opacity:0; transform: translateY(-50%) scaleX(0); }
          18%  { opacity:0.9; }
          55%  { opacity:0.8; transform: translateY(-50%) scaleX(1); }
          100% { opacity:0; transform: translateY(-50%) scaleX(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .linka-copa-aura, .linka-copa-word, .linka-copa-khero, .linka-copa-k-shine::before,
          .linka-copa-ball, .linka-copa-streak, .linka-copa-lockup, .linka-copa-stage {
            animation: none !important; opacity: 1 !important;
          }
          .linka-copa-khero { transform: translate(-50%,-50%) !important; filter: none !important; }
          .linka-copa-ball  { transform: translate(-50%,-50%) !important; }
          .linka-copa-streak{ opacity: 0 !important; }
          .linka-copa-lockup{ transform: translateX(0) !important; }
        }
      `}</style>

      <div className="linka-copa-aura" aria-hidden="true" />

      <div className="linka-copa-lockup">
        <img className="linka-copa-word" src="/linka-copa-reveal-word.png" alt="LinKa" />
        <img className="linka-copa-khero" src="/linka-copa-reveal-k.png" alt="" aria-hidden="true" />
        <div className="linka-copa-k-shine" aria-hidden="true" />
        <div className="linka-copa-streak" aria-hidden="true" />
        <img className="linka-copa-ball" src="/linka-copa-reveal-ball.png" alt="" aria-hidden="true" />
      </div>
    </div>
  );
}
