export type UserRole = "member" | "team" | "super_admin";

export const USER_ROLES: readonly UserRole[] = ["member", "team", "super_admin"];

export const isUserRole = (value: unknown): value is UserRole => USER_ROLES.includes(value as UserRole);

/** `member` is stored as-is but shown as Regular: newsletter sign-ups, room guests and everyone else. */
export const ROLE_LABELS: Record<UserRole, string> = {
  member: "Regular",
  team: "Team",
  super_admin: "Super admin",
};

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
