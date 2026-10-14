"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import { DEFAULT_SCENARIO, type Scenario } from "./model/catalog";
import { simulate } from "./sim/simulate";
import type { Trace } from "./sim/trace";

/** How often the panels catch up with the playhead while playing. */
const UI_MS = 120;
/** Where a still (reduced-motion) view opens: far enough in that the line is full. */
const STILL_AT = 10 * 24;

export interface FactoryContextValue {
  scenario: Scenario;
  trace: Trace;
  /** Re-runs the simulation on a new scenario, keeping the playhead where it can. */
  run: (scenario: Scenario) => void;
  playing: boolean;
  speed: number;
  setPlaying: (playing: boolean) => void;
  setSpeed: (hours: number) => void;
  seek: (time: number) => void;
  getTime: () => number;
  /** Calls `listener` with the playhead on every frame it moves; returns the unsubscribe. */
  subscribe: (listener: (time: number) => void) => () => void;
}

interface ShownTime {
  subscribe: (onChange: () => void) => () => void;
  get: () => number;
}

const FactoryContext = createContext<FactoryContextValue | null>(null);
const ShownTimeContext = createContext<ShownTime | null>(null);

export function useFactory(): FactoryContextValue {
  const value = useContext(FactoryContext);
  if (!value) throw new Error("useFactory needs a FactoryProvider");
  return value;
}

function useShownTime(): ShownTime {
  const value = useContext(ShownTimeContext);
  if (!value) throw new Error("useFactoryTime needs a FactoryProvider");
  return value;
}

const atStart = () => 0;

/**
 * The playhead as the panels see it, caught up every UI_MS while playing.
 * Only the components that call it re-render as it moves.
 */
export function useFactoryTime(): number {
  const { subscribe, get } = useShownTime();
  return useSyncExternalStore(subscribe, get, atStart);
}

/** Renders `children` at the playhead, so only they re-render as it moves. */
export function AtPlayhead({ children }: { children: (time: number) => ReactNode }): ReactNode {
  return children(useFactoryTime());
}

// A transition's render can be thrown away and restarted, so each scenario
// keeps its run rather than simulating again on the restart.
const runs = new WeakMap<Scenario, Trace>();

function simulated(scenario: Scenario): Trace {
  let trace = runs.get(scenario);
  if (!trace) {
    trace = simulate(scenario);
    runs.set(scenario, trace);
  }
  return trace;
}

/**
 * One simulation and one playhead for every flow's page, so moving between
 * them in the sidebar keeps the same run at the same moment. It lives in the
 * Factory layout, which stays mounted across those pages.
 */
export function FactoryProvider({ children }: { children: ReactNode }): ReactElement {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const trace = useMemo(() => simulated(scenario), [scenario]);
  const horizon = trace.horizon;

  const timeRef = useRef(0);
  const listeners = useRef(new Set<(time: number) => void>());
  const shownRef = useRef(0);
  const shownListeners = useRef(new Set<() => void>());
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);

  const show = useCallback((t: number) => {
    shownRef.current = t;
    for (const listener of shownListeners.current) listener();
  }, []);

  const moveTo = useCallback(
    (t: number) => {
      timeRef.current = t;
      for (const listener of listeners.current) listener(t);
      show(t);
    },
    [show],
  );

  const seek = useCallback((t: number) => moveTo(Math.min(Math.max(t, 0), horizon)), [moveTo, horizon]);

  const subscribe = useCallback((listener: (time: number) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const subscribeShown = useCallback((onChange: () => void) => {
    shownListeners.current.add(onChange);
    return () => {
      shownListeners.current.delete(onChange);
    };
  }, []);

  // Autoplay from the start, unless motion is reduced: then open on a full line, paused.
  // Only on mount; a later scenario keeps the playhead where it is.
  const open = useEffectEvent(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) seek(STILL_AT);
    else setPlaying(true);
  });
  useEffect(() => {
    const raf = requestAnimationFrame(open);
    return () => cancelAnimationFrame(raf);
  }, []);

  // A new run commits in a transition; the playhead joins it there, pulled
  // back to the end if the run is shorter.
  useLayoutEffect(() => {
    moveTo(Math.min(timeRef.current, trace.horizon));
  }, [trace, moveTo]);

  useEffect(() => {
    if (!playing) return;
    const current = listeners.current;
    let raf = 0;
    let last = 0;
    let lastUi = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      let t = timeRef.current + dt * speed;
      const end = t >= horizon;
      if (end) t = horizon;
      timeRef.current = t;
      for (const listener of current) listener(t);
      if (end || now - lastUi > UI_MS) {
        lastUi = now;
        show(t);
      }
      if (end) {
        cancelAnimationFrame(raf);
        setPlaying(false);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, horizon, show]);

  const getTime = useCallback(() => timeRef.current, []);
  const getShown = useCallback(() => shownRef.current, []);

  const run = useCallback((next: Scenario) => {
    startTransition(() => setScenario(next));
  }, []);

  const value = useMemo<FactoryContextValue>(
    () => ({
      scenario,
      trace,
      run,
      playing,
      speed,
      setPlaying,
      setSpeed,
      seek,
      getTime,
      subscribe,
    }),
    [scenario, trace, run, playing, speed, seek, getTime, subscribe],
  );
  const shown = useMemo<ShownTime>(() => ({ subscribe: subscribeShown, get: getShown }), [subscribeShown, getShown]);

  return (
    <FactoryContext.Provider value={value}>
      <ShownTimeContext.Provider value={shown}>{children}</ShownTimeContext.Provider>
    </FactoryContext.Provider>
  );
}
