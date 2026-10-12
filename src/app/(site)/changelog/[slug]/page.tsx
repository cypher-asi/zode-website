import type { Metadata } from "next";
import { PublishedPostPage, postMetadata } from "@/features/posts/pages";

export const revalidate = 3600;

/** None at build; each entry renders on its first visit and is then cached until it's edited. */
export function generateStaticParams(): { slug: string }[] {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/changelog/[slug]">): Promise<Metadata> {
  return postMetadata("changelog", (await params).slug);
}

export default async function ChangelogEntryPage({ params }: PageProps<"/changelog/[slug]">) {
  return <PublishedPostPage kind="changelog" slug={(await params).slug} />;
}
