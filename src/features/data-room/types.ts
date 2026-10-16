export type RoomRole = "admin" | "viewer";

export const ROLES: readonly { id: RoomRole; label: string; detail: string }[] = [
  { id: "viewer", label: "Viewer", detail: "Can browse, view and download files." },
  { id: "admin", label: "Admin", detail: "Can also upload, organize, invite people and see activity." },
];

export const roleLabel = (role: RoomRole): string => ROLES.find((r) => r.id === role)?.label ?? role;

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

/** Where the site is; `city` and `placeId` are null when the address was typed rather than picked. */
export interface RoomSite {
  address: string;
  city: string | null;
  placeId: string | null;
}

/** The site in Google Maps: the picked place when there is one, else a search for the address. */
export function googleMapsHref(site: RoomSite): string {
  const params = new URLSearchParams({ api: "1", query: site.address });
  if (site.placeId) params.set("query_place_id", site.placeId);
  return `https://www.google.com/maps/search/?${params}`;
}

export interface RoomSummary {
  id: string;
  name: string;
  kind: RoomKind;
  role: RoomRole;
  site: RoomSite | null;
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

/** What the viewer needs of any file it previews, a room's or another's, like a deployment quote's. */
export type PreviewFile = Pick<RoomFile, "name" | "sizeBytes" | "createdAt">;

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
  | "room_address_change"
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
  room_address_change: "Changed address",
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

/** A pending invite, by the emailed link's token or, in the portal, by its member row. */
export type InviteRef = { token: string } | { memberId: string };

/** An invite waiting on the signed-in account, shown in its portal. */
export interface PendingInvite {
  memberId: string;
  roomName: string;
  role: RoomRole;
  invitedBy: string | null;
  /** The invite requires the MNDA and the account hasn't signed one yet. */
  needsMnda: boolean;
}
