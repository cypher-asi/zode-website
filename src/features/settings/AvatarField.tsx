"use client";

import { useRef, useState, useTransition, type ChangeEvent, type ReactElement } from "react";
import { upload } from "@vercel/blob/client";
import { initials } from "@/features/account/initials";
import ui from "@/features/data-room/ui.module.css";
import { removeAvatarAction, setAvatarAction } from "./actions";
import styles from "./settings.module.css";

const SIZE = 512;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/** Centre-crops the image to a square of at most 512px, as WebP where the browser can encode it (PNG otherwise). */
async function squareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn't process that image.");
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) throw new Error("Couldn't process that image.");
  return blob;
}

/** The profile photo with Upload and Remove; falls back to initials when there's none. */
export function AvatarField({
  userId,
  name,
  src,
}: {
  userId: string;
  name: string;
  /** The custom photo's URL, or `null` when none is set. */
  src: string | null;
}): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, startRemove] = useTransition();
  const [broken, setBroken] = useState<string | null>(null);
  const busy = uploading || removing;

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Choose a PNG, JPEG, WebP or GIF image.");
      return;
    }

    setError(null);
    setUploading(true);
    try {
      let image: Blob;
      try {
        image = await squareImage(file);
      } catch {
        throw new Error("Couldn't read that image. Try another file.");
      }
      const extension = image.type === "image/webp" ? "webp" : "png";
      const blob = await upload(`avatars/${userId}/avatar.${extension}`, image, {
        access: "private",
        handleUploadUrl: "/api/account/avatar/upload",
        contentType: image.type,
      });
      const result = await setAvatarAction(blob.pathname);
      if (result.error) setError(result.error);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const remove = () => {
    setError(null);
    startRemove(async () => {
      const result = await removeAvatarAction();
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className={styles.avatarRow}>
      <span className={styles.avatar} aria-hidden="true">
        {src && broken !== src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" onError={() => setBroken(src)} />
        ) : (
          initials(name)
        )}
      </span>
      <div className={styles.avatarMain}>
        <div className={styles.actions}>
          <button type="button" className={ui.button} disabled={busy} onClick={() => inputRef.current?.click()}>
            {uploading ? "Uploading…" : src ? "Change photo" : "Upload photo"}
          </button>
          {src ? (
            <button type="button" className={ui.button} disabled={busy} onClick={remove}>
              {removing ? "Removing…" : "Remove"}
            </button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className={styles.fileInput}
          tabIndex={-1}
          aria-hidden="true"
          onChange={onChange}
        />
        {error ? (
          <p className={ui.error} role="alert">
            {error}
          </p>
        ) : (
          <p className={styles.hint}>PNG, JPEG, WebP or GIF. It&apos;s cropped to a square.</p>
        )}
      </div>
    </div>
  );
}
