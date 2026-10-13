import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { PublishedPostPage, postMetadata } from "@/features/posts/pages";

export async function generateMetadata({ params }: PageProps<"/news/[slug]">): Promise<Metadata> {
  return postMetadata("news", (await params).slug);
}

/** Renders per request around the post, which is cached until it's edited. */
export default function NewsPostPage({ params }: PageProps<"/news/[slug]">): ReactElement {
  return (
    <Suspense>
      <Post params={params} />
    </Suspense>
  );
}

async function Post({ params }: Pick<PageProps<"/news/[slug]">, "params">): Promise<ReactElement> {
  return <PublishedPostPage kind="news" slug={(await params).slug} />;
}
