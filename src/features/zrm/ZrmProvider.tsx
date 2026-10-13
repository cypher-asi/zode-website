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
import { RECORD_APPS, type Option, type RecordAppId, type RecordKind, type SiteGroup, type SiteStatus, type Stage, type ZrmData } from "./types";

interface ZrmContextValue {
  data: ZrmData;
  /** The kinds this app has lists for. */
  kinds: readonly RecordKind[];
  /** The route's segments below the app's base, ahead of the router while a navigation within it is in flight. */
  segments: readonly string[];
  /** Whether a navigation within the app is in flight, i.e. `segments` is ahead of what's rendered. */
  pending: boolean;
  /**
   * Navigates within the app, showing the destination's list and selection
   * before the server answers. Links into the other app (a site's company,
   * a company's sites) navigate as usual.
   */
  go: (href: string) => void;
}

const ZrmContext = createContext<ZrmContextValue | null>(null);

const pathOf = (href: string): string => new URL(href, "http://zrm").pathname;

/**
 * All of the engine's lists, loaded once by the app's layout so tabs and
 * records switch without refetching them. ZRM and Capacity each wrap their
 * layout in one, with their own `app`.
 */
export function ZrmProvider({ app, data, children }: { app: RecordAppId; data: ZrmData; children: ReactNode }): ReactElement {
  const router = useRouter();
  const routed = useSelectedLayoutSegments();
  const [pending, setPending] = useOptimistic<string | null>(null);
  const { base, kinds } = RECORD_APPS[app];
  const prefix = `${base}/`;

  const go = useCallback(
    (href: string) =>
      startTransition(() => {
        if (pathOf(href).startsWith(prefix)) setPending(href);
        router.push(href, { scroll: false });
      }),
    [router, setPending, prefix],
  );

  const value = useMemo(
    () => ({
      data,
      kinds,
      segments: pending ? pathOf(pending).slice(prefix.length).split("/").filter(Boolean) : routed,
      pending: pending !== null,
      go,
    }),
    [data, kinds, pending, prefix, routed, go],
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

/** A Link to a record, which within the app switches the list and selection at once rather than when the server answers. */
export function ZrmLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href" | "onClick"> & { href: string }): ReactElement {
  const { go } = useZrm();
  return <Link {...props} href={href} scroll={false} onClick={goOnClick(go, href)} />;
}

/** Choices for the reference fields. */
export interface RefOptions {
  companies: Option[];
  people: Option[];
  stages: Stage[];
  groups: SiteGroup[];
  statuses: SiteStatus[];
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
      groups: data.groups,
      statuses: data.statuses,
    }),
    [data],
  );
}
