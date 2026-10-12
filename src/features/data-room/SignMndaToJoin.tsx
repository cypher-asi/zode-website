"use client";

import { useActionState, type ReactElement } from "react";
import { MndaForm } from "@/features/mnda/MndaForm";
import { signMndaAndAcceptInviteAction } from "./actions";
import type { ActionState } from "./types";

/** Signs the MNDA and accepts the invite in one step; success redirects into the room. */
export function SignMndaToJoin({ token, email }: { token: string; email: string }): ReactElement {
  const [state, sign, pending] = useActionState<ActionState, FormData>(
    signMndaAndAcceptInviteAction.bind(null, token),
    {},
  );
  return (
    <MndaForm
      action={sign}
      pending={pending}
      error={state.error ?? null}
      lockedEmail={email}
      submitLabel="Sign and open the data room"
    />
  );
}
