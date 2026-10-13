"use client";

import {
  createContext,
  startTransition,
  use,
  useCallback,
  useMemo,
  useOptimistic,
  type ComponentProps,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegments } from "next/navigation";
import type { Option, Stage, ZrmData } from "./types";

interface ZrmContextValue {
  data: ZrmData;
  /** The route's segments below /portal/zrm, ahead of the router while a ZRM navigation is in flight. */
  segments: readonly string[];
  /** Whether a ZRM navigation is in flight, i.e. `segments` is ahead of what's rendered. */
  pending: boolean;
  /** Navigates within ZRM, showing the destination's list and selection before the server answers. */
  go: (href: string) => void;
}

const ZrmContext = createContext<ZrmContextValue | null>(null);

const PREFIX = "/portal/zrm/";

const segmentsOf = (href: string): string[] => new URL(href, "http://zrm").pathname.slice(PREFIX.length).split("/").filter(Boolean);

/** All of ZRM's lists, loaded once by its layout so tabs and records switch without refetching them. */
export function ZrmProvider({ data, children }: { data: ZrmData; children: ReactNode }): ReactElement {
  const router = useRouter();
  const routed = useSelectedLayoutSegments();
  const [pending, setPending] = useOptimistic<string | null>(null);

  const go = useCallback(
    (href: string) =>
      startTransition(() => {
        setPending(href);
        router.push(href, { scroll: false });
      }),
    [router, setPending],
  );

  const value = useMemo(
    () => ({ data, segments: pending ? segmentsOf(pending) : routed, pending: pending !== null, go }),
    [data, pending, routed, go],
  );

  return <ZrmContext value={value}>{children}</ZrmContext>;
}

export function useZrm(): ZrmContextValue {
  const value = use(ZrmContext);
  if (!value) throw new Error("useZrm must be used inside ZrmProvider");
  return value;
}

/** A Link's onClick that hands plain clicks to `go`, leaving new-tab and new-window clicks to the browser. */
export const goOnClick =
  (go: (href: string) => void, href: string) =>
  (event: MouseEvent<HTMLAnchorElement>): void => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go(href);
  };

/** A Link within ZRM, which switches the list and selection at once rather than when the server answers. */
export function ZrmLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href" | "onClick"> & { href: string }): ReactElement {
  const { go } = useZrm();
  return <Link {...props} href={href} scroll={false} onClick={goOnClick(go, href)} />;
}

/** Choices for the company, person and stage fields. */
export interface RefOptions {
  companies: Option[];
  people: Option[];
  stages: Stage[];
}

export function useRefOptions(): RefOptions {
  const { data } = useZrm();
  return useMemo(
    () => ({
      companies: data.companies.map((company) => ({ value: company.id, label: company.name })),
      people: data.people.map((person) => ({
        value: person.id,
        label: [[person.first_name, person.last_name].filter(Boolean).join(" "), person.company_name].filter(Boolean).join(" · "),
      })),
      stages: data.stages,
    }),
    [data],
  );
}
