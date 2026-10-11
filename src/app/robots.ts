import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep the API and the auth and account pages out of search.
      disallow: ["/api/", "/login", "/register", "/portal"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
