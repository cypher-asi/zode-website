---
name: Edit the MNDA requirement on pending data room invites
overview: Let data room admins turn the MNDA requirement on or off for an invite that hasn't been accepted yet, from the Pending invites list on the room's Members page, with the change recorded in the activity log.
todos:
- id: query
  content: Add setInviteMnda(roomId, memberId, requiresMnda) in src/features/data-room/invites.ts, limited to unaccepted rows
  status: completed
- id: action
  content: 'Add setInviteMndaAction in src/features/data-room/actions.ts: admin check, update, share with an existing account when turned off, audit event, refresh'
  status: completed
- id: audit
  content: Add invite_mnda_change to AuditAction and AUDIT_ACTION_LABELS in types.ts, and its describe() case on the activity page
  status: completed
- id: ui
  content: Replace the static MNDA badge with an optimistic toggle on pending invite rows in MembersPanel.tsx, plus styles in admin.module.css
  status: completed
- id: verify
  content: Typecheck and lint the changed files
  status: completed
---

## Current behaviour

- The requirement is stored per invite in `data_room_members.requires_mnda` (`db/schema.sql`). It's set when the invite is sent, from the "Require the mutual NDA" checkbox in `ShareDialog.tsx`.
- The only way to change it today is to re-invite the same email, since `issueInvite` overwrites a pending row (`src/features/data-room/invites.ts`). That also issues a new link and sends another email.
- Every place that enforces it reads the current value from the database at accept time: `bindInvite`, `acceptInvite`, `claimPendingInvites`, `listPendingInvites` and the two join pages. So once the stored value changes, the rest of the system follows it. **No schema change is needed.**

## Behaviour after the change

- **Where:** each row under **Pending invites** on the Members page (`MembersPanel.tsx`) gets an MNDA toggle next to the role picker. Only pending or expired invites have it; active members don't, since they've already joined.
- **Turning it on:** the invitee must sign the MNDA before joining, even with the link they already have. Nothing is emailed.
- **Turning it off when the invitee already has a ZODE account:** they're added to the room right away. That matches what happens when an invite without an MNDA goes to an existing account (`shareWithAccount`). The admin sees "Shared with X", and the row moves to People with access.
- **Turning it off when they have no account yet:** the invite stays pending, and their existing link now skips the MNDA step. Nothing is emailed.
- **Permissions:** room admins only, through the same `roomAccess(roomId, "admin")` check as the other member actions.
- **Activity log:** a new `invite_mnda_change` entry, labelled "Changed MNDA requirement", e.g. "Now required" or "No longer required, shared with their account".

## Files to change

1. **`src/features/data-room/invites.ts`:** add `setInviteMnda(roomId, memberId, requiresMnda)`. It updates only rows that haven't been accepted:
   ```ts
   update data_room_members set requires_mnda = ${requiresMnda}
   where room_id = ${roomId} and id = ${memberId} and accepted_at is null
   returning id, email, role, requires_mnda
   ```
   It returns the invite fields `shareWithAccount` needs, or `null` if the invite was already accepted or removed.
2. **`src/features/data-room/actions.ts`:** add `setInviteMndaAction(roomId, memberId, requiresMnda)`. It checks admin access and the member id, calls `setInviteMnda`, and returns early if nothing changed. When turning it off, it calls `shareWithAccount`. It records the audit event, calls `refresh()`, and returns `{ ok }` text such as "MNDA no longer required for X." or "Shared with X." It doesn't count against the invite-email rate limit, since nothing is sent.
3. **`src/features/data-room/types.ts`:** add `"invite_mnda_change"` to `AuditAction` and `AUDIT_ACTION_LABELS`.
4. **`src/app/(portal)/portal/data-rooms/[roomId]/activity/page.tsx`:** add a `describe()` case so the entry shows the email and the new setting.
5. **`src/features/data-room/MembersPanel.tsx`:** for rows that aren't active, replace the static "MNDA required" badge with a small toggle (checkbox labelled "Require MNDA", `aria-label` with the email). Update it optimistically with `useOptimistic`, as the role picker already does, and show the action's message in the existing `rowState` banner.
6. **`src/features/data-room/admin.module.css`:** styles for the toggle, matching `.roleSelect` and `.memberActions`.

## Edge cases

- **Race with acceptance:** the update only touches rows where `accepted_at is null`. If the invitee joins first, the action returns "That invite was already accepted or removed."
- **Invitee is on the join page while it changes:** `acceptInviteAction` and `signMndaAndAcceptInviteAction` call `findInvite` again, so they act on the new value. If the requirement is added while they're on the plain "Accept" screen, accepting returns `mnda-required` and the page sends them to sign it.
- **Expired invites:** the toggle still works and the change is kept. They still need a Resend to get a working link, which keeps the new setting because `reissueInvite` doesn't touch `requires_mnda`.
- **Portal refresh:** `roomsVersion` already includes `requires_mnda`, so an invitee with the portal open sees the change on its next refresh.

## Out of scope

- Share links for people without an account (`shareLinks.ts`) have no MNDA requirement today, so there's nothing to edit there.
- No email is sent when the requirement changes. That could be an option on the toggle later.