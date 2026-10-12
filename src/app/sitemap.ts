import type { MetadataRoute } from "next";
import { loadPublished } from "@/features/posts/pages";
import { postHref } from "@/features/posts/types";
import { SITE_URL } from "@/lib/site";

const PUBLIC_ROUTES = [
  "",
  "/buy-compute",
  "/cluster-configurator",
  "/compute-model",
  "/contact",
  "/talk-to-an-engineer",
  "/news",
  "/changelog",
  "/styleguide",
  "/mnda",
  "/privacy",
  "/terms",
] as const;

/** Publishing revalidates this; the hour is a backstop. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));

  const [news, changelog] = await Promise.all([loadPublished("news"), loadPublished("changelog")]);
  const posts: MetadataRoute.Sitemap = [...(news ?? []), ...(changelog ?? [])].map((post) => ({
    url: `${SITE_URL}${postHref(post.kind, post.slug)}`,
    lastModified: post.updatedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...pages, ...posts];
}
