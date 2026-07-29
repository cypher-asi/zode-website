import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep the API, auth, and customer-specific quote pages out of search.
      disallow: ["/api/", "/login", "/deck", "/deployments"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
