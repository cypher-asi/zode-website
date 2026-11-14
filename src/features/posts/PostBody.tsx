import type { ReactElement } from "react";
import Markdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { PostChart } from "./charts/PostChart";
import styles from "./PostBody.module.css";

const isExternal = (href: string | undefined): boolean => Boolean(href && /^https?:\/\//i.test(href));

/** Drops react-markdown's syntax-tree `node` prop, which isn't a DOM attribute. */
function dom<T extends ExtraProps>(props: T): Omit<T, "node"> {
  const { node, ...rest } = props;
  void node;
  return rest;
}

/** A fenced block in the `chart` language names a chart (charts/PostChart.tsx) to draw in its place. */
function chartName(node: ExtraProps["node"]): string | undefined {
  const code = node?.children[0];
  if (code?.type !== "element" || code.tagName !== "code") return undefined;
  const classes = code.properties.className;
  if (!Array.isArray(classes) || !classes.includes("language-chart")) return undefined;
  return code.children
    .map((child) => (child.type === "text" ? child.value : ""))
    .join("")
    .trim();
}

/** The page's title is the only h1, so a `#` in the body renders one level down. */
const components: Components = {
  h1: (props) => <h2 {...dom(props)} />,
  pre: (props) => {
    const chart = chartName(props.node);
    return chart === undefined ? <pre {...dom(props)} /> : <PostChart name={chart} />;
  },
  a: (props) =>
    isExternal(props.href) ? <a {...dom(props)} target="_blank" rel="noreferrer noopener" /> : <a {...dom(props)} />,
  // eslint-disable-next-line @next/next/no-img-element -- uploads are served at their own size from /post-media
  img: (props) => <img {...dom(props)} alt={props.alt ?? ""} loading="lazy" decoding="async" />,
};

/** A post's Markdown, rendered on the server. Raw HTML in the source is never rendered as HTML. */
export function PostBody({ markdown }: { markdown: string }): ReactElement {
  return (
    <div className={styles.prose}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </Markdown>
    </div>
  );
}
