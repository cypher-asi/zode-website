import type { Metadata } from "next";
import { PublishedPostPage, postMetadata } from "@/features/posts/pages";

export const revalidate = 3600;

/** None at build; each post renders on its first visit and is then cached until it's edited. */
export function generateStaticParams(): { slug: string }[] {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/news/[slug]">): Promise<Metadata> {
  return postMetadata("news", (await params).slug);
}

export default async function NewsPostPage({ params }: PageProps<"/news/[slug]">) {
  return <PublishedPostPage kind="news" slug={(await params).slug} />;
}
