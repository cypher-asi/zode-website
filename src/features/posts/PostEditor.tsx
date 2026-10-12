"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Select } from "@/components/ui/Select";
import { Dialog } from "@/features/data-room/Dialog";
import ui from "@/features/data-room/ui.module.css";
import { deletePostAction, publishPostAction, savePostAction, unpublishPostAction } from "./actions";
import {
  MAX_SLUG_LENGTH,
  MAX_SUMMARY_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_VERSION_LENGTH,
  POST_KINDS,
  mediaUrl,
  postHref,
  slugify,
  type Post,
  type PostDraft,
  type PostKind,
  type PostStatus,
  type SaveResult,
} from "./types";
import prose from "./PostBody.module.css";
import styles from "./PostEditor.module.css";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 10 * 1024 ** 2;

const savedTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
/** UTC so the server render and hydration agree. */
const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** Keeps letters, digits, dots, dashes and underscores; Blob adds a random suffix to keep names unique. */
const safeName = (name: string): string => name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "image";

async function uploadImage(postId: string, file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Images must be PNG, JPEG, WebP or GIF.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be 10 MB or smaller.");
  const blob = await upload(`posts/${postId}/${safeName(file.name)}`, file, {
    access: "private",
    handleUploadUrl: `/api/posts/${postId}/upload`,
    contentType: file.type,
  });
  return blob.pathname;
}

type DialogState = { kind: "link" } | { kind: "delete" } | null;

export function PostEditor({ post }: { post: Post }): ReactElement {
  const ids = useId();
  const [kind, setKind] = useState<PostKind>(post.kind);
  const [title, setTitle] = useState(post.title);
  const [summary, setSummary] = useState(post.summary);
  const [slug, setSlug] = useState(post.slug.startsWith("untitled-") ? slugify(post.title) : post.slug);
  const [slugTouched, setSlugTouched] = useState(!post.slug.startsWith("untitled-"));
  const [version, setVersion] = useState(post.version ?? "");
  const [cover, setCover] = useState(post.coverPathname);
  const [status, setStatus] = useState<PostStatus>(post.status);
  const [publishedSlug, setPublishedSlug] = useState(post.status === "published" ? post.slug : null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<"save" | "publish" | "unpublish" | null>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string>();
  const [dialog, setDialog] = useState<DialogState>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  /** The paste and drop handlers are bound when the editor is created, before `editor` exists. */
  const editorRef = useRef<Editor | null>(null);

  const touch = () => setDirty(true);

  const insertImages = useCallback(
    async (editor: Editor, files: File[], at?: number) => {
      setError(undefined);
      for (const file of files) {
        setUploading((n) => n + 1);
        try {
          const pathname = await uploadImage(post.id, file);
          const chain = editor.chain().focus();
          (at === undefined ? chain : chain.setTextSelection(at)).setImage({ src: mediaUrl(pathname), alt: "" }).run();
        } catch (uploadError) {
          setError(uploadError instanceof Error ? uploadError.message : "That image couldn't be uploaded.");
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [post.id],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Image.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: "Write your post…" }),
      Markdown,
    ],
    content: post.bodyMd,
    contentType: "markdown",
    editorProps: {
      attributes: { class: `${prose.prose} ${styles.surface}`, "aria-label": "Post body" },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (!files.length || !editorRef.current) return false;
        void insertImages(editorRef.current, files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (!files.length || !editorRef.current) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImages(editorRef.current, files, at);
        return true;
      },
    },
    onUpdate: touch,
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const draft = useCallback(
    (): PostDraft => ({
      kind,
      title,
      summary,
      slug,
      version,
      coverPathname: cover,
      bodyMd: editor?.getMarkdown() ?? post.bodyMd,
    }),
    [kind, title, summary, slug, version, cover, editor, post.bodyMd],
  );

  const apply = (result: SaveResult, sentSlug?: string) => {
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(undefined);
    setDirty(false);
    if (result.savedAt) setSavedAt(new Date(result.savedAt));
    if (result.status) {
      setStatus(result.status);
      setPublishedSlug(result.status === "published" ? (sentSlug ?? slug) : null);
    }
  };

  const run = async (action: "save" | "publish" | "unpublish") => {
    if (pending) return;
    setPending(action);
    try {
      if (action === "unpublish") {
        apply(await unpublishPostAction(post.id));
      } else {
        const data = draft();
        apply(await (action === "publish" ? publishPostAction : savePostAction)(post.id, data), data.slug);
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  };
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void runRef.current("save");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const published = status === "published";
  const liveHref = publishedSlug ? postHref(kind, publishedSlug) : null;

  return (
    <div className={styles.editor}>
      <div className={styles.bar}>
        <Link
          className={styles.back}
          href="/portal/posts"
          onClick={(event) => {
            if (dirty && !window.confirm("Leave without saving your changes?")) event.preventDefault();
          }}
        >
          ← Posts
        </Link>
        <span className={styles.pill} data-strong={published ? "" : undefined}>
          {published ? "Published" : "Draft"}
        </span>
        <span className={styles.saved} aria-live="polite">
          {uploading
            ? "Uploading image…"
            : pending === "save"
              ? "Saving…"
              : dirty
                ? "Unsaved changes"
                : savedAt
                  ? `Saved ${savedTime.format(savedAt)}`
                  : null}
        </span>
        <span className={styles.spacer} />
        <button type="button" className={ui.button} onClick={() => setDialog({ kind: "delete" })}>
          Delete
        </button>
        <Link className={ui.button} href={`/portal/posts/${post.id}/preview`} target="_blank">
          Preview
        </Link>
        {liveHref ? (
          <Link className={ui.button} href={liveHref} target="_blank">
            View live
          </Link>
        ) : null}
        {published ? (
          <>
            <button type="button" className={ui.button} disabled={Boolean(pending)} onClick={() => run("unpublish")}>
              {pending === "unpublish" ? "Unpublishing…" : "Unpublish"}
            </button>
            <button type="button" className={ui.primary} disabled={Boolean(pending)} onClick={() => run("save")}>
              {pending === "save" ? "Updating…" : "Update"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className={ui.button} disabled={Boolean(pending)} onClick={() => run("save")}>
              Save draft
            </button>
            <button type="button" className={ui.primary} disabled={Boolean(pending)} onClick={() => run("publish")}>
              {pending === "publish" ? "Publishing…" : "Publish"}
            </button>
          </>
        )}
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.writing}>
          <textarea
            className={styles.title}
            value={title}
            placeholder="Title"
            aria-label="Title"
            rows={1}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(event) => {
              setTitle(event.target.value);
              if (!slugTouched && !published) setSlug(slugify(event.target.value));
              touch();
            }}
          />
          <textarea
            className={styles.summary}
            value={summary}
            placeholder="A one or two sentence summary, shown in the list and in link previews"
            aria-label="Summary"
            rows={2}
            maxLength={MAX_SUMMARY_LENGTH}
            onChange={(event) => {
              setSummary(event.target.value);
              touch();
            }}
          />
          {editor ? (
            <Toolbar
              editor={editor}
              onLink={() => setDialog({ kind: "link" })}
              onImage={() => imageInput.current?.click()}
            />
          ) : null}
          <EditorContent editor={editor} className={styles.body} />
          <input
            ref={imageInput}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (editor && files.length) void insertImages(editor, files);
            }}
          />
        </div>

        <aside className={styles.settings} aria-label="Post settings">
          <div className={ui.field}>
            <label id={`${ids}-kind`} htmlFor={`${ids}-kind-select`} className={ui.label}>
              Section
            </label>
            <Select
              id={`${ids}-kind-select`}
              aria-labelledby={`${ids}-kind`}
              size="sm"
              className={ui.fill}
              options={POST_KINDS.map((option) => ({ value: option.id, label: option.label }))}
              value={kind}
              disabled={published}
              onChange={(value) => {
                setKind(value as PostKind);
                touch();
              }}
            />
            {published ? <span className={styles.hint}>Unpublish to move it to another section.</span> : null}
          </div>

          <label className={ui.field}>
            <span className={ui.label}>URL</span>
            <span className={styles.slug}>
              <span className={styles.slugPrefix}>/{kind}/</span>
              <input
                className={ui.input}
                value={slug}
                maxLength={MAX_SLUG_LENGTH}
                spellCheck={false}
                onChange={(event) => {
                  setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                  setSlugTouched(true);
                  touch();
                }}
                onBlur={() => setSlug((current) => slugify(current))}
              />
            </span>
            {published ? <span className={styles.hint}>Changing it breaks links already shared.</span> : null}
          </label>

          {kind === "changelog" ? (
            <label className={ui.field}>
              <span className={ui.label}>Version</span>
              <input
                className={ui.input}
                value={version}
                placeholder="1.4"
                maxLength={MAX_VERSION_LENGTH}
                onChange={(event) => {
                  setVersion(event.target.value);
                  touch();
                }}
              />
            </label>
          ) : null}

          <div className={ui.field}>
            <span className={ui.label}>Cover image</span>
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- uploads are served at their own size from /post-media
              <img className={styles.cover} src={mediaUrl(cover)} alt="" />
            ) : null}
            <span className={styles.coverActions}>
              <button type="button" className={ui.button} onClick={() => coverInput.current?.click()}>
                {cover ? "Replace" : "Upload"}
              </button>
              {cover ? (
                <button
                  type="button"
                  className={ui.button}
                  onClick={() => {
                    setCover(null);
                    touch();
                  }}
                >
                  Remove
                </button>
              ) : null}
            </span>
            <input
              ref={coverInput}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setError(undefined);
                setUploading((n) => n + 1);
                try {
                  setCover(await uploadImage(post.id, file));
                  touch();
                } catch (uploadError) {
                  setError(uploadError instanceof Error ? uploadError.message : "That image couldn't be uploaded.");
                } finally {
                  setUploading((n) => n - 1);
                }
              }}
            />
          </div>

          <dl className={styles.facts}>
            <dt>Author</dt>
            <dd>{post.author.name}</dd>
            <dt>Created</dt>
            <dd>{day.format(post.createdAt)}</dd>
            {post.publishedAt ? (
              <>
                <dt>First published</dt>
                <dd>{day.format(post.publishedAt)}</dd>
              </>
            ) : null}
          </dl>
        </aside>
      </div>

      {dialog?.kind === "link" && editor ? (
        <Dialog
          title="Add a link"
          input={{ label: "URL", initial: "" }}
          confirmLabel="Add link"
          onConfirm={(href) => {
            const value = href.trim();
            if (/\s/.test(value)) return "Enter a web address without spaces.";
            const url = /^(https?:\/\/|mailto:|\/|#)/i.test(value) ? value : `https://${value}`;
            if (editor.state.selection.empty) {
              editor.chain().focus().insertContent({ type: "text", text: value, marks: [{ type: "link", attrs: { href: url } }] }).run();
            } else {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog?.kind === "delete" ? (
        <Dialog
          title="Delete this post?"
          description={
            published
              ? "It comes off the site straight away, along with its images. This can't be undone."
              : "The draft and its images are removed for good."
          }
          confirmLabel="Delete"
          danger
          onConfirm={async () => (await deletePostAction(post.id))?.error}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function Toolbar({ editor, onLink, onImage }: { editor: Editor; onLink: () => void; onImage: () => void }): ReactElement {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const tool = (label: string, active: boolean, onClick: () => void, glyph: ReactNode, disabled = false) => (
    <button
      type="button"
      className={styles.tool}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {glyph}
    </button>
  );

  const chain = () => editor.chain().focus();

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
      {tool("Heading", state.h2, () => chain().toggleHeading({ level: 2 }).run(), <b>H2</b>)}
      {tool("Subheading", state.h3, () => chain().toggleHeading({ level: 3 }).run(), <b>H3</b>)}
      <span className={styles.divider} />
      {tool("Bold", state.bold, () => chain().toggleBold().run(), <b>B</b>)}
      {tool("Italic", state.italic, () => chain().toggleItalic().run(), <i>I</i>)}
      {tool("Strikethrough", state.strike, () => chain().toggleStrike().run(), <s>S</s>)}
      {tool("Inline code", state.code, () => chain().toggleCode().run(), <code>{"<>"}</code>)}
      {tool(
        state.link ? "Remove link" : "Link",
        state.link,
        () => (state.link ? chain().extendMarkRange("link").unsetLink().run() : onLink()),
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M8.5 11.5a3 3 0 0 0 4.24 0l2.5-2.5a3 3 0 0 0-4.24-4.24l-.75.75M11.5 8.5a3 3 0 0 0-4.24 0l-2.5 2.5a3 3 0 0 0 4.24 4.24l.75-.75" />
        </svg>,
      )}
      <span className={styles.divider} />
      {tool(
        "Bulleted list",
        state.bullet,
        () => chain().toggleBulletList().run(),
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M8 5.5h8.5M8 10h8.5M8 14.5h8.5M4 5.5h.01M4 10h.01M4 14.5h.01" />
        </svg>,
      )}
      {tool(
        "Numbered list",
        state.ordered,
        () => chain().toggleOrderedList().run(),
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M8 5.5h8.5M8 10h8.5M8 14.5h8.5M3.5 4.5l1-.75v3.5M3.25 12.5a1 1 0 0 1 1.75.6c0 .9-1.75 1.4-1.75 2.4H5.1" />
        </svg>,
      )}
      {tool(
        "Quote",
        state.quote,
        () => chain().toggleBlockquote().run(),
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4.5 4.5v11M8 6.5h7.5M8 10h7.5M8 13.5h5" />
        </svg>,
      )}
      {tool(
        "Code block",
        state.codeBlock,
        () => chain().toggleCodeBlock().run(),
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M7 6.5 3.5 10 7 13.5M13 6.5l3.5 3.5-3.5 3.5M11 5l-2 10" />
        </svg>,
      )}
      {tool(
        "Divider",
        false,
        () => chain().setHorizontalRule().run(),
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3.5 10h13" />
        </svg>,
      )}
      {tool(
        "Image",
        false,
        onImage,
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3.5 4.5h13v11h-13zM3.5 13l4-4 3.5 3.5 2-2 3.5 3.5M12.75 7.5h.01" />
        </svg>,
      )}
      <span className={styles.spacer} />
      {tool(
        "Undo",
        false,
        () => chain().undo().run(),
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M7.5 5 4 8.5 7.5 12M4 8.5h8a4 4 0 0 1 0 8h-2" />
        </svg>,
        !state.canUndo,
      )}
      {tool(
        "Redo",
        false,
        () => chain().redo().run(),
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M12.5 5 16 8.5 12.5 12M16 8.5H8a4 4 0 0 0 0 8h2" />
        </svg>,
        !state.canRedo,
      )}
    </div>
  );
}
