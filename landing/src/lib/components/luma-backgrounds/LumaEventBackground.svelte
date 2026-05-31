<script lang="ts">
  import { EVENT_BACKGROUND_VARIANTS, type EventBackgroundVariant } from "./variants.js";

  type Props = {
    variant?: EventBackgroundVariant | "cycle";
    class?: string;
  };

  let { variant = "cycle", class: className = "" }: Props = $props();

  const rootClass = $derived(["luma-event-background", `is-${variant}`, className].filter(Boolean).join(" "));
</script>

<div class={rootClass} aria-hidden="true">
  <div class="background-base"></div>

  {#each EVENT_BACKGROUND_VARIANTS as item (item)}
    <div class={`scene scene-${item}`}>
      {#if item === "serpent"}
        <div class="serpent-field"></div>
        <svg class="snake-map" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="luma-snake-primary" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#be185d" />
              <stop offset="34%" stop-color="#ec4899" />
              <stop offset="62%" stop-color="#f59e0b" />
              <stop offset="100%" stop-color="#ef4444" />
            </linearGradient>
            <linearGradient id="luma-snake-secondary" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stop-color="#ec4899" />
              <stop offset="48%" stop-color="#f472b6" />
              <stop offset="100%" stop-color="#f97316" />
            </linearGradient>
            <filter id="luma-snake-blur" x="-12%" y="-35%" width="124%" height="170%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
          </defs>

          <path
            class="snake-halo"
            pathLength="1400"
            d="M -70 650 C 145 498 273 782 455 614 S 735 342 954 488 S 1234 770 1460 506 S 1662 182 1774 336" />
          <path
            class="snake-runner snake-a"
            pathLength="1400"
            d="M -70 650 C 145 498 273 782 455 614 S 735 342 954 488 S 1234 770 1460 506 S 1662 182 1774 336" />
          <path
            class="snake-runner snake-b"
            pathLength="1400"
            d="M -150 250 C 90 80 220 220 360 170 S 620 22 805 150 S 1040 382 1250 230 S 1500 50 1740 180" />
          <path
            class="snake-runner snake-c"
            pathLength="1400"
            d="M -180 590 C 100 700 250 440 460 550 S 780 720 1010 500 S 1260 230 1490 370 S 1650 520 1760 430" />
          <path
            class="snake-runner snake-d"
            pathLength="1400"
            d="M -120 120 C 130 260 300 40 500 126 S 820 300 1020 120 S 1320 -20 1530 158 S 1680 260 1780 204" />
          <path
            class="snake-thread"
            pathLength="1400"
            d="M 30 780 C 226 658 340 856 520 742 S 754 568 938 668 S 1176 848 1368 710 S 1508 512 1650 592" />
        </svg>
      {:else if item === "quantum"}
        <div class="mesh mesh-primary"></div>
        <div class="mesh mesh-secondary"></div>
        <div class="mesh-shimmer"></div>
      {:else if item === "classic-snake"}
        <div class="classic-snake-field"></div>
        <svg class="classic-snake-map" viewBox="0 0 1600 900" preserveAspectRatio="xMinYMid slice">
          <path
            class="classic-snake-body classic-snake-main"
            pathLength="2200"
            d="M -240 170 H 220 V 70 H 560 V 190 H 980 V 90 H 1320 V 170 H 1820" />
          <path
            class="classic-snake-body classic-snake-mid"
            pathLength="2200"
            d="M 90 -180 V 120 H 250 V 360 H 90 V 620 H 260 V 1040" />
          <path
            class="classic-snake-body classic-snake-small"
            pathLength="2200"
            d="M 1840 270 H 1500 V 470 H 1710 V 650 H 1380 V 840 H -260" />
        </svg>
        <span class="classic-pellet pellet-a">❇️</span>
        <span class="classic-pellet pellet-b">❇️</span>
        <span class="classic-pellet pellet-c">❇️</span>
      {:else if item === "ribbon"}
        <div class="ribbon-field"></div>
        <div class="ribbon-grid"></div>
        <div class="ribbon-sheen"></div>
      {:else}
        <div class="topography-field"></div>
        <div class="contour contour-a"></div>
        <div class="contour contour-b"></div>
        <div class="contour-drift"></div>
      {/if}
    </div>
  {/each}

  <div class="event-grain"></div>
  <div class="event-fade"></div>
</div>

<style>
  .luma-event-background {
    min-height: 760px;
    overflow: hidden;
    pointer-events: none;
    contain: layout paint style;
    isolation: isolate;
    background:
      radial-gradient(76% 52% at 50% -12%, rgb(15 23 42 / 0.07), transparent 64%),
      linear-gradient(180deg, rgb(248 250 252 / 0.9) 0%, rgb(248 250 252 / 0.5) 66%, rgb(248 250 252 / 0) 100%);
  }

  .background-base,
  .scene,
  .scene::before,
  .scene::after,
  .event-grain,
  .event-fade {
    position: absolute;
    inset: 0;
  }

  .background-base {
    z-index: -2;
    background:
      linear-gradient(110deg, rgb(255 255 255 / 0.7), rgb(255 255 255 / 0.2) 44%, transparent 76%),
      radial-gradient(56% 38% at 12% 8%, rgb(236 72 153 / 0.22), transparent 64%),
      radial-gradient(48% 32% at 86% 4%, rgb(251 146 60 / 0.22), transparent 66%);
  }

  .scene {
    inset: -18% -10% 0;
    opacity: 0;
    transform: translateZ(0);
    transition: opacity 680ms ease;
    will-change: opacity;
  }

  .is-cycle .scene-serpent {
    animation: luma-cycle-serpent 60s linear infinite;
  }

  .is-cycle .scene-quantum {
    animation: luma-cycle-quantum 60s linear infinite;
  }

  .is-cycle .scene-classic-snake {
    animation: luma-cycle-classic-snake 60s linear infinite;
  }

  .is-cycle .scene-ribbon {
    animation: luma-cycle-ribbon 60s linear infinite;
  }

  .is-cycle .scene-topography {
    animation: luma-cycle-topography 60s linear infinite;
  }

  .is-serpent .scene-serpent,
  .is-quantum .scene-quantum,
  .is-classic-snake .scene-classic-snake,
  .is-ribbon .scene-ribbon,
  .is-topography .scene-topography {
    opacity: 1;
  }

  .scene-serpent {
    -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 66%, transparent 96%);
    mask-image: linear-gradient(180deg, #000 0%, #000 66%, transparent 96%);
    background:
      radial-gradient(52% 38% at 50% 34%, rgb(236 72 153 / 0.2), transparent 72%),
      radial-gradient(44% 34% at 78% 42%, rgb(249 115 22 / 0.18), transparent 70%),
      linear-gradient(180deg, rgb(255 255 255 / 0.34), transparent 76%);
  }

  .scene-serpent::after {
    content: "";
    background: radial-gradient(ellipse 48% 34% at 50% 31%, rgb(248 250 252 / 0.58), rgb(248 250 252 / 0.2) 48%, transparent 76%);
  }

  .serpent-field {
    position: absolute;
    inset: 8% 0 12%;
    opacity: 0.22;
    background-image:
      repeating-linear-gradient(103deg, transparent 0 18px, rgb(15 23 42 / 0.1) 19px, transparent 20px),
      repeating-linear-gradient(23deg, transparent 0 34px, rgb(236 72 153 / 0.08) 35px, transparent 36px),
      linear-gradient(115deg, rgb(236 72 153 / 0.08), transparent 48%, rgb(20 184 166 / 0.12));
    mask-image: radial-gradient(ellipse 64% 48% at 50% 32%, #000 0%, transparent 74%);
    animation: luma-field-drift 18s ease-in-out infinite alternate;
  }

  .snake-map {
    position: absolute;
    left: 50%;
    top: -11%;
    width: 154vw;
    min-width: 1900px;
    height: 760px;
    overflow: visible;
    transform: translateX(-50%);
    -webkit-mask-image: radial-gradient(ellipse 44% 34% at 50% 43%, transparent 0 40%, rgb(0 0 0 / 0.42) 58%, #000 80%);
    mask-image: radial-gradient(ellipse 44% 34% at 50% 43%, transparent 0 40%, rgb(0 0 0 / 0.42) 58%, #000 80%);
  }

  .snake-halo,
  .snake-runner,
  .snake-thread {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .snake-halo {
    stroke: url("#luma-snake-primary");
    stroke-width: 102;
    stroke-dasharray: 300 1100;
    stroke-dashoffset: 120;
    opacity: 0.18;
    filter: url("#luma-snake-blur");
    animation: luma-snake 24s linear infinite;
  }

  .snake-runner {
    stroke-width: 46;
    stroke-dasharray: 190 1210;
    stroke-dashoffset: 0;
    opacity: 0.72;
    animation: luma-snake 13s linear infinite;
  }

  .snake-a {
    stroke: url("#luma-snake-primary");
    opacity: 0.84;
    filter: drop-shadow(0 16px 28px rgb(20 184 166 / 0.18));
    animation-duration: 12s;
    animation-delay: -1s;
  }

  .snake-b {
    stroke: url("#luma-snake-secondary");
    stroke-width: 34;
    opacity: 0.64;
    animation-duration: 19s;
    animation-delay: -8s;
  }

  .snake-c {
    stroke: url("#luma-snake-primary");
    stroke-width: 26;
    stroke-dasharray: 150 1250;
    opacity: 0.48;
    animation-duration: 27s;
    animation-delay: -15s;
  }

  .snake-d {
    stroke: url("#luma-snake-secondary");
    stroke-width: 22;
    stroke-dasharray: 120 1280;
    opacity: 0.38;
    animation-duration: 35s;
    animation-delay: -22s;
  }

  .snake-thread {
    stroke: rgb(15 23 42 / 0.16);
    stroke-width: 5;
    stroke-dasharray: 32 42;
    animation: luma-snake-thread 22s linear infinite;
  }

  .mesh,
  .mesh-shimmer,
  .classic-snake-field,
  .ribbon-field,
  .ribbon-grid,
  .ribbon-sheen,
  .topography-field,
  .contour,
  .contour-drift {
    position: absolute;
    inset: 0;
  }

  .scene-quantum {
    mix-blend-mode: multiply;
  }

  .scene-quantum::before {
    content: "";
    inset: 4% -6% 18%;
    opacity: 0.18;
    background-image:
      repeating-linear-gradient(100deg, transparent 0 26px, rgb(15 23 42 / 0.16) 27px 28px),
      repeating-linear-gradient(10deg, transparent 0 42px, rgb(236 72 153 / 0.18) 43px 44px);
    mask-image: radial-gradient(ellipse 66% 46% at 50% 32%, #000 0%, transparent 72%);
    mix-blend-mode: multiply;
    transform: skewY(-5deg);
    animation: luma-quantum-lattice 18s linear infinite;
  }

  .scene-quantum::after {
    content: "";
    background:
      radial-gradient(ellipse 52% 38% at 50% 30%, rgb(248 250 252 / 0.74), rgb(248 250 252 / 0.28) 50%, transparent 76%),
      linear-gradient(180deg, rgb(248 250 252 / 0.1), transparent 58%);
  }

  .mesh {
    inset: -30%;
    filter: blur(18px) saturate(1.24);
    transform-origin: 50% 42%;
  }

  .mesh-primary {
    opacity: 0.78;
    background:
      radial-gradient(ellipse 56% 44% at 18% 20%, rgb(236 72 153 / 0.4), transparent 61%),
      radial-gradient(ellipse 44% 38% at 78% 14%, rgb(251 146 60 / 0.42), transparent 64%),
      radial-gradient(ellipse 48% 44% at 62% 78%, rgb(34 197 94 / 0.3), transparent 62%),
      radial-gradient(ellipse 40% 34% at 92% 70%, rgb(239 68 68 / 0.28), transparent 64%);
    animation: luma-mesh-drift 19s ease-in-out infinite alternate;
  }

  .mesh-secondary {
    opacity: 0.54;
    mix-blend-mode: screen;
    background:
      conic-gradient(from 130deg at 48% 38%, transparent 0deg, rgb(45 212 191 / 0.36) 78deg, rgb(253 186 116 / 0.42) 146deg, transparent 228deg, rgb(244 114 182 / 0.32) 316deg, transparent 360deg),
      linear-gradient(100deg, transparent, rgb(255 255 255 / 0.46), transparent);
    animation: luma-mesh-turn 27s ease-in-out infinite alternate;
  }

  .mesh-shimmer {
    inset: 2% -12% 22%;
    opacity: 0.36;
    filter: blur(12px);
    background:
      linear-gradient(108deg, transparent 5%, rgb(255 255 255 / 0.68) 15%, transparent 28%, transparent 50%, rgb(255 255 255 / 0.44) 62%, transparent 78%),
      linear-gradient(180deg, transparent, rgb(45 212 191 / 0.12), transparent);
    mask-image: radial-gradient(ellipse 58% 44% at 50% 32%, #000 0%, transparent 72%);
    animation: luma-shimmer 14s ease-in-out infinite;
  }

  .scene-classic-snake {
    inset: -18% 0 0;
    z-index: 6;
    background: linear-gradient(180deg, rgb(240 253 244 / 0.42), rgb(255 255 255 / 0));
  }

  .scene-classic-snake::after {
    content: none;
  }

  .classic-snake-field {
    inset: 0 0 14%;
    opacity: 0.3;
    background-image:
      linear-gradient(to right, rgb(22 101 52 / 0.2) 1px, transparent 1px),
      linear-gradient(to bottom, rgb(22 101 52 / 0.2) 1px, transparent 1px);
    background-size:
      48px 48px,
      48px 48px;
    background-position:
      0 0,
      0 0;
    -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 66%, transparent 96%);
    mask-image: linear-gradient(180deg, #000 0%, #000 66%, transparent 96%);
  }

  .classic-snake-map {
    position: absolute;
    left: 0;
    top: -7%;
    width: clamp(1180px, 104vw, 1760px);
    height: 740px;
    overflow: visible;
    transform: none;
  }

  .classic-snake-body {
    fill: none;
    stroke-linecap: square;
    stroke-linejoin: miter;
  }

  .classic-snake-body {
    stroke: #16a34a;
    stroke-width: 18;
    stroke-dasharray: 300 2400;
    stroke-dashoffset: 0;
    opacity: 1;
    filter: none;
  }

  .classic-snake-main {
    --snake-duration: 14s;
  }

  .classic-snake-mid {
    --snake-duration: 18s;
    --snake-delay: -6s;
    stroke-dasharray: 220 2400;
    opacity: 1;
  }

  .classic-snake-small {
    --snake-duration: 22s;
    --snake-delay: -12s;
    stroke-dasharray: 150 2400;
    opacity: 1;
  }

  .is-classic-snake .classic-snake-body,
  .is-cycle .classic-snake-body {
    animation-delay: var(--snake-delay, 0s);
    animation-duration: var(--snake-duration, 14s);
    animation-iteration-count: infinite;
    animation-name: luma-classic-snake;
    animation-timing-function: steps(52, end);
  }

  .classic-pellet {
    position: absolute;
    z-index: 3;
    display: grid;
    width: 20px;
    height: 20px;
    place-items: center;
    background: transparent;
    font-size: 17px;
    line-height: 1;
    opacity: 1;
    animation: luma-pellet-pop 2.8s steps(2, end) infinite;
  }

  .pellet-a {
    left: 21%;
    top: 34%;
  }

  .pellet-b {
    right: 24%;
    top: 23%;
    animation-delay: -0.9s;
  }

  .pellet-c {
    left: 67%;
    top: 54%;
    animation-delay: -1.8s;
  }

  .scene-ribbon {
    background:
      radial-gradient(64% 44% at 46% 20%, rgb(255 255 255 / 0.72), transparent 66%),
      linear-gradient(180deg, rgb(254 252 232 / 0.22), transparent 84%);
  }

  .ribbon-field {
    inset: -42%;
    opacity: 0.76;
    filter: blur(18px) saturate(1.24);
    background:
      conic-gradient(from 218deg at 52% 42%, rgb(34 197 94 / 0.34) 0deg 28deg, transparent 58deg 108deg, rgb(239 68 68 / 0.28) 142deg 172deg, transparent 210deg 260deg, rgb(236 72 153 / 0.32) 292deg 326deg, rgb(251 146 60 / 0.28) 342deg 360deg),
      linear-gradient(120deg, transparent 18%, rgb(255 255 255 / 0.62) 42%, transparent 68%);
    animation: luma-ribbon-swim 24s cubic-bezier(0.42, 0, 0.2, 1) infinite alternate;
  }

  .ribbon-grid {
    inset: 2% -8% 18%;
    opacity: 0.28;
    background-image:
      repeating-linear-gradient(102deg, transparent 0 18px, rgb(15 23 42 / 0.1) 19px 20px),
      repeating-linear-gradient(12deg, transparent 0 34px, rgb(20 184 166 / 0.1) 35px 36px);
    mask-image: radial-gradient(ellipse 66% 42% at 48% 35%, #000 0%, transparent 72%);
    transform: skewY(-7deg);
    animation: luma-ribbon-lines 16s linear infinite;
  }

  .ribbon-sheen {
    inset: 4% 6% 30%;
    opacity: 0.44;
    background: linear-gradient(115deg, transparent 0 34%, rgb(255 255 255 / 0.72) 44%, transparent 56% 100%);
    filter: blur(9px);
    transform: translateX(-28%);
    animation: luma-ribbon-sheen 11s ease-in-out infinite;
  }

  .scene-topography {
    background:
      radial-gradient(62% 46% at 52% 36%, rgb(16 185 129 / 0.12), transparent 70%),
      radial-gradient(40% 30% at 78% 22%, rgb(245 158 11 / 0.14), transparent 68%);
  }

  .topography-field {
    inset: -24%;
    opacity: 0.86;
    filter: blur(18px) saturate(1.2);
    background:
      radial-gradient(ellipse 46% 36% at 22% 18%, rgb(6 182 212 / 0.3), transparent 62%),
      radial-gradient(ellipse 42% 34% at 78% 22%, rgb(245 158 11 / 0.28), transparent 66%),
      radial-gradient(ellipse 48% 42% at 50% 72%, rgb(34 197 94 / 0.28), transparent 66%),
      conic-gradient(from 90deg at 52% 46%, rgb(236 72 153 / 0.22), transparent, rgb(239 68 68 / 0.22), transparent, rgb(236 72 153 / 0.2));
    animation: luma-topography-wash 24s ease-in-out infinite alternate;
  }

  .contour {
    inset: -18% -12% 4%;
    opacity: 0.34;
    background-image:
      repeating-radial-gradient(ellipse at 54% 42%, transparent 0 28px, rgb(15 23 42 / 0.12) 29px 30px, transparent 31px 54px);
    mask-image: radial-gradient(ellipse 68% 48% at 52% 34%, #000 0%, transparent 72%);
    animation: luma-contour-slide 22s linear infinite;
  }

  .contour-b {
    opacity: 0.18;
    transform: rotate(9deg) scale(1.12);
    animation-duration: 30s;
    animation-direction: reverse;
  }

  .contour-drift {
    inset: 0 -20% 22%;
    opacity: 0.18;
    background-image: repeating-linear-gradient(92deg, transparent 0 44px, rgb(15 23 42 / 0.16) 45px 46px);
    mask-image: radial-gradient(ellipse 62% 44% at 48% 32%, #000 0%, transparent 72%);
    animation: luma-field-drift 20s ease-in-out infinite alternate;
  }

  .event-grain {
    z-index: 4;
    opacity: 0.11;
    mix-blend-mode: multiply;
    background-image: radial-gradient(circle at center, rgb(15 23 42 / 0.22) 0 0.65px, transparent 0.85px);
    background-size: 3px 3px;
    mask-image: linear-gradient(180deg, #000 0%, transparent 86%);
  }

  .event-fade {
    z-index: 5;
    background:
      linear-gradient(180deg, rgb(248 250 252 / 0) 0%, rgb(248 250 252 / 0.28) 58%, rgb(248 250 252 / 0.94) 100%),
      radial-gradient(ellipse 70% 50% at 50% 28%, transparent 0%, rgb(248 250 252 / 0.08) 72%, rgb(248 250 252 / 0.62) 100%);
  }

  @keyframes luma-cycle-serpent {
    0%,
    21% {
      opacity: 1;
    }
    27%,
    94% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  @keyframes luma-cycle-quantum {
    0%,
    20% {
      opacity: 0;
    }
    26%,
    38% {
      opacity: 1;
    }
    44%,
    100% {
      opacity: 0;
    }
  }

  @keyframes luma-cycle-classic-snake {
    0%,
    37% {
      opacity: 0;
    }
    43%,
    55% {
      opacity: 1;
    }
    61%,
    100% {
      opacity: 0;
    }
  }

  @keyframes luma-cycle-ribbon {
    0%,
    54% {
      opacity: 0;
    }
    60%,
    72% {
      opacity: 1;
    }
    78%,
    100% {
      opacity: 0;
    }
  }

  @keyframes luma-cycle-topography {
    0%,
    71% {
      opacity: 0;
    }
    76%,
    96% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  @keyframes luma-snake {
    to {
      stroke-dashoffset: -1400;
    }
  }

  @keyframes luma-snake-thread {
    to {
      stroke-dashoffset: -280;
    }
  }

  @keyframes luma-field-drift {
    from {
      transform: translate3d(-2%, -1%, 0) rotate(-1deg);
    }
    to {
      transform: translate3d(3%, 2%, 0) rotate(1.5deg);
    }
  }

  @keyframes luma-mesh-drift {
    from {
      transform: translate3d(-3%, -1%, 0) rotate(-2deg) scale(1);
    }
    to {
      transform: translate3d(3%, 2%, 0) rotate(3deg) scale(1.06);
    }
  }

  @keyframes luma-mesh-turn {
    from {
      transform: translate3d(2%, -2%, 0) rotate(0deg) scale(1.02);
    }
    to {
      transform: translate3d(-2%, 3%, 0) rotate(18deg) scale(1.08);
    }
  }

  @keyframes luma-shimmer {
    0%,
    100% {
      transform: translateX(-10%) skewX(-8deg);
      opacity: 0.2;
    }
    50% {
      transform: translateX(12%) skewX(-8deg);
      opacity: 0.42;
    }
  }

  @keyframes luma-quantum-lattice {
    to {
      background-position:
        120px 0,
        -96px 36px;
    }
  }

  @keyframes luma-classic-snake {
    from {
      stroke-dashoffset: 0;
    }
    to {
      stroke-dashoffset: -2200;
    }
  }

  @keyframes luma-pellet-pop {
    0%,
    100% {
      transform: scale(0.88);
      opacity: 1;
    }
    50% {
      transform: scale(1.08);
      opacity: 1;
    }
  }

  @keyframes luma-ribbon-swim {
    from {
      transform: translate3d(-3%, -1%, 0) rotate(-7deg) scale(1.02);
    }
    to {
      transform: translate3d(3%, 3%, 0) rotate(8deg) scale(1.1);
    }
  }

  @keyframes luma-ribbon-lines {
    to {
      background-position:
        120px 0,
        -80px 40px;
    }
  }

  @keyframes luma-ribbon-sheen {
    0%,
    100% {
      transform: translateX(-28%) skewX(-12deg);
    }
    50% {
      transform: translateX(28%) skewX(-12deg);
    }
  }

  @keyframes luma-topography-wash {
    from {
      transform: translate3d(-2%, 1%, 0) rotate(-3deg) scale(1);
    }
    to {
      transform: translate3d(2%, -2%, 0) rotate(4deg) scale(1.08);
    }
  }

  @keyframes luma-contour-slide {
    to {
      background-position: 160px -110px;
    }
  }

  @media (max-width: 760px) {
    .luma-event-background {
      min-height: 700px;
    }

    .scene {
      inset: -18% -36% 0;
    }

    .scene-classic-snake {
      inset: -18% 0 0;
    }

    .snake-map {
      left: 50%;
      top: -5%;
      width: max(1120px, 218vw);
      min-width: 0;
      height: 650px;
    }

    .snake-runner {
      stroke-width: 34;
      opacity: 0.64;
    }

    .snake-halo {
      stroke-width: 88;
    }

    .snake-c,
    .snake-d {
      stroke-width: 18;
      opacity: 0.28;
    }

    .classic-snake-map {
      left: 0;
      top: -2%;
      width: max(1120px, 190vw);
      height: 640px;
    }

    .classic-snake-body {
      stroke-width: 14;
    }

    .classic-pellet {
      width: 16px;
      height: 16px;
      font-size: 14px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scene,
    .scene-quantum::before,
    .serpent-field,
    .snake-halo,
    .snake-runner,
    .snake-thread,
    .classic-snake-field,
    .classic-snake-body,
    .classic-pellet,
    .mesh,
    .mesh-shimmer,
    .ribbon-field,
    .ribbon-grid,
    .ribbon-sheen,
    .topography-field,
    .contour,
    .contour-drift {
      animation: none !important;
    }

    .is-cycle .scene {
      opacity: 0;
    }

    .is-cycle .scene-serpent {
      opacity: 1;
    }
  }
</style>
