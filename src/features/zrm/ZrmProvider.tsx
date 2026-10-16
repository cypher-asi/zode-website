"use client";

import {
  createContext,
  startTransition,
  use,
  useCallback,
  useMemo,
  useOptimistic,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSelectedLayoutSegments } from "next/navigation";
import {
  RECORD_APPS,
  type Option,
  type RecordAppId,
  type RecordKind,
  type SiteGroup,
  type SiteRoom,
  type SiteStatus,
  type Stage,
  type ZrmData,
} from "./types";

interface ZrmDataValue {
  data: ZrmData;
  /** The kinds this app has lists for. */
  kinds: readonly RecordKind[];
}

interface ZrmRouteValue {
  /** The route's segments below the app's base, ahead of the router while a navigation within it is in flight. */
  segments: readonly string[];
  /** Whether a navigation within the app is in flight, i.e. `segments` is ahead of what's rendered. */
  pending: boolean;
}

interface ZrmNavigateValue {
  /**
   * Navigates within the app, showing the destination's list and selection
   * before the server answers. Links into the other app (a site's company,
   * a company's sites) navigate as usual.
   */
  go: (href: string) => void;
  /** Prefetches a route once, again only after its prefetched data goes stale. */
  prefetch: (href: string) => void;
}

type ZrmContextValue = ZrmDataValue & ZrmRouteValue & ZrmNavigateValue;

/** Split so that what only reads the lists, or only navigates, doesn't re-render as each navigation starts and lands. */
const ZrmDataContext = createContext<ZrmDataValue | null>(null);
const ZrmRouteContext = createContext<ZrmRouteValue | null>(null);
const ZrmNavigateContext = createContext<ZrmNavigateValue | null>(null);

const pathOf = (href: string): string => new URL(href, "http://zrm").pathname;

/** Its type requires Next's internal `kind`, which defaults to auto when omitted. */
type PrefetchOptions = Parameters<ReturnType<typeof useRouter>["prefetch"]>[1];

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

  const [prefetched] = useState(() => new Set<string>());
  const prefetch = useCallback(
    (href: string) => {
      if (prefetched.has(href)) return;
      prefetched.add(href);
      router.prefetch(href, {
        onInvalidate: () => {
          prefetched.delete(href);
        },
      } as PrefetchOptions);
    },
    [router, prefetched],
  );

  const dataValue = useMemo(() => ({ data, kinds }), [data, kinds]);
  const routeValue = useMemo(
    () => ({
      segments: pending ? pathOf(pending).slice(prefix.length).split("/").filter(Boolean) : routed,
      pending: pending !== null,
    }),
    [pending, prefix, routed],
  );
  const navigateValue = useMemo(() => ({ go, prefetch }), [go, prefetch]);

  return (
    <ZrmDataContext value={dataValue}>
      <ZrmNavigateContext value={navigateValue}>
        <ZrmRouteContext value={routeValue}>{children}</ZrmRouteContext>
      </ZrmNavigateContext>
    </ZrmDataContext>
  );
}

function required<T>(value: T | null, hook: string): T {
  if (!value) throw new Error(`${hook} must be used inside ZrmProvider`);
  return value;
}

/** The app's lists and kinds, which change only when the server sends new data. */
export function useZrmData(): ZrmDataValue {
  return required(use(ZrmDataContext), "useZrmData");
}

/** The route as the app shows it, which changes as each navigation starts and lands. */
export function useZrmRoute(): ZrmRouteValue {
  return required(use(ZrmRouteContext), "useZrmRoute");
}

/** `go` and `prefetch`, which never change. */
export function useZrmNavigate(): ZrmNavigateValue {
  return required(use(ZrmNavigateContext), "useZrmNavigate");
}

export function useZrm(): ZrmContextValue {
  return { ...useZrmData(), ...useZrmRoute(), ...useZrmNavigate() };
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
  const { go } = useZrmNavigate();
  return <Link {...props} href={href} scroll={false} onClick={goOnClick(go, href)} />;
}

/** Choices for the reference fields. */
export interface RefOptions {
  companies: Option[];
  people: Option[];
  stages: Stage[];
  groups: SiteGroup[];
  statuses: SiteStatus[];
  rooms: SiteRoom[];
}

export function useRefOptions(): RefOptions {
  const { data } = useZrmData();
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
      rooms: data.rooms,
    }),
    [data],
  );
}
