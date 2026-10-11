export type RoomRole = "admin" | "viewer";

export const ROLES: readonly { id: RoomRole; label: string; detail: string }[] = [
  { id: "viewer", label: "Viewer", detail: "Can browse, view and download files." },
  { id: "admin", label: "Admin", detail: "Can also upload, organize, invite people and see activity." },
];

export interface RoomSummary {
  id: string;
  name: string;
  role: RoomRole;
  createdAt: string;
  fileCount: number;
}

export interface RoomFolder {
  id: string;
  parentId: string | null;
  name: string;
}

export interface RoomFile {
  id: string;
  folderId: string | null;
  name: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

export interface RoomTree {
  folders: RoomFolder[];
  files: RoomFile[];
}

export interface RoomMember {
  id: string;
  email: string;
  role: RoomRole;
  status: "active" | "pending" | "expired";
  invitedBy: string | null;
  invitedAt: string;
  acceptedAt: string | null;
}

export type AuditAction =
  | "view"
  | "download"
  | "upload"
  | "delete"
  | "rename"
  | "move"
  | "folder_create"
  | "room_create"
  | "room_rename"
  | "invite"
  | "invite_resend"
  | "invite_revoke"
  | "accept"
  | "role_change"
  | "remove";

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  view: "Viewed",
  download: "Downloaded",
  upload: "Uploaded",
  delete: "Deleted",
  rename: "Renamed",
  move: "Moved",
  folder_create: "Created folder",
  room_create: "Created room",
  room_rename: "Renamed room",
  invite: "Invited",
  invite_resend: "Resent invite",
  invite_revoke: "Revoked invite",
  accept: "Joined",
  role_change: "Changed role",
  remove: "Removed",
};

export interface AuditEvent {
  id: string;
  createdAt: string;
  actorEmail: string;
  action: AuditAction;
  fileId: string | null;
  detail: Record<string, unknown>;
  ip: string | null;
}

/** The result of a form-driven server action. */
export interface ActionState {
  readonly error?: string;
  readonly ok?: string;
}
