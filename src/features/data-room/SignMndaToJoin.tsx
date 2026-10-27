"use client";

import { useActionState, type ReactElement } from "react";
import { MndaForm } from "@/features/mnda/MndaForm";
import { signMndaAndAcceptInviteAction } from "./actions";
import type { ActionState, InviteRef } from "./types";

/** Signs the MNDA and accepts the invite in one step; success redirects into the room. */
export function SignMndaToJoin({
  invite,
  email,
  templateVersion,
}: {
  invite: InviteRef;
  email: string;
  templateVersion: string;
}): ReactElement {
  const [state, sign, pending] = useActionState<ActionState, FormData>(
    signMndaAndAcceptInviteAction.bind(null, invite),
    {},
  );
  return (
    <MndaForm
      action={sign}
      pending={pending}
      error={state.error ?? null}
      lockedEmail={email}
      templateVersion={templateVersion}
      submitLabel="Sign and open the data room"
    />
  );
}
