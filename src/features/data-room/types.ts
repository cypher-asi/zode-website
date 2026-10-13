export type RoomRole = "admin" | "viewer";

export const ROLES: readonly { id: RoomRole; label: string; detail: string }[] = [
  { id: "viewer", label: "Viewer", detail: "Can browse, view and download files." },
  { id: "admin", label: "Admin", detail: "Can also upload, organize, invite people and see activity." },
];

/** A room role as shown; a ZODE super admin who is a room admin reads as "Super admin". */
export const roleLabel = (role: RoomRole, superAdmin = false): string =>
  superAdmin && role === "admin" ? "Super admin" : (ROLES.find((r) => r.id === role)?.label ?? role);

/** Whether the room is for buying a site, leasing one, or renting colo space. */
export type RoomKind = "purchase" | "lease" | "colo";

export const ROOM_KINDS: readonly { id: RoomKind; label: string; detail: string }[] = [
  { id: "purchase", label: "Purchase", detail: "ZODE would buy the site." },
  { id: "lease", label: "Lease", detail: "ZODE would lease the site from a landlord." },
  { id: "colo", label: "Colo", detail: "ZODE would rent colocation space in a provider's data center." },
];

export const isRoomKind = (value: unknown): value is RoomKind => ROOM_KINDS.some((kind) => kind.id === value);

export const roomKindLabel = (kind: RoomKind): string => ROOM_KINDS.find((k) => k.id === kind)?.label ?? kind;

/** A purchase's summary holds purchase economics; a lease's and a colo's hold lease economics. */
export const leaseEconomics = (kind: RoomKind): boolean => kind !== "purchase";

export interface RoomSummary {
  id: string;
  name: string;
  kind: RoomKind;
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

/**
 * Largest selection one zip download may hold. The zip streams through a
 * function that must finish within its time limit; bigger selections go by folder.
 */
export const MAX_ARCHIVE_BYTES = 1024 ** 3;

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
  /** The invite asks for a signed MNDA before joining. */
  requiresMnda: boolean;
  /** The member's account is a ZODE super admin. */
  superAdmin: boolean;
}

/** Someone the share dialog suggests inviting; `name` is null when only their email is known. */
export interface PersonSuggestion {
  email: string;
  name: string | null;
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
  | "room_kind_change"
  | "invite"
  | "invite_resend"
  | "invite_revoke"
  | "accept"
  | "mnda_sign"
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
  room_kind_change: "Changed type",
  invite: "Invited",
  invite_resend: "Resent invite",
  invite_revoke: "Revoked invite",
  accept: "Joined",
  mnda_sign: "Signed MNDA",
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
