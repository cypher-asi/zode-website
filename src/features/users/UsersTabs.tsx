import type { ReactElement } from "react";
import Link from "next/link";
import tabs from "@/features/data-room/room.module.css";
import { ROLE_LABELS, ROLE_SLUGS, USER_ROLES, type UserRole } from "./types";

export type UsersTab = UserRole | "all" | "invites";

const TABS: readonly { id: UsersTab; label: string; href: string }[] = [
  { id: "all", label: "All", href: "/portal/users" },
  ...USER_ROLES.map((role) => ({ id: role, label: ROLE_LABELS[role], href: `/portal/users/${ROLE_SLUGS[role]}` })),
  { id: "invites", label: "Invites", href: "/portal/users/invites" },
];

/** The Users app's tabs: everyone, each role, and pending invites. */
export function UsersTabs({ current }: { current: UsersTab }): ReactElement {
  return (
    <nav className={tabs.tabs} aria-label="User types">
      {TABS.map((tab) => (
        <Link key={tab.id} href={tab.href} className={tabs.tab} aria-current={current === tab.id ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
