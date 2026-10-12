"use client";

import { useEffect, useImperativeHandle, useRef, type ReactElement, type Ref } from "react";
import { ClusterView, type Pick, type ViewPreset, type ViewState } from "./ClusterView";
import styles from "./ClusterScene.module.css";

export interface ClusterSceneHandle {
  setView: (preset: ViewPreset) => void;
}

export interface ClusterSceneProps extends ViewState {
  ref?: Ref<ClusterSceneHandle>;
  onHover: (pick: Pick | null, x: number, y: number) => void;
  onSelect: (pick: Pick | null) => void;
}

/** Hosts the WebGL view; everything after mount goes through `ClusterView.setState`. */
export function ClusterScene({ ref, onHover, onSelect, ...state }: ClusterSceneProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<ClusterView | null>(null);
  const callbacks = useRef({ onHover, onSelect });

  useEffect(() => {
    callbacks.current = { onHover, onSelect };
  });

  useImperativeHandle(ref, () => ({ setView: (preset) => viewRef.current?.setView(preset) }), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let view: ClusterView;
    try {
      view = new ClusterView(container, {
        onHover: (...args) => callbacks.current.onHover(...args),
        onSelect: (pick) => callbacks.current.onSelect(pick),
      });
    } catch {
      return;
    }
    viewRef.current = view;
    return () => {
      view.dispose();
      viewRef.current = null;
    };
  }, []);

  const { model, hidden, cables, rail, focus, selected } = state;
  useEffect(() => {
    viewRef.current?.setState({ model, hidden, cables, rail, focus, selected });
  }, [model, hidden, cables, rail, focus, selected]);

  return <div ref={containerRef} className={styles.root} />;
}
