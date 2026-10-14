"use client";

import type { ReactElement } from "react";
import { clockLabel } from "./format";
import styles from "./factory.module.css";

/** Simulated hours per real second. */
export const SPEEDS = [
  { hours: 1, label: "1 h/s" },
  { hours: 4, label: "4 h/s" },
  { hours: 12, label: "12 h/s" },
  { hours: 24, label: "1 d/s" },
  { hours: 72, label: "3 d/s" },
] as const;

export interface TransportProps {
  time: number;
  horizon: number;
  playing: boolean;
  speed: number;
  onPlay: (playing: boolean) => void;
  onSpeed: (hours: number) => void;
  onSeek: (time: number) => void;
}

/** Play, speed and the scrubber across the whole run, marked by week. */
export function Transport({ time, horizon, playing, speed, onPlay, onSpeed, onSeek }: TransportProps): ReactElement {
  const weeks = Math.floor(horizon / 168);
  const atEnd = time >= horizon;
  return (
    <div className={styles.transport}>
      <button
        type="button"
        className={styles.play}
        onClick={() => {
          if (atEnd) onSeek(0);
          onPlay(atEnd || !playing);
        }}
        aria-label={playing ? "Pause" : atEnd ? "Replay" : "Play"}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          {playing ? <path d="M5 3.5v9M11 3.5v9" /> : atEnd ? <path d="M3.5 8a4.5 4.5 0 1 0 1.3-3.2M4.5 2.5v2.5H7" /> : <path d="M5 3.25v9.5L12.5 8z" />}
        </svg>
      </button>
      <span className={styles.clock}>{clockLabel(time)}</span>
      <div className={styles.scrub}>
        <input
          type="range"
          min={0}
          max={horizon}
          step={0.25}
          value={time}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Simulation time"
          aria-valuetext={clockLabel(time)}
        />
        <div className={styles.ticks} aria-hidden="true">
          {Array.from({ length: weeks }, (_, i) => (
            <span key={i} style={{ left: `${(((i + 1) * 168) / horizon) * 100}%` }} />
          ))}
        </div>
      </div>
      <div className={styles.speeds} role="radiogroup" aria-label="Speed">
        {SPEEDS.map((s) => (
          <button
            key={s.hours}
            type="button"
            role="radio"
            aria-checked={speed === s.hours}
            className={styles.speed}
            onClick={() => onSpeed(s.hours)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
