export type UserRole = "member" | "team" | "super_admin";

export const USER_ROLES: readonly UserRole[] = ["member", "team", "super_admin"];

export const isUserRole = (value: unknown): value is UserRole => USER_ROLES.includes(value as UserRole);

/** `member` is stored as-is but shown as Regular: newsletter sign-ups, room guests and everyone else. */
export const ROLE_LABELS: Record<UserRole, string> = {
  member: "Regular",
  team: "Team",
  super_admin: "Super admin",
};

/** Each role's page in the portal's Users app, `/portal/users/<slug>`, named as the role is shown. */
export const ROLE_SLUGS: Record<UserRole, string> = {
  member: "regular",
  team: "team",
  super_admin: "super-admin",
};

export const roleForSlug = (slug: string | undefined): UserRole | null =>
  USER_ROLES.find((role) => ROLE_SLUGS[role] === slug) ?? null;

/** The roles an invite can grant. Super admins are made with Change role, never by invite. */
export type InviteRole = Exclude<UserRole, "super_admin">;

export const INVITE_ROLES: readonly InviteRole[] = ["member", "team"];

export const isInviteRole = (value: unknown): value is InviteRole => INVITE_ROLES.includes(value as InviteRole);

/** Super admins can do everything the Team can. */
export const onTeam = (role: UserRole): boolean => role === "team" || role === "super_admin";

export interface User {
  /** The ZODE user id. */
  id: number;
  zosUserId: string;
  role: UserRole;
  email: string | null;
  name: string | null;
  lastSeenAt: Date | null;
}

export interface RoleResult {
  readonly error?: string;
}
