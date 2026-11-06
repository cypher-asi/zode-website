import type { RoomFile, RoomFolder, RoomTree } from "./types";

export const fileKey = (id: string): string => `f:${id}`;
export const folderKey = (id: string): string => `d:${id}`;

export type TreeAction = "rename" | "move" | "delete";

export interface TreeIndex {
  folders: Map<string, RoomFolder>;
  childFolders: Map<string | null, RoomFolder[]>;
  childFiles: Map<string | null, RoomFile[]>;
}

export function indexTree(tree: RoomTree): TreeIndex {
  const folders = new Map(tree.folders.map((folder) => [folder.id, folder]));
  const childFolders = new Map<string | null, RoomFolder[]>();
  const childFiles = new Map<string | null, RoomFile[]>();
  for (const folder of tree.folders) {
    const parent = folder.parentId && folders.has(folder.parentId) ? folder.parentId : null;
    childFolders.set(parent, [...(childFolders.get(parent) ?? []), folder]);
  }
  for (const file of tree.files) {
    const parent = file.folderId && folders.has(file.folderId) ? file.folderId : null;
    childFiles.set(parent, [...(childFiles.get(parent) ?? []), file]);
  }
  return { folders, childFolders, childFiles };
}

/** Folder ids from the root down to `folderId`'s parent. */
export function ancestorsOf(index: TreeIndex, folderId: string | null): string[] {
  const chain: string[] = [];
  for (let id = folderId, depth = 0; id && depth < 64; depth += 1) {
    const parent = index.folders.get(id)?.parentId ?? null;
    if (parent) chain.unshift(parent);
    id = parent;
  }
  return chain;
}

/** "Folder / Subfolder" for display, or "All files" at the root. */
export function folderPath(index: TreeIndex, folderId: string | null): string {
  if (!folderId || !index.folders.has(folderId)) return "All files";
  return [...ancestorsOf(index, folderId), folderId].map((id) => index.folders.get(id)?.name ?? "").join(" / ");
}
