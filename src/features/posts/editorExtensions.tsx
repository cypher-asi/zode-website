"use client";

import type { ReactElement } from "react";
import CodeBlock from "@tiptap/extension-code-block";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  Extension,
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { PostChart, isChart } from "./charts/PostChart";
import { isNoteText } from "./types";
import prose from "./PostBody.module.css";
import styles from "./PostEditor.module.css";

/** A `chart` block draws its chart under the editable name, as the post will; other code blocks are unchanged. */
function CodeBlockView({ node }: ReactNodeViewProps): ReactElement {
  const chart = node.attrs.language === "chart" ? node.textContent.trim() : null;
  return (
    <NodeViewWrapper className={chart === null ? undefined : styles.chartBlock}>
      <pre>
        <NodeViewContent<"code"> as="code" />
      </pre>
      {chart === null ? null : (
        <div contentEditable={false} className={styles.chartPreview}>
          {isChart(chart) ? <PostChart name={chart} /> : <p className={styles.chartMissing}>No chart named “{chart}”.</p>}
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const ChartCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});

function noteDecorations(doc: PmNode): DecorationSet {
  const found: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && isNoteText(node.text) && node.marks.some((mark) => mark.type.name === "link")) {
      found.push(Decoration.inline(pos, pos + node.nodeSize, { class: prose.note }));
    }
  });
  return DecorationSet.create(doc, found);
}

/** Marks numbered notes, `[3](https://…)`, so they're raised and small while editing, as on the site. */
export const NoteLinks = Extension.create({
  name: "noteLinks",
  addProseMirrorPlugins() {
    const key = new PluginKey<DecorationSet>("noteLinks");
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => noteDecorations(state.doc),
          apply: (tr, previous) => (tr.docChanged ? noteDecorations(tr.doc) : previous),
        },
        props: {
          decorations: (state) => key.getState(state),
        },
      }),
    ];
  },
});
