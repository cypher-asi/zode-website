import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { PublishedPostPage, postMetadata } from "@/features/posts/pages";

export async function generateMetadata({ params }: PageProps<"/changelog/[slug]">): Promise<Metadata> {
  return postMetadata("changelog", (await params).slug);
}

/** Renders per request around the entry, which is cached until it's edited. */
export default function ChangelogEntryPage({ params }: PageProps<"/changelog/[slug]">): ReactElement {
  return (
    <Suspense>
      <Post params={params} />
    </Suspense>
  );
}

async function Post({ params }: Pick<PageProps<"/changelog/[slug]">, "params">): Promise<ReactElement> {
  return <PublishedPostPage kind="changelog" slug={(await params).slug} />;
}
