export type UserRole = "member" | "super_admin";

export const isUserRole = (value: unknown): value is UserRole => value === "member" || value === "super_admin";

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
