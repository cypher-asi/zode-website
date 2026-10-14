import { useId, type ReactElement } from "react";
import styles from "./MemeTV.module.css";

/** The TikTok note (Simple Icons, CC0), drawn on a 24-unit square. */
const NOTE =
  "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";

const SCREEN = { x: 12, y: 12, w: 216, h: 112 };

/** HUD brackets in the screen's corners, `l` long, inset `i`. */
function brackets(l: number, i: number): string {
  const [x0, y0] = [SCREEN.x + i, SCREEN.y + i];
  const [x1, y1] = [SCREEN.x + SCREEN.w - i, SCREEN.y + SCREEN.h - i];
  return [
    `M${x0} ${y0 + l}V${y0}H${x0 + l}`,
    `M${x1 - l} ${y0}H${x1}V${y0 + l}`,
    `M${x1} ${y1 - l}V${y1}H${x1 - l}`,
    `M${x0 + l} ${y1}H${x0}V${y1 - l}`,
  ].join("");
}

/** Old Man Yells at Cloud: the cloud, the raised fist, and Grandpa yelling up at it. */
function Meme(): ReactElement {
  return (
    <>
      <path
        className={`${styles.edge} ${styles.cloud}`}
        d="M28 38C22 38 21 30 27 29C27 22 36 19 41 24C44 17 56 17 58 25C65 24 68 33 62 37C62 39 60 40 58 40H30C29 40 28 39 28 38Z"
      />
      <path className={styles.fine} d="M34 33C36 31 39 31 41 33M48 30C50 28 53 28 55 30" />

      <g className={styles.fist}>
        <path className={styles.face} d="M49 124L42 72H62L74 124Z" />
        <path className={styles.edge} d="M42 72L49 124M62 72L74 124" />
        <path className={styles.edge} d="M45 98Q55 94 66 96" />
        <path
          className={styles.face}
          d="M40 53C39 47 43 45 46 47C47 42 53 42 54 46C56 42 62 42 62 47C66 46 68 50 67 56C67 64 62 73 53 73C45 73 41 67 41 60Z"
        />
        <path className={styles.fine} d="M46 47L47 56M54 46L54 56M62 47L61 56" />
        <path className={styles.edge} d="M40 56Q53 60 67 56" />
        <path className={styles.edge} d="M41 61Q53 59 61 63Q64 66 59 68" />
      </g>

      <path className={styles.yell} d="M102 86L90 80M100 95H86M102 104L90 110" />

      <path className={styles.face} d="M150 104L147 124H180L172 96Z" />
      <path className={styles.edge} d="M150 104L147 124M172 96L180 124" />

      <path
        className={styles.face}
        d="M122 56C120 36 136 26 154 26C174 26 186 40 186 60C186 72 182 82 174 92C166 100 156 106 146 106C136 110 120 112 112 104C104 96 108 86 118 80Z"
      />
      <path
        className={styles.edge}
        d="M151 27L147 15L156 24L159 10L164 24L172 13L172 27L182 21L180 34L188 33L184 44"
      />

      <path className={styles.face} d="M178 60C188 56 194 68 186 78C183 82 179 82 177 79" />
      <path className={styles.fine} d="M181 64C185 64 186 70 182 74" />

      <path className={styles.fine} d="M130 38Q140 34 150 36M132 43Q141 40 149 42M160 74Q166 80 164 88" />

      <circle className={styles.face} cx="128" cy="58" r="8" />
      <circle className={styles.face} cx="144" cy="57" r="9" />
      <circle className={styles.ink} cx="125" cy="59" r="1.6" />
      <circle className={styles.ink} cx="140" cy="58" r="1.6" />
      <circle className={styles.edge} cx="144" cy="57" r="12" />
      <path className={styles.edge} d="M156 56L177 63" />
      <path className={styles.edge} d="M117 47L134 53M136 51L154 43" />

      <path className={styles.face} d="M131 64C120 63 110 66 110 73C110 80 119 80 128 77" />

      <path className={styles.edge} d="M126 80C114 84 106 92 110 102C114 110 130 112 142 106C150 100 150 90 146 84" />
      <path
        className={styles.mouth}
        d="M118 88C114 94 116 102 124 104C134 106 142 100 140 92C138 86 126 84 118 88Z"
      />
      <path className={styles.fine} d="M120 101Q127 97 135 101" />
      <path
        className={styles.stubble}
        d="M113 92l1 1M112 98l1 1M116 106l1 1M124 109l1 1M133 108l1 1M141 104l1 1M145 96l1 1M147 89l1 1M152 96l1 1M158 92l1 1"
      />
    </>
  );
}

/**
 * A clean sci-fi TV, branded TikTok, showing Old Man Yells at Cloud: a
 * chamfered panel on a slim stand, the brand and channel controls on its
 * chin. `playing` shakes the fist and flickers the screen.
 */
export function MemeTV({ playing = false }: { playing?: boolean }): ReactElement {
  const id = useId();
  const [glow, clip] = [`${id}glow`, `${id}clip`];
  return (
    <svg
      className={styles.tv}
      viewBox="0 0 240 180"
      preserveAspectRatio="xMinYMax meet"
      data-playing={playing || undefined}
      role="img"
      aria-label="A TV branded TikTok showing the Old Man Yells at Cloud meme"
    >
      <defs>
        <radialGradient id={glow} cx="50%" cy="45%" r="70%">
          <stop offset="0" stopColor="var(--tv-glow)" />
          <stop offset="1" stopColor="var(--tv-top)" />
        </radialGradient>
        <clipPath id={clip}>
          <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} rx="2" />
        </clipPath>
      </defs>

      <path className={styles.face} d="M112 152H128L131 170H109Z" />
      <path className={styles.body} d="M84 170H156L160 174V176H80V174Z" />
      <path className={styles.fine} d="M90 173H150" />

      <path className={styles.body} d="M10 4H230L236 10V146L230 152H10L4 146V10Z" />
      <path className={styles.fine} d="M11 7H229L233 11V145L229 149H11L7 145V11Z" />
      <circle className={styles.fine} cx="120" cy="8.5" r="0.9" />

      <rect
        x={SCREEN.x}
        y={SCREEN.y}
        width={SCREEN.w}
        height={SCREEN.h}
        rx="2"
        fill={`url(#${glow})`}
        className={styles.screen}
      />
      <g clipPath={`url(#${clip})`} className={styles.picture}>
        <Meme />
        <rect className={styles.chyron} x="18" y="111" width="124" height="9" />
        <rect className={styles.live} x="18" y="111" width="18" height="9" />
        <text className={styles.liveText} x="27" y="117.6">
          LIVE
        </text>
        <text className={styles.caption} x="40" y="117.6">
          OLD MAN YELLS AT CLOUD
        </text>
      </g>
      <path className={styles.fine} d={brackets(6, 3)} />

      <circle className={styles.led} cx="20" cy="138" r="1.4" />

      <g transform="translate(101 132.5) scale(0.46)">
        <path d={NOTE} fill="#25f4ee" transform="translate(-1.3 -1.3)" />
        <path d={NOTE} fill="#fe2c55" transform="translate(1.3 1.3)" />
        <path d={NOTE} className={styles.ink} />
      </g>
      <text className={styles.brand} x="115" y="141.5">
        TikTok
      </text>

      <text className={styles.label} x="188" y="140">
        CH
      </text>
      <path className={styles.edge} d="M199 137.5L202 134.5L205 137.5M199 140.5L202 143.5L205 140.5" />
      <circle className={styles.ink} cx="212" cy="139" r="1.2" />
      <circle className={styles.fine} cx="217" cy="139" r="1.2" />
      <circle className={styles.fine} cx="222" cy="139" r="1.2" />
    </svg>
  );
}
