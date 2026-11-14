import { create } from "zustand";
import { derive, type Derived } from "./model/calc";
import type { BomItem, DataFileName, DesignData, Part } from "./model/schema";
import { safeParseDesign, parseDesign, seedDesign } from "./model/seed";

const DRAFT_PREFIX = "zode-chassis-draft:";
const UNDO_LIMIT = 50;

export type SaveState =
  | { status: "idle" | "saving" }
  | { status: "saved"; version: number }
  | { status: "error"; message: string }
  /** Someone saved a newer version while this draft was open. */
  | { status: "conflict"; latest: number };

/** The design version a page loaded, from the server. */
export interface LoadedVersion {
  designId: string;
  version: number;
  data: DesignData;
}

interface DesignState {
  designId: string | null;
  /** The version the edits are based on; saving makes the next one. */
  baseVersion: number;
  /** The design's latest version on the server, which Discard goes back to. */
  latestVersion: number;
  base: DesignData;
  data: DesignData;
  derived: Derived;
  /** The data sections edited since the base version. */
  dirty: DataFileName[];
  undoStack: { data: DesignData; dirty: DataFileName[] }[];
  selection: string | null;
  hover: string | null;
  save: SaveState;

  /** Opens a design version, with this browser's unsaved draft of it when there's one. */
  load: (loaded: LoadedVersion) => void;
  select: (key: string | null) => void;
  setHover: (key: string | null) => void;
  /** Mutate a deep copy of one data section and recompute everything. */
  edit: <K extends DataFileName>(file: K, recipe: (draft: DesignData[K]) => void) => void;
  updatePart: (partId: string, patch: Partial<Part>) => void;
  updateBom: (id: string, patch: Partial<BomItem>) => void;
  undo: () => void;
  replaceAll: (raw: unknown) => void;
  discard: () => void;
  setSave: (save: SaveState) => void;
  /** The draft is now version `version` on the server. */
  saved: (version: number) => void;
}

interface Draft {
  baseVersion: number;
  data: unknown;
  dirty: DataFileName[];
}

const draftKey = (designId: string) => `${DRAFT_PREFIX}${designId}`;

function readDraft(designId: string): { baseVersion: number; data: DesignData; dirty: DataFileName[] } | null {
  try {
    const raw = localStorage.getItem(draftKey(designId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    const data = safeParseDesign(draft.data);
    if (!data || !Number.isInteger(draft.baseVersion)) throw new Error("unreadable draft");
    return { baseVersion: draft.baseVersion, data, dirty: draft.dirty ?? [] };
  } catch {
    localStorage.removeItem(draftKey(designId));
    return null;
  }
}

function writeDraft(designId: string | null, draft: Draft | null) {
  if (!designId || typeof localStorage === "undefined") return;
  if (!draft) localStorage.removeItem(draftKey(designId));
  else localStorage.setItem(draftKey(designId), JSON.stringify(draft));
}

export const useDesign = create<DesignState>((set, get) => {
  const commit = (data: DesignData, dirty: DataFileName[], pushUndo = true) => {
    const prev = get();
    const undoStack = pushUndo
      ? [...prev.undoStack, { data: prev.data, dirty: prev.dirty }].slice(-UNDO_LIMIT)
      : prev.undoStack;
    let derived: Derived;
    try {
      derived = derive(data);
    } catch (err) {
      console.error(err);
      set({ save: { status: "error", message: `Edit rejected: ${String(err)}` } });
      return;
    }
    const save = prev.save.status === "conflict" ? prev.save : { status: "idle" as const };
    set({ data, derived, dirty, undoStack, save });
    writeDraft(prev.designId, dirty.length ? { baseVersion: prev.baseVersion, data, dirty } : null);
  };

  return {
    designId: null,
    baseVersion: 0,
    latestVersion: 0,
    base: seedDesign,
    data: seedDesign,
    derived: derive(seedDesign),
    dirty: [],
    undoStack: [],
    selection: null,
    hover: null,
    save: { status: "idle" },

    load: ({ designId, version, data }) => {
      const draft = readDraft(designId);
      const open = draft ?? { baseVersion: version, data, dirty: [] };
      set({
        designId,
        baseVersion: open.baseVersion,
        latestVersion: version,
        base: data,
        data: open.data,
        derived: derive(open.data),
        dirty: open.dirty,
        undoStack: [],
        selection: null,
        hover: null,
        save: draft && draft.baseVersion !== version ? { status: "conflict", latest: version } : { status: "idle" },
      });
    },

    select: (key) => set({ selection: key }),
    setHover: (key) => set({ hover: key }),

    edit: (file, recipe) => {
      const { data, dirty } = get();
      const copy = structuredClone(data[file]);
      recipe(copy);
      const next = { ...data, [file]: copy } as DesignData;
      commit(next, dirty.includes(file) ? dirty : [...dirty, file]);
    },

    updatePart: (partId, patch) =>
      get().edit("parts", (p) => {
        const i = p.parts.findIndex((x) => x.partId === partId);
        if (i >= 0) p.parts[i] = { ...p.parts[i], ...patch };
      }),

    updateBom: (id, patch) =>
      get().edit("bom", (b) => {
        const i = b.items.findIndex((x) => x.id === id);
        if (i >= 0) b.items[i] = { ...b.items[i], ...patch };
      }),

    undo: () => {
      const last = get().undoStack.at(-1);
      if (!last) return;
      set({ undoStack: get().undoStack.slice(0, -1) });
      commit(last.data, last.dirty, false);
    },

    replaceAll: (raw) => {
      const data = parseDesign(raw);
      commit(data, Object.keys(data) as DataFileName[]);
    },

    discard: () => {
      const { designId, base, latestVersion } = get();
      writeDraft(designId, null);
      set({ baseVersion: latestVersion, dirty: [], undoStack: [], save: { status: "idle" } });
      commit(base, [], false);
      set({ undoStack: [] });
    },

    setSave: (save) => set({ save }),

    saved: (version) => {
      const { designId, data } = get();
      writeDraft(designId, null);
      set({ baseVersion: version, latestVersion: version, base: data, dirty: [], save: { status: "saved", version } });
    },
  };
});
